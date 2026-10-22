import RetroreflectanceTrigger from '~/components/RetroreflectanceTrigger';

// Semantic version from package.json, with the build's short commit hash appended.
const appVersion = `v${__APP_VERSION__}${__GIT_COMMIT__ ? ` · ${__GIT_COMMIT__}` : ''}`;

// Icons inline (fill: currentColor) rather than as CDN images: no extra requests, they work in
// dev without a CDN, and they follow the link's text colour on hover.
const LINKS = [
  {
    label: 'Email',
    href: 'mailto:trbbarron@gmail.com',
    viewBox: '0 0 512 512',
    path: 'M437.332 80H74.668C51.199 80 32 99.198 32 122.667v266.666C32 412.802 51.199 432 74.668 432h362.664C460.801 432 480 412.802 480 389.333V122.667C480 99.198 460.801 80 437.332 80zM432 170.667L256 288 80 170.667V128l176 117.333L432 128v42.667z',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/trbarron',
    viewBox: '0 0 32 32',
    path: 'M16,0.4c-8.8,0-16,7.2-16,16c0,7.1,4.6,13.1,10.9,15.2c0.8,0.2,1.1-0.3,1.1-0.8c0-0.4,0-1.4,0-2.7c-4.5,1-5.4-2.2-5.4-2.2c-0.7-1.8-1.8-2.3-1.8-2.3c-1.4-1,0.1-1,0.1-1c1.6,0.1,2.4,1.6,2.4,1.6c1.4,2.4,3.7,1.7,4.7,1.3c0.1-1,0.6-1.7,1-2.1c-3.6-0.4-7.3-1.8-7.3-7.9c0-1.8,0.6-3.2,1.6-4.3c-0.2-0.4-0.7-2,0.1-4.2c0,0,1.3-0.4,4.4,1.6c1.3-0.4,2.6-0.5,4-0.5c1.4,0,2.7,0.2,4,0.5C23,6.6,24.4,7,24.4,7c0.9,2.2,0.3,3.8,0.2,4.2c1,1.1,1.6,2.5,1.6,4.3c0,6.1-3.7,7.5-7.3,7.9c0.6,0.5,1.1,1.5,1.1,3c0,2.1,0,3.9,0,4.4c0,0.4,0.3,0.9,1.1,0.8c6.4-2.1,11-8.1,11-15.2C32,7.6,24.8,0.4,16,0.4L16,0.4z',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/tyler-barron-61972855/',
    viewBox: '0 0 512 512',
    path: 'M448.9,31H63c-17.7,0-32,14.6-32,32.4v385.1c0,17.9,14.4,32.4,32,32.4h385.8c17.7,0,32.1-14.6,32.1-32.4V63.4C481,45.6,466.5,31,448.9,31z M167,416.7h-66.7V202h66.8v214.8H167z M133.7,172.6c-21.4,0-38.7-17.4-38.7-38.7s17.3-38.7,38.7-38.7c21.3,0,38.7,17.4,38.7,38.7C172.3,155.4,155.1,172.6,133.7,172.6z M417,416.7h-66.7V312.2c0-24.9-0.5-57-34.7-57c-34.8,0-40.1,27.1-40.1,55.1v106.3h-66.7V202h64v29.3h0.9c8.9-16.9,30.7-34.7,63.2-34.7c67.5,0,80.1,44.5,80.1,102.4V416.7z',
  },
];

export default function Footer() {
  return (
    <footer className="font-neo relative z-10 border-t-4 border-black bg-white/90 px-4 py-8 text-center text-black backdrop-blur-sm">
      <div className="pb-4 text-sm font-semibold tracking-wide">version: {appVersion}</div>

      <ul className="m-0 flex list-none items-center justify-center gap-4 p-0">
        {LINKS.map(({ label, href, viewBox, path }) => (
          <li key={label}>
            <a
              href={href}
              aria-label={label}
              title={label}
              className="hover:bg-accent flex h-12 w-12 items-center justify-center border-2 border-black bg-white text-black hover:text-white"
            >
              <svg viewBox={viewBox} className="h-6 w-6" fill="currentColor" aria-hidden="true">
                <path d={path} />
              </svg>
            </a>
          </li>
        ))}
      </ul>

      <RetroreflectanceTrigger />
    </footer>
  );
}
