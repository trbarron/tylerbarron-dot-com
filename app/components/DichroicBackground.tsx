import { useEffect, useRef } from "react";

import RetroreflectanceControls from "./RetroreflectanceControls";
import { useRetroreflectance } from "./retroreflectance-context";
import { DEFAULT_RETRO_PARAMS } from "./retroreflectance-params";

// Vertex shader - just passes through coordinates
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

/*
 * Fragment shader - retroreflective fabric (3M Scotchlite / "reflective
 * hoodie" look), following Silverwing VFX's (Raphael Rau) dichroic-glass and
 * retroreflector material approach.
 *
 * The physical story, and why the code is shaped the way it is:
 *
 *  1. Fabric. The same layered simplex noise that used to draw the caustics is
 *     now read as a HEIGHT FIELD; its gradient gives a per-pixel normal. The
 *     wrinkles are what the colour ends up painted along.
 *  2. Retroreflection. A glass-bead retroreflector sends light back down the
 *     axis it arrived on, so the light source effectively rides with the
 *     camera. Brightness therefore has nothing to do with a mirror lobe - it
 *     falls off with the ENTRANCE angle, dot(N, V), as beads at a steep tilt
 *     stop coupling light in.
 *  3. Colour. Each bead is a tiny lens with chromatic aberration, so the
 *     wavelength that returns strongest shifts with entrance angle and with
 *     the small observation angle between the illumination and viewing axes.
 *     That angle-driven hue sweep is the whole effect: folds become colour.
 *  4. Pastel, not rainbow. Head-on, the bead returns a broad slice of the
 *     spectrum and reads white; obliquely it returns a narrow slice and
 *     saturates. Modelled as a Gaussian band over the spectrum whose width
 *     tracks dot(N, V) - see spectralBand().
 *  5. Dichroic pairing. What isn't retroreflected scatters with the
 *     COMPLEMENTARY hue (Silverwing's reflected/transmitted ramp inversion).
 *     That is the magenta-next-to-green adjacency of real reflective fabric.
 *
 * Everything below is tuned to stay a light background: the page is white and
 * content sits on bg-white/95 cards, so the output is kept high-value pastel
 * rather than the vivid-on-black look of a flash photograph.
 */
