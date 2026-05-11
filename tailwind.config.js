/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        jakarta: ['PlusJakartaSans_400Regular', 'sans-serif'],
        'jakarta-bold': ['PlusJakartaSans_700Bold', 'sans-serif'],
        'jakarta-light': ['PlusJakartaSans_300Light', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      colors: {
        brand: {
          50: '#fff1f0',
          100: '#ffdfdb',
          200: '#ffc3bd',
          300: '#ff9a91',
          400: '#ff6254',
          500: '#E0533D', // Financy Primary Coral (Replaces Indigo)
          600: '#d73b24',
          700: '#b42b17',
          800: '#942617',
          900: '#E0533D30', // Semi-trans for bubbles
        },
        emerald: {
          50: '#469B8810',
          100: '#469B8820',
          400: '#469B88',
          500: '#469B88', // Financy Success Teal
          600: '#3A8272',
          950: '#469B8830',
        },
        gray: {
          50: '#F4F6F9', // Financy Surface Background
          100: '#eef1f6',
          200: '#e2e8f0',
          800: '#1e1e28',
          900: '#242424', // Financy Dark Text
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.9)',
          black: 'rgba(0, 0, 0, 0.5)',
          border: 'rgba(255, 255, 255, 0.4)',
        },
        financy: {
          primary: '#E0533D',
          secondary: '#9DA7D0',
          success: '#469B88',
          link: '#377CC8',
          dark: '#242424',
          surface: '#F4F6F9'
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      }
    },
  },
  plugins: [],
}
