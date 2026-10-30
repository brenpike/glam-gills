import { describe, expect, it } from 'vitest';
import {
  drawnSnackX,
  drawnSnackY,
  pullSnacksToward,
  type Collectible,
  type SnackDrift,
  type SnackFrame,
} from './collectibles';
import type { HazardRect, HazardShape } from './hazards';
import type { Threat } from './hiding';
import type { MobileSnackAvoid, ShrimpPoseState, ShrimpRule } from './mobileSnacks';
import {
  createShrimpFlicks,
  createShrimpPoseLookup,
  isShrimpFlickLandingClear,
  isShrimpFlicking,
  isShrimpRestingAfterFlick,
  readShrimpHopSign,
  readShrimpPose,
  stepShrimpFlicks,
  type ShrimpFlickState,
  type ShrimpFlickStep,
} from './shrimpFlick';
import { SHRIMP as SHRIMP_TUNING, SNACK_REACH } from './tuning';
import type { CollectibleKind, Point, SwimBounds } from './zone';

const BOUNDS: SwimBounds = { minX: 40, maxX: 1880, minY: 94, maxY: 296 };
const STILL_DRIFT: SnackDrift = { amplitudeX: 0, amplitudeY: 0, periodX: 10, periodY: 8 };
const STILL: SnackFrame = { driftT: 0, bobT: 0, bobbing: false, drift: STILL_DRIFT, bounds: BOUNDS };
const AVOID: MobileSnackAvoid = {
  bounds: BOUNDS,
  homeSpot: { x: 90, y: 200, radius: 30 },
  safeArea: { x0: 40, x1: 140, y0: 80, y1: 318 },
  currents: [],
  mats: [],
  worms: [],
  keepAway: [],
  threats: [],
};
/** Area 2's shrimp values (ND-25). */
const RULE: ShrimpRule = { triggerRadius: 60, restFor: 2, flickDistance: 36, flickSpeed: 100 };
const REDUCED = true;
const GLIDING = false;

const SHRIMP: Point = { x: 500, y: 200 };
const HEAD: Point = { x: 450, y: 200 };

function snackOf(kind: CollectibleKind, point: Point, index: number): Collectible {
  return { id: `s${index}`, kind, x: point.x, y: point.y, collected: false };
}

/** One shrimp at `at`, plus a far worm. */
function oneShrimp(at: Point = SHRIMP): { items: Collectible[]; state: ShrimpFlickState } {
  const items = [snackOf('shrimp', at, 0), snackOf('worm', { x: 1500, y: 200 }, 1)];
  return { items, state: createShrimpFlicks(items, RULE) };
}

function frameAt(driftT: number): SnackFrame {
  return { ...STILL, driftT };
}

function stepOrFail(
  items: readonly Collectible[],
  head: Point,
  state: ShrimpFlickState,
  reduced: boolean,
  dt: number,
  frame: SnackFrame = STILL,
  avoid: MobileSnackAvoid = AVOID,
): ShrimpFlickStep {
  const step = stepShrimpFlicks(items, head, frame, state, reduced, avoid, dt);
  if (!step) throw new Error('expected a flick step');
  return step;
}

describe('createShrimpFlicks', () => {
  it('starts with every shrimp, in list order, ready and no flick under way', () => {
    const items = [
      snackOf('worm', { x: 300, y: 200 }, 0),
      snackOf('shrimp', { x: 400, y: 200 }, 1),
      snackOf('tadpole', { x: 500, y: 200 }, 2),
      snackOf('bug', { x: 600, y: 200 }, 3),
      snackOf('shrimp', { x: 700, y: 200 }, 4),
    ];
    const state = createShrimpFlicks(items, RULE);
    expect(state.resting.map((rest) => rest.id)).toEqual(['s1', 's4']);
    for (const rest of state.resting) expect(rest.readyAt).toBe(-Infinity);
    expect(state.flicks).toEqual([]);
    expect(state.hops).toEqual([]);
    expect(isShrimpFlicking(state, 's1')).toBe(false);
  });

  it('throws when the rule fails shrimpRule', () => {
    expect(() => createShrimpFlicks([], { ...RULE, restFor: 0.5 })).toThrow(RangeError);
    expect(() => createShrimpFlicks([], { ...RULE, flickDistance: 80 })).toThrow(RangeError);
    expect(() => createShrimpFlicks([], { ...RULE, triggerRadius: 36 })).toThrow(RangeError);
  });
});

