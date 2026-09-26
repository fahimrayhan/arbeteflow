// export type View = 'resume' | 'coverletter' | 'chat' | 'tracker' | 'settings';

// export type ChatMode = 'resume' | 'career' | 'jobcritic';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  location: string;
  status: JobStatus;
  salary?: string;
  appliedDate: string;
  deadline?: string;
  notes: string;
  url?: string;
  jobDescription?: string;
}

export type View =
  | 'resume'
  | 'coverletter'
  | 'chat'
  | 'interview'
  | 'finder'
  | 'tracker'
  | 'settings';

export interface JobMarketMatch {
  similarity_distance: number;
  similarity_score: number;
  metadata: {
    id?: string;
    title?: string;
    company?: string;
    location?: string;
    url?: string;
    [key: string]: unknown;
  };
  document: string;
}

export type ChatMode =
  | 'resume'
  | 'career'
  | 'jobcritic';

export type InterviewType =
  | 'behavioral'
  | 'technical'
  | 'mixed'
  | 'case';

export type InterviewDifficulty =
  | 'junior'
  | 'mid'
  | 'senior';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type JobStatus =
  | 'bookmarked'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected';

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  location: string;
  status: JobStatus;
  salary?: string;
  appliedDate: string;
  deadline?: string;
  notes: string;
  url?: string;
  jobDescription?: string;
}

/* â”€â”€â”€ Multi-provider AI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  bookmarked: { label: 'Bookmarked', color: '#909090', bg: '#1A1A1A', border: '#282828' },
  applied:    { label: 'Applied',    color: '#A3E635', bg: '#141900', border: '#2A3300' },
  screening:  { label: 'Screening',  color: '#FBBF24', bg: '#1A1200', border: '#352400' },
  interview:  { label: 'Interview',  color: '#60A5FA', bg: '#091420', border: '#0A2040' },
  offer:      { label: 'Offer',      color: '#4ADE80', bg: '#061410', border: '#0A2A1A' },
  rejected:   { label: 'Rejected',   color: '#F87171', bg: '#1A0808', border: '#330E0E' },
};
