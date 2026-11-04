import type * as Phaser from 'phaser';
import type { CormorantFrame } from '../art/drawCormorant';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import { CORMORANT_SPECIES, diveArcPose, type PredatorState } from '../logic/predators';
import type { GameAssets } from './BootScene';
import type { PredatorFrame } from './PredatorView';
import { faceSprite } from './spriteFacing';

/** Full motion: seconds each float frame shows while the cormorant floats. */
const FLOAT_FRAME_S = 0.5;
/** Full motion: the float bob, one frame per FLOAT_FRAME_S. */
const FLOAT_CYCLE: readonly CormorantFrame[] = ['floatA', 'floatB'];
/** The float pose held under reduced motion. */
const STILL_FLOAT_FRAME: CormorantFrame = 'floatA';
/** Most bubbles in one cormorant's dive trail. */
const TRAIL_BUBBLES = 4;
/** Seconds a trail bubble takes to fade out. */
const TRAIL_FADE_S = 0.6;
/** Full motion: seconds between trail bubbles while diving, so at most TRAIL_BUBBLES are ever alive. */
const TRAIL_EMIT_S = TRAIL_FADE_S / TRAIL_BUBBLES;

/** One frame of cormorant rendering input: the encounter, motion and dt. */
export type CormorantViewFrame = Pick<PredatorFrame, 'encounter' | 'motion' | 'dt'>;

/** The encounter predator a cormorant is drawn from: its species and route id. */
export type CormorantSource = Pick<PredatorState, 'species' | 'routeId'>;

/** One bubble of a dive trail: its sprite and seconds since it was let go. */
interface TrailBubble {
  image: Phaser.GameObjects.Image;
  age: number;
}

/** The sprites and visual-only state of one cormorant. */
interface CormorantDrawing {
  /** Index of the cormorant in the encounter's `predators`. */
  index: number;
  /** The cormorant, anchored at the body centre (the logic point), its tail trailing behind it. */
  body: Phaser.GameObjects.Image;
  /** The dive trail, a ring of TRAIL_BUBBLES reused bubbles. */
  trail: TrailBubble[];
  /** The trail slot the next bubble takes: the oldest. */
  nextBubble: number;
  /** Seconds since the last trail bubble while diving; TRAIL_EMIT_S or more lets one go at once. */
  sinceBubble: number;
  /** Seconds the cormorant has floated under full motion; picks the float frame. */
  floatTime: number;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth)
    .setVisible(false);
}

/** The sign of `dx` as a facing, or `fallback` when it is 0. */
function facingOf(dx: number, fallback: -1 | 1): -1 | 1 {
  if (dx > 0) return 1;
  if (dx < 0) return -1;
  return fallback;
}

/** Whether the cormorant is under water: striking, or finishing its dive arc in the cooldown. */
function isDiving(state: PredatorState): boolean {
  return state.phase === 'lunge' || (state.phase === 'cooldown' && state.dive !== undefined);
}

/**
 * Draws each cormorant (issue #112; PRD N3, A11, ND-15; guide 7n) from its encounter state.
 * Visual only: it reads the encounter and the motion setting each frame, the bob and the bubble
 * trail are driven by the frame `dt`, so they freeze with the scene, and nothing here changes game
 * state. It reuses its sprites; per frame it allocates only `diveArcPose`'s result while a
 * cormorant is under water.
 *
 * Mapping: the sprite's anchor is the body centre, placed on the logic point (`state.pos`), and
 * the tail trails behind it. Floating, warning and drying, it faces `state.facing` with no turn.
 *
 * Phases: patrol floats, swapping floatA and floatB (CORMORANT_BOB apart) under full motion and
 * holding floatA under reduced motion; the warning shows the `warn` crouch for the whole warning;
 * the dive, the strike and the rest of the arc a connecting dive finishes in the cooldown (while
 * `state.dive` is kept), shows the `dive` pose at `diveArcPose`'s head, turned along its tangent and
 * mirrored when the tangent points left, so the eye stays on top; the cooldown after surfacing (or
 * after a cancelled warning) shows the `dry` pose, keeping the facing the logic keeps (turned
 * away). Floating, warning and drying draw at `heronBody`, under every cue object; under water it
 * draws at `heronStab`, in front of the tilapia and behind the halo and the axolotl. Under full
 * motion a dive leaves a trail of up to TRAIL_BUBBLES bubbles, each fading over TRAIL_FADE_S; under
 * reduced motion there is no trail. No "!" bubble and no glint, and the bill is always closed. A
 * hit shows only PredatorView's shared leg-loss poof.
 */
export class CormorantView {
  private readonly cormorants: CormorantDrawing[] = [];
  private readonly assets: GameAssets;

  /** `predators` holds every encounter predator, in `predators` order; only the cormorants are drawn. */
  constructor(scene: Phaser.Scene, assets: GameAssets, predators: readonly CormorantSource[]) {
    this.assets = assets;
    predators.forEach((predator, index) => {
      if (predator.species === CORMORANT_SPECIES.id) this.cormorants.push(this.createCormorant(scene, index));
    });
  }

