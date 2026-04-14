
export interface Chapter {
  id: number;
  titleBurmese: string;
  titleEnglish: string;
  summary: string;
  keyPoints: KeyPoint[];
  visualType: VisualType;
  content: string; // The raw or summarized text from the OCR
}

export interface KeyPoint {
  concept: string;
  definition: string;
  icon?: string;
}

export enum VisualType {
  Tree = 'tree',
  Flow = 'flow',
  Comparison = 'comparison',
  Steps = 'steps',
  Cycle = 'cycle',
  Clock = 'clock'
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number; // 0-3 index
  explanation: string;
}

export interface Quiz {
  chapterId: number;
  questions: QuizQuestion[];
}

export interface Course {
  id: string;
  titleBurmese: string;
  titleEnglish: string;
  descriptionBurmese: string;
  descriptionEnglish: string;
  chapters: Chapter[];
}
