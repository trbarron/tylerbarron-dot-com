import Footer from "~/components/Footer";
import { Link, useLoaderData } from 'react-router';

interface Post {
  slug: string;
  title: string;
  date: string;
  type?: string;
  subtitle?: string;
}

export async function loader() {
  // Use ARC_ENV (automatically set by Architect) to detect production
  const isProduction = process.env.ARC_ENV === 'production';
  
  if (isProduction) {
    // In production, fetch pre-compiled JSON files from S3
    const region = 'us-west-2'; // Hardcode since it matches app.arc
    const bucketName = process.env.AWS_BUCKET_NAME || 'remix-website-writing-posts';

    const { S3Client, GetObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: region });

    try {
      const { Contents = [] } = await s3.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'compiled-posts/'
      }));

      const posts = await Promise.all(
        Contents.map(async (obj) => {
          if (!obj.Key || !obj.Key.endsWith('.json')) return null;
          try {
            const { Body } = await s3.send(new GetObjectCommand({
              Bucket: bucketName,
              Key: obj.Key
            }));
            if (!Body) return null;
            const jsonString = await Body.transformToString();
            const { frontmatter } = JSON.parse(jsonString);
            return {
              slug: obj.Key.replace('compiled-posts/', '').replace('.json', ''),
              title: frontmatter.title,
              date: frontmatter.date,
              type: frontmatter.type,
              subtitle: frontmatter.subtitle,
            };
          } catch (err) {
            console.error(`Error processing ${obj.Key}:`, err);
            return null;
          }
        })
      );
      const validPosts = posts.filter((post): post is NonNullable<typeof post> => post !== null);
      return Response.json({ posts: validPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
    } catch (error) {
      console.error('S3 Error:', error);
      return Response.json({ posts: [] });
    }
  } else {
    // In development, compile MDX on the fly
    // Dynamic imports to keep mdx-bundler out of production bundle
    const [{ processMdx }, fs, path] = await Promise.all([
      import('~/utils/mdx.server'),
      import('fs/promises'),
      import('path')
    ]);
    
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
    to: "/the-riddler",
    title: "FiveThirtyEight's The Riddler",
    description: "Math puzzles and problems"
  },
  {
    to: "/camel-up-cup",
    title: "Camel Up Cup",
    description: "\"Bring your own board game playing bot\" competition"
  },
  {
    to: "/chesser-guesser/unlimited",
    title: "Chesser Guesser",
    description: "Can you tell who is winning the chess game?"
  },
  {
    to: "/collaborative-checkmate",
    title: "Collaborative Checkmate",
    description: "Play chess with your friends"
  },
  {
    to: "/pizza-rating",
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
    to: "/cat-tracker",
    title: "Cat Work Tracker",
    description: "Measuring the cat's time in the office"
  },

  {
    to: "https://trbarron.itch.io/spheroid-zero",
    title: "Spheroid Zero",
    description: "A Godot game, a game jam submission"
  },
  {
    to: "/set",
    title: "Set",
    description: "Using computer vision to play a board game"
  },
  {
    to: "/bouldering-tracker",
    title: "Bouldering Tracker",
    description: "Using computer vision to track climbing style"
  },
  {
    to: "/SSBM",
    title: "Super Smash Bros. Melee Mods",
    description: "Collection of hardware and software mods"
  },
  {
    to: "/generative-art",
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