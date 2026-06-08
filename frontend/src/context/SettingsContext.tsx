import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'indigo' | 'violet' | 'cyan' | 'emerald' | 'rose' | 'amber';
export type Density = 'Compact' | 'Default' | 'Comfortable';

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  targetRole: string;
  password?: string;
  currentRole: string;
  experienceLevel: string;
  linkedin: string;
  github: string;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  weekly: boolean;
  tips: boolean;
}

export interface PrivacySettings {
  shareData: boolean;
  analytics: boolean;
  publicProfile: boolean;
}

export interface AudioSettings {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  hd: boolean;
}

interface SettingsContextType {
  profile: UserProfile;
  themeMode: ThemeMode;
  accentColor: AccentColor;
  density: Density;
  language: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  audio: AudioSettings;
  cameraDevice: string;
  microphoneDevice: string;
  isDark: boolean;
  
  updateProfile: (profile: Partial<UserProfile>) => void;
  updateAppearance: (themeMode: ThemeMode, accentColor: AccentColor, density: Density, language: string) => void;
  updateNotifications: (notifications: Partial<NotificationSettings>) => void;
  updatePrivacy: (privacy: Partial<PrivacySettings>) => void;
  updateAudio: (audio: Partial<AudioSettings>) => void;
  updateCameraDevice: (camera: string) => void;
  updateMicrophoneDevice: (microphone: string) => void;
  saveAllSettings: () => void;
  resetAllSettings: () => void;
}

const defaultProfile: UserProfile = {
  firstName: '',
  lastName: '',
  email: '',
  targetRole: '',
  password: '',
  currentRole: '',
  experienceLevel: '',
  linkedin: '',
  github: '',
};

const defaultNotifications: NotificationSettings = {
  email: true,
  push: true,
  weekly: false,
  tips: true,
};

const defaultPrivacy: PrivacySettings = {
  shareData: false,
  analytics: true,
  publicProfile: false,
};

const defaultAudio: AudioSettings = {
  noiseSuppression: true,
  echoCancellation: true,
  hd: false,
};

