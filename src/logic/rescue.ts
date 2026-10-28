/**
 * Stranded axolotl rescue rules (PRD C2 to C6): whether an axolotl is stranded this trip, which
 * morph waits where, whether it is waiting, following or safe, how it follows the player and
 * where it rests once banked.
 */
import type { AreaData } from './areas';
import type { AxolotlSex } from './axolotlLook';
import { axolotlFindId, rescuableMorphs, type RealMorphId } from './morphs';
import { mulberry32 } from './rng';
import type { FindId, Holdings } from './tripBag';
import type { TripPhase } from './tripEvents';
import type { Point, StrandingPlace } from './zone';

/** Rescue follower tuning; units are world pixels and seconds. */
export interface RescueTuning {
  /** Centre distance in px within which the player reaches the stranded axolotl (inclusive). */
  reachRadius: number;
  /** Path length in px the follower keeps behind the player along the player's trail. */
  followGap: number;
  /** Largest straight-line distance in px between the follower and the player. */
  maxLag: number;
  /** Follower speed cap in px/s; above the Tail Dash speed so it always keeps up. */
  followSpeed: number;
  /** Distance in px the player moves before the next trail point is recorded. */
  trailStep: number;
  /** Rest point offset in px from the Home Spot centre; inside the Home Spot ring. */
  restOffset: Readonly<Point>;
}

/** Provisional rescue values. */
export const RESCUE: Readonly<RescueTuning> = Object.freeze({
  reachRadius: 32,
  followGap: 44,
  maxLag: 90,
  followSpeed: 400,
  trailStep: 4,
  restOffset: Object.freeze({ x: -44, y: 40 }),
});

/**
 * A stranded axolotl left waiting after a trip, stored so the next trip shows it at the same place
 * as the same boy or girl.
 */
export interface WaitingStranded {
  morph: RealMorphId;
  sex: AxolotlSex;
  placeId: string;
}

/** This trip's stranded axolotl. `met` is true when it was already met on an earlier trip. */
export interface Stranding {
  id: FindId;
  morph: RealMorphId;
  sex: AxolotlSex;
  placeId: string;
  x: number;
  y: number;
  met: boolean;
}

/**
 * A stranded axolotl during a trip. `place` is where it waits, `pos` its centre, `trail` the
 * player positions it follows (oldest first) and `facing` 1 for right, -1 for left.
 */
export interface RescueState {
  id: FindId;
  morph: RealMorphId;
  sex: AxolotlSex;
  placeId: string;
  place: Point;
  met: boolean;
  pos: Point;
  trail: Point[];
  facing: 1 | -1;
}

/** Waiting at its place, following the player (in the Trip Bag), or banked for good. */
export type RescueStatus = 'waiting' | 'following' | 'safe';

/** Chance from 0 to 1 that a trip with nobody waiting has a stranded axolotl: 40% (PRD C2, issue #111). */
export const STRANDING_CHANCE = 0.4;

/** The area's stranding chance from 0 to 1: its own strandingChance, else STRANDING_CHANCE. */
export function areaStrandingChance(area: Pick<AreaData, 'strandingChance'>): number {
  return area.strandingChance ?? STRANDING_CHANCE;
}

const STRANDING_SEED_SALT = 0x5743a11d;
const STRANDING_CHANCE_SALT = 0xc2b2ae35;
/** Smallest |x velocity| in px/s before the follower's facing may flip. */
const FACING_HYSTERESIS = 2;

/**
 * This trip's stranded axolotl, or null when every real morph is owned (C6) or there are no
 * places. A waiting record whose morph is still rescuable and whose place is in `places` comes back
 * with its sex and `met` true. Otherwise a morph not in `owned`, then a place, then a sex are picked
 * by `tripSeed`; the sex is the third draw, so the morph and place picked for a seed do not depend on it.
 */
