/**
 * Phaser glue for the Home Tank kit: bakes the tank layers, the "no" icon, the
 * Decoration sprites and their rarity glows into CanvasTextures. Visual only. No game state, no
 * input, no physics.
 *
 * Same rules as textures.ts: every texture is drawn at its bake scale through
 * the context transform, so the ink stays constant. A sprite shows at logical
 * size with setScale(1 / info.scale).
 */
import * as Phaser from 'phaser';
import type { BadgeShape } from './drawBadges';
import { NO_ICON_TEX, TANK_FRAME, paintNoIcon, paintTankBack, paintTankFront, paintTankGlass } from './drawHomeTank';
import { paintRarityGlow, rarityGlowTextureSize } from './drawRarityGlow';
import {
  decorationBaseOffset,
  paintTreasureIcon,
  paintWideDecoration,
  treasureIconTextureSize,
  wideDecorationTextureSize,
  type TreasureIconSlug,
} from './drawTreasures';
import type { TexSize } from './canvasKit';
import { bake, type TexInfo } from './textures';

/**
 * The Decorations that can stand in the Home Tank: the treasure icon slugs of the four canal
 * Decorations, the four pond ones, the six pond Area 3 ones, the six chinampa Area 4 ones, the five
 * chinampa Area 5 ones, then the six spring cave Area 6 ones (the text after `canal/`, `pond/`, `chinampa/`
 * or `spring-cave/` in src/logic/catalogue.ts), in catalogue order.
 * This file does not import the logic; keep it in step with the catalogue (treasureArt.test.ts checks).
 */
export const TANK_DECORATION_SLUGS = [
  'pond-plant',
  'toy-boat',
  'castle-tower',
  'sun-pyramid',
  'lily-pad',
  'cattail-clump',
  'frog-statue',
  'lotus-lantern',
  'reed-bundle',
  'drifting-feather',
  'wooden-duck-decoy',
  'firefly-string-lights',
  'firefly-jar',
  'golden-lotus-throne',
  'clay-flowerpot',
  'corn-husk-doll',
  'scarecrow',
  'papel-picado-banner',
  'willow-swing',
  'golden-corn',
  'watering-can',
  'floating-gourd',
  'pinata',
  'talavera-fountain',
  'alebrije-statue',
  'pebble-stack',
  'glow-moss-ball',
  'fossil-ammonite',
  'crystal-wind-chime',
  'geode-lamp',
  'crystal-arch',
] as const satisfies readonly TreasureIconSlug[];
export type TankDecorationSlug = (typeof TANK_DECORATION_SLUGS)[number];

/**
 * Badge shape of each Decoration's rarity (catalogue: Pond plant Common, Toy boat Rare, Castle tower
 * Epic, Sun pyramid Legendary; Lily pad Common, Cattail clump Common, Frog statue Rare, Lotus lantern
 * Epic; Reed bundle Common, Drifting feather Common, Wooden duck decoy Rare, Firefly string lights Rare,
 * Firefly jar Epic, Golden lotus throne Legendary; Clay flowerpot Common, Corn husk doll Common, Scarecrow Rare,
 * Papel picado banner Rare, Willow swing Epic, Golden corn Legendary; Watering can Common, Floating gourd Common,
 * Pinata Rare, Talavera fountain Epic, Alebrije statue Legendary; Pebble stack Common, Glow moss ball Common,
 * Fossil ammonite Rare, Crystal wind chime Rare, Geode lamp Epic, Crystal arch Legendary). This file does not
 * import the logic; keep it in step with the catalogue (treasureArt.test.ts checks).
 */
