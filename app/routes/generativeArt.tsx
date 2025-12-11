import React, { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// Import components
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import { Subarticle } from "../components/Subarticle.js";
import Article from "../components/Article.js";
import Riddler from "../components/Riddler.js";

// Import assets
import plotter from "~/images/GenerativeArt/plotter.jpg";
import pic1 from "~/images/GenerativeArt/1.jpg";
import pic2 from "~/images/GenerativeArt/2.jpg";
import pic3 from "~/images/GenerativeArt/3.jpg";
import pic4 from "~/images/GenerativeArt/4.jpg";
import pic5 from "~/images/GenerativeArt/5.jpg";

const GenerativeArt = () => {
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = [
    { src: plotter, alt: "plotter", caption: "my HP 7550A pen plotter" },
    { src: pic1, alt: "Photo 1" },
    { src: pic2, alt: "Photo 2" },
    { src: pic3, alt: "Photo 3" },
    { src: pic4, alt: "Photo 4" },
    { src: pic5, alt: "Photo 5" },
  ];

  const openLightbox = (index) => {
    setPhotoIndex(index);
    setOpen(true);
  };

  const PhotoComponent = ({ photo, index }) => (
    <div onClick={() => openLightbox(index)} style={{cursor: 'pointer', margin: '20px 0'}}>
      <img src={photo.src} alt={photo.alt} style={{maxWidth: '100%', height: 'auto'}} />
      {photo.caption && <p style={{fontStyle: 'italic', marginTop: '10px'}}>{photo.caption}</p>}
    </div>
  );

  return (
    <div className="bg-black  bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="Generative Art" subtitle="">
          <Subarticle subtitle="goodbad.png">
            <p>Inspired by <a href="https://medium.com/quarterstudio/an-intro-to-pen-plotters-29b6bd4327ba">a blog post</a> I decided to purchase a 1980's pen plotter and get into the world of generative art</p>
            
            <PhotoComponent photo={photos[0]} index={0} />

            <p>After taking some online classes I set up an instagram to showcase my art: <a href="https://www.instagram.com/goodbad.png/">goodbad.png</a>. This led to an invitation to an online community of generative artists to share work and methodology</p>
            
            <p>After months of sharing work I was accepted to showcase my art at the local library with an exhibition for the public. This was unfortunately canceled due to COVID-19 but <a href="https://www.instagram.com/p/B_h_3LmAZSy/">led to a digital exhibition on their instagram</a></p>
            
            <p>Here is my artist's statement about the generative work:</p>

            <Riddler>
              {"good bad plotting is a showcase of generated geometric structures, which I disrupt to create snapshots reminiscent of the natural world. I guide their creation using repetition, symmetry, and reoccurring patterns. My work embraces exploration and discovery, often following unintended paths to get to the result. The code is written by myself primarily in JavaScript, and I then trace it to paper using a modified 1980's Hewlett-Packard pen plotter."}
            </Riddler>

            {photos.slice(1).map((photo, index) => (
              <React.Fragment key={index + 1}>
                <p></p>
                <PhotoComponent photo={photo} index={index + 1} />
              </React.Fragment>
            ))}
          </Subarticle>
          <Subarticle subtitle="For more:">
            <p>
              Check out more work <a href="https://www.instagram.com/goodbad.png/">on my instagram</a> where I post this work along with some photography.
            </p>
          </Subarticle>
        </Article>
      </main>
      <Footer />
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={photos}
        index={photoIndex}
      />
    </div>
  );
};

export default GenerativeArt;