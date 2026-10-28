/**
 * Rarity colour, rarity glow and unfound-treasure silhouettes (guide 3e, 7e, 8), headless.
 * The painters run against a recording context and a stub Path2D (the same approach as
 * wearableArt.test.ts): every fill and stroke is kept with the style, width and alpha it
 * was painted under. The bake glue runs against a stubbed `bake`, so keys, frames and the
 * paint calls can be checked without Phaser.
 */
import { describe, expect, it, vi } from 'vitest';
import { badgeShape } from '../logic/hints';
import {
  ALL_TREASURES,
  CHINAMPA_2_TREASURES,
  CHINAMPA_TREASURES,
  POND_2_TREASURES,
  POND_TREASURES,
  SPRING_CAVE_TREASURES,
  isDecoration,
  placementKind,
  treasureSlug,
  type Decoration,
  type Treasure,
} from '../logic/catalogue';
import { DEV_DECORATIONS } from '../logic/devDecorations';
import { TANK, TOP_BASE_Y } from '../logic/tank';
import { BADGE_SHAPES } from './drawBadges';
import { paintRarityGlow, rarityGlowTextureSize } from './drawRarityGlow';
import {
  ALEBRIJE_BASE,
  ALEBRIJE_BODY,
  ALEBRIJE_HEAD,
  ALEBRIJE_MARKS,
  ALEBRIJE_TAIL,
  ALEBRIJE_WING,
  BANDANA_DOT,
  BANDANA_FILL,
  BEE_HEADBAND_FILL,
  CLAY_FLOWERPOT_FILL,
  CLAY_FLOWERPOT_SPROUT,
  CORN_HUSK_FILL,
  DREAM_SWATCH_IDS,
  EMBROIDERED_SHIRT_FILL,
  EMBROIDERY_BAND,
  EMBROIDERY_PETALS,
  GARDEN_OVERALLS_FILL,
  GOLDEN_CORN_BASE,
  GOLDEN_CORN_HUSK,
  GOLDEN_CORN_KERNEL,
  GOLDEN_CORN_ROW,
  GOURD_FILL,
  GEODE_CAVITY,
  GEODE_CRYSTAL,
  GOURD_WEIGHT,
  HEADLAMP_LENS,
  HUMMINGBIRD_RIBBON_FILL,
  MARIGOLD_PETAL,
  MONARCH_BODY,
  MONARCH_SPOT,
  MONARCH_WING,
  MOSS_GLOW_DOT,
  PAPEL_PICADO_APRICOT,
  PAPEL_PICADO_HOOK,
  PAPEL_PICADO_PINK,
  PINATA_APRICOT,
  PINATA_HOOK,
  PINATA_PINK,
  PINATA_SKY,
  SCARECROW_HAT,
  SCARECROW_POST,
  SCARECROW_SHIRT,
  SERAPE_FILL,
  SERAPE_STRIPES,
  STRAW_HAT_FILL,
  SUNFLOWER_CENTRE,
  SUNFLOWER_FRAME,
  TALAVERA_COBALT,
  TALAVERA_TILE,
  TALAVERA_WATER,
  TREASURE_ICON_SLUGS,
  WATERING_CAN_FILL,
  WILLOW_FROND,
  WILLOW_HOOK,
  WILLOW_SEAT,
  dreamSwatchTextureSize,
  paintDreamSwatch,
  paintDreamSwatchSilhouette,
  paintTreasureIcon,
  paintTreasureSilhouette,
  paintWideDecoration,
  treasureIconTextureSize,
  decorationBaseOffset,
  wideDecorationTextureSize,
  type TreasureIconSlug,
} from './drawTreasures';
import {
  bakeDevDecorations,
  devDecorationGlowKey,
  devDecorationGlowSize,
  devDecorationGlowTextureSize,
  devDecorationIconKey,
  devDecorationIconTextureSize,
  devDecorationKey,
  devDecorationTextureSize,
  paintDevDecoration,
  paintDevDecorationGlow,
  paintDevDecorationIcon,
} from './devDecorationArt';
import { DEPTH } from './layers';
import { INK, LILY_PAD, PEBBLE_A } from './palette';
import {
  EXTRA_DECORATION_ICON_SIZES,
  TANK_DECORATION_BADGES,
  TANK_DECORATION_SHAPES,
  TANK_DECORATION_SLUGS,
  TANK_GLOW_SCALE,
  bakeTankTextures,
  tankDecorationGlowKey,
  tankDecorationKey,
  type TankDecorationSlug,
} from './tankTextures';
import { TAU, type TexSize } from './canvasKit';
import tankTexturesSource from './tankTextures.ts?raw';
import {
  DREAM_SWATCH_SILHOUETTE_KEY,
  RARITY_GLOW_SIZES,
  TREASURE_SILHOUETTE_SIZE,
  bakeTreasureTextures,
  rarityGlowKey,
  treasureSilhouetteKey,
} from './treasureTextures';
import {
  AMMONITE_FILL,
  AMMONITE_SLAB,
  BADGE_FILL,
  BOAT_TRIM,
  BOW_GEM,
  CASTLE_GEM,
  CASTLE_TRIM,
  CATTAIL_HEAD,
  CATTAIL_STEM,
  CAVE_CRYSTAL_FILL,
  CRYSTAL_ARCH_BASE,
  CRYSTAL_CROWN_BAND,
  CRYSTAL_CUFF_BAND,
  DECOY_BEAK,
  DECOY_BODY,
  DRAGONFLY_FRAME,
  DRAGONFLY_WING,
  DREAM_SWATCH,
  EXPLORER_VEST_FILL,
  FEATHER_CAP_FILL,
  FEATHER_FILL,
  FIREFLY_BULB,
  FIREFLY_CAPE_FILL,
  FIREFLY_HOOK,
  FIREFLY_JAR_GLASS,
  FIREFLY_JAR_LID,
  FIREFLY_SOCKET,
  FROG_STATUE_STONE,
  FROGGY_BOOT,
  GEM_GLINT,
  GEODE_BASE_FILL,
  GEODE_ROCK_FILL,
  GOLD_TRIM,
  GOLDEN_LOTUS_BASE,
  GOLDEN_LOTUS_PETAL,
  GOLDEN_LOTUS_SEAT,
  LADYBUG_SHELL,
  LILY_CROWN_FLOWER,
  LILY_CROWN_LEAF,
  LILY_PAD_FILL,
  LILY_PAD_SOCK_FILL,
  LOTUS_LANTERN_BODY,
  LOTUS_PETAL,
  MINERS_HELMET_FILL,
  MOSS_BALL_FILL,
  MOSS_BALL_WEIGHT,
  PEARL_CHARM_CORD,
  PEARL_FILL,
  PEBBLE_STACK_FILL,
  POND_WEED_SCARF,
  PYRAMID_GEM,
  RAINCOAT_FILL,
  RARITY_GLOW_ALPHA,
  REED_BUNDLE_STALK,
  TREASURE_SILHOUETTE_FILL,
  TREASURE_STAR,
  WATER_LILY_BLOSSOM,
  WATER_LILY_SHIRT_FILL,
  WIND_CHIME_BAR,
  WIND_CHIME_HOOK,
  type BadgeShape,
} from './treasurePalette';

vi.mock('phaser', () => ({}));

/** Bakes recorded by the stubbed `bake`: the frame it was given and its paint callback. */
interface BakeCall {
  readonly key: string;
  readonly size: TexSize;
  readonly paint: (ctx: CanvasRenderingContext2D) => void;
}
const bakes = vi.hoisted(() => [] as BakeCall[]);

vi.mock('./textures', () => ({
  bake: (_scene: unknown, key: string, size: TexSize, scale: number, paint: BakeCall['paint']) => {
    bakes.push({ key, size, paint });
    return { key, scale, ...size };
  },
}));

/** Guide 3e and 4: the four greens and teal the Common fill must stand apart from. */
const COMMON_NEIGHBOURS = ['#86e660', '#7dff8f', '#a8f0cf', '#55e4d8'] as const;
/** Minimum luminance contrast between Common and each neighbour. */
const COMMON_NEIGHBOUR_RATIO = 1.6;
/** Badge fills are UI on a panel: 4.5:1 with ink (guide 3e). */
const BADGE_INK_RATIO = 4.5;
/** Greyscale contrast between rarity fills, rounded to 2 places (guide 3e). */
const GREYSCALE_PAIRS: readonly [BadgeShape, BadgeShape, number][] = [
  ['circle', 'diamond', 1.16],
  ['circle', 'shield', 1.17],
  ['circle', 'star', 1.54],
  ['diamond', 'shield', 1.36],
  ['diamond', 'star', 1.33],
  ['shield', 'star', 1.8],
];
/** The '?' tube width at every size. */
const Q_LW = 2.4;
/** The icons whose outer silhouette includes coloured tubes (cord, glasses band, wreath, lantern tassel, sunflower glasses, pendant chain). */
const TUBE_SLUGS: readonly TreasureIconSlug[] = [
  'shell-necklace',
  'heart-glasses',
  'lotus-lantern',
  'lily-flower-crown',
  'dragonfly-glasses',
  'sunflower-sunglasses',
  'crystal-pendant',
];
/**
 * The treasures of an area's list whose ids start with its own `prefix`: the ones that area added.
 * Treasures that moved out of the canal (issue #146) keep their 'canal/' ids and stay canal art.
 */
function addedBy(treasures: readonly Treasure[], prefix: 'pond' | 'chinampa' | 'spring-cave'): Treasure[] {
  return treasures.filter((treasure) => treasure.id.startsWith(`${prefix}/`));
}
/** The slugs the pond added (the text after `pond/`), from the catalogue. */
const POND_SLUGS: readonly string[] = addedBy(POND_TREASURES, 'pond').map((treasure) => treasureSlug(treasure.id));
/** The slugs the pond Area 3 added (the text after `pond/`), from the catalogue. */
const POND_2_SLUGS: readonly string[] = addedBy(POND_2_TREASURES, 'pond').map((treasure) => treasureSlug(treasure.id));
/** The slugs the chinampa Area 4 added (the text after `chinampa/`), from the catalogue. */
const CHINAMPA_SLUGS: readonly string[] = addedBy(CHINAMPA_TREASURES, 'chinampa').map((treasure) => treasureSlug(treasure.id));
/** The slugs the chinampa Area 5 added (the text after `chinampa/`), from the catalogue. */
const CHINAMPA_2_SLUGS: readonly string[] = addedBy(CHINAMPA_2_TREASURES, 'chinampa').map((treasure) =>
  treasureSlug(treasure.id),
);
/** The slugs the spring cave Area 6 added (the text after `spring-cave/`), from the catalogue: 11 items and the Moonstone Paint shell. */
const SPRING_CAVE_SLUGS: readonly string[] = addedBy(SPRING_CAVE_TREASURES, 'spring-cave').map((treasure) =>
  treasureSlug(treasure.id),
);
/** The slugs the canal had before the pond: 12 items, then its 12 Paint shells. */
const CANAL_ICON_SLUGS = TREASURE_ICON_SLUGS.filter(
  (slug) =>
    !SPRING_CAVE_SLUGS.includes(slug) &&
    !POND_SLUGS.includes(slug) &&
    !POND_2_SLUGS.includes(slug) &&
    !CHINAMPA_SLUGS.includes(slug) &&
    !CHINAMPA_2_SLUGS.includes(slug),
);
/** The icon slugs the pond added: 11 items, then the Lily green Paint shell. */
const POND_ICON_SLUGS = TREASURE_ICON_SLUGS.filter((slug) => POND_SLUGS.includes(slug));
/** The icon slugs the pond Area 3 added: 11 items, then the Firefly gold Paint shell. */
const AREA3_ICON_SLUGS = TREASURE_ICON_SLUGS.filter((slug) => POND_2_SLUGS.includes(slug));
/** The icon slugs the chinampa Area 4 added: 11 items, then the Poppy red Paint shell. */
const CHINAMPA_ICON_SLUGS = TREASURE_ICON_SLUGS.filter((slug) => CHINAMPA_SLUGS.includes(slug));
/** The icon slugs the chinampa Area 5 added: 11 items, then the Plum Paint shell. */
const CHINAMPA_2_ICON_SLUGS = TREASURE_ICON_SLUGS.filter((slug) => CHINAMPA_2_SLUGS.includes(slug));
/** The icon slugs the spring cave Area 6 added: 11 items, then the Moonstone Paint shell. */
const SPRING_CAVE_ICON_SLUGS = TREASURE_ICON_SLUGS.filter((slug) => SPRING_CAVE_SLUGS.includes(slug));
/**
 * Call-log digests of the normal painters, recorded before flat mode existed: per size, the
 * digest of every canal icon digest in TREASURE_ICON_SLUGS order; then every canal Dream
 * swatch at 32. The canal entries must never change (the canal art is draw-identical).
 */
const NORMAL_ICON_DIGESTS: Readonly<Record<number, string>> = {
  28: '2bfc2b72efe633fe:529',
  32: 'e52d43a7e49851db:529',
  48: 'e640dae2b696ac76:529',
  80: '010fb26f91be1423:529',
};
const NORMAL_SWATCH_DIGEST = 'f7aaf783ea0f56df:259';
/**
 * The same digests for the icons and the swatch the pond added, pinned when they were authored (the
 * 11 pond items, then the Lily green Paint shell). Re-pin these, and only these, when the pond art is
 * retuned on purpose.
 */
const POND_ICON_DIGESTS: Readonly<Record<number, string>> = {
  28: 'b136eddcd49ad938:264',
  32: 'd19ffb7ee4b9903a:265',
  48: 'c39ec83a31bfd326:265',
  80: '7a0548c9c515be15:265',
};
const POND_SWATCH_DIGEST = '8562a1386951ef0c:20';
/**
 * The same digests for the icons and the swatch the pond Area 3 added (the 11 items, then the Firefly gold
 * Paint shell), pinned when they were authored. Re-pin these, and only these, when the Area 3 art is retuned
 * on purpose.
 */
const AREA3_ICON_DIGESTS: Readonly<Record<number, string>> = {
  28: 'f30c99b6bc1f322a:263',
  32: '1e44127fb0ba1103:263',
  48: '8a71b50e7e1842ea:263',
  80: '173aa272c89bbf1e:263',
};
const AREA3_SWATCH_DIGEST = '9a5d5d65fa5e0b19:20';
/**
 * The same digests for the icons and the swatch the chinampa Area 4 added (the 11 items, then the Poppy red
 * Paint shell), pinned when they were authored. Re-pin these, and only these, when the Area 4 art is retuned
 * on purpose.
 */
const CHINAMPA_ICON_DIGESTS: Readonly<Record<number, string>> = {
  28: '59d7c9675993a2cb:264',
  32: '6cf633e533739759:265',
  48: 'edb6d0a6bef3201a:265',
  80: 'f6dd00ca9aec61ae:265',
};
const CHINAMPA_SWATCH_DIGEST = '59cc1a40f1f204b4:20';
/**
 * The same digests for the icons and the swatch the chinampa Area 5 added (the 11 items, then the Plum Paint
 * shell), pinned when they were authored. Re-pin these, and only these, when the Area 5 art is retuned on
 * purpose.
 */
const CHINAMPA_2_ICON_DIGESTS: Readonly<Record<number, string>> = {
  28: '92f2ec228dd8f7ee:265',
  32: '786ef47e186e3b02:265',
  48: '7b52381e12f6843a:265',
  80: 'ae1c2d49a3e3277d:265',
};
const CHINAMPA_2_SWATCH_DIGEST = '283dbca78aec2213:21';
/**
 * The same digests for the icons the spring cave Area 6 added (the 11 items, then the Moonstone Paint shell),
 * pinned when they were authored (issue #77). Re-pin these, and only these, when the Area 6 art is retuned on
 * purpose.
 */
const SPRING_CAVE_ICON_DIGESTS: Readonly<Record<number, string>> = {
  28: '4da947d556644ca9:264',
  32: '465056436bb6323f:264',
  48: 'ad097f4abf318a66:264',
  80: '9adf8734fc479810:264',
};
/** The same digest for the Moonstone swatch (issue #77), pinned when it was authored. Re-pin it, and only it, when Moonstone is retuned on purpose. */
const MOONSTONE_SWATCH_DIGEST = '0d26c3a93a452bc5:20';
const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function channelsOf(hex: string): [number, number, number] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Parse `rgba(r,g,b,a)` into its channels and alpha. */
function parseRgba(css: string): { rgb: number[]; alpha: number } {
  const match = /^rgba\((\d+),(\d+),(\d+),([\d.e-]+)\)$/.exec(css);
  expect(match, css).not.toBeNull();
  const parts = (match as RegExpExecArray).slice(1).map(Number);
  return { rgb: parts.slice(0, 3), alpha: parts[3] };
}

// ---------------------------------------------------------------------------
// A recording canvas context
// ---------------------------------------------------------------------------

/** A Path2D stand-in that keeps its commands (nested paths inline). */
class LogPath {
  readonly cmds: unknown[] = [];
  constructor() {
    return new Proxy(this, {
      get: (target, key) => (key === 'cmds' ? target.cmds : (...args: unknown[]) => recordPathCmd(target, key, args)),
    });
  }
}

function recordPathCmd(target: LogPath, key: string | symbol, args: unknown[]): void {
  target.cmds.push([String(key), ...args.map((a) => (a instanceof LogPath ? a.cmds : a))]);
}

interface Gradient {
  readonly args: number[];
  readonly stops: [number, string][];
}

/** One draw call with the style it was painted under. */
interface Op {
  readonly op: string;
  readonly args: unknown[];
  readonly fillStyle: unknown;
  readonly strokeStyle: unknown;
  readonly lineWidth: number;
  readonly globalAlpha: number;
}

const DRAW_OPS = new Set(['fill', 'fillRect', 'stroke', 'strokeRect', 'fillText', 'strokeText', 'drawImage']);
const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha'] as const;

interface Recording {
  readonly ctx: CanvasRenderingContext2D;
  readonly ops: Op[];
  readonly calls: [string, unknown[]][];
  readonly gradients: Gradient[];
}

/** A context that records every draw call, path call and gradient. Supports save and restore. */
function recordingContext(): Recording {
  const ops: Op[] = [];
  const calls: [string, unknown[]][] = [];
  const gradients: Gradient[] = [];
  let state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
  const stack: Record<string, unknown>[] = [];
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    save: () => void stack.push({ ...state }),
    restore: () => {
      state = stack.pop() ?? state;
    },
    createRadialGradient: (...args: unknown[]) => {
      const gradient: Gradient = { args: args as number[], stops: [] };
      gradients.push(gradient);
      return { addColorStop: (offset: number, colour: string) => void gradient.stops.push([offset, colour]) };
    },
  };
  const recordCall = (name: string, args: unknown[]): unknown => {
    calls.push([name, args]);
    if (DRAW_OPS.has(name)) {
      ops.push({
        op: name,
        args: args.map((a) => (a instanceof LogPath ? a.cmds : a)),
        fillStyle: state.fillStyle,
        strokeStyle: state.strokeStyle,
        lineWidth: state.lineWidth as number,
        globalAlpha: state.globalAlpha as number,
      });
    }
    return methods[name]?.(...args);
  };
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if ((STATE_KEYS as readonly string[]).includes(name)) return state[name];
        return (...args: unknown[]) => recordCall(name, args);
      },
      set: (_target, key, value) => {
        state[String(key)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, ops, calls, gradients };
}

/** Run `paint` with Path2D stubbed and return what it drew. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Recording {
  vi.stubGlobal('Path2D', LogPath);
  const rec = recordingContext();
  try {
    paint(rec.ctx);
  } finally {
    vi.unstubAllGlobals();
  }
  return rec;
}

/** FNV-1a digest pair of `text`, plus its length. */
function digest(text: string): string {
  const hash = (seed: number): string => {
    let x = seed;
    for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619) >>> 0;
    return x.toString(16).padStart(8, '0');
  };
  return `${hash(0x811c9dc5)}${hash(0x9e3779b9)}:${text.length}`;
}

/** Digest of every context call and property write `paint` makes, in order. */
function callLogDigest(paint: (ctx: CanvasRenderingContext2D) => void): string {
  const log: unknown[] = [];
  vi.stubGlobal('Path2D', LogPath);
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, key) =>
        (...args: unknown[]) => {
          log.push([String(key), ...args.map((a) => (a instanceof LogPath ? a.cmds : a))]);
        },
      set: (_target, key, value) => {
        log.push(['set', String(key), value]);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  try {
    paint(ctx);
  } finally {
    vi.unstubAllGlobals();
  }
  return digest(JSON.stringify(log));
}

// ---------------------------------------------------------------------------
// The "?" glyph
// ---------------------------------------------------------------------------

