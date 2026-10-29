import {
  CARP_FACT,
  CARP_MEET_RANGE,
  CRAYFISH_FACT,
  CRAYFISH_MEET_RANGE,
  GARTER_SNAKE_FACT,
  GARTER_SNAKE_MEET_RANGE,
  HERON_FACT,
  HERON_MEET_RANGE,
  TILAPIA_FACT,
  TILAPIA_MEET_RANGE,
  type FactCard,
} from './factCards';
import { CARP, CRAYFISH, GARTER_SNAKE, HERON, LEGS, SWIM, TILAPIA, type ChaseTuning, type TilapiaTuning } from './tuning';
import { normalize, scale, type Vec2 } from './vec';
import { inSafeArea, type Point, type SafeArea, type SwimBounds, type TilapiaRoute } from './zone';

/** Predator phase. `telegraph` is the warning and `lunge` is the strike. */
export type PredatorPhase = 'patrol' | 'telegraph' | 'lunge' | 'cooldown';

/** Patrol, warning and strike tuning of one predator species. */
export type PredatorTuning = TilapiaTuning;

/**
 * Species rule hook. `mayWarn` gates only the start of a warning and the re-check at the end of
 * the warning: false keeps a patrolling predator patrolling, and cancels a warning at its end.
 * Absent, or absent `mayWarn`, means always allowed.
 */
export interface PredatorRuleHook {
  mayWarn?(from: Point, target: Point): boolean;
}

/**
 * Shared rules a species may opt into; each absent or false keeps the tilapia's behaviour.
 * `sightCover`: the predator hunts by sight and cannot see a target in cover (`targetInCover` in
 * the context). It does not warn at it, cancels a warning whose target is in cover at the end of
 * the warning, and its strike never connects with it.
 * `fixedStrikeSpot`: the strike spot is the target's place at warning start, kept in
 * `PredatorState.strikeSpot`. The predator holds its position through the warning and strike; the
 * strike is a stab whose tip (`stabTip`) moves from the predator to that spot.
 * `stillCooldown`: through the cooldown the predator stands still, facing the target, instead of
 * swimming its route.
 * `warnOnRoute`: the predator warns only while it is on its route, within `ROUTE_WARN_TOLERANCE`
 * of it as a closed loop (`routeLoopDistance`, inclusive). Off its route, for example after a
 * strike carried it away, it does not warn and cancels a warning at its end; it swims its route
 * through the cooldown and patrol, and may warn again once back on it. A one-waypoint route counts
 * as on route only at that point.
 * `levelStrike` (issue #77, ND-5): the aim locked at the end of the warning is level, straight left
 * or right toward the target (the strike spot with `fixedStrikeSpot`), along the facing when the
 * target is straight above or below. The strike never moves the predator up or down, so it reaches
 * only a target within hitRadius of the predator's height.
 */
export interface PredatorRules {
  sightCover?: boolean;
  fixedStrikeSpot?: boolean;
  stillCooldown?: boolean;
  warnOnRoute?: boolean;
  levelStrike?: boolean;
}

/** How far in px a predator with the `warnOnRoute` rule may be from its route and still warn (inclusive). */
export const ROUTE_WARN_TOLERANCE = 2;

/**
 * One predator species: its tuning, meet range in px, fact card, optional rule hook and optional
 * shared rules. `neverTouches` true means the predator never touches or bumps the axolotl, whatever
 * its contactRadius; absent means it may. `dangerPart` true marks a danger part (PRD open question
 * 260, ND-13); absent means it is not one.
 */
export interface PredatorSpecies {
  id: string;
  name: string;
  tuning: PredatorTuning;
  meetRange: number;
  fact: FactCard;
  hook?: PredatorRuleHook;
  rules?: Readonly<PredatorRules>;
  neverTouches?: boolean;
  dangerPart?: true;
}

/** A patrol route carrying the species that swims it. */
export type PredatorRoute = TilapiaRoute & { species: Readonly<PredatorSpecies> };

