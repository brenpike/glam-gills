/**
 * The danger bar and the ramp bar (PRD N2, PRD open question 259, ND-12) are the whole-water bars
 * (issue #130): an area's moving threats, their kinds, and the longest quiet swim in its water.
 * Only this measure counts a chaser's leash (PRD open question 252, ND-5). `longestQuietStretch`,
 * the longest stretch of the main path with none in reach, stays as a measure (issue #136, ND-3).
 */
import { shapeDistance, type HazardShape } from './hazards';
import { movingHazardSweep } from './movingHazards';
import { CARP_SPECIES, TILAPIA_SPECIES, routeLoopDistance, type PredatorRules } from './predators';
import { TILAPIA, type TilapiaTuning } from './tuning';
import { SCREEN_W, WORLD_H, inSafeArea, swimBounds, type Point, type SafeArea, type TilapiaRoute, type ZoneLayout } from './zone';

/** Spacing in px of the points sampled along the main path. */
const SAMPLE_STEP = 1;

/** Moving threats the full bar asks for per screen, rounded up over the whole area. */
const THREATS_PER_SCREEN = 0.75;

/** Fewest predator species the full bar asks for. */
const MIN_PREDATOR_TYPES = 2;

/** Fewest moving hazard types the full bar asks for. */
const MIN_MOVING_HAZARD_TYPES = 1;

/** Longest quiet stretch in px either bar allows: one screen across. */
const QUIET_STRETCH_LIMIT = SCREEN_W;

/** Spacing in px of the whole-water grid's points (issue #130, ND-1). */
export const QUIET_GRID_STEP = 8;

/** Bands the swim water's height splits into: surface, middle and floor (issue #130, ND-4). */
const DEPTH_BAND_COUNT = 3;

/** How far in px a loop reaches into a depth band to count there: a tilapia body (issue #130, ND-5). */
const BAND_REACH = 24;

/** Fewest depth bands each loop the depth rule covers reaches into (issue #130, ND-5). */
const MIN_LOOP_BANDS = 2;

/** Species ids whose loops the depth rule covers (issue #130, ND-5). */
const DEPTH_RULE_SPECIES: readonly string[] = [TILAPIA_SPECIES.id, CARP_SPECIES.id];

/** Screens of water per carp the carp rule asks for (issue #130, ND-7). */
const SCREENS_PER_CARP = 3;

/** The zone's moving threats: tilapia routes with the area's tuning, other predator routes and moving hazards. */
type ThreatGeometry = Pick<ZoneLayout, 'tilapiaRoutes' | 'tilapia' | 'predatorRoutes' | 'movingHazards'>;

/** The moving threats and the main path they cover. */
type PathGeometry = ThreatGeometry & Pick<ZoneLayout, 'mainPath'>;

/** One moving threat's reach: px from a patrol loop or from a moving hazard sweep. */
type Reach =
  | { kind: 'route'; waypoints: readonly Point[]; reach: number }
  | { kind: 'shape'; shape: HazardShape; reach: number };

/** One main path sample and its distance in px along the path from its start. */
interface PathSample {
  point: Point;
  along: number;
}

/**
 * The moving threats and the water they swim in: its size and its safe area (issue #130, ND-2), and
 * its solid rock walls, which are not water (issue #105, ND-8; absent means none).
 */
type WaterGeometry = ThreatGeometry & Pick<ZoneLayout, 'width' | 'bedTop' | 'safeArea'> & Partial<Pick<ZoneLayout, 'rockWalls'>>;

/** Everything a whole-water bar reads: the threats, the water and the area's size. */
type WholeWaterGeometry = WaterGeometry & Pick<ZoneLayout, 'height'>;

/** The predator routes and the water's size, which the depth rule reads. */
type RouteGeometry = Pick<ZoneLayout, 'tilapiaRoutes' | 'predatorRoutes' | 'width' | 'bedTop'>;

/** The threats and the water's size, which the surface danger check reads. */
type SurfaceGeometry = RouteGeometry & Pick<ZoneLayout, 'movingHazards'>;

/** A span of y from `top` down to `bottom` in px: a depth band, or the height a patrol loop covers. */
interface YSpan {
  top: number;
  bottom: number;
}

/** One quiet swim: its length in px along the grid, where it starts and where it ends. */
interface QuietSwim {
  length: number;
  from: Point;
  to: Point;
}

