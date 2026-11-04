/**
 * The deep canal's Area 10 (issue #108), as area data: 10 screens across, 3 down, a grand tour
 * (ND-7), a long route that mixes the earlier shapes. The Home Spot is top left, and the safe area is
 * its column of the top row. The main path drops down and right into the fork pocket, swims the upper
 * of two lanes split by an old-stone divider to the join pocket, makes a U-turn along the top row,
 * descends through all three rows, runs east along the bed, climbs back up through a clear opening
 * between `anchor-drop-4` and `bass-0`, and forks at the hub at the top right: the main branch drops
 * to the exit low at the east end, and the treasure branch runs on east past the side-canal inflow to
 * a dead end. Each predator guards its own part of the area. Three fishing trajineras hang five lures
 * among the snacks, and two drag nets sweep stretches of the main path.
 */
import { DEEP_CANAL_3_TREASURES } from './catalogue';
import { DEEP_CANAL_2_BASS, DEEP_CANAL_2_CARP, DEEP_CANAL_2_TILAPIA } from './deepCanal2Layout';
import { DRAG_NETS, dragNetSpawn, type DragNetPlan, type DragNetSpawn, type DragNetTiming } from './dragNets';
import { fishingBoatSpawn, type FishingBoatSpawn, type LurePlace } from './lures';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { ANCHOR_DROP, MUD_SEEP, movingHazardSpawn, type MovingHazardSpawn, type MovingHazardType } from './movingHazards';
import { murkyPatchSpawn, type MurkyPatchSpawn } from './murkyWater';
import type { RockWall } from './pebble';
import {
  CARP_SPECIES,
  CRAYFISH_SPECIES,
  GARTER_SNAKE_SPECIES,
  HERON_SPECIES,
  BLACK_BASS_SPECIES,
  tunedSpecies,
  type PredatorRoute,
  type PredatorSpecies,
} from './predators';
import { CRAYFISH, CRAYFISH_CHASE, GARTER_SNAKE, GARTER_SNAKE_CHASE, HERON, type TilapiaTuning } from './tuning';
import { SURF, WORLD_H, areaSize, swimBounds, type AreaLayoutData, type BankOverhang, type Point } from './zone';

export const DEEP_CANAL_3_AREA_ID = 'deep-canal-3';

/** Area 10's size: 10 screens across, 3 down. */
const SIZE = areaSize(10, 3);

/** Top of the bed of the bottom row: 1038. */
const BED_TOP = SIZE.bedTop;

/** Where the axolotl centre may be in Area 10, which every lure's whole path keeps inside. */
const BOUNDS = swimBounds(SIZE);

/** Bottom of the water under each moored row, the bank cover of its spots (B5). */
const MOORED_HULL_Y = 140;

/** y of the heron's stretch, the line of its beak's rest point, as Area 3's: it warns no deeper than y 240. */
const HERON_STRETCH_Y = 120;

/** y of the garter snake's stretch at the surface, as Area 5's: it warns no deeper than y 215. */
const SNAKE_STRETCH_Y = 100;

/** y of the crayfish's floor stretch: the bed top less 22, the floor lane, 1016. */
const FLOOR_Y = BED_TOP - 22;

/** The second drag net's cycle (owner, #108): a 3 s quiet, the 1.0 s warning and a 2.0 s sweep. */
const SECOND_NET_TIMING: Readonly<DragNetTiming> = Object.freeze({ quietFor: 3, warnFor: 1, sweepFor: 2 });

/**
 * Area 10's tilapia, one step up the predator ladder from Area 9's (owner, #108): a 480 px/s strike
 * reaching 165 px, a 1.6 s cooldown and a 70 px/s patrol. Every other value, the 0.8 s warning and
 * the full-bar chase included, stays Area 9's.
 */
export const DEEP_CANAL_3_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...DEEP_CANAL_2_TILAPIA,
  lungeSpeed: 480,
  lungeRange: 165,
  cooldown: 1.6,
  patrolSpeed: 70,
});

/**
 * Area 10's common carp, one step up the predator ladder from Area 9's (issue #108, ND-4): a 1.5 s
 * cooldown and a 65 px/s patrol, with Area 9's other values and chase.
 */
