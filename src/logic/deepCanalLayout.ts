/**
 * The deep canal's Area 8 (issue #78), as area data: 8 screens across, 2 down, two lanes. The Home
 * Spot is in the shared pocket on the west side, and the safe area is its column. A solid old-stone
 * divider of rock walls splits the water from x 600 to x 3560 into a surface lane over it and a deep
 * lane under it; the lanes join again in the exit pocket on the east side. The divider runs at
 * y 340 to 380 and steps up to y 188 to 228 for most of a screen over `bass-1`. The surface lane
 * holds the punting poles, the moored boats and the gliding trajineras; the deep lane holds the black
 * bass, the sunken trajinera hull and the side-canal inflow. Each lane has its own tilapia and its
 * share of the carp. The main path runs along the surface lane, under the moored boats, to the exit.
 */
import { DEEP_CANAL_TREASURES } from './catalogue';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import type { RockWall } from './pebble';
import { BLACK_BASS_SPECIES, CARP_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { SPRING_CAVE_2_CARP } from './springCave2Layout';
import { trajineraSpawn, type TrajineraSpawn } from './trajineras';
import { BLACK_BASS, BLACK_BASS_CHASE, TILAPIA, TILAPIA_CHASE, type TilapiaTuning } from './tuning';
import { SURF, WORLD_H, areaSize, type AreaLayoutData, type BankOverhang, type Point } from './zone';

export const DEEP_CANAL_AREA_ID = 'deep-canal-1';

/** Top of the bed of the bottom row: 678. */
const BED_TOP = areaSize(8, 2).bedTop;

/** Bottom of the water under each moored boat, the bank cover of its spots (B5). */
const MOORED_HULL_Y = 140;

/** Depth in px below the surface of every punting pole's tip: its sweep ends 20 px over the divider. */
const POLE_DEPTH = 240;

/**
 * Area 8's tilapia, one step up the predator ladder from Area 5's (owner, #78, 2026-10-22): a 0.8 s
 * warning, at the 0.8 s floor, a 440 px/s strike reaching 155 px, a 1.8 s cooldown and a 60 px/s
 * patrol, with the full-bar chase. Every other value stays TILAPIA's.
 */
export const DEEP_CANAL_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...TILAPIA,
  windup: 0.8,
  lungeSpeed: 440,
  lungeRange: 155,
  cooldown: 1.8,
  patrolSpeed: 60,
  chase: TILAPIA_CHASE,
});

/**
 * Area 8's common carp, one step up the predator ladder from Area 7's: a 1.7 s cooldown and a 55 px/s
 * patrol, with Area 7's other values and chase, its warning at the 0.8 s floor.
 */
export const DEEP_CANAL_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...SPRING_CAVE_2_CARP.tuning, cooldown: 1.7, patrolSpeed: 55 }),
);

/** Area 8's black bass: the owner's values (BLACK_BASS) with its chase default. */
export const DEEP_CANAL_BASS: Readonly<PredatorSpecies> = tunedSpecies(
  BLACK_BASS_SPECIES,
  Object.freeze({ ...BLACK_BASS, chase: BLACK_BASS_CHASE }),
);

/** Area 8's tadpole rule, the top of the later snack ramp row: 72 px/s, as Area 7's. */
const DEEP_CANAL_TADPOLE = tadpoleRule(72);

/** Area 8's shrimp rule, Area 7's: trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s. */
const DEEP_CANAL_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/**
 * The fourteen tadpole wander loops' turn points, placed after the threats, each clear of the
 * trajineras' hull bands: twelve in the surface lane, under and beside the moored boats in the west,
 * past the raised run and past `carp-1`, three of them over the divider's east end into the top of
 * the exit pocket; and two in the deep lane by the sunken hull.
 */
const DEEP_CANAL_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[650, 100], [970, 100], [940, 250], [780, 182.5]] as const),
  Object.freeze([[700, 256], [1020, 256], [990, 106], [830, 188.5]] as const),
  Object.freeze([[760, 256], [1080, 256], [1050, 106], [890, 188.5]] as const),
  Object.freeze([[880, 100], [1200, 100], [1170, 250], [1010, 182.5]] as const),
  Object.freeze([[2360, 100], [2680, 100], [2650, 250], [2490, 182.5]] as const),
  Object.freeze([[2370, 256], [2690, 256], [2660, 106], [2500, 188.5]] as const),
  Object.freeze([[3070, 100], [3390, 100], [3360, 250], [3200, 182.5]] as const),
  Object.freeze([[3180, 250], [3500, 250], [3470, 100], [3310, 182.5]] as const),
  Object.freeze([[3300, 100], [3620, 100], [3590, 250], [3430, 182.5]] as const),
  Object.freeze([[3420, 256], [3740, 256], [3710, 106], [3550, 188.5]] as const),
  Object.freeze([[3480, 100], [3800, 100], [3770, 250], [3610, 182.5]] as const),
  Object.freeze([[820, 250], [1140, 250], [1110, 100], [950, 182.5]] as const),
  Object.freeze([[650, 640], [970, 640], [940, 490], [780, 572.5]] as const),
  Object.freeze([[840, 648], [1160, 648], [1130, 498], [970, 580.5]] as const),
]);

