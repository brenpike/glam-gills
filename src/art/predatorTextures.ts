/**
 * Phaser glue for the predators and leg loss (issues #7, #98, #103, #77 and #78): bakes the
 * tilapia, heron, garter snake, carp, crayfish, black bass, effect and leg icon painters into
 * CanvasTextures.
 * Visual only. No game state, no input, no physics.
 *
 * Same rules as textures.ts: every texture is drawn at `bakeScale`, so a
 * sprite shows at logical size with setScale(1 / info.scale).
 */
import * as Phaser from 'phaser';
import type { TexSize } from './canvasKit';
import {
  BLACK_BASS_FRAMES,
  BLACK_BASS_TEX,
  paintBlackBass,
  type BlackBassFrame,
} from './drawBlackBass';
import {
  CARP_FRAMES,
  CARP_PUFF_TEX,
  CARP_TEX,
  paintCarp,
  paintCarpPuff,
  paintCarpPuffStill,
  type CarpFrame,
} from './drawCarp';
import {
  CRAYFISH_FRAMES,
  CRAYFISH_TEX,
  paintCrayfish,
  type CrayfishFrame,
} from './drawCrayfish';
import {
  CARRY_BUBBLE_TEX,
  HALO_TEX,
  POOF_TEX,
  paintCarryBubble,
  paintPoof,
  paintProtectedHalo,
} from './drawEffects';
import {
  GARTER_RIPPLE_TEX,
  GARTER_SNAKE_FRAMES,
  GARTER_SNAKE_TEX,
  paintGarterRipple,
  paintGarterSnake,
  type GarterSnakeFrame,
} from './drawGarterSnake';
import {
  HERON_BODY_TEX,
  HERON_HEAD_TEX,
  HERON_STAB_HEAD_TEX,
  HERON_STAB_NECK_TEX,
  paintHeronBody,
  paintHeronHead,
  paintHeronStabHead,
  paintHeronStabNeck,
  type HeronBodyFrame,
  type HeronHeadPose,
} from './drawHeron';
import {
  LEG_ICON_SIZE,
  REGROW_MARK_SIZE,
  paintLegIcon,
  paintRegrowMark,
  type LegIconKind,
} from './drawLegIcons';
import {
  ALERT_TEX,
  GLINT_TEX,
  TILAPIA_TEX,
  paintAlertSign,
  paintGlint,
  paintTilapia,
  type TilapiaPose,
} from './drawTilapia';
import { bake, type TexInfo } from './textures';

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** Fixed predator texture keys. Indexed keys come from the key functions below. */
export const PREDATOR_TEX = {
  alert: 'tilapia-alert',
  glint: 'tilapia-glint',
  poof: 'fx-poof',
  halo: 'fx-halo',
  carryBubble: 'fx-carry-bubble',
  regrowMark: 'leg-regrow-mark',
  heronBodyStand: 'heron-body-stand',
  heronBodyStepA: 'heron-body-step-a',
  heronBodyStepB: 'heron-body-step-b',
  heronHeadRest: 'heron-head-rest',
  heronHeadWarn: 'heron-head-warn',
  heronStabHead: 'heron-stab-head',
  heronStabNeck: 'heron-stab-neck',
  garterSnakeSwimA: 'garter-snake-swim-a',
  garterSnakeSwimB: 'garter-snake-swim-b',
  garterSnakeSwimC: 'garter-snake-swim-c',
  garterSnakeSwimD: 'garter-snake-swim-d',
  garterSnakeHold: 'garter-snake-hold',
  garterSnakeDart: 'garter-snake-dart',
  garterRipple: 'garter-snake-ripple',
  carpSwim0: 'carp-swim-0',
  carpSwim1: 'carp-swim-1',
  carpSwim2: 'carp-swim-2',
  carpWarn: 'carp-warn',
  carpSweep: 'carp-sweep',
  carpPuff: 'carp-puff',
  carpPuffStill: 'carp-puff-still',
  crayfishStand: 'crayfish-stand',
  crayfishWalkA: 'crayfish-walk-a',
  crayfishWalkB: 'crayfish-walk-b',
  crayfishWarn: 'crayfish-warn',
  crayfishPinch: 'crayfish-pinch',
  blackBassSwim0: 'black-bass-swim-0',
  blackBassSwim1: 'black-bass-swim-1',
  blackBassSwim2: 'black-bass-swim-2',
  blackBassWarn: 'black-bass-warn',
  blackBassStrike: 'black-bass-strike',
  blackBassStill: 'black-bass-still',
} as const;

