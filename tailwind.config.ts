import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#085041",
        secondary: "#1D9E75",
        "data-blue": "#378ADD",
        "mint-light": "#E1F5EE",
        "chat-bg": "#051f1a",
      },
      fontFamily: {
        persian: ["Vazirmatn", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
