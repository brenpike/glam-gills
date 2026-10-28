/**
 * The level layout gap measure (the level layout ladder): the clear gaps a zone leaves between its
 * obstacles, and the narrowest one its main path swims through. Layout tests use it to keep every
 * hazard gap at least the safe passing width and to rank areas by their tightest passage.
 */
import { GHOST_NET } from './ghostNets';
import { hazardSweep, type HazardShape } from './hazards';
import { zoneThreats } from './hiding';
import { movingHazardSweep, type MovingHazardSpawn } from './movingHazards';
import { PERK_CAPS } from './perks';
import { GHOST_NETS, SWIM } from './tuning';
import type { Point, ZoneLayout } from './zone';

/** Spacing in px of the points sampled along a loop or a rect outline. */
const SAMPLE_STEP = 1;

/**
 * The zone geometry the gap measure reads: its hazards, its predator routes with their tuning and
 * its moving hazards (ND-8). Absent moving hazards mean none.
 */
type GapGeometry = Pick<ZoneLayout, 'hazards' | 'tilapiaRoutes' | 'tilapia' | 'predatorRoutes'> & {
  movingHazards?: readonly Readonly<MovingHazardSpawn>[];
};

/**
 * The safe passing width: the least clear width of a gap, between the places the body centre must
 * stay out of. One body height (twice the net reach, the body's half height) of room, so the
 * axolotl may stray half a body either way off the middle of a gap and still pass clear.
 */
export const SAFE_PASSING_WIDTH = 2 * GHOST_NET.reach;

/**
 * Least px from a ghost net to every current: the farthest a snagged axolotl at the speed perk cap
 * swims before snag time ends, plus the net's reach, from the rect edge to the body centre, where a
 * snag starts. A snagged one-leg axolotl cannot beat the current, so it is never snagged inside it.
 */
export const NET_CURRENT_CLEARANCE =
  GHOST_NETS.snagTime * SWIM.maxSpeed * (1 + PERK_CAPS.speed / 100) * GHOST_NETS.speedFactor + GHOST_NET.reach;

/**
 * One obstacle of the gap measure: a hazard shape, kept out of by its touch reach from the shape
 * edge, or a predator route, kept out of by its strike range from the loop (zoneThreats). Both
 * measure to the axolotl's body centre, except a plastic worm, which measures to the head.
 */
export type Obstacle =
  | { id: string; kind: 'shape'; shape: HazardShape; keepOut: number }
  | { id: string; kind: 'route'; waypoints: readonly Point[]; keepOut: number };

/** An extra shape obstacle a zone's hazards do not list, such as a mat: its shape and keep-out. */
export type ExtraObstacle = Omit<Extract<Obstacle, { kind: 'shape' }>, 'kind'>;

/** One gap: the clear stretch between two obstacles' keep-out edges, along the shortest line between them. */
export interface Gap {
  between: string;
  width: number;
  from: Point;
  to: Point;
  /** Whether a hazard is on one side: a gap between two routes is a timing passage, not a hazard gap. */
  hazard: boolean;
}

/**
 * Every obstacle of a zone: each hazard by its reach from its whole drift path (hazardSweep, N3),
 * but a pulsing current, which is swum through, not round (issue #105, ND-6),
 * then each moving hazard sweep by its touch reach (ND-8), then each extra shape by its keep-out,
 * then each predator route by its strike range (zoneThreats). No extras gives the zone's own obstacles.
 */
export function obstaclesOf(layout: GapGeometry, extras: readonly ExtraObstacle[] = []): Obstacle[] {
  const hazards = layout.hazards
    .filter((hazard) => hazard.pulse === undefined)
    .map((hazard): Obstacle => ({ id: hazard.id, kind: 'shape', shape: hazardSweep(hazard), keepOut: hazard.type.reach }));
  const moving = (layout.movingHazards ?? []).map(
    (spawn): Obstacle => ({ id: spawn.id, kind: 'shape', shape: movingHazardSweep(spawn), keepOut: spawn.type.touchReach }),
  );
  const shapes = extras.map((extra): Obstacle => ({ id: extra.id, kind: 'shape', shape: extra.shape, keepOut: extra.keepOut }));
  const routes = zoneThreats(layout).flatMap((threat): Obstacle[] =>
    threat.kind === 'route' ? [{ id: threat.route.id, kind: 'route', waypoints: threat.route.waypoints, keepOut: threat.strike }] : [],
  );
  return [...hazards, ...moving, ...shapes, ...routes];
}

/** Every gap between two obstacles of a zone, with any extra shape obstacles. */
export function gapsOf(layout: GapGeometry, extras: readonly ExtraObstacle[] = []): Gap[] {
  const obstacles = obstaclesOf(layout, extras);
  return obstacles.flatMap((first, i) => obstacles.slice(i + 1).map((second) => gapBetween(first, second)));
}

/** Whether the main path swims through a gap's clear stretch. */
export function onMainPath(gap: Gap, path: readonly Point[]): boolean {
  return path.slice(1).some((point, i) => segmentsMeet(gap.from, gap.to, path[i], point));
}

