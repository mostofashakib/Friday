export type InterviewType = "behavioral" | "technical" | "general";

export interface Session {
  id: string;
  user_id: string;
  interview_type: InterviewType;
  role: string | null;
  difficulty: number;
  status: "active" | "completed";
  turn_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: "interviewer" | "user" | "coach";
  content: string;
  competency: string | null;
  score: number | null;
  turn_number: number;
  is_followup: boolean;
  created_at: string;
}

export interface Grading {
  score: number;
  competency: string;
  feedback: string;
  strengths: string[];
  gaps: string[];
}

export interface TurnResponse {
  session_complete: boolean;
  grading: Grading;
  coaching_note: string;
  question: string | null;
  tts_audio: string | null;
  turn: number;
  difficulty: number;
  is_followup: boolean;
}

export interface StartResponse {
  question: string;
  tts_audio: string | null;
  turn: number;
  difficulty: number;
  session_complete: boolean;
}

export interface CompetencyScore {
  competency: string;
  score: number;
  attempts: number;
}

export interface ReportResponse {
  session: Session;
  overall_score: number;
  competency_scores: CompetencyScore[];
  coaching_notes: string[];
  messages: Message[];
  total_turns: number;
}
