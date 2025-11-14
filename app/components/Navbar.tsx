import { Link } from 'react-router';

export function Navbar() {
  return (
    <nav className="bg-white dark:bg-black border-b-4 border-black dark:!border-white flex flex-wrap items-center justify-between px-4 py-6">
      <Link 
        to="/"
        className="container px-4 mx-auto flex flex-wrap items-center justify-between hover:bg-accent dark:hover:bg-accent hover:text-white transition-all duration-100 group no-underline hover:no-underline"
      >
        <div className="w-full relative flex justify-between lg:w-auto lg:static lg:block lg:justify-start font-neo">
          <div className="leading-tight whitespace-no-wrap">
            <div className="text-4xl text-black dark:text-white font-extrabold group-hover:text-white transition-colors duration-100 tracking-tighter">
              BARRON WASTELAND
            </div>
            <div className="text-lg text-black dark:text-white group-hover:text-white transition-colors duration-100 font-semibold tracking-wide">
              FOOD FOR THOUGHT // IDEAS FOR EATING
            </div>
          </div>
        </div>
      </Link>
    </nav>
  );
}