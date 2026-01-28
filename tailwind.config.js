/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#075E54',
          light: '#25D366',
          teal: '#128C7E',
          sent: '#DCF8C6',
          received: '#FFFFFF',
          bg: '#ECE5DD',
          input: '#F0F0F0',
          dark: '#111B21',
          sidebar: '#202C33',
        }
      }
    },
  },
  plugins: [],
}
