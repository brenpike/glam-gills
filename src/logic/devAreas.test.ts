import { describe, expect, it } from 'vitest';
import { AREAS, CHINAMPA_HABITAT, areaById, threatIds, type AreaData } from './areas';
import { CANAL_TREASURES, CHINAMPA_TREASURES, RARITIES, treasureById, type Rarity } from './catalogue';
import {
  createCollectibles,
  collectSnacksAtHead,
  drawnSnackX,
  drawnSnackY,
  headPoint,
  type Collectible,
  type SnackFrame,
} from './collectibles';
import { DEV_AREAS, DEV_AREAS_MARK, DEV_DANGER_AREA, DEV_TEST_AREA, devAreaById } from './devAreas';
import { createEncounterContext } from './encounter';
import { SHRIMP_FACT, TADPOLE_FACT } from './factCards';
import { hazardSweep, type HazardShape } from './hazards';
import { coversAt, routeDistance, spotMatchesLabels } from './hiding';
import { NET_CURRENT_CLEARANCE } from './layoutGaps';
import { legSwimTuning } from './legs';
import {
  meetsSnackMotion,
  metSnackTypeIds,
  mobileSnackAvoid,
  oneLegCatchesTadpole,
  oneTimeDarts,
  shrimpHomeClear,
  snackMagnetSpeed,
  tadpoleWanderClear,
  type ShrimpRule,
  type TadpoleRule,
} from './mobileSnacks';
import { movingHazardSweep } from './movingHazards';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { routeLoopDistance } from './predators';
import { createShrimpFlicks, stepShrimpFlicks, type ShrimpFlickState } from './shrimpFlick';
import {
  createTrip,
  createTripContext,
  eatSnacks,
  markFactCardSeen,
  meetSnacks,
  stepTrip,
  tripSnapshot,
  type TripContext,
  type TripEvent,
  type TripState,
} from './trip';
import {
  CARP,
  CARP_CHASE,
  GARTER_SNAKE,
  GARTER_SNAKE_CHASE,
  LEGS,
  SHRIMP,
  TILAPIA,
  TILAPIA_CHASE,
} from './tuning';
import {
  SPOT_MIN_SPACING,
  SURF,
  buildZone,
  inSafeArea,
  isInsideCurrent,
  swimBounds,
  type Point,
  type SwimBounds,
  type ZoneLayout,
} from './zone';

const ZONE_SEEDS = [0xa70107, 1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const TRIP_SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);
const STRANDING_ROUTE_CLEARANCE = 80;

function buildTestZone(seed: number): ZoneLayout {
  return buildZone(DEV_TEST_AREA.layout, seed);
}

function expectInBounds(point: Point, bounds: SwimBounds, label: string): void {
  expect(point.x, label).toBeGreaterThanOrEqual(bounds.minX);
  expect(point.x, label).toBeLessThanOrEqual(bounds.maxX);
  expect(point.y, label).toBeGreaterThanOrEqual(bounds.minY);
  expect(point.y, label).toBeLessThanOrEqual(bounds.maxY);
}

/** Seconds round the closed loop through `points` at `speed` px/s. */
function lapSeconds(points: readonly (readonly number[])[], speed: number): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / speed;
}

function distanceToArea(pos: Point, area: { x0: number; x1: number; y0: number; y1: number }): number {
  const dx = Math.max(area.x0 - pos.x, 0, pos.x - area.x1);
  const dy = Math.max(area.y0 - pos.y, 0, pos.y - area.y1);
  return Math.hypot(dx, dy);
}

describe('DEV_AREAS_MARK', () => {
  it('is the build-output marker string', () => {
    expect(DEV_AREAS_MARK).toBe('glam-gills-dev-areas');
  });
});

describe('DEV_TEST_AREA', () => {
  it('is area 99 in the canal habitat, 6 x 2 screens', () => {
    expect(DEV_TEST_AREA.id).toBe('dev-test-area');
    expect(DEV_TEST_AREA.number).toBe(99);
    expect(DEV_TEST_AREA.habitatId).toBe('canal');
    const zone = buildTestZone(1);
    expect([zone.width, zone.height, zone.bedTop]).toEqual([2880, 720, 678]);
    expect([zone.chunks, zone.rows]).toEqual([6, 2]);
  });

  it('is never in AREAS', () => {
    expect(AREAS).not.toContain(DEV_TEST_AREA);
    expect(AREAS.map((area) => area.id)).not.toContain(DEV_TEST_AREA.id);
    expect(areaById(DEV_TEST_AREA.id)).toBeUndefined();
  });

  it('is found by devAreaById and listed in DEV_AREAS', () => {
    expect(devAreaById('dev-test-area')).toBe(DEV_TEST_AREA);
    expect(devAreaById('canal')).toBeUndefined();
    expect(DEV_AREAS).toEqual([DEV_TEST_AREA, DEV_DANGER_AREA]);
  });

  it('reuses the canal treasures and the canal special treasure', () => {
    expect(DEV_TEST_AREA.layout.treasures).toBe(CANAL_TREASURES);
    expect(DEV_TEST_AREA.specialTreasureId).toBe('canal/toy-boat');
  });

  it('has the tilapia as its only threat', () => {
    expect(threatIds(DEV_TEST_AREA.layout)).toEqual(['tilapia']);
  });
});