describe('stepShrimpFlicks', () => {
  it('flicks a ready shrimp at the start of the trip', () => {
    const { items, state } = oneShrimp();
    const step = stepOrFail(items, HEAD, state, REDUCED, 0.016, frameAt(0));
    expect(step.items[0].x).toBeCloseTo(SHRIMP.x + RULE.flickDistance, 9);
  });

  it('flicks a shrimp drawn at exactly the trigger radius and not one 0.5 px beyond it', () => {
    const atEdge = oneShrimp({ x: HEAD.x + RULE.triggerRadius, y: HEAD.y });
    const beyond = oneShrimp({ x: HEAD.x + RULE.triggerRadius + 0.5, y: HEAD.y });
    expect(stepShrimpFlicks(atEdge.items, HEAD, STILL, atEdge.state, REDUCED, AVOID, 0.016)).not.toBeNull();
    expect(stepShrimpFlicks(beyond.items, HEAD, STILL, beyond.state, REDUCED, AVOID, 0.016)).toBeNull();
  });

  it('does not flick a shrimp drawn exactly on the head', () => {
    const { items, state } = oneShrimp(HEAD);
    expect(stepShrimpFlicks(items, HEAD, STILL, state, REDUCED, AVOID, 0.016)).toBeNull();
  });

  it('flicks straight away from the head in any direction', () => {
    const { items, state } = oneShrimp();
    const step = stepOrFail(items, { x: SHRIMP.x - 36, y: SHRIMP.y - 48 }, state, REDUCED, 0.016);
    expect(step.items[0].x).toBeCloseTo(SHRIMP.x + 21.6, 9);
    expect(step.items[0].y).toBeCloseTo(SHRIMP.y + 28.8, 9);
  });

  it('glides flickSpeed x dt px a frame until it lands, flicking while it glides', () => {
    const { items, state } = oneShrimp();
    let step = stepOrFail(items, HEAD, state, GLIDING, 0.1);
    expect(step.items[0].x).toBeCloseTo(510, 9);
    expect(isShrimpFlicking(step.state, 's0')).toBe(true);
    expect(step.state.resting).toEqual([]);
    const far: Point = { x: 1000, y: 280 };
    step = stepOrFail(step.items, far, step.state, GLIDING, 0.2);
    expect(step.items[0].x).toBeCloseTo(530, 9);
    step = stepOrFail(step.items, far, step.state, GLIDING, 0.2);
    expect(step.items[0].x).toBeCloseTo(536, 9);
    expect(step.items[0].y).toBe(200);
    expect(isShrimpFlicking(step.state, 's0')).toBe(false);
    expect(step.state.flicks).toEqual([]);
  });

  it('under reduced motion lands in the frame the flick starts', () => {
    const { items, state } = oneShrimp();
    const before = structuredClone(items);
    const step = stepOrFail(items, HEAD, state, REDUCED, 0.016, frameAt(3));
    expect(step.items[0]).toEqual({ ...items[0], x: 536, y: 200 });
    expect(step.items[1]).toBe(items[1]);
    expect(step.state.flicks).toEqual([]);
    expect(step.state.resting).toEqual([{ id: 's0', readyAt: 3 + RULE.restFor, next: 0, hopSign: 0, afterFlick: true }]);
    expect(items).toEqual(before);
  });

  it('lands a gliding flick at once when reduced motion turns on', () => {
    const { items, state } = oneShrimp();
    const gliding = stepOrFail(items, HEAD, state, GLIDING, 0.1);
    const landed = stepOrFail(gliding.items, HEAD, gliding.state, REDUCED, 0.016);
    expect(landed.items[0].x).toBeCloseTo(536, 9);
    expect(landed.state.flicks).toEqual([]);
  });

  it('after landing rests restFor s on the drift clock, then flicks again, with no limit', () => {
    let { items, state } = oneShrimp({ x: 300, y: 200 });
    let driftT = 1;
    for (let flick = 1; flick <= 5; flick++) {
      const head: Point = { x: items[0].x - 50, y: 200 };
      const step = stepOrFail(items, head, state, REDUCED, 0.016, frameAt(driftT));
      ({ items, state } = step);
      expect(items[0].x).toBeCloseTo(300 + flick * RULE.flickDistance, 9);
      const restHead: Point = { x: items[0].x - 50, y: 200 };
      expect(stepShrimpFlicks(items, restHead, frameAt(driftT + RULE.restFor - 0.001), state, REDUCED, AVOID, 0.016)).toBeNull();
      driftT += RULE.restFor;
    }
  });

  it('counts the rest only on the drift clock, not on dt', () => {
    const { items, state } = oneShrimp();
    const landed = stepOrFail(items, HEAD, state, REDUCED, 0.016, frameAt(1));
    const head: Point = { x: landed.items[0].x - 50, y: 200 };
    for (let frame = 0; frame < 300; frame++) {
      expect(stepShrimpFlicks(landed.items, head, frameAt(1), landed.state, GLIDING, AVOID, 1 / 60)).toBeNull();
    }
    expect(stepShrimpFlicks(landed.items, head, frameAt(1 + RULE.restFor), landed.state, GLIDING, AVOID, 1 / 60)).not.toBeNull();
  });

  it('starts the rest when a glide lands, not when it starts', () => {
    const { items, state } = oneShrimp();
    const gliding = stepOrFail(items, HEAD, state, GLIDING, 0.2, frameAt(0));
    const landed = stepOrFail(gliding.items, HEAD, gliding.state, GLIDING, 0.2, frameAt(0.2));
    expect(landed.state.resting).toEqual([{ id: 's0', readyAt: 0.2 + RULE.restFor, next: 0, hopSign: 0, afterFlick: true }]);
  });

  it('measures the trigger where the shrimp is drawn, drift and bob included', () => {
    const drift: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 10, periodY: 8 };
    const frame: SnackFrame = { driftT: 2.5, bobT: 0.6, bobbing: true, drift, bounds: BOUNDS };
    const { items, state } = oneShrimp();
    const drawn: Point = { x: drawnSnackX(items[0], 0, frame), y: drawnSnackY(items[0], 0, frame) };
    const rightOfDrawn: Point = { x: drawn.x + RULE.triggerRadius, y: drawn.y };
    expect(Math.hypot(rightOfDrawn.x - SHRIMP.x, rightOfDrawn.y - SHRIMP.y)).toBeGreaterThan(RULE.triggerRadius);
    const step = stepShrimpFlicks(items, rightOfDrawn, frame, state, REDUCED, AVOID, 0.016);
    expect(step?.items[0].x).toBeCloseTo(SHRIMP.x - RULE.flickDistance, 9);
    expect(step?.items[0].y).toBeCloseTo(SHRIMP.y, 9);
    const leftOfDrawn: Point = { x: drawn.x - RULE.triggerRadius - 0.5, y: drawn.y };
    expect(Math.hypot(leftOfDrawn.x - SHRIMP.x, leftOfDrawn.y - SHRIMP.y)).toBeLessThan(RULE.triggerRadius);
    expect(stepShrimpFlicks(items, leftOfDrawn, frame, state, REDUCED, AVOID, 0.016)).toBeNull();
  });

  it('leaves a shrimp ready when its target is blocked, and flicks it once the target clears', () => {
    const { items, state } = oneShrimp();
    const target: Point = { x: SHRIMP.x + RULE.flickDistance, y: SHRIMP.y };
    const blocked: MobileSnackAvoid = { ...AVOID, worms: [{ x: target.x + 60, y: target.y }] };
    expect(stepShrimpFlicks(items, HEAD, STILL, state, REDUCED, blocked, 0.016)).toBeNull();
    expect(stepShrimpFlicks(items, HEAD, STILL, state, GLIDING, blocked, 0.016)).toBeNull();
    expect(state.resting).toEqual([{ id: 's0', readyAt: -Infinity, next: 0, hopSign: 0, afterFlick: false }]);
    const step = stepOrFail(items, HEAD, state, REDUCED, 0.016, STILL, AVOID);
    expect(step.items[0].x).toBeCloseTo(target.x, 9);
  });

  it('checks the target box the drift and bob can reach', () => {
    const drift: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 10, periodY: 8 };
    const frame: SnackFrame = { driftT: 0, bobT: 0, bobbing: false, drift, bounds: BOUNDS };
    const { items, state } = oneShrimp();
    const head: Point = { x: drawnSnackX(items[0], 0, frame) - 50, y: drawnSnackY(items[0], 0, frame) };
    const targetRight = SHRIMP.x + RULE.flickDistance + drift.amplitudeX;
    const edge: MobileSnackAvoid = { ...AVOID, bounds: { ...BOUNDS, maxX: targetRight - 1 } };
    expect(stepShrimpFlicks(items, head, frame, state, REDUCED, edge, 0.016)).toBeNull();
    const roomy: MobileSnackAvoid = { ...AVOID, bounds: { ...BOUNDS, maxX: targetRight } };
    expect(stepShrimpFlicks(items, head, frame, state, REDUCED, roomy, 0.016)).not.toBeNull();
  });

  it('never moves a collected shrimp', () => {
    const { items, state } = oneShrimp();
    const eaten = [{ ...items[0], collected: true }, items[1]];
    expect(stepShrimpFlicks(eaten, HEAD, STILL, state, REDUCED, AVOID, 0.016)).toBeNull();
    expect(stepShrimpFlicks(eaten, HEAD, STILL, state, GLIDING, AVOID, 0.016)).toBeNull();
  });

  it('stops a flick whose shrimp is eaten mid-glide, and drops it with the next state change', () => {
    const items = [snackOf('shrimp', SHRIMP, 0), snackOf('shrimp', { x: 900, y: 200 }, 1)];
    const state = createShrimpFlicks(items, RULE);
    const gliding = stepOrFail(items, HEAD, state, GLIDING, 0.1);
    const eaten = [{ ...gliding.items[0], collected: true }, gliding.items[1]];
    expect(stepShrimpFlicks(eaten, HEAD, STILL, gliding.state, GLIDING, AVOID, 0.1)).toBeNull();
    const next = stepOrFail(eaten, { x: 860, y: 200 }, gliding.state, GLIDING, 0.1);
    expect(next.items[0]).toBe(eaten[0]);
    expect(next.state.flicks.map((flick) => flick.id)).toEqual(['s1']);
    expect(next.state.resting).toEqual([]);
  });

  it('adds the magnet pull to a glide', () => {
    const { items, state } = oneShrimp();
    const gliding = stepOrFail(items, HEAD, state, GLIDING, 0.1);
    expect(gliding.items[0].x).toBeCloseTo(510, 9);
    const pulled = pullSnacksToward(gliding.items, HEAD, 70, 40, 0.1, STILL);
    expect(pulled?.[0].x).toBeCloseTo(506, 9);
    const next = stepOrFail(pulled ?? gliding.items, HEAD, gliding.state, GLIDING, 0.1);
    expect(next.items[0].x).toBeCloseTo(516, 9);
    expect(next.state.flicks).toEqual([{ id: 's0', restX: expect.closeTo(16, 9), restY: 0, next: 0, hopSign: 0 }]);
  });

  it('never moves an item that is not a shrimp', () => {
    const items = [
      snackOf('worm', { x: 480, y: 200 }, 0),
      snackOf('bug', { x: 470, y: 220 }, 1),
      snackOf('tadpole', { x: 490, y: 190 }, 2),
      snackOf('shrimp', SHRIMP, 3),
    ];
    const state = createShrimpFlicks(items, RULE);
    const step = stepOrFail(items, HEAD, state, REDUCED, 0.016);
    expect(step.items.slice(0, 3)).toEqual(items.slice(0, 3));
    for (let index = 0; index < 3; index++) expect(step.items[index]).toBe(items[index]);
    expect(step.items[3].x).toBeCloseTo(536, 9);
    const noShrimp = createShrimpFlicks(items.slice(0, 3), RULE);
    expect(stepShrimpFlicks(items, HEAD, STILL, noShrimp, REDUCED, AVOID, 0.016)).toBeNull();
  });

  it('returns null when nothing flicks or glides, leaving the items alone', () => {
    const { items, state } = oneShrimp();
    const before = structuredClone(items);
    expect(stepShrimpFlicks(items, { x: 900, y: 200 }, STILL, state, GLIDING, AVOID, 0.016)).toBeNull();
    expect(items).toEqual(before);
  });

  it('starts a flick but moves nothing when dt is 0 without reduced motion', () => {
    const { items, state } = oneShrimp();
    const step = stepOrFail(items, HEAD, state, GLIDING, 0);
    expect(step.items[0]).toBe(items[0]);
    expect(isShrimpFlicking(step.state, 's0')).toBe(true);
    expect(stepShrimpFlicks(step.items, HEAD, STILL, step.state, GLIDING, AVOID, 0)).toBeNull();
  });
});

