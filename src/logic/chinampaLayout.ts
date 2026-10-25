/**
 * The chinampa gardens, Area 4 (issue #76), as area data: 6 screens across, 2 down, the first area
 * that scrolls up and down. The Home Spot is top left and the exit deep bottom right. The top-row
 * way runs under the overhanging banks of the garden plots, then dives between two ghost nets to
 * the bottom row; the bottom-row way runs past the root tangle and between two more nets. Both
 * meet at the gap between two chinampas, where the current flows, and the main path leaves it by a
 * lane along the bed to the exit. The root tangle in the bottom left and the bank in the top right
 * are dead ends that hold treasure spots. Four chasing tilapia, four carp and two punting poles keep
 * all the water in some threat's reach, at every depth (issue #134, ND-1 to ND-3), and half the
 * snacks are tadpoles that wander and shrimp that hop (issue #134, ND-6).
 */
import { CHINAMPA_TREASURES } from './catalogue';
import { GHOST_NET, netDrift } from './ghostNets';
import type { HazardSpawn, NetDrift } from './hazards';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import { CARP_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { CARP, CARP_CHASE, DRIFTING_NETS, TILAPIA, TILAPIA_CHASE, type TilapiaTuning } from './tuning';
import { SURF, areaSize, type AreaLayoutData, type BankOverhang, type Point } from './zone';

export const CHINAMPA_AREA_ID = 'chinampa-1';

/** Top of the bed of the bottom row: 678. */
const CHINAMPA_BED_TOP = areaSize(6, 2).bedTop;

/** Lowest y of the overhanging banks: what is between the surface and here is under the bank. */
const BANK_UNDER_Y = 140;

/**
 * Area 4's tilapia, one step up the predator ladder (#32): a shorter warning, a faster and longer
 * strike, a shorter cooldown and a quicker patrol than TILAPIA. The 0.8 s warning floor, the strike
 * time and every other value stay TILAPIA's. It chases with the full-bar chase (issue #119, ND-1).
 */
export const CHINAMPA_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...TILAPIA,
  windup: 0.85,
  lungeSpeed: 400,
  lungeRange: 145,
  cooldown: 2.2,
  patrolSpeed: 50,
  chase: TILAPIA_CHASE,
});

/** Area 4's common carp: CARP with its chase default, a danger part (issue #119, ND-3). */
export const CHINAMPA_CARP: Readonly<PredatorSpecies> = tunedSpecies(CARP_SPECIES, Object.freeze({ ...CARP, chase: CARP_CHASE }));

/** Area 4's tadpole rule (issue #131, ND-9): 60 px/s. */
const CHINAMPA_TADPOLE = tadpoleRule(60);

/** Area 4's shrimp rule (issue #119, ND-8): trigger 60 px, rest 1.4 s, flick 52 px at 130 px/s. */
const CHINAMPA_SHRIMP = shrimpRule(60, 1.4, 52, 130);

/**
 * The tadpoles' wander loops (issue #134, ND-6): four in the top row, from the top left to the
 * top right, then three in the bottom row, from the bottom left to the bottom right. Each home is
 * 320 to 480 px wide and at least 150 px tall, with uneven legs of 90 to 300 px, and at least half
 * of each loop, in one stretch, is out of every strike.
 */
const CHINAMPA_WANDER_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[350, 110], [470, 100], [690, 118], [610, 255], [400, 240]] as const),
  Object.freeze([[800, 110], [980, 100], [1140, 130], [1130, 290], [950, 300], [830, 240]] as const),
  Object.freeze([[1060, 110], [1220, 100], [1380, 120], [1300, 180], [1160, 250], [1060, 230]] as const),
  Object.freeze([[2215, 110], [2400, 100], [2535, 105], [2420, 180], [2260, 250]] as const),
  Object.freeze([[302, 503], [310, 650], [450, 654], [624, 652], [470, 560]] as const),
  Object.freeze([[1745, 315], [1850, 300], [1962, 457], [2095, 500], [1935, 580], [2095, 645], [1900, 470]] as const),
  Object.freeze([[2400, 648], [2560, 655], [2770, 640], [2690, 500], [2540, 580]] as const),
]);

