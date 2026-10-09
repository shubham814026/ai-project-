/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          reserve: '#0F251E',
          surface: '#16382D',
          border: 'rgba(244, 246, 244, 0.10)',
        },
        moss: '#16382D',
        softwhite: '#F4F6F4',
        sage: '#94A39E',
        brass: {
          DEFAULT: '#C5A059',
          dark: '#B08C45',
          light: '#D4B473',
        },
        mint: '#5EEAD4',
        amber: '#FF9F43',
        freshgreen: '#4ADE80',
        coral: '#F0746B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
