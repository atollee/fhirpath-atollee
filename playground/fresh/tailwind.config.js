/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./routes/**/*.{tsx,ts}",
    "./islands/**/*.{tsx,ts}",
    "./components/**/*.{tsx,ts}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        mono: ["Fira Code", "Consolas", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
