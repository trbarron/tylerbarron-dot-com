import React, { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// Import components
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import { Subarticle } from "../components/Subarticle.js";
import Article from "../components/Article.js";

// Import assets
import camelUpGame from "~/images/CamelUpCup/camelUpGame.jpg";
import peoplePlaying from "~/images/CamelUpCup/peoplePlaying.jpg";
import trophy from "~/images/CamelUpCup/trophy.jpg";
import eventOne from "~/images/CamelUpCup/eventOne.jpg";
import eventTwo from "~/images/CamelUpCup/eventTwo.jpg";

const CamelUpCup = () => {
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = [
    { src: camelUpGame, alt: "Game Itself", caption: "The box art for Camel Up" },
    { src: peoplePlaying, alt: "Humans Playing", caption: "Humans Playing the game" },
    { src: trophy, alt: "The Trophy", caption: "The trophy, to be awarded to the winner" },
    { src: eventTwo, alt: "Event itself", caption: "The event itself (bots not pictured)" },
    { src: eventOne, alt: "Event itself", caption: "Sir_Humpfree_Bogart's owner (me)" },
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
        <Article title="Camel Up Cup 2K18" subtitle="">
          <Subarticle subtitle="Wait, what?">
            <p><a href="https://www.boardgamegeek.com/boardgame/153938/camel">Camel Up</a> is a board game I was playing with some buddies. While arguing about what move should have been made someone remarked "someone should write a program to play this game". That sparked the idea that became Camel Up Cup 2K18 - the premier bot creation tournament of the year. The idea is simple, make a digital bot that is able to play the game Camel Up better than all competitors.</p>
            
            <PhotoComponent photo={photos[0]} index={0} />

            <p>The game was chosen for several reasons: it has a relatively small pool of options to select from (roughly 20 choices per turn, easily narrowed down to usually about 3-4), games are short and there is an element of luck (so even bad bots have a chance to win). After seeing some interest I made the game and a few basic examples of bots and sent out invitations.</p>
            
            <PhotoComponent photo={photos[1]} index={1} />
          </Subarticle>
          
          <Subarticle subtitle="The Details">
            <p>The bots would be written in a language that interfaces with Python. They would take in the gamestate (camel positions, current bets, player money values, etc) and return their move. Bot creators had access to the game's code so could test their bots locally.</p>
            
            <PhotoComponent photo={photos[2]} index={2} />
          </Subarticle>

          <Subarticle subtitle="The Event Itself">
            <p>On the day of the event plenty of people showed up... but not many bots. There were two serious bots and two joke bots, along with a bot that was supposed to be a joke but was accidentally a jpeg image. We agreed to a best of four with a rotating player order.</p>
            
            <PhotoComponent photo={photos[3]} index={3} />

            <p>Initially the game was accidentally in a debugging mode that resulted in "trashbot", one of the joke bots, absolutely crushing the other bots.</p>
            <p>The bug was correct and we found the two competative bots <a href="https://github.com/DingusaurusRex/TimeCamel">TimeCamel [made by Libby and Jack]</a> and <a href="https://github.com/trbarron/Camel_Up_Cup_2K18">Sir_Humpfree_Bogart [made by myself]</a> well ahead of trashbot [made by Charles] and randobot [made by Sean]. TimeCamel took the first game but Sir_Humpfree_Bogart took the next three games to pull home the win.</p>
            
            <PhotoComponent photo={photos[4]} index={4} />
          </Subarticle>
          <Subarticle subtitle="The Aftermath">
            <p>Thanks for reading! It was a quirky experiment that led to a fun day with buddies -- can't ask for much more. <a href="https://github.com/trbarron/Camel_Up_Cup_2K18">See my github for the game and my bot</a> and <a href="https://github.com/DingusaurusRex/TimeCamel">here for TimeBot's code.</a></p>
            <p><a href="https://codegolf.stackexchange.com/questions/167101/camel-up-cup-an-ai-board-game-tournament">Check here for how you can make a bot and interface with the competition</a></p>
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

export default CamelUpCup;