describe.each(ZONE_SEEDS)('dev test zone for seed %i', (seed) => {
  const zone = buildTestZone(seed);
  const bounds = swimBounds(zone);

  it('builds deterministically with a start, safe area, reeds, cave, current and stranding places', () => {
    expect(buildTestZone(seed)).toEqual(zone);
    expect(zone.areaId).toBe('dev-test-area');
    expect(inSafeArea(zone.start, zone.safeArea)).toBe(true);
    expect(zone.reedPatches.length).toBeGreaterThan(0);
    expect(zone.currents.length).toBeGreaterThan(0);
    expect(zone.tilapiaRoutes.length).toBeGreaterThan(0);
    expect(zone.strandingPlaces.length).toBeGreaterThan(0);
    expect(zone.cave.y1).toBe(zone.bedTop);
    for (const patch of zone.reedPatches) {
      expect(patch.y1).toBe(zone.bedTop);
    }
  });

  it('puts every spot where its cover and rarity labels hold, spaced apart', () => {
    const ids = zone.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of zone.spots) {
      const where = `${spot.id} (${spot.rarity}) is ${routeDistance(spot, zone.tilapiaRoutes).toFixed(1)} px from a route`;
      expect(spot.id.startsWith('dev-test-area/spot-'), spot.id).toBe(true);
      expect(spotMatchesLabels(spot, zone), where).toBe(true);
      expectInBounds(spot, bounds, spot.id);
      expect(inSafeArea(spot, zone.safeArea), spot.id).toBe(false);
    }
    for (let i = 0; i < zone.spots.length; i++) {
      for (let j = i + 1; j < zone.spots.length; j++) {
        const [a, b] = [zone.spots[i], zone.spots[j]];
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} to ${b.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });

  it('gives every find a non-empty pool of spots of its own rarity', () => {
    const spotById = new Map(zone.spots.map((spot) => [spot.id, spot]));
    for (const find of zone.finds) {
      const rarity = treasureById(find.id)?.rarity;
      expect(rarity).toBeDefined();
      expect(find.pool.length, find.id).toBeGreaterThan(0);
      for (const spotId of find.pool) {
        expect(spotById.get(spotId)?.rarity, `${find.id} ${spotId}`).toBe(rarity);
      }
    }
  });

  it('fits every trip in its pools over trip seeds 1..25, with and without lost treasures', () => {
    const poolSpots = (rarity: Rarity): number =>
      new Set(zone.finds.filter((find) => treasureById(find.id)?.rarity === rarity).flatMap((find) => find.pool)).size;
    let lost: string[] = [];
    for (const tripSeed of TRIP_SEEDS) {
      for (const returnedFinds of [[], lost]) {
        const placed = createTrip(zone, LEGS, [], tripSeed, { returnedFinds, area: DEV_TEST_AREA }).placed;
        for (const rarity of RARITIES) {
          const ofRarity = placed.filter((find) => treasureById(find.id)?.rarity === rarity).length;
          expect(ofRarity, `${rarity} on trip seed ${tripSeed}`).toBeLessThanOrEqual(poolSpots(rarity));
        }
      }
      lost = createTrip(zone, LEGS, [], tripSeed, { area: DEV_TEST_AREA }).placed.map((find) => find.id);
    }
  });

  it('keeps every snack and the exit inside the swim bounds', () => {
    expect(zone.collectibles).toHaveLength(16);
    for (const snack of zone.collectibles) {
      expectInBounds(snack, bounds, snack.id);
    }
    expectInBounds(DEV_TEST_AREA.exit, bounds, 'exit');
    expect(inSafeArea(DEV_TEST_AREA.exit, zone.safeArea)).toBe(false);
  });

  it('keeps tilapia routes in the water and out of the safe area', () => {
    for (const route of zone.tilapiaRoutes) {
      for (const point of route.waypoints) {
        expectInBounds(point, bounds, route.id);
        expect(distanceToArea(point, zone.safeArea), route.id).toBeGreaterThanOrEqual(TILAPIA.bodyRadius);
      }
    }
  });

  it('keeps every stranding place in the water and at least 80 px from every route', () => {
    for (const place of zone.strandingPlaces) {
      expectInBounds(place, bounds, place.id);
      expect(inSafeArea(place, zone.safeArea), place.id).toBe(false);
      expect(routeDistance(place, zone.tilapiaRoutes), place.id).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
    }
  });
});

describe('dev test area trips', () => {
  const zone = buildTestZone(0xa70107);

  it.each(TRIP_SEEDS)('creates a trip for trip seed %i with every find placed in its pool', (tripSeed) => {
    const trip = createTrip(zone, LEGS, [], tripSeed);
    const poolById = new Map(zone.finds.map((find) => [find.id, find.pool]));
    expect(trip.placed.length).toBeGreaterThan(0);
    for (const placed of trip.placed) {
      expect(poolById.get(placed.id), placed.id).toContain(placed.spotId);
    }
  });
});

const DANGER_ZONE_SEED = 0xa70107;
const FRAMES_PER_SECOND = 60;
const DT = 1 / FRAMES_PER_SECOND;
const SWIM_SECONDS = 90;
const SWIM_FRAMES = SWIM_SECONDS * FRAMES_PER_SECOND;
const HEAD_AHEAD = 25;
const LOOP_TOLERANCE = 1e-6;
const OFF_LOOP = 2;
const CRUISE_SPEED = legSwimTuning(LEGS.count).maxSpeed;

/** A box with inclusive edges. */
interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** One stop of the scripted swim: swim to a point, park, or chase a snack until it is eaten. */
type SwimGoal =
  | { kind: 'swimTo'; at: Point }
  | { kind: 'park'; seconds: number }
  | { kind: 'catch'; snackId: string; seconds: number };

/** Everything the scripted swim steps each frame, as the swim scene steps it. */
interface SwimWorld {
  zone: ZoneLayout;
  ctx: TripContext;
  trip: TripState;
  items: Collectible[];
  flicks: ShrimpFlickState;
  pos: Point;
  heading: Point;
  driftT: number;
  goal: number;
  goalTime: number;
  lastTadpoles: Map<string, Point>;
}

/** What the scripted swim saw. */
interface SwimLog {
  chasers: Set<string>;
  poleHits: string[];
  shellBlocks: string[];
  driftSnags: string[];
  movingTadpoles: Set<string>;
  flicked: Set<string>;
  hopped: Set<string>;
  eaten: string[];
  cardsDue: string[];
  stoppedSwimming: boolean;
}

function buildDangerZone(seed: number): ZoneLayout {
  return buildZone(DEV_DANGER_AREA.layout, seed);
}

/** The water of the zone: its whole width, from the surface down to the bed top. */
function waterBox(zone: ZoneLayout): Box {
  return { x0: 0, x1: zone.width, y0: SURF, y1: zone.bedTop };
}

function rectOf(shape: HazardShape): Box {
  if (shape.kind !== 'rect') throw new Error('devAreas.test: every dev danger area sweep is a rect');
  return shape;
}

function boxInside(box: Box, outer: Box): boolean {
  return box.x0 >= outer.x0 && box.x1 <= outer.x1 && box.y0 >= outer.y0 && box.y1 <= outer.y1;
}

function boxesOverlap(box: Box, other: Box): boolean {
  return box.x1 >= other.x0 && box.x0 <= other.x1 && box.y1 >= other.y0 && box.y0 <= other.y1;
}

function boxGap(box: Box, other: Box): number {
  return Math.hypot(Math.max(other.x0 - box.x1, 0, box.x0 - other.x1), Math.max(other.y0 - box.y1, 0, box.y0 - other.y1));
}

/** Every predator route and tilapia route of the zone, by id. */
function routesOf(zone: ZoneLayout): { id: string; waypoints: Point[] }[] {
  return [...zone.tilapiaRoutes, ...zone.predatorRoutes];
}

/** The scripted swim's stops: the first tadpole, the first shrimp from above, through the second net, a park under the first pole, then the main path to the exit. */
function dangerSwimGoals(zone: ZoneLayout): SwimGoal[] {
  return [
    { kind: 'catch', snackId: 'snack-tadpole-1', seconds: 8 },
    { kind: 'swimTo', at: { x: 520, y: 370 } },
    { kind: 'catch', snackId: 'snack-shrimp-1', seconds: 8 },
    { kind: 'swimTo', at: { x: 600, y: 450 } },
    { kind: 'swimTo', at: { x: 980, y: 450 } },
    { kind: 'swimTo', at: { x: 1150, y: 150 } },
    { kind: 'park', seconds: 9 },
    ...zone.mainPath.slice(2).map((at): SwimGoal => ({ kind: 'swimTo', at })),
  ];
}

function snackFrameAt(world: SwimWorld, clock: number): SnackFrame {
  return { driftT: world.driftT, bobT: clock, bobbing: true, drift: DEV_DANGER_AREA.snackDrift, bounds: swimBounds(world.zone) };
}

function drawnAt(items: readonly Collectible[], index: number, frame: SnackFrame): Point {
  return { x: drawnSnackX(items[index], index, frame), y: drawnSnackY(items[index], index, frame) };
}

/** Where the body swims to this frame for the current goal, or null when the goal is done. */
function goalTarget(world: SwimWorld, goal: SwimGoal, frame: SnackFrame): Point | null {
  if (goal.kind === 'swimTo') return world.pos.x === goal.at.x && world.pos.y === goal.at.y ? null : goal.at;
  if (world.goalTime >= goal.seconds) return null;
  if (goal.kind === 'park') return world.pos;
  const index = world.items.findIndex((item) => item.id === goal.snackId);
  if (index < 0 || world.items[index].collected) return null;
  const snack = drawnAt(world.items, index, frame);
  const away = Math.hypot(snack.x - world.pos.x, snack.y - world.pos.y);
  if (away === 0) return world.pos;
  return { x: snack.x - ((snack.x - world.pos.x) / away) * HEAD_AHEAD, y: snack.y - ((snack.y - world.pos.y) / away) * HEAD_AHEAD };
}

/** The target for this frame, moving on past every done goal; the last place once every goal is done. */
function nextTarget(world: SwimWorld, goals: readonly SwimGoal[], frame: SnackFrame): Point {
  while (world.goal < goals.length) {
    const target = goalTarget(world, goals[world.goal], frame);
    if (target) return target;
    world.goal += 1;
    world.goalTime = 0;
  }
  return world.pos;
}

/** Moves the body at four-leg cruise toward `target`, turning the head the way it moves. */
function swimToward(world: SwimWorld, target: Point): void {
  const dx = target.x - world.pos.x;
  const dy = target.y - world.pos.y;
  const away = Math.hypot(dx, dy);
  if (away === 0) return;
  const share = Math.min(1, (CRUISE_SPEED * DT) / away);
  world.pos = share === 1 ? { x: target.x, y: target.y } : { x: world.pos.x + dx * share, y: world.pos.y + dy * share };
  world.heading = { x: dx / away, y: dy / away };
}

function logTripEvents(log: SwimLog, events: readonly TripEvent[], world: SwimWorld): void {
  const drifting = new Set(world.zone.hazards.filter((hazard) => hazard.drift).map((hazard) => hazard.id));
  for (const event of events) {
    if (event.type === 'hit' && event.sourceId.includes('punting-pole')) log.poleHits.push(event.sourceId);
    if (event.type === 'shellBlock') log.shellBlocks.push(event.sourceId);
    if (event.type === 'snagged' && drifting.has(event.id)) log.driftSnags.push(event.id);
  }
}

function logChasers(log: SwimLog, trip: TripState): void {
  for (const predator of trip.encounter.predators) {
    if (predator.phase === 'patrol' && routeLoopDistance(predator.pos, predator.waypoints) > OFF_LOOP) {
      log.chasers.add(predator.routeId);
    }
  }
}

/** Distance from `at` to the leg from a to b. */
function legDistance(at: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const share = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((at.x - a.x) * dx + (at.y - a.y) * dy) / lengthSq));
  return Math.hypot(at.x - (a.x + dx * share), at.y - (a.y + dy * share));
}