/** The '?' is the last stroke (the hook, ink 2.4) and the last fill (the dot, ink), centred on (0, 0). */
function expectQuestionMark(ops: readonly Op[], label: string): void {
  const hook = ops[ops.length - 2];
  const dot = ops[ops.length - 1];
  expect(hook.op, label).toBe('stroke');
  expect(hook.strokeStyle, label).toBe(INK);
  expect(hook.lineWidth, label).toBe(Q_LW);
  expect(dot.op, label).toBe('fill');
  expect(dot.fillStyle, label).toBe(INK);

  const hookCmds = hook.args[0] as unknown[][];
  const arc = hookCmds.find((c) => c[0] === 'arc') as unknown as [string, number, number, number] | undefined;
  expect(arc, label).toBeDefined();
  const [, hookX, hookY, hookR] = arc as [string, number, number, number];
  const dotCmds = dot.args[0] as unknown[][];
  const ellipse = dotCmds.find((c) => c[0] === 'ellipse') as unknown as [string, number, number, number] | undefined;
  expect(ellipse, label).toBeDefined();
  const [, dotX, dotY, dotR] = ellipse as [string, number, number, number];
  expect(Math.abs(hookX), `${label} hook centred in x`).toBeLessThan(EPS);
  expect(Math.abs(dotX), `${label} dot centred in x`).toBeLessThan(EPS);
  const top = hookY - hookR - Q_LW / 2;
  const bottom = dotY + dotR;
  expect(Math.abs(top + bottom), `${label} centred in y`).toBeLessThan(1e-6);
  expect(dotR, label).toBeCloseTo(0.55 * Q_LW, 9);
}

/** Every fill is the silhouette fill or the ink dot; every stroke is ink, or a tube colour on the tube icons. */
function expectSilhouetteColours(rec: Recording, label: string, tubes: boolean): void {
  expect(rec.gradients, label).toHaveLength(0);
  for (const op of rec.ops) {
    expect(op.globalAlpha, `${label} ${op.op} alpha`).toBe(1);
    if (op.op === 'fill' || op.op === 'fillRect') {
      expect([TREASURE_SILHOUETTE_FILL, INK], `${label} fill`).toContain(op.fillStyle);
    } else {
      expect(op.op, label).toBe('stroke');
      const allowed = tubes ? [INK, TREASURE_SILHOUETTE_FILL] : [INK];
      expect(allowed, `${label} stroke`).toContain(op.strokeStyle);
    }
  }
  expect(rec.ops.filter((op) => op.op === 'fill' && op.fillStyle === INK), `${label} one ink dot`).toHaveLength(1);
  const silhouetteOps = rec.ops.filter(
    (op) => (op.op === 'fill' ? op.fillStyle : op.op === 'stroke' ? op.strokeStyle : null) === TREASURE_SILHOUETTE_FILL,
  );
  expect(silhouetteOps.length, `${label} uses the silhouette fill`).toBeGreaterThan(0);
}

function inkStrokeSignature(op: Op): string {
  return JSON.stringify([op.lineWidth, op.args]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Rarity fills (guide 3e)', () => {
  it('makes Common the green #1fb98d', () => {
    expect(BADGE_FILL.circle).toBe('#1fb98d');
  });

  it('keeps every fill at 4.5:1 or more with ink, and all four fills differ', () => {
    for (const shape of BADGE_SHAPES) {
      expect(contrastRatio(BADGE_FILL[shape], INK), shape).toBeGreaterThanOrEqual(BADGE_INK_RATIO);
    }
    expect(new Set(BADGE_SHAPES.map((shape) => BADGE_FILL[shape])).size).toBe(4);
  });

  it('gives Common the measured luminance and ink ratio', () => {
    expect(relativeLuminance(BADGE_FILL.circle)).toBeCloseTo(0.369, 3);
    expect(Math.round(contrastRatio(BADGE_FILL.circle, INK) * 100) / 100).toBe(5.75);
  });

  it('keeps Common at least 1.6:1 from the nearby greens and teal', () => {
    for (const neighbour of COMMON_NEIGHBOURS) {
      expect(contrastRatio(BADGE_FILL.circle, neighbour), neighbour).toBeGreaterThanOrEqual(COMMON_NEIGHBOUR_RATIO);
    }
  });

  it('matches the greyscale pair table', () => {
    for (const [a, b, ratio] of GREYSCALE_PAIRS) {
      expect(Math.round(contrastRatio(BADGE_FILL[a], BADGE_FILL[b]) * 100) / 100, `${a}/${b}`).toBe(ratio);
    }
  });
});

describe('paintRarityGlow', () => {
  it.each(BADGE_SHAPES.flatMap((shape) => [40, 56, 96].map((size) => [shape, size] as const)))(
    '%s at %i uses only its badge fill, never above the peak alpha, fading to 0 at the edge',
    (shape, size) => {
      const rec = record((ctx) => paintRarityGlow(ctx, shape, size));
      expect(rec.gradients).toHaveLength(1);
      const [gradient] = rec.gradients;
      const [x0, y0, r0, x1, y1, r1] = gradient.args;
      expect([x0, y0, r0, x1, y1]).toEqual([0, 0, 0, 0, 0]);
      expect(r1).toBeLessThanOrEqual(size / 2);
      const fill = channelsOf(BADGE_FILL[shape]);
      for (const [offset, colour] of gradient.stops) {
        const { rgb, alpha } = parseRgba(colour);
        expect(rgb, `${offset}`).toEqual(fill);
        expect(alpha, `${offset}`).toBeLessThanOrEqual(RARITY_GLOW_ALPHA);
        expect(alpha, `${offset}`).toBeGreaterThanOrEqual(0);
        if (offset <= 0.5) expect(alpha, `${offset}`).toBe(RARITY_GLOW_ALPHA);
      }
      const offsets = gradient.stops.map(([offset]) => offset);
      expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
      const [lastOffset, lastColour] = gradient.stops[gradient.stops.length - 1];
      expect(lastOffset).toBe(1);
      expect(parseRgba(lastColour).alpha).toBe(0);

      expect(rec.ops).toHaveLength(1);
      expect(rec.ops[0].op).toBe('fill');
      for (const [name, args] of rec.calls) {
        if (name === 'arc') expect(args[2] as number).toBeLessThanOrEqual(size / 2);
      }
    },
  );

  it('fits the disc in its frame with a centre anchor', () => {
    for (const size of RARITY_GLOW_SIZES) {
      const frame = rarityGlowTextureSize(size);
      expect(frame.originX).toBeGreaterThanOrEqual(size / 2);
      expect(frame.w - frame.originX).toBeGreaterThanOrEqual(size / 2);
      expect(frame.originY).toBeGreaterThanOrEqual(size / 2);
      expect(frame.h - frame.originY).toBeGreaterThanOrEqual(size / 2);
      expect(frame.originX * 2).toBe(frame.w);
    }
  });
});

describe('Unfound silhouettes', () => {
  it.each(TREASURE_ICON_SLUGS.flatMap((slug) => [28, 32, 48].map((size) => [slug, size] as const)))(
    '%s at %i is flat silhouette fill, the normal outer ink and an ink "?"',
    (slug, size) => {
      const flat = record((ctx) => paintTreasureSilhouette(ctx, slug, size));
      expectSilhouetteColours(flat, slug, TUBE_SLUGS.includes(slug));
      expectQuestionMark(flat.ops, slug);

      const normal = record((ctx) => paintTreasureIcon(ctx, slug, size));
      const normalInk = new Set(
        normal.ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK).map(inkStrokeSignature),
      );
      const flatInk = flat.ops.slice(0, -2).filter((op) => op.op === 'stroke' && op.strokeStyle === INK);
      expect(flatInk.length, slug).toBeGreaterThan(0);
      for (const op of flatInk) expect(normalInk.has(inkStrokeSignature(op)), `${slug} outer ink`).toBe(true);
    },
  );

  it('draws the Dream swatch silhouette as a flat tile with ink 2.6 and an ink "?"', () => {
    const rec = record((ctx) => paintDreamSwatchSilhouette(ctx, 32));
    expectSilhouetteColours(rec, 'swatch', false);
    expectQuestionMark(rec.ops, 'swatch');
    expect(rec.ops.map((op) => op.op)).toEqual(['fill', 'stroke', 'stroke', 'fill']);
    expect(rec.ops[1].lineWidth).toBe(2.6);
  });

  it('leaves the normal icons and swatches making exactly the calls they made before flat mode', () => {
    const swatchDigests = (ids: readonly (typeof DREAM_SWATCH_IDS)[number][]): string =>
      digest(ids.map((id) => callLogDigest((ctx) => paintDreamSwatch(ctx, id, 32))).join('|'));
    for (const size of [28, 32, 48, 80]) {
      const digestOf = (slugs: readonly TreasureIconSlug[]): string =>
        digest(slugs.map((slug) => callLogDigest((ctx) => paintTreasureIcon(ctx, slug, size))).join('|'));
      expect(digestOf(CANAL_ICON_SLUGS), `canal ${size}`).toBe(NORMAL_ICON_DIGESTS[size]);
      expect(digestOf(POND_ICON_SLUGS), `pond ${size}`).toBe(POND_ICON_DIGESTS[size]);
      expect(digestOf(AREA3_ICON_SLUGS), `area 3 ${size}`).toBe(AREA3_ICON_DIGESTS[size]);
      expect(digestOf(CHINAMPA_ICON_SLUGS), `area 4 ${size}`).toBe(CHINAMPA_ICON_DIGESTS[size]);
      expect(digestOf(CHINAMPA_2_ICON_SLUGS), `area 5 ${size}`).toBe(CHINAMPA_2_ICON_DIGESTS[size]);
      expect(digestOf(SPRING_CAVE_ICON_SLUGS), `area 6 ${size}`).toBe(SPRING_CAVE_ICON_DIGESTS[size]);
    }
    expect(
      swatchDigests(
        DREAM_SWATCH_IDS.filter(
          (id) => id !== 'lily-green' && id !== 'firefly-gold' && id !== 'poppy-red' && id !== 'plum' && id !== 'moonstone',
        ),
      ),
      'canal swatches',
    ).toBe(NORMAL_SWATCH_DIGEST);
    expect(swatchDigests(['lily-green']), 'lily-green swatch').toBe(POND_SWATCH_DIGEST);
    expect(swatchDigests(['firefly-gold']), 'firefly-gold swatch').toBe(AREA3_SWATCH_DIGEST);
    expect(swatchDigests(['poppy-red']), 'poppy-red swatch').toBe(CHINAMPA_SWATCH_DIGEST);
    expect(swatchDigests(['plum']), 'plum swatch').toBe(CHINAMPA_2_SWATCH_DIGEST);
    expect(swatchDigests(['moonstone']), 'moonstone swatch').toBe(MOONSTONE_SWATCH_DIGEST);
  });
});

describe('Treasure texture bakes', () => {
  it('bakes the glows, silhouettes and the swatch silhouette with their keys and frames', () => {
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    for (const size of RARITY_GLOW_SIZES) {
      for (const shape of BADGE_SHAPES) {
        const info = tex.glows[size][shape];
        expect(info.key).toBe(rarityGlowKey(shape, size));
        expect(info.key).toBe(`rarity-glow-${shape}-${size}`);
        expect(tex.info[info.key]).toBe(info);
        expect(bakes.find((b) => b.key === info.key)?.size).toEqual(rarityGlowTextureSize(size));
      }
    }
    for (const slug of TREASURE_ICON_SLUGS) {
      const info = tex.silhouettes[slug];
      expect(info.key).toBe(`treasure-silhouette-${slug}-32`);
      expect(info.key).toBe(treasureSilhouetteKey(slug));
      expect(tex.info[info.key]).toBe(info);
      expect(bakes.find((b) => b.key === info.key)?.size).toEqual(treasureIconTextureSize(TREASURE_SILHOUETTE_SIZE));
    }
    expect(tex.swatchSilhouette.key).toBe(DREAM_SWATCH_SILHOUETTE_KEY);
    expect(bakes.find((b) => b.key === DREAM_SWATCH_SILHOUETTE_KEY)?.size).toEqual(dreamSwatchTextureSize(32));
    expect(new Set(bakes.map((b) => b.key)).size).toBe(bakes.length);
  });
});

describe('Home Tank Decoration glows', () => {
  it('gives every catalogue Decoration a tank slug and a badge matching its catalogue rarity, looked up by id', () => {
    const decorations = ALL_TREASURES.filter(isDecoration);
    expect(decorations.map((d) => d.id)).toEqual([
      'canal/pond-plant',
      'canal/toy-boat',
      'canal/castle-tower',
      'canal/sun-pyramid',
      'pond/lily-pad',
      'pond/cattail-clump',
      'pond/frog-statue',
      'pond/lotus-lantern',
      'pond/reed-bundle',
      'pond/drifting-feather',
      'pond/wooden-duck-decoy',
      'pond/firefly-string-lights',
      'pond/firefly-jar',
      'pond/golden-lotus-throne',
      'chinampa/clay-flowerpot',
      'chinampa/corn-husk-doll',
      'chinampa/scarecrow',
      'chinampa/papel-picado-banner',
      'chinampa/willow-swing',
      'chinampa/golden-corn',
      'chinampa/watering-can',
      'chinampa/floating-gourd',
      'chinampa/pinata',
      'chinampa/talavera-fountain',
      'chinampa/alebrije-statue',
      'spring-cave/pebble-stack',
      'spring-cave/glow-moss-ball',
      'spring-cave/fossil-ammonite',
      'spring-cave/crystal-wind-chime',
      'spring-cave/geode-lamp',
      'spring-cave/crystal-arch',
    ]);
    for (const decoration of decorations) {
      const slug = treasureSlug(decoration.id);
      expect(TANK_DECORATION_SLUGS as readonly string[], decoration.id).toContain(slug);
      expect(TANK_DECORATION_BADGES[slug as TankDecorationSlug], decoration.id).toBe(badgeShape(decoration.rarity));
    }
    expect(TANK_DECORATION_SLUGS.map(String)).toEqual(decorations.map((d) => treasureSlug(d.id)));
  });

  it('bakes a sprite and a glow for every catalogue Decoration', () => {
    bakes.length = 0;
    const tex = bakeTankTextures({} as never, 2, { decorationPx: 80, rand: () => 0.5 });
    for (const decoration of ALL_TREASURES.filter(isDecoration)) {
      const slug = treasureSlug(decoration.id) as TankDecorationSlug;
      expect(tex.decorations[slug].key, decoration.id).toBe(`tank-deco-${slug}-80`);
      expect(tex.decorationGlows[slug].key, decoration.id).toBe(`tank-deco-glow-${slug}-80`);
      expect(bakes.some((b) => b.key === tex.decorations[slug].key), decoration.id).toBe(true);
    }
    expect(new Set(bakes.map((b) => b.key)).size).toBe(bakes.length);
  });

  it('mirrors the catalogue placement kind and width of every Decoration', () => {
    const decorations = ALL_TREASURES.filter(isDecoration);
    expect(Object.keys(TANK_DECORATION_SHAPES)).toEqual(decorations.map((d) => treasureSlug(d.id)));
    for (const decoration of decorations) {
      const slug = treasureSlug(decoration.id) as TankDecorationSlug;
      expect(TANK_DECORATION_SHAPES[slug].placement, decoration.id).toBe(placementKind(decoration));
      expect(TANK_DECORATION_SHAPES[slug].width, decoration.id).toBe(decoration.width);
    }
  });

  it('bakes one glow per Floor and Floating Decoration, 1.2 times its size, anchored at the Decoration base point', () => {
    bakes.length = 0;
    const decorationPx = 80;
    const tex = bakeTankTextures({} as never, 2, { decorationPx, rand: () => 0.5 });
    const glowPx = Math.round(TANK_GLOW_SCALE * decorationPx);
    expect(glowPx).toBe(96);
    const glowFrame = rarityGlowTextureSize(glowPx);
    const iconFrame = treasureIconTextureSize(decorationPx);
    for (const slug of TANK_DECORATION_SLUGS.filter((s) => TANK_DECORATION_SHAPES[s].placement !== 'hanging')) {
      const info = tex.decorationGlows[slug];
      expect(info.key).toBe(tankDecorationGlowKey(slug, decorationPx));
      expect(tex.info[info.key]).toBe(info);
      const baseY = decorationBaseOffset(slug, decorationPx);
      const glowBake = bakes.find((b) => b.key === info.key) as BakeCall;
      expect(glowBake.size).toEqual({ ...glowFrame, originY: glowFrame.originY + baseY });
      const decorationBake = bakes.find((b) => b.key === tex.decorations[slug].key) as BakeCall;
      expect(glowBake.size.originY - glowFrame.originY).toBe(decorationBake.size.originY - iconFrame.originY);

      const rec = record(glowBake.paint);
      expect(rec.calls[0]).toEqual(['translate', [0, -baseY]]);
      expect(rec.gradients).toHaveLength(1);
      expect(rec.gradients[0].args[5]).toBe(glowPx / 2);
      const glowRgb = parseRgba(rec.gradients[0].stops[0][1]).rgb;
      expect(glowRgb).toEqual(channelsOf(BADGE_FILL[TANK_DECORATION_BADGES[slug]]));
      expect(rec.calls.some(([name]) => name === 'scale'), slug).toBe(false);
    }
  });

  it('bakes each Floor and Floating sprite as before: the icon at 80, its anchor moved down to the base point', () => {
    bakes.length = 0;
    const decorationPx = 80;
    bakeTankTextures({} as never, 2, { decorationPx, rand: () => 0.5 });
    const iconFrame = treasureIconTextureSize(decorationPx);
    for (const slug of TANK_DECORATION_SLUGS.filter((s) => TANK_DECORATION_SHAPES[s].placement !== 'hanging')) {
      const baseY = decorationBaseOffset(slug, decorationPx);
      const sprite = bakes.find((b) => b.key === tankDecorationKey(slug, decorationPx)) as BakeCall;
      expect(sprite.size, slug).toEqual({ ...iconFrame, originY: iconFrame.originY + baseY });
      const before = (ctx: CanvasRenderingContext2D): void => {
        ctx.translate(0, -baseY);
        paintTreasureIcon(ctx, slug, decorationPx);
      };
      expect(callLogDigest(sprite.paint), slug).toBe(callLogDigest(before));
    }
  });
});

