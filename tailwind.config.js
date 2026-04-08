/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Sora"', 'sans-serif'],
      },
      colors: {
        surface: {
          950: '#070b17',
          900: '#0b1020',
          800: '#12172a',
          700: '#18203b',
        },
        accent: {
          blue: '#4f7cff',
          cyan: '#34d7ff',
          violet: '#8b5cf6',
          mint: '#83ffc7',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 24px 80px rgba(34, 211, 238, 0.18)',
        panel: '0 24px 80px rgba(5, 10, 25, 0.35)',
      },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(circle at top, rgba(79,124,255,0.24), transparent 32%), radial-gradient(circle at 80% 20%, rgba(52,215,255,0.18), transparent 24%), radial-gradient(circle at 20% 80%, rgba(139,92,246,0.18), transparent 24%)',
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 14s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};
