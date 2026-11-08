import { describe, expect, it } from 'vitest';
import { driftingIslands, driftingIslandSpawn, islandSpanAt, shelteredScoopHit } from './driftingIslands';
import { createEncounterContext } from './encounter';
import { reedDragAt } from './environment';
import { OPEN_LAKE_2_LAYOUT } from './openLake2Layout';
import { OPEN_LAKE_LAYOUT } from './openLakeLayout';
import {
  PELICAN_LINE,
  pelicanBirdPositions,
  pelicanLinePeriod,
  pelicanLineSpawn,
  pelicanScoopHit,
  type PelicanLineSpawn,
} from './pelicanLine';
import { createTrip, createTripContext, stepTrip, type TripEvent, type TripSource, type TripState, type TripStepResult } from './trip';
import { LEGS } from './tuning';
import { DEFAULT_ZONE_SEED, SURF, buildCanalZone, buildZone, swimBounds, type AreaLayoutData, type Point } from './zone';

const DT = 1 / 60;
const ctx = createTripContext({ encounter: createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 } }) });
const zone = buildCanalZone();

/** One `DT` swimming step at `pos`. */
function stepAt(state: TripState, pos: Point): TripStepResult {
  return stepTrip(state, { axolotlPos: pos, reduced: false, dashing: false }, DT, ctx);
}

/** The step result with the trip's elements left out, so a trip with islands compares to one without. */
function withoutElements(result: TripStepResult): TripStepResult {
  return { ...result, state: { ...result.state, elements: [] } };
}

/** The events of a hit or a Shell block. */
function hitEvents(events: readonly TripEvent[]): TripEvent[] {
  return events.filter((event) => event.type === 'hit' || event.type === 'shellBlock');
}

/**
 * Body centres around each bird of `line` at element time `t`: its centre, and just inside and just
 * outside the touch reach of its scoop box on either side and under the dip.
 */
function probesAround(line: Readonly<PelicanLineSpawn>, t: number): Point[] {
  const { scoopWidth, touchReach, dipDepth } = line.tuning;
  const half = scoopWidth / 2;
  const xs = (birdX: number) => [birdX - half - touchReach - 1, birdX - half - touchReach, birdX, birdX + half + touchReach, birdX + half + touchReach + 1];
  const ys = [SURF, SURF + dipDepth / 2, SURF + dipDepth + touchReach, SURF + dipDepth + touchReach + 1];
  return pelicanBirdPositions(line, t).flatMap((bird) => xs(bird.x).flatMap((x) => ys.map((y) => ({ x, y }))));
}

/** Counts the probes where shelteredScoopHit with `islands` differs from pelicanScoopHit, at every DT step over two cycles. */
function countDifferences(lines: readonly Readonly<PelicanLineSpawn>[], islands: Parameters<typeof shelteredScoopHit>[3]): { differ: number; hits: number } {
  let differ = 0;
  let hits = 0;
  for (const line of lines) {
    const steps = Math.ceil((2 * pelicanLinePeriod(line)) / DT);
    for (let step = 0; step <= steps; step++) {
      const t = step * DT;
      for (const pos of probesAround(line, t)) {
        const open = pelicanScoopHit(line, pos, t);
        if (shelteredScoopHit(line, pos, t, islands) !== open) differ++;
        if (open !== null) hits++;
      }
    }
  }
  return { differ, hits };
}

/** Area 12's and Area 13's real data, each with an island path between its two pelican lines. */
const LAKES: readonly [string, Readonly<AreaLayoutData>, { x0: number; x1: number }][] = [
  ['Area 12', OPEN_LAKE_LAYOUT, { x0: 1950, x1: 2400 }],
  ['Area 13', OPEN_LAKE_2_LAYOUT, { x0: 1500, x1: 3800 }],
];

describe('drifting islands with the real pelican lines (issue #213)', () => {
  it.each(LAKES)('%s has no islands, and its scoops are exactly pelicanScoopHit at every step', (_, layout) => {
    const islands = driftingIslands(layout.elements);
    expect(islands).toEqual([]);
    const { differ, hits } = countDifferences(layout.pelicanLines ?? [], islands);
    expect(differ).toBe(0);
    expect(hits).toBeGreaterThan(0);
  });

  it.each(LAKES)('%s scoops are still exactly pelicanScoopHit with an island drifting between its lines', (_, layout, path) => {
    const lines = layout.pelicanLines ?? [];
    expect(lines).toHaveLength(2);
    expect(path.x0).toBeGreaterThan(lines[0].x1);
    expect(path.x1).toBeLessThan(lines[1].x0);
    const islands = [driftingIslandSpawn('lake/island-between', 0, { ...path, direction: 'right' })];
    expect(countDifferences(lines, islands)).toMatchObject({ differ: 0 });
  });
});

