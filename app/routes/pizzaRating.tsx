// Import components
import { lazy, Suspense } from "react";
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import Article from "../components/Article.js";


const PizzaScoringMap = lazy(() => import("~/components/PizzaScoringMap"));


const PizzaRating = () => {
  return (
    <div className="bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="Pizza Ratings" subtitle="">
          <Suspense fallback={
            <div className="w-full bg-white border-4 border-black p-8 text-center mt-4">
              <p className="font-neo font-bold text-black uppercase tracking-widest animate-pulse">Loading map…</p>
            </div>
          }>
            <PizzaScoringMap />
          </Suspense>
        </Article>
      </main>
      <Footer />
    </div>
  );
};

export default PizzaRating;