/**
 * Predator state. Immutable: `stepPredator` returns a new object.
 * `species` is the species id. `elapsed` is seconds spent in the current phase and `duration` is
 * that phase's length in seconds, locked on entry (0 for patrol, which has no end).
 * `aim` is the unit strike direction, locked at strike start; it is null outside the lunge phase.
 * `strikeSpot` is for a species with the `fixedStrikeSpot` rule only: where its strike goes, fixed
 * at warning start and kept through the warning and strike. It is absent in every other phase and
 * on every other species.
 */
export interface PredatorState {
  species: string;
  routeId: string;
  waypoints: readonly Point[];
  waypointIndex: number;
  pos: Point;
  facing: -1 | 1;
  phase: PredatorPhase;
  elapsed: number;
  duration: number;
  aim: Point | null;
  strikeSpot?: Point;
}

/** Phase events emitted by `stepPredator`, in the order they happened within the step. */
export type PredatorEvent =
  | { type: 'telegraphStart' }
  | { type: 'telegraphCancel' }
  | { type: 'lungeStart'; aim: Point }
  | { type: 'lungeEnd'; connected: boolean }
  | { type: 'cooldownEnd' };

/** World context a predator step needs. `bounds` limits the predator centre. */
export interface PredatorContext {
  safeArea: SafeArea;
  bounds: SwimBounds;
  tuning: PredatorTuning;
  /**
   * When true, a patrolling predator does not start a warning this step because another
   * predator is already warning or striking. Absent means false.
   */
  telegraphBlocked?: boolean;
  /** Species rule hook; absent means no extra rule. */
  hook?: PredatorRuleHook;
  /** Species shared rules; absent means none. */
  rules?: Readonly<PredatorRules>;
  /** Whether the target is in sight cover this step; read only with the `sightCover` rule. Absent means false. */
  targetInCover?: boolean;
}

export interface PredatorStepResult {
  state: PredatorState;
  events: PredatorEvent[];
}

interface PhaseStep {
  state: PredatorState;
  used: number;
  event: PredatorEvent | null;
}

const MAX_PHASE_STEPS = 8;
const PROGRESS_EPSILON = 1e-9;
/**
 * Slack in px for the chase: a chase stops this far inside the lungeRange, so float error never
 * leaves it just outside reach, and a chaser counts as within its leash up to this far past it.
 */
const CHASE_TOLERANCE = 1e-6;

/** The tilapia, the first predator species. */
export const TILAPIA_SPECIES: Readonly<PredatorSpecies> = Object.freeze({
  id: 'tilapia',
  name: 'Tilapia',
  tuning: TILAPIA,
  meetRange: TILAPIA_MEET_RANGE,
  fact: TILAPIA_FACT,
});

/**
 * The heron, a wading stalker (PRD N3, issue #111): it hunts by sight and cannot see into cover,
 * stabs the spot fixed at its warning start from where it stands, stands still through its
 * cooldown, and never touches or bumps.
 */
export const HERON_SPECIES: Readonly<PredatorSpecies> = Object.freeze({
  id: 'heron',
  name: 'Heron',
  tuning: HERON,
  meetRange: HERON_MEET_RANGE,
  fact: HERON_FACT,
  rules: Object.freeze({ sightCover: true, fixedStrikeSpot: true, stillCooldown: true }),
  neverTouches: true,
});

/**
 * The garter snake (issue #103): it swims its stretch at the surface and plays the tilapia's shared
 * rules with its own tuning. It warns when the axolotl is within reach of its head, darts along the
 * aim locked at the end of the warning, swims its route through the cooldown and bumps gently.
 * With the `warnOnRoute` rule (owner decision on #103, 2026-10-23, option 1) it warns only while
 * its head is on its stretch: after a dart it swims back to the line before it can warn again, so
 * repeated dives never walk it deeper. The dart itself is unchanged and has no depth cap.
 */
export const GARTER_SNAKE_SPECIES: Readonly<PredatorSpecies> = Object.freeze({
  id: 'garter-snake',
  name: 'Garter snake',
  tuning: GARTER_SNAKE,
  meetRange: GARTER_SNAKE_MEET_RANGE,
  fact: GARTER_SNAKE_FACT,
  rules: Object.freeze({ warnOnRoute: true }),
});

