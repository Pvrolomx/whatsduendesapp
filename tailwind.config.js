/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          dark: '#075E54',
          light: '#25D366',
          sent: '#DCF8C6',
          bg: '#ECE5DD',
          input: '#F0F0F0'
        }
      }
    }
  },
  plugins: []
}
