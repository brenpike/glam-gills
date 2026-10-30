/**
 * Hiding rules (PRD B6): which cover a position is under and which rarity a spot may hold.
 * Every rule derives from geometry; declared spot labels are only checked against it. Rarer
 * spots also sit nearer a threat: a predator route or a leg-costing hazard (the risk ladder, issue #70).
 * Legendaries are the rarest finds, more hidden and/or more dangerous to get: a Legendary spot is
 * deep and in the Legendary risk band, and is in a Dash pot or in an area with a measurable threat.
 */
import type { Rarity } from './catalogue';
import { shapeDistance, type HazardShape, type HazardSpawn } from './hazards';
import { movingHazardSweep, type MovingHazardSpawn } from './movingHazards';
import { routeLoopDistance, type PredatorRoute } from './predators';
import { RISK, TILAPIA, type RiskTuning, type TilapiaTuning } from './tuning';
import {
  SURF,
  type BankOverhang,
  type CaveArea,
  type CurrentZone,
  type HidingCover,
  type HidingSpot,
  type PadSpec,
  type Point,
  type ReedPatch,
  type TilapiaRoute,
  type ZoneLayout,
} from './zone';

/** A Common spot is at most this far from the main swim path; a Rare spot is farther. */
export const MAIN_PATH_REACH = 48;
/** How far below the surface a lily pad hides things. */
export const PAD_COVER_DEPTH = 30;
/** How far beyond a current's upstream edge the past-current band reaches. */
export const PAST_CURRENT_DEPTH = 140;

/** How far past a threat's strike range the Common band starts, in px. */
export const RISK_COMMON_MARGIN = 60;

/**
 * The zone geometry the hiding rules read. Absent predator routes, hazards or moving hazards mean
 * none; together with the tilapia routes they are the zone's threats. Absent `tilapia` means the
 * TILAPIA tuning; absent `bankOverhangs` means no bank cover.
 */
export type HidingGeometry = Pick<
  ZoneLayout,
  'reedPatches' | 'pads' | 'cave' | 'currents' | 'homeSpot' | 'mainPath' | 'tilapiaRoutes' | 'tilapia' | 'bankOverhangs'
> & {
  predatorRoutes?: readonly Readonly<PredatorRoute>[];
  hazards?: readonly Readonly<HazardSpawn>[];
  movingHazards?: readonly Readonly<MovingHazardSpawn>[];
};

/**
 * One thing a hiding spot's risk is measured against, with its strike range in px. A route threat is
 * a predator's patrol loop; `tilapia` marks a tilapia route, whose bands come from the risk tuning
 * unless `tuned` marks it as played with its area's own tuning, banded by riskBands(strike).
 * A shape threat is a leg-costing hazard, its strike range being the hazard's reach from the shape
 * edge, or a moving hazard, its shape being its sweep and its strike range its touch reach (ND-8).
 */
export type Threat =
  | { kind: 'route'; route: Readonly<TilapiaRoute>; strike: number; tilapia: boolean; tuned?: true }
  | { kind: 'shape'; shape: HazardShape; strike: number };

/** Whether a point is inside any reed patch rectangle (inclusive edges). */
export function inReeds(pos: Point, patches: readonly ReedPatch[]): boolean {
  return patches.some((patch) => pos.x >= patch.x0 && pos.x <= patch.x1 && pos.y >= patch.y0 && pos.y <= patch.y1);
}

/** Whether a point is under a lily pad: within its half-width and at most PAD_COVER_DEPTH below the surface. */
export function underPad(pos: Point, pads: readonly PadSpec[]): boolean {
  return pads.some((pad) => Math.abs(pos.x - pad.x) <= pad.rx && pos.y >= SURF && pos.y <= SURF + PAD_COVER_DEPTH);
}

/** Whether a point is inside the cave (inclusive edges). */
export function inCave(pos: Point, cave: CaveArea): boolean {
  return pos.x >= cave.x0 && pos.x <= cave.x1 && pos.y >= cave.y0 && pos.y <= cave.y1;
}

/**
 * A current's past band along x: from `edgeX`, the current's upstream edge (excluded), to `farX`,
 * PAST_CURRENT_DEPTH beyond it (included). It spans the current's y range.
 */
export interface PastCurrentBand {
  readonly edgeX: number;
  readonly farX: number;
}

