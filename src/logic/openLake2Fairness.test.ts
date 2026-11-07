/**
 * Area 13's fairness proofs (issue #212, ND-4, ND-8): every water area is joined to the Home Spot,
 * and a one-leg axolotl swims the main path from the Home Spot to the exit in under 180 s, timing
 * each pelican scoop, each cormorant dive and each mud turtle snap. The main path keeps out of every
 * tilapia and carp strike (openLake2Layout.test.ts), so those are not timed, as in Area 12. Both
 * proofs run again with every fading light out: they never read light state, and the dark hides
 * only scenery, snacks and treasure, never the axolotl, the exit, a predator, a warning, the Home
 * Spot or a light (ND-9).
 */
import { describe, expect, it } from 'vitest';
import { createEncounter, createEncounterContext, stepEncounter, type EncounterState } from './encounter';
import { reedDragAt } from './environment';
import { FADING_LIGHTS, fadingLightCircles, fadingLights, type FadingLightTimers } from './fadingLights';
import { DARK_HIDDEN_PARTS, DARK_SHOWN_PARTS, inDarkWater, shownInDark, type DarkLight, type DarkWaterPart } from './glowPlants';
import { legSwimTuning } from './legs';
import { OPEN_LAKE_2_EXIT, OPEN_LAKE_2_LAYOUT } from './openLake2Layout';
import { blockAtRock, bodyInAnyRock } from './pebble';
import { pelicanScoopHit } from './pelicanLine';
import { CORMORANT_SPECIES, MUD_TURTLE_SPECIES } from './predators';
import { stepSwim, type SwimState } from './swimPhysics';
import { normalize } from './vec';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds, type Point, type ZoneLayout } from './zone';

const EXTRA_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const ALL_SEEDS = [DEFAULT_ZONE_SEED, ...EXTRA_SEEDS];
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
/** Spacing in px of the water grid the joined-water proof floods. */
const FLOOD_STEP = 8;
/**
 * The one-leg run, as measured: it leaves the Home Spot at element time `start` and reaches the exit
 * `seconds` after it left. `cormorant-0` warns twice, as the axolotl leaves the safe area and as it
 * leaves the left step's tule going west, and each warning ends with the axolotl hidden in the tule
 * or out of reach, so it never dives. `cormorant-1` and the mud turtles never warn. As measured,
 * every start from 3.05 s to 3.20 s passes, so `start` is pinned at 3.15 s, mid-window. A later
 * shared tuning change re-measures the window and pins `start` inside it again; it never loosens
 * the run to fit.
 */
const ONE_LEG_RUN = { start: 3.15, seconds: 82.13, warnings: ['cormorant-0', 'cormorant-0'], strikes: [] as string[] };

const zone = buildZone(OPEN_LAKE_2_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const exit = OPEN_LAKE_2_EXIT;
const walls = zone.rockWalls ?? [];
const lines = zone.pelicanLines ?? [];
const lights = fadingLights(zone.elements);
const dark = zone.darkWater;
/** The predators the one-leg run times: the cormorants and the mud turtles, with the rock and the tule they cannot see through. */
const timedSource = {
  safeArea: zone.safeArea,
  tilapiaRoutes: [],
  predatorRoutes: zone.predatorRoutes.filter((route) => route.species.id === CORMORANT_SPECIES.id || route.species.id === MUD_TURTLE_SPECIES.id),
  rockWalls: walls,
  reedPatches: zone.reedPatches,
  pads: zone.pads,
  cave: zone.cave,
};
const encounterCtx = createEncounterContext({ bounds, tilapia: zone.tilapia });
/** Every light out: each timer run down to 0 (ND-7). */
const FADED_TIMERS: FadingLightTimers = Object.fromEntries(lights.map((light) => [light.id, 0]));
/** Every light fully lit: each timer at its full time from a touch (ND-7). */
const LIT_TIMERS: FadingLightTimers = Object.fromEntries(lights.map((light) => [light.id, FADING_LIGHTS.fullFor + FADING_LIGHTS.dimFor]));
const LIGHT_STATES: readonly [string, FadingLightTimers][] = [
  ['every light fully lit', LIT_TIMERS],
  ['every light faded', FADED_TIMERS],
];
let floodedWater: { reached: boolean[]; open: boolean[]; columns: number; rows: number } | null = null;

/**
 * The result of a one-leg run: its seconds, or null when hit or over the limit, what hit it, which
 * predators warned and which struck, in order, and any part the dark hid that the run reads.
 */
interface OneLegRun {
  seconds: number | null;
  hitBy: string | null;
  warnings: string[];
  strikes: string[];
  hidden: string[];
}

/** The encounter of the timed predators, stepped `seconds` with the axolotl waiting at the Home Spot. */
function warmEncounter(seconds: number): EncounterState {
  let encounter = createEncounter(timedSource);
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame++) encounter = stepEncounter(encounter, zone.start, FRAME, encounterCtx).state;
  return encounter;
}

