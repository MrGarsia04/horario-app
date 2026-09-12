/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        board: {
          bg: '#1B2430',
          panel: '#131920',
          line: '#2A3444',
          cream: '#F2EFE9',
          amber: '#E8A33D',
          teal: '#4C7C7C',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
