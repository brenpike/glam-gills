import { describe, expect, it } from 'vitest';
import {
  QUIET_GRID_STEP,
  carpCount,
  carpTarget,
  depthBands,
  floorQuietStretch,
  hasSurfaceDanger,
  longestQuietStretch,
  longestQuietSwim,
  meetsDepthRule,
  meetsFloorRule,
  meetsFullDangerBar,
  meetsRampDangerBar,
  meetsWholeWaterDangerBar,
  meetsWholeWaterRampBar,
  movingHazardTypeCount,
  movingThreatCount,
  predatorTypeCount,
} from './dangerBar';
import { DEV_DANGER_AREA } from './devAreas';
import { PUNTING_POLE, movingHazardSpawn } from './movingHazards';
import {
  CARP_SPECIES,
  GARTER_SNAKE_SPECIES,
  HERON_SPECIES,
  TILAPIA_SPECIES,
  tunedSpecies,
  type PredatorRoute,
  type PredatorSpecies,
} from './predators';
import { CARP, GARTER_SNAKE, TILAPIA, type ChaseTuning } from './tuning';
import {
  DEFAULT_ZONE_SEED,
  SCREEN_W,
  SURF,
  WORLD_H,
  areaSize,
  buildZone,
  swimBounds,
  type Point,
  type SafeArea,
  type TilapiaRoute,
  type ZoneLayout,
} from './zone';

const PATH_Y = 200;
const STRIKE = 50;
const LEASH = 30;
const CHASE: ChaseTuning = { sight: 100, leash: LEASH, speed: 125 };
const STILL_TILAPIA = { ...TILAPIA, lungeRange: STRIKE };
const CHASING_TILAPIA = { ...STILL_TILAPIA, chase: CHASE };
const STILL_CARP = tunedSpecies(CARP_SPECIES, { ...CARP, lungeRange: STRIKE });
const CHASING_CARP = tunedSpecies(CARP_SPECIES, { ...CARP, lungeRange: STRIKE, chase: CHASE });
const CHASING_SNAKE = tunedSpecies(GARTER_SNAKE_SPECIES, { ...GARTER_SNAKE, lungeRange: STRIKE, chase: CHASE });
const POLE_REACH = PUNTING_POLE.halfWidth + PUNTING_POLE.touchReach;
const OTHER_TYPE = { ...PUNTING_POLE, id: 'test-jab' };

type TestLayout = Pick<ZoneLayout, 'width' | 'height' | 'mainPath' | 'tilapiaRoutes' | 'tilapia' | 'predatorRoutes' | 'movingHazards'>;

function line(fromX: number, toX: number): Point[] {
  return [
    { x: fromX, y: PATH_Y },
    { x: toX, y: PATH_Y },
  ];
}

function route(id: string, fromX: number, toX: number): TilapiaRoute {
  return { id, waypoints: line(fromX, toX) };
}

function predatorRoute(id: string, species: Readonly<PredatorSpecies>, fromX: number, toX: number): PredatorRoute {
  return { ...route(id, fromX, toX), species };
}

function pole(id: string, x: number) {
  return movingHazardSpawn(id, PUNTING_POLE, x, 0);
}

function layout(parts: Partial<TestLayout> = {}): TestLayout {
  return { width: 4 * SCREEN_W, height: WORLD_H, mainPath: line(0, 1000), tilapiaRoutes: [], predatorRoutes: [], ...parts };
}

/**
 * Four moving threats over four screens, two species, one moving hazard type, every predator
 * chasing, and a 47 px longest quiet stretch (between the pole's reach and the carp's).
 */
function fullBarLayout(parts: Partial<TestLayout> = {}): TestLayout {
  return layout({
    tilapia: CHASING_TILAPIA,
    tilapiaRoutes: [route('t-1', 0, 100), route('t-2', 300, 500)],
    predatorRoutes: [predatorRoute('carp-1', CHASING_CARP, 800, 900)],
    movingHazards: [pole('test/punting-pole-1', 650)],
    ...parts,
  });
}

/** Two chasing tilapia routes and a 320 px longest quiet stretch, at the path end. */
function rampLayout(parts: Partial<TestLayout> = {}): TestLayout {
  return layout({ tilapia: CHASING_TILAPIA, tilapiaRoutes: [route('t-1', 0, 100), route('t-2', 500, 600)], ...parts });
}

describe('movingThreatCount', () => {
  it('counts nothing in an area with no routes and no moving hazards', () => {
    expect(movingThreatCount(layout())).toBe(0);
  });

  it('counts each tilapia route, each other predator route and each moving hazard spawn once', () => {
    const counted = layout({
      tilapiaRoutes: [route('t-1', 0, 100), route('t-2', 200, 300)],
      predatorRoutes: [predatorRoute('carp-1', CHASING_CARP, 400, 500)],
      movingHazards: [pole('p-1', 600), pole('p-2', 700)],
    });
    expect(movingThreatCount(counted)).toBe(5);
  });
});

