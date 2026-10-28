import { describe, expect, it } from 'vitest';
import {
  createEncounter,
  createEncounterContext,
  predatorSpecies,
  resetEncounter,
  stepEncounter,
  type EncounterContext,
  type EncounterEvent,
  type EncounterSource,
  type EncounterState,
  type EncounterStepResult,
} from './encounter';
import { currentAt, reedDragAt } from './environment';
import { TILAPIA_FACT } from './factCards';
import { GAME_EVENTS, REGISTRY_KEYS } from './gameEvents';
import { GHOST_NET, netDrift } from './ghostNets';
import type { HazardSpawn, HazardType } from './hazards';
import { inSightCover } from './hiding';
import { createLegs, isProtected, legSwimTuning, presentCount } from './legs';
import { GEYSER_VENT, PUNTING_POLE, STALACTITE_DRIP, movingHazardSpawn } from './movingHazards';
import {
  HERON_SPECIES,
  TILAPIA_SPECIES,
  type PredatorRoute,
  type PredatorSpecies,
  type PredatorState,
} from './predators';
import { mulberry32 } from './rng';
import { stepSwim, type SwimState } from './swimPhysics';
import { inSafeArea } from './tilapia';
import { TRIP_EVENTS, TRIP_REGISTRY_KEYS } from './tripEvents';
import { HERON, LEGS, SWIM, TILAPIA } from './tuning';
import { normalize } from './vec';
import {
  BED_TOP,
  SURF,
  buildCanalZone,
  inHomeSpot,
  swimBounds,
  type CaveArea,
  type PadSpec,
  type Point,
  type ReedPatch,
  type SafeArea,
  type TilapiaRoute,
} from './zone';

const DT = 1 / 60;
const zone = buildCanalZone();
const routeStart = zone.tilapiaRoutes[0].waypoints[0];
const inRange: Point = { x: routeStart.x + 60, y: routeStart.y };
const noRegrowCtx = createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 } });

interface Run {
  state: EncounterState;
  events: EncounterEvent[];
  impulses: number;
}

function run(
  state: EncounterState,
  pos: Point,
  seconds: number,
  ctx: EncounterContext = createEncounterContext(),
  until?: EncounterEvent['type'],
): Run {
  let current = state;
  const events: EncounterEvent[] = [];
  let impulses = 0;
  for (let t = 0; t < seconds; t += DT) {
    const result = stepEncounter(current, pos, DT, ctx);
    current = result.state;
    events.push(...result.events);
    if (result.impulse) impulses++;
    if (until && result.events.some((event) => event.type === until)) break;
  }
  return { state: current, events, impulses };
}

function typesOf(events: EncounterEvent[], keep: readonly EncounterEvent['type'][]): string[] {
  return events.filter((event) => keep.includes(event.type)).map((event) => event.type);
}

/** A tilapia mid-lunge 30 px left of `target`, aimed at it, so the next step connects. */
function lungingAt(target: Point, legs: EncounterState['legs']): EncounterState {
  const state = createEncounter(zone);
  const tilapia = {
    ...state.predators[0],
    pos: { x: target.x - 30, y: target.y },
    phase: 'lunge' as const,
    elapsed: 0,
    duration: TILAPIA.lungeDuration,
    aim: { x: 1, y: 0 },
  };
  return { ...state, legs, predators: [tilapia] };
}

describe('createEncounter', () => {
  it('starts with every leg, no protection and each tilapia at its route start', () => {
    const state = createEncounter(zone);
    expect(presentCount(state.legs)).toBe(LEGS.count);
    expect(isProtected(state.legs)).toBe(false);
    expect(state.predators).toHaveLength(zone.tilapiaRoutes.length);
    expect(state.predators[0].pos).toEqual(routeStart);
    expect(state.predators[0].phase).toBe('patrol');
    expect(state.tripOver).toBe(false);
  });

  it('makes one tilapia per route', () => {
    const second: TilapiaRoute = { id: 'second', waypoints: [{ x: 1500, y: 200 }] };
    const state = createEncounter({ ...zone, tilapiaRoutes: [...zone.tilapiaRoutes, second] });
    expect(state.predators.map((tilapia) => tilapia.routeId)).toEqual(['tilapia-0', 'tilapia-1', 'tilapia-2', 'second']);
  });
});

describe('stepEncounter scenario', () => {
  it('telegraphs, lunges, hits one leg, protects, cools down and repeats until carried home', () => {
    const { state, events } = run(createEncounter(zone), inRange, 60, noRegrowCtx, 'carriedHome');
    const flow = typesOf(events, ['telegraph', 'lunge', 'hit', 'protectedEnd', 'carriedHome']);
    const cycle = ['telegraph', 'lunge', 'hit', 'protectedEnd'];
    expect(flow).toEqual([...cycle, ...cycle, ...cycle, 'telegraph', 'lunge', 'hit', 'carriedHome']);
    const hits = events.filter((event) => event.type === 'hit');
    expect(hits.map((event) => event.leg)).toEqual([0, 1, 2, 3]);
    expect(presentCount(state.legs)).toBe(0);
    expect(state.tripOver).toBe(true);
  });

  it('ends the trip when no leg is present even though one is regrowing', () => {
    const { state, events } = run(createEncounter(zone), inRange, 60, createEncounterContext(), 'carriedHome');
    expect(events.filter((event) => event.type === 'carriedHome')).toHaveLength(1);
    expect(state.legs.slots[0].status).toBe('regrowing');
    expect(state.legs.slots[0].progress).toBeGreaterThan(0);
    expect(state.tripOver).toBe(true);
  });

  it('makes every step a no-op after carried home', () => {
    const over = run(createEncounter(zone), inRange, 60, noRegrowCtx, 'carriedHome').state;
    const after = run(over, inRange, 30, noRegrowCtx);
    expect(after.state).toBe(over);
    expect(after.events).toEqual([]);
    expect(after.impulses).toBe(0);
  });

  it('costs no leg when a lunge connects during protected time', () => {
    const ctx = createEncounterContext({ legs: { ...LEGS, protectedTime: 100, regrowTime: 1e9 } });
    const { state, events } = run(createEncounter(zone), inRange, 15, ctx);
    expect(typesOf(events, ['lunge']).length).toBeGreaterThanOrEqual(2);
    expect(typesOf(events, ['hit'])).toEqual(['hit']);
    expect(presentCount(state.legs)).toBe(LEGS.count - 1);
  });
});

describe('stepEncounter bump', () => {
  const edgeRoute: TilapiaRoute = { id: 'edge', waypoints: [{ x: zone.safeArea.x1 + TILAPIA.bodyRadius, y: 200 }] };
  const homeEdge: Point = { x: zone.safeArea.x1, y: 200 };

  it('bumps a touching axolotl gently away with no leg loss, limited by bumpCooldown', () => {
    const start = createEncounter({ ...zone, tilapiaRoutes: [edgeRoute] });
    const first = stepEncounter(start, homeEdge, DT);
    expect(first.events).toEqual([{ type: 'bump', sourceId: 'edge', from: edgeRoute.waypoints[0] }]);
    expect(first.impulse?.x).toBeCloseTo(-TILAPIA.bumpSpeed, 9);
    expect(first.impulse?.y).toBeCloseTo(0, 9);

    const during = run(first.state, homeEdge, TILAPIA.bumpCooldown - 2 * DT);
    expect(during.impulses).toBe(0);
    const later = run(during.state, homeEdge, 4 * DT);
    expect(later.impulses).toBe(1);
    expect(presentCount(later.state.legs)).toBe(LEGS.count);
  });
});

