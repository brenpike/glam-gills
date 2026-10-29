/**
 * Golden guard for the spring cave, Area 6 ('spring-cave-1'): its built zone, its trip placements,
 * and the encounter and trip rules, its crayfish, chasing common carp, dripping stalactites, geyser
 * vents, mobile snacks, spring outflow, dark water and glow-plants included, played along a fixed
 * scripted swim that swims down into the dark, waits there for the glow-plant hint, lights every
 * glow-plant, then parks by every crayfish, carp, stalactite and geyser sweep (issue #77). Any change here means a shared rule changed spring-cave-1 behaviour.
 */
import { describe, expect, it } from 'vitest';
import { SPRING_CAVE_TREASURES } from './catalogue';
import { createEncounter, createEncounterContext, stepEncounter, type EncounterState } from './encounter';
import { glowPlants, inDarkWater } from './glowPlants';
import { hazardCentre, shapeDistance } from './hazards';
import { legSwimTuning } from './legs';
import { movingHazardSweep } from './movingHazards';
import { SPRING_CAVE_LAYOUT } from './springCaveLayout';
import { createTrip, createTripContext, newTrip, stepTrip, type TripState } from './trip';
import { LEGS } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds, type Point, type ZoneLayout } from './zone';

const EXTRA_ZONE_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const TRIP_SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);
const BANKED_IDS = SPRING_CAVE_TREASURES.slice(0, 3).map((treasure) => treasure.id);
const RETURNED_IDS = SPRING_CAVE_TREASURES.slice(3, 5).map((treasure) => treasure.id);
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const FRAMES_PER_SECOND = 60;
const DT = 1 / FRAMES_PER_SECOND;
const PARK_SECONDS = 20;
const TRACE_SECONDS = 480;
const MIN_TRACE_SECONDS = 120;
const TRACE_FRAMES = TRACE_SECONDS * FRAMES_PER_SECOND;
const PARK_FRAMES = PARK_SECONDS * FRAMES_PER_SECOND;
const EVENT_DECIMALS = 100;
const STOP_TOLERANCE = 1e-6;

const cruiseSpeed = legSwimTuning(LEGS.count).maxSpeed;

/** One stop of the scripted swim: where to swim to, and whether to park there PARK_SECONDS. */
interface ScriptStop {
  at: Point;
  park: boolean;
}

function pickGoldenProjection(zone: ZoneLayout) {
  return {
    areaId: zone.areaId,
    width: zone.width,
    height: zone.height,
    bedTop: zone.bedTop,
    chunks: zone.chunks,
    rows: zone.rows,
    start: zone.start,
    reeds: zone.reeds,
    reedPatches: zone.reedPatches,
    currents: zone.currents,
    collectibles: zone.collectibles,
    pads: zone.pads,
    bankChunks: zone.bankChunks,
    sunChunk: zone.sunChunk,
    safeArea: zone.safeArea,
    tilapiaRoutes: zone.tilapiaRoutes,
    homeSpot: zone.homeSpot,
    finds: zone.finds,
    spots: zone.spots,
    cave: zone.cave,
    mainPath: zone.mainPath,
    strandingPlaces: zone.strandingPlaces,
    hazards: zone.hazards,
    predatorRoutes: zone.predatorRoutes,
    elements: zone.elements,
    tilapia: zone.tilapia,
    bankOverhangs: zone.bankOverhangs,
    movingHazards: zone.movingHazards,
    mobileSnacks: zone.mobileSnacks,
    darkWater: zone.darkWater,
  };
}