/** The dev area's shrimp values (issue #131, ND-14 note): 40 px hops at about 97 px/s and a 0.9 s hop rest. */
const HOP_RULE: ShrimpRule = { triggerRadius: 60, restFor: 1.2, flickDistance: 60, flickSpeed: 145 };
const HOP_LENGTH = HOP_RULE.flickDistance * SHRIMP_TUNING.hopShare;
const HOP_REST = HOP_RULE.restFor * SHRIMP_TUNING.hopRestShare;
/** Farther than SHRIMP_TUNING.holdDistance from every hop spot used below. */
const FAR_HEAD: Point = { x: 300, y: 200 };
/** A 30 px square of hop spots, each one hop from the last. */
const SQUARE: readonly Point[] = [
  { x: 600, y: 200 },
  { x: 630, y: 200 },
  { x: 630, y: 230 },
  { x: 600, y: 230 },
];

function shrimpWithHome(home: readonly Point[], index: number): Collectible {
  return { ...snackOf('shrimp', home[0], index), home: home.map((spot) => ({ ...spot })) };
}

/** One hopping shrimp at its home's first spot, plus a far worm. */
function oneHopper(home: readonly Point[] = SQUARE): { items: Collectible[]; state: ShrimpFlickState } {
  const items = [shrimpWithHome(home, 0), snackOf('worm', { x: 1500, y: 200 }, 1)];
  return { items, state: createShrimpFlicks(items, HOP_RULE) };
}

function placeOf(item: Collectible): Point {
  return { x: item.x, y: item.y };
}