describe('Home Tank Hanging and wide Decorations', () => {
  const PX = 80;
  const bakeShipped = (): ReturnType<typeof bakeTankTextures> => {
    bakes.length = 0;
    return bakeTankTextures({} as never, 2, { decorationPx: PX, rand: () => 0.5 });
  };
  const bakeOf = (key: string): BakeCall => bakes.find((b) => b.key === key) as BakeCall;
  const HANGING_SLUGS = TANK_DECORATION_SLUGS.filter((slug) => TANK_DECORATION_SHAPES[slug].placement === 'hanging');

  it('has the Firefly string lights and the Papel picado banner, 144 wide, and the Firefly jar, the Willow swing, the Pinata and the Crystal wind chime as its Hanging Decorations', () => {
    expect(HANGING_SLUGS).toEqual([
      'firefly-string-lights',
      'firefly-jar',
      'papel-picado-banner',
      'willow-swing',
      'pinata',
      'crystal-wind-chime',
    ]);
    expect(TANK_DECORATION_SHAPES['firefly-string-lights'].width).toBe(144);
    expect(TANK_DECORATION_SHAPES['papel-picado-banner'].width).toBe(144);
    expect(TANK_DECORATION_SHAPES['firefly-jar'].width).toBeUndefined();
    expect(TANK_DECORATION_SHAPES['willow-swing'].width).toBeUndefined();
  });

  it('anchors the Firefly jar sprite at its hook: the top-centre of the 80 icon box', () => {
    const tex = bakeShipped();
    const iconFrame = treasureIconTextureSize(PX);
    const sprite = bakeOf(tex.decorations['firefly-jar'].key);
    expect(sprite.size).toEqual({ ...iconFrame, originY: iconFrame.originY - PX / 2 });
    const box = frameBox(sprite.size);
    expect(box.minY).toBe(-1);
    expect(box.maxY).toBe(PX + 1);
    expect(box.minX + box.maxX).toBe(0);
    const before = (ctx: CanvasRenderingContext2D): void => {
      ctx.translate(0, PX / 2);
      paintTreasureIcon(ctx, 'firefly-jar', PX);
    };
    expect(callLogDigest(sprite.paint)).toBe(callLogDigest(before));
    // The hook ring's ink touches the hook point, and the jar base reaches the base point one footprint below
    // (inkReach does not follow the context transform, so the icon is measured from its centre).
    const { box: reach } = inkReach((ctx) => paintTreasureIcon(ctx, 'firefly-jar', PX));
    expect(reach.minY + PX / 2).toBeGreaterThanOrEqual(-0.05);
    expect(reach.minY + PX / 2).toBeLessThan(1);
    expect(reach.maxY + PX / 2).toBeCloseTo(PX, 1);
  });

  it('bakes the Firefly string lights on a 144 x 80 box hanging from its top-centre hook', () => {
    const tex = bakeShipped();
    const sprite = bakeOf(tex.decorations['firefly-string-lights'].key);
    expect(sprite.size).toEqual({ w: 146, h: 82, originX: 73, originY: 1 });
    const centred = wideDecorationTextureSize(144, PX);
    expect(sprite.size).toEqual({ ...centred, originY: centred.originY - PX / 2 });
    const before = (ctx: CanvasRenderingContext2D): void => {
      ctx.translate(0, PX / 2);
      paintWideDecoration(ctx, 'firefly-string-lights', 144, PX);
    };
    expect(callLogDigest(sprite.paint)).toBe(callLogDigest(before));
    // Inside the 144 x 80 box below the hook, ink included; the hook rings on the top edge, the middle bulbs
    // on the bottom edge (inkReach does not follow the context transform, so measured from the box centre).
    const { box: reach } = inkReach((ctx) => paintWideDecoration(ctx, 'firefly-string-lights', 144, PX));
    expect(reach.minX).toBeGreaterThanOrEqual(-72);
    expect(reach.maxX).toBeLessThanOrEqual(72);
    expect(reach.minY + PX / 2).toBeCloseTo(0, 6);
    expect(reach.maxY + PX / 2).toBeCloseTo(PX, 6);
    expect(reach.maxX - reach.minX).toBeGreaterThan(130);
  });

  it.each(HANGING_SLUGS.map((slug) => [slug] as const))(
    'centres the %s glow on its box, 1.2 x its width by 96, with the sprite anchor at the hook',
    (slug) => {
      const tex = bakeShipped();
      const widthPx = TANK_DECORATION_SHAPES[slug].width ?? PX;
      const glowW = Math.round(TANK_GLOW_SCALE * widthPx);
      expect(glowW).toBe(TANK_DECORATION_SHAPES[slug].width === 144 ? 173 : 96);
      const glow = bakeOf(tex.decorationGlows[slug].key);
      const across = rarityGlowTextureSize(glowW);
      const tall = rarityGlowTextureSize(96);
      expect(glow.size).toEqual({ w: across.w, originX: across.originX, h: tall.h, originY: tall.originY - PX / 2 });
      const box = frameBox(glow.size);
      expect((box.minX + box.maxX) / 2).toBe(0);
      expect((box.minY + box.maxY) / 2).toBe(PX / 2);

      const rec = record(glow.paint);
      expect(rec.calls[0]).toEqual(['translate', [0, PX / 2]]);
      const scaleCall = rec.calls.find(([name]) => name === 'scale');
      if (glowW === 96) expect(scaleCall).toBeUndefined();
      else expect(scaleCall?.[1]).toEqual([glowW / 96, 1]);
      expect(rec.gradients).toHaveLength(1);
      expect(rec.gradients[0].args[5]).toBe(48);
      expect(parseRgba(rec.gradients[0].stops[0][1]).rgb).toEqual(channelsOf(BADGE_FILL[TANK_DECORATION_BADGES[slug]]));
    },
  );

  it('draws the wide string lights as the icon parts: a wire, three hook rings, six sockets and six round bulbs, one shine', () => {
    const ops = record((ctx) => paintWideDecoration(ctx, 'firefly-string-lights', 144, PX)).ops;
    const fills = (fill: string): Op[] => ops.filter((op) => op.op === 'fill' && op.fillStyle === fill);
    expect(fills(FIREFLY_HOOK)).toHaveLength(3);
    expect(fills(FIREFLY_SOCKET)).toHaveLength(6);
    expect(fills(FIREFLY_BULB)).toHaveLength(6);
    expect(fills('rgba(255,255,255,0.8)')).toHaveLength(1);
    const outer = new Set(
      ops.filter((op) => op.op === 'fill' && typeof op.fillStyle === 'string' && op.fillStyle.startsWith('#')).map((op) => op.fillStyle),
    );
    expect([...outer].sort()).toEqual([FIREFLY_BULB, FIREFLY_HOOK, FIREFLY_SOCKET].sort());
    const ink = ops.filter((op) => op.op === 'stroke');
    for (const op of ink) expect(op.strokeStyle).toBe(INK);
    expect([...new Set(ink.map((op) => op.lineWidth))].sort()).toEqual([1.6, 2.8]);
  });

  it('keeps the string lights ink constant at another size', () => {
    const widthsAt = (px: number): number[] => {
      const ops = record((ctx) => paintWideDecoration(ctx, 'firefly-string-lights', 144, px)).ops;
      return ops.filter((op) => op.op === 'stroke').map((op) => op.lineWidth);
    };
    expect(widthsAt(120)).toEqual(widthsAt(PX));
    expect(record((ctx) => paintWideDecoration(ctx, 'firefly-string-lights', 144, 120)).calls.some(([name]) => name === 'scale')).toBe(false);
    const frame = wideDecorationTextureSize(144, 120);
    expect(frame).toEqual({ w: 218, h: 122, originX: 109, originY: 61 });
  });

  it('throws for a Decoration or width with no wide tank sprite', () => {
    const ctx = recordingContext().ctx;
    expect(() => paintWideDecoration(ctx, 'firefly-string-lights', 160, PX)).toThrow('no 160 wide tank sprite for "firefly-string-lights"');
    expect(() => paintWideDecoration(ctx, 'firefly-jar', 144, PX)).toThrow('no 144 wide tank sprite for "firefly-jar"');
    expect(() => paintWideDecoration(ctx, 'papel-picado-banner', 160, PX)).toThrow('no 160 wide tank sprite for "papel-picado-banner"');
    expect(() => paintWideDecoration(ctx, 'willow-swing', 144, PX)).toThrow('no 144 wide tank sprite for "willow-swing"');
  });
});

// ---------------------------------------------------------------------------
// Painted extents: where every fill and stroke lands, in anchor space
// ---------------------------------------------------------------------------

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** One fill or stroke: its style, its stroke width as it shows on screen, and the box it covers. */
interface Painted {
  readonly op: 'fill' | 'stroke';
  readonly style: unknown;
  /** Stroke width times the transform scale. 0 for a fill. */
  readonly screenWidth: number;
  readonly box: Box;
}

/**
 * Run `paint` against a context that follows save, restore, translate, scale and setTransform, and
 * return the box of every path it fills or strokes, strokes widened by half their on-screen width.
 * Only paths built with Path2D are tracked (the dev painters build every path that way).
 */
