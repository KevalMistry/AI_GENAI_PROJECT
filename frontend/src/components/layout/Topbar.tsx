import React, { useMemo, useState } from 'react';
import { Menu, Sun, Moon, Bell, Search, X, ArrowLeft } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import type { Section } from '../../hooks/useActiveSection';

interface TopbarProps {
  activeSection: Section;
  setMobileOpen: (v: boolean) => void;
  setActiveSection: (v: Section) => void;
  goBack: () => void;
  canGoBack: boolean;
}

const sectionTitles: Record<Section, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Welcome back, Alex' },
  interview: { title: 'AI Interview', subtitle: 'Real-time AI-powered mock interviews' },
  resume: { title: 'Resume Analyzer', subtitle: 'AI feedback on your resume' },
  chatbot: { title: 'AI Coach', subtitle: 'Your personal interview coach' },
  schedule: { title: 'Scheduled Meetings', subtitle: 'Plan and manage upcoming practice sessions' },
  history: { title: 'Session History', subtitle: 'Review your past performance' },
  settings: { title: 'Settings', subtitle: 'Manage your account & preferences' },
};

const Topbar: React.FC<TopbarProps> = ({
  activeSection,
  setMobileOpen,
  setActiveSection,
  goBack,
  canGoBack,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { profile } = useSettings();
  const [query, setQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const barBg = isDark
    ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md'
    : 'bg-white/80 border-slate-200 backdrop-blur-md';

  const titleColor = isDark ? 'text-white' : 'text-slate-900';
  const subtitleColor = isDark ? 'text-slate-400' : 'text-slate-500';
  const iconBtn = isDark
    ? 'text-slate-400 hover:text-white hover:bg-slate-800 border-slate-700'
    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200';

  const searchBg = isDark
    ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-500 focus:border-indigo-500'
    : 'bg-slate-100 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400';

  const { title, subtitle } = sectionTitles[activeSection];
  const displaySubtitle = activeSection === 'dashboard'
    ? `Welcome back, ${profile.firstName}`
    : subtitle;
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return (Object.entries(sectionTitles) as Array<[Section, { title: string; subtitle: string }]>)
      .filter(([, item]) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized))
      .slice(0, 4);
  }, [query]);

  const firstSearchMatch = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    return (Object.entries(sectionTitles) as Array<[Section, { title: string; subtitle: string }]>)
      .find(([, item]) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized))?.[0] ?? null;
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const match = firstSearchMatch(query);
    if (match) {
      setActiveSection(match);
      setQuery('');
    }
  };

  return (
    <header className={`sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 border-b ${barBg}`}>
      {/* Left: Hamburger + Back Button + Title */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => setMobileOpen(true)}
          className={`lg:hidden p-2 rounded-lg border transition-colors duration-200 ${iconBtn}`}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        {canGoBack && (
          <button
            onClick={goBack}
            className={`p-2 rounded-lg border transition-all duration-200 ${iconBtn} flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer`}
            aria-label="Go back"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        <div>
          <h2 className={`text-base sm:text-lg font-bold leading-tight ${titleColor}`}>{title}</h2>
          <p className={`text-xs hidden sm:block ${subtitleColor}`}>{displaySubtitle}</p>
        </div>
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search - hidden on small screens */}
        <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              const match = firstSearchMatch(event.currentTarget.value);
              if (event.key === 'Enter' && match) {
                event.preventDefault();
                setActiveSection(match);
                setQuery('');
              }
            }}
            className={`pl-8 pr-3 py-1.5 text-sm w-44 rounded-lg border outline-none transition-colors duration-200 ${searchBg}`}
            aria-label="Search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className={`absolute right-2 top-1/2 -translate-y-1/2 ${subtitleColor}`}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
          {searchResults.length > 0 && (
            <div className={`absolute right-0 mt-2 w-64 rounded-xl border shadow-xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              {searchResults.map(([section, item]) => (
                <button
                  type="button"
                  key={section}
                  onClick={() => {
                    setActiveSection(section);
                    setQuery('');
                  }}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                >
                  <span className={`block text-sm font-semibold ${titleColor}`}>{item.title}</span>
                  <span className={`block text-xs ${subtitleColor}`}>{item.subtitle}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(open => !open)}
            className={`relative p-2 rounded-lg border transition-colors duration-200 ${iconBtn}`}
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full" />
          </button>
          {showNotifications && (
            <div className={`absolute right-0 mt-2 w-72 rounded-xl border shadow-xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              {[
                ['Resume analyzer is ready', 'Upload a resume to get a live ATS breakdown.'],
                ['Practice reminder', 'You have one scheduled session waiting.'],
                ['Progress update', 'Your average score is up 8 points this week.'],
              ].map(([headline, body]) => (
                <div key={headline} className={`px-3 py-3 border-b last:border-b-0 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <p className={`text-sm font-semibold ${titleColor}`}>{headline}</p>
                  <p className={`text-xs mt-0.5 ${subtitleColor}`}>{body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg border transition-all duration-300 ${iconBtn}`}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
};

export default Topbar;