/** Whether `at` is on one of the legs of the tadpole's wander loop, from its stored x and y (issue #131, ND-1). */
function onLoop(item: Collectible, at: Point): boolean {
  const wander = item.wander;
  if (!wander) return false;
  const corners = wander.points.map((point) => ({ x: item.x + point.x, y: item.y + point.y }));
  return corners.some((corner, i) => legDistance(at, corner, corners[(i + 1) % corners.length]) <= LOOP_TOLERANCE);
}

/** Logs each uncollected tadpole drawn on its loop somewhere else than on the last frame. */
function logTadpoles(log: SwimLog, world: SwimWorld, frame: SnackFrame): void {
  world.items.forEach((item, index) => {
    if (item.kind !== 'tadpole' || item.collected) return;
    const at = drawnAt(world.items, index, frame);
    const last = world.lastTadpoles.get(item.id);
    if (last && (last.x !== at.x || last.y !== at.y) && onLoop(item, at)) log.movingTadpoles.add(item.id);
    world.lastTadpoles.set(item.id, at);
  });
}

/** The shrimp flick, the snack type meeting, the eat and the fact card due, in the swim scene's order. */
function stepSnacks(world: SwimWorld, log: SwimLog, frame: SnackFrame): void {
  const head = headPoint({ x: world.pos.x, y: world.pos.y, facing: 1, rotation: Math.atan2(world.heading.y, world.heading.x) });
  const flick = stepShrimpFlicks(world.items, head, frame, world.flicks, false, mobileSnackAvoid(world.zone, world.trip.plasticWorms.worms), DT);
  if (flick) {
    world.items = flick.items;
    world.flicks = flick.state;
    for (const started of flick.state.flicks) log.flicked.add(started.id);
    for (const hop of flick.state.hops) log.hopped.add(hop.id);
  }
  world.trip = meetSnacks(world.trip, metSnackTypeIds(world.items, world.pos, world.zone.safeArea, world.trip.met, frame));
  const eaten = collectSnacksAtHead(world.items, head, frame);
  if (eaten) {
    world.items = eaten.items;
    log.eaten.push(...eaten.newly.map((item) => item.kind));
    world.trip = eatSnacks(world.trip, eaten.newly.length, world.ctx).state;
  }
  const due = tripSnapshot(world.trip).factCardDue;
  if (due !== null) {
    log.cardsDue.push(due);
    world.trip = markFactCardSeen(world.trip, due);
  }
}