function hashFnv1a(text: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function summarizeText(text: string) {
  return { length: text.length, fnv1a: hashFnv1a(text) };
}

function summarizeProjection(zone: ZoneLayout) {
  return summarizeText(JSON.stringify(pickGoldenProjection(zone)));
}

function buildSpringCaveZone(zoneSeed: number): ZoneLayout {
  return buildZone(SPRING_CAVE_LAYOUT, zoneSeed);
}

function listPlacements(
  zone: ZoneLayout,
  tripSeed: number,
  banked: readonly string[] = [],
  returnedFinds: readonly string[] = [],
): string[] {
  const trip = createTrip(zone, LEGS, banked, tripSeed, { returnedFinds });
  return trip.placed.map((find) => `${find.id}@${find.spotId}${find.container ? '+pot' : ''}`);
}

function listPlacementsPerSeed(zone: ZoneLayout, banked: readonly string[], returnedFinds: readonly string[]) {
  return TRIP_SEEDS.map((tripSeed) => listPlacements(zone, tripSeed, banked, returnedFinds).join(','));
}

function summarizePlacements(zone: ZoneLayout) {
  return summarizeText(listPlacementsPerSeed(zone, [], []).join('|'));
}

/** Axolotl centre after each 1/60 s frame of a straight swim at four-leg cruise speed. */
function swimPositions(from: Point, to: Point): Point[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const positions: Point[] = [];
  let travelled = 0;
  while (travelled < length) {
    travelled = Math.min(length, travelled + cruiseSpeed * DT);
    const share = travelled / length;
    positions.push({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share });
  }
  return positions;
}

/**
 * Mean of a route's waypoints: a carp loop's centre, inside its lunge range wherever it is on the
 * loop, or the middle of a crayfish's two-waypoint floor stretch.
 */
function routeCentre(route: { waypoints: readonly Point[] }): Point {
  const count = route.waypoints.length;
  const sumX = route.waypoints.reduce((total, point) => total + point.x, 0);
  const sumY = route.waypoints.reduce((total, point) => total + point.y, 0);
  return { x: sumX / count, y: sumY / count };
}

/** The centre of each stalactite's and geyser's sweep, in data order. */
function listMovingHazardCentres(zone: ZoneLayout): Point[] {
  return (zone.movingHazards ?? []).map((spawn) => hazardCentre(movingHazardSweep(spawn)));
}

/** The centre of each glow-plant, in data order. */
function listGlowPlantCentres(zone: ZoneLayout): Point[] {
  return glowPlants(zone.elements).map((plant) => ({ x: plant.glowPlant.x, y: plant.glowPlant.y }));
}

/**
 * Every place the scripted swim parks after the glow-plants, west to east: each crayfish
 * stretch's middle and each carp loop's centre, then each stalactite and geyser sweep's centre, west to east.
 */
function listParkSpots(zone: ZoneLayout): Point[] {
  const byX = (first: Point, second: Point) => first.x - second.x;
  return [...zone.predatorRoutes.map(routeCentre).sort(byX), ...listMovingHazardCentres(zone).sort(byX)];
}

/**
 * The scripted swim's stops: the main path down into the dark, parked at its end long enough for
 * the glow-plant hint, then through each glow-plant centre, last plant first, then each parked
 * spot of listParkSpots.
 */
function listScriptStops(zone: ZoneLayout): ScriptStop[] {
  const path = zone.mainPath.slice(1);
  return [
    ...path.map((at, index): ScriptStop => ({ at, park: index === path.length - 1 })),
    ...listGlowPlantCentres(zone)
      .reverse()
      .map((at): ScriptStop => ({ at, park: false })),
    ...listParkSpots(zone).map((at): ScriptStop => ({ at, park: true })),
  ];
}

/**
 * The scripted swim, one axolotl centre per frame at four-leg cruise along listScriptStops, parked
 * PARK_SECONDS at each parked stop, then parked at the last stop until TRACE_SECONDS.
 */
function listScriptedPositions(zone: ZoneLayout): Point[] {
  const positions: Point[] = [{ ...zone.mainPath[0] }];
  for (const stop of listScriptStops(zone)) {
    positions.push(...swimPositions(positions[positions.length - 1], stop.at));
    if (stop.park) positions.push(...Array.from({ length: PARK_FRAMES }, () => ({ ...stop.at })));
  }
  const last = positions[positions.length - 1];
  while (positions.length < TRACE_FRAMES) positions.push({ ...last });
  return positions.slice(0, TRACE_FRAMES);
}

function countFramesAt(positions: readonly Point[], at: Point): number {
  return positions.filter((pos) => pos.x === at.x && pos.y === at.y).length;
}

function roundEventNumber(_key: string, value: unknown): unknown {
  return typeof value === 'number' ? Math.round(value * EVENT_DECIMALS) / EVENT_DECIMALS : value;
}

function describePredators(state: EncounterState): string {
  return state.predators
    .map((predator) => `${predator.routeId}/${predator.phase}/${Math.round(predator.pos.x)},${Math.round(predator.pos.y)}`)
    .join(' ');
}

/**
 * Every encounter event, by frame, and each predator's phase and rounded position once per
 * second. A finished trip records `reset` and starts a fresh encounter.
 */
function traceEncounter(zone: ZoneLayout, positions: readonly Point[]): string[] {
  const ctx = createEncounterContext({ bounds: swimBounds(zone) });
  const lines: string[] = [];
  let state = createEncounter(zone);
  positions.forEach((pos, index) => {
    const frame = index + 1;
    const result = stepEncounter(state, pos, DT, ctx);
    for (const event of result.events) lines.push(`${frame}:${JSON.stringify(event, roundEventNumber)}`);
    state = result.state;
    if (state.tripOver) {
      lines.push(`${frame}:reset`);
      state = createEncounter(zone);
    }
    if (frame % FRAMES_PER_SECOND === 0) lines.push(`${frame / FRAMES_PER_SECOND}s ${describePredators(state)}`);
  });
  return lines;
}

function countEventTypes(lines: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const line of lines) {
    const match = /^\d+:(?:\{"type":"(\w+)"|(reset))/.exec(line);
    const type = match?.[1] ?? match?.[2];
    if (type !== undefined) counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/** The trip's phase, legsLost, met, whether `pos` is in the dark, the hint clock and the hint. */
function describeTrip(state: TripState, pos: Point): string {
  const dark = state.darkWater !== null && inDarkWater(pos, state.darkWater);
  return `${state.phase} legsLost=${state.legsLost} met=${state.met.join('+')} dark=${dark} hintTime=${state.darkHintTime.toFixed(2)} hint=${state.darkHint ?? '-'}`;
}

/** A line by frame for each glow-plant lit this step. */
function listLightLines(frame: number, before: TripState, after: TripState): string[] {
  return after.litGlowPlants.slice(before.litGlowPlants.length).map((id) => `${frame}: lit ${id}`);
}

/**
 * The trip's phase, legsLost, met, whether the axolotl is in the dark, the hint clock and the hint
 * once per second, and each newly lit glow-plant by frame; an ended trip starts the next with
 * `newTrip`.
 */
function traceTrip(zone: ZoneLayout, positions: readonly Point[]): string[] {
  const ctx = createTripContext({ encounter: createEncounterContext({ bounds: swimBounds(zone) }) });
  const lines: string[] = [];
  let state = createTrip(zone);
  positions.forEach((pos, index) => {
    const frame = index + 1;
    const result = stepTrip(state, { axolotlPos: pos, reduced: false, dashing: false }, DT, ctx);
    lines.push(...listLightLines(frame, state, result.state));
    state = result.state;
    if (state.phase === 'ended') {
      lines.push(`${frame}: ended, new trip`);
      state = newTrip(state);
    }
    if (frame % FRAMES_PER_SECOND === 0) lines.push(`${frame / FRAMES_PER_SECOND}s ${describeTrip(state, pos)}`);
  });
  return lines;
}

describe('spring-cave-1 golden', () => {
  const defaultZone = buildSpringCaveZone(DEFAULT_ZONE_SEED);
  const positions = listScriptedPositions(defaultZone);

  it('keeps the default zone projection', () => {
    expect(pickGoldenProjection(defaultZone)).toMatchSnapshot();
  });

  it('keeps the projection of every extra zone seed', () => {
    const summaries = Object.fromEntries(
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizeProjection(buildSpringCaveZone(zoneSeed))]),
    );
    expect(summaries).toMatchSnapshot();
  });

  it('keeps the default zone placements for trip seeds 1..25', () => {
    expect(listPlacementsPerSeed(defaultZone, [], [])).toMatchSnapshot();
  });

  it('keeps the default zone placements with three banked treasures', () => {
    expect(listPlacementsPerSeed(defaultZone, BANKED_IDS, [])).toMatchSnapshot();
  });

  it('keeps the default zone placements with two returned treasures', () => {
    expect(listPlacementsPerSeed(defaultZone, [], RETURNED_IDS)).toMatchSnapshot();
  });

  it('keeps the placements of every extra zone seed', () => {
    const summaries = Object.fromEntries(
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizePlacements(buildSpringCaveZone(zoneSeed))]),
    );
    expect(summaries).toMatchSnapshot();
  });

  it('scripts a swim of at least 120 s that reaches every stop', () => {
    expect(positions.length / FRAMES_PER_SECOND).toBeGreaterThanOrEqual(MIN_TRACE_SECONDS);
    for (const stop of listScriptStops(defaultZone)) {
      expect(positions.some((pos) => Math.hypot(pos.x - stop.at.x, pos.y - stop.at.y) < STOP_TOLERANCE)).toBe(true);
    }
  });

  it('scripts a swim that parks at every crayfish stretch middle, every carp loop centre and every stalactite and geyser sweep centre', () => {
    expect(defaultZone.tilapiaRoutes).toEqual([]);
    expect(defaultZone.predatorRoutes.map((route) => route.species.id)).toEqual([
      'crayfish',
      'crayfish',
      'crayfish',
      'carp',
      'carp',
      'carp',
      'carp',
      'carp',
      'carp',
      'carp',
    ]);
    expect((defaultZone.movingHazards ?? []).map((spawn) => spawn.type.id)).toEqual([
      'stalactite-drip',
      'stalactite-drip',
      'stalactite-drip',
      'stalactite-drip',
      'stalactite-drip',
      'geyser-vent',
      'geyser-vent',
    ]);
    const parkSpots = [...defaultZone.predatorRoutes.map(routeCentre), ...listMovingHazardCentres(defaultZone)];
    for (const at of parkSpots) expect(countFramesAt(positions, at)).toBeGreaterThanOrEqual(PARK_FRAMES);
  });

  it("scripts a swim that runs through the spring outflow and every stalactite's and geyser's sweep", () => {
    const current = defaultZone.currents[0];
    const inCurrent = positions.some(
      (pos) => pos.x >= current.x0 && pos.x <= current.x1 && pos.y >= current.y0 && pos.y <= current.y1,
    );
    expect(inCurrent).toBe(true);
    for (const spawn of defaultZone.movingHazards ?? []) {
      expect(positions.some((pos) => shapeDistance(pos, movingHazardSweep(spawn)) === 0)).toBe(true);
    }
  });

  it('scripts a swim that parks in the dark at the main path end and touches every glow-plant', () => {
    const dark = defaultZone.darkWater;
    if (!dark) throw new Error('spring-cave-1 has no dark water');
    const pathEnd = defaultZone.mainPath[defaultZone.mainPath.length - 1];
    expect(inDarkWater(pathEnd, dark)).toBe(true);
    expect(countFramesAt(positions, pathEnd)).toBeGreaterThanOrEqual(PARK_FRAMES);
    const plants = glowPlants(defaultZone.elements);
    expect(plants).toHaveLength(6);
    for (const plant of plants) {
      expect(positions.some((pos) => Math.hypot(pos.x - plant.glowPlant.x, pos.y - plant.glowPlant.y) < STOP_TOLERANCE)).toBe(true);
    }
  });

  it('shows the glow-plant hint and lights all six glow-plants on the first trip, before it ends', () => {
    const lines = traceTrip(defaultZone, positions);
    const firstEnd = lines.findIndex((line) => line.endsWith('ended, new trip'));
    const firstTrip = lines.slice(0, firstEnd);
    expect(firstTrip.some((line) => / hint=spring-cave-1\/glow-plant-\d$/.test(line))).toBe(true);
    const lit = firstTrip.flatMap((line) => /^\d+: lit (\S+)$/.exec(line)?.[1] ?? []);
    expect([...lit].sort()).toEqual(glowPlants(defaultZone.elements).map((plant) => plant.id).sort());
  });

  it('keeps the encounter trace along the scripted swim', () => {
    const lines = traceEncounter(defaultZone, positions);
    expect({ events: countEventTypes(lines), ...summarizeText(lines.join('\n')) }).toMatchSnapshot();
  });

  it('keeps the trip trace of met, legsLost, the dark, the glow-plant hint, lit plants and phase along the scripted swim', () => {
    expect(traceTrip(defaultZone, positions)).toMatchSnapshot();
  });

  it('is deterministic across repeated builds and runs', () => {
    expect(summarizeProjection(buildSpringCaveZone(DEFAULT_ZONE_SEED))).toEqual(summarizeProjection(defaultZone));
    const rerun = listScriptedPositions(buildSpringCaveZone(DEFAULT_ZONE_SEED));
    expect(traceEncounter(defaultZone, rerun)).toEqual(traceEncounter(defaultZone, positions));
    expect(traceTrip(defaultZone, rerun)).toEqual(traceTrip(defaultZone, positions));
  }, 60_000);
});
