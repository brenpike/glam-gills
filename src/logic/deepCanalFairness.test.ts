/**
 * Risk ladder fairness (B10, issue #70; PRD open question 264) on Area 8, the deep canal, with its
 * tilapia, its common carp, its black bass, its punting poles, its gliding trajineras and its
 * old-stone divider (issue #78), on #130's relaxed safe start and the shared harness in
 * riskFairness.ts, with the rock rule in force: no predator senses, chases or strikes through the
 * divider, and no swim passes through it. Each lane is full of chasing predators that out-swim a
 * one-leg axolotl, so a straight swim from a safe start cannot prove a spot fair here. Instead a
 * search swims the real rules frame by frame (the swim, the current, the rock, the trajinera push and
 * the encounter) and keeps a move only when, after it, swimming straight away from the nearest
 * threat survives the longest warning and strike: the skill of baiting a warning and leaving its
 * reach. It proves the area can be beaten with one leg on the full route, every snack in both lanes
 * eaten before the exit opens, that every strike can be avoided by swimming away, and that every
 * spot and stranding place can be reached and left without a hit.
 */
import { describe, expect, it } from 'vitest';
import { DEEP_CANAL_AREA, exitOpen } from './areas';
import { collectSnacksAtHead, createCollectibles, drawnSnackX, drawnSnackY, headPoint, snacksLeft, type Collectible, type SnackFrame } from './collectibles';
import { DEEP_CANAL_BASS, DEEP_CANAL_CARP, DEEP_CANAL_LAYOUT, DEEP_CANAL_TILAPIA } from './deepCanalLayout';
import { createEncounter, stepEncounter, type EncounterEvent, type EncounterState } from './encounter';
import { currentAt } from './environment';
import { shapeDistance } from './hazards';
import { meetsThreatRiskRule, turnDistance, zoneThreats } from './hiding';
import { legSwimTuning } from './legs';
import { mobileSnackAvoid, type MobileSnackAvoid } from './mobileSnacks';
import { PUNTING_POLE, movingHazardPeriod, movingHazardSweep } from './movingHazards';
import { blockAtRock, bodyInAnyRock } from './pebble';
import { BLACK_BASS_SPECIES, CARP_SPECIES, crossesRock, routeLoopDistance } from './predators';
import { DT, EXTRA_SEEDS, START_STEP, fairnessZone, isSafeStart, loopSeconds, poolSpots, ringPoints, tailSteps, tilapiaOf } from './riskFairness';
import { RESCUE } from './rescue';
import { createShrimpFlicks, stepShrimpFlicks, type ShrimpFlickState } from './shrimpFlick';
import { startDashVelocity, stepSwim, type SwimState } from './swimPhysics';
import { createTrajineraLane, pushFromTrajineras, tickTrajineraLane, type TrajineraLane } from './trajineras';
import { BLACK_BASS_CHASE, FINDS, RISK, SWIM, TILAPIA_CHASE, type SwimTuning } from './tuning';
import { normalize } from './vec';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds, type HidingSpot, type Point, type TilapiaRoute, type ZoneLayout } from './zone';

/** A safe start's clearance from every tilapia loop: its 155 px strike plus its 160 px leash (issue #130, ND-11). */
const TILAPIA_REACH = 315;
/** A safe start's clearance from every carp loop: its 135 px strike plus its 120 px leash. */
const CARP_REACH = 255;
/** A safe start's clearance from every bass loop: its 180 px strike plus its 160 px leash. */
const BASS_REACH = 340;
/** Longest one-leg swim, in seconds, before it counts as stuck. */
const ONE_LEG_SWIM_LIMIT = 180;
/** Longest one-leg full route, in seconds, before it counts as stuck: two lane swims, as it crosses the area three times. */
const FULL_ROUTE_LIMIT = 2 * ONE_LEG_SWIM_LIMIT;
/** Px from a waypoint at which a swim steers for the next one. */
const WAYPOINT_REACH = 24;
/** Px ahead along a lane's way that a swim blocked by rock steers for. */
const LANE_STEER_AHEAD = 80;
/** y of the way along the deep lane, clear of the rock. */
const DEEP_WAY_Y = 450;
/** Px within which a swim heads straight for a target with a clear way, not along its lane's way. */
const NEAR_TARGET = 240;
/** Steps of one move the search tries: 0.2 s. */
const MOVE_STEPS = 12;
/** Moves the search tries from one checkpoint before it waits there longer and tries again. */
const LEG_BUDGET = 300;
/** Seconds of swim from one checkpoint before the search counts the leg as stuck. */
const LEG_LIMIT = 30;
/** Steps added to the wait at a checkpoint on each new try of a stuck leg: 0.5 s. */
const PATIENCE_STEPS = 30;
/** Tries of one stuck leg, each waiting longer at its checkpoint, before the search goes back a checkpoint. */
const LEG_TRIES = 8;
/** Legs a swim tries in all before it gives up. */
const SWIM_BUDGET = 200;
/** Px of a checkpoint along the way: a swim commits each time it gets this much farther on. */
const CHECKPOINT_PX = 240;
/** Px a swim-away probe looks ahead in each direction for rock and the swim bounds. */
const ESCAPE_PROBE = 40;
/** Directions a swim away is tried in. */
const ESCAPE_DIRECTIONS = 16;
/** First start time in seconds, as measured, for a one-leg swim of each lane to the exit without a hit. */
const ONE_LEG_LANE_START = { surface: 0, deep: 0 };
/** One-leg seconds along each lane to the exit with every threat playing, as measured. */
const ONE_LEG_LANE_SECONDS = { surface: 67.9, deep: 47.5 };
/** First start time in seconds, as measured, for the one-leg full route without a hit. */
const FULL_ROUTE_START = 0;
/** One-leg seconds of the full route, every snack eaten, to the exit, as measured. */
const FULL_ROUTE_SECONDS = 224.6;

