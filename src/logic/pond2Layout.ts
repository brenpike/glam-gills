/**
 * The lily pad pond at dusk, Area 3 (issue #98), as area data: 6 screens across, 1 down. The
 * stream flowing in past the last tilapia is the current, with spots past it, and a root arch under
 * the bank beyond them is the cave. Two herons wade short stretches near the surface at the far end
 * (issue #111): `heron-0` over the spots past the stream and `heron-1` over the root arch, so the Epic
 * and Legendary spots there sit where a heron can strike. The deep water below their reach is out of
 * every heron's reach (issue #133, ND-5). For the whole-water ramp bar (issue #133, ND-1 to ND-3)
 * its tilapia chase on a 100 px leash in two pairs of taller loops, and two carp patrol too: `carp-1`
 * past the second pair and `carp-0` on the floor under the herons, so every depth has a chaser. A
 * third of its snacks swim (issue #120, ND-4; issue #133, ND-6): tadpoles on wander loops and shrimp
 * that hop and flick away, which replace the darters, in the open water between the pairs. Each Rare
 * spot keeps a safe start beyond the chase (issue #120, ND-8), so the deep Rare reeds and the Rare
 * pad sit at the far end, just past `heron-1`'s reach.
 */
import { POND_2_TREASURES } from './catalogue';
import { snackWander } from './collectibles';
import type { HazardSpawn } from './hazards';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { PLASTIC_WORM } from './plasticWorms';
import { CARP_SPECIES, HERON_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { CARP, TILAPIA, TILAPIA_RAMP_CHASE, type TilapiaTuning } from './tuning';
import { BED_TOP, SURF, type AreaLayoutData, type Point } from './zone';

export const POND_2_AREA_ID = 'pond-2';

/**
 * Area 3's tilapia (issue #120, ND-1; issue #133, ND-1): TILAPIA with the ramp-bar chase on a
 * 100 px leash, sight 200, leash 100 and speed 115. Every other value, and so every risk band,
 * stays TILAPIA's. The herons do not chase.
 */
export const POND_2_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...TILAPIA,
  chase: Object.freeze({ ...TILAPIA_RAMP_CHASE, leash: 100 }),
});

/**
 * Area 3's common carp (issue #133, ND-3): CARP with a chase of sight 220, leash 80 and speed 115.
 * Every other value, and so its B10 strike of 120 px, stays CARP's.
 */
export const POND_2_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...CARP, chase: Object.freeze({ sight: 220, leash: 80, speed: 115 }) }),
);

/** Area 3's tadpole rule (issue #131, ND-9): 50 px/s. */
const POND_2_TADPOLE = tadpoleRule(50);

/** Area 3's shrimp rule (issue #120, ND-4): trigger 60 px, rest 1.7 s, flick 44 px at 115 px/s. */
const POND_2_SHRIMP = shrimpRule(60, 1.7, 44, 115);

/**
 * Tadpole `n` (1 to 4) on its wander loop through `points`, `n - 1` quarters of its own lap ahead
 * (issue #131, ND-1; issue #133, ND-6).
 */
function pond2Wander(n: number, points: readonly (readonly [number, number])[]): Readonly<TadpoleWander> {
  const loop = snackWander(points.map(([x, y]) => ({ x, y })), POND_2_TADPOLE.speed, 0);
  return tadpoleWander(POND_2_TADPOLE, points, ((n - 1) * loop.lap) / POND_2_TADPOLE.speed / 4);
}

/**
 * y of each heron's stretch, the line of its beak's rest point. A heron reaches HERON.lungeRange
 * (110 px) from where it stands on it, so it warns no deeper than y 230, and its stab hits no axolotl
 * centred below about y 256 (HERON.hitRadius past y 230); deeper water is out of its reach.
 */
export const HERON_STRETCH_Y = 120;

/** One plastic worm: a circle of radius 0 at a fixed place, id `pond-2/plastic-worm-<n>`. */
function plasticWormAt(index: number, x: number, y: number): Readonly<HazardSpawn> {
  return Object.freeze({
    id: `${POND_2_AREA_ID}/plastic-worm-${index}`,
    type: PLASTIC_WORM,
    shape: Object.freeze({ kind: 'circle' as const, x, y, r: 0 }),
  });
}

/** One heron's route: a straight stretch from `x0` to `x1` at HERON_STRETCH_Y, two waypoints. */
function heronStretch(id: string, x0: number, x1: number): Readonly<PredatorRoute> {
  const waypoints: Point[] = [
    Object.freeze({ x: x0, y: HERON_STRETCH_Y }),
    Object.freeze({ x: x1, y: HERON_STRETCH_Y }),
  ];
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species: HERON_SPECIES });
}