/** One 1/60 s frame: the body moves, the trip steps, then the snacks, as SwimScene.update runs them. */
function stepSwimFrame(world: SwimWorld, log: SwimLog, goals: readonly SwimGoal[], clock: number): void {
  swimToward(world, nextTarget(world, goals, snackFrameAt(world, clock)));
  world.goalTime += DT;
  world.driftT += DT;
  const result = stepTrip(world.trip, { axolotlPos: world.pos, reduced: false, dashing: false }, DT, world.ctx);
  world.trip = result.state;
  logTripEvents(log, result.events, world);
  logChasers(log, world.trip);
  if (world.trip.phase !== 'swimming') {
    log.stoppedSwimming = true;
    return;
  }
  const frame = snackFrameAt(world, clock + DT);
  logTadpoles(log, world, frame);
  stepSnacks(world, log, frame);
}

function tadpoleRuleOf(zone: ZoneLayout): TadpoleRule {
  const rule = zone.mobileSnacks?.tadpole;
  if (!rule) throw new Error('devAreas.test: the dev danger area has a tadpole rule');
  return rule;
}

function shrimpRuleOf(zone: ZoneLayout): ShrimpRule {
  const rule = zone.mobileSnacks?.shrimp;
  if (!rule) throw new Error('devAreas.test: the dev danger area has a shrimp rule');
  return rule;
}

