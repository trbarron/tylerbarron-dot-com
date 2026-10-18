import { Link } from 'react-router';

export function Navbar() {
  return (
    <nav className="relative z-10 flex flex-wrap items-center justify-between border-b-4 border-black bg-white/90 px-4 py-6 backdrop-blur-sm">
      <Link
        to="/"
        className="hover:bg-accent group container mx-auto flex flex-wrap items-center justify-between px-4 no-underline hover:text-white hover:no-underline"
      >
        <div className="font-neo relative flex w-full justify-between lg:static lg:block lg:w-auto lg:justify-start">
          <div className="whitespace-no-wrap leading-tight">
            <div className="text-4xl font-extrabold tracking-tighter text-black group-hover:text-white">
              BARRON WASTELAND
            </div>
            <div className="text-lg font-semibold tracking-wide text-black group-hover:text-white">
              A SERIES OF FLAT CIRCLES
            </div>
          </div>
        </div>
      </Link>
    </nav>
  );
}
