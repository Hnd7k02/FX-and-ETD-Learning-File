/**
 * Start diagnostics of forward-first.html (DECISIONS D-41). Runs before the data block and the
 * main script. If the interface is not ready after 4 s (window.__FF_READY__), a yellow box below
 * the loading text shows what is needed to find the cause: version, whether the main script
 * started (window.__FF_OFFLINE__, its first statement) and whether the interface became ready,
 * the lengths of the data block and the main script against the lengths at build time (a
 * transport that changes characters changes them), whether the file was opened locally or from a
 * network share (no path), the browser, CSP violations and JavaScript errors. Text only
 * (textContent), no HTML.
 *
 * The build inserts __FF_DIAG__ (scripts/build-offline.ts).
 */
declare const __FF_DIAG__: {
  /** version number */
  v: number;
  /** build date as shown (dd.mm.yyyy) */
  d: string;
  /** length of the data block at build time */
  ld: number;
  /** length of the main script as written into the file (characters) */
  lm: number;
};

const errors: string[] = [];
const violations: string[] = [];

window.addEventListener('error', (e) => {
  const where = e.filename ? ` (${e.lineno}:${e.colno})` : '';
  errors.push(`${String(e.message || 'error')}${where}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason as { message?: string } | undefined;
  errors.push(`Promise: ${String(r && r.message ? r.message : r)}`);
});
document.addEventListener('securitypolicyviolation', (e) => {
  violations.push(`${e.violatedDirective} ${e.blockedURI || ''}`.trim());
});

function lengthOf(id: string): number {
  const el = document.getElementById(id);
  return el && el.textContent !== null ? el.textContent.length : -1;
}

/** Only "local" or "network share": a path or server name never appears in the box. */
function where(): string {
  return location.protocol === 'file:' && location.host
    ? 'Netzlaufwerk / network share'
    : 'lokal / local';
}

const flag = (on: boolean) => (on ? 'ja / yes' : 'nein / no');

function compare(actual: number, expected: number): string {
  return `${actual} (Build ${expected})${actual === expected ? ' OK' : ' ABWEICHUNG / MISMATCH'}`;
}

/** The two flags of the main script: started (first statement) and interface ready. */
function flags(): { started: boolean; ready: boolean } {
  const w = window as unknown as { __FF_OFFLINE__?: boolean; __FF_READY__?: boolean };
  return { started: w.__FF_OFFLINE__ === true, ready: w.__FF_READY__ === true };
}

window.setTimeout(() => {
  const f = flags();
  if (f.ready) return; // started
  const main = document.getElementById('main');
  if (!main) return;
  const D = __FF_DIAG__;
  const lines = [
    `Forward First ${D.v} (${D.d}): Start-Diagnose / start diagnostics`,
    `Hauptskript gestartet / main script started (__FF_OFFLINE__): ${flag(f.started)}`,
    `Oberfläche bereit / interface ready (__FF_READY__): ${flag(f.ready)}`,
    `Datenblock / data block: ${compare(lengthOf('ff-data'), D.ld)}`,
    `Hauptskript / main script: ${compare(lengthOf('ff-main'), D.lm)}`,
    `Ort / location: ${where()}`,
    `Browser: ${navigator.userAgent}`,
    `CSP-Verstösse / CSP violations: ${violations.length ? violations.slice(0, 5).join(' | ') : 'keine / none'}`,
    `JS-Fehler / JS errors: ${errors.length ? errors.slice(0, 5).join(' | ') : 'keine / none'}`,
  ];
  const box = document.createElement('div');
  box.id = 'ff-diagnose';
  box.setAttribute('role', 'status');
  box.style.cssText =
    'margin:0 16px 48px;padding:16px;background:#fff3b0;border:2px solid #b38f00;' +
    'border-radius:12px;font:13px/1.5 system-ui,sans-serif;color:#1a1a1a;overflow-wrap:anywhere';
  for (const line of lines) {
    const p = document.createElement('div');
    p.textContent = line;
    box.appendChild(p);
  }
  main.appendChild(box);
}, 4000);