export const TANK_DECORATION_BADGES: Readonly<Record<TankDecorationSlug, BadgeShape>> = {
  'pond-plant': 'circle',
  'toy-boat': 'diamond',
  'castle-tower': 'shield',
  'sun-pyramid': 'star',
  'lily-pad': 'circle',
  'cattail-clump': 'circle',
  'frog-statue': 'diamond',
  'lotus-lantern': 'shield',
  'reed-bundle': 'circle',
  'drifting-feather': 'circle',
  'wooden-duck-decoy': 'diamond',
  'firefly-string-lights': 'diamond',
  'firefly-jar': 'shield',
  'golden-lotus-throne': 'star',
  'clay-flowerpot': 'circle',
  'corn-husk-doll': 'circle',
  scarecrow: 'diamond',
  'papel-picado-banner': 'diamond',
  'willow-swing': 'shield',
  'golden-corn': 'star',
  'watering-can': 'circle',
  'floating-gourd': 'circle',
  pinata: 'diamond',
  'talavera-fountain': 'shield',
  'alebrije-statue': 'star',
  'pebble-stack': 'circle',
  'glow-moss-ball': 'circle',
  'fossil-ammonite': 'diamond',
  'crystal-wind-chime': 'diamond',
  'geode-lamp': 'shield',
  'crystal-arch': 'star',
};

/** Where a Decoration goes in the Home Tank: on the gravel, on the water surface, or from the glass top. */
export type TankPlacementKind = 'floor' | 'floating' | 'hanging';

/** Placement kind and footprint width of a Decoration; an absent `width` means the standard 80 tank units. */
export interface TankDecorationShape {
  readonly placement: TankPlacementKind;
  /** Footprint width in tank units, set only when it is not the standard 80 (catalogue `width`). */
  readonly width?: number;
}

/**
 * Placement kind and width of each Decoration (catalogue `placement` and `width`): Hanging items are baked
 * with their anchor at the hook, and a wide item on its width x 80 box. This file does not import the
 * logic; keep it in step with the catalogue (treasureArt.test.ts checks).
 */
export const TANK_DECORATION_SHAPES: Readonly<Record<TankDecorationSlug, TankDecorationShape>> = {
  'pond-plant': { placement: 'floor' },
  'toy-boat': { placement: 'floor' },
  'castle-tower': { placement: 'floor' },
  'sun-pyramid': { placement: 'floor' },
  'lily-pad': { placement: 'floating' },
  'cattail-clump': { placement: 'floor' },
  'frog-statue': { placement: 'floor' },
  'lotus-lantern': { placement: 'floating' },
  'reed-bundle': { placement: 'floor' },
  'drifting-feather': { placement: 'floating' },
  'wooden-duck-decoy': { placement: 'floating' },
  'firefly-string-lights': { placement: 'hanging', width: 144 },
  'firefly-jar': { placement: 'hanging' },
  'golden-lotus-throne': { placement: 'floor' },
  'clay-flowerpot': { placement: 'floor' },
  'corn-husk-doll': { placement: 'floor' },
  scarecrow: { placement: 'floor' },
  'papel-picado-banner': { placement: 'hanging', width: 144 },
  'willow-swing': { placement: 'hanging' },
  'golden-corn': { placement: 'floor' },
  'watering-can': { placement: 'floor' },
  'floating-gourd': { placement: 'floating' },
  pinata: { placement: 'hanging' },
  'talavera-fountain': { placement: 'floor' },
  'alebrije-statue': { placement: 'floor' },
  'pebble-stack': { placement: 'floor' },
  'glow-moss-ball': { placement: 'floating' },
  'fossil-ammonite': { placement: 'floor' },
  'crystal-wind-chime': { placement: 'hanging' },
  'geode-lamp': { placement: 'floor' },
  'crystal-arch': { placement: 'floor' },
};

/** The standard Decoration footprint in tank units (TANK.decorationPx): a width x this box. */
const TANK_DECORATION_BOX = 80;

/** Rarity glow width as a multiple of the Decoration size (96 across at 80). */
export const TANK_GLOW_SCALE = 1.2;

/** Fixed texture keys for the tank layers and the "no" icon. */
export const TANK_TEX = {
  back: 'tank-back',
  glass: 'tank-glass',
  front: 'tank-front',
  noIcon: 'tank-no-icon',
} as const;

export const tankDecorationKey = (slug: TankDecorationSlug, px: number): string => `tank-deco-${slug}-${px}`;
export const tankDecorationGlowKey = (slug: TankDecorationSlug, px: number): string => `tank-deco-glow-${slug}-${px}`;

