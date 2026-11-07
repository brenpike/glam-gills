/**
 * Phaser glue for the open lake's small sprites (issue #211, Area 12; ND-5, ND-6, ND-10, ND-11): bakes
 * the pelican's body frames, bill piece, neck piece and scoop splash, the wind's ripple arcs and
 * gust streak, and (issue #212, Area 13) the mud turtle's body frames, head piece and neck piece and
 * the fading light's frames, into CanvasTextures. The lake's sky, water and lakebed are painted into the
 * per-area background chunks (drawLake.ts), so they have no texture here. Visual only. No game
 * state, no input, no physics.
 *
 * Same rules as textures.ts: every texture is drawn at `bakeScale` through the context transform, so
 * the ink stays constant, and a sprite shows at logical size with setScale(1 / info.scale). Only small
 * sprites are baked, once: none larger than LAKE_TEX_MAX_W x LAKE_TEX_MAX_H logical
 * units. The pelican line, the wind, the turtles and the lights share these textures across every bird,
 * ripple, streak, turtle and light, so the number of them on screen adds no texture memory.
 */
import * as Phaser from 'phaser';
import type { TexSize } from './canvasKit';
import {
  FADING_LIGHT_FRAMES,
  FADING_LIGHT_KEYS,
  FADING_LIGHT_TEX,
  paintFadingLight,
  type FadingLightFrame,
} from './drawFadingLight';
import {
  MUD_TURTLE_FRAMES,
  MUD_TURTLE_HEAD_TEX,
  MUD_TURTLE_KEYS,
  MUD_TURTLE_NECK_TEX,
  MUD_TURTLE_TEX,
  paintMudTurtle,
  paintMudTurtleHead,
  paintMudTurtleNeck,
  type MudTurtleFrame,
} from './drawMudTurtle';
import {
  PELICAN_BILL_TEX,
  PELICAN_FRAMES,
  PELICAN_NECK_TEX,
  PELICAN_SPLASH_TEX,
  PELICAN_TEX,
  paintPelican,
  paintPelicanBill,
  paintPelicanNeck,
  paintPelicanSplash,
  type PelicanFrame,
} from './drawPelican';
import { WIND_RIPPLE_TEX, WIND_STREAK_TEX, paintWindRipple, paintWindStreak } from './drawWind';
import { bake, type TexInfo } from './textures';

/** Fixed texture keys of the lake's small sprites. */
export const LAKE_TEX = {
  pelicanFloatA: 'pelican-float-a',
  pelicanFloatB: 'pelican-float-b',
  pelicanWarn: 'pelican-warn',
  pelicanScoop: 'pelican-scoop',
  pelicanRise: 'pelican-rise',
  pelicanBill: 'pelican-bill',
  pelicanNeck: 'pelican-neck',
  pelicanSplash: 'pelican-splash',
  windRipple: 'wind-ripple',
  windStreak: 'wind-streak',
  mudTurtleCrawlA: MUD_TURTLE_KEYS.crawlA,
  mudTurtleCrawlB: MUD_TURTLE_KEYS.crawlB,
  mudTurtleWarn: MUD_TURTLE_KEYS.warn,
  mudTurtleSnap: MUD_TURTLE_KEYS.snap,
  mudTurtleStill: MUD_TURTLE_KEYS.still,
  mudTurtleHead: MUD_TURTLE_KEYS.head,
  mudTurtleNeck: MUD_TURTLE_KEYS.neck,
  fadingLightOut: FADING_LIGHT_KEYS.out,
  fadingLightHint: FADING_LIGHT_KEYS.hint,
  fadingLightLit: FADING_LIGHT_KEYS.lit,
} as const;

/** The largest a lake sprite may be, in logical units: the memory guard for the small-sprites rule. */
export const LAKE_TEX_MAX_W = 128;
export const LAKE_TEX_MAX_H = 112;

/** Fixed key of each pelican body frame. */
const PELICAN_KEYS: Readonly<Record<PelicanFrame, string>> = {
  floatA: LAKE_TEX.pelicanFloatA,
  floatB: LAKE_TEX.pelicanFloatB,
  warn: LAKE_TEX.pelicanWarn,
  scoop: LAKE_TEX.pelicanScoop,
  rise: LAKE_TEX.pelicanRise,
};

/** The size of every lake texture by key, in logical units, for tests and memory budgets. */
export const LAKE_TEX_SIZES: Readonly<Record<string, TexSize>> = {
  ...Object.fromEntries(PELICAN_FRAMES.map((frame) => [PELICAN_KEYS[frame], PELICAN_TEX])),
  [LAKE_TEX.pelicanBill]: PELICAN_BILL_TEX,
  [LAKE_TEX.pelicanNeck]: PELICAN_NECK_TEX,
  [LAKE_TEX.pelicanSplash]: PELICAN_SPLASH_TEX,
  [LAKE_TEX.windRipple]: WIND_RIPPLE_TEX,
  [LAKE_TEX.windStreak]: WIND_STREAK_TEX,
  ...Object.fromEntries(MUD_TURTLE_FRAMES.map((frame) => [MUD_TURTLE_KEYS[frame], MUD_TURTLE_TEX])),
  [LAKE_TEX.mudTurtleHead]: MUD_TURTLE_HEAD_TEX,
  [LAKE_TEX.mudTurtleNeck]: MUD_TURTLE_NECK_TEX,
  ...Object.fromEntries(FADING_LIGHT_FRAMES.map((frame) => [FADING_LIGHT_KEYS[frame], FADING_LIGHT_TEX])),
};