export function pickStranding(
  owned: readonly RealMorphId[],
  waiting: WaitingStranded | null,
  places: readonly StrandingPlace[],
  tripSeed: number,
): Stranding | null {
  const rescuable = rescuableMorphs(owned);
  if (rescuable.length === 0 || places.length === 0) return null;
  const waitingPlace = waiting && rescuable.includes(waiting.morph)
    ? places.find((place) => place.id === waiting.placeId)
    : undefined;
  if (waiting && waitingPlace) return createStranding(waiting.morph, waiting.sex, waitingPlace, true);
  const rng = mulberry32((tripSeed ^ STRANDING_SEED_SALT) >>> 0);
  const morph = rescuable[Math.floor(rng() * rescuable.length)];
  const place = places[Math.floor(rng() * places.length)];
  const sex: AxolotlSex = rng() < 0.5 ? 'boy' : 'girl';
  return createStranding(morph, sex, place, false);
}

/** This trip's stranding roll from 0 (inclusive) to 1: one draw from its own trip seed stream. */
export function strandingRoll(tripSeed: number): number {
  return mulberry32((tripSeed ^ STRANDING_CHANCE_SALT) >>> 0)();
}

/**
 * This trip's stranded axolotl, or null. A valid waiting record always comes back met, with no
 * roll (C5); null when pickStranding gives null (C6). Otherwise the axolotl pickStranding picks
 * is stranded only when strandingRoll is below `chance`. A waiting record whose morph is now owned
 * or whose place is unknown counts as nobody waiting, so the roll applies. Throws when `chance`
 * is not a number from 0 to 1.
 */
export function tripStranding(
  owned: readonly RealMorphId[],
  waiting: WaitingStranded | null,
  places: readonly StrandingPlace[],
  tripSeed: number,
  chance: number = STRANDING_CHANCE,
): Stranding | null {
  if (!(chance >= 0 && chance <= 1)) {
    throw new RangeError(`tripStranding: chance ${chance} is not a number from 0 to 1`);
  }
  const stranding = pickStranding(owned, waiting, places, tripSeed);
  if (stranding === null || stranding.met) return stranding;
  return strandingRoll(tripSeed) < chance ? stranding : null;
}

/** A rescue waiting at its stranding place, with an empty trail, facing left. */
export function createRescue(stranding: Stranding): RescueState {
  return {
    id: stranding.id,
    morph: stranding.morph,
    sex: stranding.sex,
    placeId: stranding.placeId,
    place: { x: stranding.x, y: stranding.y },
    met: stranding.met,
    pos: { x: stranding.x, y: stranding.y },
    trail: [],
    facing: -1,
  };
}

/**
 * 'safe' once its id is banked; else 'waiting' while the trip is carrying or ended; else
 * 'following' while its id is in the Trip Bag; else 'waiting'.
 */
export function rescueStatus(rescue: RescueState, holdings: Holdings, phase: TripPhase): RescueStatus {
  if (holdings.banked.includes(rescue.id)) return 'safe';
  if (phase === 'carrying' || phase === 'ended') return 'waiting';
  return holdings.bag.includes(rescue.id) ? 'following' : 'waiting';
}

/** Whether `pos` is within the reach radius of the rescue (inclusive). */
export function reachesRescue(rescue: RescueState, pos: Point, tuning: RescueTuning = RESCUE): boolean {
  return distanceBetween(rescue.pos, pos) <= tuning.reachRadius;
}

/**
 * Advances the follower by `dt` seconds behind `leader`. The leader is added to the trail once it
 * has moved at least the trail step, and the trail keeps just over followGap + maxLag of path. The
 * follower swims at up to followSpeed toward the point followGap of path behind the leader, then
 * is pulled to within maxLag of the leader. A zero, negative or non-finite `dt` returns the input.
 */
export function stepFollower(
  rescue: RescueState,
  leader: Point,
  dt: number,
  tuning: RescueTuning = RESCUE,
): RescueState {
  if (!(dt > 0) || !Number.isFinite(dt)) return rescue;
  const trail = trimTrail(appendTrail(rescue.trail, leader, tuning.trailStep), leader, tuning.followGap + tuning.maxLag);
  const target = pointBehind(leader, trail, rescue.pos, tuning.followGap);
  const moved = moveToward(rescue.pos, target, tuning.followSpeed * dt);
  const pos = leashTo(moved, leader, tuning.maxLag);
  return { ...rescue, pos, trail, facing: nextFacing(rescue.facing, (pos.x - rescue.pos.x) / dt) };
}