describe('stepEncounter safe area immunity', () => {
  it('never hits an axolotl on the safe area edge from a lunge at the keep-out face', () => {
    const face: Point = { x: zone.safeArea.x1 + TILAPIA.bodyRadius, y: 200 };
    const homeEdge: Point = { x: zone.safeArea.x1, y: 200 };
    const start = createEncounter({ ...zone, tilapiaRoutes: [{ id: 'edge', waypoints: [face] }] });
    const tilapia = {
      ...start.predators[0],
      phase: 'lunge' as const,
      elapsed: 0,
      duration: TILAPIA.lungeDuration,
      aim: { x: -1, y: 0 },
    };
    const lunging: EncounterState = { ...start, predators: [tilapia] };
    const { state, events } = run(lunging, homeEdge, TILAPIA.lungeDuration + TILAPIA.cooldown + DT);
    expect(typesOf(events, ['hit', 'carriedHome'])).toEqual([]);
    expect(presentCount(state.legs)).toBe(4);
  });
});

describe('stepEncounter same-frame order', () => {
  const target: Point = { x: 600, y: 200 };

  it('lets a hit win over contact in the same frame', () => {
    const state = lungingAt(target, createEncounter(zone).legs);
    const result = stepEncounter(state, target, DT);
    expect(result.events.map((event) => event.type)).toEqual(['hit', 'regrowStart']);
    expect(result.impulse).toBeUndefined();
    expect(result.state.bumpCooldownLeft).toBe(TILAPIA.bumpCooldown);
    expect(result.state.legs.protectedLeft).toBe(LEGS.protectedTime);
  });

  it('blocks a hit in the step where protected time runs out partway through', () => {
    const legs: EncounterState['legs'] = { ...createEncounter(zone).legs, protectedLeft: DT / 2 };
    const result = stepEncounter(lungingAt(target, legs), target, DT);
    expect(result.events[0]).toEqual({ type: 'protectedEnd' });
    expect(typesOf(result.events, ['hit', 'regrowStart', 'carriedHome'])).toEqual([]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count);
    expect(isProtected(result.state.legs)).toBe(false);
    expect(result.state.predators[0].phase).toBe('cooldown');
  });

  it('lands a hit in the first step after protected time has run out', () => {
    const legs: EncounterState['legs'] = { ...createEncounter(zone).legs, protectedLeft: DT / 2 };
    const ended = stepEncounter({ ...createEncounter(zone), legs }, { x: 1800, y: 200 }, DT).state;
    expect(isProtected(ended.legs)).toBe(false);
    const result = stepEncounter(lungingAt(target, ended.legs), target, DT);
    expect(typesOf(result.events, ['hit'])).toEqual(['hit']);
    expect(presentCount(result.state.legs)).toBe(LEGS.count - 1);
  });

  it('counts a leg that finishes regrowing in the step, so a same-step hit cannot end the trip', () => {
    const legs: EncounterState['legs'] = {
      slots: [
        { status: 'regrowing', progress: 1 - (DT / 2) / LEGS.regrowTime },
        { status: 'lost', progress: 0 },
        { status: 'lost', progress: 0 },
        { status: 'present', progress: 1 },
      ],
      protectedLeft: 0,
      regrowQueue: [0, 1, 2],
    };
    const result = stepEncounter(lungingAt(target, legs), target, DT);
    expect(result.events.map((event) => event.type)).toEqual(['regrown', 'regrowStart', 'hit']);
    expect(typesOf(result.events, ['carriedHome'])).toEqual([]);
    expect(presentCount(result.state.legs)).toBe(1);
    expect(result.state.tripOver).toBe(false);
  });

  it('emits regrown before the hit when both happen in one step', () => {
    const almost = 1 - (DT / 2) / LEGS.regrowTime;
    const legs: EncounterState['legs'] = {
      slots: [
        { status: 'regrowing', progress: almost },
        { status: 'present', progress: 1 },
        { status: 'present', progress: 1 },
        { status: 'present', progress: 1 },
      ],
      protectedLeft: 0,
      regrowQueue: [0],
    };
    const result = stepEncounter(lungingAt(target, legs), target, DT);
    expect(result.events.map((event) => event.type)).toEqual(['regrown', 'hit', 'regrowStart']);
    expect(result.events[1]).toMatchObject({ type: 'hit', leg: 0 });
  });

  it('emits regrowStart for the next queued leg when one finishes', () => {
    const legs: EncounterState['legs'] = {
      slots: [
        { status: 'regrowing', progress: 1 - (DT / 2) / LEGS.regrowTime },
        { status: 'lost', progress: 0 },
        { status: 'present', progress: 1 },
        { status: 'present', progress: 1 },
      ],
      protectedLeft: 0,
      regrowQueue: [0, 1],
    };
    const state = { ...createEncounter(zone), legs };
    const result = stepEncounter(state, { x: 1800, y: 200 }, DT);
    expect(result.events).toEqual([
      { type: 'regrown', leg: 0 },
      { type: 'regrowStart', leg: 1 },
    ]);
  });
});

describe('stepEncounter pause and dt', () => {
  it('leaves state unchanged at dt=0 through telegraph, cooldown, protected time and regrowth', () => {
    const telegraphing = run(createEncounter(zone), inRange, 5, createEncounterContext(), 'telegraph').state;
    expect(telegraphing.predators[0].phase).toBe('telegraph');
    const afterHit = run(telegraphing, inRange, 5, createEncounterContext(), 'hit').state;
    expect(afterHit.predators[0].phase).toBe('cooldown');
    expect(isProtected(afterHit.legs)).toBe(true);
    expect(afterHit.legs.slots[0].status).toBe('regrowing');

    for (const state of [telegraphing, afterHit]) {
      for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const paused = stepEncounter(state, inRange, dt);
        expect(paused.state).toBe(state);
        expect(paused.events).toEqual([]);
        expect(paused.impulse).toBeUndefined();
      }
    }
  });

  it('caps dt at SWIM.dtMax', () => {
    const telegraphing = run(createEncounter(zone), inRange, 5, createEncounterContext(), 'telegraph').state;
    const elapsed = telegraphing.predators[0].elapsed;
    const stepped = stepEncounter(telegraphing, inRange, 1).state;
    expect(stepped.predators[0].elapsed).toBeCloseTo(elapsed + SWIM.dtMax, 9);
  });
});

function attackingCount(state: EncounterState): number {
  return state.predators.filter((tilapia) => tilapia.phase === 'telegraph' || tilapia.phase === 'lunge').length;
}

function bodyGap(pos: Point, area: SafeArea): number {
  const dx = Math.max(area.x0 - pos.x, 0, pos.x - area.x1);
  const dy = Math.max(area.y0 - pos.y, 0, pos.y - area.y1);
  return Math.hypot(dx, dy);
}

/** Moves a target at 120 px/s toward seeded goals spread across the whole canal. */
function canalWanderer(rand: () => number): () => Point {
  const bounds = swimBounds();
  const target = { x: zone.start.x, y: zone.start.y };
  let goal = { ...target };
  return () => {
    if (Math.hypot(goal.x - target.x, goal.y - target.y) < 5) {
      goal = {
        x: bounds.minX + rand() * (bounds.maxX - bounds.minX),
        y: bounds.minY + rand() * (bounds.maxY - bounds.minY),
      };
    }
    const gap = Math.hypot(goal.x - target.x, goal.y - target.y);
    const stride = Math.min(gap, 120 * DT);
    target.x += ((goal.x - target.x) / gap) * stride;
    target.y += ((goal.y - target.y) / gap) * stride;
    return { x: target.x, y: target.y };
  };
}

