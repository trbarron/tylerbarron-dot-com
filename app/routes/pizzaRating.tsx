// Import components
import { lazy, Suspense } from 'react';
import { Navbar } from '../components/Navbar.js';
import Footer from '../components/Footer.js';

const PizzaScoringMap = lazy(() => import('~/components/PizzaScoringMap'));
import { buildMeta } from '~/utils/seo';

export function meta() {
  return buildMeta({
    title: 'Pizza Ratings',
    description:
      'Check your town’s Pizza Score: where Domino’s rates poorly, the local pizza is strong. A map of 5,700 US Domino’s ratings.',
    path: '/pizza-rating',
  });
}

const PizzaRating = () => {
  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-fixed">
      <Navbar />
      <main className="flex-grow">
        <section className="article">
          <article className="article-card">
            <header className="article-header">
              <h1 className="article-title">Pizza Ratings</h1>
            </header>
            <div className="prose">
              <Suspense
                fallback={
                  <div className="mt-4 w-full border-4 border-black bg-white p-8 text-center">
                    <p className="font-neo animate-pulse font-bold tracking-widest text-black uppercase">
                      Loading map…
                    </p>
                  </div>
                }
              >
                <PizzaScoringMap />
              </Suspense>
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PizzaRating;
