import { useEffect, useState } from 'react';

export function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydration safe - only show toggle after mount
  useEffect(() => {
    setMounted(true);
    // Check localStorage and system preference
    const stored = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'true' : prefersDark;
    setDarkMode(isDark);
    
    // Apply the class immediately
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setLightMode = () => {
    setDarkMode(false);
    localStorage.setItem('darkMode', 'false');
    document.documentElement.classList.remove('dark');
  };

  const setDarkModeOn = () => {
    setDarkMode(true);
    localStorage.setItem('darkMode', 'true');
    document.documentElement.classList.add('dark');
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="inline-flex w-44 border-2 border-black dark:!border-white">
        <div className="flex-1 h-10 bg-white"></div>
        <div className="flex-1 h-12 bg-black border-l-2 border-black dark:!border-white"></div>
      </div>
    );
  }

  return (
    <div className="inline-flex w-44 border-2 border-black dark:!border-white" role="radiogroup" aria-label="Theme selection">
      <button
        onClick={setLightMode}
        className={`flex-1 h-6 relative ${
          !darkMode 
            ? 'ring-1 ring-inset ring-accent' 
            : 'hover:opacity-80'
        }`}
        aria-label="Light mode"
        aria-checked={!darkMode}
        role="radio"
        style={{ backgroundColor: '#ffffff' }}
      >
        <span className="sr-only">Light mode</span>
      </button>
      <button
        onClick={setDarkModeOn}
        className={`flex-1 h-6 border-l-2 border-black dark:!border-white relative ${
          darkMode 
            ? 'ring-1 ring-inset ring-accent' 
            : 'hover:opacity-80'
        }`}
        aria-label="Dark mode"
        aria-checked={darkMode}
        role="radio"
        style={{ backgroundColor: '#000000' }}
      >
        <span className="sr-only">Dark mode</span>
      </button>
    </div>
  );
}