const deepCanal = fairnessZone(buildZone(DEEP_CANAL_LAYOUT, DEFAULT_ZONE_SEED));
const oneLeg = legSwimTuning(1);
const fourLegs = legSwimTuning(4);
const STEPS_PER_START = Math.round(START_STEP / DT);
const DASH_STEPS = Math.round(SWIM.dashDuration / DT);
const DASH_REACH = SWIM.dashSpeed * SWIM.dashDuration;
/** Steps the search looks ahead after each move: the longest warning and strike, plus one move. */
const LOOKAHEAD_STEPS = deepCanal.parkSteps + MOVE_STEPS;
/** Every predator tuning of the zone: the tilapia's, then each route's. */
const THREAT_TUNINGS = [tilapiaOf(deepCanal.zone), ...deepCanal.zone.predatorRoutes.map((route) => route.species.tuning)];
/** Px within which a predator is a threat to swim away from: the longest chase sight. */
const THREAT_RANGE = Math.max(...THREAT_TUNINGS.map((tuning) => tuning.chase?.sight ?? 0));
/** Px a swimmer and a predator can close in LOOKAHEAD_STEPS at most: both at top speed (a chase or a Tail Dash), then the longest strike and hit. */
const QUIET_PREDATOR_DISTANCE =
  (LOOKAHEAD_STEPS * DT + SWIM.dashDuration) * (SWIM.dashSpeed + Math.max(...THREAT_TUNINGS.map((tuning) => tuning.chase?.speed ?? 0))) +
  Math.max(...THREAT_TUNINGS.map((tuning) => tuning.lungeSpeed * tuning.lungeDuration + tuning.hitRadius));
/** Px a swimmer can close on a pole's sweep in LOOKAHEAD_STEPS at most, plus its touch reach. */
const QUIET_POLE_DISTANCE = (LOOKAHEAD_STEPS * DT + SWIM.dashDuration) * SWIM.dashSpeed + PUNTING_POLE.touchReach;
/** The turns from the aim each move tries, in order: straight on, 45 degrees either way, waiting (null), 90 degrees either way, back. */
const MOVE_TURNS: readonly (number | null)[] = [0, Math.PI / 4, -Math.PI / 4, null, Math.PI / 2, -Math.PI / 2, Math.PI];
const { exit } = DEEP_CANAL_AREA;
const rocks = deepCanal.zone.rockWalls ?? [];
const bounds = swimBounds(deepCanal.zone);
const snackAvoid: MobileSnackAvoid = mobileSnackAvoid(deepCanal.zone);
const dividerWest = Math.min(...rocks.map((stone) => stone.x0));
const dividerEast = Math.max(...rocks.map((stone) => stone.x1));
/** The way along each lane: the main path's points over the divider for the surface lane, y 450 under it for the deep lane. */
const LANE_WAYS: Readonly<Record<'surface' | 'deep', readonly Point[]>> = {
  surface: deepCanal.zone.mainPath.filter((point) => laneOf(point) === 'surface'),
  deep: [
    { x: dividerWest, y: DEEP_WAY_Y },
    { x: dividerEast, y: DEEP_WAY_Y },
  ],
};

/** The way along the deep lane: from the Home Spot down under the divider's west end, east along the lane, up to the exit. */
const DEEP_WAY: readonly Point[] = [
  { x: 120, y: 360 },
  { x: 520, y: 450 },
  { x: 3620, y: 450 },
  { x: exit.x, y: exit.y },
];

type Lane = 'surface' | 'deep' | 'west' | 'east';

/** One swimmer of a headless trip: its swim tuning and swim, its encounter, its trajineras, the element time and whether it has dashed. */
interface Swimmer {
  tuning: SwimTuning;
  swim: SwimState;
  encounter: EncounterState;
  boats: TrajineraLane;
  time: number;
  dashed: boolean;
}

/** Where a swim heads now: the point, and whether it Tail Dashes there (once per swim). */
interface Aim {
  point: Point;
  dash: boolean;
}

/** A swim the search plays: where it heads, how its own state follows each step, and when it is done. */
interface SwimTask<T> {
  aim(swimmer: Swimmer, state: T): Aim;
  follow(swimmer: Swimmer, state: T): T;
  isDone(swimmer: Swimmer, state: T): boolean;
  /** Checkpoints passed: it only grows, and the search never backtracks past one. */
  progress(state: T): number;
}

/** The state of a lane swim: the way point it heads for and the farthest checkpoint east it has reached. */
interface LaneState {
  next: number;
  checkpoint: number;
}

/** A searched swim: the swimmer and the task state at the end, and its seconds from its start. */
interface SwimRun<T> {
  swimmer: Swimmer;
  state: T;
  seconds: number;
}

/** One node of the search: the swimmer, the task state and how many moves have been tried from it. */
interface SearchNode<T> {
  swimmer: Swimmer;
  state: T;
  tried: number;
}

/** The snacks of a headless trip: the items, the shrimp flick state, the lanes swum so far, in order, and the farthest checkpoint east once every snack is eaten. */
interface RouteState {
  items: Collectible[];
  flicks: ShrimpFlickState;
  lanes: Lane[];
  checkpoint: number;
}

/** The state of a visit: whether the target is reached, so the swim heads back to its start, and the nearest it has come to where it heads, in checkpoints. */
interface VisitState {
  reached: boolean;
  nearest: number;
}

/** The lane a point is in: over the divider, under it, or in the shared pocket west or east of it. */
function laneOf(point: Point): Lane {
  if (point.x < dividerWest) return 'west';
  if (point.x > dividerEast) return 'east';
  const tops = rocks.filter((stone) => stone.x0 <= point.x && point.x <= stone.x1).map((stone) => stone.y0);
  return point.y < Math.min(...tops) ? 'surface' : 'deep';
}

/** Whether a straight swim from `from` to `to` keeps the body out of the rock. */
function isClearWay(from: Point, to: Point): boolean {
  const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2));
  for (let index = 0; index <= count; index++) {
    const point = { x: from.x + ((to.x - from.x) * index) / count, y: from.y + ((to.y - from.y) * index) / count };
    if (bodyInAnyRock(point, rocks)) return false;
  }
  return true;
}