/** One frame of a one-leg swim steered by `steer`, slowed in the tule, stopped at the rock. */
function swimFrame(state: SwimState, steer: Point): SwimState {
  const pos = { x: state.x, y: state.y };
  const env = { current: { x: 0, y: 0 }, dragMul: reedDragAt(pos, zone.reedPatches), bounds, dashing: false };
  const swum = stepSwim(state, steer, env, FRAME, legSwimTuning(1));
  const blocked = blockAtRock(pos, swum, walls);
  return { ...swum, x: blocked.x, y: blocked.y, vx: blocked.x === swum.x ? swum.vx : 0, vy: blocked.y === swum.y ? swum.vy : 0 };
}

/** Each part the one-leg run reads, where it is this frame: the axolotl, the exit, the Home Spot, every predator and every light. */
function runParts(pos: Point, encounter: EncounterState): [DarkWaterPart, Point, string][] {
  return [
    ['axolotl', pos, 'axolotl'],
    ['exit', exit, 'exit'],
    ['home-spot', zone.homeSpot, 'home-spot'],
    ...encounter.predators.map((predator): [DarkWaterPart, Point, string] => [predator.phase === 'telegraph' ? 'warning' : 'predator', predator.pos, predator.routeId]),
    ...lights.map((light): [DarkWaterPart, Point, string] => ['fading-light', light.fadingLight, light.id]),
  ];
}

/**
 * A one-leg swim of the main path from the Home Spot to the exit, leaving at element time `start`,
 * every pelican scoop, cormorant and mud turtle timed. Each frame it checks that the dark, under
 * the lights of `timers`, shows every part the run reads; the lights change nothing else.
 */
function oneLegRun(start: number, timers: FadingLightTimers): OneLegRun {
  const circles: DarkLight[] = fadingLightCircles(zone.elements, timers, false);
  let encounter = warmEncounter(start);
  let state: SwimState = { x: zone.start.x, y: zone.start.y, vx: 0, vy: 0, facing: -1 };
  const targets = zone.mainPath.slice(1);
  const warnings: string[] = [];
  const strikes: string[] = [];
  const hidden = new Set<string>();
  let next = 0;
  for (let frame = 0; frame < Math.round(BEAT_MAX_SECONDS / FRAME); frame++) {
    const t = start + frame * FRAME;
    const pos = { x: state.x, y: state.y };
    for (const [part, at, id] of runParts(pos, encounter)) if (!shownInDark(part, at, dark, circles)) hidden.add(id);
    if (next === targets.length - 1 && Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius) return { seconds: frame * FRAME, hitBy: null, warnings, strikes, hidden: [...hidden] };
    const scoop = lines.find((line) => pelicanScoopHit(line, pos, t) !== null);
    if (scoop) return { seconds: null, hitBy: scoop.id, warnings, strikes, hidden: [...hidden] };
    const target = targets[next];
    if (next < targets.length - 1 && Math.hypot(target.x - pos.x, target.y - pos.y) <= WAYPOINT_REACH) {
      next++;
      continue;
    }
    state = swimFrame(state, normalize({ x: target.x - pos.x, y: target.y - pos.y }));
    const result = stepEncounter(encounter, { x: state.x, y: state.y }, FRAME, encounterCtx);
    encounter = result.state;
    for (const event of result.events) {
      if (event.type === 'telegraph') warnings.push(event.sourceId);
      if (event.type === 'lunge') strikes.push(event.sourceId);
      if (event.type === 'hit') return { seconds: null, hitBy: event.sourceId, warnings, strikes, hidden: [...hidden] };
    }
  }
  return { seconds: null, hitBy: null, warnings, strikes, hidden: [...hidden] };
}