/**
 * The common carp (PRD open question 253, ND-6): it plays the shared rules with its own tuning and
 * no rule options, and is a danger part (PRD open question 260, ND-13).
 */
export const CARP_SPECIES: Readonly<PredatorSpecies> = Object.freeze({
  id: 'carp',
  name: 'Common carp',
  tuning: CARP,
  meetRange: CARP_MEET_RANGE,
  fact: CARP_FACT,
  dangerPart: true,
});

/**
 * The crayfish (issue #77, ND-5): it walks its floor stretch and plays the shared rules with its own
 * tuning. It warns by distance, opening its claws, when the axolotl is within reach of it, then
 * pinches along the aim locked at the end of the warning, straight at the axolotl's place then, up
 * off the floor included, so an axolotl hovering above it within reach is pinched. It swims its
 * route through the cooldown and bumps gently. With the `warnOnRoute` rule it warns only while on
 * its stretch, so a chase stays along the stretch and, after a pinch carried it off, it walks back
 * onto its stretch before it warns again. Swimming away when the claws open avoids the pinch.
 */
export const CRAYFISH_SPECIES: Readonly<PredatorSpecies> = Object.freeze({
  id: 'crayfish',
  name: 'Crayfish',
  tuning: CRAYFISH,
  meetRange: CRAYFISH_MEET_RANGE,
  fact: CRAYFISH_FACT,
  rules: Object.freeze({ warnOnRoute: true }),
});

/** Every predator species. */
export const PREDATOR_SPECIES: readonly Readonly<PredatorSpecies>[] = Object.freeze([
  TILAPIA_SPECIES,
  HERON_SPECIES,
  CRAYFISH_SPECIES,
  GARTER_SNAKE_SPECIES,
  CARP_SPECIES,
]);

/**
 * `species` played with `tuning` (PRD open questions 248 and 250, ND-1 and ND-3): the same id, name,
 * meet range, fact card, hook and rules. Throws a RangeError when the tuning's chase is outside its
 * limits, or when it gives a chase to a species with the `fixedStrikeSpot` or `stillCooldown` rule.
 */
export function tunedSpecies(
  species: Readonly<PredatorSpecies>,
  tuning: Readonly<PredatorTuning>,
): Readonly<PredatorSpecies> {
  if (tuning.chase) {
    if (species.rules?.fixedStrikeSpot || species.rules?.stillCooldown) {
      throw new RangeError(`tunedSpecies: ${species.id} cannot chase`);
    }
    checkChaseLimits(species.id, tuning.chase, tuning);
  }
  return Object.freeze({ ...species, tuning });
}

/**
 * Throws a RangeError unless the chase speed is strictly between the 2-leg and 4-leg top speeds,
 * the sight is finite and greater than the lungeRange, and the leash is finite and 0 or more.
 */
function checkChaseLimits(speciesId: string, chase: Readonly<ChaseTuning>, tuning: Readonly<PredatorTuning>): void {
  const slowest = SWIM.maxSpeed * LEGS.speedByLegs[1];
  const fastest = SWIM.maxSpeed * LEGS.speedByLegs[LEGS.count - 1];
  if (!(chase.speed > slowest && chase.speed < fastest)) {
    throw new RangeError(`tunedSpecies: ${speciesId} chase speed ${chase.speed} is not between ${slowest} and ${fastest}`);
  }
  if (!(Number.isFinite(chase.sight) && chase.sight > tuning.lungeRange)) {
    throw new RangeError(`tunedSpecies: ${speciesId} chase sight ${chase.sight} is not greater than lungeRange ${tuning.lungeRange}`);
  }
  if (!(Number.isFinite(chase.leash) && chase.leash >= 0)) {
    throw new RangeError(`tunedSpecies: ${speciesId} chase leash ${chase.leash} is not 0 or more`);
  }
}

