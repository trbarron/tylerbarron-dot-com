import React, { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// Import components
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import { Subarticle } from "../components/Subarticle.js";
import Article from "../components/Article.js";

// Import assets
import falco1 from "~/images/SSBM/falco1.jpg";
import falco2 from "~/images/SSBM/falco2.jpg";
import fox from "~/images/SSBM/fox.jpg";
import gameCubeController from "~/images/SSBM/gameCubeController.jpg";
import marth from "~/images/SSBM/marth.jpg";
import shiek from "~/images/SSBM/shiek.jpg";
import stadiumTransformed from "~/images/SSBM/stadiumTransformed.jpg";
import barronBoxx from "~/images/SSBM/barronBoxx.jpg";
import boxxRender from "~/images/SSBM/boxxRender.jpg";

const SSBM = () => {
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Group photos by section for easier management
  const textureModPhotos = [
    { src: falco1, alt: "Falco UW", caption: "Falco wearing UW colors" },
    { src: fox, alt: "Fox UW", caption: "UW Fox" },
    { src: marth, alt: "Marth UW", caption: "Marth with a UW sword gradient" },
    { src: shiek, alt: "Shiek UW", caption: "UW Shiek" },
    { src: stadiumTransformed, alt: "UW Stadium", caption: "No-Transform Pokemon Stadium" },
    { src: falco2, alt: "Falco Lasers", caption: "The space animals have purple and gold lasers" }
  ];

  const boxxPhotos = [
    { src: gameCubeController, alt: "Gamecube Controllers", caption: "My Modded Gamecube Controllers" },
    { src: boxxRender, alt: "B0XX Render", caption: "Controller Rendering" },
    { src: barronBoxx, alt: "Barron B0XX", caption: "Completed Controller, ready to use" }
  ];

  // Combine all photos for the lightbox
  const allPhotos = [...textureModPhotos, ...boxxPhotos];

  const openLightbox = (index) => {
    setPhotoIndex(index);
    setOpen(true);
  };

  const PhotoComponent = ({ photo, index }) => (
    <div onClick={() => openLightbox(index)} style={{cursor: 'pointer', margin: '20px 0', textAlign: 'center'}}>
      <img src={photo.src} alt={photo.alt} style={{maxWidth: '100%', height: 'auto', margin: '0 auto', display: 'block'}} />
      {photo.caption && <p style={{fontStyle: 'italic', marginTop: '10px'}}>{photo.caption}</p>}
    </div>
  );

  const VideoComponent = ({ src, caption }) => (
    <div style={{margin: '20px 0'}}>
      <div className="video-container" style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
        <iframe 
          style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
          src={src}
          title={caption || "Video"}
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen>
        </iframe>
      </div>
      {caption && <p style={{fontStyle: 'italic', marginTop: '10px'}}>{caption}</p>}
    </div>
  );

  return (
    <div className="bg-black dark:bg-white bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="Super Smash Bros. Melee" subtitle="">
          <Subarticle subtitle="UW Texture Mod V1.10">
            <p>Super Smash Bros. Melee is a "beautiful accident" because of it's speed, balance and ability for self-expression. It came out before the internet so it hasn't had balance patches, DLC or visual updates. This mod was an attempt to give our college's competitive scene a unique skin for the game</p>
            
            <PhotoComponent photo={textureModPhotos[0]} index={0} />
            
            <p>The most popular characters got alternate costumes with our school's colors</p>
            
            <PhotoComponent photo={textureModPhotos[1]} index={1} />
            
            <p className="w-screen"></p>
            
            <PhotoComponent photo={textureModPhotos[2]} index={2} />
            
            <p className="w-screen"></p>
            
            <PhotoComponent photo={textureModPhotos[3]} index={3} />
            
            <p>I modified the stage Pokémon Stadium to have the UW Logo</p>
            
            <PhotoComponent photo={textureModPhotos[4]} index={4} />
            
            <p>Finally, Fox and Falco's lasers are now purple. Like all the other mods this is togglable</p>
            
            <PhotoComponent photo={textureModPhotos[5]} index={5} />
          </Subarticle>
          
          <Subarticle subtitle="How to get it:">
            <p>You can get the rom by asking at the UW Smash Club. <a href="https://www.facebook.com/groups/udistrictsmash/about/">Find their events on their Facebook page</a></p>
          </Subarticle>
        </Article>

        <Article title="Custom Gamecube Controllers" subtitle="">
          <Subarticle subtitle="Barron B0XX">
            <p>There is a small slice of the world who is still into Super Smash Bros. Melee on the Nintendo Gamecube. Over time players have asked more and more of themselves to reach higher heights. One roadblock to this is the physical controller and it's inherent flaws. This project aims to solve some of those drawbacks</p>
            
            <PhotoComponent photo={boxxPhotos[0]} index={textureModPhotos.length} />
            
            <p>This started with someone who need it most, Hax$. He is a top 20 player known for his extreme speed at the game but this speed came at a cost -- his hands. After several surgeries to reconstruct his hands he had to start over. He designed an ergonomic keyboard style controller called the B0XX.</p>
                        
            <VideoComponent 
              src="https://www.youtube.com/embed/KdSd2CBcSJc"
              caption="Hax's playstyle (that destroyed his hands)"
            />
            
            <p>Hax promised to sell these controllers but he was very slow to make it market. As a result I decided to build my own</p>
            
            <PhotoComponent photo={boxxPhotos[1]} index={textureModPhotos.length + 1} />
            
            <p className="w-screen"></p>
                        
            <p>I linked a more detailed build process. The build itself took 20 hours, two hardware trips, five online orders and one burnt thumb. The code is based on SimpleController's, modified for my button layout and application. The only thing left is to get good with it</p>
            
            <PhotoComponent photo={boxxPhotos[2]} index={textureModPhotos.length + 2} />
          </Subarticle>
          
          <Subarticle subtitle="How to get it:">
            <p><a href="https://imgur.com/a/M2QSR">You can better follow / copy my build process here</a></p>
            <p><a href="https://github.com/trbarron/SimpleControllersBuild-a-Box/blob/master/Barron_B0XX_Arduino.ino">The code can be found here</a></p>
          </Subarticle>
        </Article>
      </main>
      <Footer />
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={allPhotos}
        index={photoIndex}
      />
    </div>
  );
};

export default SSBM;