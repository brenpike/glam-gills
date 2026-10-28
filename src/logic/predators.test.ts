import { describe, expect, it } from 'vitest';
import {
  GARTER_SNAKE_FACT,
  GARTER_SNAKE_MEET_RANGE,
  HERON_FACT,
  HERON_MEET_RANGE,
  TILAPIA_FACT,
  TILAPIA_MEET_RANGE,
} from './factCards';
import { routeDistance } from './hiding';
import {
  CARP_SPECIES,
  CRAYFISH_SPECIES,
  GARTER_SNAKE_SPECIES,
  HERON_SPECIES,
  PREDATOR_SPECIES,
  ROUTE_WARN_TOLERANCE,
  TILAPIA_SPECIES,
  createPredator,
  lungeConnects,
  phaseProgress,
  routeLoopDistance,
  stabTip,
  stepPredator,
  type PredatorContext,
  type PredatorEvent,
  type PredatorRoute,
  type PredatorRules,
  type PredatorSpecies,
  type PredatorState,
  type PredatorTuning,
} from './predators';
import { GARTER_SNAKE, HERON, TILAPIA } from './tuning';
import type { Point } from './zone';

const TEST_TUNING: Readonly<PredatorTuning> = Object.freeze({
  minWindup: 0.5,
  windup: 0.3,
  cooldown: 1,
  lungeRange: 100,
  lungeSpeed: 200,
  lungeDuration: 0.5,
  hitRadius: 10,
  contactRadius: 12,
  bodyRadius: 10,
  patrolSpeed: 20,
  bumpSpeed: 50,
  bumpCooldown: 0.5,
});

/** Test-only species whose hook lets it warn only at targets level with or below it. */
const TEST_SPECIES: Readonly<PredatorSpecies> = Object.freeze({
  id: 'testEel',
  name: 'Test eel',
  tuning: TEST_TUNING,
  meetRange: 150,
  fact: { id: 'testEel', name: 'Test eel', title: 'Meet the test eel', body: 'Test only.' },
  hook: { mayWarn: (from: Point, target: Point) => target.y >= from.y },
});

const ROUTE: PredatorRoute = { id: 'test-route', waypoints: [{ x: 1000, y: 200 }], species: TEST_SPECIES };

const CTX: PredatorContext = {
  safeArea: { x0: 0, x1: 200, y0: 100, y1: 300 },
  bounds: { minX: 0, maxX: 2000, minY: 100, maxY: 300 },
  tuning: TEST_SPECIES.tuning,
  hook: TEST_SPECIES.hook,
};

const IN_RANGE: Point = { x: 1100, y: 200 };
const FAR: Point = { x: 1500, y: 200 };
const WINDUP = Math.max(TEST_TUNING.windup, TEST_TUNING.minWindup);

function eventTypes(events: PredatorEvent[]): string[] {
  return events.map((event) => event.type);
}

function spawn(): PredatorState {
  return createPredator(ROUTE, ROUTE.species.id);
}

function warning(target: Point = IN_RANGE): PredatorState {
  const result = stepPredator(spawn(), target, 0.25, CTX);
  expect(eventTypes(result.events)).toEqual(['telegraphStart']);
  return result.state;
}

function striking(aim: Point): PredatorState {
  return { ...spawn(), phase: 'lunge', elapsed: 0, duration: TEST_TUNING.lungeDuration, aim };
}

describe('predator species', () => {
  it('describes the tilapia as the first species', () => {
    expect(TILAPIA_SPECIES.id).toBe('tilapia');
    expect(TILAPIA_SPECIES.name).toBe('Tilapia');
    expect(TILAPIA_SPECIES.tuning).toBe(TILAPIA);
    expect(TILAPIA_SPECIES.meetRange).toBe(TILAPIA_MEET_RANGE);
    expect(TILAPIA_SPECIES.fact).toBe(TILAPIA_FACT);
    expect(TILAPIA_SPECIES.hook).toBeUndefined();
    expect(TILAPIA_SPECIES.neverTouches).toBeUndefined();
    expect(PREDATOR_SPECIES).toEqual([TILAPIA_SPECIES, HERON_SPECIES, CRAYFISH_SPECIES, GARTER_SNAKE_SPECIES, CARP_SPECIES]);
    expect(Object.isFrozen(TILAPIA_SPECIES)).toBe(true);
    expect(Object.isFrozen(PREDATOR_SPECIES)).toBe(true);
  });

  it('describes the garter snake: its own tuning, meet range and fact, warning only on its route, and bumping', () => {
    expect(GARTER_SNAKE_SPECIES).toEqual({
      id: 'garter-snake',
      name: 'Garter snake',
      tuning: GARTER_SNAKE,
      meetRange: GARTER_SNAKE_MEET_RANGE,
      fact: GARTER_SNAKE_FACT,
      rules: { warnOnRoute: true },
    });
    expect(GARTER_SNAKE_SPECIES.tuning).toBe(GARTER_SNAKE);
    expect(GARTER_SNAKE_SPECIES.fact).toBe(GARTER_SNAKE_FACT);
    expect(GARTER_SNAKE_SPECIES.hook).toBeUndefined();
    expect(GARTER_SNAKE_SPECIES.neverTouches).toBeUndefined();
    expect(Object.isFrozen(GARTER_SNAKE_SPECIES)).toBe(true);
    expect(Object.isFrozen(GARTER_SNAKE_SPECIES.rules)).toBe(true);
  });

  it('creates a patrolling predator carrying its species id', () => {
    const predator = spawn();
    expect(predator.species).toBe('testEel');
    expect(predator.routeId).toBe('test-route');
    expect(predator.phase).toBe('patrol');
    expect(predator.pos).toEqual({ x: 1000, y: 200 });
  });

  it('names the route when it has no waypoints', () => {
    expect(() => createPredator({ id: 'bare-route', waypoints: [] }, 'testEel')).toThrow(/bare-route/);
  });
});

