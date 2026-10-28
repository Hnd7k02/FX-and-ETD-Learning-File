/**
 * Learning progress, stored only in the browser (localStorage key "ff-progress-v1").
 * No tracking, no server. Pure functions plus a thin storage adapter.
 *
 * - A section counts as done once its end has been visible (IntersectionObserver).
 * - A module counts as done once its quiz is passed (at least 3 of 4).
 * - Overall progress = (done sections + passed quizzes) / 45.
 */
import { MODULES, PROGRESS_UNITS } from '@/data/modules';
import type { SectionKey } from '@/i18n/routes';

export const STORAGE_KEY = 'ff-progress-v1';
export const QUIZ_PASS = 3;
export const CONTENT_SECTIONS = ['1', '2', '3', '4'] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

export interface QuizRecord {
  best: number;
  total: number;
  passed: boolean;
}

export interface Progress {
  v: 1;
  /** Done sections, keyed "05-greeks/2". */
  sections: Record<string, true>;
  /** Quiz results per module slug. */
  quiz: Record<string, QuizRecord>;
  /** Last visited section. */
  last?: { slug: string; section: SectionKey };
}

export const emptyProgress = (): Progress => ({ v: 1, sections: {}, quiz: {} });

export const sectionKey = (slug: string, section: ContentSection) => `${slug}/${section}`;

export function parseProgress(raw: string | null | undefined): Progress {
  if (!raw) return emptyProgress();
  try {
    const p = JSON.parse(raw) as Partial<Progress>;
    if (!p || p.v !== 1 || typeof p.sections !== 'object' || typeof p.quiz !== 'object') {
      return emptyProgress();
    }
    const out: Progress = { v: 1, sections: {}, quiz: {} };
    for (const [k, v] of Object.entries(p.sections ?? {})) if (v === true) out.sections[k] = true;
    for (const [k, q] of Object.entries(p.quiz ?? {})) {
      if (q && typeof q.best === 'number' && typeof q.total === 'number') {
        out.quiz[k] = { best: q.best, total: q.total, passed: q.best >= QUIZ_PASS };
      }
    }
    if (p.last && typeof p.last.slug === 'string' && typeof p.last.section === 'string') {
      out.last = { slug: p.last.slug, section: p.last.section };
    }
    return out;
  } catch {
    return emptyProgress();
  }
}

export function markSection(p: Progress, slug: string, section: ContentSection): Progress {
  const key = sectionKey(slug, section);
  if (p.sections[key]) return p;
  return { ...p, sections: { ...p.sections, [key]: true } };
}

export function setLast(p: Progress, slug: string, section: SectionKey): Progress {
  if (p.last?.slug === slug && p.last.section === section) return p;
  return { ...p, last: { slug, section } };
}

export function recordQuiz(p: Progress, slug: string, score: number, total: number): Progress {
  const prev = p.quiz[slug];
  const best = Math.max(prev?.best ?? 0, score);
  return { ...p, quiz: { ...p.quiz, [slug]: { best, total, passed: best >= QUIZ_PASS } } };
}

export function isSectionDone(p: Progress, slug: string, section: ContentSection): boolean {
  return p.sections[sectionKey(slug, section)] === true;
}

export function isQuizPassed(p: Progress, slug: string): boolean {
  return p.quiz[slug]?.passed === true;
}

/** Done units of one module (0..5). */
export function moduleUnits(p: Progress, slug: string): number {
  const s = CONTENT_SECTIONS.filter((k) => isSectionDone(p, slug, k)).length;
  return s + (isQuizPassed(p, slug) ? 1 : 0);
}

export type ModuleState = 'done' | 'current' | 'open';

export interface ModuleStatus {
  state: ModuleState;
  /** Percent of the module's 5 units, 0..100. */
  percent: number;
}

/** A module is done when its quiz is passed; in progress when any unit is done. */
export function moduleStatus(p: Progress, slug: string): ModuleStatus {
  const units = moduleUnits(p, slug);
  const percent = Math.round((units / 5) * 100);
  if (isQuizPassed(p, slug)) return { state: 'done', percent: 100 };
  if (units > 0) return { state: 'current', percent };
  return { state: 'open', percent: 0 };
}

/** Overall progress in percent (0..100), rounded. */
export function overallPercent(p: Progress): number {
  let units = 0;
  for (const m of MODULES) units += moduleUnits(p, m.slug);
  return Math.round((units / PROGRESS_UNITS) * 100);
}

export function doneModules(p: Progress): number {
  return MODULES.filter((m) => isQuizPassed(p, m.slug)).length;
}

/** First open unit along the path: the target of "Weiterlernen". */
export function firstOpen(p: Progress): { slug: string; section: SectionKey } {
  for (const m of MODULES) {
    for (const s of CONTENT_SECTIONS) {
      if (!isSectionDone(p, m.slug, s)) return { slug: m.slug, section: s };
    }
    if (!isQuizPassed(p, m.slug)) return { slug: m.slug, section: 'quiz' };
  }
  const first = MODULES[0]!;
  return { slug: first.slug, section: '1' };
}

/** Module shown on "Weiter, wo du warst": the last visited one, else the first open one. */
export function resumeTarget(p: Progress): { slug: string; section: SectionKey; started: boolean } {
  const started = Object.keys(p.sections).length > 0 || Object.keys(p.quiz).length > 0;
  if (p.last && MODULES.some((m) => m.slug === p.last!.slug) && !isQuizPassed(p, p.last.slug)) {
    // continue in the last module at its first open unit
    const slug = p.last.slug;
    for (const s of CONTENT_SECTIONS) {
      if (!isSectionDone(p, slug, s)) return { slug, section: s, started };
    }
    return { slug, section: 'quiz', started };
  }
  return { ...firstOpen(p), started };
}

/* ---------- Storage adapter (browser only) ---------- */

type Listener = (p: Progress) => void;
const listeners = new Set<Listener>();

export function loadProgress(): Progress {
  try {
    return parseProgress(globalThis.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable (private mode); progress then lives for this page only */
  }
  for (const l of listeners) l(p);
}

export function updateProgress(fn: (p: Progress) => Progress): Progress {
  const before = loadProgress();
  const after = fn(before);
  if (after !== before) saveProgress(after);
  return after;
}

export function resetProgress(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(emptyProgress());
}

export function onProgress(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
