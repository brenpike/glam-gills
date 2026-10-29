/**
 * Phaser glue for the spring cave props (issue #77, ND-15 and ND-18): bakes the side grotto's back
 * and front, the rock ledge, the spring outflow marks, the glow-plant in its three states, the
 * soft light and the two dark edge fade strips into CanvasTextures. The row details (pool, walls, rock bed) are painted into the
 * background chunks by drawSpringCave.ts, so they have no texture here.
 * Visual only. No game state, no input, no physics.
 *
 * Same rules as textures.ts: every texture is drawn at `bakeScale` through the context transform,
 * so the ink stays constant, and a sprite shows at logical size with setScale(1 / info.scale). The
 * soft light and the dark edge fade strips have no ink and nothing sharp, so they bake at
 * SOFT_LIGHT_BAKE_SCALE or less.
 */
import * as Phaser from 'phaser';
import {
  DARK_FADE_TEX,
  GLOW_PLANT_TEX,
  GROTTO_TEX,
  OUTFLOW_TEX,
  ROCK_LEDGE_TEX,
  SOFT_LIGHT_TEX,
  paintDarkEdgeFade,
  paintGlowPlant,
  paintGrottoBack,
  paintGrottoFront,
  paintRockLedge,
  paintSoftLight,
  paintSpringOutflow,
  type GlowPlantState,
} from './drawSpringCave';
import {
  PEBBLE_HINT_TEX,
  PEBBLE_TEX,
  SURGE_STREAK_TEX,
  VENT_BUBBLE_TEX,
  VENT_MOUTH_TEX,
  paintPebble,
  paintPebbleHint,
  paintRockWall,
  paintSurgeStreak,
  paintVentBubble,
  paintVentMouth,
  rockWallTex,
} from './drawPebbleRoom';
import { bake, type TexInfo } from './textures';

/** Fixed texture keys of the spring cave props. */
export const SPRING_CAVE_TEX = {
  grottoBack: 'spring-cave-grotto-back',
  grottoFront: 'spring-cave-grotto-front',
  rockLedge: 'spring-cave-rock-ledge',
  outflow: 'spring-cave-outflow',
  glowPlantUnlit: 'spring-cave-glow-plant-unlit',
  glowPlantLit: 'spring-cave-glow-plant-lit',
  glowPlantHint: 'spring-cave-glow-plant-hint',
  softLight: 'spring-cave-soft-light',
  darkFadeX: 'spring-cave-dark-fade-x',
  darkFadeY: 'spring-cave-dark-fade-y',
  pebble: 'spring-cave-pebble',
  pebbleHint: 'spring-cave-pebble-hint',
  ventMouth: 'spring-cave-vent-mouth',
  ventBubble: 'spring-cave-vent-bubble',
  surgeStreak: 'spring-cave-surge-streak',
} as const;

/** The texture key prefix of a baked rock wall; each key ends with the wall's size (issue #105, ND-8). */
export const ROCK_WALL_KEY_PREFIX = 'spring-cave-rock-wall-';

/** The key a rock wall `w` x `h` logical px is baked under, and found by, in SpringCaveTextures.rockWalls. */
export function rockWallSizeKey(w: number, h: number): string {
  return `${w}x${h}`;
}

/**
 * The soft light and the dark edge fade strips bake at this many texture pixels per logical unit, or
 * at `bakeScale` when that is lower: a soft gradient needs no more.
 */
export const SOFT_LIGHT_BAKE_SCALE = 1;

/** The side grotto back and front: the same frame, GROTTO_TEX (the cave's CAVE_W x CAVE_H). */
export interface GrottoTextures {
  /** Dark interior (depth DEPTH.caveBack). Anchor is the base centre on the bed, the same as the cave. */
  readonly back: TexInfo;
  /** Rock rim (depth DEPTH.caveFront). Same frame and anchor as `back`. */
  readonly front: TexInfo;
}

/** The glow-plant in each of its states: one frame, GLOW_PLANT_TEX, one anchor, so a swap never moves the plant. */
export type GlowPlantTextures = Readonly<Record<GlowPlantState, TexInfo>>;

