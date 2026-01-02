import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark base
        'omnium-bg': '#0a0a0f',
        'omnium-bg-secondary': '#12121a',
        'omnium-text': '#f0f0f5',
        'omnium-muted': '#8888aa',

        // Dimension colors
        'dim-magnitude': '#ffffff',
        'dim-temporal': '#6366f1',
        'dim-locality': '#22c55e',
        'dim-purpose': '#f59e0b',
        'dim-reputation': '#ec4899',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { filter: 'drop-shadow(0 0 2px currentColor)' },
          '100%': { filter: 'drop-shadow(0 0 8px currentColor)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
