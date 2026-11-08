import { describe, expect, it } from 'vitest';
import {
  DRIFTING_ISLAND,
  DRIFTING_ISLANDS,
  driftingIslandLoop,
  driftingIslands,
  driftingIslandSpawn,
  islandSpanAt,
  isDriftingIsland,
  pelicanBirdSheltered,
  shelteredScoopHit,
  type DriftingIslandSpawn,
} from './driftingIslands';
import { glowPlantSpawn } from './glowPlants';
import { elementActive, elementSweep, type DriftingIslandPath, type IslandDriftDirection } from './hazards';
import { coversAt } from './hiding';
import { PELICAN_LINE, pelicanLinePeriod, pelicanLineSpawn, pelicanScoopBoxes, pelicanScoopHit } from './pelicanLine';
import { windSpawn } from './wind';
import { CANAL_LAYOUT, SURF, areaSize, buildCanalZone, buildZone, swimBounds, type Point, type SwimBounds } from './zone';

const BOUNDS: SwimBounds = swimBounds(areaSize(9, 2));
/**
 * A line over 600..2400 at offset 0: each scoop runs from 4.0 s to 5.5 s into its 5.5 s cycle. In
 * cycle 0 the birds stand at x 800, 1000 and 1200, so the boxes are x 750..850, 950..1050 and
 * 1150..1250.
 */
const LINE = pelicanLineSpawn('lake-3/pelicans-1', 0, { x0: 600, x1: 2400 }, BOUNDS);
const PERIOD = pelicanLinePeriod(LINE);
const SCOOP_FROM = PELICAN_LINE.glideFor + PELICAN_LINE.warnFor;
const SCOOP_FOR = PERIOD - SCOOP_FROM;
const REACH = PELICAN_LINE.touchReach;
/** A 1200 px path: the island's left edge travels 960 px each way, 60 s at 16 px/s, a 120 s loop. */
const PATH: DriftingIslandPath = { x0: 700, x1: 1900, direction: 'right' };
const ISLAND = driftingIslandSpawn('lake-3/island-1', 0, PATH);
const LOOP = 120;
/** 24 drift phases, 5 s apart, over the whole loop; a 'left' heading is a 'right' one half a loop on. */
const PHASE_OFFSETS = Array.from({ length: 24 }, (_, index) => index * (LOOP / 24));
/** Six moments of a scoop, from the start of the plunge to the end of the rise. */
const WINDOW_SHARES = [0, 0.2, 0.4, 0.6, 0.8, 0.999];

/** The island over PATH with drift offset `offset`. */
function islandAt(offset: number): DriftingIslandSpawn {
  return driftingIslandSpawn(`lake-3/island-${offset}`, offset, PATH);
}

/** Element times over the live scoops of `cycles`, WINDOW_SHARES of each window. */
function scoopTimes(cycles: readonly number[]): number[] {
  return cycles.flatMap((cycle) => WINDOW_SHARES.map((share) => cycle * PERIOD + SCOOP_FROM + share * SCOOP_FOR));
}

/** Body centres from SURF - 20 down to 20 px under the dip, every 40 px. */
const DEPTHS = Array.from({ length: 7 }, (_, index) => SURF - 20 + index * 40);

describe('drifting island tuning and element type (issue #213)', () => {
  it('has the owner-approved values', () => {
    expect(DRIFTING_ISLANDS).toEqual({ width: 240, speed: 16 });
    expect(Object.isFrozen(DRIFTING_ISLANDS)).toBe(true);
  });

  it('is an always-active cycle element that is never met and has no fact card', () => {
    expect(DRIFTING_ISLAND).toEqual({ id: 'drifting-island', name: 'Drifting island', kind: 'cycle', period: 1, activeFor: 1 });
    expect(DRIFTING_ISLAND).not.toHaveProperty('fact');
    expect(DRIFTING_ISLAND).not.toHaveProperty('meetRange');
    expect(Object.isFrozen(DRIFTING_ISLAND)).toBe(true);
    for (const t of [-3.2, 0, 0.5, 17, 1000]) expect(elementActive(ISLAND, t)).toBe(true);
  });

  it('has no sweep, so it never blocks the axolotl', () => {
    expect(elementSweep(ISLAND)).toBeNull();
  });
});

