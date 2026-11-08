/**
 * Open lake Area 13 treasure art (issue #215), headless: the eight trench Decoration icons and their Home Tank
 * sprites and glows, and the six trench Wearable icons. The painters run
 * against a recording context and a stub Path2D, as in treasureArt.test.ts: every fill and stroke is kept with the
 * style, width and alpha it was painted under. The bake glue runs against a stubbed `bake`.
 */
import { describe, expect, it, vi } from 'vitest';
import { badgeShape } from '../logic/hints';
import { ALL_TREASURES, OPEN_LAKE_2_TREASURES, isDecoration, placementKind, treasureSlug, type Treasure } from '../logic/catalogue';
import { rarityGlowTextureSize } from './drawRarityGlow';
import {
  DREAM_SWATCH_IDS,
  GOGGLES_LENS,
  TREASURE_ICON_SLUGS,
  decorationBaseOffset,
  paintTreasureIcon,
  paintTreasureSilhouette,
  treasureIconTextureSize,
  type TreasureIconSlug,
} from './drawTreasures';
import { EYE, INK } from './palette';
import { TAU, type TexSize } from './canvasKit';
import {
  TANK_DECORATION_BADGES,
  TANK_DECORATION_SHAPES,
  TANK_DECORATION_SLUGS,
  bakeTankTextures,
  type TankDecorationSlug,
} from './tankTextures';
import { bakeTreasureTextures, treasureSilhouetteKey } from './treasureTextures';
import {
  BADGE_FILL,
  BAILING_BUCKET_FILL,
  BOAT_TRIM,
  CAPTAINS_HAT_FILL,
  CASTLE_GEM,
  DIVING_BELL_BASE,
  DIVING_BELL_FILL,
  DIVING_BELL_RING,
  DIVING_GOGGLES_FRAME,
  DIVING_SUIT_FILL,
  FADING_GARDEN_BASE,
  FADING_GARDEN_BULB,
  FADING_GARDEN_CAP,
  FADING_GARDEN_STALK,
  FESTIVAL_PLINTH,
  FIREFLY_BULB,
  FIREFLY_HOOK,
  FIREFLY_JAR_GLASS,
  GEM_GLINT,
  GLASSES_GEM,
  GLOW_CORE,
  GLOW_FLOWER_BULB,
  GLOW_FLOWER_CAP,
  GLOW_FLOWER_PETAL,
  GOLD_TRIM,
  LAKE_BUOY_FILL,
  LAKE_BUOY_TOP,
  LANTERN_CHARM_FILL,
  LANTERN_GLASS,
  LIGHTHOUSE_CAP,
  LIGHTHOUSE_LAMP,
  LIGHTHOUSE_ROCK,
  LIGHTHOUSE_TOWER,
  MINI_SUBMARINE_FILL,
  MUD_TURTLE_SHELL,
  MUD_TURTLE_SKIN,
  PAPER_BOAT_FILL,
  PLANT_LEAF,
  PYRAMID_GEM,
  RAINCLOUD_DROP,
  RAINCLOUD_FILL,
  RAINCLOUD_HOOK,
  RAINCOAT_FILL,
  STONE_STACK_FILL,
  TRAJINERA_ARCH,
  TREASURE_SILHOUETTE_FILL,
  TREASURE_STAR,
  TURTLE_SHELL_FILL,
  TURTLE_SOCKS_FILL,
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

/** The five Decorations the open lake Area 12 added (issue #214, ND-3), in catalogue order. */

/** The eight Decorations the open lake Area 13 added (issue #215), in catalogue order. */
const TRENCH_DECORATION_SLUGS = [
  'stone-stack',
  'lake-buoy',
  'raincloud-mobile',
  'little-lighthouse',
  'glow-flower-lamp',
  'diving-bell',
  'little-mud-turtle',
  'fading-light-garden',
] as const;
/** The six Wearables the open lake Area 13 added (issue #215), in catalogue order. */
const TRENCH_WEARABLE_SLUGS = [
  'turtle-socks',
  'diving-goggles',
  'turtle-shell-backpack',
  'lantern-tail-charm',
  'mini-submarine',
  'diving-suit',
] as const;
/** All fourteen Area 13 items in catalogue order, the Decorations and Wearables interleaved by rarity as the catalogue lists them. */
const TRENCH_ITEM_SLUGS = [
  'stone-stack',
  'lake-buoy',
  'raincloud-mobile',
  'turtle-socks',
  'little-lighthouse',
  'glow-flower-lamp',
  'diving-bell',
  'diving-goggles',
  'turtle-shell-backpack',
  'lantern-tail-charm',
  'little-mud-turtle',
  'mini-submarine',
  'fading-light-garden',
  'diving-suit',
] as const;
const SIZES = [28, 32, 48, 80] as const;
const REACH_TOLERANCE = 0.05;
const SHINE = 'rgba(255,255,255,0.8)';
const PX = 80;

/**
 * The outer fills each Decoration may paint (exported by treasurePalette.ts), by item. The yellow trim band, the gold band,
 * ink, the bead eye, the gem and its glint, the star, the porthole glass, the soft ink bands, specks and net, the soft white
 * glow hearts (rgba, so never a hex fill) and the shine are inside the silhouette, so free.
 */
const OUTER_FILLS: Readonly<Record<string, readonly string[]>> = {
  'stone-stack': [STONE_STACK_FILL],
  'lake-buoy': [LAKE_BUOY_FILL, LAKE_BUOY_TOP, FIREFLY_HOOK],
  'raincloud-mobile': [RAINCLOUD_FILL, RAINCLOUD_DROP, RAINCLOUD_HOOK],
  'little-lighthouse': [LIGHTHOUSE_TOWER, LIGHTHOUSE_LAMP, LIGHTHOUSE_CAP, LIGHTHOUSE_ROCK],
  'glow-flower-lamp': [GLOW_FLOWER_PETAL, GLOW_FLOWER_BULB, GLOW_FLOWER_CAP],
  'diving-bell': [DIVING_BELL_FILL, DIVING_BELL_RING, DIVING_BELL_BASE],
  'little-mud-turtle': [MUD_TURTLE_SHELL, MUD_TURTLE_SKIN],
  'fading-light-garden': [FADING_GARDEN_BULB, FADING_GARDEN_STALK, FADING_GARDEN_CAP, FADING_GARDEN_BASE],
};
/** The colours each Decoration may paint inside its silhouette besides ink, by item (all hex; the rgba glow and shine are not hex). */
const FREE_STYLES: Readonly<Record<string, readonly string[]>> = {
  'stone-stack': [],
  'lake-buoy': [],
  'raincloud-mobile': [],
  'little-lighthouse': [BOAT_TRIM],
  'glow-flower-lamp': [BOAT_TRIM],
  'diving-bell': [BOAT_TRIM, FIREFLY_JAR_GLASS],
  'little-mud-turtle': [EYE, CASTLE_GEM, GEM_GLINT],
  'fading-light-garden': [GOLD_TRIM, PYRAMID_GEM, GEM_GLINT, TREASURE_STAR],
};
/** The catalogue rarity of each Decoration, which the icon's rarity look ladder (guide 6i) must follow. */
const RARITY_OF: Readonly<Record<string, Treasure['rarity']>> = {
  'stone-stack': 'common',
  'lake-buoy': 'common',
  'raincloud-mobile': 'common',
  'little-lighthouse': 'rare',
  'glow-flower-lamp': 'rare',
  'diving-bell': 'rare',
  'little-mud-turtle': 'epic',
  'fading-light-garden': 'legendary',
};
/** The ink widths of the shipped icons that an Area 13 painter may use: item 2.8, details 1.6, trim lines 1.2, and the merged `blob` ink 5.6. */
const ALLOWED_INK = new Set([2.8, 1.6, 1.2, 5.6]);
/** The one Decoration drawn as a merged `blob` silhouette (its cloud): its outer ink is 5.6 wide with the fills over its inner half. */
const MERGED_SLUGS: readonly TreasureIconSlug[] = ['raincloud-mobile'];

/**
 * Call-log digests of the eight Area 13 Decoration icons (issue #215), in catalogue order, per size, pinned when they were
 * authored. Re-pin these, and only these, when the Area 13 Decoration art is retuned on purpose.
 */
const TRENCH_DECORATION_DIGESTS: Readonly<Record<number, string>> = {
  28: 'b430d8aa30cf9c06:175',
  32: '24fa2bd298d59f8e:175',
  48: '398f3fa2e6dff0c6:175',
  80: 'd631b97ffb92bc23:175',
};
/** The same digests for each Decoration alone at 80, pinned when they were authored. */
const TRENCH_DECORATION_DIGESTS_80: Readonly<Record<string, string>> = {
  'stone-stack': '17fb61873308f16b:21',
  'lake-buoy': '95a8700e14ef7b6a:21',
  'raincloud-mobile': '5542e68a306d500e:21',
  'little-lighthouse': 'a717aed9e81e3d4d:21',
  'glow-flower-lamp': '96302e0cc193a638:21',
  'diving-bell': 'ede29e82efe84306:21',
  'little-mud-turtle': '2469d73ef9d8567a:21',
  'fading-light-garden': '350f8e521340984e:21',
};

/**
 * Call-log digests of the six Area 13 Wearable icons (issue #215), in catalogue order, per size, pinned when they were
 * authored. Re-pin these, and only these, when the Area 13 Wearable art is retuned on purpose.
 */
const TRENCH_WEARABLE_DIGESTS: Readonly<Record<number, string>> = {
  28: '77c576e4b74cab40:131',
  32: '9855d6db2b688caf:131',
  48: '451b612b465a03a7:131',
  80: '15c17f98d495b784:131',
};
/** The same digests for each Wearable alone at 80, pinned when they were authored. */
const TRENCH_WEARABLE_DIGESTS_80: Readonly<Record<string, string>> = {
  'turtle-socks': 'c4b721cbe77ac5ef:21',
  'diving-goggles': 'b326673ca40b7348:21',
  'turtle-shell-backpack': '5ed12e283115626c:21',
  'lantern-tail-charm': '9357966316d9d23f:21',
  'mini-submarine': '9339e3738a4ccc97:21',
  'diving-suit': '015687c8ea1ece14:21',
};

// ---------------------------------------------------------------------------
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

/** Hue of a #rrggbb colour in degrees, 0 to 360. */
function hueOf(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const sector = max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return sector * 60;
}

/** HSV saturation of a #rrggbb colour, 0 to 1. */
function saturationOf(hex: string): number {
  const channels = channelsOf(hex).map((v) => v / 255);
  const max = Math.max(...channels);
  return max === 0 ? 0 : (max - Math.min(...channels)) / max;
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
  readonly ops: Op[];
  readonly calls: [string, unknown[]][];
  readonly gradients: Gradient[];
}

/** A context that records every draw call, path call and gradient. Supports save and restore. */
function recordingContext(): Recording & { readonly ctx: CanvasRenderingContext2D } {
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

/** Every hex colour an icon paints with, fills and strokes. */
function hexStyles(paint: (ctx: CanvasRenderingContext2D) => void): Set<string> {
  const styles = new Set<string>();
  for (const op of record(paint).ops) {
    const style = op.op === 'fill' || op.op === 'fillRect' ? op.fillStyle : op.strokeStyle;
    if (typeof style === 'string' && /^#[0-9a-f]{6}$/i.test(style)) styles.add(style.toLowerCase());
  }
  return styles;
}

// ---------------------------------------------------------------------------
// Ink extents: the box every fill and stroke of an icon reaches, in anchor space
// ---------------------------------------------------------------------------

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

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

/** The tangent arc of a rounded `arcTo` corner from `cur`, sampled into `out` through `apply`; returns the arc's end. */
function arcToPoints(
  cur: readonly [number, number],
  [x1, y1, x2, y2, r]: readonly number[],
  apply: (x: number, y: number) => [number, number],
  out: [number, number][],
): [number, number] {
  const v1 = [cur[0] - x1, cur[1] - y1];
  const v2 = [x2 - x1, y2 - y1];
  const l1 = Math.hypot(v1[0], v1[1]);
  const l2 = Math.hypot(v2[0], v2[1]);
  if (r === 0 || l1 === 0 || l2 === 0) {
    out.push(apply(x1, y1));
    return [x1, y1];
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
  return t2;
}

/**
 * The points a recorded path reaches, through `m`: moves, lines, `arcTo` corners, and sampled curves, arcs and
 * ellipses. Nested `addPath` is followed.
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
      cur = arcToPoints(cur, a, apply, out);
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

/**
 * Run `paint` and return the box its fills and strokes reach, in anchor space. Everything painted under a `clip`
 * stays inside the silhouette that clipped it, so it is skipped. Only Path2D draws count.
 */
function inkReach(paint: (ctx: CanvasRenderingContext2D) => void): Box {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let lineWidth = 1;
  let clipped = false;
  const stack: { lineWidth: number; clipped: boolean }[] = [];
  const add = (path: unknown, pad: number): void => {
    if (clipped || !(path instanceof LogPath)) return;
    const points: [number, number][] = [];
    pathPoints(path.cmds as unknown[][], IDENTITY, points);
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
  return box;
}

/** The box of a texture frame in anchor space. */
function frameBox(size: TexSize): Box {
  return { minX: -size.originX, minY: -size.originY, maxX: size.w - size.originX, maxY: size.h - size.originY };
}

// ---------------------------------------------------------------------------
// Per-icon helpers
// ---------------------------------------------------------------------------

/** Counts of shines, gold trim bands, yellow trim bands, gem glints and stars painted by an icon at 80. */
function countDetails(slug: TreasureIconSlug): { shine: number; gold: number; band: number; glint: number; star: number } {
  const ops = record((ctx) => paintTreasureIcon(ctx, slug, PX)).ops;
  const whites = ops.filter((op) => op.op === 'fill' && op.fillStyle === GEM_GLINT);
  const uses = (op: Op, command: string): boolean => JSON.stringify(op.args[0]).includes(`"${command}"`);
  return {
    shine: ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length,
    gold: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === GOLD_TRIM).length,
    band: ops.filter((op) => op.op === 'fillRect' && op.fillStyle === BOAT_TRIM).length,
    glint: whites.filter((op) => uses(op, 'ellipse')).length,
    star: whites.filter((op) => uses(op, 'arcTo')).length,
  };
}

/** The fills in `colour` an icon paints at 80. */
function fillsOf(slug: TreasureIconSlug, colour: string, paint: typeof paintTreasureIcon = paintTreasureIcon): Op[] {
  return record((ctx) => paint(ctx, slug, PX)).ops.filter((op) => op.op === 'fill' && op.fillStyle === colour);
}

/** The ink strokes of `width` an icon paints at 80. */
function inkLines(slug: TreasureIconSlug, width: number, paint: typeof paintTreasureIcon = paintTreasureIcon): Op[] {
  return record((ctx) => paint(ctx, slug, PX)).ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === width);
}

/** The fills in ink at alpha 0.30 an icon paints at 80: its soft stripes, waves and openings. */
function softInk(slug: TreasureIconSlug, paint: typeof paintTreasureIcon = paintTreasureIcon): Op[] {
  return record((ctx) => paint(ctx, slug, PX)).ops.filter(
    (op) => (op.op === 'fill' || op.op === 'fillRect') && op.fillStyle === INK && op.globalAlpha === 0.3,
  );
}

/** Every outer fill of an icon at 80: the fills in its own outer colours. */
function outerFillsOf(slug: TreasureIconSlug): Op[] {
  return record((ctx) => paintTreasureIcon(ctx, slug, PX)).ops.filter(
    (op) => op.op === 'fill' && (OUTER_FILLS[slug] ?? WEARABLE_OUTER_FILLS[slug]).includes(op.fillStyle as string),
  );
}

function pointsOf(op: Op): [number, number][] {
  const points: [number, number][] = [];
  pathPoints(op.args[0] as unknown[][], IDENTITY, points);
  return points;
}
const lowestOf = (op: Op): number => Math.max(...pointsOf(op).map(([, y]) => y));
const highestOf = (op: Op): number => Math.min(...pointsOf(op).map(([, y]) => y));
const rightmostOf = (op: Op): number => Math.max(...pointsOf(op).map(([x]) => x));
const centreXOf = (op: Op): number => {
  const xs = pointsOf(op).map(([x]) => x);
  return (Math.min(...xs) + Math.max(...xs)) / 2;
};
/** How many times `command` appears in a recorded path, nested `addPath` included. */
const commandsIn = (op: Op, command: string): number => JSON.stringify(op.args[0]).split(`"${command}"`).length - 1;
/** The corner radius of every `arcTo` in a recorded path, nested `addPath` followed. */
function cornerRadii(cmds: readonly unknown[][]): number[] {
  return cmds.flatMap((cmd) => {
    if (cmd[0] === 'arcTo') return [cmd[5] as number];
    if (cmd[0] === 'addPath') return cornerRadii(cmd[1] as unknown[][]);
    return [];
  });
}
/** Digest of the normal icons of `slugs` at `size`, in order. */
function iconDigest(slugs: readonly TreasureIconSlug[], size: number): string {
  return digest(slugs.map((slug) => callLogDigest((ctx) => paintTreasureIcon(ctx, slug, size))).join('|'));
}
const isReddish = (hex: string): boolean => saturationOf(hex) > 0.15 && (hueOf(hex) < 15 || hueOf(hex) > 345);

const centreYOf = (op: Op): number => {
  const ys = pointsOf(op).map(([, y]) => y);
  return (Math.min(...ys) + Math.max(...ys)) / 2;
};
const widthOf = (op: Op): number => {
  const xs = pointsOf(op).map(([x]) => x);
  return Math.max(...xs) - Math.min(...xs);
};
/** The highest and lowest outer fill edges of an icon at 80. */
const outerTop = (slug: TreasureIconSlug): number => Math.min(...outerFillsOf(slug).map(highestOf));
const outerBottom = (slug: TreasureIconSlug): number => Math.max(...outerFillsOf(slug).map(lowestOf));
/** The fills of an icon painted in the soft white heart of a bulb or lamp. */
const glowHearts = (slug: TreasureIconSlug, paint: typeof paintTreasureIcon = paintTreasureIcon): Op[] =>
  record((ctx) => paint(ctx, slug, PX)).ops.filter((op) => op.op === 'fill' && op.fillStyle === GLOW_CORE);

describe('Open lake Area 13 Decoration icons (issue #215)', () => {
  it('lists the eight Area 13 Decorations after the Area 12 ones, in catalogue order, ahead of the Paint shells', () => {
    const added = OPEN_LAKE_2_TREASURES.filter(isDecoration).map((decoration) => treasureSlug(decoration.id));
    expect(added).toEqual([...TRENCH_DECORATION_SLUGS]);
    expect(TREASURE_ICON_SLUGS.indexOf('pelican-slippers')).toBe(129);
    // The fourteen items sit at 130 to 143 in catalogue order (Decorations and Wearables interleaved by rarity, as Area 12
    // did); only the two Paint shells of the catalogue, Pitch black and Trench shine, are not among them.
    const items = OPEN_LAKE_2_TREASURES.filter((treasure) => treasure.category !== 'paintShell').map((treasure) => treasureSlug(treasure.id));
    expect(items).toEqual([...TRENCH_ITEM_SLUGS]);
    expect(TREASURE_ICON_SLUGS.slice(130, 144)).toEqual(items);
    expect(TREASURE_ICON_SLUGS.slice(144)).toEqual(DREAM_SWATCH_IDS.map((id) => `paint-shell-${id}`));
    expect(TREASURE_ICON_SLUGS).toHaveLength(179);
    expect(TREASURE_ICON_SLUGS.slice(-2)).toEqual(['paint-shell-pitch-black', 'paint-shell-trench-shine']);
    expect(new Set(TREASURE_ICON_SLUGS).size).toBe(TREASURE_ICON_SLUGS.length);
    // Every Area 13 Decoration has an icon slug of its own, and no slug is in the list twice.
    const iconSlugs = new Set<string>(TREASURE_ICON_SLUGS);
    for (const slug of TRENCH_DECORATION_SLUGS) expect(iconSlugs.has(slug), slug).toBe(true);
    expect(new Set(ALL_TREASURES.map((treasure) => treasureSlug(treasure.id))).size).toBe(ALL_TREASURES.length);
  });

  it('bakes an icon at every baked size and a silhouette for all eight Area 13 Decorations', () => {
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    for (const slug of TRENCH_DECORATION_SLUGS) {
      for (const size of [28, 32, 48] as const) expect(tex.icons[size][slug].key, `${slug} ${size}`).toBe(`treasure-${slug}-${size}`);
      expect(tex.silhouettes[slug].key, slug).toBe(treasureSilhouetteKey(slug));
      expect(bakes.some((b) => b.key === treasureSilhouetteKey(slug)), slug).toBe(true);
    }
    expect(new Set(bakes.map((b) => b.key)).size).toBe(bakes.length);
  });

  it('follows the catalogue rarity of each Decoration: three Common, three Rare, the Mud turtle Epic, the Fading light garden Legendary', () => {
    const catalogue = new Map(OPEN_LAKE_2_TREASURES.map((treasure) => [treasureSlug(treasure.id), treasure.rarity]));
    for (const slug of TRENCH_DECORATION_SLUGS) expect(catalogue.get(slug), slug).toBe(RARITY_OF[slug]);
  });

  it('keeps every Area 13 Decoration outer fill at 9:1 or more with ink, pale, none a rarity badge fill and none red', () => {
    const fills = [...new Set(Object.values(OUTER_FILLS).flat())];
    for (const fill of fills) {
      expect(fill, fill).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
      expect(relativeLuminance(fill), fill).toBeGreaterThanOrEqual(0.607);
      expect(isReddish(fill), `${fill} is not red`).toBe(false);
    }
    expect(fills).toHaveLength(new Set(fills.map((c) => c.toLowerCase())).size);
    // Five fills are new to the treasure palette; each is pale and its own.
    const added: readonly (readonly [string, string, number])[] = [
      [STONE_STACK_FILL, '#e4ddd0', 10.66],
      [GLOW_FLOWER_PETAL, '#e0d0ff', 10.03],
      [DIVING_BELL_FILL, '#bdeccf', 11.01],
      [MUD_TURTLE_SHELL, '#dcd6a0', 9.71],
      [MUD_TURTLE_SKIN, '#cfe6a4', 10.63],
    ];
    for (const [fill, hex, ratio] of added) {
      expect(fill).toBe(hex);
      expect(contrastRatio(fill, INK), hex).toBeCloseTo(ratio, 1);
    }
    expect(new Set(added.map(([fill]) => fill)).size).toBe(added.length);
  });

  it('shares the shipped colours where the Area 13 Decoration fills alias them', () => {
    expect(LAKE_BUOY_FILL).toBe(RAINCOAT_FILL);
    expect(LAKE_BUOY_TOP).toBe(FIREFLY_HOOK);
    expect(RAINCLOUD_FILL).toBe(BAILING_BUCKET_FILL);
    expect(RAINCLOUD_DROP).toBe(PAPER_BOAT_FILL);
    expect(RAINCLOUD_HOOK).toBe(FIREFLY_HOOK);
    expect(LIGHTHOUSE_TOWER).toBe(CAPTAINS_HAT_FILL);
    expect(LIGHTHOUSE_LAMP).toBe(LANTERN_GLASS);
    expect(LIGHTHOUSE_CAP).toBe(TRAJINERA_ARCH);
    expect(LIGHTHOUSE_ROCK).toBe(FESTIVAL_PLINTH);
    expect(GLOW_FLOWER_BULB).toBe(FIREFLY_BULB);
    expect(GLOW_FLOWER_CAP).toBe(FIREFLY_HOOK);
    expect(DIVING_BELL_RING).toBe(FIREFLY_HOOK);
    expect(DIVING_BELL_BASE).toBe(FESTIVAL_PLINTH);
    expect(FADING_GARDEN_BULB).toBe(FIREFLY_BULB);
    expect(FADING_GARDEN_STALK).toBe(PLANT_LEAF);
    expect(FADING_GARDEN_CAP).toBe(FIREFLY_HOOK);
    expect(FADING_GARDEN_BASE).toBe(FESTIVAL_PLINTH);
  });

  it('keeps the soft glow heart a still, translucent white that is neither the shine nor a gem glint', () => {
    const { rgb, alpha } = parseRgba(GLOW_CORE);
    expect(rgb).toEqual([255, 255, 255]);
    expect(alpha).toBeGreaterThan(0.5);
    expect(alpha).toBeLessThan(1);
    expect(GLOW_CORE).not.toBe(SHINE);
    expect(GLOW_CORE).not.toBe(GEM_GLINT);
  });

  it.each(TRENCH_DECORATION_SLUGS.map((slug) => [slug] as const))('%s paints its own Area 13 fills and no other outer colour', (slug) => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48));
    const own = OUTER_FILLS[slug].map((c) => c.toLowerCase());
    for (const fill of own) expect(styles, `${slug} uses ${fill}`).toContain(fill);
    const free = new Set([INK, ...FREE_STYLES[slug]].map((c) => c.toLowerCase()));
    for (const style of styles) {
      if (free.has(style)) continue;
      expect(own, `${slug} paints only its own fills, ${style} is not one`).toContain(style);
    }
  });

  it.each(TRENCH_DECORATION_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i keeps its frame: the ink inside the icon box and the texture frame, reaching nearly the whole longest side',
    (slug, size) => {
      const half = size / 2;
      const frame = frameBox(treasureIconTextureSize(size));
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const box = inkReach((ctx) => paint(ctx, slug, size));
        expect(box.minX, `${slug} left`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minX));
        expect(box.maxX, `${slug} right`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxX));
        expect(box.minY, `${slug} top`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minY));
        expect(box.maxY, `${slug} bottom`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxY));
      }
      const box = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
      expect(Math.max(box.maxX - box.minX, box.maxY - box.minY), `${slug} longest side`).toBeGreaterThanOrEqual(size - 2);
    },
  );

  it.each(TRENCH_DECORATION_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its ink outline at the shipped widths, and keeps the outer ink in the unfound silhouette',
    (slug, size) => {
      const ink = record((ctx) => paintTreasureIcon(ctx, slug, size)).ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK);
      const widths = new Set(ink.map((op) => op.lineWidth));
      const merged = MERGED_SLUGS.includes(slug);
      expect(widths.has(2.8), `${slug} has its 2.8 item outline`).toBe(true);
      expect(widths.has(5.6), `${slug} merged ink`).toBe(merged);
      for (const width of widths) expect(ALLOWED_INK, `${slug} ink ${width}`).toContain(width);
      for (const outline of merged ? [2.8, 5.6] : [2.8]) {
        const flat = record((ctx) => paintTreasureSilhouette(ctx, slug, size)).ops.filter(
          (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === outline,
        );
        expect(flat.length, `${slug} silhouette outer ink ${outline}`).toBeGreaterThan(0);
      }
    },
  );

  it.each(TRENCH_DECORATION_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its one white shine, and none in the unfound silhouette',
    (slug, size) => {
      const shines = (paint: typeof paintTreasureIcon): number =>
        record((ctx) => paint(ctx, slug, size)).ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length;
      expect(shines(paintTreasureIcon), slug).toBe(1);
      expect(shines(paintTreasureSilhouette), `${slug} silhouette`).toBe(0);
    },
  );

  it('draws every Area 13 Decoration unfound silhouette in the flat fill alone, so no icon is told apart by colour', () => {
    for (const slug of TRENCH_DECORATION_SLUGS) {
      const fills = hexStyles((ctx) => paintTreasureSilhouette(ctx, slug, 32));
      expect([...fills].sort(), slug).toEqual([INK, TREASURE_SILHOUETTE_FILL].map((c) => c.toLowerCase()).sort());
      expect(glowHearts(slug, paintTreasureSilhouette), `${slug} silhouette has no glow`).toHaveLength(0);
    }
  });

  it('gives every Area 13 Decoration its own outline: no two silhouettes are the same drawing, nor any other item one', () => {
    const silhouetteOf = (slug: TreasureIconSlug): string => callLogDigest((ctx) => paintTreasureSilhouette(ctx, slug, 48));
    const own = TRENCH_DECORATION_SLUGS.map(silhouetteOf);
    expect(new Set(own).size).toBe(own.length);
    const others = new Set(
      TREASURE_ICON_SLUGS.filter((slug) => !slug.startsWith('paint-shell-') && !(TRENCH_DECORATION_SLUGS as readonly string[]).includes(slug)).map(
        silhouetteOf,
      ),
    );
    for (const [i, slugDigest] of own.entries()) expect(others.has(slugDigest), TRENCH_DECORATION_SLUGS[i]).toBe(false);
  });

  it('draws no letters, numbers or text on any Area 13 Decoration (ADR 0007): the lighthouse and the buoy carry none', () => {
    for (const slug of TRENCH_DECORATION_SLUGS) {
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const text = record((ctx) => paint(ctx, slug, PX)).ops.filter((op) => op.op === 'fillText' || op.op === 'strokeText');
        expect(text, slug).toHaveLength(0);
      }
    }
  });

  it('paints every glow as a still pale heart inside a bulb or lamp, never a ring or beam outside it', () => {
    // The lamp room, the flower bulb and the three garden bulbs each carry one heart; nothing else glows.
    const expected: Readonly<Record<string, number>> = { 'little-lighthouse': 1, 'glow-flower-lamp': 1, 'fading-light-garden': 3 };
    for (const slug of TRENCH_DECORATION_SLUGS) expect(glowHearts(slug), slug).toHaveLength(expected[slug] ?? 0);
    // Each heart is a round ellipse, translucent and painted at full global alpha (no pulse, no fade).
    for (const slug of ['little-lighthouse', 'glow-flower-lamp', 'fading-light-garden'] as const) {
      for (const heart of glowHearts(slug)) {
        expect(commandsIn(heart, 'ellipse'), slug).toBe(1);
        expect(heart.globalAlpha, slug).toBe(1);
      }
    }
  });

  describe('rarity ladder (guide 6i)', () => {
    const byRarity = (rarity: Treasure['rarity']): TreasureIconSlug[] => TRENCH_DECORATION_SLUGS.filter((slug) => RARITY_OF[slug] === rarity);

    it('gives Common no trim band, gem, gold or star, and one shine', () => {
      expect(byRarity('common')).toEqual(['stone-stack', 'lake-buoy', 'raincloud-mobile']);
      for (const slug of byRarity('common')) expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 0, band: 0, glint: 0, star: 0 });
    });

    it('gives Rare its one yellow trim band between two thin ink lines and no gem, gold or star', () => {
      expect(byRarity('rare')).toEqual(['little-lighthouse', 'glow-flower-lamp', 'diving-bell']);
      for (const slug of byRarity('rare')) {
        expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 0, band: 1, glint: 0, star: 0 });
        expect(inkLines(slug, 1.2).length, `${slug} trim band lines`).toBeGreaterThanOrEqual(2);
      }
    });

    it('gives Epic one gem with its glint and no trim band, gold or star', () => {
      expect(byRarity('epic')).toEqual(['little-mud-turtle']);
      for (const slug of byRarity('epic')) expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 0, band: 0, glint: 1, star: 0 });
    });

    it('gives Legendary one gold band, one gem with its glint and one 4-point star', () => {
      expect(byRarity('legendary')).toEqual(['fading-light-garden']);
      for (const slug of byRarity('legendary')) expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 1, band: 0, glint: 1, star: 1 });
    });
  });
});

