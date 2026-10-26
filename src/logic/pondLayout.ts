/**
 * The lily pad pond, Area 2 (issue #75), as area data: 5 screens across, 1 down. A hollow log is
 * the cave, and the stream flowing in at the right end is the current, with spots past it. Four
 * chasing tilapia and two common carp patrol at every depth, so the whole water meets the ramp bar
 * (PRD N2; issue #132, ND-1 to ND-3).
 */
import { POND_TREASURES } from './catalogue';
import type { HazardSpawn } from './hazards';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander } from './mobileSnacks';
import { PLASTIC_WORM } from './plasticWorms';
import { CARP_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { CARP, TILAPIA, TILAPIA_RAMP_CHASE, type TilapiaTuning } from './tuning';
import { BED_TOP, SURF, type AreaLayoutData, type Point } from './zone';

export const POND_AREA_ID = 'pond-1';

/**
 * Area 2's tilapia (issue #132, ND-1): TILAPIA with the ramp chase as it is, sight 200, leash 80
 * and speed 115. Every other value stays TILAPIA's.
 */
export const POND_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({ ...TILAPIA, chase: TILAPIA_RAMP_CHASE });

/**
 * Area 2's common carp (issue #132, ND-3): CARP with a chase of sight 220, leash 60 and speed 115, a
 * danger part. CARP's own values stay, a 1.0 s warning and a slow 120 px sweep.
 */
export const POND_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...CARP, chase: Object.freeze({ sight: 220, leash: 60, speed: 115 }) }),
);

/** Area 2's tadpoles (issue #131, ND-9): 40 px/s, the middle of the ramp's 35 to 45 px/s. */
const POND_TADPOLE = tadpoleRule(40);

/**
 * The tadpoles' wander loop turn points (issue #145): along the bed between `tilapia-1` and
 * `tilapia-2`, with a thin spike up the middle, so the surface corners on either side stay clear
 * for plastic worms. Both tadpoles share it, half a lap apart.
 */
const TADPOLE_LOOP: readonly (readonly [number, number])[] = Object.freeze([
  [1180, 136],
  [1190, 236],
  [1310, 232],
  [1300, 294],
  [1140, 294],
  [990, 290],
  [985, 226],
  [1170, 226],
] as const);

/** Seconds a tadpole takes round the closed loop through `points` at Area 2's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / POND_TADPOLE.speed;
}

/** One plastic worm: a circle of radius 0 at a fixed place, id `pond-1/plastic-worm-<n>`. */
function plasticWormAt(index: number, x: number, y: number): Readonly<HazardSpawn> {
  return Object.freeze({
    id: `${POND_AREA_ID}/plastic-worm-${index}`,
    type: PLASTIC_WORM,
    shape: Object.freeze({ kind: 'circle' as const, x, y, r: 0 }),
  });
}

/** One carp route, id `carp-<n>`, round the box from (x0, y0) to (x1, y1), played as POND_CARP (issue #132, ND-3). */
function carpRoute(index: number, x0: number, x1: number, y0: number, y1: number): Readonly<PredatorRoute> {
  return Object.freeze({
    id: `carp-${index}`,
    waypoints: Object.freeze([
      Object.freeze({ x: x0, y: y0 }),
      Object.freeze({ x: x1, y: y0 }),
      Object.freeze({ x: x1, y: y1 }),
      Object.freeze({ x: x0, y: y1 }),
    ]) as Point[],
    species: POND_CARP,
  });
}

