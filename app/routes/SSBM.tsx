import { useState } from "react";
import LightboxComponent from "../components/LazyLightbox";
import { buildMeta } from "~/utils/seo";

export function meta() {
  return buildMeta({
    title: "Super Smash Bros. Melee",
    description: "Competitive Melee and custom GameCube controller builds, with photos.",
    path: "/SSBM",
  });
}

const boxxRender = getImageUrl("SSBM/boxxRender.jpg");
const barronBoxx = getImageUrl("SSBM/barronBoxx.jpg");
const stadiumTransformed = getImageUrl("SSBM/stadiumTransformed.jpg");
const shiek = getImageUrl("SSBM/shiek.jpg");
const marth = getImageUrl("SSBM/marth.jpg");
const gameCubeController = getImageUrl("SSBM/gameCubeController.jpg");
const fox = getImageUrl("SSBM/fox.jpg");
const falco2 = getImageUrl("SSBM/falco2.jpg");
const falco1 = getImageUrl("SSBM/falco1.jpg");
// Import components
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";

// Import assets

import { getImageUrl } from "~/utils/cdn";

const SSBM = () => {
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Group photos by section for easier management
  const textureModPhotos = [
    { src: falco1, alt: "Falco UW", caption: "Falco wearing UW colors" },
    { src: fox, alt: "Fox UW", caption: "UW Fox" },
    { src: marth, alt: "Marth UW", caption: "Marth with a UW sword gradient" },
    { src: shiek, alt: "Shiek UW", caption: "UW Shiek" },
    {
      src: stadiumTransformed,
      alt: "UW Stadium",
      caption: "No-Transform Pokemon Stadium",
    },
    {
      src: falco2,
      alt: "Falco Lasers",
      caption: "The space animals have purple and gold lasers",
    },
  ];

  const boxxPhotos = [
    {
      src: gameCubeController,
      alt: "Gamecube Controllers",
      caption: "My Modded Gamecube Controllers",
    },
    { src: boxxRender, alt: "B0XX Render", caption: "Controller Rendering" },
    {
      src: barronBoxx,
      alt: "Barron B0XX",
      caption: "Completed Controller, ready to use",
    },
  ];

  // Combine all photos for the lightbox
  const allPhotos = [...textureModPhotos, ...boxxPhotos];

  const openLightbox = (index: number) => {
    setPhotoIndex(index);
    setOpen(true);
  };

  const PhotoComponent = ({
    photo,
    index,
  }: {
    photo: (typeof allPhotos)[0];
    index: number;
  }) => (
    <div
      onClick={() => openLightbox(index)}
      className="my-5 cursor-pointer text-center"
    >
      <img
        src={photo.src}
        alt={photo.alt}
        className="mx-auto block h-auto max-w-full"
      />
      {photo.caption && <p className="mt-2.5 italic">{photo.caption}</p>}
    </div>
  );

  const VideoComponent = ({
    src,
    caption,
  }: {
    src: string;
    caption?: string;
  }) => (
    <div className="my-5">
      <div className="relative h-0 overflow-hidden pb-[56.25%]">
        <iframe
          className="absolute top-0 left-0 h-full w-full"
          src={src}
          title={caption || "Video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
      {caption && <p className="mt-2.5 italic">{caption}</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-black bg-fixed relative z-10">
      <Navbar />
      <main className="flex-grow">
        <section className="article">
          <article className="article-card">
            <header className="article-header">
              <h1 className="article-title">Super Smash Bros. Melee</h1>
            </header>
            <div className="prose">
              <section className="subarticle prose">
                <h3 className="subarticle-title">UW Texture Mod V1.10</h3>
                <div className="overflow-hidden bg-white break-words">
                  <p>
                    Super Smash Bros. Melee is a "beautiful accident" because of
                    it's speed, balance and ability for self-expression. It came
                    out before the internet so it hasn't had balance patches,
                    DLC or visual updates. This mod was an attempt to give our
                    college's competitive scene a unique skin for the game
                  </p>

                  <PhotoComponent photo={textureModPhotos[0]} index={0} />

                  <p>
                    The most popular characters got alternate costumes with our
                    school's colors
                  </p>

                  <PhotoComponent photo={textureModPhotos[1]} index={1} />

                  <p className="w-screen"></p>

                  <PhotoComponent photo={textureModPhotos[2]} index={2} />

                  <p className="w-screen"></p>

                  <PhotoComponent photo={textureModPhotos[3]} index={3} />

                  <p>
                    I modified the stage Pokémon Stadium to have the UW Logo
                  </p>

                  <PhotoComponent photo={textureModPhotos[4]} index={4} />

                  <p>
                    Finally, Fox and Falco's lasers are now purple. Like all the
                    other mods this is togglable
                  </p>

                  <PhotoComponent photo={textureModPhotos[5]} index={5} />
                </div>
              </section>

              <section className="subarticle prose">
                <h3 className="subarticle-title">How to get it:</h3>
                <div className="overflow-hidden bg-white break-words">
                  <p>
                    You can get the rom by asking at the UW Smash Club.{" "}
                    <a href="https://www.facebook.com/groups/udistrictsmash/about/">
                      Find their events on their Facebook page
                    </a>
                  </p>
                </div>
              </section>
            </div>
          </article>
        </section>

        <section className="article">
          <article className="article-card">
            <header className="article-header">
              <h1 className="article-title">Custom Gamecube Controllers</h1>
            </header>
            <div className="prose">
              <section className="subarticle prose">
                <h3 className="subarticle-title">Barron B0XX</h3>
                <div className="overflow-hidden bg-white break-words">
                  <p>
                    There is a small slice of the world who is still into Super
                    Smash Bros. Melee on the Nintendo Gamecube. Over time
                    players have asked more and more of themselves to reach
                    higher heights. One roadblock to this is the physical
                    controller and it's inherent flaws. This project aims to
                    solve some of those drawbacks
                  </p>

                  <PhotoComponent
                    photo={boxxPhotos[0]}
                    index={textureModPhotos.length}
                  />

                  <p>
                    This started with someone who need it most, Hax$. He is a
                    top 20 player known for his extreme speed at the game but
                    this speed came at a cost -- his hands. After several
                    surgeries to reconstruct his hands he had to start over. He
                    designed an ergonomic keyboard style controller called the
                    B0XX.
                  </p>

                  <VideoComponent
                    src="https://www.youtube.com/embed/KdSd2CBcSJc"
                    caption="Hax's playstyle (that destroyed his hands)"
                  />

                  <p>
                    Hax promised to sell these controllers but he was very slow
                    to make it market. As a result I decided to build my own
                  </p>

                  <PhotoComponent
                    photo={boxxPhotos[1]}
                    index={textureModPhotos.length + 1}
                  />

                  <p className="w-screen"></p>

                  <p>
                    I linked a more detailed build process. The build itself
                    took 20 hours, two hardware trips, five online orders and
                    one burnt thumb. The code is based on SimpleController's,
                    modified for my button layout and application. The only
                    thing left is to get good with it
                  </p>

                  <PhotoComponent
                    photo={boxxPhotos[2]}
                    index={textureModPhotos.length + 2}
                  />
                </div>
              </section>

              <section className="subarticle prose">
                <h3 className="subarticle-title">How to get it:</h3>
                <div className="overflow-hidden bg-white break-words">
                  <p>
                    <a href="https://imgur.com/a/M2QSR">
                      You can better follow / copy my build process here
                    </a>
                  </p>
                  <p>
                    <a href="https://github.com/trbarron/SimpleControllersBuild-a-Box/blob/master/Barron_B0XX_Arduino.ino">
                      The code can be found here
                    </a>
                  </p>
                </div>
              </section>
            </div>
          </article>
        </section>
      </main>
      <Footer />
      <LightboxComponent
        open={open}
        close={() => setOpen(false)}
        slides={allPhotos}
        index={photoIndex}
      />
    </div>
  );
};

export default SSBM;
