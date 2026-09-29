import type { Config } from 'tailwindcss';

// Design tokens: সব রঙ CSS variable থেকে (src/theme/tokens.css) — কোনো hard-coded hex নেই
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        fg: 'rgb(var(--color-fg) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        income: 'rgb(var(--color-income) / <alpha-value>)',
        expense: 'rgb(var(--color-expense) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        page: 'rgb(var(--color-page) / <alpha-value>)',
        chart1: 'rgb(var(--chart-1) / <alpha-value>)',
        chart2: 'rgb(var(--chart-2) / <alpha-value>)',
        chart3: 'rgb(var(--chart-3) / <alpha-value>)',
        chart4: 'rgb(var(--chart-4) / <alpha-value>)',
        chart5: 'rgb(var(--chart-5) / <alpha-value>)',
        chart6: 'rgb(var(--chart-6) / <alpha-value>)',
        chart7: 'rgb(var(--chart-7) / <alpha-value>)',
        chart8: 'rgb(var(--chart-8) / <alpha-value>)',
      },
    },
  },
  plugins: [],
} satisfies Config;