/** The y of `lane`'s way at `x`: straight between its points, level past its ends. */
function laneWayY(lane: 'surface' | 'deep', x: number): number {
  const way = LANE_WAYS[lane];
  if (x <= way[0].x) return way[0].y;
  const after = way.findIndex((point) => point.x >= x);
  if (after < 0) return way[way.length - 1].y;
  const [from, to] = [way[after - 1], way[after]];
  return from.y + ((to.y - from.y) * (x - from.x)) / (to.x - from.x);
}

/** The point on `lane`'s way LANE_STEER_AHEAD px from `pos` toward `towardX`. */
function laneAheadPoint(pos: Point, lane: 'surface' | 'deep', towardX: number): Point {
  const x = pos.x + Math.sign(towardX - pos.x) * LANE_STEER_AHEAD;
  return { x, y: laneWayY(lane, x) };
}

/**
 * Where a swimmer at `pos` heads for `target`: the target itself in the same pocket, or when the
 * straight way is clear of rock and the target is near or level with it; else along its lane's way
 * when the target is in that lane or a pocket; along its lane's way to the exit pocket when the
 * target is in the other lane; and, from a pocket, onto the target lane's way at the pocket's edge
 * (the deep lane's for a target in the other pocket).
 */
function steerPoint(pos: Point, target: Point): Point {
  const from = laneOf(pos);
  const to = laneOf(target);
  const near = Math.hypot(target.x - pos.x, target.y - pos.y) <= NEAR_TARGET || Math.abs(target.x - pos.x) <= LANE_STEER_AHEAD;
  if (from === to && (from === 'west' || from === 'east')) return target;
  if (near && isClearWay(pos, target)) return target;
  if (from === 'west' || from === 'east') {
    const edge = from === 'west' ? dividerWest - LANE_STEER_AHEAD : dividerEast + LANE_STEER_AHEAD;
    const lane = to === 'surface' || to === 'deep' ? to : 'deep';
    const atEdge = from === 'west' ? pos.x >= edge - WAYPOINT_REACH : pos.x <= edge + WAYPOINT_REACH;
    return atEdge ? laneAheadPoint(pos, lane, target.x) : { x: edge, y: laneWayY(lane, edge) };
  }
  if (from === to || to === 'west' || to === 'east') return laneAheadPoint(pos, from, target.x);
  return laneAheadPoint(pos, from, dividerEast + LANE_STEER_AHEAD);
}

/** A new swimmer at `at` with `tuning`, a fresh encounter and fresh trajineras, at element time 0. */
function createSwimmer(at: Point, tuning: SwimTuning): Swimmer {
  return {
    tuning,
    swim: { x: at.x, y: at.y, vx: 0, vy: 0, facing: 1 },
    encounter: createEncounter(deepCanal.zone),
    boats: createTrajineraLane(deepCanal.zone.trajineras ?? [], bounds, rocks),
    time: 0,
    dashed: false,
  };
}

/**
 * One frame as the swim scene plays it: swim steered by `steer` with the current (dashing when
 * `dashing`), stop at the rock with the blocked velocity zeroed, step the encounter, then a bump
 * sets the velocity, else the first ready trajinera whose hull touches the axolotl pushes it aside.
 * Returns the swimmer after it, or null on a hit.
 */
function stepSwimmer(swimmer: Swimmer, steer: Point, dashing: boolean): Swimmer | null {
  const pos = { x: swimmer.swim.x, y: swimmer.swim.y };
  const env = { current: currentAt(pos, deepCanal.zone.currents), dragMul: 1, bounds, dashing };
  const swum = stepSwim(swimmer.swim, steer, env, DT, swimmer.tuning);
  const blocked = blockAtRock(pos, swum, rocks);
  const vx = blocked.x === swum.x ? swum.vx : 0;
  const vy = blocked.y === swum.y ? swum.vy : 0;
  const time = swimmer.time + DT;
  const result = stepEncounter(swimmer.encounter, blocked, DT, deepCanal.ctx);
  if (result.events.some((event) => event.type === 'hit')) return null;
  const ticked = tickTrajineraLane(swimmer.boats, DT);
  const pushed = result.impulse ? null : pushFromTrajineras(ticked, blocked, time);
  const impulse = result.impulse ?? pushed?.push.impulse ?? { x: vx, y: vy };
  const swim = { ...swum, x: blocked.x, y: blocked.y, vx: impulse.x, vy: impulse.y };
  return { ...swimmer, swim, encounter: result.state, boats: pushed ? pushed.lane : ticked, time };
}

/** The swimmer after waiting where it is for `steps`, or null on a hit. */
function parkSwimmer(swimmer: Swimmer, steps: number): Swimmer | null {
  let current: Swimmer | null = swimmer;
  for (let step = 0; step < steps && current; step++) current = stepSwimmer(current, { x: 0, y: 0 }, false);
  return current;
}

/** The nearest predator to the swimmer, not behind rock, that warns, strikes or is within THREAT_RANGE; null when none. */
function nearestThreat(swimmer: Swimmer): Point | null {
  const pos = { x: swimmer.swim.x, y: swimmer.swim.y };
  let threat: Point | null = null;
  let nearest = Infinity;
  for (const predator of swimmer.encounter.predators) {
    const distance = Math.hypot(predator.pos.x - pos.x, predator.pos.y - pos.y);
    const striking = predator.phase === 'telegraph' || predator.phase === 'lunge';
    if ((!striking && distance > THREAT_RANGE) || distance >= nearest || crossesRock(predator.pos, pos, rocks)) continue;
    threat = predator.pos;
    nearest = distance;
  }
  return threat;
}

/** The way straight away from the nearest threat that keeps the body in the water and out of the rock; still when no threat. */
function escapeSteer(swimmer: Swimmer): Point {
  const threat = nearestThreat(swimmer);
  if (!threat) return { x: 0, y: 0 };
  const pos = { x: swimmer.swim.x, y: swimmer.swim.y };
  let best = { x: 0, y: 0 };
  let farthest = -Infinity;
  for (let index = 0; index < ESCAPE_DIRECTIONS; index++) {
    const angle = (index * 2 * Math.PI) / ESCAPE_DIRECTIONS;
    const way = { x: Math.cos(angle), y: Math.sin(angle) };
    const probe = { x: pos.x + way.x * ESCAPE_PROBE, y: pos.y + way.y * ESCAPE_PROBE };
    const inWater = probe.x >= bounds.minX && probe.x <= bounds.maxX && probe.y >= bounds.minY && probe.y <= bounds.maxY;
    const distance = Math.hypot(probe.x - threat.x, probe.y - threat.y);
    if (!inWater || bodyInAnyRock(probe, rocks) || distance <= farthest) continue;
    best = way;
    farthest = distance;
  }
  return best;
}

