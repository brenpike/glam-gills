/**
 * The PRD F15 floors over every Dream colour pair, not only each new colour's (issue #215; owner decision, 2026-11-08,
 * option A; open question 747). Every unique pair of Dream bodies is checked by `dreamSeparationFailures` on unrounded
 * measures. The only misses allowed are the older pairs F15 records, tracked in issue #227, listed once below with
 * their measure. A miss outside the list fails, a listed pair that now clears its floor fails, and the list holds
 * only pairs of the Dream colours that were once canal colours, so a newer colour's miss can never be listed.
 */
import { describe, expect, it } from 'vitest';
import { CANAL_DREAM_COLOURS, GALAXY, RAINBOW, TIE_DYE_GALAXY } from '../logic/catalogue';
import { DREAM_GREYSCALE_FLOOR, DREAM_OKLAB_FLOOR, dreamSeparationFailures, type DreamSeparationFailure } from './dreamSeparation';
import { DREAM_SLOTS, type DreamLookId } from './palette';

/** The older Dream colour pairs under an F15 floor, each with the measure it misses (issue #227). */
const RECORDED_OLDER_MISSES: readonly (readonly [DreamLookId, DreamLookId, DreamSeparationFailure['measure']])[] = [
  ['sky-blue', 'lavender', 'greyscale'],
  ['sky-blue', 'sunset-orange', 'greyscale'],
  ['sky-blue', 'bubblegum', 'greyscale'],
  ['lavender', 'sunset-orange', 'greyscale'],
  ['lavender', 'bubblegum', 'greyscale'],
  ['sunset-orange', 'bubblegum', 'greyscale'],
  ['galaxy', 'tie-dye-galaxy', 'greyscale'],
  ['sky-blue', 'iridescent', 'oklab'],
  ['lavender', 'bubblegum', 'oklab'],
  ['lavender', 'iridescent', 'oklab'],
  ['bubblegum', 'iridescent', 'oklab'],
  ['midnight-blue', 'galaxy', 'oklab'],
  ['midnight-blue', 'tie-dye-galaxy', 'oklab'],
  ['hearts', 'tie-dye', 'oklab'],
  ['galaxy', 'tie-dye-galaxy', 'oklab'],
];

/** The Dream colours that were once canal colours (issue #146): the only colours a recorded pair may join. */
const ONCE_CANAL_IDS: readonly string[] = [...CANAL_DREAM_COLOURS, GALAXY, RAINBOW, TIE_DYE_GALAXY].map((colour) => colour.id);

const DREAM_IDS = Object.keys(DREAM_SLOTS) as DreamLookId[];

/** One key per pair, measure and floor, the pair's ids in sorted order so catalogue order never changes a key. */
function missKey(a: DreamLookId, b: DreamLookId, measure: DreamSeparationFailure['measure'], floor: number): string {
  return `${[a, b].sort().join(' / ')}: ${measure} ${floor}`;
}

/** Every F15 floor every unique Dream colour pair misses, as sorted keys. */
function listCatalogueMisses(): string[] {
  return DREAM_IDS.flatMap((id, index) =>
    dreamSeparationFailures(id)
      .filter((failure) => DREAM_IDS.indexOf(failure.pair[1]) > index)
      .map((failure) => missKey(failure.pair[0], failure.pair[1], failure.measure, failure.floor)),
  ).sort();
}

describe('PRD F15 floors over every Dream colour pair', () => {
  it('misses no floor on any pair except the recorded older pairs, each of which still misses it', () => {
    const recorded = RECORDED_OLDER_MISSES.map(([a, b, measure]) =>
      missKey(a, b, measure, measure === 'oklab' ? DREAM_OKLAB_FLOOR : DREAM_GREYSCALE_FLOOR),
    ).sort();
    expect(listCatalogueMisses()).toEqual(recorded);
  });

  it('records each older miss once, and only between Dream colours that were once canal colours', () => {
    const keys = RECORDED_OLDER_MISSES.map(([a, b, measure]) => missKey(a, b, measure, 0));
    expect(new Set(keys).size).toBe(keys.length);
    for (const [a, b] of RECORDED_OLDER_MISSES) {
      expect(a).not.toBe(b);
      expect(ONCE_CANAL_IDS).toContain(a);
      expect(ONCE_CANAL_IDS).toContain(b);
    }
  });
});
