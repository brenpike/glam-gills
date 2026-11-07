import { describe, expect, it } from 'vitest';
import { createEncounterContext } from './encounter';
import { FADING_LIGHTS, fadingLightCircles, fadingLightShare, fadingLightSpawn } from './fadingLights';
import { GLOW_PLANTS, glowPlantSpawn, type DarkWater } from './glowPlants';
import { FADING_LIGHT_RADIUS } from './hazards';
import { tripEndRecord } from './session';
import {
  createTrip,
  createTripContext,
  goHome,
  idleTripSnapshot,
  keepExploring,
  newTrip,
  sameTripSnapshot,
  stepTrip,
  tripSnapshot,
  type TripEvent,
  type TripSource,
  type TripState,
} from './trip';
import { LEGS, SWIM } from './tuning';
import { buildCanalZone, type Point } from './zone';

const STEP = SWIM.dtMax;
const PAUSE_DTS = [0, -1, Number.NaN, Number.POSITIVE_INFINITY];
const HINT_STEPS = Math.round(FADING_LIGHTS.hintAfter / STEP);
const FULL = FADING_LIGHTS.fullFor + FADING_LIGHTS.dimFor;
const ctx = createTripContext({ encounter: createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 } }) });
const zone = buildCanalZone();
const routeStart = zone.tilapiaRoutes[0].waypoints[0];
const inRange: Point = { x: routeStart.x + 60, y: routeStart.y };
const darkWater: DarkWater = { x0: 960, x1: 1920, y0: 0, y1: 400 };
const lightA = fadingLightSpawn('light-a', { x: 1200, y: 200 });
const lightB = fadingLightSpawn('light-b', { x: 1600, y: 200 });
const plant = glowPlantSpawn('plant-c', { x: 1400, y: 330, radius: 20 });
const fadingZone: TripSource = {
  ...zone,
  finds: [],
  spots: [],
  tilapiaRoutes: [],
  hazards: [],
  predatorRoutes: [],
  elements: [lightA, lightB],
  darkWater,
};
const mixedZone: TripSource = { ...fadingZone, elements: [lightA, lightB, plant] };
const glowZone: TripSource = { ...fadingZone, elements: [plant] };
const deep: Point = { x: 1350, y: 120 };
const atA: Point = { x: 1200, y: 200 - FADING_LIGHT_RADIUS - FADING_LIGHTS.touchReach };
const pastA: Point = { x: 1200, y: 200 - FADING_LIGHT_RADIUS - FADING_LIGHTS.touchReach - 0.5 };
const atB: Point = { x: 1600, y: 200 };
const atPlant: Point = { x: 1400, y: 330 - 20 - GLOW_PLANTS.bodyReach };
const FADING_KEYS = ['fadingLightTimers', 'fadingLightHint'];

/** Swims `steps` steps of `STEP` seconds at `pos`. */
function swimSteps(state: TripState, pos: Point, steps: number): TripState {
  let current = state;
  for (let i = 0; i < steps; i++) current = stepAt(current, pos);
  return current;
}

/** One `STEP` swimming step at `pos`. */
function stepAt(state: TripState, pos: Point): TripState {
  return stepTrip(state, { axolotlPos: pos, reduced: false, dashing: false }, STEP, ctx).state;
}

/** Steps at `pos` until an event of type `until`, for at most `limit` seconds. */
function driveUntil(state: TripState, pos: Point, until: TripEvent['type'], limit = 120): TripState {
  let current = state;
  for (let seconds = 0; seconds < limit; seconds += STEP) {
    const result = stepTrip(current, { axolotlPos: pos, reduced: false, dashing: false }, STEP, ctx);
    current = result.state;
    if (result.events.some((event) => event.type === until)) break;
  }
  return current;
}

/** Seconds left on light `id`, failing when the trip has no fading light timers. */
function leftOn(state: TripState, id: string): number {
  if (state.fadingLightTimers === undefined) throw new Error('trip has no fading light timers');
  return state.fadingLightTimers[id] ?? 0;
}

