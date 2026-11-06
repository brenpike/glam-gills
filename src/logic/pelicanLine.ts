/**
 * Pure American white pelican line rules (issue #211, ND-5, ND-6): Area 12's signature predator, a
 * scheduled formation and never a chasing predator. A line of birds floats at the surface (SURF), a
 * fixed spacing apart, and glides as one back and forth along its span. On one shared cycle the line
 * stops and warns (heads up, pouches open), plunges every bill together down to its dip depth, holds
 * there, then rises and glides on. Each bill makes a scoop box, from SURF down to the bill, from the
 * start of the plunge to the end of the rise. A body centre within the touch reach of a box is
 * bumped: the caller lands one hit, and each scoop bumps at most once. The axolotl dives under the
 * dip or slips through a gap between two boxes. A scoop never catches, holds or lifts the axolotl
 * (ADR 0007): these rules only say when a bump lands.
 */
import { SAFE_PASSING_WIDTH } from './ghostNets';
import type { HazardRect } from './hazards';
import { TILAPIA } from './tuning';
import { SURF, type Point, type SwimBounds } from './zone';

/** Pelican line tuning (issue #211, ND-5, ND-6). */
export interface PelicanLineTuning {
  /** Birds in the line. Must be a whole number, at least 2. */
  count: number;
  /** Px between the centres of two neighbour birds. */
  spacing: number;
  /** Width in px of each bill's scoop box, centred on its bird. */
  scoopWidth: number;
  /** Speed in px/s the line glides along its span. */
  glideSpeed: number;
  /** Seconds the line glides at the start of each cycle. */
  glideFor: number;
  /** Seconds of warning (heads up, pouches open) after the glide; at least the A2 floor, 0.8 s. */
  warnFor: number;
  /** Seconds the bills take to plunge from SURF to the dip depth, at a steady speed. */
  plungeFor: number;
  /** Seconds the bills hold at the dip depth. */
  holdFor: number;
  /** Seconds the bills take to rise from the dip depth back to SURF, at a steady speed. */
  riseFor: number;
  /** Depth in px below SURF the bills reach at the bottom of the plunge. */
  dipDepth: number;
  /** Distance in px from a scoop box within which the body centre is bumped (inclusive). */
  touchReach: number;
  /** Height in px of a floating bird's bob above and below SURF; none under reduced motion. */
  bobAmplitude: number;
  /** Seconds for one full bob. */
  bobPeriod: number;
}

/**
 * Provisional pelican line values (issue #211, ND-5, ND-6); tune in play. Three birds 200 px apart,
 * each with a 100 px scoop box, glide at 50 px/s for 3.0 s, then warn 1.0 s, plunge 0.4 s to 220 px
 * below SURF, hold 0.5 s and rise over 0.6 s: a 5.5 s cycle. The 18 px touch reach is the ghost
 * net's, so each gap is 200 - 100 - 2 * 18 = 64 px clear, above SAFE_PASSING_WIDTH. A 2 px bob every
 * 2.4 s.
 */
export const PELICAN_LINE: Readonly<PelicanLineTuning> = Object.freeze({
  count: 3,
  spacing: 200,
  scoopWidth: 100,
  glideSpeed: 50,
  glideFor: 3.0,
  warnFor: 1.0,
  plungeFor: 0.4,
  holdFor: 0.5,
  riseFor: 0.6,
  dipDepth: 220,
  touchReach: 18,
  bobAmplitude: 2,
  bobPeriod: 2.4,
});

/** The parts of the pelican line's cycle, in cycle order. */
export const PELICAN_PHASES = Object.freeze(['glide', 'warn', 'plunge', 'hold', 'rise'] as const);

/** One part of the pelican line's cycle. */
export type PelicanPhaseName = (typeof PELICAN_PHASES)[number];

/** The line's phase and how far through it, as a share in [0, 1). */
export interface PelicanPhase {
  phase: PelicanPhaseName;
  progress: number;
}

/** Area data for a pelican line: the surface span `x0..x1` its scoop boxes glide across. */
export interface PelicanLinePlan {
  x0: number;
  x1: number;
}

/**
 * A pelican line (issue #211, ND-5, ND-6): its id, the surface span `x0..x1` its scoop boxes glide
 * across, its start offset in seconds of element time and its own copy of the tuning.
 */
export interface PelicanLineSpawn {
  readonly id: string;
  readonly x0: number;
  readonly x1: number;
  readonly offset: number;
  readonly tuning: Readonly<PelicanLineTuning>;
}

/**
 * A bird's drawn pose: its centre at SURF plus its bob, its frame (the index of its phase in
 * PELICAN_PHASES), its facing (1 right, -1 left) and its bill's depth in px below SURF.
 */
