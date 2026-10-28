/**
 * Client script of SectionEnd.astro. Runs on every 'astro:page-load' (Astro's ClientRouter
 * in the web build; the offline router in forward-first.html dispatches the same event).
 */
import {
  isSectionDone,
  loadProgress,
  markSection,
  setLast,
  updateProgress,
  type ContentSection,
} from '@/lib/progress';

let observer: IntersectionObserver | null = null;

function wire() {
  observer?.disconnect();
  observer = null;
  const el = document.querySelector<HTMLElement>('[data-section-end]');
  if (!el) return;
  const slug = el.dataset.slug ?? '';
  const section = (el.dataset.section ?? '1') as ContentSection;
  updateProgress((p) => setLast(p, slug, section));

  const chip = el.querySelector<HTMLElement>('[data-section-done]');
  const show = () => {
    el.dataset.done = 'true';
    if (chip) chip.hidden = false;
  };
  if (isSectionDone(loadProgress(), slug, section)) {
    show();
    return;
  }
  if (!('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      updateProgress((p) => markSection(p, slug, section));
      show();
      observer?.disconnect();
      observer = null;
    },
    { threshold: 0 },
  );
  observer.observe(el);
}

document.addEventListener('astro:page-load', wire);
