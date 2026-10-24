/**
 * The chinampa gardens, Area 4 (issue #76), as area data: 6 screens across, 2 down, the first area
 * that scrolls up and down. The Home Spot is top left and the exit deep bottom right. The top-row
 * way runs under the overhanging banks of the garden plots, then dives between two ghost nets to
 * the bottom row; the bottom-row way runs past the root tangle and between two more nets. Both
 * meet at the gap between two chinampas, where the current flows, and the main path leaves it by a
 * lane along the bed to the exit. The root tangle in the bottom left and the bank in the top right
 * are dead ends that hold treasure spots. Six chasing tilapia, a carp and two punting poles keep
 * every screen of the main path in some threat's reach, and half the snacks are tadpoles and
 * shrimp (issue #119, ND-2 to ND-8).
 */
import { CHINAMPA_TREASURES } from './catalogue';
import { GHOST_NET, netDrift } from './ghostNets';
import type { HazardSpawn, NetDrift } from './hazards';
import { mobileSnackMix, shrimpRule, tadpoleLane, tadpoleRule, type TadpoleLane } from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import { CARP_SPECIES, tunedSpecies, type PredatorSpecies } from './predators';
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

/** Area 4's tadpole rule (issue #119, ND-8): 48 px/s. */
const CHINAMPA_TADPOLE = tadpoleRule(48);

/** Area 4's shrimp rule (issue #119, ND-8): trigger 60 px, rest 1.4 s, flick 52 px at 130 px/s. */
const CHINAMPA_SHRIMP = shrimpRule(60, 1.4, 52, 130);

/** Px of every tadpole lane, sideways (issue #119, ND-8). */
const LANE_LENGTH = 120;

/** How many tadpole lanes there are; each starts one seventh of a there-and-back cycle after the one before (issue #119, ND-8). */
const LANE_COUNT = 7;

/** One ghost net, id `chinampa-1/ghost-net-<n>`: a rect at a fixed place, drifting when `drift` is set (issue #119, ND-5). */
function ghostNetAt(index: number, x0: number, x1: number, y0: number, y1: number, drift?: Readonly<NetDrift>): Readonly<HazardSpawn> {
  return Object.freeze({
    id: `${CHINAMPA_AREA_ID}/ghost-net-${index}`,
    type: GHOST_NET,
    shape: Object.freeze({ kind: 'rect' as const, x0, x1, y0, y1 }),
    ...(drift ? { drift } : {}),
  });
}

