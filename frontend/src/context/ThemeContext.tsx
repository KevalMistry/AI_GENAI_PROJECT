import React from 'react';
import { useSettings } from './SettingsContext';
import type { Theme } from '../types';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

// Dummy ThemeProvider that does nothing since SettingsProvider is at root
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const useTheme = (): ThemeContextType => {
  const { isDark, themeMode, updateAppearance, accentColor, density, language } = useSettings();

  const toggleTheme = () => {
    const nextMode = isDark ? 'light' : 'dark';
    updateAppearance(nextMode, accentColor, density, language);
  };

  return {
    theme: isDark ? 'dark' : 'light',
    toggleTheme,
    isDark,
  };
};
