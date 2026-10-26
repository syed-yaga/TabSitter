/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sloth: {
          50: "#fdf8f6",
          100: "#f2e8e5",
          200: "#eaddd7",
          300: "#e0cec7",
          400: "#d2bab0",
          500: "#bfa094",
          600: "#a18072",
          700: "#977669",
          800: "#846358",
          900: "#43302b",
        },
        jungle: {
          50: "#f2fbf6",
          100: "#e1f6eb",
          200: "#c5edd8",
          300: "#97dec0",
          400: "#60c5a2",
          500: "#3aa887",
          600: "#2a876d",
          700: "#246c59",
          800: "#205648",
          900: "#1c473c",
        }
      }
    },
  },
  plugins: [],
}
