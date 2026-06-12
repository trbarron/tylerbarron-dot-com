import { useEffect, useState } from "react";
import Footer from "~/components/Footer";
import { Link, useLoaderData } from 'react-router';
import { buildMeta } from "~/utils/seo";

export function meta() {
  return buildMeta({ path: "/" });
}

interface Post {
  slug: string;
  title: string;
  date: string;
  type?: string;
  subtitle?: string;
}

export async function loader(): Promise<{ posts: Post[] }> {
  const { getAllPostMeta } = await import('~/utils/posts.server');
  return { posts: await getAllPostMeta() };
}

interface ProjectLink {
  to: string;
  title: string;
  description: string;
}

type CategoryId = 'chess' | 'puzzles' | 'games' | 'vision' | 'gadgets';

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'chess', label: 'CHESS' },
  { id: 'puzzles', label: 'PUZZLES & DATA' },
  { id: 'games', label: 'GAMES' },
  { id: 'vision', label: 'COMPUTER VISION' },
  { id: 'gadgets', label: 'GADGETS & TOYS' },
];

// Route / slug → category. Slugs use the final URL segment.
const CATEGORY_BY_KEY: Record<string, CategoryId> = {
  // chess
  'chesser-guesser': 'chess',
  'blunder-watch': 'chess',
  'collaborative-checkmate': 'chess',
  'multiple-choice-chess': 'chess',
  // puzzles & data
  'the-riddler': 'puzzles',
  'camel-up-cup': 'puzzles',
  'pizza-rating': 'puzzles',
  // games
  'spheroid-zero': 'games',
  'planomancer': 'games',
  'SSBM': 'games',
  'stardewLLMDialog': 'games',
  // computer vision
  'set': 'vision',
  'bouldering-tracker': 'vision',
  'cat-tracker': 'vision',
  // gadgets & toys
  'vestaboardController': 'gadgets',
  'smartCyclingFanController': 'gadgets',
  'generative-art': 'gadgets',
  'youtube-speed-sense': 'gadgets',
};

function categoryOf(to: string): CategoryId | null {
  // Match by final URL segment or known external-link keyword.
  if (to.includes('spheroid-zero')) return 'games';
  if (to.includes('youtube-speed-sense') || to.includes('efgmcojhefjjdpdnnmclekblhpaiaedo')) return 'gadgets';
  const lastSeg = to.replace(/\/$/, '').split('/').pop() ?? '';
  return CATEGORY_BY_KEY[lastSeg] ?? null;
}

const staticLinks: ProjectLink[] = [
  { to: "/the-riddler", title: "FiveThirtyEight's The Riddler", description: "Math puzzles and problems" },
  { to: "/camel-up-cup", title: "Camel Up Cup", description: "\"Bring your own board game playing bot\" competition" },
  { to: "/chesser-guesser", title: "Chesser Guesser", description: "Can you tell who is winning the chess game?" },
  { to: "/blunder-watch", title: "Blunder Watch", description: "Spot the blunders as a chess game plays out" },
  { to: "/collaborative-checkmate", title: "Collaborative Checkmate", description: "Play chess with your friends" },
  { to: "/multiple-choice-chess", title: "Multiple Choice Chess", description: "Pick the best move from four engine-generated options" },
  { to: "/pizza-rating", title: "National Pizza Ratings", description: "Using Domino's to find the best pizza" },
  { to: "/cat-tracker", title: "Cat Work Tracker", description: "Measuring the cat's time in the office" },
  { to: "https://trbarron.itch.io/spheroid-zero", title: "Spheroid Zero", description: "A Godot game, a game jam submission" },
  { to: "/set", title: "Set", description: "Using computer vision to play a board game" },
  { to: "/bouldering-tracker", title: "Bouldering Tracker", description: "Using computer vision to track climbing style" },
  { to: "/SSBM", title: "Super Smash Bros. Melee Mods", description: "Collection of hardware and software mods" },
  { to: "/generative-art", title: "Generative Art", description: "Dive into plotters and generative art" },
  { to: "https://chromewebstore.google.com/detail/youtube-speed-sense/efgmcojhefjjdpdnnmclekblhpaiaedo", title: "YouTube Speed Sense", description: "Adjust video playback speed based on categories" },
];

const LS_KEY = 'bw.homepage.cats';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function ProjectCard({ to, title, description }: ProjectLink) {
  return (
    <div className="border-4 border-black bg-white/90 backdrop-blur-sm transition-transform duration-150 ease-out motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-x-[3px] [@media(hover:hover)]:hover:-translate-y-[3px] [@media(hover:hover)]:hover:shadow-[6px_6px_0_0_#111]">
      <Link to={to} className="block p-6 no-underline hover:no-underline h-full">
        <div className="font-neo font-bold text-xl text-black tracking-wide">{title.toUpperCase()}</div>
        <div className="font-neo text-sm mt-2 opacity-75 text-black font-medium">{description}</div>
      </Link>
    </div>
  );
}

interface CategorySectionProps {
  id: CategoryId;
  label: string;
  projects: ProjectLink[];
  open: boolean;
  onToggle: () => void;
}