/**
 * The sixteen shrimp homes' hop spots, each starting on a spot out of every threat's reach and clear
 * of the hull bands: four in the start pocket beside the safe area, three by the west moored boats,
 * two by the sunken hull, three by the middle moored boats, two by the east moored boats and two in
 * the top of the exit pocket, over the exit.
 */
const DEEP_CANAL_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[360, 160], [420, 130], [400, 200]] as const),
  Object.freeze([[360, 280], [420, 250], [400, 320]] as const),
  Object.freeze([[360, 400], [420, 370], [400, 440]] as const),
  Object.freeze([[360, 600], [420, 570], [400, 640]] as const),
  Object.freeze([[880, 130], [860, 200], [820, 160]] as const),
  Object.freeze([[940, 200], [1000, 170], [980, 240]] as const),
  Object.freeze([[1060, 160], [1120, 130], [1100, 200]] as const),
  Object.freeze([[900, 510], [880, 580], [840, 540]] as const),
  Object.freeze([[960, 600], [1020, 570], [1000, 640]] as const),
  Object.freeze([[2460, 130], [2440, 200], [2400, 160]] as const),
  Object.freeze([[2560, 200], [2620, 170], [2600, 240]] as const),
  Object.freeze([[3200, 130], [3180, 200], [3140, 160]] as const),
  Object.freeze([[3300, 200], [3360, 170], [3340, 240]] as const),
  Object.freeze([[3660, 240], [3720, 210], [3700, 280]] as const),
  Object.freeze([[3660, 320], [3720, 290], [3700, 360]] as const),
  Object.freeze([[2620, 160], [2680, 130], [2660, 200]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 8's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / DEEP_CANAL_TADPOLE.speed;
}

/** Tadpole n (from 0) on its wander loop, n parts of its own lap ahead, so the tadpoles are out of step. */
function wanderAt(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(DEEP_CANAL_TADPOLE, points, (index * lapSeconds(points)) / DEEP_CANAL_LOOPS.length);
}

/** The water under one moored boat at the surface, the bank cover (B5). */
function mooredBoat(x0: number, x1: number): Readonly<BankOverhang> {
  return Object.freeze({ x0, x1, y0: SURF, y1: MOORED_HULL_Y });
}

/** One block of the old-stone divider, solid rock (ND-8). */
function dividerStone(x0: number, x1: number, y0: number, y1: number): Readonly<RockWall> {
  return Object.freeze({ x0, x1, y0, y1 });
}

/** One predator's route, id `<name>-<n>`: a closed loop through `points`, each an [x, y] pair. */
function loopRoute(id: string, species: Readonly<PredatorSpecies>, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species });
}

