// Import components
import { Navbar } from "../components/Navbar";
import Footer from "../components/Footer";
import Article from "../components/Article";
import PizzaScoringMap from "~/components/PizzaScoringMap";


const PizzaRating = () => {
  return (
    <div className="bg-background bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="Pizza Ratings" subtitle="">
          <PizzaScoringMap />
        </Article>
      </main>
      <Footer />
    </div>
  );
};

export default PizzaRating;