function paintedOps(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  const out: Painted[] = [];
  let m = [1, 0, 0, 1, 0, 0];
  const mStack: number[][] = [];
  let style: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1 };
  const styleStack: Record<string, unknown>[] = [];
  const point = (x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const boxOf = (cmds: unknown[][], pad: number): Box => {
    const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const add = (x: number, y: number, extra = 0): void => {
      const [px, py] = point(x, y);
      box.minX = Math.min(box.minX, px - pad - extra);
      box.minY = Math.min(box.minY, py - pad - extra);
      box.maxX = Math.max(box.maxX, px + pad + extra);
      box.maxY = Math.max(box.maxY, py + pad + extra);
    };
    // Curves are sampled, so the box is the curve's, not its control polygon's.
    let cur: [number, number] = [0, 0];
    const sample = (points: readonly [number, number][]): void => {
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const u = 1 - t;
        const [x, y] =
          points.length === 3
            ? [0, 1].map((k) => u * u * points[0][k] + 2 * u * t * points[1][k] + t * t * points[2][k])
            : [0, 1].map(
                (k) => u * u * u * points[0][k] + 3 * u * u * t * points[1][k] + 3 * u * t * t * points[2][k] + t * t * t * points[3][k],
              );
        add(x, y);
      }
      cur = points[points.length - 1];
    };
    for (const [name, ...a] of cmds as [string, ...number[]][]) {
      if (name === 'moveTo' || name === 'lineTo') {
        add(a[0], a[1]);
        cur = [a[0], a[1]];
      } else if (name === 'quadraticCurveTo') {
        sample([cur, [a[0], a[1]], [a[2], a[3]]]);
      } else if (name === 'bezierCurveTo') {
        sample([cur, [a[0], a[1]], [a[2], a[3]], [a[4], a[5]]]);
      } else if (name === 'ellipse') {
        // Unrotated ellipses only: a rotated one is bounded by its larger radius, which is safe.
        const rx = a[4] === 0 ? a[2] : Math.max(a[2], a[3]);
        const ry = a[4] === 0 ? a[3] : Math.max(a[2], a[3]);
        add(a[0] - rx, a[1] - ry);
        add(a[0] + rx, a[1] + ry);
      } else expect(['closePath'], `unhandled path command ${name}`).toContain(name);
    }
    return box;
  };
  const scaleOf = (): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const draw = (op: 'fill' | 'stroke', path: unknown): void => {
    expect(path instanceof LogPath, `${op} of a Path2D`).toBe(true);
    const width = op === 'stroke' ? (style.lineWidth as number) * scaleOf() : 0;
    out.push({
      op,
      style: op === 'fill' ? style.fillStyle : style.strokeStyle,
      screenWidth: width,
      box: boxOf((path as LogPath).cmds as unknown[][], width / 2),
    });
  };
  const methods: Record<string, (...args: number[]) => void> = {
    save: () => {
      mStack.push([...m]);
      styleStack.push({ ...style });
    },
    restore: () => {
      m = mStack.pop() ?? m;
      style = styleStack.pop() ?? style;
    },
    translate: (x, y) => {
      m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    },
    scale: (x, y) => {
      m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]];
    },
    setTransform: (a, b, c, d, e, f) => {
      m = [a, b, c, d, e, f];
    },
  };
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if (name in style) return style[name];
        if (name === 'fill' || name === 'stroke') return (path: unknown) => draw(name, path);
        const method = methods[name];
        if (method) return method;
        expect(['lineJoin', 'lineCap', 'globalAlpha'], `unexpected context call ${name}`).toContain(name);
        return undefined;
      },
      set: (_target, key, value) => {
        style[String(key)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  vi.stubGlobal('Path2D', LogPath);
  try {
    paint(ctx);
  } finally {
    vi.unstubAllGlobals();
  }
  return out;
}

/** Union of the boxes of `ops`. */
function unionBox(ops: readonly Painted[]): Box {
  return ops.reduce<Box>(
    (all, { box }) => ({
      minX: Math.min(all.minX, box.minX),
      minY: Math.min(all.minY, box.minY),
      maxX: Math.max(all.maxX, box.maxX),
      maxY: Math.max(all.maxY, box.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

/** The box of a texture frame in anchor space. */
function frameBox(size: TexSize): Box {
  return { minX: -size.originX, minY: -size.originY, maxX: size.w - size.originX, maxY: size.h - size.originY };
}

/** Distinct on-screen widths of the ink strokes, to 6 places. */
function inkWidths(ops: readonly Painted[]): number[] {
  const widths = ops.filter((o) => o.op === 'stroke' && o.style === INK).map((o) => Math.round(o.screenWidth * 1e6) / 1e6);
  return [...new Set(widths)].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Ink extents: the box every fill and stroke of an icon reaches, in anchor space
// ---------------------------------------------------------------------------

interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** `m` applied after `n`. */
function compose(m: Affine, n: Affine): Affine {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

/**
 * The points a recorded path reaches, through `m`: moves, lines, `arcTo` corners (the rounded corner's
 * vertex, so a safe bound), and sampled curves, arcs and ellipses. Nested `addPath` is followed.
 */
function pathPoints(cmds: readonly unknown[][], m: Affine, out: [number, number][]): void {
  const apply = (x: number, y: number): [number, number] => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  let cur: [number, number] = [0, 0];
  for (const cmd of cmds) {
    const [name, ...rest] = cmd as [string, ...unknown[]];
    const a = rest as number[];
    if (name === 'moveTo' || name === 'lineTo') {
      out.push(apply(a[0], a[1]));
      cur = [a[0], a[1]];
    } else if (name === 'arcTo') {
      // The tangent arc of a rounded corner: from the current point toward (x1, y1), turning to (x2, y2).
      const [x1, y1, x2, y2, r] = a;
      const v1 = [cur[0] - x1, cur[1] - y1];
      const v2 = [x2 - x1, y2 - y1];
      const l1 = Math.hypot(v1[0], v1[1]);
      const l2 = Math.hypot(v2[0], v2[1]);
      if (r === 0 || l1 === 0 || l2 === 0) {
        out.push(apply(x1, y1));
        cur = [x1, y1];
        continue;
      }
      const u1 = [v1[0] / l1, v1[1] / l1];
      const u2 = [v2[0] / l2, v2[1] / l2];
      const theta = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
      const d = r / Math.tan(theta / 2);
      const t1: [number, number] = [x1 + u1[0] * d, y1 + u1[1] * d];
      const t2: [number, number] = [x1 + u2[0] * d, y1 + u2[1] * d];
      const bis = [u1[0] + u2[0], u1[1] + u2[1]];
      const bl = Math.hypot(bis[0], bis[1]);
      const centre = [x1 + (bis[0] / bl) * (r / Math.sin(theta / 2)), y1 + (bis[1] / bl) * (r / Math.sin(theta / 2))];
      const a1 = Math.atan2(t1[1] - centre[1], t1[0] - centre[0]);
      let delta = Math.atan2(t2[1] - centre[1], t2[0] - centre[0]) - a1;
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;
      for (let i = 0; i <= 16; i++) {
        const t = a1 + (delta * i) / 16;
        out.push(apply(centre[0] + r * Math.cos(t), centre[1] + r * Math.sin(t)));
      }
      cur = t2;
    } else if (name === 'quadraticCurveTo' || name === 'bezierCurveTo') {
      const ctrl: [number, number][] = [cur];
      for (let i = 0; i < a.length; i += 2) ctrl.push([a[i], a[i + 1]]);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const u = 1 - t;
        const [x, y] =
          ctrl.length === 3
            ? [0, 1].map((k) => u * u * ctrl[0][k] + 2 * u * t * ctrl[1][k] + t * t * ctrl[2][k])
            : [0, 1].map(
                (k) => u * u * u * ctrl[0][k] + 3 * u * u * t * ctrl[1][k] + 3 * u * t * t * ctrl[2][k] + t * t * t * ctrl[3][k],
              );
        out.push(apply(x, y));
      }
      cur = ctrl[ctrl.length - 1];
    } else if (name === 'ellipse' || name === 'arc') {
      const [cx, cy, rx, ry, rot, a0, a1] = name === 'arc' ? [a[0], a[1], a[2], a[2], 0, a[3], a[4]] : a;
      for (let i = 0; i <= 64; i++) {
        const t = a0 + ((a1 - a0) * i) / 64;
        const x = rx * Math.cos(t);
        const y = ry * Math.sin(t);
        out.push(apply(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)));
      }
    } else if (name === 'addPath') {
      const nested = (rest[1] ?? IDENTITY) as Affine;
      pathPoints(rest[0] as unknown[][], compose(m, nested), out);
    } else expect(['closePath'], `unhandled path command ${name}`).toContain(name);
  }
}

interface InkReach {
  /** The box of every fill and stroke, strokes widened by half their width. */
  readonly box: Box;
  /** Each fill or stroke: the first point of its path (the base of a petal, the centre of a pad). */
  readonly starts: readonly (readonly [number, number])[];
}

/**
 * Run `paint` and return the box its fills and strokes reach, in anchor space. Everything painted
 * under a `clip` stays inside the silhouette that clipped it, so it is skipped. Only Path2D draws count.
 */
function inkReach(paint: (ctx: CanvasRenderingContext2D) => void): InkReach {
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const starts: [number, number][] = [];
  let lineWidth = 1;
  let clipped = false;
  const stack: { lineWidth: number; clipped: boolean }[] = [];
  const add = (path: unknown, pad: number): void => {
    if (clipped || !(path instanceof LogPath)) return;
    const points: [number, number][] = [];
    pathPoints(path.cmds as unknown[][], IDENTITY, points);
    starts.push(points[0]);
    for (const [x, y] of points) {
      box.minX = Math.min(box.minX, x - pad);
      box.minY = Math.min(box.minY, y - pad);
      box.maxX = Math.max(box.maxX, x + pad);
      box.maxY = Math.max(box.maxY, y + pad);
    }
  };
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if (name === 'lineWidth') return lineWidth;
        return (...args: unknown[]) => {
          if (name === 'save') stack.push({ lineWidth, clipped });
          else if (name === 'restore') ({ lineWidth, clipped } = stack.pop() ?? { lineWidth, clipped });
          else if (name === 'clip') clipped = true;
          else if (name === 'fill') add(args[0], 0);
          else if (name === 'stroke') add(args[0], lineWidth / 2);
        };
      },
      set: (_target, key, value) => {
        if (key === 'lineWidth') lineWidth = value as number;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  vi.stubGlobal('Path2D', LogPath);
  try {
    paint(ctx);
  } finally {
    vi.unstubAllGlobals();
  }
  return { box, starts };
}

/** Every hex colour an icon paints with, fills and strokes. */
function hexStyles(paint: (ctx: CanvasRenderingContext2D) => void): Set<string> {
  const styles = new Set<string>();
  for (const op of record(paint).ops) {
    const style = op.op === 'fill' || op.op === 'fillRect' ? op.fillStyle : op.strokeStyle;
    if (typeof style === 'string' && /^#[0-9a-f]{6}$/i.test(style)) styles.add(style.toLowerCase());
  }
  return styles;
}

const DEV_PX = 80;
const devDecoration = (id: string): Decoration => DEV_DECORATIONS.find((d) => d.id === id) as Decoration;
const FLOATING = DEV_DECORATIONS.filter((d) => d.placement === 'floating');
const HANGING = DEV_DECORATIONS.filter((d) => d.placement === 'hanging');
/** Ink may reach this far past the 80-high footprint box at the anchor edge. */
const BOX_SLACK = 1;

describe('Dev Decoration art', () => {
  const bakeDev = (): ReturnType<typeof bakeDevDecorations> => {
    bakes.length = 0;
    return bakeDevDecorations({} as never, 2, DEV_PX);
  };

  it('covers a floating and two hanging dev Decorations, one of them 144 wide', () => {
    expect(FLOATING.map((d) => d.id)).toEqual(['dev/test-lily-pad']);
    expect(HANGING.map((d) => d.id)).toEqual(['dev/test-firefly-jar', 'dev/test-string-lights']);
    expect(devDecoration('dev/test-string-lights').width).toBe(144);
  });

  it('bakes a sprite, a glow and both tray icons for every dev Decoration, with dev keys', () => {
    const tex = bakeDev();
    expect(EXTRA_DECORATION_ICON_SIZES).toEqual([48, 32]);
    for (const d of DEV_DECORATIONS) {
      expect(tex.decorations[d.id].key).toBe(devDecorationKey(d.id, DEV_PX));
      expect(tex.decorationGlows[d.id].key).toBe(devDecorationGlowKey(d.id, DEV_PX));
      for (const size of EXTRA_DECORATION_ICON_SIZES) {
        expect(tex.icons[size][d.id].key).toBe(devDecorationIconKey(d.id, size));
        expect(tex.icons[size][d.id].key).toBe(`treasure-dev-${d.id.slice(4)}-${size}`);
      }
      for (const info of [tex.decorations[d.id], tex.decorationGlows[d.id], tex.icons[48][d.id], tex.icons[32][d.id]]) {
        expect(info.key, d.id).toContain('dev');
        expect(tex.info[info.key]).toBe(info);
        expect(info.scale).toBe(2);
      }
    }
    expect(Object.keys(tex.info)).toHaveLength(DEV_DECORATIONS.length * 4);
    expect(new Set(bakes.map((b) => b.key)).size).toBe(bakes.length);
  });

  it('never reuses a shipped texture key', () => {
    bakes.length = 0;
    bakeTankTextures({} as never, 2, { decorationPx: DEV_PX, rand: () => 0.5 });
    bakeTreasureTextures({} as never, 2);
    const shipped = new Set(bakes.map((b) => b.key));
    expect(shipped.size).toBeGreaterThan(0);
    const tex = bakeDev();
    for (const key of Object.keys(tex.info)) expect(shipped.has(key), key).toBe(false);
  });

  it('keeps the shipped tank bake free of any dev module', () => {
    expect(tankTexturesSource).not.toMatch(/devDecoration/i);
    expect(tankTexturesSource).not.toMatch(/from '\.\.\/logic\/dev/);
  });

  it('sizes each sprite frame from the item width and anchors by kind', () => {
    bakeDev();
    for (const d of DEV_DECORATIONS) {
      const size = bakes.find((b) => b.key === devDecorationKey(d.id, DEV_PX))!.size;
      expect(size).toEqual(devDecorationTextureSize(d, DEV_PX));
      const width = d.width as number;
      expect(size.w).toBeGreaterThanOrEqual(width);
      expect(size.w).toBeLessThanOrEqual(width + 10);
      expect(size.originX * 2, `${d.id} centred across`).toBe(size.w);
      expect(size.h).toBeGreaterThanOrEqual(DEV_PX);
      expect(size.h).toBeLessThanOrEqual(DEV_PX + 10);
      const box = frameBox(size);
      if (d.placement === 'hanging') {
        // The anchor is the top-centre hook: the 80 high box hangs below it.
        expect(box.minY, d.id).toBeLessThanOrEqual(0);
        expect(box.minY, d.id).toBeGreaterThanOrEqual(-5);
        expect(box.maxY, d.id).toBeGreaterThanOrEqual(DEV_PX);
      } else {
        // The anchor is the bottom-centre: the 80 high box stands on it.
        expect(box.maxY, d.id).toBeGreaterThanOrEqual(0);
        expect(box.maxY, d.id).toBeLessThanOrEqual(5);
        expect(box.minY, d.id).toBeLessThanOrEqual(-DEV_PX);
      }
    }
  });

  it('sizes each glow 1.2 x the width by 96, centred on the box with the sprite anchor', () => {
    bakeDev();
    for (const d of DEV_DECORATIONS) {
      const glow = devDecorationGlowSize(d, DEV_PX);
      expect(glow.w).toBe(Math.round(TANK_GLOW_SCALE * (d.width as number)));
      expect(glow.h).toBe(96);
      const size = bakes.find((b) => b.key === devDecorationGlowKey(d.id, DEV_PX))!.size;
      expect(size).toEqual(devDecorationGlowTextureSize(d, DEV_PX));
      expect(size.w).toBeGreaterThanOrEqual(glow.w);
      expect(size.w).toBeLessThanOrEqual(glow.w + 4);
      expect(size.h).toBeGreaterThanOrEqual(96);
      expect(size.h).toBeLessThanOrEqual(100);
      const box = frameBox(size);
      expect((box.minX + box.maxX) / 2, `${d.id} centred across`).toBe(0);
      expect((box.minY + box.maxY) / 2, `${d.id} centred on the box`).toBe(d.placement === 'hanging' ? DEV_PX / 2 : -DEV_PX / 2);

      const rec = record(bakes.find((b) => b.key === devDecorationGlowKey(d.id, DEV_PX))!.paint);
      expect(rec.gradients).toHaveLength(1);
      expect(rec.gradients[0].args[5]).toBe(glow.h / 2);
      expect(parseRgba(rec.gradients[0].stops[0][1]).rgb).toEqual(channelsOf(BADGE_FILL[badgeShape(d.rarity)]));
      const scaleCall = rec.calls.find(([name]) => name === 'scale');
      expect(scaleCall?.[1]).toEqual([glow.w / glow.h, 1]);
      // The stretched disc reaches half the glow width and half its height, inside the frame.
      expect(glow.w / 2).toBeLessThanOrEqual(box.maxX);
      expect(Math.abs((box.minY + box.maxY) / 2) + glow.h / 2).toBeLessThanOrEqual(Math.max(Math.abs(box.minY), Math.abs(box.maxY)));
    }
  });

  it('makes the 80-wide glow the same size as the shipped Decoration glow', () => {
    const lily = devDecorationGlowSize(devDecoration('dev/test-lily-pad'), DEV_PX);
    expect(lily).toEqual({ w: 96, h: 96 });
  });

  it('bakes tray icons centre-anchored at 48 and 32 in the shipped icon frame', () => {
    bakeDev();
    for (const d of DEV_DECORATIONS) {
      for (const size of EXTRA_DECORATION_ICON_SIZES) {
        const frame = bakes.find((b) => b.key === devDecorationIconKey(d.id, size))!.size;
        expect(frame).toEqual(treasureIconTextureSize(size));
        expect(frame).toEqual(devDecorationIconTextureSize(size));
        expect(frame.originX * 2).toBe(frame.w);
        expect(frame.originY * 2).toBe(frame.h);
      }
    }
  });

  it.each(DEV_DECORATIONS.map((d) => [d.id, d] as const))('%s paints inside its sprite frame and its footprint box', (_id, d) => {
    const ops = paintedOps((ctx) => paintDevDecoration(ctx, d, DEV_PX));
    expect(ops.length).toBeGreaterThan(5);
    const painted = unionBox(ops);
    const frame = frameBox(devDecorationTextureSize(d, DEV_PX));
    expect(painted.minX).toBeGreaterThanOrEqual(frame.minX);
    expect(painted.maxX).toBeLessThanOrEqual(frame.maxX);
    expect(painted.minY).toBeGreaterThanOrEqual(frame.minY);
    expect(painted.maxY).toBeLessThanOrEqual(frame.maxY);
    // Inside the footprint box too, with a pixel for ink.
    const half = (d.width as number) / 2;
    expect(painted.minX).toBeGreaterThanOrEqual(-half - BOX_SLACK);
    expect(painted.maxX).toBeLessThanOrEqual(half + BOX_SLACK);
    if (d.placement === 'hanging') {
      expect(painted.minY).toBeGreaterThanOrEqual(-BOX_SLACK);
      expect(painted.maxY).toBeLessThanOrEqual(DEV_PX + BOX_SLACK);
      // The item hangs from the hook at the top-centre: ink touches the top edge near the middle.
      expect(painted.minY).toBeLessThanOrEqual(1);
    } else {
      expect(painted.minY).toBeGreaterThanOrEqual(-DEV_PX - BOX_SLACK);
      expect(painted.maxY).toBeLessThanOrEqual(BOX_SLACK);
      // Standing on the base point at the bottom-centre: the lowest ink edge sits on it.
      expect(painted.maxY).toBeGreaterThanOrEqual(-2);
    }
  });

  it.each(DEV_DECORATIONS.flatMap((d) => EXTRA_DECORATION_ICON_SIZES.map((size) => [d.id, d, size] as const)))(
    '%s icon at %i paints inside its frame with the sprite ink widths',
    (_id, d, size) => {
      const icon = paintedOps((ctx) => paintDevDecorationIcon(ctx, d, size));
      const painted = unionBox(icon);
      const frame = frameBox(devDecorationIconTextureSize(size));
      expect(painted.minX).toBeGreaterThanOrEqual(frame.minX);
      expect(painted.maxX).toBeLessThanOrEqual(frame.maxX);
      expect(painted.minY).toBeGreaterThanOrEqual(frame.minY);
      expect(painted.maxY).toBeLessThanOrEqual(frame.maxY);
      // The whole item fits the icon box, ink included.
      expect(Math.max(painted.maxX - painted.minX, painted.maxY - painted.minY)).toBeLessThanOrEqual(size);
      // Ink never scales: the icon draws the same ink widths on screen as the tank sprite.
      const sprite = paintedOps((ctx) => paintDevDecoration(ctx, d, DEV_PX));
      expect(inkWidths(icon)).toEqual(inkWidths(sprite));
      expect(inkWidths(icon).length).toBeGreaterThan(0);
    },
  );

  it('keeps every shape outline ink, the main outline widths at 3.15 or less', () => {
    for (const d of DEV_DECORATIONS) {
      const widths = inkWidths(paintedOps((ctx) => paintDevDecoration(ctx, d, DEV_PX)));
      expect(Math.max(...widths), d.id).toBeLessThanOrEqual(2 * 3.5);
      expect(Math.min(...widths), d.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('puts the lily pad waterline 20 units below its footprint top, at the water surface', () => {
    const d = devDecoration('dev/test-lily-pad');
    const ops = paintedOps((ctx) => paintDevDecoration(ctx, d, DEV_PX));
    const pad = ops.find((o) => o.op === 'fill' && o.style === LILY_PAD);
    expect(pad).toBeDefined();
    const centreY = ((pad as Painted).box.minY + (pad as Painted).box.maxY) / 2;
    // Floating anchor is the box bottom, so the box top is 80 above it.
    expect(centreY - -DEV_PX).toBeCloseTo(20, 9);
    // With the base point at TOP_BASE_Y the pad sits on the water surface line.
    expect(TOP_BASE_Y + centreY).toBe(TANK.waterTop);
    // Flower above the water, roots and tuber below it, down to the base point.
    const painted = unionBox(ops);
    expect(painted.minY).toBeLessThan(centreY - 10);
    expect(painted.maxY).toBeGreaterThan(centreY + 40);
  });

  it('draws the string lights as a wire with six bulbs of three shapes', () => {
    const d = devDecoration('dev/test-string-lights');
    const ops = paintedOps((ctx) => paintDevDecoration(ctx, d, DEV_PX));
    // Bulbs are the ink shapes of ink width 2.4 whose fill is not a ring/socket colour.
    const bulbOutlines = ops.filter((o) => o.op === 'stroke' && o.style === INK && Math.abs(o.screenWidth - 2.4) < 1e-9);
    expect(bulbOutlines).toHaveLength(6);
    const sizes = new Set(bulbOutlines.map((o) => `${(o.box.maxX - o.box.minX).toFixed(1)}x${(o.box.maxY - o.box.minY).toFixed(1)}`));
    expect(sizes.size).toBeGreaterThanOrEqual(3);
    // The wire spans most of the 144 width.
    const painted = unionBox(ops);
    expect(painted.maxX - painted.minX).toBeGreaterThan(130);
  });

  it('paints the glow through the shipped rarity glow stretched across the box', () => {
    const d = devDecoration('dev/test-string-lights');
    const rec = record((ctx) => paintDevDecorationGlow(ctx, d, DEV_PX));
    expect(rec.calls[0]).toEqual(['translate', [0, DEV_PX / 2]]);
    expect(rec.calls[1]).toEqual(['scale', [devDecorationGlowSize(d, DEV_PX).w / 96, 1]]);
    expect(rec.ops).toHaveLength(1);
  });
});

describe('Pond treasure art (issue #75)', () => {
  /** The pond fills of the outer silhouettes (treasurePalette.ts), by item. */
  const OUTER_FILLS: Readonly<Record<string, readonly string[]>> = {
    'lily-pad': [LILY_PAD_FILL],
    'cattail-clump': [CATTAIL_STEM, CATTAIL_HEAD],
    'frog-statue': [FROG_STATUE_STONE],
    'lotus-lantern': [LOTUS_PETAL, LOTUS_LANTERN_BODY],
    'lily-flower-crown': [LILY_CROWN_LEAF, LILY_CROWN_FLOWER],
    'pond-weed-scarf': [POND_WEED_SCARF],
    'dragonfly-glasses': [DRAGONFLY_FRAME],
    raincoat: [RAINCOAT_FILL],
    'ladybug-backpack': [LADYBUG_SHELL],
    'rainbow-dragonfly-wings': [DRAGONFLY_WING],
    'froggy-boots': [FROGGY_BOOT],
  };
  /** Trims, gems, stars, pattern marks and ink: inside the silhouette, or already shipped, so free. */
  const FREE_STYLES = new Set(
    [GOLD_TRIM, CASTLE_TRIM, CASTLE_GEM, PYRAMID_GEM, BOW_GEM, GEM_GLINT, TREASURE_STAR, INK, ...DREAM_SWATCH.rainbow.marks].map((c) =>
      c.toLowerCase(),
    ),
  );
  const POND_ITEM_SLUGS = POND_ICON_SLUGS.filter((slug) => !slug.startsWith('paint-shell-'));
  const HALF = (size: number): number => size / 2;
  const REACH_TOLERANCE = 0.05;

  it('has an icon and a silhouette for every catalogue treasure, and no other', () => {
    expect(new Set(ALL_TREASURES.map((treasure) => treasureSlug(treasure.id)))).toEqual(new Set(TREASURE_ICON_SLUGS));
    expect(TREASURE_ICON_SLUGS).toHaveLength(ALL_TREASURES.length);
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    for (const treasure of ALL_TREASURES) {
      const slug = treasureSlug(treasure.id) as TreasureIconSlug;
      expect(tex.icons[32][slug].key, treasure.id).toBe(`treasure-${slug}-32`);
      expect(tex.silhouettes[slug].key, treasure.id).toBe(treasureSilhouetteKey(slug));
      expect(bakes.some((b) => b.key === tex.silhouettes[slug].key), treasure.id).toBe(true);
    }
  });

  it('adds the eleven pond items after the canal twelve, in catalogue order, with the Lily green shell among the Paint shells', () => {
    expect(POND_ITEM_SLUGS).toEqual(
      addedBy(POND_TREASURES, 'pond').filter((treasure) => treasure.category !== 'paintShell').map((treasure) => treasureSlug(treasure.id)),
    );
    expect(POND_ITEM_SLUGS).toHaveLength(11);
    expect(TREASURE_ICON_SLUGS.slice(12, 23)).toEqual(POND_ITEM_SLUGS);
    expect(TREASURE_ICON_SLUGS).toContain('paint-shell-lily-green');
    expect(POND_ICON_SLUGS).toEqual([...POND_ITEM_SLUGS, 'paint-shell-lily-green']);
  });

  it('keeps every pond outer fill at 9:1 or more with ink, and none a rarity badge fill', () => {
    const fills = Object.values(OUTER_FILLS).flat();
    expect(fills).toHaveLength(14);
    for (const fill of fills) {
      expect(contrastRatio(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
  });

  it.each(POND_ITEM_SLUGS.map((slug) => [slug] as const))(
    '%s paints its pond fills and no other outer colour, every colour 9:1 or free',
    (slug) => {
      const styles = hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48));
      for (const fill of OUTER_FILLS[slug]) expect(styles, `${slug} uses ${fill}`).toContain(fill.toLowerCase());
      for (const style of styles) {
        if (FREE_STYLES.has(style)) continue;
        expect(contrastRatio(style, INK), `${slug} ${style}`).toBeGreaterThanOrEqual(9);
        expect(
          Object.values(OUTER_FILLS[slug]).map((c) => c.toLowerCase()).concat(TREASURE_SILHOUETTE_FILL.toLowerCase()),
          `${slug} paints only its own fills, ${style} is not one`,
        ).toContain(style);
      }
    },
  );

  it.each(POND_ITEM_SLUGS.flatMap((slug) => [28, 32, 48, 80].map((size) => [slug, size] as const)))(
    '%s at %i keeps its ink inside the icon box, reaching nearly the whole of the longest side',
    (slug, size) => {
      const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
      const half = HALF(size);
      expect(box.minX, `${slug} left`).toBeGreaterThanOrEqual(-half - REACH_TOLERANCE);
      expect(box.maxX, `${slug} right`).toBeLessThanOrEqual(half + REACH_TOLERANCE);
      expect(box.minY, `${slug} top`).toBeGreaterThanOrEqual(-half - REACH_TOLERANCE);
      expect(box.maxY, `${slug} bottom`).toBeLessThanOrEqual(half + REACH_TOLERANCE);
      expect(Math.max(box.maxX - box.minX, box.maxY - box.minY), `${slug} longest side`).toBeGreaterThanOrEqual(size - 2);
    },
  );

  it.each(POND_ICON_SLUGS.map((slug) => [slug] as const))('%s has a frame that holds its icon and silhouette', (slug) => {
    const frame = frameBox(treasureIconTextureSize(48));
    for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
      const { box } = inkReach((ctx) => paint(ctx, slug, 48));
      expect(box.minX).toBeGreaterThanOrEqual(frame.minX);
      expect(box.maxX).toBeLessThanOrEqual(frame.maxX);
      expect(box.minY).toBeGreaterThanOrEqual(frame.minY);
      expect(box.maxY).toBeLessThanOrEqual(frame.maxY);
    }
  });

  it('draws ink at the shipped widths only: item 2.8, blob 5.6, tubes 8.0, glasses 3.5 (bridge 4.6), details 1.6, bands 1.2', () => {
    const ALLOWED = new Set([2.8, 5.6, 8, 3.5, 4.6, 1.6, 1.2]);
    for (const slug of POND_ITEM_SLUGS) {
      const ink = record((ctx) => paintTreasureIcon(ctx, slug, 48)).ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK);
      const widths = new Set(ink.map((op) => op.lineWidth));
      for (const width of widths) expect(ALLOWED, `${slug} ink ${width}`).toContain(width);
    }
  });

  describe('Decorations in the Home Tank', () => {
    const FLOORS = ['cattail-clump', 'frog-statue'] as const;
    const FLOATS = ['lily-pad', 'lotus-lantern'] as const;

    it('matches the catalogue placement kinds', () => {
      const kinds = new Map(ALL_TREASURES.filter(isDecoration).map((d) => [treasureSlug(d.id), placementKind(d)]));
      for (const slug of FLOORS) expect(kinds.get(slug), slug).toBe('floor');
      for (const slug of FLOATS) expect(kinds.get(slug), slug).toBe('floating');
    });

    it.each(FLOORS.map((slug) => [slug] as const))('%s is anchored at its lowest ink edge', (slug) => {
      for (const size of [48, 80]) {
        const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(box.maxY, 1);
        expect(box.maxY).toBeLessThanOrEqual(size / 2 + REACH_TOLERANCE);
      }
    });

    it.each(FLOATS.map((slug) => [slug] as const))('%s is anchored at the bottom centre of its 80 box', (slug) => {
      const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, 80));
      expect(decorationBaseOffset(slug, 80)).toBeCloseTo(40, 9);
      expect(box.maxY).toBeCloseTo(40, 1);
      const frame = frameBox({ ...treasureIconTextureSize(80), originY: treasureIconTextureSize(80).originY + 40 });
      expect(frame.maxY).toBeGreaterThanOrEqual(1);
      expect(frame.maxY).toBeLessThanOrEqual(2);
    });

    it('puts the Lily pad centre on the waterline, 20 below the top of the 80 box, at the water surface', () => {
      const { starts } = inkReach((ctx) => paintTreasureIcon(ctx, 'lily-pad', 80));
      // The pad path starts at its centre (0, waterline); the box top is 40 above the icon centre.
      expect(starts.some(([x, y]) => Math.abs(x) < 1e-6 && Math.abs(y - (-40 + 20)) < 1e-6)).toBe(true);
    });

    it('puts the Lotus lantern belt on the waterline, 20 below the top of the 80 box, at the water surface', () => {
      const bands = record((ctx) => paintTreasureIcon(ctx, 'lotus-lantern', 80)).ops.filter(
        (op) => op.op === 'fillRect' && op.fillStyle === CASTLE_TRIM,
      );
      expect(bands).toHaveLength(1);
      const [, y, , height] = bands[0].args as number[];
      expect(y + height / 2).toBeCloseTo(-40 + 20, 9);
    });

    it('lands both waterlines on the water surface when the base point is TOP_BASE_Y', () => {
      // The box bottom is the base point, so the waterline is 60 above it.
      expect(TOP_BASE_Y - (80 - 20)).toBe(TANK.waterTop);
    });

    it('stays on the shipped floating convention of the dev Test lily pad', () => {
      const dev = paintedOps((ctx) => paintDevDecoration(ctx, devDecoration('dev/test-lily-pad'), DEV_PX));
      const pad = dev.find((o) => o.op === 'fill' && o.style === LILY_PAD) as Painted;
      const centreY = (pad.box.minY + pad.box.maxY) / 2;
      const { starts } = inkReach((ctx) => paintTreasureIcon(ctx, 'lily-pad', 80));
      expect(starts.some(([, y]) => Math.abs(y - (centreY + 40)) < 1e-6)).toBe(true);
    });
  });

  describe('rarity ladder (guide 6i)', () => {
    /** The count of shines, gold trims, gem glints and stars in an icon, by their paint. */
    const count = (slug: TreasureIconSlug): { shine: number; gold: number; glint: number; star: number } => {
      const ops = record((ctx) => paintTreasureIcon(ctx, slug, 80)).ops;
      // The gem glint and the star are both white: a glint is an ellipse, a star is a rounded polygon.
      const whites = ops.filter((op) => op.op === 'fill' && op.fillStyle === GEM_GLINT && op.fillStyle === TREASURE_STAR);
      const uses = (op: Op, command: string): boolean => JSON.stringify(op.args[0]).includes(`"${command}"`);
      return {
        shine: ops.filter((op) => op.op === 'fill' && op.fillStyle === 'rgba(255,255,255,0.8)').length,
        gold: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === GOLD_TRIM).length,
        glint: whites.filter((op) => uses(op, 'ellipse')).length,
        star: whites.filter((op) => uses(op, 'arcTo')).length,
      };
    };

    it.each(POND_ITEM_SLUGS.map((slug) => [slug] as const))('%s has its one shine', (slug) => {
      expect(count(slug).shine, slug).toBe(1);
    });

    it('gives Legendary the gold trim, one gem and one star, and the others none of the three', () => {
      for (const slug of ['rainbow-dragonfly-wings', 'froggy-boots'] as const) {
        const found = count(slug);
        expect(found.gold, slug).toBe(1);
        expect(found.glint, slug).toBe(1);
        expect(found.star, slug).toBe(1);
      }
      for (const slug of POND_ITEM_SLUGS.filter((s) => s !== 'rainbow-dragonfly-wings' && s !== 'froggy-boots')) {
        const found = count(slug);
        expect(found.gold, slug).toBe(0);
        expect(found.star, slug).toBe(0);
      }
    });

    it('gives Epic one gem and Common and Rare none', () => {
      for (const slug of ['lotus-lantern', 'ladybug-backpack'] as const) expect(count(slug).glint, slug).toBe(1);
      for (const slug of ['lily-pad', 'cattail-clump', 'frog-statue', 'lily-flower-crown', 'pond-weed-scarf', 'dragonfly-glasses', 'raincoat'] as const) {
        expect(count(slug).glint, slug).toBe(0);
      }
    });
  });
});

describe('Pond Area 3 treasure art (issue #98)', () => {
  /**
   * The outer fills each icon may paint (treasurePalette.ts), by item: its silhouette fills plus the trim
   * colours it paints on the outer silhouette. Gems, gold trim, stars, ink and glows are free.
   */
  const OUTER_FILLS: Readonly<Record<string, readonly string[]>> = {
    'reed-bundle': [REED_BUNDLE_STALK],
    'drifting-feather': [FEATHER_FILL],
    'wooden-duck-decoy': [DECOY_BODY, DECOY_BEAK, BOAT_TRIM],
    'firefly-string-lights': [FIREFLY_BULB, FIREFLY_HOOK, FIREFLY_SOCKET],
    'firefly-jar': [FIREFLY_JAR_GLASS, FIREFLY_JAR_LID, FIREFLY_HOOK],
    'golden-lotus-throne': [GOLDEN_LOTUS_PETAL, GOLDEN_LOTUS_SEAT, GOLDEN_LOTUS_BASE],
    'feather-cap': [FEATHER_CAP_FILL, FEATHER_FILL],
    'lily-pad-socks': [LILY_PAD_SOCK_FILL],
    'water-lily-shirt': [WATER_LILY_SHIRT_FILL, WATER_LILY_BLOSSOM, BOAT_TRIM],
    'pearl-tail-charm': [PEARL_FILL, PEARL_CHARM_CORD],
    'firefly-cape': [FIREFLY_CAPE_FILL],
  };
  const FREE_STYLES = new Set(
    [GOLD_TRIM, CASTLE_GEM, PYRAMID_GEM, BOW_GEM, GEM_GLINT, TREASURE_STAR, INK].map((c) => c.toLowerCase()),
  );
  const AREA3_ITEM_SLUGS = AREA3_ICON_SLUGS.filter((slug) => !slug.startsWith('paint-shell-'));
  const SIZES = [28, 32, 48, 80] as const;
  const REACH_TOLERANCE = 0.05;
  /** The ink widths of the shipped icons that an Area 3 painter may use: item 2.8, details 1.6, trim lines 1.2. */
  const ALLOWED_INK = new Set([2.8, 1.6, 1.2]);
  const SHINE = 'rgba(255,255,255,0.8)';
  /** Counts of shines, gold trim bands, gem glints and stars painted by an icon. */
  const count = (slug: TreasureIconSlug): { shine: number; gold: number; glint: number; star: number } => {
    const ops = record((ctx) => paintTreasureIcon(ctx, slug, 80)).ops;
    const whites = ops.filter((op) => op.op === 'fill' && op.fillStyle === GEM_GLINT);
    const uses = (op: Op, command: string): boolean => JSON.stringify(op.args[0]).includes(`"${command}"`);
    return {
      shine: ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length,
      gold: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === GOLD_TRIM).length,
      glint: whites.filter((op) => uses(op, 'ellipse')).length,
      star: whites.filter((op) => uses(op, 'arcTo')).length,
    };
  };

  it('lists the eleven Area 3 items after the pond ones, in catalogue order, with the Paint shells last', () => {
    expect(AREA3_ITEM_SLUGS).toHaveLength(11);
    expect(AREA3_ITEM_SLUGS).toEqual(
      addedBy(POND_2_TREASURES, 'pond').filter((treasure) => treasure.category !== 'paintShell').map((treasure) => treasureSlug(treasure.id)),
    );
    expect(AREA3_ITEM_SLUGS).toEqual([
      'reed-bundle',
      'drifting-feather',
      'wooden-duck-decoy',
      'firefly-string-lights',
      'firefly-jar',
      'golden-lotus-throne',
      'feather-cap',
      'lily-pad-socks',
      'water-lily-shirt',
      'pearl-tail-charm',
      'firefly-cape',
    ]);
    expect(TREASURE_ICON_SLUGS).toHaveLength(84);
    expect(TREASURE_ICON_SLUGS.slice(23, 34)).toEqual(AREA3_ITEM_SLUGS);
    expect(TREASURE_ICON_SLUGS.slice(67)).toEqual(DREAM_SWATCH_IDS.map((id) => `paint-shell-${id}`));
    expect(DREAM_SWATCH_IDS).toHaveLength(17);
    expect(AREA3_ICON_SLUGS).toEqual([...AREA3_ITEM_SLUGS, 'paint-shell-firefly-gold']);
    expect(new Set(TREASURE_ICON_SLUGS).size).toBe(TREASURE_ICON_SLUGS.length);
  });

  it('draws the Firefly gold Paint shell icon and its swatch in the Firefly gold body colour', () => {
    const last = addedBy(POND_2_TREASURES, 'pond').at(-1);
    expect(last?.category).toBe('paintShell');
    expect(last?.category === 'paintShell' ? last.dreamColour : undefined).toBe('firefly-gold');
    expect(last && treasureSlug(last.id)).toBe('paint-shell-firefly-gold');
    expect(DREAM_SWATCH['firefly-gold'].body).toBe('#ffd52a');
    expect(hexStyles((ctx) => paintTreasureIcon(ctx, 'paint-shell-firefly-gold', 48))).toContain('#ffd52a');
    expect(hexStyles((ctx) => paintDreamSwatch(ctx, 'firefly-gold', 32))).toContain('#ffd52a');
  });

  it('keeps every Area 3 outer fill at 9:1 or more with ink, and none a rarity badge fill', () => {
    const fills = [...new Set(Object.values(OUTER_FILLS).flat())];
    expect(fills).toHaveLength(17);
    for (const fill of fills) {
      expect(contrastRatio(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
  });

  it.each(AREA3_ITEM_SLUGS.map((slug) => [slug] as const))(
    '%s paints its own Area 3 fills and no other outer colour',
    (slug) => {
      const styles = hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48));
      const own = OUTER_FILLS[slug].map((c) => c.toLowerCase());
      for (const fill of OUTER_FILLS[slug].filter((c) => c !== BOAT_TRIM)) expect(styles, `${slug} uses ${fill}`).toContain(fill.toLowerCase());
      for (const style of styles) {
        if (FREE_STYLES.has(style)) continue;
        expect(own, `${slug} paints only its own fills, ${style} is not one`).toContain(style);
      }
    },
  );

  it.each(AREA3_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i keeps its frame: the ink inside the icon box and the texture frame, reaching nearly the whole longest side',
    (slug, size) => {
      const half = size / 2;
      const frame = frameBox(treasureIconTextureSize(size));
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const { box } = inkReach((ctx) => paint(ctx, slug, size));
        expect(box.minX, `${slug} left`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minX));
        expect(box.maxX, `${slug} right`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxX));
        expect(box.minY, `${slug} top`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minY));
        expect(box.maxY, `${slug} bottom`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxY));
      }
      const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
      expect(Math.max(box.maxX - box.minX, box.maxY - box.minY), `${slug} longest side`).toBeGreaterThanOrEqual(size - 2);
    },
  );

  it.each(AREA3_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its ink outline at the shipped widths, the item outline 2.8 among them',
    (slug, size) => {
      const ink = record((ctx) => paintTreasureIcon(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK,
      );
      const widths = new Set(ink.map((op) => op.lineWidth));
      expect(widths.has(2.8), `${slug} has the 2.8 item outline`).toBe(true);
      for (const width of widths) expect(ALLOWED_INK, `${slug} ink ${width}`).toContain(width);
      // The silhouette keeps the outer ink and drops the details.
      const flat = record((ctx) => paintTreasureSilhouette(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 2.8,
      );
      expect(flat.length, `${slug} silhouette outer ink`).toBeGreaterThan(0);
    },
  );

  it.each(AREA3_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its one white shine, and none in the unfound silhouette',
    (slug, size) => {
      const shines = (paint: typeof paintTreasureIcon): number =>
        record((ctx) => paint(ctx, slug, size)).ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length;
      expect(shines(paintTreasureIcon), slug).toBe(1);
      expect(shines(paintTreasureSilhouette), `${slug} silhouette`).toBe(0);
    },
  );

  describe('rarity ladder (guide 6i)', () => {
    it('gives Legendary the gold trim, one gem and one star', () => {
      for (const slug of ['golden-lotus-throne', 'firefly-cape'] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 1, glint: 1, star: 1 });
      }
    });

    it('gives Epic one gem and no gold or star', () => {
      for (const slug of ['firefly-jar', 'pearl-tail-charm'] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 0, glint: 1, star: 0 });
      }
    });

    it('gives Common and Rare no gem, no gold trim and no star', () => {
      for (const slug of [
        'reed-bundle',
        'drifting-feather',
        'wooden-duck-decoy',
        'firefly-string-lights',
        'feather-cap',
        'lily-pad-socks',
        'water-lily-shirt',
      ] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 0, glint: 0, star: 0 });
      }
    });

    it('gives the Rare icons that carry a band their one trim band', () => {
      for (const slug of ['wooden-duck-decoy', 'water-lily-shirt'] as const) {
        const bands = record((ctx) => paintTreasureIcon(ctx, slug, 80)).ops.filter(
          (op) => op.op === 'fillRect' && op.fillStyle === BOAT_TRIM,
        );
        expect(bands, slug).toHaveLength(1);
      }
    });
  });

  describe('Decorations in the Home Tank', () => {
    const FLOORS = ['reed-bundle', 'golden-lotus-throne'] as const;
    const FLOATS = ['drifting-feather', 'wooden-duck-decoy'] as const;
    const HANGS = ['firefly-string-lights', 'firefly-jar'] as const;
    const DECORATION_SLUGS = [...FLOORS, ...FLOATS, ...HANGS] as const;

    it('matches the catalogue placement kinds, rarities and the 144 wide string lights', () => {
      const decorations = new Map(addedBy(POND_2_TREASURES, 'pond').filter(isDecoration).map((d) => [treasureSlug(d.id), d]));
      expect([...decorations.keys()]).toEqual([
        'reed-bundle',
        'drifting-feather',
        'wooden-duck-decoy',
        'firefly-string-lights',
        'firefly-jar',
        'golden-lotus-throne',
      ]);
      for (const slug of FLOORS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('floor');
      for (const slug of FLOATS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('floating');
      for (const slug of HANGS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('hanging');
      expect((decorations.get('firefly-string-lights') as Decoration).width).toBe(144);
      const badges = TANK_DECORATION_BADGES as Readonly<Record<string, BadgeShape>>;
      expect(badges['reed-bundle']).toBe('circle');
      expect(badges['drifting-feather']).toBe('circle');
      expect(badges['wooden-duck-decoy']).toBe('diamond');
      expect(badges['firefly-string-lights']).toBe('diamond');
      expect(badges['firefly-jar']).toBe('shield');
      expect(badges['golden-lotus-throne']).toBe('star');
    });

    it('lists the 31 tank Decorations in catalogue order, canal, pond, Area 3, Area 4, Area 5, then Area 6', () => {
      const catalogue = ALL_TREASURES.filter(isDecoration).map((d) => treasureSlug(d.id));
      expect(catalogue).toHaveLength(31);
      expect([...TANK_DECORATION_SLUGS]).toEqual(catalogue);
      expect(Object.keys(TANK_DECORATION_BADGES)).toEqual(catalogue);
    });

    it.each(DECORATION_SLUGS.flatMap((slug) => [48, 80].map((size) => [slug, size] as const)))(
      '%s at %i is anchored at its lowest fill edge, the icon box edge',
      (slug, size) => {
        const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(box.maxY, 1);
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(size / 2, 1);
      },
    );

    it.each(FLOATS.map((slug) => [slug] as const))('%s is anchored at the bottom centre of its 80 box', (slug) => {
      const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, 80));
      expect(decorationBaseOffset(slug, 80)).toBeCloseTo(40, 9);
      expect(box.maxY).toBeCloseTo(40, 1);
    });

    it('sits the Wooden duck decoy body across the waterline, 20 below the top of the 80 box', () => {
      const bands = record((ctx) => paintTreasureIcon(ctx, 'wooden-duck-decoy', 80)).ops.filter(
        (op) => op.op === 'fillRect' && op.fillStyle === BOAT_TRIM,
      );
      const [, y, , height] = bands[0].args as number[];
      // The band is across the body; the waterline (-40 + 20) lies inside the body ellipse, 2.4 design units under its centre.
      expect(y + height / 2).toBeGreaterThan(-40 + 20 - 10);
      expect(y).toBeLessThan(-40 + 20 + 12);
    });

    it('bakes a tank sprite and glow for each Floor and Floating one, anchored at the icon box edge', () => {
      bakes.length = 0;
      const tex = bakeTankTextures({} as never, 2, { decorationPx: 80, rand: () => 0.5 });
      const iconFrame = treasureIconTextureSize(80);
      for (const slug of [...FLOORS, ...FLOATS]) {
        expect(tex.decorations[slug].key).toBe(`tank-deco-${slug}-80`);
        expect(tex.decorationGlows[slug].key).toBe(`tank-deco-glow-${slug}-80`);
        const sprite = bakes.find((b) => b.key === tex.decorations[slug].key) as BakeCall;
        expect(sprite.size.originY - iconFrame.originY, slug).toBeCloseTo(40, 0);
        expect(sprite.size.originY - iconFrame.originY, slug).toBeCloseTo(decorationBaseOffset(slug, 80), 9);
      }
    });

    it('bakes a tank sprite and glow for each Hanging one, anchored at the top-centre hook', () => {
      bakes.length = 0;
      const tex = bakeTankTextures({} as never, 2, { decorationPx: 80, rand: () => 0.5 });
      for (const slug of HANGS) {
        expect(tex.decorations[slug].key).toBe(`tank-deco-${slug}-80`);
        expect(tex.decorationGlows[slug].key).toBe(`tank-deco-glow-${slug}-80`);
        const sprite = bakes.find((b) => b.key === tex.decorations[slug].key) as BakeCall;
        expect(sprite.size.originY, slug).toBe(1);
        expect(sprite.size.h, slug).toBe(82);
        expect(sprite.size.originX * 2, slug).toBe(sprite.size.w);
      }
    });
  });
});

