/**
 * Client script of TopNav.astro. Runs on every 'astro:page-load' (Astro's ClientRouter
 * in the web build; the offline router in forward-first.html dispatches the same event).
 */
import { firstOpen, loadProgress, onProgress, type Progress } from '@/lib/progress';
import { modulePath } from '@/i18n/routes';

/** "Weiterlernen" points at the first open section; updated whenever progress changes. */
function setContinue(p: Progress): void {
  const target = firstOpen(p);
  document.querySelectorAll<HTMLAnchorElement>('a[data-continue]').forEach((a) => {
    const lang = a.dataset.continue === 'en' ? 'en' : 'de';
    a.setAttribute('href', modulePath(lang, target.slug, target.section));
  });
}

function rememberLang(this: HTMLAnchorElement): void {
  try {
    localStorage.setItem('ff-lang', this.dataset.langSwitch ?? 'de');
  } catch {
    /* storage blocked: the choice is not remembered */
  }
}

function wire(): void {
  setContinue(loadProgress());
  // The offline file keeps the navigation element across pages: bind each link only once.
  document.querySelectorAll<HTMLAnchorElement>('a[data-lang-switch]').forEach((a) => {
    if (a.dataset.wired) return;
    a.dataset.wired = '1';
    a.addEventListener('click', rememberLang);
  });
}

onProgress(setContinue);
document.addEventListener('astro:page-load', wire);