describe('predator warning', () => {
  it('starts only when the target is in range (inclusive)', () => {
    expect(eventTypes(stepPredator(spawn(), IN_RANGE, 0.25, CTX).events)).toEqual(['telegraphStart']);
    const beyond = stepPredator(spawn(), { x: 1101, y: 200 }, 0.25, CTX);
    expect(beyond.events).toEqual([]);
    expect(beyond.state.phase).toBe('patrol');
  });

  it('starts only when the target is outside the safe area, whose edges count as inside', () => {
    const nearHome = createPredator({ id: 'near-home', waypoints: [{ x: 260, y: 200 }] }, 'testEel');
    expect(stepPredator(nearHome, { x: 200, y: 200 }, 0.25, CTX).state.phase).toBe('patrol');
    expect(stepPredator(nearHome, { x: 201, y: 200 }, 0.25, CTX).state.phase).toBe('telegraph');
  });

  it('starts only when the species hook allows it', () => {
    const above: Point = { x: 1050, y: 190 };
    const blocked = stepPredator(spawn(), above, 0.25, CTX);
    expect(blocked.events).toEqual([]);
    expect(blocked.state.phase).toBe('patrol');
    const noHook = stepPredator(spawn(), above, 0.25, { ...CTX, hook: undefined });
    expect(eventTypes(noHook.events)).toEqual(['telegraphStart']);
  });

  it('lasts max(windup, minWindup), then strikes', () => {
    const warned = warning();
    expect(warned.duration).toBe(WINDUP);
    expect(warned.elapsed).toBe(0.25);
    expect(phaseProgress(warned)).toBe(0.5);
    const struck = stepPredator(warned, IN_RANGE, 0.25, CTX);
    expect(eventTypes(struck.events)).toEqual(['lungeStart']);
    expect(struck.state.phase).toBe('lunge');
  });

  it('cancels into cooldown when the target is out of range at the end', () => {
    const cancelled = stepPredator(warning(), FAR, 0.25, CTX);
    expect(eventTypes(cancelled.events)).toEqual(['telegraphCancel']);
    expect(cancelled.state.phase).toBe('cooldown');
    expect(cancelled.state.duration).toBe(TEST_TUNING.cooldown);
  });

  it('cancels when the hook refuses at the end', () => {
    const cancelled = stepPredator(warning(), { x: 1050, y: 190 }, 0.25, CTX);
    expect(eventTypes(cancelled.events)).toEqual(['telegraphCancel']);
    expect(cancelled.state.phase).toBe('cooldown');
  });
});

describe('predator strike', () => {
  it('follows the aim locked at strike start, even when the target moves', () => {
    const target: Point = { x: 1060, y: 280 };
    const started = stepPredator(warning(target), target, 0.25, CTX);
    expect(eventTypes(started.events)).toEqual(['lungeStart']);
    expect(started.state.aim?.x).toBeCloseTo(0.6);
    expect(started.state.aim?.y).toBeCloseTo(0.8);
    const moved = stepPredator(started.state, FAR, 0.25, CTX);
    expect(moved.events).toEqual([]);
    expect(moved.state.pos.x).toBeCloseTo(1000 + 0.6 * TEST_TUNING.lungeSpeed * 0.25);
    expect(moved.state.pos.y).toBeCloseTo(200 + 0.8 * TEST_TUNING.lungeSpeed * 0.25);
  });

  it('connects once the target is within hitRadius', () => {
    const target: Point = { x: 1045, y: 200 };
    const short = stepPredator(striking({ x: 1, y: 0 }), target, 0.1, CTX);
    expect(short.events).toEqual([]);
    expect(lungeConnects(short.state, target, TEST_TUNING)).toBe(false);
    const hit = stepPredator(short.state, target, 0.1, CTX);
    expect(hit.events).toEqual([{ type: 'lungeEnd', connected: true }]);
    expect(hit.state.phase).toBe('cooldown');
  });

  it('ends unconnected at lungeDuration', () => {
    const first = stepPredator(striking({ x: 1, y: 0 }), FAR, 0.25, CTX);
    expect(first.events).toEqual([]);
    const ended = stepPredator(first.state, FAR, 0.25, CTX);
    expect(ended.events).toEqual([{ type: 'lungeEnd', connected: false }]);
    expect(ended.state.pos.x).toBeCloseTo(1000 + TEST_TUNING.lungeSpeed * TEST_TUNING.lungeDuration);
    expect(ended.state.phase).toBe('cooldown');
  });
});

describe('predator cooldown', () => {
  it('runs the full cooldown, then emits cooldownEnd and patrols', () => {
    const cooling = stepPredator(striking({ x: 1, y: 0 }), FAR, TEST_TUNING.lungeDuration, CTX).state;
    expect(cooling.phase).toBe('cooldown');
    const partway = stepPredator(cooling, cooling.pos, 0.75, CTX);
    expect(partway.events).toEqual([]);
    expect(partway.state.phase).toBe('cooldown');
    const done = stepPredator(partway.state, partway.state.pos, 0.25, CTX);
    expect(eventTypes(done.events)).toEqual(['cooldownEnd']);
    expect(done.state.phase).toBe('patrol');
    const again = stepPredator(done.state, done.state.pos, 0.25, CTX);
    expect(eventTypes(again.events)).toEqual(['telegraphStart']);
  });

  it('honours telegraphBlocked for a new warning only', () => {
    const blockedCtx: PredatorContext = { ...CTX, telegraphBlocked: true };
    const blocked = stepPredator(spawn(), IN_RANGE, 0.25, blockedCtx);
    expect(blocked.events).toEqual([]);
    expect(blocked.state.phase).toBe('patrol');
    const running = stepPredator(warning(), IN_RANGE, 0.25, blockedCtx);
    expect(eventTypes(running.events)).toEqual(['lungeStart']);
  });
});

/** The heron's stretch: the line of its beak's rest point, which it wades back and forth along. */
const STRETCH_Y = 100;
const HERON_ROUTE: PredatorRoute = {
  id: 'heron-test',
  waypoints: [
    { x: 600, y: STRETCH_Y },
    { x: 800, y: STRETCH_Y },
  ],
  species: HERON_SPECIES,
};
const HERON_CTX: PredatorContext = {
  safeArea: CTX.safeArea,
  bounds: CTX.bounds,
  tuning: HERON_SPECIES.tuning,
  rules: HERON_SPECIES.rules,
};
const HERON_COVERED: PredatorContext = { ...HERON_CTX, targetInCover: true };

/** A binary fraction, so step times add up exactly. */
const HERON_DT = 1 / 64;
const HERON_START: Point = HERON_ROUTE.waypoints[0];
/** About 71 px from where the heron starts: in its reach. */
const IN_REACH: Point = { x: 650, y: STRETCH_Y + 50 };
/** Below the deepest point the heron can reach from anywhere on its stretch. */
const BELOW_REACH: Point = { x: 700, y: STRETCH_Y + HERON.lungeRange + 1 };

interface TimedEvent {
  time: number;
  event: PredatorEvent;
}