/** Fixed key of each black bass frame. */
const BLACK_BASS_KEYS: Readonly<Record<BlackBassFrame, string>> = {
  swim0: PREDATOR_TEX.blackBassSwim0,
  swim1: PREDATOR_TEX.blackBassSwim1,
  swim2: PREDATOR_TEX.blackBassSwim2,
  warn: PREDATOR_TEX.blackBassWarn,
  strike: PREDATOR_TEX.blackBassStrike,
  still: PREDATOR_TEX.blackBassStill,
};

/** Fixed key of each crayfish frame. */
const CRAYFISH_KEYS: Readonly<Record<CrayfishFrame, string>> = {
  stand: PREDATOR_TEX.crayfishStand,
  walkA: PREDATOR_TEX.crayfishWalkA,
  walkB: PREDATOR_TEX.crayfishWalkB,
  warn: PREDATOR_TEX.crayfishWarn,
  pinch: PREDATOR_TEX.crayfishPinch,
};

/** Fixed key of each carp frame. */
const CARP_KEYS: Readonly<Record<CarpFrame, string>> = {
  swim0: PREDATOR_TEX.carpSwim0,
  swim1: PREDATOR_TEX.carpSwim1,
  swim2: PREDATOR_TEX.carpSwim2,
  warn: PREDATOR_TEX.carpWarn,
  sweep: PREDATOR_TEX.carpSweep,
};

/** Fixed key of each garter snake frame. */
const GARTER_SNAKE_KEYS: Readonly<Record<GarterSnakeFrame, string>> = {
  swimA: PREDATOR_TEX.garterSnakeSwimA,
  swimB: PREDATOR_TEX.garterSnakeSwimB,
  swimC: PREDATOR_TEX.garterSnakeSwimC,
  swimD: PREDATOR_TEX.garterSnakeSwimD,
  hold: PREDATOR_TEX.garterSnakeHold,
  dart: PREDATOR_TEX.garterSnakeDart,
};

/** Fixed key of each wading heron body frame. */
const HERON_BODY_KEYS: Readonly<Record<HeronBodyFrame, string>> = {
  stand: PREDATOR_TEX.heronBodyStand,
  stepA: PREDATOR_TEX.heronBodyStepA,
  stepB: PREDATOR_TEX.heronBodyStepB,
};

/** Fixed key of each wading heron head and neck pose. */
const HERON_HEAD_KEYS: Readonly<Record<HeronHeadPose, string>> = {
  rest: PREDATOR_TEX.heronHeadRest,
  warn: PREDATOR_TEX.heronHeadWarn,
};

const TILAPIA_POSES: readonly TilapiaPose[] = ['swim', 'windup', 'lunge', 'rest'];
const HERON_BODY_FRAMES: readonly HeronBodyFrame[] = ['stand', 'stepA', 'stepB'];
const HERON_HEAD_POSES: readonly HeronHeadPose[] = ['rest', 'warn'];
const LEG_ICON_KINDS: readonly LegIconKind[] = ['present', 'outline'];

export const tilapiaKey = (pose: TilapiaPose): string => `tilapia-${pose}`;
export const legIconKey = (kind: LegIconKind): string => `leg-icon-${kind}`;

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