export interface PelicanPose {
  pos: Point;
  frame: number;
  facing: 1 | -1;
  billDepth: number;
}

/** The shortest warning in seconds: the A2 telegraph floor, the predators' minWindup. */
const WARN_FLOOR = TILAPIA.minWindup;

/** Width in px of the whole line's scoop boxes, from the first box's left edge to the last box's right edge. */
function lineWidth(tuning: Readonly<PelicanLineTuning>): number {
  return (tuning.count - 1) * tuning.spacing + tuning.scoopWidth;
}

/** Clear width in px between two neighbour scoop boxes once both touch reaches are taken off. */
function clearGap(tuning: Readonly<PelicanLineTuning>): number {
  return tuning.spacing - tuning.scoopWidth - 2 * tuning.touchReach;
}

/** Throws RangeError unless every value is finite and in range. */
function checkTuning(id: string, tuning: Readonly<PelicanLineTuning>): void {
  const { spacing, scoopWidth, glideSpeed, glideFor, plungeFor, riseFor, dipDepth, bobPeriod } = tuning;
  const positive = { spacing, scoopWidth, glideSpeed, glideFor, plungeFor, riseFor, dipDepth, bobPeriod };
  for (const [name, value] of Object.entries(positive)) {
    if (!Number.isFinite(value) || !(value > 0)) {
      throw new RangeError(`pelicanLineSpawn: ${id} ${name} must be finite and greater than 0, got ${value}`);
    }
  }
  const nonNegative = { holdFor: tuning.holdFor, touchReach: tuning.touchReach, bobAmplitude: tuning.bobAmplitude };
  for (const [name, value] of Object.entries(nonNegative)) {
    if (!Number.isFinite(value) || !(value >= 0)) {
      throw new RangeError(`pelicanLineSpawn: ${id} ${name} must be finite and at least 0, got ${value}`);
    }
  }
  if (!Number.isInteger(tuning.count) || tuning.count < 2) {
    throw new RangeError(`pelicanLineSpawn: ${id} count must be a whole number of at least 2, got ${tuning.count}`);
  }
  if (!Number.isFinite(tuning.warnFor) || !(tuning.warnFor >= WARN_FLOOR)) {
    throw new RangeError(`pelicanLineSpawn: ${id} warnFor ${tuning.warnFor} must be at least ${WARN_FLOOR}`);
  }
  if (!(clearGap(tuning) >= SAFE_PASSING_WIDTH)) {
    throw new RangeError(`pelicanLineSpawn: ${id} gap ${clearGap(tuning)} px after both touch reaches is under the ${SAFE_PASSING_WIDTH} px safe passing width`);
  }
}

/** Throws RangeError unless the span is finite, longer than the line and inside `bounds`, and the dip stays inside `bounds`. */
function checkSpan(id: string, plan: Readonly<PelicanLinePlan>, bounds: Readonly<SwimBounds>, tuning: Readonly<PelicanLineTuning>): void {
  const { x0, x1 } = plan;
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !(x1 > x0)) {
    throw new RangeError(`pelicanLineSpawn: ${id} needs a finite span with x0 < x1, got ${x0}..${x1}`);
  }
  if (!(x1 - x0 > lineWidth(tuning))) {
    throw new RangeError(`pelicanLineSpawn: ${id} span ${x1 - x0} px is not longer than the ${lineWidth(tuning)} px line`);
  }
  if (x0 < bounds.minX || x1 > bounds.maxX) {
    throw new RangeError(`pelicanLineSpawn: ${id} span ${x0}..${x1} is outside the swim bounds ${bounds.minX}..${bounds.maxX}`);
  }
  if (SURF + tuning.dipDepth > bounds.maxY) {
    throw new RangeError(`pelicanLineSpawn: ${id} dip depth ${tuning.dipDepth} px reaches below the swim bounds`);
  }
}

/**
 * A pelican line for area data (issue #211, ND-5, ND-6), gliding over the plan's span, `offset`
 * seconds into its cycle clock: the cycle starts its glide at `offset` and every pelicanLinePeriod
 * after, and the line starts at the span's left end, gliding right. The spawn keeps its own frozen
 * copy of `tuning`. Throws RangeError for a span that is not finite with x0 < x1, is not longer than
 * the line or is outside `bounds` in x; a dip reaching below `bounds.maxY`; an offset that is not
 * finite; a count that is not a whole number of at least 2; a warning under the A2 floor (0.8 s); any
 * other tuning value that is not finite or is out of range; or a gap between neighbour scoop boxes
 * that is under SAFE_PASSING_WIDTH once both touch reaches are taken off.
 */
