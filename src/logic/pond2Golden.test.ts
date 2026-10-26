/**
 * Golden guard for the lily pad pond at dusk, Area 3 ('pond-2'): its built zone, its trip placements,
 * and the encounter and trip rules, the heron included, played along a fixed scripted swim. Any change
 * here means a shared rule changed pond-2 behaviour.
 */
import { describe, expect, it } from 'vitest';
import { POND_2_TREASURES } from './catalogue';
import { createEncounter, createEncounterContext, stepEncounter, type EncounterState } from './encounter';
import { legSwimTuning } from './legs';
import { POND_2_LAYOUT } from './pond2Layout';
import { CARP_SPECIES } from './predators';
import { createTrip, createTripContext, newTrip, stepTrip, type TripState } from './trip';
import { LEGS } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds, type Point, type TilapiaRoute, type ZoneLayout } from './zone';

const EXTRA_ZONE_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const TRIP_SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);
const BANKED_IDS = POND_2_TREASURES.slice(0, 3).map((treasure) => treasure.id);
const RETURNED_IDS = POND_2_TREASURES.slice(3, 5).map((treasure) => treasure.id);
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const FRAMES_PER_SECOND = 60;
const DT = 1 / FRAMES_PER_SECOND;
const PARK_SECONDS = 20;
const TRACE_SECONDS = 180;
const MIN_TRACE_SECONDS = 90;
const TRACE_FRAMES = TRACE_SECONDS * FRAMES_PER_SECOND;
const EVENT_DECIMALS = 100;

const cruiseSpeed = legSwimTuning(LEGS.count).maxSpeed;

function pickGoldenProjection(zone: ZoneLayout) {
  return {
    areaId: zone.areaId,
    width: zone.width,
    height: zone.height,
    chunks: zone.chunks,
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
    mobileSnacks: zone.mobileSnacks,
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

function buildPond2Zone(zoneSeed: number): ZoneLayout {
  return buildZone(POND_2_LAYOUT, zoneSeed);
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

/** Mean of a route's waypoints: inside the tilapia's or the carp's lunge range wherever it is on its loop. */
function routeCentre(route: TilapiaRoute): Point {
  const count = route.waypoints.length;
  const sumX = route.waypoints.reduce((total, point) => total + point.x, 0);
  const sumY = route.waypoints.reduce((total, point) => total + point.y, 0);
  return { x: sumX / count, y: sumY / count };
}

/** The routes the scripted swim parks by: every tilapia route, then every carp route (issue #133, ND-9). */
function listParkRoutes(zone: ZoneLayout): TilapiaRoute[] {
  return [...zone.tilapiaRoutes, ...zone.predatorRoutes.filter((route) => route.species.id === CARP_SPECIES.id)];
}

/**
 * The scripted swim, one axolotl centre per frame: the main path at four-leg cruise, then to each
 * tilapia's and then each carp's route centre in turn, parked there PARK_SECONDS, then parked at the
 * last one until TRACE_SECONDS. Throws when the stops overrun TRACE_SECONDS, so no park is cut off.
 */
function listScriptedPositions(zone: ZoneLayout): Point[] {
  const positions: Point[] = [{ ...zone.mainPath[0] }];
  const stops = [...zone.mainPath.slice(1), ...listParkRoutes(zone).map(routeCentre)];
  const parkFrom = zone.mainPath.length - 1;
  stops.forEach((stop, index) => {
    positions.push(...swimPositions(positions[positions.length - 1], stop));
    if (index >= parkFrom) {
      positions.push(...Array.from({ length: PARK_SECONDS * FRAMES_PER_SECOND }, () => ({ ...stop })));
    }
  });
  if (positions.length > TRACE_FRAMES) {
    throw new Error(`listScriptedPositions: the stops take ${positions.length} frames, more than the ${TRACE_FRAMES} of TRACE_SECONDS`);
  }
  const last = positions[positions.length - 1];
  while (positions.length < TRACE_FRAMES) positions.push({ ...last });
  return positions.slice(0, TRACE_FRAMES);
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

function describeTrip(state: TripState): string {
  return `${state.phase} legsLost=${state.legsLost} met=${state.met.join('+')}`;
}

/** The trip's phase, legsLost and met once per second; an ended trip starts the next with `newTrip`. */
function traceTrip(zone: ZoneLayout, positions: readonly Point[]): string[] {
  const ctx = createTripContext({ encounter: createEncounterContext({ bounds: swimBounds(zone) }) });
  const lines: string[] = [];
  let state = createTrip(zone);
  positions.forEach((pos, index) => {
    const frame = index + 1;
    state = stepTrip(state, { axolotlPos: pos, reduced: false, dashing: false }, DT, ctx).state;
    if (state.phase === 'ended') {
      lines.push(`${frame}: ended, new trip`);
      state = newTrip(state);
    }
    if (frame % FRAMES_PER_SECOND === 0) lines.push(`${frame / FRAMES_PER_SECOND}s ${describeTrip(state)}`);
  });
  return lines;
}

describe('pond-2 golden', () => {
  const defaultZone = buildPond2Zone(DEFAULT_ZONE_SEED);
  const positions = listScriptedPositions(defaultZone);

  it('keeps the default zone projection', () => {
    expect(pickGoldenProjection(defaultZone)).toMatchSnapshot();
  });

  it('keeps the projection of every extra zone seed', () => {
    const summaries = Object.fromEntries(
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizeProjection(buildPond2Zone(zoneSeed))]),
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
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizePlacements(buildPond2Zone(zoneSeed))]),
    );
    expect(summaries).toMatchSnapshot();
  });

  it('scripts a swim of at least 90 s that parks inside every tilapia and carp lunge range', () => {
    expect(positions.length / FRAMES_PER_SECOND).toBeGreaterThanOrEqual(MIN_TRACE_SECONDS);
    expect(listParkRoutes(defaultZone).map((route) => route.id)).toEqual([
      'tilapia-0',
      'tilapia-1',
      'tilapia-2',
      'tilapia-3',
      'carp-0',
      'carp-1',
    ]);
    const parkedFrames = listParkRoutes(defaultZone).map((route) => {
      const centre = routeCentre(route);
      return positions.filter((pos) => pos.x === centre.x && pos.y === centre.y).length;
    });
    for (const frames of parkedFrames) expect(frames).toBeGreaterThanOrEqual(PARK_SECONDS * FRAMES_PER_SECOND);
  });

  it('keeps the encounter trace along the scripted swim', () => {
    const lines = traceEncounter(defaultZone, positions);
    expect({ events: countEventTypes(lines), ...summarizeText(lines.join('\n')) }).toMatchSnapshot();
  });

  it('keeps the trip trace of met, legsLost and phase along the scripted swim', () => {
    expect(traceTrip(defaultZone, positions)).toMatchSnapshot();
  });

  it('is deterministic across repeated builds and runs', () => {
    expect(summarizeProjection(buildPond2Zone(DEFAULT_ZONE_SEED))).toEqual(summarizeProjection(defaultZone));
    const rerun = listScriptedPositions(buildPond2Zone(DEFAULT_ZONE_SEED));
    expect(traceEncounter(defaultZone, rerun)).toEqual(traceEncounter(defaultZone, positions));
  });
});
