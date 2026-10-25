/**
 * Golden guard for the chinampa gardens, Area 5 ('chinampa-2'): its built zone, its trip
 * placements, and the encounter and trip rules, its tilapia tuning, chasing tilapia, garter snakes
 * and common carp, punting poles, mobile snacks, water hyacinth mats, gap current and ghost nets
 * included, played along a fixed scripted swim that parks by every tilapia, snake and carp (issue
 * #118, ND-13; issue #135, ND-8). Any change here means a shared rule changed chinampa-2 behaviour.
 */
import { describe, expect, it } from 'vitest';
import { CHINAMPA_2_TREASURES } from './catalogue';
import { CHINAMPA_2_LAYOUT } from './chinampa2Layout';
import { createEncounter, createEncounterContext, stepEncounter, type EncounterState } from './encounter';
import { isSnagged } from './ghostNets';
import { hazardCentre, shapeDistance } from './hazards';
import { matPhase } from './hyacinthMats';
import { movingHazardSweep } from './movingHazards';
import { legSwimTuning } from './legs';
import { createTrip, createTripContext, newTrip, stepTrip, type TripEvent, type TripState } from './trip';
import { LEGS } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds, type Point, type ZoneLayout } from './zone';

const EXTRA_ZONE_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const TRIP_SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);
const BANKED_IDS = CHINAMPA_2_TREASURES.slice(0, 3).map((treasure) => treasure.id);
const RETURNED_IDS = CHINAMPA_2_TREASURES.slice(3, 5).map((treasure) => treasure.id);
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const FRAMES_PER_SECOND = 60;
const DT = 1 / FRAMES_PER_SECOND;
const PARK_SECONDS = 20;
const TRACE_SECONDS = 360;
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

