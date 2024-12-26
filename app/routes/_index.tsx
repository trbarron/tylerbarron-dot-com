import type { MetaFunction } from "@remix-run/node";
import Footer from "~/components/Footer";

import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import fs from 'fs/promises';
import path from 'path';
import { processMdx } from '~/utils/mdx.server';

export async function loader() {
  // Get the directory path
  const postsPath = path.join(process.cwd(), '..', 'posts');
  console.log('Posts path:', postsPath);
  
  try {
    // Read all files in the posts directory
    const files = await fs.readdir(postsPath);
    const mdxFiles = files.filter(file => file.endsWith('.mdx'));
    
    // Process each MDX file to get its frontmatter
    const posts = await Promise.all(
      mdxFiles.map(async (filename) => {
        const filePath = path.join(postsPath, filename);
        const source = await fs.readFile(filePath, 'utf-8');
        const { frontmatter } = await processMdx(source);
        
        return {
          slug: filename.replace('.mdx', ''),
          title: frontmatter.title,
          date: frontmatter.date,
        };
      })
    );
    
    // Sort posts by date (most recent first)
    posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return json({ posts });
  } catch (error) {
    console.error('Error loading blog posts:', error);
    return json({ posts: [] });
  }
}

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
  // {
  //   to: "/CamelUpCup",
  //   title: "Camel Up Cup",
  //   description: "\"Bring your own board game playing bot\" competition"
  // },
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
  // {
  //   to: "/RiddlerWarfare",
  //   title: "Riddler Warfare",
  //   description: "Blotto style game-theory challenge"
  // },
  {
    to: "/CatTracker",
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
  // {
  //   to: "/BoulderingTracker",
  //   title: "Bouldering Tracker",
  //   description: "Using computer vision to track climbing style"
  // },
  // {
  //   to: "/SSBM",
  //   title: "Super Smash Bros. Melee Mods",
  //   description: "Collection of hardware and software mods"
  // }
];

export default function Index() {

  const { posts } = useLoaderData<typeof loader>();

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
            {links.map(({ to, title, description }) => (
              <li key={to}>
                <Link to={to} className="py-1 home-link">{title}</Link>
                <div className="ml-6 text-sm text-gray-600 pb-2">{description}</div>
              </li>
            ))}
          </ul>

          <h2 className="ml-4 text-offBlack">Writing</h2>
          <ul className="mx-auto pl-6 pr-4 h-5/6 text-xl leading-normal lg:leading-relaxed md:text-2xl lg:text-2xl text-transparent bg-clip-text bg-text-bg" style={{ width: "fit-content", height: "fit-content" }}>
            {posts.map((post) => (
              <li key={post.slug}>
                <Link to={`/blog/${post.slug}`} className="py-1 home-link">{post.title}</Link>
                <div className="ml-6 text-sm text-gray-600 pb-2">
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="sm:h-auto lg:hidden w-screen">
        <Footer />
      </div>
    </main>
  );
}