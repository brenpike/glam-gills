/**
 * The spring cave's Area 7 (issue #105), as area data: 8 screens across, 2 down, the first climb
 * (ND-2). The Home Spot is bottom left, and the safe area is its column in the bottom row only. The
 * main path only goes across or up, never back down: right along the bottom row, through the first
 * pulsing vent and the first geyser's column, up the climb at x 800 through the second vent, then
 * right along the top row under the rock ledges and the stalactites' streams, through the third vent
 * and the dark stretch, to the exit at the top right.
 */
import { SPRING_CAVE_2_TREASURES } from './catalogue';
import { glowPlantSpawn } from './glowPlants';
import type { ElementSpawn, HazardSpawn } from './hazards';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { GEYSER_VENT, STALACTITE_DRIP, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import { pebbleSpawn, type RockWall } from './pebble';
import { CARP_SPECIES, CRAYFISH_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { pulsingCurrentSpawn } from './pulsingCurrents';
import type { CurrentPulse } from './hazards';
import { CARP, CARP_CHASE, CRAYFISH, CRAYFISH_CHASE } from './tuning';
import { WORLD_H, areaSize, type AreaLayoutData, type BankOverhang, type Point } from './zone';

export const SPRING_CAVE_2_AREA_ID = 'spring-cave-2';

/** Top of the bed of the bottom row: 678. */
const BED_TOP = areaSize(8, 2).bedTop;

/** y of each crayfish's floor stretch: the bed top less 22, the floor lane, 656. */
export const SPRING_CAVE_2_FLOOR_Y = BED_TOP - 22;

/** Radius in px of each glow-plant's touch circle, as in Area 6. */
export const SPRING_CAVE_2_GLOW_PLANT_RADIUS = 14;

/**
 * Area 7's crayfish, one step up the predator ladder from Area 6's (owner, #105, 2026-10-22): a
 * 1.6 s cooldown and a 65 px/s patrol, Area 6's other values, with its chase default (ND-4).
 */
export const SPRING_CAVE_2_CRAYFISH: Readonly<PredatorSpecies> = tunedSpecies(
  CRAYFISH_SPECIES,
  Object.freeze({ ...CRAYFISH, cooldown: 1.6, patrolSpeed: 65, chase: CRAYFISH_CHASE }),
);

/**
 * Area 7's common carp, one step up the predator ladder from Area 6's (ND-4): a 0.8 s warning, at
 * the 0.8 s floor, a 153 px sweep at 340 px/s for 0.45 s from 135 px, Area 6's 50 px hit reach and
 * 53 px touch, a 1.8 s cooldown, a 50 px/s patrol, and the carp's chase sight and leash at 135 px/s.
 */
export const SPRING_CAVE_2_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({
    ...CARP,
    windup: 0.8,
    lungeSpeed: 340,
    lungeDuration: 0.45,
    lungeRange: 135,
    hitRadius: 50,
    contactRadius: 53,
    cooldown: 1.8,
    patrolSpeed: 50,
    chase: Object.freeze({ ...CARP_CHASE, speed: 135 }),
  }),
);

/** Area 7's tadpole rule, the top of the later snack ramp row: 72 px/s (ND-11). */
const SPRING_CAVE_2_TADPOLE = tadpoleRule(72);

/** Area 7's shrimp rule, Area 6's (ND-11): trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s. */
const SPRING_CAVE_2_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/**
 * The twelve tadpole wander loops' turn points (ND-11), placed after the threats: nine in the top
 * row, along the main path, one of them in the dark, and three in the bottom row, under `carp-1`,
 * west of the steady outflow and by the pebble room.
 */
const SPRING_CAVE_2_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[50, 100], [370, 100], [340, 250], [180, 182.5]] as const),
  Object.freeze([[880, 100], [1200, 100], [1170, 250], [1010, 182.5]] as const),
  Object.freeze([[1200, 175], [1360, 100], [1530, 175], [1360, 250]] as const),
  Object.freeze([[1980, 100], [2300, 100], [2270, 250], [2110, 182.5]] as const),
  Object.freeze([[2450, 170], [2770, 170], [2740, 320], [2580, 252.5]] as const),
  Object.freeze([[2680, 100], [3000, 100], [2970, 250], [2810, 182.5]] as const),
  Object.freeze([[2920, 100], [3240, 100], [3210, 250], [3050, 182.5]] as const),
  Object.freeze([[3170, 100], [3490, 100], [3460, 250], [3300, 182.5]] as const),
  Object.freeze([[3430, 100], [3750, 100], [3720, 250], [3560, 182.5]] as const),
  Object.freeze([[1600, 598], [1920, 598], [1890, 448], [1730, 515.5]] as const),
  Object.freeze([[1360, 480], [1680, 480], [1650, 630], [1490, 562.5]] as const),
  Object.freeze([[3040, 648], [3360, 648], [3330, 498], [3170, 565.5]] as const),
]);