describe('shrimp hops (issue #131, ND-5, ND-6)', () => {
  it('first rests shrimp n of N (n - 1) / N of a hop rest, and keeps every 1-spot shrimp ready now', () => {
    const items = [
      shrimpWithHome(SQUARE, 0),
      shrimpWithHome([{ x: 900, y: 200 }], 1),
      shrimpWithHome(SQUARE.map((spot) => ({ x: spot.x + 400, y: spot.y })), 2),
      snackOf('worm', { x: 300, y: 200 }, 3),
      shrimpWithHome(SQUARE.map((spot) => ({ x: spot.x + 800, y: spot.y })), 4),
    ];
    const state = createShrimpFlicks(items, HOP_RULE);
    expect(state.resting.map((rest) => [rest.id, rest.readyAt])).toEqual([
      ['s0', 0],
      ['s1', -Infinity],
      ['s2', expect.closeTo(HOP_REST / 3, 9)],
      ['s4', expect.closeTo((2 * HOP_REST) / 3, 9)],
    ]);
    for (const rest of state.resting) expect(rest.afterFlick).toBe(false);
    const head: Point = { x: 1800, y: 120 };
    const atStart = stepOrFail(items, head, state, REDUCED, 0.016, frameAt(0));
    expect(atStart.items[0]).not.toBe(items[0]);
    expect(atStart.items[2]).toBe(items[2]);
    expect(atStart.items[4]).toBe(items[4]);
    const second = stepOrFail(atStart.items, head, atStart.state, REDUCED, 0.016, frameAt(HOP_REST / 3));
    expect(second.items[2]).not.toBe(atStart.items[2]);
    expect(second.items[4]).toBe(atStart.items[4]);
  });

  it('hops when its rest ends, then rests a hop rest before the next hop', () => {
    let { items, state } = oneHopper();
    let driftT = 0;
    for (let hop = 1; hop <= 3; hop++) {
      const step = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(driftT));
      ({ items, state } = step);
      expect(placeOf(items[0])).toEqual(SQUARE[hop]);
      expect(state.resting).toEqual([{ id: 's0', readyAt: driftT + HOP_REST, next: (hop + 1) % 4, hopSign: expect.any(Number), afterFlick: false }]);
      expect(stepShrimpFlicks(items, FAR_HEAD, frameAt(driftT + HOP_REST - 0.001), state, REDUCED, AVOID, 0.016)).toBeNull();
      driftT += HOP_REST;
    }
  });

  it('hops toward each next spot in turn and round again, landing on each', () => {
    let { items, state } = oneHopper();
    const landings: Point[] = [];
    for (let hop = 0; hop < 6; hop++) {
      ({ items, state } = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(hop * HOP_REST)));
      landings.push(placeOf(items[0]));
    }
    expect(landings).toEqual([SQUARE[1], SQUARE[2], SQUARE[3], SQUARE[0], SQUARE[1], SQUARE[2]]);
  });

  it('hops at most 2/3 of the flick distance, landing on a spot only once it is that close', () => {
    const home: Point[] = [
      { x: 600, y: 200 },
      { x: 700, y: 200 },
    ];
    let { items, state } = oneHopper(home);
    const xs: number[] = [];
    const nexts: number[] = [];
    for (let hop = 0; hop < 4; hop++) {
      ({ items, state } = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(hop * HOP_REST)));
      xs.push(items[0].x);
      nexts.push(state.resting[0].next);
    }
    expect(HOP_LENGTH).toBe(40);
    expect(xs[0]).toBeCloseTo(640, 9);
    expect(xs[1]).toBeCloseTo(680, 9);
    expect(xs[2]).toBeCloseTo(700, 9);
    expect(xs[3]).toBeCloseTo(660, 9);
    expect(nexts).toEqual([1, 1, 0, 0]);
  });

  it('glides a hop at 2/3 of the flick speed, facing the way it hops', () => {
    const { items, state } = oneHopper();
    expect(readShrimpHopSign(state, 's0')).toBe(0);
    const gliding = stepOrFail(items, FAR_HEAD, state, GLIDING, 0.1);
    expect(gliding.items[0].x).toBeCloseTo(600 + HOP_RULE.flickSpeed * SHRIMP_TUNING.hopShare * 0.1, 9);
    expect(gliding.state.hops.map((hop) => hop.id)).toEqual(['s0']);
    expect(gliding.state.resting).toEqual([]);
    expect(isShrimpFlicking(gliding.state, 's0')).toBe(false);
    expect(readShrimpHopSign(gliding.state, 's0')).toBe(1);
    const landed = stepOrFail(gliding.items, FAR_HEAD, gliding.state, GLIDING, 0.5, frameAt(0.6));
    expect(placeOf(landed.items[0])).toEqual(SQUARE[1]);
    expect(landed.state.hops).toEqual([]);
    expect(landed.state.resting).toEqual([{ id: 's0', readyAt: 0.6 + HOP_REST, next: 2, hopSign: 1, afterFlick: false }]);
  });

  it('gives the x sign of the last hop: 0 for a straight down hop and -1 for a hop left', () => {
    let { items, state } = oneHopper();
    ({ items, state } = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(0)));
    expect(readShrimpHopSign(state, 's0')).toBe(1);
    ({ items, state } = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(HOP_REST)));
    expect(readShrimpHopSign(state, 's0')).toBe(0);
    state = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(2 * HOP_REST)).state;
    expect(readShrimpHopSign(state, 's0')).toBe(-1);
    expect(readShrimpHopSign(state, 'unknown')).toBe(0);
  });

  it('skips a spot whose landing is not clear and hops toward the one after', () => {
    const home: Point[] = [
      { x: 600, y: 200 },
      { x: 560, y: 200 },
      { x: 640, y: 200 },
    ];
    const { items, state } = oneHopper(home);
    const wormNearSecond: MobileSnackAvoid = { ...AVOID, worms: [{ x: 490, y: 200 }] };
    const step = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, STILL, wormNearSecond);
    expect(placeOf(step.items[0])).toEqual(home[2]);
    expect(step.state.resting[0].next).toBe(0);
    const clear = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, STILL, AVOID);
    expect(placeOf(clear.items[0])).toEqual(home[1]);
  });

  it('rests a hop rest again, without moving, when no spot is clear', () => {
    const home: Point[] = [
      { x: 600, y: 200 },
      { x: 560, y: 200 },
      { x: 640, y: 200 },
    ];
    const { items, state } = oneHopper(home);
    const wormOnHome: MobileSnackAvoid = { ...AVOID, worms: [{ x: 600, y: 200 }] };
    const step = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(0.5), wormOnHome);
    expect(step.items[0]).toBe(items[0]);
    expect(step.state.hops).toEqual([]);
    expect(step.state.resting).toEqual([{ id: 's0', readyAt: 0.5 + HOP_REST, next: 1, hopSign: 0, afterFlick: false }]);
    expect(stepShrimpFlicks(step.items, FAR_HEAD, frameAt(0.5 + HOP_REST - 0.001), step.state, REDUCED, wormOnHome, 0.016)).toBeNull();
  });

  it('never hops through a current whose way it would cross, though both ends are clear: it tries the next spot', () => {
    const home: Point[] = [
      { x: 600, y: 200 },
      { x: 640, y: 200 },
      { x: 600, y: 240 },
    ];
    const { items, state } = oneHopper(home);
    const current = { id: 'current-0', x0: 618, x1: 622, y0: 150, y1: 215, force: { x: 0, y: 0 } };
    const across: MobileSnackAvoid = { ...AVOID, currents: [current] };
    const step = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, STILL, across);
    expect(placeOf(step.items[0])).toEqual(home[2]);
    expect(step.state.resting[0].next).toBe(0);
    const clear = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, STILL, AVOID);
    expect(placeOf(clear.items[0])).toEqual(home[1]);
  });

  it('rests a hop rest again, without moving, when every hop would cross a current', () => {
    const home: Point[] = [
      { x: 600, y: 200 },
      { x: 640, y: 200 },
    ];
    const { items, state } = oneHopper(home);
    const current = { id: 'current-0', x0: 618, x1: 622, y0: 150, y1: 250, force: { x: 0, y: 0 } };
    const across: MobileSnackAvoid = { ...AVOID, currents: [current] };
    const step = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(0.5), across);
    expect(step.items[0]).toBe(items[0]);
    expect(step.state.resting).toEqual([{ id: 's0', readyAt: 0.5 + HOP_REST, next: 1, hopSign: 0, afterFlick: false }]);
  });

  it('never flicks through a current though the landing is clear, a hopping shrimp or a 1-spot one', () => {
    const still = oneShrimp();
    const pastStill: MobileSnackAvoid = { ...AVOID, currents: [{ id: 'current-0', x0: 515, x1: 520, y0: 150, y1: 250, force: { x: 0, y: 0 } }] };
    expect(stepShrimpFlicks(still.items, HEAD, STILL, still.state, REDUCED, pastStill, 0.016)).toBeNull();
    expect(stepShrimpFlicks(still.items, HEAD, STILL, still.state, GLIDING, pastStill, 0.016)).toBeNull();
    expect(stepOrFail(still.items, HEAD, still.state, REDUCED, 0.016).items[0].x).toBeCloseTo(SHRIMP.x + RULE.flickDistance, 9);
    const hopper = oneHopper();
    const head: Point = { x: 650, y: 200 };
    const pastHopper: MobileSnackAvoid = { ...AVOID, currents: [{ id: 'current-0', x0: 565, x1: 570, y0: 150, y1: 250, force: { x: 0, y: 0 } }] };
    expect(stepShrimpFlicks(hopper.items, head, STILL, hopper.state, REDUCED, pastHopper, 0.016)).toBeNull();
    expect(stepOrFail(hopper.items, head, hopper.state, REDUCED, 0.016).items[0].x).toBeCloseTo(600 - HOP_RULE.flickDistance, 9);
  });

  it('checks each landing with each plastic worm where it is now, by the hard rules only', () => {
    const { items, state } = oneHopper();
    const threatNear: MobileSnackAvoid = { ...AVOID, hazards: [], keepAway: [{ kind: 'circle', x: 630, y: 260, r: 10 }] };
    const step = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, STILL, threatNear);
    expect(placeOf(step.items[0])).toEqual(SQUARE[1]);
    const wormNow: MobileSnackAvoid = { ...AVOID, worms: [{ x: 700, y: 200 }] };
    const skipped = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, STILL, wormNow);
    expect(placeOf(skipped.items[0])).toEqual(SQUARE[3]);
  });

  it('does not hop while the head is within 120 px, measured where the shrimp is drawn', () => {
    const { items, state } = oneHopper();
    expect(SHRIMP_TUNING.holdDistance).toBe(120);
    const atHold: Point = { x: 600 - SHRIMP_TUNING.holdDistance, y: 200 };
    expect(stepShrimpFlicks(items, atHold, STILL, state, REDUCED, AVOID, 0.016)).toBeNull();
    expect(stepShrimpFlicks(items, { x: 600, y: 200 + 90 }, STILL, state, GLIDING, AVOID, 0.016)).toBeNull();
    const beyond: Point = { x: atHold.x - 0.5, y: 200 };
    expect(stepShrimpFlicks(items, beyond, STILL, state, REDUCED, AVOID, 0.016)).not.toBeNull();
  });

  it('rests the full restFor after a flick and 3/4 of it after a hop', () => {
    let { items, state } = oneHopper();
    ({ items, state } = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(0)));
    expect(state.resting[0].readyAt).toBeCloseTo(HOP_RULE.restFor * 0.75, 9);
    expect(isShrimpRestingAfterFlick(state, 's0')).toBe(false);
    const near: Point = { x: items[0].x, y: items[0].y + 50 };
    state = stepOrFail(items, near, state, REDUCED, 0.016, frameAt(1)).state;
    expect(state.resting[0].readyAt).toBeCloseTo(1 + HOP_RULE.restFor, 9);
    expect(isShrimpRestingAfterFlick(state, 's0')).toBe(true);
    expect(isShrimpRestingAfterFlick(state, 'unknown')).toBe(false);
  });

  it('flicks instead of hopping inside the trigger radius, landing inside the home box grown by the flick distance', () => {
    const home: Point[] = [
      { x: 600, y: 200 },
      { x: 640, y: 200 },
      { x: 640, y: 240 },
    ];
    let { items, state } = oneHopper(home);
    ({ items, state } = stepOrFail(items, { x: 650, y: 200 }, state, REDUCED, 0.016, frameAt(0)));
    expect(items[0].x).toBeCloseTo(600 - HOP_RULE.flickDistance, 9);
    expect(state.resting[0]).toEqual({ id: 's0', readyAt: HOP_RULE.restFor, next: 1, hopSign: 0, afterFlick: true });
    const pushOut: Point = { x: items[0].x + 50, y: 200 };
    expect(stepShrimpFlicks(items, pushOut, frameAt(2), state, REDUCED, AVOID, 0.016)).toBeNull();
    ({ items, state } = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(2)));
    expect(items[0].x).toBeCloseTo(540 + HOP_LENGTH, 9);
    expect(state.resting[0]).toEqual({ id: 's0', readyAt: 2 + HOP_REST, next: 1, hopSign: 1, afterFlick: false });
  });

  it('checks a hopping flick by the hard rules, and a 1-spot flick by mobileSnackClear', () => {
    const threatNear: MobileSnackAvoid = { ...AVOID, hazards: [], keepAway: [{ kind: 'circle', x: 540, y: 260, r: 10 }] };
    const head: Point = { x: 650, y: 200 };
    const hopper = oneHopper();
    const flicked = stepOrFail(hopper.items, head, hopper.state, REDUCED, 0.016, STILL, threatNear);
    expect(flicked.items[0].x).toBeCloseTo(540, 9);
    const still = oneHopper([{ x: 600, y: 200 }]);
    expect(stepShrimpFlicks(still.items, head, STILL, still.state, REDUCED, threatNear, 0.016)).toBeNull();
  });

  it('keeps a 1-spot shrimp ready at once, never hopping, and flicking with no home limit', () => {
    let { items, state } = oneHopper([{ x: 300, y: 200 }]);
    expect(state.resting).toEqual([{ id: 's0', readyAt: -Infinity, next: 0, hopSign: 0, afterFlick: false }]);
    expect(stepShrimpFlicks(items, { x: 1200, y: 200 }, frameAt(5), state, REDUCED, AVOID, 0.016)).toBeNull();
    let driftT = 0;
    for (let flick = 1; flick <= 4; flick++) {
      ({ items, state } = stepOrFail(items, { x: items[0].x - 50, y: 200 }, state, REDUCED, 0.016, frameAt(driftT)));
      expect(items[0].x).toBeCloseTo(300 + flick * HOP_RULE.flickDistance, 9);
      expect(stepShrimpFlicks(items, { x: 1200, y: 200 }, frameAt(driftT + 10), state, REDUCED, AVOID, 0.016)).toBeNull();
      driftT += HOP_RULE.restFor;
    }
    expect(readShrimpHopSign(state, 's0')).toBe(0);
  });

  it('keeps the catch limit: a one-leg axolotl closing at the catch speed reaches a flicked shrimp before it moves again', () => {
    let { items, state } = oneHopper();
    const startHead: Point = { x: 600 - HOP_RULE.triggerRadius, y: 200 };
    ({ items, state } = stepOrFail(items, startHead, state, REDUCED, 0.016, frameAt(0)));
    const landed = items[0].x;
    expect(landed - startHead.x).toBeCloseTo(HOP_RULE.triggerRadius + HOP_RULE.flickDistance, 9);
    for (let frame = 1; frame / 60 < HOP_RULE.restFor; frame++) {
      const head: Point = { x: startHead.x + SHRIMP_TUNING.catchSpeed * (frame / 60), y: 200 };
      expect(stepShrimpFlicks(items, head, frameAt(frame / 60), state, GLIDING, AVOID, 1 / 60)).toBeNull();
    }
    const closed = HOP_RULE.restFor * SHRIMP_TUNING.catchSpeed;
    expect(landed - (startHead.x + closed)).toBeLessThanOrEqual(SNACK_REACH.radius + 1e-9);
  });

  it('under reduced motion lands a hop in the frame it starts, and a gliding hop at once', () => {
    const { items, state } = oneHopper();
    const landed = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016);
    expect(placeOf(landed.items[0])).toEqual(SQUARE[1]);
    expect(landed.state.hops).toEqual([]);
    const gliding = stepOrFail(items, FAR_HEAD, state, GLIDING, 0.1);
    const snapped = stepOrFail(gliding.items, FAR_HEAD, gliding.state, REDUCED, 0.016);
    expect(placeOf(snapped.items[0])).toEqual(SQUARE[1]);
    expect(snapped.state.hops).toEqual([]);
  });

  it('adds the magnet pull to a hop glide', () => {
    const { items, state } = oneHopper();
    const gliding = stepOrFail(items, FAR_HEAD, state, GLIDING, 0.1);
    const moved = gliding.items[0].x - 600;
    const pulled = pullSnacksToward(gliding.items, { x: 900, y: 200 }, 400, 40, 0.1, STILL);
    expect(pulled?.[0].x).toBeCloseTo(600 + moved + 4, 9);
    const next = stepOrFail(pulled ?? gliding.items, FAR_HEAD, gliding.state, GLIDING, 0.1);
    expect(next.items[0].x).toBeCloseTo(600 + 2 * moved + 4, 9);
  });

  it('drops the hop of a shrimp eaten mid-glide', () => {
    const { items, state } = oneHopper();
    const gliding = stepOrFail(items, FAR_HEAD, state, GLIDING, 0.1);
    const eaten = [{ ...gliding.items[0], collected: true }, gliding.items[1]];
    expect(stepShrimpFlicks(eaten, FAR_HEAD, STILL, gliding.state, GLIDING, AVOID, 0.1)).toBeNull();
    const withWorm = [...eaten, shrimpWithHome(SQUARE.map((spot) => ({ x: spot.x + 600, y: spot.y })), 2)];
    const both = { ...gliding.state, resting: createShrimpFlicks([withWorm[2]], HOP_RULE).resting };
    const next = stepOrFail(withWorm, FAR_HEAD, both, GLIDING, 0.1);
    expect(next.items[0]).toBe(eaten[0]);
    expect(next.state.hops.map((hop) => hop.id)).toEqual(['s2']);
  });

  it('returns null when nothing hops, flicks or glides, leaving the items alone', () => {
    const { items, state } = oneHopper();
    const before = structuredClone(items);
    const between: Point = { x: 600 - 90, y: 200 };
    expect(stepShrimpFlicks(items, between, STILL, state, GLIDING, AVOID, 0.016)).toBeNull();
    const rested = stepOrFail(items, FAR_HEAD, state, REDUCED, 0.016, frameAt(0));
    expect(stepShrimpFlicks(rested.items, FAR_HEAD, frameAt(0.5), rested.state, GLIDING, AVOID, 0.016)).toBeNull();
    expect(items).toEqual(before);
  });
});

