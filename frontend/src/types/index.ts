export type Theme = 'dark' | 'light';

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  badge?: string;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  typing?: boolean;
};

export type InterviewSession = {
  id: string;
  role: string;
  company: string;
  date: string;
  score: number;
  status: 'completed' | 'in-progress' | 'scheduled';
  duration: string;
};

export type StatCard = {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: string;
};

export type InterviewLevel = 'entry' | 'mid' | 'senior';

export type InterviewQuestion = {
  id: string;
  text: string;
  competency: string;
  expected_keywords: string[];
};

export type CandidateProfile = {
  candidate_name: string;
  role: string;
  level: InterviewLevel;
  resume_id?: string | null;
};

export type InterviewStartRequest = CandidateProfile & {
  question_count: number;
};

export type BackendInterviewSession = {
  session_id: string;
  profile: CandidateProfile;
  questions: InterviewQuestion[];
  created_at: string;
};

export type ScoreBreakdown = {
  relevance: number;
  fluency: number;
  confidence: number;
  clarity: number;
  emotional_tone: number;
};

export type AnswerAnalysis = {
  question_id: string;
  question: string;
  transcript: string;
  scores: ScoreBreakdown;
  overall_score: number;
  sentiment: string;
  strengths: string[];
  improvements: string[];
  feedback: string;
};

export type TranscriptRequest = {
  session_id?: string | null;
  question: InterviewQuestion;
  transcript: string;
  audio_features?: Record<string, number>;
  resume_id?: string | null;
};

export type InterviewReportRequest = {
  session: BackendInterviewSession;
  analyses: AnswerAnalysis[];
};

export type InterviewReport = {
  session_id: string;
  candidate_name: string;
  role: string;
  resume_id?: string | null;
  overall_score: number;
  recommendation: string;
  generated_at: string;
  category_scores: ScoreBreakdown;
  analyses: AnswerAnalysis[];
  summary: string;
};

export type ResumeScoreCard = {
  label: string;
  value: number;
  description: string;
};

export type ResumeSuggestion = {
  type: 'success' | 'warning' | 'error';
  title: string;
  detail: string;
};

export type ResumeAnalysisResponse = {
  resume_id: string;
  candidate_name: string;
  file_name: string;
  ats_score: number;
  keyword_match_score: number;
  formatting_score: number;
  impact_score: number;
  section_score: number;
  matched_skills: string[];
  missing_skills: string[];
  extracted_skills: string[];
  summary: string;
  score_cards: ResumeScoreCard[];
  suggestions: ResumeSuggestion[];
};

export type CoachProfile = {
  id: string;
  name: string;
  description: string;
  expertise: string[];
  icon: string;
  avatar_color: string;
};

export type CoachChatRequest = {
  session_id: string;
  message: string;
};

export type CoachChatResponse = {
  coach_id: string;
  reply: string;
};

