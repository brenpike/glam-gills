import { describe, expect, it } from 'vitest';
import {
  createEncounter,
  createEncounterContext,
  predatorSpecies,
  stepEncounter,
  type EncounterEvent,
  type EncounterSource,
  type EncounterState,
} from './encounter';
import { CRAYFISH_FACT, CRAYFISH_MEET_RANGE } from './factCards';
import { legSwimTuning, presentCount } from './legs';
import {
  CRAYFISH_SPECIES,
  PREDATOR_SPECIES,
  ROUTE_WARN_TOLERANCE,
  createPredator,
  routeLoopDistance,
  stepPredator,
  touching,
  tunedSpecies,
  type PredatorContext,
  type PredatorEvent,
  type PredatorRoute,
  type PredatorSpecies,
  type PredatorState,
} from './predators';
import { stepSwim, type SwimEnv, type SwimState } from './swimPhysics';
import { CRAYFISH, CRAYFISH_CHASE, LEGS, TILAPIA, type SwimTuning } from './tuning';
import { buildCanalZone, inSafeArea, swimBounds, type Point, type TilapiaRoute } from './zone';

const DT = 1 / 60;
const zone = buildCanalZone();
const BOUNDS = swimBounds();

/** The crayfish's floor stretch: the line it walks back and forth along on the bottom. */
const FLOOR_Y = BOUNDS.maxY;
const CRAYFISH_ROUTE: PredatorRoute = {
  id: 'crayfish-test',
  waypoints: [
    { x: 1000, y: FLOOR_Y },
    { x: 1300, y: FLOOR_Y },
  ],
  species: CRAYFISH_SPECIES,
};
const CRAYFISH_START: Point = CRAYFISH_ROUTE.waypoints[0];

/** The crayfish played with its chase along the stretch (issue #77, ND-5). */
const CHASING_CRAYFISH: Readonly<PredatorSpecies> = tunedSpecies(
  CRAYFISH_SPECIES,
  Object.freeze({ ...CRAYFISH, chase: CRAYFISH_CHASE }),
);
const CHASING_ROUTE: PredatorRoute = { ...CRAYFISH_ROUTE, species: CHASING_CRAYFISH };

const FAR: Point = { x: 1700, y: FLOOR_Y - 300 };
const PINCH = CRAYFISH.lungeSpeed * CRAYFISH.lungeDuration;
/** The highest a warned axolotl can be: the crayfish's reach above its stretch. */
const MID_WATER_Y = FLOOR_Y - CRAYFISH.lungeRange;
/** Allowed rounding error when comparing positions and aims. */
const EPSILON = 1e-6;

interface Sample {
  crayfish: Point;
  target: Point;
}

interface CrayfishRun {
  state: PredatorState;
  events: PredatorEvent[];
  positions: Point[];
  warnings: Sample[];
  hits: Sample[];
  touches: Sample[];
}

function contextFor(species: Readonly<PredatorSpecies>): PredatorContext {
  return { safeArea: zone.safeArea, bounds: BOUNDS, tuning: species.tuning, rules: species.rules };
}

const CRAYFISH_CTX = contextFor(CRAYFISH_SPECIES);
const CHASING_CTX = contextFor(CHASING_CRAYFISH);

function spawnCrayfish(route: PredatorRoute = CRAYFISH_ROUTE): PredatorState {
  return createPredator(route, route.species.id);
}

/**
 * Steps a crayfish for `seconds` in DT steps, stopping after a step with an event of type `until`.
 * `targetAt` gets the state and time at the start of each step. Records where each warning started,
 * each connected pinch and each touch, with the target of that step.
 */
function runCrayfish(
  start: PredatorState,
  targetAt: (state: PredatorState, time: number) => Point,
  seconds: number,
  ctx: PredatorContext = CRAYFISH_CTX,
  until?: PredatorEvent['type'],
): CrayfishRun {
  const run: CrayfishRun = { state: start, events: [], positions: [], warnings: [], hits: [], touches: [] };
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const target = targetAt(run.state, i * DT);
    const result = stepPredator(run.state, target, DT, ctx);
    run.state = result.state;
    run.events.push(...result.events);
    run.positions.push(result.state.pos);
    recordSamples(run, result.events, target, ctx);
    if (until && result.events.some((event) => event.type === until)) break;
  }
  return run;
}