function buildChinampa2Zone(zoneSeed: number): ZoneLayout {
  return buildZone(CHINAMPA_2_LAYOUT, zoneSeed);
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
 * Mean of a route's waypoints: a tilapia or carp loop's centre, inside its lunge range wherever it
 * is on the loop, or the middle of a garter snake's two-waypoint stretch.
 */
function routeCentre(route: { waypoints: readonly Point[] }): Point {
  const count = route.waypoints.length;
  const sumX = route.waypoints.reduce((total, point) => total + point.x, 0);
  const sumY = route.waypoints.reduce((total, point) => total + point.y, 0);
  return { x: sumX / count, y: sumY / count };
}

/**
 * Every place the scripted swim parks, west to east from the main path's end: each snake stretch's
 * middle, each carp loop's centre and each tilapia route's centre (issue #135, ND-8).
 */
function listParkSpots(zone: ZoneLayout): Point[] {
  return [...zone.predatorRoutes, ...zone.tilapiaRoutes].map(routeCentre).sort((first, second) => first.x - second.x);
}

/**
 * The scripted swim's stops: the main path, each parked spot of listParkSpots, then through each
 * ghost net centre, last net first.
 */
function listScriptStops(zone: ZoneLayout): ScriptStop[] {
  return [
    ...zone.mainPath.slice(1).map((at): ScriptStop => ({ at, park: false })),
    ...listParkSpots(zone).map((at): ScriptStop => ({ at, park: true })),
    ...[...zone.hazards].reverse().map((hazard): ScriptStop => ({ at: hazardCentre(hazard.shape), park: false })),
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

function describeMats(state: TripState): string {
  return state.elements.map((element) => `${element.id}/${matPhase(element, state.elementTime)}`).join(' ');
}

function describeTrip(state: TripState): string {
  return `${state.phase} legsLost=${state.legsLost} snagged=${isSnagged(state.ghostNets)} met=${state.met.join('+')} mats=${describeMats(state)}`;
}

function listSnagLines(frame: number, events: readonly TripEvent[]): string[] {
  return events.flatMap((event) => (event.type === 'snagged' ? [`${frame}: snagged ${event.id}`] : []));
}

/**
 * The trip's phase, legsLost, snag, met and mat phases once per second, and each new snag by
 * frame; an ended trip starts the next with `newTrip`.
 */
function traceTrip(zone: ZoneLayout, positions: readonly Point[]): string[] {
  const ctx = createTripContext({ encounter: createEncounterContext({ bounds: swimBounds(zone) }) });
  const lines: string[] = [];
  let state = createTrip(zone);
  positions.forEach((pos, index) => {
    const frame = index + 1;
    const result = stepTrip(state, { axolotlPos: pos, reduced: false, dashing: false }, DT, ctx);
    lines.push(...listSnagLines(frame, result.events));
    state = result.state;
    if (state.phase === 'ended') {
      lines.push(`${frame}: ended, new trip`);
      state = newTrip(state);
    }
    if (frame % FRAMES_PER_SECOND === 0) lines.push(`${frame / FRAMES_PER_SECOND}s ${describeTrip(state)}`);
  });
  return lines;
}

describe('chinampa-2 golden', () => {
  const defaultZone = buildChinampa2Zone(DEFAULT_ZONE_SEED);
  const positions = listScriptedPositions(defaultZone);

  it('keeps the default zone projection', () => {
    expect(pickGoldenProjection(defaultZone)).toMatchSnapshot();
  });

  it('keeps the projection of every extra zone seed', () => {
    const summaries = Object.fromEntries(
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizeProjection(buildChinampa2Zone(zoneSeed))]),
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
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizePlacements(buildChinampa2Zone(zoneSeed))]),
    );
    expect(summaries).toMatchSnapshot();
  });

  it('scripts a swim of at least 120 s that reaches every stop', () => {
    expect(positions.length / FRAMES_PER_SECOND).toBeGreaterThanOrEqual(MIN_TRACE_SECONDS);
    for (const stop of listScriptStops(defaultZone)) {
      expect(positions.some((pos) => Math.hypot(pos.x - stop.at.x, pos.y - stop.at.y) < STOP_TOLERANCE)).toBe(true);
    }
  });

  it('scripts a swim that parks at every tilapia route centre, snake stretch middle and carp loop centre', () => {
    expect(defaultZone.tilapiaRoutes).toHaveLength(3);
    expect(defaultZone.predatorRoutes.map((route) => route.species.id)).toEqual([
      'garter-snake',
      'garter-snake',
      'garter-snake',
      'carp',
      'carp',
      'carp',
      'carp',
      'carp',
    ]);
    const parkSpots = [...defaultZone.tilapiaRoutes, ...defaultZone.predatorRoutes].map(routeCentre);
    for (const at of parkSpots) expect(countFramesAt(positions, at)).toBeGreaterThanOrEqual(PARK_FRAMES);
  });

  it('scripts a swim that runs through the gap current and through every ghost net', () => {
    const current = defaultZone.currents[0];
    const inCurrent = positions.some(
      (pos) => pos.x >= current.x0 && pos.x <= current.x1 && pos.y >= current.y0 && pos.y <= current.y1,
    );
    expect(inCurrent).toBe(true);
    expect(defaultZone.hazards).toHaveLength(5);
    for (const hazard of defaultZone.hazards) {
      expect(positions.some((pos) => shapeDistance(pos, hazard.shape) === 0)).toBe(true);
    }
  });

  it("scripts a swim that runs through every punting pole's sweep", () => {
    const spawns = defaultZone.movingHazards ?? [];
    expect(spawns).toHaveLength(5);
    for (const spawn of spawns) {
      expect(positions.some((pos) => shapeDistance(pos, movingHazardSweep(spawn)) === 0)).toBe(true);
    }
  });

  it('keeps the encounter trace along the scripted swim', () => {
    const lines = traceEncounter(defaultZone, positions);
    expect({ events: countEventTypes(lines), ...summarizeText(lines.join('\n')) }).toMatchSnapshot();
  });

  it('keeps the trip trace of met, snags, legsLost, mat phases and phase along the scripted swim', () => {
    expect(traceTrip(defaultZone, positions)).toMatchSnapshot();
  });

  it('is deterministic across repeated builds and runs', () => {
    expect(summarizeProjection(buildChinampa2Zone(DEFAULT_ZONE_SEED))).toEqual(summarizeProjection(defaultZone));
    const rerun = listScriptedPositions(buildChinampa2Zone(DEFAULT_ZONE_SEED));
    expect(traceEncounter(defaultZone, rerun)).toEqual(traceEncounter(defaultZone, positions));
    expect(traceTrip(defaultZone, rerun)).toEqual(traceTrip(defaultZone, positions));
  }, 60_000);
});