describe('predatorTypeCount', () => {
  it('counts no species in an area with no routes', () => {
    expect(predatorTypeCount(layout())).toBe(0);
  });

  it('counts the tilapia once however many tilapia routes there are', () => {
    expect(predatorTypeCount(layout({ tilapiaRoutes: [route('t-1', 0, 100), route('t-2', 200, 300)] }))).toBe(1);
  });

  it('counts a tuned tilapia on a predator route as the tilapia', () => {
    const tuned = tunedSpecies(TILAPIA_SPECIES, CHASING_TILAPIA);
    expect(predatorTypeCount(layout({ tilapiaRoutes: [route('t-1', 0, 100)], predatorRoutes: [predatorRoute('t-9', tuned, 200, 300)] }))).toBe(1);
  });

  it('counts distinct species by id, with or without the tilapia', () => {
    const routes = [predatorRoute('carp-1', CHASING_CARP, 0, 100), predatorRoute('carp-2', STILL_CARP, 200, 300), predatorRoute('snake-1', CHASING_SNAKE, 400, 500)];
    expect(predatorTypeCount(layout({ tilapiaRoutes: [route('t-1', 600, 700)], predatorRoutes: routes }))).toBe(3);
    expect(predatorTypeCount(layout({ predatorRoutes: routes }))).toBe(2);
  });
});

describe('movingHazardTypeCount', () => {
  it('counts no types when the area has no moving hazards', () => {
    expect(movingHazardTypeCount(layout())).toBe(0);
    expect(movingHazardTypeCount(layout({ movingHazards: [] }))).toBe(0);
  });

  it('counts distinct types by id', () => {
    expect(movingHazardTypeCount(layout({ movingHazards: [pole('p-1', 100), pole('p-2', 300)] }))).toBe(1);
    const mixed = [pole('p-1', 100), movingHazardSpawn('j-1', OTHER_TYPE, 300, 0)];
    expect(movingHazardTypeCount(layout({ movingHazards: mixed }))).toBe(2);
  });
});

describe('longestQuietStretch', () => {
  it('gives the whole path length when nothing is in reach, across every segment', () => {
    expect(longestQuietStretch(layout())).toBe(1000);
    const bent = [
      { x: 0, y: PATH_Y },
      { x: 300, y: PATH_Y },
      { x: 300, y: PATH_Y + 400 },
    ];
    expect(longestQuietStretch(layout({ mainPath: bent }))).toBe(700);
  });

  it('gives 0 when every sample is in reach, and for a one-point path', () => {
    expect(longestQuietStretch(layout({ tilapia: STILL_TILAPIA, tilapiaRoutes: [route('t-1', 0, 1000)] }))).toBe(0);
    expect(longestQuietStretch(layout({ mainPath: [{ x: 10, y: PATH_Y }] }))).toBe(0);
  });

  it('throws when the main path has no points', () => {
    expect(() => longestQuietStretch(layout({ mainPath: [] }))).toThrow(Error);
  });

  it('measures a tilapia by the area tuning, and by TILAPIA when the area has none', () => {
    expect(longestQuietStretch(layout({ tilapia: STILL_TILAPIA, tilapiaRoutes: [route('t-1', 300, 500)] }))).toBe(500 - STRIKE);
    expect(longestQuietStretch(layout({ tilapiaRoutes: [route('t-1', 300, 500)] }))).toBe(500 - TILAPIA.lungeRange);
  });

  it('adds the leash for a tilapia whose area tuning chases', () => {
    expect(longestQuietStretch(layout({ tilapia: CHASING_TILAPIA, tilapiaRoutes: [route('t-1', 300, 500)] }))).toBe(500 - STRIKE - LEASH);
  });

  it('adds the leash only for another predator whose tuning chases', () => {
    expect(longestQuietStretch(layout({ predatorRoutes: [predatorRoute('carp-1', STILL_CARP, 300, 500)] }))).toBe(500 - STRIKE);
    expect(longestQuietStretch(layout({ predatorRoutes: [predatorRoute('carp-1', CHASING_CARP, 300, 500)] }))).toBe(500 - STRIKE - LEASH);
  });

  it('counts the leash as 0 for a warn-on-route species, whatever its chase says', () => {
    expect(longestQuietStretch(layout({ predatorRoutes: [predatorRoute('snake-1', CHASING_SNAKE, 300, 500)] }))).toBe(500 - STRIKE);
  });

  it('keeps a moving hazard in reach within its touch reach of its sweep', () => {
    expect(longestQuietStretch(layout({ movingHazards: [pole('p-1', 200)] }))).toBe(1000 - 200 - POLE_REACH);
    const shallow = movingHazardSpawn('p-1', PUNTING_POLE, 200, 0, PATH_Y - SURF - PUNTING_POLE.touchReach - 1);
    expect(longestQuietStretch(layout({ movingHazards: [shallow] }))).toBe(1000);
  });

  it('measures a stretch between two threats from reach edge to reach edge', () => {
    const split = layout({ tilapia: STILL_TILAPIA, tilapiaRoutes: [route('t-1', 0, 100), route('t-2', 700, 1000)] });
    expect(longestQuietStretch(split)).toBe(700 - STRIKE - (100 + STRIKE));
  });
});

