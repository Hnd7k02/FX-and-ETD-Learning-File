/**
 * "Fortschritt zurücksetzen" (About page). Two steps: the button opens a confirmation, only
 * "Yes, reset" calls resetProgress(). The outcome is announced in a live region.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { reset as dict } from '@/i18n/dict/reset';
import { translator, type Lang } from '@/i18n/types';
import { fmtPct } from '@/lib/format';
import {
  emptyProgress,
  loadProgress,
  onProgress,
  overallPercent,
  resetProgress,
  type Progress,
} from '@/lib/progress';

export interface ResetProgressProps {
  lang: Lang;
}

type Phase = 'idle' | 'confirm';
type Status = '' | 'done' | 'cancelled';

function hasProgress(p: Progress): boolean {
  return Object.keys(p.sections).length > 0 || Object.keys(p.quiz).length > 0;
}

export default function ResetProgress({ lang }: ResetProgressProps) {
  const t = translator(dict, lang);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState<Status>('');
  const openBtn = useRef<HTMLButtonElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    setProgress(loadProgress());
    return onProgress(setProgress);
  }, []);

  // Move focus into the confirmation and back, but not on the first render.
  useEffect(() => {
    if (!moved.current) return;
    if (phase === 'confirm') cancelBtn.current?.focus();
    else openBtn.current?.focus();
  }, [phase]);

  const open = () => {
    moved.current = true;
    setStatus('');
    setPhase('confirm');
  };
  const cancel = () => {
    setStatus('cancelled');
    setPhase('idle');
  };
  const confirm = () => {
    resetProgress();
    setProgress(emptyProgress());
    setStatus('done');
    setPhase('idle');
  };

  const pct = overallPercent(progress);
  const stored = hasProgress(progress);

  return (
    <div class="rp">
      <p class="rp-state">
        {stored ? t('reset.stored', { pct: fmtPct(pct / 100, lang, 0) }) : t('reset.none')}
      </p>
      {stored && (
        <div class="rp-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}

      {phase === 'idle' ? (
        <button ref={openBtn} type="button" class="btn btn-light rp-open" onClick={open}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5V5.5h3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {t('reset.button')}
        </button>
      ) : (
        <div
          class="rp-confirm"
          role="group"
          aria-labelledby="rp-confirm-title"
          aria-describedby="rp-confirm-text"
        >
          <p id="rp-confirm-title" class="rp-confirm-title">
            {t('reset.confirmTitle')}
          </p>
          <p id="rp-confirm-text" class="rp-confirm-text">
            {t('reset.confirmText')}
          </p>
          <div class="rp-actions">
            <button type="button" class="btn btn-dark rp-yes" onClick={confirm}>
              {t('reset.confirm')}
            </button>
            <button ref={cancelBtn} type="button" class="btn btn-light" onClick={cancel}>
              {t('reset.cancel')}
            </button>
          </div>
        </div>
      )}

      <p class="rp-status" role="status" aria-live="polite" data-status={status || undefined}>
        {status === 'done' ? t('reset.done') : status === 'cancelled' ? t('reset.cancelled') : ''}
      </p>
    </div>
  );
}
