const { heroui } = require('@heroui/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ground: '#F7F7FC',
        ink: { DEFAULT: '#1A202C', 2: '#4E4B66', 3: '#6E7191' },
        line: '#D9DBE9',
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            // EZForm primary (form/tailwind.config.ts)
            primary: {
              50: '#EEF4FD',
              100: '#D7E5FA',
              200: '#AFCBF5',
              300: '#7FAAEE',
              400: '#3F80E3',
              500: '#005BD4',
              600: '#004DB4',
              700: '#003E91',
              800: '#002F6E',
              900: '#00214D',
              DEFAULT: '#005BD4',
              foreground: '#FFFFFF',
            },
            focus: '#005BD4',
          },
        },
      },
    }),
  ],
};
