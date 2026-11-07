import type * as Phaser from 'phaser';
import {
  MUD_TURTLE_CRAWL_FRAMES,
  MUD_TURTLE_HEAD_TO_TIP,
  MUD_TURTLE_NECK_LEN,
  MUD_TURTLE_STUMP,
  type MudTurtleFrame,
} from '../art/drawMudTurtle';
import { DEPTH } from '../art/layers';
import type { LakeTextures } from '../art/lakeTextures';
import type { TexInfo } from '../art/textures';
import { MUD_TURTLE_SPECIES, phaseProgress, type PredatorState } from '../logic/predators';
import type { GameAssets } from './BootScene';
import type { PredatorFrame } from './PredatorView';
import { faceSprite } from './spriteFacing';

/** Full motion: seconds each crawl frame shows while the turtle creeps. */
const CRAWL_FRAME_S = 0.5;
/** The pose for rest, the cooldown and a crawl under reduced motion. */
const STILL_FRAME: MudTurtleFrame = 'still';
/** Full motion: seconds a turn to a new facing takes, the sprite narrowing edge-on and widening mirrored. */
const TURN_S = 0.3;
/** Narrowest width share of a turn, so the turtle never vanishes edge-on mid-turn. */
const TURN_MIN_WIDTH = 0.2;

/** One frame of mud turtle rendering input: the encounter, motion and dt. */
export type MudTurtleViewFrame = Pick<PredatorFrame, 'encounter' | 'motion' | 'dt'>;

/** The encounter predator a mud turtle is drawn from: its species and route id. */
export type MudTurtleSource = Pick<PredatorState, 'species' | 'routeId'>;

/** The sprites and visual-only state of one mud turtle. */
interface MudTurtleDrawing {
  /** Index of the turtle in the encounter's `predators`. */
  index: number;
  /** The baked lake textures the sprites show. */
  art: LakeTextures;
  /** Snap neck piece, anchored at its top end on the stump. Added before `body`, so the shell covers its rear end. */
  neck: Phaser.GameObjects.Image;
  /** Body frame, anchored at the shell centre (the logic point), the tail trailing behind it. */
  body: Phaser.GameObjects.Image;
  /** Snap head piece, anchored at the head centre. Added after `neck`, so it draws over the neck's front end. */
  head: Phaser.GameObjects.Image;
  /** Seconds the turtle has crept under full motion; picks the crawl frame. */
  crawlTime: number;
  /** The logic place last drawn, to tell whether it moved this frame. */
  lastX: number;
  lastY: number;
  /** The facing last drawn; null before the first frame, which faces at once. */
  facing: -1 | 1 | null;
  /** Seconds since the drawn facing changed; TURN_S or more is a finished turn. */
  turnTime: number;
}

