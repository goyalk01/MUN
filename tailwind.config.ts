import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Premium neutral palette
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#FAFAFA',
          tertiary: '#F5F5F5',
          border: '#E5E5E5',
          dark: {
            DEFAULT: '#0A0C12',
            secondary: '#12141C',
            tertiary: '#171717',
            elevated: '#1A1A1A',
            border: 'rgba(255,255,255,0.08)',
          },
        },
        // Minimal accent - only used sparingly
        accent: {
          DEFAULT: '#171717',
          muted: '#525252',
          light: '#F5F5F5',
          dark: '#FAFAFA',
        },
        // Status colors - muted, professional
        status: {
          active: '#22C55E',
          warning: '#F59E0B',
          critical: '#EF4444',
          info: '#3B82F6',
        },
        // Text hierarchy
        text: {
          primary: '#0A0A0A',
          secondary: '#525252',
          tertiary: '#A3A3A3',
          inverse: '#FAFAFA',
          'dark-primary': '#FAFAFA',
          'dark-secondary': '#A3A3A3',
          'dark-tertiary': '#525252',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        'display': ['4rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'hero': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'title': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body': ['0.9375rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.02em', fontWeight: '500' }],
        'label': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '500' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0,0,0,0.04)',
        'card': '0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'elevated': '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'dark-subtle': '0 1px 2px rgba(0,0,0,0.2)',
        'dark-card': '0 2px 8px rgba(0,0,0,0.3)',
        'dark-elevated': '0 4px 16px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(34, 197, 94, 0.2)' },
        },
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