describe('flick starts for the flick sound (issue #166, ND-15)', () => {
  it('gives the id of a shrimp that starts a flick, and none while the flick only glides', () => {
    const { items, state } = oneShrimp();
    const started = stepOrFail(items, HEAD, state, GLIDING, 0.1);
    expect(started.flickStarts).toEqual(['s0']);
    const gliding = stepOrFail(started.items, HEAD, started.state, GLIDING, 0.1);
    expect(isShrimpFlicking(gliding.state, 's0')).toBe(true);
    expect(gliding.flickStarts).toEqual([]);
  });

  it('gives both ids when two shrimp start a flick in one step', () => {
    const items = [snackOf('shrimp', SHRIMP, 0), snackOf('shrimp', { x: 400, y: 200 }, 1)];
    const step = stepOrFail(items, HEAD, createShrimpFlicks(items, RULE), GLIDING, 0.1);
    expect(step.flickStarts).toEqual(['s0', 's1']);
  });

  it('gives no id for a hop, and only the flick id when a hop and a flick start together', () => {
    const hopper = oneHopper();
    const hop = stepOrFail(hopper.items, FAR_HEAD, hopper.state, GLIDING, 0.1, frameAt(0));
    expect(hop.state.hops.map((glide) => glide.id)).toEqual(['s0']);
    expect(hop.flickStarts).toEqual([]);
    const items = [shrimpWithHome(SQUARE, 0), snackOf('shrimp', SHRIMP, 1)];
    const both = stepOrFail(items, HEAD, createShrimpFlicks(items, HOP_RULE), GLIDING, 0.1, frameAt(0));
    expect(both.state.hops.map((glide) => glide.id)).toEqual(['s0']);
    expect(both.flickStarts).toEqual(['s1']);
  });

  it('gives the id under reduced motion, though the flick lands in the same step', () => {
    const { items, state } = oneShrimp();
    const step = stepOrFail(items, HEAD, state, REDUCED, 0.016);
    expect(step.state.flicks).toEqual([]);
    expect(step.flickStarts).toEqual(['s0']);
  });
});

