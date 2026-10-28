/**
 * Pure rock wall and pebble rules (issue #105, ND-8): solid rock that the axolotl's body never
 * enters, and the pebble puzzle. A big round pebble sits in the doorway of a walled side room. The
 * axolotl pushes it by swimming into it from behind, and it rolls slowly along its fixed groove in
 * one direction only, from its start to its end, so it can never get stuck; once rolled, it stays.
 * After `hintAfter` seconds near the pebble without moving it, the hint arrow shows the way to push.
 * The pebble is trip state only: a new trip starts with every pebble at its start.
 */
import type { ElementSpawn, ElementType, PebbleGroove } from './hazards';
import { GHOST_NETS } from './tuning';
import type { Point } from './zone';

/** A solid rock wall (issue #105, ND-8), in world px. Inclusive edges; `x0 < x1` and `y0 < y1`. */
export interface RockWall {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Pebble and rock wall tuning (issue #105, ND-8). */
export interface PebbleTuning {
  /** Distance in px from the body centre to the body edge that meets rock or the pebble. */
  bodyReach: number;
  /** Speed in px/s the pebble rolls at while pushed. */
  rollSpeed: number;
  /** Distance in px from the pebble's edge within which the axolotl is near it, for the hint. */
  hintRange: number;
  /** Seconds near the pebble without moving it before the hint shows. */
  hintAfter: number;
}

/**
 * Provisional pebble values (issue #105, ND-8); tune in play. The pebble rolls at 40 px/s, slowly,
 * and the hint shows after the owner's 10 s within 160 px of the pebble's edge. bodyReach is the
 * ghost net reach, the Medium body's half height, as for the mats and the glow-plants.
 */
export const PEBBLES: Readonly<PebbleTuning> = Object.freeze({
  bodyReach: GHOST_NETS.reach,
  rollSpeed: 40,
  hintRange: 160,
  hintAfter: 10,
});

/**
 * The pebble (issue #105, ND-8), a puzzle element: always active (`activeFor` equals `period`),
 * with no fact card and no meet range, so it is never met. It has no sweep (elementSweep), so it is
 * never a mat, never counts as a hazard for the snacks and never costs a leg; it only blocks the
 * axolotl. Each spawn carries its own `pebble` groove.
 */
export const PEBBLE: Readonly<ElementType> = Object.freeze({
  id: 'pebble',
  name: 'Pebble',
  kind: 'puzzle',
  period: 1,
  activeFor: 1,
});

/** One pebble's trip state: its element id and how far in px along its groove it has rolled. */
export interface PebbleState {
  readonly id: string;
  readonly along: number;
}

/** What one swim step did against the rock and the pebbles: where the body ends and the pebbles' state. */
export interface PebbleStep {
  pos: Point;
  pebbles: readonly PebbleState[];
}

/** One step of the hint clock (issue #105, ND-8). */
export interface PebbleHintStep {
  /** Game seconds since the last step; at least 0. */
  dt: number;
  /** True when the axolotl's body centre is near an unrolled pebble (nearUnrolledPebble). */
  near: boolean;
  /** True when this step rolled a pebble. */
  rolled: boolean;
  /** True while the clock holds: the game is paused, the banking card is up or the carry home runs. */
  paused: boolean;
}

type ElementWithPebble = Readonly<ElementSpawn> & { readonly pebble: Readonly<PebbleGroove> };

/** The groove's length in px. */
export function grooveLength(groove: Readonly<PebbleGroove>): number {
  return Math.hypot(groove.x1 - groove.x0, groove.y1 - groove.y0);
}

/**
 * A pebble element (PEBBLE) on `groove`. Throws RangeError for a place that is not finite, a radius
 * not greater than 0 or a groove of no length.
 */
export function pebbleSpawn(id: string, groove: Readonly<PebbleGroove>): ElementSpawn {
  const { x0, y0, x1, y1, radius } = groove;
  if (![x0, y0, x1, y1].every(Number.isFinite)) {
    throw new RangeError(`pebbleSpawn: ${id} needs a finite groove, got (${x0}, ${y0}) to (${x1}, ${y1})`);
  }
  if (!(radius > 0) || !Number.isFinite(radius)) {
    throw new RangeError(`pebbleSpawn: ${id} radius must be > 0, got ${radius}`);
  }
  if (!(grooveLength(groove) > 0)) {
    throw new RangeError(`pebbleSpawn: ${id} groove must have a length`);
  }
  return { id, type: PEBBLE, offset: 0, pebble: { x0, y0, x1, y1, radius } };
}

/** The elements that are pebbles, in element order, with their grooves. */
export function pebbles(elements: readonly Readonly<ElementSpawn>[]): ElementWithPebble[] {
  return elements.filter((element): element is ElementWithPebble => element.pebble !== undefined);
}

/** Every pebble at the start of its groove, in element order: a new trip's pebbles. */
export function createPebbles(elements: readonly Readonly<ElementSpawn>[]): PebbleState[] {
  return pebbles(elements).map((element) => ({ id: element.id, along: 0 }));
}

/** The pebble's centre `along` px along its groove, clamped to the groove. */
export function pebbleCentre(groove: Readonly<PebbleGroove>, along: number): Point {
  const length = grooveLength(groove);
  const share = Math.min(1, Math.max(0, along / length));
  return { x: groove.x0 + share * (groove.x1 - groove.x0), y: groove.y0 + share * (groove.y1 - groove.y0) };
}

/** True when the pebble has rolled the whole groove. */
export function pebbleRolled(groove: Readonly<PebbleGroove>, along: number): boolean {
  return along >= grooveLength(groove);
}

/** The unit step from the groove's start to its end: the way the pebble rolls. */
export function rollDirection(groove: Readonly<PebbleGroove>): Point {
  const length = grooveLength(groove);
  return { x: (groove.x1 - groove.x0) / length, y: (groove.y1 - groove.y0) / length };
}

/** True when the body centred on `pos` is inside the rock wall grown by the body reach (edges are clear). */
export function bodyInRock(pos: Readonly<Point>, wall: Readonly<RockWall>, tuning: Pick<PebbleTuning, 'bodyReach'> = PEBBLES): boolean {
  const reach = tuning.bodyReach;
  return pos.x > wall.x0 - reach && pos.x < wall.x1 + reach && pos.y > wall.y0 - reach && pos.y < wall.y1 + reach;
}

/** True when the body centred on `pos` is in any of the walls (bodyInRock). */
export function bodyInAnyRock(pos: Readonly<Point>, walls: readonly Readonly<RockWall>[], tuning: Pick<PebbleTuning, 'bodyReach'> = PEBBLES): boolean {
  return walls.some((wall) => bodyInRock(pos, wall, tuning));
}

/** The point nearest `pos` on the edge of the wall grown by the body reach, out the shortest way. */
function outOfRock(pos: Readonly<Point>, wall: Readonly<RockWall>, reach: number): Point {
  const left = pos.x - (wall.x0 - reach);
  const right = wall.x1 + reach - pos.x;
  const up = pos.y - (wall.y0 - reach);
  const down = wall.y1 + reach - pos.y;
  const least = Math.min(left, right, up, down);
  if (least === left) return { x: wall.x0 - reach, y: pos.y };
  if (least === right) return { x: wall.x1 + reach, y: pos.y };
  if (least === up) return { x: pos.x, y: wall.y0 - reach };
  return { x: pos.x, y: wall.y1 + reach };
}

/**
 * The swim step from `prev` to `next` stopped at the rock (issue #105, ND-8): each axis moves on its
 * own, x first, and stops at a wall's grown edge when it would go in. A body already in rock, as at
 * a bad start, is put out the shortest way first. Returns `next` itself when no wall is in the way,
 * so it can run every frame. A step is never longer than a wall is thick, so it never goes through.
 */
export function blockAtRock(
  prev: Readonly<Point>,
  next: Readonly<Point>,
  walls: readonly Readonly<RockWall>[],
  tuning: Pick<PebbleTuning, 'bodyReach'> = PEBBLES,
): Readonly<Point> {
  if (walls.length === 0 || !bodyInAnyRock(next, walls, tuning)) return next;
  const reach = tuning.bodyReach;
  let from: Point = { x: prev.x, y: prev.y };
  for (const wall of walls) if (bodyInRock(from, wall, tuning)) from = outOfRock(from, wall, reach);
  let x = next.x;
  for (const wall of walls) {
    if (!bodyInRock({ x, y: from.y }, wall, tuning)) continue;
    x = x > from.x ? wall.x0 - reach : wall.x1 + reach;
  }
  let y = next.y;
  for (const wall of walls) {
    if (!bodyInRock({ x, y }, wall, tuning)) continue;
    y = y > from.y ? wall.y0 - reach : wall.y1 + reach;
  }
  return { x, y };
}

/** True when the body centred on `pos` is touching the pebble at `centre` (closer than its radius plus the body reach). */
export function bodyTouchesPebble(
  pos: Readonly<Point>,
  centre: Readonly<Point>,
  radius: number,
  tuning: Pick<PebbleTuning, 'bodyReach'> = PEBBLES,
): boolean {
  return Math.hypot(pos.x - centre.x, pos.y - centre.y) < radius + tuning.bodyReach;
}

/** `pos` put out of the pebble at `centre` along the line from its centre, to its radius plus the body reach. */
function outOfPebble(pos: Readonly<Point>, centre: Readonly<Point>, radius: number, back: Readonly<Point>, reach: number): Point {
  const dx = pos.x - centre.x;
  const dy = pos.y - centre.y;
  const distance = Math.hypot(dx, dy);
  const keep = radius + reach;
  if (distance === 0) return { x: centre.x - back.x * keep, y: centre.y - back.y * keep };
  return { x: centre.x + (dx / distance) * keep, y: centre.y + (dy / distance) * keep };
}

/**
 * One swim step against the pebbles (issue #105, ND-8): the body moving from `prev` to `next`.
 * A pebble that the body touches at `next` rolls on when the body comes from behind it (`prev` is
 * behind the pebble's centre along its groove) and moves forward along it: by at most `rollSpeed`
 * × `dt`, and never past the groove's end. Then the body is put out of every pebble it is in.
 * Returns the step's own objects when nothing touches, so it can run every frame.
 */
export function stepPebbles(
  states: readonly PebbleState[],
  elements: readonly Readonly<ElementSpawn>[],
  prev: Readonly<Point>,
  next: Readonly<Point>,
  dt: number,
  tuning: Readonly<PebbleTuning> = PEBBLES,
): PebbleStep {
  let pos: Point = { x: next.x, y: next.y };
  let changed = false;
  const after = states.map((state) => {
    const element = elements.find((candidate) => candidate.id === state.id);
    if (!element?.pebble) return state;
    const groove = element.pebble;
    const centre = pebbleCentre(groove, state.along);
    if (!bodyTouchesPebble(pos, centre, groove.radius, tuning)) return state;
    const dir = rollDirection(groove);
    const behind = (prev.x - centre.x) * dir.x + (prev.y - centre.y) * dir.y < 0;
    const forward = (next.x - prev.x) * dir.x + (next.y - prev.y) * dir.y > 0;
    let along = state.along;
    if (behind && forward && dt > 0 && !pebbleRolled(groove, along)) {
      along = Math.min(grooveLength(groove), along + tuning.rollSpeed * dt);
    }
    pos = outOfPebble(pos, pebbleCentre(groove, along), groove.radius, dir, tuning.bodyReach);
    changed = true;
    return along === state.along ? state : { id: state.id, along };
  });
  if (!changed) return { pos: next as Point, pebbles: states };
  return { pos, pebbles: after.some((state, i) => state !== states[i]) ? after : states };
}

/**
 * True when the body centred on `pos` is near a pebble that has not rolled at all (issue #105,
 * ND-8): within `hintRange` px of its edge.
 */
export function nearUnrolledPebble(
  pos: Readonly<Point>,
  states: readonly PebbleState[],
  elements: readonly Readonly<ElementSpawn>[],
  tuning: Pick<PebbleTuning, 'hintRange'> = PEBBLES,
): boolean {
  return states.some((state) => {
    if (state.along > 0) return false;
    const groove = elements.find((element) => element.id === state.id)?.pebble;
    if (!groove) return false;
    const centre = pebbleCentre(groove, 0);
    return Math.hypot(pos.x - centre.x, pos.y - centre.y) <= groove.radius + tuning.hintRange;
  });
}

/**
 * The hint clock after one step (issue #105, ND-8): seconds near an unrolled pebble without moving
 * it. It holds while paused, goes back to 0 when the axolotl leaves or a pebble rolls, and otherwise
 * adds `dt`. Throws RangeError for a negative or non-finite `dt`.
 */
export function stepPebbleHintClock(seconds: number, step: Readonly<PebbleHintStep>): number {
  if (!(step.dt >= 0) || !Number.isFinite(step.dt)) {
    throw new RangeError(`stepPebbleHintClock: dt must be a finite number >= 0, got ${step.dt}`);
  }
  if (step.paused) return seconds;
  if (!step.near || step.rolled) return 0;
  return seconds + step.dt;
}

/** True when the hint shows: the hint clock has reached `hintAfter` (issue #105, ND-8). */
export function pebbleHintShown(seconds: number, tuning: Pick<PebbleTuning, 'hintAfter'> = PEBBLES): boolean {
  return seconds >= tuning.hintAfter;
}