describe('Chinampa Area 4 treasure art (issue #76)', () => {
  /**
   * The outer fills each icon may paint (exported by drawTreasures.ts), by item. Gems, gold trim, trim
   * bands, stars, kernel rows, spots, ink and glows are free.
   */
  const OUTER_FILLS: Readonly<Record<string, readonly string[]>> = {
    'clay-flowerpot': [CLAY_FLOWERPOT_FILL, CLAY_FLOWERPOT_SPROUT],
    'corn-husk-doll': [CORN_HUSK_FILL],
    'straw-sun-hat': [STRAW_HAT_FILL],
    'marigold-necklace': [MARIGOLD_PETAL],
    scarecrow: [SCARECROW_POST, CORN_HUSK_FILL, SCARECROW_SHIRT, SCARECROW_HAT],
    'papel-picado-banner': [PAPEL_PICADO_PINK, PAPEL_PICADO_APRICOT, PAPEL_PICADO_HOOK],
    'garden-overalls': [GARDEN_OVERALLS_FILL],
    'willow-swing': [WILLOW_FROND, WILLOW_SEAT, WILLOW_HOOK],
    'monarch-hair-clip': [MONARCH_WING, MONARCH_BODY],
    'golden-corn': [GOLDEN_CORN_KERNEL, GOLDEN_CORN_HUSK, GOLDEN_CORN_BASE],
    'monarch-wings': [MONARCH_WING, MONARCH_BODY],
  };
  const FREE_STYLES = new Set(
    [GOLD_TRIM, BOAT_TRIM, CASTLE_GEM, PYRAMID_GEM, GEM_GLINT, TREASURE_STAR, INK, GOLDEN_CORN_ROW, MONARCH_SPOT].map((c) =>
      c.toLowerCase(),
    ),
  );
  const CHINAMPA_ITEM_SLUGS = CHINAMPA_ICON_SLUGS.filter((slug) => !slug.startsWith('paint-shell-'));
  const SIZES = [28, 32, 48, 80] as const;
  const REACH_TOLERANCE = 0.05;
  /** The ink widths of the shipped icons that an Area 4 painter may use: item 2.8, details 1.6, trim lines 1.2. */
  const ALLOWED_INK = new Set([2.8, 1.6, 1.2]);
  const SHINE = 'rgba(255,255,255,0.8)';
  /** Counts of shines, gold trim bands, yellow trim bands, gem glints and stars painted by an icon. */
  const count = (slug: TreasureIconSlug): { shine: number; gold: number; band: number; glint: number; star: number } => {
    const ops = record((ctx) => paintTreasureIcon(ctx, slug, 80)).ops;
    const whites = ops.filter((op) => op.op === 'fill' && op.fillStyle === GEM_GLINT);
    const uses = (op: Op, command: string): boolean => JSON.stringify(op.args[0]).includes(`"${command}"`);
    return {
      shine: ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length,
      gold: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === GOLD_TRIM).length,
      band: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === BOAT_TRIM).length,
      glint: whites.filter((op) => uses(op, 'ellipse')).length,
      star: whites.filter((op) => uses(op, 'arcTo')).length,
    };
  };

  it('lists the eleven Area 4 items after the Area 3 ones, in catalogue order, with the Poppy red Paint shell last', () => {
    expect(CHINAMPA_ITEM_SLUGS).toHaveLength(11);
    expect(CHINAMPA_ITEM_SLUGS).toEqual(
      addedBy(CHINAMPA_TREASURES, 'chinampa').filter((treasure) => treasure.category !== 'paintShell').map((treasure) => treasureSlug(treasure.id)),
    );
    expect(CHINAMPA_ITEM_SLUGS).toEqual([
      'clay-flowerpot',
      'corn-husk-doll',
      'straw-sun-hat',
      'marigold-necklace',
      'scarecrow',
      'papel-picado-banner',
      'garden-overalls',
      'willow-swing',
      'monarch-hair-clip',
      'golden-corn',
      'monarch-wings',
    ]);
    expect(TREASURE_ICON_SLUGS).toHaveLength(84);
    expect(TREASURE_ICON_SLUGS).toHaveLength(ALL_TREASURES.length);
    expect(TREASURE_ICON_SLUGS.slice(34, 45)).toEqual(CHINAMPA_ITEM_SLUGS);
    expect(TREASURE_ICON_SLUGS.slice(67)).toEqual(DREAM_SWATCH_IDS.map((id) => `paint-shell-${id}`));
    expect(DREAM_SWATCH_IDS).toHaveLength(17);
    expect(DREAM_SWATCH_IDS[14]).toBe('poppy-red');
    expect(CHINAMPA_ICON_SLUGS).toEqual([...CHINAMPA_ITEM_SLUGS, 'paint-shell-poppy-red']);
    expect(new Set(TREASURE_ICON_SLUGS).size).toBe(TREASURE_ICON_SLUGS.length);
    expect(new Set(ALL_TREASURES.map((treasure) => treasureSlug(treasure.id)))).toEqual(new Set(TREASURE_ICON_SLUGS));
  });

  it('draws the Poppy red Paint shell icon and its swatch in the Poppy red body colour, with an icon and silhouette baked', () => {
    const shell = CHINAMPA_TREASURES.find((treasure) => treasure.category === 'paintShell');
    expect(shell?.category === 'paintShell' ? shell.dreamColour : undefined).toBe('poppy-red');
    expect(treasureSlug(shell?.id ?? '')).toBe('paint-shell-poppy-red');
    expect(DREAM_SWATCH['poppy-red'].body).toBe('#e8402f');
    expect(hexStyles((ctx) => paintTreasureIcon(ctx, 'paint-shell-poppy-red', 48))).toContain('#e8402f');
    expect(hexStyles((ctx) => paintDreamSwatch(ctx, 'poppy-red', 32))).toContain('#e8402f');
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    expect(tex.swatches['poppy-red'].key).toBe('dream-swatch-poppy-red-32');
    for (const size of [28, 32, 48] as const) {
      for (const slug of CHINAMPA_ICON_SLUGS) expect(tex.icons[size][slug].key, `${slug} ${size}`).toBe(`treasure-${slug}-${size}`);
    }
    for (const slug of CHINAMPA_ICON_SLUGS) expect(tex.silhouettes[slug].key, slug).toBe(treasureSilhouetteKey(slug));
  });

  it('keeps every Area 4 outer fill at 9:1 or more with ink, and none a rarity badge fill', () => {
    const fills = [...new Set(Object.values(OUTER_FILLS).flat())];
    expect(fills).toHaveLength(16);
    for (const fill of fills) {
      expect(contrastRatio(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
    // The new hexes: the ones that are not an alias of a shipped colour.
    for (const fill of [CLAY_FLOWERPOT_FILL, CORN_HUSK_FILL, STRAW_HAT_FILL, MARIGOLD_PETAL, GARDEN_OVERALLS_FILL, MONARCH_WING, GOLDEN_CORN_KERNEL]) {
      expect(fill, fill).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(CHINAMPA_ITEM_SLUGS.map((slug) => [slug] as const))('%s paints its own Area 4 fills and no other outer colour', (slug) => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48));
    const own = OUTER_FILLS[slug].map((c) => c.toLowerCase());
    for (const fill of own) expect(styles, `${slug} uses ${fill}`).toContain(fill);
    for (const style of styles) {
      if (FREE_STYLES.has(style)) continue;
      expect(own, `${slug} paints only its own fills, ${style} is not one`).toContain(style);
    }
  });

  it.each(CHINAMPA_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i keeps its frame: the ink inside the icon box and the texture frame, reaching nearly the whole longest side',
    (slug, size) => {
      const half = size / 2;
      const frame = frameBox(treasureIconTextureSize(size));
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const { box } = inkReach((ctx) => paint(ctx, slug, size));
        expect(box.minX, `${slug} left`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minX));
        expect(box.maxX, `${slug} right`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxX));
        expect(box.minY, `${slug} top`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minY));
        expect(box.maxY, `${slug} bottom`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxY));
      }
      const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
      expect(Math.max(box.maxX - box.minX, box.maxY - box.minY), `${slug} longest side`).toBeGreaterThanOrEqual(size - 2);
    },
  );

  it.each(CHINAMPA_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its ink outline at the shipped widths, the item outline 2.8 among them',
    (slug, size) => {
      const ink = record((ctx) => paintTreasureIcon(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK,
      );
      const widths = new Set(ink.map((op) => op.lineWidth));
      expect(widths.has(2.8), `${slug} has the 2.8 item outline`).toBe(true);
      for (const width of widths) expect(ALLOWED_INK, `${slug} ink ${width}`).toContain(width);
      // The silhouette keeps the outer ink and drops the details.
      const flat = record((ctx) => paintTreasureSilhouette(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 2.8,
      );
      expect(flat.length, `${slug} silhouette outer ink`).toBeGreaterThan(0);
    },
  );

  it.each(CHINAMPA_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its one white shine, and none in the unfound silhouette',
    (slug, size) => {
      const shines = (paint: typeof paintTreasureIcon): number =>
        record((ctx) => paint(ctx, slug, size)).ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length;
      expect(shines(paintTreasureIcon), slug).toBe(1);
      expect(shines(paintTreasureSilhouette), `${slug} silhouette`).toBe(0);
    },
  );

  it('draws every Area 4 unfound silhouette in the flat fill alone, so no icon is told apart by colour', () => {
    for (const slug of CHINAMPA_ITEM_SLUGS) {
      const fills = hexStyles((ctx) => paintTreasureSilhouette(ctx, slug, 32));
      expect([...fills].sort(), slug).toEqual([INK, TREASURE_SILHOUETTE_FILL].map((c) => c.toLowerCase()).sort());
    }
  });

  it('gives every Area 4 icon its own outline: no two silhouettes are the same drawing', () => {
    const digests = CHINAMPA_ITEM_SLUGS.map((slug) => callLogDigest((ctx) => paintTreasureSilhouette(ctx, slug, 48)));
    expect(new Set(digests).size).toBe(CHINAMPA_ITEM_SLUGS.length);
  });

  describe('rarity ladder (guide 6i)', () => {
    it('gives Legendary the gold trim, one gem and one star', () => {
      for (const slug of ['golden-corn', 'monarch-wings'] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 1, glint: 1, star: 1 });
      }
    });

    it('gives Epic one gem and no gold or star', () => {
      for (const slug of ['willow-swing', 'monarch-hair-clip'] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 0, glint: 1, star: 0 });
      }
    });

    it('gives Common and Rare no gem, no gold trim and no star', () => {
      for (const slug of [
        'clay-flowerpot',
        'corn-husk-doll',
        'straw-sun-hat',
        'marigold-necklace',
        'scarecrow',
        'papel-picado-banner',
        'garden-overalls',
      ] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 0, glint: 0, star: 0 });
      }
    });

    it('gives Common no trim band, and the Rare icons their yellow trim band', () => {
      for (const slug of ['clay-flowerpot', 'corn-husk-doll', 'straw-sun-hat', 'marigold-necklace'] as const) {
        expect(count(slug).band, slug).toBe(0);
      }
      for (const slug of ['scarecrow', 'garden-overalls'] as const) expect(count(slug).band, slug).toBe(1);
      // The banner's one band runs across its three flags, at the same height under the wire on each.
      expect(count('papel-picado-banner').band).toBe(3);
    });

    it('gives Epic and Legendary no yellow trim band, so the gem and gold carry them', () => {
      for (const slug of ['willow-swing', 'monarch-hair-clip', 'golden-corn', 'monarch-wings'] as const) {
        expect(count(slug).band, slug).toBe(0);
      }
    });
  });

  describe('Decorations in the Home Tank', () => {
    const FLOORS = ['clay-flowerpot', 'corn-husk-doll', 'scarecrow', 'golden-corn'] as const;
    const HANGS = ['papel-picado-banner', 'willow-swing'] as const;
    const PX = 80;
    const bakeShipped = (): ReturnType<typeof bakeTankTextures> => {
      bakes.length = 0;
      return bakeTankTextures({} as never, 2, { decorationPx: PX, rand: () => 0.5 });
    };
    const bakeOf = (key: string): BakeCall => bakes.find((b) => b.key === key) as BakeCall;

    it('matches the catalogue placement kinds, rarities and the 144 wide banner', () => {
      const decorations = new Map(addedBy(CHINAMPA_TREASURES, 'chinampa').filter(isDecoration).map((d) => [treasureSlug(d.id), d]));
      expect([...decorations.keys()]).toEqual([
        'clay-flowerpot',
        'corn-husk-doll',
        'scarecrow',
        'papel-picado-banner',
        'willow-swing',
        'golden-corn',
      ]);
      for (const slug of FLOORS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('floor');
      for (const slug of HANGS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('hanging');
      expect((decorations.get('papel-picado-banner') as Decoration).width).toBe(144);
      expect((decorations.get('willow-swing') as Decoration).width).toBeUndefined();
      const badges = TANK_DECORATION_BADGES as Readonly<Record<string, BadgeShape>>;
      expect(badges['clay-flowerpot']).toBe('circle');
      expect(badges['corn-husk-doll']).toBe('circle');
      expect(badges.scarecrow).toBe('diamond');
      expect(badges['papel-picado-banner']).toBe('diamond');
      expect(badges['willow-swing']).toBe('shield');
      expect(badges['golden-corn']).toBe('star');
      expect(TANK_DECORATION_SHAPES['papel-picado-banner']).toEqual({ placement: 'hanging', width: 144 });
      expect(TANK_DECORATION_SHAPES['willow-swing']).toEqual({ placement: 'hanging' });
      for (const slug of FLOORS) expect(TANK_DECORATION_SHAPES[slug], slug).toEqual({ placement: 'floor' });
    });

    it.each(FLOORS.flatMap((slug) => [48, 80].map((size) => [slug, size] as const)))(
      '%s at %i is anchored at its lowest fill edge, the icon box edge',
      (slug, size) => {
        const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(box.maxY, 1);
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(size / 2, 1);
      },
    );

    it('bakes a tank sprite and glow for each Floor one, anchored at the icon box edge', () => {
      const tex = bakeShipped();
      const iconFrame = treasureIconTextureSize(PX);
      for (const slug of FLOORS) {
        expect(tex.decorations[slug].key).toBe(`tank-deco-${slug}-80`);
        expect(tex.decorationGlows[slug].key).toBe(`tank-deco-glow-${slug}-80`);
        const sprite = bakeOf(tex.decorations[slug].key);
        expect(sprite.size.originY - iconFrame.originY, slug).toBeCloseTo(40, 0);
        expect(sprite.size.originY - iconFrame.originY, slug).toBeCloseTo(decorationBaseOffset(slug, PX), 9);
        expect(sprite.size, slug).toEqual({ ...iconFrame, originY: iconFrame.originY + decorationBaseOffset(slug, PX) });
      }
    });

    it('bakes the Willow swing from its icon at 80, hanging from its top-centre hook', () => {
      const tex = bakeShipped();
      const iconFrame = treasureIconTextureSize(PX);
      const sprite = bakeOf(tex.decorations['willow-swing'].key);
      expect(sprite.size).toEqual({ ...iconFrame, originY: iconFrame.originY - PX / 2 });
      expect(sprite.size.originY).toBe(1);
      expect(sprite.size.h).toBe(82);
      expect(sprite.size.originX * 2).toBe(sprite.size.w);
      const before = (ctx: CanvasRenderingContext2D): void => {
        ctx.translate(0, PX / 2);
        paintTreasureIcon(ctx, 'willow-swing', PX);
      };
      expect(callLogDigest(sprite.paint)).toBe(callLogDigest(before));
      // The hook ring's ink touches the hook point, and the seat reaches the base point one footprint below.
      const { box: reach } = inkReach((ctx) => paintTreasureIcon(ctx, 'willow-swing', PX));
      expect(reach.minY + PX / 2).toBeGreaterThanOrEqual(-0.05);
      expect(reach.minY + PX / 2).toBeLessThan(1);
      expect(reach.maxY + PX / 2).toBeCloseTo(PX, 1);
    });

    it('bakes the Papel picado banner on a 144 x 80 box hanging from its top-centre hook, like the Firefly string lights', () => {
      const tex = bakeShipped();
      const sprite = bakeOf(tex.decorations['papel-picado-banner'].key);
      expect(sprite.size).toEqual({ w: 146, h: 82, originX: 73, originY: 1 });
      expect(sprite.size).toEqual(bakeOf(tex.decorations['firefly-string-lights'].key).size);
      const centred = wideDecorationTextureSize(144, PX);
      expect(sprite.size).toEqual({ ...centred, originY: centred.originY - PX / 2 });
      const before = (ctx: CanvasRenderingContext2D): void => {
        ctx.translate(0, PX / 2);
        paintWideDecoration(ctx, 'papel-picado-banner', 144, PX);
      };
      expect(callLogDigest(sprite.paint)).toBe(callLogDigest(before));
      // Inside the 144 x 80 box below the hook, ink included: the hook rings on the top edge, the middle flags
      // on the bottom edge (inkReach does not follow the context transform, so measured from the box centre).
      const { box: reach } = inkReach((ctx) => paintWideDecoration(ctx, 'papel-picado-banner', 144, PX));
      expect(reach.minX).toBeGreaterThanOrEqual(-72);
      expect(reach.maxX).toBeLessThanOrEqual(72);
      expect(reach.minY + PX / 2).toBeCloseTo(0, 6);
      expect(reach.maxY + PX / 2).toBeLessThanOrEqual(PX + REACH_TOLERANCE);
      expect(reach.maxY + PX / 2).toBeGreaterThan(PX - 1.5);
      expect(reach.maxX - reach.minX).toBeGreaterThan(130);
    });

    it.each(HANGS.map((slug) => [slug] as const))('centres the %s glow on its box, with the sprite anchor at the hook', (slug) => {
      const tex = bakeShipped();
      const widthPx = TANK_DECORATION_SHAPES[slug].width ?? PX;
      const glowW = Math.round(TANK_GLOW_SCALE * widthPx);
      expect(glowW).toBe(slug === 'papel-picado-banner' ? 173 : 96);
      const glow = bakeOf(tex.decorationGlows[slug].key);
      const across = rarityGlowTextureSize(glowW);
      const tall = rarityGlowTextureSize(96);
      expect(glow.size).toEqual({ w: across.w, originX: across.originX, h: tall.h, originY: tall.originY - PX / 2 });
      const rec = record(glow.paint);
      expect(rec.calls[0]).toEqual(['translate', [0, PX / 2]]);
      expect(parseRgba(rec.gradients[0].stops[0][1]).rgb).toEqual(channelsOf(BADGE_FILL[TANK_DECORATION_BADGES[slug]]));
    });

    it('draws the wide banner as the icon parts: a wire in two swags, three hook rings, six paper flags in two fills, six bands, one shine', () => {
      const ops = record((ctx) => paintWideDecoration(ctx, 'papel-picado-banner', 144, PX)).ops;
      const fills = (fill: string): Op[] => ops.filter((op) => op.op === 'fill' && op.fillStyle === fill);
      expect(fills(PAPEL_PICADO_HOOK)).toHaveLength(3);
      expect(fills(PAPEL_PICADO_PINK)).toHaveLength(3);
      expect(fills(PAPEL_PICADO_APRICOT)).toHaveLength(3);
      expect(ops.filter((op) => op.op === 'fillRect' && op.fillStyle === BOAT_TRIM)).toHaveLength(6);
      expect(fills(SHINE)).toHaveLength(1);
      const outer = new Set(
        ops.filter((op) => op.op === 'fill' && typeof op.fillStyle === 'string' && op.fillStyle.startsWith('#')).map((op) => op.fillStyle),
      );
      expect([...outer].sort()).toEqual([PAPEL_PICADO_APRICOT, PAPEL_PICADO_HOOK, PAPEL_PICADO_PINK].sort());
      const ink = ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK);
      expect([...new Set(ink.map((op) => op.lineWidth))].sort()).toEqual([1.2, 1.6, 2.8]);
    });

    it('keeps the wide banner ink constant at another size, and each band reaches the whole 144 box', () => {
      const widthsAt = (px: number): number[] =>
        record((ctx) => paintWideDecoration(ctx, 'papel-picado-banner', 144, px)).ops
          .filter((op) => op.op === 'stroke')
          .map((op) => op.lineWidth);
      expect(widthsAt(120)).toEqual(widthsAt(PX));
      expect(record((ctx) => paintWideDecoration(ctx, 'papel-picado-banner', 144, 120)).calls.some(([name]) => name === 'scale')).toBe(false);
      for (const op of record((ctx) => paintWideDecoration(ctx, 'papel-picado-banner', 144, PX)).ops) {
        if (op.op !== 'fillRect' || op.fillStyle !== BOAT_TRIM) continue;
        const [x, , w] = op.args as number[];
        expect(x).toBeLessThanOrEqual(-72);
        expect(x + w).toBeGreaterThanOrEqual(72);
      }
    });
  });
});

