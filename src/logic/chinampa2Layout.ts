/**
 * The chinampa gardens, Area 5 (issue #103), as area data: 7 screens across, 2 down, the first
 * U-turn area. The Home Spot is top left and the exit straight under it, bottom left. The main
 * path runs right along the top row, under the banks and deep under the three garter snakes'
 * stretches, through the first water hyacinth channel; it goes down in the rightmost screen column,
 * then runs back left along the bottom row, through the gap current, between two ghost nets, under
 * the first channel's mats and through the second channel to the exit. Each mat pair gates its row,
 * and the way round it, through the other row, passes a ghost net. The bank in the top right,
 * beside the snakes and the carp there, and the root tangle in the bottom row are dead ends that
 * hold treasure spots. It meets the full danger bar with the whole-water test (issue #135, ND-6):
 * three chasing tilapia, three chasing garter snakes, five chasing common carp patrolling every
 * depth and five punting poles that jab down across both rows of the main path in the west half
 * (issue #118, ND-3; issue #135, ND-1 and ND-2), with tadpoles and shrimp among its snacks (issue
 * #118, ND-12).
 */
import { CHINAMPA_2_TREASURES } from './catalogue';
import { GHOST_NET } from './ghostNets';
import type { ElementSpawn, HazardSpawn, MatPair } from './hazards';
import { hyacinthMatSpawn } from './hyacinthMats';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import { CARP_SPECIES, GARTER_SNAKE_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import {
  CARP,
  CARP_CHASE,
  GARTER_SNAKE,
  GARTER_SNAKE_CHASE,
  HYACINTH_MATS,
  TILAPIA,
  TILAPIA_CHASE,
  type TilapiaTuning,
} from './tuning';
import { SURF, WORLD_H, areaSize, type AreaLayoutData, type BankOverhang, type Point } from './zone';

export const CHINAMPA_2_AREA_ID = 'chinampa-2';

/** Top of the bed of the bottom row: 678. */
const CHINAMPA_2_BED_TOP = areaSize(7, 2).bedTop;

/** Lowest y of the overhanging banks: what is between the surface and here is under the bank. */
const BANK_UNDER_Y = 140;

/**
 * y of each garter snake's stretch, the line its head swims along at the surface. A snake warns at
 * no more than its lunge range (110 px) from its head on the stretch, and its dart hits no axolotl
 * centred below about y 254, so the water below y 260 is out of its reach.
 */
export const SNAKE_STRETCH_Y = 100;

/**
 * Area 5's tilapia, one more step up the predator ladder (#32): a 0.825 s warning, one step under
 * Area 4's 0.85 s and over the 0.8 s floor (issue #118, ND-2), with a faster and longer strike, a
 * shorter cooldown and a quicker patrol, and the full-bar chase (issue #118, ND-1). The strike
 * time and every other value stay TILAPIA's.
 */
export const CHINAMPA_2_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...TILAPIA,
  windup: 0.825,
  lungeSpeed: 420,
  lungeRange: 150,
  cooldown: 2,
  patrolSpeed: 55,
  chase: TILAPIA_CHASE,
});

/** Area 5's garter snake: the garter snake with its chase default, so it chases along its stretch (issue #118, ND-1). */
export const CHINAMPA_2_SNAKE: Readonly<PredatorSpecies> = tunedSpecies(
  GARTER_SNAKE_SPECIES,
  Object.freeze({ ...GARTER_SNAKE, chase: GARTER_SNAKE_CHASE }),
);

/**
 * Area 5's common carp, one step up the predator ladder from Area 4's: a 0.95 s warning, over the
 * 0.8 s floor, a sweep at 210 px/s for 0.6 s reaching 125 px, a 2.3 s cooldown, a 38 px/s patrol and
 * the carp's chase default (issue #135, ND-2).
 */
export const CHINAMPA_2_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...CARP, windup: 0.95, lungeSpeed: 210, lungeDuration: 0.6, lungeRange: 125, cooldown: 2.3, patrolSpeed: 38, chase: CARP_CHASE }),
);

/** Area 5's tadpole rule (issue #131, ND-9): 70 px/s. */
const CHINAMPA_2_TADPOLE = tadpoleRule(70);

