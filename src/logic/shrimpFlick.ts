/**
 * The freshwater shrimp's repeat flick (PRD H4, A19, open question 272, ND-25) and its hops round
 * its home (issue #131, ND-5, ND-6). Separate from the one-time darter (snackDart.ts), which areas
 * with shrimp turn off (ND-27).
 */
import { drawnSnackX, drawnSnackY, type Collectible, type SnackFrame } from './collectibles';
import {
  mobileSnackClear,
  mobileSnackHardClear,
  shrimpBox,
  shrimpGlideClear,
  shrimpRule,
  type MobileSnackAvoid,
  type ShrimpPoseState,
  type ShrimpRule,
} from './mobileSnacks';
import { SHRIMP } from './tuning';
import type { Point, SwimBounds } from './zone';

/**
 * A resting shrimp (issue #131, ND-5): its id, the drift time (SnackFrame.driftT) from which it is
 * ready to hop or flick, the index of the hop spot it aims at next, the x sign of its last hop (0
 * before any hop) and whether this rest follows a flick.
 */
export interface ShrimpRest {
  readonly id: string;
  readonly readyAt: number;
  readonly next: number;
  readonly hopSign: -1 | 0 | 1;
  readonly afterFlick: boolean;
}

/**
 * A flick or hop under way: the shrimp's id, the base x/y displacement it has still to glide, the
 * index of the hop spot it aims at once it lands and the x sign of its last hop (0 before any hop).
 */
export interface ShrimpGlide {
  readonly id: string;
  readonly restX: number;
  readonly restY: number;
  readonly next: number;
  readonly hopSign: -1 | 0 | 1;
}

/**
 * Flick state of one trip (ND-25; issue #131, ND-5): the rule, each shrimp's index in the trip's
 * items by id, the shrimp at rest with their ready-at times, the flicks under way and the hops under
 * way. A shrimp is in exactly one of `resting`, `flicks` and `hops`.
 */
export interface ShrimpFlickState {
  readonly rule: Readonly<ShrimpRule>;
  /** Built once per trip and shared by every later state; a stale or missing entry falls back to a scan. */
  readonly indexById: ReadonlyMap<string, number>;
  readonly resting: readonly ShrimpRest[];
  readonly flicks: readonly ShrimpGlide[];
  readonly hops: readonly ShrimpGlide[];
}

/**
 * Outcome of a flick step: the new items (input untouched), the new flick state and the ids of the
 * shrimp that start a flick in this step (issue #166, ND-15), in resting order. A hop or a rest
 * again adds no id; a flick that lands at once under reduced motion still does.
 */
export interface ShrimpFlickStep {
  items: Collectible[];
  state: ShrimpFlickState;
  readonly flickStarts: readonly string[];
}

/** What a ready shrimp does this frame: flick, hop, or rest again when no hop spot is clear; `at` is its index in `resting`. */
type ShrimpStart =
  | { readonly kind: 'flick'; readonly at: number; readonly glide: ShrimpGlide }
  | { readonly kind: 'hop'; readonly at: number; readonly glide: ShrimpGlide }
  | { readonly kind: 'rest'; readonly at: number; readonly rest: ShrimpRest };

/** Where the starts and landings of one step go. */
interface ShrimpStepSinks {
  readonly resting: ShrimpRest[];
  readonly flicks: ShrimpGlide[];
  readonly hops: ShrimpGlide[];
}

/** Whether a shrimp with these hop spots hops (issue #131, ND-5): 2 or more spots. A 1-spot home or none only flicks. */
function hopsAround(home: readonly Readonly<Point>[] | undefined): home is readonly Readonly<Point>[] {
  return home !== undefined && home.length >= 2;
}

/** Seconds a shrimp rests after a hop (issue #131, ND-5). */
function hopRestOf(rule: Readonly<ShrimpRule>): number {
  return rule.restFor * SHRIMP.hopRestShare;
}

