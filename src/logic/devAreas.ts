/**
 * Dev and test areas: area data that never joins AREAS. Imported only by tests and by the dev
 * build's area flag, so none of it ships in the production build.
 */
import { CANAL_AREA, CHINAMPA_HABITAT, areaById, type AreaData } from './areas';
import { CANAL_TREASURES, CHINAMPA_TREASURES } from './catalogue';
import { GHOST_NET, netDrift } from './ghostNets';
import type { HazardSpawn, NetDrift } from './hazards';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import { CARP_SPECIES, GARTER_SNAKE_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import {
  CARP,
  CARP_CHASE,
  DRIFTING_NETS,
  GARTER_SNAKE,
  GARTER_SNAKE_CHASE,
  TILAPIA,
  TILAPIA_CHASE,
  type TilapiaTuning,
} from './tuning';
import { SURF, type AreaLayoutData, type BankOverhang, type Point } from './zone';

/** Marker string that appears in a build only when this module is bundled. */
export const DEV_AREAS_MARK = 'glam-gills-dev-areas';

const DEV_TEST_AREA_ID = 'dev-test-area';

/**
 * A 6 x 2 screen test area (2880 x 720 world px, bed top 678). The top screen follows the canal's
 * layout up to its cave; the cave, its tilapia and its last reeds sit on the bed of the lower
 * screen, and the main path dives to the exit at the far right of the lower screen.
 */
const DEV_TEST_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: DEV_TEST_AREA_ID,
  screensWide: 6,
  screensTall: 2,
  start: Object.freeze({ x: 120, y: 200 }),
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: 678 }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([
    Object.freeze({
      columns: Object.freeze([316, 372, 428, 484]),
      rows: Object.freeze([
        Object.freeze({ y: 172, rarity: 'common', tag: 'a' }),
        Object.freeze({ y: 228, rarity: 'common', tag: 'b' }),
      ]),
    }),
    Object.freeze({
      columns: Object.freeze([580, 640]),
      rows: Object.freeze([Object.freeze({ y: 110, rarity: 'rare', tag: 'top' })]),
    }),
    Object.freeze({
      columns: Object.freeze([1316, 1376, 1436]),
      rows: Object.freeze([Object.freeze({ y: 288, rarity: 'rare', tag: 'deep' })]),
    }),
    Object.freeze({
      columns: Object.freeze([1700]),
      rows: Object.freeze([Object.freeze({ y: 648, rarity: 'rare', tag: 'deep' })]),
    }),
  ]),
  caveSpots: Object.freeze([
    Object.freeze([1492, 566, 'legendary', true] as const),
    Object.freeze([1552, 566, 'legendary', true] as const),
    Object.freeze([1612, 566, 'legendary', true] as const),
    Object.freeze([1492, 626, 'epic', false] as const),
    Object.freeze([1552, 626, 'epic', false] as const),
    Object.freeze([1612, 626, 'epic', false] as const),
  ]),
  currentSpots: Object.freeze([
    Object.freeze([1200, 140, 'legendary', true] as const),
    Object.freeze([1200, 200, 'legendary', true] as const),
    Object.freeze([1200, 260, 'legendary', true] as const),
    Object.freeze([1260, 140, 'epic', false] as const),
    Object.freeze([1260, 200, 'epic', false] as const),
    Object.freeze([1260, 260, 'epic', false] as const),
  ]),
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 760, x1: 1160, y0: 120, y1: 280, force: Object.freeze({ x: -70, y: 0 }) }),
  ]),
  cave: Object.freeze({ id: `${DEV_TEST_AREA_ID}/cave`, x0: 1480, x1: 1640, y0: 560, y1: 678 }),
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([700, 262] as const),
      Object.freeze([790, 262] as const),
      Object.freeze([790, 296] as const),
      Object.freeze([700, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1080, 100] as const),
      Object.freeze([1145, 100] as const),
      Object.freeze([1145, 296] as const),
      Object.freeze([1080, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1432, 470] as const),
      Object.freeze([1588, 470] as const),
      Object.freeze([1588, 504] as const),
      Object.freeze([1432, 504] as const),
    ]),
  ]),
  predatorRoutes: Object.freeze([]),
  hazards: Object.freeze([]),
  elements: Object.freeze([]),
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 200 }),
    Object.freeze({ x: 1840, y: 200 }),
    Object.freeze({ x: 2760, y: 560 }),
  ]),
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${DEV_TEST_AREA_ID}/strand-1`, x: 320, y: 110 }),
    Object.freeze({ id: `${DEV_TEST_AREA_ID}/strand-2`, x: 880, y: 292 }),
    Object.freeze({ id: `${DEV_TEST_AREA_ID}/strand-3`, x: 1340, y: 220 }),
    Object.freeze({ id: `${DEV_TEST_AREA_ID}/strand-4`, x: 2000, y: 600 }),
    Object.freeze({ id: `${DEV_TEST_AREA_ID}/strand-5`, x: 2600, y: 300 }),
  ]),
  treasures: CANAL_TREASURES,
  snackWorms: 10,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 9,
  padSpotIndex: 2,
  padSpotY: 100,
  bankChunks: Object.freeze([1, 3, 5]),
  sunChunk: 0,
} satisfies AreaLayoutData);

/** The dev test area: wider and taller than one screen, in the canal habitat. Never in AREAS. */
export const DEV_TEST_AREA: Readonly<AreaData> = Object.freeze({
  id: DEV_TEST_AREA_ID,
  number: 99,
  habitatId: CANAL_AREA.habitatId,
  layout: DEV_TEST_LAYOUT,
  exit: Object.freeze({ x: 2780, y: 560, radius: 40 }),
  specialTreasureId: CANAL_AREA.specialTreasureId,
  snackDrift: CANAL_AREA.snackDrift,
});

const DEV_DANGER_AREA_ID = 'dev-danger-area';

/** Lowest y of the overhanging banks: what is between the surface and here is under the bank. */
const DEV_DANGER_BANK_UNDER_Y = 140;

/** The top-row screens with a garden plot bank; the sun's column and the snake's column have none. */
const DEV_DANGER_BANK_CHUNKS: readonly number[] = Object.freeze([1, 2, 4, 5]);

/** The dev danger area's tilapia (PRD open question 262, ND-15): TILAPIA with the full-bar chase. */
const DEV_DANGER_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({ ...TILAPIA, chase: TILAPIA_CHASE });

/** The garter snake with its chase default (ND-4), so it chases along its stretch. */
const DEV_DANGER_SNAKE: Readonly<PredatorSpecies> = tunedSpecies(
  GARTER_SNAKE_SPECIES,
  Object.freeze({ ...GARTER_SNAKE, chase: GARTER_SNAKE_CHASE }),
);

/** The common carp with its chase default (ND-4). */
const DEV_DANGER_CARP: Readonly<PredatorSpecies> = tunedSpecies(CARP_SPECIES, Object.freeze({ ...CARP, chase: CARP_CHASE }));

/** Area 5's tadpole rule (ND-24; issue #131, ND-9): 70 px/s. */
const DEV_DANGER_TADPOLE = tadpoleRule(70);

/**
 * Area 5's shrimp rule (ND-25): trigger 60 px, rest 1.2 s, flick 60 px at 145 px/s; so 0.9 s rest
 * after a hop, and 40 px hops at about 97 px/s (issue #131, ND-5).
 */
const DEV_DANGER_SHRIMP = shrimpRule(60, 1.2, 60, 145);

/**
 * The three tadpole wander loops' turn points (issue #131, ND-2, ND-3, ND-7): beside `tilapia-0`
 * and the second ghost net's drift, round both punting poles, and between the garter snake and
 * `tilapia-1`.
 */
const DEV_DANGER_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[320, 140], [560, 120], [650, 320], [440, 340], [320, 300]] as const),
  Object.freeze([[1100, 140], [1300, 120], [1480, 150], [1420, 290], [1180, 280]] as const),
  Object.freeze([[1980, 140], [2250, 130], [2420, 220], [2300, 300], [2020, 290]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at the dev danger area's tadpole speed. */
function devDangerLapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / DEV_DANGER_TADPOLE.speed;
}

/** Tadpole n of 3 (from 0) on its wander loop, offset n x lap / 3 so the three are out of step (ND-24). */
function devDangerWander(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(DEV_DANGER_TADPOLE, points, (index * devDangerLapSeconds(points)) / 3);
}

/** The water under the bank of top-row screen `column`, from the surface to the bank's lowest y, inset 20 px. */
function devDangerBankOf(column: number): Readonly<BankOverhang> {
  return Object.freeze({ x0: column * 480 + 20, x1: column * 480 + 460, y0: SURF, y1: DEV_DANGER_BANK_UNDER_Y });
}

/** One ghost net, id `dev-danger-area/ghost-net-<n>`: a rect at a fixed place, drifting when `drift` is set. */
function devDangerNet(
  index: number,
  rect: Readonly<{ x0: number; x1: number; y0: number; y1: number }>,
  drift?: Readonly<NetDrift>,
): Readonly<HazardSpawn> {
  return Object.freeze({
    id: `${DEV_DANGER_AREA_ID}/ghost-net-${index}`,
    type: GHOST_NET,
    shape: Object.freeze({ kind: 'rect' as const, ...rect }),
    ...(drift ? { drift } : {}),
  });
}

/** One punting pole, id `dev-danger-area/punting-pole-<n>`, at `x`, its cycle starting at `offset` seconds. */
function devDangerPole(index: number, x: number, offset: number): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${DEV_DANGER_AREA_ID}/punting-pole-${index}`, PUNTING_POLE, x, offset));
}

