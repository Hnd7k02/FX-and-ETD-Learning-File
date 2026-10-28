import { describe, expect, it } from 'vitest';
import { getNum } from '@/lib/nums';
import { EXAMPLE_FORWARD } from '@/lib/fx/example';
import {
  GT_CONFIG,
  LEVER_CONFIG,
  basePremiumChf,
  gammaTheta,
  gammaThetaCurve,
  gammaThetaDomain,
  gammaThetaZone,
  leverEffect,
  leverForward,
} from '@/lib/greeksfigures';

describe('five levers', () => {
  it('starts from the premium of the running example', () => {
    expect(basePremiumChf()).toBeCloseTo(getNum('ex.callChf').value, 6);
  });

  it('has the textbook signs for the USD call', () => {
    expect(leverEffect('spot', 'up').exact).toBeGreaterThan(0);
    expect(leverEffect('spot', 'down').exact).toBeLessThan(0);
    for (const c of ['day', 'week', 'month'] as const)
      expect(leverEffect('time', c).exact).toBeLessThan(0);
    expect(leverEffect('vol', 'up').exact).toBeGreaterThan(0);
    expect(leverEffect('rd', 'up').exact).toBeGreaterThan(0);
    expect(leverEffect('rf', 'up').exact).toBeLessThan(0);
    expect(leverEffect('rf', 'down').exact).toBeGreaterThan(0);
  });

  it('the Greeks estimate the change from the current slope', () => {
    const vol = leverEffect('vol', 'up');
    expect(vol.estimate).toBeCloseTo(getNum('ex.vegaChf').value, 6);
    expect(Math.abs(vol.exact - vol.estimate)).toBeLessThan(1);
    const day = leverEffect('time', 'day');
    expect(day.exact).toBeCloseTo(getNum('ex.thetaDayChf').value, 6);
    expect(day.estimate).toBeCloseTo(getNum('ex.thetaAnalyticChf').value, 6);
    expect(leverEffect('rd', 'up').estimate).toBeCloseTo(getNum('ex.rhoDChf').value, 6);
    expect(leverEffect('rf', 'up').estimate).toBeCloseTo(getNum('ex.rhoFChf').value, 6);
    // a whole month decays faster than theta today suggests
    const month = leverEffect('time', 'month');
    expect(month.exact).toBeLessThan(month.estimate);
    // delta plus gamma gets the big-figure move to within 0.5 %
    const spot = leverEffect('spot', 'up');
    expect(Math.abs(spot.exact - spot.estimate) / spot.exact).toBeLessThan(0.005);
    expect(spot.price).toBeCloseTo(basePremiumChf() + spot.exact, 6);
  });

  it('keeps every bar inside the fixed axis', () => {
    for (const k of LEVER_CONFIG.order)
      for (const c of LEVER_CONFIG.choices[k])
        expect(Math.abs(leverEffect(k, c).exact)).toBeLessThan(LEVER_CONFIG.axisChf);
  });

  it('moves the forward the way the text says', () => {
    expect(leverForward('rd', 'up')).toBeGreaterThan(EXAMPLE_FORWARD);
    expect(leverForward('rd', 'down')).toBeLessThan(EXAMPLE_FORWARD);
    expect(leverForward('rf', 'up')).toBeLessThan(EXAMPLE_FORWARD);
    expect(leverForward('rf', 'down')).toBeGreaterThan(EXAMPLE_FORWARD);
    expect(leverForward('vol', 'up')).toBeCloseTo(EXAMPLE_FORWARD, 12);
    expect(leverForward('spot', 'up')).toBeGreaterThan(EXAMPLE_FORWARD);
    // time passing pulls the forward towards spot (USD rate above CHF rate)
    expect(leverForward('time', 'week')).toBeGreaterThan(EXAMPLE_FORWARD);
    expect(leverForward('time', 'day')).toBeLessThan(leverForward('time', 'month'));
  });
});

describe('gamma against theta', () => {
  it('pays theta without a move and breaks even at σ·S/√365', () => {
    const flat = gammaTheta(0, 8);
    expect(flat.pnlChf).toBeCloseTo(getNum('ex.thetaGammaChf').value, 6);
    expect(flat.gammaGainChf).toBe(0);
    expect(flat.breakEvenPips).toBeCloseTo(getNum('ex.breakEvenPips').value, 8);
    const be = gammaTheta(flat.breakEvenPips, 8);
    expect(be.pnlChf).toBeCloseTo(0, 8);
    expect(be.realisedVol).toBeCloseTo(0.08, 10);
    expect(gammaTheta(-flat.breakEvenPips, 8).pnlChf).toBeCloseTo(0, 8);
    expect(gammaTheta(60, 8).pnlChf).toBeGreaterThan(0);
    expect(gammaTheta(20, 8).pnlChf).toBeLessThan(0);
  });

  it('is symmetric in the move and needs more movement at higher vol', () => {
    expect(gammaTheta(40, 8).pnlChf).toBeCloseTo(gammaTheta(-40, 8).pnlChf, 10);
    expect(gammaTheta(0, 12).breakEvenPips).toBeGreaterThan(gammaTheta(0, 8).breakEvenPips);
  });

  it('samples the parabola and finds a domain that holds it', () => {
    for (const v of [GT_CONFIG.vol.min, 8, GT_CONFIG.vol.max]) {
      const curve = gammaThetaCurve(v);
      expect(curve).toHaveLength(GT_CONFIG.samples + 1);
      const { domain, step } = gammaThetaDomain(v);
      const ys = curve.map(([, y]) => y);
      expect(domain[0]).toBeLessThanOrEqual(Math.min(...ys));
      expect(domain[1]).toBeGreaterThanOrEqual(Math.max(...ys));
      expect(step).toBeGreaterThan(0);
    }
  });

  it('names the zone of the move', () => {
    expect(gammaThetaZone(0, 8)).toBe('flat');
    expect(gammaThetaZone(20, 8)).toBe('loss');
    expect(gammaThetaZone(-34, 8)).toBe('breakEven');
    expect(gammaThetaZone(80, 8)).toBe('gain');
  });
});
