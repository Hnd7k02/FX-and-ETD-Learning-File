/**
 * Client script of AboutView.astro. Runs on every 'astro:page-load' (Astro's ClientRouter
 * in the web build; the offline router in forward-first.html dispatches the same event).
 */
function initToc() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.ab-toc a[data-toc]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const setActive = (id: string) => {
    for (const a of links) {
      if (a.dataset.toc === id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      const hit = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id);
    },
    { rootMargin: '-15% 0px -70% 0px' },
  );
  for (const a of links) {
    const el = document.getElementById(a.dataset.toc ?? '');
    if (el) io.observe(el);
  }
  document.addEventListener('astro:before-swap', () => io.disconnect(), { once: true });
}
document.addEventListener('astro:page-load', initToc);