export interface SpringCaveTextures {
  /** The side grotto, the cave of Area 6 (a dead end on the bed in the dark). */
  readonly grotto: GrottoTextures;
  /**
   * The shade and rock lip over the water under a ledge (depth DEPTH.caveFront, above hidden treasure
   * icons). ROCK_LEDGE_TEX, nominal 440 x 60 logical px: anchor is the top-left corner of the zone's bank
   * overhang rect, so place it at (x0, y0) and stretch it to the rect's size.
   */
  readonly rockLedge: TexInfo;
  /**
   * The spring outflow marks (OUTFLOW_TEX, nominal 160 x 120): a lighter band and five flow lines with
   * left-pointing chevrons. Anchor is the top-left corner of the current's rect; stretch it to the rect.
   * The scene's flow streaks (motion) go over it.
   */
  readonly outflow: TexInfo;
  /**
   * The glow-plant (GLOW_PLANT_TEX, 88 x 88): 'unlit' is a dim teal outline, 'lit' bright pods with ink and
   * a halo, 'hint' a thicker, brighter outline with a ring. Anchor is the plant's centre, the centre of its
   * touch circle. The plant is never hidden by the darkness, so it draws above the dark layer.
   */
  readonly glowPlants: GlowPlantTextures;
  /**
   * The soft light (SOFT_LIGHT_TEX, 320 x 320): white, full at the middle, fading to nothing at its edge.
   * Anchor is the centre. Erase it from the dark layer at a light's centre, scaled to
   * radius / SOFT_LIGHT_RADIUS / info.scale. Baked at SOFT_LIGHT_BAKE_SCALE or lower.
   */
  readonly softLight: TexInfo;
  /**
   * The dark edge fade strip for a left or right edge (DARK_FADE_TEX.x, DARK_FADE_BAND x
   * DARK_FADE_STRIP_LENGTH): white, erase strength 1 at its left side falling to nothing at
   * DARK_FADE_BAND. Anchor is the top-left corner: erase it from the dark layer at the edge, stretched
   * along y to the edge's length, flipped in x for a right edge. Baked at SOFT_LIGHT_BAKE_SCALE or lower.
   */
  readonly darkFadeX: TexInfo;
  /**
   * The dark edge fade strip for a top or bottom edge (DARK_FADE_TEX.y, DARK_FADE_STRIP_LENGTH x
   * DARK_FADE_BAND): the same ramp along y. Anchor is the top-left corner: stretch it along x to the
   * edge's length, flipped in y for a bottom edge. Baked at SOFT_LIGHT_BAKE_SCALE or lower.
   */
  readonly darkFadeY: TexInfo;
  /** The pebble (issue #105, ND-8; PEBBLE_TEX): anchor is its centre. The scene turns it as it rolls. */
  readonly pebble: TexInfo;
  /** The pebble's hint arrow (PEBBLE_HINT_TEX), pointing along +x; anchor is the middle of its tail. */
  readonly pebbleHint: TexInfo;
  /** A pulsing vent's mouth (issue #105, ND-7; VENT_MOUTH_TEX), blowing along -x; anchor is the middle of its opening. */
  readonly ventMouth: TexInfo;
  /** One warning bubble (VENT_BUBBLE_TEX); anchor is its centre. */
  readonly ventBubble: TexInfo;
  /** One surge streak (SURGE_STREAK_TEX), along +x; anchor is its middle. */
  readonly surgeStreak: TexInfo;
  /**
   * The solid rock walls (issue #105, ND-8), one bake per wall size in any area, keyed by
   * rockWallSizeKey: anchor is the wall's top-left corner, drawn at its rect's own size.
   */
  readonly rockWalls: ReadonlyMap<string, TexInfo>;
}

/**
 * Bake the spring cave props at `bakeScale` texture pixels per logical unit, with one rock wall bake
 * for each of `rockWallSizes`, [w, h] in logical px.
 */
export function bakeSpringCaveTextures(
  scene: Phaser.Scene,
  bakeScale: number,
  rockWallSizes: readonly (readonly [number, number])[] = [],
): SpringCaveTextures {
  const softScale = Math.min(bakeScale, SOFT_LIGHT_BAKE_SCALE);
  const rockWalls = new Map<string, TexInfo>();
  for (const [w, h] of rockWallSizes) {
    const key = rockWallSizeKey(w, h);
    if (!rockWalls.has(key)) rockWalls.set(key, bake(scene, `${ROCK_WALL_KEY_PREFIX}${key}`, rockWallTex(w, h), bakeScale, (ctx) => paintRockWall(ctx, w, h)));
  }
  return {
    grotto: {
      back: bake(scene, SPRING_CAVE_TEX.grottoBack, GROTTO_TEX, bakeScale, paintGrottoBack),
      front: bake(scene, SPRING_CAVE_TEX.grottoFront, GROTTO_TEX, bakeScale, paintGrottoFront),
    },
    rockLedge: bake(scene, SPRING_CAVE_TEX.rockLedge, ROCK_LEDGE_TEX, bakeScale, paintRockLedge),
    outflow: bake(scene, SPRING_CAVE_TEX.outflow, OUTFLOW_TEX, bakeScale, paintSpringOutflow),
    glowPlants: {
      unlit: bake(scene, SPRING_CAVE_TEX.glowPlantUnlit, GLOW_PLANT_TEX, bakeScale, (ctx) => paintGlowPlant(ctx, 'unlit')),
      lit: bake(scene, SPRING_CAVE_TEX.glowPlantLit, GLOW_PLANT_TEX, bakeScale, (ctx) => paintGlowPlant(ctx, 'lit')),
      hint: bake(scene, SPRING_CAVE_TEX.glowPlantHint, GLOW_PLANT_TEX, bakeScale, (ctx) => paintGlowPlant(ctx, 'hint')),
    },
    softLight: bake(scene, SPRING_CAVE_TEX.softLight, SOFT_LIGHT_TEX, softScale, paintSoftLight),
    darkFadeX: bake(scene, SPRING_CAVE_TEX.darkFadeX, DARK_FADE_TEX.x, softScale, (ctx) => paintDarkEdgeFade(ctx, 'x')),
    darkFadeY: bake(scene, SPRING_CAVE_TEX.darkFadeY, DARK_FADE_TEX.y, softScale, (ctx) => paintDarkEdgeFade(ctx, 'y')),
    pebble: bake(scene, SPRING_CAVE_TEX.pebble, PEBBLE_TEX, bakeScale, paintPebble),
    pebbleHint: bake(scene, SPRING_CAVE_TEX.pebbleHint, PEBBLE_HINT_TEX, bakeScale, paintPebbleHint),
    ventMouth: bake(scene, SPRING_CAVE_TEX.ventMouth, VENT_MOUTH_TEX, bakeScale, paintVentMouth),
    ventBubble: bake(scene, SPRING_CAVE_TEX.ventBubble, VENT_BUBBLE_TEX, bakeScale, paintVentBubble),
    surgeStreak: bake(scene, SPRING_CAVE_TEX.surgeStreak, SURGE_STREAK_TEX, bakeScale, paintSurgeStreak),
    rockWalls,
  };
}