interface HeronRun {
  state: PredatorState;
  events: TimedEvent[];
  positions: Point[];
}

function spawnHeron(route: PredatorRoute = HERON_ROUTE): PredatorState {
  return createPredator(route, HERON_SPECIES.id);
}

/**
 * Steps a heron for `seconds` in HERON_DT steps, stopping after a step with an event of type
 * `until`. `targetAt` gets the time at the start of each step; each event is stamped with that time.
 */
function runHeron(
  start: PredatorState,
  targetAt: (time: number) => Point,
  seconds: number,
  ctx: PredatorContext = HERON_CTX,
  until?: PredatorEvent['type'],
): HeronRun {
  let state = start;
  const events: TimedEvent[] = [];
  const positions: Point[] = [];
  for (let i = 0; i < Math.round(seconds / HERON_DT); i++) {
    const time = i * HERON_DT;
    const result = stepPredator(state, targetAt(time), HERON_DT, ctx);
    state = result.state;
    positions.push(state.pos);
    for (const event of result.events) events.push({ time, event });
    if (until && result.events.some((event) => event.type === until)) break;
  }
  return { state, events, positions };
}

function heronEvents(run: HeronRun): PredatorEvent[] {
  return run.events.map((entry) => entry.event);
}

/** A heron at its start whose warning at `target` has just started. */
function heronWarning(target: Point = IN_REACH): PredatorState {
  const result = stepPredator(spawnHeron(), target, HERON_DT, HERON_CTX);
  expect(eventTypes(result.events)).toEqual(['telegraphStart']);
  return result.state;
}

/** A heron whose stab at `target`'s place has just started, with the axolotl still there. */
function heronStab(target: Point = IN_REACH): PredatorState {
  const run = runHeron(heronWarning(target), () => target, HERON.windup + HERON_DT, HERON_CTX, 'lungeStart');
  expect(run.state.phase).toBe('lunge');
  return run.state;
}

describe('heron species', () => {
  it('describes the heron as the second species: a sight hunter that stabs a fixed spot, stands still to cool down and never bumps', () => {
    expect(HERON_SPECIES).toEqual({
      id: 'heron',
      name: 'Heron',
      tuning: HERON,
      meetRange: HERON_MEET_RANGE,
      fact: HERON_FACT,
      rules: { sightCover: true, fixedStrikeSpot: true, stillCooldown: true },
      neverTouches: true,
    });
    expect(HERON_SPECIES.tuning).toBe(HERON);
    expect(HERON_SPECIES.fact).toBe(HERON_FACT);
    expect(HERON_SPECIES.hook).toBeUndefined();
    expect(Object.isFrozen(HERON_SPECIES)).toBe(true);
    expect(Object.isFrozen(HERON_SPECIES.rules)).toBe(true);
  });

  it('warns for 1.2 s above the floor, stabs 110 px in 0.3 s at a Medium reach, cools down for 3 s and wades slowly', () => {
    expect(HERON).toEqual({
      minWindup: 0.8,
      windup: 1.2,
      cooldown: 3,
      lungeRange: 110,
      lungeSpeed: 110 / 0.3,
      lungeDuration: 0.3,
      hitRadius: 26,
      contactRadius: 0,
      bodyRadius: 0,
      patrolSpeed: 20,
      bumpSpeed: 0,
      bumpCooldown: 0.6,
    });
    expect(HERON.windup).toBeGreaterThanOrEqual(HERON.minWindup);
    expect(HERON.windup).toBeGreaterThan(Math.max(TILAPIA.windup, TILAPIA.minWindup));
    expect(HERON.hitRadius).toBe(TILAPIA.hitRadius);
    expect(HERON.patrolSpeed).toBeLessThan(TILAPIA.patrolSpeed);
    expect(HERON.lungeSpeed * HERON.lungeDuration).toBeCloseTo(HERON.lungeRange, 9);
    expect(Object.isFrozen(HERON)).toBe(true);
  });

  it('runs only the shared sight-based phase events', () => {
    const run = runHeron(spawnHeron(), () => IN_REACH, 12);
    expect(new Set(run.events.map((entry) => entry.event.type))).toEqual(
      new Set(['telegraphStart', 'lungeStart', 'lungeEnd', 'cooldownEnd']),
    );
  });
});

