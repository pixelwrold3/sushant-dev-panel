/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        card: '#0f172a',
        'card-hover': '#131e36',
        border: '#1e293b',
        primary: {
          DEFAULT: '#3b82f6',
          foreground: '#ffffff',
          hover: '#2563eb'
        },
        accent: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        muted: '#64748b',
        panel: '#0d1322',
        sidebar: '#0a0e1a'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace']
      }
    },
  },
  plugins: [],
}

