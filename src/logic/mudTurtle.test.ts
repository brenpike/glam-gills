import { describe, expect, it } from 'vitest';
import { areaFactCards } from './areas';
import { MUD_TURTLE_FACT, MUD_TURTLE_MEET_RANGE } from './factCards';
import {
  CORMORANT_SPECIES,
  MUD_TURTLE_SPECIES,
  PREDATOR_SPECIES,
  createPredator,
  crossesRock,
  stabTip,
  stepPredator,
  tunedSpecies,
  type PredatorContext,
  type PredatorEvent,
  type PredatorRoute,
  type PredatorState,
} from './predators';
import type { RockWall } from './pebble';
import { MUD_TURTLE, TILAPIA } from './tuning';
import type { Point } from './zone';

const TURTLE_ROUTE: PredatorRoute = {
  id: 'mud-turtle-test',
  waypoints: [
    { x: 600, y: 400 },
    { x: 800, y: 400 },
  ],
  species: MUD_TURTLE_SPECIES,
};
const TURTLE_START: Point = TURTLE_ROUTE.waypoints[0];

const CTX: PredatorContext = {
  safeArea: { x0: 0, x1: 200, y0: 100, y1: 800 },
  bounds: { minX: 0, maxX: 3000, minY: 100, maxY: 800 },
  tuning: MUD_TURTLE_SPECIES.tuning,
  rules: MUD_TURTLE_SPECIES.rules,
};

/** A binary fraction, so step times add up exactly. */
const DT = 1 / 64;
/** Straight below the turtle's start, exactly lungeRange away: the edge of its reach. */
const AT_REACH: Point = { x: TURTLE_START.x, y: TURTLE_START.y + MUD_TURTLE.lungeRange };
/** A thin rock shelf between the turtle's start and AT_REACH. */
const SHELF: RockWall = { x0: 500, x1: 700, y0: 450, y1: 452 };

interface TimedEvent {
  time: number;
  event: PredatorEvent;
}

interface TurtleRun {
  state: PredatorState;
  events: TimedEvent[];
  positions: Point[];
}

function spawnTurtle(): PredatorState {
  return createPredator(TURTLE_ROUTE, MUD_TURTLE_SPECIES.id);
}

/**
 * The context for one step. With `walls`, the target counts as behind rock when rock lies between
 * the turtle and the target, as the encounter works it out each step.
 */
function stepCtx(state: PredatorState, target: Point, walls: readonly RockWall[]): PredatorContext {
  if (walls.length === 0) return CTX;
  return { ...CTX, rockWalls: walls, targetBehindRock: crossesRock(state.pos, target, walls) };
}

/**
 * Steps a turtle for `seconds` in DT steps, stopping after a step with an event of type `until`.
 * `targetAt` gets the time at the start of each step; each event is stamped with that time.
 */
function runTurtle(
  start: PredatorState,
  targetAt: (time: number) => Point,
  seconds: number,
  until?: PredatorEvent['type'],
  walls: readonly RockWall[] = [],
): TurtleRun {
  let state = start;
  const events: TimedEvent[] = [];
  const positions: Point[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const time = i * DT;
    const target = targetAt(time);
    const result = stepPredator(state, target, DT, stepCtx(state, target, walls));
    state = result.state;
    positions.push(state.pos);
    for (const event of result.events) events.push({ time, event });
    if (until && result.events.some((event) => event.type === until)) break;
  }
  return { state, events, positions };
}

function eventTypes(run: TurtleRun): string[] {
  return run.events.map((entry) => entry.event.type);
}

/** A turtle at its start whose warning at `target` has just started. */
function turtleWarning(target: Point = AT_REACH): PredatorState {
  const result = stepPredator(spawnTurtle(), target, DT, CTX);
  expect(result.events).toEqual([{ type: 'telegraphStart' }]);
  return result.state;
}

/** A turtle at its start that snapped at AT_REACH, hit, and has just started its cooldown. */
function turtleCooling(): PredatorState {
  const run = runTurtle(turtleWarning(), () => AT_REACH, MUD_TURTLE.windup + MUD_TURTLE.lungeDuration + DT, 'lungeEnd');
  expect(run.state.phase).toBe('cooldown');
  return run.state;
}

