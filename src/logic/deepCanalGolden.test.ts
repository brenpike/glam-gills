/**
 * Golden guard for the deep canal's Area 8 ('deep-canal-1'): its built zone, its trip placements,
 * and the encounter and trip rules, its tilapia, common carp, black bass, punting poles, gliding
 * trajineras, mobile snacks, side-canal inflow and old-stone divider included, played along a fixed
 * scripted swim that climbs the surface lane, parks in the middle of each trajinera's span until its
 * hull glides over and pushes the axolotl aside, swims on to the exit pocket, then goes back west
 * along the deep lane and parks by every black bass loop (issue #78). Any change here means a shared
 * rule changed deep-canal-1 behaviour.
 */
import { describe, expect, it } from 'vitest';
import { DEEP_CANAL_TREASURES } from './catalogue';
import { createEncounter, createEncounterContext, stepEncounter, type EncounterState } from './encounter';
import { legSwimTuning } from './legs';
import { bodyInAnyRock } from './pebble';
import { BLACK_BASS_SPECIES } from './predators';
import { TRAJINERAS } from './trajineras';
import { createTrip, createTripContext, newTrip, stepTrip, type TripState } from './trip';
import { LEGS } from './tuning';
import { DEEP_CANAL_LAYOUT } from './deepCanalLayout';
import { DEFAULT_ZONE_SEED, SURF, buildZone, swimBounds, type Point, type ZoneLayout } from './zone';

const EXTRA_ZONE_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const TRIP_SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);
const BANKED_IDS = DEEP_CANAL_TREASURES.slice(0, 3).map((treasure) => treasure.id);
const RETURNED_IDS = DEEP_CANAL_TREASURES.slice(3, 5).map((treasure) => treasure.id);
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const FRAMES_PER_SECOND = 60;
const DT = 1 / FRAMES_PER_SECOND;
const PARK_SECONDS = 20;
/** A trajinera crossing takes 6 s, so a parked axolotl waits a little longer to be sure a hull glides over. */
const BOAT_WAIT_SECONDS = 8;
const TRACE_SECONDS = 600;
const MIN_TRACE_SECONDS = 120;
const TRACE_FRAMES = TRACE_SECONDS * FRAMES_PER_SECOND;
const EVENT_DECIMALS = 100;
const STOP_TOLERANCE = 1e-6;

const cruiseSpeed = legSwimTuning(LEGS.count).maxSpeed;

