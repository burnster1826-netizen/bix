export interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

export enum AppState {
  IDLE,
  JEE_TIMER_SETUP,
  PROCESSING,
  QUIZ,
  RESULTS,
}

export type QuizMode = 'PRACTICE' | 'JEE';

export type QuestionStatus = 'answered' | 'notAnswered' | 'marked' | 'answeredAndMarked' | 'notVisited';