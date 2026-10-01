import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fnvac: {
          blue: {
            50: '#f0f7fb',
            100: '#dbeefa',
            200: '#bce0f6',
            300: '#8ac9ee',
            400: '#52abe0',
            500: '#1d85be',
            600: '#136793', // Official FNVAC Blue
            700: '#0f5377',
            800: '#0c4360',
            900: '#082e44',
            950: '#051e2d',
          },
          red: {
            50: '#fef2f2',
            100: '#fee2e2',
            200: '#fecaca',
            300: '#fca5a5',
            400: '#f87171',
            500: '#e02830',
            600: '#d21e27', // Official FNVAC Red
            700: '#b3161e',
            800: '#92151c',
            900: '#79161a',
            950: '#45070a',
          },
          primary: '#136793',
          secondary: '#d21e27',
          accent: '#1d85be',
        },
        fefo: {
          red: '#ef4444',
          yellow: '#eab308',
          green: '#22c55e',
          gray: '#6b7280',
        },
      },
    },
  },
  plugins: [],
};

export default config;