export interface PredatorTextures {
  /** Every predator texture by key. */
  readonly info: Readonly<Record<string, TexInfo>>;
  /** One still frame per pose, facing right. Anchor is the body centre. */
  readonly tilapia: Readonly<Record<TilapiaPose, TexInfo>>;
  /** "!" sign. Anchor is the disc centre; the thought dot hangs below. */
  readonly alert: TexInfo;
  /** Telegraph glint. Anchor is the centre. */
  readonly glint: TexInfo;
  /** Leg-loss poof. Anchor is the centre. */
  readonly poof: TexInfo;
  /** Protected halo around the axolotl. Anchor is the centre. */
  readonly halo: TexInfo;
  /** Carry bubble. Anchor is the centre. */
  readonly carryBubble: TexInfo;
  /** HUD leg icons. Anchor is the top-left of the LEG_ICON_SIZE box. */
  readonly legIcons: Readonly<Record<LegIconKind, TexInfo>>;
  /** Regrow sparkle. Anchor is the top-left of the REGROW_MARK_SIZE box. */
  readonly regrowMark: TexInfo;
  /**
   * Wading heron body and legs, one still frame each (HERON_BODY_TEX), facing right.
   * Anchor is on the art water line (HERON_WATER_LINE_Y) directly under the resting beak tip,
   * the heron's logic point; the body trails toward -x. Under reduced motion hold `stand`.
   */
  readonly heronBody: Readonly<Record<HeronBodyFrame, TexInfo>>;
  /**
   * Wading heron head and neck, `rest` (also the watch pose) and `warn` (the S-neck)
   * (HERON_HEAD_TEX), facing right. Anchor is the neck base (HERON_NECK_BASE on the body).
   */
  readonly heronHead: Readonly<Record<HeronHeadPose, TexInfo>>;
  /** Stab head (HERON_STAB_HEAD_TEX): a closed beak pointing +x. Anchor is the beak tip. */
  readonly heronStabHead: TexInfo;
  /** Stab neck piece (HERON_STAB_NECK_TEX), stretched along x by the scene. Anchor is the rear end centre. */
  readonly heronStabNeck: TexInfo;
  /**
   * Garter snake, one still frame each (GARTER_SNAKE_TEX), facing right: `swimA` to `swimD` (the
   * gentle S-wiggle, cycled in that order), `hold` (the one held S pose for reduced motion) and
   * `dart`. Anchor is the head centre, the snake's logic point; the body trails toward -x.
   */
  readonly garterSnake: Readonly<Record<GarterSnakeFrame, TexInfo>>;
  /** One ripple ring (GARTER_RIPPLE_TEX), the garter snake's warning cue. Anchor is the ring centre. */
  readonly garterRipple: TexInfo;
  /**
   * Common carp, one still frame each (CARP_TEX), facing right: `swim0` to `swim2` (the tail one
   * step up, straight, one step down; the scene steps 0, 1, 2, 1), `warn` (nose down) and `sweep`
   * (the tail swung wide). `swim1` is the one held pose for reduced motion. Anchor is the body
   * centre, the carp's logic point; the tail trails toward -x.
   */
  readonly carp: Readonly<Record<CarpFrame, TexInfo>>;
  /** The moving mud puff (CARP_PUFF_TEX), the carp's warning cue with the `warn` pose. Anchor is the main lobe's centre. */
  readonly carpPuff: TexInfo;
  /** The still mud puff (CARP_PUFF_TEX, no specks), for reduced motion. Anchor is the main lobe's centre. */
  readonly carpPuffStill: TexInfo;
  /**
   * Crayfish, one still frame each (CRAYFISH_TEX), facing right: `stand` (claws closed, the one
   * held pose for reduced motion), `walkA` and `walkB` (the scene steps walkA, stand, walkB, stand),
   * `warn` (both claws raised and opened wide) and `pinch` (both claws closed and pushed level along
   * the floor). Anchor is the shell centre, the crayfish's logic point; the feet reach
   * CRAYFISH_FOOT_Y below it and the tail trails toward -x.
   */
  readonly crayfish: Readonly<Record<CrayfishFrame, TexInfo>>;
  /**
   * Black bass, one still frame each (BLACK_BASS_TEX), facing right: `swim0` to `swim2` (fins
   * folded, the tail one step up, straight, one step down; the scene steps 0, 1, 2, 1), `warn` (the
   * stop: fins flared, head up, pale flash), `strike` (fins tucked flat, tail swept wide) and
   * `still` (fins flared, level, no flash: the reduced motion pose). Anchor is the body centre, the
   * bass's logic point; the tail trails toward -x.
   */
  readonly blackBass: Readonly<Record<BlackBassFrame, TexInfo>>;
}