/**
 * Advances a safe rescue by `dt` seconds toward its rest point, `home` plus the rest offset, at
 * followSpeed, with an empty trail. A zero, negative or non-finite `dt` returns the input.
 */
export function stepToRest(rescue: RescueState, home: Point, dt: number, tuning: RescueTuning = RESCUE): RescueState {
  if (!(dt > 0) || !Number.isFinite(dt)) return rescue;
  const rest = { x: home.x + tuning.restOffset.x, y: home.y + tuning.restOffset.y };
  const pos = moveToward(rescue.pos, rest, tuning.followSpeed * dt);
  return { ...rescue, pos, trail: [], facing: nextFacing(rescue.facing, (pos.x - rescue.pos.x) / dt) };
}

/** The rescue back at its stranding place with an empty trail (C5). */
export function sendRescueBack(rescue: RescueState): RescueState {
  return { ...rescue, pos: { x: rescue.place.x, y: rescue.place.y }, trail: [] };
}

/**
 * The waiting record to keep after a trip: the morph, sex and place of a rescue the player met but
 * did not bank, else null.
 */
export function waitingAfterTrip(
  rescue: RescueState | null,
  holdings: Holdings,
  phase: TripPhase,
): WaitingStranded | null {
  if (!rescue || !rescue.met || rescueStatus(rescue, holdings, phase) === 'safe') return null;
  return { morph: rescue.morph, sex: rescue.sex, placeId: rescue.placeId };
}

function createStranding(morph: RealMorphId, sex: AxolotlSex, place: StrandingPlace, met: boolean): Stranding {
  return { id: axolotlFindId(morph), morph, sex, placeId: place.id, x: place.x, y: place.y, met };
}

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** `from` moved toward `to` by `t` of the way, with `t` clamped to 0..1. */
function lerpPoint(from: Point, to: Point, t: number): Point {
  const share = Math.min(1, Math.max(0, t));
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
}

/**
 * The trail with `leader` added once it has moved at least `trailStep` from the newest point.
 * Returns the same array when nothing is added, so a step that adds no point allocates nothing.
 */
function appendTrail(trail: Point[], leader: Point, trailStep: number): Point[] {
  const last = trail[trail.length - 1];
  if (last && distanceBetween(last, leader) < trailStep) return trail;
  return [...trail, { x: leader.x, y: leader.y }];
}

/** The newest trail points whose path from `leader` first reaches `keepLength`; older ones drop. */
function trimTrail(trail: Point[], leader: Point, keepLength: number): Point[] {
  let pathLength = 0;
  let previous = leader;
  for (let i = trail.length - 1; i >= 0; i--) {
    pathLength += distanceBetween(previous, trail[i]);
    if (pathLength >= keepLength) return trail.slice(i);
    previous = trail[i];
  }
  return trail;
}

/**
 * The point `distance` of path behind `leader`, walking `trail` (oldest first) from its newest
 * point back to its oldest and then on to `end`; `end` when the path is shorter. Walks in place,
 * with no copy of the trail.
 */
function pointBehind(leader: Point, trail: readonly Point[], end: Point, distance: number): Point {
  let remaining = distance;
  let previous = leader;
  for (let i = trail.length - 1; i >= -1; i--) {
    const point = i >= 0 ? trail[i] : end;
    const segment = distanceBetween(previous, point);
    if (segment >= remaining && segment > 0) return lerpPoint(previous, point, remaining / segment);
    remaining -= segment;
    previous = point;
  }
  return { x: previous.x, y: previous.y };
}

function moveToward(from: Point, to: Point, maxStep: number): Point {
  const gap = distanceBetween(from, to);
  if (gap <= maxStep) return { x: to.x, y: to.y };
  return lerpPoint(from, to, maxStep / gap);
}

/** `pos` pulled onto the segment from `leader` so it is at most `maxLag` from it. */
function leashTo(pos: Point, leader: Point, maxLag: number): Point {
  const lag = distanceBetween(pos, leader);
  if (lag <= maxLag) return pos;
  return lerpPoint(leader, pos, maxLag / lag);
}

function nextFacing(facing: 1 | -1, vx: number): 1 | -1 {
  if (vx > FACING_HYSTERESIS) return 1;
  if (vx < -FACING_HYSTERESIS) return -1;
  return facing;
}
