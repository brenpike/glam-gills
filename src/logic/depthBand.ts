/**
 * Pure depth band rules (issue #211, ND-1, ND-2). In an area that opts in, each screen row is one
 * depth band: band 1 is the top row (the shallows), band 2 the middle row, and band 3 and every row
 * below it the deep. Each band allows only some spot rarities, and the area's special treasure
 * rarity sits only in the deepest band that holds swimmable water.
 */
import type { Rarity } from './catalogue';
import type { RockWall } from './pebble';
import { WORLD_H, areaSize, swimBounds, type AreaLayoutData, type HidingSpot } from './zone';

/** A depth band's name (issue #211, ND-1): band 1 the shallows, band 2 the middle, band 3 and deeper the deep. */
export type DepthBandName = 'shallows' | 'middle' | 'deep';

/** The first band named the deep (issue #211, ND-1); every band below it is the deep too. */
export const DEEP_BAND = 3;

const SHALLOWS_RARITIES: readonly Rarity[] = Object.freeze(['common']);
const MIDDLE_RARITIES: readonly Rarity[] = Object.freeze(['rare']);
const DEEP_RARITIES: readonly Rarity[] = Object.freeze(['epic', 'legendary']);

/** Throws a RangeError unless `band` is a 1-based band number. */
function assertBand(band: number, caller: string): void {
  if (!Number.isInteger(band) || band < 1) {
    throw new RangeError(`${caller} needs an integer band of 1 or more, got ${band}`);
  }
}

/**
 * The 1-based depth band of world y (issue #211, ND-1): one band per screen row of WORLD_H px, so
 * band 1 is y in [0, WORLD_H), band 2 is [WORLD_H, 2 * WORLD_H) and so on. A row's top edge belongs
 * to its own band. Throws a RangeError for a y that is not finite or is above the area (y < 0).
 */
export function depthBandAt(y: number): number {
  if (!Number.isFinite(y) || y < 0) {
    throw new RangeError(`depthBandAt needs a finite world y of 0 or more, got ${y}`);
  }
  return Math.floor(y / WORLD_H) + 1;
}

/** The name of `band` (issue #211, ND-1). Throws a RangeError for a band that is not an integer of 1 or more. */
export function depthBandName(band: number): DepthBandName {
  assertBand(band, 'depthBandName');
  if (band === 1) return 'shallows';
  return band === 2 ? 'middle' : 'deep';
}

/**
 * The spot rarities `band` allows (issue #211, ND-2): band 1 Common, band 2 Rare, band 3 and deeper
 * Epic and Legendary. Throws a RangeError for a band that is not an integer of 1 or more.
 */
export function bandRarities(band: number): readonly Rarity[] {
  assertBand(band, 'bandRarities');
  if (band === 1) return SHALLOWS_RARITIES;
  return band === 2 ? MIDDLE_RARITIES : DEEP_RARITIES;
}

/** True when the band at the spot's y allows the spot's rarity (issue #211, ND-2). Throws as depthBandAt does. */
export function spotFitsBand(spot: Readonly<Pick<HidingSpot, 'y' | 'rarity'>>): boolean {
  return bandRarities(depthBandAt(spot.y)).includes(spot.rarity);
}

/** True when the union of `walls` covers the whole rectangle [x0, x1] x [y0, y1]; inclusive wall edges. */
function wallsCover(walls: readonly Readonly<RockWall>[], x0: number, x1: number, y0: number, y1: number): boolean {
  const edges = walls.flatMap((wall) => [wall.y0, wall.y1]).filter((edge) => edge > y0 && edge < y1);
  const cuts = [...new Set([y0, ...edges, y1])].sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const spanning = walls.filter((wall) => wall.y0 <= cuts[i] && wall.y1 >= cuts[i + 1]);
    if (!spansCoverX(spanning, x0, x1)) return false;
  }
  return true;
}

/** True when the x spans of `walls` together cover [x0, x1] with no gap. */
function spansCoverX(walls: readonly Readonly<RockWall>[], x0: number, x1: number): boolean {
  const spans = [...walls].sort((a, b) => a.x0 - b.x0);
  let reach = x0;
  for (const wall of spans) {
    if (wall.x0 > reach) return false;
    reach = Math.max(reach, wall.x1);
    if (reach >= x1) return true;
  }
  return reach >= x1;
}

/**
 * The deepest band that holds swimmable water (issue #211, ND-1, ND-2): the band of the lowest
 * screen row whose part of the area's swim bounds (swimBounds of areaSize) the rock walls do not
 * wholly cover. Throws a RangeError when `screensWide` or `screensTall` is not an integer of 1 or
 * more, or when the rock walls cover every row's water.
 */
export function deepestWaterBand(area: Pick<AreaLayoutData, 'screensWide' | 'screensTall' | 'rockWalls'>): number {
  const { screensWide, screensTall } = area;
  if (!Number.isInteger(screensWide) || screensWide < 1 || !Number.isInteger(screensTall) || screensTall < 1) {
    throw new RangeError(`deepestWaterBand needs integer screens of 1 or more, got ${screensWide} x ${screensTall}`);
  }
  const bounds = swimBounds(areaSize(screensWide, screensTall));
  const walls = area.rockWalls ?? [];
  for (let row = screensTall - 1; row >= 0; row--) {
    const top = Math.max(row * WORLD_H, bounds.minY);
    const bottom = Math.min((row + 1) * WORLD_H, bounds.maxY);
    if (top < bottom && !wallsCover(walls, bounds.minX, bounds.maxX, top, bottom)) return row + 1;
  }
  throw new RangeError(`deepestWaterBand found no swimmable water in ${screensWide} x ${screensTall} screens`);
}

/**
 * True when at least one spot has `rarity` and every spot with it lies in `deepestBand` (issue #211,
 * ND-2), the rule for the special treasure's rarity. False when no spot has `rarity`, since the
 * special treasure then has nowhere to sit. Throws a RangeError for a band that is not an integer of
 * 1 or more, and as depthBandAt does for a spot's y.
 */
export function raritySpotsInDeepestBand(
  spots: readonly Readonly<Pick<HidingSpot, 'y' | 'rarity'>>[],
  rarity: Rarity,
  deepestBand: number,
): boolean {
  assertBand(deepestBand, 'raritySpotsInDeepestBand');
  const held = spots.filter((spot) => spot.rarity === rarity);
  return held.length > 0 && held.every((spot) => depthBandAt(spot.y) === deepestBand);
}