function lakeTexturesFor(assets: GameAssets): LakeTextures {
  if (assets.lake === null) throw new Error('MudTurtleView: mud turtles need the baked lake textures');
  return assets.lake;
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

/**
 * Draws each mud turtle (issue #212; PRD N3, A11; guide 7t) from its encounter state, at
 * DEPTH.tilapia: above the dark layer and the fading lights, so the darkness never hides it, and
 * behind the axolotl. Visual only: it reads the encounter and the motion setting each frame, the
 * crawl swap and the turn are driven by the frame `dt`, so they freeze with the scene, and nothing
 * here changes game state. It reuses its sprites and allocates nothing per frame.
 *
 * Mapping: the body anchor is the shell centre, placed on the logic point (`state.pos`), and every
 * piece is mirrored with faceSprite to `state.facing`. Under full motion a change of facing is a
 * TURN_S turn: the body narrows edge-on (never below TURN_MIN_WIDTH) and widens mirrored, so the
 * turtle visibly turns to face the axolotl as its warning starts; under reduced motion, and through
 * the snap, it faces at once.
 *
 * Phases: patrol swaps crawlA and crawlB every CRAWL_FRAME_S while the turtle creeps under full
 * motion and holds the frame while it does not; under reduced motion it holds `still`. The warning
 * shows the `warn` pose, head raised, for the whole warning, never blinked. The snap shows the
 * `snap` body frame with the neck and head pieces: the head goes in a straight line from the neck
 * stump (MUD_TURTLE_STUMP, mirrored with the body) toward the strike spot fixed at the warning's
 * start (`state.strikeSpot`), over the strike's share (`phaseProgress`), so the closed beak's tip
 * reaches the spot as the logic stab tip does; the neck piece stretches from the stump to the head
 * centre. The snap runs the same under reduced motion, because it is gameplay. The cooldown shows
 * `still`, the neck drawn back in, facing the axolotl as the logic keeps it. No "!" bubble and no
 * glint, and the beak is always closed and empty. A hit shows only PredatorView's shared leg-loss poof.
 */
export class MudTurtleView {
  private readonly turtles: MudTurtleDrawing[] = [];

  /**
   * `predators` holds every encounter predator, in `predators` order; only the mud turtles are
   * drawn. Throws when there is a mud turtle and the lake textures are missing.
   */
  constructor(scene: Phaser.Scene, assets: GameAssets, predators: readonly MudTurtleSource[]) {
    predators.forEach((predator, index) => {
      if (predator.species === MUD_TURTLE_SPECIES.id) this.turtles.push(this.createTurtle(scene, assets, index));
    });
  }

  /** Draws one frame. Throws when a drawn index is no longer a mud turtle in the encounter. */
  render(frame: MudTurtleViewFrame): void {
    for (const turtle of this.turtles) {
      const state = frame.encounter.predators[turtle.index];
      if (!state || state.species !== MUD_TURTLE_SPECIES.id) {
        throw new Error(`MudTurtleView: encounter predator ${turtle.index} is not a mud turtle`);
      }
      this.renderBody(turtle, state, frame);
      if (state.phase === 'lunge') {
        this.renderSnap(turtle, state);
      } else {
        turtle.neck.setVisible(false);
        turtle.head.setVisible(false);
      }
    }
  }

  destroy(): void {
    for (const turtle of this.turtles) {
      turtle.neck.destroy();
      turtle.body.destroy();
      turtle.head.destroy();
    }
  }

  private createTurtle(scene: Phaser.Scene, assets: GameAssets, index: number): MudTurtleDrawing {
    const art = lakeTexturesFor(assets);
    const neck = bakedImage(scene, art.mudTurtleNeck, DEPTH.tilapia);
    const body = bakedImage(scene, art.mudTurtle[STILL_FRAME], DEPTH.tilapia);
    const head = bakedImage(scene, art.mudTurtleHead, DEPTH.tilapia);
    return { index, art, neck, body, head, crawlTime: 0, lastX: Number.NaN, lastY: Number.NaN, facing: null, turnTime: TURN_S };
  }

  /** The body frame for the phase at the logic point, mirrored to the drawn facing and narrowed mid-turn. */
  private renderBody(turtle: MudTurtleDrawing, state: PredatorState, frame: MudTurtleViewFrame): void {
    const info = turtle.art.mudTurtle[this.bodyFrame(turtle, state, frame)];
    turtle.body.setTexture(info.key).setVisible(true).setPosition(state.pos.x, state.pos.y);
    const share = this.turnShare(turtle, state, frame);
    const drawnFacing = share < 0.5 ? facingOf(-state.facing, state.facing) : state.facing;
    const width = Math.max(TURN_MIN_WIDTH, Math.abs(Math.cos(Math.PI * share)));
    faceSprite(turtle.body, drawnFacing, width / info.scale, 1 / info.scale);
  }

  /** The warning shows `warn`, the snap `snap` and the cooldown `still`; patrol crawls under full motion only. */
  private bodyFrame(turtle: MudTurtleDrawing, state: PredatorState, frame: MudTurtleViewFrame): MudTurtleFrame {
    const moved = state.pos.x !== turtle.lastX || state.pos.y !== turtle.lastY;
    turtle.lastX = state.pos.x;
    turtle.lastY = state.pos.y;
    if (state.phase === 'telegraph') return 'warn';
    if (state.phase === 'lunge') return 'snap';
    if (state.phase === 'cooldown' || !frame.motion.ambient) return STILL_FRAME;
    if (moved) turtle.crawlTime += frame.dt;
    return MUD_TURTLE_CRAWL_FRAMES[Math.floor(turtle.crawlTime / CRAWL_FRAME_S) % MUD_TURTLE_CRAWL_FRAMES.length];
  }

  /**
   * How far through a turn to `state.facing` the turtle is, 0 to 1. A new facing starts a TURN_S
   * turn under full motion outside the snap; under reduced motion, in the snap or on the first
   * frame it faces at once.
   */
  private turnShare(turtle: MudTurtleDrawing, state: PredatorState, frame: MudTurtleViewFrame): number {
    const instant = !frame.motion.ambient || state.phase === 'lunge' || turtle.facing === null;
    if (state.facing !== turtle.facing) {
      turtle.facing = state.facing;
      turtle.turnTime = instant ? TURN_S : 0;
    } else {
      turtle.turnTime = instant ? TURN_S : Math.min(TURN_S, turtle.turnTime + frame.dt);
    }
    return turtle.turnTime / TURN_S;
  }

  /**
   * The snap: the head centre goes from the stump toward the strike spot over the strike's share,
   * stopping MUD_TURTLE_HEAD_TO_TIP short of it so the beak tip ends on the spot, and the neck
   * piece runs straight from the stump to the head centre. The head is mirrored when it heads left,
   * so its eye stays on top. Throws when the strike has no spot.
   */
  private renderSnap(turtle: MudTurtleDrawing, state: PredatorState): void {
    const spot = state.strikeSpot;
    if (spot === undefined) throw new Error(`MudTurtleView: mud turtle ${turtle.index} strikes with no strike spot`);
    const stumpX = state.pos.x + state.facing * MUD_TURTLE_STUMP[0];
    const stumpY = state.pos.y + MUD_TURTLE_STUMP[1];
    const dx = spot.x - stumpX;
    const dy = spot.y - stumpY;
    const reach = Math.hypot(dx, dy);
    const unitX = reach > 0 ? dx / reach : state.facing;
    const unitY = reach > 0 ? dy / reach : 0;
    const share = state.duration > 0 ? phaseProgress(state) : 1;
    const neckLen = Math.max(0, reach - MUD_TURTLE_HEAD_TO_TIP) * share;

    const neckInfo = turtle.art.mudTurtleNeck;
    turtle.neck
      .setVisible(neckLen > 0)
      .setPosition(stumpX, stumpY)
      .setRotation(Math.atan2(-unitX, unitY));
    faceSprite(turtle.neck, 1, 1 / neckInfo.scale, neckLen / MUD_TURTLE_NECK_LEN / neckInfo.scale);

    const headInfo = turtle.art.mudTurtleHead;
    const mirror = facingOf(unitX, state.facing);
    turtle.head
      .setVisible(true)
      .setPosition(stumpX + unitX * neckLen, stumpY + unitY * neckLen)
      .setRotation(Math.atan2(mirror * unitY, mirror * unitX));
    faceSprite(turtle.head, mirror, 1 / headInfo.scale);
  }
}