  /** Draws one frame. Throws when a drawn index is no longer a cormorant in the encounter. */
  render(frame: CormorantViewFrame): void {
    for (const cormorant of this.cormorants) {
      const state = frame.encounter.predators[cormorant.index];
      if (!state || state.species !== CORMORANT_SPECIES.id) {
        throw new Error(`CormorantView: encounter predator ${cormorant.index} is not a cormorant`);
      }
      const diving = isDiving(state);
      if (diving) this.renderDive(cormorant, state);
      else this.renderAtSurface(cormorant, state, frame);
      this.renderTrail(cormorant, state, frame, diving);
    }
  }

  destroy(): void {
    for (const cormorant of this.cormorants) {
      cormorant.body.destroy();
      for (const bubble of cormorant.trail) bubble.image.destroy();
    }
  }

  private createCormorant(scene: Phaser.Scene, index: number): CormorantDrawing {
    const body = bakedImage(scene, this.assets.predator.cormorant[STILL_FLOAT_FRAME], DEPTH.heronBody);
    const bubbles = this.assets.baked.bubbles;
    const trail = Array.from({ length: TRAIL_BUBBLES }, (_, slot) => ({
      image: bakedImage(scene, bubbles[slot % bubbles.length], DEPTH.bubbles),
      age: TRAIL_FADE_S,
    }));
    return { index, body, trail, nextBubble: 0, sinceBubble: TRAIL_EMIT_S, floatTime: 0 };
  }

  /** Floating (bobbing under full motion), the warning crouch, or drying, at the logic point. */
  private renderAtSurface(cormorant: CormorantDrawing, state: PredatorState, frame: CormorantViewFrame): void {
    const info = this.assets.predator.cormorant[this.surfaceFrame(cormorant, state, frame)];
    cormorant.body
      .setTexture(info.key)
      .setVisible(true)
      .setDepth(DEPTH.heronBody)
      .setPosition(state.pos.x, state.pos.y)
      .setRotation(0);
    faceSprite(cormorant.body, state.facing, 1 / info.scale);
  }

  /** The warning shows `warn` and the cooldown `dry`; patrol bobs between the float frames under full motion only. */
  private surfaceFrame(cormorant: CormorantDrawing, state: PredatorState, frame: CormorantViewFrame): CormorantFrame {
    if (state.phase === 'telegraph') return 'warn';
    if (state.phase === 'cooldown') return 'dry';
    if (!frame.motion.ambient) return STILL_FLOAT_FRAME;
    cormorant.floatTime += frame.dt;
    return FLOAT_CYCLE[Math.floor(cormorant.floatTime / FLOAT_FRAME_S) % FLOAT_CYCLE.length];
  }

  /** The dive pose at the head, turned along the arc and mirrored when it heads left, so the eye stays on top. */
  private renderDive(cormorant: CormorantDrawing, state: PredatorState): void {
    const { head, tangent } = diveArcPose(state);
    const mirror = facingOf(tangent.x, state.facing);
    const info = this.assets.predator.cormorant.dive;
    cormorant.body
      .setTexture(info.key)
      .setVisible(true)
      .setDepth(DEPTH.heronStab)
      .setPosition(head.x, head.y)
      .setRotation(Math.atan2(mirror * tangent.y, mirror * tangent.x));
    faceSprite(cormorant.body, mirror, 1 / info.scale);
  }

  /**
   * Full motion: while diving, lets a bubble go at the logic point every TRAIL_EMIT_S into the
   * oldest slot; every bubble fades out over TRAIL_FADE_S where it was let go. Reduced motion hides
   * the whole trail.
   */
  private renderTrail(cormorant: CormorantDrawing, state: PredatorState, frame: CormorantViewFrame, diving: boolean): void {
    if (!frame.motion.ambient) {
      for (const bubble of cormorant.trail) {
        bubble.age = TRAIL_FADE_S;
        bubble.image.setVisible(false);
      }
      cormorant.sinceBubble = TRAIL_EMIT_S;
      return;
    }
    for (const bubble of cormorant.trail) bubble.age += frame.dt;
    cormorant.sinceBubble = diving ? cormorant.sinceBubble + frame.dt : TRAIL_EMIT_S;
    if (diving && cormorant.sinceBubble >= TRAIL_EMIT_S) {
      cormorant.sinceBubble = 0;
      const bubble = cormorant.trail[cormorant.nextBubble];
      cormorant.nextBubble = (cormorant.nextBubble + 1) % cormorant.trail.length;
      bubble.age = 0;
      bubble.image.setPosition(state.pos.x, state.pos.y);
    }
    for (const bubble of cormorant.trail) {
      const left = 1 - bubble.age / TRAIL_FADE_S;
      bubble.image.setVisible(left > 0).setAlpha(Math.max(0, left));
    }
  }
}