/** Whether no predator or pole can reach the swimmer within LOOKAHEAD_STEPS, however it swims. */
function isOutOfEveryReach(swimmer: Swimmer): boolean {
  const pos = { x: swimmer.swim.x, y: swimmer.swim.y };
  const nearPredator = swimmer.encounter.predators.some((predator) => Math.hypot(predator.pos.x - pos.x, predator.pos.y - pos.y) <= QUIET_PREDATOR_DISTANCE);
  const nearPole = (deepCanal.zone.movingHazards ?? []).some((spawn) => shapeDistance(pos, movingHazardSweep(spawn)) <= QUIET_POLE_DISTANCE);
  return !nearPredator && !nearPole;
}

/** Whether swimming away from the nearest threat from `swimmer` takes no hit for LOOKAHEAD_STEPS. */
function escapes(swimmer: Swimmer): boolean {
  if (isOutOfEveryReach(swimmer)) return true;
  let current: Swimmer | null = swimmer;
  for (let step = 0; step < LOOKAHEAD_STEPS && current; step++) current = stepSwimmer(current, escapeSteer(current), false);
  return current !== null;
}

/** `way` turned by `angle` radians; still for a null angle. */
function turnWay(way: Point, angle: number | null): Point {
  if (angle === null) return { x: 0, y: 0 };
  return { x: way.x * Math.cos(angle) - way.y * Math.sin(angle), y: way.x * Math.sin(angle) + way.y * Math.cos(angle) };
}

/**
 * One move from `node`: a Tail Dash at the aim, or MOVE_STEPS steered by `steer`, the task state
 * following each step. Kept only when it takes no hit and the swimmer can then swim away from the
 * nearest threat for LOOKAHEAD_STEPS with no hit; null otherwise.
 */
function playMove<T>(node: SearchNode<T>, steer: Point, dash: boolean, task: SwimTask<T>): SearchNode<T> | null {
  let swimmer: Swimmer | null = dash ? { ...node.swimmer, swim: startDashVelocity(node.swimmer.swim, steer), dashed: true } : node.swimmer;
  let state = node.state;
  for (let step = 0; step < (dash ? DASH_STEPS : MOVE_STEPS) && swimmer; step++) {
    swimmer = stepSwimmer(swimmer, steer, dash);
    if (swimmer) state = task.follow(swimmer, state);
  }
  if (!swimmer || !escapes(swimmer)) return null;
  return { swimmer, state, tried: 0 };
}

/** The east checkpoint of `x`. */
function checkpointOf(x: number): number {
  return Math.floor(x / CHECKPOINT_PX);
}

/**
 * A depth-first search for one leg of `task` from `start`: a swim with no hit that passes a new
 * checkpoint or finishes, within LEG_BUDGET moves and LEG_LIMIT seconds. From each node it tries a
 * Tail Dash when the aim asks for one, then heading for the aim, turned 45 degrees either way,
 * waiting, turned 90 degrees either way and turning back, keeping the first move after which the
 * swimmer can still swim away from every threat. Returns the node that ends the leg, or null.
 */
function searchLeg<T>(start: SearchNode<T>, task: SwimTask<T>): SearchNode<T> | null {
  const passed = task.progress(start.state);
  const stack: SearchNode<T>[] = [start];
  for (let moves = 0; moves < LEG_BUDGET && stack.length > 0; ) {
    const node = stack[stack.length - 1];
    if (node !== start && (task.isDone(node.swimmer, node.state) || task.progress(node.state) > passed)) return node;
    const aim = task.aim(node.swimmer, node.state);
    const dash = aim.dash && !node.swimmer.dashed;
    const tries = MOVE_TURNS.length + (dash ? 1 : 0);
    if (node.swimmer.time - start.swimmer.time > LEG_LIMIT || node.tried >= tries) {
      stack.pop();
      continue;
    }
    const pos = { x: node.swimmer.swim.x, y: node.swimmer.swim.y };
    const ahead = normalize({ x: aim.point.x - pos.x, y: aim.point.y - pos.y });
    const dashNow = dash && node.tried === 0;
    const turn = MOVE_TURNS[node.tried - (dash ? 1 : 0)] ?? 0;
    node.tried++;
    moves++;
    const child = playMove(node, dashNow ? ahead : turnWay(ahead, turn), dashNow, task);
    if (child) stack.push(child);
  }
  return null;
}

/**
 * The checkpoint after the swimmer waits there for `steps`, swimming away from any threat and else
 * still, the task state following each step; null on a hit.
 */
function waitAtCheckpoint<T>(checkpoint: SearchNode<T>, steps: number, task: SwimTask<T>): SearchNode<T> | null {
  let swimmer: Swimmer | null = checkpoint.swimmer;
  let state = checkpoint.state;
  for (let step = 0; step < steps && swimmer; step++) {
    swimmer = stepSwimmer(swimmer, escapeSteer(swimmer), false);
    if (swimmer) state = task.follow(swimmer, state);
  }
  return swimmer ? { swimmer, state, tried: 0 } : null;
}

/** A checkpoint of a swim: the node that passed it, and how many tries of the next leg have been made from it. */
interface Checkpoint<T> {
  node: SearchNode<T>;
  tries: number;
}

/**
 * A swim of `task` from `start` with no hit in at most `limit` seconds, leg by leg from checkpoint
 * to checkpoint (searchLeg). A stuck leg is tried again after waiting at its checkpoint a little
 * longer each time, as a player holds back until a threat moves on; when every try is stuck, or the
 * wait itself is hit, the swim goes back to the checkpoint before and waits there longer instead.
 * Returns the swim, or null when the first checkpoint runs out of tries or SWIM_BUDGET legs are tried.
 */
