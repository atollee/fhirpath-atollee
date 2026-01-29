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
        atollee: {
          ocean: '#1ed2ff',
          sea: '#00a3cc',
        },
      },
    },
  },
  plugins: [],
};