export function pelicanLineSpawn(
  id: string,
  offset: number,
  plan: Readonly<PelicanLinePlan>,
  bounds: Readonly<SwimBounds>,
  tuning: Readonly<PelicanLineTuning> = PELICAN_LINE,
): PelicanLineSpawn {
  checkTuning(id, tuning);
  checkSpan(id, plan, bounds, tuning);
  if (!Number.isFinite(offset)) {
    throw new RangeError(`pelicanLineSpawn: ${id} offset must be finite, got ${offset}`);
  }
  return { id, x0: plan.x0, x1: plan.x1, offset, tuning: Object.freeze({ ...tuning }) };
}

/** Seconds in one full cycle of the line: its glide, warning, plunge, hold and rise. */
export function pelicanLinePeriod(line: Readonly<PelicanLineSpawn>): number {
  const { glideFor, warnFor, plungeFor, holdFor, riseFor } = line.tuning;
  return glideFor + warnFor + plungeFor + holdFor + riseFor;
}

/** Seconds into the current cycle at element time `t`, in [0, period). */
function cycleTime(line: Readonly<PelicanLineSpawn>, t: number): number {
  const period = pelicanLinePeriod(line);
  return (((t - line.offset) % period) + period) % period;
}

/**
 * The line's phase at element time `t` and how far through it: 'glide' for the first `glideFor`
 * seconds from `offset`, then 'warn', 'plunge', 'hold' and 'rise'. The cycle repeats every
 * pelicanLinePeriod; any finite `t` is valid, negative included. A hold of 0 s is skipped.
 */
export function pelicanLinePhase(line: Readonly<PelicanLineSpawn>, t: number): PelicanPhase {
  const local = cycleTime(line, t);
  const { glideFor, warnFor, plungeFor, holdFor, riseFor } = line.tuning;
  const spans: readonly [PelicanPhaseName, number][] = [
    ['glide', glideFor],
    ['warn', warnFor],
    ['plunge', plungeFor],
    ['hold', holdFor],
  ];
  let start = 0;
  for (const [phase, seconds] of spans) {
    if (local < start + seconds) return { phase, progress: (local - start) / seconds };
    start += seconds;
  }
  return { phase: 'rise', progress: (local - start) / riseFor };
}

/**
 * Which scoop element time `t` is in: the whole cycles since `offset`, rounded down, so it changes
 * once per cycle, at the start of each glide. A caller keeps the number of the last scoop that bumped
 * to land at most one bump per scoop.
 */
export function pelicanScoopNumber(line: Readonly<PelicanLineSpawn>, t: number): number {
  return Math.floor((t - line.offset) / pelicanLinePeriod(line));
}

/** Px the line has glided by element time `t` since `t = offset`: negative before it. */
function glidedDistance(line: Readonly<PelicanLineSpawn>, t: number): number {
  const { glideSpeed, glideFor } = line.tuning;
  const local = cycleTime(line, t);
  return glideSpeed * (pelicanScoopNumber(line, t) * glideFor + Math.min(local, glideFor));
}

/** Where the line is along its back-and-forth glide at element time `t`, in [0, 2 * travel), and its travel. */
function glideState(line: Readonly<PelicanLineSpawn>, t: number): { driven: number; travel: number } {
  const travel = line.x1 - line.x0 - lineWidth(line.tuning);
  const loop = 2 * travel;
  const driven = ((glidedDistance(line, t) % loop) + loop) % loop;
  return { driven, travel };
}

/** The first bird's x at element time `t`: half a scoop box in from the line's left edge, which glides back and forth. */
function firstBirdX(line: Readonly<PelicanLineSpawn>, t: number): number {
  const { driven, travel } = glideState(line, t);
  return line.x0 + (driven <= travel ? driven : 2 * travel - driven) + line.tuning.scoopWidth / 2;
}

/** The number of birds in the line. */
export function pelicanBirdCount(line: Readonly<PelicanLineSpawn>): number {
  return line.tuning.count;
}

/**
 * Every bird's centre at element time `t`, first bird (leftmost) first: on SURF, `spacing` px apart,
 * with no bob. The line glides from the span's left end right at `glideSpeed`, turns at once at each
 * end, and holds still from the start of the warning to the end of the rise. Any finite `t` is
 * valid, negative included.
 */
export function pelicanBirdPositions(line: Readonly<PelicanLineSpawn>, t: number): Point[] {
  const first = firstBirdX(line, t);
  return Array.from({ length: line.tuning.count }, (_, index) => ({ x: first + index * line.tuning.spacing, y: SURF }));
}

/**
 * The bills' depth in px below SURF at element time `t`: 0 through the glide and the warning, going
 * down at a steady speed to `dipDepth` over the plunge, `dipDepth` through the hold and back up at a
 * steady speed over the rise.
 */