interface WanderStats {
  hits: number;
  attackers: Set<string>;
}

function checkWanderStep(before: EncounterState, result: EncounterStepResult, target: Point, stats: WanderStats): void {
  const { state, events } = result;
  expect(attackingCount(state)).toBeLessThanOrEqual(1);
  for (const tilapia of state.predators) {
    expect(bodyGap(tilapia.pos, state.safeArea)).toBeGreaterThanOrEqual(TILAPIA.bodyRadius - 1e-9);
  }
  const hits = events.filter((event) => event.type === 'hit').length;
  const regrown = events.filter((event) => event.type === 'regrown').length;
  expect(hits).toBeLessThanOrEqual(1);
  expect(presentCount(state.legs)).toBe(presentCount(before.legs) + regrown - hits);
  if (hits > 0) expect(inSafeArea(target, state.safeArea)).toBe(false);
  stats.hits += hits;
  for (const event of events) {
    if (event.type === 'telegraph') stats.attackers.add(event.sourceId);
  }
}

/** Steers a 1-leg axolotl from `start` to the Home Spot through the canal; returns seconds taken or Infinity. */
function secondsToHome(start: Point, warmUp: number, limit: number): number {
  const tuning = legSwimTuning(1);
  const env = { bounds: swimBounds(), dashing: false };
  let encounter: EncounterState = { ...createEncounter(zone), legs: { ...createLegs(), protectedLeft: 1e9 } };
  for (let t = 0; t < warmUp; t += DT) encounter = stepEncounter(encounter, zone.start, DT).state;
  let swim: SwimState = { x: start.x, y: start.y, vx: 0, vy: 0, facing: -1 };
  const steps = Math.round(limit / DT);
  for (let i = 1; i <= steps; i++) {
    const pos = { x: swim.x, y: swim.y };
    const steer = normalize({ x: zone.homeSpot.x - pos.x, y: zone.homeSpot.y - pos.y });
    const swimEnv = { ...env, current: currentAt(pos, zone.currents), dragMul: reedDragAt(pos, zone.reedPatches) };
    swim = stepSwim(swim, steer, swimEnv, DT, tuning);
    const result = stepEncounter(encounter, { x: swim.x, y: swim.y }, DT);
    encounter = result.state;
    if (result.impulse) swim = { ...swim, vx: result.impulse.x, vy: result.impulse.y };
    if (inHomeSpot({ x: swim.x, y: swim.y }, zone.homeSpot)) return i * DT;
  }
  return Infinity;
}

describe('several tilapia', () => {
  const left: TilapiaRoute = { id: 'left', waypoints: [{ x: 1000, y: 200 }] };
  const right: TilapiaRoute = { id: 'right', waypoints: [{ x: 1100, y: 200 }] };
  const between: Point = { x: 1050, y: 200 };

  it('lets only the first fish telegraph, and the second only after the first lunge ends', () => {
    let state = createEncounter({ ...zone, tilapiaRoutes: [left, right] });
    let firstLungeEnd = -1;
    let secondTelegraph = -1;
    const telegraphs: string[] = [];
    for (let i = 0; i < Math.round(4 / DT) && secondTelegraph < 0; i++) {
      const wasLunging = state.predators[0].phase === 'lunge';
      const result = stepEncounter(state, between, DT, noRegrowCtx);
      state = result.state;
      expect(attackingCount(state)).toBeLessThanOrEqual(1);
      if (wasLunging && state.predators[0].phase !== 'lunge' && firstLungeEnd < 0) firstLungeEnd = i;
      for (const event of result.events) {
        if (event.type !== 'telegraph') continue;
        telegraphs.push(event.sourceId);
        if (event.sourceId === 'right') secondTelegraph = i;
      }
    }
    expect(telegraphs).toEqual(['left', 'right']);
    expect(firstLungeEnd).toBeGreaterThan(0);
    expect(secondTelegraph).toBeGreaterThanOrEqual(firstLungeEnd);
  });

  it('never lets two fish attack at once over a long canal wander', { timeout: 20000 }, () => {
    const nextTarget = canalWanderer(mulberry32(0x7a1a));
    const stats: WanderStats = { hits: 0, attackers: new Set() };
    let state = createEncounter(zone);
    for (let i = 0; i < Math.round(300 / DT); i++) {
      const target = nextTarget();
      const result = stepEncounter(state, target, DT);
      checkWanderStep(state, result, target, stats);
      state = result.state.tripOver ? resetEncounter(result.state) : result.state;
    }
    expect(stats.hits).toBeGreaterThan(0);
    expect([...stats.attackers].sort()).toEqual(['tilapia-0', 'tilapia-1', 'tilapia-2']);
  });

  it('blocks a hit from a different fish during protected time', () => {
    const target: Point = { x: 1050, y: 200 };
    const start = createEncounter({ ...zone, tilapiaRoutes: [left, right] });
    const lunge = { phase: 'lunge' as const, elapsed: 0, duration: TILAPIA.lungeDuration };
    const fromLeft = { ...start.predators[0], ...lunge, pos: { x: target.x - 30, y: 200 }, aim: { x: 1, y: 0 } };
    const first = stepEncounter({ ...start, predators: [fromLeft, start.predators[1]] }, target, DT, noRegrowCtx);
    expect(typesOf(first.events, ['hit'])).toEqual(['hit']);
    expect(presentCount(first.state.legs)).toBe(LEGS.count - 1);

    const fromRight = { ...first.state.predators[1], ...lunge, pos: { x: target.x + 30, y: 200 }, aim: { x: -1, y: 0 } };
    const armed: EncounterState = { ...first.state, predators: [first.state.predators[0], fromRight] };
    const second = stepEncounter(armed, target, DT, noRegrowCtx);
    expect(isProtected(armed.legs)).toBe(true);
    expect(second.state.predators[1].phase).toBe('cooldown');
    expect(second.state.predators[1].elapsed).toBe(0);
    expect(typesOf(second.events, ['hit', 'carriedHome'])).toEqual([]);
    expect(presentCount(second.state.legs)).toBe(LEGS.count - 1);
  });

  it('always leaves a 1-leg axolotl a path home from anywhere in the canal', { timeout: 20000 }, () => {
    const times: number[] = [];
    for (const warmUp of [0, 9.1]) {
      for (let x = 340; x <= 1840; x += 100) {
        for (const y of [110, 200, 286]) {
          const seconds = secondsToHome({ x, y }, warmUp, 40);
          expect(seconds, `start (${x}, ${y}) after ${warmUp} s`).toBeLessThanOrEqual(40);
          times.push(seconds);
        }
      }
    }
    expect(times).toHaveLength(96);
  });
});

describe('resetEncounter', () => {
  it('restores four legs, no protection and the tilapia at its route start', () => {
    const over = run(createEncounter(zone), inRange, 60, noRegrowCtx, 'carriedHome').state;
    const fresh = resetEncounter(over);
    expect(presentCount(fresh.legs)).toBe(4);
    expect(isProtected(fresh.legs)).toBe(false);
    expect(fresh.legs.regrowQueue).toEqual([]);
    expect(fresh.predators[0].pos).toEqual(routeStart);
    expect(fresh.predators[0].phase).toBe('patrol');
    expect(fresh.bumpCooldownLeft).toBe(0);
    expect(fresh.tripOver).toBe(false);
    expect(fresh).toEqual(createEncounter(zone));
  });

  it('accepts a zone', () => {
    expect(resetEncounter(zone)).toEqual(createEncounter(zone));
  });
});

