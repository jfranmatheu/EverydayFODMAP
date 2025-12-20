import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'auto';
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colors: typeof lightColors;
}

const lightColors = {
  // Backgrounds
  background: '#F8FAF8',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#F5F7F5',
  
  // Text
  text: '#1A1F1A',
  textSecondary: '#5C6B5C',
  textMuted: '#8A9A8A',
  
  // Primary (Green - main brand color)
  primary: '#2E7D32',
  primaryLight: '#4CAF50',
  primaryDark: '#1B5E20',
  
  // Accent (Amber)
  accent: '#F59E0B',
  accentLight: '#FCD34D',
  
  // FODMAP levels
  fodmapLow: '#22C55E',
  fodmapMedium: '#F59E0B',
  fodmapHigh: '#EF4444',
  
  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // UI
  border: '#E2E8E2',
  divider: '#E5E7EB',
  tabBar: '#FFFFFF',
  tabBarInactive: '#9CA3AF',
  
  // Specific
  water: '#3B82F6',
  symptom: '#F97316',
  treatment: '#8B5CF6',
  bowel: '#78716C',
};

const darkColors = {
  // Backgrounds
  background: '#0A0F0A',
  surface: '#151A15',
  card: '#1A201A',
  cardElevated: '#242A24',
  
  // Text
  text: '#F0F4F0',
  textSecondary: '#A8B8A8',
  textMuted: '#6B7B6B',
  
  // Primary (Green - main brand color)
  primary: '#4CAF50',
  primaryLight: '#81C784',
  primaryDark: '#388E3C',
  
  // Accent (Amber)
  accent: '#FBBF24',
  accentLight: '#FDE68A',
  
  // FODMAP levels
  fodmapLow: '#34D399',
  fodmapMedium: '#FBBF24',
  fodmapHigh: '#F87171',
  
  // Status
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',
  
  // UI
  border: '#2A352A',
  divider: '#374151',
  tabBar: '#151A15',
  tabBarInactive: '#6B7280',
  
  // Specific
  water: '#60A5FA',
  symptom: '#FB923C',
  treatment: '#A78BFA',
  bowel: '#A8A29E',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadThemeMode();
  }, []);

  const loadThemeMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('themeMode');
      if (savedMode && ['light', 'dark', 'auto'].includes(savedMode)) {
        setThemeModeState(savedMode as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme mode:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  const theme: Theme = themeMode === 'auto' 
    ? (systemColorScheme ?? 'light') 
    : themeMode;

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { lightColors, darkColors };

