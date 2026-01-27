import { Link } from 'react-router';

export function Navbar() {
  return (
    <nav className="border-b-4 border-black flex flex-wrap items-center justify-between px-4 py-6 bg-white/90 backdrop-blur-sm relative z-10">
      <Link 
        to="/"
        className="container px-4 mx-auto flex flex-wrap items-center justify-between hover:bg-accent  hover:text-white group no-underline hover:no-underline"
      >
        <div className="w-full relative flex justify-between lg:w-auto lg:static lg:block lg:justify-start font-neo">
          <div className="leading-tight whitespace-no-wrap">
            <div className="text-4xl text-black  font-extrabold group-hover:text-white tracking-tighter">
              BARRON WASTELAND
            </div>
            <div className="text-lg text-black  group-hover:text-white font-semibold tracking-wide">
              FOOD FOR THOUGHT // IDEAS FOR EATING
            </div>
          </div>
        </div>
      </Link>
    </nav>
  );
}