describe('trip events contract', () => {
  it('uses event names and registry keys that never repeat the game ones', () => {
    const gameValues = new Set<string>(Object.values(GAME_EVENTS));
    for (const name of Object.values(TRIP_EVENTS)) expect(gameValues.has(name)).toBe(false);
    expect(new Set(Object.values(TRIP_EVENTS)).size).toBe(Object.values(TRIP_EVENTS).length);
    const registryValues = new Set<string>(Object.values(REGISTRY_KEYS));
    for (const key of Object.values(TRIP_REGISTRY_KEYS)) expect(registryValues.has(key)).toBe(false);
  });
});

describe('Shell perk (A22, F11)', () => {
  const target: Point = { x: 600, y: 200 };
  const shellCtx = createEncounterContext({ shell: true });
  const shellNoRegrowCtx = createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 }, shell: true });

  it('is off by default and starts every encounter unused', () => {
    expect(createEncounterContext().shell).toBe(false);
    expect(createEncounter(zone).shellUsed).toBe(false);
  });

  it('blocks the first connected lunge: no leg lost, protected time and bump cooldown start, shellBlock not hit', () => {
    const result = stepEncounter(lungingAt(target, createEncounter(zone).legs), target, DT, shellCtx);
    expect(result.events).toEqual([{ type: 'shellBlock', sourceId: 'tilapia-0', from: result.state.predators[0].pos }]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count);
    expect(result.state.legs.regrowQueue).toEqual([]);
    expect(result.state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(result.state.bumpCooldownLeft).toBe(TILAPIA.bumpCooldown);
    expect(result.impulse).toBeUndefined();
    expect(result.state.shellUsed).toBe(true);
    expect(result.state.tripOver).toBe(false);
  });

  it('blocks only once per trip: the next connected lunge costs a leg', () => {
    const blocked = stepEncounter(lungingAt(target, createEncounter(zone).legs), target, DT, shellCtx).state;
    const unprotected = { ...blocked.legs, protectedLeft: 0 };
    const armed: EncounterState = { ...blocked, legs: unprotected, predators: lungingAt(target, unprotected).predators };
    const result = stepEncounter(armed, target, DT, shellCtx);
    expect(result.events.map((event) => event.type)).toEqual(['hit', 'regrowStart']);
    expect(presentCount(result.state.legs)).toBe(LEGS.count - 1);
    expect(result.state.shellUsed).toBe(true);
  });

  it('keeps the Shell unused when protected time already blocks the lunge', () => {
    const protectedLegs = { ...createEncounter(zone).legs, protectedLeft: 1 };
    const blockedByTime = stepEncounter(lungingAt(target, protectedLegs), target, DT, shellCtx);
    expect(typesOf(blockedByTime.events, ['hit', 'shellBlock'])).toEqual([]);
    expect(blockedByTime.state.shellUsed).toBe(false);
    expect(presentCount(blockedByTime.state.legs)).toBe(LEGS.count);

    const unprotected = { ...blockedByTime.state.legs, protectedLeft: 0 };
    const armed: EncounterState = {
      ...blockedByTime.state,
      legs: unprotected,
      predators: lungingAt(target, unprotected).predators,
    };
    const result = stepEncounter(armed, target, DT, shellCtx);
    expect(typesOf(result.events, ['hit', 'shellBlock'])).toEqual(['shellBlock']);
    expect(result.state.shellUsed).toBe(true);
  });

  it('changes nothing without the Shell flag', () => {
    const result = stepEncounter(lungingAt(target, createEncounter(zone).legs), target, DT);
    expect(result.events.map((event) => event.type)).toEqual(['hit', 'regrowStart']);
    expect(presentCount(result.state.legs)).toBe(LEGS.count - 1);
    expect(result.state.shellUsed).toBe(false);
  });

  it('still ends the trip after 4 hits that follow the block', () => {
    const { state, events } = run(createEncounter(zone), inRange, 120, shellNoRegrowCtx, 'carriedHome');
    const flow = typesOf(events, ['telegraph', 'lunge', 'hit', 'shellBlock', 'protectedEnd', 'carriedHome']);
    const cycle = ['telegraph', 'lunge', 'hit', 'protectedEnd'];
    const blockCycle = ['telegraph', 'lunge', 'shellBlock', 'protectedEnd'];
    expect(flow).toEqual([...blockCycle, ...cycle, ...cycle, ...cycle, 'telegraph', 'lunge', 'hit', 'carriedHome']);
    const hits = events.filter((event) => event.type === 'hit');
    expect(hits.map((event) => event.leg)).toEqual([0, 1, 2, 3]);
    expect(presentCount(state.legs)).toBe(0);
    expect(state.tripOver).toBe(true);
  });

  it('is unused again after resetEncounter', () => {
    const blocked = stepEncounter(lungingAt(target, createEncounter(zone).legs), target, DT, shellCtx).state;
    expect(blocked.shellUsed).toBe(true);
    expect(resetEncounter(blocked).shellUsed).toBe(false);
  });
});

describe('hazard hits', () => {
  const spikeType: HazardType = {
    id: 'test-spike',
    name: 'Test spike',
    costsLeg: true,
    reach: 0,
    meetRange: 40,
    fact: TILAPIA_FACT,
  };
  const weedType: HazardType = { ...spikeType, id: 'test-weed', name: 'Test weed', costsLeg: false };
  const spike: HazardSpawn = { id: 'spike', type: spikeType, shape: { kind: 'circle', x: 1000, y: 200, r: 20 } };
  const weed: HazardSpawn = { id: 'weed', type: weedType, shape: { kind: 'rect', x0: 980, x1: 1020, y0: 180, y1: 220 } };
  const onHazard: Point = { x: 1005, y: 200 };
  const spikeCentre: Point = { x: 1000, y: 200 };
  const shellCtx = createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 }, shell: true });

  function hazardEncounter(hazards: HazardSpawn[]): EncounterState {
    return createEncounter({ ...zone, tilapiaRoutes: [], hazards });
  }

  it('costs one leg from the hazard centre and leaves the bump cooldown unchanged', () => {
    const start: EncounterState = { ...hazardEncounter([spike]), bumpCooldownLeft: 0.5 };
    const result = stepEncounter(start, onHazard, DT, noRegrowCtx);
    expect(result.events).toEqual([
      { type: 'hit', sourceId: 'spike', leg: 0, from: spikeCentre },
      { type: 'regrowStart', leg: 0 },
    ]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count - 1);
    expect(result.state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(result.state.bumpCooldownLeft).toBeCloseTo(0.5 - DT, 9);
    expect(result.impulse).toBeUndefined();
  });

  it('follows a hit with protected time that blocks a second hazard hit', () => {
    const first = stepEncounter(hazardEncounter([spike]), onHazard, DT, noRegrowCtx).state;
    const during = run(first, onHazard, LEGS.protectedTime - 2 * DT, noRegrowCtx);
    expect(typesOf(during.events, ['hit', 'shellBlock', 'carriedHome'])).toEqual([]);
    expect(presentCount(during.state.legs)).toBe(LEGS.count - 1);
    const after = run(during.state, onHazard, 4 * DT, noRegrowCtx, 'hit');
    expect(typesOf(after.events, ['protectedEnd', 'hit'])).toEqual(['protectedEnd', 'hit']);
    expect(presentCount(after.state.legs)).toBe(LEGS.count - 2);
  });

  it('lets the Shell block the first hazard hit', () => {
    const result = stepEncounter(hazardEncounter([spike]), onHazard, DT, shellCtx);
    expect(result.events).toEqual([{ type: 'shellBlock', sourceId: 'spike', from: spikeCentre }]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count);
    expect(result.state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(result.state.bumpCooldownLeft).toBe(0);
    expect(result.state.shellUsed).toBe(true);
  });

  it('carries the axolotl home on the fourth leg', () => {
    const { state, events } = run(hazardEncounter([spike]), onHazard, 60, noRegrowCtx, 'carriedHome');
    const hits = events.filter((event) => event.type === 'hit');
    expect(hits.map((event) => event.leg)).toEqual([0, 1, 2, 3]);
    expect(typesOf(events, ['carriedHome'])).toEqual(['carriedHome']);
    expect(events[events.length - 1]).toEqual({ type: 'carriedHome' });
    expect(presentCount(state.legs)).toBe(0);
    expect(state.tripOver).toBe(true);
  });

  it('never hits from a slow-only hazard', () => {
    const { state, events } = run(hazardEncounter([weed]), onHazard, 10, shellCtx);
    expect(typesOf(events, ['hit', 'shellBlock', 'carriedHome'])).toEqual([]);
    expect(presentCount(state.legs)).toBe(LEGS.count);
    expect(state.shellUsed).toBe(false);
  });
});

