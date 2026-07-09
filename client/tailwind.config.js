/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'Inter Variable', 'system-ui', 'sans-serif'],
        // Chiffres alignés pour la finance / les tableaux
        num: ['Inter Variable', '"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        sidebar: '#171b26',
        fond: '#f6f7f9',
        primaire: {
          DEFAULT: '#2563eb',
          50: '#eff5ff',
          100: '#dbe8fe',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        ambre: '#f59e0b',
      },
      boxShadow: {
        carte: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        'carte-hover': '0 4px 6px -2px rgba(16, 24, 40, 0.05), 0 12px 24px -8px rgba(37, 99, 235, 0.16)',
        flottant: '0 8px 16px -4px rgba(16, 24, 40, 0.08), 0 20px 40px -12px rgba(16, 24, 40, 0.14)',
        bouton: '0 1px 2px rgba(37, 99, 235, 0.24), 0 4px 10px -3px rgba(37, 99, 235, 0.36)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      letterSpacing: {
        tight2: '-0.011em',
      },
    },
  },
  plugins: [],
}
