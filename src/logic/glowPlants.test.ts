import { describe, expect, it } from 'vitest';
import { PERK_CAPS } from './perks';
import {
  DARK_HIDDEN_PARTS,
  DARK_SHOWN_PARTS,
  GLOW_PLANTS,
  darkHintPlant,
  darkLights,
  darknessMayHide,
  glowMotion,
  glowPlantReachable,
  glowPlantSpawn,
  glowPlants,
  glowShowsBeforeReach,
  inDarkWater,
  lightGlowPlants,
  lightShare,
  litByAny,
  shownInDark,
  stepDarkHintClock,
  touchesGlowPlant,
  type DarkHintStep,
  type DarkWater,
  type DarkWaterPart,
} from './glowPlants';
import { GLOW_PLANT, type ElementSpawn } from './hazards';
import { WATER_HYACINTH } from './hyacinthMats';
import { SHRIMP, SNACK_REACH, SWIM, TADPOLES } from './tuning';
import { areaSize, swimBounds, type Point } from './zone';

const SIZE = areaSize(5, 3);
const BOUNDS = swimBounds(SIZE);
const DARK: DarkWater = { x0: 1200, x1: 2400, y0: 720, y1: SIZE.bedTop };
const EXIT: Point = { x: 2300, y: 980 };
const AWAY: Point = { x: 200, y: 200 };

const PLANTS: readonly ElementSpawn[] = [
  glowPlantSpawn('test/glow-plant-1', { x: 1300, y: 900, radius: 14 }),
  glowPlantSpawn('test/glow-plant-2', { x: 1600, y: 800, radius: 14 }),
  glowPlantSpawn('test/glow-plant-3', { x: 1900, y: 1000, radius: 14 }),
  glowPlantSpawn('test/glow-plant-4', { x: 2200, y: 760, radius: 14 }),
];
const MAT: ElementSpawn = {
  id: 'test/mats-1',
  type: WATER_HYACINTH,
  offset: 0,
  matPair: { x0: 400, x1: 460, rowTop: 80, rowBottom: 360, channelY: 220, openHeight: 72 },
};
const ELEMENTS: readonly ElementSpawn[] = [MAT, ...PLANTS];
const PLANT_IDS = PLANTS.map((plant) => plant.id);

const ALL_PARTS: readonly DarkWaterPart[] = [...DARK_HIDDEN_PARTS, ...DARK_SHOWN_PARTS];

/** Every point of the dark water on a grid `step` px apart, edges included. */
function darkGrid(dark: DarkWater, step: number): Point[] {
  const points: Point[] = [];
  for (let x = dark.x0; x <= dark.x1; x += step) {
    for (let y = dark.y0; y <= dark.y1; y += step) points.push({ x, y });
  }
  return points;
}

function step(overrides: Partial<DarkHintStep>): DarkHintStep {
  return { dt: 0.05, inDark: true, newLight: false, paused: false, ...overrides };
}

describe('the dark water (issue #77, ND-7)', () => {
  it('covers its rect with inclusive edges', () => {
    expect(inDarkWater({ x: 1200, y: 720 }, DARK)).toBe(true);
    expect(inDarkWater({ x: 2400, y: SIZE.bedTop }, DARK)).toBe(true);
    expect(inDarkWater({ x: 1800, y: 900 }, DARK)).toBe(true);
    expect(inDarkWater({ x: 1199.9, y: 900 }, DARK)).toBe(false);
    expect(inDarkWater({ x: 1800, y: 719.9 }, DARK)).toBe(false);
  });

  it('may hide only scenery, snacks, treasure spots, their hint sparkles and finds', () => {
    expect(DARK_HIDDEN_PARTS).toEqual(['scenery', 'snack', 'treasure-spot', 'hint-sparkle', 'find']);
    for (const part of DARK_HIDDEN_PARTS) expect(darknessMayHide(part)).toBe(true);
  });

  it('never hides the axolotl, the exit, the Home Spot, a predator, a moving hazard, a warning, a stranded axolotl or a glow-plant', () => {
    expect(DARK_SHOWN_PARTS).toEqual([
      'axolotl',
      'exit',
      'home-spot',
      'predator',
      'moving-hazard',
      'warning',
      'stranded-axolotl',
      'glow-plant',
    ]);
    for (const part of DARK_SHOWN_PARTS) expect(darknessMayHide(part)).toBe(false);
    expect(DARK_HIDDEN_PARTS.some((part) => DARK_SHOWN_PARTS.includes(part))).toBe(false);
  });

  it('hides a hideable part in the dark with no light on it', () => {
    for (const part of DARK_HIDDEN_PARTS) expect(shownInDark(part, { x: 1800, y: 900 }, DARK, [])).toBe(false);
  });

  it('shows every part out of the dark, and every part in an area with no dark water', () => {
    for (const part of ALL_PARTS) {
      expect(shownInDark(part, { x: 600, y: 900 }, DARK, [])).toBe(true);
      expect(shownInDark(part, { x: 1800, y: 900 }, undefined, [])).toBe(true);
    }
  });

  it('shows a hideable part a light reaches, edge included', () => {
    const light = { x: 1800, y: 900, radius: 120 };
    expect(shownInDark('snack', { x: 1920, y: 900 }, DARK, [light])).toBe(true);
    expect(shownInDark('snack', { x: 1920.1, y: 900 }, DARK, [light])).toBe(false);
    expect(litByAny({ x: 1800, y: 1020 }, [light])).toBe(true);
  });
});

