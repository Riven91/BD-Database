import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#050505",
          900: "#0B0B0B",
          850: "#0F0F0F",
          800: "#1A1A1A",
          700: "#123018"
        },
        emerald: {
          700: "#0f5132",
          800: "#0b3d24"
        },
        text: {
          base: "#EDEDED",
          muted: "#9AA0A6"
        }
      }
    }
  },
  plugins: []
};

export default config;
