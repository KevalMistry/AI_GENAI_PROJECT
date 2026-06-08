import React, { useState, useRef } from 'react';
import {
  Upload, FileText, Sparkles, CheckCircle2, AlertCircle,
  XCircle, Target, TrendingUp, Download, RotateCcw,
  Zap, BookOpen, Briefcase, ArrowLeft
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { interviewApi } from '../../services/api';
import type { ResumeAnalysisResponse, ResumeSuggestion } from '../../types';
import { downloadTextFile } from '../../utils/download';

type AnalysisStage = 'upload' | 'analyzing' | 'results';

type ResumeAnalyzerProps = {
  onBack?: () => void;
};

const scoreColor = (value: number) => {
  if (value >= 80) return '#10b981';
  if (value >= 65) return '#f59e0b';
  return '#f43f5e';
};

const suggestionIcon = (type: ResumeSuggestion['type']) => {
  if (type === 'success') return CheckCircle2;
  if (type === 'warning') return AlertCircle;
  return XCircle;
};

const ResumeAnalyzer: React.FC<ResumeAnalyzerProps> = ({ onBack }) => {
  const { isDark } = useTheme();
  const { profile } = useSettings();
  const [stage, setStage] = useState<AnalysisStage>(() => {
    const saved = localStorage.getItem('intervai-resume-analysis');
    return saved ? 'results' : 'upload';
  });
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [jobDesc, setJobDesc] = useState('');
  const [candidateName, setCandidateName] = useState(() => `${profile.firstName} ${profile.lastName}`.trim() || 'Candidate');
  const [analysis, setAnalysis] = useState<ResumeAnalysisResponse | null>(() => {
    const saved = localStorage.getItem('intervai-resume-analysis');
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setSelectedFile(file);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setStage('analyzing');
    setProgress(0);
    setError(null);
    const iv = setInterval(() => {
      setProgress(p => Math.min(88, p + 8));
    }, 200);
    try {
      const result = await interviewApi.analyzeResume({
        candidateName: candidateName.trim() || 'Candidate',
        resume: selectedFile,
        jobDescription: jobDesc,
      });
      setAnalysis(result);
      localStorage.setItem('intervai-resume-analysis', JSON.stringify(result));
      setProgress(100);
      setTimeout(() => setStage('results'), 250);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume analysis failed.');
      setStage('upload');
    } finally {
      clearInterval(iv);
    }
  };

  const resetAnalysis = () => {
    localStorage.removeItem('intervai-resume-analysis');
    setStage('upload');
    setProgress(0);
    setAnalysis(null);
    setError(null);
  };

  const exportReport = () => {
    if (!analysis) return;
    const report = [
      `Resume Analysis Report`,
      `Candidate: ${analysis.candidate_name}`,
      `File: ${analysis.file_name}`,
      `ATS Score: ${Math.round(analysis.ats_score)}%`,
      `Keyword Match: ${Math.round(analysis.keyword_match_score)}%`,
      `Formatting: ${Math.round(analysis.formatting_score)}%`,
      `Impact Score: ${Math.round(analysis.impact_score)}%`,
      '',
      `Matched Skills: ${analysis.matched_skills.join(', ') || 'None'}`,
      `Skill Gaps: ${analysis.missing_skills.join(', ') || 'None'}`,
      '',
      'Recommendations:',
      ...analysis.suggestions.map(item => `- ${item.title}: ${item.detail}`),
    ].join('\n');
    downloadTextFile(`${analysis.candidate_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-resume-analysis.txt`, report);
  };

  const cardBg = isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-slate-700/50' : 'border-slate-200';
  const dropZone = dragging
    ? isDark ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-400 bg-indigo-50'
    : isDark ? 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/20' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50';
  const textArea = isDark
    ? 'bg-slate-900/50 border-slate-700 text-slate-200 placeholder-slate-600 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400';

  // UPLOAD STAGE
  if (stage === 'upload') {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all
              ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-white'}`}
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <Zap size={14} className="flex-shrink-0" />
          <p className="text-xs font-medium">
            <strong>Groq Resume Analysis</strong> - Scores, summary, and suggestions are generated by Groq from your uploaded resume and job description.
          </p>
        </div>

        <div className={`rounded-2xl border p-6 ${cardBg}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-violet-500/15">
              <FileText size={20} className="text-violet-400" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${textPrimary}`}>Resume Analyzer</h3>
              <p className={`text-xs ${textSecondary}`}>Upload your resume for Groq-powered ATS analysis and feedback</p>
            </div>
          </div>

          <div className="mb-4">
            <label className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${textSecondary}`}>
              Candidate Name
            </label>
            <input
              className={`w-full p-3 text-sm rounded-lg border outline-none transition-colors ${textArea}`}
              placeholder="Candidate"
              value={candidateName}
              onChange={e => setCandidateName(e.target.value)}
            />
          </div>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${dropZone}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Upload size={28} className={`mx-auto mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            {fileName ? (
              <div>
                <p className={`text-sm font-semibold ${textPrimary}`}>{fileName}</p>
                <p className={`text-xs mt-1 ${textSecondary}`}>Click to change file</p>
              </div>
            ) : (
              <div>
                <p className={`text-sm font-semibold ${textPrimary}`}>Drop your resume here</p>
                <p className={`text-xs mt-1 ${textSecondary}`}>PDF, DOCX, TXT - max 5MB</p>
              </div>
            )}
          </div>

          {/* Job Description */}
          <div className="mt-4">
            <label className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${textSecondary}`}>
              Job Description (Optional but recommended)
            </label>
            <textarea
              className={`w-full p-3 text-sm rounded-lg border outline-none resize-none transition-colors ${textArea}`}
              rows={4}
              placeholder="Paste the job description here for accurate keyword match and skill gap detection..."
              value={jobDesc}
              onChange={e => setJobDesc(e.target.value)}
            />
          </div>

          {error && (
            <div className={`mt-4 flex gap-2 rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!fileName}
            className="w-full mt-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
          >
            <Sparkles size={16} /> Analyze Resume
          </button>
        </div>

        {/* Feature List */}
        <div className={`rounded-xl border p-5 ${cardBg}`}>
          <h4 className={`text-sm font-semibold mb-3 ${textPrimary}`}>What we analyze</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: Target, text: 'ATS Compatibility Score' },
              { icon: BookOpen, text: 'Keyword Alignment' },
              { icon: TrendingUp, text: 'Impact & Metrics Ratio' },
              { icon: Briefcase, text: 'Industry-Specific Gaps' },
              { icon: CheckCircle2, text: 'Formatting & Readability' },
              { icon: Sparkles, text: 'AI Rewrite Suggestions' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className={`flex items-center gap-2 text-xs ${textSecondary}`}>
                <Icon size={13} className="text-indigo-400 flex-shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ANALYZING STAGE
  if (stage === 'analyzing') {
    const steps = ['Parsing document structure...', 'Extracting skills & keywords...', 'Comparing with job description...', 'Generating AI recommendations...'];
    const stepIdx = Math.floor((progress / 100) * steps.length);
    return (
      <div className="max-w-md mx-auto">
        <div className={`rounded-2xl border p-8 text-center ${cardBg}`}>
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-slate-700/40" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <div className="absolute inset-3 flex items-center justify-center">
              <Sparkles size={24} className="text-indigo-400 animate-pulse" />
            </div>
          </div>
          <h3 className={`text-base font-bold mb-2 ${textPrimary}`}>Analyzing Your Resume</h3>
          <p className={`text-xs mb-5 ${textSecondary}`}>{steps[Math.min(stepIdx, steps.length - 1)]}</p>
          <div className={`w-full h-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-200"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className={`text-xs mt-2 ${textSecondary}`}>{Math.round(Math.min(progress, 100))}%</p>
          <button
            onClick={resetAnalysis}
            className={`mt-5 inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all
              ${isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
          >
            <ArrowLeft size={12} /> Back to upload
          </button>
        </div>
      </div>
    );
  }

  // RESULTS STAGE
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-bold ${textPrimary}`}>Analysis Complete</h3>
          <p className={`text-xs ${textSecondary}`}>{analysis?.file_name ?? fileName}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all
              ${isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}>
            <ArrowLeft size={12} /> Back
          </button>
          <button onClick={resetAnalysis}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all
              ${isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}>
            <RotateCcw size={12} /> Re-analyze
          </button>
          <button
            onClick={exportReport}
            disabled={!analysis}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
          >
            <Download size={12} /> Export Report
          </button>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(analysis?.score_cards ?? []).map(s => (
          <div key={s.label} className={`rounded-xl border p-4 text-center ${cardBg}`}>
            <div className="text-2xl font-black mb-0.5" style={{ color: scoreColor(s.value) }}>{Math.round(s.value)}%</div>
            <div className={`text-xs font-semibold ${textPrimary}`}>{s.label}</div>
            <div className={`text-[10px] mt-1 ${textSecondary}`}>{s.description}</div>
          </div>
        ))}
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`rounded-xl border p-5 ${cardBg}`}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <h4 className={`text-sm font-semibold ${textPrimary}`}>Matched Skills</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {(analysis?.matched_skills ?? []).map(s => (
              <span key={s} className={`px-2 py-1 rounded-lg text-xs font-medium
                ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {s}
              </span>
            ))}
            {!analysis?.matched_skills.length && <span className={`text-xs ${textSecondary}`}>No strong matches found yet.</span>}
          </div>
        </div>
        <div className={`rounded-xl border p-5 ${cardBg}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-amber-400" />
            <h4 className={`text-sm font-semibold ${textPrimary}`}>Skill Gaps</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {(analysis?.missing_skills ?? []).map(s => (
              <span key={s} className={`px-2 py-1 rounded-lg text-xs font-medium
                ${isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                + {s}
              </span>
            ))}
            {!analysis?.missing_skills.length && <span className={`text-xs ${textSecondary}`}>No priority gaps from the job description.</span>}
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className={`rounded-xl border ${cardBg}`}>
        <div className={`px-5 py-4 border-b ${divider}`}>
          <h4 className={`text-sm font-semibold ${textPrimary}`}>AI Recommendations</h4>
        </div>
        <div className="divide-y divide-slate-700/30">
          {(analysis?.suggestions ?? []).map((s, i) => {
            const Icon = suggestionIcon(s.type);
            const color = s.type === 'success' ? 'text-emerald-400' : s.type === 'warning' ? 'text-amber-400' : 'text-rose-400';
            return (
              <div key={i} className={`flex gap-3 px-5 py-3.5`}>
                <Icon size={15} className={`${color} flex-shrink-0 mt-0.5`} />
                <div>
                  <p className={`text-xs font-semibold ${textPrimary}`}>{s.title}</p>
                  <p className={`text-xs mt-0.5 ${textSecondary}`}>{s.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalyzer;