/** One ghost net, id `chinampa-1/ghost-net-<n>`: a rect at a fixed place, drifting when `drift` is set (issue #119, ND-5). */
function ghostNetAt(index: number, x0: number, x1: number, y0: number, y1: number, drift?: Readonly<NetDrift>): Readonly<HazardSpawn> {
  return Object.freeze({
    id: `${CHINAMPA_AREA_ID}/ghost-net-${index}`,
    type: GHOST_NET,
    shape: Object.freeze({ kind: 'rect' as const, x0, x1, y0, y1 }),
    ...(drift ? { drift } : {}),
  });
}

/** Carp `carp-<n>` on a rect patrol loop from x0 to x1 and y0 to y1, with CHINAMPA_CARP (issue #134, ND-2). */
function carpAt(index: number, x0: number, x1: number, y0: number, y1: number): Readonly<PredatorRoute> {
  return Object.freeze({
    id: `carp-${index}`,
    waypoints: Object.freeze([
      Object.freeze({ x: x0, y: y0 }),
      Object.freeze({ x: x1, y: y0 }),
      Object.freeze({ x: x1, y: y1 }),
      Object.freeze({ x: x0, y: y1 }),
    ]) as Point[],
    species: CHINAMPA_CARP,
  });
}

/** One punting pole, id `chinampa-1/punting-pole-<n>`, at `x`, its cycle starting at `offset` s, reaching `depth` px (issue #119, ND-4). */
function puntingPoleAt(index: number, x: number, offset: number, depth: number): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${CHINAMPA_AREA_ID}/punting-pole-${index}`, PUNTING_POLE, x, offset, depth));
}

/** Seconds a tadpole takes round the closed loop through `points` at Area 4's tadpole speed. */
function chinampaLapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / CHINAMPA_TADPOLE.speed;
}

/** Tadpole n of 7 (from 0) on its wander loop, offset n x lap / 7 so the seven are out of step (issue #134, ND-6). */
function chinampaWander(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(CHINAMPA_TADPOLE, points, (index * chinampaLapSeconds(points)) / CHINAMPA_WANDER_LOOPS.length);
}

/** The water under the bank of top-row screen `column`, from the surface to BANK_UNDER_Y, inset 20 px. */
function bankOverhangOf(column: number): Readonly<BankOverhang> {
  return Object.freeze({ x0: column * 480 + 20, x1: column * 480 + 460, y0: SURF, y1: BANK_UNDER_Y });
}

/** The chinampa gardens, Area 4, as area data: 6 screens across, 2 down. */
export const CHINAMPA_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: CHINAMPA_AREA_ID,
  screensWide: 6,
  screensTall: 2,
  start: Object.freeze({ x: 120, y: 200 }),
  /** The Home Spot's column, from the surface down to the bed of the bottom row. */
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: CHINAMPA_BED_TOP }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /** In the root tangle on the bed of the bottom left: Legendary pots near its top, Epic spots lower down. */
  caveSpots: Object.freeze([
    Object.freeze([440, 566, 'legendary', true] as const),
    Object.freeze([500, 566, 'legendary', true] as const),
    Object.freeze([560, 566, 'legendary', true] as const),
    Object.freeze([440, 626, 'epic', false] as const),
    Object.freeze([500, 626, 'epic', false] as const),
    Object.freeze([560, 626, 'epic', false] as const),
  ]),
  /** Just past the gap current, beside `tilapia-1`: Legendary pots nearer it, Epic spots farther. */
  currentSpots: Object.freeze([
    Object.freeze([2430, 420, 'legendary', true] as const),
    Object.freeze([2430, 480, 'legendary', true] as const),
    Object.freeze([2370, 420, 'epic', false] as const),
    Object.freeze([2370, 480, 'epic', false] as const),
  ]),
  /**
   * The water flowing through the gap between two chinampas in the bottom row, sideways and to the
   * left, as strong as the canal's and the pond's and weaker than Area 3's stream, so the snacks can
   * drift a little faster than Area 3's and stay under a one-leg axolotl's headway against it.
   */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 2140, x1: 2340, y0: 380, y1: 600, force: Object.freeze({ x: -72, y: 0 }) }),
  ]),
  /** The tangle of ahuejote roots on the bed of the bottom left, a dead end. */
  cave: Object.freeze({ id: `${CHINAMPA_AREA_ID}/cave`, x0: 410, x1: 590, y0: 560, y1: CHINAMPA_BED_TOP }),
  /**
   * Four fixed patrol loops (issue #134, ND-1): `tilapia-0` over the root tangle; `tilapia-1`, a
   * slanting loop from the surface band down beside the spots past the current, under the bank in
   * the top right; `tilapia-2`, a tall narrow loop between the bottom-row nets and the main path's
   * dive; and `tilapia-3` at the right edge of the top right. Each reaches 24 px or more into two
   * depth bands, and `tilapia-1` and `tilapia-3` reach the surface band, where no Common spot is
   * near. Every two are more than twice the lunge range of 145 px apart.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([465, 330] as const),
      Object.freeze([685, 330] as const),
      Object.freeze([685, 500] as const),
      Object.freeze([465, 500] as const),
    ]),
    Object.freeze([
      Object.freeze([2522, 256] as const),
      Object.freeze([2532, 256] as const),
      Object.freeze([2502, 480] as const),
      Object.freeze([2495, 480] as const),
    ]),
    Object.freeze([
      Object.freeze([1265, 330] as const),
      Object.freeze([1270, 330] as const),
      Object.freeze([1270, 600] as const),
      Object.freeze([1265, 600] as const),
    ]),
    Object.freeze([
      Object.freeze([2823, 256] as const),
      Object.freeze([2840, 256] as const),
      Object.freeze([2840, 430] as const),
      Object.freeze([2823, 430] as const),
    ]),
  ]),
  /**
   * Four carp on tall narrow loops (issue #134, ND-2), left to right: `carp-0` under the main path's
   * dive and `carp-1` beyond it, from the middle band down to the floor; `carp-2` in the top row
   * between the fourth and sixth plots, from the surface band down to the middle, so its reach
   * covers the top row under the banks beside it; and `carp-3` in the current, from the middle band
   * down to the floor. Each is more than its lunge plus the Area 4 lunge from every tilapia route
   * and more than twice its lunge from every other carp, and each lap is shorter than the longest
   * tilapia lap.
   */
  predatorRoutes: Object.freeze([carpAt(0, 1550, 1560, 444, 600), carpAt(1, 1801, 1806, 444, 600), carpAt(2, 2003, 2008, 150, 306), carpAt(3, 2224, 2229, 444, 600)]),
  /**
   * Five ghost nets, left to right: two in the bottom row with the bottom-row way between them, two
   * at the top of the main path's dive with the dive between them, and one at the surface beyond
   * the dive, under the bank of the fourth plot. The two bottom-row nets drift 120 px sideways in
   * step, along the current's flow, so the way between them stays 100 px tall (issue #119, ND-5).
   * Each, by its whole drift path, is more than a lunge plus its reach and the safe passing width
   * from every tilapia and carp route, and at least 190.5 px from the current, so a snag ends
   * before a snagged axolotl reaches it (issue #134, ND-5).
   */
  hazards: Object.freeze([
    ghostNetAt(1, 1005, 1065, 400, 470, netDrift(-120, 0, DRIFTING_NETS.period, 0)),
    ghostNetAt(2, 1005, 1065, 570, 640, netDrift(-120, 0, DRIFTING_NETS.period, 0)),
    ghostNetAt(3, 1460, 1510, 170, 270),
    ghostNetAt(4, 1610, 1660, 170, 270),
    ghostNetAt(5, 1745, 1805, 94, 170),
  ]),
  elements: Object.freeze([]),
  /**
   * Down and right: up under the banks, along them past the Common spots, down between the two top
   * row nets, along the bottom row through the current, then down to the lane along the bed to the
   * exit.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 200 }),
    Object.freeze({ x: 440, y: 150 }),
    Object.freeze({ x: 1560, y: 150 }),
    Object.freeze({ x: 1560, y: 500 }),
    Object.freeze({ x: 2340, y: 500 }),
    Object.freeze({ x: 2360, y: 625 }),
    Object.freeze({ x: 2780, y: 625 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), left to right: above the root tangle, on the bed past it, in
   * the open water below the banks, below the top of the dive between `carp-0` and `carp-1`, on the
   * bed before the current, and in the top right corner. Every place is at least 80 px from every
   * tilapia and carp route, and clear of every net's drift path and every pole sweep by the rescue
   * reach (issue #119, ND-2; issue #134, ND-5).
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-1`, x: 360, y: 300 }),
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-2`, x: 690, y: 640 }),
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-3`, x: 1000, y: 250 }),
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-4`, x: 1700, y: 380 }),
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-5`, x: 2120, y: 650 }),
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-6`, x: 2800, y: 140 }),
  ]),
  treasures: CHINAMPA_TREASURES,
  snackWorms: 8,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  /** The garden plots along the top row; the gap column, where the current flows, has none. */
  bankChunks: Object.freeze([1, 2, 3, 5]),
  sunChunk: 0,
  tilapia: CHINAMPA_TILAPIA,
  bankOverhangs: Object.freeze([1, 2, 3, 5].map(bankOverhangOf)),
  /**
   * Under the banks: Common spots in the first two plots, along the main path, then Rare spots under
   * the bank in the top right, a dead end off the path, within reach of the strike bands of
   * `tilapia-1` and `tilapia-3`.
   */
  bankSpots: Object.freeze([
    Object.freeze([560, 110, 'common', false] as const),
    Object.freeze([700, 110, 'common', false] as const),
    Object.freeze([880, 110, 'common', false] as const),
    Object.freeze([1040, 110, 'common', false] as const),
    Object.freeze([1220, 110, 'common', false] as const),
    Object.freeze([1380, 110, 'common', false] as const),
    Object.freeze([2430, 110, 'rare', false] as const),
    Object.freeze([2490, 110, 'rare', false] as const),
    Object.freeze([2550, 110, 'rare', false] as const),
    Object.freeze([2610, 110, 'rare', false] as const),
    Object.freeze([2670, 110, 'rare', false] as const),
    Object.freeze([2730, 110, 'rare', false] as const),
  ]),
  /**
   * Two punting poles in top-row screen columns with no bank, 2 s out of step (issue #119, ND-4):
   * a short one by the Home Spot's column, clear of `tilapia-0`, and one between `carp-2` and the
   * bank in the top right (issue #134, ND-3).
   */
  movingHazards: Object.freeze([puntingPoleAt(1, 324, 0, 100), puntingPoleAt(2, 2190, 2, 180)]),
  /**
   * Seven tadpoles on wander loops (CHINAMPA_WANDER_LOOPS), out of step, and seven shrimp on homes of
   * 3 or 4 hop spots, four of each in the top row and three in the bottom row, half of the 28 snacks
   * (issue #134, ND-6).
   */
  mobileSnacks: mobileSnackMix({
    tadpole: CHINAMPA_TADPOLE,
    wanders: CHINAMPA_WANDER_LOOPS.map(chinampaWander),
    shrimp: CHINAMPA_SHRIMP,
    homes: [
      shrimpHome([[390, 120], [470, 110], [520, 160], [430, 170]]),
      shrimpHome([[1150, 112], [1230, 108], [1290, 150], [1200, 160]]),
      shrimpHome([[2265, 120], [2335, 112], [2380, 165], [2300, 175]]),
      shrimpHome([[2600, 110], [2680, 105], [2760, 120], [2700, 135]]),
      shrimpHome([[2430, 630], [2500, 645], [2570, 640]]),
      shrimpHome([[1950, 460], [2030, 450], [2070, 560], [1990, 600]]),
      shrimpHome([[2650, 620], [2720, 645], [2800, 610], [2740, 590]]),
    ],
  }),
} satisfies AreaLayoutData);
