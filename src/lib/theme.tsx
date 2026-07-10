import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Light / dark theme, switched by a toggle button (topbar, sidebar, login,
// landing). The choice persists per browser; first visit follows the OS.

type Theme = 'light' | 'dark';
export type FontSize = 'compact' | 'default' | 'comfortable';

const FONT_SCALE: Record<FontSize, string> = {
  compact: '15px',
  default: '16px',
  comfortable: '18px',
};

export const ACCENT_COLORS = [
  { name: 'Indigo', hex: '#5B4FE8' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Amber', hex: '#F59E0B' },
] as const;

const DEFAULT_ACCENT = ACCENT_COLORS[0].hex;

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  accent: string;
  setAccent: (hex: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  isDark: false,
  fontSize: 'default',
  setFontSize: () => {},
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('prepmind_theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const stored = localStorage.getItem('prepmind_font_size') as FontSize | null;
    return stored && stored in FONT_SCALE ? stored : 'default';
  });

  const [accent, setAccentState] = useState<string>(() => {
    return localStorage.getItem('prepmind_accent') ?? DEFAULT_ACCENT;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('prepmind_theme', theme);
  }, [theme]);

  // Apply font scale to the root element — every rem-based size scales with it.
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SCALE[fontSize];
    localStorage.setItem('prepmind_font_size', fontSize);
  }, [fontSize]);

  // Expose the chosen accent as a CSS variable so themed elements can pick it up.
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    localStorage.setItem('prepmind_accent', accent);
  }, [accent]);

  function toggleTheme() {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        isDark: theme === 'dark',
        fontSize,
        setFontSize: setFontSizeState,
        accent,
        setAccent: setAccentState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