function searchSwim<T>(start: Swimmer, initial: T, task: SwimTask<T>, limit: number): SwimRun<T> | null {
  const checkpoints: Checkpoint<T>[] = [{ node: { swimmer: start, state: initial, tried: 0 }, tries: 0 }];
  for (let legs = 0; legs < SWIM_BUDGET && checkpoints.length > 0; legs++) {
    const top = checkpoints[checkpoints.length - 1];
    const { swimmer, state } = top.node;
    if (task.isDone(swimmer, state)) return { swimmer, state, seconds: swimmer.time - start.time };
    const waited = top.tries < LEG_TRIES && swimmer.time - start.time <= limit ? waitAtCheckpoint(top.node, top.tries * PATIENCE_STEPS, task) : null;
    top.tries = waited ? top.tries + 1 : LEG_TRIES;
    const leg = waited ? searchLeg(waited, task) : null;
    if (leg) checkpoints.push({ node: leg, tries: 0 });
    else if (!waited) checkpoints.pop();
  }
  return null;
}

/** Whether a point is inside the area's exit circle (inclusive). */
function isAtExit(pos: Point): boolean {
  return Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius;
}

/** The index of the next point of `way` after any the swimmer at `pos` has reached. */
function followWay(way: readonly Point[], next: number, pos: Point): number {
  const reached = next < way.length - 1 && Math.hypot(way[next].x - pos.x, way[next].y - pos.y) <= WAYPOINT_REACH;
  return reached ? next + 1 : next;
}

/** A swim along `way` to the exit: heading for each point in turn, round the rock, a checkpoint at each point and each CHECKPOINT_PX east. */
function laneTask(way: readonly Point[]): SwimTask<LaneState> {
  return {
    aim: (swimmer, lane) => ({ point: steerPoint({ x: swimmer.swim.x, y: swimmer.swim.y }, way[lane.next]), dash: false }),
    follow: (swimmer, lane) => ({
      next: followWay(way, lane.next, { x: swimmer.swim.x, y: swimmer.swim.y }),
      checkpoint: Math.max(lane.checkpoint, checkpointOf(swimmer.swim.x)),
    }),
    isDone: (swimmer, lane) => lane.next === way.length - 1 && isAtExit({ x: swimmer.swim.x, y: swimmer.swim.y }),
    progress: (lane) => lane.next + lane.checkpoint,
  };
}

/** A one-leg swim from the Home Spot along `way` to the exit after waiting there `startSteps`; null on a hit everywhere. */
function swimLane(way: readonly Point[], startSteps: number): SwimRun<LaneState> | null {
  const start = parkSwimmer(createSwimmer(deepCanal.zone.start, oneLeg), startSteps);
  const initial = { next: 0, checkpoint: checkpointOf(deepCanal.zone.start.x) };
  return start ? searchSwim(start, initial, laneTask(way.slice(1)), ONE_LEG_SWIM_LIMIT) : null;
}

/** The first start time over the start window at which `attempt` finds a swim, with that swim; null when none does. */
function firstStart<T>(attempt: (startSteps: number) => SwimRun<T> | null): { time: number; run: SwimRun<T> } | null {
  for (let index = 0; index <= deepCanal.lastStartIndex; index++) {
    const run = attempt(index * STEPS_PER_START);
    if (run) return { time: index * START_STEP, run };
  }
  return null;
}

/** The snack frame at element time `time`. */
function snackFrameAt(time: number): SnackFrame {
  return { driftT: time, bobT: time, bobbing: true, drift: DEEP_CANAL_AREA.snackDrift, bounds };
}

/** The lane a snack lives in: its spawn, a tadpole's first turn point or a shrimp's first hop spot. */
function snackLane(item: Collectible): Lane {
  return laneOf(item.home?.[0] ?? { x: item.x, y: item.y });
}

/** The full route's lanes in eating order, with the way along each: east in the deep lane, back west in the surface lane. */
const ROUTE_LANES: readonly { lane: Lane; east: boolean }[] = [
  { lane: 'west', east: true },
  { lane: 'deep', east: true },
  { lane: 'east', east: true },
  { lane: 'surface', east: false },
];

/**
 * The next snack of the full route: the first lane of ROUTE_LANES with a snack left (the west
 * pocket, the deep lane, the exit pocket, then back west along the surface lane), and in it the
 * first snack in the way of travel by its spawn x; -1 when none is left.
 */
function nextSnackIndex(items: readonly Collectible[]): number {
  for (const { lane, east } of ROUTE_LANES) {
    let best = -1;
    for (let index = 0; index < items.length; index++) {
      if (items[index].collected || snackLane(items[index]) !== lane) continue;
      if (best < 0 || (east ? items[index].x < items[best].x : items[index].x > items[best].x)) best = index;
    }
    if (best >= 0) return best;
  }
  return -1;
}

/** The route state after one frame: shrimp flick and hop at the head, every snack at the head is eaten, and the lanes follow. */
function followRoute(swimmer: Swimmer, route: RouteState): RouteState {
  const pos = { x: swimmer.swim.x, y: swimmer.swim.y };
  const frame = snackFrameAt(swimmer.time);
  const head = headPoint({ x: pos.x, y: pos.y, facing: swimmer.swim.facing, rotation: 0 });
  const flicked = stepShrimpFlicks(route.items, head, frame, route.flicks, false, snackAvoid, DT);
  const items = flicked ? flicked.items : route.items;
  const eaten = collectSnacksAtHead(items, head, frame);
  const lane = laneOf(pos);
  const lanes = lane === route.lanes[route.lanes.length - 1] ? route.lanes : [...route.lanes, lane];
  const left = snacksLeft(eaten?.items ?? items);
  const checkpoint = left === 0 ? Math.max(route.checkpoint, checkpointOf(pos.x)) : route.checkpoint;
  return { items: eaten?.items ?? items, flicks: flicked ? flicked.state : route.flicks, lanes, checkpoint };
}

