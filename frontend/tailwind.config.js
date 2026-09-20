/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F3F3',
        canvasBorder: '#E2E0E0',
        surface: {
          dark: '#141619',
          elevated: '#2C2E3A',
        },
        navy: {
          deep: '#050A44',
          DEFAULT: '#050A44',
        },
        cobalt: {
          DEFAULT: '#0A21C0',
          hover: '#1E3DE6',
        },
        textMuted: '#B3B4BD',
        priceGreen: '#4ADE80',
        discountRed: '#F87171',
        warningYellow: '#FBBF24',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
