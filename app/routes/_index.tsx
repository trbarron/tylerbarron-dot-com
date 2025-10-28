import Footer from "~/components/Footer";
import { Link, useLoaderData } from 'react-router';
import fs from 'fs/promises';
import path from 'path';
import { processMdx } from '~/utils/mdx.server';

interface Post {
  slug: string;
  title: string;
  date: string;
  type?: string;
  subtitle?: string;
}

export async function loader() {
  if (process.env.NODE_ENV === 'production') {
 
    const region = process.env.AWS_REGION || 'us-west-2';
    const bucketName = process.env.AWS_BUCKET_NAME || 'remix-website-writing-posts';

    const { S3Client, GetObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: region });

    try {
      const { Contents = [] } = await s3.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'posts/'
      }));

 
      const posts = await Promise.all(
        Contents.map(async (obj) => {
          if (!obj.Key) return null;
          const { Body } = await s3.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: obj.Key
          }));
          if (!Body) return null;
          const source = await Body.transformToString();
          const { frontmatter } = await processMdx(source);
          return {
            slug: obj.Key.replace('posts/', '').replace('.mdx', ''),
            title: frontmatter.title,
            date: frontmatter.date,
            type: frontmatter.type,
            subtitle: frontmatter.subtitle,
          };
        })
      );
      const validPosts = posts.filter((post): post is NonNullable<typeof post> => post !== null);
      return Response.json({ posts: validPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
    } catch (error) {
      console.error('S3 Error:', error);
      return Response.json({ posts: [] });
    }
  } else {
    const postsPath = path.join(process.cwd(), '..', 'posts');
    try {
      const files = await fs.readdir(postsPath);
      const posts = await Promise.all(
        files.filter(f => f.endsWith('.mdx')).map(async (filename) => {
          const source = await fs.readFile(path.join(postsPath, filename), 'utf-8');
          const { frontmatter } = await processMdx(source);
          return {
            slug: filename.replace('.mdx', ''),
            title: frontmatter.title,
            date: frontmatter.date,
            type: frontmatter.type,
            subtitle: frontmatter.subtitle,
          };
        })
      );
      return Response.json({ posts: posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
    } catch (error) {
      console.error('Filesystem Error:', error);
      return Response.json({ posts: [] });
    }
  }
 }

const links = [
  {
    to: "/TheRiddler",
    title: "FiveThirtyEight's The Riddler",
    description: "Math puzzles and problems"
  },
  {
    to: "/CamelUpCup",
    title: "Camel Up Cup",
    description: "\"Bring your own board game playing bot\" competition"
  },
  {
    to: "/chesserGuesser/unlimited",
    title: "Chesser Guesser",
    description: "Can you tell who is winning the chess game?"
  },
  {
    to: "/collaborativeCheckmate",
    title: "Collaborative Checkmate",
    description: "Play chess with your friends"
  },
  {
    to: "/PizzaRating",
    title: "National Pizza Ratings",
    description: "Using Domino's to find the best pizza"
  },
  // {
  //   to: "/ChessOpenings",
  //   title: "Chess Openings Practice",
  //   description: "Tool to practice your chess openings"
  // },
  // {
  //   to: "/RiddlerWarfare",
  //   title: "Riddler Warfare",
  //   description: "Blotto style game-theory challenge"
  // },
  {
    to: "/CatTracker",
    title: "Cat Work Tracker",
    description: "Measuring the cat's time in the office"
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
  },
  {
    to: "/GenerativeArt",
    title: "Generative Art",
    description: "Dive into plotters and generative art"
  },
  {
    to: "https://chromewebstore.google.com/detail/youtube-speed-sense/efgmcojhefjjdpdnnmclekblhpaiaedo",
    title: "YouTube Speed Sense",
    description: "Adjust video playback speed based on categories"
  }
];

export default function Index() {

  const { posts } = useLoaderData<typeof loader>();

  // Add project posts to the main projects list
  const projectPosts = posts.filter((post: Post) => post.type === 'project').map((post: Post) => ({
    to: `/blog/${post.slug}`,
    title: post.title,
    description: post.subtitle || `${new Date(post.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`
  }));

  const allProjects = [...links, ...projectPosts];

  return (
    <main className="min-h-screen bg-white relative font-neo">
      <section className="w-full py-16 top-0 z-10 flex items-center justify-center border-b-4 border-black">
        <div className="text-center">
          <div className="text-5xl md:text-6xl xl:text-7xl text-black font-neo font-extrabold tracking-tighter">
            BARRON WASTELAND
          </div>
          <div className="text-black text-xl xl:text-2xl font-neo font-semibold mt-2 tracking-wide">
            FOOD FOR THOUGHT // IDEAS FOR EATING
          </div>
        </div>
      </section>

      <section className="w-full flex items-center justify-center bg-white py-12">
        <div className="flex flex-col items-center w-full max-w-4xl">
          <h2 className="text-black text-4xl font-neo font-extrabold mb-8 border-b-2 border-accent pb-2 tracking-tight">PROJECTS</h2>
          <div className="w-full px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {allProjects.map(({ to, title, description }) => (
                <div key={to} className="border-2 border-black bg-white hover:bg-accent transition-all duration-100 group">
                  <Link to={to} className="block p-4 no-underline hover:no-underline h-full">
                    <div className="font-neo font-bold text-lg text-black group-hover:text-white transition-colors duration-100 tracking-wide">{title.toUpperCase()}</div>
                    <div className="font-neo text-sm mt-1 opacity-75 text-black group-hover:text-white group-hover:opacity-100 transition-colors duration-100 font-medium">{description}</div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-black text-4xl font-neo font-extrabold mb-8 mt-16 border-b-2 border-accent pb-2 tracking-tight">WRITING</h2>
          <ul className="w-full space-y-4 px-8">
            {posts.filter((post: Post) => post.type !== 'project').map((post: Post) => (
              <li key={post.slug} className="border-2 border-black bg-white hover:bg-accent transition-all duration-100 group">
                <Link to={`/blog/${post.slug}`} className="block p-4 no-underline hover:no-underline">
                  <div className="font-neo font-bold text-lg text-black group-hover:text-white transition-colors duration-100 tracking-wide">{post.title.toUpperCase()}</div>
                  {post.subtitle && (
                    <div className="font-neo text-base mt-1 text-black group-hover:text-white opacity-80 group-hover:opacity-100 transition-colors duration-100 font-medium">
                      {post.subtitle}
                    </div>
                  )}
                  <div className="font-neo text-sm mt-1 opacity-75 text-black group-hover:text-white group-hover:opacity-100 transition-colors duration-100 font-medium">
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }).toUpperCase()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="border-t-4 border-black">
        <Footer />
      </div>
    </main>
  );
}