/**
 * The scripted 90 s swim of the dev danger area, with the Shell on: the real trip (encounter,
 * ghost nets and moving hazards), snacks, shrimp flicks, snack type meetings and fact cards, stepped
 * every 1/60 s along dangerSwimGoals. A trip that stops swimming stops the swim.
 */
function runDangerSwim(zone: ZoneLayout): SwimLog {
  const world: SwimWorld = {
    zone,
    ctx: createTripContext({ encounter: createEncounterContext({ bounds: swimBounds(zone), shell: true }) }),
    trip: createTrip(zone, LEGS, [], 1, { area: DEV_DANGER_AREA }),
    items: createCollectibles(zone.collectibles),
    flicks: createShrimpFlicks(zone.collectibles, shrimpRuleOf(zone)),
    pos: { ...zone.start },
    heading: { x: 1, y: 0 },
    driftT: 0,
    goal: 0,
    goalTime: 0,
    lastTadpoles: new Map(),
  };
  const log: SwimLog = {
    chasers: new Set(),
    poleHits: [],
    shellBlocks: [],
    driftSnags: [],
    movingTadpoles: new Set(),
    flicked: new Set(),
    hopped: new Set(),
    eaten: [],
    cardsDue: [],
    stoppedSwimming: false,
  };
  const goals = dangerSwimGoals(zone);
  for (let frame = 0; frame < SWIM_FRAMES && !log.stoppedSwimming; frame++) {
    stepSwimFrame(world, log, goals, frame * DT);
  }
  return log;
}

