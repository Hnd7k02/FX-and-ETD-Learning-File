/**
 * The ex.* number registry (running example): the German strings that module texts show via
 * <Num of="ex.…" />, and that they match the MASTER_PROMPT §6 reference table.
 */
import { describe, expect, it } from 'vitest';
import { EXAMPLE, gkPrice, thetaOneDay } from '@/lib/fx';
import { NUM_FILES, formatNum, getNum } from '@/lib/nums';

const NB = ' '; // no-break space between currency and amount, and before %
const de = (key: string): string => formatNum(getNum(key), 'de');
const en = (key: string): string => formatNum(getNum(key), 'en');

describe('ex.* registry: German formatting', () => {
  it.each([
    ['ex.spot', '0.8000'],
    ['ex.strike', '0.7930'],
    ['ex.rf', `3.5${NB}%`],
    ['ex.vol', `8${NB}%`],
    ['ex.vol1', `8.0${NB}%`],
    ['ex.T', '0.25'],
    ['ex.mmDays', '90'],
    ['ex.notionalM', '1'],
    ['ex.forward', '0.79303'],
    ['ex.forwardMM', '0.79306'],
    ['ex.fwdPoints', '−69.7'],
    ['ex.fwdPointsMM', '−69.4'],
    ['ex.fwdDiffPips', '0.3'],
    ['ex.d1', '0.0210'],
    ['ex.d2', '−0.0190'],
    ['ex.dff', '0.9913'],
    ['ex.callPips', '126.69'],
    ['ex.callChf', `CHF${NB}12’669`],
    ['ex.putPips', '126.39'],
    ['ex.putChf', `CHF${NB}12’639`],
    ['ex.parityPips', '0.31'],
    ['ex.tv3m', '126.5'],
    ['ex.tv1y', '253.0'],
    ['ex.delta', '0.5039'],
    ['ex.deltaUp', '0.6244'],
    ['ex.gamma', '12.36'],
    ['ex.gamma4', '12.3556'],
    ['ex.gammaBigFig', '+0.124'],
    ['ex.vegaChf', `CHF${NB}1’582`],
    ['ex.thetaDayChf', `CHF${NB}−30.82`],
    ['ex.thetaAnalyticChf', `CHF${NB}−30.67`],
    ['ex.thetaGammaChf', `CHF${NB}−69.33`],
    ['ex.thetaCarryChf', `CHF${NB}38.50`],
    ['ex.rhoDChf', `CHF${NB}+976`],
    ['ex.rhoFChf', `CHF${NB}−1’008`],
    ['ex.breakEvenPips', '33.50'],
    ['ex.breakEvenPips1', '33.5'],
  ])('%s → %s', (key, expected) => {
    expect(de(key)).toBe(expected);
  });

  it('English uses commas for thousands and no space before %', () => {
    expect(en('ex.callChf')).toBe(`CHF${NB}12,669`);
    expect(en('ex.rhoFChf')).toBe(`CHF${NB}−1,008`);
    expect(en('ex.vol1')).toBe('8.0%');
  });
});

describe('ex.* registry: consistency with the core', () => {
  const N = EXAMPLE.notional;
  const { spot: S, rd, rf, T, vol } = EXAMPLE;
  const K = getNum('ex.strike').value;

  it('keeps the original input keys', () => {
    for (const key of ['ex.spot', 'ex.rd', 'ex.rf', 'ex.vol', 'ex.notional', 'ex.forward']) {
      expect(NUM_FILES.ex?.[key], key).toBeDefined();
    }
  });

  it('values are the core results, not rounded copies', () => {
    expect(getNum('ex.callChf').value).toBe(gkPrice(S, K, T, vol, rd, rf, 'call') * N);
    expect(getNum('ex.thetaDayChf').value).toBe(thetaOneDay(S, K, T, vol, rd, rf, 'call') * N);
    expect(getNum('ex.gamma').value).toBe(getNum('ex.gamma4').value);
    expect(getNum('ex.breakEvenPips').value).toBe(getNum('ex.breakEvenPips1').value);
  });

  it('theta decomposition adds up: gamma share + carry = one-day theta', () => {
    const sum = getNum('ex.thetaGammaChf').value + getNum('ex.thetaCarryChf').value;
    expect(sum).toBeCloseTo(getNum('ex.thetaDayChf').value, 10);
  });

  it('parity in pips: C − P = DF_d · (F − K)', () => {
    const lhs = getNum('ex.callPips').value - getNum('ex.putPips').value;
    expect(lhs).toBeCloseTo(getNum('ex.parityPips').value, 10);
    const F = getNum('ex.forward').value;
    expect(getNum('ex.parityPips').value).toBeCloseTo((Math.exp(-rd * T) * (F - K)) / 1e-4, 10);
  });

  it('forward gap is continuous minus money market, in absolute pips', () => {
    const gap = getNum('ex.fwdPointsMM').value - getNum('ex.fwdPoints').value;
    expect(gap).toBeGreaterThan(0);
    expect(getNum('ex.fwdDiffPips').value).toBeCloseTo(gap, 10);
  });
});
