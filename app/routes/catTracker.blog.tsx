import { useState } from "react";
import { Link, useLoaderData } from "react-router";

import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import { Subarticle } from "~/components/Subarticle";
import Article from "~/components/Article";
import CustomLightbox from "~/components/CustomLightbox";
import LightboxPhoto from "~/components/LightboxPhoto";

import checoSetup from "~/images/CatTracker/checoSetup.jpg";
import checoWorking from "~/images/CatTracker/checoWorking.jpg";
import vestaboard from "~/images/CatTracker/vestaboardDisplay.jpg";

export const loader = async () => {
  // You can fetch data here if needed
  return {
    // Return any data you want to use in the component
  };
};

export default function CatTrackerBlog() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const data = useLoaderData();
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = [
    { src: checoSetup, alt: "Checo Setup", caption: "Hardware setup for tracking Checo" },
    { src: checoWorking, alt: "Checo Working", caption: "Checo hard at work, seen from camera" },
    { src: vestaboard, alt: "Checo's Work Log", caption: "Work time displayed on a Vestaboard" },
  ];

  const openLightbox = (index: number) => {
    setPhotoIndex(index);
    setOpen(true);
  };

  return (
    <div className="bg-black dark:bg-white bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article
          title="Cat Tracker"
          subtitle="Measuring Checo&apos;s Work Ethic"
        >
          <Subarticle subtitle="">           
            <p>This project started with a simple curiosity: just how much does one of our catsCheco work next to me? He seemed to always be there, clocking in hours by sleeping in his circle next to my desk. With a free weekend, I decided to turn this into a project to track his effort.</p>

            <LightboxPhoto photo={photos[0]} index={0} onClick={openLightbox} />

            <p>To measure Checo&apos;s presence, I built a system using a Raspberry Pi W Zero 2 and a Raspberry Pi AI Camera. The software stack includes using DynamoDB, a custom trained ONNX AI Model, API Gateway, and Python in Lambda functions and on the RPi.</p>

            <LightboxPhoto photo={photos[1]} index={1} onClick={openLightbox} />

            <p>The camera captures photos at ~40 second intervals, which are then processed to determine if there&apos;s a cat in the image via the custom AI model run on the edge. Based on the results it may add an entry to our database with details about which cat is in the image.</p>

            <p>When a user visits the website, we use API Gateway to hit a Lambda function to calculate the time worked and display that to the user.</p>
            <p>It&apos;s a fun way to keep my manager, the Checo, on task!</p>

            <LightboxPhoto photo={photos[2]} index={2} onClick={openLightbox} />

            <p><Link to="/cat-tracker">See the cat&apos;s current status here</Link></p>
          </Subarticle>
        </Article>
      </main>
      <Footer />
      <CustomLightbox
        open={open}
        close={() => setOpen(false)}
        photos={photos}
        currentIndex={photoIndex}
        setCurrentIndex={setPhotoIndex}
      />
    </div>
  );
}