describe('DEV_DANGER_AREA', () => {
  const zone = buildDangerZone(DANGER_ZONE_SEED);

  it('is Area 98 in the chinampa habitat, 6 x 2 screens, with its Home Spot, safe area and exit', () => {
    expect(DEV_DANGER_AREA.id).toBe('dev-danger-area');
    expect(DEV_DANGER_AREA.number).toBe(98);
    expect(DEV_DANGER_AREA.habitatId).toBe(CHINAMPA_HABITAT.id);
    expect(DEV_DANGER_AREA.look).toBeUndefined();
    expect([zone.width, zone.height, zone.bedTop]).toEqual([2880, 720, 678]);
    expect([zone.chunks, zone.rows]).toEqual([6, 2]);
    expect(zone.homeSpot).toEqual({ x: 120, y: 200, radius: 72 });
    expect(zone.safeArea).toEqual({ x0: 40, x1: 300, y0: SURF, y1: 678 });
    expect(DEV_DANGER_AREA.exit).toEqual({ x: 2780, y: 625, radius: 40 });
  });

  it('is never in AREAS', () => {
    expect(AREAS).not.toContain(DEV_DANGER_AREA);
    expect(AREAS.map((area) => area.id)).not.toContain(DEV_DANGER_AREA.id);
    expect(areaById(DEV_DANGER_AREA.id)).toBeUndefined();
  });

  it('is found by devAreaById and listed in DEV_AREAS after the dev test area', () => {
    expect(devAreaById('dev-danger-area')).toBe(DEV_DANGER_AREA);
    expect(DEV_AREAS.map((area) => area.id)).toEqual(['dev-test-area', 'dev-danger-area']);
  });

  it('shares only the chinampa treasures and the scarecrow, and no real layout object', () => {
    expect(DEV_DANGER_AREA.layout.treasures).toBe(CHINAMPA_TREASURES);
    expect(DEV_DANGER_AREA.specialTreasureId).toBe('chinampa/scarecrow');
    const realLayouts = AREAS.map((area: Readonly<AreaData>) => area.layout);
    for (const [key, value] of Object.entries(DEV_DANGER_AREA.layout)) {
      if (key === 'treasures' || typeof value !== 'object' || value === null) continue;
      for (const real of realLayouts) expect(Object.values(real), key).not.toContain(value);
    }
  });

  it('has the tilapia, the garter snake, the carp, the ghost net and the punting pole as threats', () => {
    expect(threatIds(DEV_DANGER_AREA.layout)).toEqual(['tilapia', 'garter-snake', 'carp', 'ghost-net', 'punting-pole']);
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(['tilapia-0', 'tilapia-1']);
    expect(zone.predatorRoutes.map((route) => route.id)).toEqual(['garter-snake-0', 'carp-0']);
  });

  it('gives every species that chases its chase in its tuning', () => {
    expect(zone.tilapia).toEqual({ ...TILAPIA, chase: TILAPIA_CHASE });
    const tuningBySpecies = new Map(zone.predatorRoutes.map((route) => [route.species.id, route.species.tuning]));
    expect(tuningBySpecies.get('garter-snake')).toEqual({ ...GARTER_SNAKE, chase: GARTER_SNAKE_CHASE });
    expect(tuningBySpecies.get('carp')).toEqual({ ...CARP, chase: CARP_CHASE });
    for (const route of zone.predatorRoutes) expect(route.species.tuning.chase, route.id).toBeDefined();
  });

  it('has one still ghost net and two drifting 160 px sideways along the current, 8 s apart and clear of it', () => {
    const current = zone.currents[0];
    const nets = zone.hazards.filter((hazard) => hazard.type.id === 'ghost-net');
    expect(nets.map((net) => net.id)).toEqual(['dev-danger-area/ghost-net-1', 'dev-danger-area/ghost-net-2', 'dev-danger-area/ghost-net-3']);
    expect(nets.filter((net) => net.drift === undefined)).toHaveLength(1);
    const drifting = nets.filter((net) => net.drift !== undefined);
    expect(drifting.map((net) => net.drift?.offset)).toEqual([0, 8]);
    for (const net of drifting) {
      expect(net.drift?.dy, net.id).toBe(0);
      expect(net.drift?.dx, net.id).toBe(-160);
      expect(Math.sign(net.drift?.dx ?? 0), net.id).toBe(Math.sign(current.force.x));
      expect(boxGap(rectOf(hazardSweep(net)), current), net.id).toBeGreaterThanOrEqual(NET_CURRENT_CLEARANCE);
    }
  });

  it('has two punting poles in the top row, 2 s out of step', () => {
    const poles = zone.movingHazards ?? [];
    expect(poles.map((pole) => [pole.id, pole.type.id, pole.x, pole.offset])).toEqual([
      ['dev-danger-area/punting-pole-1', 'punting-pole', 1150, 0],
      ['dev-danger-area/punting-pole-2', 'punting-pole', 1350, 2],
    ]);
  });

  it("has 6 worms, 4 bugs, 3 tadpoles and 3 shrimp, Area 4's drift and no one-time darters", () => {
    const kinds = zone.collectibles.map((snack) => snack.kind);
    expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([6, 4, 3, 3]);
    expect(DEV_DANGER_AREA.snackDrift).toEqual({ amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 });
    expect(DEV_DANGER_AREA.snackDart).toBeUndefined();
    expect(oneTimeDarts(DEV_DANGER_AREA, zone)).toBeNull();
    const current = zone.currents[0];
    expect(DEV_DANGER_AREA.layout.snacksInCurrent).toBe(4);
    expect(zone.collectibles.filter((snack) => isInsideCurrent(snack, current)).length).toBeGreaterThanOrEqual(4);
  });

  it('gives tadpoles out of step on 5-point wander loops at 70 px/s, and shrimp on 4-spot homes with the Area 5 rule', () => {
    const mix = zone.mobileSnacks;
    const loops = [
      [[320, 140], [560, 120], [650, 320], [440, 340], [320, 300]],
      [[1100, 140], [1300, 120], [1480, 150], [1420, 290], [1180, 280]],
      [[1980, 140], [2250, 130], [2420, 220], [2300, 300], [2020, 290]],
    ];
    expect(mix?.tadpole).toEqual({ speed: 70 });
    expect(mix?.wanders.map((wander) => wander.points.map((point) => [point.x, point.y]))).toEqual(loops);
    loops.forEach((loop, index) => {
      expect(mix?.wanders[index].offset, `loop ${index + 1}`).toBeCloseTo((index * lapSeconds(loop, 70)) / 3, 9);
    });
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 1.2, flickDistance: 60, flickSpeed: 145 });
    expect(mix?.homes.map((home) => home.points.map((spot) => [spot.x, spot.y]))).toEqual([
      [[480, 440], [560, 470], [520, 540], [440, 520]],
      [[960, 200], [1040, 180], [1080, 250], [1000, 280]],
      [[1360, 540], [1420, 560], [1440, 630], [1380, 620]],
    ]);
  });

  it("hops its shrimp as Area 5's do: a 0.9 s rest after a hop, and 40 px hops at about 97 px/s", () => {
    const rule = shrimpRuleOf(zone);
    expect(rule.restFor * SHRIMP.hopRestShare).toBeCloseTo(0.9, 9);
    expect(rule.flickDistance * SHRIMP.hopShare).toBeCloseTo(40, 9);
    expect(rule.flickSpeed * SHRIMP.hopShare).toBeCloseTo(96.67, 2);
  });

  it('has three stranding places', () => {
    expect(zone.strandingPlaces.map((place) => place.id)).toEqual([
      'dev-danger-area/strand-1',
      'dev-danger-area/strand-2',
      'dev-danger-area/strand-3',
    ]);
  });
});