export interface TankBakeOptions {
  /** Decoration icon size baked, logical px on the longest side (guide 7f footprint is at most 120 x 140). */
  readonly decorationPx: number;
  /** Injected randomness in [0, 1), for the gravel pebbles. */
  readonly rand: () => number;
}

export interface TankTextures {
  /** Every tank texture by key. */
  readonly info: Readonly<Record<string, TexInfo>>;
  /**
   * Back layer: wall, stand, lid back, air gap, water, gravel. 480 x 360 logical,
   * origin top-left, baked at min(bakeScale, 2). Place it at (0, 0) at the back.
   */
  readonly back: TexInfo;
  /** Glass shine stripes. Same frame and scale as `back`. Drawn before the axolotls. */
  readonly glass: TexInfo;
  /** Tank outline and lid front. Same frame and scale as `back`. Drawn above the surface line, below the UI. */
  readonly front: TexInfo;
  /** The 24 px "no" icon for an invalid move. Anchor is the disc centre. */
  readonly noIcon: TexInfo;
  /**
   * One per Decoration, baked at `decorationPx` high (a wide one on its width x
   * 80 box, TANK_DECORATION_SHAPES). Anchor is the Decoration anchor: for Floor
   * and Floating, bottom-centre, the lowest ink edge of the item at the
   * horizontal middle, so place the sprite at the base point (x, base y); for
   * Hanging, top-centre, the hook on the glass top one footprint above it.
   */
  readonly decorations: Readonly<Record<TankDecorationSlug, TexInfo>>;
  /**
   * One rarity glow per Decoration, round(TANK_GLOW_SCALE * width) across and
   * round(TANK_GLOW_SCALE * decorationPx) tall, centred on the icon centre (the
   * box centre). Anchor is the same as `decorations[slug]`, so give it the same
   * position, scale and rotation as the Decoration sprite, at a lower depth.
   */
  readonly decorationGlows: Readonly<Record<TankDecorationSlug, TexInfo>>;
}

/** Tray icon sizes baked for an extra Decoration, logical px on the longest side (48 in the tray square, 32 in the box). */
export const EXTRA_DECORATION_ICON_SIZES = [48, 32] as const;
export type ExtraDecorationIconSize = (typeof EXTRA_DECORATION_ICON_SIZES)[number];

/**
 * Textures of Decorations that are not in the shipped four (the dev and test Decorations of the
 * dev build), keyed by Decoration id. Dev-free on purpose: the pack that fills it lives in its own
 * module, and this file never imports one. Every value is a TexInfo, so a sprite shows at logical
 * size with setScale(1 / info.scale), as the shipped records do.
 */
export interface ExtraDecorationTextures {
  /** Every extra texture by key. */
  readonly info: Readonly<Record<string, TexInfo>>;
  /**
   * Tank sprite per id, baked on a width x `decorationPx` box. A Floating item is anchored at
   * bottom-centre, a Hanging item at its top-centre hook, so place it at the Decoration anchor.
   */
  readonly decorations: Readonly<Record<string, TexInfo>>;
  /**
   * Tank rarity glow per id: round(TANK_GLOW_SCALE * width) across and round(TANK_GLOW_SCALE *
   * decorationPx) tall, centred on the box, with the same anchor as `decorations[id]`.
   */
  readonly decorationGlows: Readonly<Record<string, TexInfo>>;
  /** Tray icons by size, then id. Anchor is the icon centre. Tray glows reuse the shipped rarity glows by badge shape. */
  readonly icons: Readonly<Record<ExtraDecorationIconSize, Readonly<Record<string, TexInfo>>>>;
}