describe('stagger across species', () => {
  const testSpecies: PredatorSpecies = {
    id: 'test-eel',
    name: 'Test eel',
    tuning: { ...TILAPIA, windup: TILAPIA.windup * 1.5 },
    meetRange: 120,
    fact: TILAPIA_FACT,
  };
  const left: TilapiaRoute = { id: 'left', waypoints: [{ x: 1000, y: 200 }] };
  const eelRoute = { id: 'eel', waypoints: [{ x: 1100, y: 200 }], species: testSpecies };
  const between: Point = { x: 1050, y: 200 };
  const source = { ...zone, tilapiaRoutes: [left], predatorRoutes: [eelRoute] };

  it('puts the tilapia first, then the other species, each with its own species', () => {
    const state = createEncounter(source);
    expect(state.predators.map((predator) => [predator.routeId, predator.species])).toEqual([
      ['left', 'tilapia'],
      ['eel', 'test-eel'],
    ]);
    expect(predatorSpecies(state, state.predators[0])).toBe(TILAPIA_SPECIES);
    expect(predatorSpecies(state, state.predators[1])).toBe(testSpecies);
  });

  it('never lets the tilapia and the other species telegraph or lunge at once', () => {
    let state = createEncounter(source);
    const telegraphs = new Set<string>();
    for (let i = 0; i < Math.round(20 / DT) && !state.tripOver; i++) {
      const result = stepEncounter(state, between, DT, noRegrowCtx);
      state = result.state;
      expect(attackingCount(state)).toBeLessThanOrEqual(1);
      for (const event of result.events) {
        if (event.type === 'telegraph') telegraphs.add(event.sourceId);
      }
    }
    expect([...telegraphs].sort()).toEqual(['eel', 'left']);
  });
});

describe('the heron in the encounter (#111)', () => {
  const standPoint: Point = { x: 1000, y: 100 };
  const heronRoute: PredatorRoute = { id: 'heron-stand', waypoints: [standPoint], species: HERON_SPECIES };
  const heronSource: EncounterSource = { ...zone, tilapiaRoutes: [], predatorRoutes: [heronRoute] };
  const inReach: Point = { x: 1000, y: 180 };
  const shellCtx = createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 }, shell: true });
  /** One warning and its cooldown: the shortest time from one heron warning to the next. */
  const round = HERON.windup + HERON.cooldown;

  function heronOf(state: EncounterState): PredatorState {
    return state.predators[state.predators.length - 1];
  }

  function standingAt(id: string, at: Point): PredatorRoute {
    return { id, waypoints: [at], species: HERON_SPECIES };
  }

  it('builds the tilapia first, then the heron route with the heron species and its own tuning', () => {
    const left: TilapiaRoute = { id: 'left', waypoints: [{ x: 1000, y: 200 }] };
    const state = createEncounter({ ...heronSource, tilapiaRoutes: [left] });
    expect(state.predators.map((predator) => [predator.routeId, predator.species])).toEqual([
      ['left', 'tilapia'],
      ['heron-stand', 'heron'],
    ]);
    const tunedCtx = createEncounterContext({ tilapia: { ...TILAPIA, windup: 5 } });
    expect(predatorSpecies(state, state.predators[1], tunedCtx)).toBe(HERON_SPECIES);
    expect(predatorSpecies(state, state.predators[1], tunedCtx).tuning).toBe(HERON);
  });

  it('never bumps, even with the axolotl on its strike spot, whatever its contactRadius', () => {
    const wideReach: PredatorSpecies = { ...HERON_SPECIES, tuning: { ...HERON, contactRadius: 1000, bumpSpeed: 500 } };
    for (const species of [HERON_SPECIES, wideReach]) {
      const source: EncounterSource = { ...heronSource, predatorRoutes: [{ ...heronRoute, species }] };
      const { events, impulses } = run(createEncounter(source), inReach, 2 * round, noRegrowCtx);
      expect(typesOf(events, ['telegraph', 'hit'])).toEqual(['telegraph', 'hit', 'telegraph', 'hit']);
      expect(typesOf(events, ['bump'])).toEqual([]);
      expect(impulses).toBe(0);
    }
  });

  it('lands a connected stab as one hit from where it stands: one leg, protected time and the heron bump cooldown', () => {
    const { state, events } = run(createEncounter(heronSource), inReach, round, noRegrowCtx, 'hit');
    expect(typesOf(events, ['telegraph', 'lunge', 'hit', 'regrowStart', 'bump'])).toEqual([
      'telegraph',
      'lunge',
      'hit',
      'regrowStart',
    ]);
    expect(events.find((event) => event.type === 'hit')).toEqual({ type: 'hit', sourceId: 'heron-stand', leg: 0, from: standPoint });
    expect(presentCount(state.legs)).toBe(LEGS.count - 1);
    expect(state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(state.bumpCooldownLeft).toBe(HERON.bumpCooldown);
    expect(heronOf(state).phase).toBe('cooldown');
    expect(heronOf(state).pos).toEqual(standPoint);
  });

  it('lets the Shell block the first stab, and the next stab costs a leg', () => {
    const blocked = run(createEncounter(heronSource), inReach, round, shellCtx, 'shellBlock');
    expect(blocked.events.filter((event) => event.type === 'shellBlock')).toEqual([
      { type: 'shellBlock', sourceId: 'heron-stand', from: standPoint },
    ]);
    expect(presentCount(blocked.state.legs)).toBe(LEGS.count);
    expect(blocked.state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(blocked.state.bumpCooldownLeft).toBe(HERON.bumpCooldown);
    expect(blocked.state.shellUsed).toBe(true);
    const next = run(blocked.state, inReach, 2 * round, shellCtx, 'hit');
    expect(typesOf(next.events, ['hit', 'shellBlock'])).toEqual(['hit']);
    expect(presentCount(next.state.legs)).toBe(LEGS.count - 1);
  });

  it('carries the axolotl home on the fourth stab', () => {
    const { state, events } = run(createEncounter(heronSource), inReach, 5 * round, noRegrowCtx, 'carriedHome');
    const hits = events.filter((event) => event.type === 'hit');
    expect(hits.map((event) => event.leg)).toEqual([0, 1, 2, 3]);
    expect(events[events.length - 1]).toEqual({ type: 'carriedHome' });
    expect(state.tripOver).toBe(true);
  });

  it('takes its cover from the zone data: never warns at an axolotl in the canal reeds, under a canal pad or in the canal cave', () => {
    const reeds = zone.reedPatches[2];
    const pad = zone.pads[3];
    const hiding: { cover: string; stand: Point; axolotl: Point }[] = [
      { cover: 'reeds', stand: { x: (reeds.x0 + reeds.x1) / 2, y: 100 }, axolotl: { x: (reeds.x0 + reeds.x1) / 2, y: 180 } },
      { cover: 'pad', stand: { x: pad.x - 60, y: 100 }, axolotl: { x: pad.x, y: SURF + 15 } },
      { cover: 'cave', stand: { x: zone.cave.x0 + 20, y: 100 }, axolotl: { x: zone.cave.x0 + 20, y: zone.cave.y0 + 5 } },
    ];
    for (const { cover, stand, axolotl } of hiding) {
      const source: EncounterSource = { ...heronSource, predatorRoutes: [standingAt(`heron-${cover}`, stand)] };
      const state = createEncounter(source);
      expect(state.reedPatches).toEqual(zone.reedPatches);
      expect(state.pads).toEqual(zone.pads);
      expect(state.cave).toEqual(zone.cave);
      expect(inSightCover(axolotl, state), cover).toBe(true);
      expect(Math.hypot(axolotl.x - stand.x, axolotl.y - stand.y), cover).toBeLessThanOrEqual(HERON.lungeRange);
      expect(typesOf(run(state, axolotl, 2 * round, noRegrowCtx).events, ['telegraph', 'lunge', 'hit']), cover).toEqual([]);
    }
    const open: Point = { x: inReach.x, y: inReach.y };
    expect(inSightCover(open, createEncounter(heronSource))).toBe(false);
    const { events } = run(createEncounter(heronSource), open, round, noRegrowCtx, 'hit');
    expect(typesOf(events, ['telegraph', 'lunge', 'hit'])).toEqual(['telegraph', 'lunge', 'hit']);
  });

  it('lets only one predator warn or strike at a time across two herons and a tilapia (A1)', () => {
    const fish: TilapiaRoute = { id: 'fish', waypoints: [{ x: 1000, y: 260 }] };
    const source: EncounterSource = {
      ...zone,
      tilapiaRoutes: [fish],
      predatorRoutes: [standingAt('heron-0', { x: 950, y: 100 }), standingAt('heron-1', { x: 1050, y: 100 })],
    };
    const axolotl: Point = { x: 1000, y: 170 };
    let state = createEncounter(source);
    const telegraphs: string[] = [];
    for (let i = 0; i < Math.round(30 / DT) && !state.tripOver; i++) {
      const result = stepEncounter(state, axolotl, DT, noRegrowCtx);
      state = result.state;
      expect(attackingCount(state)).toBeLessThanOrEqual(1);
      for (const event of result.events) {
        if (event.type === 'telegraph') telegraphs.push(event.sourceId);
      }
    }
    expect(new Set(telegraphs)).toEqual(new Set(['fish', 'heron-0', 'heron-1']));
  });

  it('freezes the heron at dt=0 and every other paused dt', () => {
    const warning = run(createEncounter(heronSource), inReach, 0.5, noRegrowCtx).state;
    expect(heronOf(warning).phase).toBe('telegraph');
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const paused = stepEncounter(warning, inReach, dt, noRegrowCtx);
      expect(paused.state).toBe(warning);
      expect(paused.events).toEqual([]);
    }
  });
});

