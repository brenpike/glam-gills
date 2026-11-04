/**
 * Pure drag net rules (issue #108, ND-2): Area 10's timing element and the first one that costs a
 * leg. A drag net works one stretch of water on a fixed cycle: a quiet time, a warning (floats rising
 * and boats leaning) and a sweep, in which a front crosses the stretch from one edge to the other.
 * During the sweep the net catches an axolotl whose centre is inside the stretch, on the side of the
 * front it has already swept and not in one of the stretch's two safe hollows. A catch is one shared
 * hit, sourceId 'drag-net', and a stretch catches at most once per sweep. Tail Dash gives no
 * immunity. A net never moves, holds or traps the axolotl: these rules only say when a catch lands.
 * Drag nets are their own area data field, never in `hazards` or `elements`: a hiding-risk threat,
 * but not a gap obstacle and not a danger-bar threat.
 */
import { DRAG_NET_FACT, DRAG_NET_MEET_RANGE } from './factCards';
import type { ElementSpawn, ElementType, HazardRect } from './hazards';
import { legSpeedFactor } from './legs';
import { SWIM } from './tuning';
import type { Point, SwimBounds } from './zone';

/** A drag net's cycle, in seconds, read in this order from the start of each cycle (`offset`). */
export interface DragNetTiming {
  /** Seconds of quiet at the start of each cycle. Must be finite and at least 0. */
  quietFor: number;
  /** Seconds of warning (floats rising, boats leaning) after the quiet. Must be finite and greater than 0. */
  warnFor: number;
  /** Seconds the front takes to cross the stretch after the warning. Must be finite and greater than 0. */
  sweepFor: number;
}

/**
 * The owner's default drag net timing (issue #108, ND-2), provisional: a 7.5 s cycle of 4 s quiet,
 * a 1.0 s warning and a 2.5 s sweep. Area data can set its own timing per stretch.
 */
export const DRAG_NETS: Readonly<DragNetTiming> = Object.freeze({
  quietFor: 4,
  warnFor: 1,
  sweepFor: 2.5,
});

/**
 * The drag net (issue #108, ND-2), a timing element with the "Fishing nets" card, met within
 * DRAG_NET_MEET_RANGE of a stretch. Its `period` is the default cycle (DRAG_NETS); a stretch with its
 * own timing runs on dragNetPeriod instead. `activeFor` equals `period` because the cycle clock
 * always runs; dragNetPhase says which part of the cycle it is in.
 */
export const DRAG_NET: Readonly<ElementType> = Object.freeze({
  id: 'drag-net',
  name: 'Drag net',
  kind: 'cycle',
  period: DRAG_NETS.quietFor + DRAG_NETS.warnFor + DRAG_NETS.sweepFor,
  activeFor: DRAG_NETS.quietFor + DRAG_NETS.warnFor + DRAG_NETS.sweepFor,
  fact: DRAG_NET_FACT,
  meetRange: DRAG_NET_MEET_RANGE,
});

/** The way the front crosses the stretch: 'right' starts at the left edge, 'down' at the top edge. */
export type SweepDirection = 'left' | 'right' | 'up' | 'down';

/** The part of a drag net's cycle: quiet, warning (floats rising, boats leaning) or sweeping (catching). */
export type DragNetPhase = 'quiet' | 'warn' | 'sweep';

/** A rect given by its edges, before it is stored as a HazardRect. */
export type DragNetRect = Readonly<Omit<HazardRect, 'kind'>>;

/** Area data for one stretch: its rect, the sweep direction and its two safe hollows inside it. */
export interface DragNetPlan {
  stretch: DragNetRect;
  sweep: SweepDirection;
  hollows: readonly [DragNetRect, DragNetRect];
}

/** A built stretch: its rect, its sweep direction, its two hollows and its timing. Inclusive edges. */
export interface DragNetStretch {
  stretch: HazardRect;
  sweep: SweepDirection;
  hollows: readonly [HazardRect, HazardRect];
  timing: DragNetTiming;
}

/** A drag net element, with its stretch. */
export type DragNetSpawn = ElementSpawn & { dragNet: DragNetStretch };

