
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  subject: string;
  explanation?: string;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
}

export interface FixationData {
  stepByStep: string;
  mainTopic: string;
  fixationQuestions: Question[];
}

export interface SessionResult {
  question: Question;
  userAnswer: number | null;
  isCorrect: boolean;
  timestamp: Date;
  mode: 'AI_GENERATED' | 'OCR';
}

export interface EssayAnalysis {
  score: number;
  competencies: {
    c1: { score: number; feedback: string };
    c2: { score: number; feedback: string };
    c3: { score: number; feedback: string };
    c4: { score: number; feedback: string };
    c5: { score: number; feedback: string };
  };
  generalFeedback: string;
  suggestions: string[];
}

export interface SyllabusTopic {
  id: string;
  name: string;
  weight: number; // 0-100 (80/20 importance)
  status: 'Pendente' | 'Em Progresso' | 'Dominado';
}

export enum AppMode {
  WELCOME = 'WELCOME',
  GOAL_SETTING = 'GOAL_SETTING',
  STUDY_FLOW = 'STUDY_FLOW',
  OCR_SOLVER = 'OCR_SOLVER',
  ESSAY_ANALYSIS = 'ESSAY_ANALYSIS',
  REPORT = 'REPORT'
}
