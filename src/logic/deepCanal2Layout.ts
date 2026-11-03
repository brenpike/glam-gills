/**
 * The deep canal's Area 9 (issue #107), as area data: 9 screens across, 2 down, a hub. The Home
 * Spot sits mid-area, and the safe area is its column. The west branch holds the treasure: Rare
 * spots under its moored rows, the sunken hull cave under the wide murky patch and the side-canal
 * inflow on the bed. The east branch holds the main path: along the surface under the moored rows,
 * through two narrow murky patches, under both anchor drops and past both bailing boats to the
 * exit, low at the branch's end with its gate on the bed.
 */
import { bailingBoatSpawn, type BailingBoatSpawn } from './bailingBuckets';
import { DEEP_CANAL_2_TREASURES } from './catalogue';
import { DEEP_CANAL_CARP, DEEP_CANAL_TILAPIA } from './deepCanalLayout';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { ANCHOR_DROP, MUD_SEEP, movingHazardSpawn, type MovingHazardSpawn, type MovingHazardType } from './movingHazards';
import { murkyPatchSpawn, type MurkyPatchSpawn } from './murkyWater';
import { BLACK_BASS_SPECIES, CARP_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { BLACK_BASS, BLACK_BASS_CHASE, type TilapiaTuning } from './tuning';
import { SURF, WORLD_H, areaSize, swimBounds, type AreaLayoutData, type BankOverhang, type Point } from './zone';

export const DEEP_CANAL_2_AREA_ID = 'deep-canal-2';

/** Area 9's size: 9 screens across, 2 down. */
const SIZE = areaSize(9, 2);

/** Top of the bed of the bottom row: 678. */
const BED_TOP = SIZE.bedTop;

/** Bottom of the water under each moored row, the bank cover of its spots (B5). */
const MOORED_HULL_Y = 140;

/** Depth in px below the surface of each anchor drop: the main path dips under its anchor. */
const ANCHOR_DEPTH = 140;

/** Height in px above the bed of each mud seep's column. */
const SEEP_HEIGHT = 200;

/**
 * Area 9's tilapia, one step up the predator ladder from Area 8's (owner, #107): a 460 px/s strike
 * reaching 160 px, a 1.7 s cooldown and a 65 px/s patrol. Every other value, the 0.8 s warning and
 * the full-bar chase included, stays Area 8's.
 */
export const DEEP_CANAL_2_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...DEEP_CANAL_TILAPIA,
  lungeSpeed: 460,
  lungeRange: 160,
  cooldown: 1.7,
  patrolSpeed: 65,
});

/**
 * Area 9's common carp, one step up the predator ladder from Area 8's (issue #107, ND-3): a 1.6 s
 * cooldown and a 60 px/s patrol, with Area 8's other values and chase.
 */
export const DEEP_CANAL_2_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...DEEP_CANAL_CARP.tuning, cooldown: 1.6, patrolSpeed: 60 }),
);

/**
 * Area 9's black bass (owner, #107): a 500 px/s strike, a 1.4 s cooldown and a 65 px/s patrol, with
 * Area 8's other values and the bass chase.
 */
export const DEEP_CANAL_2_BASS: Readonly<PredatorSpecies> = tunedSpecies(
  BLACK_BASS_SPECIES,
  Object.freeze({ ...BLACK_BASS, lungeSpeed: 500, cooldown: 1.4, patrolSpeed: 65, chase: BLACK_BASS_CHASE }),
);

/** Area 9's tadpole rule, the top of the later snack ramp row: 72 px/s, as Area 8's. */
const DEEP_CANAL_2_TADPOLE = tadpoleRule(72);

/** Area 9's shrimp rule, Area 8's: trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s. */
const DEEP_CANAL_2_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/**
 * The sixteen tadpole wander loops' turn points, placed after the threats, each clear of every murky
 * patch and every catch box: five in the top of the west branch over the sunken hull and the inflow,
 * three on the west bed past the mud seep, four by the hub's east side under the first moored row,
 * and four at the end of the east branch, past the bailing boats.
 */