describe.each(ZONE_SEEDS)('dev danger zone for seed %i', (seed) => {
  const zone = buildDangerZone(seed);
  const bounds = swimBounds(zone);

  it('builds deterministically', () => {
    expect(buildDangerZone(seed)).toEqual(zone);
    expect(zone.areaId).toBe('dev-danger-area');
    expect(inSafeArea(zone.start, zone.safeArea)).toBe(true);
  });

  it('keeps every route, spot and stranding place in bounds and out of the safe area', () => {
    const points = [
      ...routesOf(zone).flatMap((route) => route.waypoints.map((point) => ({ label: route.id, point }))),
      ...zone.spots.map((spot) => ({ label: spot.id, point: spot })),
      ...zone.strandingPlaces.map((place) => ({ label: place.id, point: place })),
    ];
    for (const { label, point } of points) {
      expectInBounds(point, bounds, label);
      expect(inSafeArea(point, zone.safeArea), label).toBe(false);
    }
  });

  it('keeps every net and pole sweep in the water and off the safe area', () => {
    const sweeps = [
      ...zone.hazards.map((hazard) => ({ id: hazard.id, box: rectOf(hazardSweep(hazard)) })),
      ...(zone.movingHazards ?? []).map((spawn) => ({ id: spawn.id, box: movingHazardSweep(spawn) })),
    ];
    expect(sweeps).toHaveLength(5);
    for (const { id, box } of sweeps) {
      expect(boxInside(box, waterBox(zone)), id).toBe(true);
      expect(boxesOverlap(box, zone.safeArea), id).toBe(false);
    }
  });

  it('puts every spot under its declared cover, spaced apart', () => {
    for (const spot of zone.spots) expect(coversAt(spot, zone), spot.id).toContain(spot.cover);
    for (let i = 0; i < zone.spots.length; i++) {
      for (let j = i + 1; j < zone.spots.length; j++) {
        const [a, b] = [zone.spots[i], zone.spots[j]];
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} to ${b.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask (meetsSnackMotion)', () => {
    expect(meetsSnackMotion(DEV_DANGER_AREA.layout)).toBe(true);
    expect(meetsSnackMotion({ screensWide: zone.chunks, screensTall: zone.rows, mobileSnacks: zone.mobileSnacks })).toBe(true);
  });

  it('keeps every tadpole wander loop and shrimp home clear (tadpoleWanderClear, shrimpHomeClear)', () => {
    const avoid = mobileSnackAvoid(zone);
    const mix = zone.mobileSnacks;
    expect(mix?.wanders).toHaveLength(3);
    expect(mix?.homes).toHaveLength(3);
    for (const wander of mix?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}`).toBe(true);
    for (const home of mix?.homes ?? []) {
      expect(shrimpHomeClear(home, DEV_DANGER_AREA.snackDrift, avoid), `home at ${home.points[0].x}`).toBe(true);
    }
  });

  it('lets a one-leg axolotl catch every tadpole (the one-leg catch proof)', () => {
    const rule = tadpoleRuleOf(zone);
    const wanders = zone.mobileSnacks?.wanders ?? [];
    expect(wanders).toHaveLength(3);
    for (const wander of wanders) expect(oneLegCatchesTadpole(rule, wander, bounds), `loop at ${wander.points[0].x}`).toBe(true);
  });

  it('pulls its snacks with the Snack magnet at 84 px/s, has no one-time darters, and has 6 worms, 4 bugs, 3 tadpoles and 3 shrimp', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBe(84);
    expect(oneTimeDarts(DEV_DANGER_AREA, zone)).toBeNull();
    const kinds = zone.collectibles.map((snack) => snack.kind);
    expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([6, 4, 3, 3]);
  });

  it('gives every rarity and every find a non-empty pool of spots of its own rarity', () => {
    const spotById = new Map(zone.spots.map((spot) => [spot.id, spot]));
    for (const rarity of RARITIES) expect(zone.spots.some((spot) => spot.rarity === rarity), rarity).toBe(true);
    for (const find of zone.finds) {
      expect(find.pool.length, find.id).toBeGreaterThan(0);
      for (const spotId of find.pool) expect(spotById.get(spotId)?.rarity, `${find.id} ${spotId}`).toBe(treasureById(find.id)?.rarity);
    }
  });

  it('fits every trip in its pools over trip seeds 1..25', () => {
    for (const tripSeed of TRIP_SEEDS) {
      const placed = createTrip(zone, LEGS, [], tripSeed, { area: DEV_DANGER_AREA }).placed;
      for (const rarity of RARITIES) {
        const ofRarity = placed.filter((find) => treasureById(find.id)?.rarity === rarity).length;
        const pool = zone.spots.filter((spot) => spot.rarity === rarity).length;
        expect(ofRarity, `${rarity} on trip seed ${tripSeed}`).toBeLessThanOrEqual(pool);
      }
    }
  });

  it('keeps every snack and the exit inside the swim bounds, and the exit out of the safe area', () => {
    for (const snack of zone.collectibles) expectInBounds(snack, bounds, snack.id);
    expectInBounds(DEV_DANGER_AREA.exit, bounds, 'exit');
    expect(inSafeArea(DEV_DANGER_AREA.exit, zone.safeArea)).toBe(false);
  });
});

describe('dev danger area trips', () => {
  const zone = buildDangerZone(DANGER_ZONE_SEED);

  it.each(TRIP_SEEDS)('creates a trip for trip seed %i with every find placed in its pool', (tripSeed) => {
    const trip = createTrip(zone, LEGS, [], tripSeed, { area: DEV_DANGER_AREA });
    const poolById = new Map(zone.finds.map((find) => [find.id, find.pool]));
    expect(trip.placed.length).toBeGreaterThan(0);
    for (const placed of trip.placed) expect(poolById.get(placed.id), placed.id).toContain(placed.spotId);
  });
});

describe('dev danger area scripted swim', () => {
  const zone = buildDangerZone(DANGER_ZONE_SEED);

  it('records every danger part and mobile snack in a 90 s swim with the Shell on, and nothing throws', () => {
    const log = runDangerSwim(zone);
    expect(log.stoppedSwimming).toBe(false);
    expect(log.chasers.size).toBeGreaterThan(0);
    expect(log.poleHits.length).toBeGreaterThan(0);
    expect(log.shellBlocks.length).toBeGreaterThan(0);
    expect(log.driftSnags.length).toBeGreaterThan(0);
    expect(log.movingTadpoles.size).toBe(3);
    expect(log.flicked.size).toBeGreaterThan(0);
    expect(log.hopped.size).toBeGreaterThan(0);
    expect(log.eaten).toContain('tadpole');
    expect(log.eaten).toContain('shrimp');
    expect(log.cardsDue).toContain(TADPOLE_FACT.id);
    expect(log.cardsDue).toContain(SHRIMP_FACT.id);
  });
});
