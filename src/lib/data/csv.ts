/**
 * Raw data format of the Riskometer and the parser for the ECB Data Portal "csvdata" export.
 *
 * Raw format (data/raw/ecb-eur-reference.csv): header `date,USD,CHF,JPY`, one row per ECB
 * fixing day in ascending order, values = units of the currency per 1 EUR (ECB reference
 * rates), written in the shortest form that round-trips (`1.1789`, `133.73`). A missing value
 * is an empty cell and is read as NaN, which the validation rejects.
 */

export const CURRENCIES = ['USD', 'CHF', 'JPY'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const RAW_HEADER = `date,${CURRENCIES.join(',')}`;

/** One ECB fixing day: units of each currency per 1 EUR. */
export interface RawRow {
  date: string;
  USD: number;
  CHF: number;
  JPY: number;
}

function parseValue(cell: string | undefined): number {
  const s = (cell ?? '').trim();
  if (s === '' || s.toUpperCase() === 'NAN') return Number.NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

function lines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
}

/** Parses the raw format. Throws if the header is not `date,USD,CHF,JPY`. */
export function parseRawCsv(text: string): RawRow[] {
  const ls = lines(text);
  const header = ls.shift();
  if (header?.trim() !== RAW_HEADER) {
    throw new Error(`Unexpected header "${header ?? ''}", expected "${RAW_HEADER}"`);
  }
  return ls.map((l) => {
    const c = l.split(',');
    return {
      date: (c[0] ?? '').trim(),
      USD: parseValue(c[1]),
      CHF: parseValue(c[2]),
      JPY: parseValue(c[3]),
    };
  });
}

function cell(x: number): string {
  return Number.isFinite(x) ? String(x) : '';
}

/** Serialises rows in the raw format, with a trailing newline. */
export function serializeRawCsv(rows: readonly RawRow[]): string {
  const body = rows.map((r) => [r.date, cell(r.USD), cell(r.CHF), cell(r.JPY)].join(','));
  return [RAW_HEADER, ...body].join('\n') + '\n';
}

/** Splits one CSV line (RFC 4180: fields in double quotes may contain commas and ""). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export interface EcbParseResult {
  rows: RawRow[];
  /** Observations that were ignored (other currencies, empty or non-numeric values). */
  skipped: number;
}

function isCurrency(x: string): x is Currency {
  return (CURRENCIES as readonly string[]).includes(x);
}

/**
 * Parses the ECB Data Portal csvdata export (columns include TIME_PERIOD, CURRENCY and
 * OBS_VALUE; one row per series and day, series one after the other) and pivots it into the
 * raw format, sorted by date. A day on which a currency is missing keeps NaN for it, so the
 * validation reports the gap instead of silently dropping the day.
 */
export function parseEcbCsv(text: string): EcbParseResult {
  const ls = lines(text);
  const header = splitCsvLine(ls.shift() ?? '').map((h) => h.trim());
  const iDate = header.indexOf('TIME_PERIOD');
  const iCcy = header.indexOf('CURRENCY');
  const iVal = header.indexOf('OBS_VALUE');
  if (iDate < 0 || iCcy < 0 || iVal < 0) {
    throw new Error('ECB csvdata: columns TIME_PERIOD, CURRENCY and OBS_VALUE are required');
  }
  const byDate = new Map<string, RawRow>();
  let skipped = 0;
  for (const l of ls) {
    const c = splitCsvLine(l);
    const ccy = (c[iCcy] ?? '').trim();
    const date = (c[iDate] ?? '').trim();
    const value = parseValue(c[iVal]);
    if (!isCurrency(ccy) || !Number.isFinite(value)) {
      skipped++;
      continue;
    }
    let row = byDate.get(date);
    if (!row) {
      row = { date, USD: Number.NaN, CHF: Number.NaN, JPY: Number.NaN };
      byDate.set(date, row);
    }
    row[ccy] = value;
  }
  const rows = [...byDate.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  return { rows, skipped };
}