function recordSamples(run: CrayfishRun, events: PredatorEvent[], target: Point, ctx: PredatorContext): void {
  const sample: Sample = { crayfish: run.state.pos, target };
  for (const event of events) {
    if (event.type === 'telegraphStart') run.warnings.push(sample);
    if (event.type === 'lungeEnd' && event.connected) run.hits.push(sample);
  }
  if (touching(run.state, target, ctx.tuning)) run.touches.push(sample);
}

function stillAt(target: Point): () => Point {
  return () => target;
}

function typesOf(events: readonly { type: string }[]): string[] {
  return events.map((event) => event.type);
}

/** A crayfish at its start whose warning at `target` has just started. */
function crayfishWarning(target: Point, ctx: PredatorContext = CRAYFISH_CTX): PredatorState {
  const result = stepPredator(spawnCrayfish(), target, DT, ctx);
  expect(typesOf(result.events)).toEqual(['telegraphStart']);
  return result.state;
}

/** A crayfish at `pos` whose pinch along `aim` has just started. */
function crayfishPinch(pos: Point, aim: Point): PredatorState {
  return { ...spawnCrayfish(), pos: { ...pos }, phase: 'lunge', elapsed: 0, duration: CRAYFISH.lungeDuration, aim };
}

/** A position moving back and forth between `from` and `to` at `speed` px/s. */
function pingPong(time: number, from: number, to: number, speed: number): number {
  const span = to - from;
  const travelled = (time * speed) % (2 * span);
  return from + (travelled <= span ? travelled : 2 * span - travelled);
}