/**
 * A current's past band, from its own flow: the PAST_CURRENT_DEPTH beyond the upstream edge, the
 * edge its flow comes from. Flow to the left (force.x < 0) gives (x1, x1 + PAST_CURRENT_DEPTH];
 * flow to the right gives [x0 - PAST_CURRENT_DEPTH, x0). No sideways flow gives null.
 */
export function pastCurrentBand(current: Pick<CurrentZone, 'x0' | 'x1' | 'force'>): PastCurrentBand | null {
  if (current.force.x < 0) return { edgeX: current.x1, farX: current.x1 + PAST_CURRENT_DEPTH };
  if (current.force.x > 0) return { edgeX: current.x0, farX: current.x0 - PAST_CURRENT_DEPTH };
  return null;
}

function isPastOneCurrent(pos: Point, current: CurrentZone): boolean {
  if (pos.y < current.y0 || pos.y > current.y1) {
    return false;
  }
  const band = pastCurrentBand(current);
  if (band === null) {
    return false;
  }
  if (band.farX > band.edgeX) {
    return pos.x > band.edgeX && pos.x <= band.farX;
  }
  return pos.x < band.edgeX && pos.x >= band.farX;
}

/**
 * Whether a point is in any current's past band (pastCurrentBand): within PAST_CURRENT_DEPTH
 * beyond the current's upstream edge (the edge itself excluded) and within the current's y range.
 * A current with no sideways flow has no past band.
 */
export function pastCurrent(pos: Point, currents: readonly CurrentZone[]): boolean {
  return currents.some((current) => isPastOneCurrent(pos, current));
}

/** Whether a point is under any overhanging bank rectangle (inclusive edges). */
export function underBank(pos: Point, overhangs: readonly Readonly<BankOverhang>[]): boolean {
  return overhangs.some((bank) => pos.x >= bank.x0 && pos.x <= bank.x1 && pos.y >= bank.y0 && pos.y <= bank.y1);
}

/** The cover geometry a sight hunter cannot see into. Absent parts mean no such cover. */
export type SightCoverGeometry = Partial<Pick<ZoneLayout, 'reedPatches' | 'pads' | 'cave'>>;

/**
 * Whether a point is hidden from a predator that hunts by sight: inside a reed patch, under a lily
 * pad or in the cave. Past a current is open water, so it is not sight cover.
 */
export function inSightCover(pos: Point, geo: SightCoverGeometry): boolean {
  return (
    inReeds(pos, geo.reedPatches ?? []) ||
    underPad(pos, geo.pads ?? []) ||
    (geo.cave !== undefined && inCave(pos, geo.cave))
  );
}

/** Every cover at a point, in the order reeds, pad, cave, pastCurrent, bank. */
export function coversAt(pos: Point, geo: HidingGeometry): HidingCover[] {
  const covers: HidingCover[] = [];
  if (inReeds(pos, geo.reedPatches)) covers.push('reeds');
  if (underPad(pos, geo.pads)) covers.push('pad');
  if (inCave(pos, geo.cave)) covers.push('cave');
  if (pastCurrent(pos, geo.currents)) covers.push('pastCurrent');
  if (underBank(pos, geo.bankOverhangs ?? [])) covers.push('bank');
  return covers;
}

function distanceToSegment(pos: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const along = lengthSq === 0 ? 0 : ((pos.x - a.x) * abx + (pos.y - a.y) * aby) / lengthSq;
  const clamped = Math.min(1, Math.max(0, along));
  return Math.hypot(pos.x - (a.x + clamped * abx), pos.y - (a.y + clamped * aby));
}

/** Minimum distance from a point to an open polyline; a single-point path gives the distance to it. */
export function distanceToPath(pos: Point, path: readonly Point[]): number {
  if (path.length === 0) {
    throw new Error('distanceToPath: path has no points');
  }
  if (path.length === 1) {
    return Math.hypot(pos.x - path[0].x, pos.y - path[0].y);
  }
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    best = Math.min(best, distanceToSegment(pos, path[i], path[i + 1]));
  }
  return best;
}

/** Whether a point is deep: in the cave or past a current. */
export function isDeep(pos: Point, geo: HidingGeometry): boolean {
  return inCave(pos, geo.cave) || pastCurrent(pos, geo.currents);
}

/**
 * Shortest distance from a point to any tilapia route. Each route is a closed loop, so the
 * segment from the last waypoint back to the first counts. A one-waypoint route gives the distance
 * to that point; a route with no waypoints is ignored. No waypoints at all gives Infinity.
 */