const PALETTES: Record<AccentColor, Record<string, string>> = {
  indigo: {
    '50': '#f5f3ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc',
    '400': '#818cf8', '500': '#6366f1', '600': '#4f46e5', '700': '#4338ca',
    '800': '#3730a3', '900': '#312e81', '950': '#1e1b4b'
  },
  violet: {
    '50': '#fdf4ff', '100': '#fae8ff', '200': '#f5d0fe', '300': '#f0abfc',
    '400': '#c084fc', '500': '#a855f7', '600': '#8b5cf6', '700': '#7c3aed',
    '800': '#6d28d9', '900': '#581c87', '950': '#2e1065'
  },
  cyan: {
    '50': '#ecfeff', '100': '#cffafe', '200': '#a5f3fc', '300': '#67e8f9',
    '400': '#22d3ee', '500': '#06b6d4', '600': '#0891b2', '700': '#0e7490',
    '800': '#155e75', '900': '#164e63', '950': '#083344'
  },
  emerald: {
    '50': '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0', '300': '#86efac',
    '400': '#4ade80', '500': '#22c55e', '600': '#10b981', '700': '#047857',
    '800': '#065f46', '900': '#064e3b', '950': '#022c22'
  },
  rose: {
    '50': '#fff1f2', '100': '#ffe4e6', '200': '#fecdd3', '300': '#fda4af',
    '400': '#fb7185', '500': '#f43f5e', '600': '#e11d48', '700': '#be123c',
    '800': '#9f1239', '900': '#881337', '950': '#4c0519'
  },
  amber: {
    '50': '#fffbeb', '100': '#fef3c7', '200': '#fde68a', '300': '#fcd34d',
    '400': '#fbbf24', '500': '#f59e0b', '600': '#d97706', '700': '#b45309',
    '800': '#92400e', '900': '#78350f', '950': '#451a03'
  }
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('intervai-profile');
    if (!saved) return defaultProfile;
    try {
      const parsed = JSON.parse(saved);
      // Ensure password is never loaded from localStorage
      if (parsed && typeof parsed === 'object') {
        parsed.password = '';
      }
      return { ...defaultProfile, ...parsed };
    } catch {
      return defaultProfile;
    }
  });
  const token = typeof window !== 'undefined' ? localStorage.getItem('intervai-token') : null;

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('intervai-theme-mode') as ThemeMode) || 'dark';
  });

  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    return (localStorage.getItem('intervai-accent-color') as AccentColor) || 'indigo';
  });

  const [density, setDensity] = useState<Density>(() => {
    return (localStorage.getItem('intervai-density') as Density) || 'Default';
  });

  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem('intervai-language') || 'English (US)';
  });

  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('intervai-notifications');
    return saved ? JSON.parse(saved) : defaultNotifications;
  });

  const [privacy, setPrivacy] = useState<PrivacySettings>(() => {
    const saved = localStorage.getItem('intervai-privacy');
    return saved ? JSON.parse(saved) : defaultPrivacy;
  });

  const [audio, setAudio] = useState<AudioSettings>(() => {
    const saved = localStorage.getItem('intervai-audio');
    return saved ? JSON.parse(saved) : defaultAudio;
  });

  const [cameraDevice, setCameraDevice] = useState<string>(() => {
    return localStorage.getItem('intervai-camera-device') || 'FaceTime HD Camera (Built-in)';
  });

  const [microphoneDevice, setMicrophoneDevice] = useState<string>(() => {
    return localStorage.getItem('intervai-microphone-device') || 'MacBook Pro Microphone';
  });

  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    if (!token) return;

    const syncProfileFromServer = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const user = await response.json();
        setProfile({
          ...defaultProfile,
          firstName: user.first_name ?? '',
          lastName: user.last_name ?? '',
          email: user.email ?? '',
        });
      } catch {
        // Keep local profile if the server is unavailable or the token expired.
      }
    };

    syncProfileFromServer();
  }, [token]);

  // Sync theme changes
  useEffect(() => {
    const checkTheme = () => {
      let activeTheme: 'dark' | 'light' = 'dark';
      if (themeMode === 'system') {
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        activeTheme = isSystemDark ? 'dark' : 'light';
      } else {
        activeTheme = themeMode === 'dark' ? 'dark' : 'light';
      }

      setIsDark(activeTheme === 'dark');

      if (activeTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    };

    checkTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => checkTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Sync accent color changes (overriding Tailwind color variables)
  useEffect(() => {
    const root = document.documentElement;
    const palette = PALETTES[accentColor] || PALETTES.indigo;

    Object.entries(palette).forEach(([key, colorValue]) => {
      // Override both indigo classes (standard accent color used)
      root.style.setProperty(`--color-indigo-${key}`, colorValue);
    });

    localStorage.setItem('intervai-accent-color', accentColor);
  }, [accentColor]);

  // Sync density changes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-density', density.toLowerCase());
    
    if (density === 'Compact') {
      root.style.fontSize = '14px';
    } else if (density === 'Comfortable') {
      root.style.fontSize = '18px';
    } else {
      root.style.fontSize = '16px';
    }

    localStorage.setItem('intervai-density', density);
  }, [density]);

  const updateProfile = (fields: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...fields }));
  };

  const updateAppearance = (mode: ThemeMode, accent: AccentColor, dens: Density, lang: string) => {
    setThemeMode(mode);
    setAccentColor(accent);
    setDensity(dens);
    setLanguage(lang);

    localStorage.setItem('intervai-theme-mode', mode);
    localStorage.setItem('intervai-language', lang);
  };

  const updateNotifications = (fields: Partial<NotificationSettings>) => {
    setNotifications(prev => ({ ...prev, ...fields }));
  };

  const updatePrivacy = (fields: Partial<PrivacySettings>) => {
    setPrivacy(prev => ({ ...prev, ...fields }));
  };

  const updateAudio = (fields: Partial<AudioSettings>) => {
    setAudio(prev => ({ ...prev, ...fields }));
  };

  const updateCameraDevice = (camera: string) => {
    setCameraDevice(camera);
    localStorage.setItem('intervai-camera-device', camera);
  };

  const updateMicrophoneDevice = (microphone: string) => {
    setMicrophoneDevice(microphone);
    localStorage.setItem('intervai-microphone-device', microphone);
  };

  const saveAllSettings = () => {
    // Do not persist password to localStorage for security reasons
    const { password, ...profileSafe } = profile as any;
    localStorage.setItem('intervai-profile', JSON.stringify(profileSafe));
    localStorage.setItem('intervai-theme-mode', themeMode);
    localStorage.setItem('intervai-accent-color', accentColor);
    localStorage.setItem('intervai-density', density);
    localStorage.setItem('intervai-language', language);
    localStorage.setItem('intervai-notifications', JSON.stringify(notifications));
    localStorage.setItem('intervai-privacy', JSON.stringify(privacy));
    localStorage.setItem('intervai-audio', JSON.stringify(audio));
  };

  const resetAllSettings = () => {
    localStorage.removeItem('intervai-profile');
    localStorage.removeItem('intervai-theme-mode');
    localStorage.removeItem('intervai-accent-color');
    localStorage.removeItem('intervai-density');
    localStorage.removeItem('intervai-language');
    localStorage.removeItem('intervai-notifications');
    localStorage.removeItem('intervai-privacy');
    localStorage.removeItem('intervai-audio');
    localStorage.removeItem('intervai-camera-device');
    localStorage.removeItem('intervai-microphone-device');
    localStorage.removeItem('intervai-sessions');
    // Also remove per-user session/resume keys if present
    try {
      const key = profile?.email ? `intervai-sessions:${profile.email.trim().toLowerCase()}` : null;
      const rkey = profile?.email ? `intervai-resume-analysis:${profile.email.trim().toLowerCase()}` : null;
      if (key) localStorage.removeItem(key);
      if (rkey) localStorage.removeItem(rkey);
    } catch (e) {
      // ignore
    }

    setProfile(defaultProfile);
    setThemeMode('dark');
    setAccentColor('indigo');
    setDensity('Default');
    setLanguage('English (US)');
    setNotifications(defaultNotifications);
    setPrivacy(defaultPrivacy);
    setAudio(defaultAudio);
    setCameraDevice('FaceTime HD Camera (Built-in)');
    setMicrophoneDevice('MacBook Pro Microphone');
  };

  return (
    <SettingsContext.Provider
      value={{
        profile,
        themeMode,
        accentColor,
        density,
        language,
        notifications,
        privacy,
        audio,
        cameraDevice,
        microphoneDevice,
        isDark,
        updateProfile,
        updateAppearance,
        updateNotifications,
        updatePrivacy,
        updateAudio,
        updateCameraDevice,
        updateMicrophoneDevice,
        saveAllSettings,
        resetAllSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
