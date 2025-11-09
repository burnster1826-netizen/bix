
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

export interface SavedFile {
  name: string;
}

export interface SavedQuiz {
  id: string; // Unique identifier for the quiz
  name: string;
  createdAt: string;
  quiz: Question[];
  pageImages: string[];
  files: SavedFile[];
}

export enum AppState {
  IDLE,
  JEE_TIMER_SETUP,
  PROCESSING,
  QUIZ_READY,
  QUIZ,
  RESULTS,
  DRIVE, // Added state for viewing saved quizzes
}

export type QuizMode = 'PRACTICE' | 'JEE';

export type QuestionStatus = 'answered' | 'notAnswered' | 'marked' | 'answeredAndMarked' | 'notVisited';