export function routeDistance(pos: Point, routes: readonly TilapiaRoute[]): number {
  let best = Infinity;
  for (const route of routes) {
    best = Math.min(best, routeLoopDistance(pos, route.waypoints));
  }
  return best;
}

/** Shortest distance from a point to any route waypoint, where a tilapia turns; Infinity with no waypoints. */
export function turnDistance(pos: Point, routes: readonly TilapiaRoute[]): number {
  let best = Infinity;
  for (const route of routes) {
    for (const point of route.waypoints) {
      best = Math.min(best, Math.hypot(pos.x - point.x, pos.y - point.y));
    }
  }
  return best;
}

/** Whether a point is within a lunge range of any tilapia route (inclusive). */
export function withinLungeRange(pos: Point, routes: readonly TilapiaRoute[], lungeRange: number = TILAPIA.lungeRange): boolean {
  return routeDistance(pos, routes) <= lungeRange;
}

/**
 * The risk ladder (issue #70): whether a point sits in its rarity's band of distance to the nearest
 * tilapia route and at least the turn clearance from every waypoint. Always true with no routes.
 */
export function meetsRiskRule(pos: Point, rarity: Rarity, routes: readonly TilapiaRoute[], risk: RiskTuning = RISK): boolean {
  const distance = routeDistance(pos, routes);
  if (distance === Infinity) {
    return true;
  }
  const band = risk.band[rarity];
  return distance > band.over && distance <= band.upTo && turnDistance(pos, routes) >= risk.turnClearance;
}

/**
 * Every threat in a zone: each tilapia route with the tilapia lunge range, each other predator route
 * with its species' lunge range, then each leg-costing hazard with its reach, then each moving
 * hazard by its sweep with its touch reach (ND-8). A geometry with its own tilapia tuning gives its
 * tilapia routes that tuning's lunge range, marked `tuned`; without one they get TILAPIA's.
 * Slow-only hazards, drifting nets included (N3), are not threats.
 */
export function zoneThreats(
  geo: Pick<HidingGeometry, 'tilapiaRoutes' | 'tilapia' | 'predatorRoutes' | 'hazards' | 'movingHazards'>,
): Threat[] {
  const threats: Threat[] = geo.tilapiaRoutes.map((route) => tilapiaThreat(route, geo.tilapia));
  for (const route of geo.predatorRoutes ?? []) {
    threats.push({ kind: 'route', route, strike: route.species.tuning.lungeRange, tilapia: false });
  }
  for (const hazard of geo.hazards ?? []) {
    if (hazard.type.costsLeg) threats.push({ kind: 'shape', shape: hazard.shape, strike: hazard.type.reach });
  }
  for (const spawn of geo.movingHazards ?? []) {
    threats.push({ kind: 'shape', shape: movingHazardSweep(spawn), strike: spawn.type.touchReach });
  }
  return threats;
}

/** One tilapia route threat: with `tuning`, its lunge range and the `tuned` mark; else TILAPIA's lunge range. */
function tilapiaThreat(route: Readonly<TilapiaRoute>, tuning: Readonly<TilapiaTuning> | undefined): Threat {
  if (tuning) return { kind: 'route', route, strike: tuning.lungeRange, tilapia: true, tuned: true };
  return { kind: 'route', route, strike: TILAPIA.lungeRange, tilapia: true };
}

/**
 * The risk bands for a threat with this strike range, in the shape of RISK.band: Common over
 * strike + RISK_COMMON_MARGIN, Rare over strike and up to strike + RISK_COMMON_MARGIN, Epic over
 * half the strike and up to the strike, Legendary up to half the strike.
 */
export function riskBands(strike: number): RiskTuning['band'] {
  return {
    common: { over: strike + RISK_COMMON_MARGIN, upTo: Infinity },
    rare: { over: strike, upTo: strike + RISK_COMMON_MARGIN },
    epic: { over: strike / 2, upTo: strike },
    legendary: { over: -Infinity, upTo: strike / 2 },
  };
}

/**
 * Distance from a point to one threat: to its closed patrol loop, or to its shape edge (0 inside).
 * A route is measured with routeLoopDistance. A predator warns from where it is on its route, so
 * every point it can warn at is within its strike of the route. The chase is ignored (PRD open
 * question 252, ND-5): a chaser's strike stays its lungeRange from its patrol loop. Its chase widens
 * where it can warn by the same leash for every spot near it, so the ladder's order holds. The
 * other option is S = lungeRange + leash, which leaves almost no Common spots in a full-bar area.
 * No cover (reeds, pad, cave) shortens or blocks the distance: a covered spot still counts as near
 * a sight hunter such as the heron, because getting in and out of it crosses the hunter's reach.
 */