/** The water grid every FLOOD_STEP px over the swim bounds, flooded from the Home Spot through every place the body fits. */
function floodWater(): { reached: boolean[]; open: boolean[]; columns: number; rows: number } {
  if (floodedWater) return floodedWater;
  const columns = Math.floor((bounds.maxX - bounds.minX) / FLOOD_STEP) + 1;
  const rows = Math.floor((bounds.maxY - bounds.minY) / FLOOD_STEP) + 1;
  const open = Array.from({ length: columns * rows }, (_, cell) => !bodyInAnyRock(gridPoint(cell, columns), walls));
  const reached = open.map(() => false);
  const queue = [nearestCell(zone.start, columns)];
  reached[queue[0]] = true;
  for (let index = 0; index < queue.length; index++) {
    for (const next of gridNeighbours(queue[index], columns, rows)) {
      if (!open[next] || reached[next]) continue;
      reached[next] = true;
      queue.push(next);
    }
  }
  floodedWater = { reached, open, columns, rows };
  return floodedWater;
}

/** The world point of grid cell `cell`. */
function gridPoint(cell: number, columns: number): Point {
  return { x: bounds.minX + (cell % columns) * FLOOD_STEP, y: bounds.minY + Math.floor(cell / columns) * FLOOD_STEP };
}

/** The grid cell nearest a point in the swim bounds. */
function nearestCell(point: Point, columns: number): number {
  const column = Math.round((Math.min(Math.max(point.x, bounds.minX), bounds.maxX) - bounds.minX) / FLOOD_STEP);
  const row = Math.round((Math.min(Math.max(point.y, bounds.minY), bounds.maxY) - bounds.minY) / FLOOD_STEP);
  return row * columns + Math.min(column, columns - 1);
}

/** The up to four cells next to `cell`. */
function gridNeighbours(cell: number, columns: number, rows: number): number[] {
  const [row, column] = [Math.floor(cell / columns), cell % columns];
  const steps = [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1],
  ];
  return steps.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < columns).map(([r, c]) => r * columns + c);
}

/** Whether a point is in the swim bounds, out of the rock, and the flood from the Home Spot reaches a body place within one grid step of it. */
function inJoinedWater(point: Point): boolean {
  const inBounds = point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
  if (!inBounds || walls.some((wall) => point.x >= wall.x0 && point.x <= wall.x1 && point.y >= wall.y0 && point.y <= wall.y1)) return false;
  const { reached, columns, rows } = floodWater();
  const centre = nearestCell(point, columns);
  const [row, column] = [Math.floor(centre / columns), centre % columns];
  for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
    for (let c = Math.max(0, column - 1); c <= Math.min(columns - 1, column + 1); c++) if (reached[r * columns + c]) return true;
  }
  return false;
}

/** Every place a trip must reach, by name: each mobile snack home point, spot, stranding place, light, the Home Spot and the exit. */
function placesToReach(layout: ZoneLayout): [string, Point][] {
  const homes = [...(layout.mobileSnacks?.wanders ?? []), ...(layout.mobileSnacks?.homes ?? [])].flatMap((home) => home.points);
  return [
    ...homes.map((point): [string, Point] => [`snack home at ${point.x}, ${point.y}`, point]),
    ...layout.spots.map((spot): [string, Point] => [spot.id, spot]),
    ...layout.strandingPlaces.map((place): [string, Point] => [place.id, place]),
    ...lights.map((light): [string, Point] => [light.id, light.fadingLight]),
    ['home-spot', layout.homeSpot],
    ['exit', exit],
  ];
}

