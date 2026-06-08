import type {
  AnswerAnalysis,
  BackendInterviewSession,
  InterviewReport,
  InterviewReportRequest,
  InterviewStartRequest,
  ResumeAnalysisResponse,
  TranscriptRequest,
  CoachProfile,
  CoachChatRequest,
  CoachChatResponse,
} from '../types';

const viteEnv = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env;
const API_BASE_URL = viteEnv?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type RequestOptions = {
  signal?: AbortSignal;
};

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(typeof window !== 'undefined' && localStorage.getItem('intervai-token')
        ? { Authorization: `Bearer ${localStorage.getItem('intervai-token')}` }
        : {}),
    },
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
  } catch {
    return response.statusText;
  }
  return response.statusText;
}

export const interviewApi = {
  startInterview(payload: InterviewStartRequest, options?: RequestOptions) {
    return requestJson<BackendInterviewSession>(
      '/api/interviews',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      options,
    );
  },

  analyzeText(payload: TranscriptRequest, options?: RequestOptions) {
    return requestJson<AnswerAnalysis>(
      '/api/analyze-text',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      options,
    );
  },

  async analyzeAudio(question: TranscriptRequest['question'], audio: Blob, options?: RequestOptions) {
    const formData = new FormData();
    formData.append('question_json', JSON.stringify(question));
    formData.append('audio', audio, 'answer.webm');

    const response = await fetch(`${API_BASE_URL}/api/analyze-audio`, {
      method: 'POST',
      body: formData,
      signal: options?.signal,
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message || `Request failed with ${response.status}`);
    }

    return response.json() as Promise<AnswerAnalysis>;
  },

  createReport(payload: InterviewReportRequest, options?: RequestOptions) {
    return requestJson<InterviewReport>(
      '/api/reports',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      options,
    );
  },

  async analyzeResume(
    payload: { candidateName: string; resume: File; jobDescription?: string },
    options?: RequestOptions,
  ) {
    const formData = new FormData();
    formData.append('candidate_name', payload.candidateName || 'Candidate');
    formData.append('job_description', payload.jobDescription ?? '');
    formData.append('resume', payload.resume);

    const response = await fetch(`${API_BASE_URL}/api/resumes/analyze`, {
      method: 'POST',
      body: formData,
      signal: options?.signal,
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message || `Request failed with ${response.status}`);
    }

    return response.json() as Promise<ResumeAnalysisResponse>;
  },

  getCoaches(options?: RequestOptions) {
    return requestJson<CoachProfile[]>('/api/coaches', { method: 'GET' }, options);
  },

  sendCoachMessage(coachId: string, payload: CoachChatRequest, options?: RequestOptions) {
    return requestJson<CoachChatResponse>(
      `/api/coaches/${coachId}/chat`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      options,
    );
  },

  resetCoachChat(coachId: string, payload: { session_id: string }, options?: RequestOptions) {
    return requestJson<{ status: string }>(
      `/api/coaches/${coachId}/reset`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      options,
    );
  },
};

