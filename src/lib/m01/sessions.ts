/**
 * Module 01, section 2: the FX trading day (session clock, MASTER_PROMPT §8.5).
 *
 * SCHEMATIC. Session hours are rounded teaching values (about 08:00–17:00 local time), stored
 * in UTC for the northern winter (Europe and the US on standard time). Daylight saving time
 * shifts them: London and New York move one hour earlier in UTC during their summer time,
 * Wellington and Sydney one hour later (their summer is our winter), Tokyo has no DST. The
 * figure draws everything in Zurich time (CET = UTC+1, CEST = UTC+2); one season switch covers
 * the shift, ignoring the few weeks in which the countries change their clocks on different
 * dates. The liquidity curve is a schematic sum of session activities, not market data.
 *
 * The FX week starts on Monday morning in Wellington (Sunday evening in Zurich) and ends with
 * the New York close on Friday.
 */

export type SessionId = 'wellington' | 'sydney' | 'tokyo' | 'london' | 'newYork';
/** Season in Zurich: winter = CET (UTC+1), summer = CEST (UTC+2). */
export type Season = 'winter' | 'summer';
/** Day in Zurich: Monday to Thursday behave alike; Friday ends with New York, Saturday is shut. */
export type DayType = 'monThu' | 'fri' | 'sat' | 'sun';

export interface SessionDef {
  id: SessionId;
  /** Opening hour in UTC, northern winter (Europe/US standard time). */
  openUtc: number;
  /** Closing hour in UTC, northern winter. */
  closeUtc: number;
  /** Shift in UTC hours while Zurich is on summer time (London/New York −1, Asia-Pacific …). */
  summerShiftUtc: number;
  /** Relative weight in the schematic liquidity curve. */
  weight: number;
  /** Share of the weight lost from open to close (activity fades towards the close). */
  fade: number;
  /** IANA time zone of the city (documentation; the figure works in Zurich time). */
  tz: string;
}

/** One config object for the whole session clock (D-22). Schematic, see the module comment. */
export const SESSION_CONFIG = {
  sessions: [
    {
      id: 'wellington',
      openUtc: 19,
      closeUtc: 4,
      summerShiftUtc: 1,
      weight: 0.15,
      fade: 0.3,
      tz: 'Pacific/Auckland',
    },
    {
      id: 'sydney',
      openUtc: 21,
      closeUtc: 6,
      summerShiftUtc: 1,
      weight: 0.3,
      fade: 0.3,
      tz: 'Australia/Sydney',
    },
    {
      id: 'tokyo',
      openUtc: 0,
      closeUtc: 9,
      summerShiftUtc: 0,
      weight: 0.45,
      fade: 0.3,
      tz: 'Asia/Tokyo',
    },
    {
      id: 'london',
      openUtc: 8,
      closeUtc: 17,
      summerShiftUtc: -1,
      weight: 1,
      fade: 0.15,
      tz: 'Europe/London',
    },
    {
      id: 'newYork',
      openUtc: 13,
      closeUtc: 22,
      summerShiftUtc: -1,
      weight: 0.7,
      fade: 0.6,
      tz: 'America/New_York',
    },
  ] as const satisfies readonly SessionDef[],
  /** Zurich offset to UTC in hours. */
  zurichOffset: { winter: 1, summer: 2 } as const,
  /** Width of the soft ramp at an open or close, in hours. */
  rampHours: 0.75,
  /** Liquidity level thresholds on the normalised curve (0 … 1). */
  levels: { thin: 0.3, moderate: 0.56, high: 0.8 } as const,
} as const;

export const SESSION_IDS: readonly SessionId[] = SESSION_CONFIG.sessions.map((s) => s.id);

const mod24 = (h: number): number => ((h % 24) + 24) % 24;

/** Opening and closing hour of a session in Zurich time (0 ≤ h < 24). */
export function zurichWindow(s: SessionDef, season: Season): { open: number; close: number } {
  const shift = (season === 'summer' ? s.summerShiftUtc : 0) + SESSION_CONFIG.zurichOffset[season];
  return { open: mod24(s.openUtc + shift), close: mod24(s.closeUtc + shift) };
}

/**
 * Trading intervals of one session on one Zurich calendar day, in hours relative to that day's
 * midnight (they may start before 0 or end after 24 when a session runs across midnight).
 * - Monday–Thursday: the session that began the evening before plus today's.
 * - Friday: no session may start after New York's close for the weekend; the Asia-Pacific
 *   sessions that would open on Friday evening (Saturday morning there) do not open.
 * - Saturday: closed. Sunday: only sessions that open before midnight (Monday morning there).
 */
export function sessionIntervals(
  s: SessionDef,
  season: Season,
  day: DayType,
): Array<[number, number]> {
  const { open: o, close: c } = zurichWindow(s, season);
  const wraps = c <= o;
  const end = wraps ? c + 24 : c;
  switch (day) {
    case 'monThu':
      return wraps
        ? [
            [o - 24, c],
            [o, end],
          ]
        : [[o, end]];
    case 'fri':
      return wraps ? [[o - 24, c]] : [[o, end]];
    case 'sun':
      return wraps ? [[o, end]] : [];
    case 'sat':
      return [];
  }
}

/** The intervals clipped to the visible day [0, 24]. */
export function visibleSegments(intervals: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [a, b] of intervals) {
    const lo = Math.max(0, a);
    const hi = Math.min(24, b);
    if (hi > lo) out.push([lo, hi]);
  }
  return out;
}