describe('meetsFullDangerBar', () => {
  it('passes an area that meets every condition', () => {
    expect(meetsFullDangerBar(fullBarLayout())).toBe(true);
  });

  it('passes with a warn-on-route species that has a chase as the second species', () => {
    expect(meetsFullDangerBar(fullBarLayout({ predatorRoutes: [predatorRoute('snake-1', CHASING_SNAKE, 800, 900)] }))).toBe(true);
  });

  it('asks for at least 0.75 moving threats per screen, rounded up, screens being width and height over one screen', () => {
    expect(meetsFullDangerBar(fullBarLayout({ width: 5 * SCREEN_W }))).toBe(true);
    expect(meetsFullDangerBar(fullBarLayout({ width: 6 * SCREEN_W }))).toBe(false);
    expect(meetsFullDangerBar(fullBarLayout({ height: 2 * WORLD_H }))).toBe(false);
  });

  it('fails with one predator species', () => {
    const tilapiaOnly = tunedSpecies(TILAPIA_SPECIES, CHASING_TILAPIA);
    expect(meetsFullDangerBar(fullBarLayout({ predatorRoutes: [predatorRoute('t-9', tilapiaOnly, 800, 900)] }))).toBe(false);
  });

  it('fails with no moving hazard type', () => {
    expect(meetsFullDangerBar(fullBarLayout({ movingHazards: [] }))).toBe(false);
  });

  it('fails when the area tilapia tuning has no chase, or the area has none', () => {
    expect(meetsFullDangerBar(fullBarLayout({ tilapia: STILL_TILAPIA }))).toBe(false);
    expect(meetsFullDangerBar({ ...fullBarLayout(), tilapia: undefined })).toBe(false);
  });

  it('fails when another predator has no chase, the heron included', () => {
    expect(meetsFullDangerBar(fullBarLayout({ predatorRoutes: [predatorRoute('carp-1', STILL_CARP, 800, 900)] }))).toBe(false);
    const withHeron = [predatorRoute('carp-1', CHASING_CARP, 800, 900), predatorRoute('heron-1', HERON_SPECIES, 900, 1000)];
    expect(meetsFullDangerBar(fullBarLayout({ predatorRoutes: withHeron }))).toBe(false);
  });

  it('allows a longest quiet stretch of exactly one screen, and fails a longer one', () => {
    expect(meetsFullDangerBar(fullBarLayout({ mainPath: line(0, 980 + SCREEN_W) }))).toBe(true);
    expect(meetsFullDangerBar(fullBarLayout({ mainPath: line(0, 981 + SCREEN_W) }))).toBe(false);
  });
});

describe('meetsRampDangerBar', () => {
  it('passes Areas 2 and 3 with the tilapia chase, a short quiet stretch and no moving hazard', () => {
    expect(meetsRampDangerBar(2, rampLayout())).toBe(true);
    expect(meetsRampDangerBar(3, rampLayout())).toBe(true);
  });

  it('fails without the tilapia chase, or with no tilapia route', () => {
    expect(meetsRampDangerBar(2, rampLayout({ tilapia: STILL_TILAPIA }))).toBe(false);
    const carpOnly = rampLayout({ tilapiaRoutes: [], predatorRoutes: [predatorRoute('carp-1', CHASING_CARP, 0, 100), predatorRoute('carp-2', CHASING_CARP, 500, 600)] });
    expect(meetsRampDangerBar(3, carpOnly)).toBe(false);
  });

  it('fails a quiet stretch longer than one screen', () => {
    expect(meetsRampDangerBar(2, rampLayout({ mainPath: line(0, 680 + SCREEN_W) }))).toBe(true);
    expect(meetsRampDangerBar(2, rampLayout({ mainPath: line(0, 681 + SCREEN_W) }))).toBe(false);
  });

  it('allows no moving hazard type in Area 2 and at most one in Area 3', () => {
    const onePole = rampLayout({ movingHazards: [pole('p-1', 300), pole('p-2', 800)] });
    expect(meetsRampDangerBar(2, onePole)).toBe(false);
    expect(meetsRampDangerBar(3, onePole)).toBe(true);
    const twoTypes = rampLayout({ movingHazards: [pole('p-1', 300), movingHazardSpawn('j-1', OTHER_TYPE, 800, 0)] });
    expect(meetsRampDangerBar(3, twoTypes)).toBe(false);
  });

  it('throws a RangeError for an area without a ramp bar', () => {
    expect(() => meetsRampDangerBar(1, rampLayout())).toThrow(RangeError);
    expect(() => meetsRampDangerBar(4, rampLayout())).toThrow(RangeError);
  });
});