function threatDistance(pos: Point, threat: Threat): number {
  return threat.kind === 'route' ? routeLoopDistance(pos, threat.route.waypoints) : shapeDistance(pos, threat.shape);
}

/** Shortest distance from a point to any threat; Infinity with no threats or no measurable threat. */
export function riskDistance(pos: Point, threats: readonly Threat[]): number {
  let best = Infinity;
  for (const threat of threats) {
    best = Math.min(best, threatDistance(pos, threat));
  }
  return best;
}

/**
 * The risk ladder over every threat: whether a point's riskiest band equals the rarity, and the
 * point keeps the turn clearance from every predator route waypoint. Each threat puts the point in a
 * band of its own: a tilapia route by `risk.band`, a `tuned` tilapia route or any other threat by
 * riskBands(strike). The riskiest band any threat gives is the point's band, so a spot inside a
 * tilapia's lunge range never ranks Rare because a weaker threat with a shorter strike is nearer.
 * With bands ordered nearer for rarer, the point is in the rarity's band for some threat and
 * farther than its lower edge from every threat. With one shared strike range this equals the band of the shortest distance, as in
 * meetsRiskRule. A threat with no waypoints is ignored; always true with no threats left.
 */
export function meetsThreatRiskRule(pos: Point, rarity: Rarity, threats: readonly Threat[], risk: RiskTuning = RISK): boolean {
  let inBand = false;
  let measured = false;
  for (const threat of threats) {
    const distance = threatDistance(pos, threat);
    if (distance === Infinity) continue;
    measured = true;
    const shared = threat.kind === 'route' && threat.tilapia && !threat.tuned;
    const band = shared ? risk.band[rarity] : riskBands(threat.strike)[rarity];
    if (distance <= band.over) return false;
    if (distance <= band.upTo) inBand = true;
  }
  return !measured || (inBand && threatTurnDistance(pos, threats) >= risk.turnClearance);
}

/** Shortest distance from a point to any waypoint of a route threat; Infinity with none. */
function threatTurnDistance(pos: Point, threats: readonly Threat[]): number {
  const routes = threats.flatMap((threat) => (threat.kind === 'route' ? [threat.route] : []));
  return turnDistance(pos, routes);
}

/**
 * Whether a spot's geometry suits a rarity; ignores any declared labels. Common: hidden, shallow,
 * no container, near the main path. Rare: the same but away from the path. Epic: deep, no
 * container. Legendary: deep, and in a container (a Dash pot) or measurably near some threat
 * (riskDistance not Infinity), so a Legendary with no pot only sits in an area with a threat.
 * Containers are reserved for Legendary. Every rarity must also meet the risk ladder for every
 * threat in the geometry (zoneThreats).
 */
export function meetsRarity(
  spot: Pick<HidingSpot, 'x' | 'y' | 'container'>,
  rarity: Rarity,
  geo: HidingGeometry,
  risk: RiskTuning = RISK,
): boolean {
  const threats = zoneThreats(geo);
  return meetsHidingRule(spot, rarity, geo, threats) && meetsThreatRiskRule(spot, rarity, threats, risk);
}

function meetsHidingRule(
  spot: Pick<HidingSpot, 'x' | 'y' | 'container'>,
  rarity: Rarity,
  geo: HidingGeometry,
  threats: readonly Threat[],
): boolean {
  const hidden = coversAt(spot, geo).length > 0;
  const deep = isDeep(spot, geo);
  switch (rarity) {
    case 'common':
      return hidden && !deep && !spot.container && distanceToPath(spot, geo.mainPath) <= MAIN_PATH_REACH;
    case 'rare':
      return hidden && !deep && !spot.container && distanceToPath(spot, geo.mainPath) > MAIN_PATH_REACH;
    case 'epic':
      return deep && !spot.container;
    case 'legendary':
      return deep && (spot.container || riskDistance(spot, threats) !== Infinity);
  }
}

/** Whether a spot's declared cover and rarity labels both hold for its geometry, risk ladder included. */
export function spotMatchesLabels(spot: Omit<HidingSpot, 'id'>, geo: HidingGeometry, risk: RiskTuning = RISK): boolean {
  return coversAt(spot, geo).includes(spot.cover) && meetsRarity(spot, spot.rarity, geo, risk);
}
