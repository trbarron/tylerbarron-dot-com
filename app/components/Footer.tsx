import RetroreflectanceTrigger from '~/components/RetroreflectanceTrigger';
import { getImageUrl } from '~/utils/cdn';

const linkedin = getImageUrl('Global/in.svg');
const git = getImageUrl('Global/git.svg');
const email = getImageUrl('Global/email.svg');

// Semantic version from package.json, with the build's short commit hash appended.
const appVersion = `v${__APP_VERSION__}${__GIT_COMMIT__ ? ` · ${__GIT_COMMIT__}` : ''}`;

export default function Footer() {
  return (
    <footer className="relative z-10 border-t-4 border-black bg-white/90 py-8 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center">
          <div className="mx-auto w-full px-4 text-center">
            <div className="font-neo text-black">
              <div className="font-neo pb-4 text-sm font-semibold tracking-wide text-black">version: {appVersion}</div>

              {/* Social media buttons on separate row */}
              <div className="mt-0 flex items-center justify-center space-x-4">
                <a
                  href="mailto: trbbarron@gmail.com"
                  className="hover:bg-accent flex h-12 w-12 items-center justify-center !border-2 border-black bg-white"
                  type="button"
                >
                  <div className="">
                    <img src={email} alt="EMAIL" className="h-6 w-6" />
                  </div>
                </a>

                <a
                  href="https://github.com/trbarron"
                  className="hover:bg-accent flex h-12 w-12 items-center justify-center !border-2 border-black bg-white"
                  type="button"
                >
                  <div className="">
                    <img src={git} alt="GITHUB" className="h-6 w-6" />
                  </div>
                </a>

                <a
                  href="https://www.linkedin.com/in/tyler-barron-61972855/"
                  className="hover:bg-accent flex h-12 w-12 items-center justify-center !border-2 border-black bg-white"
                  type="button"
                >
                  <div className="">
                    <img src={linkedin} alt="LINKEDIN" className="h-6 w-6" />
                  </div>
                </a>
              </div>

              <RetroreflectanceTrigger />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