export const DEEP_CANAL_3_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...DEEP_CANAL_2_CARP.tuning, cooldown: 1.5, patrolSpeed: 65 }),
);

/**
 * Area 10's black bass (owner, #108): a 0.8 s warning, a 520 px/s lunge for 0.45 s reaching 185 px,
 * a 1.3 s cooldown and a 70 px/s patrol, with Area 9's other values and the bass chase.
 */
export const DEEP_CANAL_3_BASS: Readonly<PredatorSpecies> = tunedSpecies(
  BLACK_BASS_SPECIES,
  Object.freeze({ ...DEEP_CANAL_2_BASS.tuning, lungeSpeed: 520, lungeRange: 185, cooldown: 1.3, patrolSpeed: 70 }),
);

/**
 * Area 10's heron, a wading stalker one step tighter than Area 3's (owner, #108, 2026-10-22; ND-12):
 * a 1.0 s warning, a 120 px stab in the heron's 0.3 s and a 2.5 s cooldown. It never chases, as
 * every heron (ADR 0038 exempts it from the danger bar's chase check).
 */
export const DEEP_CANAL_3_HERON: Readonly<PredatorSpecies> = tunedSpecies(
  HERON_SPECIES,
  Object.freeze({ ...HERON, windup: 1.0, lungeRange: 120, lungeSpeed: 120 / HERON.lungeDuration, cooldown: 2.5 }),
);

/**
 * Area 10's garter snake (owner, #108): a 0.8 s warning, a 380 px/s dart for 0.35 s reaching 115 px
 * from the surface, a 1.8 s cooldown, a 60 px/s patrol and the snake chase.
 */
export const DEEP_CANAL_3_SNAKE: Readonly<PredatorSpecies> = tunedSpecies(
  GARTER_SNAKE_SPECIES,
  Object.freeze({ ...GARTER_SNAKE, lungeSpeed: 380, lungeRange: 115, cooldown: 1.8, patrolSpeed: 60, chase: GARTER_SNAKE_CHASE }),
);

/**
 * Area 10's crayfish (owner, #108): a 0.8 s warning, a 420 px/s pinch for 0.3 s reaching 95 px from
 * the floor, a 1.5 s cooldown, a 70 px/s patrol and the crayfish chase.
 */
export const DEEP_CANAL_3_CRAYFISH: Readonly<PredatorSpecies> = tunedSpecies(
  CRAYFISH_SPECIES,
  Object.freeze({ ...CRAYFISH, lungeSpeed: 420, lungeRange: 95, cooldown: 1.5, patrolSpeed: 70, chase: CRAYFISH_CHASE }),
);

/** Area 10's tadpole rule, the top of the later snack ramp row: 72 px/s, as Area 9's (ND-8). */
const DEEP_CANAL_3_TADPOLE = tadpoleRule(72);

/** Area 10's shrimp rule, Area 9's: trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s (ND-8). */
const DEEP_CANAL_3_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/**
 * The eighteen tadpole wander loops' turn points, west to east, placed after the threats, each clear
 * of every murky patch, lure, line and drag-net stretch by SNACK_HAZARD_CLEARANCE, and never in the
 * lower lane, which its predators fill: four by the Home Spot and the fork pocket, five in the upper
 * lane and the join pocket, three round the U-turn and on the bed under it, and six by the climb, the
 * hub and the exit.
 */