/** Creates a patrolling predator of `speciesId` at the route's first waypoint, heading for the second. */
export function createPredator(route: TilapiaRoute, speciesId: string): PredatorState {
  if (route.waypoints.length === 0) {
    throw new Error(`createPredator: route ${route.id} has no waypoints`);
  }
  const waypoints = route.waypoints.map((point) => ({ x: point.x, y: point.y }));
  return {
    species: speciesId,
    routeId: route.id,
    waypoints,
    waypointIndex: waypoints.length > 1 ? 1 : 0,
    pos: { ...waypoints[0] },
    facing: 1,
    phase: 'patrol',
    elapsed: 0,
    duration: 0,
    aim: null,
  };
}

/**
 * Whether the centre distance from `from` to `target` is within lunge range.
 * Inclusive: a distance of exactly `lungeRange` counts as in range.
 */
export function inLungeRange(from: Point, target: Point, tuning: PredatorTuning = TILAPIA): boolean {
  return distance(from, target) <= tuning.lungeRange;
}

/**
 * Whether a strike connects: lunge phase only, distance from the striking point (`stabTip`: the
 * predator centre, or a stab's tip) to the target centre within `hitRadius` (inclusive).
 */
export function lungeConnects(
  state: PredatorState,
  target: Point,
  tuning: PredatorTuning = TILAPIA,
): boolean {
  return state.phase === 'lunge' && distance(stabTip(state), target) <= tuning.hitRadius;
}

/**
 * The striking point. During the strike of a predator with a fixed strike spot (a stab), the tip
 * moves in a straight line from the predator's position to the spot over the strike: the share
 * elapsed / duration of the way, all of it for a strike with no duration. In every other case it
 * is the predator's position.
 */
export function stabTip(state: PredatorState): Point {
  const spot = state.strikeSpot;
  if (state.phase !== 'lunge' || !spot) return { x: state.pos.x, y: state.pos.y };
  const share = state.duration > 0 ? Math.min(1, Math.max(0, state.elapsed / state.duration)) : 1;
  return {
    x: state.pos.x + (spot.x - state.pos.x) * share,
    y: state.pos.y + (spot.y - state.pos.y) * share,
  };
}

/**
 * Whether a non-striking predator touches the target: centre distance within `contactRadius`
 * (inclusive).
 * Always false during a lunge, so a touch never doubles as a hit.
 */
export function touching(
  state: PredatorState,
  target: Point,
  tuning: PredatorTuning = TILAPIA,
): boolean {
  return state.phase !== 'lunge' && distance(state.pos, target) <= tuning.contactRadius;
}

/**
 * Velocity in px/s to give the target for a gentle bump: points from the predator to the target
 * with magnitude `bumpSpeed`. When the centres coincide it points along the predator's facing.
 */
export function bumpImpulse(
  state: PredatorState,
  target: Point,
  tuning: PredatorTuning = TILAPIA,
): Vec2 {
  const direction = normalize({ x: target.x - state.pos.x, y: target.y - state.pos.y });
  if (direction.x === 0 && direction.y === 0) return { x: state.facing * tuning.bumpSpeed, y: 0 };
  return scale(direction, tuning.bumpSpeed);
}

/**
 * Shortest distance in px from a point to a route as a closed loop, the segment from the last
 * waypoint back to the first included. A one-waypoint route gives the distance to that point; no
 * waypoints give Infinity. The hiding rules measure a route threat with this (B10).
 */
export function routeLoopDistance(pos: Point, waypoints: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < waypoints.length; i++) {
    best = Math.min(best, distanceToSegment(pos, waypoints[i], waypoints[(i + 1) % waypoints.length]));
  }
  return best;
}

/** Fraction of the current phase completed, in [0, 1]; always 0 while patrolling. */
export function phaseProgress(state: PredatorState): number {
  if (state.duration <= 0) return 0;
  return Math.min(1, Math.max(0, state.elapsed / state.duration));
}

