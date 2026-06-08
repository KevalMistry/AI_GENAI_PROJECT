import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Sparkles, User, RotateCcw,
  ChevronDown, Mic, PaperclipIcon, Copy, ThumbsUp, ThumbsDown,
  Brain, Code, FileText, Briefcase, AlertCircle, Layers
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { copyText } from '../../utils/download';
import { interviewApi } from '../../services/api';
import type { CoachProfile, Message } from '../../types';

const iconMap: Record<string, React.FC<any>> = {
  Brain,
  Code,
  FileText,
  Briefcase,
  User,
  Layers
};

const defaultCoaches: CoachProfile[] = [
  {
    id: 'rohit',
    name: 'Rohit Prasad (Technical & AI/ML)',
    description: 'Alexa Head Scientist. Specialist in AI/ML systems, natural language processing, deep learning pipelines, and core coding questions.',
    expertise: ['AI/ML Systems', 'Neural Networks', 'NLP / LLMs', 'Technical Coding'],
    icon: 'Code',
    avatar_color: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'allie',
    name: 'Allie Miller (Resume & Career)',
    description: 'Top AI brand strategist and tech advisor. Reviews resumes, optimizes ATS parsing, and helps map transition roadmaps.',
    expertise: ['ATS Optimization', 'Resume Polish', 'Career Transition', 'Brand Building'],
    icon: 'FileText',
    avatar_color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'blaise',
    name: 'Blaise Agüera y Arcas (AI Research)',
    description: 'VP & Distinguished Scientist at Google AI. Diagnoses machine learning models, project architectures, and academic research methodologies.',
    expertise: ['AI Architectures', 'Neural Computation', 'Project Diagnostics', 'Research Papers'],
    icon: 'Brain',
    avatar_color: 'from-teal-500 to-emerald-500'
  },
  {
    id: 'aarthi',
    name: 'Aarthi Subramanian (HR & Communication)',
    description: 'Experienced technology executive. Focuses on situational leadership, behavioral STAR framework, and executive presence.',
    expertise: ['Behavioral STAR method', 'Executive Presence', 'Conflict Resolution', 'Leadership Values'],
    icon: 'User',
    avatar_color: 'from-amber-500 to-orange-500'
  },
  {
    id: 'jeff',
    name: 'Jeff Dean (System Design & Scale)',
    description: 'Chief Scientist at Google AI. Reviews internet-scale distributed systems, low-latency design patterns, and database scaling.',
    expertise: ['Distributed Systems', 'MapReduce/Bigtable scale', 'Scalability Reviews', 'Low-Latency Design'],
    icon: 'Layers',
    avatar_color: 'from-red-500 to-rose-600'
  }
];

const coachGreetings: Record<string, string> = {
  rohit: "Greetings, Rohit Prasad here. 💻 As a tech and AI/ML coach, I focus on how you translate complex concepts into scalable systems and algorithms. What technical topic or AI/ML system would you like to build or practice today?",
  allie: "Hi, Allie Miller here! 📄 I evaluate resumes, career branding, and AI job strategies. Let's make sure your portfolio highlights business impact and ATS alignment. What target roles or bullet points are we looking at today?",
  blaise: "Hello! Blaise Agüera y Arcas here. 🧠 My focus is machine learning research, neural architectures, and computational logic. Paste your project specifications or research abstract, and let's critique it.",
  aarthi: "Hi, Aarthi Subramanian here. 🤝 In corporate engineering settings, soft skills, communication, and situational leadership determine your leverage. Let's practice behavioral questions using the STAR framework.",
  jeff: "Jeff Dean here. ⚙️ Let's design distributed infrastructure. If you're building storage clusters, MapReduce systems, low-latency cache, or global datastores, let's identify your bottle-necks. What are we scaling today?"
};

