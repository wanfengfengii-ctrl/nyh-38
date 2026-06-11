/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#fdfcf9',
          100: '#f9f5ec',
          200: '#f1e7d0',
          300: '#e5d3a9',
          400: '#d4b87a',
          500: '#c4a052',
          600: '#b1893d',
          700: '#926c32',
          800: '#76572e',
          900: '#624829',
        },
        ink: {
          50: '#f5f5f4',
          100: '#e8e6e3',
          200: '#d3cfc8',
          300: '#b5aea1',
          400: '#928877',
          500: '#776b5a',
          600: '#62574a',
          700: '#50473e',
          800: '#433c36',
          900: '#3a3530',
        }
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
