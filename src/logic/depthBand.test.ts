import { describe, expect, it } from 'vitest';
import {
  DEEP_BAND,
  bandRarities,
  deepestWaterBand,
  depthBandAt,
  depthBandName,
  raritySpotsInDeepestBand,
  spotFitsBand,
} from './depthBand';
import { RARITIES } from './catalogue';
import { SCREEN_W, WORLD_H, areaSize, swimBounds } from './zone';

/** Area 12's bowl (issue #211): 9 screens wide, 2 down, rock under the 3 screens at each end of the bottom row. */
const BOWL = {
  screensWide: 9,
  screensTall: 2,
  rockWalls: [
    { x0: 0, x1: SCREEN_W * 3, y0: WORLD_H, y1: WORLD_H * 2 },
    { x0: SCREEN_W * 6, x1: SCREEN_W * 9, y0: WORLD_H, y1: WORLD_H * 2 },
  ],
};

describe('depthBandAt (issue #211, ND-1)', () => {
  it('pins band 1 to the top screen row, from y 0 up to but not including WORLD_H', () => {
    expect(WORLD_H).toBe(360);
    expect(depthBandAt(0)).toBe(1);
    expect(depthBandAt(WORLD_H - 0.001)).toBe(1);
  });

  it('pins band 2 to the second row, its top edge included', () => {
    expect(depthBandAt(WORLD_H)).toBe(2);
    expect(depthBandAt(WORLD_H * 2 - 0.001)).toBe(2);
  });

  it('gives each lower row its own band from band 3 on', () => {
    expect(depthBandAt(WORLD_H * 2)).toBe(3);
    expect(depthBandAt(WORLD_H * 3 - 0.001)).toBe(3);
    expect(depthBandAt(WORLD_H * 3)).toBe(4);
  });

  it.each([-0.001, -WORLD_H, Number.NaN, Number.POSITIVE_INFINITY])('throws a RangeError for y %s', (y) => {
    expect(() => depthBandAt(y)).toThrow(RangeError);
  });
});

describe('depthBandName (issue #211, ND-1)', () => {
  it('names band 1 the shallows, band 2 the middle and band 3 and deeper the deep', () => {
    expect(depthBandName(1)).toBe('shallows');
    expect(depthBandName(2)).toBe('middle');
    expect(depthBandName(DEEP_BAND)).toBe('deep');
    expect(depthBandName(DEEP_BAND + 2)).toBe('deep');
  });

  it.each([0, -1, 1.5, Number.NaN])('throws a RangeError for band %s', (band) => {
    expect(() => depthBandName(band)).toThrow(RangeError);
  });
});

describe('bandRarities (issue #211, ND-2)', () => {
  it('allows only Common in band 1', () => {
    expect(bandRarities(1)).toEqual(['common']);
  });

  it('allows only Rare in band 2', () => {
    expect(bandRarities(2)).toEqual(['rare']);
  });

  it('allows only Epic and Legendary in band 3 and every band below it', () => {
    expect(bandRarities(3)).toEqual(['epic', 'legendary']);
    expect(bandRarities(7)).toEqual(['epic', 'legendary']);
  });

  it('gives every rarity exactly one band kind', () => {
    const allowed = [...bandRarities(1), ...bandRarities(2), ...bandRarities(3)];
    expect([...allowed].sort()).toEqual([...RARITIES].sort());
  });

  it('returns frozen lists', () => {
    expect(Object.isFrozen(bandRarities(1))).toBe(true);
    expect(Object.isFrozen(bandRarities(2))).toBe(true);
    expect(Object.isFrozen(bandRarities(3))).toBe(true);
  });

  it.each([0, 2.5, Number.NaN])('throws a RangeError for band %s', (band) => {
    expect(() => bandRarities(band)).toThrow(RangeError);
  });
});

describe('spotFitsBand (issue #211, ND-2)', () => {
  it('fits a spot whose rarity its band allows', () => {
    expect(spotFitsBand({ y: 200, rarity: 'common' })).toBe(true);
    expect(spotFitsBand({ y: WORLD_H, rarity: 'rare' })).toBe(true);
    expect(spotFitsBand({ y: WORLD_H * 2 + 100, rarity: 'epic' })).toBe(true);
    expect(spotFitsBand({ y: WORLD_H * 3 + 100, rarity: 'legendary' })).toBe(true);
  });

  it('rejects a spot whose rarity its band does not allow', () => {
    expect(spotFitsBand({ y: 200, rarity: 'rare' })).toBe(false);
    expect(spotFitsBand({ y: WORLD_H - 1, rarity: 'rare' })).toBe(false);
    expect(spotFitsBand({ y: WORLD_H + 100, rarity: 'common' })).toBe(false);
    expect(spotFitsBand({ y: WORLD_H + 100, rarity: 'epic' })).toBe(false);
    expect(spotFitsBand({ y: WORLD_H * 2, rarity: 'rare' })).toBe(false);
  });

  it('throws a RangeError for a spot above the area', () => {
    expect(() => spotFitsBand({ y: -1, rarity: 'common' })).toThrow(RangeError);
  });
});

