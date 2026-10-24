/**
 * Golden guard for the chinampa gardens, Area 4 ('chinampa-1'): its built zone, its trip placements,
 * and the encounter and trip rules, its tilapia tuning, carp, bank cover, gap current, drifting
 * ghost nets, punting poles and mobile snacks included, played along a fixed scripted swim. Any
 * change here means a shared rule changed chinampa-1 behaviour.
 */
import { describe, expect, it } from 'vitest';
import { CHINAMPA_TREASURES } from './catalogue';
import { CHINAMPA_LAYOUT } from './chinampaLayout';
import { createEncounter, createEncounterContext, stepEncounter, type EncounterState } from './encounter';
import { isSnagged } from './ghostNets';
import { hazardCentre } from './hazards';
import { legSwimTuning } from './legs';
import { movingHazardDepth, movingHazardSweep } from './movingHazards';
import { createTrip, createTripContext, newTrip, stepTrip, type TripEvent, type TripState } from './trip';
import { DRIFTING_NETS, LEGS } from './tuning';
import {
  DEFAULT_ZONE_SEED,
  SURF,
  buildZone,
  swimBounds,
  type BankOverhang,
  type Point,
  type TilapiaRoute,
  type ZoneLayout,
} from './zone';

const EXTRA_ZONE_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const TRIP_SEEDS = Array.from({ length: 25 }, (_, index) => index + 1);
const BANKED_IDS = CHINAMPA_TREASURES.slice(0, 3).map((treasure) => treasure.id);
const RETURNED_IDS = CHINAMPA_TREASURES.slice(3, 5).map((treasure) => treasure.id);
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const FRAMES_PER_SECOND = 60;
const DT = 1 / FRAMES_PER_SECOND;
const PARK_SECONDS = 20;
const TRACE_SECONDS = 300;
const MIN_TRACE_SECONDS = 120;
const TRACE_FRAMES = TRACE_SECONDS * FRAMES_PER_SECOND;
const PARK_FRAMES = PARK_SECONDS * FRAMES_PER_SECOND;
const EVENT_DECIMALS = 100;

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

