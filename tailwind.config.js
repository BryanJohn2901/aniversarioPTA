/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:      '#020617',
          navy:    '#0d1e3d',
          primary: '#3b82f6',
          accent:  '#06b6d4',
          gold:    '#c8962c',
          success: '#10b981'
        }
      },
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        heading: ['Oswald', 'sans-serif']
      }
    }
  },
  plugins: []
}
