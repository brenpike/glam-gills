/**
 * The PRD F15 floors over every Dream colour pair, not only each new colour's (issue #215; owner decision, 2026-11-08,
 * option A; PRD F15, ND-10). `dreamCatalogueSeparationDrift` checks every unique pair of Dream bodies on unrounded
 * measures against `RECORDED_DREAM_FLOOR_MISSES`, the older pairs F15 records (issue #227). A miss outside the record
 * fails, a recorded pair that now clears its floor fails, and the record holds only pairs of the Dream colours that
 * were once canal colours, so a newer colour's miss can never be recorded.
 */
import { describe, expect, it } from 'vitest';
import { ONCE_CANAL_DREAM_IDS, RECORDED_DREAM_FLOOR_MISSES, dreamCatalogueSeparationDrift } from './dreamSeparation';

describe('PRD F15 floors over every Dream colour pair', () => {
  it('misses no floor on any pair except the recorded older pairs, each of which still misses it', () => {
    expect(dreamCatalogueSeparationDrift()).toEqual({ unrecorded: [], stale: [] });
  });

  it('records each older miss once, and only between Dream colours that were once canal colours', () => {
    expect(Object.isFrozen(ONCE_CANAL_DREAM_IDS)).toBe(true);
    expect(Object.isFrozen(RECORDED_DREAM_FLOOR_MISSES)).toBe(true);
    const keys = new Set<string>();
    for (const entry of RECORDED_DREAM_FLOOR_MISSES) {
      const [a, b] = entry.pair;
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.pair)).toBe(true);
      expect(a).not.toBe(b);
      expect(ONCE_CANAL_DREAM_IDS).toContain(a);
      expect(ONCE_CANAL_DREAM_IDS).toContain(b);
      keys.add(`${[a, b].sort().join(' / ')}: ${entry.measure}`);
    }
    expect(keys.size).toBe(RECORDED_DREAM_FLOOR_MISSES.length);
  });
});
