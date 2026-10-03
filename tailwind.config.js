/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFBF7',
          100: '#FAF7F2',
          200: '#F4EFEA',
          300: '#EAE3DA',
          400: '#DDD4C7',
          card: '#FFFFFF',
        },
        terracotta: {
          50: '#FDF5F2',
          100: '#FAE8E2',
          200: '#F4D2C5',
          300: '#E8A78F',
          400: '#DC7C59',
          500: '#C85A32', // Primary
          600: '#B44A24',
          700: '#963A19',
          800: '#792E15',
          900: '#632512',
        },
        botanical: {
          50: '#F2F7F4',
          100: '#E3EFE8',
          200: '#C7DFD1',
          300: '#9FC4B0',
          400: '#6FA489',
          500: '#3D7A5C',
          600: '#2D5A43', // Secondary deep sage
          700: '#244735',
          800: '#1D372A',
          900: '#172B21',
        },
        ink: {
          900: '#1C1917', // near-black
          800: '#2B2724',
          700: '#44403C',
          500: '#78716C',
          400: '#A8A29E',
          300: '#D6D3D1',
        },
        borderWarm: {
          DEFAULT: '#E8E2D8',
          subtle: '#F0ECE4',
          dark: '#DDD5C8',
        },
        sand: {
          100: '#F5F0E8',
          200: '#EAE3D5',
          300: '#DDD4C7',
          400: '#CEC3B4',
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Playfair Display', 'Lora', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(28, 25, 23, 0.03), 0 1px 2px -1px rgba(28, 25, 23, 0.03)',
        card: '0 2px 6px -1px rgba(28, 25, 23, 0.04), 0 1px 4px -1px rgba(28, 25, 23, 0.02)',
        float: '0 8px 24px -4px rgba(28, 25, 23, 0.08), 0 4px 12px -2px rgba(28, 25, 23, 0.04)',
      },
      keyframes: {
        checkDraw: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        checkCompress: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(0.88)' },
          '100%': { transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sheetUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        checkDraw: 'checkDraw 220ms ease-out forwards',
        checkCompress: 'checkCompress 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        fadeIn: 'fadeIn 200ms ease-out forwards',
        sheetUp: 'sheetUp 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    },
  },
  plugins: [],
}
