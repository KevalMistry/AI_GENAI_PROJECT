import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Star, Clock, Calendar,
  ChevronDown, ChevronRight, Download, BarChart2, Mic2,
  Plus, X, Play, Trash2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { sessionsKey } from '../../services/storage';
import Badge from '../ui/Badge';
import { downloadTextFile } from '../../utils/download';

type FilterType = 'all' | 'completed' | 'scheduled';
type SessionStatus = 'completed' | 'in-progress' | 'scheduled';

type HistorySession = {
  id: string;
  role: string;
  company: string;
  score: number;
  status: SessionStatus;
  date: string;
  duration: string;
  questions: number;
  domain: string;
  interviewer?: string;
  meetingLink?: string;
  notes?: string;
};

type ScheduleForm = {
  role: string;
  company: string;
  date: string;
  time: string;
  domain: string;
  interviewer: string;
  meetingLink: string;
  notes: string;
};

const initialSessions: HistorySession[] = [
  { id: '1', role: 'Senior Frontend Engineer', company: 'Google', score: 92, status: 'completed', date: 'Jun 10, 2025', duration: '32 min', questions: 6, domain: 'React / System Design' },
  { id: '2', role: 'Full Stack Developer', company: 'Stripe', score: 87, status: 'completed', date: 'Jun 9, 2025', duration: '28 min', questions: 5, domain: 'Node.js / APIs' },
  { id: '3', role: 'React Developer', company: 'Airbnb', score: 78, status: 'completed', date: 'Jun 7, 2025', duration: '24 min', questions: 4, domain: 'React / TypeScript' },
  { id: '4', role: 'Backend Engineer', company: 'Spotify', score: 83, status: 'completed', date: 'Jun 5, 2025', duration: '30 min', questions: 6, domain: 'Algorithms & DS' },
  { id: '5', role: 'Lead Engineer', company: 'Meta', score: 0, status: 'scheduled', date: 'Jun 15, 2025 - 2:00 PM', duration: '-', questions: 0, domain: 'System Design', interviewer: 'Avery Chen', meetingLink: 'https://meet.example.com/lead-engineer', notes: 'Prepare architecture tradeoffs and leadership examples.' },
  { id: '6', role: 'Software Engineer II', company: 'Netflix', score: 89, status: 'completed', date: 'Jun 3, 2025', duration: '26 min', questions: 5, domain: 'Python / Django' },
];

const emptyScheduleForm: ScheduleForm = {
  role: '',
  company: '',
  date: '',
  time: '',
  domain: '',
  interviewer: '',
  meetingLink: '',
  notes: '',
};

const statusVariant = {
  completed: 'success' as const,
  'in-progress': 'warning' as const,
  scheduled: 'info' as const,
};