/** The pond, Area 2, as area data: 5 screens across, 1 down. */
export const POND_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: POND_AREA_ID,
  screensWide: 5,
  screensTall: 1,
  start: Object.freeze({ x: 120, y: 200 }),
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: BED_TOP }),
  homeSpotRadius: 72,
  /**
   * Reed beds, left to right (issue #132, ND-2): the first Common reeds between `tilapia-0` and
   * `carp-0`, a Rare reed at the top before them, a deep Rare reed past `tilapia-1`, the second
   * Common reeds before `tilapia-2`, and two deep Rare reeds between the hollow log and the stream.
   */
  reedBeds: Object.freeze([
    Object.freeze({
      columns: Object.freeze([548]),
      rows: Object.freeze([
        Object.freeze({ y: 172, rarity: 'common', tag: 'a' }),
        Object.freeze({ y: 228, rarity: 'common', tag: 'b' }),
      ]),
    }),
    Object.freeze({
      columns: Object.freeze([470]),
      rows: Object.freeze([Object.freeze({ y: 110, rarity: 'rare', tag: 'top' })]),
    }),
    Object.freeze({
      columns: Object.freeze([1124]),
      rows: Object.freeze([Object.freeze({ y: 288, rarity: 'rare', tag: 'deep' })]),
    }),
    Object.freeze({
      columns: Object.freeze([1212]),
      rows: Object.freeze([
        Object.freeze({ y: 172, rarity: 'common', tag: 'a' }),
        Object.freeze({ y: 228, rarity: 'common', tag: 'b' }),
      ]),
    }),
    Object.freeze({
      columns: Object.freeze([1644, 1712]),
      rows: Object.freeze([Object.freeze({ y: 288, rarity: 'rare', tag: 'deep' })]),
    }),
  ]),
  /** In the hollow log under `tilapia-2`'s corner: Legendary pots nearest it, Epic spots farther (issue #132, ND-2). */
  caveSpots: Object.freeze([
    Object.freeze([1480, 242, 'legendary', true] as const),
    Object.freeze([1536, 248, 'legendary', true] as const),
    Object.freeze([1566, 200, 'legendary', true] as const),
    Object.freeze([1496, 296, 'epic', false] as const),
    Object.freeze([1566, 296, 'epic', false] as const),
    Object.freeze([1596, 248, 'epic', false] as const),
  ]),
  currentSpots: Object.freeze([
    Object.freeze([2200, 140, 'legendary', true] as const),
    Object.freeze([2200, 200, 'legendary', true] as const),
    Object.freeze([2200, 260, 'legendary', true] as const),
    Object.freeze([2260, 140, 'epic', false] as const),
    Object.freeze([2260, 200, 'epic', false] as const),
    Object.freeze([2260, 260, 'epic', false] as const),
  ]),
  /** The stream flowing in at the right end, in the art's stream band (y 120 to 280), flowing left. */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 1760, x1: 2160, y0: 120, y1: 280, force: Object.freeze({ x: -70, y: 0 }) }),
  ]),
  /** The hollow log. */
  cave: Object.freeze({ id: `${POND_AREA_ID}/cave`, x0: 1480, x1: 1640, y0: 200, y1: 318 }),
  /**
   * Four fixed patrol loops, left to right, each reaching into at least two depth bands (issue
   * #132, ND-2): `tilapia-0` up and down on the deep side beside the safe area, `tilapia-1` the same
   * past `carp-0`, `tilapia-2` near the surface over the hollow log, and `tilapia-3` through the
   * stream. The closest two, `tilapia-1` and `tilapia-2`, are 465 px apart, more than twice the
   * lunge range of 140 px.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([326, 204] as const),
      Object.freeze([346, 204] as const),
      Object.freeze([346, 296] as const),
      Object.freeze([326, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([960, 204] as const),
      Object.freeze([980, 204] as const),
      Object.freeze([980, 296] as const),
      Object.freeze([960, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1445, 100] as const),
      Object.freeze([1505, 100] as const),
      Object.freeze([1505, 186] as const),
      Object.freeze([1445, 186] as const),
    ]),
    Object.freeze([
      Object.freeze([2080, 100] as const),
      Object.freeze([2145, 100] as const),
      Object.freeze([2145, 296] as const),
      Object.freeze([2080, 296] as const),
    ]),
  ]),
  /**
   * Two common carp (issue #132, ND-3): `carp-0` on the deep side between the first Common reeds
   * and `tilapia-1`, and `carp-1` near the surface in the stream before `tilapia-3`. Each loop is at
   * least 210 px from every tilapia route and the two are far more than 240 px apart.
   */
  predatorRoutes: Object.freeze([carpRoute(0, 729, 749, 204, 296), carpRoute(1, 1860, 1870, 100, 190)]),
  /**
   * Six plastic worms spread from the first Common reeds to before `tilapia-2` (issue #145): near
   * the surface past `tilapia-0`, on the bed before `carp-0`, near the surface either side of
   * `carp-0`, near the surface past `tilapia-1`, and in the open water before `tilapia-2`. Each is
   * at least 180 px from every other, farther than a lunge from every tilapia route and a sweep from
   * every carp route, and far from the stream.
   */
  hazards: Object.freeze([
    plasticWormAt(1, 488, 100),
    plasticWormAt(2, 585, 294),
    plasticWormAt(3, 670, 96),
    plasticWormAt(4, 855, 96),
    plasticWormAt(5, 1080, 96),
    plasticWormAt(6, 1300, 144),
  ]),
  elements: Object.freeze([]),
  /** Along the middle, up round the Common pad, then on past the hollow log and the stream to the exit. */
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 200 }),
    Object.freeze({ x: 500, y: 200 }),
    Object.freeze({ x: 530, y: 145 }),
    Object.freeze({ x: 560, y: 200 }),
    Object.freeze({ x: 2330, y: 200 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), left to right: near the surface past `tilapia-0`, on the bed
   * before `carp-0`, in the open water before `tilapia-2`, on the bed under the stream, and on the
   * bed past the stream. Every place is at least 80 px from every tilapia and carp route.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${POND_AREA_ID}/strand-1`, x: 400, y: 110 }),
    Object.freeze({ id: `${POND_AREA_ID}/strand-2`, x: 640, y: 290 }),
    Object.freeze({ id: `${POND_AREA_ID}/strand-3`, x: 1330, y: 220 }),
    Object.freeze({ id: `${POND_AREA_ID}/strand-4`, x: 1780, y: 296 }),
    Object.freeze({ id: `${POND_AREA_ID}/strand-5`, x: 2310, y: 296 }),
  ]),
  treasures: POND_TREASURES,
  /**
   * 10 worms and 6 bugs (issue #121, ND-4): 4 fewer than before, for the 2 tadpoles and 2 shrimp,
   * so the pond keeps 20 snacks. snacksInCurrent places 4 worms or bugs in the stream on purpose;
   * it is a floor, since stripe snacks may also start there (ADR 0022).
   */
  snackWorms: 10,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  /**
   * The Common pad over the main path by the first Common reeds, and the Rare pad between the
   * hollow log and the stream, then pads that only decorate (issue #132, ND-2). No pad sits above a
   * plastic worm.
   */
  fixedPads: Object.freeze([
    Object.freeze({ x: 530, rx: 24, flower: true, spot: Object.freeze({ y: 100, rarity: 'common', tag: 'a' }) }),
    Object.freeze({ x: 1680, rx: 23, flower: false, spot: Object.freeze({ y: 100, rarity: 'rare', tag: 'b' }) }),
    Object.freeze({ x: 190, rx: 24, flower: true }),
    Object.freeze({ x: 900, rx: 22, flower: false }),
    Object.freeze({ x: 1390, rx: 25, flower: true }),
    Object.freeze({ x: 1820, rx: 22, flower: false }),
    Object.freeze({ x: 2280, rx: 24, flower: true }),
  ]),
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  tilapia: POND_TILAPIA,
  /**
   * Mobile snacks (issue #132, ND-5), placed after the predators: two tadpoles sharing one wander
   * loop along the bed between `tilapia-1` and `tilapia-2`, half a lap out of step, so the west
   * water is free for plastic worms (issue #145); then a shrimp home near the surface between the
   * hollow log and the stream, and one on the bed below it. The shrimp turn the one-time darters off
   * (issue #121, ND-6), and the Snack
   * magnet pulls at 48 px/s (issue #131, ND-8).
   */
  mobileSnacks: mobileSnackMix({
    tadpole: POND_TADPOLE,
    wanders: Object.freeze([
      tadpoleWander(POND_TADPOLE, TADPOLE_LOOP, 0),
      tadpoleWander(POND_TADPOLE, TADPOLE_LOOP, lapSeconds(TADPOLE_LOOP) / 2),
    ]),
    shrimp: shrimpRule(60, 2.0, 36, 100),
    homes: Object.freeze([
      shrimpHome([
        [1650, 110],
        [1720, 110],
        [1690, 160],
      ]),
      shrimpHome([
        [1650, 285],
        [1720, 285],
        [1690, 240],
      ]),
    ]),
  }),
} satisfies AreaLayoutData);
