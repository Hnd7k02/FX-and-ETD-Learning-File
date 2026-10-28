/** Quiz registry: every file src/content/quiz/<slug>.ts exports `quiz: ModuleQuiz`. */
import type { ModuleQuiz } from './types';

const files = import.meta.glob<{ quiz: ModuleQuiz }>('./[0-9][0-9]-*.ts', { eager: true });

export const QUIZZES: Record<string, ModuleQuiz> = {};
for (const mod of Object.values(files)) {
  if (mod.quiz) QUIZZES[mod.quiz.slug] = mod.quiz;
}

export function getQuiz(slug: string): ModuleQuiz | undefined {
  return QUIZZES[slug];
}

export type { ModuleQuiz, QuizQuestion, QuizOption, QuizView } from './types';
export { viewQuestion } from './types';