/** The whole-water grid: x of each column, y of each row, and whether each point is quiet, row by row. */
interface WaterGrid {
  xs: number[];
  ys: number[];
  quiet: boolean[];
}

/** A step onto a pocket point: the point's index in its pocket and the step's length in px. */
interface PocketStep {
  node: number;
  step: number;
}

/** Where a quiet swim may start or end: a point and its steps onto the pocket's points. */
interface SwimEnd {
  point: Point;
  steps: PocketStep[];
}

/**
 * One quiet pocket: its points as grid indices, each point's steps to the pocket points next to
 * it, where its swims may end, and which of those ends its swims start from, as indices into `ends`.
 */
interface QuietPocket {
  cells: number[];
  links: PocketStep[][];
  ends: SwimEnd[];
  starts: number[];
}

/** A pocket with one point's shortest way to each of its ends, and the farthest of them in px. */
interface PocketSurvey {
  pocket: QuietPocket;
  endDistances: number[];
  farthest: number;
}

/** A pocket point waiting in the shortest way search, at `distance` px from where the search started. */
interface QueueEntry {
  node: number;
  distance: number;
}

/** Moving threats: one per tilapia route, one per other predator route and one per moving hazard spawn. */
export function movingThreatCount(layout: Pick<ZoneLayout, 'tilapiaRoutes' | 'predatorRoutes' | 'movingHazards'>): number {
  return layout.tilapiaRoutes.length + layout.predatorRoutes.length + (layout.movingHazards ?? []).length;
}

/** Distinct predator species by id, the tilapia included when the area has a tilapia route. */
export function predatorTypeCount(layout: Pick<ZoneLayout, 'tilapiaRoutes' | 'predatorRoutes'>): number {
  const tilapia = layout.tilapiaRoutes.length > 0 ? [TILAPIA_SPECIES.id] : [];
  return new Set([...tilapia, ...layout.predatorRoutes.map((route) => route.species.id)]).size;
}

/** Distinct moving hazard types by id. */
export function movingHazardTypeCount(layout: Pick<ZoneLayout, 'movingHazards'>): number {
  return new Set((layout.movingHazards ?? []).map((spawn) => spawn.type.id)).size;
}

/**
 * Longest stretch in px of the main path with no moving threat in reach, sampled every SAMPLE_STEP
 * px. In reach means within lungeRange plus leash of a predator's patrol loop (a tilapia by the
 * area's own tuning; leash 0 without a chase or with the `warnOnRoute` rule), or within touch reach
 * of a moving hazard sweep, inclusive. A stretch runs from the last in-reach sample before it, or
 * the path start, to the first in-reach sample after it, or the path end. Throws when the main
 * path has no points.
 */
export function longestQuietStretch(layout: PathGeometry): number {
  const samples = pathSamples(layout.mainPath);
  const reaches = reachesOf(layout);
  let longest = 0;
  let fence = 0;
  let quietSinceFence = false;
  for (const sample of samples) {
    if (reaches.some((reach) => inReach(sample.point, reach))) {
      if (quietSinceFence) longest = Math.max(longest, sample.along - fence);
      fence = sample.along;
      quietSinceFence = false;
    } else {
      quietSinceFence = true;
    }
  }
  if (quietSinceFence) longest = Math.max(longest, samples[samples.length - 1].along - fence);
  return longest;
}

/**
 * The longest quiet swim in the whole water (issue #130, ND-1 and ND-2), exact. A grid covers
 * swimBounds(layout) every QUIET_GRID_STEP px, its last row and column on the water's edges. Each
 * point is in reach (as longestQuietStretch measures it), home (in the safe area) or quiet. Quiet
 * points that touch, diagonals included, make one pocket. A swim starts at an in-reach or home
 * point, goes through the quiet points of one pocket and ends at another in-reach or home point or
 * at a quiet point on the water's edge; its length is the shortest such way along the grid. A
 * pocket that touches no in-reach or home point, so all the water is quiet, has its swims start at
 * the water's edge too. Gives the swim's length in px and both end points, or null when no point
 * of the water is quiet.
 */
export function longestQuietSwim(layout: WaterGeometry): QuietSwim | null {
  return searchQuietSwims(layout, Infinity);
}

