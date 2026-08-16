/*
 * The knobs the retroreflective background exposes at runtime.
 *
 * These are the subset of the shader's constants worth handing to a visitor -
 * the ones that change the look rather than the ones that keep the simulation
 * physically sane. The surface/geometry constants (MAX_TILT, DRAPE_DEPTH,
 * WRINKLE_DEPTH ...) deliberately stay compiled in: they are calibrated against
 * the noise's actual gradient magnitude, and letting them be dialled freely tips
 * the normals past grazing and flattens the whole effect into solid patches.
 */

export interface RetroParams {
  /** Master. 0 leaves the page pure white; the effect fades up from there. */
  amount: number;
  saturation: number;
  /** Hue at the neutral end of the sweep. */
  hueA: number;
  /** Hue at the saturated end. */
  hueB: number;
  /** Below this point in the sweep the material reads neutral silver. */
  greyPoint: number;
  /** Above this point it carries full saturation. */
  colorPoint: number;
  dispersion: number;
  scrollHue: number;
  sparkle: number;
  greyscale: number;
}

export interface RetroParamSpec {
  key: keyof RetroParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const DEFAULT_RETRO_PARAMS: RetroParams = {
  amount: 1,
  saturation: 0.72,
  hueA: 0.16,
  hueB: 0,
  greyPoint: 0.22,
  colorPoint: 0.72,
  dispersion: 1.1,
  scrollHue: 0.45,
  sparkle: 0.04,
  greyscale: 0,
};

/*
 * Hue is a position on a colour wheel, not a wavelength in nm: 0.0 red,
 * 0.08 orange, 0.16 amber, 0.35 green, 0.5 cyan, 0.67 blue, 0.85 magenta.
 * From/To interpolate linearly, so the sweep travels along the wheel between
 * them rather than taking the short way round - 0.16 -> 0.0 is amber through
 * orange to red, while 0.16 -> 1.0 lands on the same red but drags the sweep
 * backwards through green, cyan and blue to get there.
 */
export const RETRO_PARAM_SPECS: RetroParamSpec[] = [
  {
    key: "amount",
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "saturation",
    label: "Saturation",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "hueA",
    label: "Hue from",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "hueB",
    label: "Hue to",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "greyPoint",
    label: "Grey below",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "colorPoint",
    label: "Color above",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "dispersion",
    label: "Dispersion",
    min: 0,
    max: 4,
    step: 0.05,
  },
  {
    key: "scrollHue",
    label: "Scroll shift",
    min: 0,
    max: 1.5,
    step: 0.01,
  },
  {
    key: "sparkle",
    label: "Sparkle",
    min: 0,
    max: 0.2,
    step: 0.005,
  },
  {
    key: "greyscale",
    label: "Greyscale",
    min: 0,
    max: 1,
    step: 0.01,
  },
];