/** The unit vector from `from` toward `to`. */
function directionTo(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/**
 * Checks that every warning on a run started from on the stretch, at a target within 90 px of the
 * crayfish, and that a pinch never carried the crayfish farther than one pinch from its stretch.
 */
function expectWarnsFromStretch(run: CrayfishRun): void {
  for (const pos of run.positions) {
    expect(routeLoopDistance(pos, CRAYFISH_ROUTE.waypoints)).toBeLessThanOrEqual(PINCH + EPSILON);
  }
  for (const { crayfish, target } of run.warnings) {
    expect(routeLoopDistance(crayfish, CRAYFISH_ROUTE.waypoints)).toBeLessThanOrEqual(ROUTE_WARN_TOLERANCE);
    expect(Math.hypot(target.x - crayfish.x, target.y - crayfish.y)).toBeLessThanOrEqual(CRAYFISH.lungeRange);
    expect(target.y).toBeGreaterThanOrEqual(MID_WATER_Y - ROUTE_WARN_TOLERANCE);
  }
}

describe('crayfish tuning and species (issue #77, ND-5)', () => {
  it('warns for 0.8 s, reaches 90 px, pinches 400 px/s for 0.3 s, cools down for 1.8 s and patrols at 60 px/s', () => {
    expect(CRAYFISH).toEqual({
      minWindup: 0.8,
      windup: 0.8,
      cooldown: 1.8,
      lungeRange: 90,
      lungeSpeed: 400,
      lungeDuration: 0.3,
      hitRadius: 26,
      contactRadius: TILAPIA.contactRadius,
      bodyRadius: TILAPIA.bodyRadius,
      patrolSpeed: 60,
      bumpSpeed: TILAPIA.bumpSpeed,
      bumpCooldown: TILAPIA.bumpCooldown,
    });
    expect(CRAYFISH.hitRadius).toBe(TILAPIA.hitRadius);
    expect(Math.max(CRAYFISH.windup, CRAYFISH.minWindup)).toBe(0.8);
    expect(PINCH).toBeCloseTo(120, 9);
    expect(CRAYFISH.chase).toBeUndefined();
    expect(Object.isFrozen(CRAYFISH)).toBe(true);
  });

  it('has a chase along its stretch only: sight 200, leash 0 and speed 120', () => {
    expect(CRAYFISH_CHASE).toEqual({ sight: 200, leash: 0, speed: 120 });
    expect(Object.isFrozen(CRAYFISH_CHASE)).toBe(true);
    expect(CHASING_CRAYFISH.tuning.chase).toBe(CRAYFISH_CHASE);
    expect(CHASING_CRAYFISH.rules).toBe(CRAYFISH_SPECIES.rules);
  });

  it('is the species crayfish, Crayfish, warning only on its route with an aimed pinch', () => {
    expect(CRAYFISH_SPECIES).toEqual({
      id: 'crayfish',
      name: 'Crayfish',
      tuning: CRAYFISH,
      meetRange: CRAYFISH_MEET_RANGE,
      fact: CRAYFISH_FACT,
      rules: { warnOnRoute: true },
    });
    expect(CRAYFISH_SPECIES.tuning).toBe(CRAYFISH);
    expect(CRAYFISH_SPECIES.fact).toBe(CRAYFISH_FACT);
    expect(CRAYFISH_SPECIES.meetRange).toBe(180);
    expect(CRAYFISH_SPECIES.hook).toBeUndefined();
    expect(CRAYFISH_SPECIES.neverTouches).toBeUndefined();
    expect(CRAYFISH_SPECIES.dangerPart).toBeUndefined();
    expect(Object.isFrozen(CRAYFISH_SPECIES)).toBe(true);
    expect(Object.isFrozen(CRAYFISH_SPECIES.rules)).toBe(true);
    expect(CRAYFISH_SPECIES.rules?.levelStrike).toBeUndefined();
    expect(PREDATOR_SPECIES).toContain(CRAYFISH_SPECIES);
  });

  it('plays its own species in the encounter', () => {
    const state = createEncounter({ ...zone, tilapiaRoutes: [], predatorRoutes: [CRAYFISH_ROUTE] });
    expect(state.predators.map((predator) => [predator.routeId, predator.species])).toEqual([['crayfish-test', 'crayfish']]);
    expect(predatorSpecies(state, state.predators[0])).toBe(CRAYFISH_SPECIES);
  });
});

describe('crayfish warning', () => {
  it('warns by distance, inclusive at 90 px, and holds still for 0.8 s before it pinches', () => {
    const above: Point = { x: CRAYFISH_START.x, y: FLOOR_Y - CRAYFISH.lungeRange };
    const diagonal: Point = { x: CRAYFISH_START.x + 54, y: FLOOR_Y - 72 };
    for (const edge of [above, diagonal]) {
      expect(typesOf(stepPredator(spawnCrayfish(), edge, DT, CRAYFISH_CTX).events)).toEqual(['telegraphStart']);
    }
    const beyond = stepPredator(spawnCrayfish(), { x: above.x, y: above.y - 0.5 }, DT, CRAYFISH_CTX);
    expect(beyond.events).toEqual([]);
    expect(beyond.state.phase).toBe('patrol');
    const warned = crayfishWarning(diagonal);
    expect(warned.duration).toBe(0.8);
    const held = runCrayfish(warned, stillAt(diagonal), 2, CRAYFISH_CTX, 'lungeStart');
    expect(typesOf(held.events)).toEqual(['lungeStart']);
    expect((held.positions.length + 1) * DT).toBeCloseTo(0.8, 6);
    for (const pos of held.positions.slice(0, -1)) expect(pos).toEqual(CRAYFISH_START);
  });

  it('never warns at, pinches or touches an axolotl in mid-water above its reach, chasing or not', () => {
    const midWater = (_state: PredatorState, time: number): Point => ({
      x: pingPong(time, 900, 1400, 110),
      y: pingPong(time, BOUNDS.minY, MID_WATER_Y - 0.5, 35),
    });
    for (const [route, ctx] of [[CRAYFISH_ROUTE, CRAYFISH_CTX], [CHASING_ROUTE, CHASING_CTX]] as const) {
      const run = runCrayfish(spawnCrayfish(route), midWater, 60, ctx);
      expect(run.events).toEqual([]);
      expect(run.touches).toEqual([]);
      for (const pos of run.positions) expect(pos.y).toBe(FLOOR_Y);
    }
  });

  it('never warns at an axolotl in the safe area, edges included, and never enters the safe area', () => {
    const keepOutX = zone.safeArea.x1 + CRAYFISH.bodyRadius;
    const waypoints = [{ x: keepOutX + 16, y: FLOOR_Y }, { x: keepOutX + 216, y: FLOOR_Y }];
    const sheltered: Point = { x: zone.safeArea.x1, y: Math.min(zone.safeArea.y1, FLOOR_Y) };
    expect(inSafeArea(sheltered, zone.safeArea)).toBe(true);
    expect(Math.hypot(waypoints[0].x - sheltered.x, waypoints[0].y - sheltered.y)).toBeLessThanOrEqual(CRAYFISH.lungeRange);
    for (const species of [CRAYFISH_SPECIES, CHASING_CRAYFISH]) {
      const route: PredatorRoute = { ...CRAYFISH_ROUTE, waypoints, species };
      const ctx = contextFor(species);
      expect(runCrayfish(spawnCrayfish(route), stillAt(sheltered), 30, ctx).events).toEqual([]);
      const exposed = runCrayfish(spawnCrayfish(route), stillAt({ x: sheltered.x + 1, y: sheltered.y }), 30, ctx);
      expect(typesOf(exposed.events)).toContain('telegraphStart');
      expect(typesOf(exposed.events)).toContain('lungeStart');
      for (const pos of exposed.positions) expect(pos.x).toBeGreaterThanOrEqual(keepOutX);
    }
  });

  it('warns only at an axolotl within 90 px of it, from on its stretch, under a floor hugger', () => {
    const floorHugger = (_state: PredatorState, time: number): Point => ({
      x: pingPong(time, 800, 1500, 90),
      y: pingPong(time, FLOOR_Y - 120, FLOOR_Y, 25),
    });
    for (const [route, ctx] of [[CRAYFISH_ROUTE, CRAYFISH_CTX], [CHASING_ROUTE, CHASING_CTX]] as const) {
      const run = runCrayfish(spawnCrayfish(route), floorHugger, 60, ctx);
      expect(run.warnings.length).toBeGreaterThanOrEqual(5);
      expect(typesOf(run.events).filter((type) => type === 'lungeStart').length).toBeGreaterThanOrEqual(3);
      expectWarnsFromStretch(run);
    }
  });
});

describe('crayfish pinch', () => {
  it('locks its aim at the axolotl at the end of the warning, up off the floor included', () => {
    const targets: Point[] = [
      { x: CRAYFISH_START.x + 40, y: FLOOR_Y - 60 },
      { x: CRAYFISH_START.x, y: FLOOR_Y - CRAYFISH.lungeRange },
      { x: CRAYFISH_START.x - 30, y: FLOOR_Y - 30 },
      { x: CRAYFISH_START.x + 70, y: FLOOR_Y },
    ];
    for (const target of targets) {
      const held = runCrayfish(crayfishWarning(target), stillAt(target), 2, CRAYFISH_CTX, 'lungeStart');
      expect(typesOf(held.events)).toEqual(['lungeStart']);
      const aim = held.state.aim;
      const toTarget = directionTo(CRAYFISH_START, target);
      expect(aim?.x).toBeCloseTo(toTarget.x, 9);
      expect(aim?.y).toBeCloseTo(toTarget.y, 9);
      expect(held.state.facing).toBe(target.x < CRAYFISH_START.x ? -1 : 1);
    }
  });

  it('aims at where the axolotl is when the claws close, not where it was when they opened', () => {
    const opened: Point = { x: CRAYFISH_START.x + 60, y: FLOOR_Y };
    const closed: Point = { x: CRAYFISH_START.x + 30, y: FLOOR_Y - 70 };
    const held = runCrayfish(crayfishWarning(opened), stillAt(closed), 2, CRAYFISH_CTX, 'lungeStart');
    const toClosed = directionTo(CRAYFISH_START, closed);
    expect(held.state.aim?.x).toBeCloseTo(toClosed.x, 9);
    expect(held.state.aim?.y).toBeCloseTo(toClosed.y, 9);
  });

  it('connects with an axolotl hovering above the floor lane within its reach, lifting off the floor', () => {
    const hovers: Point[] = [
      { x: CRAYFISH_START.x, y: FLOOR_Y - CRAYFISH.lungeRange },
      { x: CRAYFISH_START.x + 54, y: FLOOR_Y - 72 },
      { x: CRAYFISH_START.x - 40, y: FLOOR_Y - 60 },
    ];
    for (const hover of hovers) {
      expect(FLOOR_Y - hover.y).toBeGreaterThan(CRAYFISH.hitRadius);
      const run = runCrayfish(crayfishWarning(hover), stillAt(hover), 2, CRAYFISH_CTX, 'lungeEnd');
      expect(typesOf(run.events)).toEqual(['lungeStart', 'lungeEnd']);
      expect(run.events.at(-1)).toEqual({ type: 'lungeEnd', connected: true });
      expect(run.state.pos.y).toBeLessThan(FLOOR_Y);
      expect(Math.hypot(hover.x - run.state.pos.x, hover.y - run.state.pos.y)).toBeLessThanOrEqual(CRAYFISH.hitRadius);
    }
  });

  it('connects only with an axolotl within its 26 px hit reach of the pinch', () => {
    const near: Point = { x: 1060, y: FLOOR_Y - CRAYFISH.hitRadius };
    const reached = runCrayfish(crayfishPinch(CRAYFISH_START, { x: 1, y: 0 }), stillAt(near), 1, CRAYFISH_CTX, 'lungeEnd');
    expect(reached.events).toEqual([{ type: 'lungeEnd', connected: true }]);
    expect(reached.state.pos.x).toBeCloseTo(near.x, 6);
    const above: Point = { x: near.x, y: near.y - 0.5 };
    const missed = runCrayfish(crayfishPinch(CRAYFISH_START, { x: 1, y: 0 }), stillAt(above), 1, CRAYFISH_CTX, 'lungeEnd');
    expect(missed.events).toEqual([{ type: 'lungeEnd', connected: false }]);
  });

  it('never warns beyond 90 px or off its stretch', () => {
    const beyond: Point = { x: CRAYFISH_START.x + 60, y: FLOOR_Y - Math.sqrt(90 ** 2 - 60 ** 2) - 0.5 };
    expect(stepPredator(spawnCrayfish(), beyond, DT, CRAYFISH_CTX).events).toEqual([]);
    const lifted: PredatorState = { ...spawnCrayfish(), pos: { x: 1150, y: FLOOR_Y - ROUTE_WARN_TOLERANCE - 0.5 } };
    const offStretch = stepPredator(lifted, { x: 1150, y: FLOOR_Y - 40 }, DT, CRAYFISH_CTX);
    expect(offStretch.events).toEqual([]);
    expect(offStretch.state.phase).toBe('patrol');
    const edge: PredatorState = { ...spawnCrayfish(), pos: { x: 1150, y: FLOOR_Y - ROUTE_WARN_TOLERANCE } };
    expect(typesOf(stepPredator(edge, { x: 1150, y: FLOOR_Y - 40 }, DT, CRAYFISH_CTX).events)).toEqual(['telegraphStart']);
  });

  it('cancels a warning whose axolotl is beyond 90 px when the claws close', () => {
    const start: Point = { x: CRAYFISH_START.x + 40, y: FLOOR_Y - 40 };
    const escaped: Point = { x: CRAYFISH_START.x + 40, y: FLOOR_Y - 90 };
    const run = runCrayfish(crayfishWarning(start), stillAt(escaped), 2, CRAYFISH_CTX, 'telegraphCancel');
    expect(typesOf(run.events)).toEqual(['telegraphCancel']);
    expect(run.state.phase).toBe('cooldown');
  });

  it('walks back onto its stretch through the 1.8 s cooldown, after a pinch up, before it warns again', () => {
    const end = CRAYFISH_ROUTE.waypoints[1];
    const cooling = stepPredator(crayfishPinch(end, { x: 0, y: -1 }), FAR, CRAYFISH.lungeDuration, CRAYFISH_CTX).state;
    expect(cooling.phase).toBe('cooldown');
    expect(cooling.duration).toBe(1.8);
    expect(cooling.pos.x).toBeCloseTo(end.x, 9);
    expect(cooling.pos.y).toBeCloseTo(FLOOR_Y - PINCH, 9);
    const above = (state: PredatorState): Point => ({ x: state.pos.x, y: state.pos.y - 40 });
    const back = runCrayfish(cooling, above, 10, CRAYFISH_CTX, 'telegraphStart');
    expect(typesOf(back.events)).toEqual(['cooldownEnd', 'telegraphStart']);
    expect(routeLoopDistance(back.state.pos, CRAYFISH_ROUTE.waypoints)).toBeLessThanOrEqual(ROUTE_WARN_TOLERANCE);
    for (const pos of back.positions.slice(0, -2)) {
      expect(routeLoopDistance(pos, CRAYFISH_ROUTE.waypoints)).toBeGreaterThan(ROUTE_WARN_TOLERANCE);
    }
    expect(back.positions.length * DT).toBeGreaterThan(CRAYFISH.cooldown);
  });
});

describe('crayfish chase (issue #77, ND-5)', () => {
  it('chases faster than it patrols, along its stretch only, closing in under an axolotl out of its reach', () => {
    const overhead: Point = { x: 1150, y: FLOOR_Y - 120 };
    const run = runCrayfish(spawnCrayfish(CHASING_ROUTE), stillAt(overhead), 4, CHASING_CTX);
    expect(run.events).toEqual([]);
    expect(run.positions[29].x - CRAYFISH_START.x).toBeGreaterThan(CRAYFISH.patrolSpeed * 30 * DT);
    let x = CRAYFISH_START.x;
    for (const pos of run.positions) {
      expect(routeLoopDistance(pos, CRAYFISH_ROUTE.waypoints)).toBeLessThanOrEqual(1e-6);
      expect(pos.x).toBeGreaterThanOrEqual(x);
      expect(pos.x).toBeLessThanOrEqual(overhead.x);
      x = pos.x;
    }
    expect(overhead.x - run.state.pos.x).toBeLessThan(5);
  });

  it('never chases past the end of its stretch', () => {
    const pastEnd: Point = { x: 1420, y: FLOOR_Y - 100 };
    const run = runCrayfish(spawnCrayfish(CHASING_ROUTE), stillAt(pastEnd), 10, CHASING_CTX);
    expect(run.events).toEqual([]);
    for (const pos of run.positions) expect(routeLoopDistance(pos, CRAYFISH_ROUTE.waypoints)).toBeLessThanOrEqual(1e-6);
    expect(run.state.pos.x).toBeCloseTo(CRAYFISH_ROUTE.waypoints[1].x, 6);
  });
});

describe('crayfish in the encounter', () => {
  const source: EncounterSource = { ...zone, tilapiaRoutes: [], predatorRoutes: [CRAYFISH_ROUTE] };
  const noRegrowCtx = createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 } });
  const onFloor: Point = { x: CRAYFISH_START.x + 60, y: FLOOR_Y - 10 };

  function stepAll(state: EncounterState, axolotl: Point, seconds: number, until?: EncounterEvent['type']): { state: EncounterState; events: EncounterEvent[] } {
    let current = state;
    const events: EncounterEvent[] = [];
    for (let i = 0; i < Math.round(seconds / DT) && !current.tripOver; i++) {
      const result = stepEncounter(current, axolotl, DT, noRegrowCtx);
      current = result.state;
      events.push(...result.events);
      if (until && result.events.some((event) => event.type === until)) break;
    }
    return { state: current, events };
  }

  it('lands a pinch as one hit: one leg, protected time and the crayfish bump cooldown', () => {
    const { state, events } = stepAll(createEncounter(source), onFloor, 3, 'hit');
    expect(typesOf(events)).toEqual(['telegraph', 'lunge', 'hit', 'regrowStart']);
    expect(events[2]).toMatchObject({ type: 'hit', sourceId: 'crayfish-test', leg: 0 });
    expect(presentCount(state.legs)).toBe(LEGS.count - 1);
    expect(state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(state.bumpCooldownLeft).toBe(CRAYFISH.bumpCooldown);
    expect(state.predators[0].phase).toBe('cooldown');
  });

  it('pinches an axolotl hovering above it within reach: one leg', () => {
    const hovering: Point = { x: CRAYFISH_START.x + 20, y: FLOOR_Y - 80 };
    expect(FLOOR_Y - hovering.y).toBeGreaterThan(CRAYFISH.hitRadius);
    const { state, events } = stepAll(createEncounter(source), hovering, 3, 'hit');
    expect(typesOf(events)).toEqual(['telegraph', 'lunge', 'hit', 'regrowStart']);
    expect(events[2]).toMatchObject({ type: 'hit', sourceId: 'crayfish-test', leg: 0 });
    expect(presentCount(state.legs)).toBe(LEGS.count - 1);
    expect(state.predators[0].pos.y).toBeLessThan(FLOOR_Y);
  });

  it("gives the tilapia's gentle bump on a touch, never during a pinch", () => {
    const close: Point = { x: CRAYFISH_START.x + 150, y: FLOOR_Y - 28 };
    expect(FLOOR_Y - close.y).toBeGreaterThan(CRAYFISH.hitRadius);
    expect(FLOOR_Y - close.y).toBeLessThanOrEqual(CRAYFISH.contactRadius);
    const pinching = crayfishPinch(CRAYFISH_START, { x: 1, y: 0 });
    expect(touching(pinching, pinching.pos, CRAYFISH)).toBe(false);
    let state = createEncounter(source);
    let bumps = 0;
    for (let i = 0; i < Math.round(20 / DT) && !state.tripOver; i++) {
      const result = stepEncounter(state, close, DT, noRegrowCtx);
      state = result.state;
      if (!result.events.some((event) => event.type === 'bump')) continue;
      bumps++;
      expect(state.predators[0].phase).not.toBe('lunge');
      expect(Math.hypot(result.impulse?.x ?? 0, result.impulse?.y ?? 0)).toBeCloseTo(TILAPIA.bumpSpeed, 9);
      expect(state.bumpCooldownLeft).toBe(TILAPIA.bumpCooldown);
    }
    expect(bumps).toBeGreaterThanOrEqual(2);
  });

  it('lets only one predator warn or pinch at a time across two crayfish and a tilapia (A1)', () => {
    const fish: TilapiaRoute = { id: 'fish', waypoints: [{ x: 1100, y: FLOOR_Y - 150 }] };
    const crayfish = (id: string, x0: number): PredatorRoute => ({
      ...CRAYFISH_ROUTE,
      id,
      waypoints: [{ x: x0, y: FLOOR_Y }, { x: x0 + 200, y: FLOOR_Y }],
    });
    const twoCrayfish: EncounterSource = {
      ...zone,
      tilapiaRoutes: [fish],
      predatorRoutes: [crayfish('crayfish-0', 900), crayfish('crayfish-1', 1100)],
    };
    const axolotl: Point = { x: 1100, y: FLOOR_Y - 40 };
    let state = createEncounter(twoCrayfish);
    const telegraphs = new Set<string>();
    for (let i = 0; i < Math.round(30 / DT) && !state.tripOver; i++) {
      const result = stepEncounter(state, axolotl, DT, noRegrowCtx);
      state = result.state;
      const attacking = state.predators.filter((predator) => predator.phase === 'telegraph' || predator.phase === 'lunge');
      expect(attacking.length).toBeLessThanOrEqual(1);
      for (const event of result.events) {
        if (event.type === 'telegraph') telegraphs.add(event.sourceId);
      }
    }
    expect(telegraphs).toEqual(new Set(['fish', 'crayfish-0', 'crayfish-1']));
  });
});

