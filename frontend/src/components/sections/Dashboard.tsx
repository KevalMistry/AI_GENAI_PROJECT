import React, { useState, useEffect, useMemo } from 'react';
import {
  Mic2, FileText, MessageSquare, Star, Clock,
  Target, Zap, Award, ChevronRight, Play, TrendingUp,
  Sparkles, CheckCircle2, ChevronRight as ChevronIcon
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { sessionsKey, resumeKey } from '../../services/storage';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import ProgressRing from '../ui/ProgressRing';
import type { Section } from '../../hooks/useActiveSection';

interface DashboardProps {
  setActiveSection: (s: Section) => void;
}

type SessionStatus = 'completed' | 'in-progress' | 'scheduled';

interface DashboardSession {
  id: string;
  role: string;
  company: string;
  score: number;
  status: SessionStatus;
  date: string;
  duration: string;
  questions?: number;
  domain?: string;
  category_scores?: {
    relevance: number;
    fluency: number;
    confidence: number;
    clarity: number;
    emotional_tone: number;
  };
}

const statusVariant = {
  completed: 'success' as const,
  'in-progress': 'warning' as const,
  scheduled: 'info' as const,
};

const parseDurationToMinutes = (dur: string): number => {
  if (!dur || dur === '—' || dur === '-') return 0;
  const minMatch = dur.match(/(\d+)\s*min/i);
  const secMatch = dur.match(/(\d+)\s*sec/i);
  let mins = minMatch ? parseInt(minMatch[1], 10) : 0;
  let secs = secMatch ? parseInt(secMatch[1], 10) : 0;
  
  if (!mins && !secs) {
    const rawMatch = dur.match(/(\d+)/);
    mins = rawMatch ? parseInt(rawMatch[1], 10) : 0;
  }
  return mins + (secs / 60);
};

const Dashboard: React.FC<DashboardProps> = ({ setActiveSection }) => {
  const { isDark } = useTheme();

  const { profile } = useSettings();

  // Load actual sessions from localStorage or fallback to empty array
  const [sessions, setSessions] = useState<DashboardSession[]>(() => {
    const saved = localStorage.getItem(sessionsKey(profile?.email));
    return saved ? JSON.parse(saved) : [];
  });

  // Load actual latest resume analysis from localStorage
  const [resumeAnalysis, setResumeAnalysis] = useState<any>(() => {
    const saved = localStorage.getItem(resumeKey(profile?.email));
    return saved ? JSON.parse(saved) : null;
  });

  // Listen to profile/settings clears in other tabs
  useEffect(() => {
    const handleClear = () => {
      setSessions([]);
      setResumeAnalysis(null);
    };
    window.addEventListener('intervai-history-cleared', handleClear);
    return () => window.removeEventListener('intervai-history-cleared', handleClear);
  }, []);

  // Compute stats dynamically in real-time
  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter(s => s.status === 'completed');
    const scored = completed.filter(s => s.score > 0);
    
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
      : 0;

    // Sum durations
    const totalMinutes = sessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + parseDurationToMinutes(s.duration), 0);
    
    // Parse streak dynamically
    let streakCount = 0;
    if (completed.length > 0) {
      const uniqueDates = Array.from(new Set(
        completed.map(s => {
          const parsed = Date.parse(s.date);
          if (isNaN(parsed)) return '';
          const d = new Date(parsed);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }).filter(Boolean)
      )).sort((a, b) => b.localeCompare(a));

      if (uniqueDates.length > 0) {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        
        if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
          streakCount = 1;
          let current = new Date(Date.parse(uniqueDates[0]));
          for (let i = 1; i < uniqueDates.length; i++) {
            const prevDate = new Date(current);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
            if (uniqueDates[i] === prevDateStr) {
              streakCount++;
              current = prevDate;
            } else {
              break;
            }
          }
        }
      }
    }

    const hoursPracticed = (totalMinutes / 60).toFixed(1);
    
    return {
      total,
      avgScore,
      hoursPracticed: `${hoursPracticed}h`,
      streak: `${streakCount} Day${streakCount === 1 ? '' : 's'}`,
    };
  }, [sessions]);

  // Compute skill averages dynamically
  const skills = useMemo(() => {
    const sessionsWithScores = sessions.filter(s => s.status === 'completed' && s.category_scores);
    
    if (sessionsWithScores.length === 0) {
      // Fallback base standard default values
      return [
        { label: 'Technical Depth', value: 88, color: '#6366f1' },
        { label: 'Communication', value: 76, color: '#8b5cf6' },
        { label: 'Problem Solving', value: 91, color: '#06b6d4' },
        { label: 'System Design', value: 72, color: '#10b981' },
      ];
    }

    const relevanceSum = sessionsWithScores.reduce((sum, s) => sum + (s.category_scores?.relevance || 0), 0);
    const fluencySum = sessionsWithScores.reduce((sum, s) => sum + (s.category_scores?.fluency || 0), 0);
    const claritySum = sessionsWithScores.reduce((sum, s) => sum + (s.category_scores?.clarity || 0), 0);
    const confidenceSum = sessionsWithScores.reduce((sum, s) => sum + (s.category_scores?.confidence || 0), 0);
    
    const count = sessionsWithScores.length;
    return [
      { label: 'Technical Depth', value: Math.round(relevanceSum / count), color: '#6366f1' },
      { label: 'Communication', value: Math.round(fluencySum / count), color: '#8b5cf6' },
      { label: 'Problem Solving', value: Math.round(claritySum / count), color: '#06b6d4' },
      { label: 'System Design', value: Math.round(confidenceSum / count), color: '#10b981' },
    ];
  }, [sessions]);

  const cardBg = isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const rowHover = isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50';
  const divider = isDark ? 'border-slate-700/50' : 'border-slate-100';
  const heroBg = isDark
    ? 'bg-gradient-to-br from-indigo-900/40 via-slate-800/60 to-violet-900/30 border-indigo-500/20'
    : 'bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-indigo-200/60';
  const skillBar = isDark ? 'bg-slate-700/50' : 'bg-slate-100';

  return (
    <div className="space-y-6">
      {/* Hero Banner with ATS Integration & Dynamic CTAs */}
      <div className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 ${heroBg}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />
        
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {resumeAnalysis ? (
            <>
              <ProgressRing
                value={Math.round(resumeAnalysis.ats_score)}
                size={110}
                strokeWidth={9}
                color="#10b981"
                label={`${Math.round(resumeAnalysis.ats_score)}%`}
                sublabel="ATS Score"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Award size={16} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider animate-pulse">
                    ATS Rating Active
                  </span>
                </div>
                <h3 className={`text-2xl sm:text-3xl font-bold mb-1.5 ${textPrimary}`}>
                  Resume ATS Optimized!
                </h3>
                <p className={`text-sm mb-3.5 ${textSecondary}`}>
                  Your resume has been successfully parsed. Industry keyword matching and formatting metrics are live.
                </p>
                {resumeAnalysis.matched_skills && resumeAnalysis.matched_skills.length > 0 && (
                  <div className="mb-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary} block mb-2`}>
                      Matched Keywords ({resumeAnalysis.matched_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {resumeAnalysis.matched_skills.slice(0, 6).map((skill: string) => (
                        <span key={skill} className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border transition-all duration-300
                          ${isDark ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:border-indigo-500/40' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-250'}`}>
                          {skill}
                        </span>
                      ))}
                      {resumeAnalysis.matched_skills.length > 6 && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          +{resumeAnalysis.matched_skills.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSection('interview')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 cursor-pointer"
                  >
                    <Play size={14} /> Start Interview
                  </button>
                  <button
                    onClick={() => setActiveSection('resume')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-all duration-200 cursor-pointer
                      ${isDark ? 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700/50' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <FileText size={14} /> View ATS Analysis
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <ProgressRing
                value={stats.avgScore || 0}
                size={110}
                strokeWidth={9}
                color="#3b82f6"
                label={stats.avgScore > 0 ? `${stats.avgScore}%` : 'Locked'}
                sublabel="ATS Check"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-amber-400 animate-pulse" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Boost Your ATS Performance
                  </span>
                </div>
                <h3 className={`text-2xl sm:text-3xl font-extrabold mb-1.5 ${textPrimary}`}>
                  Analyze Your Resume with AI
                </h3>
                <p className={`text-sm mb-4 max-w-xl ${textSecondary}`}>
                  Get immediate dynamic feedback on formatting, industry keyword matching, quantified experience metrics, and identify critical skill gaps!
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSection('resume')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 cursor-pointer"
                  >
                    <Sparkles size={14} /> Upload & Analyze Resume
                  </button>
                  <button
                    onClick={() => setActiveSection('interview')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-all duration-200 cursor-pointer
                      ${isDark ? 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700/50' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Play size={14} /> Start Practice Run
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Sessions"
          value={stats.total.toString()}
          delta="Dynamic count"
          positive={true}
          icon={<Mic2 size={20} />}
          accentColor="indigo"
        />
        <StatCard
          label="Avg. Score"
          value={stats.avgScore > 0 ? `${stats.avgScore}%` : '—'}
          delta="Real evaluation"
          positive={true}
          icon={<TrendingUp size={20} />}
          accentColor="violet"
        />
        <StatCard
          label="Hours Practiced"
          value={stats.hoursPracticed}
          delta="Calculated duration"
          positive={true}
          icon={<Clock size={20} />}
          accentColor="cyan"
        />
        <StatCard
          label="Streak"
          value={stats.streak}
          delta="Dynamic active streak"
          positive={streakCount => parseInt(streakCount) > 0}
          icon={<Zap size={20} />}
          accentColor="amber"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Sessions */}
        <div className={`lg:col-span-2 rounded-xl border ${cardBg}`}>
          <div className={`flex items-center justify-between px-5 py-4 border-b ${divider}`}>
            <div className="flex items-center gap-2">
              <HistoryIcon size={16} className="text-indigo-400" />
              <h3 className={`text-sm font-semibold ${textPrimary}`}>Recent Sessions</h3>
            </div>
            <button
              onClick={() => setActiveSection('history')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              View All <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-700/30">
            {sessions.slice(0, 4).map((s, i) => (
              <div key={s.id || i} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${rowHover}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm
                  ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {s.company ? s.company[0] : 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${textPrimary}`}>{s.role}</p>
                  <p className={`text-xs ${textSecondary}`}>{s.company} · {s.date}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {s.status === 'completed' && s.score > 0 && (
                    <div className="hidden sm:flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className={`text-sm font-bold ${textPrimary}`}>{s.score}%</span>
                    </div>
                  )}
                  <Badge
                    label={s.status}
                    variant={statusVariant[s.status]}
                    dot
                  />
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="p-10 text-center flex flex-col items-center justify-center">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4
                  ${isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
                  <Mic2 size={24} />
                </div>
                <p className={`text-sm font-bold ${textPrimary} mb-1`}>No practice sessions completed yet</p>
                <p className={`text-xs ${textSecondary} max-w-sm mb-5`}>
                  Start practicing with our interactive, role-specific AI Coach to receive dynamic stats, skills evaluation, and detailed session analysis.
                </p>
                <button
                  onClick={() => setActiveSection('interview')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  <Play size={14} /> Start Practice Interview
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Skills Breakdown */}
        <div className={`rounded-xl border ${cardBg}`}>
          <div className={`flex items-center gap-2 px-5 py-4 border-b ${divider}`}>
            <Target size={16} className="text-violet-400" />
            <h3 className={`text-sm font-semibold ${textPrimary}`}>Skill Breakdown</h3>
          </div>
          <div className="px-5 py-4 space-y-4 relative">
            {skills.map((skill) => (
              <div key={skill.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${textSecondary}`}>{skill.label}</span>
                  <span className={`text-xs font-bold ${textPrimary}`}>{skill.value}%</span>
                </div>
                <div className={`w-full h-1.5 rounded-full ${skillBar}`}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${skill.value}%`, backgroundColor: skill.color }}
                  />
                </div>
              </div>
            ))}
            {sessions.filter(s => s.status === 'completed' && s.category_scores).length === 0 && (
              <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] rounded-xl flex items-center justify-center flex-col p-4 text-center">
                <div className={`p-4 rounded-2xl border backdrop-blur-md flex flex-col items-center justify-center
                  ${isDark ? 'bg-slate-850 border-slate-700/80 shadow-2xl' : 'bg-white/95 border-slate-200 shadow-xl'}`}>
                  <Target size={18} className="text-indigo-400 mb-2 animate-bounce" />
                  <p className={`text-xs font-bold ${textPrimary} mb-1`}>Locked Skill Dashboard</p>
                  <p className={`text-[10px] ${textSecondary} max-w-[200px] mb-3`}>
                    Complete a dynamic AI mock interview to measure your technical depth, fluency, and system design live!
                  </p>
                  <button
                    onClick={() => setActiveSection('interview')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                  >
                    Unlock Metrics
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className={`px-5 pb-5 pt-2 border-t ${divider}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textSecondary}`}>Quick Actions</p>
            <div className="space-y-2">
              {[
                { icon: <Mic2 size={14} />, label: 'Practice Technical', section: 'interview' as Section },
                { icon: <MessageSquare size={14} />, label: 'Chat with AI Coach', section: 'chatbot' as Section },
                { icon: <FileText size={14} />, label: 'Review Resume', section: 'resume' as Section },
              ].map(({ icon, label, section }) => (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer
                    ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                >
                  <span className="text-indigo-400">{icon}</span>
                  {label}
                  <ChevronIcon size={10} className="ml-auto opacity-40" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
  </svg>
);

export default Dashboard;