describe('glow-plant spawns (issue #77, ND-8)', () => {
  it('builds an always-active glow-plant with its own copy of the geometry', () => {
    const spot = { x: 1300, y: 900, radius: 14 };
    const spawn = glowPlantSpawn('test/glow-plant-9', spot);
    expect(spawn).toEqual({ id: 'test/glow-plant-9', type: GLOW_PLANT, offset: 0, glowPlant: spot });
    expect(spawn.type).toBe(GLOW_PLANT);
    expect(spawn.glowPlant).not.toBe(spot);
  });

  it.each([
    ['a zero radius', { x: 1, y: 1, radius: 0 }],
    ['a negative radius', { x: 1, y: 1, radius: -4 }],
    ['a NaN radius', { x: 1, y: 1, radius: Number.NaN }],
    ['an infinite radius', { x: 1, y: 1, radius: Infinity }],
    ['a NaN x', { x: Number.NaN, y: 1, radius: 14 }],
    ['an infinite y', { x: 1, y: -Infinity, radius: 14 }],
  ])('throws RangeError for %s', (_, spot) => {
    expect(() => glowPlantSpawn('test/bad', spot)).toThrow(RangeError);
  });

  it('lists only the glow-plants, in element order', () => {
    expect(glowPlants(ELEMENTS).map((plant) => plant.id)).toEqual(PLANT_IDS);
    expect(glowPlants([MAT])).toEqual([]);
  });
});

describe('lighting a glow-plant (issue #77, ND-8)', () => {
  const spot = { x: 1300, y: 900, radius: 14 };

  it('counts a touch when the body edge reaches the plant, edge included', () => {
    const reach = spot.radius + GLOW_PLANTS.bodyReach;
    expect(touchesGlowPlant({ x: spot.x + reach, y: spot.y }, spot)).toBe(true);
    expect(touchesGlowPlant({ x: spot.x + reach + 0.1, y: spot.y }, spot)).toBe(false);
  });

  it('returns the same lit list when no new plant is touched', () => {
    const lit: readonly string[] = [];
    expect(lightGlowPlants(lit, ELEMENTS, AWAY)).toBe(lit);
    const one = [PLANT_IDS[0]];
    expect(lightGlowPlants(one, ELEMENTS, { x: 1300, y: 900 })).toBe(one);
  });

  it('appends each newly touched plant and keeps every lit plant lit', () => {
    const first = lightGlowPlants([], ELEMENTS, { x: 1600, y: 800 });
    expect(first).toEqual([PLANT_IDS[1]]);
    const second = lightGlowPlants(first, ELEMENTS, { x: 1300, y: 900 });
    expect(second).toEqual([PLANT_IDS[1], PLANT_IDS[0]]);
    expect(lightGlowPlants(second, ELEMENTS, AWAY)).toEqual(second);
    expect(first).toEqual([PLANT_IDS[1]]);
  });

  it('lights two touched plants in element order', () => {
    const close = [
      glowPlantSpawn('test/glow-plant-b', { x: 1320, y: 900, radius: 14 }),
      glowPlantSpawn('test/glow-plant-a', { x: 1280, y: 900, radius: 14 }),
    ];
    expect(lightGlowPlants([], close, { x: 1300, y: 900 })).toEqual(['test/glow-plant-b', 'test/glow-plant-a']);
  });

  it('never lights a mat pair or changes the elements, so a new trip from the same data starts unlit', () => {
    const before = structuredClone(ELEMENTS);
    expect(lightGlowPlants([], ELEMENTS, { x: 430, y: 220 })).toEqual([]);
    lightGlowPlants([], ELEMENTS, { x: 1300, y: 900 });
    expect(ELEMENTS).toEqual(before);
  });
});