describe('Chinampa Area 5 treasure art (issue #103)', () => {
  /**
   * The outer fills each icon may paint (exported by drawTreasures.ts), by item. Gems, gold trim, the hem band,
   * sunflower centre, embroidery, tile blue, dots, stripes, ink and glows are free.
   */
  const OUTER_FILLS: Readonly<Record<string, readonly string[]>> = {
    'watering-can': [WATERING_CAN_FILL],
    'floating-gourd': [GOURD_FILL, GOURD_WEIGHT],
    'bee-headband': [BEE_HEADBAND_FILL],
    bandana: [BANDANA_FILL],
    pinata: [PINATA_PINK, PINATA_SKY, PINATA_APRICOT, PINATA_HOOK],
    'sunflower-sunglasses': [SUNFLOWER_FRAME],
    'embroidered-shirt': [EMBROIDERED_SHIRT_FILL],
    'talavera-fountain': [TALAVERA_TILE, TALAVERA_WATER],
    'hummingbird-tail-ribbon': [HUMMINGBIRD_RIBBON_FILL],
    'alebrije-statue': [ALEBRIJE_BODY, ALEBRIJE_WING, ALEBRIJE_HEAD, ALEBRIJE_TAIL, ALEBRIJE_BASE],
    'rainbow-serape-cape': [SERAPE_FILL],
  };
  const FREE_STYLES = new Set(
    [
      GOLD_TRIM,
      BOAT_TRIM,
      CASTLE_GEM,
      PYRAMID_GEM,
      BOW_GEM,
      GEM_GLINT,
      TREASURE_STAR,
      INK,
      SUNFLOWER_CENTRE,
      EMBROIDERY_BAND,
      TALAVERA_COBALT,
      BANDANA_DOT,
      ...EMBROIDERY_PETALS,
      ...ALEBRIJE_MARKS,
      ...SERAPE_STRIPES,
    ].map((c) => c.toLowerCase()),
  );
  const CHINAMPA_2_ITEM_SLUGS = CHINAMPA_2_ICON_SLUGS.filter((slug) => !slug.startsWith('paint-shell-'));
  const SIZES = [28, 32, 48, 80] as const;
  const REACH_TOLERANCE = 0.05;
  /** The ink widths of the shipped icons that an Area 5 painter may use: item 2.8, details 1.6, trim lines 1.2. */
  const ALLOWED_INK = new Set([2.8, 1.6, 1.2]);
  /** The Sunflower sunglasses are glasses: their frame is a tube of band 1.5 and 1.0 ink each side (3.5), bridge 2.6 (4.6). */
  const GLASSES_INK = new Set([3.5, 4.6]);
  const SHINE = 'rgba(255,255,255,0.8)';
  /** Counts of shines, gold trim bands, yellow trim bands, teal trim bands, gem glints and stars painted by an icon. */
  const count = (slug: TreasureIconSlug): { shine: number; gold: number; band: number; teal: number; glint: number; star: number } => {
    const ops = record((ctx) => paintTreasureIcon(ctx, slug, 80)).ops;
    const whites = ops.filter((op) => op.op === 'fill' && op.fillStyle === GEM_GLINT);
    const uses = (op: Op, command: string): boolean => JSON.stringify(op.args[0]).includes(`"${command}"`);
    return {
      shine: ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length,
      gold: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === GOLD_TRIM).length,
      band: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === BOAT_TRIM).length,
      teal: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === EMBROIDERY_BAND).length,
      glint: whites.filter((op) => uses(op, 'ellipse')).length,
      star: whites.filter((op) => uses(op, 'arcTo')).length,
    };
  };

  it('lists the eleven Area 5 items after the Area 4 ones, in catalogue order, with the Plum Paint shell last', () => {
    expect(CHINAMPA_2_ITEM_SLUGS).toHaveLength(11);
    expect(CHINAMPA_2_ITEM_SLUGS).toEqual(
      addedBy(CHINAMPA_2_TREASURES, 'chinampa').filter((treasure) => treasure.category !== 'paintShell').map((treasure) => treasureSlug(treasure.id)),
    );
    expect(CHINAMPA_2_ITEM_SLUGS).toEqual([
      'watering-can',
      'floating-gourd',
      'bee-headband',
      'bandana',
      'pinata',
      'sunflower-sunglasses',
      'embroidered-shirt',
      'talavera-fountain',
      'hummingbird-tail-ribbon',
      'alebrije-statue',
      'rainbow-serape-cape',
    ]);
    expect(TREASURE_ICON_SLUGS).toHaveLength(84);
    expect(TREASURE_ICON_SLUGS).toHaveLength(ALL_TREASURES.length);
    expect(TREASURE_ICON_SLUGS.slice(45, 56)).toEqual(CHINAMPA_2_ITEM_SLUGS);
    expect(TREASURE_ICON_SLUGS.slice(67)).toEqual(DREAM_SWATCH_IDS.map((id) => `paint-shell-${id}`));
    expect(DREAM_SWATCH_IDS).toHaveLength(17);
    expect(DREAM_SWATCH_IDS[15]).toBe('plum');
    expect(CHINAMPA_2_ICON_SLUGS).toEqual([...CHINAMPA_2_ITEM_SLUGS, 'paint-shell-plum']);
    expect(new Set(TREASURE_ICON_SLUGS).size).toBe(TREASURE_ICON_SLUGS.length);
    expect(new Set(ALL_TREASURES.map((treasure) => treasureSlug(treasure.id)))).toEqual(new Set(TREASURE_ICON_SLUGS));
  });

  it('draws the Plum Paint shell icon and its swatch in the Plum body colour, with an icon and silhouette baked', () => {
    const shell = CHINAMPA_2_TREASURES.find((treasure) => treasure.category === 'paintShell');
    expect(shell?.category === 'paintShell' ? shell.dreamColour : undefined).toBe('plum');
    expect(treasureSlug(shell?.id ?? '')).toBe('paint-shell-plum');
    expect(DREAM_SWATCH.plum).toEqual({ body: '#933f93', pattern: 'plain', marks: [], dark: true });
    expect(hexStyles((ctx) => paintTreasureIcon(ctx, 'paint-shell-plum', 48))).toContain('#933f93');
    expect(hexStyles((ctx) => paintDreamSwatch(ctx, 'plum', 32))).toContain('#933f93');
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    expect(tex.swatches.plum.key).toBe('dream-swatch-plum-32');
    for (const size of [28, 32, 48] as const) {
      for (const slug of CHINAMPA_2_ICON_SLUGS) expect(tex.icons[size][slug].key, `${slug} ${size}`).toBe(`treasure-${slug}-${size}`);
    }
    for (const slug of CHINAMPA_2_ICON_SLUGS) expect(tex.silhouettes[slug].key, slug).toBe(treasureSilhouetteKey(slug));
  });

  it('keeps every Area 5 outer fill at 9:1 or more with ink, and none a rarity badge fill', () => {
    const fills = [...new Set(Object.values(OUTER_FILLS).flat())];
    expect(fills).toHaveLength(19);
    for (const fill of fills) {
      expect(contrastRatio(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
    for (const fill of [WATERING_CAN_FILL, GOURD_FILL, BEE_HEADBAND_FILL, BANDANA_FILL, PINATA_SKY, SUNFLOWER_FRAME, EMBROIDERED_SHIRT_FILL]) {
      expect(fill, fill).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const fill of [TALAVERA_TILE, TALAVERA_WATER, HUMMINGBIRD_RIBBON_FILL, ALEBRIJE_BODY, ALEBRIJE_WING, ALEBRIJE_HEAD, ALEBRIJE_TAIL, SERAPE_FILL]) {
      expect(fill, fill).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(CHINAMPA_2_ITEM_SLUGS.map((slug) => [slug] as const))('%s paints its own Area 5 fills and no other outer colour', (slug) => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48));
    const own = OUTER_FILLS[slug].map((c) => c.toLowerCase());
    for (const fill of own) expect(styles, `${slug} uses ${fill}`).toContain(fill);
    for (const style of styles) {
      if (FREE_STYLES.has(style)) continue;
      expect(own, `${slug} paints only its own fills, ${style} is not one`).toContain(style);
    }
  });

  it.each(CHINAMPA_2_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i keeps its frame: the ink inside the icon box and the texture frame, reaching nearly the whole longest side',
    (slug, size) => {
      const half = size / 2;
      const frame = frameBox(treasureIconTextureSize(size));
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const { box } = inkReach((ctx) => paint(ctx, slug, size));
        expect(box.minX, `${slug} left`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minX));
        expect(box.maxX, `${slug} right`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxX));
        expect(box.minY, `${slug} top`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minY));
        expect(box.maxY, `${slug} bottom`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxY));
      }
      const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
      expect(Math.max(box.maxX - box.minX, box.maxY - box.minY), `${slug} longest side`).toBeGreaterThanOrEqual(size - 2);
    },
  );

  it.each(CHINAMPA_2_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its ink outline at the shipped widths, the item outline 2.8 among them',
    (slug, size) => {
      const ink = record((ctx) => paintTreasureIcon(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK,
      );
      const widths = new Set(ink.map((op) => op.lineWidth));
      const allowed = slug === 'sunflower-sunglasses' ? new Set([...ALLOWED_INK, ...GLASSES_INK]) : ALLOWED_INK;
      expect(widths.has(2.8), `${slug} has the 2.8 item outline`).toBe(true);
      for (const width of widths) expect(allowed, `${slug} ink ${width}`).toContain(width);
      // The silhouette keeps the outer ink and drops the details.
      const flat = record((ctx) => paintTreasureSilhouette(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 2.8,
      );
      expect(flat.length, `${slug} silhouette outer ink`).toBeGreaterThan(0);
    },
  );

  it.each(CHINAMPA_2_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its one white shine, and none in the unfound silhouette',
    (slug, size) => {
      const shines = (paint: typeof paintTreasureIcon): number =>
        record((ctx) => paint(ctx, slug, size)).ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length;
      expect(shines(paintTreasureIcon), slug).toBe(1);
      expect(shines(paintTreasureSilhouette), `${slug} silhouette`).toBe(0);
    },
  );

  it('draws every Area 5 unfound silhouette in the flat fill alone, so no icon is told apart by colour', () => {
    for (const slug of CHINAMPA_2_ITEM_SLUGS) {
      const fills = hexStyles((ctx) => paintTreasureSilhouette(ctx, slug, 32));
      expect([...fills].sort(), slug).toEqual([INK, TREASURE_SILHOUETTE_FILL].map((c) => c.toLowerCase()).sort());
    }
  });

  it('gives every Area 5 icon its own outline: no two silhouettes are the same drawing', () => {
    const digests = CHINAMPA_2_ITEM_SLUGS.map((slug) => callLogDigest((ctx) => paintTreasureSilhouette(ctx, slug, 48)));
    expect(new Set(digests).size).toBe(CHINAMPA_2_ITEM_SLUGS.length);
  });

  it('keeps the Area 5 cue values apart in greyscale: pale fills, so ink or fill is 3:1 or better on any background', () => {
    // A fill 9:1 with ink has relative luminance 0.607 or more, so it is 3:1 or better against the deepest background (10).
    for (const fill of [...new Set(Object.values(OUTER_FILLS).flat())]) {
      expect(relativeLuminance(fill), fill).toBeGreaterThanOrEqual(0.607);
    }
    // The count cues never lean on hue: the Rare and Epic and Legendary counted details are shapes, not colours.
    expect(contrastRatio(EMBROIDERY_BAND, EMBROIDERED_SHIRT_FILL)).toBeGreaterThan(1.3);
  });

  describe('rarity ladder (guide 6i)', () => {
    it('gives Legendary the gold trim, one gem and one star', () => {
      for (const slug of ['alebrije-statue', 'rainbow-serape-cape'] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 1, glint: 1, star: 1 });
      }
    });

    it('gives Epic one gem and no gold or star', () => {
      for (const slug of ['talavera-fountain', 'hummingbird-tail-ribbon'] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 0, glint: 1, star: 0 });
      }
    });

    it('gives Common and Rare no gem, no gold trim and no star', () => {
      for (const slug of [
        'watering-can',
        'floating-gourd',
        'bee-headband',
        'bandana',
        'pinata',
        'sunflower-sunglasses',
        'embroidered-shirt',
      ] as const) {
        expect(count(slug), slug).toMatchObject({ gold: 0, glint: 0, star: 0 });
      }
    });

    it('gives Common no trim band, and the Rare icons their one trim band (or, for the glasses, their sunflower)', () => {
      for (const slug of ['watering-can', 'floating-gourd', 'bee-headband', 'bandana'] as const) {
        expect(count(slug), slug).toMatchObject({ band: 0, teal: 0 });
      }
      // The Pinata's sash is the one yellow band; the blouse's hem is the one teal band, as its worn look.
      expect(count('pinata')).toMatchObject({ band: 1, teal: 0 });
      expect(count('embroidered-shirt')).toMatchObject({ band: 0, teal: 1 });
      // The sunglasses' one Rare detail is the sunflower on the bridge: eight petals round a brown centre.
      expect(count('sunflower-sunglasses')).toMatchObject({ band: 0, teal: 0 });
      expect(hexStyles((ctx) => paintTreasureIcon(ctx, 'sunflower-sunglasses', 48))).toContain(SUNFLOWER_CENTRE);
    });

    it('gives Epic and Legendary no band, so the gem and gold carry them', () => {
      for (const slug of ['talavera-fountain', 'hummingbird-tail-ribbon', 'alebrije-statue', 'rainbow-serape-cape'] as const) {
        expect(count(slug), slug).toMatchObject({ band: 0, teal: 0 });
      }
    });
  });

  it('gives the Talavera fountain its blue-and-white tile look: white glaze and aqua water, with cobalt tile blue inside', () => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, 'talavera-fountain', 80));
    for (const colour of [TALAVERA_TILE, TALAVERA_WATER, TALAVERA_COBALT]) expect(styles).toContain(colour.toLowerCase());
    // The cobalt is a detail inside the glaze and is skipped in the unfound silhouette.
    expect(hexStyles((ctx) => paintTreasureSilhouette(ctx, 'talavera-fountain', 80))).not.toContain(TALAVERA_COBALT.toLowerCase());
  });

  it('gives the Alebrije statue its four mark colours, a winged friendly creature, and keeps them out of the silhouette', () => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, 'alebrije-statue', 80));
    for (const mark of ALEBRIJE_MARKS) expect(styles, mark).toContain(mark.toLowerCase());
    const flat = hexStyles((ctx) => paintTreasureSilhouette(ctx, 'alebrije-statue', 80));
    for (const mark of ALEBRIJE_MARKS) expect(flat, mark).not.toContain(mark.toLowerCase());
  });

  it('draws the Pinata as a star with five wedges, a hook ring and no stick: nothing to hit', () => {
    const ops = record((ctx) => paintTreasureIcon(ctx, 'pinata', 80)).ops;
    const wedge = (fill: string): Op[] => ops.filter((op) => op.op === 'fill' && op.fillStyle === fill);
    // The star body fill is the pink; wedges add one more pink, two sky and one apricot; one hook ring.
    expect(wedge(PINATA_SKY)).toHaveLength(2);
    expect(wedge(PINATA_APRICOT)).toHaveLength(1);
    expect(wedge(PINATA_PINK)).toHaveLength(3);
    expect(wedge(PINATA_HOOK)).toHaveLength(1);
  });

  describe('Decorations in the Home Tank', () => {
    const FLOORS = ['watering-can', 'talavera-fountain', 'alebrije-statue'] as const;
    const FLOATS = ['floating-gourd'] as const;
    const PX = 80;
    const bakeShipped = (): ReturnType<typeof bakeTankTextures> => {
      bakes.length = 0;
      return bakeTankTextures({} as never, 2, { decorationPx: PX, rand: () => 0.5 });
    };
    const bakeOf = (key: string): BakeCall => bakes.find((b) => b.key === key) as BakeCall;

    it('matches the catalogue placement kinds, rarities and standard widths', () => {
      const decorations = new Map(addedBy(CHINAMPA_2_TREASURES, 'chinampa').filter(isDecoration).map((d) => [treasureSlug(d.id), d]));
      expect([...decorations.keys()]).toEqual(['watering-can', 'floating-gourd', 'pinata', 'talavera-fountain', 'alebrije-statue']);
      for (const slug of FLOORS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('floor');
      for (const slug of FLOATS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('floating');
      expect(placementKind(decorations.get('pinata') as Decoration)).toBe('hanging');
      for (const decoration of decorations.values()) expect(decoration.width, decoration.id).toBeUndefined();
      const badges = TANK_DECORATION_BADGES as Readonly<Record<string, BadgeShape>>;
      expect(badges['watering-can']).toBe('circle');
      expect(badges['floating-gourd']).toBe('circle');
      expect(badges.pinata).toBe('diamond');
      expect(badges['talavera-fountain']).toBe('shield');
      expect(badges['alebrije-statue']).toBe('star');
      for (const slug of FLOORS) expect(TANK_DECORATION_SHAPES[slug], slug).toEqual({ placement: 'floor' });
      expect(TANK_DECORATION_SHAPES['floating-gourd']).toEqual({ placement: 'floating' });
      expect(TANK_DECORATION_SHAPES.pinata).toEqual({ placement: 'hanging' });
    });

    it.each([...FLOORS, ...FLOATS].flatMap((slug) => [48, 80].map((size) => [slug, size] as const)))(
      '%s at %i is anchored at its lowest fill edge, the icon box edge',
      (slug, size) => {
        const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(box.maxY, 1);
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(size / 2, 1);
      },
    );

    it('bakes a tank sprite and glow for each Floor and Floating one, anchored at the icon box edge', () => {
      const tex = bakeShipped();
      const iconFrame = treasureIconTextureSize(PX);
      for (const slug of [...FLOORS, ...FLOATS]) {
        expect(tex.decorations[slug].key).toBe(`tank-deco-${slug}-80`);
        expect(tex.decorationGlows[slug].key).toBe(`tank-deco-glow-${slug}-80`);
        const sprite = bakeOf(tex.decorations[slug].key);
        expect(sprite.size.originY - iconFrame.originY, slug).toBeCloseTo(40, 0);
        expect(sprite.size.originY - iconFrame.originY, slug).toBeCloseTo(decorationBaseOffset(slug, PX), 9);
        expect(sprite.size, slug).toEqual({ ...iconFrame, originY: iconFrame.originY + decorationBaseOffset(slug, PX) });
      }
    });

    it('sits the Floating gourd across the waterline, 20 below the top of the 80 box', () => {
      // The gourd body is the last GOURD_FILL fill (the stem is first): it reaches above and below y = -40 + 20.
      const fills = record((ctx) => paintTreasureIcon(ctx, 'floating-gourd', PX)).ops.filter(
        (op) => op.op === 'fill' && op.fillStyle === GOURD_FILL,
      );
      const points: [number, number][] = [];
      pathPoints(fills[fills.length - 1].args[0] as unknown[][], IDENTITY, points);
      const ys = points.map(([, y]) => y);
      expect(Math.min(...ys)).toBeLessThan(-20 - 8);
      expect(Math.max(...ys)).toBeGreaterThan(-20 + 8);
      expect(Math.min(...ys)).toBeGreaterThan(-40);
    });

    it('bakes the Pinata from its icon at 80, hanging from its top-centre hook', () => {
      const tex = bakeShipped();
      const iconFrame = treasureIconTextureSize(PX);
      const sprite = bakeOf(tex.decorations.pinata.key);
      expect(sprite.size).toEqual({ ...iconFrame, originY: iconFrame.originY - PX / 2 });
      expect(sprite.size.originY).toBe(1);
      expect(sprite.size.h).toBe(82);
      expect(sprite.size.originX * 2).toBe(sprite.size.w);
      const before = (ctx: CanvasRenderingContext2D): void => {
        ctx.translate(0, PX / 2);
        paintTreasureIcon(ctx, 'pinata', PX);
      };
      expect(callLogDigest(sprite.paint)).toBe(callLogDigest(before));
      // The hook ring's ink touches the hook point, and the two lower tips reach the base point one footprint below.
      const { box: reach } = inkReach((ctx) => paintTreasureIcon(ctx, 'pinata', PX));
      expect(reach.minY + PX / 2).toBeGreaterThanOrEqual(-0.05);
      expect(reach.minY + PX / 2).toBeLessThan(1);
      expect(reach.maxY + PX / 2).toBeGreaterThan(PX - 1.5);
      expect(reach.maxY + PX / 2).toBeLessThanOrEqual(PX + REACH_TOLERANCE);
    });

    it('centres the Pinata glow on its box, with the sprite anchor at the hook', () => {
      const tex = bakeShipped();
      const glow = bakeOf(tex.decorationGlows.pinata.key);
      const frame = rarityGlowTextureSize(96);
      expect(glow.size).toEqual({ ...frame, originY: frame.originY - PX / 2 });
      const rec = record(glow.paint);
      expect(rec.calls[0]).toEqual(['translate', [0, PX / 2]]);
      expect(parseRgba(rec.gradients[0].stops[0][1]).rgb).toEqual(channelsOf(BADGE_FILL.diamond));
    });
  });
});