const coachSuggestions: Record<string, { label: string; prompt: string }[]> = {
  rohit: [
    { label: '🤖 Deep Learning', prompt: 'Explain the key differences in Transformer self-attention compared to recurrent systems.' },
    { label: '💻 Coding Prep', prompt: 'Give me a mock technical question regarding NLP text classification.' },
    { label: '⚙️ Core Algorithms', prompt: 'How do you optimize gradient descent computations for large-scale production training?' }
  ],
  allie: [
    { label: '📄 ATS Checklist', prompt: 'What are the main mistakes engineers make that cause resumes to fail ATS parsing?' },
    { label: '🔥 Impact Bullets', prompt: 'How do I rewrite a resume line about API development to emphasize business impact?' },
    { label: '🚀 AI Transition', prompt: 'What skills should a traditional software engineer study to switch to an AI/ML role?' }
  ],
  blaise: [
    { label: '🧠 Neural Computation', prompt: 'Explain the computational constraints and memory access patterns of deep neural models.' },
    { label: '📄 Research Critique', prompt: 'What validation methodologies are critical to prove an AI research hypothesis?' },
    { label: '⚡ Model Diagnostics', prompt: 'How do you diagnose and debug vanishing/exploding gradients during training?' }
  ],
  aarthi: [
    { label: '🗣️ STAR Framework', prompt: 'Walk me through a behavioral mock question and evaluate my answer using the STAR structure.' },
    { label: '💡 Conflict Handling', prompt: 'How should I answer a question about handling disagreement on architectural design with a senior engineer?' },
    { label: '💎 Leadership Values', prompt: 'What metrics of executive presence and clear communication do directors look for in interviews?' }
  ],
  jeff: [
    { label: '📊 System Scaling', prompt: 'How should we partition and shard a database expected to handle 100k writes per second?' },
    { label: '💾 Caching Strategies', prompt: 'What cache eviction patterns and architectures do you recommend to reduce tail latencies?' },
    { label: '🔌 low-latency Design', prompt: 'Explain how to design a distributed message queue to handle network partitions gracefully.' }
  ]
};

