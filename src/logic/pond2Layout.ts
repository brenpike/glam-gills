/**
 * The lily pad pond at dusk, Area 3 (issue #98), as area data: 6 screens across, 1 down. The
 * stream flowing in past the last tilapia is the current, with spots past it, and a root arch under
 * the bank beyond them is the cave. Two herons wade short stretches near the surface at the far end
 * (issue #111): `heron-0` over the spots past the stream and `heron-1` over the root arch, so the Epic
 * and Legendary spots there sit where a heron can strike. The water below their reach stays open.
 * For the ramp bar (issue #120, ND-1, ND-4) its tilapia chase on a short leash, and a third of its
 * snacks swim: tadpoles on fixed lanes and shrimp that flick away, which replace the darters. Each
 * Rare spot keeps a safe start beyond the chase (ND-8), so the deep Rare reeds and the Rare pad sit
 * at the far end, just past `heron-1`'s reach.
 */
import { POND_2_TREASURES } from './catalogue';
import type { HazardSpawn } from './hazards';
import { mobileSnackMix, shrimpRule, tadpoleLane, tadpoleRule, type TadpoleLane } from './mobileSnacks';
import { PLASTIC_WORM } from './plasticWorms';
import { HERON_SPECIES, type PredatorRoute } from './predators';
import { TILAPIA, TILAPIA_RAMP_CHASE, type TilapiaTuning } from './tuning';
import { BED_TOP, SURF, type AreaLayoutData, type Point } from './zone';

export const POND_2_AREA_ID = 'pond-2';

/**
 * Area 3's tilapia (issue #120, ND-1): TILAPIA with the ramp-bar chase, sight 200, leash 80 and
 * speed 115. Every other value, and so every risk band, stays TILAPIA's. The herons do not chase.
 */
export const POND_2_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({ ...TILAPIA, chase: TILAPIA_RAMP_CHASE });

/** Area 3's tadpole rule (issue #120, ND-4): 35 px/s. */
const POND_2_TADPOLE = tadpoleRule(35);

/** Area 3's shrimp rule (issue #120, ND-4): trigger 60 px, rest 1.7 s, flick 44 px at 115 px/s. */
const POND_2_SHRIMP = shrimpRule(60, 1.7, 44, 115);

/** Length in px of each tadpole lane. */
const POND_2_LANE_LENGTH = 120;

/** Seconds a tadpole takes there and back along its lane: 2L / speed. */
const POND_2_LANE_LOOP = (2 * POND_2_LANE_LENGTH) / POND_2_TADPOLE.speed;

/** Tadpole lane `n` (1 to 4) from (x, y), `n - 1` quarters of the lane loop ahead (issue #120, ND-4). */
function pond2Lane(n: number, x: number, y: number, dx: number, dy: number): Readonly<TadpoleLane> {
  return tadpoleLane(POND_2_TADPOLE, x, y, dx, dy, ((n - 1) * POND_2_LANE_LOOP) / 4);
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
   * Four fixed patrol loops, left to right along the pond, all before the herons' stretches, each
   * chasing on POND_2_TILAPIA's short leash. The closest two, `tilapia-0` and `tilapia-1`, are 290 px
   * apart, more than twice the lunge range of 140 px.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([700, 262] as const),
      Object.freeze([790, 262] as const),
      Object.freeze([790, 296] as const),
      Object.freeze([700, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1080, 250] as const),
      Object.freeze([1150, 250] as const),
      Object.freeze([1150, 296] as const),
      Object.freeze([1080, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1440, 110] as const),
      Object.freeze([1510, 110] as const),
      Object.freeze([1510, 150] as const),
      Object.freeze([1440, 150] as const),
    ]),
    Object.freeze([
      Object.freeze([1800, 250] as const),
      Object.freeze([1870, 250] as const),
      Object.freeze([1870, 296] as const),
      Object.freeze([1800, 296] as const),
    ]),
  ]),
  /**
   * Two herons wading near the surface at the far end, each on a 180 px stretch: `heron-0` from the
   * end of the stream over the spots past it, and `heron-1` over the root arch. `heron-0` stops short
   * of the bank on the last column.
   */
  predatorRoutes: Object.freeze([heronStretch('heron-0', 2190, 2370), heronStretch('heron-1', 2440, 2620)]),
  /** Five plastic worms, left to right, each far from the tilapia, the herons and the stream. */
  hazards: Object.freeze([
    plasticWormAt(1, 420, 120),
    plasticWormAt(2, 540, 290),
    plasticWormAt(3, 960, 170),
    plasticWormAt(4, 1300, 270),
    plasticWormAt(5, 2740, 270),
  ]),
  elements: Object.freeze([]),
  /**
   * Along the middle, up over the first tilapia and the Common pad, then on through the stream and
   * under the herons' stretches to the exit. Under the stretches it is inside their reach; the water
   * below y 230 is not.
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
   * Fixed stranding places (PRD C2), left to right: above the first reeds, on the bed between the
   * first two tilapia, in the open water before the deep reeds, near the surface before the last
   * tilapia, on the bed under the root arch, and in mid-water before the exit, clear of the Rare pad
   * (issue #120, ND-8). Every place is at least 80 px from every tilapia route and heron stretch,
   * and out of every heron's reach.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-1`, x: 320, y: 110 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-2`, x: 880, y: 292 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-3`, x: 1340, y: 220 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-4`, x: 1700, y: 140 }),
    Object.freeze({ id: `${POND_2_AREA_ID}/strand-5`, x: 2400, y: 290 }),
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
   * The Common pad over the main path, far from the herons' stretches, and the Rare pad near the
   * exit, just past `heron-1`'s reach (issue #120, ND-8), then pads that only decorate. No pad sits
   * above a plastic worm.
   */
  fixedPads: Object.freeze([
    Object.freeze({ x: 915, rx: 24, flower: true, spot: Object.freeze({ y: 100, rarity: 'common', tag: 'a' }) }),
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
   * Four tadpoles on 120 px lanes, each a quarter of the lane loop out of step (issue #120, ND-4),
   * and four shrimp, every lane and shrimp box clear of the threats, worms and the stream.
   */
  mobileSnacks: mobileSnackMix({
    tadpole: POND_2_TADPOLE,
    lanes: [
      pond2Lane(1, 320, 210, POND_2_LANE_LENGTH, 0),
      pond2Lane(2, 560, 100, POND_2_LANE_LENGTH, 0),
      pond2Lane(3, 1655, 140, 0, POND_2_LANE_LENGTH),
      pond2Lane(4, 2420, 280, POND_2_LANE_LENGTH, 0),
    ],
    shrimp: POND_2_SHRIMP,
    spots: [
      { x: 860, y: 106 },
      { x: 1230, y: 106 },
      { x: 2320, y: 280 },
      { x: 2760, y: 140 },
    ],
  }),
} satisfies AreaLayoutData);