/** Where the full route heads: the next snack where it is drawn now, else the exit, round the rock. */
function aimRoute(swimmer: Swimmer, route: RouteState): Aim {
  const pos = { x: swimmer.swim.x, y: swimmer.swim.y };
  const index = nextSnackIndex(route.items);
  if (index < 0) return { point: steerPoint(pos, exit), dash: false };
  const frame = snackFrameAt(swimmer.time);
  const snack = { x: drawnSnackX(route.items[index], index, frame), y: drawnSnackY(route.items[index], index, frame) };
  return { point: steerPoint(pos, snack), dash: false };
}

/** The full route: every snack in ROUTE_LANES order, a checkpoint at each, then along the lane it is in to the exit once none is left, a checkpoint each CHECKPOINT_PX east. */
const FULL_ROUTE_TASK: SwimTask<RouteState> = {
  aim: aimRoute,
  follow: followRoute,
  isDone: (swimmer, route) => snacksLeft(route.items) === 0 && isAtExit({ x: swimmer.swim.x, y: swimmer.swim.y }),
  progress: (route) => route.items.length - snacksLeft(route.items) + route.checkpoint,
};

/**
 * The one-leg full route from the Home Spot after waiting there `startSteps`, the snacks playing
 * through the wait: every snack eaten, east along the deep lane and, as the divider forces, back
 * west along the surface lane, then east along it again to the exit once it opens, in at most
 * FULL_ROUTE_LIMIT seconds; null when no swim is found.
 */
function swimFullRoute(startSteps: number): SwimRun<RouteState> | null {
  const rule = deepCanal.zone.mobileSnacks?.shrimp;
  if (!rule) throw new Error('swimFullRoute: Area 8 has no shrimp rule');
  const items = createCollectibles(deepCanal.zone.collectibles);
  let route: RouteState = { items, flicks: createShrimpFlicks(items, rule), lanes: [laneOf(deepCanal.zone.start)], checkpoint: 0 };
  let start: Swimmer | null = createSwimmer(deepCanal.zone.start, oneLeg);
  for (let step = 0; step < startSteps && start; step++) {
    start = stepSwimmer(start, { x: 0, y: 0 }, false);
    if (start) route = followRoute(start, route);
  }
  return start ? searchSwim(start, route, FULL_ROUTE_TASK, FULL_ROUTE_LIMIT) : null;
}

/** The visit after one step: reached once within `reach` of `target`, and the nearest it has come to `target`, or to `from` once reached. */
function followVisit(swimmer: Swimmer, visit: VisitState, target: Point, from: Point, reach: number): VisitState {
  const reached = visit.reached || Math.hypot(target.x - swimmer.swim.x, target.y - swimmer.swim.y) <= reach;
  const goal = reached ? from : target;
  const away = Math.hypot(goal.x - swimmer.swim.x, goal.y - swimmer.swim.y);
  return { reached, nearest: reached === visit.reached ? Math.min(visit.nearest, away) : away };
}

/** A visit to `target` from `from`: in to it (one Tail Dash for a Legendary), within `reach`, then back to `from`, a checkpoint each CHECKPOINT_PX nearer. */
function visitTask(target: Point, from: Point, reach: number, legendary: boolean): SwimTask<VisitState> {
  return {
    aim: (swimmer, visit) => {
      const pos = { x: swimmer.swim.x, y: swimmer.swim.y };
      if (visit.reached) return { point: steerPoint(pos, from), dash: false };
      const near = Math.hypot(target.x - pos.x, target.y - pos.y) <= DASH_REACH && isClearWay(pos, target);
      return { point: steerPoint(pos, target), dash: legendary && near };
    },
    follow: (swimmer, visit) => followVisit(swimmer, visit, target, from, reach),
    isDone: (swimmer, visit) => visit.reached && Math.hypot(from.x - swimmer.swim.x, from.y - swimmer.swim.y) <= WAYPOINT_REACH,
    progress: (visit) => (visit.reached ? 1000 : 0) - Math.floor(visit.nearest / CHECKPOINT_PX),
  };
}

/**
 * Whether the axolotl can wait at `point` to visit `target`: a safe start on #130's relaxed rule,
 * out of the rock, on the target's side of the divider (its lane or a shared pocket).
 */
function isOpenSafeStart(point: Point, target: Point, zone: ZoneLayout): boolean {
  const lane = laneOf(point);
  const sameSide = lane === laneOf(target) || lane === 'west' || lane === 'east';
  return sameSide && isSafeStart(point, zone) && !bodyInAnyRock(point, rocks);
}

/** The nearest safe start to `target` on its side of the divider, searched ring by ring in 1 px steps out to the zone's diagonal. */
function nearestOpenSafeStart(target: Point, zone: ZoneLayout): Point {
  if (isOpenSafeStart(target, target, zone)) return { x: target.x, y: target.y };
  const maxRadius = Math.ceil(Math.hypot(zone.width, zone.height));
  for (let radius = 1; radius <= maxRadius; radius++) {
    const found = ringPoints(target, radius).find((point) => isOpenSafeStart(point, target, zone));
    if (found) return found;
  }
  throw new Error(`nearestOpenSafeStart: no safe start for (${target.x}, ${target.y})`);
}

/**
 * A visit to `target` with `tuning` from its nearest open safe start after waiting there
 * `startSteps`, then waiting there again for the park steps; null on a hit.
 */
function visitFrom(target: Point, reach: number, legendary: boolean, tuning: SwimTuning, startSteps: number): SwimRun<VisitState> | null {
  const from = nearestOpenSafeStart(target, deepCanal.zone);
  const start = parkSwimmer(createSwimmer(from, tuning), startSteps);
  if (!start) return null;
  const initial = { reached: false, nearest: Math.hypot(target.x - from.x, target.y - from.y) };
  const visit = searchSwim(start, initial, visitTask(target, from, reach, legendary), ONE_LEG_SWIM_LIMIT);
  const parked = visit ? parkSwimmer(visit.swimmer, deepCanal.parkSteps) : null;
  return visit && parked ? { ...visit, swimmer: parked } : null;
}

