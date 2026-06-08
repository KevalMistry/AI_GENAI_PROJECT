import React, { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { useActiveSection } from './hooks/useActiveSection';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Dashboard from './components/sections/Dashboard';
import InterviewSession from './components/sections/InterviewSession';
import ResumeAnalyzer from './components/sections/ResumeAnalyzer';
import Chatbot from './components/sections/Chatbot';
import SessionHistory from './components/sections/SessionHistory';
import Settings from './components/sections/Settings';
import AuthScreen from './components/sections/AuthScreen';

const AppShell: React.FC = () => {
  const { isDark } = useTheme();
  const { activeSection, setActiveSection, goBack, canGoBack } = useActiveSection();
  const [mobileOpen, setMobileOpen] = useState(false);

  const mainBg = isDark ? 'bg-[#0f1523]' : 'bg-slate-50';
  const contentBg = isDark ? 'text-slate-100' : 'text-slate-900';

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':    return <Dashboard setActiveSection={setActiveSection} />;
      case 'interview':    return <InterviewSession />;
      case 'resume':       return <ResumeAnalyzer onBack={goBack} />;
      case 'chatbot':      return <Chatbot />;
      case 'schedule':     return <SessionHistory defaultFilter="scheduled" scheduledOnly />;
      case 'history':      return <SessionHistory />;
      case 'settings':     return <Settings />;
      default:             return <Dashboard setActiveSection={setActiveSection} />;
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden ${mainBg} ${contentBg}`}>
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar
          activeSection={activeSection}
          setMobileOpen={setMobileOpen}
          setActiveSection={setActiveSection}
          goBack={goBack}
          canGoBack={canGoBack}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('intervai-token'));

  useEffect(() => {
    const syncToken = () => setToken(localStorage.getItem('intervai-token'));
    window.addEventListener('storage', syncToken);
    return () => window.removeEventListener('storage', syncToken);
  }, []);

  return (
    <SettingsProvider>
      <ThemeProvider>
        {token ? <AppShell /> : <AuthScreen onAuthenticated={() => setToken(localStorage.getItem('intervai-token'))} />}
      </ThemeProvider>
    </SettingsProvider>
  );
};

export default App;
