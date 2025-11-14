import React, { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// Import components
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import { Subarticle } from "../components/Subarticle.js";
import Article from "../components/Article.js";

// Import assets
import riddlerLogo from "~/images/Riddler/riddlerlogo.gif";
import pizzaPath from "~/images/Riddler/pizza_path.jpg";
import barronSquareFour from "~/images/Riddler/barronSquareFour.jpg";
import barronSquareEight from "~/images/Riddler/barronSquareEight.jpg";
import geometricPuzzle from "~/images/Riddler/sixPuzzle.jpg";
import uniqueTileSnips from "~/images/Riddler/unique_tile_snips.png";
import sevenSegDisplay from "~/images/Riddler/sevenSegDisplay.jpg";
import setBoard from "~/images/Riddler/setBoard.jpg";
import neutColorado from "~/images/Riddler/neutColorado.png";
import blueColorado from "~/images/Riddler/blueColorado.png";
import crosswordOne from "~/images/Riddler/crosswordOne.png";
import crosswordTwo from "~/images/Riddler/crosswordTwo.png";

const Riddler = () => {
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = [
    { src: riddlerLogo, alt: "Riddler Logo", caption: "The Riddler Logo" },
    { src: pizzaPath, alt: "Pizza Path", caption: "Pizza sauce dispensing path" },
    { src: barronSquareFour, alt: "4x4 Barron Square", caption: "4x4 Barron Square" },
    { src: barronSquareEight, alt: "8x8 Barron Square", caption: "8x8 Barron Square" },
    { src: geometricPuzzle, alt: "Geometric Puzzle", caption: "Find the area of the orange section" },
    { src: uniqueTileSnips, alt: "Unique Tile Snips", caption: "150 of the 6188 solutions" },
    { src: sevenSegDisplay, alt: "Seven Segment Display", caption: "A seven-segment display" },
    { src: setBoard, alt: "Set Board", caption: "A Standard board of Set Cards" },
    { src: neutColorado, alt: "Neutral Colorado", caption: "Colorado's voter preferences" },
    { src: blueColorado, alt: "Blue Colorado", caption: "Optimized districts for Blue Party" },
    { src: crosswordOne, alt: "Crossword One", caption: "Crossword puzzle grid" },
    { src: crosswordTwo, alt: "Crossword Two", caption: "Generated crossword grids" }
  ];

  const openLightbox = (index) => {
    setPhotoIndex(index);
    setOpen(true);
  };

  const PhotoComponent = ({ photo, index }) => (
    <div 
      onClick={() => openLightbox(index)} 
      style={{
        cursor: 'pointer', 
        margin: '20px auto',
        textAlign: 'center',
        maxWidth: '80%'
      }}
    >
      <img 
        src={photo.src} 
        alt={photo.alt} 
        style={{
          maxWidth: '100%', 
          height: 'auto',
          display: 'block',
          margin: '0 auto'
        }} 
      />
      {photo.caption && (
        <p style={{
          fontStyle: 'italic', 
          marginTop: '10px',
          textAlign: 'center'
        }}>
          {photo.caption}
        </p>
      )}
    </div>
  );

  return (
    <div className="bg-black dark:bg-white bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="FiveThirtyEight's The Riddler" subtitle="">
          <Subarticle subtitle="What is the Riddler?">
            <p>The Riddler is a weekly math, logic and probability problem hosted by fivethirtyeight. The website usually posts data-driven politics, sports and culture blog and predictions.</p>
            
            <PhotoComponent photo={photos[0]} index={0} />

            <p>If my solution is extendable, interactive or generalizable then I'll usually blog about it. I've also created and submitted some problems that have been published on the column.</p>
          </Subarticle>

          <Subarticle subtitle="Submitted Problems">
            <h3>A Pizza Sauce Problem</h3>
            <p>This problem is about filling a pizza evenly with sauce.</p>
            <blockquote>
              <p>You work for Puzzling Pizza, a company committed to making the best and most consistent pizzas in town. As the shop's resident mathematician, your boss has asked you to design a product similar to one they saw online:</p>
            </blockquote>
            <p><a href="https://www.youtube.com/watch?v=8Q0vk_fKDEo">Link to video</a></p>
            <blockquote>
              <p>They've already purchased the equipment but need to know the exact path and flow rate the sauce-dispensing arm should use to fill a 12-inch circular pizza with sauce as fully and evenly as possible.</p>
            </blockquote>
            <p>This problem was unique in that I not only created the problem but also wrote the solution and provided the diagrams.</p>
            
            <PhotoComponent photo={photos[1]} index={1} />
            
            <p><a href="https://fivethirtyeight.com/features/a-peaceful-but-not-peaceful-transition-of-power-in-riddler-nation/">The solution can be found here</a></p>

            <h3>Barron Squares</h3>
            <p>This is a mathematical object. It is a square matrix such that each row's leftmost element times its rightmost element will equal the two inner numbers (in the example below, the top row has 6*7 = 42).</p>
            <p>Similarly, each column's uppermost element times the column's lowermost element equals the middle digits (in the example, the right column is 7*8 = 56), as read top to bottom.</p>
            
            <PhotoComponent photo={photos[2]} index={2} />
            
            <p>This was then expanded on to be an 8x8 with two digit rows/columns being multiplied to get four digit products</p>
            
            <PhotoComponent photo={photos[3]} index={3} />
            
            <p>We ended up finding all 122 4x4 Barrons Squares, several hundred 8x8 and even a few 16x16 Barron Squares. <a href="https://fivethirtyeight.com/features/can-you-crack-this-squares-hidden-code/">This was featured as a Riddler Express for FiveThirtyEight.</a></p>

            {/* Add more submitted problems here */}
          </Subarticle>

          <Subarticle subtitle="Problem Solutions">
            <h3>Putting Sharp Objects into Round Ones</h3>
            <p>This problem was about creating triangles in a unit circle and determining if the circle's center was enclosed.</p>
            <blockquote>
              <p>"Choose three points on a circle at random and connect them to form a triangle. What is the probability that the center of the circle is contained in that triangle?"</p>
            </blockquote>
            <p>This led to the following visualization:</p>
            <p><a href="https://www.youtube.com/watch?v=tilkid4qwo4">2d Simulation</a></p>

            <h4>3D Case</h4>
            <blockquote>
              <p>Choose four points at random (independently and uniformly distributed) on the surface of a sphere. What is the probability that the tetrahedron defined by those four points contains the center of the sphere?</p>
            </blockquote>
            <p><a href="https://www.youtube.com/watch?v=SCb3hnudEFA">3d Simulation</a></p>
            <p>The probability that the shapes would enclose the center resulted in surprisingly nice 25% and 12.5%.</p>

            <h3>Gerrymandering</h3>
            <blockquote>
              <p>Below is a rough approximation of Colorado's voter preferences, based on county-level results from the 2012 presidential election, in a 14-by-10 grid. Colorado has seven districts, so each would have 20 voters in this model. What is the most districts that the Red Party could win if you get to draw the districts with the same rules as above? What about the Blue Party? (Assume ties within a district are considered wins for the party of your choice.)</p>
            </blockquote>
            
            <PhotoComponent photo={photos[8]} index={8} />
            
            <p>We used a randomized search that would try to slightly move districts, check continuity and then check the voting results. The method resulted in uniquely shaped maps that optimized each side's winningness.</p>
            
            <PhotoComponent photo={photos[9]} index={9} />
            
            <p><a href="https://www.youtube.com/watch?v=V-VWRII179E">Districts move their boundaries each iteration</a></p>

            {/* Add more problem solutions here */}
          </Subarticle>

          <Subarticle subtitle="Other Solutions">
            <p>Other solutions worthy of writing up but not dedicating space to here:</p>
            <p><ul>
            <li><a href="https://barronwasteland.wordpress.com/2020/07/12/2220/">A Story of Stacking Rings</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2020/06/21/golden-spheres/">Golden Spheres</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2020/06/11/can-you-join-the-worlds-biggest-zoom-call/">Can You Join the World’s Biggest Zoom Call?</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2020/03/02/2186/">A Dark Room With Cards</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2020/02/11/jim-propp-and-the-unique-observed-series/">Jim Propp and the Unique Observed Series</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2020/01/06/a-hexagon-problem/">A Hexagon Problem</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2019/12/22/can-you-find-a-matching-pair-of-socks/">Can You Find A Matching Pair of Socks?</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2019/12/18/a-particularly-prismatic-puzzle/">A Particularly Prismatic Problem</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2019/12/10/how-fast-can-you-skip-to-your-favorite-song/">How Fast Can You Skip to Your Favorite Song</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2019/11/03/new-sultans-dowry-problem/">New Sultan's Dowery Problem</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2018/08/19/game-theory-on-a-number-line/">Game Theory on a Number Line</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2018/09/15/the-eccentric-billionaire-and-the-banker/">The Eccentric Billionaire and the Banker</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2018/09/24/a-tale-of-two-endpoints/">A Tale of Two Endpoints</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2018/12/24/2000/">Elf Playlist</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2019/01/22/creating-crossword-grids/">Creating Crosswords</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2019/02/17/sum-to-15-card-game/">Sum to 15 Card Game</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2019/04/01/a-fivethirtyeight-spelling-be/">A FiveThirtyEight Spelling Bee</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2019/04/20/a-circular-conundrum/">A Circular Conundrum</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2018/06/17/matching-game/">Matching Game</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2018/06/06/a-classic-construction-problem/">A Classic Construction Problem</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2017/11/04/an-amphibious-enigma/">An Amphibious Enigma</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2017/10/08/game-show-bright-lights-big-cit/">Big City, Bright Lights</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2017/07/06/the-purge-riddler/">The Purge</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2017/04/29/a-painting-puzzl/">A Painting Puzzle</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2017/04/23/pick-a-card-any-card/">Pick a Card, Any Card</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2017/03/18/a-puzzle-about-domestic-boundaries/">A Puzzle About Domestic Boundaries</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2017/01/17/the-riddler-an-impromptu-gambling-problem/">An Impromptu Gambling Problem</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2016/10/23/the-riddler-can-you-survive-this-deadly-board-game/">Can You Survive This Deadly Board Game?</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2016/09/19/the-riddler-count-von-count/">Count Von Count</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2016/05/25/the-riddler/">Jems</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2016/04/16/the-riddler-space-race/">Space Race</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2015/12/22/the-riddler-2-which-geyser-gushes-first/">Which Geyser Gushes First?</a></li>
            <li><a href="https://barronwasteland.wordpress.com/2015/12/12/the-riddler-1-whats-the-best-way-to-drop-a-smartphone/">What's the Best Way To Drop A Smartphone?</a></li>   

            </ul></p>
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

export default Riddler;