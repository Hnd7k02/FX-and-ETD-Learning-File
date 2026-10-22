/**
 * Quiz island (B-Modul quiz card).
 * mode "check": one ungraded "Kurz geprüft" question at the end of a section (D-18).
 * mode "quiz":  the module's four graded questions, one at a time, then a result screen;
 *               the score is stored with recordQuiz (pass from 3 of 4), the best result is shown.
 * Options are real buttons with aria-pressed; after answering the correct option turns green,
 * a wrong pick red, and the explanation of the picked option (plus the correct one) is announced
 * in a live region. Styles: .qz-* in src/components/module/ModuleMain.astro.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { QuizView } from '@/content/quiz/types';
import { common } from '@/i18n/dict/common';
import { moduleui } from '@/i18n/dict/moduleui';
import { translator, type Lang } from '@/i18n/types';
import { QUIZ_PASS, loadProgress, recordQuiz, setLast, updateProgress } from '@/lib/progress';

export interface QuizProps {
  lang: Lang;
  mode: 'check' | 'quiz';
  slug: string;
  questions: QuizView[];
}

const KEYS = ['A', 'B', 'C', 'D'] as const;

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8.4L6.6 11.4L12.5 4.8" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5" />
    </svg>
  );
}

export default function Quiz({ lang, mode, slug, questions }: QuizProps) {
  const t = translator(common, lang);
  const tm = translator(moduleui, lang);
  const total = questions.length;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [round, setRound] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const q = questions[index];
  const answered = picked !== null;
  const score = results.filter(Boolean).length;
  const titleId = `qz-${mode}-${slug}`;

  // Quiz page: remember the visit and load the best result so far.
  useEffect(() => {
    if (mode !== 'quiz') return;
    const p = updateProgress((x) => setLast(x, slug, 'quiz'));
    const rec = p.quiz[slug];
    if (rec) setBest(rec.best);
  }, [mode, slug]);

  // After "next question", "see result" or "try again", move focus to the new heading.
  useEffect(() => {
    if (moved.current) titleRef.current?.focus();
  }, [index, finished, round]);

  if (!q) return null;

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    setResults((r) => [...r, i === q.correct]);
  };

  const next = () => {
    moved.current = true;
    if (index + 1 < total) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    const prev = loadProgress().quiz[slug]?.best ?? null;
    const p = updateProgress((x) => recordQuiz(x, slug, score, total));
    setBest(p.quiz[slug]?.best ?? score);
    setNewBest(score > 0 && (prev === null || score > prev));
    setFinished(true);
  };

  const retry = () => {
    moved.current = true;
    setIndex(0);
    setPicked(null);
    setResults([]);
    setFinished(false);
    setNewBest(false);
    setRound((r) => r + 1);
  };

  if (finished) {
    const passed = score >= QUIZ_PASS;
    return (
      <section
        class="qz"
        aria-labelledby={titleId}
        data-quiz={mode}
        data-state="result"
        data-passed={passed ? 'true' : 'false'}
      >
        <div class="qz-result" data-ok={passed ? 'true' : 'false'}>
          <h3 id={titleId} class="qz-title" ref={titleRef} tabIndex={-1}>
            {tm('quiz.resultTitle')}
          </h3>
          <p class="qz-score" data-score={score}>
            {t('quiz.result', { score, total })}
          </p>
          <p class="qz-verdict" role="status">
            {passed ? <CheckIcon /> : null}
            {passed ? t('quiz.passed') : t('quiz.failed')}
          </p>
          <ol class="qz-review" aria-label={tm('quiz.review')}>
            {questions.map((qq, i) => (
              <li key={qq.id} data-ok={results[i] ? 'true' : 'false'}>
                <span class="qz-review-dot">
                  {results[i] ? <CheckIcon /> : <CrossIcon />}
                  <span class="sr-only">
                    {results[i] ? tm('quiz.reviewCorrect') : tm('quiz.reviewWrong')}
                  </span>
                </span>
                <span>{qq.prompt}</span>
              </li>
            ))}
          </ol>
          <p class="qz-best">
            {best !== null ? t('quiz.best', { score: best, total }) : ''}
            {newBest ? ` · ${tm('quiz.newBest')}` : ''}
            {` · ${tm('quiz.passHint', { pass: QUIZ_PASS, total })}`}
          </p>
          <div class="qz-actions">
            <button type="button" class="btn btn-light" onClick={retry}>
              {t('quiz.retry')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const ok = answered && picked === q.correct;

  return (
    <section
      class="qz"
      aria-labelledby={titleId}
      data-quiz={mode}
      data-state={answered ? 'answered' : 'open'}
      data-index={index}
    >
      <div class="qz-head">
        <h3 id={titleId} class="qz-title" ref={titleRef} tabIndex={-1}>
          {mode === 'quiz' ? t('quiz.title', { n: index + 1, total }) : tm('check.title')}
        </h3>
        {mode === 'quiz' ? (
          <ol class="qz-dots" aria-label={tm('quiz.dots')}>
            {questions.map((qq, i) => {
              const state =
                i < results.length
                  ? results[i]
                    ? 'correct'
                    : 'wrong'
                  : i === index
                    ? 'current'
                    : 'open';
              const key =
                state === 'correct'
                  ? 'quiz.dotCorrect'
                  : state === 'wrong'
                    ? 'quiz.dotWrong'
                    : state === 'current'
                      ? 'quiz.dotCurrent'
                      : 'quiz.dotOpen';
              return (
                <li key={qq.id} data-state={state}>
                  <span class="sr-only">{tm(key, { n: i + 1 })}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <span class="qz-hint">{tm('check.hint')}</span>
        )}
      </div>

      <p class="qz-prompt">{q.prompt}</p>

      <div role="group" aria-label={t('quiz.answers')} class="qz-options">
        {q.options.map((o, i) => {
          const state = !answered
            ? 'idle'
            : i === q.correct
              ? 'correct'
              : i === picked
                ? 'wrong'
                : 'idle';
          return (
            <button
              key={`${round}-${q.id}-${i}`}
              type="button"
              class="qz-opt"
              data-state={state}
              data-option={i}
              aria-pressed={picked === i}
              aria-disabled={answered && picked !== i ? 'true' : undefined}
              onClick={() => pick(i)}
            >
              <span class="qz-key" aria-hidden="true">
                {KEYS[i]}
              </span>
              <span class={o.mono ? 'qz-label mono' : 'qz-label'}>{o.label}</span>
              {answered && i === q.correct ? (
                <span class="sr-only">{` (${tm('quiz.srCorrect')})`}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div class="qz-status" role="status" aria-live="polite">
        {answered ? (
          <div class="qz-feedback" data-ok={ok ? 'true' : 'false'}>
            <p>
              <strong>{ok ? t('quiz.correct') : t('quiz.wrong')}</strong>{' '}
              {q.options[picked]!.explain}
            </p>
            {!ok ? (
              <p>
                <strong>{tm('quiz.correctWas', { key: KEYS[q.correct] ?? '' })}</strong>{' '}
                {q.options[q.correct]!.explain}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {answered ? (
        <div class="qz-actions">
          {mode === 'quiz' ? (
            <button type="button" class="btn btn-dark" onClick={next} data-next>
              {index + 1 < total ? t('quiz.next') : t('quiz.finish')}
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M2 7H12M8 3L12 7L8 11"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          ) : (
            <button type="button" class="qz-link" onClick={retry}>
              {t('quiz.retry')}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
