import type * as Phaser from 'phaser';
import { MARIGOLD_PATCHES } from '../art/drawGoldenCanal';
import type { HabitatLook } from '../art/habitatLook';
import { DEPTH } from '../art/layers';
import { SURF, VIEW_W } from '../art/palette';
import type { TexInfo } from '../art/textures';
import type { MotionProfile } from '../logic/motion';
import type { ZoneLayout } from '../logic/zone';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

const TAU = Math.PI * 2;
/** ND-13: never more than one sinking petal per screen of area width, whatever the look asks for. */
const MAX_PETALS_PER_SCREEN = 1;
/** Where each petal starts: this far under the surface line, just under its marigold patch. */
const START_DROP_PX = 12;
/** Sinking speed in px per second (ND-13: 10 or slower). */
const SINK_PX_PER_S = 8;
/** Depth under the start at which a petal has faded out completely (ND-13: about 120 px). */
const FADE_OUT_PX = 120;
/** Depth under the start over which a petal fades in, so it never pops in. */
const FADE_IN_PX = 16;
/** Seconds for one sink from the start to the fade-out depth; the petal then starts again. */
const SINK_CYCLE_S = FADE_OUT_PX / SINK_PX_PER_S;
/** Sideways sway of a sinking petal in px either way, and its period in seconds. */
const SWAY_PX = 3;
const SWAY_PERIOD_S = 5;
/** Tilt of the petal at the far end of its sway, in radians. */
const TILT_RAD = 0.25;
/** Each petal's sink is this share of a cycle out of step with the one before (the golden ratio's fraction). */
const PHASE_SHARE_STEP = 0.618034;
/** Depth under the start at which a petal holds still under reduced motion. */
const HOLD_DEPTH_PX = 40;
/** Petals are at least this far apart in x, so one view never shows two, even at full sway. */
const MIN_PETAL_GAP_PX = VIEW_W + 2 * SWAY_PX;

/** The area size the petals spread over. */
export type PetalZone = Pick<ZoneLayout, 'width' | 'chunks'>;

interface Petal {
  image: Phaser.GameObjects.Image;
  x: number;
  phase: number;
}

function petalTexture(assets: GameAssets): TexInfo {
  const info = assets.goldenCanal?.sinkingPetal ?? null;
  if (info === null) {
    throw new Error('PetalView: a look with sinking petals needs the baked golden canal petal texture');
  }
  return info;
}

/**
 * The world x of each petal: the centres of the marigold patches inside the area, in order, at most
 * `count`, skipping a patch closer than MIN_PETAL_GAP_PX to the last one kept.
 */
function petalXs(count: number, width: number): number[] {
  const xs: number[] = [];
  // INVARIANT: MARIGOLD_PATCHES is in increasing x, so the gap check against the last kept petal holds for every pair.
  for (const patch of MARIGOLD_PATCHES) {
    if (xs.length >= count) break;
    if (patch.x + patch.w / 2 > width) continue;
    const last = xs.length > 0 ? xs[xs.length - 1] : -Infinity;
    if (patch.x - last >= MIN_PETAL_GAP_PX) xs.push(patch.x);
  }
  return xs;
}

/** Alpha of a petal `depth` px under its start: fades in over FADE_IN_PX, then out until FADE_OUT_PX. */
function petalAlpha(depth: number): number {
  return Math.max(0, Math.min(depth / FADE_IN_PX, 1 - depth / FADE_OUT_PX));
}

/**
 * Draws the sinking marigold petals of a golden-hour look (issue #112, ND-13): at most one per
 * screen of area width (`look.sinkingPetalsPerScreen`, capped at MAX_PETALS_PER_SCREEN), each
 * starting just under a marigold patch (MARIGOLD_PATCHES) and never two in one view. Under full
 * motion each sinks SINK_PX_PER_S with a small sway and tilt, fades out by FADE_OUT_PX and starts
 * again, each out of step with the next (deterministic, no random). Under reduced motion each holds
 * still at HOLD_DEPTH_PX. The motion setting is read every frame. Hazed scenery at DEPTH.petals,
 * below the haze and every cue object. Background only: nothing here changes game state.
 */
export class PetalView {
  private readonly petals: Petal[];

  /** Throws when the look has sinking petals but the golden canal petal texture was not baked. */
  constructor(scene: Phaser.Scene, assets: GameAssets, look: HabitatLook, zone: PetalZone) {
    const count = Math.floor(Math.min(look.sinkingPetalsPerScreen, MAX_PETALS_PER_SCREEN) * zone.chunks);
    if (count <= 0) {
      this.petals = [];
      return;
    }
    const info = petalTexture(assets);
    this.petals = petalXs(count, zone.width).map((x, index): Petal => {
      const image = scene.add
        .image(x, SURF + START_DROP_PX + HOLD_DEPTH_PX, info.key)
        .setOrigin(info.originNormX, info.originNormY)
        .setDepth(DEPTH.petals)
        .setAlpha(petalAlpha(HOLD_DEPTH_PX));
      faceSprite(image, index % 2 === 0 ? 1 : -1, 1 / info.scale);
      return { image, x, phase: (index * PHASE_SHARE_STEP) % 1 };
    });
  }

  /** Draws one frame at scene clock `time` seconds. Allocates nothing. */
  render(motion: MotionProfile, time: number): void {
    for (const petal of this.petals) {
      if (!motion.ambient) {
        petal.image.setPosition(petal.x, SURF + START_DROP_PX + HOLD_DEPTH_PX).setRotation(0).setAlpha(petalAlpha(HOLD_DEPTH_PX));
        continue;
      }
      const share = (time / SINK_CYCLE_S + petal.phase) % 1;
      const depth = share * FADE_OUT_PX;
      const sway = Math.sin((TAU * time) / SWAY_PERIOD_S + petal.phase * TAU);
      petal.image
        .setPosition(petal.x + sway * SWAY_PX, SURF + START_DROP_PX + depth)
        .setRotation(sway * TILT_RAD)
        .setAlpha(petalAlpha(depth));
    }
  }

  /** Destroys every petal sprite. */
  destroy(): void {
    for (const petal of this.petals) petal.image.destroy();
  }
}