describe('Area 13 water joined to the Home Spot', () => {
  it('floods every place the body fits from the Home Spot: no water area is cut off', () => {
    const { reached, open } = floodWater();
    const openCells = open.filter(Boolean).length;
    expect(openCells).toBeGreaterThan(0);
    expect(reached.filter(Boolean).length).toBe(openCells);
  });

  it.each(ALL_SEEDS)('puts every snack start in water joined to the Home Spot, none in rock, for seed %i', (seed) => {
    for (const snack of buildZone(OPEN_LAKE_2_LAYOUT, seed).collectibles) expect(inJoinedWater(snack), snack.id).toBe(true);
  });

  it('puts every mobile snack home, spot, stranding place, light, the Home Spot and the exit in water joined to the Home Spot', () => {
    for (const [name, point] of placesToReach(zone)) expect(inJoinedWater(point), name).toBe(true);
  });
});

describe.each(LIGHT_STATES)('Area 13 fairness with %s (ND-8, ND-9)', (_, timers) => {
  const circles = fadingLightCircles(zone.elements, timers, false);

  it('never reads light state: the same joined water, every place a trip needs still joined to the Home Spot', () => {
    const { reached, open } = floodWater();
    expect(reached.filter(Boolean).length).toBe(open.filter(Boolean).length);
    for (const [name, point] of placesToReach(zone)) expect(inJoinedWater(point), name).toBe(true);
  });

  it('lets a one-leg axolotl swim the main path from the Home Spot to the exit in under 180 s, timing each pelican scoop, cormorant dive and mud turtle snap, with every part it reads shown in the dark', () => {
    const run = oneLegRun(ONE_LEG_RUN.start, timers);
    expect(run.hitBy, 'the measured run is hit').toBeNull();
    expect(run.seconds).toBeCloseTo(ONE_LEG_RUN.seconds, 1);
    expect(run.seconds ?? Infinity).toBeLessThan(BEAT_MAX_SECONDS);
    expect(run.warnings).toEqual(ONE_LEG_RUN.warnings);
    expect(run.strikes).toEqual(ONE_LEG_RUN.strikes);
    expect(run.hidden).toEqual([]);
  });

  it('hides only scenery, snacks and treasure in the dark, and only where no light reaches', () => {
    expect(DARK_HIDDEN_PARTS).toEqual(['scenery', 'snack', 'treasure-spot', 'hint-sparkle', 'find']);
    expect(DARK_SHOWN_PARTS).toEqual(expect.arrayContaining(['axolotl', 'exit', 'home-spot', 'predator', 'warning', 'fading-light']));
    const lit = (point: Point) => circles.some((light) => Math.hypot(point.x - light.x, point.y - light.y) <= light.radius);
    for (const snack of zone.collectibles) {
      const inDark = dark !== undefined && inDarkWater(snack, dark);
      expect(shownInDark('snack', snack, dark, circles), snack.id).toBe(!inDark || lit(snack));
    }
    for (const spot of zone.spots) {
      const inDark = dark !== undefined && inDarkWater(spot, dark);
      expect(shownInDark('treasure-spot', spot, dark, circles), spot.id).toBe(!inDark || lit(spot));
    }
    for (const route of [...zone.tilapiaRoutes, ...zone.predatorRoutes]) {
      for (const point of route.waypoints) expect(shownInDark('predator', point, dark, circles), route.id).toBe(true);
    }
    expect(shownInDark('exit', exit, dark, circles)).toBe(true);
    for (const light of lights) expect(shownInDark('fading-light', light.fadingLight, dark, circles), light.id).toBe(true);
  });
});

describe('Area 13 dark pit with every light faded', () => {
  it('gives no light at all, so every spot in the pit is hidden until a light is lit', () => {
    expect(fadingLightCircles(zone.elements, FADED_TIMERS, false)).toEqual([]);
    const deep = zone.spots.filter((spot) => dark !== undefined && inDarkWater(spot, dark));
    expect(deep.length).toBeGreaterThan(0);
    for (const spot of deep) expect(shownInDark('treasure-spot', spot, dark, []), spot.id).toBe(false);
    for (const spot of deep) expect(shownInDark('treasure-spot', spot, dark, fadingLightCircles(zone.elements, LIT_TIMERS, false)), spot.id).toBe(true);
  });
});
