/**
 * Client script of SectionStepper.astro. Runs on every 'astro:page-load' (Astro's ClientRouter
 * in the web build; the offline router in forward-first.html dispatches the same event).
 */
import {
  isQuizPassed,
  isSectionDone,
  loadProgress,
  onProgress,
  type ContentSection,
  type Progress,
} from '@/lib/progress';

function apply(p: Progress) {
  document.querySelectorAll<HTMLElement>('[data-stepper]').forEach((root) => {
    const slug = root.dataset.slug ?? '';
    root.querySelectorAll<HTMLElement>('[data-step]').forEach((a) => {
      const key = a.dataset.step ?? '';
      const done =
        key === 'quiz' ? isQuizPassed(p, slug) : isSectionDone(p, slug, key as ContentSection);
      const current = a.getAttribute('aria-current') === 'step';
      a.dataset.state = current ? 'current' : done ? 'done' : 'open';
      a.dataset.done = done ? 'true' : 'false';
      const sr = a.querySelector('[data-step-sr]');
      if (sr) {
        const parts: string[] = [];
        if (current) parts.push(root.dataset.srCurrent ?? '');
        if (done) parts.push(root.dataset.srDone ?? '');
        const text = parts.length ? ` · ${parts.join(', ')}` : '';
        if (sr.textContent !== text) sr.textContent = text;
      }
    });
  });
}

document.addEventListener('astro:page-load', () => apply(loadProgress()));
onProgress(apply);
