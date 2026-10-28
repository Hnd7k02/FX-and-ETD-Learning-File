/**
 * Proof that the escape rewrite (scripts/lib/transport.ts) does not change what a script means
 * (DECISIONS D-41, supplement point 4). Original and rewritten source are parsed with acorn
 * (ecmaVersion 'latest') and their syntax trees compared without start, end and raw:
 * - string and number literals by value; a directive ("use strict") also by its raw text, because
 *   an escaped "use strict" is no directive,
 * - template elements by their cooked value (tagged templates also by raw, because the tag
 *   function sees the raw text),
 * - regular expression literals by flags and by the pattern tree of @eslint-community/regexpp,
 *   where every character is its code point.
 * Any difference is reported with the path in the tree and the source around it.
 */
import { parse, type Node } from 'acorn';
import { RegExpParser } from '@eslint-community/regexpp';

const SKIP = new Set(['start', 'end', 'raw', 'loc', 'range']);
const REGEX_SKIP = new Set(['parent', 'start', 'end', 'raw', 'resolved']);
const regexParser = new RegExpParser({ ecmaVersion: 2025 });

type AnyNode = Record<string, unknown>;

function regexTree(pattern: string, flags: string): unknown {
  return regexParser.parsePattern(pattern, 0, pattern.length, {
    unicode: flags.includes('u'),
    unicodeSets: flags.includes('v'),
  });
}

/** Generic deep comparison; returns the path of the first difference or null. */
function compareValues(a: unknown, b: unknown, path: string, skip: Set<string>): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return `${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${path}: array vs object`;
    if (a.length !== b.length) return `${path}: length ${a.length} ≠ ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = compareValues(a[i], b[i], `${path}[${i}]`, skip);
      if (d) return d;
    }
    return null;
  }
  const ao = a as AnyNode;
  const bo = b as AnyNode;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)].filter((k) => !skip.has(k)));
  for (const k of keys) {
    const d = compareValues(ao[k], bo[k], `${path}.${k}`, skip);
    if (d) return d;
  }
  return null;
}

/** Compares two acorn trees with the rules above. */
function compareNodes(a: unknown, b: unknown, path: string, tagged = false): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return `${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${path}: array vs object`;
    if (a.length !== b.length) return `${path}: length ${a.length} ≠ ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = compareNodes(a[i], b[i], `${path}[${i}]`, tagged);
      if (d) return d;
    }
    return null;
  }
  const ao = a as AnyNode;
  const bo = b as AnyNode;
  if (ao.type !== bo.type) return `${path}.type: ${String(ao.type)} ≠ ${String(bo.type)}`;

  if (ao.type === 'Literal' && (ao.regex || bo.regex)) {
    const ra = ao.regex as { pattern: string; flags: string } | undefined;
    const rb = bo.regex as { pattern: string; flags: string } | undefined;
    if (!ra || !rb) return `${path}: regex vs literal`;
    if (ra.flags !== rb.flags) return `${path}.flags: ${ra.flags} ≠ ${rb.flags}`;
    return compareValues(
      regexTree(ra.pattern, ra.flags),
      regexTree(rb.pattern, rb.flags),
      `${path}.regex(/${ra.pattern}/${ra.flags})`,
      REGEX_SKIP,
    );
  }
  if (ao.type === 'TemplateElement') {
    const va = ao.value as { cooked: string | null; raw: string };
    const vb = bo.value as { cooked: string | null; raw: string };
    if (va.cooked !== vb.cooked)
      return `${path}.cooked: ${JSON.stringify(va.cooked)} ≠ ${JSON.stringify(vb.cooked)}`;
    if (tagged && va.raw !== vb.raw) return `${path}.raw (tagged template): ${va.raw} ≠ ${vb.raw}`;
    if (ao.tail !== bo.tail) return `${path}.tail`;
    return null;
  }
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)].filter((k) => !SKIP.has(k)));
  for (const k of keys) {
    // raw text matters only for the quasis of a tagged template, not for nested expressions
    const inTag =
      (ao.type === 'TaggedTemplateExpression' && k === 'quasi') ||
      (ao.type === 'TemplateLiteral' && k === 'quasis' && tagged);
    const d = compareNodes(ao[k], bo[k], `${path}.${k}`, inTag);
    if (d) return d;
  }
  return null;
}

/**
 * Null when both sources mean the same, else a description of the first difference
 * (including a parse error of either side).
 */
export function scriptSemanticsDiff(original: string, rewritten: string): string | null {
  let ta: Node;
  let tb: Node;
  try {
    ta = parse(original, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch (e) {
    return `original does not parse: ${String(e)}`;
  }
  try {
    tb = parse(rewritten, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch (e) {
    return `rewritten source does not parse: ${String(e)}`;
  }
  return compareNodes(ta, tb, 'Program');
}