const DEEP_CANAL_2_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[40, 100], [360, 100], [330, 250], [170, 182.5]] as const),
  Object.freeze([[200, 154], [520, 154], [490, 304], [330, 236.5]] as const),
  Object.freeze([[340, 316], [660, 316], [630, 166], [470, 248.5]] as const),
  Object.freeze([[360, 226], [680, 226], [650, 376], [490, 308.5]] as const),
  Object.freeze([[500, 100], [820, 100], [790, 250], [630, 182.5]] as const),
  Object.freeze([[1300, 592], [1620, 592], [1590, 442], [1430, 524.5]] as const),
  Object.freeze([[1260, 454], [1580, 454], [1550, 604], [1390, 536.5]] as const),
  Object.freeze([[1220, 646], [1540, 646], [1510, 496], [1350, 578.5]] as const),
  Object.freeze([[2320, 100], [2640, 100], [2610, 250], [2450, 182.5]] as const),
  Object.freeze([[2320, 262], [2640, 262], [2610, 112], [2450, 194.5]] as const),
  Object.freeze([[2340, 190], [2660, 190], [2630, 340], [2470, 272.5]] as const),
  Object.freeze([[2360, 130], [2680, 130], [2650, 280], [2490, 212.5]] as const),
  Object.freeze([[3960, 376], [4280, 376], [4250, 226], [4090, 308.5]] as const),
  Object.freeze([[3960, 300], [4280, 300], [4250, 450], [4090, 382.5]] as const),
  Object.freeze([[3960, 556], [4280, 556], [4250, 406], [4090, 488.5]] as const),
  Object.freeze([[3960, 490], [4280, 490], [4250, 640], [4090, 572.5]] as const),
]);

/**
 * The seventeen shrimp homes' hop spots, each starting on a spot out of every threat's strike and
 * clear of every murky patch and every catch box: nine at the west end of the west branch, three
 * more along it, three under the first moored row of the east branch, one under the second and one
 * at the end of the east branch.
 */
const DEEP_CANAL_2_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[60, 200], [120, 170], [100, 240]] as const),
  Object.freeze([[60, 300], [120, 270], [100, 340]] as const),
  Object.freeze([[60, 400], [120, 370], [100, 440]] as const),
  Object.freeze([[140, 150], [200, 120], [180, 190]] as const),
  Object.freeze([[300, 145], [360, 115], [340, 185]] as const),
  Object.freeze([[440, 145], [500, 115], [480, 185]] as const),
  Object.freeze([[560, 200], [620, 170], [600, 240]] as const),
  Object.freeze([[560, 300], [620, 270], [600, 340]] as const),
  Object.freeze([[600, 400], [660, 370], [640, 440]] as const),
  Object.freeze([[1300, 600], [1360, 570], [1340, 640]] as const),
  Object.freeze([[1560, 500], [1620, 470], [1600, 540]] as const),
  Object.freeze([[1880, 145], [1940, 115], [1920, 185]] as const),
  Object.freeze([[2400, 180], [2460, 150], [2440, 220]] as const),
  Object.freeze([[2500, 150], [2560, 120], [2540, 190]] as const),
  Object.freeze([[2600, 180], [2660, 150], [2640, 220]] as const),
  Object.freeze([[3120, 180], [3180, 150], [3160, 220]] as const),
  Object.freeze([[4180, 300], [4240, 270], [4220, 340]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 9's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / DEEP_CANAL_2_TADPOLE.speed;
}

/** Tadpole n (from 0) on its wander loop, n parts of its own lap ahead, so the tadpoles are out of step. */
function wanderAt(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(DEEP_CANAL_2_TADPOLE, points, (index * lapSeconds(points)) / DEEP_CANAL_2_LOOPS.length);
}

/** The water under one moored row at the surface, the bank cover (B5). */
function mooredRow(x0: number, x1: number): Readonly<BankOverhang> {
  return Object.freeze({ x0, x1, y0: SURF, y1: MOORED_HULL_Y });
}

/** One predator's route, id `<name>-<n>`: a closed loop through `points`, each an [x, y] pair. */
function loopRoute(id: string, species: Readonly<PredatorSpecies>, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species });
}

