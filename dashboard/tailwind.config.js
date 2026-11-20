/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 900: '#0B1220', 800: '#111A2B', 700: '#1E293B', 600: '#334155' },
        accent: '#F2B134',
        warn: '#FBBF24',
        danger: '#F87171',
        ok: '#4ADE80',
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