describe('Open lake Area 13 Decoration construction (issue #215)', () => {
  it('draws the Stone stack as four flat rounded stones, each narrower and leaning the other way, under a small round pebble', () => {
    const stones = fillsOf('stone-stack', STONE_STACK_FILL);
    expect(stones).toHaveLength(5);
    const slabs = stones.slice(0, 4);
    const [pebble] = stones.slice(4);
    // Widest at the bottom, narrower each step up; every corner is rounded, never sharp.
    const widths = slabs.map(widthOf);
    for (let i = 1; i < widths.length; i++) expect(widths[i], `slab ${i}`).toBeLessThan(widths[i - 1]);
    for (const slab of slabs) {
      const radii = cornerRadii(slab.args[0] as unknown[][]);
      expect(radii).toHaveLength(4);
      for (const r of radii) expect(r).toBeGreaterThan(0);
    }
    // Each stone leans the other way from the one under it.
    const lean = slabs.map(centreXOf);
    expect(Math.sign(lean[1] - lean[0]) * Math.sign(lean[2] - lean[1])).toBe(-1);
    expect(Math.sign(lean[2] - lean[1]) * Math.sign(lean[3] - lean[2])).toBe(-1);
    // The round pebble tops the stack and is the highest fill; the bottom stone's foot is the lowest.
    expect(commandsIn(pebble, 'ellipse')).toBe(1);
    expect(highestOf(pebble)).toBeCloseTo(outerTop('stone-stack'), 6);
    expect(lowestOf(slabs[0])).toBeCloseTo(outerBottom('stone-stack'), 6);
    // Soft ink specks only (alpha 0.30): seven of them, none in the unfound silhouette, no trim lines.
    expect(softInk('stone-stack')).toHaveLength(7);
    expect(softInk('stone-stack', paintTreasureSilhouette)).toHaveLength(0);
    expect(inkLines('stone-stack', 1.2)).toHaveLength(0);
  });

  it('floats the Lake buoy as a rope-netted round float cut by the waterline, with a ring on top and a cord to a weight', () => {
    const [ball] = fillsOf('lake-buoy', LAKE_BUOY_FILL);
    expect(fillsOf('lake-buoy', LAKE_BUOY_FILL)).toHaveLength(1);
    expect(commandsIn(ball, 'ellipse')).toBe(1);
    // The waterline is 20 below the box centre at 80: the float stands in the air above it and sits in the water below it.
    expect(highestOf(ball)).toBeLessThan(-20 - 5);
    expect(lowestOf(ball)).toBeGreaterThan(-20 + 5);
    // The weight is drawn first and is the lowest fill edge; the ring on top is the highest, top-centre.
    const [weight, ring] = fillsOf('lake-buoy', LAKE_BUOY_TOP);
    expect(fillsOf('lake-buoy', LAKE_BUOY_TOP)).toHaveLength(2);
    expect(lowestOf(weight)).toBeCloseTo(outerBottom('lake-buoy'), 6);
    expect(highestOf(ring)).toBeCloseTo(outerTop('lake-buoy'), 6);
    expect(centreXOf(ring)).toBeCloseTo(0, 6);
    // One soft net of rope lines (1.2, alpha 0.30); the unfound silhouette drops it but keeps the cord (1.6).
    const net = record((ctx) => paintTreasureIcon(ctx, 'lake-buoy', PX)).ops.filter(
      (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 1.2,
    );
    expect(net).toHaveLength(1);
    expect(net[0].globalAlpha).toBe(0.3);
    expect(inkLines('lake-buoy', 1.2, paintTreasureSilhouette)).toHaveLength(0);
    expect(inkLines('lake-buoy', 1.6, paintTreasureSilhouette).length).toBeGreaterThanOrEqual(1);
  });

  it('draws the Raincloud mobile as one merged cloud over three rain drops of three heights, hung by a string from a top-centre hook', () => {
    // The cloud: a base and four round puffs, all ink first at twice the width, then every fill: no line across a joint.
    const cloud = fillsOf('raincloud-mobile', RAINCLOUD_FILL);
    expect(cloud).toHaveLength(5);
    expect(cloud.filter((op) => commandsIn(op, 'ellipse') === 1)).toHaveLength(4);
    const ops = record((ctx) => paintTreasureIcon(ctx, 'raincloud-mobile', PX)).ops;
    const merged = ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 5.6);
    expect(merged).toHaveLength(5);
    expect(ops.indexOf(merged[merged.length - 1])).toBeLessThan(ops.findIndex((op) => op.op === 'fill' && op.fillStyle === RAINCLOUD_FILL));
    // The drops: three, each a rounded curve with no straight edge, at three different feet; the middle one is the lowest fill.
    const drops = fillsOf('raincloud-mobile', RAINCLOUD_DROP);
    expect(drops).toHaveLength(3);
    for (const drop of drops) {
      expect(commandsIn(drop, 'bezierCurveTo')).toBe(4);
      expect(commandsIn(drop, 'lineTo')).toBe(0);
    }
    const feet = drops.map(lowestOf);
    expect(new Set(feet.map((y) => y.toFixed(3))).size).toBe(3);
    expect(feet[1]).toBeCloseTo(outerBottom('raincloud-mobile'), 6);
    expect(Math.max(...feet)).toBe(feet[1]);
    // The hook ring is top-centre and the highest fill, over the cloud.
    const [hook] = fillsOf('raincloud-mobile', RAINCLOUD_HOOK);
    expect(fillsOf('raincloud-mobile', RAINCLOUD_HOOK)).toHaveLength(1);
    expect(centreXOf(hook)).toBeCloseTo(0, 6);
    expect(highestOf(hook)).toBeCloseTo(outerTop('raincloud-mobile'), 6);
    for (const part of cloud) expect(highestOf(part)).toBeGreaterThan(highestOf(hook));
    // A soft underside on every cloud piece; the unfound silhouette drops it but keeps the strings (1.6).
    expect(softInk('raincloud-mobile')).toHaveLength(5);
    expect(softInk('raincloud-mobile', paintTreasureSilhouette)).toHaveLength(0);
    expect(inkLines('raincloud-mobile', 1.6, paintTreasureSilhouette).length).toBeGreaterThanOrEqual(1);
    // A calm rain: no lightning colour, no trim and no zigzag fill.
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, 'raincloud-mobile', 48));
    for (const bolt of [BOAT_TRIM, GOLD_TRIM, FIREFLY_BULB, LANTERN_GLASS]) expect(styles).not.toContain(bolt.toLowerCase());
    for (const op of [...cloud, ...drops]) expect(commandsIn(op, 'lineTo') <= 4).toBe(true);
  });

  it('draws the Little lighthouse as a tapering tower with the band, a gallery, a lamp room with one still heart and a dome roof, on a rock', () => {
    const [rock] = fillsOf('little-lighthouse', LIGHTHOUSE_ROCK);
    const [tower] = fillsOf('little-lighthouse', LIGHTHOUSE_TOWER);
    const [lamp] = fillsOf('little-lighthouse', LIGHTHOUSE_LAMP);
    const [gallery, roof] = fillsOf('little-lighthouse', LIGHTHOUSE_CAP);
    expect(fillsOf('little-lighthouse', LIGHTHOUSE_ROCK)).toHaveLength(1);
    expect(fillsOf('little-lighthouse', LIGHTHOUSE_TOWER)).toHaveLength(1);
    expect(fillsOf('little-lighthouse', LIGHTHOUSE_LAMP)).toHaveLength(1);
    expect(fillsOf('little-lighthouse', LIGHTHOUSE_CAP)).toHaveLength(2);
    // Stacked from the rock up: tower, gallery, lamp room, roof; the roof is the highest fill and the rock the lowest.
    expect(highestOf(roof)).toBeCloseTo(outerTop('little-lighthouse'), 6);
    expect(highestOf(roof)).toBeLessThan(highestOf(lamp));
    expect(highestOf(lamp)).toBeLessThan(highestOf(gallery));
    expect(highestOf(gallery)).toBeLessThan(highestOf(tower));
    expect(highestOf(tower)).toBeLessThan(highestOf(rock));
    expect(lowestOf(rock)).toBeCloseTo(outerBottom('little-lighthouse'), 6);
    // The tower tapers: its upper half is narrower than its lower half; the roof is one soft curve, never a point.
    const towerPoints = pointsOf(tower);
    const mid = centreYOf(tower);
    const spanOf = (points: [number, number][]): number => Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
    expect(spanOf(towerPoints.filter(([, y]) => y < mid))).toBeLessThan(spanOf(towerPoints.filter(([, y]) => y >= mid)));
    expect(commandsIn(roof, 'bezierCurveTo')).toBe(1);
    // The one soft heart sits inside the lamp room; the band's two lines are the only 1.2 lines.
    const [heart] = glowHearts('little-lighthouse');
    const lampXs = pointsOf(lamp).map(([x]) => x);
    const lampYs = pointsOf(lamp).map(([, y]) => y);
    for (const [x, y] of pointsOf(heart)) {
      expect(x).toBeGreaterThan(Math.min(...lampXs));
      expect(x).toBeLessThan(Math.max(...lampXs));
      expect(y).toBeGreaterThan(Math.min(...lampYs));
      expect(y).toBeLessThan(Math.max(...lampYs));
    }
    expect(inkLines('little-lighthouse', 1.2)).toHaveLength(2);
    expect(inkLines('little-lighthouse', 1.2, paintTreasureSilhouette)).toHaveLength(0);
    // A soft ink round window; no beam: nothing is painted outside the five outer fills.
    expect(softInk('little-lighthouse')).toHaveLength(1);
  });

  it('draws the Glow-flower lamp as five petals fanning down from a banded collar round a lit bulb, hung from a top-centre hook', () => {
    const petals = fillsOf('glow-flower-lamp', GLOW_FLOWER_PETAL);
    expect(petals).toHaveLength(5);
    for (const petal of petals) expect(commandsIn(petal, 'quadraticCurveTo')).toBe(2);
    // The outer pair mirror each other, as do the middle pair; the last, middle petal's tip is the lowest fill.
    expect(centreXOf(petals[0])).toBeCloseTo(-centreXOf(petals[1]), 6);
    expect(centreXOf(petals[2])).toBeCloseTo(-centreXOf(petals[3]), 6);
    expect(centreXOf(petals[4])).toBeCloseTo(0, 6);
    expect(lowestOf(petals[4])).toBeCloseTo(outerBottom('glow-flower-lamp'), 6);
    for (const petal of petals.slice(0, 4)) expect(lowestOf(petal)).toBeLessThan(lowestOf(petals[4]));
    // The pebble A fills are the hook ring (first, top-centre, the highest) and the collar the petals hang from.
    const [hook, collar] = fillsOf('glow-flower-lamp', GLOW_FLOWER_CAP);
    expect(fillsOf('glow-flower-lamp', GLOW_FLOWER_CAP)).toHaveLength(2);
    expect(centreXOf(hook)).toBeCloseTo(0, 6);
    expect(highestOf(hook)).toBeCloseTo(outerTop('glow-flower-lamp'), 6);
    for (const petal of petals) expect(lowestOf(petal)).toBeGreaterThan(lowestOf(collar));
    // The lit bulb is one round fill with one still heart inside it; the unfound silhouette drops the heart.
    const [bulb] = fillsOf('glow-flower-lamp', GLOW_FLOWER_BULB);
    expect(fillsOf('glow-flower-lamp', GLOW_FLOWER_BULB)).toHaveLength(1);
    expect(commandsIn(bulb, 'ellipse')).toBe(1);
    const [heart] = glowHearts('glow-flower-lamp');
    expect(centreXOf(heart)).toBeCloseTo(centreXOf(bulb), 6);
    expect(widthOf(heart)).toBeLessThan(widthOf(bulb));
    // The collar's band: two thin lines; the string stays in the silhouette.
    expect(inkLines('glow-flower-lamp', 1.2)).toHaveLength(2);
    expect(inkLines('glow-flower-lamp', 1.6, paintTreasureSilhouette).length).toBeGreaterThanOrEqual(1);
  });

  it('draws the Diving bell as a rounded flared dome with the band, one framed porthole and a lifting ring, on a round platform', () => {
    const [dome] = fillsOf('diving-bell', DIVING_BELL_FILL);
    const [platform] = fillsOf('diving-bell', DIVING_BELL_BASE);
    expect(fillsOf('diving-bell', DIVING_BELL_FILL)).toHaveLength(1);
    expect(fillsOf('diving-bell', DIVING_BELL_BASE)).toHaveLength(1);
    // The platform is the lowest fill and wider than the dome; the dome has no sharp corner of its own.
    expect(lowestOf(platform)).toBeCloseTo(outerBottom('diving-bell'), 6);
    expect(widthOf(platform)).toBeGreaterThan(widthOf(dome));
    expect(commandsIn(dome, 'lineTo')).toBe(0);
    // Pebble A is the lifting ring (top-centre, the highest) and the porthole's frame inside the dome.
    const [ring, frame] = fillsOf('diving-bell', DIVING_BELL_RING);
    expect(fillsOf('diving-bell', DIVING_BELL_RING)).toHaveLength(2);
    expect(centreXOf(ring)).toBeCloseTo(0, 6);
    expect(highestOf(ring)).toBeCloseTo(outerTop('diving-bell'), 6);
    // One porthole only, centred, in pale glass; the unfound silhouette drops both frame and glass.
    const [glass] = fillsOf('diving-bell', FIREFLY_JAR_GLASS);
    expect(fillsOf('diving-bell', FIREFLY_JAR_GLASS)).toHaveLength(1);
    expect(centreXOf(glass)).toBeCloseTo(0, 6);
    expect(centreXOf(frame)).toBeCloseTo(0, 6);
    expect(widthOf(glass)).toBeLessThan(widthOf(frame));
    expect(fillsOf('diving-bell', FIREFLY_JAR_GLASS, paintTreasureSilhouette)).toHaveLength(0);
    // The band's two lines are the only 1.2 lines.
    expect(inkLines('diving-bell', 1.2)).toHaveLength(2);
  });

  it('draws the Little mud turtle as a friendly toy: a high dome shell with a gem on its centre scute, a level round head with a smile, two feet', () => {
    const [shell] = fillsOf('little-mud-turtle', MUD_TURTLE_SHELL);
    expect(fillsOf('little-mud-turtle', MUD_TURTLE_SHELL)).toHaveLength(1);
    const skin = fillsOf('little-mud-turtle', MUD_TURTLE_SKIN);
    expect(skin).toHaveLength(3);
    const [leftFoot, rightFoot, head] = skin;
    // The shell is the highest fill and the two feet are the lowest; the head is the rightmost part, facing right.
    expect(highestOf(shell)).toBeCloseTo(outerTop('little-mud-turtle'), 6);
    expect(lowestOf(leftFoot)).toBeCloseTo(outerBottom('little-mud-turtle'), 6);
    expect(lowestOf(rightFoot)).toBeCloseTo(outerBottom('little-mud-turtle'), 6);
    expect(rightmostOf(head)).toBeCloseTo(Math.max(...outerFillsOf('little-mud-turtle').map(rightmostOf)), 6);
    for (const foot of [leftFoot, rightFoot]) for (const r of cornerRadii(foot.args[0] as unknown[][])) expect(r).toBeGreaterThan(0);
    // The head is level, never raised: its middle is below the shell's middle. It is one closed round ellipse, no beak point or open mouth.
    expect(centreYOf(head)).toBeGreaterThan(centreYOf(shell));
    expect(commandsIn(head, 'ellipse')).toBe(1);
    expect(commandsIn(head, 'lineTo')).toBe(0);
    // One aqua gem with its glint on the centre scute, inside the shell; the scute lines and the smile are 1.2 ink.
    expect(fillsOf('little-mud-turtle', CASTLE_GEM)).toHaveLength(1);
    expect(fillsOf('little-mud-turtle', GEM_GLINT)).toHaveLength(1);
    expect(fillsOf('little-mud-turtle', CASTLE_GEM, paintTreasureSilhouette)).toHaveLength(0);
    expect(inkLines('little-mud-turtle', 1.2)).toHaveLength(3);
    expect(inkLines('little-mud-turtle', 1.2, paintTreasureSilhouette)).toHaveLength(0);
    // One bead eye, none in the unfound silhouette.
    expect(fillsOf('little-mud-turtle', EYE)).toHaveLength(1);
    expect(fillsOf('little-mud-turtle', EYE, paintTreasureSilhouette)).toHaveLength(0);
    // Never the lake predator's dark shell and pale rim: every fill is pale.
    for (const fill of OUTER_FILLS['little-mud-turtle']) expect(relativeLuminance(fill)).toBeGreaterThanOrEqual(0.607);
  });

  it('draws the Fading light garden as three round bulbs of three heights on thin stalks, each under a cap with a still heart, on a banded bed', () => {
    const bulbs = fillsOf('fading-light-garden', FADING_GARDEN_BULB);
    expect(bulbs).toHaveLength(3);
    for (const bulb of bulbs) expect(commandsIn(bulb, 'ellipse')).toBe(1);
    // Three different heights, the tallest and widest last.
    const middles = bulbs.map(centreYOf);
    expect(new Set(middles.map((y) => y.toFixed(3))).size).toBe(3);
    expect(Math.min(...middles)).toBe(middles[2]);
    expect(widthOf(bulbs[2])).toBeGreaterThan(widthOf(bulbs[0]));
    expect(widthOf(bulbs[2])).toBeGreaterThan(widthOf(bulbs[1]));
    // A cap on each bulb, the tall one's the highest fill; a stalk under each; the bed is the lowest fill.
    const caps = fillsOf('fading-light-garden', FADING_GARDEN_CAP);
    expect(caps).toHaveLength(3);
    expect(Math.min(...caps.map(highestOf))).toBeCloseTo(outerTop('fading-light-garden'), 6);
    expect(fillsOf('fading-light-garden', FADING_GARDEN_STALK)).toHaveLength(3);
    const [bed] = fillsOf('fading-light-garden', FADING_GARDEN_BASE);
    expect(fillsOf('fading-light-garden', FADING_GARDEN_BASE)).toHaveLength(1);
    expect(lowestOf(bed)).toBeCloseTo(outerBottom('fading-light-garden'), 6);
    // One soft heart inside each bulb, still; the unfound silhouette drops them.
    const hearts = glowHearts('fading-light-garden');
    expect(hearts).toHaveLength(3);
    for (const [i, heart] of hearts.entries()) expect(widthOf(heart)).toBeLessThan(widthOf(bulbs[i]));
    // The bed carries the one gold band; the gem and the 4-point star sit with it.
    expect(fillsOf('fading-light-garden', PYRAMID_GEM)).toHaveLength(1);
    expect(inkLines('fading-light-garden', 1.2)).toHaveLength(2);
  });
});