/** The swim water's height split into three equal bands, surface, middle and floor, top down (issue #130, ND-4). */
export function depthBands(layout: Pick<ZoneLayout, 'width' | 'bedTop'>): YSpan[] {
  const { minY, maxY } = swimBounds(layout);
  const height = (maxY - minY) / DEPTH_BAND_COUNT;
  return Array.from({ length: DEPTH_BAND_COUNT }, (_, band) => ({
    top: minY + band * height,
    bottom: band === DEPTH_BAND_COUNT - 1 ? maxY : minY + (band + 1) * height,
  }));
}

/**
 * Whether the tilapia and carp loops patrol at every depth (issue #130, ND-5). It covers tilapia
 * routes and predator routes whose species id is the tilapia's or the carp's, grouped by species
 * id: (a) each loop's height overlaps at least two depth bands by at least BAND_REACH px each, and
 * (b) each species' loops together overlap every band by at least BAND_REACH px. True when the area
 * has no such loop.
 */
export function meetsDepthRule(layout: RouteGeometry): boolean {
  const bands = depthBands(layout);
  const loops = depthRuleLoops(layout);
  const eachLoopSpansTwo = [...loops.values()].flat().every((loop) => bandsReached(loop, bands) >= MIN_LOOP_BANDS);
  const eachSpeciesCoversAll = [...loops.values()].every((species) => bands.every((band) => unionOverlap(species, band) >= BAND_REACH));
  return eachLoopSpansTwo && eachSpeciesCoversAll;
}

/**
 * Whether the area has danger from the surface (issue #130, ND-6): any moving hazard, or any
 * predator route, tilapia routes included, lying wholly in the surface band. A route lies wholly
 * there when none of its waypoints is below the band's bottom edge, the edge included.
 */
export function hasSurfaceDanger(layout: SurfaceGeometry): boolean {
  const surfaceBottom = depthBands(layout)[0].bottom;
  const routes: readonly TilapiaRoute[] = [...layout.tilapiaRoutes, ...layout.predatorRoutes];
  const surfaceRoute = routes.some((route) => route.waypoints.length > 0 && route.waypoints.every((point) => point.y <= surfaceBottom));
  return (layout.movingHazards ?? []).length > 0 || surfaceRoute;
}

/**
 * Longest stretch in px of the floor lane with no predator in reach (issue #130, ND-6). The lane
 * runs along y = bedTop − 22 from the swim water's left edge to its right edge, sampled every
 * SAMPLE_STEP px. A sample is a threat point when it is in the safe area or within a predator's
 * reach as longestQuietStretch measures it; moving hazards do not count. A stretch runs from the
 * last threat point before it, or the lane start, to the first threat point after it, or the lane end.
 */
export function floorQuietStretch(layout: WaterGeometry): number {
  const { minX, maxX, maxY } = swimBounds(layout);
  const samples = pathSamples([
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
  ]);
  const predators = reachesOf(layout).filter((reach) => reach.kind === 'route');
  let longest = 0;
  let fence = 0;
  let quietSinceFence = false;
  for (const sample of samples) {
    if (inSafeArea(sample.point, layout.safeArea) || predators.some((reach) => inReach(sample.point, reach))) {
      if (quietSinceFence) longest = Math.max(longest, sample.along - fence);
      fence = sample.along;
      quietSinceFence = false;
    } else {
      quietSinceFence = true;
    }
  }
  if (quietSinceFence) longest = Math.max(longest, samples[samples.length - 1].along - fence);
  return longest;
}

/** Whether the floor rule holds (issue #130, ND-6): no surface danger, or a floor quiet stretch of at most one screen across. */
export function meetsFloorRule(layout: WaterGeometry): boolean {
  return !hasSurfaceDanger(layout) || floorQuietStretch(layout) <= QUIET_STRETCH_LIMIT;
}

/** Carp routes the carp rule asks for over `screens` screens of water: screens / 3, rounded half up (issue #130, ND-7). */
export function carpTarget(screens: number): number {
  return Math.round(screens / SCREENS_PER_CARP);
}

/** Predator routes whose species id is the carp's (issue #130, ND-7). */
export function carpCount(layout: Pick<ZoneLayout, 'predatorRoutes'>): number {
  return layout.predatorRoutes.filter((route) => route.species.id === CARP_SPECIES.id).length;
}