describe('drifting islands add no reed patch, rock or drag (issue #213)', () => {
  it.each([DEFAULT_ZONE_SEED, 7])('leave Area 12 built the same apart from its elements for seed %i', (seed) => {
    const island = driftingIslandSpawn('open-lake-1/island-1', 0, { x0: 500, x1: 1700, direction: 'right' });
    const plain = buildZone(OPEN_LAKE_LAYOUT, seed);
    const withIsland = buildZone({ ...OPEN_LAKE_LAYOUT, elements: [...OPEN_LAKE_LAYOUT.elements, island] }, seed);
    expect(withIsland).toStrictEqual({ ...plain, elements: [...plain.elements, island] });
    for (const t of [0, 30, 60]) {
      const span = islandSpanAt(island, t);
      for (let x = span.x0; x <= span.x1; x += 20) {
        for (const y of [SURF, SURF + 20, SURF + 80]) expect(reedDragAt({ x, y }, withIsland.reedPatches)).toBe(reedDragAt({ x, y }, plain.reedPatches));
      }
    }
  });
});

describe('a trip under a drifting island (issue #213)', () => {
  const island = driftingIslandSpawn('canal/island-1', 0, { x0: 300, x1: 1500, direction: 'right' });

  it('copies the island, sharing no path object with the source', () => {
    const trip = createTrip({ ...zone, elements: [island] });
    expect(trip.elements).toEqual([island]);
    expect(trip.elements[0]).not.toBe(island);
    expect(trip.elements[0].island).not.toBe(island.island);
  });

  it('moves the axolotl, meets and bumps exactly as without the island, the fish included', () => {
    let plain = createTrip(zone);
    let islanded = createTrip({ ...zone, elements: [island] });
    for (let step = 0; step < 240; step++) {
      const span = islandSpanAt(island, (step + 1) * DT);
      const pos: Point = { x: span.x0 + 20 + ((step * 7) % 200), y: SURF + 14 + ((step * 3) % 120) };
      const before = stepAt(plain, pos);
      const after = stepAt(islanded, pos);
      expect(withoutElements(after)).toStrictEqual(withoutElements(before));
      expect(after.state.met).not.toContain('drifting-island');
      plain = before.state;
      islanded = after.state;
    }
  });

  describe('with a pelican line', () => {
    /** As trip.test's line: holding at the dip until element time 0.4; boxes x 1050..1150, 1250..1350 and 1450..1550, y 80 to 230. */
    const line = pelicanLineSpawn('canal/pelicans-1', -4.5, { x0: 1000, x1: 1600 }, swimBounds(zone), { ...PELICAN_LINE, dipDepth: 150 });
    /** Over x 900..1156 through this scoop: it shelters the first bird only. */
    const over = driftingIslandSpawn('canal/island-2', 0, { x0: 900, x1: 1500, direction: 'right' });
    const calm: TripSource = { ...zone, finds: [], spots: [], tilapiaRoutes: [], hazards: [], predatorRoutes: [], pelicanLines: [line] };
    const underFirst: Point = { x: 1130, y: 150 };
    const underSecond: Point = { x: 1300, y: 150 };

    it('lands no hit from a sheltered bird, and no scoop counts as landed', () => {
      expect(hitEvents(stepAt(createTrip(calm), underFirst).events)).toHaveLength(1);
      const { state, events, ...result } = stepAt(createTrip({ ...calm, elements: [over] }), underFirst);
      expect(hitEvents(events)).toEqual([]);
      expect(state.pelicanScoops).toEqual([null]);
      expect(state.legsLost).toBe(0);
      expect(result).not.toHaveProperty('impulse');
    });

    it('still lands the hit of an unsheltered bird of the same line', () => {
      const { state, events } = stepAt(createTrip({ ...calm, elements: [over] }), underSecond);
      expect(hitEvents(events)).toEqual([{ type: 'hit', sourceId: 'pelican', leg: 0, from: { x: 1300, y: SURF + 150 } }]);
      expect(state.pelicanScoops).toEqual([0]);
    });
  });
});