function buildChinampaZone(zoneSeed: number): ZoneLayout {
  return buildZone(CHINAMPA_LAYOUT, zoneSeed);
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

/** Mean of a route's waypoints: inside the tilapia's lunge range wherever it is on its loop. */
function routeCentre(route: TilapiaRoute): Point {
  const count = route.waypoints.length;
  const sumX = route.waypoints.reduce((total, point) => total + point.x, 0);
  const sumY = route.waypoints.reduce((total, point) => total + point.y, 0);
  return { x: sumX / count, y: sumY / count };
}

/** Centre of an overhanging bank rectangle: under the bank, in its cover. */
function overhangCentre(overhang: BankOverhang): Point {
  return { x: (overhang.x0 + overhang.x1) / 2, y: (overhang.y0 + overhang.y1) / 2 };
}

/** The last overhanging bank, the one in the top right beside `tilapia-1`. Throws when there is none. */
function lastOverhang(zone: ZoneLayout): BankOverhang {
  const overhangs = zone.bankOverhangs ?? [];
  if (overhangs.length === 0) throw new Error('lastOverhang: the zone has no bank overhangs');
  return overhangs[overhangs.length - 1];
}

/** True when `pos` is inside the rect or on its edge. */
function isInRect(pos: Point, rect: { x0: number; x1: number; y0: number; y1: number }): boolean {
  return pos.x >= rect.x0 && pos.x <= rect.x1 && pos.y >= rect.y0 && pos.y <= rect.y1;
}

/** Axolotl centre after each frame of a cruise along the whole main path from its first point. */
function listMainPathPositions(zone: ZoneLayout): Point[] {
  const positions: Point[] = [{ ...zone.mainPath[0] }];
  for (const at of zone.mainPath.slice(1)) positions.push(...swimPositions(positions[positions.length - 1], at));
  return positions;
}

/** The tip at full depth of each punting pole whose sweep the main path never enters. */
function listUncrossedPoleTips(zone: ZoneLayout): Point[] {
  const pathPositions = listMainPathPositions(zone);
  return (zone.movingHazards ?? [])
    .filter((spawn) => !pathPositions.some((pos) => isInRect(pos, movingHazardSweep(spawn))))
    .map((spawn) => ({ x: spawn.x, y: SURF + movingHazardDepth(spawn) }));
}

/**
 * The scripted swim's stops: the main path, the tip of each pole the main path does not cross,
 * each tilapia's route centre (parked), each predator's route centre (parked), under the last
 * bank (parked), then through each ghost net's starting centre, right to left, parked at each
 * drifting one: PARK_SECONDS is longer than DRIFTING_NETS.period, so the net drifts back over it.
 */
function listScriptStops(zone: ZoneLayout): ScriptStop[] {
  return [
    ...zone.mainPath.slice(1).map((at): ScriptStop => ({ at, park: false })),
    ...listUncrossedPoleTips(zone).map((at): ScriptStop => ({ at, park: false })),
    ...zone.tilapiaRoutes.map((route): ScriptStop => ({ at: routeCentre(route), park: true })),
    ...zone.predatorRoutes.map((route): ScriptStop => ({ at: routeCentre(route), park: true })),
    { at: overhangCentre(lastOverhang(zone)), park: true },
    ...[...zone.hazards]
      .reverse()
      .map((hazard): ScriptStop => ({ at: hazardCentre(hazard.shape), park: hazard.drift !== undefined })),
  ];
}

/**
 * The scripted swim, one axolotl centre per frame at four-leg cruise along listScriptStops, parked
 * PARK_SECONDS at each parked stop, then parked at the last stop until TRACE_SECONDS. Throws when
 * the stops take longer than TRACE_SECONDS, so no stop is ever cut off.
 */
function listScriptedPositions(zone: ZoneLayout): Point[] {
  const positions: Point[] = [{ ...zone.mainPath[0] }];
  for (const stop of listScriptStops(zone)) {
    positions.push(...swimPositions(positions[positions.length - 1], stop.at));
    if (stop.park) positions.push(...Array.from({ length: PARK_FRAMES }, () => ({ ...stop.at })));
  }
  if (positions.length > TRACE_FRAMES) {
    throw new RangeError(`listScriptedPositions: the stops take ${positions.length / FRAMES_PER_SECOND} s, over TRACE_SECONDS`);
  }
  const last = positions[positions.length - 1];
  while (positions.length < TRACE_FRAMES) positions.push({ ...last });
  return positions;
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

function describeTrip(state: TripState): string {
  return `${state.phase} legsLost=${state.legsLost} snagged=${isSnagged(state.ghostNets)} met=${state.met.join('+')}`;
}

/**
 * The id of every ghost net whose reach held the axolotl on some frame of the trip along
 * `positions`: each net where it is at the trip's element time, as the trip itself checks it, so
 * a drifting net counts only where it has drifted to. An ended trip starts the next with `newTrip`.
 */
function listNetsTouched(zone: ZoneLayout, positions: readonly Point[]): Set<string> {
  const ctx = createTripContext({ encounter: createEncounterContext({ bounds: swimBounds(zone) }) });
  const touched = new Set<string>();
  let state = createTrip(zone);
  for (const pos of positions) {
    state = stepTrip(state, { axolotlPos: pos, reduced: false, dashing: false }, DT, ctx).state;
    for (const id of state.ghostNets.inReach) touched.add(id);
    if (state.phase === 'ended') state = newTrip(state);
  }
  return touched;
}

function listSnagLines(frame: number, events: readonly TripEvent[]): string[] {
  return events.flatMap((event) => (event.type === 'snagged' ? [`${frame}: snagged ${event.id}`] : []));
}

/**
 * The trip's phase, legsLost, snag and met once per second, and each new snag by frame; an ended
 * trip starts the next with `newTrip`.
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

describe('chinampa-1 golden', () => {
  const defaultZone = buildChinampaZone(DEFAULT_ZONE_SEED);
  const positions = listScriptedPositions(defaultZone);

  it('keeps the default zone projection', () => {
    expect(pickGoldenProjection(defaultZone)).toMatchSnapshot();
  });

  it('keeps the projection of every extra zone seed', () => {
    const summaries = Object.fromEntries(
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizeProjection(buildChinampaZone(zoneSeed))]),
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
      EXTRA_ZONE_SEEDS.map((zoneSeed) => [String(zoneSeed), summarizePlacements(buildChinampaZone(zoneSeed))]),
    );
    expect(summaries).toMatchSnapshot();
  });

  it('scripts a swim of at least 120 s that parks by every tilapia, the carp and under the last bank', () => {
    expect(positions.length / FRAMES_PER_SECOND).toBeGreaterThanOrEqual(MIN_TRACE_SECONDS);
    expect(defaultZone.tilapiaRoutes).toHaveLength(6);
    expect(defaultZone.predatorRoutes.map((route) => route.species.id)).toEqual(['carp']);
    const parkedFrames = [
      ...defaultZone.tilapiaRoutes.map(routeCentre),
      ...defaultZone.predatorRoutes.map(routeCentre),
      overhangCentre(lastOverhang(defaultZone)),
    ].map((at) => countFramesAt(positions, at));
    for (const frames of parkedFrames) expect(frames).toBeGreaterThanOrEqual(PARK_FRAMES);
  });

  it('scripts a swim that runs through the gap current and touches every ghost net where it has drifted to', () => {
    expect(positions.some((pos) => isInRect(pos, defaultZone.currents[0]))).toBe(true);
    expect(defaultZone.hazards).toHaveLength(5);
    expect(defaultZone.hazards.filter((hazard) => hazard.drift).map((hazard) => hazard.id)).toEqual([
      'chinampa-1/ghost-net-1',
      'chinampa-1/ghost-net-2',
    ]);
    expect(PARK_SECONDS).toBeGreaterThan(DRIFTING_NETS.period);
    const touched = listNetsTouched(defaultZone, positions);
    for (const hazard of defaultZone.hazards) expect(touched.has(hazard.id), hazard.id).toBe(true);
  });

  it('scripts a swim that enters every punting pole sweep', () => {
    const poles = defaultZone.movingHazards ?? [];
    expect(poles.map((spawn) => spawn.type.id)).toEqual(['punting-pole', 'punting-pole']);
    for (const spawn of poles) {
      expect(positions.some((pos) => isInRect(pos, movingHazardSweep(spawn)))).toBe(true);
    }
  });

  it('keeps the encounter trace along the scripted swim', () => {
    const lines = traceEncounter(defaultZone, positions);
    expect({ events: countEventTypes(lines), ...summarizeText(lines.join('\n')) }).toMatchSnapshot();
  });

  it('keeps the trip trace of met, snags, legsLost and phase along the scripted swim', () => {
    expect(traceTrip(defaultZone, positions)).toMatchSnapshot();
  });

  it('is deterministic across repeated builds and runs', () => {
    expect(summarizeProjection(buildChinampaZone(DEFAULT_ZONE_SEED))).toEqual(summarizeProjection(defaultZone));
    const rerun = listScriptedPositions(buildChinampaZone(DEFAULT_ZONE_SEED));
    expect(traceEncounter(defaultZone, rerun)).toEqual(traceEncounter(defaultZone, positions));
    expect(traceTrip(defaultZone, rerun)).toEqual(traceTrip(defaultZone, positions));
  });
});