/** The sentences of a card body. */
function sentences(body: string): string[] {
  return body.split(/(?<=\.)\s+/);
}

describe('mud turtle tuning and species (issue #212, ND-11 and ND-12)', () => {
  it('has the ND-11 and ND-12 tuning, with no chase of its own', () => {
    expect(MUD_TURTLE).toEqual({
      minWindup: 0.8,
      windup: 1.2,
      cooldown: 2.5,
      lungeRange: 110,
      lungeSpeed: 110 / 0.3,
      lungeDuration: 0.3,
      hitRadius: TILAPIA.hitRadius,
      contactRadius: TILAPIA.contactRadius,
      bodyRadius: TILAPIA.bodyRadius,
      patrolSpeed: 20,
      bumpSpeed: TILAPIA.bumpSpeed,
      bumpCooldown: TILAPIA.bumpCooldown,
    });
    expect(MUD_TURTLE.chase).toBeUndefined();
    expect(MUD_TURTLE.lungeSpeed * MUD_TURTLE.lungeDuration).toBeCloseTo(MUD_TURTLE.lungeRange, 9);
    expect(Object.isFrozen(MUD_TURTLE)).toBe(true);
  });

  it('is the species mud-turtle, Mud turtle, with a fixed strike spot and a still cooldown only', () => {
    expect(MUD_TURTLE_SPECIES).toEqual({
      id: 'mud-turtle',
      name: 'Mud turtle',
      tuning: MUD_TURTLE,
      meetRange: MUD_TURTLE_MEET_RANGE,
      fact: MUD_TURTLE_FACT,
      rules: { fixedStrikeSpot: true, stillCooldown: true },
    });
    expect(MUD_TURTLE_SPECIES.tuning).toBe(MUD_TURTLE);
    expect(MUD_TURTLE_SPECIES.fact).toBe(MUD_TURTLE_FACT);
    expect(MUD_TURTLE_SPECIES.rules?.sightCover).toBeUndefined();
    expect(MUD_TURTLE_SPECIES.neverTouches).toBeUndefined();
    expect(MUD_TURTLE_SPECIES.dangerPart).toBeUndefined();
    expect(MUD_TURTLE_SPECIES.hook).toBeUndefined();
    expect(Object.isFrozen(MUD_TURTLE_SPECIES)).toBe(true);
    expect(Object.isFrozen(MUD_TURTLE_SPECIES.rules)).toBe(true);
  });

  it('comes right after the cormorant in the species list', () => {
    const cormorant = PREDATOR_SPECIES.indexOf(CORMORANT_SPECIES);
    expect(PREDATOR_SPECIES[cormorant + 1]).toBe(MUD_TURTLE_SPECIES);
  });

  it('throws when tuned with a chase', () => {
    const chase = { sight: MUD_TURTLE.lungeRange + 100, leash: 0, speed: 120 };
    expect(() => tunedSpecies(MUD_TURTLE_SPECIES, { ...MUD_TURTLE, chase })).toThrow(RangeError);
    expect(() => tunedSpecies(MUD_TURTLE_SPECIES, { ...MUD_TURTLE, chase })).toThrow('tunedSpecies: mud-turtle cannot chase');
  });

  it('plays as tuned with no chase', () => {
    const tuned = tunedSpecies(MUD_TURTLE_SPECIES, { ...MUD_TURTLE, windup: 1.5 });
    expect(tuned.tuning.windup).toBe(1.5);
    expect(tuned.rules).toBe(MUD_TURTLE_SPECIES.rules);
  });
});

