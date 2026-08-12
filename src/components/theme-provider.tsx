'use client';

import * as React from 'react';

interface Theme {
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
}

const defaultTheme: Theme = {
  primaryHue: 35,
  primarySaturation: 91,
  primaryLightness: 55,
};

/**
 * ThemeProvider handles the application of dynamic theme colors.
 * It is a Client Component to allow usage of React hooks and DOM manipulation.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, _setTheme] = React.useState<Theme>(defaultTheme);
  const [mounted, setMounted] = React.useState(false);

  // Initialize theme from localStorage after mount to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
    try {
      const item = window.localStorage.getItem('app-theme');
      if (item) {
        const parsed = JSON.parse(item);
        _setTheme(parsed);
      }
    } catch (error) {
      console.warn('Error reading theme from localStorage', error);
    }
  }, []);

  // Apply theme to document root
  React.useEffect(() => {
    if (mounted) {
      const root = document.documentElement;
      root.style.setProperty('--primary', `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`);
    }
  }, [theme, mounted]);

  return (
    <div style={{
        // @ts-ignore
       '--primary': `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`,
    } as React.CSSProperties}>
      {children}
    </div>
  );
}