function signOf(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

/**
 * Fresh flick state for a trip (ND-25; issue #131, ND-5): every shrimp among `items` (kind
 * 'shrimp'), in list order, rests and aims at its second hop spot, with no flick or hop under way.
 * A shrimp with a home of 2 or more spots is hopping shrimp n of N, in list order, and first rests
 * (n - 1) / N of a hop rest; every other shrimp is ready now. Each shrimp's index in `items` is
 * kept by id, so stepShrimpFlicks finds it without a scan while the items keep that order. Throws
 * RangeError when `rule` fails shrimpRule().
 */
export function createShrimpFlicks(
  items: readonly Readonly<Pick<Collectible, 'id' | 'kind' | 'home'>>[],
  rule: Readonly<ShrimpRule>,
): ShrimpFlickState {
  const checked = shrimpRule(rule.triggerRadius, rule.restFor, rule.flickDistance, rule.flickSpeed);
  const indexById = new Map<string, number>();
  items.forEach((item, index) => {
    if (item.kind === 'shrimp' && !indexById.has(item.id)) indexById.set(item.id, index);
  });
  const shrimp = items.filter((item) => item.kind === 'shrimp');
  const hopping = shrimp.filter((item) => hopsAround(item.home)).length;
  const hopRest = hopRestOf(checked);
  let rank = 0;
  const resting = shrimp.map((item): ShrimpRest => {
    if (!hopsAround(item.home)) return { id: item.id, readyAt: -Infinity, next: 0, hopSign: 0, afterFlick: false };
    const readyAt = (rank / hopping) * hopRest;
    rank += 1;
    return { id: item.id, readyAt, next: 1, hopSign: 0, afterFlick: false };
  });
  return { rule: checked, indexById, resting, flicks: [], hops: [] };
}

/** Whether the shrimp with this id has a flick under way, for its pose (mobileSnackPose). Allocates nothing. */
export function isShrimpFlicking(state: ShrimpFlickState, id: string): boolean {
  for (const flick of state.flicks) {
    if (flick.id === id) return true;
  }
  return false;
}

/** Whether the shrimp with this id is resting after a flick (issue #131, ND-10), for its pose. Allocates nothing. */
export function isShrimpRestingAfterFlick(state: ShrimpFlickState, id: string): boolean {
  for (const rest of state.resting) {
    if (rest.id === id) return rest.afterFlick;
  }
  return false;
}

/**
 * The x sign of the last hop of the shrimp with this id, a hop under way included (issue #131,
 * ND-10), for its pose: 0 before any hop, for a straight up or down hop, or for an unknown id.
 * Allocates nothing.
 */
export function readShrimpHopSign(state: ShrimpFlickState, id: string): -1 | 0 | 1 {
  for (const rest of state.resting) {
    if (rest.id === id) return rest.hopSign;
  }
  for (const hop of state.hops) {
    if (hop.id === id) return hop.hopSign;
  }
  for (const flick of state.flicks) {
    if (flick.id === id) return flick.hopSign;
  }
  return 0;
}

/**
 * A reusable id-indexed view of one flick state for posing every shrimp in a frame (issue #131,
 * ND-10): `source` is the state the maps were filled from, or null before the first read.
 */
export interface ShrimpPoseLookup {
  source: ShrimpFlickState | null;
  readonly rests: Map<string, ShrimpRest>;
  readonly hops: Map<string, ShrimpGlide>;
  readonly flicks: Map<string, ShrimpGlide>;
}

/** An empty pose lookup, to keep and reuse for every frame of a trip. */
export function createShrimpPoseLookup(): ShrimpPoseLookup {
  return { source: null, rests: new Map(), hops: new Map(), flicks: new Map() };
}

function fillById<T extends { readonly id: string }>(byId: Map<string, T>, entries: readonly T[]): void {
  byId.clear();
  for (const entry of entries) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
}

/**
 * Writes the pose state of the shrimp with this id in `state` into `out` and returns it: as
 * isShrimpFlicking, isShrimpRestingAfterFlick and readShrimpHopSign would read it, from one map
 * look-up per list. Refills `lookup` only when `state` is not the state it was last filled from, so
 * posing S shrimp costs O(S) per state, not O(S²). Allocates no objects.
 */
export function readShrimpPose(
  lookup: ShrimpPoseLookup,
  state: ShrimpFlickState,
  id: string,
  out: ShrimpPoseState,
): ShrimpPoseState {
  if (lookup.source !== state) {
    fillById(lookup.rests, state.resting);
    fillById(lookup.hops, state.hops);
    fillById(lookup.flicks, state.flicks);
    lookup.source = state;
  }
  const rest = lookup.rests.get(id);
  const flick = lookup.flicks.get(id);
  out.flicking = flick !== undefined;
  out.afterFlick = rest !== undefined && rest.afterFlick;
  out.hopSign = (rest ?? lookup.hops.get(id) ?? flick)?.hopSign ?? 0;
  return out;
}

function indexOfId(items: readonly Collectible[], id: string): number {
  for (let index = 0; index < items.length; index++) {
    if (items[index].id === id) return index;
  }
  return -1;
}

/** The index of the item with this id: its `state.indexById` entry when that still holds the id, else a scan. */
function slotOf(items: readonly Collectible[], state: ShrimpFlickState, id: string): number {
  const known = state.indexById.get(id);
  if (known !== undefined && known < items.length && items[known].id === id) return known;
  return indexOfId(items, id);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Whether the point is inside the box round the hop spots grown by `grow` px each way, edges included (issue #131, ND-6). */
function insideGrownHome(point: Readonly<Point>, home: readonly Readonly<Point>[], grow: number): boolean {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const spot of home) {
    minX = Math.min(minX, spot.x);
    maxX = Math.max(maxX, spot.x);
    minY = Math.min(minY, spot.y);
    maxY = Math.max(maxY, spot.y);
  }
  return point.x >= minX - grow && point.x <= maxX + grow && point.y >= minY - grow && point.y <= maxY + grow;
}

/**
 * Whether a flick may land at `target` (ND-26; issue #131, ND-6, ND-7): a hopping shrimp lands only
 * inside its home box grown by the flick distance, where shrimpBox passes mobileSnackHardClear; any
 * other shrimp where shrimpBox passes mobileSnackClear. Either way the whole glide there must pass
 * shrimpGlideClear.
 */
function flickLandingClear(
  item: Collectible,
  target: Readonly<Point>,
  frame: SnackFrame,
  avoid: MobileSnackAvoid,
  rule: Readonly<ShrimpRule>,
): boolean {
  const box = shrimpBox(target, frame.drift);
  const lands = hopsAround(item.home)
    ? insideGrownHome(target, item.home, rule.flickDistance) && mobileSnackHardClear(box, avoid)
    : mobileSnackClear(box, avoid);
  return lands && shrimpGlideClear(item, target, frame.drift, avoid);
}

/** The flick of `rule.flickDistance` px straight away from the head, from (dx, dy) at `distance`, or null when its landing is not clear. */
function flickFrom(
  item: Collectible,
  dx: number,
  dy: number,
  distance: number,
  frame: SnackFrame,
  rest: ShrimpRest,
  avoid: MobileSnackAvoid,
  rule: Readonly<ShrimpRule>,
): ShrimpGlide | null {
  const restX = (dx / distance) * rule.flickDistance;
  const restY = (dy / distance) * rule.flickDistance;
  if (!flickLandingClear(item, { x: item.x + restX, y: item.y + restY }, frame, avoid, rule)) return null;
  return { id: item.id, restX, restY, next: rest.next, hopSign: rest.hopSign };
}

/**
 * The hop toward the shrimp's next hop spot, or toward the first spot after it whose landing is
 * clear (issue #131, ND-5): at most SHRIMP.hopShare of the flick distance, landing on the spot
 * when it is that close and then aiming at the one after. The landing's shrimpBox must pass
 * mobileSnackHardClear, and the whole glide there shrimpGlideClear. A spot the shrimp is already on
 * is skipped. Null when no hop is clear.
 */
function hopFrom(
  item: Collectible,
  home: readonly Readonly<Point>[],
  frame: SnackFrame,
  rest: ShrimpRest,
  avoid: MobileSnackAvoid,
  rule: Readonly<ShrimpRule>,
): ShrimpGlide | null {
  const longest = rule.flickDistance * SHRIMP.hopShare;
  for (let skip = 0; skip < home.length; skip++) {
    const spotIndex = (rest.next + skip) % home.length;
    const dx = home[spotIndex].x - item.x;
    const dy = home[spotIndex].y - item.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    const reaches = distance <= longest;
    const share = reaches ? 1 : longest / distance;
    const restX = dx * share;
    const restY = dy * share;
    const landing: Point = { x: item.x + restX, y: item.y + restY };
    if (!mobileSnackHardClear(shrimpBox(landing, frame.drift), avoid) || !shrimpGlideClear(item, landing, frame.drift, avoid)) continue;
    const next = reaches ? (spotIndex + 1) % home.length : spotIndex;
    return { id: item.id, restX, restY, next, hopSign: signOf(restX) };
  }
  return null;
}

/**
 * What the resting shrimp at `resting[at]` starts this frame, or null. It must be ready at the
 * frame's drift time and uncollected. Drawn within the trigger radius of the head but not on it, it
 * flicks when the landing is clear. A hopping shrimp drawn farther than SHRIMP.holdDistance from the
 * head hops, or rests a hop rest again when no hop spot is clear.
 */
function startFrom(
  items: readonly Collectible[],
  head: Point,
  frame: SnackFrame,
  state: ShrimpFlickState,
  at: number,
  avoid: MobileSnackAvoid,
): ShrimpStart | null {
  const rest = state.resting[at];
  if (frame.driftT < rest.readyAt) return null;
  const index = slotOf(items, state, rest.id);
  if (index < 0 || items[index].collected) return null;
  const item = items[index];
  const dx = drawnSnackX(item, index, frame) - head.x;
  const dy = drawnSnackY(item, index, frame) - head.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 0 && distance <= state.rule.triggerRadius) {
    const flick = flickFrom(item, dx, dy, distance, frame, rest, avoid, state.rule);
    return flick ? { kind: 'flick', at, glide: flick } : null;
  }
  if (!hopsAround(item.home) || distance <= SHRIMP.holdDistance) return null;
  const hop = hopFrom(item, item.home, frame, rest, avoid, state.rule);
  if (hop) return { kind: 'hop', at, glide: hop };
  const again: ShrimpRest = { ...rest, readyAt: frame.driftT + hopRestOf(state.rule), afterFlick: false };
  return { kind: 'rest', at, rest: again };
}

/** The first start among the resting shrimp, in list order, or null when none starts. */
function firstStart(
  items: readonly Collectible[],
  head: Point,
  frame: SnackFrame,
  state: ShrimpFlickState,
  avoid: MobileSnackAvoid,
): ShrimpStart | null {
  for (let at = 0; at < state.resting.length; at++) {
    const start = startFrom(items, head, frame, state, at, avoid);
    if (start) return start;
  }
  return null;
}

function placeStart(start: ShrimpStart, sinks: ShrimpStepSinks): void {
  if (start.kind === 'flick') sinks.flicks.push(start.glide);
  else if (start.kind === 'hop') sinks.hops.push(start.glide);
  else sinks.resting.push(start.rest);
}

/**
 * Sorts every resting shrimp into `sinks`: those before `first` stay at rest, `first` starts, and
 * each one after it starts or stays at rest. With no `first`, every one stays at rest.
 */
function collectStarts(
  items: readonly Collectible[],
  head: Point,
  frame: SnackFrame,
  state: ShrimpFlickState,
  avoid: MobileSnackAvoid,
  first: ShrimpStart | null,
  sinks: ShrimpStepSinks,
): void {
  const firstAt = first ? first.at : state.resting.length;
  for (let at = 0; at < firstAt; at++) sinks.resting.push(state.resting[at]);
  if (!first) return;
  placeStart(first, sinks);
  for (let at = firstAt + 1; at < state.resting.length; at++) {
    const start = startFrom(items, head, frame, state, at, avoid);
    if (start) placeStart(start, sinks);
    else sinks.resting.push(state.resting[at]);
  }
}

function glideMoves(items: readonly Collectible[], state: ShrimpFlickState, glide: ShrimpGlide): boolean {
  const index = slotOf(items, state, glide.id);
  return index >= 0 && !items[index].collected;
}

function anyGlideMoves(items: readonly Collectible[], state: ShrimpFlickState, glides: readonly ShrimpGlide[]): boolean {
  for (const glide of glides) {
    if (glideMoves(items, state, glide)) return true;
  }
  return false;
}

/** Glides the shrimp at `index` in `updated` one frame; returns the glide still under way, or null when it landed. */
function glideOnce(updated: Collectible[], index: number, glide: ShrimpGlide, step: number, bounds: SwimBounds): ShrimpGlide | null {
  const rest = Math.hypot(glide.restX, glide.restY);
  const share = rest === 0 ? 1 : Math.min(step, rest) / rest;
  const item = updated[index];
  updated[index] = {
    ...item,
    x: clamp(item.x + glide.restX * share, bounds.minX, bounds.maxX),
    y: clamp(item.y + glide.restY * share, bounds.minY, bounds.maxY),
  };
  if (share >= 1) return null;
  return { ...glide, restX: glide.restX * (1 - share), restY: glide.restY * (1 - share) };
}

/** Where the glides of one kind land: ready at `readyAt`, after a flick or not, into `resting`; `state` finds each shrimp. */
interface GlideLanding {
  readonly state: ShrimpFlickState;
  readonly readyAt: number;
  readonly afterFlick: boolean;
  readonly resting: ShrimpRest[];
}

/**
 * Glides `glide` `step` px in `updated` when its shrimp is uncollected, looking the shrimp up once:
 * still under way, it goes in `left`; landed, it rests in `landing.resting`; eaten, it is dropped.
 */
function glideInto(
  updated: Collectible[],
  glide: ShrimpGlide,
  step: number,
  bounds: SwimBounds,
  landing: GlideLanding,
  left: ShrimpGlide[],
): void {
  const index = slotOf(updated, landing.state, glide.id);
  if (index < 0 || updated[index].collected) return;
  const still = step > 0 ? glideOnce(updated, index, glide, step, bounds) : glide;
  if (still) left.push(still);
  else landing.resting.push({ id: glide.id, readyAt: landing.readyAt, next: glide.next, hopSign: glide.hopSign, afterFlick: landing.afterFlick });
}

/**
 * Glides each of `glides`, then each of `started`, whose shrimp is uncollected `step` px in
 * `updated` in one pass, and returns those still under way. Each one that lands rests in
 * `landing.resting`, ready at `landing.readyAt`; an eaten one is dropped.
 */
function glideAll(
  updated: Collectible[],
  glides: readonly ShrimpGlide[],
  started: readonly ShrimpGlide[],
  step: number,
  bounds: SwimBounds,
  landing: GlideLanding,
): ShrimpGlide[] {
  const left: ShrimpGlide[] = [];
  for (const glide of glides) glideInto(updated, glide, step, bounds, landing, left);
  for (const glide of started) glideInto(updated, glide, step, bounds, landing, left);
  return left;
}

/**
 * One frame of shrimp flicks and hops (PRD H4, A19, ND-25; issue #131, ND-5, ND-6). Run it after
 * the one-time darts and before the Snack magnet and the eat. `head` is the head reach centre;
 * `frame` draws the snacks; `avoid.worms` is where each plastic worm is now.
 *
 * A resting shrimp ready at `frame.driftT`, uncollected and drawn within `rule.triggerRadius` of
 * `head` (inclusive, not on it) starts a flick of `rule.flickDistance` px straight away from the
 * head. A shrimp with a home of 2 or more hop spots flicks only when the landing is inside its home
 * box grown by `rule.flickDistance` and its shrimpBox passes mobileSnackHardClear; any other shrimp
 * when its shrimpBox passes mobileSnackClear. Either way the whole glide from where it is to the
 * landing must pass shrimpGlideClear. Otherwise it stays ready.
 *
 * A ready hopping shrimp drawn farther than SHRIMP.holdDistance px from `head` hops toward its next
 * hop spot (see hopFrom), or, when no hop is clear, rests a hop rest again. A hop's whole glide must
 * pass shrimpGlideClear too. It never hops while the head is within SHRIMP.holdDistance px. A
 * 1-spot home, or none, never hops.
 *
 * A flick glides `rule.flickSpeed` x `dt` px a frame and a hop SHRIMP.hopShare of that, moving the
 * stored base x/y (clamped to `avoid.bounds`); both land at once under `reduced` motion. On landing
 * the shrimp rests: `rule.restFor` after a flick, SHRIMP.hopRestShare of it after a hop. A flick or
 * hop whose shrimp is eaten stops and is dropped with the next state change; the magnet's pull adds
 * to a glide. The clear checks run only when a ready shrimp would start, except that a ready shrimp
 * whose flick landing is blocked reruns its landing check and builds two small objects each frame
 * (known gap, issue #131, ND-12). Each shrimp is found through `state.indexById`, so a step reads
 * O(S) item ids for S shrimp, not O(S x items), while `items` keep their order.
 *
 * Returns null when nothing starts and nothing moves, allocating nothing except for that blocked
 * flick's two small objects. Otherwise returns a new
 * items array (input untouched) in which unmoved items are the same objects, the new state and
 * the ids of the shrimp that start a flick in this step (issue #166, ND-15).
 */
export function stepShrimpFlicks(
  items: readonly Collectible[],
  head: Point,
  frame: SnackFrame,
  state: ShrimpFlickState,
  reduced: boolean,
  avoid: MobileSnackAvoid,
  dt: number,
): ShrimpFlickStep | null {
  const rule = state.rule;
  const flickStep = reduced ? Infinity : rule.flickSpeed * Math.max(dt, 0);
  const hopStep = reduced ? Infinity : flickStep * SHRIMP.hopShare;
  const gliding = flickStep > 0 && (anyGlideMoves(items, state, state.flicks) || anyGlideMoves(items, state, state.hops));
  const first = firstStart(items, head, frame, state, avoid);
  if (!gliding && !first) return null;

  const sinks: ShrimpStepSinks = { resting: [], flicks: [], hops: [] };
  collectStarts(items, head, frame, state, avoid, first, sinks);
  const flickStarts = sinks.flicks.map((glide) => glide.id);
  const updated = items.slice();
  const resting = sinks.resting;
  const flicks = glideAll(updated, state.flicks, sinks.flicks, flickStep, avoid.bounds, {
    state,
    readyAt: frame.driftT + rule.restFor,
    afterFlick: true,
    resting,
  });
  const hops = glideAll(updated, state.hops, sinks.hops, hopStep, avoid.bounds, {
    state,
    readyAt: frame.driftT + hopRestOf(rule),
    afterFlick: false,
    resting,
  });
  return { items: updated, state: { rule, indexById: state.indexById, resting, flicks, hops }, flickStarts };
}