describe('Open lake Area 13 Decorations in the Home Tank (issue #215)', () => {
  const bakeShipped = (): ReturnType<typeof bakeTankTextures> => {
    bakes.length = 0;
    return bakeTankTextures({} as never, 2, { decorationPx: PX, rand: () => 0.5 });
  };
  const bakeOf = (key: string): BakeCall => bakes.find((b) => b.key === key) as BakeCall;
  const BASED = ['stone-stack', 'lake-buoy', 'little-lighthouse', 'diving-bell', 'little-mud-turtle', 'fading-light-garden'] as const;
  const HANGING = ['raincloud-mobile', 'glow-flower-lamp'] as const;

  it('matches the catalogue placement kinds, rarities and standard widths, listed after Area 12 last', () => {
    const decorations = OPEN_LAKE_2_TREASURES.filter(isDecoration);
    expect(TANK_DECORATION_SLUGS.slice(-8)).toEqual(decorations.map((d) => treasureSlug(d.id)));
    expect(TANK_DECORATION_SLUGS.slice(-13, -8)).toEqual(['windsock', 'pinwheel', 'little-pelican', 'twin-volcanoes', 'little-sailboat']);
    for (const decoration of decorations) {
      const slug = treasureSlug(decoration.id) as TankDecorationSlug;
      expect(decoration.width, decoration.id).toBeUndefined();
      expect(TANK_DECORATION_SHAPES[slug], decoration.id).toEqual({ placement: placementKind(decoration) });
      expect(TANK_DECORATION_BADGES[slug], decoration.id).toBe(badgeShape(decoration.rarity));
    }
    const badges = TANK_DECORATION_BADGES as Readonly<Record<string, BadgeShape>>;
    expect(TRENCH_DECORATION_SLUGS.map((slug) => badges[slug])).toEqual([
      'circle',
      'circle',
      'circle',
      'diamond',
      'diamond',
      'diamond',
      'shield',
      'star',
    ]);
    expect(TRENCH_DECORATION_SLUGS.map((slug) => TANK_DECORATION_SHAPES[slug].placement)).toEqual([
      'floor',
      'floating',
      'hanging',
      'floor',
      'hanging',
      'floor',
      'floor',
      'floor',
    ]);
  });

  it.each(TRENCH_DECORATION_SLUGS.flatMap((slug) => [48, 80].map((size) => [slug, size] as const)))(
    '%s at %i is anchored at its lowest fill edge, the icon box edge',
    (slug, size) => {
      const box = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
      expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(box.maxY, 1);
      expect(decorationBaseOffset(slug, size), `${slug} ${size}`).toBeCloseTo(size / 2, 1);
    },
  );

  it('bakes a tank sprite and a glow for the Floor and Floating ones, anchored at the icon box edge', () => {
    const tex = bakeShipped();
    const iconFrame = treasureIconTextureSize(PX);
    for (const slug of BASED) {
      expect(tex.decorations[slug].key).toBe(`tank-deco-${slug}-80`);
      expect(tex.decorationGlows[slug].key).toBe(`tank-deco-glow-${slug}-80`);
      const sprite = bakeOf(tex.decorations[slug].key);
      expect(sprite.size, slug).toEqual({ ...iconFrame, originY: iconFrame.originY + decorationBaseOffset(slug, PX) });
      const before = (ctx: CanvasRenderingContext2D): void => {
        ctx.translate(0, -decorationBaseOffset(slug, PX));
        paintTreasureIcon(ctx, slug, PX);
      };
      expect(callLogDigest(sprite.paint), slug).toBe(callLogDigest(before));
    }
  });

  it('rides the Lake buoy on the waterline, 20 below the top of the 80 box', () => {
    const [ball] = fillsOf('lake-buoy', LAKE_BUOY_FILL);
    // The top of the float stands in the air and the waterline cuts it, as the Glow moss ball does.
    expect(highestOf(ball)).toBeLessThan(-20);
    expect(lowestOf(ball)).toBeGreaterThan(-20);
    expect(TANK_DECORATION_SHAPES['lake-buoy'].placement).toBe('floating');
  });

  it.each(HANGING.map((slug) => [slug] as const))('bakes the %s from its icon at 80, hanging from its top-centre hook', (slug) => {
    const tex = bakeShipped();
    const iconFrame = treasureIconTextureSize(PX);
    const sprite = bakeOf(tex.decorations[slug].key);
    expect(sprite.size).toEqual({ ...iconFrame, originY: iconFrame.originY - PX / 2 });
    expect(sprite.size.originX * 2).toBe(sprite.size.w);
    const before = (ctx: CanvasRenderingContext2D): void => {
      ctx.translate(0, PX / 2);
      paintTreasureIcon(ctx, slug, PX);
    };
    expect(callLogDigest(sprite.paint)).toBe(callLogDigest(before));
    // The hook ring's ink touches the hook point, and the lowest part reaches the base point one footprint below.
    const reach = inkReach((ctx) => paintTreasureIcon(ctx, slug, PX));
    expect(reach.minY + PX / 2).toBeGreaterThanOrEqual(-0.05);
    expect(reach.minY + PX / 2).toBeLessThan(1);
    expect(reach.maxY + PX / 2).toBeGreaterThan(PX - 1.5);
    expect(reach.maxY + PX / 2).toBeLessThanOrEqual(PX + REACH_TOLERANCE);
  });

  it.each(HANGING.map((slug) => [slug] as const))('centres the %s glow on its box, with the sprite anchor at the hook', (slug) => {
    const tex = bakeShipped();
    const glow = bakeOf(tex.decorationGlows[slug].key);
    const frame = rarityGlowTextureSize(96);
    expect(glow.size).toEqual({ ...frame, originY: frame.originY - PX / 2 });
    const rec = record(glow.paint);
    expect(rec.calls[0]).toEqual(['translate', [0, PX / 2]]);
  });

  it('glows every Area 13 Decoration in its catalogue rarity: Common, Rare, Epic and Legendary', () => {
    const tex = bakeShipped();
    for (const decoration of OPEN_LAKE_2_TREASURES.filter(isDecoration)) {
      const slug = treasureSlug(decoration.id) as TankDecorationSlug;
      const rec = record(bakeOf(tex.decorationGlows[slug].key).paint);
      expect(parseRgba(rec.gradients[0].stops[0][1]).rgb, decoration.id).toEqual(channelsOf(BADGE_FILL[badgeShape(decoration.rarity)]));
    }
  });

  it('adds 48 boot textures for the eight Decorations: an icon at three sizes, a silhouette, a tank sprite and a tank glow each', () => {
    bakes.length = 0;
    bakeTreasureTextures({} as never, 2);
    bakeTankTextures({} as never, 2, { decorationPx: PX, rand: () => 0.5 });
    const keys = TRENCH_DECORATION_SLUGS.flatMap((slug) => [
      ...[28, 32, 48].map((size) => `treasure-${slug}-${size}`),
      treasureSilhouetteKey(slug),
      `tank-deco-${slug}-80`,
      `tank-deco-glow-${slug}-80`,
    ]);
    expect(keys).toHaveLength(48);
    expect(new Set(keys).size).toBe(48);
    const baked = new Set(bakes.map((b) => b.key));
    for (const key of keys) expect(baked.has(key), key).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Wearable icons
// ---------------------------------------------------------------------------

/** The outer fills each Wearable may paint (the Area 13 Wearable fills of treasurePalette.ts, plus the shipped pebble A), by item. */
const WEARABLE_OUTER_FILLS: Readonly<Record<string, readonly string[]>> = {
  'turtle-socks': [TURTLE_SOCKS_FILL],
  'diving-goggles': [DIVING_GOGGLES_FRAME, FIREFLY_HOOK],
  'turtle-shell-backpack': [TURTLE_SHELL_FILL, FIREFLY_HOOK],
  'lantern-tail-charm': [LANTERN_CHARM_FILL, FIREFLY_HOOK],
  'mini-submarine': [MINI_SUBMARINE_FILL, FIREFLY_HOOK],
  'diving-suit': [DIVING_SUIT_FILL],
};
/** The colours each Wearable may paint inside its silhouette besides ink (all hex; the rgba glow and shine are not hex). */
const WEARABLE_FREE_STYLES: Readonly<Record<string, readonly string[]>> = {
  'turtle-socks': [],
  'diving-goggles': [BOAT_TRIM, GOGGLES_LENS],
  'turtle-shell-backpack': [BOAT_TRIM],
  'lantern-tail-charm': [BOAT_TRIM],
  'mini-submarine': [GLASSES_GEM, GEM_GLINT],
  'diving-suit': [GOLD_TRIM, CASTLE_GEM, GEM_GLINT, TREASURE_STAR],
};
/** The catalogue rarity of each Wearable. */
const WEARABLE_RARITY_OF: Readonly<Record<string, Treasure['rarity']>> = {
  'turtle-socks': 'common',
  'diving-goggles': 'rare',
  'turtle-shell-backpack': 'rare',
  'lantern-tail-charm': 'rare',
  'mini-submarine': 'epic',
  'diving-suit': 'legendary',
};
/** The Wearables drawn as a merged `blob` silhouette (outer ink 5.6, all outside the fills); the rest are plain `shape` silhouettes (2.8). */
const WEARABLE_MERGED: readonly TreasureIconSlug[] = ['lantern-tail-charm', 'mini-submarine', 'diving-suit'];
/** The outer fills of a Wearable icon at 80. */
const wearableFills = (slug: TreasureIconSlug, colour: string): Op[] => fillsOf(slug, colour);

describe('Open lake Area 13 Wearable icons (issue #215)', () => {
  it('lists the six Area 13 Wearables in catalogue order, interleaved with the Decorations ahead of the Paint shells', () => {
    const added = OPEN_LAKE_2_TREASURES.filter((treasure) => treasure.category === 'wearable').map((treasure) => treasureSlug(treasure.id));
    expect(added).toEqual([...TRENCH_WEARABLE_SLUGS]);
    const positions = TRENCH_WEARABLE_SLUGS.map((slug) => TREASURE_ICON_SLUGS.indexOf(slug));
    expect(positions).toEqual([133, 137, 138, 139, 141, 143]);
    // Every one has an icon slug of its own, and is among the fourteen items in the order the catalogue lists them.
    expect(TRENCH_ITEM_SLUGS.filter((slug) => (TRENCH_WEARABLE_SLUGS as readonly string[]).includes(slug))).toEqual([...TRENCH_WEARABLE_SLUGS]);
    expect(TRENCH_ITEM_SLUGS.filter((slug) => (TRENCH_DECORATION_SLUGS as readonly string[]).includes(slug))).toEqual([...TRENCH_DECORATION_SLUGS]);
  });

  it('bakes an icon at every baked size and a silhouette for all six Area 13 Wearables', () => {
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    for (const slug of TRENCH_WEARABLE_SLUGS) {
      for (const size of [28, 32, 48] as const) expect(tex.icons[size][slug].key, `${slug} ${size}`).toBe(`treasure-${slug}-${size}`);
      expect(tex.silhouettes[slug].key, slug).toBe(treasureSilhouetteKey(slug));
      expect(bakes.some((b) => b.key === treasureSilhouetteKey(slug)), slug).toBe(true);
    }
    expect(new Set(bakes.map((b) => b.key)).size).toBe(bakes.length);
  });

  it('follows the catalogue rarity of each Wearable: Turtle socks Common, three Rare, the Mini submarine Epic, the Diving suit Legendary', () => {
    const catalogue = new Map(OPEN_LAKE_2_TREASURES.map((treasure) => [treasureSlug(treasure.id), treasure.rarity]));
    for (const slug of TRENCH_WEARABLE_SLUGS) expect(catalogue.get(slug), slug).toBe(WEARABLE_RARITY_OF[slug]);
  });

  it('uses the worn-look fills of treasurePalette.ts, pale, 9:1 or more with ink, none a rarity badge fill and none red', () => {
    const worn: readonly (readonly [string, string, number])[] = [
      [TURTLE_SOCKS_FILL, '#b8fcc0', 12.15],
      [DIVING_GOGGLES_FRAME, '#bad8ff', 9.84],
      [TURTLE_SHELL_FILL, '#e4cfba', 9.55],
      [LANTERN_CHARM_FILL, '#9cfffc', 12.42],
      [MINI_SUBMARINE_FILL, '#f0f396', 12.31],
      [DIVING_SUIT_FILL, '#edccbd', 9.58],
    ];
    for (const [fill, hex, ratio] of worn) {
      expect(fill).toBe(hex);
      expect(contrastRatio(fill, INK), hex).toBeCloseTo(ratio, 1);
      expect(contrastRatio(fill, INK), hex).toBeGreaterThanOrEqual(9);
      expect(relativeLuminance(fill), hex).toBeGreaterThanOrEqual(0.607);
      expect(Object.values(BADGE_FILL), hex).not.toContain(fill);
      expect(isReddish(fill), `${hex} is not red`).toBe(false);
    }
    expect(new Set(worn.map(([fill]) => fill)).size).toBe(worn.length);
    for (const fill of new Set(Object.values(WEARABLE_OUTER_FILLS).flat())) expect(isReddish(fill), `${fill} is not red`).toBe(false);
  });

  it.each(TRENCH_WEARABLE_SLUGS.map((slug) => [slug] as const))('%s paints its own Area 13 fills and no other outer colour', (slug) => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48));
    const own = WEARABLE_OUTER_FILLS[slug].map((c) => c.toLowerCase());
    for (const fill of own) expect(styles, `${slug} uses ${fill}`).toContain(fill);
    const free = new Set([INK, ...WEARABLE_FREE_STYLES[slug]].map((c) => c.toLowerCase()));
    for (const style of styles) {
      if (free.has(style)) continue;
      expect(own, `${slug} paints only its own fills, ${style} is not one`).toContain(style);
    }
  });

  it.each(TRENCH_WEARABLE_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i keeps its frame: the ink inside the icon box and the texture frame, reaching nearly the whole longest side',
    (slug, size) => {
      const half = size / 2;
      const frame = frameBox(treasureIconTextureSize(size));
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const box = inkReach((ctx) => paint(ctx, slug, size));
        expect(box.minX, `${slug} left`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minX));
        expect(box.maxX, `${slug} right`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxX));
        expect(box.minY, `${slug} top`).toBeGreaterThanOrEqual(Math.max(-half - REACH_TOLERANCE, frame.minY));
        expect(box.maxY, `${slug} bottom`).toBeLessThanOrEqual(Math.min(half + REACH_TOLERANCE, frame.maxY));
      }
      const box = inkReach((ctx) => paintTreasureIcon(ctx, slug, size));
      expect(Math.max(box.maxX - box.minX, box.maxY - box.minY), `${slug} longest side`).toBeGreaterThanOrEqual(size - 2);
    },
  );

  it.each(TRENCH_WEARABLE_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its ink outline at the shipped widths, and keeps the outer ink in the unfound silhouette',
    (slug, size) => {
      const ink = record((ctx) => paintTreasureIcon(ctx, slug, size)).ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK);
      const widths = new Set(ink.map((op) => op.lineWidth));
      const merged = WEARABLE_MERGED.includes(slug);
      expect(widths.has(5.6), `${slug} merged ink`).toBe(merged);
      expect(widths.has(2.8), `${slug} item outline`).toBe(!merged);
      for (const width of widths) expect(ALLOWED_INK, `${slug} ink ${width}`).toContain(width);
      const outline = merged ? 5.6 : 2.8;
      const flat = record((ctx) => paintTreasureSilhouette(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === outline,
      );
      expect(flat.length, `${slug} silhouette outer ink ${outline}`).toBeGreaterThan(0);
    },
  );

  it.each(TRENCH_WEARABLE_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its one white shine, and none in the unfound silhouette',
    (slug, size) => {
      const shines = (paint: typeof paintTreasureIcon): number =>
        record((ctx) => paint(ctx, slug, size)).ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length;
      expect(shines(paintTreasureIcon), slug).toBe(1);
      expect(shines(paintTreasureSilhouette), `${slug} silhouette`).toBe(0);
    },
  );

  it('draws every Area 13 Wearable unfound silhouette in the flat fill alone, so no icon is told apart by colour', () => {
    for (const slug of TRENCH_WEARABLE_SLUGS) {
      const fills = hexStyles((ctx) => paintTreasureSilhouette(ctx, slug, 32));
      expect([...fills].sort(), slug).toEqual([INK, TREASURE_SILHOUETTE_FILL].map((c) => c.toLowerCase()).sort());
      expect(glowHearts(slug, paintTreasureSilhouette), `${slug} silhouette has no glow`).toHaveLength(0);
    }
  });

  it('gives every Area 13 Wearable its own outline: no two silhouettes are the same drawing, nor any other item one', () => {
    const silhouetteOf = (slug: TreasureIconSlug): string => callLogDigest((ctx) => paintTreasureSilhouette(ctx, slug, 48));
    const own = TRENCH_WEARABLE_SLUGS.map(silhouetteOf);
    expect(new Set(own).size).toBe(own.length);
    const others = new Set(
      TREASURE_ICON_SLUGS.filter((slug) => !slug.startsWith('paint-shell-') && !(TRENCH_WEARABLE_SLUGS as readonly string[]).includes(slug)).map(
        silhouetteOf,
      ),
    );
    for (const [i, slugDigest] of own.entries()) expect(others.has(slugDigest), TRENCH_WEARABLE_SLUGS[i]).toBe(false);
  });

  it('draws no letters, numbers or text on any Area 13 Wearable (ADR 0007)', () => {
    for (const slug of TRENCH_WEARABLE_SLUGS) {
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const text = record((ctx) => paint(ctx, slug, PX)).ops.filter((op) => op.op === 'fillText' || op.op === 'strokeText');
        expect(text, slug).toHaveLength(0);
      }
    }
  });

  describe('rarity ladder (guide 6i)', () => {
    const byRarity = (rarity: Treasure['rarity']): TreasureIconSlug[] => TRENCH_WEARABLE_SLUGS.filter((slug) => WEARABLE_RARITY_OF[slug] === rarity);

    it('gives Common no trim band, gem, gold or star, and one shine', () => {
      expect(byRarity('common')).toEqual(['turtle-socks']);
      for (const slug of byRarity('common')) expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 0, band: 0, glint: 0, star: 0 });
    });

    it('gives Rare its one yellow trim band between two thin ink lines and no gem, gold or star', () => {
      expect(byRarity('rare')).toEqual(['diving-goggles', 'turtle-shell-backpack', 'lantern-tail-charm']);
      for (const slug of byRarity('rare')) {
        expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 0, band: 1, glint: 0, star: 0 });
        expect(inkLines(slug, 1.2).length, `${slug} trim band lines`).toBeGreaterThanOrEqual(2);
      }
    });

    it('gives Epic one gem with its glint and no trim band, gold or star', () => {
      expect(byRarity('epic')).toEqual(['mini-submarine']);
      for (const slug of byRarity('epic')) expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 0, band: 0, glint: 1, star: 0 });
    });

    it('gives Legendary one gold band, one gem with its glint and one 4-point star', () => {
      expect(byRarity('legendary')).toEqual(['diving-suit']);
      for (const slug of byRarity('legendary')) expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 1, band: 0, glint: 1, star: 1 });
    });
  });
});