const DEEP_CANAL_3_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[40, 364], [360, 364], [330, 514], [170, 446.5]] as const),
  Object.freeze([[380, 484], [700, 484], [670, 634], [510, 566.5]] as const),
  Object.freeze([[380, 1014], [700, 1014], [670, 864], [510, 931.5]] as const),
  Object.freeze([[680, 424], [1000, 424], [970, 274], [810, 341.5]] as const),
  Object.freeze([[1300, 94], [1620, 94], [1590, 244], [1430, 176.5]] as const),
  Object.freeze([[1560, 114], [1880, 114], [1850, 264], [1690, 196.5]] as const),
  Object.freeze([[1740, 304], [2060, 304], [2030, 454], [1870, 386.5]] as const),
  Object.freeze([[2000, 94], [2320, 94], [2290, 244], [2130, 176.5]] as const),
  Object.freeze([[2220, 364], [2540, 364], [2510, 514], [2350, 446.5]] as const),
  Object.freeze([[2500, 1014], [2820, 1014], [2790, 864], [2630, 931.5]] as const),
  Object.freeze([[2800, 94], [3120, 94], [3090, 244], [2930, 176.5]] as const),
  Object.freeze([[2800, 834], [3120, 834], [3090, 984], [2930, 916.5]] as const),
  Object.freeze([[3440, 94], [3760, 94], [3730, 244], [3570, 176.5]] as const),
  Object.freeze([[3640, 864], [3960, 864], [3930, 1014], [3770, 946.5]] as const),
  Object.freeze([[4040, 954], [4360, 954], [4330, 804], [4170, 871.5]] as const),
  Object.freeze([[4080, 204], [4400, 204], [4370, 354], [4210, 286.5]] as const),
  Object.freeze([[4340, 494], [4660, 494], [4630, 644], [4470, 576.5]] as const),
  Object.freeze([[4440, 864], [4760, 864], [4730, 1014], [4570, 946.5]] as const),
]);

/**
 * The eighteen shrimp homes' hop spots, west to east, each starting on a spot out of every threat's
 * strike and clear of every murky patch, lure, line and drag-net stretch by SNACK_HAZARD_CLEARANCE:
 * three in the west, four in the upper lane, three round the U-turn and the bottom row, and
 * eight by the climb, the hub and the exit.
 */
const DEEP_CANAL_3_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[360, 144], [420, 114], [400, 184]] as const),
  Object.freeze([[360, 354], [420, 324], [400, 394]] as const),
  Object.freeze([[400, 744], [460, 714], [440, 784]] as const),
  Object.freeze([[1000, 424], [1060, 394], [1040, 464]] as const),
  Object.freeze([[1040, 254], [1100, 224], [1080, 294]] as const),
  Object.freeze([[1720, 424], [1780, 394], [1760, 464]] as const),
  Object.freeze([[1960, 224], [2020, 194], [2000, 264]] as const),
  Object.freeze([[2660, 144], [2720, 114], [2700, 184]] as const),
  Object.freeze([[2740, 824], [2800, 794], [2780, 864]] as const),
  Object.freeze([[3020, 734], [3080, 704], [3060, 774]] as const),
  Object.freeze([[3680, 784], [3740, 754], [3720, 824]] as const),
  Object.freeze([[3740, 624], [3800, 594], [3780, 664]] as const),
  Object.freeze([[3980, 964], [4040, 934], [4020, 1004]] as const),
  Object.freeze([[4100, 144], [4160, 114], [4140, 184]] as const),
  Object.freeze([[4340, 144], [4400, 114], [4380, 184]] as const),
  Object.freeze([[4340, 964], [4400, 934], [4380, 1004]] as const),
  Object.freeze([[4360, 404], [4420, 374], [4400, 444]] as const),
  Object.freeze([[4380, 784], [4440, 754], [4420, 824]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 10's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / DEEP_CANAL_3_TADPOLE.speed;
}

/** Tadpole n (from 0) on its wander loop, n parts of its own lap ahead, so the tadpoles are out of step. */
function wanderAt(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(DEEP_CANAL_3_TADPOLE, points, (index * lapSeconds(points)) / DEEP_CANAL_3_LOOPS.length);
}

/** The water under one moored row at the surface, the bank cover (B5). */
function mooredRow(x0: number, x1: number): Readonly<BankOverhang> {
  return Object.freeze({ x0, x1, y0: SURF, y1: MOORED_HULL_Y });
}

/** One block of the old-stone divider, solid rock (issue #105, ND-8). */
function dividerStone(x0: number, x1: number, y0: number, y1: number): Readonly<RockWall> {
  return Object.freeze({ x0, x1, y0, y1 });
}

/** One predator's route, id `<name>-<n>`: a closed loop through `points`, each an [x, y] pair. */
function loopRoute(id: string, species: Readonly<PredatorSpecies>, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species });
}

