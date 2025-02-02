// Import components
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import Article from "../components/Article.js";
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