/** The first start time at which a visit to a spot with `tuning` takes no hit, a Legendary with one Tail Dash; null when none. */
function visitSpot(spot: HidingSpot, tuning: SwimTuning): { time: number; run: SwimRun<VisitState> } | null {
  return firstStart((startSteps) => visitFrom(spot, FINDS.pickupRadius, spot.rarity === 'legendary', tuning, startSteps));
}

/** The centre of a loop's box: where the axolotl waits for its predator to warn. */
function loopCentre(route: TilapiaRoute): Point {
  const xs = route.waypoints.map((point) => point.x);
  const ys = route.waypoints.map((point) => point.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/**
 * The one-leg axolotl waits in the middle of a loop until its predator warns, then swims straight
 * away from the nearest threat, clear of the rock, for the longest warning and strike. Returns
 * every event from the warning on, the hit included; throws when the predator never warns.
 */
function swimAwayFromWarning(route: TilapiaRoute): EncounterEvent[] {
  const wait = loopCentre(route);
  let encounter = createEncounter(deepCanal.zone);
  for (let step = 0; step < Math.ceil((2 * deepCanal.startWindow) / DT); step++) {
    const result = stepEncounter(encounter, wait, DT, deepCanal.ctx);
    encounter = result.state;
    if (!result.events.some((event) => event.type === 'telegraph' && event.sourceId === route.id)) continue;
    return [...result.events, ...listEscapeEvents({ ...createSwimmer(wait, oneLeg), encounter, time: (step + 1) * DT })];
  }
  throw new Error(`swimAwayFromWarning: ${route.id} never warns`);
}

/** Every encounter event while `swimmer` swims away from the nearest threat for the park steps, the hit included. */
function listEscapeEvents(swimmer: Swimmer): EncounterEvent[] {
  let current = swimmer;
  const events: EncounterEvent[] = [];
  for (let step = 0; step < deepCanal.parkSteps; step++) {
    const pos = { x: current.swim.x, y: current.swim.y };
    const swum = stepSwim(current.swim, escapeSteer(current), { current: currentAt(pos, deepCanal.zone.currents), dragMul: 1, bounds, dashing: false }, DT, oneLeg);
    const blocked = blockAtRock(pos, swum, rocks);
    const result = stepEncounter(current.encounter, blocked, DT, deepCanal.ctx);
    events.push(...result.events);
    current = { ...current, swim: { ...swum, x: blocked.x, y: blocked.y }, encounter: result.state, time: current.time + DT };
  }
  return events;
}

/** Every encounter event, in order, while the axolotl waits at `at` for `seconds` from a fresh Area 8 encounter. */
function listWaitEvents(at: Point, seconds: number): EncounterEvent[] {
  let encounter = createEncounter(deepCanal.zone);
  const events: EncounterEvent[] = [];
  for (let step = 0; step < Math.ceil(seconds / DT); step++) {
    const result = stepEncounter(encounter, at, DT, deepCanal.ctx);
    encounter = result.state;
    events.push(...result.events);
  }
  return events;
}

describe('risk fairness on the default Area 8 zone', () => {
  const { zone, ctx, startWindow, lastStartIndex, parkSteps } = deepCanal;
  const spots = poolSpots(zone);
  const carp = zone.predatorRoutes.filter((route) => route.species.id === CARP_SPECIES.id);
  const bass = zone.predatorRoutes.filter((route) => route.species.id === BLACK_BASS_SPECIES.id);
  const poles = zone.movingHazards ?? [];

  it('plays two tilapia, five carp, two black bass and four punting poles behind the rock: start times over the longest loop and pole cycle, waiting out the longest strike', () => {
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(['tilapia-0', 'tilapia-1']);
    expect(tilapiaOf(zone)).toEqual(DEEP_CANAL_TILAPIA);
    expect(carp.map((route) => [route.id, route.species])).toEqual([0, 1, 2, 3, 4].map((n) => [`carp-${n}`, DEEP_CANAL_CARP]));
    expect(bass.map((route) => [route.id, route.species])).toEqual(['bass-0', 'bass-1'].map((id) => [id, DEEP_CANAL_BASS]));
    expect(poles.map((spawn) => spawn.type)).toEqual(Array(4).fill(PUNTING_POLE));
    const wades = zone.predatorRoutes.map((route) => loopSeconds(route, route.species.tuning.patrolSpeed));
    const loops = zone.tilapiaRoutes.map((route) => loopSeconds(route, DEEP_CANAL_TILAPIA.patrolSpeed));
    expect(startWindow).toBeCloseTo(Math.max(...wades, ...loops, ...poles.map((spawn) => movingHazardPeriod(spawn.type))), 9);
    expect(startWindow).toBeCloseTo((2 * (440 + 200)) / 60, 9);
    expect(lastStartIndex).toBe(Math.floor(startWindow / START_STEP));
    expect(parkSteps).toBe(Math.max(tailSteps(DEEP_CANAL_TILAPIA), tailSteps(DEEP_CANAL_CARP.tuning), tailSteps(DEEP_CANAL_BASS.tuning)));
    expect(createEncounter(zone).rockWalls).toEqual(rocks);
    expect(ctx.bounds).toEqual(bounds);
  });

  it('catches a hit when the axolotl waits at each Legendary spot, from carp-2 in the sunken hull and from bass-0 past the inflow', () => {
    const legendaries = spots.filter((spot) => spot.rarity === 'legendary');
    const hitters = legendaries.map((spot) => listWaitEvents(spot, startWindow).find((event) => event.type === 'hit'));
    expect(hitters.map((hit) => (hit?.type === 'hit' ? hit.sourceId : null))).toEqual(['carp-2', 'bass-0', 'bass-0', 'bass-0']);
  });

  it.each(spots)('bands $id by S = 155 for the tilapia, 135 for the carp, 180 for the bass and the touch reach for the poles', (spot) => {
    const threats = zoneThreats(zone);
    expect(threats.map((threat) => threat.strike)).toEqual([155, 155, 135, 135, 135, 135, 135, 180, 180, 18, 18, 18, 18]);
    expect(PUNTING_POLE.touchReach).toBe(18);
    expect(meetsThreatRiskRule(spot, spot.rarity, threats)).toBe(true);
  });

  it.each(spots)("finds a safe start out of the rock on #130's relaxed rule past every tilapia, carp and bass reach and every pole sweep for $id", (spot) => {
    const start = nearestOpenSafeStart(spot, zone);
    expect(DEEP_CANAL_TILAPIA.lungeRange + TILAPIA_CHASE.leash).toBe(TILAPIA_REACH);
    expect(DEEP_CANAL_CARP.tuning.lungeRange + (DEEP_CANAL_CARP.tuning.chase?.leash ?? 0)).toBe(CARP_REACH);
    expect(DEEP_CANAL_BASS.tuning.lungeRange + BLACK_BASS_CHASE.leash).toBe(BASS_REACH);
    for (const route of zone.tilapiaRoutes) expect(routeLoopDistance(start, route.waypoints), route.id).toBeGreaterThan(TILAPIA_REACH);
    for (const route of carp) expect(routeLoopDistance(start, route.waypoints), route.id).toBeGreaterThan(CARP_REACH);
    for (const route of bass) expect(routeLoopDistance(start, route.waypoints), route.id).toBeGreaterThan(BASS_REACH);
    for (const spawn of poles) expect(shapeDistance(start, movingHazardSweep(spawn)), spawn.id).toBeGreaterThan(spawn.type.touchReach);
    expect(bodyInAnyRock(start, rocks)).toBe(false);
  });

  it.each(spots)('lets the axolotl grab $id and swim back to its safe start without a hit for some start time, a Legendary with one Tail Dash', (spot) => {
    expect(visitSpot(spot, fourLegs), `${spot.id} (${spot.rarity}) is hit at every start time`).not.toBeNull();
  }, 120_000);

  it.each(spots)('keeps $id at least the turn clearance from every tilapia, carp and bass waypoint', (spot) => {
    expect(turnDistance(spot, [...zone.tilapiaRoutes, ...zone.predatorRoutes])).toBeGreaterThanOrEqual(RISK.turnClearance);
  });
});

describe('beating Area 8 with one leg', () => {
  const { zone } = deepCanal;
  const spots = poolSpots(zone);

  it.each(spots)('lets a one-leg axolotl grab $id and swim back to its safe start without a hit for some start time, a Legendary with one Tail Dash on the way in', (spot) => {
    expect(visitSpot(spot, oneLeg), `${spot.id} (${spot.rarity}) is hit at every start time`).not.toBeNull();
  }, 120_000);

  it.each(zone.strandingPlaces)('lets a one-leg axolotl reach the stranded axolotl at $id and swim back without a hit for some start time', (place) => {
    const found = firstStart((startSteps) => visitFrom(place, RESCUE.reachRadius, false, oneLeg, startSteps));
    expect(found, `${place.id} is hit at every start time`).not.toBeNull();
  }, 120_000);

  it.each([
    ['surface', zone.mainPath],
    ['deep', DEEP_WAY],
  ] as const)('lets a one-leg axolotl swim the %s lane from the Home Spot to the exit with no hit, pushed by the trajineras and stopped by the rock', (lane, way) => {
    const found = firstStart((startSteps) => swimLane(way, startSteps));
    expect(found, `the ${lane} lane is hit at every start time`).not.toBeNull();
    expect(found?.time).toBe(ONE_LEG_LANE_START[lane]);
    expect(found?.run.seconds).toBeCloseTo(ONE_LEG_LANE_SECONDS[lane], 1);
    expect(found?.run.seconds ?? Infinity).toBeLessThan(ONE_LEG_SWIM_LIMIT);
  }, 120_000);

  it('beats Area 8 with one leg on the full route: every snack in both lanes, east along the deep lane and back west along the surface lane as the divider forces, then out of the exit once it opens', () => {
    const found = firstStart(swimFullRoute);
    expect(found, 'the full route is hit at every start time').not.toBeNull();
    expect(found?.time).toBe(FULL_ROUTE_START);
    expect(found?.run.state.items).toHaveLength(44);
    expect(snacksLeft(found?.run.state.items ?? [])).toBe(0);
    expect(exitOpen(snacksLeft(found?.run.state.items ?? []))).toBe(true);
    expect(found?.run.state.lanes.slice(0, 4)).toEqual(['west', 'deep', 'east', 'surface']);
    expect(found?.run.seconds ?? Infinity).toBeLessThan(FULL_ROUTE_LIMIT);
    expect(found?.run.seconds).toBeCloseTo(FULL_ROUTE_SECONDS, 1);
  }, 120_000);

  it.each([...zone.tilapiaRoutes, ...zone.predatorRoutes].map((route) => [route.id, route] as const))(
    'never lands a strike from %s on a one-leg axolotl that swims straight away when it warns',
    (id, route) => {
      const events = swimAwayFromWarning(route);
      expect(events.some((event) => event.type === 'telegraph' && event.sourceId === id)).toBe(true);
      expect(events.filter((event) => event.type === 'hit')).toEqual([]);
    },
  );
});

describe('Area 8 risk fairness on other seeds', () => {
  it.each(EXTRA_SEEDS)('keeps every spot, route, pole, boat, stone, current, stranding place and the main path identical to the default seed for seed %i, so every proof but the full route holds for it too', (seed) => {
    const layout = buildZone(DEEP_CANAL_LAYOUT, seed);
    expect(layout.tilapiaRoutes).toEqual(deepCanal.zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(deepCanal.zone.predatorRoutes);
    expect(layout.movingHazards).toEqual(deepCanal.zone.movingHazards);
    expect(layout.trajineras).toEqual(deepCanal.zone.trajineras);
    expect(layout.rockWalls).toEqual(deepCanal.zone.rockWalls);
    expect(layout.spots).toEqual(deepCanal.zone.spots);
    expect(layout.finds).toEqual(deepCanal.zone.finds);
    expect(layout.currents).toEqual(deepCanal.zone.currents);
    expect(layout.mainPath).toEqual(deepCanal.zone.mainPath);
    expect(layout.strandingPlaces).toEqual(deepCanal.zone.strandingPlaces);
  });
});

