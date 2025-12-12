import linkedin from "~/images/Global/in.svg";
import { getImageUrl } from '~/utils/cdn';

const linkedin = getImageUrl('Global/in.svg');
const git = getImageUrl('Global/git.svg');
const email = getImageUrl('Global/email.svg');
export default function Footer() {
  return (
    <footer className="bg-white  border-t-4 border-black  py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center">
          <div className="w-full px-4 mx-auto text-center">
            <div className="text-black  font-neo">
              <div className="text-sm pb-4 text-black  font-neo font-semibold tracking-wide">
                version: {__GIT_VERSION__}
              </div>


              {/* Social media buttons on separate row */}
              <div className="mt-0 flex items-center justify-center space-x-4">
                <a href="mailto: trbbarron@gmail.com"
                  className="bg-white  !border-2 border-black  h-12 w-12 flex items-center justify-center hover:bg-accent "
                  type="button">
                  <div className="">
                    <img
                      src={email}
                      alt="EMAIL"
                      className="w-6 h-6"
                    />
                  </div>
                </a>

                <a href="https://github.com/trbarron"
                  className="bg-white  !border-2 border-black  h-12 w-12 flex items-center justify-center hover:bg-accent "
                  type="button">
                  <div className="">
                    <img
                      src={git}
                      alt="GITHUB"
                      className="w-6 h-6"
                    />
                  </div>
                </a>

                <a href="https://linkedin.com/in/tylerbarron"
                  className="bg-white  !border-2 border-black  h-12 w-12 flex items-center justify-center hover:bg-accent "
                  type="button">
                  <div className="">
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