import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";

const BoulderingTracker = () => {
  const VideoComponent = ({
    src,
    caption,
  }: {
    src: string;
    caption?: string;
  }) => (
    <div className="my-5 text-center">
      <div className="relative mx-auto h-0 max-w-full overflow-hidden pb-[56.25%]">
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
    <div className="flex min-h-screen flex-col bg-black bg-fixed">
      <Navbar />
      <main className="flex-grow">
        <section className="article">
          <article className="article-card">
            <header className="article-header">
              <h1 className="article-title">Bouldering Tracker</h1>
            </header>
            <div className="prose">
              <section className="subarticle prose">
                <h3 className="subarticle-title">
                  Measuring the ability to go up
                </h3>
                <div className="overflow-hidden bg-white break-words">
                  <p>
                    Deep in youtube I found a video that showcased some software
                    that I was really impressed with
                  </p>

                  <VideoComponent
                    src="https://www.youtube.com/embed/7BrYiaSyNto"
                    caption="Original inspiration video"
                  />

                  <p>
                    Naturally, after seeing that, I wanted to make one myself. A
                    few weeks later I had this demo
                  </p>

                  <VideoComponent
                    src="https://www.youtube.com/embed/q8dG_Ff2cAc"
                    caption="First demo in apartment"
                  />

                  <p>
                    This was improved over a few weekends and taken to the gym
                    to try out
                  </p>

                  <VideoComponent
                    src="https://www.youtube.com/embed/rpvqT8xBKl0"
                    caption="Demoing it at the gym"
                  />

                  <p className="w-full"></p>
                </div>
              </section>

              <section className="subarticle prose">
                <h3 className="subarticle-title">Hardware:</h3>
                <div className="overflow-hidden bg-white break-words">
                  <p>
                    The project used a Kinect V2 Camera that connected to a 2018
                    Dell XPS Ultrabook. No special lighting is needed
                  </p>
                </div>
              </section>

              <section className="subarticle prose">
                <h3 className="subarticle-title">Software:</h3>
                <div className="overflow-hidden bg-white break-words">
                  <p className="text-gray-dark font-bold">
                    Highlighting Holds:{" "}
                  </p>
                  <p>
                    This is where it highlights the holds, showing in the first
                    few seconds of the video. It uses color and depth to
                    determine if the hold is contiguous
                  </p>

                  <p className="text-gray-dark font-bold">Tracking People: </p>
                  <p>
                    This is where it highlights the holds, showing in the first
                    few seconds of the video. It uses color and depth to
                    determine if the hold is contiguous
                  </p>

                  <p className="text-gray-dark font-bold">
                    Detecting Human to Hold Collisions:{" "}
                  </p>
                  <p>
                    This is done by tracking the human hand and checking it
                    against the distance (one threshold) and depth (another
                    threshold). If each are met, the hold is marked as
                    &quot;reached&quot; and the color is changed.
                  </p>

                  <p className="py-4"></p>
                  <p>
                    <a href="https://github.com/trbarron/bouldering-sensing">
                      Check out the code here
                    </a>
                  </p>
                </div>
              </section>
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BoulderingTracker;