/** One stop of the scripted swim: where to swim to, and how many seconds to park there. */
interface ScriptStop {
  at: Point;
  parkSeconds: number;
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
    rockWalls: zone.rockWalls,
    sideRooms: zone.sideRooms,
    trajineras: zone.trajineras,
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

function buildDeepCanalZone(zoneSeed: number): ZoneLayout {
  return buildZone(DEEP_CANAL_LAYOUT, zoneSeed);
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

/** Mean of a route's waypoints: a loop's centre, inside its lunge range wherever it is on the loop. */
function routeCentre(route: { waypoints: readonly Point[] }): Point {
  const count = route.waypoints.length;
  const sumX = route.waypoints.reduce((total, point) => total + point.x, 0);
  const sumY = route.waypoints.reduce((total, point) => total + point.y, 0);
  return { x: sumX / count, y: sumY / count };
}

/** The middle of each trajinera's span, level with the middle of its hull, in data order. */
function listBoatWaits(zone: ZoneLayout): Point[] {
  return (zone.trajineras ?? []).map((boat) => ({
    x: (boat.trajinera.x0 + boat.trajinera.x1) / 2,
    y: SURF + TRAJINERAS.hullDepth / 2,
  }));
}

/** The centre of each black bass loop, east to west: the deep lane swum back west from the exit pocket. */
function listBassParks(zone: ZoneLayout): Point[] {
  return zone.predatorRoutes
    .filter((route) => route.species.id === BLACK_BASS_SPECIES.id)
    .map(routeCentre)
    .sort((first, second) => second.x - first.x);
}

/**
 * The scripted swim's stops: the main path up to the surface lane, with a wait in the middle of
 * each trajinera's span before the main path point that passes it, on to the exit pocket, then
 * back west along the deep lane through each black bass loop's centre, parked there.
 */
function listScriptStops(zone: ZoneLayout): ScriptStop[] {
  const climb = zone.mainPath.slice(1, -1);
  const exit = zone.mainPath[zone.mainPath.length - 1];
  const waits = listBoatWaits(zone);
  const stops: ScriptStop[] = [];
  for (const at of climb) {
    while (waits.length > 0 && waits[0].x < at.x) stops.push({ at: waits.shift() as Point, parkSeconds: BOAT_WAIT_SECONDS });
    stops.push({ at, parkSeconds: 0 });
  }
  stops.push({ at: exit, parkSeconds: 0 });
  for (const at of listBassParks(zone)) stops.push({ at, parkSeconds: PARK_SECONDS });
  return stops;
}

/**
 * The scripted swim, one axolotl centre per frame at four-leg cruise along listScriptStops, parked
 * at each stop for its seconds, then parked at the last stop until TRACE_SECONDS.
 */
function listScriptedPositions(zone: ZoneLayout): Point[] {
  const positions: Point[] = [{ ...zone.mainPath[0] }];
  for (const stop of listScriptStops(zone)) {
    positions.push(...swimPositions(positions[positions.length - 1], stop.at));
    positions.push(...Array.from({ length: stop.parkSeconds * FRAMES_PER_SECOND }, () => ({ ...stop.at })));
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

/** The trip's phase, legsLost and met. */
function describeTrip(state: TripState): string {
  return `${state.phase} legsLost=${state.legsLost} met=${state.met.join('+')}`;
}

/**
 * The trip's phase, legsLost and met once per second, and each trajinera push by frame (the boat,
 * where the axolotl was, where it is pushed to and the impulse); an ended trip starts the next with
 * `newTrip`.
 */
function traceTrip(zone: ZoneLayout, positions: readonly Point[]): string[] {
  const ctx = createTripContext({ encounter: createEncounterContext({ bounds: swimBounds(zone) }) });
  const lines: string[] = [];
  let state = createTrip(zone);
  positions.forEach((pos, index) => {
    const frame = index + 1;
    const result = stepTrip(state, { axolotlPos: pos, reduced: false, dashing: false }, DT, ctx);
    if (result.pushed) lines.push(`${frame}: push ${JSON.stringify(result.pushed, roundEventNumber)}`);
    state = result.state;
    if (state.phase === 'ended') {
      lines.push(`${frame}: ended, new trip`);
      state = newTrip(state);
    }
    if (frame % FRAMES_PER_SECOND === 0) lines.push(`${frame / FRAMES_PER_SECOND}s ${describeTrip(state)}`);
  });
  return lines;
}

describe('deep-canal-1 golden', () => {
  const defaultZone = buildDeepCanalZone(DEFAULT_ZONE_SEED);
  const positions = listScriptedPositions(defaultZone);

  it('keeps the default zone projection', () => {
    expect(pickGoldenProjection(defaultZone)).toMatchSnapshot();
  });

  it('keeps the projection of every extra zone seed', () => {
    const summaries = Object.fromEntries(
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizeProjection(buildDeepCanalZone(zoneSeed))]),
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
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizePlacements(buildDeepCanalZone(zoneSeed))]),
    );
    expect(summaries).toMatchSnapshot();
  });

  it('builds the two lanes: an old-stone divider of seven touching stones, two trajineras, four punting poles, two black bass', () => {
    expect(defaultZone.rockWalls).toHaveLength(7);
    expect((defaultZone.trajineras ?? []).map((boat) => [boat.id, boat.trajinera.direction])).toEqual([
      ['deep-canal-1/trajinera-1', 'right'],
      ['deep-canal-1/trajinera-2', 'left'],
    ]);
    expect((defaultZone.movingHazards ?? []).map((spawn) => spawn.type.id)).toEqual(Array(4).fill('punting-pole'));
    expect(defaultZone.predatorRoutes.map((route) => route.id)).toEqual(['carp-0', 'carp-1', 'carp-2', 'carp-3', 'carp-4', 'bass-0', 'bass-1']);
    expect(defaultZone.predatorRoutes.filter((route) => route.species.id === BLACK_BASS_SPECIES.id)).toHaveLength(2);
    expect(defaultZone.tilapiaRoutes).toHaveLength(2);
  });

  it('scripts a swim of at least 120 s that reaches every stop and never enters the divider', () => {
    expect(positions.length / FRAMES_PER_SECOND).toBeGreaterThanOrEqual(MIN_TRACE_SECONDS);
    for (const stop of listScriptStops(defaultZone)) {
      expect(positions.some((pos) => Math.hypot(pos.x - stop.at.x, pos.y - stop.at.y) < STOP_TOLERANCE)).toBe(true);
    }
    expect(positions.filter((pos) => bodyInAnyRock(pos, defaultZone.rockWalls ?? []))).toEqual([]);
  });

  it('scripts a swim that parks in the middle of each trajinera span and at the centre of each black bass loop', () => {
    for (const at of [...listBoatWaits(defaultZone), ...listBassParks(defaultZone)]) {
      expect(countFramesAt(positions, at)).toBeGreaterThanOrEqual(BOAT_WAIT_SECONDS * FRAMES_PER_SECOND);
    }
    expect(listBassParks(defaultZone)).toHaveLength(2);
  });

  it('meets the black bass on the encounter trace', () => {
    const lines = traceEncounter(defaultZone, positions);
    const bassWarned = lines.some((line) => /"type":"telegraph".*"sourceId":"bass-\d"/.test(line));
    expect(bassWarned).toBe(true);
  });

  it('pushes the axolotl aside from each trajinera on the trip trace', () => {
    const lines = traceTrip(defaultZone, positions);
    for (const boat of defaultZone.trajineras ?? []) {
      expect(lines.some((line) => line.includes(`"id":"${boat.id}"`)), boat.id).toBe(true);
    }
  });

  it('keeps the encounter trace along the scripted swim', () => {
    const lines = traceEncounter(defaultZone, positions);
    expect({ events: countEventTypes(lines), ...summarizeText(lines.join('\n')) }).toMatchSnapshot();
  });

  it('keeps the trip trace of pushes, met, legsLost and phase along the scripted swim', () => {
    expect(traceTrip(defaultZone, positions)).toMatchSnapshot();
  });

  it('is deterministic across repeated builds and runs', () => {
    expect(summarizeProjection(buildDeepCanalZone(DEFAULT_ZONE_SEED))).toEqual(summarizeProjection(defaultZone));
    const rerun = listScriptedPositions(buildDeepCanalZone(DEFAULT_ZONE_SEED));
    expect(traceEncounter(defaultZone, rerun)).toEqual(traceEncounter(defaultZone, positions));
    expect(traceTrip(defaultZone, rerun)).toEqual(traceTrip(defaultZone, positions));
  }, 60_000);
});