function CategorySection({ id, label, projects, open, onToggle }: CategorySectionProps) {
  if (projects.length === 0) return null;
  const bodyId = `cat-body-${id}`;
  return (
    <div className="w-full mb-8">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-full flex items-center gap-4 py-3 px-0 cursor-pointer text-left border-0 bg-transparent hover:bg-transparent hover:text-black"
      >
        <span aria-hidden="true" className="inline-block w-12 h-1 bg-black" />
        <span className="font-neo font-semibold text-lg tracking-wide text-black uppercase">{label}</span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          className={`ml-auto text-black transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 5 L7 10 L12 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        </svg>
      </button>
      <div
        id={bodyId}
        aria-hidden={!open}
        className={`relative grid transition-[grid-template-rows] duration-[250ms] ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 pb-3 pl-1 pr-2">
            {projects.map((p) => (
              <ProjectCard key={p.to} {...p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPostDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();
}

function groupPostsByYear(posts: Post[]) {
  const groups = new Map<number, Post[]>();
  for (const p of posts) {
    const year = new Date(p.date).getUTCFullYear();
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(p);
  }
  return Array.from(groups.entries())
    .map(([year, items]) => ({
      year,
      items: items.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }))
    .sort((a, b) => b.year - a.year);
}

export default function Index() {
  const { posts } = useLoaderData<typeof loader>();

  const projectPosts: ProjectLink[] = posts
    .filter((post: Post) => post.type === 'project')
    .map((post: Post) => ({
      to: `/blog/${post.slug}`,
      title: post.title,
      description: post.subtitle || formatPostDate(post.date),
    }));

  const allProjects: ProjectLink[] = [...staticLinks, ...projectPosts];

  const byCategory: Record<CategoryId, ProjectLink[]> = {
    chess: [], puzzles: [], games: [], vision: [], gadgets: [],
  };
  for (const p of allProjects) {
    const cat = categoryOf(p.to);
    if (cat) byCategory[cat].push(p);
  }

  const [openMap, setOpenMap] = useState<Record<CategoryId, boolean>>({
    chess: true, puzzles: true, games: true, vision: true, gadgets: true,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setOpenMap((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore corrupt state
    }
  }, []);

  const toggle = (id: CategoryId) => {
    setOpenMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const writingPosts = posts.filter((post: Post) => post.type !== 'project');
  const writingByYear = groupPostsByYear(writingPosts);

  return (
    <main className="min-h-screen relative font-neo z-10">
      <section className="w-full py-20 top-0 z-10 flex items-center justify-center border-b-4 border-black bg-white/95 backdrop-blur-sm">
        <div className="text-center px-4">
          <h1 className="text-5xl md:text-7xl xl:text-8xl text-black font-neo font-extrabold tracking-tighter">
            BARRON WASTELAND
          </h1>
          <p className="text-black text-xl xl:text-2xl font-neo font-semibold mt-4 tracking-wide opacity-80 uppercase">
            FOOD FOR THOUGHT // IDEAS FOR EATING
          </p>
        </div>
      </section>

      <section className="relative w-full flex items-center justify-center py-20">
        {/* Vertical white runner behind the projects/writing column so the links read clearly over the dichroic background. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[min(100%,1024px)] bg-white z-0"
        />
        <div className="relative z-10 flex flex-col items-center w-full max-w-5xl">
          <h2 className="inline-block text-4xl lg:text-5xl font-neo font-extrabold mb-12 border-b-8 border-black pb-2 tracking-tighter uppercase text-black bg-white px-4">
            PROJECTS
          </h2>

          <div className="w-full px-8">
            {CATEGORIES.map((c) => (
              <CategorySection
                key={c.id}
                id={c.id}
                label={c.label}
                projects={byCategory[c.id]}
                open={openMap[c.id]}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </div>

          <div className="w-full px-8 mt-16">
            <hr className="border-0 border-t-[3px] border-black" />
          </div>

          <h2 className="inline-block text-4xl lg:text-5xl font-neo font-extrabold mt-16 mb-12 border-b-8 border-black pb-2 tracking-tighter uppercase text-black bg-white px-4">
            WRITING
          </h2>

          <div className="w-full px-8 space-y-12">
            {writingByYear.map(({ year, items }) => (
              <div key={year}>
                <div className="flex items-baseline border-b-[2.5px] border-black pb-2">
                  <span className="font-neo font-black text-2xl md:text-3xl text-black tracking-tight">{year}</span>
                  <span className="ml-auto font-mono text-[11px] text-neutral-500 uppercase">
                    {pad2(items.length)} {items.length === 1 ? 'POST' : 'POSTS'}
                  </span>
                </div>
                <ul className="bg-white/90 backdrop-blur-sm">
                  {items.map((post) => (
                    <li key={post.slug} className="border-b border-black/10 last:border-b-0">
                      <Link
                        to={`/blog/${post.slug}`}
                        className="grid grid-cols-[110px_1fr_24px] md:grid-cols-[140px_1fr_24px] gap-5 items-center px-3 py-3 no-underline hover:no-underline group transition-all duration-150 [@media(hover:hover)]:hover:bg-black [@media(hover:hover)]:hover:pl-6 motion-reduce:transition-none"
                      >
                        <span className="font-mono text-xs text-neutral-500 [@media(hover:hover)]:group-hover:text-white/80 uppercase">
                          {formatPostDate(post.date)}
                        </span>
                        <span className="font-neo font-black text-base md:text-lg text-black [@media(hover:hover)]:group-hover:text-white tracking-tight">
                          {post.title}
                        </span>
                        <span aria-hidden="true" className="text-right text-black/40 [@media(hover:hover)]:group-hover:text-white">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