/** The fifteen shrimp homes' hop spots (ND-11): eleven in the top row and four in the bottom row. */
const SPRING_CAVE_2_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[60, 290], [120, 260], [100, 330]] as const),
  Object.freeze([[970, 140], [1030, 110], [1010, 180]] as const),
  Object.freeze([[1350, 140], [1410, 110], [1390, 180]] as const),
  Object.freeze([[2000, 140], [2060, 110], [2040, 180]] as const),
  Object.freeze([[2150, 140], [2210, 110], [2190, 180]] as const),
  Object.freeze([[2240, 260], [2300, 230], [2280, 300]] as const),
  Object.freeze([[2460, 140], [2520, 110], [2500, 180]] as const),
  Object.freeze([[2760, 140], [2820, 110], [2800, 180]] as const),
  Object.freeze([[3010, 140], [3070, 110], [3050, 180]] as const),
  Object.freeze([[3150, 200], [3210, 170], [3190, 240]] as const),
  Object.freeze([[3670, 140], [3730, 110], [3710, 180]] as const),
  Object.freeze([[1660, 470], [1720, 440], [1700, 510]] as const),
  Object.freeze([[1740, 600], [1800, 570], [1780, 640]] as const),
  Object.freeze([[2250, 530], [2310, 500], [2290, 570]] as const),
  Object.freeze([[2310, 450], [2370, 420], [2350, 490]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 7's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / SPRING_CAVE_2_TADPOLE.speed;
}

/** Tadpole n (from 0) on its wander loop, n parts of its own lap ahead, so the tadpoles are out of step. */
function wanderAt(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(SPRING_CAVE_2_TADPOLE, points, (index * lapSeconds(points)) / SPRING_CAVE_2_LOOPS.length);
}

/** The water under one rock ledge, the bank cover (B5). Its y0 is the rock's underside. */
function rockLedge(x0: number, x1: number, y0: number, y1: number): Readonly<BankOverhang> {
  return Object.freeze({ x0, x1, y0, y1 });
}

/** One solid rock wall (ND-8). */
function rockWall(x0: number, x1: number, y0: number, y1: number): Readonly<RockWall> {
  return Object.freeze({ x0, x1, y0, y1 });
}

/** The rock ledge over the top of the climb: the roof of `stalactite-1`. */
const CLIMB_LEDGE = rockLedge(820, 900, 110, 170);

/** The rock ledge over the main path just past the climb: Common spots, and the roof of `stalactite-2`. */
const WEST_LEDGE = rockLedge(920, 1200, 110, 170);

/** The rock ledge over the main path past the third vent, by the dark stretch: the roof of `stalactite-2`. */
const MIDDLE_LEDGE = rockLedge(2300, 2400, 110, 170);

/** The rock ledge over the main path past the dark stretch: Common spots, and the roof of `stalactite-3`. */
const EAST_LEDGE = rockLedge(2880, 3180, 110, 170);

/** The rock ledge by the exit: the roof of `stalactite-4`. */
const EXIT_LEDGE = rockLedge(3500, 3620, 110, 170);

/** The rock ledge before the exit: the roof of `stalactite-6`. */
const LAST_LEDGE = rockLedge(3300, 3400, 110, 170);

/** The pebble room's roof, a solid rock lid over the room in the bottom right (ND-8). */
const ROOM_LID = rockWall(3440, 3840, 340, 380);

/** The pebble room's west wall, down from the lid to the top of the doorway (ND-8). */
const ROOM_WALL = rockWall(3440, 3480, 380, 560);

/** The water inside the pebble room: under the lid, east of the west wall, down to the bed (ND-8). */
const ROOM = rockWall(3480, 3840, 380, WORLD_H * 2);

/** The water under the room's lid, the bank cover of its Rare spots (B5; ND-9). */
const ROOM_ROOF = rockLedge(3480, 3800, 380, 580);

/** One crayfish's route, id `crayfish-<n>`: a straight floor stretch from `x0` to `x1` on the floor lane. */
function crayfishStretch(index: number, x0: number, x1: number): Readonly<PredatorRoute> {
  const waypoints: Point[] = [Object.freeze({ x: x0, y: SPRING_CAVE_2_FLOOR_Y }), Object.freeze({ x: x1, y: SPRING_CAVE_2_FLOOR_Y })];
  return Object.freeze({ id: `crayfish-${index}`, waypoints: Object.freeze(waypoints) as Point[], species: SPRING_CAVE_2_CRAYFISH });
}

/** One common carp's route, id `carp-<n>`: a closed loop through `points`, each an [x, y] pair. */
function carpLoop(index: number, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id: `carp-${index}`, waypoints: Object.freeze(waypoints) as Point[], species: SPRING_CAVE_2_CARP });
}