describe('mud turtle warning', () => {
  it('warns for at least 0.8 s, 1.2 s as tuned, before it snaps', () => {
    const warned = turtleWarning();
    expect(warned.phase).toBe('telegraph');
    expect(warned.duration).toBe(MUD_TURTLE.windup);
    expect(warned.duration).toBeGreaterThanOrEqual(0.8);
    const run = runTurtle(spawnTurtle(), () => AT_REACH, MUD_TURTLE.windup + 2 * DT, 'lungeStart');
    expect(eventTypes(run)).toEqual(['telegraphStart', 'lungeStart']);
    const [warnAt, snapAt] = run.events.map((entry) => entry.time);
    expect(warnAt).toBe(0);
    expect(snapAt).toBeLessThan(MUD_TURTLE.windup);
    expect(snapAt + DT).toBeGreaterThanOrEqual(MUD_TURTLE.windup);
    expect(snapAt).toBeGreaterThanOrEqual(0.8);
  });

  it('starts no warning at an axolotl just beyond its reach', () => {
    const beyond: Point = { x: AT_REACH.x, y: AT_REACH.y + 1 };
    const result = stepPredator(spawnTurtle(), beyond, DT, CTX);
    expect(result.events).toEqual([]);
    expect(result.state.phase).toBe('patrol');
  });

  it('warns at an axolotl in cover, because it does not hunt by sight', () => {
    const result = stepPredator(spawnTurtle(), AT_REACH, DT, { ...CTX, targetInCover: true });
    expect(result.events).toEqual([{ type: 'telegraphStart' }]);
  });
});

describe('mud turtle snap', () => {
  it('snaps 110 px to the spot locked at warning start, from where it is, and hits an axolotl that stayed', () => {
    const warned = turtleWarning();
    expect(warned.strikeSpot).toEqual(AT_REACH);
    const run = runTurtle(warned, () => AT_REACH, MUD_TURTLE.windup + MUD_TURTLE.lungeDuration + DT, 'lungeEnd');
    expect(eventTypes(run)).toEqual(['lungeStart', 'lungeEnd']);
    expect(run.events[1].event).toEqual({ type: 'lungeEnd', connected: true });
    for (const pos of run.positions) expect(pos).toEqual(TURTLE_START);
    expect(Object.keys(run.state)).not.toContain('strikeSpot');
  });

  it('moves the snap tip in a straight line from the turtle to the locked spot, reaching it at the end', () => {
    const run = runTurtle(turtleWarning(), () => AT_REACH, MUD_TURTLE.windup + DT, 'lungeStart');
    const snapping = run.state;
    expect(snapping.phase).toBe('lunge');
    expect(snapping.duration).toBe(MUD_TURTLE.lungeDuration);
    const end = stabTip({ ...snapping, elapsed: MUD_TURTLE.lungeDuration });
    expect(end).toEqual(AT_REACH);
    expect(Math.hypot(end.x - TURTLE_START.x, end.y - TURTLE_START.y)).toBe(110);
    const halfway = stabTip({ ...snapping, elapsed: MUD_TURTLE.lungeDuration / 2 });
    expect(halfway.x).toBeCloseTo(TURTLE_START.x, 9);
    expect(halfway.y).toBeCloseTo(TURTLE_START.y + 55, 9);
  });

  it('keeps the spot from warning start and misses an axolotl that moved away during the warning', () => {
    const moved: Point = { x: TURTLE_START.x + 60, y: TURTLE_START.y + 30 };
    const run = runTurtle(turtleWarning(), () => moved, MUD_TURTLE.windup + MUD_TURTLE.lungeDuration + DT, 'lungeEnd');
    expect(eventTypes(run)).toEqual(['lungeStart', 'lungeEnd']);
    expect(run.events[1].event).toEqual({ type: 'lungeEnd', connected: false });
    for (const pos of run.positions) expect(pos).toEqual(TURTLE_START);
  });

  it('never snaps through rock: it starts no warning at an axolotl behind rock', () => {
    const run = runTurtle(spawnTurtle(), () => AT_REACH, 1, undefined, [SHELF]);
    expect(run.events).toEqual([]);
    expect(run.state.phase).toBe('patrol');
  });

  it('never snaps through rock: a snap at an axolotl that went behind rock misses, even at the spot', () => {
    const open = runTurtle(turtleWarning(), () => AT_REACH, MUD_TURTLE.windup + DT, 'lungeStart');
    expect(open.state.phase).toBe('lunge');
    const walled = runTurtle(open.state, () => AT_REACH, MUD_TURTLE.lungeDuration + DT, 'lungeEnd', [SHELF]);
    expect(walled.events.map((entry) => entry.event)).toEqual([{ type: 'lungeEnd', connected: false }]);
  });
});

