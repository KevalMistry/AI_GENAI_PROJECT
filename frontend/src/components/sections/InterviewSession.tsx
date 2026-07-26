import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Timer, Brain, Volume2, ChevronRight, RotateCcw,
  Lightbulb, CheckCircle2, Sparkles, AlertCircle,
  Play, Pause
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { sessionsKey } from '../../services/storage';
import { interviewApi } from '../../services/api';
import type {
  AnswerAnalysis,
  BackendInterviewSession,
  InterviewLevel,
  InterviewReport,
} from '../../types';
import Badge from '../ui/Badge';

type InterviewStage = 'setup' | 'active' | 'feedback';
type LoadingAction = 'start' | 'submit' | 'report' | null;
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};
type SpeechLanguage = 'en-IN' | 'hi-IN';
type SpeechStatus = 'idle' | 'listening' | 'unavailable';

const levels: Array<{ label: string; value: InterviewLevel }> = [
  { label: 'Entry', value: 'entry' },
  { label: 'Mid-level', value: 'mid' },
  { label: 'Senior', value: 'senior' },
];
const speechLanguages: Array<{ label: string; value: SpeechLanguage }> = [
  { label: 'English', value: 'en-IN' },
  { label: 'Hindi', value: 'hi-IN' },
];

const InterviewSession: React.FC = () => {
  const { isDark } = useTheme();
  const { profile, cameraDevice, microphoneDevice } = useSettings();
  const [stage, setStage] = useState<InterviewStage>('setup');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);

  const initialLevel = useMemo(() => {
    const levelStr = (profile.experienceLevel || '').toLowerCase();
    if (levelStr.includes('senior')) return levels.find(l => l.value === 'senior') || levels[2];
    if (levelStr.includes('entry') || levelStr.includes('junior')) return levels.find(l => l.value === 'entry') || levels[0];
    return levels.find(l => l.value === 'mid') || levels[1];
  }, [profile.experienceLevel]);

  const [candidateName, setCandidateName] = useState(() => `${profile.firstName} ${profile.lastName}`.trim() || 'Candidate');
  const [selectedRole, setSelectedRole] = useState(() => profile.targetRole || '');
  const [selectedLevel, setSelectedLevel] = useState(initialLevel);
  const [questionCount, setQuestionCount] = useState(5);
  const [session, setSession] = useState<BackendInterviewSession | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [analyses, setAnalyses] = useState<AnswerAnalysis[]>([]);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [speechLanguage, setSpeechLanguage] = useState<SpeechLanguage>('en-IN');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechDraftRef = useRef('');
  const speechShouldRunRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const autoEndTriggeredRef = useRef(false);

  const currentQuestion = session?.questions[questionIdx] ?? null;
  const isLastQuestion = questionIdx >= Math.max((session?.questions.length ?? 1) - 1, 0);

  useEffect(() => {
    if (stage === 'active') {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'active') {
      stopCameraTracks();
      return;
    }

    if (camOn) {
      void startCameraPreview();
    } else {
      stopCameraTracks();
    }

    return () => stopCameraTracks();
  }, [camOn, stage]);

  useEffect(() => () => {
    stopMediaTracks();
    stopCameraTracks();
    speechShouldRunRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  const averageScore = useMemo(() => {
    if (report) return Math.round(report.overall_score);
    if (!analyses.length) return 0;
    return Math.round(analyses.reduce((total, item) => total + item.overall_score, 0) / analyses.length);
  }, [analyses, report]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (recordedAudio) {
      const url = URL.createObjectURL(recordedAudio);
      setAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setAudioUrl(null);
      };
    } else {
      setAudioUrl(null);
    }
  }, [recordedAudio]);

  const togglePlayback = () => {
    if (!playbackRef.current) return;
    if (isPlayingRecording) {
      playbackRef.current.pause();
    } else {
      void playbackRef.current.play();
    }
  };

  const handleStart = async () => {
    setLoadingAction('start');
    setError(null);
    setReport(null);
    setAnalyses([]);
    setTerminationReason(null);
    setQuestionIdx(0);
    setAnswerText('');
    setRecordedAudio(null);
    autoEndTriggeredRef.current = false;

    try {
      const nextSession = await interviewApi.startInterview({
        candidate_name: candidateName.trim() || 'Candidate',
        role: selectedRole.trim() || 'Software Engineer',
        level: selectedLevel.value,
        question_count: questionCount,
      });
      setSession(nextSession);
      setElapsed(0);
      setStage('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start interview.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRecordToggle = async () => {
    if (playbackRef.current) {
      playbackRef.current.pause();
    }
    if (isRecording) {
      recorderRef.current?.stop();
      stopSpeechRecognition();
      return;
    }

    setError(null);
    setRecordedAudio(null);
    audioChunksRef.current = [];
    speechDraftRef.current = answerText.trim();
    speechShouldRunRef.current = true;
    const speechStarted = startSpeechRecognition();

    let recorderStarted = false;
    try {
      let audioConstraints: MediaTrackConstraints | boolean = true;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const found = devices.find(d => d.kind === 'audioinput' && d.label === microphoneDevice);
        if (found) {
          audioConstraints = { deviceId: { exact: found.deviceId } };
        }
      } catch (e) {
        console.warn('Failed to enumerate audio devices:', e);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setRecordedAudio(new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
        setIsRecording(false);
        stopSpeechRecognition();
        stopMediaTracks();
      };

      recorder.start();
      recorderStarted = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone permission was not granted.';
      if (!speechStarted) {
        setError(message);
        speechShouldRunRef.current = false;
        stopSpeechRecognition();
        setIsRecording(false);
        return;
      }

      setError(`${message} Live speech transcription is still available if your browser allows it.`);
    }

    if (speechStarted || recorderStarted) {
      setIsRecording(true);
    } else {
      setError('Microphone is unavailable in this browser. You can still type your answer instead.');
      speechShouldRunRef.current = false;
      stopSpeechRecognition();
    }
  };

  const toggleMic = () => {
    setMicOn(value => {
      const next = !value;
      if (!next && isRecording) {
        recorderRef.current?.stop();
      }
      return next;
    });
  };

  const handleSubmitAnswer = async () => {
    if (playbackRef.current) {
      playbackRef.current.pause();
    }
    if (!session || !currentQuestion) return;
    const transcript = answerText.trim();
    if (!transcript && !recordedAudio) {
      setError('Type an answer or record audio before submitting.');
      return;
    }

    setLoadingAction('submit');
    setError(null);

    try {
      let analysis;
      if (recordedAudio) {
        // If we have audio, we use analyzeAudio which handles transcription backend-side
        analysis = await interviewApi.analyzeAudio(currentQuestion, recordedAudio as Blob);
      } else {
        // Fallback to text analysis if no audio was recorded
        analysis = await interviewApi.analyzeText({
          session_id: session.session_id,
          question: currentQuestion,
          transcript,
          audio_features: {},
          resume_id: session.profile.resume_id,
        });
      }

      setAnalyses(prev => [...prev.filter(item => item.question_id !== analysis.question_id), analysis]);
      setAnswerText('');
      setRecordedAudio(null);
      speechDraftRef.current = '';

      if (isLastQuestion) {
        await createFinalReport([...analyses.filter(item => item.question_id !== analysis.question_id), analysis]);
      } else {
        setQuestionIdx(i => i + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze answer.');
    } finally {
      setLoadingAction(null);
    }
  };

  const createFinalReport = async (completedAnalyses = analyses) => {
    if (!session) return;
    if (!completedAnalyses.length) {
      setError('Submit at least one answer before ending the interview.');
      return;
    }

    setLoadingAction('report');
    setError(null);
    try {
      const finalReport = await interviewApi.createReport({
        session,
        analyses: completedAnalyses,
      });
      setReport(finalReport);
      setStage('feedback');
      
      // Save completed practice session to local storage history
      try {
        const key = sessionsKey(profile?.email);
        const saved = localStorage.getItem(key);
        const history = saved ? JSON.parse(saved) : [];
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        const newSession = {
          id: session.session_id || `session-${Date.now()}`,
          role: session.profile.role || 'Software Engineer',
          company: 'IntervAI Practice',
          score: Math.round(finalReport.overall_score),
          status: 'completed' as const,
          date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          duration: `${minutes} min ${seconds} sec`,
          questions: completedAnalyses.length,
          domain: session.profile.role || 'General SWE',
          category_scores: finalReport.category_scores,
        };
        localStorage.setItem(key, JSON.stringify([newSession, ...history]));
      } catch (e) {
        console.error('Failed to save session history:', e);
      }

      if (intervalRef.current) clearInterval(intervalRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create interview report.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEnd = () => {
    setTerminationReason(null);
    void createFinalReport();
  };

  useEffect(() => {
    if (stage !== 'active' || !session) return;

    const endForFocusLoss = () => {
      if (autoEndTriggeredRef.current) return;
      autoEndTriggeredRef.current = true;
      setTerminationReason('The interview ended automatically because the page lost focus or became hidden.');
      setLoadingAction(null);
      if (playbackRef.current) {
        playbackRef.current.pause();
      }
      recorderRef.current?.stop();
      stopSpeechRecognition();
      stopMediaTracks();
      stopCameraTracks();
      setIsRecording(false);
      setStage('feedback');
      if (analyses.length > 0) {
        void createFinalReport(analyses);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endForFocusLoss();
      }
    };

    const handleWindowBlur = () => {
      endForFocusLoss();
    };

    const handlePageHide = () => {
      endForFocusLoss();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [analyses, createFinalReport, session, stage]);

  const resetInterview = () => {
    stopMediaTracks();
    stopCameraTracks();
    stopSpeechRecognition();
    autoEndTriggeredRef.current = false;
    setStage('setup');
    setSession(null);
    setQuestionIdx(0);
    setElapsed(0);
    setAnswerText('');
    setRecordedAudio(null);
    setAnalyses([]);
    setReport(null);
    setError(null);
    setTerminationReason(null);
    setAudioMuted(false);
  };

  const stopMediaTracks = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const startCameraPreview = async () => {
    if (cameraStreamRef.current) return;

    try {
      let videoConstraints: MediaTrackConstraints | boolean = true;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const found = devices.find(d => d.kind === 'videoinput' && d.label === cameraDevice);
        if (found) {
          videoConstraints = { deviceId: { exact: found.deviceId } };
        }
      } catch (e) {
        console.warn('Failed to enumerate video devices:', e);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCamOn(false);
      setError(err instanceof Error ? err.message : 'Camera permission was not granted.');
    }
  };

  const stopCameraTracks = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognitionCtor = (
      window as Window & {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      }
    ).SpeechRecognition ?? (
      window as Window & {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      }
    ).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
      setSpeechStatus('unavailable');
      return false;
    }

    if (recognitionRef.current) {
      return true;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLanguage;
    recognition.onresult = event => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          speechDraftRef.current = `${speechDraftRef.current} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }
      const combined = `${speechDraftRef.current} ${interim}`.trim();
      if (combined) setAnswerText(combined);
    };
    recognition.onerror = () => {
      setSpeechStatus('idle');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setSpeechStatus('idle');
      if (speechShouldRunRef.current) {
        window.setTimeout(() => startSpeechRecognition(), 250);
      }
    };
    recognitionRef.current = recognition;

    try {
      setSpeechSupported(true);
      recognition.start();
      setSpeechStatus('listening');
      return true;
    } catch {
      recognitionRef.current = null;
      setSpeechStatus('idle');
      return false;
    }
  };

  const stopSpeechRecognition = () => {
    speechShouldRunRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setSpeechStatus('idle');
  };

  const cardBg = isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-slate-700/50' : 'border-slate-200';
  const inputClass = isDark
    ? 'bg-slate-900/50 border-slate-700 text-slate-200 placeholder-slate-600 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400';

  const ErrorNotice = error ? (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
      <AlertCircle size={14} />
      {error}
    </div>
  ) : null;

  if (stage === 'setup') {
    return (
      <div className="w-full space-y-16">
        {ErrorNotice}
        <div className={`rounded-2xl border px-5 py-7 sm:px-8 sm:py-9 lg:px-8 lg:py-9 ${isDark ? 'bg-slate-900/60 border-slate-700/60' : cardBg}`}>
          <h3 className={`text-2xl font-extrabold mb-9 ${textPrimary}`}>Session Config</h3>

          <div className="space-y-5">
            <div>
              <label className={`text-xs font-extrabold uppercase tracking-[0.16em] block mb-3 ${textSecondary}`}>Candidate Name</label>
              <input
                value={candidateName}
                onChange={event => setCandidateName(event.target.value)}
                className={`w-full h-12 px-5 text-base font-semibold rounded-xl border outline-none transition-colors ${inputClass}`}
                placeholder="Full Name"
              />
            </div>

            <div>
              <label className={`text-xs font-extrabold uppercase tracking-[0.16em] block mb-3 ${textSecondary}`}>Target Role</label>
              <input
                value={selectedRole}
                onChange={event => setSelectedRole(event.target.value)}
                className={`w-full h-12 px-5 text-base font-semibold rounded-xl border outline-none transition-colors ${inputClass}`}
                placeholder="e.g. Lead Engineer"
              />
            </div>

            <div>
              <label className={`text-xs font-extrabold uppercase tracking-[0.16em] block mb-3 ${textSecondary}`}>Seniority</label>
              <select
                value={selectedLevel.value}
                onChange={event => {
                  const nextLevel = levels.find(level => level.value === event.target.value);
                  if (nextLevel) setSelectedLevel(nextLevel);
                }}
                className={`w-full h-12 px-5 text-base font-semibold rounded-xl border outline-none transition-colors ${inputClass}`}
              >
                {levels.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-xs font-extrabold uppercase tracking-[0.16em] block mb-3 ${textSecondary}`}>Question Count ({questionCount})</label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={questionCount}
                onChange={event => setQuestionCount(parseInt(event.target.value))}
                className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between mt-2 px-1">
                <span className={`text-[10px] font-bold ${textSecondary}`}>1</span>
                <span className={`text-[10px] font-bold ${textSecondary}`}>5</span>
                <span className={`text-[10px] font-bold ${textSecondary}`}>10</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={loadingAction === 'start'}
            className="w-full mt-8 h-16 bg-[#5237ff] hover:bg-[#6048ff] disabled:opacity-60 text-white text-lg font-extrabold rounded-2xl transition-all duration-200 shadow-lg shadow-indigo-500/25 flex items-center justify-center"
          >
            {loadingAction === 'start' ? 'Starting...' : 'Launch Interview'}
          </button>
        </div>

        <div className="text-center">
          <h1 className={`text-5xl sm:text-6xl font-black tracking-tight ${textPrimary}`}>AI Interview</h1>
          <p className={`mt-5 text-xl sm:text-2xl ${textSecondary}`}>Speech-based interview simulation using LLM evaluation</p>
        </div>
      </div>
    );
  }

  if (stage === 'active') {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {ErrorNotice}
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${cardBg}`}>
          <div className="flex items-center gap-3">
            <Badge label="Live" variant="danger" dot />
            <span className={`text-xs font-medium ${textSecondary}`}>{session?.profile.role} - {selectedLevel.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Timer size={14} className="text-indigo-400" />
            <span className={`text-sm font-mono font-bold ${textPrimary}`}>{formatTime(elapsed)}</span>
          </div>
        </div>

        <div className={`rounded-2xl border p-5 sm:p-6 ${cardBg}`}>
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              {loadingAction === 'submit' && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-slate-900 animate-pulse" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-bold ${textPrimary}`}>AI Interviewer</span>
                {loadingAction === 'submit' && <span className={`text-xs ${textSecondary}`}>Analyzing</span>}
              </div>
              <div className={`rounded-xl p-4 text-sm leading-relaxed ${isDark ? 'bg-slate-700/40' : 'bg-slate-100'} ${textPrimary}`}>
                <p>Question {questionIdx + 1} of {session?.questions.length ?? 0}:</p>
                <p className="mt-1 font-medium">{currentQuestion?.text}</p>
                {currentQuestion?.competency && <p className={`mt-2 text-xs ${textSecondary}`}>Competency: {currentQuestion.competency}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
          <div className={`flex items-center justify-between px-5 py-3 border-b ${divider}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Camera Preview</span>
            <Badge label={camOn ? 'Camera On' : 'Camera Off'} variant={camOn ? 'success' : 'neutral'} dot />
          </div>
          <div className={`aspect-video flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
            {camOn ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            ) : (
              <div className={`flex flex-col items-center gap-2 text-xs ${textSecondary}`}>
                <VideoOff size={22} />
                Camera is off
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-xl border p-5 ${cardBg}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <span className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Your Response</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={speechLanguage}
                onChange={event => setSpeechLanguage(event.target.value as SpeechLanguage)}
                disabled={isRecording}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold outline-none ${inputClass}`}
                aria-label="Speech language"
              >
                {speechLanguages.map(language => (
                  <option key={language.value} value={language.value}>{language.label}</option>
                ))}
              </select>
              <button onClick={handleRecordToggle}
                disabled={!micOn || loadingAction === 'submit'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isRecording ? 'border-rose-500/50 bg-rose-500/10 text-rose-400 animate-pulse' : isDark ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400' : 'border-indigo-300 bg-indigo-50 text-indigo-600'}`}>
                {isRecording ? <><MicOff size={12} /> Stop Recording</> : <><Mic size={12} /> Record Audio</>}
              </button>
            </div>
          </div>
          <div className={`min-h-[76px] rounded-lg p-3 text-sm ${isDark ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
            {isRecording && speechStatus === 'listening' && <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>Listening in {speechLanguages.find(language => language.value === speechLanguage)?.label}. Speak clearly and your words will appear below.</span>}
            {isRecording && speechStatus !== 'listening' && <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>Recording audio. Live typing is reconnecting or unavailable, so you can still type/edit the answer before submitting.</span>}
            {!isRecording && recordedAudio && (
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-medium">Audio captured. Listen back to your response:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlayback}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                  >
                    {isPlayingRecording ? <><Pause size={12} fill="currentColor" /> Pause</> : <><Play size={12} fill="currentColor" /> Play Recording</>}
                  </button>
                  <audio
                    ref={playbackRef}
                    src={audioUrl || ''}
                    onPlay={() => setIsPlayingRecording(true)}
                    onPause={() => setIsPlayingRecording(false)}
                    onEnded={() => setIsPlayingRecording(false)}
                    className="hidden"
                  />
                </div>
              </div>
            )}
            {!isRecording && !recordedAudio && <span>Type your answer below, or record audio and submit it for the backend audio pipeline.</span>}
            {!speechSupported && <p className="mt-2 text-amber-400">Live speech typing is not supported in this browser. Audio recording and typed answers still work.</p>}
          </div>
          <textarea
            className={`w-full mt-2 p-3 text-sm rounded-lg border outline-none resize-none transition-colors ${inputClass}`}
            rows={4}
            placeholder="Type your answer here..."
            value={answerText}
            onChange={event => setAnswerText(event.target.value)}
          />
        </div>

        {analyses.length > 0 && (
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Latest Analysis</span>
              <span className={`text-sm font-bold ${textPrimary}`}>{analyses[analyses.length - 1].overall_score}%</span>
            </div>
            <p className={`text-xs mt-2 ${textSecondary}`}>{analyses[analyses.length - 1].feedback}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={toggleMic}
              aria-label={micOn ? 'Mute microphone' : 'Enable microphone'}
              className={`p-2.5 rounded-xl border transition-all ${micOn ? isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500' : 'border-slate-200 hover:border-emerald-400' : 'border-rose-500/50 bg-rose-500/10 text-rose-400'}`}>
              {micOn ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
            <button
              onClick={() => setCamOn(v => !v)}
              aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
              className={`p-2.5 rounded-xl border transition-all ${camOn ? isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500' : 'border-slate-200 hover:border-emerald-400' : 'border-rose-500/50 bg-rose-500/10 text-rose-400'}`}>
              {camOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
            <button
              onClick={() => setAudioMuted(v => !v)}
              aria-label={audioMuted ? 'Unmute interview audio' : 'Mute interview audio'}
              className={`p-2.5 rounded-xl border transition-all ${audioMuted ? 'border-rose-500/50 bg-rose-500/10 text-rose-400' : isDark ? 'border-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
            >
              <Volume2 size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmitAnswer} disabled={loadingAction !== null}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all">
              {loadingAction === 'submit' ? 'Analyzing...' : isLastQuestion ? 'Submit & Finish' : 'Submit Answer'} <ChevronRight size={14} />
            </button>
            <button onClick={handleEnd} disabled={loadingAction !== null || analyses.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all">
              <PhoneOff size={14} /> End
            </button>
          </div>
        </div>
      </div>
    );
  }

  const scoreBreakdown = report
    ? [
        { label: 'Relevance', score: report.category_scores.relevance, color: '#6366f1' },
        { label: 'Fluency', score: report.category_scores.fluency, color: '#8b5cf6' },
        { label: 'Confidence', score: report.category_scores.confidence, color: '#06b6d4' },
        { label: 'Clarity', score: report.category_scores.clarity, color: '#10b981' },
        { label: 'Emotional Tone', score: report.category_scores.emotional_tone, color: '#f59e0b' },
      ]
    : [];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {ErrorNotice}
      {terminationReason && (
        <div className={`rounded-2xl border px-5 py-4 text-sm font-medium ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {terminationReason}
        </div>
      )}
      <div className={`rounded-2xl border p-6 text-center ${cardBg}`}>
        <div className="inline-flex p-3 rounded-xl bg-indigo-500/15 mb-3">
          <CheckCircle2 size={28} className="text-indigo-400" />
        </div>
        <h3 className={`text-xl font-bold mb-1 ${textPrimary}`}>Session Complete</h3>
        <p className={`text-sm mb-4 ${textSecondary}`}>Duration: {formatTime(elapsed)} - {analyses.length} answers evaluated</p>
        <div className={`text-5xl font-black mb-1 ${textPrimary}`}>{averageScore}<span className="text-2xl text-indigo-400">%</span></div>
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">{report?.recommendation ?? 'Overall Performance'}</p>
      </div>

      {report && (
        <>
          <div className={`rounded-xl border p-5 ${cardBg}`}>
            <h4 className={`text-sm font-bold mb-4 ${textPrimary}`}>Detailed Breakdown</h4>
            <div className="space-y-3">
              {scoreBreakdown.map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-medium ${textSecondary}`}>{item.label}</span>
                    <span className={`text-xs font-bold ${textPrimary}`}>{Math.round(item.score)}%</span>
                  </div>
                  <div className={`h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-xl border p-5 ${cardBg}`}>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={15} className="text-violet-400" />
              <h4 className={`text-sm font-bold ${textPrimary}`}>AI Report</h4>
            </div>
            <p className={`text-xs mb-3 ${textSecondary}`}>{report.summary}</p>
            <div className="space-y-2.5">
              {report.analyses.map(item => (
                <div key={item.question_id} className={`flex gap-2.5 p-3 rounded-lg text-xs ${isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                  <Lightbulb size={13} className="flex-shrink-0 mt-0.5" />
                  <span><strong>{Math.round(item.overall_score)}%</strong> - {item.feedback}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3">
        <button onClick={resetInterview}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
          <RotateCcw size={14} /> Try Again
        </button>
        <button onClick={resetInterview} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all">
          New Interview
        </button>
      </div>
    </div>
  );
};

export default InterviewSession;