/**
 * The dev danger area (PRD open question 262, ND-15) shows every danger part but does not meet the
 * full bar: 6 moving threats over 12 screens, where the bar asks for 9, and a 899 px quiet stretch
 * from the second pole's reach, down the dive and along the bottom row to the last tilapia's reach.
 */
describe('the dev danger area', () => {
  const zone = buildZone(DEV_DANGER_AREA.layout, DEFAULT_ZONE_SEED);

  it('has 6 moving threats: two tilapia, a garter snake, a carp and two punting poles', () => {
    expect(movingThreatCount(zone)).toBe(6);
  });

  it('has 3 predator species and 1 moving hazard type', () => {
    expect(predatorTypeCount(zone)).toBe(3);
    expect(movingHazardTypeCount(zone)).toBe(1);
  });

  it('has a longest quiet stretch of about 899 px', () => {
    expect(longestQuietStretch(zone)).toBeCloseTo(899.16, 2);
  });

  it('does not meet the full danger bar: 9 moving threats are asked for over 12 screens, and the quiet stretch is over one screen', () => {
    expect(meetsFullDangerBar(zone)).toBe(false);
    expect(meetsFullDangerBar({ ...zone, width: 2 * SCREEN_W, height: WORLD_H })).toBe(false);
    expect(meetsFullDangerBar({ ...zone, width: 2 * SCREEN_W, height: WORLD_H, mainPath: zone.mainPath.slice(0, 3) })).toBe(true);
  });
});

/** Everything the whole-water measures read: the threats, the area's size and its safe area (issue #130, ND-2). */
type WaterLayout = Pick<
  ZoneLayout,
  'width' | 'height' | 'bedTop' | 'safeArea' | 'tilapiaRoutes' | 'tilapia' | 'predatorRoutes' | 'movingHazards'
>;

/** Lunge range in px wide enough for a few loops to cover the water. */
const WIDE_STRIKE = 100;
const WIDE_TILAPIA = { ...TILAPIA, lungeRange: WIDE_STRIKE };
const TALL_SHAPE = areaSize(1, 3);
const OFF_WATER: SafeArea = { x0: -200, x1: -100, y0: 0, y1: 0 };
const ONE_SCREEN = areaSize(1, 1);
const DIAGONAL = QUIET_GRID_STEP * Math.SQRT2;
const OTHER_SPECIES = { ...CHASING_CARP, id: 'test-pike' };

/** Water with an 8 px grid that is 300 px tall, so its depth bands are 94–194, 194–294 and 294–394. */
const EVEN_BANDS = { width: 2 * SCREEN_W, bedTop: 416 };