/**
 * Whether the area meets the full danger bar with the whole-water test (PRD N2; issue #130, ND-1
 * to ND-7): at least ⌈0.75 × screens⌉ moving threats, at least 2 predator species, at least 1
 * moving hazard type, every predator chases, no quiet swim longer than one screen across, and the
 * depth, floor and carp rules hold.
 */
export function meetsWholeWaterDangerBar(layout: WholeWaterGeometry): boolean {
  return (
    movingThreatCount(layout) >= Math.ceil(THREATS_PER_SCREEN * screenCount(layout)) &&
    predatorTypeCount(layout) >= MIN_PREDATOR_TYPES &&
    movingHazardTypeCount(layout) >= MIN_MOVING_HAZARD_TYPES &&
    everyPredatorChases(layout) &&
    meetsWholeWaterRules(layout)
  );
}

/**
 * Whether Area `areaNumber` meets the ramp bar with the whole-water test (PRD N2; issue #130, ND-1
 * to ND-7): it has a tilapia route and the area's tilapia tuning has a chase, it has no moving
 * hazard type in Area 2 and at most one in Area 3, no quiet swim is longer than one screen across,
 * and the depth, floor and carp rules hold. Throws a RangeError for any area other than 2 or 3.
 */
export function meetsWholeWaterRampBar(areaNumber: number, layout: WholeWaterGeometry): boolean {
  if (areaNumber !== 2 && areaNumber !== 3) {
    throw new RangeError(`meetsWholeWaterRampBar: area ${areaNumber} has no ramp bar; only Areas 2 and 3 do`);
  }
  return (
    layout.tilapiaRoutes.length > 0 &&
    layout.tilapia?.chase !== undefined &&
    movingHazardTypeCount(layout) <= rampMovingHazardTypeLimit(areaNumber) &&
    meetsWholeWaterRules(layout)
  );
}

/** The checks both whole-water bars share: no quiet swim over one screen across, and the depth, floor and carp rules. */
function meetsWholeWaterRules(layout: WholeWaterGeometry): boolean {
  const swim = searchQuietSwims(layout, QUIET_STRETCH_LIMIT);
  return (
    (swim === null || swim.length <= QUIET_STRETCH_LIMIT) &&
    meetsDepthRule(layout) &&
    meetsFloorRule(layout) &&
    carpCount(layout) >= carpTarget(screenCount(layout))
  );
}

/** Most moving hazard types the ramp bar allows in Area `areaNumber`; a RangeError outside Areas 2 and 3. */
function rampMovingHazardTypeLimit(areaNumber: number): number {
  switch (areaNumber) {
    case 2:
      return 0;
    case 3:
      return 1;
    default:
      throw new RangeError(`meetsWholeWaterRampBar: area ${areaNumber} has no ramp bar; only Areas 2 and 3 do`);
  }
}

/** Screens the area covers: its width over SCREEN_W times its height over WORLD_H. */
function screenCount(layout: Pick<ZoneLayout, 'width' | 'height'>): number {
  return (layout.width / SCREEN_W) * (layout.height / WORLD_H);
}

/** Whether every tilapia route (by the area's tuning) and every other predator route's species has a chase. */
function everyPredatorChases(layout: ThreatGeometry): boolean {
  const tilapiaChase = layout.tilapiaRoutes.length === 0 || layout.tilapia?.chase !== undefined;
  return tilapiaChase && layout.predatorRoutes.every((route) => route.species.tuning.chase !== undefined);
}

/** Reach in px from a predator's patrol loop: its lungeRange plus its leash when it chases off its route. */
function predatorReach(tuning: Readonly<TilapiaTuning>, rules: Readonly<PredatorRules> | undefined): number {
  const leash = tuning.chase && !rules?.warnOnRoute ? tuning.chase.leash : 0;
  return tuning.lungeRange + leash;
}

/** Every moving threat's reach: tilapia routes, then other predator routes, then moving hazard sweeps. */
function reachesOf(layout: ThreatGeometry): Reach[] {
  const tilapiaReach = predatorReach(layout.tilapia ?? TILAPIA, TILAPIA_SPECIES.rules);
  const tilapia = layout.tilapiaRoutes.map((route): Reach => ({ kind: 'route', waypoints: route.waypoints, reach: tilapiaReach }));
  const others = layout.predatorRoutes.map(
    (route): Reach => ({ kind: 'route', waypoints: route.waypoints, reach: predatorReach(route.species.tuning, route.species.rules) }),
  );
  const moving = (layout.movingHazards ?? []).map(
    (spawn): Reach => ({ kind: 'shape', shape: movingHazardSweep(spawn), reach: spawn.type.touchReach }),
  );
  return [...tilapia, ...others, ...moving];
}