describe('the lights (issue #77, ND-7)', () => {
  it('always gives the axolotl its 120 px glow and the exit its faint glow', () => {
    expect(darkLights({ axolotl: { x: 1500, y: 900 }, exit: EXIT, elements: ELEMENTS, lit: [] })).toEqual([
      { x: 1500, y: 900, radius: 120 },
      { x: EXIT.x, y: EXIT.y, radius: GLOW_PLANTS.exitGlow },
    ]);
  });

  it('adds about 200 px of light round each lit plant, in element order', () => {
    const lights = darkLights({ axolotl: AWAY, exit: EXIT, elements: ELEMENTS, lit: [PLANT_IDS[2], PLANT_IDS[0]] });
    expect(lights.slice(2)).toEqual([
      { x: 1300, y: 900, radius: 200 },
      { x: 1900, y: 1000, radius: 200 },
    ]);
  });

  it('adds nothing for a lit id that names no glow-plant', () => {
    expect(darkLights({ axolotl: AWAY, exit: EXIT, elements: ELEMENTS, lit: [MAT.id, 'test/none'] })).toHaveLength(2);
  });
});

describe('the hint clock (issue #77, ND-8)', () => {
  it('counts game time in the dark', () => {
    expect(stepDarkHintClock(3, step({ dt: 0.05 }))).toBeCloseTo(3.05, 9);
  });

  it('holds while paused: the game, the banking card or the carry home', () => {
    expect(stepDarkHintClock(12, step({ paused: true, dt: 0.05 }))).toBe(12);
    expect(stepDarkHintClock(12, step({ paused: true, inDark: false }))).toBe(12);
  });

  it('goes back to 0 out of the dark or when a new plant lights', () => {
    expect(stepDarkHintClock(25, step({ inDark: false }))).toBe(0);
    expect(stepDarkHintClock(25, step({ newLight: true }))).toBe(0);
  });

  it.each([-0.01, Number.NaN, Infinity])('throws RangeError for a dt of %s', (dt) => {
    expect(() => stepDarkHintClock(0, step({ dt }))).toThrow(RangeError);
  });

  it('reaches the hint after 20 s of unpaused steps in the dark, not counting the paused ones', () => {
    let seconds = 0;
    for (let k = 0; k < 400; k += 1) seconds = stepDarkHintClock(seconds, step({ dt: 0.05, paused: k % 2 === 1 }));
    expect(darkHintPlant(seconds, { x: 1300, y: 900 }, ELEMENTS, [])).toBeNull();
    for (let k = 0; k < 200; k += 1) seconds = stepDarkHintClock(seconds, step({ dt: 0.05 }));
    expect(seconds).toBeCloseTo(20, 9);
  });
});

describe('the hint (issue #77, ND-8)', () => {
  it('shows nothing before 20 s', () => {
    expect(GLOW_PLANTS.hintAfter).toBe(20);
    expect(darkHintPlant(19.99, { x: 1300, y: 900 }, ELEMENTS, [])).toBeNull();
  });

  it('points at the nearest unlit plant', () => {
    expect(darkHintPlant(20, { x: 1650, y: 820 }, ELEMENTS, [])).toBe(PLANT_IDS[1]);
    expect(darkHintPlant(20, { x: 1650, y: 820 }, ELEMENTS, [PLANT_IDS[1]])).toBe(PLANT_IDS[2]);
  });

  it('takes the first plant in element order on a tie', () => {
    expect(darkHintPlant(20, { x: 1450, y: 850 }, ELEMENTS, [])).toBe(PLANT_IDS[0]);
  });

  it('shows nothing once every plant is lit', () => {
    expect(darkHintPlant(60, { x: 1650, y: 820 }, ELEMENTS, PLANT_IDS)).toBeNull();
  });
});

describe('reduced motion (issue #77, ND-18)', () => {
  it('grows a light in and pulses the hint with full motion', () => {
    const motion = glowMotion(false);
    expect(motion).toEqual({ lightFadeIn: GLOW_PLANTS.lightFadeIn, hint: 'pulse' });
    expect(lightShare(0, motion)).toBe(0);
    expect(lightShare(GLOW_PLANTS.lightFadeIn / 2, motion)).toBeCloseTo(0.5, 9);
    expect(lightShare(GLOW_PLANTS.lightFadeIn * 3, motion)).toBe(1);
  });

  it('shows a light at once and brightens the hint outline under reduced motion', () => {
    const motion = glowMotion(true);
    expect(motion).toEqual({ lightFadeIn: 0, hint: 'brighten' });
    expect(lightShare(0, motion)).toBe(1);
  });

  it.each([-1, Number.NaN, Infinity])('throws RangeError for a time since lit of %s', (sinceLit) => {
    expect(() => lightShare(sinceLit, glowMotion(false))).toThrow(RangeError);
  });
});