/**
 * Advances the predator by `dt` seconds, carrying leftover time across phases.
 * Non-finite or non-positive dt returns the input state unchanged with no events.
 *
 * Phases: patrol follows the route; a warning (telegraph) starts when the target is within lunge
 * range of the predator's position, outside the safe area and `ctx.hook.mayWarn` allows it,
 * unless `ctx.telegraphBlocked` is true (another predator is warning or striking), in which case it
 * keeps patrolling. The block only stops a warning from starting: a warning, strike or cooldown
 * already running is unaffected. The warning holds position for max(windup, minWindup) seconds,
 * then re-checks range, exposure and the hook (not the block): true locks the aim and starts a
 * strike (lunge), false emits `telegraphCancel` and enters cooldown. A strike moves along the locked aim at
 * `lungeSpeed` for at most `lungeDuration`; it ends early when it connects, emitting `lungeEnd`
 * with `connected: true`. The caller applies the hit on that event.
 *
 * Safe-area immunity: a strike connects only when `lungeConnects` holds after the move AND the
 * target is outside the safe area (edges count as inside, per `inSafeArea`). The same exposure
 * rule gates the warning. A strike at a sheltered target never connects: it runs its full
 * `lungeDuration` and ends with `connected: false`. Every strike end and every cancel enters a
 * full `cooldown`, during which the predator drifts back along its route; `cooldownEnd` returns
 * it to patrol.
 *
 * All movement is clamped to `bounds` and kept clear of the safe area grown by `bodyRadius`,
 * so the body never overlaps the safe area. Callers should cap dt (for example SWIM.dtMax)
 * so strike contact is sampled finely.
 *
 * Shared rules (`ctx.rules`, see `PredatorRules`): with `sightCover`, a target in cover
 * (`ctx.targetInCover`) counts as not exposed, so it gates the warning start, the end-of-warning
 * re-check and every strike step. With `fixedStrikeSpot`, warning start stores the target's place
 * as `strikeSpot`; the strike aims at that spot, the predator does not move, and the strike
 * connects when its `stabTip` is within hitRadius of an exposed target, checked every step. Leaving
 * the strike drops the spot. With `stillCooldown`, the cooldown holds position and faces the target.
 * With `warnOnRoute`, the predator must also be within `ROUTE_WARN_TOLERANCE` of its route
 * (`routeLoopDistance`) to start a warning and at the end-of-warning re-check; movement is unchanged.
 * With `levelStrike`, the aim locked at the end of the warning is level, toward the target's side.
 *
 * Chase (PRD open question 249, ND-2): only with `ctx.tuning.chase`, and only on patrol when no
 * warning starts. See `chaseStep`. Without a chase, patrol is unchanged.
 */
export function stepPredator(
  state: PredatorState,
  target: Point,
  dt: number,
  ctx: PredatorContext,
): PredatorStepResult {
  let remaining = Number.isFinite(dt) && dt > 0 ? dt : 0;
  let current = state;
  const events: PredatorEvent[] = [];
  for (let i = 0; i < MAX_PHASE_STEPS && remaining > 0; i++) {
    const step = stepPhase(current, target, remaining, ctx);
    current = step.state;
    remaining -= step.used;
    if (step.event) events.push(step.event);
  }
  return { state: current, events };
}

function stepPhase(state: PredatorState, target: Point, dt: number, ctx: PredatorContext): PhaseStep {
  switch (state.phase) {
    case 'patrol':
      return stepPatrol(state, target, dt, ctx);
    case 'telegraph':
      return stepTelegraph(state, target, dt, ctx);
    case 'lunge':
      return stepLunge(state, target, dt, ctx);
    case 'cooldown':
      return stepCooldown(state, target, dt, ctx);
  }
}

function stepPatrol(
  state: PredatorState,
  target: Point,
  dt: number,
  ctx: PredatorContext,
): PhaseStep {
  if (!ctx.telegraphBlocked && canWarn(state, target, ctx)) {
    const telegraph: PredatorState = {
      ...state,
      phase: 'telegraph',
      elapsed: 0,
      duration: warningTime(ctx.tuning),
      facing: faceToward(state.facing, target.x - state.pos.x),
    };
    if (ctx.rules?.fixedStrikeSpot) telegraph.strikeSpot = { x: target.x, y: target.y };
    return { state: telegraph, used: 0, event: { type: 'telegraphStart' } };
  }
  if (ctx.tuning.chase && mayChase(state, target, ctx.tuning.chase, ctx)) {
    return { state: chaseStep(state, target, dt, ctx.tuning.chase, ctx), used: dt, event: null };
  }
  return { state: swimRoute(state, dt, ctx), used: dt, event: null };
}