describe('Spring cave Area 6 treasure art (issue #77, ND-12)', () => {
  /**
   * The outer fills each icon may paint (exported by treasurePalette.ts), by item. Gems, gold trim, the yellow trim
   * band, the geode cavity and crystals, the lamp lens, the moss glow dots, ink and glows are free.
   */
  const OUTER_FILLS: Readonly<Record<string, readonly string[]>> = {
    'pebble-stack': [PEBBLE_STACK_FILL],
    'glow-moss-ball': [MOSS_BALL_FILL, MOSS_BALL_WEIGHT],
    'miners-headlamp': [MINERS_HELMET_FILL],
    'crystal-pendant': [CAVE_CRYSTAL_FILL],
    'fossil-ammonite': [AMMONITE_FILL, AMMONITE_SLAB],
    'crystal-wind-chime': [CAVE_CRYSTAL_FILL, WIND_CHIME_BAR, WIND_CHIME_HOOK],
    'explorer-vest': [EXPLORER_VEST_FILL],
    'geode-lamp': [GEODE_ROCK_FILL, GEODE_BASE_FILL],
    'crystal-tail-cuff': [CRYSTAL_CUFF_BAND, CAVE_CRYSTAL_FILL],
    'crystal-arch': [CAVE_CRYSTAL_FILL, CRYSTAL_ARCH_BASE],
    'crystal-crown': [CAVE_CRYSTAL_FILL, CRYSTAL_CROWN_BAND],
  };
  const FREE_STYLES = new Set(
    [GOLD_TRIM, BOAT_TRIM, CASTLE_GEM, PYRAMID_GEM, GEM_GLINT, TREASURE_STAR, INK, GEODE_CAVITY, GEODE_CRYSTAL, HEADLAMP_LENS, MOSS_GLOW_DOT].map(
      (c) => c.toLowerCase(),
    ),
  );
  const SPRING_CAVE_ITEM_SLUGS = SPRING_CAVE_ICON_SLUGS.filter((slug) => !slug.startsWith('paint-shell-'));
  /** The catalogue rarity of each item, which the icon's rarity look ladder (guide 6i) must follow. */
  const RARITY_OF: Readonly<Record<string, Treasure['rarity']>> = {
    'pebble-stack': 'common',
    'glow-moss-ball': 'common',
    'miners-headlamp': 'common',
    'crystal-pendant': 'common',
    'fossil-ammonite': 'rare',
    'crystal-wind-chime': 'rare',
    'explorer-vest': 'rare',
    'geode-lamp': 'epic',
    'crystal-tail-cuff': 'epic',
    'crystal-arch': 'legendary',
    'crystal-crown': 'legendary',
  };
  const SIZES = [28, 32, 48, 80] as const;
  const REACH_TOLERANCE = 0.05;
  /** The ink widths of the shipped icons that an Area 6 painter may use: item 2.8, details 1.6, trim lines 1.2. */
  const ALLOWED_INK = new Set([2.8, 1.6, 1.2]);
  /** The Crystal pendant's chain is a tube: colour 3.2 with 2.4 ink each side, 8 in all. */
  const TUBE_INK = new Set([8]);
  const SHINE = 'rgba(255,255,255,0.8)';
  /** Counts of shines, gold trim bands, yellow trim bands, gem glints and stars painted by an icon. */
  const count = (slug: TreasureIconSlug): { shine: number; gold: number; band: number; glint: number; star: number } => {
    const ops = record((ctx) => paintTreasureIcon(ctx, slug, 80)).ops;
    const whites = ops.filter((op) => op.op === 'fill' && op.fillStyle === GEM_GLINT);
    const uses = (op: Op, command: string): boolean => JSON.stringify(op.args[0]).includes(`"${command}"`);
    return {
      shine: ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length,
      gold: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === GOLD_TRIM).length,
      band: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === BOAT_TRIM).length,
      glint: whites.filter((op) => uses(op, 'ellipse')).length,
      star: whites.filter((op) => uses(op, 'arcTo')).length,
    };
  };

  it('lists the eleven Area 6 items after the Area 5 ones, in catalogue order, with the Moonstone Paint shell last of all', () => {
    expect(SPRING_CAVE_ITEM_SLUGS).toHaveLength(11);
    expect(SPRING_CAVE_ITEM_SLUGS).toEqual(
      addedBy(SPRING_CAVE_TREASURES, 'spring-cave')
        .filter((treasure) => treasure.category !== 'paintShell')
        .map((treasure) => treasureSlug(treasure.id)),
    );
    expect(SPRING_CAVE_ITEM_SLUGS).toEqual([
      'pebble-stack',
      'glow-moss-ball',
      'miners-headlamp',
      'crystal-pendant',
      'fossil-ammonite',
      'crystal-wind-chime',
      'explorer-vest',
      'geode-lamp',
      'crystal-tail-cuff',
      'crystal-arch',
      'crystal-crown',
    ]);
    expect(TREASURE_ICON_SLUGS).toHaveLength(84);
    expect(TREASURE_ICON_SLUGS).toHaveLength(ALL_TREASURES.length);
    expect(TREASURE_ICON_SLUGS.slice(56, 67)).toEqual(SPRING_CAVE_ITEM_SLUGS);
    expect(TREASURE_ICON_SLUGS.slice(67)).toEqual(DREAM_SWATCH_IDS.map((id) => `paint-shell-${id}`));
    expect(SPRING_CAVE_ICON_SLUGS).toEqual([...SPRING_CAVE_ITEM_SLUGS, 'paint-shell-moonstone']);
    expect(SPRING_CAVE_TREASURES).toHaveLength(12);
    expect(new Set(TREASURE_ICON_SLUGS).size).toBe(TREASURE_ICON_SLUGS.length);
    expect(new Set(ALL_TREASURES.map((treasure) => treasureSlug(treasure.id)))).toEqual(new Set(TREASURE_ICON_SLUGS));
  });

  it('draws the Moonstone Paint shell with the Moonstone swatch, and bakes an icon and silhouette for all twelve treasures', () => {
    const shell = SPRING_CAVE_TREASURES.find((treasure) => treasure.category === 'paintShell');
    expect(shell?.category === 'paintShell' ? shell.dreamColour : undefined).toBe('moonstone');
    expect(treasureSlug(shell?.id ?? '')).toBe('paint-shell-moonstone');
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    for (const size of [28, 32, 48] as const) {
      for (const slug of SPRING_CAVE_ICON_SLUGS) expect(tex.icons[size][slug].key, `${slug} ${size}`).toBe(`treasure-${slug}-${size}`);
    }
    for (const slug of SPRING_CAVE_ICON_SLUGS) expect(tex.silhouettes[slug].key, slug).toBe(treasureSilhouetteKey(slug));
    for (const slug of SPRING_CAVE_ICON_SLUGS) expect(bakes.some((b) => b.key === treasureSilhouetteKey(slug)), slug).toBe(true);
    expect(tex.swatches.moonstone.key).toBe('dream-swatch-moonstone-32');
  });

  it('follows the catalogue rarity of each item, and keeps the ladder: Fossil ammonite Rare, Geode lamp Epic, Crystal arch and Crystal crown Legendary', () => {
    const catalogue = new Map(SPRING_CAVE_TREASURES.map((treasure) => [treasureSlug(treasure.id), treasure.rarity]));
    for (const slug of SPRING_CAVE_ITEM_SLUGS) expect(catalogue.get(slug), slug).toBe(RARITY_OF[slug]);
    expect(RARITY_OF['fossil-ammonite']).toBe('rare');
    expect(RARITY_OF['geode-lamp']).toBe('epic');
    expect(RARITY_OF['crystal-arch']).toBe('legendary');
    expect(RARITY_OF['crystal-crown']).toBe('legendary');
  });

  it('keeps every Area 6 outer fill at 9:1 or more with ink, and none a rarity badge fill', () => {
    const fills = [...new Set(Object.values(OUTER_FILLS).flat())];
    for (const fill of fills) {
      expect(fill, fill).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
    // Eleven distinct outer fills: three of the twelve are shared or aliases (pebble A, pebble C, the pale pad green).
    expect(fills.map((c) => c.toLowerCase())).toEqual([
      PEBBLE_STACK_FILL,
      MOSS_BALL_FILL,
      MOSS_BALL_WEIGHT,
      MINERS_HELMET_FILL,
      CAVE_CRYSTAL_FILL,
      AMMONITE_FILL,
      AMMONITE_SLAB,
      WIND_CHIME_BAR,
      EXPLORER_VEST_FILL,
      GEODE_ROCK_FILL,
      GEODE_BASE_FILL,
      CRYSTAL_CUFF_BAND,
      CRYSTAL_ARCH_BASE,
      CRYSTAL_CROWN_BAND,
    ].filter((c, i, all) => all.indexOf(c) === i));
  });

  it('shares the shipped colours where the Area 6 fills alias them', () => {
    expect(MOSS_BALL_FILL).toBe(LILY_PAD_SOCK_FILL);
    expect(MOSS_BALL_WEIGHT).toBe(FIREFLY_HOOK);
    expect(WIND_CHIME_BAR).toBe(DECOY_BODY);
    expect(WIND_CHIME_HOOK).toBe(FIREFLY_HOOK);
    expect(GEODE_BASE_FILL).toBe(GOLDEN_LOTUS_BASE);
    expect(CRYSTAL_ARCH_BASE).toBe(GOLDEN_LOTUS_BASE);
    expect(AMMONITE_SLAB).toBe(CRYSTAL_CUFF_BAND);
    expect(CRYSTAL_CUFF_BAND).toBe(PEBBLE_A);
  });

  it.each(SPRING_CAVE_ITEM_SLUGS.map((slug) => [slug] as const))('%s paints its own Area 6 fills and no other outer colour', (slug) => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48));
    const own = OUTER_FILLS[slug].map((c) => c.toLowerCase());
    for (const fill of own) expect(styles, `${slug} uses ${fill}`).toContain(fill);
    for (const style of styles) {
      if (FREE_STYLES.has(style)) continue;
      expect(own, `${slug} paints only its own fills, ${style} is not one`).toContain(style);
    }
  });

  it.each(SPRING_CAVE_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i keeps its frame: the ink inside the icon box and the texture frame, reaching nearly the whole longest side',
    (slug, size) => {
      const half = size / 2;
      const frame = frameBox(treasureIconTextureSize(size));
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const { box } = inkReach((ctx) => paint(ctx, slug, size));
        expect(box.minX, `${slug} left`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minX));
        expect(box.maxX, `${slug} right`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxX));
        expect(box.minY, `${slug} top`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minY));
        expect(box.maxY, `${slug} bottom`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxY));
      }
      const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
      expect(Math.max(box.maxX - box.minX, box.maxY - box.minY), `${slug} longest side`).toBeGreaterThanOrEqual(size - 2);
    },
  );

  it.each(SPRING_CAVE_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its ink outline at the shipped widths, the item outline 2.8 among them',
    (slug, size) => {
      const ink = record((ctx) => paintTreasureIcon(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK,
      );
      const widths = new Set(ink.map((op) => op.lineWidth));
      const allowed = slug === 'crystal-pendant' ? new Set([...ALLOWED_INK, ...TUBE_INK]) : ALLOWED_INK;
      expect(widths.has(2.8), `${slug} has the 2.8 item outline`).toBe(true);
      for (const width of widths) expect(allowed, `${slug} ink ${width}`).toContain(width);
      // The silhouette keeps the outer ink and drops the details.
      const flat = record((ctx) => paintTreasureSilhouette(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 2.8,
      );
      expect(flat.length, `${slug} silhouette outer ink`).toBeGreaterThan(0);
    },
  );

  it.each(SPRING_CAVE_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its one white shine, and none in the unfound silhouette',
    (slug, size) => {
      const shines = (paint: typeof paintTreasureIcon): number =>
        record((ctx) => paint(ctx, slug, size)).ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length;
      expect(shines(paintTreasureIcon), slug).toBe(1);
      expect(shines(paintTreasureSilhouette), `${slug} silhouette`).toBe(0);
    },
  );

  it('draws every Area 6 unfound silhouette in the flat fill alone, so no icon is told apart by colour', () => {
    for (const slug of SPRING_CAVE_ITEM_SLUGS) {
      const fills = hexStyles((ctx) => paintTreasureSilhouette(ctx, slug, 32));
      expect([...fills].sort(), slug).toEqual([INK, TREASURE_SILHOUETTE_FILL].map((c) => c.toLowerCase()).sort());
    }
  });

  it('gives every Area 6 icon its own outline: no two silhouettes are the same drawing', () => {
    const digests = SPRING_CAVE_ITEM_SLUGS.map((slug) => callLogDigest((ctx) => paintTreasureSilhouette(ctx, slug, 48)));
    expect(new Set(digests).size).toBe(SPRING_CAVE_ITEM_SLUGS.length);
  });

  it('keeps the Area 6 cue values pale: 9:1 fills have relative luminance 0.607 or more, so ink or fill is 3:1 or better on any background', () => {
    // The dark cave sits under a dark layer, so the pale fills matter most here (guide 10).
    for (const fill of [...new Set(Object.values(OUTER_FILLS).flat())]) {
      expect(relativeLuminance(fill), fill).toBeGreaterThanOrEqual(0.607);
    }
    // The Legendary gold band stands apart from the pale fills it crosses; the Rare yellow band is set between two thin ink lines.
    expect(contrastRatio(GOLD_TRIM, CAVE_CRYSTAL_FILL)).toBeGreaterThan(1.3);
    expect(contrastRatio(GOLD_TRIM, CRYSTAL_CROWN_BAND)).toBeGreaterThan(1.3);
    for (const slug of ['fossil-ammonite', 'crystal-wind-chime', 'explorer-vest'] as const) {
      const lines = record((ctx) => paintTreasureIcon(ctx, slug, 80)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 1.2,
      );
      expect(lines.length, `${slug} trim band lines`).toBeGreaterThanOrEqual(2);
    }
  });

  describe('rarity ladder (guide 6i)', () => {
    const byRarity = (rarity: Treasure['rarity']): TreasureIconSlug[] =>
      SPRING_CAVE_ITEM_SLUGS.filter((slug) => RARITY_OF[slug] === rarity);

    it('gives Legendary the gold trim, one gem and one star', () => {
      expect(byRarity('legendary')).toEqual(['crystal-arch', 'crystal-crown']);
      for (const slug of byRarity('legendary')) expect(count(slug), slug).toMatchObject({ gold: 1, glint: 1, star: 1, band: 0 });
    });

    it('gives Epic one gem and no gold, no star and no trim band', () => {
      expect(byRarity('epic')).toEqual(['geode-lamp', 'crystal-tail-cuff']);
      for (const slug of byRarity('epic')) expect(count(slug), slug).toMatchObject({ gold: 0, glint: 1, star: 0, band: 0 });
    });

    it('gives Rare its one yellow trim band and no gem, gold or star', () => {
      expect(byRarity('rare')).toEqual(['fossil-ammonite', 'crystal-wind-chime', 'explorer-vest']);
      for (const slug of byRarity('rare')) expect(count(slug), slug).toMatchObject({ gold: 0, glint: 0, star: 0, band: 1 });
    });

    it('gives Common one flat colour and one shine: no trim band, no gem, no gold and no star', () => {
      expect(byRarity('common')).toEqual(['pebble-stack', 'glow-moss-ball', 'miners-headlamp', 'crystal-pendant']);
      for (const slug of byRarity('common')) expect(count(slug), slug).toMatchObject({ gold: 0, band: 0, glint: 0, star: 0, shine: 1 });
    });

    it('gives each item exactly one shine', () => {
      for (const slug of SPRING_CAVE_ITEM_SLUGS) expect(count(slug).shine, slug).toBe(1);
    });
  });

  it('draws the Crystal pendant chain as a tube of colour 3.2 with 2.4 ink, the Shell necklace\'s construction', () => {
    const strokes = record((ctx) => paintTreasureIcon(ctx, 'crystal-pendant', 80)).ops.filter((op) => op.op === 'stroke');
    const tube = strokes.filter((op) => op.strokeStyle === CAVE_CRYSTAL_FILL);
    expect(tube).toHaveLength(1);
    expect(tube[0].lineWidth).toBe(3.2);
    expect(strokes.some((op) => op.strokeStyle === INK && op.lineWidth === 3.2 + 2 * 2.4)).toBe(true);
    // The unfound silhouette turns the cord into the flat fill.
    const flat = record((ctx) => paintTreasureSilhouette(ctx, 'crystal-pendant', 80)).ops.filter((op) => op.op === 'stroke');
    expect(flat.some((op) => op.strokeStyle === TREASURE_SILHOUETTE_FILL && op.lineWidth === 3.2)).toBe(true);
  });

  it('gives the Geode lamp its glowing cavity and lilac crystals inside the rock, and keeps them out of the silhouette', () => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, 'geode-lamp', 80));
    for (const colour of [GEODE_CAVITY, GEODE_CRYSTAL]) expect(styles, colour).toContain(colour.toLowerCase());
    const flat = hexStyles((ctx) => paintTreasureSilhouette(ctx, 'geode-lamp', 80));
    for (const colour of [GEODE_CAVITY, GEODE_CRYSTAL]) expect(flat, colour).not.toContain(colour.toLowerCase());
  });

  it('draws the Crystal arch as one outline with a hole, the opening, so the star shows through it', () => {
    const outline = record((ctx) => paintTreasureIcon(ctx, 'crystal-arch', 80)).ops.find(
      (op) => op.op === 'fill' && op.fillStyle === CAVE_CRYSTAL_FILL,
    ) as Op;
    const nested = (outline.args[0] as unknown[][])[0][1] as unknown[][];
    expect(nested.filter((c) => c[0] === 'closePath')).toHaveLength(2);
    // Two sub-paths, the outer arch and the opening, wound opposite ways so a non-zero fill leaves the opening empty.
    const starts = nested.flatMap((c, i) => (c[0] === 'moveTo' ? [i] : []));
    expect(starts).toHaveLength(2);
    const area = (cmds: unknown[][]): number => {
      const points: [number, number][] = [];
      pathPoints(cmds, IDENTITY, points);
      return points.reduce((sum, [x, y], i) => {
        const [nx, ny] = points[(i + 1) % points.length];
        return sum + (x * ny - nx * y);
      }, 0);
    };
    const outer = area(nested.slice(starts[0], starts[1]));
    const opening = area(nested.slice(starts[1]));
    expect(Math.sign(outer) * Math.sign(opening)).toBe(-1);
    expect(Math.abs(outer)).toBeGreaterThan(Math.abs(opening));
  });

  describe('Decorations in the Home Tank', () => {
    const FLOORS = ['pebble-stack', 'fossil-ammonite', 'geode-lamp', 'crystal-arch'] as const;
    const FLOATS = ['glow-moss-ball'] as const;
    const PX = 80;
    const bakeShipped = (): ReturnType<typeof bakeTankTextures> => {
      bakes.length = 0;
      return bakeTankTextures({} as never, 2, { decorationPx: PX, rand: () => 0.5 });
    };
    const bakeOf = (key: string): BakeCall => bakes.find((b) => b.key === key) as BakeCall;

    it('matches the catalogue placement kinds, rarities and standard widths', () => {
      const decorations = new Map(addedBy(SPRING_CAVE_TREASURES, 'spring-cave').filter(isDecoration).map((d) => [treasureSlug(d.id), d]));
      expect([...decorations.keys()]).toEqual([
        'pebble-stack',
        'glow-moss-ball',
        'fossil-ammonite',
        'crystal-wind-chime',
        'geode-lamp',
        'crystal-arch',
      ]);
      for (const slug of FLOORS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('floor');
      for (const slug of FLOATS) expect(placementKind(decorations.get(slug) as Decoration), slug).toBe('floating');
      expect(placementKind(decorations.get('crystal-wind-chime') as Decoration)).toBe('hanging');
      for (const decoration of decorations.values()) expect(decoration.width, decoration.id).toBeUndefined();
      const badges = TANK_DECORATION_BADGES as Readonly<Record<string, BadgeShape>>;
      expect(badges['pebble-stack']).toBe('circle');
      expect(badges['glow-moss-ball']).toBe('circle');
      expect(badges['fossil-ammonite']).toBe('diamond');
      expect(badges['crystal-wind-chime']).toBe('diamond');
      expect(badges['geode-lamp']).toBe('shield');
      expect(badges['crystal-arch']).toBe('star');
      for (const slug of FLOORS) expect(TANK_DECORATION_SHAPES[slug], slug).toEqual({ placement: 'floor' });
      expect(TANK_DECORATION_SHAPES['glow-moss-ball']).toEqual({ placement: 'floating' });
      expect(TANK_DECORATION_SHAPES['crystal-wind-chime']).toEqual({ placement: 'hanging' });
    });

    it.each([...FLOORS, ...FLOATS].flatMap((slug) => [48, 80].map((size) => [slug, size] as const)))(
      '%s at %i is anchored at its lowest fill edge, the icon box edge',
      (slug, size) => {
        const { box } = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(box.maxY, 1);
        expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(size / 2, 1);
      },
    );

    it('bakes a tank sprite and glow for each Floor and Floating one, anchored at the icon box edge', () => {
      const tex = bakeShipped();
      const iconFrame = treasureIconTextureSize(PX);
      for (const slug of [...FLOORS, ...FLOATS]) {
        expect(tex.decorations[slug].key).toBe(`tank-deco-${slug}-80`);
        expect(tex.decorationGlows[slug].key).toBe(`tank-deco-glow-${slug}-80`);
        const sprite = bakeOf(tex.decorations[slug].key);
        expect(sprite.size.originY - iconFrame.originY, slug).toBeCloseTo(40, 0);
        expect(sprite.size.originY - iconFrame.originY, slug).toBeCloseTo(decorationBaseOffset(slug, PX), 9);
        expect(sprite.size, slug).toEqual({ ...iconFrame, originY: iconFrame.originY + decorationBaseOffset(slug, PX) });
      }
    });

    it('sits the Glow moss ball across the waterline, 20 below the top of the 80 box', () => {
      const fills = record((ctx) => paintTreasureIcon(ctx, 'glow-moss-ball', PX)).ops.filter(
        (op) => op.op === 'fill' && op.fillStyle === MOSS_BALL_FILL,
      );
      expect(fills).toHaveLength(1);
      const points: [number, number][] = [];
      pathPoints(fills[0].args[0] as unknown[][], IDENTITY, points);
      const ys = points.map(([, y]) => y);
      expect(Math.min(...ys)).toBeLessThan(-20 - 8);
      expect(Math.max(...ys)).toBeGreaterThan(-20 + 8);
      expect(Math.min(...ys)).toBeGreaterThan(-40);
    });

    it('bakes the Crystal wind chime from its icon at 80, hanging from its top-centre hook', () => {
      const tex = bakeShipped();
      const iconFrame = treasureIconTextureSize(PX);
      const sprite = bakeOf(tex.decorations['crystal-wind-chime'].key);
      expect(sprite.size).toEqual({ ...iconFrame, originY: iconFrame.originY - PX / 2 });
      expect(sprite.size.originY).toBe(1);
      expect(sprite.size.h).toBe(82);
      expect(sprite.size.originX * 2).toBe(sprite.size.w);
      const before = (ctx: CanvasRenderingContext2D): void => {
        ctx.translate(0, PX / 2);
        paintTreasureIcon(ctx, 'crystal-wind-chime', PX);
      };
      expect(callLogDigest(sprite.paint)).toBe(callLogDigest(before));
      // The hook ring's ink touches the hook point, and the longest rod reaches the base point one footprint below.
      const { box: reach } = inkReach((ctx) => paintTreasureIcon(ctx, 'crystal-wind-chime', PX));
      expect(reach.minY + PX / 2).toBeGreaterThanOrEqual(-0.05);
      expect(reach.minY + PX / 2).toBeLessThan(1);
      expect(reach.maxY + PX / 2).toBeGreaterThan(PX - 1.5);
      expect(reach.maxY + PX / 2).toBeLessThanOrEqual(PX + REACH_TOLERANCE);
    });

    it('centres the Crystal wind chime glow on its box, with the sprite anchor at the hook', () => {
      const tex = bakeShipped();
      const glow = bakeOf(tex.decorationGlows['crystal-wind-chime'].key);
      const frame = rarityGlowTextureSize(96);
      expect(glow.size).toEqual({ ...frame, originY: frame.originY - PX / 2 });
      const rec = record(glow.paint);
      expect(rec.calls[0]).toEqual(['translate', [0, PX / 2]]);
      expect(parseRgba(rec.gradients[0].stops[0][1]).rgb).toEqual(channelsOf(BADGE_FILL.diamond));
    });

    it('glows every Area 6 Decoration in its catalogue rarity: Common, Rare, Epic and Legendary', () => {
      const tex = bakeShipped();
      const rarityColour = { common: 'circle', rare: 'diamond', epic: 'shield', legendary: 'star' } as const;
      for (const decoration of addedBy(SPRING_CAVE_TREASURES, 'spring-cave').filter(isDecoration)) {
        const slug = treasureSlug(decoration.id) as TankDecorationSlug;
        const glow = bakeOf(tex.decorationGlows[slug].key);
        const rec = record(glow.paint);
        expect(parseRgba(rec.gradients[0].stops[0][1]).rgb, decoration.id).toEqual(channelsOf(BADGE_FILL[rarityColour[decoration.rarity]]));
      }
    });
  });
});

