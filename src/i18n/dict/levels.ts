import { defineDict } from '../types';

/** Riskometer levels (always shown with a label, never colour alone). */
export const levels = defineDict({
  de: {
    'level.1': 'Ruhig',
    'level.2': 'Normal',
    'level.3': 'Erhöht',
    'level.4': 'Hoch',
    'level.5': 'Extrem',
  },
  en: {
    'level.1': 'Calm',
    'level.2': 'Normal',
    'level.3': 'Elevated',
    'level.4': 'High',
    'level.5': 'Extreme',
  },
});

export type LevelIndex = 1 | 2 | 3 | 4 | 5;
export const LEVEL_KEYS = ['level.1', 'level.2', 'level.3', 'level.4', 'level.5'] as const;
export const LEVEL_COLORS: Record<LevelIndex, string> = {
  1: 'var(--ff-level-1)',
  2: 'var(--ff-level-2)',
  3: 'var(--ff-level-3)',
  4: 'var(--ff-level-4)',
  5: 'var(--ff-level-5)',
};
