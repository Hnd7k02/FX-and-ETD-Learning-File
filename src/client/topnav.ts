/**
 * Client script of TopNav.astro. Runs on every 'astro:page-load' (Astro's ClientRouter
 * in the web build; the offline router in forward-first.html dispatches the same event).
 */
import { loadProgress, firstOpen } from '@/lib/progress';
import { modulePath } from '@/i18n/routes';

function wire() {
  const p = loadProgress();
  const target = firstOpen(p);
  document.querySelectorAll<HTMLAnchorElement>('a[data-continue]').forEach((a) => {
    const lang = a.dataset.continue === 'en' ? 'en' : 'de';
    a.href = modulePath(lang, target.slug, target.section);
  });
  document.querySelectorAll<HTMLAnchorElement>('a[data-lang-switch]').forEach((a) => {
    a.addEventListener('click', () => {
      try {
        localStorage.setItem('ff-lang', a.dataset.langSwitch ?? 'de');
      } catch {
        /* ignore */
      }
    });
  });
}
document.addEventListener('astro:page-load', wire);
