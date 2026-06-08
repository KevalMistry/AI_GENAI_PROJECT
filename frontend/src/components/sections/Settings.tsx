import React, { useState } from 'react';
import {
  User, Bell, Shield, Palette, Mic, Globe,
  ChevronRight, Check, Sun, Moon, Monitor,
  Save, Trash2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings, ThemeMode, AccentColor, Density, UserProfile } from '../../context/SettingsContext';
import { login, signup, signout, getToken } from '../../services/auth';
import { downloadTextFile } from '../../utils/download';

type SettingsTab = 'profile' | 'appearance' | 'notifications' | 'privacy' | 'audio';

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { id: 'privacy', label: 'Privacy', icon: <Shield size={15} /> },
  { id: 'audio', label: 'Audio & Video', icon: <Mic size={15} /> },
];

const Toggle: React.FC<{ enabled: boolean; onChange: () => void; label?: string }> = ({ enabled, onChange, label }) => {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      className={`relative inline-flex w-10 h-5 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900
        ${enabled ? 'bg-indigo-600' : 'bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
};

const Settings: React.FC = () => {
  const { isDark } = useTheme();
  const {
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
    updateProfile,
    updateAppearance,
    updateNotifications,
    updatePrivacy,
    updateAudio,
    updateCameraDevice,
    updateMicrophoneDevice,
    saveAllSettings,
    resetAllSettings,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  // password visibility removed from settings; managed via Set/Change button
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSave = () => {
    saveAllSettings();
    setSaved(true);
    setNotice('Settings saved successfully.');
    setTimeout(() => setSaved(false), 2000);
    setTimeout(() => setNotice(null), 2200);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    updateAppearance(mode, accentColor, density, language);
  };

  const onProfileFieldChange = (key: keyof UserProfile, value: string) => {
    updateProfile({ [key]: value });
  };

  const downloadMyData = () => {
    downloadTextFile('intervai-account-data.json', JSON.stringify({
      profile,
      notifications,
      privacy,
      audio,
      appearance: { themeMode, accentColor, density, language },
    }, null, 2), 'application/json');
    setNotice('Account data downloaded.');
    window.setTimeout(() => setNotice(null), 2200);
  };

  const clearHistory = () => {
    localStorage.removeItem('intervai-sessions');
    window.dispatchEvent(new Event('intervai-history-cleared'));
    setNotice('Session history cleared for this demo workspace.');
    window.setTimeout(() => setNotice(null), 2200);
  };

  const deleteAccount = () => {
    const confirmed = window.confirm('Delete this demo account data? This resets the local profile in this app.');
    if (!confirmed) return;
    resetAllSettings();
    setNotice('Demo account profile cleared.');
    window.setTimeout(() => setNotice(null), 2200);
  };

  const cardBg = isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-slate-700/50' : 'border-slate-200';
  const inputBg = isDark
    ? 'bg-slate-900/50 border-slate-700 text-slate-200 placeholder-slate-600 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400';
  const activeTab_ = isDark
    ? 'bg-slate-700/60 text-white border-indigo-500'
    : 'bg-indigo-50 text-indigo-700 border-indigo-400';
  const inactiveTab = isDark
    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 border-transparent'
    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-transparent';

  const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className={`rounded-xl border ${cardBg}`}>
      <div className={`px-5 py-4 border-b ${divider}`}>
        <h4 className={`text-sm font-semibold ${textPrimary}`}>{title}</h4>
        {description && <p className={`text-xs mt-0.5 ${textSecondary}`}>{description}</p>}
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );

  const ToggleRow: React.FC<{ label: string; description: string; enabled: boolean; onChange: () => void }> = ({ label, description, enabled, onChange }) => (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${textPrimary}`}>{label}</p>
        <p className={`text-xs ${textSecondary}`}>{description}</p>
      </div>
      <Toggle enabled={enabled} onChange={onChange} label={label} />
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-5">
            <Section title="Personal Information" description="Update your profile details">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                     style={{ backgroundImage: isDark ? 'linear-gradient(135deg,#5b21b6,#6366f1)' : 'linear-gradient(135deg,#c7b4ff,#dbeafe)' }}>
                  {((profile.firstName?.[0] || '') + (profile.lastName?.[0] || '')).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${textPrimary}`}>{profile.firstName} {profile.lastName}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setNotice('Photo upload is ready for backend storage integration.');
                        window.setTimeout(() => setNotice(null), 2200);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all bg-transparent hover:bg-slate-50/40`
                      }
                      style={{ borderColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(226,232,240,1)', color: isDark ? undefined : 'var(--slate-700)' }}>
                      Change Photo
                    </button>

                    {/* Auth actions */}
                    {getToken() ? (
                      <button
                        onClick={() => {
                          signout();
                          setNotice('Signed out.');
                          window.location.reload();
                          window.setTimeout(() => setNotice(null), 2200);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium text-rose-600 hover:bg-rose-50/10"
                      >
                        Sign Out
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await signup(profile.email || '', profile.password || '', profile.firstName, profile.lastName);
                              setNotice('Signed up successfully. You may now sign in.');
                              window.location.reload();
                            } catch (err: any) {
                              setNotice(String(err?.message || err));
                            }
                            window.setTimeout(() => setNotice(null), 2200);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border font-medium text-indigo-500 hover:bg-indigo-50/10"
                        >
                          Sign Up
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await login(profile.email || '', profile.password || '');
                              setNotice('Signed in successfully.');
                              window.location.reload();
                            } catch (err: any) {
                              setNotice(String(err?.message || err));
                            }
                            window.setTimeout(() => setNotice(null), 2200);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border font-medium text-emerald-600 hover:bg-emerald-50/10"
                        >
                          Sign In
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'First Name', key: 'firstName' as const, type: 'text' },
                  { label: 'Last Name', key: 'lastName' as const, type: 'text' },
                  { label: 'Email', key: 'email' as const, type: 'email' },
                  { label: 'Target Role', key: 'targetRole' as const, type: 'text' },
                ].map(f => (
                  <div key={f.label}>
                    <label className={`text-xs font-medium block mb-1 ${textSecondary}`}>{f.label}</label>
                    <input
                      type={f.type}
                      value={profile[f.key] || ''}
                      onChange={event => onProfileFieldChange(f.key, event.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${inputBg}`}
                    />
                  </div>
                ))}
              </div>

              {/* Password */}
              <div>
                <label className={`text-xs font-medium block mb-1 ${textSecondary}`}>Password</label>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${textSecondary}`}>{profile.password ? '••••••••' : 'Not set'}</span>
                  <button
                    onClick={() => {
                      const pw = window.prompt('Enter new password (will not be saved to local storage):');
                      if (pw !== null) {
                        onProfileFieldChange('password', pw);
                        setNotice('Password set for this session.');
                        window.setTimeout(() => setNotice(null), 2200);
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium text-indigo-500 hover:bg-indigo-50/10"
                  >
                    Set / Change
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Professional Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Current Role', key: 'currentRole' as const, type: 'text' },
                  { label: 'Experience Level', key: 'experienceLevel' as const, type: 'text' },
                  { label: 'LinkedIn URL', key: 'linkedin' as const, type: 'url' },
                  { label: 'GitHub URL', key: 'github' as const, type: 'url' },
                ].map(f => (
                  <div key={f.label}>
                    <label className={`text-xs font-medium block mb-1 ${textSecondary}`}>{f.label}</label>
                    <input
                      type={f.type}
                      value={profile[f.key] || ''}
                      onChange={event => onProfileFieldChange(f.key, event.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${inputBg}`}
                    />
                  </div>
                ))}
              </div>
            </Section>

            {/* Danger Zone */}
            <div className={`rounded-xl border p-5 ${isDark ? 'border-rose-900/40 bg-rose-500/5' : 'border-rose-200 bg-rose-50'}`}>
              <h4 className={`text-sm font-semibold mb-1 ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>Danger Zone</h4>
              <p className={`text-xs mb-3 ${isDark ? 'text-rose-400/70' : 'text-rose-600/70'}`}>Permanently delete your account and all data.</p>
              <button
                onClick={deleteAccount}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium transition-all"
              >
                <Trash2 size={12} /> Delete Account
              </button>
            </div>
          </div>
        );

      case 'appearance':
        const themes: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
          { id: 'dark', label: 'Dark', icon: <Moon size={16} /> },
          { id: 'light', label: 'Light', icon: <Sun size={16} /> },
          { id: 'system', label: 'System', icon: <Monitor size={16} /> },
        ];
        const accents = [
          { id: 'indigo' as AccentColor, color: '#6366f1' },
          { id: 'violet' as AccentColor, color: '#8b5cf6' },
          { id: 'cyan' as AccentColor, color: '#06b6d4' },
          { id: 'emerald' as AccentColor, color: '#10b981' },
          { id: 'rose' as AccentColor, color: '#f43f5e' },
          { id: 'amber' as AccentColor, color: '#f59e0b' },
        ];
        return (
          <div className="space-y-5">
            <Section title="Theme Mode" description="Choose how IntervAI looks for you">
              <div className="grid grid-cols-3 gap-3">
                {themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 font-medium text-sm transition-all
                      ${themeMode === t.id
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : isDark ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    {t.icon}
                    <span className="text-xs">{t.label}</span>
                    {themeMode === t.id && <Check size={12} className="text-indigo-400" />}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Accent Color" description="Personalize your color scheme">
              <div className="flex gap-3 flex-wrap">
                {accents.map(a => (
                  <button
                    key={a.id}
                    onClick={() => updateAppearance(themeMode, a.id, density, language)}
                    className={`w-8 h-8 rounded-full transition-all ${accentColor === a.id ? 'scale-125 ring-2 ring-offset-2 ring-offset-slate-900 ring-white' : 'hover:scale-110'}`}
                    style={{ backgroundColor: a.color }}
                    aria-label={`${a.id} accent`}
                  />
                ))}
              </div>
            </Section>

            <Section title="Interface Density" description="Control spacing and element size">
              <div className="flex gap-2">
                {['Compact', 'Default', 'Comfortable'].map(d => (
                  <button key={d}
                    onClick={() => updateAppearance(themeMode, accentColor, d as Density, language)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all
                      ${d === density
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : isDark ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-500'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Language & Region">
              <div className="flex items-center gap-3">
                <Globe size={15} className="text-indigo-400" />
                <select
                  value={language}
                  onChange={event => updateAppearance(themeMode, accentColor, density, event.target.value)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${inputBg}`}
                >
                  <option>English (US)</option>
                  <option>English (UK)</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                </select>
              </div>
            </Section>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-5">
            <Section title="Email Notifications">
              <ToggleRow label="Session Reminders" description="Get reminded before scheduled interviews" enabled={notifications.email} onChange={() => updateNotifications({ email: !notifications.email })} />
              <ToggleRow label="Weekly Progress Report" description="Weekly summary of your performance" enabled={notifications.weekly} onChange={() => updateNotifications({ weekly: !notifications.weekly })} />
              <ToggleRow label="AI Tips & Insights" description="Personalized tips based on your sessions" enabled={notifications.tips} onChange={() => updateNotifications({ tips: !notifications.tips })} />
            </Section>
            <Section title="Push Notifications">
              <ToggleRow label="Browser Notifications" description="Real-time alerts in your browser" enabled={notifications.push} onChange={() => updateNotifications({ push: !notifications.push })} />
            </Section>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-5">
            <Section title="Data & Analytics">
              <ToggleRow label="Share Usage Data" description="Help improve IntervAI by sharing anonymized usage" enabled={privacy.shareData} onChange={() => updatePrivacy({ shareData: !privacy.shareData })} />
              <ToggleRow label="Performance Analytics" description="Allow us to analyze session data to improve feedback" enabled={privacy.analytics} onChange={() => updatePrivacy({ analytics: !privacy.analytics })} />
              <ToggleRow label="Public Profile" description="Allow others to see your profile and achievements" enabled={privacy.publicProfile} onChange={() => updatePrivacy({ publicProfile: !privacy.publicProfile })} />
            </Section>
            <Section title="Data Management">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={downloadMyData}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all
                  ${isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}>
                  <ChevronRight size={12} /> Download My Data
                </button>
                <button
                  onClick={clearHistory}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium
                  ${isDark ? 'border-rose-800/60 text-rose-400 hover:bg-rose-500/10' : 'border-rose-200 text-rose-600 hover:bg-rose-50'}`}>
                  <Trash2 size={12} /> Clear Session History
                </button>
              </div>
            </Section>
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-5">
            <Section title="Microphone Settings">
              <ToggleRow label="Noise Suppression" description="Filter background noise during interviews" enabled={audio.noiseSuppression} onChange={() => updateAudio({ noiseSuppression: !audio.noiseSuppression })} />
              <ToggleRow label="Echo Cancellation" description="Prevent audio feedback and echo" enabled={audio.echoCancellation} onChange={() => updateAudio({ echoCancellation: !audio.echoCancellation })} />
            </Section>
            <Section title="Video Settings">
              <ToggleRow label="HD Video" description="Use high-definition video (requires fast connection)" enabled={audio.hd} onChange={() => updateAudio({ hd: !audio.hd })} />
              <div>
                <label className={`text-xs font-medium block mb-2 ${textSecondary}`}>Camera Device</label>
                <select
                  value={cameraDevice}
                  onChange={event => updateCameraDevice(event.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${inputBg}`}
                >
                  <option>FaceTime HD Camera (Built-in)</option>
                  <option>External USB Camera</option>
                </select>
              </div>
              <div>
                <label className={`text-xs font-medium block mb-2 ${textSecondary}`}>Microphone Device</label>
                <select
                  value={microphoneDevice}
                  onChange={event => updateMicrophoneDevice(event.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${inputBg}`}
                >
                  <option>MacBook Pro Microphone</option>
                  <option>AirPods Pro</option>
                </select>
              </div>
            </Section>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-xs ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {notice}
        </div>
      )}
      {/* Tabs */}
      <div className={`rounded-xl border p-1.5 flex flex-wrap gap-1 ${cardBg}`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200
              ${activeTab === tab.id ? activeTab_ : inactiveTab}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {renderContent()}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg
            ${saved
              ? 'bg-emerald-600 shadow-emerald-500/20 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25 text-white'}`}
        >
          {saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
        </button>
      </div>
    </div>
  );
};

export default Settings;
