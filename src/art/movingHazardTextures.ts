/**
 * Phaser glue for the moving hazard looks (issue #117, ND-8, ND-9; issue #77, ND-3): bakes a look's
 * painters into CanvasTextures. Visual only. No game state, no input, no physics.
 *
 * Looks are data. MOVING_HAZARD_LOOKS maps a look id (MovingHazardType.look in
 * src/logic/movingHazards.ts) to its four parts and where they sit along the shaft. A new look is
 * one painter file plus one entry here. The scene bakes only the looks the areas use, and draws the textures baked for a
 * hazard type's look.
 *
 * Same rules as textures.ts: every texture is drawn at `bakeScale`, so a sprite shows at logical
 * size with setScale(1 / info.scale).
 */
import * as Phaser from 'phaser';
import { PUNTING_POLES } from '../logic/tuning';
import type { TexSize } from './canvasKit';
import {
  GEYSER_BUBBLES_RISE,
  GEYSER_BUBBLES_TEX,
  GEYSER_CHIMNEY_TEX,
  GEYSER_COLUMN_LENGTH,
  GEYSER_COLUMN_TEX,
  GEYSER_MOUTH_RISE,
  GEYSER_RING_TEX,
  paintGeyserBubbles,
  paintGeyserChimney,
  paintGeyserColumn,
  paintGeyserRing,
} from './drawGeyserVent';
import {
  POLE_SHAFT_LENGTH,
  PUNTING_BOW_TEX,
  PUNTING_RING_TEX,
  PUNTING_SHADOW_DROP,
  PUNTING_SHADOW_TEX,
  PUNTING_SHAFT_TEX,
  paintPuntingBow,
  paintPuntingRing,
  paintPuntingShadow,
  paintPuntingShaft,
} from './drawPuntingPole';
import {
  DRIP_DROP_ALONG,
  DRIP_DROP_TEX,
  DRIP_RING_ALONG,
  DRIP_RING_TEX,
  DRIP_STREAM_LENGTH,
  DRIP_STREAM_TEX,
  STALACTITE_TEX,
  paintDripDrop,
  paintDripRing,
  paintDripStream,
  paintStalactite,
} from './drawStalactite';
import { bake, type TexInfo } from './textures';

// ---------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------

/**
 * The four parts every look has, so the scene draws any look the same way. The base is where the
 * shaft starts: the surface, a rock roof or the floor (MovingHazardType.from).
 * - `bow`: the thing at the base the shaft comes from (a boat's bow, a stalactite, a vent's
 *   chimney); anchor on the base at the shaft's x, drawn over the shaft;
 * - `shadow`: the warning cue near the base (the boat's shadow, a drop, bubbles); anchor is its
 *   centre; the scene fades it in over the warning;
 * - `shaft`: the part that goes out from the base; anchor is the tip, and the art runs back from it
 *   toward the base (up for a shaft going down, down for one going up); the scene crops it to the
 *   tip depth;
 * - `ring`: the ripple or shimmer the warning shows at the base; anchor is its centre.
 */
export type MovingHazardPart = 'bow' | 'shadow' | 'shaft' | 'ring';

/** Every part, in the order they are baked. */
export const MOVING_HAZARD_PARTS: readonly MovingHazardPart[] = ['bow', 'shadow', 'shaft', 'ring'];

/** One part of a look: its texture frame and the painter that draws it around the anchor. */
export interface MovingHazardPartPainter {
  readonly tex: TexSize;
  readonly paint: (ctx: CanvasRenderingContext2D) => void;
}

/**
 * Where a look's parts sit along its shaft's way, px from the base (provisional), so the scene
 * places every look the same way. Along means out from the base the way the shaft goes.
 */
export interface MovingHazardLookPlace {
  /** Px of shaft art the scene draws back past the base, hidden behind the bow. */
  readonly shaftPastBase: number;
  /** Px the drawn tip is held back toward the base at rest; the warning brings it out to the base. */
  readonly restBack: number;
  /** Px along from the base to the shadow's centre; negative is back past the base. */
  readonly shadowAlong: number;
  /** Px along from the base to the ring's centre. */
  readonly ringAlong: number;
  /** Px of shaft art from the tip back toward the base. */
  readonly shaftLength: number;
  /**
   * Whether a spawn whose drawn length is over shaftLength stacks repeated shaft pieces (the
   * pole's, issue #118, ND-4). A look that does not stack needs every spawn to fit its art.
   */
  readonly stacks: boolean;
}

/** A look: its id, one painter for each part and where the parts sit. */
export interface MovingHazardLook {
  readonly id: string;
  readonly parts: Readonly<Record<MovingHazardPart, MovingHazardPartPainter>>;
  readonly place: Readonly<MovingHazardLookPlace>;
}

