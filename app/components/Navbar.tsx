import { Link } from '@remix-run/react';

export function Navbar() {
  return (
    <nav className="relative shadow-lg bg-offWhite shadow-lg flex flex-wrap items-center justify-between px-2 py-6 navbar-expand-lg">
      <Link 
        to="/"
        className="container px-4 mx-auto flex flex-wrap items-center justify-between"
      >
        <div className="w-full relative flex justify-between lg:w-auto lg:static lg:block lg:justify-start font-body">
          <div className="leading-relaxed whitespace-no-wrap">
            <div className="text-3xl text-offBlack">
              Barron Wasteland
            </div>
            <div className="text-md text-gray-400">
              Food for thought // Ideas for eating
            </div>
          </div>
        </div>
      </Link>
    </nav>
  );
}