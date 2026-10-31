/**
 * Phaser glue for the deep canal props (issue #78): bakes the gliding trajinera hull and its leading
 * shadow, the moored hulls and the sunken old trajinera hull cave's back and front into
 * CanvasTextures. The old canal-bed stones are painted into the background chunks
 * (drawDeepCanal.ts paintCanalBedStones), and the side-canal inflow marks are the spring outflow's
 * texture (springCaveTextures.ts), so neither has a texture here.
 * Visual only. No game state, no input, no physics.
 *
 * Same rules as textures.ts: every texture is drawn at `bakeScale` through the context transform,
 * so the ink stays constant, and a sprite shows at logical size with setScale(1 / info.scale).
 */
import * as Phaser from 'phaser';
import {
  HULL_CAVE_TEX,
  MOORED_TEX,
  TRAJINERA_HULL_TEX,
  TRAJINERA_SHADOW_TEX,
  paintHullCaveBack,
  paintHullCaveFront,
  paintMooredHulls,
  paintTrajineraHull,
  paintTrajineraShadow,
} from './drawDeepCanal';
import { bake, type TexInfo } from './textures';

/** Fixed texture keys of the deep canal props. */
export const DEEP_CANAL_TEX = {
  trajineraHull: 'deep-canal-trajinera-hull',
  trajineraShadow: 'deep-canal-trajinera-shadow',
  mooredHulls: 'deep-canal-moored-hulls',
  hullCaveBack: 'deep-canal-hull-cave-back',
  hullCaveFront: 'deep-canal-hull-cave-front',
} as const;

/** The sunken hull cave back and front: the same frame, HULL_CAVE_TEX (the cave's CAVE_W x CAVE_H). */
export interface HullCaveTextures {
  /** Dark interior (depth DEPTH.caveBack). Anchor is the base centre on the bed, the same as the cave. */
  readonly back: TexInfo;
  /** The upturned old hull (depth DEPTH.caveFront). Same frame and anchor as `back`. */
  readonly front: TexInfo;
}

export interface DeepCanalTextures {
  /**
   * The gliding trajinera hull (TRAJINERA_HULL_TEX). Anchor is the top-centre of the hull's rect, on
   * the water line. The prow is at +x: mirror the sprite for a boat that glides left.
   */
  readonly trajineraHull: TexInfo;
  /**
   * The gliding trajinera's leading shadow (TRAJINERA_SHADOW_TEX). Same anchor as the hull: the
   * middle of the footprint's length, on the water line. Its chevrons point +x: mirror it for a boat
   * that glides left.
   */
  readonly trajineraShadow: TexInfo;
  /**
   * The moored hulls and the shade under them (depth DEPTH.caveFront, above hidden treasure icons).
   * MOORED_TEX, nominal MOORED_W x MOORED_H logical px (440 x 60): anchor is the top-left corner of
   * the zone's bank overhang rect, so place it at (x0, y0) and stretch it to the rect's size.
   */
  readonly mooredHulls: TexInfo;
  /** The sunken old trajinera hull, the cave of Area 8. */
  readonly hullCave: HullCaveTextures;
}

/** Bake the deep canal props at `bakeScale` texture pixels per logical unit. */
export function bakeDeepCanalTextures(scene: Phaser.Scene, bakeScale: number): DeepCanalTextures {
  return {
    trajineraHull: bake(scene, DEEP_CANAL_TEX.trajineraHull, TRAJINERA_HULL_TEX, bakeScale, paintTrajineraHull),
    trajineraShadow: bake(scene, DEEP_CANAL_TEX.trajineraShadow, TRAJINERA_SHADOW_TEX, bakeScale, paintTrajineraShadow),
    mooredHulls: bake(scene, DEEP_CANAL_TEX.mooredHulls, MOORED_TEX, bakeScale, paintMooredHulls),
    hullCave: {
      back: bake(scene, DEEP_CANAL_TEX.hullCaveBack, HULL_CAVE_TEX, bakeScale, paintHullCaveBack),
      front: bake(scene, DEEP_CANAL_TEX.hullCaveFront, HULL_CAVE_TEX, bakeScale, paintHullCaveFront),
    },
  };
}
