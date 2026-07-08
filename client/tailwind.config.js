/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1e2430',
        fond: '#f5f6f8',
        primaire: '#2563eb',
      },
    },
  },
  plugins: [],
}
