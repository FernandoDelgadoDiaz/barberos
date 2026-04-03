import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080808',
        surface: '#0e0e0e',
        card: '#111111',
        border: '#1c1c1c',
        accent: '#B8FF47',
        purple: '#c084fc',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config