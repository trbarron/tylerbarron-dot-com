import React, { useState, useCallback } from "react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { ClientOnly } from "remix-utils/client-only";
import { Chess } from "chess.js";

import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import { Subarticle } from "~/components/Subarticle";
import Article from "~/components/Article";

const ChessgroundWrapper = React.lazy(() => import('~/components/ChessgroundWrapper'));

type LoaderData = {
  gameID: string;
  name: string;
};

export const loader: LoaderFunction = async ({ params }) => {
  return json({
    gameID: params.gameID,
    name: params.name
  });
};

export default function CollaborativeCheckmate() {
  const { gameID, name } = useLoaderData<LoaderData>();
  const [chess] = useState(new Chess());
  const [boardOrientation, setBoardOrientation] = useState("white");

  const flipBoard = useCallback(() => {
    setBoardOrientation(prev => prev === "white" ? "black" : "white");
  }, []);

  return (
    <div className="bg-background bg-fixed min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Article
          title="Collaborative Checkmate"
          subtitle={`Game ID: ${gameID} | Player: ${name}`}
        >
          <Subarticle>
            <div className="mx-auto grid gap-x-4 grid-rows-2 md:grid-rows-1 grid-cols-1 md:grid-cols-2 md:ml-iauto" style={{ gridTemplateColumns: "80% 20%", marginLeft: "-0.5rem", marginRight: "0.5rem" }}>
              <div className="w-100% col-span-2 md:col-span-1">
                <ClientOnly fallback={<div>Loading...</div>}>
                  {() => (
                    <React.Suspense fallback={<div>Loading chess board...</div>}>
                      <ChessgroundWrapper
                        fen={chess.fen()}
                        orientation={boardOrientation}
                        style={{
                          width: '100%',
                          height: '0',
                          paddingBottom: '100%',
                          position: 'relative'
                        }}
                      />
                    </React.Suspense>
                  )}
                </ClientOnly>
              </div>

              <div className="justify-center text-center grid gap-y-3 h-80 md:h-full md:grid-cols-1 w-full grid-cols-3 col-span-2 md:col-span-1 gap-x-4 py-2 md:py-0">
                <div className="bg-white shadow rounded-lg overflow-hidden w-full col-span-3 md:col-span-1 md:h-60 h-36">
                  <div className="w-full text-gray border-b-2 z-30 bg-white border-green-500 py-0 md:py-2 inline-flex items-center justify-center font-bold text-sm md:text-md">
                    Game Info
                  </div>
                  <div className="flex flex-col items-center justify-center px-4 pb-0 -mt-3 z-10 md:py-2 bg-gray text-gray-light text-xs md:text-xs h-full overflow-y-hidden">
                    <p>Current Team: {chess.turn() === 'w' ? 'White' : 'Black'}</p>
                    <p>Static chess board demo</p>
                  </div>
                </div>

                <button
                  className="w-full bg-white text-gray-800 rounded border-b-2 border-green-500 hover:border-red-600 hover:bg-red-500 hover:text-white shadow-md py-2 px-6 inline-flex items-center"
                  onClick={flipBoard}
                  aria-label="Flip board orientation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 mx-auto">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>
            </div>
          </Subarticle>
        </Article>
        <div className="visible">
          <Article title="About Collaborative Checkmate">
            <Subarticle subtitle="">
              <p>
                A simple chess board demo. You can flip the board orientation using the button on the right.
              </p>
            </Subarticle>
          </Article>
        </div>
      </main>
      <Footer />
    </div>
  );
}