/**
 * Whether a patrolling predator chases this step: the target is exposed and within `sight` of it
 * (inclusive), and the predator is within its leash of its patrol loop. Beyond its leash it swims
 * its route instead, which brings it back.
 */
function mayChase(state: PredatorState, target: Point, chase: Readonly<ChaseTuning>, ctx: PredatorContext): boolean {
  return (
    targetExposed(target, ctx) &&
    distance(state.pos, target) <= chase.sight &&
    routeLoopDistance(state.pos, state.waypoints) <= chaseLeash(chase, ctx) + CHASE_TOLERANCE
  );
}

/** The chase leash in px: 0 for a species with the `warnOnRoute` rule, so it chases along its route only. */
function chaseLeash(chase: Readonly<ChaseTuning>, ctx: PredatorContext): number {
  return ctx.rules?.warnOnRoute ? 0 : chase.leash;
}

/**
 * One chase step: toward the target at chase `speed`, stopping at the lungeRange. A move that would
 * end past the leash ends on the leash edge, on the line from the nearest point of the patrol loop.
 * The move is then clamped as any move (`moveClamped`). A clamped end past the leash, or nearer the
 * target than both the lungeRange and the start, holds the predator where it is. It faces the way it
 * moves. The waypoint is kept, so swimming the route afterwards brings it back.
 */
function chaseStep(
  state: PredatorState,
  target: Point,
  dt: number,
  chase: Readonly<ChaseTuning>,
  ctx: PredatorContext,
): PredatorState {
  const gap = distance(state.pos, target);
  const closing = Math.max(0, Math.min(chase.speed * dt, gap - (ctx.tuning.lungeRange - CHASE_TOLERANCE)));
  const step = scale(normalize({ x: target.x - state.pos.x, y: target.y - state.pos.y }), closing);
  const leash = chaseLeash(chase, ctx);
  const leashed = withinLeash({ x: state.pos.x + step.x, y: state.pos.y + step.y }, state.waypoints, leash);
  const pos = moveClamped(state.pos, { x: leashed.x - state.pos.x, y: leashed.y - state.pos.y }, ctx);
  const nearest = Math.min(gap, ctx.tuning.lungeRange) - 2 * CHASE_TOLERANCE;
  const held =
    routeLoopDistance(pos, state.waypoints) > leash + CHASE_TOLERANCE || distance(pos, target) < nearest;
  if (held) return state;
  return { ...state, pos, facing: faceToward(state.facing, pos.x - state.pos.x) };
}

/** `pos`, or the point `leash` px from the nearest point of the loop toward `pos` when it is farther. */
function withinLeash(pos: Point, waypoints: readonly Point[], leash: number): Point {
  const near = nearestOnLoop(pos, waypoints);
  const away = Math.hypot(pos.x - near.x, pos.y - near.y);
  if (away <= leash) return pos;
  const share = leash / away;
  return { x: near.x + (pos.x - near.x) * share, y: near.y + (pos.y - near.y) * share };
}

/** The nearest point to `pos` on a route as a closed loop; `pos` itself with no waypoints. */
function nearestOnLoop(pos: Point, waypoints: readonly Point[]): Point {
  let best: Point = pos;
  let bestDistance = Infinity;
  for (let i = 0; i < waypoints.length; i++) {
    const near = nearestOnSegment(pos, waypoints[i], waypoints[(i + 1) % waypoints.length]);
    const away = Math.hypot(pos.x - near.x, pos.y - near.y);
    if (away < bestDistance) {
      best = near;
      bestDistance = away;
    }
  }
  return best;
}

/** The warning length: windup, but never below the minWindup floor. */
function warningTime(tuning: PredatorTuning): number {
  return Math.max(tuning.windup, tuning.minWindup);
}