/**
 * The ten tadpole wander loops' turn points (issue #131, ND-2, ND-3, ND-7; issue #135, ND-5), six in
 * the top row and four in the bottom row, each round open water beside the threats: in the top row
 * by the first pole, over the first net, under the first snake between the second and third poles,
 * past the last pole, between `tilapia-0` and the third snake, and under the bank in the top right;
 * in the bottom row beside the exit, under `carp-1`, past the current and beside `tilapia-2`, the
 * last two under the fifth net.
 */
const CHINAMPA_2_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[305, 250], [305, 98], [625, 98], [440, 145], [440, 252]] as const),
  Object.freeze([[560, 105], [910, 105], [910, 260], [740, 260], [740, 150]] as const),
  Object.freeze([[995, 260], [1100, 225], [1360, 225], [1360, 100], [1180, 150]] as const),
  Object.freeze([[1870, 280], [1870, 105], [2195, 105], [2020, 175], [2000, 280]] as const),
  Object.freeze([[2115, 100], [2435, 100], [2420, 260], [2290, 170]] as const),
  Object.freeze([[2990, 105], [3315, 105], [3315, 280], [3210, 280]] as const),
  Object.freeze([[45, 370], [215, 370], [365, 510], [215, 650], [45, 650]] as const),
  Object.freeze([[965, 650], [1020, 555], [857, 467], [695, 380], [695, 650]] as const),
  Object.freeze([[2670, 470], [2780, 640], [3000, 650], [2700, 648]] as const),
  Object.freeze([[2960, 650], [3080, 645], [3040, 455], [3170, 455], [3315, 560], [3170, 650]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 5's tadpole speed. */
function chinampa2LapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / CHINAMPA_2_TADPOLE.speed;
}

/**
 * Tadpole n of 10 (from 0) on its wander loop, n tenths of its own lap ahead, so the ten are out of
 * step (issue #118, ND-12; issue #131, ND-14).
 */
function chinampa2Wander(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(CHINAMPA_2_TADPOLE, points, (index * chinampa2LapSeconds(points)) / 10);
}

/** One ghost net: a rect at a fixed place, id `chinampa-2/ghost-net-<n>`. */
function ghostNetAt(index: number, x0: number, x1: number, y0: number, y1: number): Readonly<HazardSpawn> {
  return Object.freeze({
    id: `${CHINAMPA_2_AREA_ID}/ghost-net-${index}`,
    type: GHOST_NET,
    shape: Object.freeze({ kind: 'rect' as const, x0, x1, y0, y1 }),
  });
}

/** The water under the bank of top-row screen `column`, from the surface to BANK_UNDER_Y, inset 20 px. */
function bankOverhangOf(column: number): Readonly<BankOverhang> {
  return Object.freeze({ x0: column * 480 + 20, x1: column * 480 + 460, y0: SURF, y1: BANK_UNDER_Y });
}

/** One garter snake's route: a straight stretch from `x0` to `x1` at SNAKE_STRETCH_Y, two waypoints. */
function snakeStretch(id: string, x0: number, x1: number): Readonly<PredatorRoute> {
  const waypoints: Point[] = [Object.freeze({ x: x0, y: SNAKE_STRETCH_Y }), Object.freeze({ x: x1, y: SNAKE_STRETCH_Y })];
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species: CHINAMPA_2_SNAKE });
}

/** One common carp's route, id `carp-<n>`: a closed loop through `points`, each an [x, y] pair (issue #135, ND-2). */
function carpLoop(index: number, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id: `carp-${index}`, waypoints: Object.freeze(waypoints) as Point[], species: CHINAMPA_2_CARP });
}

/**
 * One punting pole, id `chinampa-2/punting-pole-<n>`, at `x`, its cycle starting at `offset`
 * seconds, its tip reaching `depth` px below the surface (issue #118, ND-6).
 */