/** Bake the tilapia, heron, garter snake, carp, crayfish, black bass, effect and leg icon textures into the scene's texture manager. */
export function bakePredatorTextures(scene: Phaser.Scene, bakeScale: number): PredatorTextures {
  const info: Record<string, TexInfo> = {};
  const add = (t: TexInfo): TexInfo => {
    info[t.key] = t;
    return t;
  };

  const tilapia = {} as Record<TilapiaPose, TexInfo>;
  for (const pose of TILAPIA_POSES) {
    tilapia[pose] = add(bake(scene, tilapiaKey(pose), TILAPIA_TEX, bakeScale, (ctx) => paintTilapia(ctx, pose)));
  }

  const alert = add(bake(scene, PREDATOR_TEX.alert, ALERT_TEX, bakeScale, paintAlertSign));
  const glint = add(bake(scene, PREDATOR_TEX.glint, GLINT_TEX, bakeScale, paintGlint));
  const poof = add(bake(scene, PREDATOR_TEX.poof, POOF_TEX, bakeScale, paintPoof));
  const halo = add(bake(scene, PREDATOR_TEX.halo, HALO_TEX, bakeScale, paintProtectedHalo));
  const carryBubble = add(bake(scene, PREDATOR_TEX.carryBubble, CARRY_BUBBLE_TEX, bakeScale, paintCarryBubble));

  const legIconSize: TexSize = { w: LEG_ICON_SIZE, h: LEG_ICON_SIZE, originX: 0, originY: 0 };
  const legIcons = {} as Record<LegIconKind, TexInfo>;
  for (const kind of LEG_ICON_KINDS) {
    legIcons[kind] = add(bake(scene, legIconKey(kind), legIconSize, bakeScale, (ctx) => paintLegIcon(ctx, kind)));
  }

  const regrowSize: TexSize = { w: REGROW_MARK_SIZE, h: REGROW_MARK_SIZE, originX: 0, originY: 0 };
  const regrowMark = add(bake(scene, PREDATOR_TEX.regrowMark, regrowSize, bakeScale, paintRegrowMark));

  const heronBody = {} as Record<HeronBodyFrame, TexInfo>;
  for (const frame of HERON_BODY_FRAMES) {
    heronBody[frame] = add(
      bake(scene, HERON_BODY_KEYS[frame], HERON_BODY_TEX, bakeScale, (ctx) => paintHeronBody(ctx, frame)),
    );
  }
  const heronHead = {} as Record<HeronHeadPose, TexInfo>;
  for (const pose of HERON_HEAD_POSES) {
    heronHead[pose] = add(
      bake(scene, HERON_HEAD_KEYS[pose], HERON_HEAD_TEX, bakeScale, (ctx) => paintHeronHead(ctx, pose)),
    );
  }
  const heronStabHead = add(
    bake(scene, PREDATOR_TEX.heronStabHead, HERON_STAB_HEAD_TEX, bakeScale, paintHeronStabHead),
  );
  const heronStabNeck = add(
    bake(scene, PREDATOR_TEX.heronStabNeck, HERON_STAB_NECK_TEX, bakeScale, paintHeronStabNeck),
  );
  const garterSnake = {} as Record<GarterSnakeFrame, TexInfo>;
  for (const frame of GARTER_SNAKE_FRAMES) {
    garterSnake[frame] = add(
      bake(scene, GARTER_SNAKE_KEYS[frame], GARTER_SNAKE_TEX, bakeScale, (ctx) => paintGarterSnake(ctx, frame)),
    );
  }
  const garterRipple = add(bake(scene, PREDATOR_TEX.garterRipple, GARTER_RIPPLE_TEX, bakeScale, paintGarterRipple));
  const carp = {} as Record<CarpFrame, TexInfo>;
  for (const frame of CARP_FRAMES) {
    carp[frame] = add(bake(scene, CARP_KEYS[frame], CARP_TEX, bakeScale, (ctx) => paintCarp(ctx, frame)));
  }
  const carpPuff = add(bake(scene, PREDATOR_TEX.carpPuff, CARP_PUFF_TEX, bakeScale, paintCarpPuff));
  const carpPuffStill = add(bake(scene, PREDATOR_TEX.carpPuffStill, CARP_PUFF_TEX, bakeScale, paintCarpPuffStill));
  const crayfish = {} as Record<CrayfishFrame, TexInfo>;
  for (const frame of CRAYFISH_FRAMES) {
    crayfish[frame] = add(bake(scene, CRAYFISH_KEYS[frame], CRAYFISH_TEX, bakeScale, (ctx) => paintCrayfish(ctx, frame)));
  }
  const blackBass = {} as Record<BlackBassFrame, TexInfo>;
  for (const frame of BLACK_BASS_FRAMES) {
    blackBass[frame] = add(bake(scene, BLACK_BASS_KEYS[frame], BLACK_BASS_TEX, bakeScale, (ctx) => paintBlackBass(ctx, frame)));
  }

  return {
    info,
    tilapia,
    alert,
    glint,
    poof,
    halo,
    carryBubble,
    legIcons,
    regrowMark,
    heronBody,
    heronHead,
    heronStabHead,
    heronStabNeck,
    garterSnake,
    garterRipple,
    carp,
    carpPuff,
    carpPuffStill,
    crayfish,
    blackBass,
  };
}