describe('every crayfish pinch is avoidable by swimming away (issue #77, ND-5)', () => {
  const fourLeg = legSwimTuning(LEGS.count);
  const oneLeg = legSwimTuning(1);
  const env: SwimEnv = { current: { x: 0, y: 0 }, dragMul: 1, bounds: BOUNDS, dashing: false };
  const UP: Point = { x: 0, y: -1 };
  /** The measured smallest distance in px from which a one-leg axolotl swimming away is never pinched. */
  const ONE_LEG_SAFE_DISTANCE = 28;

  /** The way straight away from the crayfish at `from`; straight up when right on it. */
  function awayFrom(from: Point, start: Point): Point {
    return start.x === from.x && start.y === from.y ? UP : directionTo(from, start);
  }

  /**
   * Steps a crayfish whose warning has just started together with an axolotl at rest at `start`
   * that steers straight away from the crayfish, until the crayfish cools down; returns the events.
   */
  function swimAwayFrom(start: Point, ctx: PredatorContext, tuning: SwimTuning): PredatorEvent[] {
    let crayfish = crayfishWarning(start, ctx);
    let swimmer: SwimState = { ...start, vx: 0, vy: 0, facing: 1 };
    const away = awayFrom(crayfish.pos, start);
    const events: PredatorEvent[] = [];
    for (let i = 0; i < Math.round(3 / DT) && crayfish.phase !== 'cooldown'; i++) {
      swimmer = stepSwim(swimmer, away, env, DT, tuning);
      const result = stepPredator(crayfish, { x: swimmer.x, y: swimmer.y }, DT, ctx);
      crayfish = result.state;
      events.push(...result.events);
    }
    expect(crayfish.phase).toBe('cooldown');
    return events;
  }

  function pinched(events: readonly PredatorEvent[]): boolean {
    return events.some((event) => event.type === 'lungeEnd' && event.connected);
  }

  /**
   * Starts `distance` px from a crayfish at its start, every 15 degrees from floor to floor over the
   * top; 90 px is pulled in by a hair so rounding keeps it in reach.
   */
  function startsAt(distance: number): Point[] {
    const radius = Math.min(distance, CRAYFISH.lungeRange - EPSILON);
    const starts: Point[] = [];
    for (let degrees = 0; degrees <= 180; degrees += 15) {
      const angle = (degrees * Math.PI) / 180;
      starts.push({ x: CRAYFISH_START.x + radius * Math.cos(angle), y: FLOOR_Y - radius * Math.sin(angle) });
    }
    return starts;
  }

  /** Every start in reach of a crayfish at its start: a 15 px grid on and above the floor. */
  function startsInReach(): Point[] {
    const starts: Point[] = [];
    for (let dx = -90; dx <= 90; dx += 15) {
      for (let dy = 0; dy <= 90; dy += 15) {
        if (Math.hypot(dx, dy) <= CRAYFISH.lungeRange) starts.push({ x: CRAYFISH_START.x + dx, y: FLOOR_Y - dy });
      }
    }
    return starts;
  }

  it('never lands a pinch on a four-leg axolotl that swims straight away when the claws open, from any start in reach', () => {
    for (const ctx of [CRAYFISH_CTX, CHASING_CTX]) {
      for (const start of startsInReach()) {
        expect(pinched(swimAwayFrom(start, ctx, fourLeg)), JSON.stringify(start)).toBe(false);
      }
    }
  });

  it('never lands a pinch on a one-leg axolotl swimming away from 28 px or more, and lands one from nearer', () => {
    for (const ctx of [CRAYFISH_CTX, CHASING_CTX]) {
      for (let distance = ONE_LEG_SAFE_DISTANCE; distance <= CRAYFISH.lungeRange; distance++) {
        for (const start of startsAt(distance)) {
          expect(pinched(swimAwayFrom(start, ctx, oneLeg)), JSON.stringify(start)).toBe(false);
        }
      }
      const nearer = startsAt(ONE_LEG_SAFE_DISTANCE - 1).filter((start) => pinched(swimAwayFrom(start, ctx, oneLeg)));
      expect(nearer.length).toBeGreaterThan(0);
    }
  });

  it('lands the same pinch on an axolotl that stays put', () => {
    for (const start of [{ x: CRAYFISH_START.x + 30, y: FLOOR_Y }, { x: CRAYFISH_START.x + 30, y: FLOOR_Y - 60 }]) {
      const stay = runCrayfish(crayfishWarning(start), stillAt(start), 2, CRAYFISH_CTX, 'lungeEnd');
      expect(stay.events.at(-1)).toEqual({ type: 'lungeEnd', connected: true });
    }
  });
});
