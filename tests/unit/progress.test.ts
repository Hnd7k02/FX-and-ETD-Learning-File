import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  doneModules,
  emptyProgress,
  firstOpen,
  isQuizPassed,
  loadProgress,
  markSection,
  moduleStatus,
  moduleUnits,
  onProgress,
  overallPercent,
  parseProgress,
  recordQuiz,
  resetProgress,
  resumeTarget,
  saveProgress,
  setLast,
  updateProgress,
} from '@/lib/progress';
import { MODULES, PROGRESS_UNITS } from '@/data/modules';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe('progress model', () => {
  it('has 45 units: 9 modules × 4 sections + 9 quizzes', () => {
    expect(MODULES).toHaveLength(9);
    expect(PROGRESS_UNITS).toBe(45);
  });

  it('marks sections idempotently', () => {
    let p = emptyProgress();
    p = markSection(p, '05-greeks', '1');
    const same = markSection(p, '05-greeks', '1');
    expect(same).toBe(p);
    expect(moduleUnits(p, '05-greeks')).toBe(1);
  });

  it('computes overall percent over 45 units', () => {
    let p = emptyProgress();
    for (const s of ['1', '2', '3', '4'] as const) p = markSection(p, '01-spot', s);
    p = recordQuiz(p, '01-spot', 3, 4);
    expect(overallPercent(p)).toBe(Math.round((5 / 45) * 100));
    expect(doneModules(p)).toBe(1);
  });

  it('passes a quiz from 3 of 4 and keeps the best score', () => {
    let p = recordQuiz(emptyProgress(), '05-greeks', 2, 4);
    expect(isQuizPassed(p, '05-greeks')).toBe(false);
    p = recordQuiz(p, '05-greeks', 3, 4);
    expect(isQuizPassed(p, '05-greeks')).toBe(true);
    p = recordQuiz(p, '05-greeks', 1, 4);
    expect(p.quiz['05-greeks']).toEqual({ best: 3, total: 4, passed: true });
  });

  it('derives module status', () => {
    let p = emptyProgress();
    expect(moduleStatus(p, '05-greeks')).toEqual({ state: 'open', percent: 0 });
    p = markSection(p, '05-greeks', '1');
    p = markSection(p, '05-greeks', '2');
    expect(moduleStatus(p, '05-greeks')).toEqual({ state: 'current', percent: 40 });
    p = recordQuiz(p, '05-greeks', 4, 4);
    expect(moduleStatus(p, '05-greeks')).toEqual({ state: 'done', percent: 100 });
  });

  it('finds the first open unit along the path', () => {
    let p = emptyProgress();
    expect(firstOpen(p)).toEqual({ slug: '01-spot', section: '1' });
    for (const s of ['1', '2', '3', '4'] as const) p = markSection(p, '01-spot', s);
    expect(firstOpen(p)).toEqual({ slug: '01-spot', section: 'quiz' });
    p = recordQuiz(p, '01-spot', 4, 4);
    expect(firstOpen(p)).toEqual({ slug: '02-forward', section: '1' });
    for (const m of MODULES) {
      for (const s of ['1', '2', '3', '4'] as const) p = markSection(p, m.slug, s);
      p = recordQuiz(p, m.slug, 4, 4);
    }
    expect(firstOpen(p)).toEqual({ slug: '01-spot', section: '1' });
    expect(overallPercent(p)).toBe(100);
  });

  it('resumes in the last visited module', () => {
    let p = emptyProgress();
    expect(resumeTarget(p)).toEqual({ slug: '01-spot', section: '1', started: false });
    p = markSection(p, '05-greeks', '1');
    p = setLast(p, '05-greeks', '2');
    expect(setLast(p, '05-greeks', '2')).toBe(p);
    expect(resumeTarget(p)).toEqual({ slug: '05-greeks', section: '2', started: true });
    for (const s of ['2', '3', '4'] as const) p = markSection(p, '05-greeks', s);
    expect(resumeTarget(p)).toEqual({ slug: '05-greeks', section: 'quiz', started: true });
    p = recordQuiz(p, '05-greeks', 4, 4);
    expect(resumeTarget(p).slug).toBe('01-spot');
  });

  it('parses stored data defensively', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('not json')).toEqual(emptyProgress());
    expect(parseProgress('{"v":2}')).toEqual(emptyProgress());
    const raw = JSON.stringify({
      v: 1,
      sections: { '01-spot/1': true, bad: 'x' },
      quiz: { '01-spot': { best: 3, total: 4, passed: false }, x: { best: 'a' } },
      last: { slug: '01-spot', section: '2' },
    });
    const p = parseProgress(raw);
    expect(p.sections).toEqual({ '01-spot/1': true });
    expect(p.quiz).toEqual({ '01-spot': { best: 3, total: 4, passed: true } });
    expect(p.last).toEqual({ slug: '01-spot', section: '2' });
  });
});

describe('progress storage', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it('saves, loads, updates, notifies and resets', () => {
    const seen: number[] = [];
    const off = onProgress((p) => seen.push(Object.keys(p.sections).length));
    expect(loadProgress()).toEqual(emptyProgress());
    saveProgress(markSection(emptyProgress(), '01-spot', '1'));
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toContain('01-spot/1');
    updateProgress((p) => markSection(p, '01-spot', '2'));
    updateProgress((p) => p);
    expect(Object.keys(loadProgress().sections)).toHaveLength(2);
    resetProgress();
    expect(loadProgress()).toEqual(emptyProgress());
    off();
    expect(seen).toEqual([1, 2, 0]);
  });
});
