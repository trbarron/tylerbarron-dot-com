import React, { useState } from "react";

import { Navbar } from '~/components/Navbar';
import Footer from '~/components/Footer';
import { Subarticle } from '~/components/Subarticle';
import Article from '~/components/Article';
import CustomLightbox from '~/components/CustomLightbox';
import LightboxPhoto from '~/components/LightboxPhoto';

import chessBoard from '~/images/ChesserGuesser/screenshot.png';
import fen from '~/images/ChesserGuesser/fen.png';

export default function ChessBlog() {
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = [
    { src: chessBoard, alt: "Chess Board Analysis", caption: "A sample chess position from Chesser Guesser" },
    { src: fen, alt: "FEN Notation Example", caption: "How FEN Notation is used to represent a chess position" },
  ];

  const openLightbox = (index: number) => {
    setPhotoIndex(index);
    setOpen(true);
  };

  return (
    <div className="bg-background bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article
          title="Chesser Guesser"
          subtitle="A GeoGuessr for Chess Enthusiasts"
        >
          <Subarticle subtitle="The Why">
            <p>Inspired by GeoGuessr, Chesser Guesser challenges players to estimate the computer's evaluation of chess positions. Players try to estimate the value of specific chess positions as accurately as possible, matching or closely approximating the engine's evaluation to extend their streak. The goal is to sharpen your evaluative skills by understanding why certain positions are deemed advantageous or disadvantageous by the computer.</p>

            <LightboxPhoto photo={photos[0]} index={0} onClick={openLightbox} />
          </Subarticle>
        </Article>
        <Article title="" subtitle="">
          <Subarticle subtitle="The Analysis">
            <p>The game integrates with the <a href='https://lichess.org/@/lichess/blog/thousands-of-stockfish-analysers/WN-gLzAA'>Lichess Cloud Analysis</a> to fetch position evaluations at scale, giving access to all the positions and their evaluations without me having to do any work. Having this resource made the tough part of this project incredibly easy.</p>
            
            <LightboxPhoto photo={photos[1]} index={1} onClick={openLightbox} />

            <p>Chesser Guesser uses Python connected to several Amazon DynamoDB instances for data storage. Lichess gives us a huge number of analyzed positions – we get to parse those down and only insert the interesting ones for our game. The criteria used was: </p>
            <p className='pl-8'>- The evaluation is not above 400 centipawns (a centipawn is a unit of advantage, with 100 ~= 1 pawn's advantage) in either direction or between -50 and 50 centipawns</p>
            <p className='pl-8'>- The same number of entries must be given for both the black and white side</p>
            <p className='pl-8'>- There are less than 5 pawns on any rank, to remove most analysis being on openings</p>
            <p>A total of 400 evaluations were added, although thousands meet the criteria and there are over a million with saved analysis</p>
          </Subarticle>
          <Subarticle subtitle="The User Generated Content">
            <p>Then we have another application database that is also a DynamoDB that stores the daily user's scores. These will have the date, their total score and their name. The score is just the sums of the differences between their guesses and the computer's evaluation from all five rounds, which is what can land you on the leaderboards. Even with the users we were able to stay within the free tier</p>
          </Subarticle>
          <Subarticle subtitle="The Rest of the UI">
            <p>For the chess board I used the open source <a href='https://github.com/lichess-org/chessground/tree/master'>Chessground</a>. I've used it before and gotta say, its the best. Again, thank you to Lichess for providing these resources! </p>
            <p>Sliders and such were able to be reused from the <a href='https://www.tylerbarron.com/ChessOpenings'>Chess Openings Practice</a> project. I made a few improvements to help with it on mobile (75+% of users are mobile users) which is always great.</p>
          </Subarticle>
        </Article>
        <Article title="" subtitle="">
          <Subarticle subtitle="The What">
            <p>This was released on the afternoon of March 17th. It did really well on /r/chess, getting 40+k views, 50+ comments and a 95+% upvote rate. This spurred me to rush to implement Google Analytics where I could see the global engagement. Over one thousand people have since played in the daily challenges (including a few cheaters, which I try to remove), including a few titled players.</p>
            <p>Overall I would consider this experiment a success, hosting a lot of traffic and some fun conversations. I'm still playing most days of the week, so come give a try and say hello on the top 5!</p>
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