describe('per-area tilapia tuning', () => {
  const AREA_TILAPIA = { ...TILAPIA, windup: 0.85, lungeSpeed: 400, lungeRange: 145, cooldown: 2.2, patrolSpeed: 50 };
  const still: TilapiaRoute = { id: 'still', waypoints: [{ x: 1000, y: 200 }] };
  const stillSource: EncounterSource = { safeArea: zone.safeArea, tilapiaRoutes: [still] };
  const tunedSource: EncounterSource = { ...stillSource, tilapia: AREA_TILAPIA };
  const at143: Point = { x: 1143, y: 200 };

  /** Steps until the first event of `type`; returns the state after that step, or null when none came in `seconds`. */
  function stepUntil(state: EncounterState, pos: Point, type: EncounterEvent['type'], seconds: number): EncounterState | null {
    let current = state;
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const result = stepEncounter(current, pos, DT, noRegrowCtx);
      current = result.state;
      if (result.events.some((event) => event.type === type)) return current;
    }
    return null;
  }

  it('carries no tuning of its own when the source has none and plays TILAPIA_SPECIES', () => {
    const state = createEncounter(zone);
    expect(state).not.toHaveProperty('tilapia');
    expect(predatorSpecies(state, state.predators[0])).toBe(TILAPIA_SPECIES);
  });

  it('copies the source tuning and plays it in place of the context tuning, one species per encounter', () => {
    const state = createEncounter(tunedSource);
    expect(state.tilapia).toEqual(AREA_TILAPIA);
    expect(state.tilapia).not.toBe(AREA_TILAPIA);
    const species = predatorSpecies(state, state.predators[0]);
    expect(species.tuning).toBe(state.tilapia);
    expect({ ...species, tuning: TILAPIA }).toEqual(TILAPIA_SPECIES);
    const otherCtx = createEncounterContext({ tilapia: { ...TILAPIA, windup: 5 } });
    expect(predatorSpecies(state, state.predators[0], otherCtx)).toBe(species);
    const stepped = stepEncounter(state, { x: 100, y: 200 }, DT).state;
    expect(predatorSpecies(stepped, stepped.predators[0])).toBe(species);
    expect(predatorSpecies(createEncounter(tunedSource), state.predators[0]).tuning).toEqual(AREA_TILAPIA);
  });

  it('keeps the tuning on reset', () => {
    const state = createEncounter(tunedSource);
    expect(resetEncounter(state).tilapia).toEqual(AREA_TILAPIA);
    expect(resetEncounter(state)).toEqual(state);
  });

  it("starts a warning within the tuning's lunge range only", () => {
    expect(stepUntil(createEncounter(stillSource), at143, 'telegraph', 3)).toBeNull();
    const warning = stepUntil(createEncounter(tunedSource), at143, 'telegraph', 3);
    expect(warning?.predators[0].phase).toBe('telegraph');
  });

  it("warns for the tuning's windup", () => {
    const shared = stepUntil(createEncounter(stillSource), { x: 1100, y: 200 }, 'telegraph', 3);
    const tuned = stepUntil(createEncounter(tunedSource), { x: 1100, y: 200 }, 'telegraph', 3);
    expect(shared?.predators[0].duration).toBe(TILAPIA.windup);
    expect(tuned?.predators[0].duration).toBe(AREA_TILAPIA.windup);
  });

  it("strikes at the tuning's lunge speed and cools down for its cooldown", () => {
    const lunging = stepUntil(createEncounter(tunedSource), at143, 'lunge', 3);
    if (!lunging) throw new Error('no lunge');
    const next = stepEncounter(lunging, at143, DT, noRegrowCtx).state;
    expect(next.predators[0].phase).toBe('lunge');
    expect(next.predators[0].pos.x - lunging.predators[0].pos.x).toBeCloseTo(AREA_TILAPIA.lungeSpeed * DT, 9);
    const cooling = stepUntil(next, at143, 'hit', 3);
    expect(cooling?.predators[0].phase).toBe('cooldown');
    expect(cooling?.predators[0].duration).toBe(AREA_TILAPIA.cooldown);
  });

  it("patrols at the tuning's patrol speed", () => {
    const long: TilapiaRoute = { id: 'long', waypoints: [{ x: 1000, y: 200 }, { x: 1400, y: 200 }] };
    const sheltered: Point = { x: 100, y: 200 };
    let shared = createEncounter({ ...stillSource, tilapiaRoutes: [long] });
    let tuned = createEncounter({ ...tunedSource, tilapiaRoutes: [long] });
    for (let i = 0; i < 60; i++) {
      shared = stepEncounter(shared, sheltered, DT, noRegrowCtx).state;
      tuned = stepEncounter(tuned, sheltered, DT, noRegrowCtx).state;
    }
    expect(shared.predators[0].pos.x - 1000).toBeCloseTo(TILAPIA.patrolSpeed, 6);
    expect(tuned.predators[0].pos.x - 1000).toBeCloseTo(AREA_TILAPIA.patrolSpeed, 6);
  });

  it('leaves every other species on its own tuning', () => {
    const heronRoute: PredatorRoute = { id: 'heron-0', waypoints: [{ x: 1600, y: 150 }], species: HERON_SPECIES };
    const state = createEncounter({ ...tunedSource, predatorRoutes: [heronRoute] });
    expect(predatorSpecies(state, state.predators[1])).toBe(HERON_SPECIES);
  });
});