describe('driftingIslandSpawn', () => {
  it('builds the island element with a copy of its path', () => {
    const path: DriftingIslandPath = { x0: 100, x1: 1300, direction: 'left' };
    const island = driftingIslandSpawn('open-lake-3/island-2', 7.5, path);
    expect(island).toEqual({ id: 'open-lake-3/island-2', type: DRIFTING_ISLAND, offset: 7.5, island: path });
    expect(island.island).not.toBe(path);
  });

  it.each([
    ['a path with x0 not under x1', { x0: 900, x1: 900, direction: 'right' }],
    ['a reversed path', { x0: 1300, x1: 100, direction: 'right' }],
    ['a non-finite x0', { x0: Number.NaN, x1: 1300, direction: 'right' }],
    ['a non-finite x1', { x0: 100, x1: Number.POSITIVE_INFINITY, direction: 'right' }],
    ['a path no longer than one island', { x0: 100, x1: 340, direction: 'right' }],
    ['a bad direction', { x0: 100, x1: 1300, direction: 'up' as IslandDriftDirection }],
  ])('throws a RangeError for %s', (_, path) => {
    expect(() => driftingIslandSpawn('bad', 0, path as DriftingIslandPath)).toThrow(RangeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('throws a RangeError for offset %s', (offset) => {
    expect(() => driftingIslandSpawn('bad', offset, PATH)).toThrow(RangeError);
  });

  it('accepts a path one px longer than an island', () => {
    expect(driftingIslandSpawn('ok', 0, { x0: 100, x1: 341, direction: 'right' }).island.x1).toBe(341);
  });
});

describe('driftingIslands', () => {
  it('picks the islands out of the elements, in element order', () => {
    const wind = windSpawn('wind-1', 0, { x0: 0, x1: 1000, direction: 'left' });
    const plant = glowPlantSpawn('plant-1', { x: 300, y: 200, radius: 20 });
    const second = islandAt(30);
    const elements = [wind, ISLAND, plant, second];
    expect(driftingIslands(elements)).toEqual([ISLAND, second]);
    expect(elements.map(isDriftingIsland)).toEqual([false, true, false, true]);
    expect(driftingIslands([wind, plant])).toEqual([]);
  });
});

describe('islandSpanAt', () => {
  it('starts at the end it heads away from and turns at once at the far end', () => {
    expect(islandSpanAt(ISLAND, 0)).toEqual({ x0: 700, x1: 940 });
    expect(islandSpanAt(ISLAND, 30)).toEqual({ x0: 1180, x1: 1420 });
    expect(islandSpanAt(ISLAND, 60)).toEqual({ x0: 1660, x1: 1900 });
    expect(islandSpanAt(ISLAND, 59.5)).toEqual(islandSpanAt(ISLAND, 60.5));
    expect(islandSpanAt(ISLAND, 90)).toEqual({ x0: 1180, x1: 1420 });
    expect(islandSpanAt(ISLAND, 120)).toEqual({ x0: 700, x1: 940 });
    expect(islandSpanAt(ISLAND, 119.5)).toEqual(islandSpanAt(ISLAND, 120.5));
    expect(driftingIslandLoop(ISLAND)).toBe(LOOP);
  });

  it('starts a left-heading island at the right end', () => {
    const left = driftingIslandSpawn('left', 0, { ...PATH, direction: 'left' });
    expect(islandSpanAt(left, 0)).toEqual({ x0: 1660, x1: 1900 });
    expect(islandSpanAt(left, 10)).toEqual({ x0: 1500, x1: 1740 });
    expect(islandSpanAt(left, 60)).toEqual({ x0: 700, x1: 940 });
  });

  it('drifts at 16 px/s and stays 240 px wide inside its path', () => {
    for (let t = -130; t <= 250; t += 0.5) {
      const span = islandSpanAt(ISLAND, t);
      const later = islandSpanAt(ISLAND, t + 0.5);
      expect(span.x1 - span.x0).toBe(DRIFTING_ISLANDS.width);
      expect(span.x0).toBeGreaterThanOrEqual(PATH.x0);
      expect(span.x1).toBeLessThanOrEqual(PATH.x1);
      expect(Math.abs(later.x0 - span.x0)).toBeLessThanOrEqual(DRIFTING_ISLANDS.speed * 0.5 + 1e-9);
    }
    expect(islandSpanAt(ISLAND, 11).x0 - islandSpanAt(ISLAND, 10).x0).toBe(16);
  });

  it('is put out of step by its offset, before the offset included', () => {
    const late = islandAt(30);
    for (const t of [-45, 0, 12.5, 77]) expect(islandSpanAt(late, t)).toEqual(islandSpanAt(ISLAND, t - 30));
    expect(islandSpanAt(ISLAND, -10)).toEqual({ x0: 860, x1: 1100 });
  });
});

describe('pelicanBirdSheltered', () => {
  it('is false with no islands and throws for a bird the line does not have', () => {
    expect(pelicanBirdSheltered(LINE, 0, 4.5, [])).toBe(false);
    expect(() => pelicanBirdSheltered(LINE, 3, 4.5, [ISLAND])).toThrow(RangeError);
    expect(() => pelicanBirdSheltered(LINE, 0.5, 4.5, [ISLAND])).toThrow(RangeError);
    expect(() => pelicanBirdSheltered(LINE, -1, 4.5, [ISLAND])).toThrow(RangeError);
  });

  it('shelters a bird whose box the island reaches only at the end of the rise, from the start of the plunge', () => {
    const arriving = (x1: number) => driftingIslandSpawn('arriving', 0, { x0: 1000, x1, direction: 'left' });
    const atBird = { x: 1200, y: SURF + 10 };
    expect(islandSpanAt(arriving(1578), SCOOP_FROM).x0).toBe(1274);
    expect(islandSpanAt(arriving(1578), PERIOD).x0).toBe(1250);
    for (const t of scoopTimes([0])) {
      expect(pelicanScoopHit(LINE, atBird, t)).toBe(2);
      expect(pelicanBirdSheltered(LINE, 2, t, [arriving(1578)])).toBe(true);
      expect(shelteredScoopHit(LINE, atBird, t, [arriving(1578)])).toBeNull();
      expect(shelteredScoopHit(LINE, atBird, t, [arriving(1579)])).toBe(2);
    }
  });

  it('keeps a bird sheltered through the rise when the island drifts off its box after the plunge starts', () => {
    const leaving = (x1: number) => driftingIslandSpawn('leaving', 0, { x0: 400, x1, direction: 'left' });
    const atBird = { x: 800, y: SURF + 10 };
    expect(islandSpanAt(leaving(814), SCOOP_FROM).x1).toBe(750);
    for (const t of scoopTimes([0])) {
      expect(shelteredScoopHit(LINE, atBird, t, [leaving(814)])).toBeNull();
      expect(shelteredScoopHit(LINE, atBird, t, [leaving(813)])).toBe(0);
    }
  });

  it('holds one answer for each bird over the whole cycle of each scoop, glide and warning included', () => {
    const shares = Array.from({ length: 12 }, (_, index) => index / 12);
    let changed = 0;
    let sheltered = 0;
    for (const offset of PHASE_OFFSETS) {
      const islands = [islandAt(offset)];
      for (let cycle = 0; cycle < 6; cycle++) {
        for (let bird = 0; bird < PELICAN_LINE.count; bird++) {
          const answers = shares.map((share) => pelicanBirdSheltered(LINE, bird, (cycle + share) * PERIOD, islands));
          if (answers.some((answer) => answer !== answers[0])) changed++;
          if (answers[0]) sheltered++;
        }
      }
    }
    expect(changed).toBe(0);
    expect(sheltered).toBeGreaterThan(0);
  });
});

describe('shelteredScoopHit', () => {
  it('returns exactly what pelicanScoopHit returns with no islands', () => {
    let differ = 0;
    let hits = 0;
    for (let t = 0; t < 2 * PERIOD; t += 0.1) {
      for (let x = 560; x <= 1500; x += 20) {
        for (const y of DEPTHS) {
          const open = pelicanScoopHit(LINE, { x, y }, t);
          if (shelteredScoopHit(LINE, { x, y }, t, []) !== open) differ++;
          if (open !== null) hits++;
        }
      }
    }
    expect(differ).toBe(0);
    expect(hits).toBeGreaterThan(0);
  });

  it('only ever takes hits away: a sheltered hit implies an unsheltered hit, over positions, scoop moments and drift phases', () => {
    const times = scoopTimes([0, 7]);
    let added = 0;
    let removed = 0;
    let kept = 0;
    let evaluations = 0;
    for (const offset of PHASE_OFFSETS) {
      const islands = [islandAt(offset)];
      for (const t of times) {
        for (let x = 600; x <= 2400; x += 40) {
          for (const y of DEPTHS) {
            const pos = { x, y };
            const sheltered = shelteredScoopHit(LINE, pos, t, islands);
            const open = pelicanScoopHit(LINE, pos, t);
            evaluations++;
            if (sheltered !== null && open === null) added++;
            if (sheltered === null && open !== null) removed++;
            if (sheltered !== null && open !== null) kept++;
          }
        }
      }
    }
    expect(evaluations).toBeLessThanOrEqual(200_000);
    expect(added).toBe(0);
    expect(removed).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
  });

  it('never scoops a body under an island more than the touch reach in from its edges', () => {
    let underIsland = 0;
    let wouldHit = 0;
    let scooped = 0;
    for (const offset of PHASE_OFFSETS) {
      const islands = [islandAt(offset)];
      for (const t of scoopTimes([0, 1, 2, 3])) {
        const span = islandSpanAt(islands[0], t);
        for (let x = span.x0 + REACH + 0.5; x < span.x1 - REACH; x += 10) {
          for (const y of DEPTHS) {
            const pos: Point = { x, y };
            underIsland++;
            if (pelicanScoopHit(LINE, pos, t) !== null) wouldHit++;
            if (shelteredScoopHit(LINE, pos, t, islands) !== null) scooped++;
          }
        }
      }
    }
    expect(underIsland).toBeGreaterThan(0);
    expect(wouldHit).toBeGreaterThan(0);
    expect(scooped).toBe(0);
  });

  it('still lets an unsheltered bird of the same line bump', () => {
    const t = SCOOP_FROM + 0.6;
    const islands = [driftingIslandSpawn('over-bird-1', 0, { x0: 500, x1: 900, direction: 'right' })];
    const boxes = pelicanScoopBoxes(LINE, t);
    expect(pelicanBirdSheltered(LINE, 0, t, islands)).toBe(true);
    expect(pelicanBirdSheltered(LINE, 1, t, islands)).toBe(false);
    expect(shelteredScoopHit(LINE, { x: (boxes[0].x0 + boxes[0].x1) / 2, y: SURF + 40 }, t, islands)).toBeNull();
    expect(shelteredScoopHit(LINE, { x: (boxes[1].x0 + boxes[1].x1) / 2, y: SURF + 40 }, t, islands)).toBe(1);
  });
});

describe('drifting islands and the hiding rules', () => {
  it.each([1, 7, 42])('add no cover, reed patch or rock to the zone for seed %i', (seed) => {
    const island = driftingIslandSpawn('canal/island-1', 0, { x0: 300, x1: 1500, direction: 'right' });
    const canal = buildCanalZone(seed);
    const zone = buildZone({ ...CANAL_LAYOUT, elements: [island] }, seed);
    expect(zone).toStrictEqual({ ...canal, elements: [island] });
    for (const t of [0, 20, 45, 75]) {
      const span = islandSpanAt(island, t);
      for (let x = span.x0; x <= span.x1; x += 30) {
        for (const y of [SURF, SURF + 10, SURF + 60, SURF + 140]) expect(coversAt({ x, y }, zone)).toEqual(coversAt({ x, y }, canal));
      }
    }
  });
});