describe('deepestWaterBand (issue #211, ND-1, ND-2)', () => {
  it('finds band 2 in the Area 12 bowl, whose middle three screens of the bottom row are open', () => {
    expect(deepestWaterBand(BOWL)).toBe(2);
  });

  it('is the bottom row when there are no rock walls', () => {
    expect(deepestWaterBand({ screensWide: 3, screensTall: 1 })).toBe(1);
    expect(deepestWaterBand({ screensWide: 3, screensTall: 3, rockWalls: [] })).toBe(3);
  });

  it('skips a bottom row the rock walls wholly cover', () => {
    const walls = [{ x0: 0, x1: SCREEN_W * 9, y0: WORLD_H, y1: WORLD_H * 2 }];
    expect(deepestWaterBand({ screensWide: 9, screensTall: 2, rockWalls: walls })).toBe(1);
  });

  it('counts a row as covered when walls reach only the swim bounds, not the area edges', () => {
    const bounds = swimBounds(areaSize(4, 2));
    const walls = [{ x0: bounds.minX, x1: bounds.maxX, y0: WORLD_H, y1: bounds.maxY }];
    expect(deepestWaterBand({ screensWide: 4, screensTall: 2, rockWalls: walls })).toBe(1);
  });

  it('counts a row as covered by walls that tile it together, side by side and stacked', () => {
    const walls = [
      { x0: 0, x1: SCREEN_W * 2, y0: WORLD_H, y1: WORLD_H * 2 },
      { x0: SCREEN_W * 2, x1: SCREEN_W * 4, y0: WORLD_H, y1: WORLD_H + 100 },
      { x0: SCREEN_W * 2, x1: SCREEN_W * 4, y0: WORLD_H + 100, y1: WORLD_H * 2 },
    ];
    expect(deepestWaterBand({ screensWide: 4, screensTall: 2, rockWalls: walls })).toBe(1);
  });

  it('finds water through a narrow gap between walls', () => {
    const walls = [
      { x0: 0, x1: SCREEN_W * 2 - 10, y0: WORLD_H, y1: WORLD_H * 2 },
      { x0: SCREEN_W * 2, x1: SCREEN_W * 4, y0: WORLD_H, y1: WORLD_H * 2 },
    ];
    expect(deepestWaterBand({ screensWide: 4, screensTall: 2, rockWalls: walls })).toBe(2);
  });

  it('finds water left open just above the bed', () => {
    const bounds = swimBounds(areaSize(4, 2));
    const walls = [{ x0: 0, x1: SCREEN_W * 4, y0: WORLD_H, y1: bounds.maxY - 1 }];
    expect(deepestWaterBand({ screensWide: 4, screensTall: 2, rockWalls: walls })).toBe(2);
  });

  it('looks past a covered middle row to open water below it', () => {
    const walls = [{ x0: 0, x1: SCREEN_W * 3, y0: WORLD_H, y1: WORLD_H * 2 }];
    expect(deepestWaterBand({ screensWide: 3, screensTall: 3, rockWalls: walls })).toBe(3);
  });

  it('throws a RangeError when rock covers every row', () => {
    const walls = [{ x0: 0, x1: SCREEN_W * 2, y0: 0, y1: WORLD_H * 2 }];
    expect(() => deepestWaterBand({ screensWide: 2, screensTall: 2, rockWalls: walls })).toThrow(RangeError);
  });

  it.each([
    [0, 1],
    [1, 0],
    [1.5, 1],
    [1, Number.NaN],
  ])('throws a RangeError for %s x %s screens', (screensWide, screensTall) => {
    expect(() => deepestWaterBand({ screensWide, screensTall })).toThrow(RangeError);
  });
});

describe('raritySpotsInDeepestBand (issue #211, ND-2)', () => {
  const deepest = deepestWaterBand(BOWL);

  it('passes when every spot of the rarity lies in the deepest band', () => {
    const spots = [
      { y: 200, rarity: 'common' as const },
      { y: WORLD_H + 50, rarity: 'rare' as const },
      { y: WORLD_H + 150, rarity: 'rare' as const },
    ];
    expect(raritySpotsInDeepestBand(spots, 'rare', deepest)).toBe(true);
  });

  it('fails when any spot of the rarity lies above the deepest band', () => {
    const spots = [
      { y: WORLD_H + 50, rarity: 'rare' as const },
      { y: WORLD_H - 1, rarity: 'rare' as const },
    ];
    expect(raritySpotsInDeepestBand(spots, 'rare', deepest)).toBe(false);
  });

  it('fails when any spot of the rarity lies below the given band', () => {
    const spots = [
      { y: WORLD_H * 2 + 50, rarity: 'epic' as const },
      { y: WORLD_H * 3 + 50, rarity: 'epic' as const },
    ];
    expect(raritySpotsInDeepestBand(spots, 'epic', 3)).toBe(false);
  });

  it('ignores spots of other rarities', () => {
    const spots = [
      { y: 100, rarity: 'common' as const },
      { y: WORLD_H + 50, rarity: 'rare' as const },
    ];
    expect(raritySpotsInDeepestBand(spots, 'rare', deepest)).toBe(true);
  });

  it('fails when no spot has the rarity, so the special treasure has nowhere to sit', () => {
    expect(raritySpotsInDeepestBand([{ y: 100, rarity: 'common' }], 'rare', deepest)).toBe(false);
    expect(raritySpotsInDeepestBand([], 'rare', deepest)).toBe(false);
  });

  it.each([0, 1.5])('throws a RangeError for band %s', (band) => {
    expect(() => raritySpotsInDeepestBand([], 'rare', band)).toThrow(RangeError);
  });
});