describe('the dark part can always be finished (issue #77, ND-9)', () => {
  const unlit = darkLights({ axolotl: AWAY, exit: EXIT, elements: ELEMENTS, lit: [] });

  it('shows the exit and its glow with no plant lit, the axolotl far away', () => {
    expect(inDarkWater(EXIT, DARK)).toBe(true);
    expect(shownInDark('exit', EXIT, DARK, unlit)).toBe(true);
    expect(litByAny(EXIT, unlit)).toBe(true);
    const exitRadius = 40;
    for (let k = 0; k < 16; k += 1) {
      const angle = (k / 16) * Math.PI * 2;
      const edge = { x: EXIT.x + exitRadius * Math.cos(angle), y: EXIT.y + exitRadius * Math.sin(angle) };
      expect(litByAny(edge, unlit), `exit edge at ${k}`).toBe(true);
    }
  });

  it('shows every glow-plant with no plant lit, each reachable from the swim bounds', () => {
    for (const plant of glowPlants(ELEMENTS)) {
      expect(shownInDark('glow-plant', plant.glowPlant, DARK, [])).toBe(true);
      expect(glowPlantReachable(plant.glowPlant, BOUNDS)).toBe(true);
    }
  });

  it('finds a plant out of reach of every body centre unreachable', () => {
    const far = { x: BOUNDS.maxX + 14 + GLOW_PLANTS.bodyReach + 1, y: 900, radius: 14 };
    const edge = { ...far, x: BOUNDS.maxX + 14 + GLOW_PLANTS.bodyReach };
    expect(glowPlantReachable(far, BOUNDS)).toBe(false);
    expect(glowPlantReachable(edge, BOUNDS)).toBe(true);
  });

  it("shows every snack, a tadpole or a shrimp included, in the axolotl's own glow at least one step before it is in reach", () => {
    const eatReach = SNACK_REACH.headAhead + SNACK_REACH.radius;
    const magnetReach = SNACK_REACH.headAhead + PERK_CAPS.snackMagnet;
    const fastestSwim = Math.max(SWIM.dashSpeed, SWIM.maxSpeed * (1 + PERK_CAPS.speed / 100));
    const fastestSnack = Math.max(TADPOLES.maxSpeed, SHRIMP.maxFlickSpeed);
    const closingStep = (fastestSwim + fastestSnack) * SWIM.dtMax;
    expect(glowShowsBeforeReach(eatReach, closingStep)).toBe(true);
    expect(glowShowsBeforeReach(magnetReach, closingStep)).toBe(true);
    expect(glowShowsBeforeReach(GLOW_PLANTS.axolotlGlow, 0)).toBe(false);
  });

  it('shows a snack in reach of the axolotl anywhere in the dark with no plant lit', () => {
    const reach = SNACK_REACH.headAhead + PERK_CAPS.snackMagnet;
    for (const body of darkGrid(DARK, 120)) {
      const lights = darkLights({ axolotl: body, exit: EXIT, elements: ELEMENTS, lit: [] });
      const snack = { x: body.x + reach, y: body.y };
      expect(shownInDark('snack', snack, DARK, lights)).toBe(true);
    }
  });

  it('keeps the hint on an unlit plant while one is left, in any lighting order', () => {
    const orders = [PLANT_IDS, [...PLANT_IDS].reverse(), [PLANT_IDS[2], PLANT_IDS[0], PLANT_IDS[3], PLANT_IDS[1]]];
    for (const order of orders) {
      const lit: string[] = [];
      for (const id of order) {
        for (const body of darkGrid(DARK, 200)) {
          const hinted = darkHintPlant(GLOW_PLANTS.hintAfter, body, ELEMENTS, lit);
          expect(hinted).not.toBeNull();
          expect(lit).not.toContain(hinted);
          expect(PLANT_IDS).toContain(hinted);
        }
        lit.push(id);
      }
      expect(darkHintPlant(GLOW_PLANTS.hintAfter, { x: 1800, y: 900 }, ELEMENTS, lit)).toBeNull();
    }
  });

  it('never puts a part the darkness may never hide under it, anywhere in the dark with no light', () => {
    for (const pos of darkGrid(DARK, 60)) {
      for (const part of DARK_SHOWN_PARTS) expect(shownInDark(part, pos, DARK, []), `${part} at ${pos.x}, ${pos.y}`).toBe(true);
    }
  });
});