function puntingPoleAt(index: number, x: number, offset: number, depth: number): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${CHINAMPA_2_AREA_ID}/punting-pole-${index}`, PUNTING_POLE, x, offset, depth));
}

/**
 * One water hyacinth mat pair, id `chinampa-2/hyacinth-mats-<n>`, starting its cycle at `offset`:
 * a channel across `x0..x1` at `channelY`, `HYACINTH_MATS.openHeight` px tall when open, its mats
 * spanning the row from `rowTop` to `rowBottom`.
 */
function matPairAt(
  index: number,
  offset: number,
  pair: Pick<MatPair, 'x0' | 'x1' | 'rowTop' | 'rowBottom' | 'channelY'>,
): Readonly<ElementSpawn> {
  const spawn = hyacinthMatSpawn(`${CHINAMPA_2_AREA_ID}/hyacinth-mats-${index}`, offset, { ...pair, openHeight: HYACINTH_MATS.openHeight });
  Object.freeze(spawn.matPair);
  return Object.freeze(spawn);
}

/** The chinampa gardens, Area 5, as area data: 7 screens across, 2 down. */
export const CHINAMPA_2_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: CHINAMPA_2_AREA_ID,
  screensWide: 7,
  screensTall: 2,
  start: Object.freeze({ x: 120, y: 200 }),
  /** The Home Spot's column in the top row only, so the exit under it is outside the safe area. */
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: WORLD_H }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /** In the root tangle on the bed of the bottom row: Legendary pots nearest `tilapia-0`, Epic spots farther. */
  caveSpots: Object.freeze([
    Object.freeze([2092, 570, 'legendary', true] as const),
    Object.freeze([2092, 626, 'legendary', true] as const),
    Object.freeze([2032, 570, 'epic', false] as const),
    Object.freeze([2032, 626, 'epic', false] as const),
  ]),
  /**
   * Just past the gap current, on the far side along the main path, beside `tilapia-0`: Legendary
   * pots nearer it, Epic spots farther.
   */
  currentSpots: Object.freeze([
    Object.freeze([2320, 540, 'legendary', true] as const),
    Object.freeze([2320, 600, 'legendary', true] as const),
    Object.freeze([2380, 540, 'epic', false] as const),
    Object.freeze([2380, 600, 'epic', false] as const),
  ]),
  /**
   * The water flowing through the gap between two chinampas in the bottom row, sideways and to the
   * right, against the main path coming back along the bottom row, a little stronger than Area 4's.
   */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 2460, x1: 2660, y0: 380, y1: 640, force: Object.freeze({ x: 73, y: 0 }) }),
  ]),
  /** The tangle of ahuejote roots on the bed of the bottom row, a dead end below the main path. */
  cave: Object.freeze({ id: `${CHINAMPA_2_AREA_ID}/cave`, x0: 1920, x1: 2100, y0: 560, y1: CHINAMPA_2_BED_TOP }),
  /**
   * Three fixed patrol loops, each reaching into two depth bands: `tilapia-0` up and down beside the
   * root tangle, from the bottom-row path down to the spots past the current; `tilapia-1` from the
   * surface band into the middle one, under the second snake's stretch, just past the current; and
   * `tilapia-2` up and down the right edge of the bottom row (issue #118, ND-3; issue #135, ND-3).
   * Every two are more than twice the lunge range of 150 px apart.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([2160, 330] as const),
      Object.freeze([2250, 330] as const),
      Object.freeze([2250, 620] as const),
      Object.freeze([2160, 620] as const),
    ]),
    Object.freeze([
      Object.freeze([2767, 250] as const),
      Object.freeze([2773, 250] as const),
      Object.freeze([2773, 306] as const),
      Object.freeze([2767, 306] as const),
    ]),
    Object.freeze([
      Object.freeze([3316, 444] as const),
      Object.freeze([3320, 444] as const),
      Object.freeze([3320, 650] as const),
      Object.freeze([3316, 650] as const),
    ]),
  ]),
  /**
   * Three chasing garter snakes, each on its own 160 px stretch at the surface in open top-row
   * water: one in the third column, two in the sixth (issue #118, ND-3). Then five chasing common
   * carp, each loop reaching into two depth bands (issue #135, ND-2): `carp-0` up and down the
   * bottom row beside the exit, `carp-1` between the first two poles, `carp-2` from under the first
   * snake down to the bed and along it under the first channel's mats, `carp-3` beside the gap
   * current, and `carp-4` from the surface band into the middle one under the bank in the top right.
   * Each carp loop is more than 275 px from every tilapia loop, 250 px from every other carp loop and
   * 235 px from every snake stretch; `carp-0` and `carp-2` patrol the bottom row west of x 1850.
   */
  predatorRoutes: Object.freeze([
    snakeStretch('garter-snake-0', 1080, 1240),
    snakeStretch('garter-snake-1', 2700, 2860),
    snakeStretch('garter-snake-2', 2525, 2685),
    carpLoop(0, [[341, 380], [345, 380], [345, 560], [341, 560]]),
    carpLoop(1, [[830, 320], [832, 320], [832, 500], [830, 500]]),
    carpLoop(2, [[1096, 362], [1265, 362], [1265, 560], [1320, 648], [1700, 648], [1096, 648]]),
    carpLoop(3, [[2527, 444], [2528, 444], [2528, 650], [2527, 650]]),
    carpLoop(4, [[3049, 250], [3078, 250], [3078, 306], [3049, 306]]),
  ]),
  /**
   * Five punting poles jabbing down from the surface across both rows of the main path in the west
   * half, each in a column with no bank, each sweep farther than every predator's strike reach from
   * its loop, clear of the mats, 2 s out of step with the next (issue #118, ND-6; issue #135, ND-1).
   */
  movingHazards: Object.freeze([
    puntingPoleAt(1, 476, 0, 440),
    puntingPoleAt(2, 964, 2, 400),
    puntingPoleAt(3, 1400, 0, 360),
    puntingPoleAt(4, 1760, 2, 340),
    puntingPoleAt(5, 1840, 0, 340),
  ]),
  /**
   * Five ghost nets: one in the top row over the second mat pair, two in the bottom row past the
   * last pole with the main path between them, one low and flat in the bottom row under the first
   * mat pair, and one in the bottom right by the turn (issue #135, owner decision 2026-10-25). Each
   * is farther from every predator route than that predator's strike plus the net reach and the
   * safe passing width, at least 190.5 px from the current, and clear of every mat sweep by the net
   * reach and one body.
   */
  hazards: Object.freeze([
    ghostNetAt(1, 555, 635, 240, 280),
    ghostNetAt(2, 1917, 1955, 362, 400),
    ghostNetAt(3, 1917, 1955, 484, 544),
    ghostNetAt(4, 1540, 1640, 446, 468),
    ghostNetAt(5, 2880, 2940, 480, 560),
  ]),
  /**
   * Two water hyacinth mat pairs, out of step: the first gates the top row, the second the bottom
   * row. Each channel is 150 px long and 72 px tall when open.
   */
  elements: Object.freeze([
    matPairAt(1, HYACINTH_MATS.offsets[0], { x0: 1500, x1: 1650, rowTop: SURF, rowBottom: WORLD_H, channelY: 220 }),
    matPairAt(2, HYACINTH_MATS.offsets[1], { x0: 535, x1: 685, rowTop: WORLD_H, rowBottom: CHINAMPA_2_BED_TOP, channelY: 500 }),
  ]),
  /**
   * The U-turn: right along the top row, under the first bank past the Common spots, down under the
   * first snake, through the first channel, up under the second bank, down under the second snake,
   * then down in the rightmost column and back left along the bottom row, through the current,
   * between two nets, under the first channel's mats and through the second channel to the exit.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 200 }),
    Object.freeze({ x: 440, y: 150 }),
    Object.freeze({ x: 820, y: 150 }),
    Object.freeze({ x: 1100, y: 300 }),
    Object.freeze({ x: 1300, y: 300 }),
    Object.freeze({ x: 1440, y: 220 }),
    Object.freeze({ x: 1740, y: 220 }),
    Object.freeze({ x: 1960, y: 150 }),
    Object.freeze({ x: 2300, y: 150 }),
    Object.freeze({ x: 2480, y: 300 }),
    Object.freeze({ x: 2980, y: 300 }),
    Object.freeze({ x: 2980, y: 400 }),
    Object.freeze({ x: 2010, y: 400 }),
    Object.freeze({ x: 1960, y: 442 }),
    Object.freeze({ x: 1910, y: 442 }),
    Object.freeze({ x: 1860, y: 410 }),
    Object.freeze({ x: 1460, y: 400 }),
    Object.freeze({ x: 1200, y: 462 }),
    Object.freeze({ x: 1020, y: 462 }),
    Object.freeze({ x: 800, y: 500 }),
    Object.freeze({ x: 500, y: 500 }),
    Object.freeze({ x: 120, y: 625 }),
  ]),
  /**
   * Fixed stranding places (PRD C2): in the open water past the safe area, on the bed past the
   * second channel, in the top row past the first channel, under the second bank, on the bed past
   * the current and in the bottom right corner. Every place is at least 80 px from every tilapia
   * route, snake stretch and carp loop, out of every snake's reach and clear of every pole sweep by
   * the touch and rescue reach (issue #118, ND-6; issue #135, ND-2).
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${CHINAMPA_2_AREA_ID}/strand-1`, x: 360, y: 300 }),
    Object.freeze({ id: `${CHINAMPA_2_AREA_ID}/strand-2`, x: 900, y: 600 }),
    Object.freeze({ id: `${CHINAMPA_2_AREA_ID}/strand-3`, x: 1980, y: 300 }),
    Object.freeze({ id: `${CHINAMPA_2_AREA_ID}/strand-4`, x: 2200, y: 230 }),
    Object.freeze({ id: `${CHINAMPA_2_AREA_ID}/strand-5`, x: 2800, y: 520 }),
    Object.freeze({ id: `${CHINAMPA_2_AREA_ID}/strand-6`, x: 3200, y: 470 }),
  ]),
  treasures: CHINAMPA_2_TREASURES,
  /** 13 worms and bugs to 19 mobile snacks, Area 5's row of the snack ramp (issue #118, ND-12). */
  snackWorms: 7,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  /** The garden plots along the top row; the snakes' columns and the first channel's have none. */
  bankChunks: Object.freeze([1, 4, 6]),
  sunChunk: 0,
  tilapia: CHINAMPA_2_TILAPIA,
  bankOverhangs: Object.freeze([1, 4, 6].map(bankOverhangOf)),
  /**
   * Under the banks: Common spots along the main path under the first two banks; Rare spots off it,
   * at the right end of the first bank, within the second pole's strike band, at the right end of
   * the second bank, within the third snake's, and in the dead end under the bank in the top right,
   * within the second snake's or `carp-4`'s strike band (issue #118, ND-6; issue #135, owner decision
   * 2026-10-25).
   */
  bankSpots: Object.freeze([
    Object.freeze([560, 110, 'common', false] as const),
    Object.freeze([680, 110, 'common', false] as const),
    Object.freeze([800, 110, 'common', false] as const),
    Object.freeze([2020, 110, 'common', false] as const),
    Object.freeze([2140, 110, 'common', false] as const),
    Object.freeze([2260, 110, 'common', false] as const),
    Object.freeze([2375, 110, 'rare', false] as const),
    Object.freeze([929, 110, 'rare', false] as const),
    Object.freeze([2971, 138, 'rare', false] as const),
    Object.freeze([3013, 100, 'rare', false] as const),
    Object.freeze([3069, 100, 'rare', false] as const),
    Object.freeze([3125, 100, 'rare', false] as const),
    Object.freeze([3167, 138, 'rare', false] as const),
    Object.freeze([3223, 138, 'rare', false] as const),
  ]),
  /**
   * Ten tadpoles on wander loops (CHINAMPA_2_LOOPS), each a tenth of its own lap further on than
   * the last, and nine shrimp on homes of 3 hop spots, five in the top row and four in the bottom
   * row, with Area 5's rules; every loop and home passes tadpoleWanderClear() and shrimpHomeClear(),
   * and each shrimp starts on a spot out of every threat's reach (issue #118, ND-12; issue #131,
   * ND-14; issue #135, ND-5).
   */
  mobileSnacks: mobileSnackMix({
    tadpole: CHINAMPA_2_TADPOLE,
    wanders: CHINAMPA_2_LOOPS.map(chinampa2Wander),
    shrimp: shrimpRule(60, 1.2, 60, 145),
    homes: [
      shrimpHome([[350, 160], [420, 120], [430, 210]]),
      shrimpHome([[780, 140], [860, 130], [820, 175]]),
      shrimpHome([[2060, 130], [2140, 120], [2100, 170]]),
      shrimpHome([[2300, 130], [2380, 140], [2340, 175]]),
      shrimpHome([[3240, 150], [3300, 210], [3230, 250]]),
      shrimpHome([[100, 420], [170, 470], [110, 520]]),
      shrimpHome([[860, 644], [780, 640], [930, 615]]),
      shrimpHome([[2700, 500], [2760, 560], [2700, 610]]),
      shrimpHome([[3080, 480], [3130, 560], [3060, 620]]),
    ],
  }),
} satisfies AreaLayoutData);