/** Counts reads of the `id` of every object made by withCountedId. */
interface IdReads {
  count: number;
}

/** A copy of `source` whose `id` counts each read in `reads`. */
function withCountedId<T extends { readonly id: string }>(source: T, reads: IdReads): T {
  const { id, ...rest } = source;
  const readId = (): string => {
    reads.count += 1;
    return id;
  };
  return Object.defineProperty({ ...rest }, 'id', { get: readId, enumerable: true }) as unknown as T;
}

/** `count` flick-only shrimp 40 px apart along y = 200 from x = 500, then as many far worms. */
function manyShrimp(count: number): Collectible[] {
  const shrimp = Array.from({ length: count }, (_, index) => snackOf('shrimp', { x: 500 + index * 40, y: 200 }, index));
  const worms = Array.from({ length: count }, (_, index) => snackOf('worm', { x: 1800, y: 100 + index }, count + index));
  return [...shrimp, ...worms];
}

describe('shrimp look-ups scale with the shrimp count (issue #131, ND-5)', () => {
  it('reads each item id at most once per resting shrimp in a step where nothing starts', () => {
    for (const count of [25, 200]) {
      const plain = manyShrimp(count);
      const state = createShrimpFlicks(plain, RULE);
      const reads: IdReads = { count: 0 };
      const items = plain.map((item) => withCountedId(item, reads));
      expect(stepShrimpFlicks(items, { x: 100, y: 200 }, STILL, state, GLIDING, AVOID, 0.016)).toBeNull();
      expect(reads.count).toBe(count);
    }
  });

  it('reads a bounded number of item ids per gliding shrimp', () => {
    for (const count of [25, 200]) {
      const plain = manyShrimp(count);
      const fresh = createShrimpFlicks(plain, RULE);
      const flicks = fresh.resting.map((rest) => ({ id: rest.id, restX: 30, restY: 0, next: 0, hopSign: 0 as const }));
      const state: ShrimpFlickState = { ...fresh, resting: [], flicks };
      const reads: IdReads = { count: 0 };
      const items = plain.map((item) => withCountedId(item, reads));
      const step = stepOrFail(items, { x: 100, y: 200 }, state, GLIDING, 0.1);
      expect(step.state.flicks).toHaveLength(count);
      expect(reads.count).toBeLessThanOrEqual(2 * count + 1);
    }
  });

  it('still finds a shrimp the state never indexed, and an item list in another order', () => {
    const { items, state } = oneShrimp({ x: 480, y: 200 });
    const unindexed: ShrimpFlickState = { ...state, indexById: new Map() };
    expect(stepOrFail(items, HEAD, unindexed, REDUCED, 0.016).items[0].x).toBe(480 + RULE.flickDistance);
    const reversed = [items[1], items[0]];
    const step = stepOrFail(reversed, HEAD, state, REDUCED, 0.016);
    expect(step.items[1].x).toBe(480 + RULE.flickDistance);
    expect(step.items[0]).toBe(items[1]);
  });
});

