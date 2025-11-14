// Import components
import { lazy, Suspense } from "react";
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import Article from "../components/Article.js";


const PizzaScoringMap = lazy(() => import("~/components/PizzaScoringMap"));


const PizzaRating = () => {
  return (
    <div className="bg-black dark:bg-white bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="Pizza Ratings" subtitle="">
          <Suspense fallback={<div className="w-full p-6">Loading map...</div>}>
            <PizzaScoringMap />
          </Suspense>
        </Article>
      </main>
      <Footer />
    </div>
  );
};

export default PizzaRating;