import email from "~/images/Global/email.svg";
import git from "~/images/Global/git.svg";
import linkedin from "~/images/Global/in.svg";
import { DarkModeToggle } from './DarkModeToggle';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-black border-t-4 border-black dark:!border-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center">
          <div className="w-full px-4 mx-auto text-center">
            <div className="text-black dark:text-white font-neo">
              <div className="text-sm pb-4 text-black dark:text-white font-neo font-semibold tracking-wide">
                version: {__GIT_VERSION__}
              </div>
              
              {/* Dark mode toggle on its own row */}
              <div className="mb-4 flex items-center justify-center">
                <DarkModeToggle />
              </div>

              {/* Social media buttons on separate row */}
              <div className="mt-0 flex items-center justify-center space-x-4">
                <a href="mailto: trbbarron@gmail.com"
                  className="bg-white dark:bg-black !border-2 border-black dark:!border-white h-12 w-12 flex items-center justify-center hover:bg-accent dark:hover:bg-accent transition-all duration-100"
                  type="button">
                  <div className="dark:invert">
                    <img
                      src={email}
                      alt="EMAIL"
                      className="w-6 h-6"
                    />
                  </div>
                </a>

                <a href="https://github.com/trbarron"
                  className="bg-white dark:bg-black !border-2 border-black dark:!border-white h-12 w-12 flex items-center justify-center hover:bg-accent dark:hover:bg-accent transition-all duration-100"
                  type="button">
                  <div className="dark:invert">
                    <img
                      src={git}
                      alt="GITHUB"
                      className="w-6 h-6"
                    />
                  </div>
                </a>

                <a href="https://linkedin.com/in/tylerbarron"
                  className="bg-white dark:bg-black !border-2 border-black dark:!border-white h-12 w-12 flex items-center justify-center hover:bg-accent dark:hover:bg-accent transition-all duration-100"
                  type="button">
                  <div className="dark:invert">
                    <img
                      src={linkedin}
                      alt="LINKEDIN"
                      className="w-6 h-6"
                    />
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}