function inReach(point: Point, reach: Reach): boolean {
  const away = reach.kind === 'route' ? routeLoopDistance(point, reach.waypoints) : shapeDistance(point, reach.shape);
  return away <= reach.reach;
}

/** Points along the main path as an open polyline, at most SAMPLE_STEP px apart, ends included. */
function pathSamples(path: readonly Point[]): PathSample[] {
  if (path.length === 0) throw new Error('longestQuietStretch: the main path has no points');
  const samples: PathSample[] = [{ point: { x: path[0].x, y: path[0].y }, along: 0 }];
  let along = 0;
  for (let i = 1; i < path.length; i++) {
    const [from, to] = [path[i - 1], path[i]];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(length / SAMPLE_STEP));
    for (let step = 1; step <= steps; step++) {
      const point = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps };
      samples.push({ point, along: along + (length * step) / steps });
    }
    along += length;
  }
  return samples;
}

/** Each loop the depth rule covers as the y span of its waypoints, grouped by species id, tilapia routes as the tilapia. */
function depthRuleLoops(layout: RouteGeometry): Map<string, YSpan[]> {
  const routes = [
    ...layout.tilapiaRoutes.map((route) => ({ species: TILAPIA_SPECIES.id, route })),
    ...layout.predatorRoutes.map((route) => ({ species: route.species.id, route })),
  ];
  const loops = new Map<string, YSpan[]>();
  for (const { species, route } of routes) {
    if (!DEPTH_RULE_SPECIES.includes(species)) continue;
    const ys = route.waypoints.map((point) => point.y);
    loops.set(species, [...(loops.get(species) ?? []), { top: Math.min(...ys), bottom: Math.max(...ys) }]);
  }
  return loops;
}

/** How many depth bands a loop's span overlaps by at least BAND_REACH px. */
function bandsReached(loop: YSpan, bands: readonly YSpan[]): number {
  return bands.filter((band) => Math.min(loop.bottom, band.bottom) - Math.max(loop.top, band.top) >= BAND_REACH).length;
}

/** Px of `band` that at least one of the loops' spans covers. */
function unionOverlap(loops: readonly YSpan[], band: YSpan): number {
  const parts = loops
    .map((loop) => ({ top: Math.max(loop.top, band.top), bottom: Math.min(loop.bottom, band.bottom) }))
    .filter((part) => part.bottom > part.top)
    .sort((first, second) => first.top - second.top);
  let covered = 0;
  let coveredTo = -Infinity;
  for (const part of parts) {
    covered += Math.max(0, part.bottom - Math.max(part.top, coveredTo));
    coveredTo = Math.max(coveredTo, part.bottom);
  }
  return covered;
}

/**
 * The longest quiet swim (issue #130, ND-1), searching pockets from the largest bound down. A
 * pocket's bound is twice its centre point's farthest swim end, since every swim can go by way of
 * that point. A pocket, or a start inside one, is skipped once its bound is at most the length to
 * beat (lengthToBeat). The search stops at the first swim longer than `stopLimit`; Infinity
 * searches exactly.
 */
function searchQuietSwims(layout: WaterGeometry, stopLimit: number): QuietSwim | null {
  const grid = buildWaterGrid(layout);
  const surveys = findPockets(grid)
    .map((pocket) => surveyPocket(grid, pocket))
    .sort((first, second) => second.farthest - first.farthest);
  let best: QuietSwim | null = null;
  for (const survey of surveys) {
    if (2 * survey.farthest <= lengthToBeat(best, stopLimit)) break;
    best = searchPocket(survey, best, stopLimit);
    if (best !== null && best.length > stopLimit) return best;
  }
  return best;
}

/** The length a swim must pass to change the answer: the best swim found, or a finite stop limit when that is longer. */
function lengthToBeat(best: QuietSwim | null, stopLimit: number): number {
  return Math.max(best?.length ?? 0, Number.isFinite(stopLimit) ? stopLimit : 0);
}