const ScoreBar: React.FC<{ score: number }> = ({ score }) => {
  const { isDark } = useTheme();
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#6366f1' : '#f59e0b';
  return (
    <div className="flex items-center gap-2 w-24">
      <div className={`flex-1 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{score > 0 ? `${score}%` : '-'}</span>
    </div>
  );
};

interface SessionHistoryProps {
  defaultFilter?: FilterType;
  scheduledOnly?: boolean;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({
  defaultFilter = 'all',
  scheduledOnly = false,
}) => {
  const { isDark } = useTheme();
  const { profile } = useSettings();
  const [sessions, setSessions] = useState<HistorySession[]>(() => {
    const key = sessionsKey(profile?.email);
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    // For authenticated users (have an email), start with an empty history by default
    if (profile?.email && profile.email.trim()) return [];
    // For anonymous/guest users, keep the demo seeded sessions
    return initialSessions;
  });
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    const key = sessionsKey(profile?.email);
    localStorage.setItem(key, JSON.stringify(sessions));
  }, [sessions, profile?.email]);

  // Listen for history clear event
  useEffect(() => {
    const handleClear = () => {
      setSessions([]);
    };
    window.addEventListener('intervai-history-cleared', handleClear);
    return () => window.removeEventListener('intervai-history-cleared', handleClear);
  }, []);

  const filtered = sessions.filter(s => {
    const matchesFilter = scheduledOnly ? s.status === 'scheduled' : filter === 'all' || s.status === filter;
    const matchesSearch = s.role.toLowerCase().includes(search.toLowerCase()) ||
      s.company.toLowerCase().includes(search.toLowerCase()) ||
      s.domain.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const scoredSessions = sessions.filter(s => s.score > 0);
  const scheduledCount = sessions.filter(s => s.status === 'scheduled').length;
  const avgScore = scoredSessions.length
    ? Math.round(scoredSessions.reduce((a, b) => a + b.score, 0) / scoredSessions.length)
    : 0;

  const cardBg = isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-slate-700/50' : 'border-slate-200';
  const inputBg = isDark
    ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-500 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400';
  const fieldBg = isDark
    ? 'bg-slate-900/50 border-slate-700 text-slate-200 placeholder-slate-600 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400';
  const filterBtn = (active: boolean) => active
    ? 'bg-indigo-600 text-white border-indigo-600'
    : isDark ? 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700';
  const rowBg = isDark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50';
  const expandedBg = isDark ? 'bg-slate-900/40' : 'bg-slate-50';

  const updateScheduleForm = (key: keyof ScheduleForm, value: string) => {
    setScheduleForm(prev => ({ ...prev, [key]: value }));
    setFormError(null);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const formatScheduleDate = (date: string, time: string) => {
    const dateTime = new Date(`${date}T${time}`);
    if (Number.isNaN(dateTime.getTime())) return `${date} ${time}`;

    return dateTime.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleScheduleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleForm.role.trim() || !scheduleForm.company.trim() || !scheduleForm.date || !scheduleForm.time || !scheduleForm.domain.trim()) {
      setFormError('Role, company, date, time, and domain are required.');
      return;
    }

    const scheduledSession: HistorySession = {
      id: `scheduled-${Date.now()}`,
      role: scheduleForm.role.trim(),
      company: scheduleForm.company.trim(),
      score: 0,
      status: 'scheduled',
      date: formatScheduleDate(scheduleForm.date, scheduleForm.time),
      duration: '-',
      questions: 0,
      domain: scheduleForm.domain.trim(),
      interviewer: scheduleForm.interviewer.trim() || 'AI Interviewer',
      meetingLink: scheduleForm.meetingLink.trim(),
      notes: scheduleForm.notes.trim(),
    };

    setSessions(prev => [scheduledSession, ...prev]);
    setExpanded(scheduledSession.id);
    setFilter('scheduled');
    setScheduleForm(emptyScheduleForm);
    setShowScheduleForm(false);
    setFormError(null);
    showNotice('Meeting scheduled.');
  };

  const handleCancelScheduled = (sessionId: string) => {
    setSessions(prev => prev.filter(session => session.id !== sessionId));
    if (expanded === sessionId) setExpanded(null);
    showNotice('Scheduled meeting canceled.');
  };

  const handleStartScheduled = (sessionId: string) => {
    setSessions(prev => prev.map(session => (
      session.id === sessionId
        ? { ...session, status: 'in-progress', duration: 'Live' }
        : session
    )));
    setFilter('all');
    showNotice('Practice marked in progress. Open AI Interview to begin a live session.');
  };

  const exportSessions = (items: HistorySession[], fileName = 'intervai-sessions.csv') => {
    const rows = [
      ['Role', 'Company', 'Status', 'Score', 'Date', 'Duration', 'Questions', 'Domain'],
      ...items.map(session => [
        session.role,
        session.company,
        session.status,
        session.score ? `${session.score}%` : '',
        session.date,
        session.duration,
        String(session.questions),
        session.domain,
      ]),
    ];
    const csv = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadTextFile(fileName, csv, 'text/csv');
    showNotice('Export downloaded.');
  };

  const exportSessionReport = (session: HistorySession) => {
    const report = [
      `IntervAI Session Report`,
      `Role: ${session.role}`,
      `Company: ${session.company}`,
      `Status: ${session.status}`,
      `Score: ${session.score ? `${session.score}%` : 'N/A'}`,
      `Date: ${session.date}`,
      `Duration: ${session.duration}`,
      `Questions: ${session.questions || 'Upcoming'}`,
      `Domain: ${session.domain}`,
      session.interviewer ? `Interviewer: ${session.interviewer}` : '',
      session.meetingLink ? `Meeting Link: ${session.meetingLink}` : '',
      session.notes ? `Notes: ${session.notes}` : '',
    ].filter(Boolean).join('\n');
    downloadTextFile(`${session.role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.txt`, report);
    showNotice('Report downloaded.');
  };

  return (
    <div className="space-y-5">
      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-xs ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {notice}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: scheduledOnly ? 'Scheduled' : 'Total Sessions', value: scheduledOnly ? scheduledCount.toString() : sessions.length.toString(), icon: <Mic2 size={16} />, color: 'text-indigo-400' },
          { label: 'Avg Score', value: `${avgScore}%`, icon: <BarChart2 size={16} />, color: 'text-violet-400' },
          { label: 'Hours Practiced', value: '6.4h', icon: <Clock size={16} />, color: 'text-cyan-400' },
          { label: scheduledOnly ? 'Ready To Start' : 'Scheduled', value: scheduledCount.toString(), icon: <Calendar size={16} />, color: 'text-amber-400' },
        ].map(item => (
          <div key={item.label} className={`rounded-xl border p-3 sm:p-4 flex items-center gap-3 ${cardBg}`}>
            <span className={item.color}>{item.icon}</span>
            <div>
              <div className={`text-lg font-black ${textPrimary}`}>{item.value}</div>
              <div className={`text-[11px] ${textSecondary}`}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border ${cardBg}`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 ${showScheduleForm ? `border-b ${divider}` : ''}`}>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-amber-400" />
            <div>
              <h3 className={`text-sm font-semibold ${textPrimary}`}>Scheduled Meetings</h3>
              <p className={`text-xs ${textSecondary}`}>Plan upcoming interview practice sessions.</p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowScheduleForm(open => !open);
              setFormError(null);
            }}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${showScheduleForm ? isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-700/50' : 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500'}`}
          >
            {showScheduleForm ? <X size={13} /> : <Plus size={13} />}
            {showScheduleForm ? 'Close' : 'Schedule Meeting'}
          </button>
        </div>

        {showScheduleForm && (
          <form onSubmit={handleScheduleSubmit} className="px-5 py-4 space-y-4">
            {formError && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={scheduleForm.role} onChange={event => updateScheduleForm('role', event.target.value)} placeholder="Role, e.g. Backend Engineer" className={`px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${fieldBg}`} />
              <input value={scheduleForm.company} onChange={event => updateScheduleForm('company', event.target.value)} placeholder="Company or target" className={`px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${fieldBg}`} />
              <input aria-label="Interview date" inputMode="numeric" value={scheduleForm.date} onChange={event => updateScheduleForm('date', event.target.value)} placeholder="Date, YYYY-MM-DD" className={`px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${fieldBg}`} />
              <input aria-label="Interview time" inputMode="numeric" value={scheduleForm.time} onChange={event => updateScheduleForm('time', event.target.value)} placeholder="Time, HH:MM" className={`px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${fieldBg}`} />
              <input value={scheduleForm.domain} onChange={event => updateScheduleForm('domain', event.target.value)} placeholder="Domain, e.g. System Design" className={`px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${fieldBg}`} />
              <input value={scheduleForm.interviewer} onChange={event => updateScheduleForm('interviewer', event.target.value)} placeholder="Interviewer name optional" className={`px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${fieldBg}`} />
              <input value={scheduleForm.meetingLink} onChange={event => updateScheduleForm('meetingLink', event.target.value)} placeholder="Meeting link optional" className={`sm:col-span-2 px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${fieldBg}`} />
              <textarea value={scheduleForm.notes} onChange={event => updateScheduleForm('notes', event.target.value)} placeholder="Preparation notes optional" rows={3} className={`sm:col-span-2 px-3 py-2 text-sm rounded-lg border outline-none resize-none transition-colors ${fieldBg}`} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setScheduleForm(emptyScheduleForm);
                  setShowScheduleForm(false);
                  setFormError(null);
                }}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
              >
                Cancel
              </button>
              <button type="submit" className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all">
                Add Schedule
              </button>
            </div>
          </form>
        )}
      </div>

      <div className={`rounded-xl border p-3 sm:p-4 flex flex-col sm:flex-row gap-3 ${cardBg}`}>
        <div className="relative flex-1">
          <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary}`} />
          <input
            type="text"
            placeholder="Search by role, company, or domain..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg border outline-none transition-colors ${inputBg}`}
          />
        </div>
        {!scheduledOnly && (
          <div className="flex items-center gap-2">
            <Filter size={13} className={textSecondary} />
            <div className="flex gap-1.5">
              {(['all', 'completed', 'scheduled'] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${filterBtn(filter === f)}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => exportSessions(filtered)}
          disabled={filtered.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
        >
          <Download size={12} /> Export
        </button>
      </div>

      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        <div className={`hidden sm:grid grid-cols-12 gap-3 px-5 py-3 border-b text-[11px] font-semibold uppercase tracking-wider ${textSecondary} ${divider}`}>
          <div className="col-span-4">Session</div>
          <div className="col-span-2">Domain</div>
          <div className="col-span-2">Score</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1" />
        </div>

        <div className="divide-y divide-slate-700/30">
          {filtered.length === 0 ? (
            <div className={`text-center py-12 ${textSecondary}`}>
              <Search size={28} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No sessions match your search.</p>
            </div>
          ) : (
            filtered.map(session => (
              <div key={session.id}>
                <button
                  className={`w-full text-left transition-colors ${rowBg}`}
                  onClick={() => setExpanded(expanded === session.id ? null : session.id)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 px-5 py-3.5 items-center">
                    <div className="col-span-4 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        {session.company[0]}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${textPrimary}`}>{session.role}</p>
                        <p className={`text-xs ${textSecondary}`}>{session.company} - {session.date}</p>
                      </div>
                    </div>

                    <div className={`col-span-2 text-xs hidden sm:block ${textSecondary}`}>{session.domain}</div>
                    <div className="col-span-2 hidden sm:flex">
                      {session.score > 0 ? <ScoreBar score={session.score} /> : <span className={`text-xs ${textSecondary}`}>-</span>}
                    </div>
                    <div className={`col-span-2 text-xs hidden sm:flex items-center gap-1 ${textSecondary}`}>
                      <Clock size={11} /> {session.duration}
                    </div>
                    <div className="col-span-1 hidden sm:block">
                      <Badge label={session.status} variant={statusVariant[session.status]} dot />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {expanded === session.id
                        ? <ChevronDown size={14} className={textSecondary} />
                        : <ChevronRight size={14} className={textSecondary} />}
                    </div>
                  </div>
                </button>

                {expanded === session.id && (
                  <div className={`px-5 pb-4 pt-2 ${expandedBg}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {[
                        { label: 'Score', value: session.score > 0 ? `${session.score}%` : 'N/A' },
                        { label: 'Duration', value: session.duration },
                        { label: 'Questions', value: session.questions > 0 ? `${session.questions} answered` : 'Upcoming' },
                        { label: 'Domain', value: session.domain },
                      ].map(item => (
                        <div key={item.label} className={`rounded-lg p-2.5 ${isDark ? 'bg-slate-800/60' : 'bg-white border border-slate-200'}`}>
                          <p className={`text-[10px] uppercase tracking-wide ${textSecondary}`}>{item.label}</p>
                          <p className={`text-xs font-semibold mt-0.5 ${textPrimary}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {session.status === 'scheduled' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        {[
                          { label: 'Interviewer', value: session.interviewer || 'AI Interviewer' },
                          { label: 'Meeting Link', value: session.meetingLink || 'Not added' },
                          { label: 'Notes', value: session.notes || 'No prep notes yet' },
                        ].map(item => (
                          <div key={item.label} className={`rounded-lg p-2.5 ${isDark ? 'bg-slate-800/60' : 'bg-white border border-slate-200'}`}>
                            <p className={`text-[10px] uppercase tracking-wide ${textSecondary}`}>{item.label}</p>
                            <p className={`text-xs font-semibold mt-0.5 truncate ${textPrimary}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {session.status === 'completed' && (
                        <button
                          onClick={() => exportSessionReport(session)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1.5"
                        >
                          <Star size={11} /> View Full Report
                        </button>
                      )}
                      {session.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleStartScheduled(session.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1.5"
                          >
                            <Play size={11} /> Start Practice
                          </button>
                          <button
                            onClick={() => handleCancelScheduled(session.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${isDark ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10' : 'border-rose-200 text-rose-600 hover:bg-rose-50'}`}
                          >
                            <Trash2 size={11} /> Cancel Schedule
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => exportSessionReport(session)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
                      >
                        <Download size={11} /> Export
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionHistory;