/** One punting pole, id `deep-canal-1/punting-pole-<n>`, at `x`, its cycle starting at `offset` seconds. */
function puntingPoleAt(index: number, x: number, offset: number): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${DEEP_CANAL_AREA_ID}/punting-pole-${index}`, PUNTING_POLE, x, offset, POLE_DEPTH));
}

/** One gliding trajinera, id `deep-canal-1/trajinera-<n>`, crossing x0 to x1 in `direction`. */
function trajineraAt(index: number, offset: number, x0: number, x1: number, direction: 'left' | 'right'): Readonly<TrajineraSpawn> {
  const spawn = trajineraSpawn(`${DEEP_CANAL_AREA_ID}/trajinera-${index}`, offset, { x0, x1, direction });
  Object.freeze(spawn.trajinera);
  return Object.freeze(spawn);
}

/** The moored boats west of `punting-pole-1`: Common spots by the main path, and a Rare spot in its Rare band. */
const MOORED_WEST = mooredBoat(960, 1190);

/** The moored boat between `tilapia-0` and `punting-pole-2`, before the raised run: a Rare spot. */
const MOORED_RAISED = mooredBoat(1740, 1840);

/** The moored boats past the raised run: a Rare spot in `punting-pole-3`'s Rare band, then Common spots. */
const MOORED_MIDDLE = mooredBoat(2320, 2660);

/** The moored boats past `carp-1`, off the main path: Rare spots in `carp-1`'s and `punting-pole-4`'s Rare bands. */
const MOORED_EAST = mooredBoat(3100, 3500);

/**
 * The old-stone divider (the owner's Q3), west to east: two low runs at y 340 to 380, the step up,
 * the raised run at y 188 to 228 over `bass-1`, the step down and two low runs. Every stone is 40 px
 * thick and at most 640 px wide, and each touches the next, so no body passes between the lanes.
 */
const DIVIDER: readonly Readonly<RockWall>[] = Object.freeze([
  dividerStone(600, 1240, 340, 380),
  dividerStone(1240, 1880, 340, 380),
  dividerStone(1880, 1920, 188, 380),
  dividerStone(1920, 2240, 188, 228),
  dividerStone(2240, 2280, 188, 380),
  dividerStone(2280, 2920, 340, 380),
  dividerStone(2920, 3560, 340, 380),
]);

/**
 * The two gliding trajineras (issue #78, ND-8), half a crossing out of step: `trajinera-1` gliding
 * right over `carp-0`'s east side and `tilapia-0`'s west side, `trajinera-2` gliding left over
 * `carp-1`. Each span is 300 px, clear of every pole, every moored boat and the raised run.
 */
const TRAJINERAS: readonly Readonly<TrajineraSpawn>[] = Object.freeze([
  trajineraAt(1, 0, 1250, 1550, 'right'),
  trajineraAt(2, 3, 2700, 3000, 'left'),
]);

/** The deep canal's Area 8, as area data: 8 screens across, 2 down. */
export const DEEP_CANAL_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: DEEP_CANAL_AREA_ID,
  screensWide: 8,
  screensTall: 2,
  start: Object.freeze({ x: 120, y: 360 }),
  /** The Home Spot's column, top to bottom, in the shared pocket where the lanes fork. */
  safeArea: Object.freeze({ x0: 40, x1: 330, y0: SURF, y1: WORLD_H * 2 }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /** The sunken trajinera hull (B6): an open Legendary spot within half `carp-2`'s strike, and an Epic spot farther off. */
  caveSpots: Object.freeze([
    Object.freeze([730, 655, 'legendary', false] as const),
    Object.freeze([790, 610, 'epic', false] as const),
  ]),
  /**
   * Just past the side-canal inflow, on its upstream side: three open Legendary spots within half the
   * bass strike of `bass-0`, then two Epic spots farther off. No Dash pot: each Legendary spot is
   * deep and near a threat (ADR 0032).
   */
  currentSpots: Object.freeze([
    Object.freeze([2990, 484, 'legendary', false] as const),
    Object.freeze([2990, 540, 'legendary', false] as const),
    Object.freeze([2980, 600, 'legendary', false] as const),
    Object.freeze([2920, 560, 'epic', false] as const),
    Object.freeze([2920, 630, 'epic', false] as const),
  ]),
  /** The side-canal inflow on the deep-lane bed, flowing gently left (B6). */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 2760, x1: 2900, y0: 480, y1: 640, force: Object.freeze({ x: -73, y: 0 }) }),
  ]),
  /** The sunken trajinera hull, a dead end on the deep-lane bed east of `carp-2` (B6). */
  cave: Object.freeze({ id: `${DEEP_CANAL_AREA_ID}/cave`, x0: 700, x1: 900, y0: 590, y1: BED_TOP }),
  /**
   * One tilapia in each lane, each loop reaching two depth bands: `tilapia-0` in the surface lane
   * before the raised run, its east point setting the main path's narrowest gap with
   * `punting-pole-2`, and `tilapia-1` in the deep lane.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([1460, 190] as const),
      Object.freeze([1590, 190] as const),
      Object.freeze([1642, 240] as const),
      Object.freeze([1590, 306] as const),
      Object.freeze([1460, 306] as const),
    ]),
    Object.freeze([
      Object.freeze([1200, 420] as const),
      Object.freeze([1340, 420] as const),
      Object.freeze([1340, 620] as const),
      Object.freeze([1200, 620] as const),
    ]),
  ]),
  /**
   * Five carp, each loop reaching two depth bands: `carp-0` and `carp-1` in the surface lane, `carp-0`
   * at the fork; `carp-2`, `carp-3` and `carp-4` in the deep lane, `carp-2` at the fork by the sunken
   * hull. Then both black bass in the deep lane on long open-water routes: `bass-0` by the inflow
   * and the join, and `bass-1` under the raised run, reaching up to y 257 so the bass reach the
   * surface band, 29 px under the raised run. Every loop keeps its body clear of the divider.
   */
  predatorRoutes: Object.freeze([
    loopRoute('carp-0', DEEP_CANAL_CARP, [[560, 130], [700, 130], [700, 306], [560, 306]]),
    loopRoute('carp-1', DEEP_CANAL_CARP, [[2860, 130], [3000, 130], [3000, 306], [2860, 306]]),
    loopRoute('carp-2', DEEP_CANAL_CARP, [[560, 414], [700, 414], [700, 600], [560, 600]]),
    loopRoute('carp-3', DEEP_CANAL_CARP, [[1560, 414], [1700, 414], [1700, 630], [1560, 630]]),
    loopRoute('carp-4', DEEP_CANAL_CARP, [[2480, 414], [2620, 414], [2620, 630], [2480, 630]]),
    loopRoute('bass-0', DEEP_CANAL_BASS, [[3040, 420], [3480, 420], [3480, 620], [3040, 620]]),
    loopRoute('bass-1', DEEP_CANAL_BASS, [[1960, 257], [2200, 257], [2200, 620], [1960, 620]]),
  ]),
  /**
   * Four punting poles in the surface lane, 2 s out of step with the next, each sweep 20 px over the
   * divider, clear of every boat span and every surface loop's strike: `punting-pole-1` past the
   * west moored boats, `punting-pole-2` and `punting-pole-3` either side of the raised run, and
   * `punting-pole-4` by the join.
   */
  movingHazards: Object.freeze([
    puntingPoleAt(1, 1210, 0),
    puntingPoleAt(2, 1856, 2),
    puntingPoleAt(3, 2304, 0),
    puntingPoleAt(4, 3540, 2),
  ]),
  hazards: Object.freeze([]),
  elements: Object.freeze([]),
  /**
   * From the Home Spot up into the surface lane, under the moored boats and the trajineras' hulls,
   * through the gap between `tilapia-0` and `punting-pole-2`, over the raised run and on to the
   * exit on the floor of the exit pocket.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 360 }),
    Object.freeze({ x: 600, y: 165 }),
    Object.freeze({ x: 1720, y: 165 }),
    Object.freeze({ x: 1790, y: 290 }),
    Object.freeze({ x: 1860, y: 165 }),
    Object.freeze({ x: 3640, y: 165 }),
    Object.freeze({ x: 3720, y: 600 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), three in each lane: each at least 80 px from every predator
   * route, clear of every pole sweep by the touch and rescue reach, out of the inflow and the rock.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${DEEP_CANAL_AREA_ID}/strand-1`, x: 960, y: 520 }),
    Object.freeze({ id: `${DEEP_CANAL_AREA_ID}/strand-2`, x: 1060, y: 250 }),
    Object.freeze({ id: `${DEEP_CANAL_AREA_ID}/strand-3`, x: 1450, y: 520 }),
    Object.freeze({ id: `${DEEP_CANAL_AREA_ID}/strand-4`, x: 2340, y: 520 }),
    Object.freeze({ id: `${DEEP_CANAL_AREA_ID}/strand-5`, x: 2560, y: 250 }),
    Object.freeze({ id: `${DEEP_CANAL_AREA_ID}/strand-6`, x: 3300, y: 250 }),
  ]),
  treasures: DEEP_CANAL_TREASURES,
  snackWorms: 8,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  tilapia: DEEP_CANAL_TILAPIA,
  bankOverhangs: Object.freeze([MOORED_WEST, MOORED_RAISED, MOORED_MIDDLE, MOORED_EAST]),
  /** Under the moored boats (B5): Common spots by the main path, Rare spots off it. */
  bankSpots: Object.freeze([
    Object.freeze([990, 120, 'common', false] as const),
    Object.freeze([1046, 120, 'common', false] as const),
    Object.freeze([1102, 120, 'common', false] as const),
    Object.freeze([2420, 120, 'common', false] as const),
    Object.freeze([2480, 120, 'common', false] as const),
    Object.freeze([2540, 120, 'common', false] as const),
    Object.freeze([1160, 104, 'rare', false] as const),
    Object.freeze([1790, 104, 'rare', false] as const),
    Object.freeze([2340, 104, 'rare', false] as const),
    Object.freeze([3150, 112, 'rare', false] as const),
    Object.freeze([3470, 112, 'rare', false] as const),
  ]),
  rockWalls: DIVIDER,
  trajineras: TRAJINERAS,
  /** 14 tadpoles and 16 shrimp to 8 worms and 6 bugs: 30 of 44 snacks mobile, 68% (the later snack ramp row). */
  mobileSnacks: mobileSnackMix({
    tadpole: DEEP_CANAL_TADPOLE,
    wanders: DEEP_CANAL_LOOPS.map(wanderAt),
    shrimp: DEEP_CANAL_SHRIMP,
    homes: DEEP_CANAL_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);