/**
 * The longest swim from one pocket's starts, or `best` when none is longer. Each start's farthest
 * end is at most its way to a searched pocket point plus that point's farthest end; starts are
 * searched from the largest such bound down, and after each one the pocket point with the
 * smallest known farthest end is searched to tighten the bounds.
 */
function searchPocket(survey: PocketSurvey, best: QuietSwim | null, stopLimit: number): QuietSwim | null {
  const { pocket } = survey;
  const bounds = pocket.starts.map((end) => survey.endDistances[end] + survey.farthest);
  const searched = pocket.starts.map(() => false);
  const farthestAtLeast = new Array<number>(pocket.cells.length).fill(0);
  const centred = pocket.cells.map(() => false);
  let found = best;
  for (;;) {
    const start = indexOfLargest(bounds, searched);
    if (start < 0 || bounds[start] <= lengthToBeat(found, stopLimit)) return found;
    searched[start] = true;
    const startEnd = pocket.starts[start];
    const distances = pocketDistances(pocket, pocket.ends[startEnd].steps);
    const swim = farthestSwim(pocket, distances, startEnd);
    if (swim !== null && (found === null || swim.length > found.length)) found = swim;
    if (found !== null && found.length > stopLimit) return found;
    distances.forEach((distance, node) => {
      farthestAtLeast[node] = Math.max(farthestAtLeast[node], distance);
    });
    tightenBounds(pocket, bounds, indexOfSmallest(farthestAtLeast, centred), centred);
  }
}

/** Searches from pocket point `centre` and lowers each start's bound to its way there plus the centre's farthest end. */
function tightenBounds(pocket: QuietPocket, bounds: number[], centre: number, centred: boolean[]): void {
  if (centre < 0) return;
  centred[centre] = true;
  const distances = pocketDistances(pocket, [{ node: centre, step: 0 }]);
  const endDistances = pocket.ends.map((end) => endDistance(end, distances));
  const farthest = endDistances.reduce((most, distance) => Math.max(most, distance), 0);
  pocket.starts.forEach((end, start) => {
    bounds[start] = Math.min(bounds[start], endDistances[end] + farthest);
  });
}

/** The longest of the shortest swims from end `startEnd` to every other end of the pocket, or null when it has no other end. */
function farthestSwim(pocket: QuietPocket, distances: readonly number[], startEnd: number): QuietSwim | null {
  let farthest = -1;
  let length = -Infinity;
  pocket.ends.forEach((end, index) => {
    const distance = endDistance(end, distances);
    if (index !== startEnd && distance > length) [farthest, length] = [index, distance];
  });
  return farthest < 0 ? null : { length, from: pocket.ends[startEnd].point, to: pocket.ends[farthest].point };
}

/** The whole-water grid over swimBounds(layout), every QUIET_GRID_STEP px, and which of its points are quiet. */
function buildWaterGrid(layout: WaterGeometry): WaterGrid {
  const bounds = swimBounds(layout);
  const xs = gridLine(bounds.minX, bounds.maxX);
  const ys = gridLine(bounds.minY, bounds.maxY);
  const reaches = reachesOf(layout);
  const rock = layout.rockWalls ?? [];
  const quiet = ys.flatMap((y) => xs.map((x) => isQuietPoint({ x, y }, layout.safeArea, reaches) && !inRock({ x, y }, rock)));
  return { xs, ys, quiet };
}

/**
 * Whether a point is inside a rock wall, edges included (issue #105, ND-8). Rock is not water, so a
 * grid point in it is never quiet: a quiet swim ends at the rock as it ends at a threat.
 */
function inRock(point: Point, walls: readonly Readonly<{ x0: number; x1: number; y0: number; y1: number }>[]): boolean {
  return walls.some((wall) => point.x >= wall.x0 && point.x <= wall.x1 && point.y >= wall.y0 && point.y <= wall.y1);
}

/** Grid positions from `from` every QUIET_GRID_STEP px, then `to` itself, so the last one sits on the water's edge. */
function gridLine(from: number, to: number): number[] {
  const positions: number[] = [];
  for (let at = from; at < to; at += QUIET_GRID_STEP) positions.push(at);
  positions.push(to);
  return positions;
}

/** Whether a point is quiet: outside the safe area and out of every moving threat's reach. */
function isQuietPoint(point: Point, safeArea: Readonly<SafeArea>, reaches: readonly Reach[]): boolean {
  return !inSafeArea(point, safeArea) && !reaches.some((reach) => inReach(point, reach));
}

