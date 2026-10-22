import type { L10n } from '@/i18n/types';

export interface QuizOption {
  label: L10n;
  /** Explanation shown after answering, for this option. */
  explain: L10n;
  /** Render the label in the mono font (numbers, rates). */
  mono?: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: L10n;
  /** 3 or 4 options. */
  options: QuizOption[];
  /** Index of the correct option. */
  correct: number;
}

export interface ModuleQuiz {
  slug: string;
  /** Exactly four graded questions for the quiz page. */
  quiz: [QuizQuestion, QuizQuestion, QuizQuestion, QuizQuestion];
  /** One ungraded "Kurz geprüft" question at the end of each section. */
  checks: Record<'1' | '2' | '3' | '4', QuizQuestion>;
}

export type QuizView = {
  id: string;
  prompt: string;
  options: { label: string; explain: string; mono: boolean }[];
  correct: number;
};

/** Resolves a question to one language (props for the Quiz island). */
export function viewQuestion(q: QuizQuestion, lang: 'de' | 'en'): QuizView {
  return {
    id: q.id,
    prompt: q.prompt[lang],
    options: q.options.map((o) => ({
      label: o.label[lang],
      explain: o.explain[lang],
      mono: !!o.mono,
    })),
    correct: q.correct,
  };
}