/** The baked lake sprites, ready for GameAssets. */
export interface LakeTextures {
  /** Every lake texture by key. */
  readonly info: Readonly<Record<string, TexInfo>>;
  /**
   * Pelican body frames (PELICAN_TEX), facing right: `floatA` and `floatB` (PELICAN_BOB apart; the
   * scene swaps them, and holds `floatA` under reduced motion), `warn`, `scoop` and `rise`. Anchor is
   * the water line under the body centre, the pelican's logic point; the tail trails toward -x.
   */
  readonly pelican: Readonly<Record<PelicanFrame, TexInfo>>;
  /** The head and bill piece (PELICAN_BILL_TEX) for the dip. Anchor is the round bill tip. */
  readonly pelicanBill: TexInfo;
  /** The neck piece (PELICAN_NECK_TEX), stretched along y by the scene. Anchor is its top end centre. */
  readonly pelicanNeck: TexInfo;
  /** The scoop splash (PELICAN_SPLASH_TEX). Anchor is the water line where the bill goes in. */
  readonly pelicanSplash: TexInfo;
  /** The ripple arcs of the warning (WIND_RIPPLE_TEX), facing right. Anchor is the middle arc's centre. */
  readonly windRipple: TexInfo;
  /** The gust streak with its chevron (WIND_STREAK_TEX), facing right. Anchor is the chevron tip. */
  readonly windStreak: TexInfo;
  /**
   * Mud turtle body frames (MUD_TURTLE_TEX), facing right: `crawlA` and `crawlB` (the scene swaps them
   * while it crawls), `warn`, `snap` and `still`. Anchor is the shell centre, the turtle's logic point.
   */
  readonly mudTurtle: Readonly<Record<MudTurtleFrame, TexInfo>>;
  /** The head piece (MUD_TURTLE_HEAD_TEX) for the snap, beak pointing right. Anchor is the head centre. */
  readonly mudTurtleHead: TexInfo;
  /** The neck piece (MUD_TURTLE_NECK_TEX), stretched along y by the scene. Anchor is its top end centre. */
  readonly mudTurtleNeck: TexInfo;
  /**
   * The fading light's frames (FADING_LIGHT_TEX): `out`, `hint` and `lit`. Anchor is the touch centre,
   * the light's logic point.
   */
  readonly fadingLight: Readonly<Record<FadingLightFrame, TexInfo>>;
}

/**
 * Bake the lake's small sprites at `bakeScale` texture pixels per logical unit: the five pelican
 * body frames, the bill piece, the neck piece, the splash, the ripple arcs, the gust streak, the five
 * mud turtle frames, its head and neck pieces and the three fading light frames. A
 * texture that already exists under a key is replaced.
 */
export function bakeLakeTextures(scene: Phaser.Scene, bakeScale: number): LakeTextures {
  const info: Record<string, TexInfo> = {};
  const add = (t: TexInfo): TexInfo => {
    info[t.key] = t;
    return t;
  };

  const pelican = {} as Record<PelicanFrame, TexInfo>;
  for (const frame of PELICAN_FRAMES) {
    pelican[frame] = add(bake(scene, PELICAN_KEYS[frame], PELICAN_TEX, bakeScale, (ctx) => paintPelican(ctx, frame)));
  }
  const pelicanBill = add(bake(scene, LAKE_TEX.pelicanBill, PELICAN_BILL_TEX, bakeScale, paintPelicanBill));
  const pelicanNeck = add(bake(scene, LAKE_TEX.pelicanNeck, PELICAN_NECK_TEX, bakeScale, paintPelicanNeck));
  const pelicanSplash = add(bake(scene, LAKE_TEX.pelicanSplash, PELICAN_SPLASH_TEX, bakeScale, paintPelicanSplash));
  const windRipple = add(bake(scene, LAKE_TEX.windRipple, WIND_RIPPLE_TEX, bakeScale, paintWindRipple));
  const windStreak = add(bake(scene, LAKE_TEX.windStreak, WIND_STREAK_TEX, bakeScale, paintWindStreak));

  const mudTurtle = {} as Record<MudTurtleFrame, TexInfo>;
  for (const frame of MUD_TURTLE_FRAMES) {
    mudTurtle[frame] = add(bake(scene, MUD_TURTLE_KEYS[frame], MUD_TURTLE_TEX, bakeScale, (ctx) => paintMudTurtle(ctx, frame)));
  }
  const mudTurtleHead = add(bake(scene, LAKE_TEX.mudTurtleHead, MUD_TURTLE_HEAD_TEX, bakeScale, paintMudTurtleHead));
  const mudTurtleNeck = add(bake(scene, LAKE_TEX.mudTurtleNeck, MUD_TURTLE_NECK_TEX, bakeScale, paintMudTurtleNeck));

  const fadingLight = {} as Record<FadingLightFrame, TexInfo>;
  for (const frame of FADING_LIGHT_FRAMES) {
    fadingLight[frame] = add(bake(scene, FADING_LIGHT_KEYS[frame], FADING_LIGHT_TEX, bakeScale, (ctx) => paintFadingLight(ctx, frame)));
  }

  return {
    info,
    pelican,
    pelicanBill,
    pelicanNeck,
    pelicanSplash,
    windRipple,
    windStreak,
    mudTurtle,
    mudTurtleHead,
    mudTurtleNeck,
    fadingLight,
  };
}
