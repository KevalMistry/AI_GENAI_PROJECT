import React from 'react';
import {
  LayoutDashboard,
  Mic2,
  FileText,
  MessageSquare,
  History,
  Settings,
  CalendarClock,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import type { Section } from '../../hooks/useActiveSection';

interface SidebarProps {
  activeSection: Section;
  setActiveSection: (s: Section) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const navItems: { id: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'interview', label: 'AI Interview', icon: <Mic2 size={18} />, badge: 'Live' },
  { id: 'resume', label: 'Resume Analyzer', icon: <FileText size={18} />, badge: 'Beta' },
  { id: 'chatbot', label: 'AI Coach', icon: <MessageSquare size={18} /> },
  { id: 'schedule', label: 'Scheduled Meetings', icon: <CalendarClock size={18} /> },
  { id: 'history', label: 'Session History', icon: <History size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  setActiveSection,
  mobileOpen,
  setMobileOpen,
}) => {
  const { isDark } = useTheme();
  const { profile } = useSettings();

  const handleNav = (id: Section) => {
    setActiveSection(id);
    setMobileOpen(false);
  };

  const sidebarBg = isDark
    ? 'bg-slate-900 border-slate-800'
    : 'bg-white border-slate-200';

  const logoText = isDark ? 'text-white' : 'text-slate-900';
  const tagline = isDark ? 'text-slate-400' : 'text-slate-500';

  const activeItem = isDark
    ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-400'
    : 'bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500';

  const inactiveItem = isDark
    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100';

  const divider = isDark ? 'border-slate-800' : 'border-slate-200';
  const versionText = isDark ? 'text-slate-600' : 'text-slate-400';

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-50 flex flex-col border-r transition-transform duration-300
          ${sidebarBg}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo */}
        <div className={`flex items-center justify-between px-5 py-5 border-b ${divider}`}>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
              <Sparkles size={16} className="text-white" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <h1 className={`text-base font-bold tracking-tight ${logoText}`}>IntervAI</h1>
              <p className={`text-[10px] font-medium uppercase tracking-widest ${tagline}`}>Pro Platform</p>
            </div>
          </div>
          <button
            className={`lg:hidden p-1.5 rounded-lg ${inactiveItem}`}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest ${versionText}`}>
            Main Menu
          </p>
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 group text-left
                ${activeSection === item.id ? activeItem : inactiveItem}
              `}
              aria-current={activeSection === item.id ? 'page' : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={`
                  text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide
                  ${item.badge === 'Live'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'}
                `}>
                  {item.badge}
                </span>
              )}
              {activeSection === item.id && (
                <ChevronRight size={12} className="opacity-60" />
              )}
            </button>
          ))}

          <div className={`my-3 border-t ${divider}`} />
          <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest ${versionText}`}>
            Account
          </p>
          {navItems.slice(5).map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 group text-left
                ${activeSection === item.id ? activeItem : inactiveItem}
              `}
              aria-current={activeSection === item.id ? 'page' : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {activeSection === item.id && (
                <ChevronRight size={12} className="opacity-60" />
              )}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className={`px-4 py-4 border-t ${divider}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {((profile.firstName?.[0] || '') + (profile.lastName?.[0] || '')).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${logoText}`}>{profile.firstName} {profile.lastName}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