const fragmentShaderSource = `
  precision highp float;

  varying vec2 v_texCoord;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_scroll; // viewports scrolled, smoothed on the JS side

  /*
   * Runtime knobs, driven by the on-page controls. Only the look-related
   * constants were promoted to uniforms; the surface/geometry ones below stay
   * compiled in because they are calibrated against the noise's actual gradient
   * magnitude and are not safe to dial freely. u_amount is the master - at 0
   * the shader returns pure white and the page looks untouched.
   */
  uniform float u_amount;
  uniform float u_saturation;
  uniform float u_hueA;
  uniform float u_hueB;
  uniform float u_greyPoint;
  uniform float u_colorPoint;
  uniform float u_dispersion;
  uniform float u_scrollHue;
  uniform float u_sparkle;
  uniform float u_greyscale;

  #define TAU 6.28318530718

  // --- Surface -------------------------------------------------------------
  // NB: these look implausibly small. The height gradient is a finite
  // difference over eps, and snoise() below overshoots [-1,1] by a good margin,
  // so the raw gradient lands around 2-3 - an order of magnitude above what the
  // amplitudes suggest. They are scaled to put |grad| near 0.3, i.e. tilts of
  // ~17 degrees. Raise them and the normals tip past grazing, dot(N,V) clamps
  // to zero, entrance angle pins at 90 degrees, and the hue flattens into solid
  // patches of one colour. MAX_TILT below is the backstop.
  const float MAX_TILT      = 0.9;   // hard ceiling on normal tilt
  const float DRAPE_DEPTH   = 0.006; // large swells of hanging fabric. These do
                                    // most of the work: they sweep the entrance
                                    // angle across whole regions of the frame,
                                    // which is what paints the broad colour
                                    // fields. Wrinkles alone only ever give
                                    // per-crease fringing.
  const float WRINKLE_DEPTH = 0.0012; // creases riding on top of the drape
  // --- Camera / light rig --------------------------------------------------
  const float VIEW_SPREAD  = 1.15;   // perspective: view-ray tilt at frame edge
  const float OBS_OFFSET   = 0.06;   // observation angle (light off camera axis)
  // --- Retroreflector ------------------------------------------------------
  const float ENTRANCE_FALLOFF = 1.4;  // efficiency loss with entrance angle
  const float OBS_DISPERSION   = 2.5;  // hue shift per unit observation angle
  const float HUE_DRIFT        = 0.12; // slow global drift, cycles per unit t
  const float HUE_WARP         = 0.16; // bias the wheel toward magenta/green
  const float BAND_OBLIQUE     = 0.10; // narrow return band -> saturated
  const float BAND_NORMAL      = 0.26; // broad return band  -> washed out
  // --- Gamut ---------------------------------------------------------------
  // Real reflective fabric does not sweep the whole spectrum; a given bead size
  // and coating oscillates between two dominant interference colours. So the
  // phase drives a ramp between two hues rather than a lap of the whole wheel.
  //
  // Wheel landmarks: 0.0 red, 0.08 orange, 0.16 amber, 0.35 green, 0.5 cyan,
  // 0.67 blue, 0.85 magenta.
  //
  // GOTCHA: these interpolate linearly, so the sweep runs along the wheel
  // between them rather than taking the short way round. Going amber -> red is
  // 0.16 -> 0.0; writing it 0.16 -> 1.0 is the same colour at the far end but
  // drags the sweep backwards through green, cyan and blue to get there.
  //
  // Selective saturation. A dichroic stack only returns a narrow band over part
  // of its cycle; over the rest it reflects broadband and reads as neutral
  // silver. So saturation is a function of the sweep rather than a constant,
  // and the material goes grey -> orange -> red instead of being colourful
  // everywhere. Below u_greyPoint the sweep is neutral, above u_colorPoint it
  // carries full u_saturation, and it eases between the two.
  // --- Scroll response -----------------------------------------------------
  // Scrolling is treated as moving relative to the material rather than as a
  // pan of a static image: the fabric drifts (parallax), the retroreflective
  // hotspot travels as the illumination axis swings, and the observation angle
  // changes, which sweeps the hue. That last one is the whole point - it is why
  // a reflective jacket changes colour as you move past it.
  const float SCROLL_PARALLAX = 0.10; // fabric drift per viewport scrolled
  const float SCROLL_HOTSPOT  = 0.35; // travel of the bright spot, bounded
  // --- Look ----------------------------------------------------------------
  const float TRANSMIT_MIX = 0.55;   // how much complementary scatter shows
  const float DEPTH        = 0.26;   // darkest the background is allowed to go
  const float CREASE_SHADE = 0.45;   // self-shadowing in the creases
  // Greyscale. Two different things could be meant here, so this is separate
  // from u_saturation rather than folded into it:
  //   u_greyscale = 1.0  keeps the iridescent banding, rendered as tone.
  //   u_saturation = 0.0 drops the banding, leaving only the fold shading.
  // See the note by the conversion at the bottom of main().

  // Simplex noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m*m*m;
    vec3 x = 7.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  /*
   * The fabric, as a height field, at two scales: slow drape and fine wrinkle.
   * The wrinkle terms are the same layered simplex noise that used to be read
   * directly as caustic lines, so the new surface still creases along the
   * shapes the background always had.
   */
  float surfaceHeight(vec2 uv, float t) {
    float drape = snoise(uv * 0.7 + t * 0.04);
    float wrinkle = snoise(uv * 3.0 + t * 0.08) * 0.6
                  + snoise(uv * 4.0 - t * 0.05 + 100.0) * 0.4;
    return drape * DRAPE_DEPTH + wrinkle * WRINKLE_DEPTH;
  }

  /*
   * Gaussian-weighted average of the spectrum, centred on 'peak' (a cyclic
   * wavelength coordinate, wrapping through the purples so interference orders
   * are continuous) with standard deviation bandwidth/sqrt(2).
   *
   * For a cosine-model spectrum the integral has a closed form: the Gaussian
   * survives only as a single saturation factor exp(-pi^2 * bandwidth^2). So a
   * narrow return band stays saturated and a broad one collapses to white,
   * which is exactly the head-on-reads-white behaviour of a bead sheet - with
   * no per-pixel sampling loop.
   */
  vec3 spectralBand(float peak, float bandwidth) {
    float sat = exp(-9.8696044 * bandwidth * bandwidth);
    float x = TAU * peak;
    return 0.5 + 0.5 * sat * vec3(cos(x), cos(x - 2.0943951), cos(x - 4.1887902));
  }

  void main() {
    vec2 uv = v_texCoord;
    float t = u_time * 0.15; // Slow, gentle movement

    // Aspect ratio correction for even distribution. The fabric itself drifts
    // with the scroll, so the material reads as attached to the page.
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y + u_scroll * SCROLL_PARALLAX);

    // --- Surface normal from the height field --------------------------------
    float eps = 0.006;
    float h  = surfaceHeight(p, t);
    float hx = surfaceHeight(p + vec2(eps, 0.0), t);
    float hy = surfaceHeight(p + vec2(0.0, eps), t);

    vec2 grad = (vec2(hx, hy) - h) / eps;
    // Soft limit: linear while the surface is gently sloped, asymptotic to
    // MAX_TILT, so a noise spike can never tip the normal past grazing.
    grad /= 1.0 + length(grad) / MAX_TILT;
    vec3 N = normalize(vec3(-grad, 1.0));

    // --- View and light. Retroreflective, so the light rides with the eye ---
    // The hotspot travels with the scroll, bounded by s/(1+|s|) so a long page
    // swings the illumination axis without ever driving it off to infinity.
    float scrollBounded = u_scroll / (1.0 + abs(u_scroll));
    vec2 c = (uv - vec2(0.5, 0.5 + SCROLL_HOTSPOT * scrollBounded)) * vec2(aspect, 1.0);
    vec3 V = normalize(vec3(-c * VIEW_SPREAD, 1.0)); // surface -> eye
    vec3 L = normalize(V + OBS_OFFSET * vec3(cos(t * 0.9), sin(t * 0.7), 0.0));

    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float entrance = acos(ndv);                          // bead entrance angle
    float alpha = acos(clamp(dot(V, L), -1.0, 1.0));     // observation angle
    float eff = pow(ndv, ENTRANCE_FALLOFF);              // return efficiency

    // Dispersion: which wavelength comes back strongest, as a function of the
    // two angles. This is what turns the fold field into bands of colour.
    float peak = fract(u_dispersion * entrance + OBS_DISPERSION * alpha
                       + HUE_DRIFT * t + u_scrollHue * u_scroll);
    peak = fract(peak + HUE_WARP * sin(TAU * peak));

    // Dichroic pairing: where little is retroreflected, what you see instead is
    // the scattered half-order, a complementary hue. Applied as a shift of the
    // PHASE rather than a blend of the two colours - crossfading a hue with its
    // complement cancels to grey, whereas rotating the phase sweeps through the
    // intermediate hues, which is how real reflective fabric goes magenta ->
    // cyan -> green rather than magenta -> grey -> green.
    peak = fract(peak + 0.5 * TRANSMIT_MIX * (1.0 - eff));

    // The sweep, 0..1. cos() keeps it smooth and periodic with no seam where
    // the phase wraps. Both the hue and how saturated it gets ride on this one
    // value, so colour blooms and fades in step with the sweep.
    float sweep = 0.5 - 0.5 * cos(TAU * peak);
    float hue = mix(u_hueA, u_hueB, sweep);
    float saturation = u_saturation * smoothstep(u_greyPoint, u_colorPoint, sweep);

    // Head-on returns a broad band (washed out), oblique a narrow one (saturated).
    float bandwidth = mix(BAND_OBLIQUE, BAND_NORMAL, pow(ndv, 4.0));
    vec3 tint = spectralBand(hue, bandwidth);

    // Normalise to full value so a hue sweep does not read as a brightness
    // sweep, then pull toward white for a pastel that text can sit on.
    tint /= max(max(tint.r, max(tint.g, tint.b)), 1e-3);
    // The (1 - u_sparkle) leaves exactly enough headroom for the bead glints
    // below; without it the normalised tint already peaks at 1.0 and every
    // glint clips instead of reading as a highlight.
    vec3 pastel = mix(vec3(1.0), tint, saturation) * (1.0 - u_sparkle);

    // Structure: creases self-shadow. Steep gradient is where the old caustic
    // lines ran, so the drawing the background always had survives as shading
    // on the fabric instead of being the whole image.
    float crease = smoothstep(0.15, 1.1, length(grad));
    float lum = eff * (1.0 - CREASE_SHADE * crease);

    vec3 color = pastel * mix(1.0 - DEPTH, 1.0, lum);

    // Individual beads catching the light. Thresholded rather than raised to a
    // power: snoise() overshoots [-1,1], and pow(1.5, 8.0) is 25, which blew
    // the glints into hard white patches.
    float bead = snoise(p * 180.0 + t * 0.2);
    color += u_sparkle * smoothstep(0.55, 1.0, bead) * eff;

    /*
     * Greyscale by mapping to Rec.709 luma, not by zeroing saturation. The two
     * are genuinely different pictures: the hues this sweeps have very
     * different brightness (green ~0.72 luma, magenta ~0.28), so a luma map
     * keeps the iridescent bands as tonal bands and the colour shift still
     * reads. Zeroing saturation instead throws the bands away and leaves only
     * the fold shading and the hotspot - flatter, more like brushed metal.
     */
    color = mix(color, vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), u_greyscale);

    // Master fade. At u_amount = 0 this is exactly vec3(1.0), so the default
    // state of the page is pure white rather than a faint tint.
    color = mix(vec3(1.0), color, u_amount);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export default function DichroicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  /*
   * The effect is opt-in: the page is pure white until a visitor asks for it.
   * State lives in a context because the trigger is down in the footer, a
   * separate subtree. It is mirrored into refs because the WebGL setup runs
   * once and the render loop reads it every frame - putting it in the effect's
   * dependencies would tear down and rebuild the GL context on every slider
   * tick.
   */
  const retro = useRetroreflectance();
  const enabled = retro?.enabled ?? false;
  const params = retro?.params ?? DEFAULT_RETRO_PARAMS;
  const setSupported = retro?.setSupported;

  const enabledRef = useRef(enabled);
  const paramsRef = useRef(params);
  const amountRef = useRef(0);
  const startLoopRef = useRef<(() => void) | null>(null);
  const setSupportedRef = useRef(setSupported);

  useEffect(() => {
    setSupportedRef.current = setSupported;
  }, [setSupported]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    enabledRef.current = enabled;
    // Fading out is handled by the loop itself, which stops once it settles.
    if (enabled) startLoopRef.current?.();
  }, [enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      // No point offering a control that cannot do anything.
      setSupportedRef.current?.(false);
      return;
    }

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    // Set up geometry (full-screen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      gl.STATIC_DRAW,
    );

    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const scrollLocation = gl.getUniformLocation(program, "u_scroll");
    const amountLocation = gl.getUniformLocation(program, "u_amount");
    const paramLocations = {
      saturation: gl.getUniformLocation(program, "u_saturation"),
      hueA: gl.getUniformLocation(program, "u_hueA"),
      hueB: gl.getUniformLocation(program, "u_hueB"),
      greyPoint: gl.getUniformLocation(program, "u_greyPoint"),
      colorPoint: gl.getUniformLocation(program, "u_colorPoint"),
      dispersion: gl.getUniformLocation(program, "u_dispersion"),
      scrollHue: gl.getUniformLocation(program, "u_scrollHue"),
      sparkle: gl.getUniformLocation(program, "u_sparkle"),
      greyscale: gl.getUniformLocation(program, "u_greyscale"),
    } as const;

    /*
     * Scroll, measured in viewports. Read in a passive listener and eased
     * toward in the render loop rather than used raw: the easing gives the
     * material some inertia, so the colour keeps settling for a moment after
     * you stop, instead of snapping. Seeded so a page restored mid-scroll does
     * not sweep the whole hue range on load.
     */
    const readScroll = () => window.scrollY / Math.max(window.innerHeight, 1);
    let scrollTarget = readScroll();
    let scrollSmoothed = scrollTarget;

    const onScroll = () => {
      scrollTarget = readScroll();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    /*
     * Resizing reallocates the drawing buffer, which comes back cleared to
     * transparent black - and with alpha:false that composites as black, not
     * white. So anything that resizes while the loop is parked has to repaint.
     */
    const paintWhite = () => {
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };

    let frame: number | null = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (frame === null) paintWhite();
    };

    /*
     * Easing is done against elapsed time, not per frame. A fixed per-frame
     * factor is frame-rate dependent: the same code crawls on a throttled or
     * 30Hz display and runs twice too fast at 120Hz. dt is clamped so returning
     * to a backgrounded tab eases in rather than jumping.
     */
    let lastFrame = performance.now();
    const easing = (dt: number, seconds: number) => 1 - Math.exp(-dt / seconds);

    // Render loop
    const render = () => {
      const now = performance.now();
      const dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;

      const current = paramsRef.current;
      const target = enabledRef.current ? current.amount : 0;
      amountRef.current += (target - amountRef.current) * easing(dt, 0.25);

      /*
       * Once switched off and faded out there is nothing to draw, so park the
       * loop rather than burn a full-screen fragment shader every frame for a
       * white rectangle. The `enabled` effect restarts it.
       */
      if (!enabledRef.current && amountRef.current < 0.002) {
        amountRef.current = 0;
        paintWhite();
        frame = null;
        return;
      }

      const time = (Date.now() - startTimeRef.current) / 1000;

      gl.useProgram(program);

      scrollSmoothed += (scrollTarget - scrollSmoothed) * easing(dt, 0.2);

      // Set uniforms
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(scrollLocation, scrollSmoothed);
      gl.uniform1f(amountLocation, amountRef.current);
      gl.uniform1f(paramLocations.saturation, current.saturation);
      gl.uniform1f(paramLocations.hueA, current.hueA);
      gl.uniform1f(paramLocations.hueB, current.hueB);
      gl.uniform1f(paramLocations.greyPoint, current.greyPoint);
      gl.uniform1f(paramLocations.colorPoint, current.colorPoint);
      gl.uniform1f(paramLocations.dispersion, current.dispersion);
      gl.uniform1f(paramLocations.scrollHue, current.scrollHue);
      gl.uniform1f(paramLocations.sparkle, current.sparkle);
      gl.uniform1f(paramLocations.greyscale, current.greyscale);

      // Bind position buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Bind texCoord buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.enableVertexAttribArray(texCoordLocation);
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      frame = requestAnimationFrame(render);
    };

    startLoopRef.current = () => {
      if (frame === null) frame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);

    // Default state: a pure white page, with the loop parked.
    paintWhite();
    if (enabledRef.current) startLoopRef.current();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      startLoopRef.current = null;
      if (frame !== null) cancelAnimationFrame(frame);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
      />
      {retro && (
        <RetroreflectanceControls
          enabled={enabled}
          params={params}
          onEnabledChange={retro.setEnabled}
          onParamsChange={retro.setParams}
        />
      )}
    </>
  );
}