describe('route loop distance', () => {
  const triangle: Point[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('includes the wrap segment from the last waypoint back to the first', () => {
    expect(routeLoopDistance({ x: 40, y: 60 }, triangle)).toBeCloseTo(Math.hypot(10, 10), 9);
  });

  it('matches the hiding rules route distance exactly', () => {
    const samples: Point[] = [
      { x: 40, y: 60 },
      { x: -30, y: 20 },
      { x: 150, y: 150 },
      { x: 55.5, y: -12.25 },
      { x: 100, y: 50 },
    ];
    for (const pos of samples) {
      expect(routeLoopDistance(pos, triangle)).toBe(routeDistance(pos, [{ id: 'loop', waypoints: triangle }]));
      expect(routeLoopDistance(pos, HERON_ROUTE.waypoints)).toBe(routeDistance(pos, [HERON_ROUTE]));
    }
  });

  it('gives the distance to a lone waypoint, and Infinity with none', () => {
    expect(routeLoopDistance({ x: 3, y: 4 }, [{ x: 0, y: 0 }])).toBe(5);
    expect(routeLoopDistance({ x: 3, y: 4 }, [])).toBe(Infinity);
  });
});

describe('heron wading', () => {
  it('wades its stretch back and forth at patrolSpeed while the axolotl is out of reach', () => {
    const first = runHeron(spawnHeron(), () => BELOW_REACH, 1);
    expect(first.events).toEqual([]);
    expect(first.state.pos.x).toBeCloseTo(HERON_START.x + HERON.patrolSpeed, 6);
    expect(first.state.pos.y).toBe(STRETCH_Y);
    expect(first.state.facing).toBe(1);
    const stretch = HERON_ROUTE.waypoints[1].x - HERON_START.x;
    const back = runHeron(first.state, () => BELOW_REACH, stretch / HERON.patrolSpeed);
    expect(back.events).toEqual([]);
    expect(back.state.pos.x).toBeCloseTo(HERON_ROUTE.waypoints[1].x - HERON.patrolSpeed, 6);
    expect(back.state.facing).toBe(-1);
    for (const pos of [...first.positions, ...back.positions]) {
      expect(pos.x).toBeGreaterThanOrEqual(HERON_START.x);
      expect(pos.x).toBeLessThanOrEqual(HERON_ROUTE.waypoints[1].x);
    }
  });
});

describe('heron warning on sight', () => {
  it('starts on the first step the axolotl is within reach of where the heron stands (inclusive)', () => {
    const edge: Point = { x: HERON_START.x, y: STRETCH_Y + HERON.lungeRange };
    expect(eventTypes(stepPredator(spawnHeron(), edge, HERON_DT, HERON_CTX).events)).toEqual(['telegraphStart']);
    const beyond = stepPredator(spawnHeron(), { x: edge.x, y: edge.y + 0.5 }, HERON_DT, HERON_CTX);
    expect(beyond.events).toEqual([]);
    expect(beyond.state.phase).toBe('patrol');
  });

  it('measures its reach from where it stands, not from its stretch, so it warns once it wades near enough', () => {
    const ahead: Point = { x: 780, y: STRETCH_Y + 60 };
    expect(routeLoopDistance(ahead, HERON_ROUTE.waypoints)).toBeLessThanOrEqual(HERON.lungeRange);
    const run = runHeron(spawnHeron(), () => ahead, 10, HERON_CTX, 'telegraphStart');
    expect(heronEvents(run)).toEqual([{ type: 'telegraphStart' }]);
    const reachAt = (pos: Point): number => Math.hypot(ahead.x - pos.x, ahead.y - pos.y);
    const [beforeWarning, atWarning] = run.positions.slice(-3, -1);
    expect(run.state.pos).toEqual(atWarning);
    expect(reachAt(atWarning)).toBeLessThanOrEqual(HERON.lungeRange);
    expect(reachAt(beforeWarning)).toBeGreaterThan(HERON.lungeRange);
    expect(run.events[0].time).toBeGreaterThan(1);
  });

  it('never warns at an axolotl below its reach', () => {
    const deep: Point[] = [BELOW_REACH, { x: 700, y: 250 }, { x: 600, y: STRETCH_Y + HERON.lungeRange + 0.5 }];
    for (const target of deep) {
      expect(runHeron(spawnHeron(), () => target, 30).events, `${target.x},${target.y}`).toEqual([]);
    }
  });

  it('never warns at an axolotl in the safe area, edges included', () => {
    const route: PredatorRoute = { ...HERON_ROUTE, waypoints: [{ x: 250, y: STRETCH_Y }, { x: 450, y: STRETCH_Y }] };
    const sheltered: Point = { x: CTX.safeArea.x1, y: STRETCH_Y + 20 };
    expect(runHeron(spawnHeron(route), () => sheltered, 30).events).toEqual([]);
    const exposed: Point = { x: CTX.safeArea.x1 + 1, y: STRETCH_Y + 20 };
    expect(eventTypes(stepPredator(spawnHeron(route), exposed, HERON_DT, HERON_CTX).events)).toEqual(['telegraphStart']);
  });

  it('never warns at an axolotl in cover, and wades on instead', () => {
    const run = runHeron(spawnHeron(), () => IN_REACH, 5, HERON_COVERED);
    expect(run.events).toEqual([]);
    expect(run.state.phase).toBe('patrol');
    expect(run.state.pos.x).toBeGreaterThan(HERON_START.x);
  });

  it('does not start while another predator is warning or striking (A1)', () => {
    const blocked = runHeron(spawnHeron(), () => IN_REACH, 1, { ...HERON_CTX, telegraphBlocked: true });
    expect(blocked.events).toEqual([]);
    expect(blocked.state.phase).toBe('patrol');
  });

  it('stands still for max(windup, minWindup) with its facing following the axolotl, and fixes the strike spot at the start', () => {
    const warned = heronWarning();
    expect(warned.phase).toBe('telegraph');
    expect(warned.duration).toBe(Math.max(HERON.windup, HERON.minWindup));
    expect(warned.strikeSpot).toEqual(IN_REACH);
    expect(warned.pos).toEqual(HERON_START);
    const behind: Point = { x: HERON_START.x - 40, y: IN_REACH.y };
    const held = runHeron(warned, () => behind, 1);
    expect(held.events).toEqual([]);
    expect(held.state.phase).toBe('telegraph');
    expect(held.state.facing).toBe(-1);
    expect(held.state.strikeSpot).toEqual(IN_REACH);
    for (const pos of held.positions) expect(pos).toEqual(HERON_START);
  });
});

describe('heron stab', () => {
  it('stabs the fixed spot from where it stands and hits an axolotl that stayed, once the tip is within hitRadius', () => {
    const warned = heronWarning();
    const stab = runHeron(warned, () => IN_REACH, HERON.windup + HERON.lungeDuration + HERON_DT, HERON_CTX, 'lungeEnd');
    const diagonal = expect.closeTo(Math.SQRT1_2, 9);
    expect(heronEvents(stab)).toEqual([
      { type: 'lungeStart', aim: { x: diagonal, y: diagonal } },
      { type: 'lungeEnd', connected: true },
    ]);
    const [start, end] = stab.events.map((entry) => entry.time);
    expect(end - start).toBeLessThan(HERON.lungeDuration);
    expect(stab.state.phase).toBe('cooldown');
    expect(Object.keys(stab.state)).not.toContain('strikeSpot');
    for (const pos of stab.positions) expect(pos).toEqual(HERON_START);
  });

  it('works out the stab tip in a straight line from where it stands to the spot over 0.3 s', () => {
    const stabbing = heronStab();
    expect(stabbing.duration).toBe(HERON.lungeDuration);
    const halfway = { ...stabbing, elapsed: HERON.lungeDuration / 2 };
    expect(stabTip(halfway).x).toBeCloseTo((HERON_START.x + IN_REACH.x) / 2, 9);
    expect(stabTip(halfway).y).toBeCloseTo((HERON_START.y + IN_REACH.y) / 2, 9);
    expect(stabTip({ ...stabbing, elapsed: HERON.lungeDuration })).toEqual(IN_REACH);
    const tipGap = (elapsed: number): number => {
      const tip = stabTip({ ...stabbing, elapsed });
      return Math.hypot(tip.x - IN_REACH.x, tip.y - IN_REACH.y);
    };
    expect(lungeConnects({ ...stabbing, elapsed: 0 }, IN_REACH, HERON)).toBe(tipGap(0) <= HERON.hitRadius);
    expect(lungeConnects(halfway, IN_REACH, HERON)).toBe(tipGap(HERON.lungeDuration / 2) <= HERON.hitRadius);
  });

  it('misses an axolotl that moved away from the spot during the warning but stayed in reach', () => {
    const moved: Point = { x: HERON_START.x, y: STRETCH_Y + 90 };
    const run = runHeron(heronWarning(), () => moved, HERON.windup + HERON.lungeDuration + HERON_DT, HERON_CTX, 'lungeEnd');
    expect(heronEvents(run).map((event) => event.type)).toEqual(['lungeStart', 'lungeEnd']);
    expect(heronEvents(run)[1]).toEqual({ type: 'lungeEnd', connected: false });
    expect(run.state.phase).toBe('cooldown');
  });

  it('never connects with an axolotl in cover, even at the spot', () => {
    const run = runHeron(heronStab(), () => IN_REACH, HERON.lungeDuration + HERON_DT, HERON_COVERED, 'lungeEnd');
    expect(heronEvents(run)).toEqual([{ type: 'lungeEnd', connected: false }]);
  });

  it('never connects with an axolotl that reached the safe area', () => {
    const route: PredatorRoute = { ...HERON_ROUTE, waypoints: [{ x: 250, y: STRETCH_Y }, { x: 450, y: STRETCH_Y }] };
    const spot: Point = { x: CTX.safeArea.x1 + 1, y: STRETCH_Y + 20 };
    const warned = stepPredator(spawnHeron(route), spot, HERON_DT, HERON_CTX).state;
    const started = runHeron(warned, () => spot, HERON.windup + HERON_DT, HERON_CTX, 'lungeStart');
    expect(started.state.phase).toBe('lunge');
    const home: Point = { x: CTX.safeArea.x1, y: spot.y };
    const ended = runHeron(started.state, () => home, HERON.lungeDuration + HERON_DT, HERON_CTX, 'lungeEnd');
    expect(heronEvents(ended)).toEqual([{ type: 'lungeEnd', connected: false }]);
  });
});

describe('heron cancelled warning and cooldown', () => {
  it('cancels into the 3 s cooldown when the axolotl hides in cover before the warning ends', () => {
    const run = runHeron(heronWarning(), () => IN_REACH, HERON.windup + HERON_DT, HERON_COVERED, 'telegraphCancel');
    expect(heronEvents(run)).toEqual([{ type: 'telegraphCancel' }]);
    expect(run.state.phase).toBe('cooldown');
    expect(run.state.duration).toBe(HERON.cooldown);
    expect(Object.keys(run.state)).not.toContain('strikeSpot');
  });

  it('cancels into the 3 s cooldown when the axolotl swims out of reach before the warning ends', () => {
    const run = runHeron(heronWarning(), () => BELOW_REACH, HERON.windup + HERON_DT, HERON_CTX, 'telegraphCancel');
    expect(heronEvents(run)).toEqual([{ type: 'telegraphCancel' }]);
    expect(run.state.phase).toBe('cooldown');
    expect(run.state.duration).toBe(HERON.cooldown);
  });

  it('stands still facing the axolotl for the 3 s cooldown, then wades on', () => {
    const cancelled = runHeron(heronWarning(), () => BELOW_REACH, HERON.windup + HERON_DT, HERON_CTX, 'telegraphCancel').state;
    const behind: Point = { x: HERON_START.x - 300, y: 300 };
    const cooling = runHeron(cancelled, () => behind, HERON.cooldown - 0.25);
    expect(cooling.events).toEqual([]);
    expect(cooling.state.phase).toBe('cooldown');
    expect(cooling.state.facing).toBe(-1);
    for (const pos of cooling.positions) expect(pos).toEqual(HERON_START);
    const done = runHeron(cooling.state, () => behind, 0.5, HERON_CTX, 'cooldownEnd');
    expect(heronEvents(done)).toEqual([{ type: 'cooldownEnd' }]);
    expect(done.state.phase).toBe('patrol');
    const wading = runHeron(done.state, () => behind, 1);
    expect(wading.events).toEqual([]);
    expect(wading.state.pos.x).toBeGreaterThan(HERON_START.x);
  });

  it('cools down for 3 s after a stab, hit or miss, before it can warn again', () => {
    const run = runHeron(spawnHeron(), () => IN_REACH, 8);
    const ends = run.events.filter((entry) => entry.event.type === 'lungeEnd').map((entry) => entry.time);
    const starts = run.events.filter((entry) => entry.event.type === 'telegraphStart').map((entry) => entry.time);
    expect(starts.length).toBeGreaterThanOrEqual(2);
    expect(starts[1] - ends[0]).toBeGreaterThanOrEqual(HERON.cooldown - HERON_DT);
    expect(starts[1] - ends[0]).toBeLessThanOrEqual(HERON.cooldown + HERON_DT);
  });
});

describe('heron pause', () => {
  it('freezes in every phase on zero, negative or non-finite dt', () => {
    const states: PredatorState[] = [
      runHeron(spawnHeron(), () => BELOW_REACH, 1).state,
      heronWarning(),
      heronStab(),
      runHeron(heronWarning(), () => BELOW_REACH, HERON.windup + HERON_DT, HERON_CTX, 'telegraphCancel').state,
    ];
    expect(states.map((state) => state.phase)).toEqual(['patrol', 'telegraph', 'lunge', 'cooldown']);
    for (const state of states) {
      for (const dt of [0, -0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const frozen = stepPredator(state, IN_REACH, dt, HERON_CTX);
        expect(frozen.state).toBe(state);
        expect(frozen.events).toEqual([]);
      }
    }
  });
});

const STALKER_RULES: Readonly<PredatorRules> = Object.freeze({
  sightCover: true,
  fixedStrikeSpot: true,
  stillCooldown: true,
});

/** Test-only species with every shared rule: it hunts by sight, stabs a fixed spot and stands still in cooldown. */
const STALKER_SPECIES: Readonly<PredatorSpecies> = Object.freeze({
  id: 'testStalker',
  name: 'Test stalker',
  tuning: TEST_TUNING,
  meetRange: 150,
  fact: { id: 'testStalker', name: 'Test stalker', title: 'Meet the test stalker', body: 'Test only.' },
  rules: STALKER_RULES,
});

const STALKER_ROUTE: PredatorRoute = {
  id: 'stalker-route',
  waypoints: [
    { x: 1000, y: 200 },
    { x: 1200, y: 200 },
  ],
  species: STALKER_SPECIES,
};

const STALKER_CTX: PredatorContext = {
  safeArea: CTX.safeArea,
  bounds: CTX.bounds,
  tuning: STALKER_SPECIES.tuning,
  rules: STALKER_SPECIES.rules,
};
const STALKER_COVERED: PredatorContext = { ...STALKER_CTX, targetInCover: true };

/** A binary fraction, so step times add up exactly. */
const STALKER_DT = 1 / 64;
const SPOT: Point = { x: 1060, y: 200 };

interface StalkerRun {
  state: PredatorState;
  events: PredatorEvent[];
  positions: Point[];
}

function spawnStalker(): PredatorState {
  return createPredator(STALKER_ROUTE, STALKER_SPECIES.id);
}

/** Steps a predator for `seconds` in STALKER_DT steps, stopping after a step with an event of type `until`. */
function runStalker(
  start: PredatorState,
  target: Point,
  seconds: number,
  ctx: PredatorContext = STALKER_CTX,
  until?: PredatorEvent['type'],
): StalkerRun {
  let state = start;
  const events: PredatorEvent[] = [];
  const positions: Point[] = [];
  for (let i = 0; i < Math.round(seconds / STALKER_DT); i++) {
    const result = stepPredator(state, target, STALKER_DT, ctx);
    state = result.state;
    events.push(...result.events);
    positions.push(state.pos);
    if (until && result.events.some((event) => event.type === until)) break;
  }
  return { state, events, positions };
}

function stalkerWarning(target: Point = SPOT): PredatorState {
  const result = stepPredator(spawnStalker(), target, STALKER_DT, STALKER_CTX);
  expect(eventTypes(result.events)).toEqual(['telegraphStart']);
  return result.state;
}

describe('shared rule: sight cover', () => {
  it('does not warn at a target in cover, and a species without the rule ignores cover', () => {
    const hidden = stepPredator(spawnStalker(), SPOT, STALKER_DT, STALKER_COVERED);
    expect(hidden.events).toEqual([]);
    expect(hidden.state.phase).toBe('patrol');
    expect(eventTypes(stepPredator(spawnStalker(), SPOT, STALKER_DT, STALKER_CTX).events)).toEqual(['telegraphStart']);
    const noRule = stepPredator(spawn(), IN_RANGE, 0.25, { ...CTX, targetInCover: true });
    expect(eventTypes(noRule.events)).toEqual(['telegraphStart']);
  });

  it('cancels a warning whose target is in cover at the end-of-warning re-check', () => {
    const cancelled = runStalker(stalkerWarning(), SPOT, WINDUP, STALKER_COVERED, 'telegraphCancel');
    expect(eventTypes(cancelled.events)).toEqual(['telegraphCancel']);
    expect(cancelled.state.phase).toBe('cooldown');
    expect(cancelled.state.duration).toBe(TEST_TUNING.cooldown);
    expect(Object.keys(cancelled.state)).not.toContain('strikeSpot');
  });

  it('only re-checks cover at the end of the warning', () => {
    const half = runStalker(stalkerWarning(), SPOT, WINDUP / 2, STALKER_COVERED);
    expect(half.events).toEqual([]);
    const struck = runStalker(half.state, SPOT, WINDUP, STALKER_CTX, 'lungeStart');
    expect(eventTypes(struck.events)).toEqual(['lungeStart']);
  });

  it('never connects a strike with a target in cover, even at the spot', () => {
    const struck = runStalker(stalkerWarning(), SPOT, WINDUP, STALKER_CTX, 'lungeStart');
    const stab = runStalker(struck.state, SPOT, TEST_TUNING.lungeDuration * 2, STALKER_COVERED, 'lungeEnd');
    expect(stab.events).toEqual([{ type: 'lungeEnd', connected: false }]);
    expect(stab.positions).toHaveLength(Math.round(TEST_TUNING.lungeDuration / STALKER_DT));
  });
});

describe('shared rule: fixed strike spot and stab', () => {
  it('fixes the strike spot at warning start and stabs it from where it stands, missing a target that moved', () => {
    const warned = stalkerWarning();
    expect(warned.strikeSpot).toEqual(SPOT);
    expect(warned.pos).toEqual({ x: 1000, y: 200 });
    const moved: Point = { x: 1040, y: 260 };
    const struck = runStalker(warned, moved, WINDUP, STALKER_CTX, 'lungeStart');
    expect(struck.events).toEqual([{ type: 'lungeStart', aim: { x: 1, y: 0 } }]);
    expect(struck.state.strikeSpot).toEqual(SPOT);
    const stab = runStalker(struck.state, moved, TEST_TUNING.lungeDuration * 2, STALKER_CTX, 'lungeEnd');
    expect(stab.events).toEqual([{ type: 'lungeEnd', connected: false }]);
    expect(stab.state.phase).toBe('cooldown');
    expect(Object.keys(stab.state)).not.toContain('strikeSpot');
    for (const pos of [...struck.positions, ...stab.positions]) expect(pos).toEqual({ x: 1000, y: 200 });
  });

  it('connects once the stab tip comes within hitRadius of a target that stayed at the spot', () => {
    const struck = runStalker(stalkerWarning(), SPOT, WINDUP, STALKER_CTX, 'lungeStart');
    let state = struck.state;
    let events: PredatorEvent[] = [];
    while (events.length === 0) {
      const result = stepPredator(state, SPOT, STALKER_DT, STALKER_CTX);
      events = result.events;
      if (events.length === 0) {
        expect(lungeConnects(result.state, SPOT, TEST_TUNING)).toBe(false);
        state = result.state;
      }
    }
    expect(events).toEqual([{ type: 'lungeEnd', connected: true }]);
    const tipGap = Math.hypot(SPOT.x - 1000, SPOT.y - 200) * (1 - (state.elapsed + STALKER_DT) / TEST_TUNING.lungeDuration);
    expect(tipGap).toBeLessThanOrEqual(TEST_TUNING.hitRadius);
    expect(state.elapsed + STALKER_DT).toBeLessThan(TEST_TUNING.lungeDuration);
  });

  it('works out the stab tip from the state alone, in a straight line over the strike', () => {
    const lunging: PredatorState = {
      ...spawnStalker(),
      phase: 'lunge',
      elapsed: 0.25,
      duration: 0.5,
      aim: { x: 0.6, y: 0.8 },
      strikeSpot: { x: 1060, y: 280 },
    };
    expect(stabTip(lunging)).toEqual({ x: 1030, y: 240 });
    expect(stabTip({ ...lunging, elapsed: 0 })).toEqual({ x: 1000, y: 200 });
    expect(stabTip({ ...lunging, elapsed: 0.5 })).toEqual({ x: 1060, y: 280 });
    expect(stabTip({ ...lunging, elapsed: 0.75 })).toEqual({ x: 1060, y: 280 });
    expect(stabTip({ ...lunging, elapsed: 0, duration: 0 })).toEqual({ x: 1060, y: 280 });
    expect(stabTip({ ...lunging, phase: 'telegraph' })).toEqual({ x: 1000, y: 200 });
    expect(stabTip(striking({ x: 1, y: 0 }))).toEqual({ x: 1000, y: 200 });
    expect(lungeConnects({ ...lunging, elapsed: 0.5 }, { x: 1060, y: 280 }, TEST_TUNING)).toBe(true);
    expect(lungeConnects(lunging, { x: 1060, y: 280 }, TEST_TUNING)).toBe(false);
  });

  it('never gives a predator without the rule a strike spot', () => {
    let state = spawn();
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      state = stepPredator(state, IN_RANGE, 0.1, CTX).state;
      seen.add(state.phase);
      expect(Object.keys(state)).not.toContain('strikeSpot');
    }
    expect([...seen].sort()).toEqual(['cooldown', 'lunge', 'telegraph']);
  });
});

describe('shared rule: still cooldown', () => {
  const cooling: PredatorState = { ...spawnStalker(), phase: 'cooldown', elapsed: 0, duration: TEST_TUNING.cooldown };

  it('stands still facing the target through the cooldown, then patrols again', () => {
    const left: Point = { x: 900, y: 200 };
    const partway = runStalker(cooling, left, TEST_TUNING.cooldown / 2);
    expect(partway.events).toEqual([]);
    expect(partway.state.facing).toBe(-1);
    for (const pos of partway.positions) expect(pos).toEqual({ x: 1000, y: 200 });
    const done = runStalker(partway.state, FAR, TEST_TUNING.cooldown, STALKER_CTX, 'cooldownEnd');
    expect(eventTypes(done.events)).toEqual(['cooldownEnd']);
    expect(done.state.facing).toBe(1);
    const wading = runStalker(done.state, FAR, 0.5);
    expect(wading.state.phase).toBe('patrol');
    expect(wading.state.pos.x).toBeGreaterThan(1000);
  });

  it('swims its route through the cooldown without the rule', () => {
    const swimming = runStalker(cooling, FAR, TEST_TUNING.cooldown / 2, { ...STALKER_CTX, rules: { fixedStrikeSpot: true } });
    expect(swimming.state.phase).toBe('cooldown');
    expect(swimming.state.pos.x).toBeGreaterThan(1000);
  });
});

/** Test-only species with only the warn-on-route rule. */
const LINER_SPECIES: Readonly<PredatorSpecies> = Object.freeze({
  id: 'testLiner',
  name: 'Test liner',
  tuning: TEST_TUNING,
  meetRange: 150,
  fact: { id: 'testLiner', name: 'Test liner', title: 'Meet the test liner', body: 'Test only.' },
  rules: Object.freeze({ warnOnRoute: true }),
});

const LINE_Y = 200;
const LINER_ROUTE: PredatorRoute = {
  id: 'liner-route',
  waypoints: [
    { x: 1000, y: LINE_Y },
    { x: 1200, y: LINE_Y },
  ],
  species: LINER_SPECIES,
};

const LINER_CTX: PredatorContext = {
  safeArea: CTX.safeArea,
  bounds: CTX.bounds,
  tuning: LINER_SPECIES.tuning,
  rules: LINER_SPECIES.rules,
};
const NO_RULE_CTX: PredatorContext = { ...LINER_CTX, rules: undefined };

/** A patrolling liner heading for its second waypoint, at `pos`. */
function linerAt(pos: Point): PredatorState {
  return { ...createPredator(LINER_ROUTE, LINER_SPECIES.id), pos };
}

/** A liner warning at `pos`, its warning about to end. */
function linerWarningAt(pos: Point): PredatorState {
  return { ...linerAt(pos), phase: 'telegraph', elapsed: WINDUP - STALKER_DT, duration: WINDUP };
}

describe('shared rule: warn on route', () => {
  const onLine: Point = { x: 1100, y: LINE_Y };
  const offLine: Point = { x: 1100, y: LINE_Y + ROUTE_WARN_TOLERANCE + 0.5 };
  const atTolerance: Point = { x: 1100, y: LINE_Y + ROUTE_WARN_TOLERANCE };
  const below: Point = { x: 1100, y: 250 };

  it('warns while on its route', () => {
    expect(eventTypes(stepPredator(linerAt(LINER_ROUTE.waypoints[0]), { x: 1060, y: LINE_Y }, STALKER_DT, LINER_CTX).events)).toEqual([
      'telegraphStart',
    ]);
    expect(eventTypes(stepPredator(linerAt(onLine), below, STALKER_DT, LINER_CTX).events)).toEqual(['telegraphStart']);
  });

  it('keeps patrolling with no events when off its route by more than the tolerance, with the target in range', () => {
    expect(routeLoopDistance(offLine, LINER_ROUTE.waypoints)).toBeGreaterThan(ROUTE_WARN_TOLERANCE);
    const run = runStalker(linerAt(offLine), below, 0.25, LINER_CTX);
    expect(run.events).toEqual([]);
    expect(run.state.phase).toBe('patrol');
    expect(run.state.pos.x).toBeGreaterThan(offLine.x);
  });

  it('counts a predator exactly at the tolerance as on its route (inclusive)', () => {
    expect(routeLoopDistance(atTolerance, LINER_ROUTE.waypoints)).toBe(ROUTE_WARN_TOLERANCE);
    expect(eventTypes(stepPredator(linerAt(atTolerance), below, STALKER_DT, LINER_CTX).events)).toEqual(['telegraphStart']);
  });

  it('cancels a warning off its route at the end-of-warning re-check, and strikes from on its route', () => {
    const cancelled = stepPredator(linerWarningAt(offLine), below, STALKER_DT, LINER_CTX);
    expect(eventTypes(cancelled.events)).toEqual(['telegraphCancel']);
    expect(cancelled.state.phase).toBe('cooldown');
    expect(cancelled.state.duration).toBe(TEST_TUNING.cooldown);
    const midway = stepPredator({ ...linerWarningAt(offLine), elapsed: 0 }, below, STALKER_DT, LINER_CTX);
    expect(midway.events).toEqual([]);
    expect(midway.state.phase).toBe('telegraph');
    expect(eventTypes(stepPredator(linerWarningAt(atTolerance), below, STALKER_DT, LINER_CTX).events)).toEqual(['lungeStart']);
  });

  it('leaves a species without the rule warning off its route', () => {
    expect(eventTypes(stepPredator(linerAt(offLine), below, STALKER_DT, NO_RULE_CTX).events)).toEqual(['telegraphStart']);
    const ruleOff: PredatorContext = { ...LINER_CTX, rules: { warnOnRoute: false } };
    expect(eventTypes(stepPredator(linerAt(offLine), below, STALKER_DT, ruleOff).events)).toEqual(['telegraphStart']);
    expect(eventTypes(stepPredator(linerWarningAt(offLine), below, STALKER_DT, NO_RULE_CTX).events)).toEqual(['lungeStart']);
  });

  it('cannot warn after a strike leaves it off its line until it swims back within the tolerance', () => {
    const struck: PredatorState = {
      ...linerAt(LINER_ROUTE.waypoints[0]),
      phase: 'lunge',
      elapsed: 0,
      duration: TEST_TUNING.lungeDuration,
      aim: { x: 0, y: 1 },
    };
    const above = (state: PredatorState): Point => ({ x: state.pos.x, y: state.pos.y - 40 });
    let state = struck;
    let blockedPatrolSteps = 0;
    let warnedFrom: Point | null = null;
    for (let i = 0; i < Math.round(20 / STALKER_DT) && warnedFrom === null; i++) {
      const result = stepPredator(state, above(state), STALKER_DT, LINER_CTX);
      if (eventTypes(result.events).includes('telegraphStart')) warnedFrom = result.state.pos;
      else if (state.phase === 'patrol') blockedPatrolSteps++;
      state = result.state;
    }
    expect(warnedFrom).not.toBeNull();
    expect(routeLoopDistance(warnedFrom ?? struck.pos, LINER_ROUTE.waypoints)).toBeLessThanOrEqual(ROUTE_WARN_TOLERANCE);
    expect(blockedPatrolSteps * STALKER_DT).toBeGreaterThan(1);
    const seconds = TEST_TUNING.lungeDuration + TEST_TUNING.cooldown + 0.25;
    const noRule = runStalker(struck, { x: 1000, y: 260 }, seconds, NO_RULE_CTX, 'telegraphStart');
    expect(eventTypes(noRule.events)).toEqual(['lungeEnd', 'cooldownEnd', 'telegraphStart']);
    expect(routeLoopDistance(noRule.state.pos, LINER_ROUTE.waypoints)).toBeGreaterThan(ROUTE_WARN_TOLERANCE);
  });
});

/** Test-only species with only the level strike rule (issue #77, ND-5). */
const LEVELLER_RULES: Readonly<PredatorRules> = Object.freeze({ levelStrike: true });
const LEVELLER_CTX: PredatorContext = { ...LINER_CTX, rules: LEVELLER_RULES };
const STRIKE_REACH = TEST_TUNING.lungeSpeed * TEST_TUNING.lungeDuration;

describe('shared rule: level strike', () => {
  const start: Point = { x: 1100, y: LINE_Y };

  it('locks a level aim toward the side of the target at the end of the warning', () => {
    const right = stepPredator(linerWarningAt(start), { x: 1160, y: 260 }, STALKER_DT, LEVELLER_CTX);
    expect(right.events).toEqual([{ type: 'lungeStart', aim: { x: 1, y: 0 } }]);
    const left = stepPredator(linerWarningAt(start), { x: 1050, y: 130 }, STALKER_DT, LEVELLER_CTX);
    expect(left.events).toEqual([{ type: 'lungeStart', aim: { x: -1, y: 0 } }]);
    expect(left.state.facing).toBe(-1);
  });

  it('aims along its facing at a target straight above or below', () => {
    const facingLeft: PredatorState = { ...linerWarningAt(start), facing: -1 };
    expect(stepPredator(facingLeft, { x: start.x, y: 260 }, STALKER_DT, LEVELLER_CTX).events).toEqual([
      { type: 'lungeStart', aim: { x: -1, y: 0 } },
    ]);
    expect(stepPredator(linerWarningAt(start), { x: start.x, y: 140 }, STALKER_DT, LEVELLER_CTX).events).toEqual([
      { type: 'lungeStart', aim: { x: 1, y: 0 } },
    ]);
  });

  it('strikes at its own height and connects only with a target within hitRadius of it', () => {
    const struck = runStalker(linerWarningAt(start), { x: 1160, y: 260 }, 1, LEVELLER_CTX, 'lungeEnd');
    expect(eventTypes(struck.events)).toEqual(['lungeStart', 'lungeEnd']);
    for (const pos of struck.positions) expect(pos.y).toBe(LINE_Y);
    expect(struck.state.pos.x).toBeCloseTo(start.x + STRIKE_REACH, 6);
    const within = runStalker(linerWarningAt(start), { x: 1150, y: LINE_Y + TEST_TUNING.hitRadius }, 1, LEVELLER_CTX, 'lungeEnd');
    expect(within.events.at(-1)).toEqual({ type: 'lungeEnd', connected: true });
    const beyond = runStalker(linerWarningAt(start), { x: 1150, y: LINE_Y + TEST_TUNING.hitRadius + 0.5 }, 1, LEVELLER_CTX, 'lungeEnd');
    expect(beyond.events.at(-1)).toEqual({ type: 'lungeEnd', connected: false });
  });

  it('aims level toward the side of the strike spot with the fixed strike spot rule', () => {
    const ctx: PredatorContext = { ...LEVELLER_CTX, rules: { fixedStrikeSpot: true, levelStrike: true } };
    const spotted: PredatorState = { ...linerWarningAt(start), strikeSpot: { x: 1040, y: 250 } };
    expect(stepPredator(spotted, { x: 1160, y: 250 }, STALKER_DT, ctx).events).toEqual([{ type: 'lungeStart', aim: { x: -1, y: 0 } }]);
  });

  it('leaves a species without the rule aiming straight at the target', () => {
    const aimed = stepPredator(linerWarningAt(start), { x: 1160, y: 280 }, STALKER_DT, NO_RULE_CTX);
    expect(aimed.events).toEqual([{ type: 'lungeStart', aim: { x: expect.closeTo(0.6, 9), y: expect.closeTo(0.8, 9) } }]);
    const ruleOff = stepPredator(linerWarningAt(start), { x: 1160, y: 280 }, STALKER_DT, { ...LEVELLER_CTX, rules: { levelStrike: false } });
    expect(ruleOff.events).toEqual(aimed.events);
  });
});