/** Every quiet pocket: quiet points that touch, diagonals included, in grid order. */
function findPockets(grid: WaterGrid): QuietPocket[] {
  const pocketOf = new Array<number>(grid.quiet.length).fill(-1);
  const pockets: QuietPocket[] = [];
  grid.quiet.forEach((quiet, cell) => {
    if (quiet && pocketOf[cell] < 0) pockets.push(collectPocket(grid, cell, pockets.length, pocketOf));
  });
  return pockets;
}

/**
 * The pocket holding quiet point `seed`, marked `id` in `pocketOf`. Its ends are the in-reach and
 * home points next to it, then its points on the water's edge; its swims start at the first kind,
 * or at the second when it touches none.
 */
function collectPocket(grid: WaterGrid, seed: number, id: number, pocketOf: number[]): QuietPocket {
  const cells = [seed];
  pocketOf[seed] = id;
  for (let index = 0; index < cells.length; index++) {
    for (const next of neighboursOf(grid, cells[index])) {
      if (!grid.quiet[next] || pocketOf[next] >= 0) continue;
      pocketOf[next] = id;
      cells.push(next);
    }
  }
  const slotOf = new Map(cells.map((cell, slot) => [cell, slot]));
  const links = cells.map((cell) => pocketSteps(grid, cell, slotOf));
  const fences = new Map<number, PocketStep[]>();
  cells.forEach((cell, slot) => {
    for (const next of neighboursOf(grid, cell).filter((neighbour) => !grid.quiet[neighbour])) {
      fences.set(next, [...(fences.get(next) ?? []), { node: slot, step: stepLength(grid, cell, next) }]);
    }
  });
  const fenceEnds = [...fences].map(([cell, steps]): SwimEnd => ({ point: gridPoint(grid, cell), steps }));
  const edgeEnds = cells.flatMap((cell, slot): SwimEnd[] => (onWaterEdge(grid, cell) ? [{ point: gridPoint(grid, cell), steps: [{ node: slot, step: 0 }] }] : []));
  const ends = [...fenceEnds, ...edgeEnds];
  const starts = fenceEnds.length > 0 ? fenceEnds.map((_, index) => index) : edgeEnds.map((_, index) => fenceEnds.length + index);
  return { cells, links, ends, starts };
}

/** Steps from grid point `cell` to the points next to it in its pocket, by their slot in `slotOf`. */
function pocketSteps(grid: WaterGrid, cell: number, slotOf: ReadonlyMap<number, number>): PocketStep[] {
  return neighboursOf(grid, cell).flatMap((next) => {
    const slot = slotOf.get(next);
    return slot === undefined ? [] : [{ node: slot, step: stepLength(grid, cell, next) }];
  });
}

/** The pocket's first survey: from the point nearest its bounding box's centre, the shortest way to each end and the farthest. */
function surveyPocket(grid: WaterGrid, pocket: QuietPocket): PocketSurvey {
  const points = pocket.cells.map((cell) => gridPoint(grid, cell));
  const middleX = middleOf(points.map((point) => point.x));
  const middleY = middleOf(points.map((point) => point.y));
  const centre = indexOfSmallest(
    points.map((point) => Math.hypot(point.x - middleX, point.y - middleY)),
    points.map(() => false),
  );
  const distances = pocketDistances(pocket, [{ node: centre, step: 0 }]);
  const endDistances = pocket.ends.map((end) => endDistance(end, distances));
  return { pocket, endDistances, farthest: endDistances.reduce((most, distance) => Math.max(most, distance), 0) };
}

/** Halfway between the smallest and the largest value. */
function middleOf(values: readonly number[]): number {
  const smallest = values.reduce((least, value) => Math.min(least, value), Infinity);
  const largest = values.reduce((most, value) => Math.max(most, value), -Infinity);
  return (smallest + largest) / 2;
}

