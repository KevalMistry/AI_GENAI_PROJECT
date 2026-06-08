import { useState, useEffect, useCallback } from 'react';

export type Section = 'dashboard' | 'interview' | 'resume' | 'chatbot' | 'schedule' | 'history' | 'settings';

const VALID_SECTIONS: Section[] = ['dashboard', 'interview', 'resume', 'chatbot', 'schedule', 'history', 'settings'];

function getSectionFromHash(): Section {
  const hash = window.location.hash.substring(1) as Section;
  return VALID_SECTIONS.includes(hash) ? hash : 'dashboard';
}

export const useActiveSection = () => {
  const [activeSection, setActiveSectionState] = useState<Section>(() => getSectionFromHash());
  const [navigationHistory, setNavigationHistory] = useState<Section[]>(() => [getSectionFromHash()]);

  // Synchronize state with hash changes (supports back/forward buttons, manual typing, links)
  useEffect(() => {
    const handleHashChange = () => {
      const newSection = getSectionFromHash();
      setActiveSectionState(newSection);

      setNavigationHistory(prev => {
        // If going back to the previous section in history
        if (prev.length > 1 && prev[prev.length - 2] === newSection) {
          return prev.slice(0, -1);
        }
        // If transitioning to a new section (not matching current top)
        if (prev[prev.length - 1] !== newSection) {
          return [...prev, newSection];
        }
        return prev;
      });
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Set initial hash on page load if empty
    if (!window.location.hash) {
      window.location.hash = activeSection;
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeSection]);

  const setActiveSection = useCallback((newSection: Section) => {
    if (VALID_SECTIONS.includes(newSection)) {
      window.location.hash = newSection;
    }
  }, []);

  const goBack = useCallback(() => {
    if (navigationHistory.length > 1) {
      window.history.back();
    } else {
      // Fallback route if history stack is at bottom
      setActiveSection('dashboard');
    }
  }, [navigationHistory, setActiveSection]);

  const canGoBack = navigationHistory.length > 1;

  return { activeSection, setActiveSection, goBack, canGoBack };
};