/** Every moving hazard look by id. The ids match MovingHazardType.look. */
export const MOVING_HAZARD_LOOKS: Readonly<Record<string, MovingHazardLook>> = Object.freeze({
  'punting-pole': {
    id: 'punting-pole',
    parts: {
      bow: { tex: PUNTING_BOW_TEX, paint: paintPuntingBow },
      shadow: { tex: PUNTING_SHADOW_TEX, paint: paintPuntingShadow },
      shaft: { tex: PUNTING_SHAFT_TEX, paint: paintPuntingShaft },
      ring: { tex: PUNTING_RING_TEX, paint: paintPuntingRing },
    },
    /**
     * The shaft runs up past the surface behind the bow: the art's length less the pole's full
     * depth. At rest the pole is lifted 24 px, its tip over the surface.
     */
    place: {
      shaftPastBase: POLE_SHAFT_LENGTH - PUNTING_POLES.depth,
      restBack: 24,
      shadowAlong: PUNTING_SHADOW_DROP,
      ringAlong: 0,
      shaftLength: POLE_SHAFT_LENGTH,
      stacks: true,
    },
  },
  'stalactite-drip': {
    id: 'stalactite-drip',
    parts: {
      bow: { tex: STALACTITE_TEX, paint: paintStalactite },
      shadow: { tex: DRIP_DROP_TEX, paint: paintDripDrop },
      shaft: { tex: DRIP_STREAM_TEX, paint: paintDripStream },
      ring: { tex: DRIP_RING_TEX, paint: paintDripRing },
    },
    /**
     * The base is the underside of the rock the stalactite hangs from; the stream runs from its tip
     * back up to the base and no further, behind the stalactite, so none of it shows over the rock.
     * At rest and in the warning there is no stream: the drop swells at the tip and the ripple
     * rings grow just under it.
     */
    place: {
      shaftPastBase: 0,
      restBack: 0,
      shadowAlong: DRIP_DROP_ALONG,
      ringAlong: DRIP_RING_ALONG,
      shaftLength: DRIP_STREAM_LENGTH,
      stacks: false,
    },
  },
  'geyser-vent': {
    id: 'geyser-vent',
    parts: {
      bow: { tex: GEYSER_CHIMNEY_TEX, paint: paintGeyserChimney },
      shadow: { tex: GEYSER_BUBBLES_TEX, paint: paintGeyserBubbles },
      shaft: { tex: GEYSER_COLUMN_TEX, paint: paintGeyserColumn },
      ring: { tex: GEYSER_RING_TEX, paint: paintGeyserRing },
    },
    /**
     * The base is the bed top under the vent; the column runs down 16 px past it, inside the
     * chimney. At rest and in the warning no column shows: the bubbles rise and the ring shimmers
     * at the mouth.
     */
    place: {
      shaftPastBase: 16,
      restBack: 16,
      shadowAlong: GEYSER_BUBBLES_RISE,
      ringAlong: GEYSER_MOUTH_RISE,
      shaftLength: GEYSER_COLUMN_LENGTH,
      stacks: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** Fixed texture key of one part of a look, such as 'punting-pole-bow'. */
export const movingHazardTextureKey = (look: string, part: MovingHazardPart): string => `${look}-${part}`;

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

/** The baked parts of one look. */
export type MovingHazardLookTextures = Readonly<Record<MovingHazardPart, TexInfo>>;

/** Where the parts of a look sit. Throws on an unknown look, so a view never places a missing look. */
export function movingHazardLookPlace(look: string): Readonly<MovingHazardLookPlace> {
  if (!Object.hasOwn(MOVING_HAZARD_LOOKS, look)) throw new Error(`unknown moving hazard look "${look}"`);
  return MOVING_HAZARD_LOOKS[look].place;
}

/** The baked textures by look id: only the looks that were asked for. */
export type MovingHazardTextures = Readonly<Record<string, MovingHazardLookTextures>>;

/**
 * Bake the textures of the given looks into the scene's texture manager and return them by look.
 * Bakes only the looks it is given, each once however often it is listed, and no other. Throws
 * on an unknown look before it bakes any, so a bad id never leaves a half-baked set.
 */
export function bakeMovingHazardTextures(
  scene: Phaser.Scene,
  bakeScale: number,
  looks: readonly string[],
): MovingHazardTextures {
  const wanted: MovingHazardLook[] = [];
  for (const id of looks) {
    if (!Object.hasOwn(MOVING_HAZARD_LOOKS, id)) throw new Error(`unknown moving hazard look "${id}"`);
    if (!wanted.some((look) => look.id === id)) wanted.push(MOVING_HAZARD_LOOKS[id]);
  }

  const baked: Record<string, MovingHazardLookTextures> = {};
  for (const look of wanted) {
    const parts = {} as Record<MovingHazardPart, TexInfo>;
    for (const part of MOVING_HAZARD_PARTS) {
      const { tex, paint } = look.parts[part];
      parts[part] = bake(scene, movingHazardTextureKey(look.id, part), tex, bakeScale, paint);
    }
    baked[look.id] = parts;
  }
  return baked;
}

/** The baked parts of a look. Throws when that look was not baked, so a view never draws a missing texture. */
export function movingHazardLookTextures(baked: MovingHazardTextures, look: string): MovingHazardLookTextures {
  if (!Object.hasOwn(baked, look)) throw new Error(`no moving hazard look baked for "${look}"`);
  return baked[look];
}