/** True when `pos` is inside the rect, edges included. */
function inRect(pos: Readonly<Point>, rect: Readonly<DragNetRect>): boolean {
  return pos.x >= rect.x0 && pos.x <= rect.x1 && pos.y >= rect.y0 && pos.y <= rect.y1;
}

/** The rect as a HazardRect. Throws RangeError when it is not finite or is empty. */
function checkedRect(id: string, label: string, rect: DragNetRect): HazardRect {
  const { x0, x1, y0, y1 } = rect;
  if (![x0, x1, y0, y1].every(Number.isFinite) || !(x0 < x1) || !(y0 < y1)) {
    throw new RangeError(`dragNetSpawn: ${id} ${label} x ${x0}..${x1}, y ${y0}..${y1} must be finite and not empty`);
  }
  return { kind: 'rect', x0, x1, y0, y1 };
}

/** Throws RangeError when any timing value is not finite, the quiet is negative or the warning or sweep is not positive. */
function checkTiming(id: string, timing: Readonly<DragNetTiming>): void {
  const { quietFor, warnFor, sweepFor } = timing;
  if (!Number.isFinite(quietFor) || !(quietFor >= 0)) {
    throw new RangeError(`dragNetSpawn: ${id} quietFor must be finite and at least 0, got ${quietFor}`);
  }
  if (!Number.isFinite(warnFor) || !(warnFor > 0)) {
    throw new RangeError(`dragNetSpawn: ${id} warnFor must be finite and greater than 0, got ${warnFor}`);
  }
  if (!Number.isFinite(sweepFor) || !(sweepFor > 0)) {
    throw new RangeError(`dragNetSpawn: ${id} sweepFor must be finite and greater than 0, got ${sweepFor}`);
  }
}

/** The hollows as HazardRects. Throws RangeError unless there are exactly 2, each finite, not empty and inside the stretch. */
function checkedHollows(id: string, hollows: readonly DragNetRect[], stretch: Readonly<HazardRect>): [HazardRect, HazardRect] {
  if (hollows.length !== 2) {
    throw new RangeError(`dragNetSpawn: ${id} needs exactly 2 hollows, got ${hollows.length}`);
  }
  const built = hollows.map((hollow, index) => checkedRect(id, `hollow ${index + 1}`, hollow));
  for (const [index, hollow] of built.entries()) {
    if (hollow.x0 < stretch.x0 || hollow.x1 > stretch.x1 || hollow.y0 < stretch.y0 || hollow.y1 > stretch.y1) {
      throw new RangeError(`dragNetSpawn: ${id} hollow ${index + 1} x ${hollow.x0}..${hollow.x1}, y ${hollow.y0}..${hollow.y1} is not inside the stretch`);
    }
  }
  return [built[0], built[1]];
}

/**
 * A drag net element (DRAG_NET) on `plan`, `offset` seconds into its cycle clock: the cycle starts
 * its quiet at `offset` and every dragNetPeriod after. `timing` defaults to DRAG_NETS. Throws
 * RangeError for a stretch or hollow that is not finite or is empty, a hollow count other than 2, a
 * hollow not inside the stretch, a timing value out of range (checkTiming) or an offset that is not
 * finite.
 */
export function dragNetSpawn(
  id: string,
  offset: number,
  plan: Readonly<DragNetPlan>,
  timing: Readonly<DragNetTiming> = DRAG_NETS,
): DragNetSpawn {
  const stretch = checkedRect(id, 'stretch', plan.stretch);
  const hollows = checkedHollows(id, plan.hollows, stretch);
  checkTiming(id, timing);
  if (!Number.isFinite(offset)) {
    throw new RangeError(`dragNetSpawn: ${id} offset must be finite, got ${offset}`);
  }
  const { quietFor, warnFor, sweepFor } = timing;
  return { id, type: DRAG_NET, offset, dragNet: { stretch, sweep: plan.sweep, hollows, timing: { quietFor, warnFor, sweepFor } } };
}

/** Seconds in one full cycle of the net: its quiet, warning and sweep. */
export function dragNetPeriod(net: Readonly<DragNetSpawn>): number {
  const { quietFor, warnFor, sweepFor } = net.dragNet.timing;
  return quietFor + warnFor + sweepFor;
}