describe('Open lake Area 13 Wearable construction (issue #215)', () => {
  it('draws the Turtle socks as one leg with a high round shell dome for a foot and two soft scute marks', () => {
    const [sock] = wearableFills('turtle-socks', TURTLE_SOCKS_FILL);
    expect(wearableFills('turtle-socks', TURTLE_SOCKS_FILL)).toHaveLength(1);
    // The leg runs the whole height of the box on the left; the dome foot reaches the right edge and the foot line.
    expect(highestOf(sock)).toBeCloseTo(outerTop('turtle-socks'), 6);
    expect(highestOf(sock)).toBeLessThan(-35);
    expect(lowestOf(sock)).toBeCloseTo(outerBottom('turtle-socks'), 6);
    expect(rightmostOf(sock)).toBeGreaterThan(centreXOf(sock));
    expect(commandsIn(sock, 'bezierCurveTo')).toBe(1);
    // Two soft ink scute marks (alpha 0.30), each a rounded hexagon of six rounded corners, none in the silhouette.
    const marks = softInk('turtle-socks');
    expect(marks).toHaveLength(2);
    for (const mark of marks) expect(cornerRadii(mark.args[0] as unknown[][]), 'hexagon').toHaveLength(6);
    expect(softInk('turtle-socks', paintTreasureSilhouette)).toHaveLength(0);
    expect(inkLines('turtle-socks', 1.2)).toHaveLength(0);
  });

  it('draws the Diving goggles as one wide mask with a clear lens and the band under it, on two strap ends', () => {
    const [mask] = wearableFills('diving-goggles', DIVING_GOGGLES_FRAME);
    expect(wearableFills('diving-goggles', DIVING_GOGGLES_FRAME)).toHaveLength(1);
    const ends = wearableFills('diving-goggles', FIREFLY_HOOK);
    expect(ends).toHaveLength(2);
    const [lens] = wearableFills('diving-goggles', GOGGLES_LENS);
    expect(wearableFills('diving-goggles', GOGGLES_LENS)).toHaveLength(1);
    // One mask, wider than tall (never the Cave goggles' two round frames), the strap ends one each side of it.
    expect(widthOf(mask)).toBeGreaterThan(1.3 * (lowestOf(mask) - highestOf(mask)));
    expect(centreXOf(ends[0])).toBeLessThan(centreXOf(mask));
    expect(centreXOf(ends[1])).toBeGreaterThan(centreXOf(mask));
    // The lens sits inside the mask, and the one band runs across the rim under the lens.
    expect(highestOf(lens)).toBeGreaterThan(highestOf(mask));
    expect(lowestOf(lens)).toBeLessThan(lowestOf(mask));
    const band = record((ctx) => paintTreasureIcon(ctx, 'diving-goggles', PX)).ops.find((op) => op.op === 'fillRect' && op.fillStyle === BOAT_TRIM) as Op;
    const [, bandY] = band.args as number[];
    expect(bandY).toBeGreaterThan(lowestOf(lens));
  });

  it('draws the Turtle shell backpack as a high dome on short sides with a carry ring on top, the band across its foot and two scute lines', () => {
    const [dome] = wearableFills('turtle-shell-backpack', TURTLE_SHELL_FILL);
    expect(wearableFills('turtle-shell-backpack', TURTLE_SHELL_FILL)).toHaveLength(1);
    const [ring] = wearableFills('turtle-shell-backpack', FIREFLY_HOOK);
    expect(wearableFills('turtle-shell-backpack', FIREFLY_HOOK)).toHaveLength(1);
    expect(commandsIn(ring, 'ellipse')).toBe(1);
    // The ring is the highest fill, on the centre line above the dome; the dome's flat foot is the lowest.
    expect(highestOf(ring)).toBeCloseTo(outerTop('turtle-shell-backpack'), 6);
    expect(highestOf(ring)).toBeLessThan(highestOf(dome));
    expect(Math.abs(centreXOf(ring) - centreXOf(dome))).toBeLessThan(0.01);
    expect(lowestOf(dome)).toBeCloseTo(outerBottom('turtle-shell-backpack'), 6);
    // The dome is a half ellipse on upright sides, with rounded feet.
    expect(commandsIn(dome, 'ellipse')).toBe(1);
    expect(cornerRadii(dome.args[0] as unknown[][])).toHaveLength(2);
    // The band's two thin ink lines and the two scute lines are all 1.2 ink; the scute lines lean toward the middle.
    expect(inkLines('turtle-shell-backpack', 1.2)).toHaveLength(4);
    const scutes = inkLines('turtle-shell-backpack', 1.2).filter((op) => op.args[0] !== undefined && commandsIn(op, 'quadraticCurveTo') === 1);
    expect(scutes).toHaveLength(2);
    const [left, right] = scutes.map((op) => pointsOf(op));
    const lean = (path: [number, number][]): number => path[path.length - 1][0] - path[0][0];
    expect(Math.sign(lean(left)) * Math.sign(lean(right))).toBe(-1);
  });

  it('draws the Lantern tail charm as a round glass on a ring and cord, with a tassel and bead, and a soft heart inside the glass', () => {
    const [glass] = wearableFills('lantern-tail-charm', LANTERN_CHARM_FILL);
    expect(wearableFills('lantern-tail-charm', LANTERN_CHARM_FILL)).toHaveLength(1);
    expect(commandsIn(glass, 'ellipse')).toBe(1);
    // Four pebble A parts: the ring on top, the cord, the tassel and the bead under the glass.
    const parts = wearableFills('lantern-tail-charm', FIREFLY_HOOK);
    expect(parts).toHaveLength(4);
    expect(highestOf(parts[0])).toBeCloseTo(outerTop('lantern-tail-charm'), 6);
    expect(lowestOf(parts[3])).toBeCloseTo(outerBottom('lantern-tail-charm'), 6);
    // One still heart inside the glass: translucent, full global alpha, no halo or ring outside the glass.
    const hearts = glowHearts('lantern-tail-charm');
    expect(hearts).toHaveLength(1);
    expect(hearts[0].globalAlpha).toBe(1);
    expect(highestOf(hearts[0])).toBeGreaterThan(highestOf(glass));
    expect(lowestOf(hearts[0])).toBeLessThan(lowestOf(glass));
    expect(widthOf(hearts[0])).toBeLessThan(widthOf(glass));
    // Everything painted is within the glass's width or narrower, so nothing glows or hangs out to the sides.
    for (const part of parts) expect(widthOf(part)).toBeLessThan(widthOf(glass));
  });

  it('draws the Mini submarine as a long hull, a conning tower and a periscope bending forward, with two propeller blades and one porthole gem', () => {
    const [hull, tower, tube, arm] = wearableFills('mini-submarine', MINI_SUBMARINE_FILL);
    expect(wearableFills('mini-submarine', MINI_SUBMARINE_FILL)).toHaveLength(4);
    // A long hull, wider than tall, with the tower and periscope standing on it and the periscope the highest fill.
    expect(widthOf(hull)).toBeGreaterThan(1.6 * (lowestOf(hull) - highestOf(hull)));
    expect(highestOf(tower)).toBeLessThan(highestOf(hull));
    expect(highestOf(arm)).toBeLessThan(highestOf(tower));
    expect(highestOf(arm)).toBeCloseTo(highestOf(tube), 6);
    // The periscope arm bends forward (to the right) past the tower; the tube rises from the tower.
    expect(rightmostOf(arm)).toBeGreaterThan(rightmostOf(tube));
    expect(rightmostOf(arm)).toBeLessThan(rightmostOf(hull));
    // Two pebble A propeller blades at the rear, behind (left of) the hull's middle, one above the other.
    const blades = wearableFills('mini-submarine', FIREFLY_HOOK);
    expect(blades).toHaveLength(2);
    for (const blade of blades) expect(centreXOf(blade)).toBeLessThan(centreXOf(hull));
    expect(centreYOf(blades[0])).not.toBeCloseTo(centreYOf(blades[1]), 0);
    // One porthole gem (ink 1.6 ring and glint) on the hull; one 1.2 seam; no trim band.
    expect(inkLines('mini-submarine', 1.2)).toHaveLength(1);
    expect(countDetails('mini-submarine').glint).toBe(1);
  });

  it('draws the Diving suit as a helmet, torso, two arms and two legs with boots in one pale copper, a gold collar ring, a window gem and a chest star', () => {
    const pieces = wearableFills('diving-suit', DIVING_SUIT_FILL);
    expect(pieces).toHaveLength(6);
    const [leftArm, rightArm, leftLeg, rightLeg, torso, helmet] = pieces;
    expect(commandsIn(helmet, 'ellipse')).toBe(1);
    // Mirror pairs about the middle line.
    expect(centreXOf(leftArm) + centreXOf(rightArm)).toBeCloseTo(0, 6);
    expect(centreXOf(torso)).toBeCloseTo(0, 6);
    expect(centreXOf(helmet)).toBeCloseTo(0, 6);
    expect(Math.abs(centreXOf(leftLeg) + centreXOf(rightLeg))).toBeLessThan(0.01);
    // The helmet is the highest part, the boots the lowest, the arms wider than the torso, the helmet narrower than it.
    expect(highestOf(helmet)).toBeCloseTo(outerTop('diving-suit'), 6);
    expect(lowestOf(leftLeg)).toBeCloseTo(outerBottom('diving-suit'), 6);
    expect(widthOf(helmet)).toBeLessThan(widthOf(torso));
    expect(Math.min(...pointsOf(leftArm).map(([x]) => x))).toBeLessThan(Math.min(...pointsOf(torso).map(([x]) => x)));
    // One gold collar ring (the gold band), no yellow band; the gem sits on the helmet and the star on the chest.
    expect(countDetails('diving-suit')).toEqual({ shine: 1, gold: 1, band: 0, glint: 1, star: 1 });
    const star = record((ctx) => paintTreasureIcon(ctx, 'diving-suit', PX)).ops.find((op) => op.op === 'fill' && op.fillStyle === TREASURE_STAR) as Op;
    expect(centreYOf(star)).toBeGreaterThan(centreYOf(torso) - widthOf(torso));
    expect(centreYOf(star)).toBeLessThan(lowestOf(torso));
  });
});

describe('Open lake Area 13 art digests', () => {
  it('pins the eight Area 13 Decoration icons as authored, so they change only on purpose', () => {
    for (const size of SIZES) expect(iconDigest(TRENCH_DECORATION_SLUGS, size), `decorations ${size}`).toBe(TRENCH_DECORATION_DIGESTS[size]);
    for (const slug of TRENCH_DECORATION_SLUGS) expect(iconDigest([slug], PX), `${slug} 80`).toBe(TRENCH_DECORATION_DIGESTS_80[slug]);
  });

  it('pins the six Area 13 Wearable icons as authored, so they change only on purpose', () => {
    for (const size of SIZES) expect(iconDigest(TRENCH_WEARABLE_SLUGS, size), `wearables ${size}`).toBe(TRENCH_WEARABLE_DIGESTS[size]);
    for (const slug of TRENCH_WEARABLE_SLUGS) expect(iconDigest([slug], PX), `${slug} 80`).toBe(TRENCH_WEARABLE_DIGESTS_80[slug]);
  });
});
