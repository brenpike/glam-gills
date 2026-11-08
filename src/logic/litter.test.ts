import { describe, expect, it } from 'vitest';
import { areaFactCards } from './areas';
import { createEncounter, createEncounterContext, stepEncounter, type EncounterSource } from './encounter';
import { SHARP_LITTER_FACT, SHARP_LITTER_MEET_RANGE } from './factCards';
import { DARK_SHOWN_PARTS, shownInDark, type DarkWater } from './glowPlants';
import { hazardMet, hazardTouches, legHazardAt, type HazardSpawn } from './hazards';
import { presentCount } from './legs';
import { SHARP_LITTER, SHARP_LITTER_RADIUS, isLitter, litterSpawn, litters } from './litter';
import { murkyPatchSpawn } from './murkyWater';
import { GHOST_NETS, LEGS } from './tuning';
import type { Point } from './zone';

const DT = 1 / 60;
const CAN = litterSpawn('open-lake-3/litter-1', { x: 1000, y: 900 }, 'can');
const BOTTLE = litterSpawn('open-lake-3/litter-2', { x: 1400, y: 900 }, 'bottle');
const CAN_CENTRE: Point = { x: 1000, y: 900 };
const noRegrowCtx = createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 } });
const shellCtx = createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 }, shell: true });

/** An encounter source with no predators, its safe area far from the litter, and `hazards`. */
function litterSource(hazards: HazardSpawn[]): EncounterSource {
  return { safeArea: { x0: 0, x1: 100, y0: 100, y1: 300 }, tilapiaRoutes: [], hazards };
}

/** A point `distance` px right of the can's centre. */
function rightOfCan(distance: number): Point {
  return { x: CAN_CENTRE.x + distance, y: CAN_CENTRE.y };
}

/** The sentences of a card body. */
function sentences(body: string): string[] {
  return body.split(/(?<=[.!])\s+/);
}

describe('sharp litter type and spawn (issue #213)', () => {
  it('costs a leg, with the ghost net touch reach and the lure meet range', () => {
    expect(SHARP_LITTER).toEqual({
      id: 'sharp-litter',
      name: 'Sharp litter',
      costsLeg: true,
      reach: 18,
      meetRange: 120,
      fact: SHARP_LITTER_FACT,
    });
    expect(SHARP_LITTER.reach).toBe(GHOST_NETS.reach);
    expect(SHARP_LITTER_MEET_RANGE).toBe(120);
    expect(SHARP_LITTER_RADIUS).toBe(10);
    expect(Object.isFrozen(SHARP_LITTER)).toBe(true);
  });

  it('builds a still circle of the litter radius with its kind', () => {
    expect(CAN).toEqual({
      id: 'open-lake-3/litter-1',
      type: SHARP_LITTER,
      shape: { kind: 'circle', x: 1000, y: 900, r: 10 },
      litter: 'can',
    });
    expect(BOTTLE.litter).toBe('bottle');
    expect(CAN.drift).toBeUndefined();
    expect(CAN.pulse).toBeUndefined();
  });

  it('throws for a place that is not finite or a kind that is not litter', () => {
    expect(() => litterSpawn('bad', { x: Number.NaN, y: 900 }, 'can')).toThrow(RangeError);
    expect(() => litterSpawn('bad', { x: 1000, y: Infinity }, 'bottle')).toThrow(RangeError);
    expect(() => litterSpawn('bad', { x: 1000, y: 900 }, 'tyre' as never)).toThrow(RangeError);
  });

  it('picks out only the litter, in hazard order', () => {
    const murky = murkyPatchSpawn('murky', { x0: 0, x1: 100, y0: 0, y1: 100 });
    expect(litters([BOTTLE, murky, CAN])).toEqual([BOTTLE, CAN]);
    expect(isLitter(murky)).toBe(false);
    expect(isLitter({ ...CAN, litter: undefined })).toBe(false);
  });
});

describe('sharp litter touch and meet (issue #213)', () => {
  it('touches a body centre within 10 + 18 = 28 px of its centre and never beyond', () => {
    expect(hazardTouches(CAN, CAN_CENTRE)).toBe(true);
    expect(hazardTouches(CAN, rightOfCan(28))).toBe(true);
    expect(hazardTouches(CAN, rightOfCan(28.01))).toBe(false);
    expect(legHazardAt([CAN], rightOfCan(28))).toBe(CAN);
    expect(legHazardAt([CAN], rightOfCan(28.01))).toBeUndefined();
  });

  it('is met within 120 px of its edge and not beyond', () => {
    expect(hazardMet(CAN, rightOfCan(SHARP_LITTER_RADIUS + 120))).toBe(true);
    expect(hazardMet(CAN, rightOfCan(SHARP_LITTER_RADIUS + 120.01))).toBe(false);
  });
});