/** Seconds into the current cycle at element time `t`, from 0 up to the period. */
function cycleTime(net: Readonly<DragNetSpawn>, t: number): number {
  const period = dragNetPeriod(net);
  return (((t - net.offset) % period) + period) % period;
}

/**
 * The part of the cycle at element time `t`: 'quiet' for the first `quietFor` seconds from `offset`,
 * 'warn' for the next `warnFor`, then 'sweep' to the end of the period. The cycle repeats every
 * dragNetPeriod; any finite `t` is valid, negative included. Element time is always finite, so a
 * non-finite `t` is not checked for.
 */
export function dragNetPhase(net: Readonly<DragNetSpawn>, t: number): DragNetPhase {
  const { quietFor, warnFor } = net.dragNet.timing;
  const local = cycleTime(net, t);
  if (local < quietFor) return 'quiet';
  if (local < quietFor + warnFor) return 'warn';
  return 'sweep';
}

/**
 * Which sweep element time `t` is in: the whole cycles since `offset`, rounded down, so it changes
 * once per cycle, at the start of each quiet. A caller keeps the number of the last sweep that caught
 * to land at most one catch per sweep.
 */
export function sweepNumber(net: Readonly<DragNetSpawn>, t: number): number {
  return Math.floor((t - net.offset) / dragNetPeriod(net));
}

/** The front's start and end along its axis: x for a 'left' or 'right' sweep, else y. */
function frontSpan(net: Readonly<DragNetStretch>): { from: number; to: number } {
  const { stretch, sweep } = net;
  if (sweep === 'right') return { from: stretch.x0, to: stretch.x1 };
  if (sweep === 'left') return { from: stretch.x1, to: stretch.x0 };
  if (sweep === 'down') return { from: stretch.y0, to: stretch.y1 };
  return { from: stretch.y1, to: stretch.y0 };
}

/** The point's place along the front's axis: x for a 'left' or 'right' sweep, else y. */
function alongAxis(net: Readonly<DragNetStretch>, pos: Readonly<Point>): number {
  return net.sweep === 'left' || net.sweep === 'right' ? pos.x : pos.y;
}

/** The share, 0 at the start edge to 1 at the end edge, of the front's way to `coord`, clamped to 0..1. */
function frontShareTo(net: Readonly<DragNetStretch>, coord: number): number {
  const { from, to } = frontSpan(net);
  return Math.min(1, Math.max(0, (coord - from) / (to - from)));
}

/**
 * The sweep front's place across the stretch at element time `t`, along its axis (x for a 'left' or
 * 'right' sweep, else y), or null outside the sweep. It moves at a steady speed from the start edge
 * at the start of the sweep towards the end edge, which it reaches as the cycle ends.
 */
export function sweepFront(net: Readonly<DragNetSpawn>, t: number): number | null {
  const { quietFor, warnFor, sweepFor } = net.dragNet.timing;
  const local = cycleTime(net, t);
  if (local < quietFor + warnFor) return null;
  const { from, to } = frontSpan(net.dragNet);
  return from + (to - from) * Math.min(1, (local - quietFor - warnFor) / sweepFor);
}

/** True when the axolotl centre `pos` is in one of the net's hollows, edges included. */
export function inDragNetHollow(net: Readonly<DragNetSpawn>, pos: Readonly<Point>): boolean {
  return net.dragNet.hollows.some((hollow) => inRect(pos, hollow));
}

/**
 * The sweep number (sweepNumber) when the net catches the axolotl centre `pos` at element time `t`,
 * else null. It catches only in the sweep, with `pos` inside the stretch (edges included), the front
 * at or past `pos` and `pos` in no hollow, and only when `caughtSweep`, the number of the last sweep
 * that caught (null for none), is not this sweep. The caller lands one hit, sourceId 'drag-net', and
 * keeps the returned number as its new `caughtSweep`. There is no Tail Dash input: dashing gives no
 * immunity. It reads `pos` only and never moves, holds or traps the axolotl.
 */
export function dragNetCatch(net: Readonly<DragNetSpawn>, pos: Readonly<Point>, t: number, caughtSweep: number | null): number | null {
  const front = sweepFront(net, t);
  if (front === null) return null;
  const sweep = sweepNumber(net, t);
  if (sweep === caughtSweep) return null;
  if (!inRect(pos, net.dragNet.stretch) || inDragNetHollow(net, pos)) return null;
  const { from, to } = frontSpan(net.dragNet);
  const swept = (alongAxis(net.dragNet, pos) - front) * (to - from) <= 0;
  return swept ? sweep : null;
}