describe('fading lights in the trip (issue #212, ND-7)', () => {
  it('starts with every light unlit, no fading light hint and a copy of each light', () => {
    const trip = createTrip(fadingZone);
    expect(trip.fadingLightTimers).toEqual({});
    expect(trip.fadingLightHint).toBeNull();
    expect(trip.elements[0].fadingLight).toEqual(lightA.fadingLight);
    expect(trip.elements[0].fadingLight).not.toBe(lightA.fadingLight);
  });

  it('lights a light at exactly its touch reach, not past it, silently', () => {
    expect(stepAt(createTrip(fadingZone), pastA).fadingLightTimers).toEqual({});
    const result = stepTrip(createTrip(fadingZone), { axolotlPos: atA, reduced: false, dashing: false }, STEP, ctx);
    expect(result.state.fadingLightTimers).toEqual({ 'light-a': FULL });
    expect(result.events).toEqual([]);
  });

  it('relights a dimming or out light back to full', () => {
    const dimming = swimSteps(stepAt(createTrip(fadingZone), atA), deep, Math.round(16 / STEP));
    expect(leftOn(dimming, 'light-a')).toBeCloseTo(FULL - 16, 6);
    expect(leftOn(stepAt(dimming, atA), 'light-a')).toBe(FULL);
    const out = swimSteps(dimming, deep, Math.round(4 / STEP));
    expect(leftOn(out, 'light-a')).toBe(0);
    expect(leftOn(stepAt(out, atA), 'light-a')).toBe(FULL);
  });

  it('stays fully lit for 15 s, dims, and is out at 19 s', () => {
    const touched = stepAt(createTrip(fadingZone), atA);
    const full = swimSteps(touched, deep, Math.round(FADING_LIGHTS.fullFor / STEP) - 1);
    expect(fadingLightShare(leftOn(full, 'light-a'), false)).toBe(1);
    const dim = swimSteps(full, deep, Math.round(2 / STEP));
    const share = fadingLightShare(leftOn(dim, 'light-a'), false);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
    const outSteps = Math.round(FULL / STEP);
    const nearlyOut = swimSteps(touched, deep, outSteps - 1);
    expect(leftOn(nearlyOut, 'light-a')).toBeGreaterThan(0);
    const out = swimSteps(nearlyOut, deep, 2);
    expect(leftOn(out, 'light-a')).toBe(0);
    expect(fadingLightCircles(out.elements, out.fadingLightTimers ?? {}, false)).toEqual([]);
  });

  it('is trip state only: newTrip unlights every light and the end record holds no light', () => {
    const swum = swimSteps(stepAt(createTrip(fadingZone), atA), deep, 10);
    const done = goHome({ ...swum, inHomeSpot: true }).state;
    expect(done.phase).toBe('ended');
    expect(leftOn(done, 'light-a')).toBeGreaterThan(0);
    const next = newTrip(done);
    expect(next.fadingLightTimers).toEqual({});
    expect(next.fadingLightHint).toBeNull();
    expect(next.darkHintTime).toBe(0);
    expect(next.elements).toEqual(fadingZone.elements);
    expect(JSON.stringify(tripEndRecord(done, []))).not.toContain('light-a');
  });

  it('holds the timers and the hint clock while the game is paused', () => {
    const swimming = swimSteps(stepAt(createTrip(fadingZone), atA), deep, 10);
    for (const dt of PAUSE_DTS) {
      expect(stepTrip(swimming, { axolotlPos: atB, reduced: false, dashing: false }, dt, ctx).state).toBe(swimming);
    }
  });

  it('holds the timers and the hint clock while the banking card shows, and runs them again after', () => {
    const lit = stepAt(swimSteps(createTrip(fadingZone), deep, 10), atB);
    const bankedTrip: TripState = { ...lit, phase: 'banked', heldAt: { ...atB } };
    expect(stepAt(bankedTrip, atA)).toBe(bankedTrip);
    const resumed = keepExploring(bankedTrip);
    expect(resumed.fadingLightTimers).toBe(lit.fadingLightTimers);
    expect(resumed.darkHintTime).toBe(lit.darkHintTime);
    const stepped = stepAt(resumed, deep);
    expect(leftOn(stepped, 'light-b')).toBeCloseTo(FULL - STEP, 9);
    expect(stepped.darkHintTime).toBeCloseTo(lit.darkHintTime + STEP, 9);
  });

  it('holds the timers and the hint clock through the carry home', () => {
    const lightAtRange = fadingLightSpawn('light-c', inRange);
    const darkCanal: TripSource = { ...zone, elements: [lightAtRange], darkWater: { x0: 0, x1: 1920, y0: 0, y1: 400 } };
    const carry = driveUntil(createTrip(darkCanal), inRange, 'carryStart');
    expect(carry.phase).toBe('carrying');
    expect(leftOn(carry, 'light-c')).toBe(FULL);
    const moved = stepAt(carry, deep);
    expect(moved.fadingLightTimers).toBe(carry.fadingLightTimers);
    expect(moved.darkHintTime).toBe(carry.darkHintTime);
    const done = driveUntil(moved, deep, 'arrivedHome');
    expect(done.phase).toBe('ended');
    expect(done.fadingLightTimers).toBe(carry.fadingLightTimers);
    expect(done.fadingLightHint).toBe(carry.fadingLightHint);
  });

  it('points the hint at the nearest light that is out after 20 s in the dark with no new light', () => {
    const before = swimSteps(createTrip(fadingZone), deep, HINT_STEPS - 1);
    expect(before.darkHintTime).toBeCloseTo(FADING_LIGHTS.hintAfter - STEP, 9);
    expect(before.fadingLightHint).toBeNull();
    const after = swimSteps(before, deep, 2);
    expect(after.fadingLightHint).toBe('light-a');
    expect(after.darkHint).toBeNull();
    const litA = stepAt(createTrip(fadingZone), atA);
    expect(swimSteps(litA, deep, HINT_STEPS + 1).fadingLightHint).toBe('light-a');
    const relitA = stepAt(swimSteps(litA, deep, Math.round(10 / STEP)), atA);
    const stillLit = swimSteps(relitA, deep, HINT_STEPS - Math.round(10 / STEP));
    expect(leftOn(stillLit, 'light-a')).toBeGreaterThan(0);
    expect(stillLit.fadingLightHint).toBe('light-b');
  });

  it('resets the hint clock on a new fading light, not on a relight of a light still lit', () => {
    const waited = swimSteps(createTrip(fadingZone), deep, HINT_STEPS + 1);
    expect(waited.fadingLightHint).toBe('light-a');
    const litNow = stepAt(waited, atA);
    expect(litNow.darkHintTime).toBe(0);
    expect(litNow.fadingLightHint).toBeNull();
    const later = swimSteps(litNow, deep, 20);
    const relit = stepAt(later, atA);
    expect(relit.darkHintTime).toBeCloseTo(later.darkHintTime + STEP, 9);
  });

  it('shares one hint clock: a glow-plant or a fading light newly lit resets it for both hints', () => {
    const waited = swimSteps(createTrip(mixedZone), deep, HINT_STEPS + 1);
    expect(waited.darkHint).toBe('plant-c');
    expect(waited.fadingLightHint).toBe('light-a');
    const plantLit = stepAt(waited, atPlant);
    expect(plantLit.litGlowPlants).toEqual(['plant-c']);
    expect(plantLit.darkHintTime).toBe(0);
    expect(plantLit.fadingLightHint).toBeNull();
    const rewaited = swimSteps(plantLit, deep, HINT_STEPS + 1);
    expect(rewaited.fadingLightHint).toBe('light-a');
    const lightLit = stepAt(rewaited, atA);
    expect(lightLit.darkHintTime).toBe(0);
    expect(lightLit.darkHint).toBeNull();
  });

  it('adds no fading light keys to a trip, its steps or its snapshot in an area with no fading lights', () => {
    const idleKeys = Object.keys(idleTripSnapshot());
    for (const source of [zone, glowZone]) {
      const trip = createTrip(source);
      const swum = swimSteps(stepAt(trip, atPlant), deep, HINT_STEPS + 1);
      for (const state of [trip, swum]) {
        for (const key of FADING_KEYS) expect(Object.keys(state)).not.toContain(key);
        expect(Object.keys(tripSnapshot(state))).toEqual(idleKeys);
      }
    }
    for (const key of FADING_KEYS) expect(Object.keys(idleTripSnapshot())).not.toContain(key);
  });
  it('puts the fading light hint in the snapshot only in a zone with lights, and only while swimming', () => {
    const waited = swimSteps(createTrip(fadingZone), deep, HINT_STEPS + 1);
    expect(waited.fadingLightHint).toBe('light-a');
    expect(tripSnapshot(waited)).toHaveProperty('fadingLightHint', 'light-a');
    expect(tripSnapshot(createTrip(fadingZone))).toHaveProperty('fadingLightHint', null);
    for (const phase of ['banked', 'carrying', 'ended'] as const) {
      expect(tripSnapshot({ ...waited, phase })).toHaveProperty('fadingLightHint', null);
    }
    expect(Object.keys(tripSnapshot(waited))).toContain('fadingLightHint');
    expect(Object.keys(tripSnapshot(waited))).not.toContain('fadingLightTimers');
  });

  it('tells two snapshots apart when only the fading light hint differs', () => {
    const waited = swimSteps(createTrip(fadingZone), deep, HINT_STEPS + 1);
    const hinted = tripSnapshot(waited);
    const unhinted = tripSnapshot({ ...waited, fadingLightHint: null });
    expect(sameTripSnapshot(hinted, hinted)).toBe(true);
    expect(sameTripSnapshot(hinted, { ...hinted })).toBe(true);
    expect(sameTripSnapshot(hinted, unhinted)).toBe(false);
    expect(sameTripSnapshot(unhinted, hinted)).toBe(false);
  });

  it('has no fading light hint key in a zone with no lights', () => {
    for (const source of [zone, glowZone]) {
      const trip = createTrip(source);
      expect(tripSnapshot(trip)).not.toHaveProperty('fadingLightHint');
      expect(tripSnapshot(swimSteps(trip, deep, HINT_STEPS + 1))).not.toHaveProperty('fadingLightHint');
    }
    expect(idleTripSnapshot()).not.toHaveProperty('fadingLightHint');
  });
});