/**
 * One stalactite drip, id `spring-cave-2/stalactite-<n>`, hanging from the underside of `ledge` at
 * `x`, its cycle starting at `offset` seconds and its stream falling `depth` px. Throws RangeError
 * when the stream is not wholly under the ledge.
 */
function stalactiteUnder(ledge: Readonly<BankOverhang>, index: number, x: number, offset: number, depth: number): Readonly<MovingHazardSpawn> {
  const id = `${SPRING_CAVE_2_AREA_ID}/stalactite-${index}`;
  if (x - STALACTITE_DRIP.halfWidth < ledge.x0 || x + STALACTITE_DRIP.halfWidth > ledge.x1) {
    throw new RangeError(`${id}: x ${x} is not under the rock ledge from x ${ledge.x0} to ${ledge.x1}`);
  }
  return Object.freeze(movingHazardSpawn(id, STALACTITE_DRIP, x, offset, depth, ledge.y0));
}

/** One geyser vent, id `spring-cave-2/geyser-<n>`, on the bed at `x`, its column `height` px up. */
function geyserAt(index: number, x: number, offset: number, height: number): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${SPRING_CAVE_2_AREA_ID}/geyser-${index}`, GEYSER_VENT, x, offset, height, BED_TOP));
}

/** One pulsing current, id `spring-cave-2/vent-<n>` (ND-5). */
function ventAt(index: number, x0: number, x1: number, y0: number, y1: number, pulse: CurrentPulse): Readonly<HazardSpawn> {
  const spawn = pulsingCurrentSpawn(`${SPRING_CAVE_2_AREA_ID}/vent-${index}`, { x0, x1, y0, y1 }, pulse);
  Object.freeze(spawn.shape);
  Object.freeze(spawn.pulse);
  return Object.freeze(spawn);
}

/** One glow-plant, id `spring-cave-2/glow-plant-<n>`, centred on (`x`, `y`). */
function glowPlantAt(index: number, x: number, y: number): Readonly<ElementSpawn> {
  const spawn = glowPlantSpawn(`${SPRING_CAVE_2_AREA_ID}/glow-plant-${index}`, { x, y, radius: SPRING_CAVE_2_GLOW_PLANT_RADIUS });
  Object.freeze(spawn.glowPlant);
  return Object.freeze(spawn);
}

/** The pebble, id `spring-cave-2/pebble`, in the room's doorway on the bed, rolling 120 px east into the room (ND-8). */
function roomPebble(): Readonly<ElementSpawn> {
  const spawn = pebbleSpawn(`${SPRING_CAVE_2_AREA_ID}/pebble`, { x0: 3460, y0: 634, x1: 3580, y1: 634, radius: 40 });
  Object.freeze(spawn.pebble);
  return Object.freeze(spawn);
}

/** The spring cave's Area 7, as area data: 8 screens across, 2 down. */
export const SPRING_CAVE_2_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: SPRING_CAVE_2_AREA_ID,
  screensWide: 8,
  screensTall: 2,
  start: Object.freeze({ x: 120, y: 560 }),
  /** The Home Spot's column in the bottom row only (ND-2). */
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: WORLD_H, y1: WORLD_H * 2 }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /** The grotto at the back of the pebble room: one Epic spot (B6; ND-9). */
  caveSpots: Object.freeze([Object.freeze([3750, 595, 'epic', false] as const)]),
  /** Just past the steady spring outflow, on its upstream side, over `crayfish-1`: Legendary pots and Epic spots. */
  currentSpots: Object.freeze([
    Object.freeze([2215, 620, 'legendary', true] as const),
    Object.freeze([2275, 625, 'legendary', true] as const),
    Object.freeze([2335, 620, 'legendary', true] as const),
    Object.freeze([2245, 568, 'epic', false] as const),
    Object.freeze([2305, 568, 'epic', false] as const),
  ]),
  /** The steady spring outflow on the bed of the bottom row, flowing left (B6). */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 2040, x1: 2200, y0: 500, y1: 640, force: Object.freeze({ x: -73, y: 0 }) }),
  ]),
  /** The grotto at the back of the pebble room, a dead end behind the pebble (B6; ND-9). */
  cave: Object.freeze({ id: `${SPRING_CAVE_2_AREA_ID}/cave`, x0: 3740, x1: 3800, y0: 580, y1: BED_TOP }),
  /** No tilapia: the spring cave is cold, clear water. */
  tilapiaRoutes: Object.freeze([]),
  /**
   * Three crayfish on their own floor stretches in the bottom row: `crayfish-0` under the first vent,
   * west of `geyser-1`, `crayfish-1` under the steady outflow and `crayfish-2` in the pebble room.
   * Then six common carp: `carp-0`'s loop cut off at its bottom right, so `geyser-1`'s column passes
   * farther than its strike, and `carp-3` moved west, so `stalactite-4` drips its full stream.
   */
  predatorRoutes: Object.freeze([
    crayfishStretch(0, 360, 490),
    crayfishStretch(1, 2100, 2500),
    crayfishStretch(2, 3640, 3780),
    carpLoop(0, [[440, 120], [660, 120], [660, 250], [520, 310], [440, 310]]),
    carpLoop(1, [[1280, 340], [1420, 340], [1420, 495], [1280, 495]]),
    carpLoop(2, [[1900, 340], [2100, 340], [2100, 495], [1900, 495]]),
    carpLoop(3, [[2530, 340], [2750, 340], [2750, 495], [2530, 495]]),
    carpLoop(4, [[3050, 360], [3250, 360], [3250, 500], [3050, 500]]),
    carpLoop(5, [[1020, 420], [1220, 420], [1220, 560], [1020, 560]]),
  ]),
  /**
   * Six stalactites hanging from the rock ledges of the top row, each stream across the main path,
   * as deep as the shared rules allow up to 250 px: `stalactite-2` to 174 px over `carp-5`,
   * `stalactite-5` to 233 px over `carp-4` from the east end of its ledge, and `stalactite-6` to just
   * over the pebble room's lid. `stalactite-2` stands east of x 1140, so the Common spot at x 1056
   * stays over S + 60 from its stream. Then two geyser vents, each column 240 px up: `geyser-1`
   * across the main path between the first vent and the climb, `geyser-2` between `carp-3` and
   * `carp-4`. The offsets let a one-leg swim of the main path pass them all.
   */
  movingHazards: Object.freeze([
    stalactiteUnder(CLIMB_LEDGE, 1, 857, 0.5, 250),
    stalactiteUnder(WEST_LEDGE, 2, 1144, 0, 174),
    stalactiteUnder(MIDDLE_LEDGE, 3, 2350, 0.5, 250),
    stalactiteUnder(EAST_LEDGE, 4, 2900, 2.4, 250),
    stalactiteUnder(LAST_LEDGE, 5, 3392, 0, 233),
    stalactiteUnder(EXIT_LEDGE, 6, 3560, 2, 229),
    geyserAt(1, 600, 1.4, 240),
    geyserAt(2, 2900, 1, 240),
  ]),
  /** The three pulsing vents along the main path, their calms falling 2.5, 2.2 and 2.0 s (ND-5). */
  hazards: Object.freeze([
    ventAt(1, 320, 480, 376, 560, { calmFor: 2.5, flow: 'left', offset: 0 }),
    ventAt(2, 720, 880, 290, 490, { calmFor: 2.2, flow: 'down', offset: 0 }),
    ventAt(3, 1700, 1900, 94, 340, { calmFor: 2.0, flow: 'left', offset: 0 }),
  ]),
  /** The three glow-plants in the dark stretch, then the pebble (ND-8, ND-10). */
  elements: Object.freeze([glowPlantAt(1, 2460, 260), glowPlantAt(2, 2600, 140), glowPlantAt(3, 2720, 300), roomPebble()]),
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 560 }),
    Object.freeze({ x: 800, y: 560 }),
    Object.freeze({ x: 800, y: 200 }),
    Object.freeze({ x: 3720, y: 200 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), none in the dark or the pebble room: three in each row. Every
   * place is at least 80 px from every predator route and clear of every stalactite and geyser
   * sweep by the touch and rescue reach, and of every vent band by the rescue reach.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${SPRING_CAVE_2_AREA_ID}/strand-1`, x: 700, y: 600 }),
    Object.freeze({ id: `${SPRING_CAVE_2_AREA_ID}/strand-2`, x: 1400, y: 160 }),
    Object.freeze({ id: `${SPRING_CAVE_2_AREA_ID}/strand-3`, x: 1760, y: 520 }),
    Object.freeze({ id: `${SPRING_CAVE_2_AREA_ID}/strand-4`, x: 2240, y: 200 }),
    Object.freeze({ id: `${SPRING_CAVE_2_AREA_ID}/strand-5`, x: 2760, y: 620 }),
    Object.freeze({ id: `${SPRING_CAVE_2_AREA_ID}/strand-6`, x: 3240, y: 160 }),
  ]),
  treasures: SPRING_CAVE_2_TREASURES,
  snackWorms: 7,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  bankOverhangs: Object.freeze([CLIMB_LEDGE, WEST_LEDGE, MIDDLE_LEDGE, EAST_LEDGE, LAST_LEDGE, EXIT_LEDGE, ROOM_ROOF]),
  bankSpots: Object.freeze([
    Object.freeze([944, 155, 'common', false] as const),
    Object.freeze([1000, 155, 'common', false] as const),
    Object.freeze([1056, 155, 'common', false] as const),
    Object.freeze([2990, 155, 'common', false] as const),
    Object.freeze([3050, 155, 'common', false] as const),
    Object.freeze([3110, 155, 'common', false] as const),
    Object.freeze([3540, 570, 'rare', false] as const),
    Object.freeze([3590, 540, 'rare', false] as const),
    Object.freeze([3650, 510, 'rare', false] as const),
    Object.freeze([3700, 560, 'rare', false] as const),
    Object.freeze([3760, 520, 'rare', false] as const),
  ]),
  /** The dark stretch of the top row, round the three glow-plants (ND-10). */
  darkWater: Object.freeze({ x0: 2420, x1: 2780, y0: 80, y1: 360 }),
  rockWalls: Object.freeze([ROOM_LID, ROOM_WALL]),
  sideRooms: Object.freeze([ROOM]),
  mobileSnacks: mobileSnackMix({
    tadpole: SPRING_CAVE_2_TADPOLE,
    wanders: SPRING_CAVE_2_LOOPS.map(wanderAt),
    shrimp: SPRING_CAVE_2_SHRIMP,
    homes: SPRING_CAVE_2_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);
