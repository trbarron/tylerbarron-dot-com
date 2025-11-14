import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    fontFamily: {
      mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      system: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      neo: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Helvetica', 'Arial', 'sans-serif'],
      berkeley: ['JetBrains Mono', 'SF Mono', 'Monaco', 'monospace']
    },
    extend: {
      spacing: {
        xl: "49rem",
        iauto: "0",
      },
      backgroundImage: {
        'background': 'linear-gradient(0deg, #000000, #000000)',
        'text-bg': 'linear-gradient(90deg, #000000, #000000, #000000)',
      },
      maxHeight: {
        '0': '0',
        '1/4': '25%',
        '1/2': '50%',
        '3/4': '75%',
        'full': '100%',
      },
      maxWidth: {
        '0': '0',
        '1/4': '25%',
        '1/2': '50%',
        '3/4': '75%',
        'full': '100%',
      },
      colors: {
        // White, black, and blue-green system
        primary: {
          DEFAULT: '#000000',
          light: '#333333',
          dark: '#000000',
        },
        secondary: {
          DEFAULT: '#ffffff', // White background
          light: '#ffffff',
          dark: '#f5f5f5',
        },
        accent: {
          DEFAULT: '#00605E', // Updated to match CSS
          light: '#008B87',
          dark: '#004643',
        },
        // Legacy color mappings for compatibility
        red: {
          light: '#000000',
          DEFAULT: '#000000',
          dark: '#000000',
          clear: "#000000",
        },
        offWhite: {
          DEFAULT: '#ffffff' // Changed back to white
        },
        offBlack: {
          DEFAULT: '#000000'
        },
        gray: {
          50: '#ffffff',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          light: '#f5f5f5',
          DEFAULT: '#737373',
          dark: '#000000',
          clear: "#000000",
        },
      },
      fontWeight: {
        'extra-black': '950',
        'ultra-bold': '800',
      }
    }
  },
  plugins: [typography],
}