/** One predator's straight stretch from `x0` to `x1` at `y`, two waypoints: the heron's, the snake's or the crayfish's. */
function stretchRoute(id: string, species: Readonly<PredatorSpecies>, x0: number, x1: number, y: number): Readonly<PredatorRoute> {
  return loopRoute(id, species, [
    [x0, y],
    [x1, y],
  ]);
}

/** One anchor drop, id `deep-canal-3/anchor-drop-<n>`, at `x`, lowered `depth` px, its cycle starting at `offset` seconds. */
function anchorDropAt(index: number, x: number, offset: number, depth: number): Readonly<MovingHazardSpawn> {
  return moverAt(ANCHOR_DROP, index, x, offset, depth);
}

/** One mud seep, id `deep-canal-3/mud-seep-<n>`, on the bed at `x`, its column `height` px, its cycle starting at `offset` seconds. */
function mudSeepAt(index: number, x: number, offset: number, height: number): Readonly<MovingHazardSpawn> {
  return moverAt(MUD_SEEP, index, x, offset, height, BED_TOP);
}

/** One moving hazard of `type`, id `deep-canal-3/<type id>-<n>`, at `x`, reaching `depth` px from its base. */
function moverAt(
  type: Readonly<MovingHazardType>,
  index: number,
  x: number,
  offset: number,
  depth: number,
  baseY?: number,
): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${DEEP_CANAL_3_AREA_ID}/${type.id}-${index}`, type, x, offset, depth, baseY));
}

/** One murky patch, id `deep-canal-3/murky-water-<n>`, over the rect. */
function murkyPatchAt(index: number, x0: number, x1: number, y0: number, y1: number): Readonly<MurkyPatchSpawn> {
  const patch = murkyPatchSpawn(`${DEEP_CANAL_3_AREA_ID}/murky-water-${index}`, { x0, x1, y0, y1 });
  Object.freeze(patch.shape);
  return Object.freeze(patch);
}

/**
 * One fishing trajinera, id `deep-canal-3/fishing-trajinera-<n>`, drifting over `x0..x1` with its
 * lures, its drift starting at `offset` seconds.
 */
function fishingBoatAt(index: number, offset: number, x0: number, x1: number, lures: readonly LurePlace[]): Readonly<FishingBoatSpawn> {
  const spawn = fishingBoatSpawn(`${DEEP_CANAL_3_AREA_ID}/fishing-trajinera-${index}`, offset, { x0, x1, lures }, BOUNDS);
  for (const lure of spawn.lures) Object.freeze(lure);
  Object.freeze(spawn.lures);
  return Object.freeze(spawn);
}

/** One drag net, id `deep-canal-3/drag-net-<n>`, on `plan`, its cycle starting at `offset` seconds. */
function dragNetAt(index: number, offset: number, plan: Readonly<DragNetPlan>, timing: Readonly<DragNetTiming> = DRAG_NETS): Readonly<DragNetSpawn> {
  const spawn = dragNetSpawn(`${DEEP_CANAL_3_AREA_ID}/drag-net-${index}`, offset, plan, timing);
  Object.freeze(spawn.dragNet.stretch);
  for (const hollow of spawn.dragNet.hollows) Object.freeze(hollow);
  Object.freeze(spawn.dragNet.hollows);
  Object.freeze(spawn.dragNet.timing);
  Object.freeze(spawn.dragNet);
  return Object.freeze(spawn);
}

/**
 * The old-stone divider between the fork pocket and the join pocket, west to east: two stones at
 * y 560 to 600, each 40 px thick and 640 px wide, the second touching the first, so no body passes
 * between the lanes. The upper lane over it runs from the surface, and the lower lane under it to the
 * floor.
 */
const DIVIDER: readonly Readonly<RockWall>[] = Object.freeze([dividerStone(960, 1600, 560, 600), dividerStone(1600, 2240, 560, 600)]);

/** The deep canal's Area 10, as area data: 10 screens across, 3 down. */
export const DEEP_CANAL_3_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: DEEP_CANAL_3_AREA_ID,
  screensWide: 10,
  screensTall: 3,
  start: Object.freeze({ x: 180, y: 200 }),
  /** The Home Spot's column of the top row, from the surface down to y 360. */
  safeArea: Object.freeze({ x0: 40, x1: 330, y0: SURF, y1: WORLD_H }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /** The sunken hull cave (B6), under the wide murky patch: an open Legendary spot within half `tilapia-1`'s strike, and an Epic spot farther off. */
  caveSpots: Object.freeze([
    Object.freeze([1540, 975, 'legendary', false] as const),
    Object.freeze([1660, 1000, 'epic', false] as const),
  ]),
  /**
   * Just past the side-canal inflow, at the dead end of the hub's treasure branch: three open
   * Legendary spots within half the strike of `carp-9`, then two Epic spots farther off. No Dash pot:
   * each Legendary spot is deep and near a threat (ADR 0032).
   */
  currentSpots: Object.freeze([
    Object.freeze([4650, 220, 'legendary', false] as const),
    Object.freeze([4650, 280, 'legendary', false] as const),
    Object.freeze([4650, 340, 'legendary', false] as const),
    Object.freeze([4580, 250, 'epic', false] as const),
    Object.freeze([4580, 320, 'epic', false] as const),
  ]),
  /** The side-canal inflow in the hub's treasure branch, flowing left at Area 9's 72 px/s, which one leg beats by 18 px/s (B6). */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 4420, x1: 4560, y0: 120, y1: 360, force: Object.freeze({ x: -72, y: 0 }) }),
  ]),
  /** The sunken hull, a dead end on the lower-lane bed under the wide murky patch (B6). */
  cave: Object.freeze({ id: `${DEEP_CANAL_3_AREA_ID}/cave`, x0: 1480, x1: 1680, y0: 950, y1: BED_TOP }),
  /**
   * Two tilapia, each loop reaching two depth bands: `tilapia-0` east of the U-turn, from the surface
   * band down into the middle band, its strike off the U-turn's way down and the bottom row's way
   * east, and `tilapia-1` in the lower lane over the sunken hull, down into the floor band.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([3160, 260] as const),
      Object.freeze([3300, 260] as const),
      Object.freeze([3300, 610] as const),
      Object.freeze([3160, 610] as const),
    ]),
    Object.freeze([
      Object.freeze([1460, 680] as const),
      Object.freeze([1620, 680] as const),
      Object.freeze([1620, 900] as const),
      Object.freeze([1460, 900] as const),
    ]),
  ]),
  /**
   * Ten carp, each loop reaching two depth bands: `carp-0` under the Home Spot, `carp-1` under the
   * fork pocket, `carp-2` and `carp-5` in the upper lane under its way over them, `carp-3` and
   * `carp-7` in the lower lane, `carp-4` inside the U-turn, `carp-6` low in the join pocket, `carp-8`
   * west of the climb and `carp-9` at the east end past the inflow. Then the black bass on one loop
   * through all three bands east of the climb, the heron wading the upper lane's west end, the
   * garter snake at the surface of its east end and the crayfish walking the bed under the U-turn and
   * the bottom row's way east. Every loop keeps its strike off the main path and its body off the
   * divider.
   */
  predatorRoutes: Object.freeze([
    loopRoute('carp-0', DEEP_CANAL_3_CARP, [[100, 600], [240, 600], [240, 880], [100, 880]]),
    loopRoute('carp-1', DEEP_CANAL_3_CARP, [[640, 620], [780, 620], [780, 880], [640, 880]]),
    loopRoute('carp-2', DEEP_CANAL_3_CARP, [[1420, 340], [1560, 340], [1560, 500], [1420, 500]]),
    loopRoute('carp-3', DEEP_CANAL_3_CARP, [[1900, 660], [2040, 660], [2040, 900], [1900, 900]]),
    loopRoute('carp-4', DEEP_CANAL_3_CARP, [[2690, 340], [2800, 340], [2800, 470], [2690, 470]]),
    loopRoute('carp-5', DEEP_CANAL_3_CARP, [[2090, 340], [2208, 340], [2208, 500], [2090, 500]]),
    loopRoute('carp-6', DEEP_CANAL_3_CARP, [[2300, 640], [2440, 640], [2440, 880], [2300, 880]]),
    loopRoute('carp-7', DEEP_CANAL_3_CARP, [[1000, 660], [1140, 660], [1140, 880], [1000, 880]]),
    loopRoute('carp-8', DEEP_CANAL_3_CARP, [[3480, 300], [3600, 300], [3600, 560], [3480, 560]]),
    loopRoute('carp-9', DEEP_CANAL_3_CARP, [[4680, 150], [4728, 150], [4728, 700], [4680, 700]]),
    loopRoute('bass-0', DEEP_CANAL_3_BASS, [[3990, 370], [4130, 370], [4130, 760], [3990, 760]]),
    stretchRoute('heron-0', DEEP_CANAL_3_HERON, 1000, 1160, HERON_STRETCH_Y),
    stretchRoute('garter-snake-0', DEEP_CANAL_3_SNAKE, 1760, 1920, SNAKE_STRETCH_Y),
    stretchRoute('crayfish-0', DEEP_CANAL_3_CRAYFISH, 2680, 3700, FLOOR_Y),
  ]),
  /**
   * Five anchor drops: four over the fork pocket and the lane mouth, the path dipping under them, and
   * `anchor-drop-4` beside the climb, its touch setting the main path's narrowest gap with `bass-0`.
   * Then six mud seeps on the bed: `mud-seep-1` in the lower lane, four under the bottom row's way
   * east, each 40 px under it, and `mud-seep-6` by the exit. As many as the danger bar needs (ND-11).
   */
  movingHazards: Object.freeze([
    anchorDropAt(1, 480, 0, 320),
    anchorDropAt(2, 640, 1.2, 320),
    anchorDropAt(3, 800, 2.4, 320),
    anchorDropAt(4, 3743, 0, 320),
    anchorDropAt(5, 900, 3.6, 300),
    mudSeepAt(1, 1260, 0, 200),
    mudSeepAt(2, 2860, 1.4, 180),
    mudSeepAt(3, 3005, 2.8, 180),
    mudSeepAt(4, 3150, 4.2, 180),
    mudSeepAt(5, 3600, 2.8, 180),
    mudSeepAt(6, 4580, 0, 240),
  ]),
  /**
   * The two murky patches (ND-10): a narrow one, 120 px wide, over the main path on the bottom row,
   * then a wide one over the sunken hull's dead end in the lower lane.
   */
  hazards: Object.freeze([murkyPatchAt(1, 3440, 3560, 720, 880), murkyPatchAt(2, 1440, 1720, 900, 1016)]),
  elements: Object.freeze([]),
  /**
   * The grand tour (ND-7): from the Home Spot down and right under the fork pocket's anchors, up into
   * the upper lane, under the heron, over `carp-2`, under the snake and over `carp-5` to the join
   * pocket; east along the top row, down and back west inside the U-turn through the first drag net,
   * down to the bottom row and east over the mud seeps, through the second drag net and the narrow
   * murky patch; up the climb, east along the top row to the hub fork and down to the exit.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 180, y: 200 }),
    Object.freeze({ x: 420, y: 455 }),
    Object.freeze({ x: 950, y: 455 }),
    Object.freeze({ x: 975, y: 290 }),
    Object.freeze({ x: 1200, y: 280 }),
    Object.freeze({ x: 1300, y: 180 }),
    Object.freeze({ x: 1640, y: 180 }),
    Object.freeze({ x: 1720, y: 265 }),
    Object.freeze({ x: 1940, y: 265 }),
    Object.freeze({ x: 2030, y: 180 }),
    Object.freeze({ x: 2280, y: 180 }),
    Object.freeze({ x: 2340, y: 120 }),
    Object.freeze({ x: 2960, y: 120 }),
    Object.freeze({ x: 2960, y: 640 }),
    Object.freeze({ x: 2640, y: 640 }),
    Object.freeze({ x: 2640, y: 800 }),
    Object.freeze({ x: 3786, y: 800 }),
    Object.freeze({ x: 3786, y: 110 }),
    Object.freeze({ x: 4340, y: 110 }),
    Object.freeze({ x: 4380, y: 940 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), one in each part of the tour: each at least 80 px from every
   * predator route, clear of every sweep by the touch and rescue reach, and out of the inflow, the
   * rock, every murky patch, lure, line and drag-net stretch.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${DEEP_CANAL_3_AREA_ID}/strand-1`, x: 860, y: 994 }),
    Object.freeze({ id: `${DEEP_CANAL_3_AREA_ID}/strand-2`, x: 1360, y: 114 }),
    Object.freeze({ id: `${DEEP_CANAL_3_AREA_ID}/strand-3`, x: 2360, y: 994 }),
    Object.freeze({ id: `${DEEP_CANAL_3_AREA_ID}/strand-4`, x: 3540, y: 114 }),
    Object.freeze({ id: `${DEEP_CANAL_3_AREA_ID}/strand-5`, x: 3820, y: 994 }),
    Object.freeze({ id: `${DEEP_CANAL_3_AREA_ID}/strand-6`, x: 4740, y: 994 }),
  ]),
  treasures: DEEP_CANAL_3_TREASURES,
  snackWorms: 8,
  snackBugs: 8,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  tilapia: DEEP_CANAL_3_TILAPIA,
  /** Moored rows at the surface (B5): one over the fork pocket's anchors, one over `carp-2` and one on the way to the hub. */
  bankOverhangs: Object.freeze([mooredRow(500, 880), mooredRow(1380, 1620), mooredRow(4040, 4300)]),
  /** Under the moored rows (B5): Common spots by the main path over `carp-2` and on the way to the hub, Rare spots by the fork pocket's anchors. */
  bankSpots: Object.freeze([
    Object.freeze([1440, 136, 'common', false] as const),
    Object.freeze([1500, 136, 'common', false] as const),
    Object.freeze([1560, 136, 'common', false] as const),
    Object.freeze([4100, 100, 'common', false] as const),
    Object.freeze([4160, 100, 'common', false] as const),
    Object.freeze([4220, 100, 'common', false] as const),
    Object.freeze([530, 110, 'rare', false] as const),
    Object.freeze([590, 110, 'rare', false] as const),
    Object.freeze([690, 110, 'rare', false] as const),
    Object.freeze([750, 110, 'rare', false] as const),
    Object.freeze([850, 110, 'rare', false] as const),
  ]),
  rockWalls: DIVIDER,
  /**
   * The three fishing trajineras (ND-1), 4 s out of step, each hanging its lures from the ends of its
   * hull among the snacks, out of every predator's strike, and never over another surface boat: one
   * lure in the upper lane just east of the heron, two over the join pocket and two on the way to
   * the hub.
   */
  fishingBoats: Object.freeze([
    fishingBoatAt(1, 0, 1200, 1330, [{ along: 0, depth: 300 }]),
    fishingBoatAt(2, 4, 2400, 2560, [{ along: 0, depth: 200 }, { along: 120, depth: 170 }]),
    fishingBoatAt(3, 8, 3870, 4000, [{ along: 0, depth: 110 }, { along: 120, depth: 90 }]),
  ]),
  /**
   * The two drag-net stretches on the main path (ND-2), each with two safe hollows: the first inside
   * the U-turn on the default cycle, sweeping left, and the second on the bottom row's way east,
   * sweeping right on its own cycle.
   */
  dragNets: Object.freeze([
    dragNetAt(1, 0, {
      stretch: { x0: 2720, x1: 2920, y0: 580, y1: 700 },
      sweep: 'left',
      hollows: [
        { x0: 2760, x1: 2800, y0: 590, y1: 630 },
        { x0: 2840, x1: 2880, y0: 650, y1: 690 },
      ],
    }),
    dragNetAt(
      2,
      2,
      {
        stretch: { x0: 3220, x1: 3420, y0: 720, y1: 880 },
        sweep: 'right',
        hollows: [
          { x0: 3260, x1: 3300, y0: 730, y1: 770 },
          { x0: 3340, x1: 3380, y0: 830, y1: 870 },
        ],
      },
      SECOND_NET_TIMING,
    ),
  ]),
  /** 18 tadpoles and 18 shrimp to 8 worms and 8 bugs: 36 of 52 snacks mobile, 69.2% (the later snack ramp row, ND-8). */
  mobileSnacks: mobileSnackMix({
    tadpole: DEEP_CANAL_3_TADPOLE,
    wanders: DEEP_CANAL_3_LOOPS.map(wanderAt),
    shrimp: DEEP_CANAL_3_SHRIMP,
    homes: DEEP_CANAL_3_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);

