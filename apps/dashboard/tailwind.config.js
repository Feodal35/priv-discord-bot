/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        priv: {
          bg: '#0F1015',
          card: '#161821',
          hover: '#1E212D',
          border: '#272A38',
          accent: '#5865F2',
          accentHover: '#4752C4',
          textMuted: '#949BA4',
          textHeading: '#F2F3F5',
        }
      }
    },
  },
  plugins: [],
}