const Chatbot: React.FC = () => {
  const { isDark } = useTheme();
  
  // State
  const [coaches, setCoaches] = useState<CoachProfile[]>(defaultCoaches);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('rohit');
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});

  
  // Unique session ID for character.ai tracking
  const [sessionId] = useState<string>(() => `session_${Math.random().toString(36).substr(2, 9)}`);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load coaches on mount
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const list = await interviewApi.getCoaches();
        if (list && list.length > 0) {
          setCoaches(list);
        }
      } catch (error) {
        console.error("Failed to load coaches from API, using defaults:", error);
      }
    };
    fetchCoaches();
  }, []);

  // Set active conversations greeting if empty
  useEffect(() => {
    if (!conversations[selectedCoachId]) {
      const initialGreeting: Message = {
        id: `greeting_${selectedCoachId}`,
        role: 'assistant',
        content: coachGreetings[selectedCoachId] || "Hi! I'm your AI Interview Coach 👋 What would you like to work on today?",
        timestamp: new Date(),
      };
      setConversations(prev => ({
        ...prev,
        [selectedCoachId]: [initialGreeting]
      }));
    }
  }, [selectedCoachId, conversations]);

  // Scroll to bottom on updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, selectedCoachId, isTyping]);

  const activeMessages = conversations[selectedCoachId] || [];
  const activeCoach = coaches.find(c => c.id === selectedCoachId) || defaultCoaches[0];

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    
    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    
    // Optimistic Update User Message
    setConversations(prev => ({
      ...prev,
      [selectedCoachId]: [...(prev[selectedCoachId] || []), userMsg]
    }));
    setInput('');
    setIsTyping(true);

    try {
      // API call to Character.AI endpoint
      const response = await interviewApi.sendCoachMessage(selectedCoachId, {
        session_id: sessionId,
        message: text.trim()
      });

      const assistantMsg: Message = {
        id: `coach_${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
      };

      setConversations(prev => ({
        ...prev,
        [selectedCoachId]: [...(prev[selectedCoachId] || []), assistantMsg]
      }));
    } catch (error) {
      console.error("Coach message dispatch failed:", error);
      // Fallback display message inside chat
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: "⚠️ **System Notice**: Communication with Character.AI service failed. Let me help you in local mode:\n\nThat is a crucial area to check! Let's build your strategy. Can you expand on your background or target role?",
        timestamp: new Date(),
      };
      setConversations(prev => ({
        ...prev,
        [selectedCoachId]: [...(prev[selectedCoachId] || []), errorMsg]
      }));
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = async () => {
    const confirmClear = window.confirm("Are you sure you want to clear the conversation history with this coach?");
    if (!confirmClear) return;

    setIsTyping(true);
    try {
      await interviewApi.resetCoachChat(selectedCoachId, { session_id: sessionId });
      
      const newGreeting: Message = {
        id: `greeting_reset_${selectedCoachId}_${Date.now()}`,
        role: 'assistant',
        content: coachGreetings[selectedCoachId] || "Conversation reset. How can I help you now?",
        timestamp: new Date(),
      };

      setConversations(prev => ({
        ...prev,
        [selectedCoachId]: [newGreeting]
      }));
      setNotice('Conversation history reset.');
    } catch (error) {
      console.error("Failed to reset chat on backend:", error);
      // Reset locally anyway
      setConversations(prev => ({
        ...prev,
        [selectedCoachId]: [{
          id: `greeting_local_${Date.now()}`,
          role: 'assistant',
          content: coachGreetings[selectedCoachId] || "Hi! Let's start fresh.",
          timestamp: new Date(),
        }]
      }));
      setNotice('Conversation reset locally.');
    } finally {
      setIsTyping(false);
      window.setTimeout(() => setNotice(null), 2000);
    }
  };

  const handleCopy = async (message: Message) => {
    await copyText(message.content);
    setNotice('Copied response.');
    window.setTimeout(() => setNotice(null), 1800);
  };

  const handleFeedback = (messageId: string, value: 'up' | 'down') => {
    setFeedback(prev => ({ ...prev, [messageId]: value }));
    setNotice(value === 'up' ? 'Marked as helpful.' : 'Feedback saved.');
    window.setTimeout(() => setNotice(null), 1800);
  };

  const handleFileAttach = (file: File) => {
    setInput(prev => `${prev}${prev ? '\n' : ''}Attached context from ${file.name}: `);
    setNotice('Attachment context drafted.');
    window.setTimeout(() => setNotice(null), 1800);
  };

  const handleMicPrompt = () => {
    setInput(prev => prev || 'Help me practice answering this out loud: ');
    inputRef.current?.focus();
    setNotice('Voice practice context generated.');
    window.setTimeout(() => setNotice(null), 2200);
  };

  const formatTime = (d: Date) => {
    const dateObj = d instanceof Date ? d : new Date(d);
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Escape HTML and support markdown bold
      const formatted = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return <p key={i} className="mb-1.5 last:mb-0" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  // Styles
  const containerBg = isDark ? 'bg-[#0b0f19]' : 'bg-slate-50';
  const cardBg = isDark ? 'bg-[#151c2e] border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const userBubble = 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white';
  const aiBubble = isDark ? 'bg-[#1e293b] text-slate-100' : 'bg-white text-slate-800 shadow-sm border border-slate-200';
  const inputBg = isDark
    ? 'bg-[#1e293b] border-slate-800 text-slate-200 placeholder-slate-500 focus-within:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus-within:border-indigo-400';
  const intentBtn = isDark
    ? 'border-slate-800 text-slate-300 hover:border-indigo-500/60 hover:bg-indigo-500/10 hover:text-indigo-300'
    : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700';

  const CoachIcon = iconMap[activeCoach.icon] || Brain;

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-8rem)] max-h-[750px] max-w-6xl mx-auto">
      {/* Left Column: Coach Selector List */}
      <div className="w-full lg:w-80 flex flex-col gap-3 flex-shrink-0">
        <h2 className={`text-sm font-bold tracking-wider uppercase mb-1 ${textSecondary}`}>AI Coaching Characters</h2>
        <div className="flex lg:flex-col gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide lg:overflow-y-auto lg:h-full">
          {coaches.map(coach => {
            const SelectedIcon = iconMap[coach.icon] || Brain;
            const isSelected = coach.id === selectedCoachId;
            return (
              <button
                key={coach.id}
                onClick={() => setSelectedCoachId(coach.id)}
                className={`flex-shrink-0 text-left w-[260px] lg:w-full p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex gap-3.5
                  ${isSelected
                    ? isDark 
                      ? 'bg-indigo-600/15 border-indigo-500/80 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/30' 
                      : 'bg-indigo-50/70 border-indigo-400 shadow-md'
                    : isDark
                      ? 'bg-[#151c2e] border-slate-800/80 hover:bg-[#1a233a] hover:border-slate-700'
                      : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${coach.avatar_color} flex items-center justify-center text-white flex-shrink-0 shadow-md`}>
                  <SelectedIcon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm font-bold truncate ${textPrimary}`}>{coach.name.split(' ')[0]}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider
                      ${isSelected
                        ? 'bg-indigo-500/20 text-indigo-400' 
                        : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {coach.id === 'behavioral' ? 'Soft' : coach.id === 'technical' ? 'Hard' : 'Audit'}
                    </span>
                  </div>
                  <p className={`text-[11px] font-medium truncate mt-0.5 ${textSecondary}`}>{coach.name.replace(/.*?\((.*?)\)/, '$1')}</p>
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {coach.expertise.slice(0, 2).map(skill => (
                      <span key={skill} className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Chat window */}
      <div className={`flex-1 flex flex-col rounded-3xl border shadow-xl overflow-hidden ${cardBg}`}>
        {/* Chat Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-150'}`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activeCoach.avatar_color} flex items-center justify-center text-white flex-shrink-0 shadow-md`}>
              <CoachIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className={`text-sm font-extrabold ${textPrimary}`}>{activeCoach.name}</p>
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  c.ai online
                </span>
              </div>
              <p className={`text-xs mt-0.5 line-clamp-1 ${textSecondary}`}>{activeCoach.description}</p>
            </div>
          </div>
          <button
            onClick={clearChat}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer
              ${isDark ? 'border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30' : 'border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300'}`}
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>

        {/* Notice Banner */}
        {notice && (
          <div className={`px-5 py-2.5 border-b text-xs flex items-center gap-2 font-medium ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
            <Sparkles size={13} className="animate-spin" />
            {notice}
          </div>
        )}

        {/* Message Container */}
        <div className={`flex-1 overflow-y-auto px-5 py-5 space-y-4 ${containerBg}`}>
          {activeMessages.map((msg) => (
            <div key={msg.id} className={`flex gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8.5 h-8.5 rounded-xl flex items-center justify-center shadow-md
                ${msg.role === 'assistant'
                  ? `bg-gradient-to-br ${activeCoach.avatar_color}`
                  : isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-250 border border-slate-200'}`}>
                {msg.role === 'assistant'
                  ? <CoachIcon size={14} className="text-white" />
                  : <User size={14} className={isDark ? 'text-slate-300' : 'text-slate-600'} />
                }
              </div>

              {/* Message content bubble */}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm font-normal
                  ${msg.role === 'user'
                    ? `${userBubble} rounded-tr-none`
                    : `${aiBubble} rounded-tl-none`}`}>
                  {formatContent(msg.content)}
                </div>
                <div className="flex items-center gap-2.5 px-1">
                  <span className={`text-[10px] font-medium ${textSecondary}`}>{formatTime(msg.timestamp)}</span>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(msg)}
                        aria-label="Copy response"
                        className={`p-0.5 rounded hover:bg-slate-500/10 transition-all ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'up')}
                        aria-label="Mark response helpful"
                        className={`p-0.5 rounded hover:bg-slate-500/10 transition-all ${feedback[msg.id] === 'up' ? 'text-emerald-400' : isDark ? 'text-slate-600 hover:text-emerald-400' : 'text-slate-300 hover:text-emerald-600'}`}
                      >
                        <ThumbsUp size={11} />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'down')}
                        aria-label="Mark response not helpful"
                        className={`p-0.5 rounded hover:bg-slate-500/10 transition-all ${feedback[msg.id] === 'down' ? 'text-rose-400' : isDark ? 'text-slate-600 hover:text-rose-400' : 'text-slate-300 hover:text-rose-500'}`}
                      >
                        <ThumbsDown size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3.5">
              <div className={`w-8.5 h-8.5 rounded-xl bg-gradient-to-br ${activeCoach.avatar_color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <CoachIcon size={14} className="text-white" />
              </div>
              <div className={`px-4.5 py-3 rounded-2xl rounded-tl-none ${aiBubble}`}>
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestion Prompts */}
        <div className={`px-5 py-3 border-t ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSecondary}`}>Suggested Topics</p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {(coachSuggestions[selectedCoachId] || []).map(btn => (
              <button
                key={btn.label}
                onClick={() => sendMessage(btn.prompt)}
                disabled={isTyping}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 disabled:opacity-40 cursor-pointer ${intentBtn}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat input box */}
        <div className={`p-4 border-t ${isDark ? 'border-slate-800 bg-[#151c2e]' : 'border-slate-200 bg-white'}`}>
          <div className={`flex items-end gap-2.5 px-3 py-2.5 rounded-xl border ${inputBg}`}>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.docx"
              onChange={event => event.target.files?.[0] && handleFileAttach(event.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Attach context file"
              className={`flex-shrink-0 p-1 mb-0.5 hover:text-indigo-500 text-slate-400 hover:bg-slate-500/10 rounded transition-all`}
            >
              <PaperclipIcon size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              placeholder={`Message ${activeCoach.name.split(' ')[0]}...`}
              className="flex-1 bg-transparent outline-none text-sm resize-none max-h-24 min-h-[22px] py-0.5 disabled:opacity-50"
              rows={1}
              style={{ lineHeight: '1.5' }}
            />
            <div className="flex items-center gap-1.5 mb-0.5">
              <button
                onClick={handleMicPrompt}
                aria-label="Add voice practice prompt"
                className={`flex-shrink-0 p-1 hover:text-indigo-500 text-slate-400 hover:bg-slate-500/10 rounded transition-all`}
              >
                <Mic size={16} />
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="flex-shrink-0 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-md cursor-pointer"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
          <div className={`flex items-center justify-between text-[10px] mt-2.5 px-1 ${textSecondary}`}>
            <span className="flex items-center gap-1">
              <AlertCircle size={10} className="text-amber-500" />
              Conversations are private & practice-focused.
            </span>
            <span>
              Press <kbd className="px-1 py-0.5 rounded text-[9px] border border-current font-semibold">↵</kbd> to send
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
