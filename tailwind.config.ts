import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Color rosa principal de Liverpool
        'brand-orange': '#FF6600',
        // Colores rosa tipo Liverpool
        liverpool: {
          50: '#fff3eb',
          100: '#ffe4c6',
          200: '#ffcb90',
          300: '#ffaa51',
          400: '#ff861f',
          500: '#ff6600',
          600: '#ef4e00', // Naranja Liverpool principal
          700: '#c63800',
          800: '#9d2d09',
          900: '#7e270c',
        },
        primary: {
          50: '#fff3eb',
          100: '#ffe4c6',
          200: '#ffcb90',
          300: '#ffaa51',
          400: '#ff861f',
          500: '#ff6600', // Naranja primario
          600: '#ef4e00',
          700: '#c63800',
          800: '#9d2d09',
          900: '#7e270c',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        // Fade in desde abajo
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Fade in desde arriba
        'fade-down': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Fade in desde izquierda
        'fade-left': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Fade in desde derecha
        'fade-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Scale in (para cards/modals)
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Skeleton shimmer para loading
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        blink: 'blink 1.5s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out',
        'fade-down': 'fade-down 0.5s ease-out',
        'fade-left': 'fade-left 0.5s ease-out',
        'fade-right': 'fade-right 0.5s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 15px rgba(227, 18, 125, 0.3)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;