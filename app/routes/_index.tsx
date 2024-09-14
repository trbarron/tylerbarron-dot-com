import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import Footer from "~/components/Footer";

export const meta: MetaFunction = () => {
  return [
    { title: "Barron Wasteland" },
    { name: "description", content: "Food for thought // Ideas for eating" },
  ];
};

const links = [
  {
    to: "/TheRiddler",
    title: "FiveThirtyEight's The Riddler",
    description: "Math puzzles and problems"
  },
  {
    to: "/LudwigChessLanding",
    title: "Ludwig Chess",
    description: "Realtime chess with evaluation bar"
  },
  {
    to: "/CamelUpCup",
    title: "Camel Up Cup",
    description: "\"Bring your own board game playing bot\" competition"
  },
  {
    to: "/chesserGuesser/landing",
    title: "Chesser Guesser",
    description: "Can you tell who is winning the chess game?"
  },
  {
    to: "/ChessOpenings",
    title: "Chess Openings Practice",
    description: "Tool to practice your chess openings"
  },
  {
    to: "/RiddlerWarfare",
    title: "Riddler Warfare",
    description: "Blotto style game-theory challenge"
  },
  {
    to: "/CatTracker/Live",
    title: "Cat Work Tracker",
    description: "Measuring Checo's work output"
  },
  {
    to: "/GenerativeArt",
    title: "Generative Art",
    description: "Dive into plotters and generative art"
  },
  {
    to: "https://trbarron.itch.io/spheroid-zero",
    title: "Spheroid Zero",
    description: "A Godot game, a game jam submission"
  },
  {
    to: "/Set",
    title: "Set",
    description: "Using computer vision to play a board game"
  },
  {
    to: "/BoulderingTracker",
    title: "Bouldering Tracker",
    description: "Using computer vision to track climbing style"
  },
  {
    to: "/SSBM",
    title: "Super Smash Bros. Melee Mods",
    description: "Collection of hardware and software mods"
  }
];

export default function Index() {
  return (
    <main className="h-screen bg-offWhite relative font-body">
      <section className="w-full h-1/5 top-0 z-10 flex items-center justify-center">
        <div>
          <div className="text-3xl text-center md:text-left xl:text-4xl text-offBlack">
            Barron Wasteland
          </div>
          <div className="text-gray-400 lg:text-lg xl:text-2xl">
            Food for thought // Ideas for eating
          </div>
        </div>
      </section>

      <section className="w-full flex items-center justify-center bg-white pt-8 pb-12">
        <div className="flex flex-col items-center w-full">
          <h2 className="ml-4 text-offBlack">Projects</h2>
          <ul className="mx-auto pl-6 pr-4 h-5/6 text-xl leading-normal lg:leading-relaxed md:text-2xl lg:text-2xl text-transparent bg-clip-text bg-text-bg" style={{ width: "fit-content", height: "fit-content" }}>
          {
            links.map(({ to, title, description }) => (
              <li key={to}>
                <Link to={to} className="py-1 home-link">{title}</Link>
                <div className="ml-6 text-sm text-gray-600 pb-2">{description}</div>
              </li>
            ))
          }

          </ul>
        </div>
      </section>

      <div className="sm:h-auto lg:hidden w-screen">
        <Footer />
      </div>
    </main>
  );
}