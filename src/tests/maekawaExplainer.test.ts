import { describe, expect, it } from 'vitest';
import { maekawaCheck } from '../components/explainers/Maekawa';

/**
 * The Maekawa explainer's walk is drawn geometry, and its ledger and dial are
 * read from that geometry. Here the picture must say what the theorem says:
 * the arcs cancel, the U-turns make one full turn, the loop closes, and two
 * mountains with two valleys turn by 0°.
 */
describe('Maekawa explainer walk', () => {
  const c = maekawaCheck();
  it('turns one way at a valley and the other at a mountain', () => {
    expect(c.consistent).toBe(true);
    for (const u of c.uTurns) expect(Math.abs(u.turn)).toBe(180);
    const v = c.uTurns.find((u) => u.a === 'V')!.turn, m = c.uTurns.find((u) => u.a === 'M')!.turn;
    expect(v).toBe(-m);
  });
  it('arcs cancel and U-turns add up to one full turn', () => {
    expect(c.arcSum).toBe(0);
    expect(Math.abs(c.uSum)).toBe(360);
    expect(c.total).toBe(c.uSum);
  });
  it('is one closed, smooth loop whose dial matches the drawing', () => {
    expect(c.gap).toBeLessThan(1e-6);
    expect(c.headGap).toBeLessThan(1e-6);
    expect(c.dialGap).toBeLessThan(1e-6);
  });
  it('two of each turns by 0°', () => {
    expect(c.badUSum).toBe(0);
  });
  it('the separated rim loop never crosses itself (so it turns exactly once)', () => {
    expect(c.simple).toBe(true);
  });
  it('built the same way from the stack that two of each gives, the loop cuts through itself', () => {
    // folding by BAD_MV puts every flap under: sector 1 ends on top, sector 4 at the bottom,
    // so the closing U-turn at crease 1 has to pass through layers 2 and 3
    expect(c.bad.levels).toEqual([3, 2, 1, 0]);
    expect(c.bad.simple).toBe(false);
  });
});
