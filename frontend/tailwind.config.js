const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Next may compile with cwd at repo root (server.js) or frontend/.
    "./app/**/*.{js,ts,jsx,tsx}",
    "./frontend/app/**/*.{js,ts,jsx,tsx}",
    path.join(__dirname, "app/**/*.{js,ts,jsx,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        // Primary violet, echoing the logo's purple face.
        brand: { DEFAULT: "#7c3aed", light: "#a855f7", dark: "#6d28d9" },
        // Playful accents pulled straight from the dice-cube logo.
        fun: {
          pink: "#ec4899",
          purple: "#8b5cf6",
          blue: "#3b82f6",
          cyan: "#22d3ee",
          green: "#22c55e",
          yellow: "#facc15",
          orange: "#fb923c",
        },
      },
      boxShadow: {
        fun: "0 8px 24px -10px rgba(124, 58, 237, 0.45)",
      },
    },
  },
  plugins: [],
};