/**
 * The narrowest open hazard gap the main path swims through: beside a hazard and wider than 0, so
 * its keep-outs leave room. Throws when the main path swims through no such gap.
 */
export function narrowestPathGap(layout: GapGeometry & Pick<ZoneLayout, 'areaId' | 'mainPath'>, extras: readonly ExtraObstacle[] = []): Gap {
  const open = gapsOf(layout, extras).filter((gap) => gap.hazard && gap.width > 0 && onMainPath(gap, layout.mainPath));
  if (open.length === 0) throw new Error(`narrowestPathGap: the main path of ${layout.areaId} swims through no gap`);
  return open.reduce((narrowest, gap) => (gap.width < narrowest.width ? gap : narrowest));
}

/** Points along a closed loop, every SAMPLE_STEP px. */
export function loopSamples(waypoints: readonly Point[]): Point[] {
  return loopSegments(waypoints).flatMap(([a, b]) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE_STEP));
    return Array.from({ length: steps }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }));
  });
}

function loopSegments(waypoints: readonly Point[]): [Point, Point][] {
  return waypoints.map((point, i): [Point, Point] => [point, waypoints[(i + 1) % waypoints.length]]);
}

function closestOnSegment(point: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const along = lengthSq === 0 ? 0 : ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq;
  const clamped = Math.min(1, Math.max(0, along));
  return { x: a.x + clamped * abx, y: a.y + clamped * aby };
}

/** The point of a hazard shape nearest to `point`. */
function closestOnShape(point: Point, shape: HazardShape): Point {
  if (shape.kind === 'rect') {
    return { x: Math.min(shape.x1, Math.max(shape.x0, point.x)), y: Math.min(shape.y1, Math.max(shape.y0, point.y)) };
  }
  const away = Math.hypot(point.x - shape.x, point.y - shape.y);
  if (away <= shape.r) return { x: point.x, y: point.y };
  return { x: shape.x + ((point.x - shape.x) * shape.r) / away, y: shape.y + ((point.y - shape.y) * shape.r) / away };
}

function closestOnLoop(point: Point, waypoints: readonly Point[]): Point {
  let best = waypoints[0];
  let bestDistance = Infinity;
  for (const [a, b] of loopSegments(waypoints)) {
    const candidate = closestOnSegment(point, a, b);
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance < bestDistance) [best, bestDistance] = [candidate, distance];
  }
  return best;
}

function closestOn(point: Point, obstacle: Obstacle): Point {
  return obstacle.kind === 'shape' ? closestOnShape(point, obstacle.shape) : closestOnLoop(point, obstacle.waypoints);
}

/**
 * Points to try as the near end on an obstacle: for a rect facing another rect, the one point facing
 * it; for any other rect, its outline samples; a circle's centre; a loop's samples.
 */
function nearEndCandidates(obstacle: Obstacle, other: Obstacle): Point[] {
  if (obstacle.kind === 'route') return loopSamples(obstacle.waypoints);
  if (obstacle.shape.kind === 'circle') return [{ x: obstacle.shape.x, y: obstacle.shape.y }];
  if (other.kind === 'shape' && other.shape.kind === 'rect') return [rectFacingPoint(obstacle.shape, other.shape)];
  const { x0, x1, y0, y1 } = obstacle.shape;
  return loopSamples([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]);
}

/** The point of `rect` facing `other`: on each axis the middle of their overlap, else the nearer edge. */
function rectFacingPoint(rect: HazardShape & { kind: 'rect' }, other: HazardShape & { kind: 'rect' }): Point {
  return { x: facingCoordinate(rect.x0, rect.x1, other.x0, other.x1), y: facingCoordinate(rect.y0, rect.y1, other.y0, other.y1) };
}

function facingCoordinate(low: number, high: number, otherLow: number, otherHigh: number): number {
  if (otherHigh < low) return low;
  if (otherLow > high) return high;
  return (Math.max(low, otherLow) + Math.min(high, otherHigh)) / 2;
}

/** The gap between two obstacles: the shortest line between them, less each keep-out at its end. */
function gapBetween(first: Obstacle, second: Obstacle): Gap {
  let best = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, distance: Infinity };
  for (const from of nearEndCandidates(first, second)) {
    const to = closestOn(from, second);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance < best.distance) best = { from, to, distance };
  }
  const share = (keepOut: number) => (best.distance === 0 ? 0 : keepOut / best.distance);
  const along = (point: Point, toward: Point, part: number): Point => ({ x: point.x + (toward.x - point.x) * part, y: point.y + (toward.y - point.y) * part });
  return {
    between: `${first.id} and ${second.id}`,
    width: best.distance - first.keepOut - second.keepOut,
    from: along(best.from, best.to, share(first.keepOut)),
    to: along(best.to, best.from, share(second.keepOut)),
    hazard: first.kind === 'shape' || second.kind === 'shape',
  };
}

function cross(origin: Point, a: Point, b: Point): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function segmentsMeet(a: Point, b: Point, c: Point, d: Point): boolean {
  const [d1, d2, d3, d4] = [cross(c, d, a), cross(c, d, b), cross(a, b, c), cross(a, b, d)];
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
