export interface Question {
  question: string;
  options?: string[];
  correctAnswers: string[];
  explanation?: string;
  isDiagramBased?: boolean;
  pageNumber?: number;
  diagramBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export enum AppState {
  IDLE,
  JEE_TIMER_SETUP,
  PROCESSING,
  QUIZ_READY,
  QUIZ,
  RESULTS,
}

export type QuizMode = 'PRACTICE' | 'JEE';

export type QuestionStatus = 'answered' | 'notAnswered' | 'marked' | 'answeredAndMarked' | 'notVisited';