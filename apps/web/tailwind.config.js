/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          raised: 'var(--bg-surface-raised)',
          active: 'var(--bg-surface-active)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          subtle: 'var(--accent-subtle)',
          border: 'var(--accent-border)',
        },
        txt: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        status: {
          healthy: 'var(--status-healthy-text)',
          degraded: 'var(--status-degraded-text)',
          unhealthy: 'var(--status-unhealthy-text)',
          unknown: 'var(--status-unknown-text)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '3px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};