describe('sight cover and the shared predator rules in the encounter', () => {
  const reeds: ReedPatch = { x0: 1040, x1: 1080, y0: SURF, y1: BED_TOP, dragMul: 2.5 };
  const pad: PadSpec = { x: 960, rx: 20, flower: false };
  const cave: CaveArea = { id: 'test/cave', x0: 1020, x1: 1060, y0: 200, y1: BED_TOP };
  const stalker: PredatorSpecies = {
    id: 'test-stalker',
    name: 'Test stalker',
    tuning: { ...TILAPIA, windup: 1.2, cooldown: 3, lungeRange: 110, lungeSpeed: 0, lungeDuration: 0.3, contactRadius: 0, bodyRadius: 0 },
    meetRange: 150,
    fact: TILAPIA_FACT,
    rules: { sightCover: true, fixedStrikeSpot: true, stillCooldown: true },
    neverTouches: true,
  };
  const standPoint: Point = { x: 1000, y: 120 };
  const stalkerRoute: PredatorRoute = { id: 'stalker', waypoints: [standPoint], species: stalker };
  const source: EncounterSource = {
    ...zone,
    tilapiaRoutes: [],
    predatorRoutes: [stalkerRoute],
    reedPatches: [reeds],
    pads: [pad],
    cave,
  };
  const covered: Record<string, Point> = {
    reeds: { x: 1060, y: 180 },
    pad: { x: 960, y: SURF + 10 },
    cave: { x: 1030, y: 205 },
  };
  const open: Point = { x: 1000, y: 200 };

  it('copies the cover geometry, which resetEncounter keeps, and leaves absent parts absent', () => {
    const state = createEncounter(source);
    expect(state.reedPatches).toEqual([reeds]);
    expect(state.reedPatches?.[0]).not.toBe(reeds);
    expect(state.pads).toEqual([pad]);
    expect(state.pads?.[0]).not.toBe(pad);
    expect(state.cave).toEqual(cave);
    expect(state.cave).not.toBe(cave);
    expect(resetEncounter(state)).toEqual(state);
    const bare = createEncounter({ safeArea: zone.safeArea, tilapiaRoutes: zone.tilapiaRoutes });
    expect(Object.keys(bare)).not.toContain('reedPatches');
    expect(Object.keys(bare)).not.toContain('pads');
    expect(Object.keys(bare)).not.toContain('cave');
  });

  it('never warns at an axolotl in reeds, under a pad or in the cave, but warns and stabs in open water', () => {
    for (const [cover, pos] of Object.entries(covered)) {
      const { events } = run(createEncounter(source), pos, 6, noRegrowCtx);
      expect(typesOf(events, ['telegraph', 'lunge', 'hit']), cover).toEqual([]);
    }
    const { events } = run(createEncounter(source), open, 6, noRegrowCtx, 'hit');
    expect(typesOf(events, ['telegraph', 'lunge', 'hit'])).toEqual(['telegraph', 'lunge', 'hit']);
  });

  it('lets the tilapia ignore cover', () => {
    const tilapiaSource: EncounterSource = { ...source, tilapiaRoutes: [{ id: 'left', waypoints: [standPoint] }], predatorRoutes: [] };
    const { events } = run(createEncounter(tilapiaSource), covered.reeds, 6, noRegrowCtx, 'hit');
    expect(typesOf(events, ['telegraph', 'lunge', 'hit'])).toEqual(['telegraph', 'lunge', 'hit']);
  });

  it('cancels the warning into cooldown when the axolotl hides before it ends', () => {
    const warned = run(createEncounter(source), open, 0.5, noRegrowCtx);
    expect(typesOf(warned.events, ['telegraph'])).toEqual(['telegraph']);
    const hidden = run(warned.state, covered.reeds, 1.5, noRegrowCtx);
    expect(typesOf(hidden.events, ['telegraph', 'lunge', 'hit'])).toEqual([]);
    expect(hidden.state.predators[0].phase).toBe('cooldown');
    expect(Object.keys(hidden.state.predators[0])).not.toContain('strikeSpot');
  });

  it('stabs the spot fixed at warning start from where it stands: a hit when the axolotl stays, a miss when it moved', () => {
    const stayed = run(createEncounter(source), open, 3, noRegrowCtx, 'hit');
    expect(stayed.events.find((event) => event.type === 'hit')).toEqual({ type: 'hit', sourceId: 'stalker', leg: 0, from: standPoint });
    const warned = run(createEncounter(source), open, 0.5, noRegrowCtx);
    const moved = run(warned.state, { x: 940, y: 200 }, 2, noRegrowCtx);
    expect(typesOf(moved.events, ['lunge', 'hit'])).toEqual(['lunge']);
    expect(moved.events.find((event) => event.type === 'lunge')).toEqual({ type: 'lunge', sourceId: 'stalker', aim: { x: 0, y: 1 } });
    expect(moved.state.predators[0].pos).toEqual(standPoint);
    expect(presentCount(moved.state.legs)).toBe(LEGS.count);
  });
});