/** One anchor drop, id `deep-canal-2/anchor-drop-<n>`, at `x`, its cycle starting at `offset` seconds. */
function anchorDropAt(index: number, x: number, offset: number): Readonly<MovingHazardSpawn> {
  return moverAt(ANCHOR_DROP, index, x, offset, ANCHOR_DEPTH);
}

/** One mud seep, id `deep-canal-2/mud-seep-<n>`, on the bed at `x`, its cycle starting at `offset` seconds. */
function mudSeepAt(index: number, x: number, offset: number): Readonly<MovingHazardSpawn> {
  return moverAt(MUD_SEEP, index, x, offset, SEEP_HEIGHT, BED_TOP);
}

/** One moving hazard of `type`, id `deep-canal-2/<type id>-<n>`, at `x`, reaching `depth` px from its base. */
function moverAt(
  type: Readonly<MovingHazardType>,
  index: number,
  x: number,
  offset: number,
  depth: number,
  baseY?: number,
): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${DEEP_CANAL_2_AREA_ID}/${type.id}-${index}`, type, x, offset, depth, baseY));
}

/** One murky patch, id `deep-canal-2/murky-water-<n>`, over the rect. */
function murkyPatchAt(index: number, x0: number, x1: number, y0: number, y1: number): Readonly<MurkyPatchSpawn> {
  const patch = murkyPatchSpawn(`${DEEP_CANAL_2_AREA_ID}/murky-water-${index}`, { x0, x1, y0, y1 });
  Object.freeze(patch.shape);
  return Object.freeze(patch);
}

/**
 * One bailing boat, id `deep-canal-2/bailing-bucket-<n>`, moored over `x0..x1` with its bucket at
 * `bucketX`, tossing a caught axolotl to `landing`; its cycle starts at `offset` seconds.
 */
function bailingBoatAt(index: number, offset: number, x0: number, x1: number, bucketX: number, landing: readonly [number, number]): Readonly<BailingBoatSpawn> {
  const spawn = bailingBoatSpawn(
    `${DEEP_CANAL_2_AREA_ID}/bailing-bucket-${index}`,
    offset,
    { x0, x1, bucketX, landing: { x: landing[0], y: landing[1] } },
    swimBounds(SIZE),
  );
  Object.freeze(spawn.bailing.landing);
  Object.freeze(spawn.bailing);
  return Object.freeze(spawn);
}

/** The deep canal's Area 9, as area data: 9 screens across, 2 down. */
export const DEEP_CANAL_2_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: DEEP_CANAL_2_AREA_ID,
  screensWide: 9,
  screensTall: 2,
  start: Object.freeze({ x: 2160, y: 360 }),
  /** The Home Spot's column, top to bottom, in the hub where the branches meet. */
  safeArea: Object.freeze({ x0: 2015, x1: 2305, y0: SURF, y1: WORLD_H * 2 }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /** The sunken hull cave (B6), under the wide murky patch: an open Legendary spot within half `carp-1`'s strike, and an Epic spot farther off. */
  caveSpots: Object.freeze([
    Object.freeze([330, 655, 'legendary', false] as const),
    Object.freeze([470, 650, 'epic', false] as const),
  ]),
  /**
   * Just past the side-canal inflow, on its upstream side: three open Legendary spots within half the
   * bass strike of `bass-0`, then two Epic spots farther off. No Dash pot: each Legendary spot is
   * deep and near a threat (ADR 0032).
   */
  currentSpots: Object.freeze([
    Object.freeze([800, 490, 'legendary', false] as const),
    Object.freeze([800, 550, 'legendary', false] as const),
    Object.freeze([800, 610, 'legendary', false] as const),
    Object.freeze([745, 520, 'epic', false] as const),
    Object.freeze([745, 580, 'epic', false] as const),
  ]),
  /** The side-canal inflow on the west bed, flowing gently left (B6). */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 600, x1: 740, y0: 480, y1: 640, force: Object.freeze({ x: -72, y: 0 }) }),
  ]),
  /** The sunken hull, a dead end on the west bed under the wide murky patch (B6). */
  cave: Object.freeze({ id: `${DEEP_CANAL_2_AREA_ID}/cave`, x0: 280, x1: 480, y0: 590, y1: BED_TOP }),
  /**
   * One tilapia on each branch, each loop reaching two depth bands: `tilapia-0` in the west branch,
   * reaching up into the surface band, and `tilapia-1` under `anchor-drop-1`, its top setting the main
   * path's narrowest gap with the anchor.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([1100, 230] as const),
      Object.freeze([1240, 230] as const),
      Object.freeze([1240, 430] as const),
      Object.freeze([1100, 430] as const),
    ]),
    Object.freeze([
      Object.freeze([2900, 440] as const),
      Object.freeze([3060, 440] as const),
      Object.freeze([3060, 630] as const),
      Object.freeze([2900, 630] as const),
    ]),
  ]),
  /**
   * Six carp, three on each branch, each loop reaching two depth bands: `carp-0` west of the hub,
   * `carp-1` over the sunken hull and `carp-2` up in the surface band; `carp-3` by the hub's east
   * side, `carp-4` under the second murky patch and `carp-5` under `anchor-drop-2`. Then one black
   * bass on each branch on a long open-water route: `bass-0` by the inflow, reaching the surface
   * band, and `bass-1` past the anchors, under the bailing boats. The east loops keep their strikes
   * low, clear of the Common spots by the main path.
   */
  predatorRoutes: Object.freeze([
    loopRoute('carp-0', DEEP_CANAL_2_CARP, [[1760, 300], [1900, 300], [1900, 560], [1760, 560]]),
    loopRoute('carp-1', DEEP_CANAL_2_CARP, [[260, 300], [400, 300], [400, 600], [260, 600]]),
    loopRoute('carp-2', DEEP_CANAL_2_CARP, [[1560, 130], [1700, 130], [1700, 306], [1560, 306]]),
    loopRoute('carp-3', DEEP_CANAL_2_CARP, [[2480, 340], [2620, 340], [2620, 600], [2480, 600]]),
    loopRoute('carp-4', DEEP_CANAL_2_CARP, [[3200, 340], [3340, 340], [3340, 600], [3200, 600]]),
    loopRoute('carp-5', DEEP_CANAL_2_CARP, [[3460, 440], [3600, 440], [3600, 620], [3460, 620]]),
    loopRoute('bass-0', DEEP_CANAL_2_BASS, [[860, 240], [1040, 240], [1040, 640], [860, 640]]),
    loopRoute('bass-1', DEEP_CANAL_2_BASS, [[3800, 300], [3960, 300], [3960, 560], [3800, 560]]),
  ]),
  /**
   * Two anchor drops on the main path, 2.4 s out of step, each lowered 140 px so the path dips under
   * its anchor; then two mud seeps on the bed, `mud-seep-1` in the west branch between `tilapia-0`
   * and `carp-0`, and `mud-seep-2` under the second bailing boat, by the exit.
   */
  movingHazards: Object.freeze([
    anchorDropAt(1, 2980, 0),
    anchorDropAt(2, 3520, 2.4),
    mudSeepAt(1, 1450, 0),
    mudSeepAt(2, 4060, 2.8),
  ]),
  /**
   * The three murky patches (issue #107, ND-1): two narrow ones over the main path in the east
   * branch, each 160 px wide, then a wide one over the sunken hull's dead end in the west branch.
   */
  hazards: Object.freeze([
    murkyPatchAt(1, 2760, 2920, 94, 300),
    murkyPatchAt(2, 3300, 3460, 94, 300),
    murkyPatchAt(3, 200, 520, 520, 656),
  ]),
  elements: Object.freeze([]),
  /**
   * From the Home Spot up into the east branch, along the surface under the moored rows, through the
   * first murky patch, under `anchor-drop-1`, through the second murky patch, under `anchor-drop-2`,
   * through both catch boxes and down to the exit on the bed.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 2160, y: 360 }),
    Object.freeze({ x: 2380, y: 140 }),
    Object.freeze({ x: 2930, y: 140 }),
    Object.freeze({ x: 2950, y: 260 }),
    Object.freeze({ x: 3010, y: 260 }),
    Object.freeze({ x: 3030, y: 140 }),
    Object.freeze({ x: 3470, y: 140 }),
    Object.freeze({ x: 3490, y: 260 }),
    Object.freeze({ x: 3550, y: 260 }),
    Object.freeze({ x: 3570, y: 140 }),
    Object.freeze({ x: 4140, y: 140 }),
    Object.freeze({ x: 4200, y: 600 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), three on each branch: each at least 80 px from every predator
   * route, clear of every sweep by the touch and rescue reach, out of the inflow, every murky patch
   * and every catch box.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${DEEP_CANAL_2_AREA_ID}/strand-1`, x: 600, y: 250 }),
    Object.freeze({ id: `${DEEP_CANAL_2_AREA_ID}/strand-2`, x: 1450, y: 250 }),
    Object.freeze({ id: `${DEEP_CANAL_2_AREA_ID}/strand-3`, x: 1600, y: 520 }),
    Object.freeze({ id: `${DEEP_CANAL_2_AREA_ID}/strand-4`, x: 2720, y: 400 }),
    Object.freeze({ id: `${DEEP_CANAL_2_AREA_ID}/strand-5`, x: 3150, y: 250 }),
    Object.freeze({ id: `${DEEP_CANAL_2_AREA_ID}/strand-6`, x: 3700, y: 300 }),
  ]),
  treasures: DEEP_CANAL_2_TREASURES,
  snackWorms: 8,
  snackBugs: 7,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  tilapia: DEEP_CANAL_2_TILAPIA,
  /** Moored rows at the surface (B5): four in the west branch, two by the main path in the east branch. */
  bankOverhangs: Object.freeze([
    mooredRow(240, 420),
    mooredRow(620, 780),
    mooredRow(1340, 1480),
    mooredRow(1780, 1940),
    mooredRow(2420, 2680),
    mooredRow(3060, 3260),
  ]),
  /** Under the moored rows (B5): Common spots by the main path in the east branch, Rare spots in the west branch. */
  bankSpots: Object.freeze([
    Object.freeze([2480, 110, 'common', false] as const),
    Object.freeze([2540, 110, 'common', false] as const),
    Object.freeze([2600, 110, 'common', false] as const),
    Object.freeze([3100, 110, 'common', false] as const),
    Object.freeze([3160, 110, 'common', false] as const),
    Object.freeze([3220, 110, 'common', false] as const),
    Object.freeze([330, 130, 'rare', false] as const),
    Object.freeze([700, 110, 'rare', false] as const),
    Object.freeze([1400, 110, 'rare', false] as const),
    Object.freeze([1850, 110, 'rare', false] as const),
    Object.freeze([1905, 140, 'rare', false] as const),
  ]),
  /**
   * The two bailing boats (issue #107, ND-2), half a 7 s cycle out of step, moored over the main path
   * near the exit. Each tosses a caught axolotl about 3 screens back toward the hub, to a landing
   * point out of every predator's reach with its leash.
   */
  bailingBoats: Object.freeze([
    bailingBoatAt(1, 0, 3720, 3840, 3780, [2330, 110]),
    bailingBoatAt(2, 3.5, 3960, 4080, 4020, [2740, 100]),
  ]),
  /** 16 tadpoles and 17 shrimp to 8 worms and 7 bugs: 33 of 48 snacks mobile, 68.75% (the later snack ramp row). */
  mobileSnacks: mobileSnackMix({
    tadpole: DEEP_CANAL_2_TADPOLE,
    wanders: DEEP_CANAL_2_LOOPS.map(wanderAt),
    shrimp: DEEP_CANAL_2_SHRIMP,
    homes: DEEP_CANAL_2_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);