function stepTelegraph(
  state: PredatorState,
  target: Point,
  dt: number,
  ctx: PredatorContext,
): PhaseStep {
  const used = Math.min(dt, state.duration - state.elapsed);
  const facing = faceToward(state.facing, target.x - state.pos.x);
  const elapsed = state.elapsed + used;
  if (elapsed < state.duration) {
    return { state: { ...state, elapsed, facing }, used, event: null };
  }
  if (!canWarn(state, target, ctx)) {
    const cancelled = enterCooldown({ ...state, facing }, ctx);
    return { state: cancelled, used, event: { type: 'telegraphCancel' } };
  }
  const aimAt = state.strikeSpot ?? target;
  const aim = ctx.rules?.levelStrike ? lockLevelAim(state.pos, aimAt, facing) : lockAim(state.pos, aimAt, facing);
  const lunge: PredatorState = {
    ...state,
    phase: 'lunge',
    elapsed: 0,
    duration: ctx.tuning.lungeDuration,
    aim,
    facing: faceToward(facing, aim.x),
  };
  return { state: lunge, used, event: { type: 'lungeStart', aim: { ...aim } } };
}

function stepLunge(state: PredatorState, target: Point, dt: number, ctx: PredatorContext): PhaseStep {
  const used = Math.min(dt, state.duration - state.elapsed);
  const pos = state.strikeSpot ? state.pos : lungePosition(state, used, ctx);
  const moved: PredatorState = { ...state, pos, elapsed: state.elapsed + used };
  const connected = lungeConnects(moved, target, ctx.tuning) && targetExposed(target, ctx);
  if (connected || moved.elapsed >= moved.duration) {
    return { state: enterCooldown(moved, ctx), used, event: { type: 'lungeEnd', connected } };
  }
  return { state: moved, used, event: null };
}

/** Where a lunging predator gets to after `used` seconds along its locked aim at `lungeSpeed`. */
function lungePosition(state: PredatorState, used: number, ctx: PredatorContext): Point {
  const aim = state.aim ?? { x: state.facing, y: 0 };
  return moveClamped(state.pos, scale(aim, ctx.tuning.lungeSpeed * used), ctx);
}

function stepCooldown(
  state: PredatorState,
  target: Point,
  dt: number,
  ctx: PredatorContext,
): PhaseStep {
  const used = Math.min(dt, state.duration - state.elapsed);
  const drifted = cooldownMove(state, target, used, ctx);
  const elapsed = state.elapsed + used;
  if (elapsed < state.duration) {
    return { state: { ...drifted, elapsed }, used, event: null };
  }
  const patrol: PredatorState = { ...drifted, phase: 'patrol', elapsed: 0, duration: 0 };
  return { state: patrol, used, event: { type: 'cooldownEnd' } };
}

/**
 * Moves a cooling-down predator for `used` seconds: a species with the `stillCooldown` rule stands
 * still facing the target, any other swims its route.
 */
function cooldownMove(state: PredatorState, target: Point, used: number, ctx: PredatorContext): PredatorState {
  if (ctx.rules?.stillCooldown) return { ...state, facing: faceToward(state.facing, target.x - state.pos.x) };
  return swimRoute(state, used, ctx);
}

function enterCooldown(state: PredatorState, ctx: PredatorContext): PredatorState {
  const cooldown: PredatorState = { ...state, phase: 'cooldown', elapsed: 0, duration: ctx.tuning.cooldown, aim: null };
  delete cooldown.strikeSpot;
  return cooldown;
}

/**
 * Whether a warning may start or proceed: in range, target exposed, the hook allows it and, for a
 * species with the `warnOnRoute` rule, the predator is on its route.
 */
function canWarn(state: PredatorState, target: Point, ctx: PredatorContext): boolean {
  return (
    onRouteToWarn(state, ctx) &&
    inLungeRange(state.pos, target, ctx.tuning) &&
    targetExposed(target, ctx) &&
    (ctx.hook?.mayWarn?.(state.pos, target) ?? true)
  );
}

/** True without the `warnOnRoute` rule; with it, whether the predator is within `ROUTE_WARN_TOLERANCE` of its route. */
function onRouteToWarn(state: PredatorState, ctx: PredatorContext): boolean {
  if (!ctx.rules?.warnOnRoute) return true;
  return routeLoopDistance(state.pos, state.waypoints) <= ROUTE_WARN_TOLERANCE;
}

/**
 * Whether the target can be attacked: outside the safe area, whose edges count as inside, and,
 * for a species with the `sightCover` rule, not in cover.
 */