describe('moving hazards in the encounter (ND-8)', () => {
  const POLE_X = 1000;
  /** Offset -3 puts the pole 3 s into its cycle at hazard time 0: held at full depth. */
  const heldPole = movingHazardSpawn('pole-1', PUNTING_POLE, POLE_X, -3);
  const restingPole = movingHazardSpawn('pole-1', PUNTING_POLE, POLE_X, 0);
  const underPole: Point = { x: POLE_X, y: 200 };
  const poleTip: Point = { x: POLE_X, y: SURF + PUNTING_POLE.depth };
  const clear: Point = { x: 1500, y: 200 };
  const shellCtx = createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 }, shell: true });

  function poleEncounter(spawn = heldPole, extra: Partial<EncounterSource> = {}): EncounterState {
    return createEncounter({ ...zone, tilapiaRoutes: [], movingHazards: [spawn], ...extra });
  }

  it('adds no keys to an encounter whose source has no moving hazards', () => {
    const plain = createEncounter(zone);
    const empty = createEncounter({ ...zone, movingHazards: [] });
    expect(empty).toEqual(plain);
    expect(Object.keys(empty)).toEqual(Object.keys(plain));
    expect(plain).not.toHaveProperty('movingHazards');
    expect(plain).not.toHaveProperty('hazardTime');
    const stepped = stepEncounter(plain, clear, DT).state;
    expect(Object.keys(stepped)).toEqual(Object.keys(plain));
  });

  it('copies the moving hazards, sharing their type, with the clock at 0', () => {
    const state = poleEncounter();
    expect(state.movingHazards).toEqual([heldPole]);
    expect(state.movingHazards?.[0]).not.toBe(heldPole);
    expect(state.movingHazards?.[0].type).toBe(PUNTING_POLE);
    expect(state.hazardTime).toBe(0);
  });

  it("copies a hazard's drift only when it is set", () => {
    const drift = netDrift(160, 0, 16, 0);
    const still: HazardSpawn = { id: 'net-still', type: GHOST_NET, shape: { kind: 'rect', x0: 900, x1: 1000, y0: 150, y1: 250 } };
    const drifting: HazardSpawn = { ...still, id: 'net-drift', drift };
    const state = createEncounter({ ...zone, hazards: [still, drifting] });
    expect(state.hazards).toEqual([still, drifting]);
    expect(state.hazards[0]).not.toHaveProperty('drift');
    expect(state.hazards[1].drift).toEqual(drift);
  });

  it('advances the clock by the capped step and stops it on a 0 step or a finished trip', () => {
    const state = poleEncounter(restingPole);
    expect(stepEncounter(state, clear, DT).state.hazardTime).toBe(DT);
    expect(stepEncounter(state, clear, 1).state.hazardTime).toBe(SWIM.dtMax);
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(stepEncounter(state, clear, dt).state).toBe(state);
    }
    const over: EncounterState = { ...state, hazardTime: 1.5, tripOver: true };
    expect(stepEncounter(over, clear, DT).state).toBe(over);
  });

  it('restarts the clock at 0 on resetEncounter', () => {
    const swum = run(poleEncounter(restingPole), clear, 1).state;
    expect(swum.hazardTime).toBeGreaterThan(0);
    const fresh = resetEncounter(swum);
    expect(fresh.hazardTime).toBe(0);
    expect(fresh).toEqual(poleEncounter(restingPole));
  });

  it('never touches while resting or warning', () => {
    const { state, events } = run(poleEncounter(restingPole), underPole, PUNTING_POLE.restFor + PUNTING_POLE.warnFor - 2 * DT, noRegrowCtx);
    expect(typesOf(events, ['hit', 'shellBlock'])).toEqual([]);
    expect(presentCount(state.legs)).toBe(LEGS.count);
  });

  it('costs one leg from the tip and leaves the bump cooldown unchanged', () => {
    const start: EncounterState = { ...poleEncounter(), bumpCooldownLeft: 0.5 };
    const result = stepEncounter(start, underPole, DT, noRegrowCtx);
    expect(result.events).toEqual([
      { type: 'hit', sourceId: 'pole-1', leg: 0, from: poleTip },
      { type: 'regrowStart', leg: 0 },
    ]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count - 1);
    expect(result.state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(result.state.bumpCooldownLeft).toBeCloseTo(0.5 - DT, 9);
    expect(result.impulse).toBeUndefined();
  });

  it('costs one leg per touch, with protected time covering the rest of the touch', () => {
    const touch = run(poleEncounter(), underPole, 3.5, noRegrowCtx);
    expect(typesOf(touch.events, ['hit'])).toEqual(['hit']);
    expect(presentCount(touch.state.legs)).toBe(LEGS.count - 1);
    const next = run(touch.state, underPole, 0.5, noRegrowCtx, 'hit');
    expect(typesOf(next.events, ['hit'])).toEqual(['hit']);
    expect(presentCount(next.state.legs)).toBe(LEGS.count - 2);
  });

  it('hits from the real tip of a roof or floor hazard: below the roof for a stalactite drip, above the floor for a geyser vent (issue #77, ND-3)', () => {
    const drip = movingHazardSpawn('drip-1', STALACTITE_DRIP, POLE_X, -3.2, 120, 300);
    const dripHit = stepEncounter(poleEncounter(drip), { x: POLE_X, y: 360 }, DT, noRegrowCtx);
    expect(dripHit.events[0]).toEqual({ type: 'hit', sourceId: 'drip-1', leg: 0, from: { x: POLE_X, y: 420 } });
    const vent = movingHazardSpawn('vent-1', GEYSER_VENT, POLE_X, -4.0, undefined, 1000);
    const ventHit = stepEncounter(poleEncounter(vent), { x: POLE_X, y: 950 }, DT, noRegrowCtx);
    expect(ventHit.events[0]).toEqual({ type: 'hit', sourceId: 'vent-1', leg: 0, from: { x: POLE_X, y: 1000 - GEYSER_VENT.depth } });
  });

  it('lets the Shell block the first pole hit', () => {
    const result = stepEncounter(poleEncounter(), underPole, DT, shellCtx);
    expect(result.events).toEqual([{ type: 'shellBlock', sourceId: 'pole-1', from: poleTip }]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count);
    expect(result.state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(result.state.shellUsed).toBe(true);
  });

  it('carries the axolotl home on the fourth leg', () => {
    const { state, events } = run(poleEncounter(), underPole, 60, noRegrowCtx, 'carriedHome');
    const hits = events.filter((event) => event.type === 'hit');
    expect(hits.map((event) => event.leg)).toEqual([0, 1, 2, 3]);
    expect(hits.every((event) => event.sourceId === 'pole-1')).toBe(true);
    expect(events[events.length - 1]).toEqual({ type: 'carriedHome' });
    expect(state.tripOver).toBe(true);
    expect(stepEncounter(state, underPole, DT).state).toBe(state);
  });

  it('lands at most one hit per step, a predator first, then a still hazard', () => {
    const target = underPole;
    const lunging = lungingAt(target, createEncounter(zone).legs);
    const withPole: EncounterState = { ...lunging, movingHazards: [heldPole], hazardTime: 0 };
    const predatorFirst = stepEncounter(withPole, target, DT, noRegrowCtx);
    expect(typesOf(predatorFirst.events, ['hit', 'shellBlock'])).toEqual(['hit']);
    expect(predatorFirst.events[0]).toMatchObject({ type: 'hit', sourceId: lunging.predators[0].routeId });
    expect(presentCount(predatorFirst.state.legs)).toBe(LEGS.count - 1);

    const spikeType: HazardType = { id: 'test-spike', name: 'Test spike', costsLeg: true, reach: 0, meetRange: 40, fact: TILAPIA_FACT };
    const spike: HazardSpawn = { id: 'spike', type: spikeType, shape: { kind: 'circle', x: POLE_X, y: 200, r: 20 } };
    const hazardFirst = stepEncounter(poleEncounter(heldPole, { hazards: [spike] }), target, DT, noRegrowCtx);
    expect(typesOf(hazardFirst.events, ['hit', 'shellBlock'])).toEqual(['hit']);
    expect(hazardFirst.events[0]).toMatchObject({ type: 'hit', sourceId: 'spike' });
    expect(presentCount(hazardFirst.state.legs)).toBe(LEGS.count - 1);
  });

  it('is never a bump', () => {
    const { events, impulses } = run(poleEncounter(), underPole, 8, shellCtx);
    expect(typesOf(events, ['bump'])).toEqual([]);
    expect(impulses).toBe(0);
  });
});