function billDepth(line: Readonly<PelicanLineSpawn>, t: number): number {
  const { phase, progress } = pelicanLinePhase(line, t);
  const { dipDepth } = line.tuning;
  if (phase === 'plunge') return dipDepth * progress;
  if (phase === 'hold') return dipDepth;
  if (phase === 'rise') return dipDepth * (1 - progress);
  return 0;
}

/** True from the start of the plunge to the end of the rise, when the scoop boxes are live. */
function scooping(line: Readonly<PelicanLineSpawn>, t: number): boolean {
  const { phase } = pelicanLinePhase(line, t);
  return phase === 'plunge' || phase === 'hold' || phase === 'rise';
}

/**
 * Every bill's scoop box at element time `t`, first bird first: `scoopWidth` wide, centred on its
 * bird, from SURF down to the bills' depth. Empty through the glide and the warning. At the first
 * instant of the plunge a box has no height yet, but it still bumps within the touch reach of SURF.
 */
export function pelicanScoopBoxes(line: Readonly<PelicanLineSpawn>, t: number): HazardRect[] {
  if (!scooping(line, t)) return [];
  const half = line.tuning.scoopWidth / 2;
  const bottom = SURF + billDepth(line, t);
  return pelicanBirdPositions(line, t).map((bird) => ({ kind: 'rect', x0: bird.x - half, x1: bird.x + half, y0: SURF, y1: bottom }));
}

/** Distance in px from `pos` to the rect, 0 inside it. */
function rectDistance(pos: Readonly<Point>, rect: Readonly<HazardRect>): number {
  const dx = Math.max(rect.x0 - pos.x, 0, pos.x - rect.x1);
  const dy = Math.max(rect.y0 - pos.y, 0, pos.y - rect.y1);
  return Math.hypot(dx, dy);
}

/**
 * The index of the first bird (leftmost first) whose scoop box is within the touch reach of the body
 * centre `pos` at element time `t`, edge inclusive, else null. Never a bird through the glide or the
 * warning. The caller lands one hit and keeps pelicanScoopNumber for this `t`, so each scoop bumps at
 * most once. It reads `pos` only and never moves, holds or lifts the axolotl.
 */
export function pelicanScoopHit(line: Readonly<PelicanLineSpawn>, pos: Readonly<Point>, t: number): number | null {
  const index = pelicanScoopBoxes(line, t).findIndex((box) => rectDistance(pos, box) <= line.tuning.touchReach);
  return index === -1 ? null : index;
}

/** Every place a scoop box can be: the line's whole span, from SURF down to the dip depth. */
export function pelicanLineSweep(line: Readonly<PelicanLineSpawn>): HazardRect {
  return { kind: 'rect', x0: line.x0, x1: line.x1, y0: SURF, y1: SURF + line.tuning.dipDepth };
}

/**
 * The narrowest clear gap in px between two neighbour scoop boxes once both touch reaches are taken
 * off. The boxes keep their spacing and never move while live, so every gap is this wide; the spawn
 * builder holds it at SAFE_PASSING_WIDTH or more.
 */
export function pelicanNarrowestGap(line: Readonly<PelicanLineSpawn>): number {
  return clearGap(line.tuning);
}

/**
 * The line's facing at element time `t`: the way it glides, and at an end of its span the way of its
 * next glide, so it holds through the warning, plunge, hold and rise. 1 right, -1 left.
 */
function lineFacing(line: Readonly<PelicanLineSpawn>, t: number): 1 | -1 {
  const { driven, travel } = glideState(line, t);
  return driven < travel ? 1 : -1;
}

/**
 * The drawn pose of the bird at `index` at element time `t`: its centre plus a bob of `bobAmplitude`,
 * out of step by the line's offset and the bird's index, none under reduced motion; the frame of the
 * line's phase; the line's facing; and the bills' depth below SURF. Throws RangeError for an index
 * that is not a bird of the line.
 */
export function pelicanPose(line: Readonly<PelicanLineSpawn>, index: number, t: number, reduced: boolean): PelicanPose {
  if (!Number.isInteger(index) || index < 0 || index >= line.tuning.count) {
    throw new RangeError(`pelicanPose: ${line.id} has no bird ${index}`);
  }
  const { bobAmplitude, bobPeriod, spacing } = line.tuning;
  const bob = reduced ? 0 : bobAmplitude * Math.sin((2 * Math.PI * (t - line.offset)) / bobPeriod + index);
  const pos = { x: firstBirdX(line, t) + index * spacing, y: SURF + bob };
  const frame = PELICAN_PHASES.indexOf(pelicanLinePhase(line, t).phase);
  return { pos, frame, facing: lineFacing(line, t), billDepth: billDepth(line, t) };
}