/** The stretch the net sweeps, as a HazardRect: what the snacks and stranding places keep out of and the hiding risk counts. */
export function dragNetSweep(net: Readonly<DragNetSpawn>): HazardRect {
  const { x0, x1, y0, y1 } = net.dragNet.stretch;
  return { kind: 'rect', x0, x1, y0, y1 };
}

/** Seconds from the start of the warning until the front reaches `pos`'s place along its axis. */
function frontArrival(net: Readonly<DragNetStretch>, pos: Readonly<Point>): number {
  return net.timing.warnFor + net.timing.sweepFor * frontShareTo(net, alongAxis(net, pos));
}

/** The point of the rect nearest to `pos`; `pos` itself when it is inside. */
function nearestInRect(pos: Readonly<Point>, rect: Readonly<HazardRect>): Point {
  return { x: Math.min(rect.x1, Math.max(rect.x0, pos.x)), y: Math.min(rect.y1, Math.max(rect.y0, pos.y)) };
}

/** The nearest point on each edge of the stretch past which there is still water in `bounds`: where `pos` leaves the stretch. */
function exitPoints(stretch: Readonly<HazardRect>, pos: Readonly<Point>, bounds: Readonly<SwimBounds>): Point[] {
  const exits: Point[] = [];
  if (stretch.x0 > bounds.minX) exits.push({ x: stretch.x0, y: pos.y });
  if (stretch.x1 < bounds.maxX) exits.push({ x: stretch.x1, y: pos.y });
  if (stretch.y0 > bounds.minY) exits.push({ x: pos.x, y: stretch.y0 });
  if (stretch.y1 < bounds.maxY) exits.push({ x: pos.x, y: stretch.y1 });
  return exits;
}

/**
 * True when a one-leg axolotl (SWIM.maxSpeed times legSpeedFactor(1)) whose centre is at `pos` in the
 * stretch, starting to swim at the start of the warning, reaches a hollow or leaves the stretch
 * before the front reaches it. It swims straight to the nearest point of a hollow, or of a stretch
 * edge with water past it in `bounds`. On a straight swim the gap between the axolotl and the front
 * changes at a steady rate once the front moves, so the swim is safe when it ends before the front
 * reaches its end point.
 */
export function canEscapeDragNet(net: Readonly<DragNetSpawn>, pos: Readonly<Point>, bounds: Readonly<SwimBounds>): boolean {
  const speed = SWIM.maxSpeed * legSpeedFactor(1);
  const { stretch, hollows } = net.dragNet;
  const targets = [...hollows.map((hollow) => nearestInRect(pos, hollow)), ...exitPoints(stretch, pos, bounds)];
  return targets.some((target) => Math.hypot(target.x - pos.x, target.y - pos.y) / speed < frontArrival(net.dragNet, target));
}

/**
 * The first point, on a grid every `step` px across the stretch with its far edges included, from
 * which a one-leg axolotl cannot escape the net (canEscapeDragNet), or null when the net is fair from
 * every grid point. Throws RangeError for a `step` that is not finite and greater than 0.
 */
export function dragNetUnfairPoint(net: Readonly<DragNetSpawn>, bounds: Readonly<SwimBounds>, step = 8): Point | null {
  if (!Number.isFinite(step) || !(step > 0)) {
    throw new RangeError(`dragNetUnfairPoint: step must be finite and greater than 0, got ${step}`);
  }
  const { x0, x1, y0, y1 } = net.dragNet.stretch;
  const xs = gridStops(x0, x1, step);
  const ys = gridStops(y0, y1, step);
  for (const x of xs) {
    for (const y of ys) {
      if (!canEscapeDragNet(net, { x, y }, bounds)) return { x, y };
    }
  }
  return null;
}

/** Stops every `step` from `from`, with `to` always last. */
function gridStops(from: number, to: number, step: number): number[] {
  const stops: number[] = [];
  for (let at = from; at < to; at += step) stops.push(at);
  stops.push(to);
  return stops;
}