describe('Moonstone Dream swatch (issue #77)', () => {
  it('lists Moonstone as the seventeenth and last Dream swatch, with its Paint shell icon slug last', () => {
    expect(DREAM_SWATCH_IDS).toHaveLength(17);
    expect(DREAM_SWATCH_IDS.at(-1)).toBe('moonstone');
    expect(TREASURE_ICON_SLUGS.at(-1)).toBe('paint-shell-moonstone');
  });

  it('draws the Moonstone swatch and Paint shell icon in the Moonstone body colour, a light plain tile, baked', () => {
    expect(DREAM_SWATCH.moonstone).toEqual({ body: '#f5f7fc', pattern: 'plain', marks: [], dark: false });
    expect(contrastRatio(DREAM_SWATCH.moonstone.body, INK)).toBeGreaterThanOrEqual(9);
    expect(hexStyles((ctx) => paintTreasureIcon(ctx, 'paint-shell-moonstone', 48))).toContain('#f5f7fc');
    expect(hexStyles((ctx) => paintDreamSwatch(ctx, 'moonstone', 32))).toContain('#f5f7fc');
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    expect(tex.swatches.moonstone.key).toBe('dream-swatch-moonstone-32');
  });
});

describe('Treasure glow depth', () => {
  it('sits above the Home Spot ring and below the treasure, on its own value', () => {
    expect(DEPTH.treasureGlow).toBe(27);
    expect(DEPTH.treasureGlow).toBeGreaterThan(DEPTH.homeRing);
    expect(DEPTH.treasureGlow).toBeLessThan(DEPTH.treasure);
    const shared = Object.entries(DEPTH).filter(([key, value]) => value === DEPTH.treasureGlow && key !== 'treasureGlow');
    expect(shared).toEqual([]);
  });
});