/** One punting pole, id `chinampa-1/punting-pole-<n>`, at `x`, its cycle starting at `offset` s, reaching `depth` px (issue #119, ND-4). */
function puntingPoleAt(index: number, x: number, offset: number, depth: number): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${CHINAMPA_AREA_ID}/punting-pole-${index}`, PUNTING_POLE, x, offset, depth));
}

/** Tadpole lane `n` of LANE_COUNT, from (x, y) LANE_LENGTH px to the right, `(n - 1)` sevenths of its cycle ahead (issue #119, ND-8). */
function laneAt(n: number, x: number, y: number): Readonly<TadpoleLane> {
  const loopSeconds = (2 * LANE_LENGTH) / CHINAMPA_TADPOLE.speed;
  return tadpoleLane(CHINAMPA_TADPOLE, x, y, LANE_LENGTH, 0, ((n - 1) * loopSeconds) / LANE_COUNT);
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
  /** Just past the gap current, beside the last tilapia: Legendary pots nearer it, Epic spots farther. */
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
   * Six fixed patrol loops: `tilapia-0` over the root tangle, and `tilapia-1`, a tall loop from the
   * top row down into the bottom row, beside the spots past the current and under the bank in the
   * top right; then `tilapia-2` in the open water between the nets, and `tilapia-3` to `tilapia-5`
   * low over the bottom-row bed, the last under the current (issue #119, ND-2). Every two are more
   * than twice the lunge range of 145 px apart.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([420, 460] as const),
      Object.freeze([580, 460] as const),
      Object.freeze([580, 500] as const),
      Object.freeze([420, 500] as const),
    ]),
    Object.freeze([
      Object.freeze([2500, 300] as const),
      Object.freeze([2660, 300] as const),
      Object.freeze([2660, 470] as const),
      Object.freeze([2500, 470] as const),
    ]),
    Object.freeze([
      Object.freeze([1155, 320] as const),
      Object.freeze([1240, 320] as const),
      Object.freeze([1240, 334] as const),
      Object.freeze([1155, 334] as const),
    ]),
    Object.freeze([
      Object.freeze([1170, 630] as const),
      Object.freeze([1240, 630] as const),
      Object.freeze([1240, 648] as const),
      Object.freeze([1170, 648] as const),
    ]),
    Object.freeze([
      Object.freeze([1535, 630] as const),
      Object.freeze([1600, 630] as const),
      Object.freeze([1600, 648] as const),
      Object.freeze([1535, 648] as const),
    ]),
    Object.freeze([
      Object.freeze([2210, 630] as const),
      Object.freeze([2250, 630] as const),
      Object.freeze([2250, 648] as const),
      Object.freeze([2210, 648] as const),
    ]),
  ]),
  /** `carp-0` rooting along the bottom-row bed before the current (issue #119, ND-3). */
  predatorRoutes: Object.freeze([
    Object.freeze({
      id: 'carp-0',
      waypoints: Object.freeze([
        Object.freeze({ x: 1870, y: 600 }),
        Object.freeze({ x: 1940, y: 600 }),
        Object.freeze({ x: 1940, y: 640 }),
        Object.freeze({ x: 1870, y: 640 }),
      ]) as Point[],
      species: CHINAMPA_CARP,
    }),
  ]),
  /**
   * Five ghost nets, left to right: two in the bottom row with the bottom-row way between them, two
   * in the top row with the main path's dive between them, and one at the surface at the way into
   * the bank in the top right. The two bottom-row nets drift 120 px sideways in step, along the
   * current's flow, so the way between them stays 100 px tall (issue #119, ND-5). Each, by its whole
   * drift path, is more than a lunge plus its reach and the safe passing width from every tilapia
   * route and the carp's, and at least 190.5 px from the current, so a snag ends before a snagged
   * axolotl reaches it.
   */
  hazards: Object.freeze([
    ghostNetAt(1, 905, 965, 400, 470, netDrift(-120, 0, DRIFTING_NETS.period, 0)),
    ghostNetAt(2, 905, 965, 570, 640, netDrift(-120, 0, DRIFTING_NETS.period, 0)),
    ghostNetAt(3, 1460, 1510, 260, 360),
    ghostNetAt(4, 1610, 1660, 260, 360),
    ghostNetAt(5, 2200, 2260, 94, 170),
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
   * the open water below the banks, beyond the top row nets, on the bed before the current, and in
   * the top right corner. Every place is at least 80 px from every tilapia route and the carp's,
   * and clear of every net's drift path and every pole sweep by the rescue reach (issue #119, ND-2).
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-1`, x: 360, y: 300 }),
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-2`, x: 690, y: 640 }),
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-3`, x: 1000, y: 250 }),
    Object.freeze({ id: `${CHINAMPA_AREA_ID}/strand-4`, x: 1800, y: 250 }),
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
   * the bank in the top right, a dead end off the path, within reach of `tilapia-1`'s strike band.
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
  /** Two punting poles in top-row screen columns with no bank, 2 s out of step (issue #119, ND-4). */
  movingHazards: Object.freeze([puntingPoleAt(1, 420, 0, 180), puntingPoleAt(2, 2075, 2, 350)]),
  /** Seven tadpoles on lanes out of step and seven shrimp, half of the 28 snacks (issue #119, ND-8). */
  mobileSnacks: mobileSnackMix({
    tadpole: CHINAMPA_TADPOLE,
    lanes: [
      laneAt(1, 520, 200),
      laneAt(2, 700, 280),
      laneAt(3, 880, 200),
      laneAt(4, 1310, 180),
      laneAt(5, 1720, 420),
      laneAt(6, 1740, 180),
      laneAt(7, 2540, 650),
    ],
    shrimp: CHINAMPA_SHRIMP,
    spots: [
      { x: 640, y: 280 },
      { x: 980, y: 290 },
      { x: 1380, y: 480 },
      { x: 1960, y: 300 },
      { x: 2440, y: 640 },
      { x: 2320, y: 250 },
      { x: 1100, y: 160 },
    ],
  }),
} satisfies AreaLayoutData);
