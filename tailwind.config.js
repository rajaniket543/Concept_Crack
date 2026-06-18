/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand primaries
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#5B4FE8',  // PRIMARY
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        violet: {
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06B6D4',
        },
        emerald: {
          400: '#34d399',
          500: '#10B981',
        },
        amber: {
          400: '#fbbf24',
          500: '#F59E0B',
        },
        // Semantic
        success:  '#10B981',
        warning:  '#F59E0B',
        danger:   '#EF4444',
        info:     '#3B82F6',
        // Light mode surfaces
        surface: {
          DEFAULT: '#FAFAFA',
          card:    '#FFFFFF',
          muted:   '#F3F4F6',
          border:  '#E5E7EB',
        },
        // Dark mode surfaces
        dark: {
          bg:      '#0F0E17',
          surface: '#1A1929',
          card:    '#1E1D2E',
          border:  '#2D2B42',
          muted:   '#252438',
        },
        // Text
        text: {
          primary:   '#111827',
          secondary: '#374151',
          muted:     '#6B7280',
          faint:     '#9CA3AF',
          inverse:   '#F9FAFB',
        },
      },
      fontFamily: {
        headline: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans:     ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono:     ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        // Display
        'display-2xl': ['4.5rem',   { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '800' }],
        'display-xl':  ['3.75rem',  { lineHeight: '1.05', letterSpacing: '-0.035em', fontWeight: '800' }],
        'display-lg':  ['3rem',     { lineHeight: '1.1',  letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-md':  ['2.25rem',  { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-sm':  ['1.875rem', { lineHeight: '1.2',  letterSpacing: '-0.02em', fontWeight: '700' }],
        // Headline
        'headline-lg': ['1.75rem',  { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],
        'headline-md': ['1.5rem',   { lineHeight: '1.3',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        'headline-sm': ['1.25rem',  { lineHeight: '1.35', letterSpacing: '-0.008em', fontWeight: '600' }],
        // Title
        'title-lg':    ['1.125rem', { lineHeight: '1.4',  letterSpacing: '-0.005em', fontWeight: '600' }],
        'title-md':    ['1rem',     { lineHeight: '1.45', letterSpacing: '0em',      fontWeight: '600' }],
        'title-sm':    ['0.875rem', { lineHeight: '1.5',  letterSpacing: '0.005em',  fontWeight: '600' }],
        // Body
        'body-xl':     ['1.125rem', { lineHeight: '1.7', letterSpacing: '0em',  fontWeight: '400' }],
        'body-lg':     ['1rem',     { lineHeight: '1.6', letterSpacing: '0em',  fontWeight: '400' }],
        'body-md':     ['0.875rem', { lineHeight: '1.6', letterSpacing: '0em',  fontWeight: '400' }],
        'body-sm':     ['0.8125rem',{ lineHeight: '1.55', letterSpacing: '0.01em', fontWeight: '400' }],
        // Label
        'label-xl':    ['1rem',     { lineHeight: '1.4', letterSpacing: '0.01em',  fontWeight: '600' }],
        'label-lg':    ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.01em',  fontWeight: '600' }],
        'label-md':    ['0.75rem',  { lineHeight: '1.4', letterSpacing: '0.04em',  fontWeight: '600' }],
        'label-sm':    ['0.6875rem',{ lineHeight: '1.4', letterSpacing: '0.05em',  fontWeight: '600' }],
        // Overline
        'overline':    ['0.6875rem',{ lineHeight: '1.4', letterSpacing: '0.08em',  fontWeight: '600' }],
      },
      borderRadius: {
        'xs':   '4px',
        'sm':   '6px',
        DEFAULT:'8px',
        'md':   '8px',
        'lg':   '12px',
        'xl':   '16px',
        '2xl':  '20px',
        '3xl':  '24px',
        'full': '9999px',
      },
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '26':  '6.5rem',
        '30':  '7.5rem',
        sidebar:    '260px',
        topbar:     '64px',
        'container': '1280px',
      },
      boxShadow: {
        'xs':    '0 1px 2px rgba(0,0,0,0.04)',
        'sm':    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 2px 8px rgba(0,0,0,0.08)',
        'md':    '0 4px 16px rgba(0,0,0,0.10)',
        'lg':    '0 8px 24px rgba(0,0,0,0.12)',
        'xl':    '0 16px 48px rgba(0,0,0,0.16)',
        '2xl':   '0 24px 64px rgba(0,0,0,0.22)',
        'brand': '0 4px 16px rgba(91,79,232,0.30)',
        'brand-lg': '0 8px 32px rgba(91,79,232,0.40)',
        'inner':  'inset 0 2px 4px rgba(0,0,0,0.06)',
        'none':   'none',
      },
      backgroundImage: {
        'gradient-brand':    'linear-gradient(135deg, #5B4FE8 0%, #7C3AED 50%, #06B6D4 100%)',
        'gradient-brand-r':  'linear-gradient(135deg, #06B6D4 0%, #7C3AED 50%, #5B4FE8 100%)',
        'gradient-hero':     'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(91,79,232,0.3) 0%, transparent 70%)',
        'gradient-dark':     'linear-gradient(180deg, #0F0E17 0%, #1A1929 100%)',
        'gradient-card':     'linear-gradient(135deg, rgba(91,79,232,0.08) 0%, rgba(124,58,237,0.04) 100%)',
        'mesh-purple':       'radial-gradient(at 40% 20%, rgba(91,79,232,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(124,58,237,0.10) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(6,182,212,0.10) 0px, transparent 50%)',
      },
      animation: {
        'fade-in':      'fadeIn 0.2s ease-out',
        'slide-up':     'slideUp 0.3s ease-out',
        'slide-right':  'slideRight 0.3s ease-out',
        'scale-in':     'scaleIn 0.2s ease-out',
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':    'spin 3s linear infinite',
        'draw-line':    'drawLine 1s ease-out forwards',
        'count-up':     'countUp 0.6s ease-out forwards',
        'toast-in':     'toastIn 0.3s ease-out',
        'toast-out':    'toastOut 0.2s ease-in forwards',
        'shimmer':      'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideRight:{ from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        drawLine:  { from: { strokeDashoffset: '1000' }, to: { strokeDashoffset: '0' } },
        countUp:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        toastIn:   { from: { opacity: '0', transform: 'translateX(100%)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        toastOut:  { from: { opacity: '1', transform: 'translateX(0)' }, to: { opacity: '0', transform: 'translateX(100%)' } },
        shimmer:   { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
      },
      transitionTimingFunction: {
        'ease-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      zIndex: {
        'sidebar':  '40',
        'topbar':   '50',
        'dropdown': '60',
        'modal':    '70',
        'toast':    '80',
        'tooltip':  '90',
      },
    },
  },
  plugins: [],
};