describe('mud turtle still cooldown', () => {
  it('stands still for the 2.5 s cooldown, facing the axolotl as it moves, then creeps on', () => {
    const cooling = turtleCooling();
    expect(cooling.duration).toBe(MUD_TURTLE.cooldown);
    const left: Point = { x: TURTLE_START.x - 300, y: TURTLE_START.y + 200 };
    const facingLeft = runTurtle(cooling, () => left, 1);
    expect(facingLeft.events).toEqual([]);
    expect(facingLeft.state.facing).toBe(-1);
    for (const pos of facingLeft.positions) expect(pos).toEqual(TURTLE_START);
    const right: Point = { x: TURTLE_START.x + 400, y: TURTLE_START.y + 200 };
    const facingRight = runTurtle(facingLeft.state, () => right, 1);
    expect(facingRight.events).toEqual([]);
    expect(facingRight.state.facing).toBe(1);
    for (const pos of facingRight.positions) expect(pos).toEqual(TURTLE_START);
    const done = runTurtle(facingRight.state, () => right, 1, 'cooldownEnd');
    expect(eventTypes(done)).toEqual(['cooldownEnd']);
    expect(done.state.phase).toBe('patrol');
    const creeping = runTurtle(done.state, () => right, 1);
    expect(creeping.events).toEqual([]);
    expect(creeping.state.pos.x).toBeGreaterThan(TURTLE_START.x);
  });
});

describe('mud turtle fact card copy (issue #212, ND-14)', () => {
  it('has the mud turtle id, name, title and body, and no hint of its own', () => {
    expect(MUD_TURTLE_FACT).toEqual({
      id: 'mud-turtle',
      name: 'Mud turtle',
      title: 'Meet the mud turtle',
      body: 'Mud turtles live in ponds and streams from Texas to the Valley of Mexico. They hunt small fish at night. Axolotls stay safe by swimming away before they snap.',
    });
    expect(MUD_TURTLE_FACT.unfoundHint).toBeUndefined();
    expect(Object.isFrozen(MUD_TURTLE_FACT)).toBe(true);
  });

  it('never names an axolotl as food', () => {
    for (const sentence of sentences(MUD_TURTLE_FACT.body).filter((text) => /axolotl/i.test(text))) {
      expect(sentence).not.toMatch(/\b(eat\w*|hunt\w*|catch\w*|prey|grab\w*|swallow\w*|food)\b/i);
    }
  });

  it('never says the species lives only in the Valley of Mexico', () => {
    expect(MUD_TURTLE_FACT.body).not.toMatch(/\bonly\b/i);
    expect(MUD_TURTLE_FACT.body).toMatch(/from Texas to the Valley of Mexico/);
  });

  it('ends with a stay-safe tip like the pelican and cormorant cards', () => {
    expect(sentences(MUD_TURTLE_FACT.body).at(-1)).toMatch(/^Axolotls stay safe by swimming .+\.$/);
  });

  it('keeps the name, title and body no longer than the longest other area card', () => {
    const others = areaFactCards().filter((card) => card.id !== MUD_TURTLE_FACT.id);
    const longest = (field: 'name' | 'title' | 'body') => Math.max(...others.map((card) => card[field].length));
    expect(MUD_TURTLE_FACT.name.length).toBeLessThanOrEqual(longest('name'));
    expect(MUD_TURTLE_FACT.title.length).toBeLessThanOrEqual(longest('title'));
    expect(MUD_TURTLE_FACT.body.length).toBeLessThanOrEqual(longest('body'));
  });

  it('uses a meet range of 180 px, larger than the snap reach', () => {
    expect(MUD_TURTLE_MEET_RANGE).toBe(180);
    expect(MUD_TURTLE_MEET_RANGE).toBeGreaterThan(MUD_TURTLE.lungeRange);
  });
});