describe('sharp litter in the encounter (issue #213)', () => {
  it('keeps the litter kind when the encounter is built', () => {
    const state = createEncounter(litterSource([CAN, BOTTLE]));
    expect(state.hazards.map((hazard) => hazard.litter)).toEqual(['can', 'bottle']);
    expect(state.hazards[0]).not.toBe(CAN);
    expect(litters(state.hazards).map((hazard) => hazard.id)).toEqual([CAN.id, BOTTLE.id]);
  });

  it('lands one shared hit from its centre, with no push', () => {
    const result = stepEncounter(createEncounter(litterSource([CAN])), rightOfCan(20), DT, noRegrowCtx);
    expect(result.events).toEqual([
      { type: 'hit', sourceId: CAN.id, leg: 0, from: CAN_CENTRE },
      { type: 'regrowStart', leg: 0 },
    ]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count - 1);
    expect(result.state.legs.protectedLeft).toBe(LEGS.protectedTime);
    expect(result.impulse).toBeUndefined();
  });

  it('never hits a body centre beyond its touch reach', () => {
    const result = stepEncounter(createEncounter(litterSource([CAN])), rightOfCan(28.5), DT, noRegrowCtx);
    expect(result.events).toEqual([]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count);
  });

  it('lets the Shell block its hit', () => {
    const result = stepEncounter(createEncounter(litterSource([CAN])), rightOfCan(20), DT, shellCtx);
    expect(result.events).toEqual([{ type: 'shellBlock', sourceId: CAN.id, from: CAN_CENTRE }]);
    expect(presentCount(result.state.legs)).toBe(LEGS.count);
    expect(result.state.shellUsed).toBe(true);
    expect(result.impulse).toBeUndefined();
  });
});

describe('sharp litter in the dark (issue #213)', () => {
  it('is never hidden by dark water, even with no light on it', () => {
    const dark: DarkWater = { x0: 800, x1: 1600, y0: 700, y1: 1000 };
    expect(DARK_SHOWN_PARTS).toContain('hazard');
    for (const spawn of [CAN, BOTTLE]) {
      expect(shownInDark('hazard', { x: spawn.shape.x, y: spawn.shape.y }, dark, [])).toBe(true);
    }
  });
});

describe('sharp litter fact card copy (issue #213)', () => {
  it('has the sharp litter id, name, title and body, no hint of its own and frozen data', () => {
    expect(SHARP_LITTER_FACT).toEqual({
      id: 'sharp-litter',
      name: 'Sharp litter',
      title: 'Litter in the water',
      body: "People drop cans and glass bottles into Xochimilco's water. They can sink to the bottom, and sharp edges can hurt animals. Put rubbish in a bin!",
    });
    expect(SHARP_LITTER_FACT.unfoundHint).toBeUndefined();
    expect(Object.isFrozen(SHARP_LITTER_FACT)).toBe(true);
  });

  it('never names an axolotl or another amphibian as prey or food', () => {
    expect(SHARP_LITTER_FACT.body).not.toMatch(/\b(eat\w*|hunt\w*|catch\w*|prey|grab\w*|swallow\w*|food|amphibian\w*)\b/i);
  });

  it('ends with a tip', () => {
    expect(sentences(SHARP_LITTER_FACT.body).at(-1)).toBe('Put rubbish in a bin!');
  });

  it('keeps the name, title and body no longer than the longest other area card', () => {
    const others = areaFactCards().filter((card) => card.id !== SHARP_LITTER_FACT.id);
    const longest = (field: 'name' | 'title' | 'body') => Math.max(...others.map((card) => card[field].length));
    expect(SHARP_LITTER_FACT.name.length).toBeLessThanOrEqual(longest('name'));
    expect(SHARP_LITTER_FACT.title.length).toBeLessThanOrEqual(longest('title'));
    expect(SHARP_LITTER_FACT.body.length).toBeLessThanOrEqual(longest('body'));
  });
});