/** One carp's route: a closed patrol loop through `points`, played by POND_2_CARP (issue #133, ND-3). */
function carpLoop(id: string, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints = points.map(([x, y]): Point => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species: POND_2_CARP });
}

/** The pond at dusk, Area 3, as area data: 6 screens across, 1 down. */
export const POND_2_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: POND_2_AREA_ID,
  screensWide: 6,
  screensTall: 1,
  start: Object.freeze({ x: 120, y: 200 }),
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: BED_TOP }),
  homeSpotRadius: 72,
  /**
   * Common reeds just past the safe area, Rare reeds near the surface above the main path, and deep
   * Rare reeds below `heron-1`'s stretch, past its reach and right of the root arch (issue #120, ND-8).
   */
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
      columns: Object.freeze([2604, 2660, 2716]),
      rows: Object.freeze([Object.freeze({ y: 256, rarity: 'rare', tag: 'deep' })]),
    }),
  ]),
  /**
   * In the root arch, under `heron-1`'s stretch: Legendary pots near the top, within half its reach,
   * and Epic spots at the bottom of the arch, between half its reach and its reach. Each is at least
   * the turn clearance from both ends of the stretch.
   */
  caveSpots: Object.freeze([
    Object.freeze([2500, 112, 'legendary', true] as const),
    Object.freeze([2556, 112, 'legendary', true] as const),
    Object.freeze([2470, 196, 'epic', false] as const),
    Object.freeze([2540, 196, 'epic', false] as const),
  ]),
  /**
   * Just past the stream, under `heron-0`'s stretch: Legendary pots at the top of the stream, within
   * half its reach, and Epic spots lower, between half its reach and its reach. Each is at least the
   * turn clearance from both ends of the stretch.
   */
  currentSpots: Object.freeze([
    Object.freeze([2252, 120, 'legendary', true] as const),
    Object.freeze([2308, 120, 'legendary', true] as const),
    Object.freeze([2260, 190, 'epic', false] as const),
    Object.freeze([2330, 196, 'epic', false] as const),
  ]),
  /**
   * The stream, in the art's stream band (y 120 to 280), flowing left a little faster than Area 2's.
   * The shrimp replace the one-time darters (issue #120, ND-4), so no snack stripe needs to miss it.
   */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 1880, x1: 2240, y0: 120, y1: 280, force: Object.freeze({ x: -74, y: 0 }) }),
  ]),
  /** The root arch under the bank: its hollow, from just under the surface. */
  cave: Object.freeze({ id: `${POND_2_AREA_ID}/cave`, x0: 2432, x1: 2568, y0: 96, y1: 200 }),
  /**
   * Four fixed patrol loops in two pairs, all before the herons' stretches, each chasing on
   * POND_2_TILAPIA's leash (issue #133, ND-2). Each loop reaches into two depth bands: `tilapia-0`
   * and `tilapia-2` the surface and the middle, `tilapia-1` and `tilapia-3` the middle and the floor.
   * The loops of a pair sit 48.1 px apart, so their strikes overlap and leave open water between
   * the pairs (issue #133, Option A).
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([836, 110] as const),
      Object.freeze([876, 110] as const),
      Object.freeze([876, 190] as const),
      Object.freeze([836, 190] as const),
    ]),
    Object.freeze([
      Object.freeze([750, 204] as const),
      Object.freeze([790, 204] as const),
      Object.freeze([790, 296] as const),
      Object.freeze([750, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1486, 110] as const),
      Object.freeze([1526, 110] as const),
      Object.freeze([1526, 190] as const),
      Object.freeze([1486, 190] as const),
    ]),
    Object.freeze([
      Object.freeze([1390, 204] as const),
      Object.freeze([1440, 204] as const),
      Object.freeze([1440, 296] as const),
      Object.freeze([1390, 296] as const),
    ]),
  ]),
  /**
   * Two herons wading near the surface at the far end, each on a 180 px stretch: `heron-0` from the
   * end of the stream over the spots past it, and `heron-1` over the root arch. `heron-0` stops short
   * of the bank on the last column. Then two carp (issue #133, ND-3): `carp-0` on the floor under
   * both stretches, more than a heron's reach below them, rising into the middle band at the
   * stream's end, left of `heron-0`, and `carp-1` near the surface just past the second tilapia pair.
   */
  predatorRoutes: Object.freeze([
    heronStretch('heron-0', 2190, 2370),
    heronStretch('heron-1', 2440, 2620),
    carpLoop('carp-0', [
      [2100, 200],
      [2200, 262],
      [2480, 262],
      [2480, 296],
      [2100, 296],
    ]),
    carpLoop('carp-1', [
      [1586, 110],
      [1614, 110],
      [1614, 190],
      [1586, 190],
    ]),
  ]),
  /**
   * Five plastic worms, left to right, each farther than a lunge from every tilapia and carp, out of
   * every heron's reach and far from the stream: `plastic-worm-3` inside the second tadpole's loop,
   * and `plastic-worm-4` and `plastic-worm-5` on the bed past the floor carp (issue #133, ND-2).
   */
  hazards: Object.freeze([
    plasticWormAt(1, 420, 120),
    plasticWormAt(2, 540, 290),
    plasticWormAt(3, 1030, 190),
    plasticWormAt(4, 2650, 290),
    plasticWormAt(5, 2740, 270),
  ]),
  elements: Object.freeze([]),
  /**
   * Along the middle, up over the first tilapia pair and past the Common pad, then on through the
   * stream and under the herons' stretches to the exit. Under the stretches it is inside their reach;
   * the water below y 230 is not.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 200 }),
    Object.freeze({ x: 560, y: 200 }),
    Object.freeze({ x: 760, y: 140 }),
    Object.freeze({ x: 1060, y: 140 }),
    Object.freeze({ x: 1240, y: 200 }),
    Object.freeze({ x: 2810, y: 200 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), left to right: above the first reeds, on the bed past the first
   * tilapia pair, on the bed before the second pair, near the surface past `carp-1`, on the bed by
   * the exit past the floor carp, and in mid-water before the exit, clear of the Rare pad (issue
   * #120, ND-8; issue #133, ND-2). Every place is at least 80 px from every tilapia, heron and carp
   * route, and out of every heron's reach.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-1`, x: 320, y: 110 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-2`, x: 960, y: 292 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-3`, x: 1270, y: 250 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-4`, x: 1700, y: 140 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-5`, x: 2790, y: 290 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-6`, x: 2720, y: 180 }),
  ]),
  treasures: POND_2_TREASURES,
  snackWorms: 10,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  /**
   * The Common pad over the main path, between the tilapia pairs and far from the herons' stretches
   * (issue #133, ND-2), and the Rare pad near the exit, just past `heron-1`'s reach (issue #120,
   * ND-8), then pads that only decorate. No pad sits above a plastic worm.
   */
  fixedPads: Object.freeze([
    Object.freeze({ x: 1080, rx: 24, flower: true, spot: Object.freeze({ y: 100, rarity: 'common', tag: 'a' }) }),
    Object.freeze({ x: 2775, rx: 23, flower: false, spot: Object.freeze({ y: 100, rarity: 'rare', tag: 'b' }) }),
    Object.freeze({ x: 190, rx: 24, flower: true }),
    Object.freeze({ x: 640, rx: 22, flower: false }),
    Object.freeze({ x: 1390, rx: 25, flower: true }),
    Object.freeze({ x: 1740, rx: 22, flower: false }),
    Object.freeze({ x: 2100, rx: 24, flower: true }),
    Object.freeze({ x: 2700, rx: 23, flower: false }),
  ]),
  /** The bank over the root arch. */
  bankChunks: Object.freeze([5]),
  sunChunk: 0,
  tilapia: POND_2_TILAPIA,
  /**
   * Four tadpoles on wander loops, each a quarter of its own lap out of step, and four shrimp homes
   * of three hop spots, placed after the predators in the open water they leave (issue #131, ND-1,
   * ND-5; issue #133, ND-6). The tadpoles swim by the Home Spot, round `plastic-worm-3` between the
   * tilapia pairs, before the second pair and past `carp-1`; two shrimp live in each half, the last
   * one by the exit.
   */
  mobileSnacks: mobileSnackMix({
    tadpole: POND_2_TADPOLE,
    wanders: [
      pond2Wander(1, [[310, 140], [310, 290], [455, 290], [455, 205], [630, 205], [470, 205], [310, 215]]),
      pond2Wander(2, [[890, 110], [1050, 110], [1210, 110], [1210, 270], [1050, 270], [890, 270]]),
      pond2Wander(3, [[1140, 110], [1140, 280], [1245, 280], [1245, 195], [1460, 195], [1245, 110]]),
      pond2Wander(4, [[1740, 110], [1870, 110], [1870, 280], [1740, 280], [1550, 200]]),
    ],
    shrimp: POND_2_SHRIMP,
    homes: [
      shrimpHome([[340, 230], [410, 250], [460, 215]]),
      shrimpHome([[1130, 150], [1200, 200], [1130, 250]]),
      shrimpHome([[1760, 150], [1820, 200], [1780, 250]]),
      shrimpHome([[2750, 140], [2800, 115], [2815, 170]]),
    ],
  }),
} satisfies AreaLayoutData);