/** Array methods that scan a whole list with a callback. */
const LIST_SCANS: ReadonlySet<string> = new Set(['some', 'every', 'map', 'filter', 'forEach']);

/** The key a for...of loop reads to get an array iterator, an allocation, as watchedList records it. */
const ITERATOR_KEY = String(Symbol.iterator);

/** A view of `list` that adds the name of each key read from it to `keys`, a symbol key by String(key). */
function watchedList<L extends readonly unknown[]>(list: L, keys: string[]): L {
  return new Proxy(list, {
    get: (target, key, receiver) => {
      keys.push(typeof key === 'string' ? key : String(key));
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
}

/** `avoid` with every list it holds watched by watchedList. */
function watchedAvoid(avoid: MobileSnackAvoid, keys: string[]): MobileSnackAvoid {
  return {
    ...avoid,
    currents: watchedList(avoid.currents, keys),
    mats: watchedList(avoid.mats, keys),
    worms: watchedList(avoid.worms, keys),
    keepAway: watchedList(avoid.keepAway, keys),
    threats: watchedList(avoid.threats, keys),
    ...(avoid.hazards ? { hazards: watchedList(avoid.hazards, keys) } : {}),
  };
}

describe('a ready flick whose landing is blocked (issue #139)', () => {
  const FAR_CURRENT = { id: 'current-far', x0: 1700, x1: 1720, y0: 150, y1: 250, force: { x: 0, y: 0 } };
  const FAR_MAT: HazardRect = { kind: 'rect', x0: 1600, x1: 1620, y0: 150, y1: 250 };
  const FAR_SHAPE: HazardShape = { kind: 'circle', x: 1400, y: 120, r: 5 };
  const FAR_THREAT: Threat = { kind: 'shape', shape: FAR_SHAPE, strike: 10 };
  /** Every list holds a far entry; the 1-spot shrimp's landing at 536, 200 is inside a threat's strike range. */
  const THREAT_BLOCKED: MobileSnackAvoid = {
    ...AVOID,
    currents: [FAR_CURRENT],
    mats: [FAR_MAT],
    worms: [{ x: 1500, y: 120 }],
    keepAway: [FAR_SHAPE],
    threats: [FAR_THREAT, { kind: 'shape', shape: { kind: 'circle', x: 560, y: 200, r: 5 }, strike: 20 }],
  };
  /** As THREAT_BLOCKED, but the hopper's landing at 540, 200 is too near a hazard. */
  const HAZARD_BLOCKED: MobileSnackAvoid = { ...THREAT_BLOCKED, threats: [FAR_THREAT], hazards: [FAR_SHAPE, { kind: 'circle', x: 520, y: 200, r: 5 }] };
  /** As THREAT_BLOCKED with no blocking threat, but a current crosses the 1-spot shrimp's glide. */
  const GLIDE_BLOCKED: MobileSnackAvoid = { ...THREAT_BLOCKED, threats: [FAR_THREAT], currents: [FAR_CURRENT, { ...FAR_CURRENT, id: 'current-0', x0: 515, x1: 520 }] };

  const cases = [
    { name: 'a 1-spot shrimp blocked by a threat', start: oneShrimp, head: HEAD, avoid: THREAT_BLOCKED },
    { name: 'a 1-spot shrimp blocked on its glide', start: oneShrimp, head: HEAD, avoid: GLIDE_BLOCKED },
    { name: 'a hopping shrimp blocked by a hazard', start: () => oneHopper(), head: { x: 650, y: 200 }, avoid: HAZARD_BLOCKED },
  ];

  for (const { name, start, head, avoid } of cases) {
    it(`stays ready with nothing changed, frame after frame, for ${name}`, () => {
      const started = start();
      const state = started.state;
      const itemsBefore = structuredClone(started.items);
      const stateBefore = structuredClone(state);
      const keys: string[] = [];
      const watched = watchedAvoid(avoid, keys);
      const items = started.items.map((item) => (item.home ? { ...item, home: watchedList(item.home, keys) } : item));
      for (let frame = 0; frame < 5; frame++) {
        expect(stepShrimpFlicks(items, head, frameAt(frame), state, REDUCED, watched, 0.016)).toBeNull();
        expect(stepShrimpFlicks(items, head, frameAt(frame), state, GLIDING, watched, 0.016)).toBeNull();
      }
      const read = keys.slice();
      expect(read).toContain('length');
      expect(read.filter((key) => LIST_SCANS.has(key))).toEqual([]);
      expect(read).not.toContain(ITERATOR_KEY);
      expect(state).toEqual(stateBefore);
      expect(items).toEqual(itemsBefore);
      const cleared = stepOrFail(items, head, state, REDUCED, 0.016, frameAt(5));
      expect(cleared.flickStarts).toEqual(['s0']);
    });
  }
});

describe('isShrimpFlickLandingClear (issue #139)', () => {
  /** Heads round `base`, `gap` px off it, one on each side. */
  function headsRound(base: Point, gap: number): Point[] {
    return [
      { x: base.x - gap, y: base.y },
      { x: base.x + gap, y: base.y },
      { x: base.x, y: base.y - gap },
      { x: base.x, y: base.y + gap },
    ];
  }

  /** For each head, whether the predicate clears the flick away from it, checked against what stepShrimpFlicks does. */
  function checkAgainstRuntime(
    items: Collectible[],
    state: ShrimpFlickState,
    home: readonly Readonly<Point>[] | undefined,
    avoid: MobileSnackAvoid,
    rule: ShrimpRule,
  ): boolean[] {
    const base = placeOf(items[0]);
    return headsRound(base, rule.triggerRadius / 2).map((head) => {
      const away = Math.hypot(base.x - head.x, base.y - head.y);
      const target: Point = {
        x: base.x + ((base.x - head.x) / away) * rule.flickDistance,
        y: base.y + ((base.y - head.y) / away) * rule.flickDistance,
      };
      const clear = isShrimpFlickLandingClear(base.x, base.y, home, target, STILL_DRIFT, avoid, rule);
      const step = stepShrimpFlicks(items, head, STILL, state, REDUCED, avoid, 0.016);
      expect(step !== null, `head at ${head.x}, ${head.y}`).toBe(clear);
      if (step) expect(placeOf(step.items[0])).toEqual({ x: expect.closeTo(target.x, 9), y: expect.closeTo(target.y, 9) });
      return clear;
    });
  }

  it('agrees with stepShrimpFlicks for a 1-spot shrimp: a rejected way never flicks and a cleared one does', () => {
    const { items, state } = oneShrimp();
    const wormRight: MobileSnackAvoid = { ...AVOID, worms: [{ x: SHRIMP.x + RULE.flickDistance + 60, y: SHRIMP.y }] };
    const clears = checkAgainstRuntime(items, state, undefined, wormRight, RULE);
    expect(clears).toContain(true);
    expect(clears).toContain(false);
    expect(checkAgainstRuntime(items, state, undefined, AVOID, RULE)).toEqual([true, true, true, true]);
  });

  it('agrees with stepShrimpFlicks for a hopping shrimp, its home given as layout hop spots', () => {
    const home: readonly Readonly<Point>[] = SQUARE;
    const { items, state } = oneHopper(home);
    const hazardLeft: MobileSnackAvoid = { ...AVOID, hazards: [{ kind: 'circle', x: 470, y: 200, r: 5 }] };
    const clears = checkAgainstRuntime(items, state, home, hazardLeft, HOP_RULE);
    expect(clears).toContain(true);
    expect(clears).toContain(false);
    expect(checkAgainstRuntime(items, state, items[0].home, AVOID, HOP_RULE)).toContain(true);
  });

  it('keeps a hopping shrimp to its grown home box, which a 1-spot shrimp ignores', () => {
    const base = SQUARE[0];
    const outside: Point = { x: base.x - HOP_RULE.flickDistance - 1, y: base.y };
    expect(isShrimpFlickLandingClear(base.x, base.y, SQUARE, outside, STILL_DRIFT, AVOID, HOP_RULE)).toBe(false);
    expect(isShrimpFlickLandingClear(base.x, base.y, [base], outside, STILL_DRIFT, AVOID, HOP_RULE)).toBe(true);
    expect(isShrimpFlickLandingClear(base.x, base.y, undefined, outside, STILL_DRIFT, AVOID, HOP_RULE)).toBe(true);
  });
});

describe('readShrimpPose (issue #131, ND-10)', () => {
  function readPose(state: ShrimpFlickState, id: string): ShrimpPoseState {
    return {
      flicking: isShrimpFlicking(state, id),
      afterFlick: isShrimpRestingAfterFlick(state, id),
      hopSign: readShrimpHopSign(state, id),
    };
  }

  it('reads what isShrimpFlicking, isShrimpRestingAfterFlick and readShrimpHopSign read', () => {
    const { state: fresh } = oneShrimp();
    const states: ShrimpFlickState[] = [
      fresh,
      { ...fresh, resting: [{ id: 's0', readyAt: 5, next: 0, hopSign: 1, afterFlick: true }] },
      { ...fresh, resting: [], hops: [{ id: 's0', restX: -10, restY: 0, next: 1, hopSign: -1 }] },
      { ...fresh, resting: [], flicks: [{ id: 's0', restX: 30, restY: 0, next: 0, hopSign: -1 }] },
    ];
    const lookup = createShrimpPoseLookup();
    const out: ShrimpPoseState = { flicking: false, afterFlick: false, hopSign: 0 };
    for (const state of states) {
      for (const id of ['s0', 'unknown']) {
        expect(readShrimpPose(lookup, state, id, out)).toBe(out);
        expect({ ...out }).toEqual(readPose(state, id));
      }
    }
  });

  it('indexes each state once, so posing every shrimp reads each record id a bounded number of times', () => {
    const count = 200;
    const reads: IdReads = { count: 0 };
    const fresh = createShrimpFlicks(manyShrimp(count), RULE);
    const resting = fresh.resting.map((rest) => withCountedId(rest, reads));
    const state: ShrimpFlickState = { ...fresh, resting };
    const lookup = createShrimpPoseLookup();
    const out: ShrimpPoseState = { flicking: false, afterFlick: false, hopSign: 0 };
    for (const rest of fresh.resting) readShrimpPose(lookup, state, rest.id, out);
    expect(reads.count).toBeLessThanOrEqual(2 * count);
    const afterFirst = reads.count;
    for (const rest of fresh.resting) readShrimpPose(lookup, state, rest.id, out);
    expect(reads.count).toBe(afterFirst);
  });
});