function targetExposed(target: Point, ctx: PredatorContext): boolean {
  const hidden = ctx.rules?.sightCover === true && ctx.targetInCover === true;
  return !hidden && !inSafeArea(target, ctx.safeArea);
}

/** A level aim: straight toward the target's side, along `facing` when the target is straight above or below. */
function lockLevelAim(from: Point, target: Point, facing: -1 | 1): Point {
  return { x: faceToward(facing, target.x - from.x), y: 0 };
}

function lockAim(from: Point, target: Point, facing: -1 | 1): Point {
  const direction = normalize({ x: target.x - from.x, y: target.y - from.y });
  if (direction.x === 0 && direction.y === 0) return { x: facing, y: 0 };
  return direction;
}

/**
 * Swims toward the current waypoint at `patrolSpeed`. Arriving, or failing to get closer
 * because the path is blocked, advances to the next waypoint (wrapping).
 */
function swimRoute(state: PredatorState, dt: number, ctx: PredatorContext): PredatorState {
  const waypoint = state.waypoints[state.waypointIndex];
  const toWaypoint = { x: waypoint.x - state.pos.x, y: waypoint.y - state.pos.y };
  const gap = Math.hypot(toWaypoint.x, toWaypoint.y);
  const reach = ctx.tuning.patrolSpeed * dt;
  const delta = gap <= reach ? toWaypoint : scale(normalize(toWaypoint), reach);
  const pos = moveClamped(state.pos, delta, ctx);
  const arrived = distance(pos, waypoint) <= PROGRESS_EPSILON;
  const stalled = distance(pos, waypoint) >= gap - PROGRESS_EPSILON;
  const advance = arrived || (reach > 0 && stalled);
  const waypointIndex = advance
    ? (state.waypointIndex + 1) % state.waypoints.length
    : state.waypointIndex;
  return { ...state, pos, waypointIndex, facing: faceToward(state.facing, pos.x - state.pos.x) };
}

/**
 * Moves `from` by `delta`, clamping the result to `ctx.bounds` and keeping it out of the
 * safe area grown by `bodyRadius`. Resolves one axis at a time, stopping on the face of the
 * keep-out box the mover approached from, so it slides along the box instead of crossing it.
 */
function moveClamped(from: Point, delta: Point, ctx: PredatorContext): Point {
  const keepOut = growSafeArea(ctx.safeArea, ctx.tuning.bodyRadius);
  const { bounds } = ctx;
  let x = clamp(from.x + delta.x, bounds.minX, bounds.maxX);
  if (strictlyInside(x, from.y, keepOut)) x = from.x <= keepOut.x0 ? keepOut.x0 : keepOut.x1;
  let y = clamp(from.y + delta.y, bounds.minY, bounds.maxY);
  if (strictlyInside(x, y, keepOut)) y = from.y <= keepOut.y0 ? keepOut.y0 : keepOut.y1;
  return { x, y };
}

function growSafeArea(safeArea: SafeArea, margin: number): SafeArea {
  return {
    x0: safeArea.x0 - margin,
    x1: safeArea.x1 + margin,
    y0: safeArea.y0 - margin,
    y1: safeArea.y1 + margin,
  };
}

function strictlyInside(x: number, y: number, box: SafeArea): boolean {
  return x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1;
}

function faceToward(facing: -1 | 1, dx: number): -1 | 1 {
  if (dx > 0) return 1;
  if (dx < 0) return -1;
  return facing;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** INVARIANT: same arithmetic as distanceToSegment in hiding.ts, so route reach and B10 risk distances agree exactly. */
function distanceToSegment(pos: Point, a: Point, b: Point): number {
  const near = nearestOnSegment(pos, a, b);
  return Math.hypot(pos.x - near.x, pos.y - near.y);
}

function nearestOnSegment(pos: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const along = lengthSq === 0 ? 0 : ((pos.x - a.x) * abx + (pos.y - a.y) * aby) / lengthSq;
  const clamped = Math.min(1, Math.max(0, along));
  return { x: a.x + clamped * abx, y: a.y + clamped * aby };
}
