import email from "~/images/Global/email.svg";
import git from "~/images/Global/git.svg";
import linkedin from "~/images/Global/in.svg";

export default function Footer() {
  return (
    <footer className="bg-white border-t-4 border-black py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center">
          <div className="w-full px-4 mx-auto text-center">
            <div className="text-black font-neo">
              <div className="text-sm pb-4 text-black font-neo font-semibold tracking-wide">
                V5.0.11
              </div>
              <div className="mt-0 flex items-center justify-center space-x-4">
                <a href="mailto: trbbarron@gmail.com"
                  className="bg-white border-2 border-black h-12 w-12 flex items-center justify-center hover:bg-accent transition-all duration-100"
                  type="button">
                  <img
                    src={email}
                    alt="EMAIL"
                    className="w-6 h-6"
                  />
                </a>

                <a href="https://github.com/trbarron"
                  className="bg-white border-2 border-black h-12 w-12 flex items-center justify-center hover:bg-accent transition-all duration-100"
                  type="button">
                  <img
                    src={git}
                    alt="GITHUB"
                    className="w-6 h-6"
                  />
                </a>

                <a href="https://linkedin.com/in/tylerbarron"
                  className="bg-white border-2 border-black h-12 w-12 flex items-center justify-center hover:bg-accent transition-all duration-100"
                  type="button">
                  <img
                    src={linkedin}
                    alt="LINKEDIN"
                    className="w-6 h-6"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}