/** One predator route of `species`, through the waypoints as [x, y] pairs. */
function devDangerRoute(id: string, species: Readonly<PredatorSpecies>, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints = points.map(([x, y]): Point => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species });
}

/**
 * The dev danger area (PRD open question 262, ND-15): 6 x 2 screens (2880 x 720 world px, bed top
 * 678) in the chinampa look, with every danger part and mobile snack at once. Its own data, written
 * out as numbers; it never refers to a real area's layout objects. The main path runs right along
 * the top row under the banks, past `tilapia-0`, then through the second tadpole loop round both
 * punting poles, dives, runs right along the bottom row through the gap current, then drops to a lane
 * along the bed under `tilapia-1` to the exit. The root tangle sits beside the carp, and the banks in the
 * top right, past the garter snake, are a dead end with the Rare spots.
 */
const DEV_DANGER_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: DEV_DANGER_AREA_ID,
  screensWide: 6,
  screensTall: 2,
  start: Object.freeze({ x: 120, y: 200 }),
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: 678 }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /** In the root tangle beside the carp: Legendary pots near its top, Epic spots lower down. */
  caveSpots: Object.freeze([
    Object.freeze([800, 580, 'legendary', true] as const),
    Object.freeze([860, 580, 'legendary', true] as const),
    Object.freeze([800, 636, 'epic', false] as const),
    Object.freeze([860, 636, 'epic', false] as const),
  ]),
  /** Just past the gap current, below the main path: Legendary pots, then Epic spots lower down. */
  currentSpots: Object.freeze([
    Object.freeze([1740, 580, 'legendary', true] as const),
    Object.freeze([1800, 580, 'legendary', true] as const),
    Object.freeze([1740, 636, 'epic', false] as const),
    Object.freeze([1800, 636, 'epic', false] as const),
  ]),
  /** The gap current in the bottom row, flowing left at 70 px/s, against the main path. */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 1500, x1: 1700, y0: 400, y1: 640, force: Object.freeze({ x: -70, y: 0 }) }),
  ]),
  /** The tangle of ahuejote roots on the bed of the bottom row, left of the carp. */
  cave: Object.freeze({ id: `${DEV_DANGER_AREA_ID}/cave`, x0: 720, x1: 880, y0: 560, y1: 678 }),
  /** `tilapia-0` in the top row under the main path, `tilapia-1` in the bottom row above the bed lane. */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([640, 160] as const),
      Object.freeze([760, 160] as const),
      Object.freeze([760, 240] as const),
      Object.freeze([640, 240] as const),
    ]),
    Object.freeze([
      Object.freeze([2160, 460] as const),
      Object.freeze([2300, 460] as const),
      Object.freeze([2300, 540] as const),
      Object.freeze([2160, 540] as const),
    ]),
  ]),
  /** `garter-snake-0` on a 200 px stretch at the surface, then `carp-0` rooting along the bottom-row bed. */
  predatorRoutes: Object.freeze([
    devDangerRoute('garter-snake-0', DEV_DANGER_SNAKE, [
      [1700, 100],
      [1900, 100],
    ]),
    devDangerRoute('carp-0', DEV_DANGER_CARP, [
      [900, 600],
      [1200, 600],
      [1200, 640],
      [900, 640],
    ]),
  ]),
  /**
   * Three ghost nets: `ghost-net-1` still, off the main path in the bottom right; `ghost-net-2` and
   * `ghost-net-3` drifting 160 px sideways, along the current's flow, 8 s out of step (ND-11). Each
   * drift path is at least 190.5 px from the current.
   */
  hazards: Object.freeze([
    devDangerNet(1, { x0: 2440, x1: 2500, y0: 400, y1: 460 }),
    devDangerNet(2, { x0: 840, x1: 900, y0: 420, y1: 480 }, netDrift(-160, 0, DRIFTING_NETS.period, 0)),
    devDangerNet(3, { x0: 1240, x1: 1300, y0: 380, y1: 430 }, netDrift(-160, 0, DRIFTING_NETS.period, 8)),
  ]),
  elements: Object.freeze([]),
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 200 }),
    Object.freeze({ x: 440, y: 150 }),
    Object.freeze({ x: 1480, y: 150 }),
    Object.freeze({ x: 1440, y: 520 }),
    Object.freeze({ x: 1960, y: 520 }),
    Object.freeze({ x: 2060, y: 625 }),
    Object.freeze({ x: 2780, y: 625 }),
  ]),
  /** Fixed stranding places (PRD C2): on the bed past the safe area, between the poles and the current, and in the bottom right. */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${DEV_DANGER_AREA_ID}/strand-1`, x: 400, y: 560 }),
    Object.freeze({ id: `${DEV_DANGER_AREA_ID}/strand-2`, x: 1400, y: 330 }),
    Object.freeze({ id: `${DEV_DANGER_AREA_ID}/strand-3`, x: 2600, y: 560 }),
  ]),
  treasures: CHINAMPA_TREASURES,
  snackWorms: 6,
  snackBugs: 4,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: DEV_DANGER_BANK_CHUNKS,
  sunChunk: 0,
  tilapia: DEV_DANGER_TILAPIA,
  bankOverhangs: Object.freeze(DEV_DANGER_BANK_CHUNKS.map(devDangerBankOf)),
  /** Common spots under the first two banks along the main path; Rare spots in the dead end under the top-right banks. */
  bankSpots: Object.freeze([
    Object.freeze([560, 110, 'common', false] as const),
    Object.freeze([700, 110, 'common', false] as const),
    Object.freeze([860, 110, 'common', false] as const),
    Object.freeze([1040, 110, 'common', false] as const),
    Object.freeze([1250, 110, 'common', false] as const),
    Object.freeze([2060, 110, 'rare', false] as const),
    Object.freeze([2180, 110, 'rare', false] as const),
    Object.freeze([2300, 110, 'rare', false] as const),
    Object.freeze([2540, 110, 'rare', false] as const),
    Object.freeze([2660, 110, 'rare', false] as const),
    Object.freeze([2780, 110, 'rare', false] as const),
  ]),
  /** Two punting poles in the top row over the main path, 2 s out of step (ND-9). */
  movingHazards: Object.freeze([devDangerPole(1, 1150, 0), devDangerPole(2, 1350, 2)]),
  /**
   * Three tadpoles on 5-point wander loops (DEV_DANGER_LOOPS), out of step, offset (n - 1) x lap / 3
   * (ND-24), and three shrimp on 4-spot homes (ND-25; issue #131, ND-5), with Area 5's rules: one
   * home beside the second ghost net's drift, one between `tilapia-0` and the first punting pole
   * over the third net, and one just left of the gap current.
   */
  mobileSnacks: mobileSnackMix({
    tadpole: DEV_DANGER_TADPOLE,
    wanders: DEV_DANGER_LOOPS.map(devDangerWander),
    shrimp: DEV_DANGER_SHRIMP,
    homes: [
      shrimpHome([[480, 440], [560, 470], [520, 540], [440, 520]]),
      shrimpHome([[960, 200], [1040, 180], [1080, 250], [1000, 280]]),
      shrimpHome([[1360, 540], [1420, 560], [1440, 630], [1380, 620]]),
    ],
  }),
} satisfies AreaLayoutData);

/**
 * The dev danger area (PRD open question 262, ND-15), Area 98: every danger part and mobile snack in
 * one chinampa area, for play-testing them together. Never in AREAS; loads in dev builds only, with
 * `?area=dev-danger-area`. Its snacks drift with Area 4's numbers and it has no one-time darters.
 */
export const DEV_DANGER_AREA: Readonly<AreaData> = Object.freeze({
  id: DEV_DANGER_AREA_ID,
  number: 98,
  habitatId: CHINAMPA_HABITAT.id,
  layout: DEV_DANGER_LAYOUT,
  exit: Object.freeze({ x: 2780, y: 625, radius: 40 }),
  specialTreasureId: 'chinampa/scarecrow',
  snackDrift: Object.freeze({ amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 }),
});

/** Every dev and test area: the dev test area, then the dev danger area. */
export const DEV_AREAS: readonly Readonly<AreaData>[] = Object.freeze([DEV_TEST_AREA, DEV_DANGER_AREA]);

/**
 * The dev area with this id, else the real area with this id (so the dev build's area flag can swim
 * a real area such as `spring-cave-1`), or undefined when there is neither. Dev areas come first.
 */
export function devAreaById(id: string): Readonly<AreaData> | undefined {
  return DEV_AREAS.find((area) => area.id === id) ?? areaById(id);
}
