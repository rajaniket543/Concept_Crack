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

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  isDark: false,
  fontSize: 'default',
  setFontSize: () => {},
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
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
