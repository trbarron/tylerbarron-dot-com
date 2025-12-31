import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

const setSetup = getImageUrl('Set/setSetup.jpg');
const setAnswers = getImageUrl('Set/setAnswers.jpg');
const setBoard = getImageUrl('Set/setBoard.jpg');
// Import components
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import { Subarticle } from "../components/Subarticle.js";
import Article from "../components/Article.js";

// Import assets
import { getImageUrl } from '~/utils/cdn';

const Set = () => {
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = [
    { src: setBoard, alt: "Set Board", caption: "An example Set Board" },
    { src: setAnswers, alt: "Set Answers", caption: "Examples of sets using the above board" },
    { src: setSetup, alt: "Set Setup", caption: "Hardware setup" },
  ];

  const openLightbox = (index: number) => {
    setPhotoIndex(index);
    setOpen(true);
  };

  const PhotoComponent = ({ photo, index }: { photo: typeof photos[0]; index: number }) => (
    <div
      onClick={() => openLightbox(index)}
      className="cursor-pointer my-5 mx-auto text-center max-w-[80%]"
    >
      <img
        src={photo.src}
        alt={photo.alt}
        className="max-w-full h-auto block mx-auto"
      />
      {photo.caption && (
        <p className="italic mt-2.5 text-center">
          {photo.caption}
        </p>
      )}
    </div>
  );

  return (
    <div className="bg-black  bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="Set" subtitle="">
          <Subarticle subtitle="">
            <p>During quarantine, I found myself playing a lot of Set — a card game where you try to find sets of three cards that fit certain constraints.</p>

            <PhotoComponent photo={photos[0]} index={0} />

            <p>A set is three cards where each individual feature (color, shape, number, and shading) is either all the same or all different. Here are some examples:</p>

            <PhotoComponent photo={photos[1]} index={1} />

            <p>Naturally, this had to be automated. My friends were running a "casual distanced hackathon," and I chose this as my project. Here's the hardware setup I used:</p>

            <PhotoComponent photo={photos[2]} index={2} />

            <p>Using the Kinect as an RGB camera, I was able to capture images and process them in OpenCV and Python. The program looks at an image of the board, labels the cards, finds sets, and reports them with a refresh rate of 0.25s on low powered laptop.</p>

            <p>Here's a demo:</p>

            <div className="relative pb-[56.25%] h-0 overflow-hidden max-w-[80%] my-5 mx-auto">
              <iframe
                src="https://www.youtube.com/embed/U1rkMZI7B4M"
                className="absolute top-0 left-0 w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Demoing the product"
              ></iframe>
            </div>
            <p className="italic mt-2.5 text-center">Demoing the product</p>

            <p>I was very happy with what I was able to create in one weekend and ended up taking first in the hackathon.</p>
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

export default Set;