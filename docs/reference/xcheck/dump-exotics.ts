// Dumps TS core values for the independent Python cross-check (xcheck.py).
import {
  barrierPrice,
  digitalCash,
  doubleNoTouch,
  dntBreakdown,
  gkPrice,
  noTouch,
  oneTouch,
  type BarrierKind,
  type OptionType,
} from '../../../src/lib/fx/index.ts';
import { writeFileSync } from 'node:fs';

interface Mkt { name: string; S: number; T: number; vol: number; rd: number; rf: number }
const markets: Mkt[] = [
  { name: 'example', S: 0.8, T: 0.25, vol: 0.08, rd: 0, rf: 0.035 },
  { name: 'haug', S: 100, T: 0.5, vol: 0.25, rd: 0.08, rf: 0.04 },
  { name: 'haug30', S: 100, T: 0.5, vol: 0.3, rd: 0.08, rf: 0.04 },
  { name: 'negrate', S: 1.2, T: 1, vol: 0.1, rd: -0.0075, rf: 0.0005 },
  { name: 'negrate2', S: 1.05, T: 0.5, vol: 0.05, rd: -0.0075, rf: 0.0 },
  { name: 'lowvol', S: 0.9, T: 1, vol: 0.03, rd: 0.05, rf: 0.0 },
  { name: 'jpy', S: 150, T: 0.5, vol: 0.12, rd: 0.001, rf: 0.05 },
  { name: 'long', S: 1.1, T: 3, vol: 0.15, rd: 0.02, rf: 0.04 },
  { name: 'negLambda', S: 1.08, T: 1, vol: 0.1, rd: -0.0075, rf: -0.005 },
  { name: 'negLambda2', S: 1.08, T: 2, vol: 0.06, rd: -0.0075, rf: -0.0075 },
];
const kinds: BarrierKind[] = ['down-and-out', 'down-and-in', 'up-and-out', 'up-and-in'];
const types: OptionType[] = ['call', 'put'];
const rows: Record<string, unknown>[] = [];

for (const m of markets) {
  const { S, T, vol, rd, rf } = m;
  const Ks = [0.9, 0.97, 1.0, 1.03, 1.1].map((x) => x * S);
  const Hdown = [0.85, 0.95, 0.99].map((x) => x * S);
  const Hup = [1.01, 1.05, 1.15].map((x) => x * S);
  for (const kind of kinds) {
    const Hs = kind.startsWith('down') ? Hdown : Hup;
    for (const type of types) for (const K of Ks) for (const H of Hs) for (const rebate of [0, 0.03 * S]) {
      rows.push({ fn: 'barrier', m: m.name, S, T, vol, rd, rf, K, H, kind, type, rebate,
        v: barrierPrice({ S, K, H, T, vol, rd, rf, type, kind, rebate }) });
    }
  }
  for (const K of Ks) for (const type of types) {
    rows.push({ fn: 'digital', m: m.name, S, T, vol, rd, rf, K, type, v: digitalCash(S, K, T, vol, rd, rf, type) });
    rows.push({ fn: 'vanilla', m: m.name, S, T, vol, rd, rf, K, type, v: gkPrice(S, K, T, vol, rd, rf, type) });
  }
  for (const H of [...Hdown, ...Hup]) {
    rows.push({ fn: 'noTouch', m: m.name, S, T, vol, rd, rf, H, v: noTouch({ S, H, T, vol, rd, rf }) });
    rows.push({ fn: 'oneTouchExpiry', m: m.name, S, T, vol, rd, rf, H, v: oneTouch({ S, H, T, vol, rd, rf, payAt: 'expiry' }) });
    rows.push({ fn: 'oneTouchHit', m: m.name, S, T, vol, rd, rf, H, v: oneTouch({ S, H, T, vol, rd, rf, payAt: 'hit' }) });
  }
  const corridors = [[0.97, 1.03], [0.95, 1.05], [0.9, 1.1], [0.8, 1.25], [0.99, 1.06], [0.6, 1.6]];
  for (const [l, u] of corridors) {
    const L = l! * S, U = u! * S;
    for (const TT of [T, T / 20, 2 * T]) {
      const b = dntBreakdown({ S, L, U, T: TT, vol, rd, rf });
      rows.push({ fn: 'dnt', m: m.name, S, T: TT, vol, rd, rf, L, U, v: doubleNoTouch({ S, L, U, T: TT, vol, rd, rf }), method: b.method, terms: b.terms });
    }
  }
}
writeFileSync(process.argv[2]!, JSON.stringify(rows));
console.log(rows.length, 'rows');
