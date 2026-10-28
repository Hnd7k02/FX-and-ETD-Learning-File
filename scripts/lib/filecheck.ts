/**
 * Final check of the written offline file (DECISIONS D-41, supplement points 1, 3, 4 and 5).
 * Runs on the bytes read back from disk, never on the string the build held in memory:
 * - every byte is 0x0A or 0x20…0x7E,
 * - the whole file has no escape outside the tested list and survives the mail simulation,
 * - <script> blocks: no ES module; the data block (application/octet-stream) is plain base64 and
 *   is never compiled; every classic script is transport-safe, compiles (vm.Script) and means the
 *   same as the esbuild output it came from (acorn + regexpp, scripts/lib/semantics.ts),
 * - CSS: only tested escapes that end unambiguously, and decoding gives the CSS before escaping,
 * - the script lengths the start diagnostics expects are the lengths as written.
 * Returns the list of problems (empty = passed).
 */
import { Script } from 'node:vm';
import { scriptSemanticsDiff } from './semantics';
import {
  cssEscapeProblems,
  decodeCssHexEscapes,
  simulateMail,
  transportProblems,
} from './transport';

export interface ScriptBlock {
  /** position among all <script> blocks (0-based) */
  index: number;
  id: string;
  type: string;
  /** offset of the first content character in the file */
  start: number;
  content: string;
}

export interface FileExpectations {
  /** esbuild output (before the escape rewrite) per script id; every classic script needs one */
  scripts: Record<string, string>;
  /** CSS before the transport escaping; the <style> block must decode to exactly this */
  css?: string;
  /** content length (characters) per script id, as the start diagnostics expects it */
  lengths?: Record<string, number>;
}

const near = (s: string, i: number) => JSON.stringify(s.slice(Math.max(0, i - 30), i + 30));

/** All <script> blocks with id, type and the offset of their content. */
export function scriptBlocks(html: string): ScriptBlock[] {
  const out: ScriptBlock[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1]!;
    out.push({
      index: out.length,
      id: /\bid="([^"]*)"/.exec(attrs)?.[1] ?? '',
      type: (/\btype="([^"]*)"/.exec(attrs)?.[1] ?? '').toLowerCase(),
      start: m.index! + m[0].indexOf('>') + 1,
      content: m[2]!,
    });
  }
  return out;
}

/** Classic script: no type, or a JavaScript MIME type. */
const isClassic = (type: string) =>
  type === '' || type === 'text/javascript' || type === 'application/javascript';

/** Problems of the file bytes; empty when everything holds. */
export function fileProblems(bytes: Uint8Array, expect: FileExpectations): string[] {
  const out: string[] = [];
  for (let i = 0; i < bytes.length && out.length < 20; i++) {
    const b = bytes[i]!;
    if (b !== 0x0a && (b < 0x20 || b > 0x7e)) {
      out.push(`byte 0x${b.toString(16).padStart(2, '0')} at ${i}`);
    }
  }
  if (out.length) return out;
  const text = Buffer.from(bytes).toString('latin1');

  for (const p of transportProblems(text)) out.push(`file: ${p.kind} @${p.index}: ${p.text}`);
  if (simulateMail(text, true) !== text) out.push('file: the mail simulation changes it');

  const seen = new Set<string>();
  for (const s of scriptBlocks(text)) {
    const label = `script #${s.index}${s.id ? ` (${s.id})` : ''}`;
    if (s.type === 'module') {
      out.push(`${label}: ES module (type="module") is not allowed`);
      continue;
    }
    if (s.type === 'application/octet-stream') {
      // data block: base64 only, never compiled
      if (!/^[A-Za-z0-9+/=]*$/.test(s.content)) out.push(`${label}: data block is not base64`);
      continue;
    }
    if (!isClassic(s.type)) {
      out.push(`${label}: unknown script type "${s.type}"`);
      continue;
    }
    seen.add(s.id);
    for (const p of transportProblems(s.content)) {
      out.push(
        `${label} position ${p.index} (file offset ${s.start + p.index}): ${p.kind} ${p.text}`,
      );
    }
    try {
      new Script(s.content, { filename: label });
    } catch (e) {
      out.push(`${label}: does not compile: ${String(e)}`);
    }
    const original = expect.scripts[s.id];
    if (original === undefined) {
      out.push(`${label}: no esbuild output to compare with`);
    } else {
      const diff = scriptSemanticsDiff(original, s.content);
      if (diff) out.push(`${label}: meaning changed by the rewrite: ${diff}`);
    }
    const want = expect.lengths?.[s.id];
    if (want !== undefined && want !== s.content.length) {
      out.push(`${label}: length ${s.content.length}, diagnostics expects ${want}`);
    }
  }
  for (const id of Object.keys(expect.scripts)) {
    if (!seen.has(id)) out.push(`script ${id} missing in the file`);
  }

  if (expect.css !== undefined) {
    const styles = [...text.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    if (styles.length !== 1) out.push(`expected one <style> block, found ${styles.length}`);
    const css = styles[0] ?? '';
    for (const p of cssEscapeProblems(css)) out.push(`css: ${p}`);
    const wanted = decodeCssHexEscapes(expect.css.replace(/[\t\r]/g, ' '));
    const got = decodeCssHexEscapes(css);
    if (got !== wanted) {
      let i = 0;
      while (i < got.length && got[i] === wanted[i]) i++;
      out.push(
        `css: decoding differs from the source at ${i}: ${near(got, i)} vs ${near(wanted, i)}`,
      );
    }
  }
  return out;
}
