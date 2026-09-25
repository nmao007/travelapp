import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17251f",
        forest: "#28634a",
        mint: "#e9f2eb",
        canvas: "#f7f8f5",
      },
      fontFamily: { sans: ["Arial", "Helvetica", "sans-serif"] },
      boxShadow: { card: "0 18px 50px rgba(28, 48, 37, 0.07)" },
    },
  },
  plugins: [],
};

export default config;
