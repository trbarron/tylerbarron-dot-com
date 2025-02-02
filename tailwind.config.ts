import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    fontFamily: {
      berkeley: ['Berkeley', 'system-ui']
    },
    extend: {
      spacing: {
        xl: "49rem",
        iauto: "0",
      },
      backgroundImage: {
        'background': 'radial-gradient(circle at bottom left, #F2F0E5, #FFFFFF, #9CA3AF)',
        'text-bg': 'radial-gradient(circle at bottom left, #4385BE, #24837B, #4385BE)',
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
        red: {
          light: '#059669',
          DEFAULT: '#059669',
          dark: '#059669',
          clear: "#018786DD",
        },
        offWhite: {
          DEFAULT: '#F2F0E5'
        },
        offBlack: {
          DEFAULT: '#1C1B1A'
        },
        gray: {
          light: '#f2f2f2',
          DEFAULT: '#2E3532',
          dark: '#171717',
          clear: "#171717DD",
        },
      },
    }
  },
  plugins: [
    typography,
  ],
} satisfies Config