/** A loop around the rectangle from (x0, y0) to (x1, y1). */
function loop(x0: number, x1: number, y0: number, y1: number): Point[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/** A there-and-back route between two points. */
function segment(from: Point, to: Point): Point[] {
  return [from, to];
}

function tilapiaLoop(id: string, waypoints: Point[]): TilapiaRoute {
  return { id, waypoints };
}

function predatorLoop(id: string, species: Readonly<PredatorSpecies>, waypoints: Point[]): PredatorRoute {
  return { id, waypoints, species };
}

/** A route across the whole height of the water at `x`, from above the surface to below the bed. */
function upright(x: number): Point[] {
  return segment({ x, y: 0 }, { x, y: 1200 });
}

/** A route across the water at height `y`, from `fromX` to `toX`. */
function across(fromX: number, toX: number, y: number): Point[] {
  return segment({ x: fromX, y }, { x: toX, y });
}

/** Two screens across and one down, the safe area off the water and no threats unless given. */
function water(parts: Partial<WaterLayout> = {}): WaterLayout {
  return { ...areaSize(2, 1), safeArea: OFF_WATER, tilapiaRoutes: [], predatorRoutes: [], ...parts };
}

/**
 * Three screens across: a chasing tilapia loop and a chasing carp loop spanning all three depth
 * bands, a punting pole and a home safe area. With `gap` 0 every point of the water is in reach; a
 * larger gap moves the carp loop's left side right, opening a quiet gap `gap` − 40 px wide.
 */
function wholeBarWater(gap = 0, parts: Partial<WaterLayout> = {}): WaterLayout {
  return {
    ...areaSize(3, 1),
    safeArea: { x0: 40, x1: 100, y0: SURF, y1: ONE_SCREEN.bedTop },
    tilapia: CHASING_TILAPIA,
    tilapiaRoutes: [tilapiaLoop('t-1', loop(100, 400, 120, 270))],
    predatorRoutes: [predatorLoop('carp-1', CHASING_CARP, loop(520 + gap, 1360, 120, 270))],
    movingHazards: [pole('p-1', 460)],
    ...parts,
  };
}

/** Fourteen punting poles reaching the bed, 40 px apart from x 500: together they cover x 477 to 1043 from the surface down. */
function deepPoles() {
  return Array.from({ length: 14 }, (_, index) => movingHazardSpawn(`p-${index}`, PUNTING_POLE, 500 + 40 * index, 0, 240));
}

/** The whole-bar water with no moving hazard, for the ramp bar. */
function rampWater(gap = 0, parts: Partial<WaterLayout> = {}): WaterLayout {
  return wholeBarWater(gap, { movingHazards: [], ...parts });
}

/** The longest quiet stretch along each grid row of the water as a main path, today's measure. */
function longestLaneStretch(layout: WaterLayout): number {
  const { minX, maxX, minY, maxY } = swimBounds(layout);
  const rows = Array.from({ length: Math.floor((maxY - minY) / QUIET_GRID_STEP) + 1 }, (_, row) => minY + row * QUIET_GRID_STEP);
  return Math.max(...[...rows, maxY].map((y) => longestQuietStretch({ ...layout, mainPath: across(minX, maxX, y) })));
}

describe('longestQuietSwim', () => {
  it('runs from edge to edge when all the water is quiet, the last row sitting on the water edge', () => {
    const swim = longestQuietSwim(water());
    expect(swim?.length).toBeCloseTo(25 * DIAGONAL + Math.hypot(QUIET_GRID_STEP, 2) + 84 * QUIET_GRID_STEP, 6);
  });

  it('gives null when no point of the water is quiet', () => {
    expect(longestQuietSwim(wholeBarWater())).toBeNull();
  });

  it('gives the end points of the longest swim: from the farthest home point to the far corner', () => {
    const swim = longestQuietSwim(water({ safeArea: { x0: 40, x1: 200, y0: SURF, y1: 150 } }));
    expect(swim?.from).toEqual({ x: 40, y: 150 });
    expect(swim?.to).toEqual({ x: 920, y: 296 });
    expect(swim?.length).toBeCloseTo(18 * DIAGONAL + Math.hypot(QUIET_GRID_STEP, 2) + 91 * QUIET_GRID_STEP, 6);
  });

  it('never counts the safe area as quiet: it is home, where swims start', () => {
    expect(longestQuietSwim(water({ safeArea: { x0: 0, x1: 2000, y0: 0, y1: 1000 } }))).toBeNull();
    const swim = longestQuietSwim(water({ safeArea: { x0: 400, x1: 560, y0: SURF, y1: ONE_SCREEN.bedTop } }));
    expect(swim?.length).toBeCloseTo(25 * DIAGONAL + Math.hypot(QUIET_GRID_STEP, 2) + 19 * QUIET_GRID_STEP, 6);
    expect([400, 560]).toContain(swim?.from.x);
  });

  it('fails a quiet floor lane that a tilapia above leaves open', () => {
    const above = water({ tilapia: CHASING_TILAPIA, tilapiaRoutes: [tilapiaLoop('t-1', across(0, 1000, 150))] });
    expect(longestQuietSwim(above)?.length).toBeGreaterThan(SCREEN_W);
    const floor = tilapiaLoop('t-2', across(0, 1000, 270));
    expect(longestQuietSwim({ ...above, tilapiaRoutes: [...above.tilapiaRoutes, floor] })).toBeNull();
  });

  it('fails a slanting quiet swim while every horizontal lane passes', () => {
    const centres = [-732, -452, -172, 108, 492, 772, 1052];
    const routes = centres.map((x, index) => tilapiaLoop(`t-${index}`, segment({ x: x - 200, y: -106 }, { x: x + 800, y: 894 })));
    const slanting = water({ ...areaSize(2, 2), tilapia: WIDE_TILAPIA, tilapiaRoutes: routes });
    expect(longestLaneStretch(slanting)).toBeLessThanOrEqual(SCREEN_W);
    expect(longestQuietSwim(slanting)?.length).toBeGreaterThan(SCREEN_W);
  });

  it('fails an up-and-down quiet swim in a three-screen-tall water while every horizontal lane passes', () => {
    const routes = [tilapiaLoop('t-1', upright(100)), tilapiaLoop('t-2', upright(380))];
    const tall = water({ ...TALL_SHAPE, tilapia: WIDE_TILAPIA, tilapiaRoutes: routes });
    expect(longestLaneStretch(tall)).toBeLessThanOrEqual(SCREEN_W);
    const swim = longestQuietSwim(tall);
    expect(swim?.length).toBeGreaterThan(SCREEN_W);
    expect(Math.abs((swim?.to.y ?? 0) - (swim?.from.y ?? 0))).toBeGreaterThan(SCREEN_W);
  });

  it('counts the leash of a chasing predator, and not of a warn-on-route species', () => {
    const xs = [40, 190, 340, 490, 640, 790, 940];
    const carps = (species: Readonly<PredatorSpecies>) => xs.map((x, index) => predatorLoop(`p-${index}`, species, upright(x)));
    const tilapias = xs.map((x, index) => tilapiaLoop(`t-${index}`, upright(x)));
    expect(longestQuietSwim(water({ tilapia: CHASING_TILAPIA, tilapiaRoutes: tilapias }))).toBeNull();
    expect(longestQuietSwim(water({ tilapia: STILL_TILAPIA, tilapiaRoutes: tilapias }))).not.toBeNull();
    expect(longestQuietSwim(water({ predatorRoutes: carps(CHASING_CARP) }))).toBeNull();
    expect(longestQuietSwim(water({ predatorRoutes: carps(STILL_CARP) }))).not.toBeNull();
    expect(longestQuietSwim(water({ predatorRoutes: carps(CHASING_SNAKE) }))).not.toBeNull();
  });

  it("counts a pole's whole sweep, which the floor rule does not", () => {
    const xs = [20, 120, 220, 320, 420, 540, 640, 740, 840, 940];
    const split = water({ predatorRoutes: xs.map((x, index) => predatorLoop(`carp-${index}`, STILL_CARP, upright(x))) });
    const poled = { ...split, movingHazards: [movingHazardSpawn('p-1', PUNTING_POLE, 480, 0, 240)] };
    expect(longestQuietSwim(split)).not.toBeNull();
    expect(longestQuietSwim(poled)).toBeNull();
    expect(floorQuietStretch(split)).toBe(20);
    expect(floorQuietStretch(poled)).toBe(20);
  });
});

describe('depthBands', () => {
  it('splits one, two and three screens of swim water into three equal bands, top down', () => {
    const tops = (wide: number, tall: number) => depthBands(areaSize(wide, tall)).map((band) => [band.top, band.bottom]);
    const expectBands = (bands: number[][], edges: number[]) =>
      bands.forEach(([top, bottom], index) => {
        expect(top).toBeCloseTo(edges[index], 2);
        expect(bottom).toBeCloseTo(edges[index + 1], 2);
      });
    expectBands(tops(5, 1), [94, 161.33, 228.67, 296]);
    expectBands(tops(6, 2), [94, 281.33, 468.67, 656]);
    expectBands(tops(5, 3), [94, 401.33, 708.67, 1016]);
  });
});

describe('meetsDepthRule', () => {
  const tilapiaBetween = (id: string, y0: number, y1: number) => tilapiaLoop(id, loop(100, 300, y0, y1));
  const rule = (tilapiaRoutes: TilapiaRoute[], predatorRoutes: PredatorRoute[] = []) => meetsDepthRule({ ...EVEN_BANDS, tilapiaRoutes, predatorRoutes });

  it('holds with no tilapia or carp loop', () => {
    expect(rule([])).toBe(true);
    expect(rule([], [predatorLoop('snake-1', CHASING_SNAKE, across(100, 300, 100))])).toBe(true);
  });

  it('(a) asks each loop to reach at least 24 px into at least two bands', () => {
    const lower = tilapiaBetween('t-2', 194, 394);
    expect(rule([tilapiaBetween('t-1', 170, 218), lower])).toBe(true);
    expect(rule([tilapiaBetween('t-1', 171, 218), lower])).toBe(false);
    expect(rule([tilapiaBetween('t-1', 94, 394), tilapiaBetween('t-2', 120, 160)])).toBe(false);
  });

  it("(b) asks each species' loops together to reach at least 24 px into every band", () => {
    expect(rule([tilapiaBetween('t-1', 170, 318)])).toBe(true);
    expect(rule([tilapiaBetween('t-1', 170, 317)])).toBe(false);
    expect(rule([tilapiaBetween('t-1', 94, 218), tilapiaBetween('t-2', 270, 318)])).toBe(true);
    expect(rule([tilapiaBetween('t-1', 94, 218)])).toBe(false);
  });

  it('groups loops by species id: tilapia on predator routes with the tilapia routes, carp on their own', () => {
    const tunedTilapia = tunedSpecies(TILAPIA_SPECIES, CHASING_TILAPIA);
    const upper = tilapiaBetween('t-1', 94, 218);
    expect(rule([upper], [predatorLoop('t-9', tunedTilapia, loop(100, 300, 270, 318))])).toBe(true);
    expect(rule([upper], [predatorLoop('carp-1', CHASING_CARP, loop(100, 300, 270, 318))])).toBe(false);
    expect(rule([], [predatorLoop('carp-1', CHASING_CARP, loop(100, 300, 170, 318))])).toBe(true);
    expect(rule([], [predatorLoop('pike-1', OTHER_SPECIES, loop(100, 300, 170, 171))])).toBe(true);
  });
});

describe('hasSurfaceDanger and the floor rule', () => {
  const snake = predatorLoop('snake-1', CHASING_SNAKE, across(100, 300, 100));
  const tall = tilapiaLoop('t-1', loop(100, 200, 120, 270));

  it('finds surface danger in a moving hazard or a predator route wholly in the surface band, its bottom edge included', () => {
    expect(hasSurfaceDanger(water())).toBe(false);
    expect(hasSurfaceDanger(water({ movingHazards: [pole('p-1', 400)] }))).toBe(true);
    expect(hasSurfaceDanger(water({ predatorRoutes: [snake] }))).toBe(true);
    expect(hasSurfaceDanger(water({ tilapiaRoutes: [tall] }))).toBe(false);
    const edge = (y: number) => hasSurfaceDanger({ ...EVEN_BANDS, tilapiaRoutes: [tilapiaLoop('t-1', across(100, 300, y))], predatorRoutes: [] });
    expect(edge(194)).toBe(true);
    expect(edge(195)).toBe(false);
  });

  it('measures the floor lane with only predators and home as threat points', () => {
    expect(floorQuietStretch(water())).toBe(880);
    expect(floorQuietStretch(water({ movingHazards: [movingHazardSpawn('p-1', PUNTING_POLE, 480, 0, 240)] }))).toBe(880);
    const home = water({ safeArea: { x0: 40, x1: 300, y0: SURF, y1: ONE_SCREEN.bedTop } });
    expect(floorQuietStretch(home)).toBe(620);
    expect(floorQuietStretch({ ...home, predatorRoutes: [predatorLoop('carp-1', STILL_CARP, across(600, 700, 296))] })).toBe(250);
  });

  it('is triggered by a pole and by a snake stretch, and not by a tall tilapia loop', () => {
    expect(meetsFloorRule(water({ tilapiaRoutes: [tall] }))).toBe(true);
    expect(meetsFloorRule(water({ tilapiaRoutes: [tall], movingHazards: [pole('p-1', 400)] }))).toBe(false);
    expect(meetsFloorRule(water({ tilapiaRoutes: [tall], predatorRoutes: [snake] }))).toBe(false);
  });

  it('holds with surface danger when no floor stretch is longer than one screen across', () => {
    const floor = (toX: number) => predatorLoop('carp-1', STILL_CARP, across(40, toX, 296));
    expect(meetsFloorRule(water({ predatorRoutes: [snake, floor(390)] }))).toBe(true);
    expect(floorQuietStretch(water({ predatorRoutes: [snake, floor(389)] }))).toBe(481);
    expect(meetsFloorRule(water({ predatorRoutes: [snake, floor(389)] }))).toBe(false);
  });
});

describe('carpTarget and carpCount', () => {
  it('asks for screens / 3 carp, rounded half up', () => {
    expect([5, 6, 12, 14, 15, 16, 18, 30].map(carpTarget)).toEqual([2, 2, 4, 5, 5, 5, 6, 10]);
    expect(carpTarget(1.5)).toBe(1);
    expect(carpTarget(4.5)).toBe(2);
  });

  it('counts only routes whose species id is the carp', () => {
    expect(carpCount(wholeBarWater())).toBe(1);
    const others = [predatorLoop('carp-2', STILL_CARP, upright(600)), predatorLoop('pike-1', OTHER_SPECIES, upright(700))];
    expect(carpCount({ predatorRoutes: [...wholeBarWater().predatorRoutes, ...others] })).toBe(2);
  });
});

describe('meetsWholeWaterDangerBar', () => {
  it('passes an area that meets every condition', () => {
    expect(meetsWholeWaterDangerBar(wholeBarWater())).toBe(true);
  });

  it('passes exactly when the longest quiet swim is at most one screen across', () => {
    const outcomes = [200, 300, 400, 450, 500].map((gap) => {
      const layout = wholeBarWater(gap);
      expect(meetsWholeWaterDangerBar(layout)).toBe((longestQuietSwim(layout)?.length ?? 0) <= SCREEN_W);
      return meetsWholeWaterDangerBar(layout);
    });
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });

  it('fails the depth, floor or carp rule', () => {
    const flat = tilapiaLoop('t-2', across(100, 400, 130));
    expect(meetsWholeWaterDangerBar(wholeBarWater(0, { tilapiaRoutes: [...wholeBarWater().tilapiaRoutes, flat] }))).toBe(false);
    const covered = wholeBarWater(600, { movingHazards: deepPoles() });
    expect(longestQuietSwim(covered)).toBeNull();
    expect(meetsWholeWaterDangerBar(covered)).toBe(false);
    const pike = predatorLoop('pike-1', OTHER_SPECIES, loop(520, 1360, 120, 270));
    expect(meetsWholeWaterDangerBar(wholeBarWater(0, { predatorRoutes: [pike] }))).toBe(false);
  });

  it("keeps the full bar's threat count, species, moving hazard and chase checks", () => {
    expect(meetsWholeWaterDangerBar(wholeBarWater(0, { movingHazards: [] }))).toBe(false);
    expect(meetsWholeWaterDangerBar(wholeBarWater(0, { tilapia: STILL_TILAPIA }))).toBe(false);
    expect(meetsWholeWaterDangerBar(wholeBarWater(0, { height: 2 * WORLD_H }))).toBe(false);
    const tunedTilapia = tunedSpecies(TILAPIA_SPECIES, CHASING_TILAPIA);
    expect(meetsWholeWaterDangerBar(wholeBarWater(0, { predatorRoutes: [predatorLoop('t-9', tunedTilapia, loop(520, 1360, 120, 270))] }))).toBe(false);
  });
});

describe('meetsWholeWaterRampBar', () => {
  it('passes Areas 2 and 3 with the tilapia chase, the whole water in reach and no moving hazard', () => {
    expect(meetsWholeWaterRampBar(2, rampWater())).toBe(true);
    expect(meetsWholeWaterRampBar(3, rampWater())).toBe(true);
  });

  it('passes exactly when the longest quiet swim is at most one screen across', () => {
    const outcomes = [200, 300, 400, 450, 500].map((gap) => {
      const layout = rampWater(gap);
      expect(meetsWholeWaterRampBar(2, layout)).toBe((longestQuietSwim(layout)?.length ?? 0) <= SCREEN_W);
      return meetsWholeWaterRampBar(2, layout);
    });
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });

  it('allows no moving hazard type in Area 2 and at most one in Area 3', () => {
    const onePole = rampWater(0, { movingHazards: [pole('p-1', 460)] });
    expect(meetsWholeWaterRampBar(2, onePole)).toBe(false);
    expect(meetsWholeWaterRampBar(3, onePole)).toBe(true);
    const twoTypes = rampWater(0, { movingHazards: [pole('p-1', 460), movingHazardSpawn('j-1', OTHER_TYPE, 300, 0)] });
    expect(meetsWholeWaterRampBar(3, twoTypes)).toBe(false);
  });

  it('fails without the tilapia chase or a tilapia route, or with the depth, floor or carp rule failing', () => {
    expect(meetsWholeWaterRampBar(2, rampWater(0, { tilapia: STILL_TILAPIA }))).toBe(false);
    expect(meetsWholeWaterRampBar(2, rampWater(0, { tilapiaRoutes: [] }))).toBe(false);
    const flat = tilapiaLoop('t-2', across(100, 400, 130));
    expect(meetsWholeWaterRampBar(2, rampWater(0, { tilapiaRoutes: [...rampWater().tilapiaRoutes, flat] }))).toBe(false);
    expect(meetsWholeWaterRampBar(3, rampWater(0, { movingHazards: deepPoles() }))).toBe(true);
    const covered = rampWater(600, { movingHazards: deepPoles() });
    expect(longestQuietSwim(covered)).toBeNull();
    expect(meetsWholeWaterRampBar(3, covered)).toBe(false);
    const pike = predatorLoop('pike-1', OTHER_SPECIES, loop(520, 1360, 120, 270));
    expect(meetsWholeWaterRampBar(2, rampWater(0, { predatorRoutes: [pike] }))).toBe(false);
  });

  it('throws a RangeError for an area without a ramp bar', () => {
    expect(() => meetsWholeWaterRampBar(1, rampWater())).toThrow(RangeError);
    expect(() => meetsWholeWaterRampBar(4, rampWater())).toThrow(RangeError);
  });
});

/**
 * The dev danger area's whole water (issue #130, ND-9), read from its threats, size and safe area
 * only. It is not expected to meet the new bar: its longest quiet swim runs from the top row to
 * the bottom right corner, its tilapia loops each sit in one band, and it has one carp of 4.
 */
describe('the dev danger area, whole water', () => {
  const zone = buildZone(DEV_DANGER_AREA.layout, DEFAULT_ZONE_SEED);
  const devWater: WaterLayout = {
    width: zone.width,
    height: zone.height,
    bedTop: zone.bedTop,
    safeArea: zone.safeArea,
    tilapiaRoutes: zone.tilapiaRoutes,
    tilapia: zone.tilapia,
    predatorRoutes: zone.predatorRoutes,
    movingHazards: zone.movingHazards,
  };

  it('has a longest quiet swim of about 2235 px, from the top row to the bottom right corner', () => {
    const swim = longestQuietSwim(devWater);
    const bounds = swimBounds(devWater);
    expect(swim?.length).toBeCloseTo(2235.1, 1);
    expect(swim?.from).toEqual({ x: 1048, y: bounds.minY });
    expect(swim?.to).toEqual({ x: bounds.maxX, y: bounds.maxY });
  });

  it('has the two-screen-tall depth bands', () => {
    const bands = depthBands(devWater);
    expect(bands.map((band) => band.top)).toEqual([94, expect.closeTo(281.33, 2), expect.closeTo(468.67, 2)]);
    expect(bands[2].bottom).toBe(656);
  });

  it('fails the depth rule, has surface danger, meets the floor rule and fails the carp rule', () => {
    expect(meetsDepthRule(devWater)).toBe(false);
    expect(hasSurfaceDanger(devWater)).toBe(true);
    expect(floorQuietStretch(devWater)).toBe(445);
    expect(meetsFloorRule(devWater)).toBe(true);
    expect(carpCount(devWater)).toBe(1);
    expect(carpTarget((devWater.width / SCREEN_W) * (devWater.height / WORLD_H))).toBe(4);
  });

  it('does not meet the whole-water danger bar', () => {
    expect(meetsWholeWaterDangerBar(devWater)).toBe(false);
  });
});
