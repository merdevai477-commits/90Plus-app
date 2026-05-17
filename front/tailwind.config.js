/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        purple: {
          deep: '#1A0B2E',
          dark: '#2D1B4E',
          mid: '#4C1D95',
          glow: '#7C3AED',
          light: '#A78BFA',
        },
        gold: {
          primary: '#F5C518',
          dark: '#A17F37',
          light: '#FFE066',
        },
      },
      fontFamily: {
        inter: ['Inter_400Regular'],
        'inter-bold': ['Inter_700Bold'],
        'inter-extrabold': ['Inter_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