/** Bake the Home Tank layers, the "no" icon, the Decoration sprites and their rarity glows into the scene's texture manager. */
export function bakeTankTextures(scene: Phaser.Scene, bakeScale: number, opts: TankBakeOptions): TankTextures {
  const info: Record<string, TexInfo> = {};
  const add = (t: TexInfo): TexInfo => {
    info[t.key] = t;
    return t;
  };
  const { decorationPx, rand } = opts;
  const layerScale = Math.min(bakeScale, 2);

  const back = add(bake(scene, TANK_TEX.back, TANK_FRAME, layerScale, (ctx) => paintTankBack(ctx, rand)));
  const glass = add(bake(scene, TANK_TEX.glass, TANK_FRAME, layerScale, paintTankGlass));
  const front = add(bake(scene, TANK_TEX.front, TANK_FRAME, layerScale, paintTankFront));
  const noIcon = add(bake(scene, TANK_TEX.noIcon, NO_ICON_TEX, bakeScale, paintNoIcon));

  // Decorations: the icon frame (a wide one's box frame), with the anchor moved from its centre to the Decoration anchor.
  const decorations = {} as Record<TankDecorationSlug, TexInfo>;
  for (const slug of TANK_DECORATION_SLUGS) {
    const anchorY = decorationAnchorOffset(slug, decorationPx);
    const frame = decorationFrame(slug, decorationPx);
    decorations[slug] = add(
      bake(scene, tankDecorationKey(slug, decorationPx), { ...frame, originY: frame.originY + anchorY }, bakeScale, (ctx) => {
        ctx.translate(0, -anchorY);
        paintDecorationSprite(ctx, slug, decorationPx);
      }),
    );
  }

  const glowPx = Math.round(TANK_GLOW_SCALE * decorationPx);
  const decorationGlows = {} as Record<TankDecorationSlug, TexInfo>;
  for (const slug of TANK_DECORATION_SLUGS) {
    const anchorY = decorationAnchorOffset(slug, decorationPx);
    const glowW = decorationGlowWidth(slug, decorationPx);
    const frame = glowFrame(glowW, glowPx);
    decorationGlows[slug] = add(
      bake(scene, tankDecorationGlowKey(slug, decorationPx), { ...frame, originY: frame.originY + anchorY }, bakeScale, (ctx) => {
        ctx.translate(0, -anchorY);
        if (glowW !== glowPx) ctx.scale(glowW / glowPx, 1);
        paintRarityGlow(ctx, TANK_DECORATION_BADGES[slug], glowPx);
      }),
    );
  }

  return { info, back, glass, front, noIcon, decorations, decorationGlows };
}

/**
 * Distance from the centre of a Decoration's box down to its anchor, logical px: the lowest ink edge for
 * Floor and Floating, and minus half the box (its top-centre hook) for Hanging.
 */
function decorationAnchorOffset(slug: TankDecorationSlug, decorationPx: number): number {
  if (TANK_DECORATION_SHAPES[slug].placement === 'hanging') return -decorationPx / 2;
  return decorationBaseOffset(slug, decorationPx);
}

/** Sprite frame anchored at the box centre: the icon frame, or the box frame of a wide Decoration. */
function decorationFrame(slug: TankDecorationSlug, decorationPx: number): TexSize {
  const { width } = TANK_DECORATION_SHAPES[slug];
  return width === undefined ? treasureIconTextureSize(decorationPx) : wideDecorationTextureSize(width, decorationPx);
}

/** Paint the sprite centred on its box centre: the treasure icon, or the wide Decoration's own painter. */
function paintDecorationSprite(ctx: CanvasRenderingContext2D, slug: TankDecorationSlug, decorationPx: number): void {
  const { width } = TANK_DECORATION_SHAPES[slug];
  if (width === undefined) paintTreasureIcon(ctx, slug, decorationPx);
  else paintWideDecoration(ctx, slug, width, decorationPx);
}

/** Glow width across, logical px: TANK_GLOW_SCALE x the Decoration's width at `decorationPx` high. */
function decorationGlowWidth(slug: TankDecorationSlug, decorationPx: number): number {
  const { width } = TANK_DECORATION_SHAPES[slug];
  const widthPx = width === undefined ? decorationPx : (width * decorationPx) / TANK_DECORATION_BOX;
  return Math.round(TANK_GLOW_SCALE * widthPx);
}

/** Glow frame `w` across by `h` tall, centred on the glow: the rarity glow frame of each size on its own axis. */
function glowFrame(w: number, h: number): TexSize {
  const across = rarityGlowTextureSize(w);
  const tall = rarityGlowTextureSize(h);
  return { w: across.w, originX: across.originX, h: tall.h, originY: tall.originY };
}
