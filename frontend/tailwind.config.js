/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#050a14',
        'bg-card': '#0d1526',
        'border-subtle': '#1e2d4a',
        'accent-blue': '#00d4ff',
        'accent-purple': '#7c3aed',
        'accent-green': '#00ff88',
        'accent-red': '#ff4757',
        'accent-orange': '#ff8c00',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'gradient': 'gradientShift 4s ease infinite',
      },
    },
  },
  plugins: [],
};