const smoothstep = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Activity of a session at hour h (0 … 1, before weighting): soft box times fading profile. */
export function sessionActivity(
  s: SessionDef,
  season: Season,
  day: DayType,
  h: number,
): number {
  const r = SESSION_CONFIG.rampHours;
  let a = 0;
  for (const [start, end] of sessionIntervals(s, season, day)) {
    const box = smoothstep((h - start) / r + 0.5) * smoothstep((end - h) / r + 0.5);
    if (box <= 0) continue;
    const p = Math.min(1, Math.max(0, (h - start) / (end - start)));
    a += box * (1 - s.fade * p);
  }
  return a;
}

function rawLiquidity(season: Season, day: DayType, h: number): number {
  let sum = 0;
  for (const s of SESSION_CONFIG.sessions) sum += s.weight * sessionActivity(s, season, day, h);
  return sum;
}

/** Normalisation: the maximum of the raw curve on a weekday in winter (sampled every 5 min). */
const LIQ_MAX = (() => {
  let m = 0;
  for (let i = 0; i <= 24 * 12; i++) m = Math.max(m, rawLiquidity('winter', 'monThu', i / 12));
  return m;
})();

/** Schematic liquidity at Zurich hour h, normalised to 0 … 1 (1 = peak of a normal weekday). */
export function liquidityAt(season: Season, day: DayType, h: number): number {
  return Math.min(1, rawLiquidity(season, day, h) / LIQ_MAX);
}

/** The schematic liquidity curve sampled at n + 1 points over 0 … 24 h. */
export function liquidityCurve(season: Season, day: DayType, n = 192): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const h = (24 * i) / n;
    pts.push([h, liquidityAt(season, day, h)]);
  }
  return pts;
}

/** Sessions open at Zurich hour h (inside an interval, ignoring the soft ramps). */
export function openSessions(season: Season, day: DayType, h: number): SessionId[] {
  return SESSION_CONFIG.sessions
    .filter((s) => sessionIntervals(s, season, day).some(([a, b]) => h >= a && h < b))
    .map((s) => s.id);
}

export type LiquidityLevel = 'closed' | 'thin' | 'moderate' | 'high' | 'peak';

/** Verbal level of the liquidity at hour h; "peak" only inside the London/New York overlap. */
export function liquidityLevel(season: Season, day: DayType, h: number): LiquidityLevel {
  if (openSessions(season, day, h).length === 0) return 'closed';
  const L = liquidityAt(season, day, h);
  const { thin, moderate, high } = SESSION_CONFIG.levels;
  if (L < thin) return 'thin';
  if (L < moderate) return 'moderate';
  if (L < high) return 'high';
  return inOverlap(season, day, h) ? 'peak' : 'high';
}

/** London/New York overlap in Zurich hours, or null on days without it. */
export function overlapWindow(season: Season, day: DayType): [number, number] | null {
  if (day === 'sat' || day === 'sun') return null;
  const [l, n] = (['london', 'newYork'] as const).map((id) =>
    zurichWindow(SESSION_CONFIG.sessions.find((s) => s.id === id)!, season),
  );
  const a = Math.max(l!.open, n!.open);
  const b = Math.min(l!.close, n!.close);
  return b > a ? [a, b] : null;
}

/** True if h lies in the London/New York overlap. */
export function inOverlap(season: Season, day: DayType, h: number): boolean {
  const w = overlapWindow(season, day);
  return !!w && h >= w[0] && h < w[1];
}

/** Zurich hour at which the trading week starts (first open on Sunday). */
export function weekStart(season: Season): { hour: number; session: SessionId } {
  let best: { hour: number; session: SessionId } = { hour: 24, session: 'wellington' };
  for (const s of SESSION_CONFIG.sessions) {
    for (const [a] of sessionIntervals(s, season, 'sun')) {
      if (a < best.hour) best = { hour: a, session: s.id };
    }
  }
  return best;
}

/** Zurich wall clock of a moment: hour (fractional), weekday (0 = Sunday) and season. */
export interface ZurichClock {
  hour: number;
  weekday: number;
  season: Season;
  day: DayType;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Day type of a weekday (0 = Sunday … 6 = Saturday). */
export function dayTypeOf(weekday: number): DayType {
  return weekday === 0 ? 'sun' : weekday === 6 ? 'sat' : weekday === 5 ? 'fri' : 'monThu';
}

/** Reads the Zurich wall clock with Intl (works in browsers and Node). */
export function zurichClock(date: Date): ZurichClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const y = Number(get('year'));
  const mo = Number(get('month'));
  const d = Number(get('day'));
  const h = Number(get('hour')) % 24;
  const mi = Number(get('minute'));
  const wallUtc = Date.UTC(y, mo - 1, d, h, mi);
  const atMinute = Math.floor(date.getTime() / 60000) * 60000;
  const offset = Math.round((wallUtc - atMinute) / 3600000);
  const weekday = Math.max(0, WEEKDAYS.indexOf(get('weekday')));
  return {
    hour: h + mi / 60,
    weekday,
    season: offset >= 2 ? 'summer' : 'winter',
    day: dayTypeOf(weekday),
  };
}

/** "14:30" from a fractional hour (rounded to the minute; 24 → "24:00"). */
export function fmtClock(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