/** Shortest way in px from the seeds, each a pocket point and the px already swum to reach it, to every pocket point (Dijkstra). */
function pocketDistances(pocket: QuietPocket, seeds: readonly PocketStep[]): number[] {
  const distances = new Array<number>(pocket.cells.length).fill(Infinity);
  const queue: QueueEntry[] = [];
  for (const seed of seeds) {
    if (seed.step >= distances[seed.node]) continue;
    distances[seed.node] = seed.step;
    pushQueue(queue, { node: seed.node, distance: seed.step });
  }
  for (let entry = popQueue(queue); entry !== undefined; entry = popQueue(queue)) {
    if (entry.distance > distances[entry.node]) continue;
    for (const link of pocket.links[entry.node]) {
      const distance = entry.distance + link.step;
      if (distance >= distances[link.node]) continue;
      distances[link.node] = distance;
      pushQueue(queue, { node: link.node, distance });
    }
  }
  return distances;
}

/** Shortest way in px to a swim end: the nearest of its steps from the pocket. */
function endDistance(end: SwimEnd, distances: readonly number[]): number {
  return end.steps.reduce((nearest, step) => Math.min(nearest, distances[step.node] + step.step), Infinity);
}

/** Adds an entry to the binary min-heap `queue`, ordered by distance. */
function pushQueue(queue: QueueEntry[], entry: QueueEntry): void {
  queue.push(entry);
  for (let index = queue.length - 1; index > 0; ) {
    const parent = (index - 1) >> 1;
    if (queue[parent].distance <= queue[index].distance) return;
    [queue[parent], queue[index]] = [queue[index], queue[parent]];
    index = parent;
  }
}

/** Takes the nearest entry from the binary min-heap `queue`; undefined when it is empty. */
function popQueue(queue: QueueEntry[]): QueueEntry | undefined {
  const top = queue[0];
  const last = queue.pop();
  if (queue.length === 0 || last === undefined) return top;
  queue[0] = last;
  for (let index = 0; ; ) {
    const [left, right] = [2 * index + 1, 2 * index + 2];
    let smallest = index;
    if (left < queue.length && queue[left].distance < queue[smallest].distance) smallest = left;
    if (right < queue.length && queue[right].distance < queue[smallest].distance) smallest = right;
    if (smallest === index) return top;
    [queue[smallest], queue[index]] = [queue[index], queue[smallest]];
    index = smallest;
  }
}

/** Index of the largest value not yet `skipped`, or -1 when every value is skipped. */
function indexOfLargest(values: readonly number[], skipped: readonly boolean[]): number {
  let found = -1;
  values.forEach((value, index) => {
    if (!skipped[index] && (found < 0 || value > values[found])) found = index;
  });
  return found;
}

/** Index of the smallest value not yet `skipped`, or -1 when every value is skipped. */
function indexOfSmallest(values: readonly number[], skipped: readonly boolean[]): number {
  let found = -1;
  values.forEach((value, index) => {
    if (!skipped[index] && (found < 0 || value < values[found])) found = index;
  });
  return found;
}

/** Grid indices of the up to eight points next to `cell`, diagonals included. */
function neighboursOf(grid: WaterGrid, cell: number): number[] {
  const columns = grid.xs.length;
  const [row, column] = [Math.floor(cell / columns), cell % columns];
  const neighbours: number[] = [];
  for (let nextRow = Math.max(0, row - 1); nextRow <= Math.min(grid.ys.length - 1, row + 1); nextRow++) {
    for (let nextColumn = Math.max(0, column - 1); nextColumn <= Math.min(columns - 1, column + 1); nextColumn++) {
      if (nextRow !== row || nextColumn !== column) neighbours.push(nextRow * columns + nextColumn);
    }
  }
  return neighbours;
}

/** The world point of grid index `cell`. */
function gridPoint(grid: WaterGrid, cell: number): Point {
  return { x: grid.xs[cell % grid.xs.length], y: grid.ys[Math.floor(cell / grid.xs.length)] };
}

/** Px between two grid points: QUIET_GRID_STEP straight or QUIET_GRID_STEP × √2 diagonal, less towards the last row or column. */
function stepLength(grid: WaterGrid, from: number, to: number): number {
  const [start, end] = [gridPoint(grid, from), gridPoint(grid, to)];
  return Math.hypot(end.x - start.x, end.y - start.y);
}

/** Whether grid index `cell` lies on the water's edge: the first or last row or column. */
function onWaterEdge(grid: WaterGrid, cell: number): boolean {
  const columns = grid.xs.length;
  const [row, column] = [Math.floor(cell / columns), cell % columns];
  return row === 0 || row === grid.ys.length - 1 || column === 0 || column === columns - 1;
}
