import { GHOST_NET_FACT } from './factCards';
import { hazardShapeAt, shapeDistance, type HazardSpawn, type HazardType, type NetDrift } from './hazards';
import { DRIFTING_NETS, GHOST_NETS, type GhostNetTuning, type SwimTuning } from './tuning';
import type { Point } from './zone';

const TAU = Math.PI * 2;

/**
 * The ghost net hazard type: slow-only, so it never costs a leg and is not a threat. Spawns are
 * rects; the reach is measured from the rect edge to the explorer's body centre.
 */
export const GHOST_NET: Readonly<HazardType> = Object.freeze({
  id: 'ghost-net',
  name: 'Ghost net',
  costsLeg: false,
  reach: GHOST_NETS.reach,
  meetRange: GHOST_NETS.meetRange,
  fact: GHOST_NET_FACT,
});

/**
 * The safe passing width: the least clear width of a gap, between the places the body centre must
 * stay out of. One body height (twice the net reach, the body's half height) of room, so the
 * axolotl may stray half a body either way off the middle of a gap and still pass clear.
 */
export const SAFE_PASSING_WIDTH = 2 * GHOST_NET.reach;

/**
 * Ghost net state of a trip: the nets, the seconds of snag time left (0 when not snagged) and the
 * ids of the nets whose reach held the explorer on the last step. Functions in this module never
 * mutate their input; they return new states.
 */
export interface GhostNetState {
  nets: readonly Readonly<HazardSpawn>[];
  snagLeft: number;
  inReach: readonly string[];
}

type SnagTime = Pick<GhostNetTuning, 'snagTime'>;
type SnagSpeed = Pick<GhostNetTuning, 'speedFactor'>;
type SnagWriggle = Pick<GhostNetTuning, 'wriggleAmp' | 'wrigglePeriod'>;

/**
 * A ghost net's drift for area data (ND-11, PRD open question 258): there and back along (`dx`,
 * `dy`) once per `period` seconds of element time, `offset` seconds ahead (hazardShapeAt). Throws
 * RangeError when a value is not finite, when `period` is not greater than 0 or when the path is
 * longer than DRIFTING_NETS.maxPath px.
 */
export function netDrift(dx: number, dy: number, period: number, offset: number): Readonly<NetDrift> {
  if (![dx, dy, period, offset].every(Number.isFinite)) {
    throw new RangeError(`netDrift: dx ${dx}, dy ${dy}, period ${period} and offset ${offset} must be finite`);
  }
  if (!(period > 0)) throw new RangeError(`netDrift: period must be > 0, got ${period}`);
  const path = Math.hypot(dx, dy);
  if (path > DRIFTING_NETS.maxPath) {
    throw new RangeError(`netDrift: path ${path} px must be at most ${DRIFTING_NETS.maxPath} px`);
  }
  return Object.freeze({ dx, dy, period, offset });
}

/**
 * Whether `pos` is within the net's reach of where the net is at element time `elementTime`
 * (hazardShapeAt, N3), edge inclusive. A net with no drift is measured at its own shape.
 */
export function netTouchesAt(net: Readonly<HazardSpawn>, pos: Point, elementTime: number): boolean {
  return shapeDistance(pos, hazardShapeAt(net, elementTime)) <= net.type.reach;
}

/** The ghost net hazards, in data order; other hazards are skipped. Not snagged, in no net's reach. */
export function createGhostNets(hazards: readonly Readonly<HazardSpawn>[]): GhostNetState {
  const nets = hazards.filter((hazard) => hazard.type.id === GHOST_NET.id);
  return { nets, snagLeft: 0, inReach: [] };
}

/** Whether snag time is running. */
export function isSnagged(state: GhostNetState): boolean {
  return state.snagLeft > 0;
}

/**
 * The ids of the nets whose reach holds `pos` at `elementTime`, in data order. Returns `prior` itself when the ids
 * are the same as `prior`, so a step on which they do not change, in reach or not, allocates no
 * array; a new array is built only when they change.
 */
function netIdsInReach(
  nets: readonly Readonly<HazardSpawn>[],
  pos: Point,
  elementTime: number,
  prior: readonly string[],
): readonly string[] {
  let changed: string[] | null = null;
  let matched = 0;
  for (const net of nets) {
    if (!netTouchesAt(net, pos, elementTime)) continue;
    if (changed === null && prior[matched] === net.id) {
      matched += 1;
      continue;
    }
    changed ??= prior.slice(0, matched);
    changed.push(net.id);
  }
  if (changed !== null) return changed;
  return matched === prior.length ? prior : prior.slice(0, matched);
}

/**
 * Steps the ghost nets by `dt` seconds with the explorer's body centre at `pos`, each net measured
 * where it is at element time `elementTime` (netTouchesAt, N3, ND-11). Snag time counts down,
 * floored at 0. A new snag of `tuning.snagTime` seconds starts only when the explorer enters
 * the reach of the nets (in no net's reach on the last step, in some net's reach now) and `state`
 * is not snagged: never every step inside, never stacked, and entering overlapping nets at once is
 * one entry. So a new snag starts exactly when `state` is not snagged and the result is. Returns
 * `state` itself when `dt` is zero, negative or not finite (paused), or when nothing changes.
 */
export function stepGhostNets(
  state: GhostNetState,
  pos: Point,
  dt: number,
  elementTime = 0,
  tuning: SnagTime = GHOST_NETS,
): GhostNetState {
  if (!(dt > 0) || !Number.isFinite(dt)) return state;
  const inReach = netIdsInReach(state.nets, pos, elementTime, state.inReach);
  const entered = state.inReach.length === 0 && inReach.length > 0;
  const snagLeft = entered && !isSnagged(state) ? tuning.snagTime : Math.max(0, state.snagLeft - dt);
  if (snagLeft === state.snagLeft && inReach === state.inReach) return state;
  return { nets: state.nets, snagLeft, inReach };
}

/** Ends snag time at once, keeping which nets hold the explorer; returns `state` itself when not snagged. */
export function endSnag(state: GhostNetState): GhostNetState {
  if (state.snagLeft === 0) return state;
  return { nets: state.nets, snagLeft: 0, inReach: state.inReach };
}

/**
 * Swim tuning while snagged: only `maxSpeed` is scaled by `tuning.speedFactor`, so it multiplies
 * with the leg factor of `base` (legSwimTuning in src/logic/legs.ts) as queasySwimTuning does.
 * Acceleration and every Tail Dash value stay unchanged, so Tail Dash is not slowed. Returns `base`
 * itself when not snagged.
 */
export function snagSwimTuning(base: SwimTuning, state: GhostNetState, tuning: SnagSpeed = GHOST_NETS): SwimTuning {
  if (!isSnagged(state)) return base;
  return { ...base, maxSpeed: base.maxSpeed * tuning.speedFactor };
}

/**
 * Snag wriggle angle in radians at scene clock `clock` seconds: a sine of period
 * `tuning.wrigglePeriod` with peak `tuning.wriggleAmp`. 0 unless `snagged`, and 0 when `reduced`
 * (reduced motion) is true.
 */
export function snagWriggle(clock: number, snagged: boolean, reduced: boolean, tuning: SnagWriggle = GHOST_NETS): number {
  if (!snagged || reduced) return 0;
  return tuning.wriggleAmp * Math.sin((TAU * clock) / tuning.wrigglePeriod);
}
