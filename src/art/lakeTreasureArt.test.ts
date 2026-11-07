/**
 * Open lake Area 12 treasure art (issue #214), headless: the ten item icons (five Decorations and five Wearables),
 * the Tule green and Obsidian Paint shells and swatches, and the five Decorations' Home Tank sprites. The painters run
 * against a recording context and a stub Path2D, as in treasureArt.test.ts: every fill and stroke is kept with the
 * style, width and alpha it was painted under. The bake glue runs against a stubbed `bake`.
 */
import { describe, expect, it, vi } from 'vitest';
import { badgeShape } from '../logic/hints';
import {
  ALL_TREASURES,
  OBSIDIAN,
  OPEN_LAKE_TREASURES,
  TULE_GREEN,
  isDecoration,
  placementKind,
  treasureSlug,
  type Treasure,
} from '../logic/catalogue';
import { PELICAN_BILL, PELICAN_FEATHER, PELICAN_POUCH } from './drawPelican';
import { rarityGlowTextureSize } from './drawRarityGlow';
import {
  DREAM_SWATCH_IDS,
  TREASURE_ICON_SLUGS,
  decorationBaseOffset,
  paintDreamSwatch,
  paintTreasureIcon,
  paintTreasureSilhouette,
  treasureIconTextureSize,
  LANTERN_FLAME,
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
  BOAT_TRIM,
  CANDLE_FLAME_FILL,
  CLOUD_SCARF_FILL,
  CRYSTAL_CROWN_BAND,
  DECOY_BODY,
  DEEP_CANAL_WEIGHT,
  DREAM_RIM,
  DREAM_SWATCH,
  FESTIVAL_PLINTH,
  FIREFLY_BULB,
  FIREFLY_HOOK,
  GEM_GLINT,
  GOLD_TRIM,
  LITTLE_PELICAN_BILL,
  LITTLE_PELICAN_BODY,
  LITTLE_SAILBOAT_HULL,
  LITTLE_SAILBOAT_MAST,
  LITTLE_SAILBOAT_SAIL,
  MARIACHI_JACKET_FILL,
  PAINT_SHELL_FILL,
  PAPER_BOAT_FILL,
  PELICAN_SLIPPER_BILL,
  PELICAN_SLIPPER_FILL,
  PELICAN_SWIM_RING_BILL,
  PELICAN_SWIM_RING_FILL,
  PINWHEEL_BASE,
  PINWHEEL_BLADES,
  PINWHEEL_PIN,
  PINWHEEL_STICK,
  SAILOR_CAP_FILL,
  STALACTITE_ROCK,
  STRIPED_SCARF_FILL,
  SURFBOARD_FILL,
  TRAJINERA_ARCH,
  TRAJINERA_BLOSSOM_PINK,
  TREASURE_SILHOUETTE_FILL,
  TREASURE_STAR,
  TWIN_VOLCANO_BASE,
  TWIN_VOLCANO_ROCK,
  TWIN_VOLCANO_SNOW,
  WAVE_SOCKS_FILL,
  WINDSOCK_FILL,
  WINDSOCK_HOOP,
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
const LAKE_DECORATION_SLUGS = ['windsock', 'pinwheel', 'little-pelican', 'twin-volcanoes', 'little-sailboat'] as const;
/** The five Wearables the open lake Area 12 added (issue #214, ND-3), in catalogue order. */
const LAKE_WEARABLE_SLUGS = ['wave-socks', 'cloud-scarf', 'pelican-swim-ring', 'surfboard', 'pelican-slippers'] as const;
/** All ten items, the Decorations then the Wearables. */
const LAKE_ITEM_SLUGS: readonly TreasureIconSlug[] = [...LAKE_DECORATION_SLUGS, ...LAKE_WEARABLE_SLUGS];
/** The two Paint shells the open lake Area 12 added (issue #214, ND-2), the last two icon slugs. */
const LAKE_SHELL_SLUGS: readonly TreasureIconSlug[] = ['paint-shell-tule-green', 'paint-shell-obsidian'];
/** The pelican items: every one has a closed bill over an empty pouch (issue #214, ND-8). */
const PELICAN_SLUGS = ['little-pelican', 'pelican-swim-ring', 'pelican-slippers'] as const;
const SIZES = [28, 32, 48, 80] as const;
const REACH_TOLERANCE = 0.05;
const SHINE = 'rgba(255,255,255,0.8)';
const PX = 80;

/**
 * The outer fills each item may paint (exported by treasurePalette.ts), by item. The yellow trim band, ink, the bead
 * eyes, the snow caps, the soft ink stripes, waves and openings and the shine are inside the silhouette, so free.
 */
const OUTER_FILLS: Readonly<Record<string, readonly string[]>> = {
  windsock: [WINDSOCK_FILL, WINDSOCK_HOOP],
  pinwheel: [...PINWHEEL_BLADES, PINWHEEL_PIN, PINWHEEL_STICK, PINWHEEL_BASE],
  'little-pelican': [LITTLE_PELICAN_BODY, LITTLE_PELICAN_BILL, DEEP_CANAL_WEIGHT],
  'twin-volcanoes': [TWIN_VOLCANO_ROCK, TWIN_VOLCANO_BASE],
  'little-sailboat': [LITTLE_SAILBOAT_HULL, LITTLE_SAILBOAT_SAIL, LITTLE_SAILBOAT_MAST, DEEP_CANAL_WEIGHT],
  'wave-socks': [WAVE_SOCKS_FILL],
  'cloud-scarf': [CLOUD_SCARF_FILL],
  'pelican-swim-ring': [PELICAN_SWIM_RING_FILL, PELICAN_SWIM_RING_BILL],
  surfboard: [SURFBOARD_FILL],
  'pelican-slippers': [PELICAN_SLIPPER_FILL, PELICAN_SLIPPER_BILL],
};
const FREE_STYLES = new Set([BOAT_TRIM, INK, EYE, TWIN_VOLCANO_SNOW].map((c) => c.toLowerCase()));
/** The catalogue rarity of each item, which the icon's rarity look ladder (guide 6i) must follow (issue #214, ND-3). */
const RARITY_OF: Readonly<Record<string, Treasure['rarity']>> = {
  windsock: 'common',
  pinwheel: 'common',
  'wave-socks': 'common',
  'little-pelican': 'rare',
  'twin-volcanoes': 'rare',
  'little-sailboat': 'rare',
  'cloud-scarf': 'rare',
  'pelican-swim-ring': 'rare',
  surfboard: 'rare',
  'pelican-slippers': 'rare',
};
/** The ink widths of the shipped icons that an Area 12 painter may use: item 2.8, details 1.6, trim lines 1.2, and the merged `blob` ink 5.6. */
const ALLOWED_INK = new Set([2.8, 1.6, 1.2, 5.6]);
/** The one item drawn as a merged `blob` silhouette: its outer ink is 5.6 wide with the fills over its inner half. */
const MERGED_SLUGS: readonly TreasureIconSlug[] = ['cloud-scarf'];

/**
 * Call-log digests of the ten Area 12 item icons (issue #214), the five Decorations then the five Wearables, per size,
 * pinned when they were authored. Re-pin these, and only these, when the Area 12 item art is retuned on purpose.
 */
const LAKE_DECORATION_DIGESTS: Readonly<Record<number, string>> = {
  28: '92a1a6a6f50dda9a:109',
  32: 'f97111fdf667eff1:109',
  48: 'c8f87355455f9939:109',
  80: '4b13dfc528404031:109',
};
const LAKE_WEARABLE_DIGESTS: Readonly<Record<number, string>> = {
  28: '87c51e483e5c6cc4:109',
  32: 'a9b6e90443293148:109',
  48: 'c40ccd91b601efe5:109',
  80: '893f1515ae76ee31:109',
};
/**
 * The same digests for the open lake Area 12's two Paint shell icons (issue #214, ND-2), by slug then size, pinned when
 * they were authored. Re-pin these, and only these, when Tule green or Obsidian is retuned on purpose.
 */
const LAKE_SHELL_DIGESTS: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  'paint-shell-tule-green': { 28: 'eace235c726607a0:21', 32: '832a30d5f6783331:21', 48: '15ecd3fcf88f35c8:21', 80: 'ebdfb017cee38a7b:21' },
  'paint-shell-obsidian': { 28: '98bcc8c3e7a4c0ef:21', 32: '8ec8681c67d1d1e0:21', 48: 'ac49ff22beb9ae2e:21', 80: '92d50ad08a85cd94:21' },
};
/** The same digests for the Tule green and Obsidian swatches, pinned when they were authored. */
const TULE_GREEN_SWATCH_DIGEST = 'e151e06471d213a0:21';
const OBSIDIAN_SWATCH_DIGEST = '713d5d9ac618998e:21';

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
  return record((ctx) => paintTreasureIcon(ctx, slug, PX)).ops.filter((op) => op.op === 'fill' && OUTER_FILLS[slug].includes(op.fillStyle as string));
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
/** Digest of the Dream swatch of `id` at 32. */
function swatchDigest(id: (typeof DREAM_SWATCH_IDS)[number]): string {
  return digest(callLogDigest((ctx) => paintDreamSwatch(ctx, id, 32)));
}
const isReddish = (hex: string): boolean => saturationOf(hex) > 0.15 && (hueOf(hex) < 15 || hueOf(hex) > 345);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Open lake Area 12 treasure icons (issue #214)', () => {
  it('lists the ten Area 12 items after the Area 11 ones, in catalogue order, with Tule green and Obsidian the last two Paint shells', () => {
    const added = OPEN_LAKE_TREASURES.map((treasure) => treasureSlug(treasure.id));
    expect(added.filter((slug) => !slug.startsWith('paint-shell-'))).toEqual([
      'windsock',
      'pinwheel',
      'wave-socks',
      'little-pelican',
      'twin-volcanoes',
      'little-sailboat',
      'cloud-scarf',
      'pelican-swim-ring',
      'surfboard',
      'pelican-slippers',
    ]);
    expect(TREASURE_ICON_SLUGS.slice(120, 130)).toEqual(added.filter((slug) => !slug.startsWith('paint-shell-')));
    expect(TREASURE_ICON_SLUGS.indexOf('wizard-hat')).toBe(119);
    expect(TREASURE_ICON_SLUGS.slice(130)).toEqual(DREAM_SWATCH_IDS.map((id) => `paint-shell-${id}`));
    expect(TREASURE_ICON_SLUGS.slice(-2)).toEqual(LAKE_SHELL_SLUGS);
    expect(added.filter((slug) => slug.startsWith('paint-shell-'))).toEqual(LAKE_SHELL_SLUGS);
    expect(TREASURE_ICON_SLUGS).toHaveLength(163);
    expect(new Set(TREASURE_ICON_SLUGS).size).toBe(TREASURE_ICON_SLUGS.length);
    expect(new Set(ALL_TREASURES.map((treasure) => treasureSlug(treasure.id)))).toEqual(new Set(TREASURE_ICON_SLUGS));
    // The five Decorations and five Wearables split by category.
    const decorations = OPEN_LAKE_TREASURES.filter(isDecoration).map((d) => treasureSlug(d.id));
    expect(decorations).toEqual([...LAKE_DECORATION_SLUGS]);
    const wearables = OPEN_LAKE_TREASURES.filter((treasure) => treasure.category === 'wearable').map((treasure) => treasureSlug(treasure.id));
    expect(wearables).toEqual([...LAKE_WEARABLE_SLUGS]);
  });

  it('bakes an icon at every baked size and a silhouette for all twelve Area 12 treasures, and the two swatches', () => {
    bakes.length = 0;
    const tex = bakeTreasureTextures({} as never, 2);
    for (const slug of [...LAKE_ITEM_SLUGS, ...LAKE_SHELL_SLUGS]) {
      for (const size of [28, 32, 48] as const) expect(tex.icons[size][slug].key, `${slug} ${size}`).toBe(`treasure-${slug}-${size}`);
      expect(tex.silhouettes[slug].key, slug).toBe(treasureSilhouetteKey(slug));
      expect(bakes.some((b) => b.key === treasureSilhouetteKey(slug)), slug).toBe(true);
    }
    expect(tex.swatches['tule-green'].key).toBe('dream-swatch-tule-green-32');
    expect(tex.swatches.obsidian.key).toBe('dream-swatch-obsidian-32');
    expect(new Set(bakes.map((b) => b.key)).size).toBe(bakes.length);
  });

  it('follows the catalogue rarity of each item: the Windsock, Pinwheel and Wave socks Common, the other seven Rare', () => {
    const catalogue = new Map(OPEN_LAKE_TREASURES.map((treasure) => [treasureSlug(treasure.id), treasure.rarity]));
    for (const slug of LAKE_ITEM_SLUGS) expect(catalogue.get(slug), slug).toBe(RARITY_OF[slug]);
    expect(catalogue.get('paint-shell-tule-green')).toBe('common');
    expect(catalogue.get('paint-shell-obsidian')).toBe('rare');
  });

  it('keeps every Area 12 outer fill at 9:1 or more with ink, pale, none a rarity badge fill and none red (issue #214, ND-8)', () => {
    const fills = [...new Set(Object.values(OUTER_FILLS).flat())];
    for (const fill of fills) {
      expect(fill, fill).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
      expect(relativeLuminance(fill), fill).toBeGreaterThanOrEqual(0.607);
      expect(isReddish(fill), `${fill} is not red`).toBe(false);
    }
    // Two are new to the treasure palette, both the pelican line's own (guide 7r); the rest are shipped colours.
    expect([LITTLE_PELICAN_BODY, LITTLE_PELICAN_BILL]).toEqual(['#e8e4f4', '#ffc977']);
    expect(contrastRatio(LITTLE_PELICAN_BODY, INK)).toBeCloseTo(11.54, 1);
    expect(contrastRatio(LITTLE_PELICAN_BILL, INK)).toBeCloseTo(9.51, 1);
    // The real bird's warm orange bill is under 9:1, so the toy bills take the pouch colour.
    expect(contrastRatio(PELICAN_BILL, INK)).toBeLessThan(9);
    expect(fills).toHaveLength(new Set(fills.map((c) => c.toLowerCase())).size);
    // The free snow inside the mountains is never red either.
    expect(isReddish(TWIN_VOLCANO_SNOW)).toBe(false);
  });

  it('shares the shipped colours where the Area 12 fills alias them', () => {
    expect(LITTLE_PELICAN_BODY).toBe(PELICAN_FEATHER);
    expect(LITTLE_PELICAN_BILL).toBe(PELICAN_POUCH);
    expect(WINDSOCK_FILL).toBe(STRIPED_SCARF_FILL);
    expect(WINDSOCK_HOOP).toBe(FIREFLY_HOOK);
    expect(PINWHEEL_BLADES).toEqual([TRAJINERA_BLOSSOM_PINK, TRAJINERA_ARCH]);
    expect(PINWHEEL_PIN).toBe(MARIACHI_JACKET_FILL);
    expect(PINWHEEL_STICK).toBe(DECOY_BODY);
    expect(PINWHEEL_BASE).toBe(FESTIVAL_PLINTH);
    expect(TWIN_VOLCANO_ROCK).toBe(STALACTITE_ROCK);
    expect(TWIN_VOLCANO_SNOW).toBe(CRYSTAL_CROWN_BAND);
    expect(TWIN_VOLCANO_BASE).toBe(PAPER_BOAT_FILL);
    expect(LITTLE_SAILBOAT_HULL).toBe(DECOY_BODY);
    expect(LITTLE_SAILBOAT_SAIL).toBe(SAILOR_CAP_FILL);
    expect(LITTLE_SAILBOAT_MAST).toBe(FIREFLY_HOOK);
    expect(WAVE_SOCKS_FILL).toBe(PAPER_BOAT_FILL);
    expect(CLOUD_SCARF_FILL).toBe(CRYSTAL_CROWN_BAND);
    expect(PELICAN_SWIM_RING_FILL).toBe(LITTLE_PELICAN_BODY);
    expect(PELICAN_SWIM_RING_BILL).toBe(LITTLE_PELICAN_BILL);
    expect(SURFBOARD_FILL).toBe(TRAJINERA_ARCH);
    expect(PELICAN_SLIPPER_FILL).toBe(LITTLE_PELICAN_BODY);
    expect(PELICAN_SLIPPER_BILL).toBe(LITTLE_PELICAN_BILL);
  });

  it.each(LAKE_ITEM_SLUGS.map((slug) => [slug] as const))('%s paints its own Area 12 fills and no other outer colour', (slug) => {
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48));
    const own = OUTER_FILLS[slug].map((c) => c.toLowerCase());
    for (const fill of own) expect(styles, `${slug} uses ${fill}`).toContain(fill);
    for (const style of styles) {
      if (FREE_STYLES.has(style)) continue;
      expect(own, `${slug} paints only its own fills, ${style} is not one`).toContain(style);
    }
  });

  it.each(LAKE_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
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

  it.each(LAKE_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its ink outline at the shipped widths, and keeps the outer ink in the unfound silhouette',
    (slug, size) => {
      const ink = record((ctx) => paintTreasureIcon(ctx, slug, size)).ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK);
      const widths = new Set(ink.map((op) => op.lineWidth));
      const outline = MERGED_SLUGS.includes(slug) ? 5.6 : 2.8;
      expect(widths.has(outline), `${slug} has its ${outline} item outline`).toBe(true);
      for (const width of widths) expect(ALLOWED_INK, `${slug} ink ${width}`).toContain(width);
      if (!MERGED_SLUGS.includes(slug)) expect(widths.has(5.6), `${slug} is not merged`).toBe(false);
      const flat = record((ctx) => paintTreasureSilhouette(ctx, slug, size)).ops.filter(
        (op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === outline,
      );
      expect(flat.length, `${slug} silhouette outer ink`).toBeGreaterThan(0);
    },
  );

  it.each(LAKE_ITEM_SLUGS.flatMap((slug) => SIZES.map((size) => [slug, size] as const)))(
    '%s at %i has its one white shine, and none in the unfound silhouette',
    (slug, size) => {
      const shines = (paint: typeof paintTreasureIcon): number =>
        record((ctx) => paint(ctx, slug, size)).ops.filter((op) => op.op === 'fill' && op.fillStyle === SHINE).length;
      expect(shines(paintTreasureIcon), slug).toBe(1);
      expect(shines(paintTreasureSilhouette), `${slug} silhouette`).toBe(0);
    },
  );

  it('draws every Area 12 unfound silhouette in the flat fill alone, so no icon is told apart by colour', () => {
    for (const slug of [...LAKE_ITEM_SLUGS, ...LAKE_SHELL_SLUGS]) {
      const fills = hexStyles((ctx) => paintTreasureSilhouette(ctx, slug, 32));
      expect([...fills].sort(), slug).toEqual([INK, TREASURE_SILHOUETTE_FILL].map((c) => c.toLowerCase()).sort());
    }
  });

  it('gives every Area 12 item its own outline: no two silhouettes are the same drawing, nor any other item one', () => {
    const silhouetteOf = (slug: TreasureIconSlug): string => callLogDigest((ctx) => paintTreasureSilhouette(ctx, slug, 48));
    const own = LAKE_ITEM_SLUGS.map(silhouetteOf);
    expect(new Set(own).size).toBe(own.length);
    const others = new Set(
      TREASURE_ICON_SLUGS.filter((slug) => !slug.startsWith('paint-shell-') && !LAKE_ITEM_SLUGS.includes(slug)).map(silhouetteOf),
    );
    for (const [i, slugDigest] of own.entries()) expect(others.has(slugDigest), LAKE_ITEM_SLUGS[i]).toBe(false);
  });

  it('draws no letters, numbers or text on any Area 12 item (ADR 0007; issue #214, ND-8)', () => {
    for (const slug of LAKE_ITEM_SLUGS) {
      for (const paint of [paintTreasureIcon, paintTreasureSilhouette]) {
        const text = record((ctx) => paint(ctx, slug, PX)).ops.filter((op) => op.op === 'fillText' || op.op === 'strokeText');
        expect(text, slug).toHaveLength(0);
      }
    }
  });

  it('sets each Rare trim band between two thin ink lines, since the yellow band is only a little apart from the pale fill it crosses', () => {
    const banded: readonly (readonly [TreasureIconSlug, string])[] = [
      ['little-pelican', LITTLE_PELICAN_BODY],
      ['twin-volcanoes', TWIN_VOLCANO_BASE],
      ['little-sailboat', LITTLE_SAILBOAT_HULL],
      ['cloud-scarf', CLOUD_SCARF_FILL],
      ['pelican-swim-ring', PELICAN_SWIM_RING_FILL],
      ['surfboard', SURFBOARD_FILL],
      ['pelican-slippers', PELICAN_SLIPPER_FILL],
    ];
    for (const [slug, fill] of banded) {
      expect(inkLines(slug, 1.2).length, `${slug} trim band lines`).toBeGreaterThanOrEqual(2);
      expect(contrastRatio(BOAT_TRIM, fill), slug).toBeLessThan(1.2);
    }
  });

  describe('rarity ladder (guide 6i)', () => {
    const byRarity = (rarity: Treasure['rarity']): TreasureIconSlug[] => LAKE_ITEM_SLUGS.filter((slug) => RARITY_OF[slug] === rarity);

    it('gives Rare its one yellow trim band and no gem, gold or star', () => {
      expect(byRarity('rare')).toEqual([
        'little-pelican',
        'twin-volcanoes',
        'little-sailboat',
        'cloud-scarf',
        'pelican-swim-ring',
        'surfboard',
        'pelican-slippers',
      ]);
      for (const slug of byRarity('rare')) expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 0, band: 1, glint: 0, star: 0 });
    });

    it('gives Common no trim band, gem, gold or star, and one shine', () => {
      expect(byRarity('common')).toEqual(['windsock', 'pinwheel', 'wave-socks']);
      for (const slug of byRarity('common')) expect(countDetails(slug), slug).toEqual({ shine: 1, gold: 0, band: 0, glint: 0, star: 0 });
    });

    it('has no Epic or Legendary item, so no gem, gold trim or white star anywhere', () => {
      expect([...byRarity('epic'), ...byRarity('legendary')]).toEqual([]);
      for (const slug of LAKE_ITEM_SLUGS) expect(hexStyles((ctx) => paintTreasureIcon(ctx, slug, 48)), slug).not.toContain(TREASURE_STAR);
    });
  });
});

describe('Open lake Area 12 item construction (issue #214)', () => {
  it('draws the Windsock as a striped tapering sock under a round mouth hoop, on a bridle from a top-centre hook ring', () => {
    expect(fillsOf('windsock', WINDSOCK_FILL)).toHaveLength(1);
    // The hook ring and the mouth hoop are pebble A; the hook is top-centre and the highest fill.
    const [hook, hoop] = fillsOf('windsock', WINDSOCK_HOOP);
    expect(centreXOf(hook)).toBeCloseTo(0, 6);
    expect(highestOf(hook)).toBeCloseTo(Math.min(...outerFillsOf('windsock').map(highestOf)), 6);
    expect(commandsIn(hoop, 'ellipse')).toBe(1);
    // The sock's round tail end is the lowest fill edge, out to the right of the hook: it drifts on the breeze.
    const [sock] = fillsOf('windsock', WINDSOCK_FILL);
    expect(lowestOf(sock)).toBeCloseTo(Math.max(...outerFillsOf('windsock').map(lowestOf)), 6);
    expect(commandsIn(sock, 'arc')).toBe(1);
    // Two soft ink stripes across the sock and the hoop's soft opening; the unfound silhouette drops them.
    expect(softInk('windsock').filter((op) => op.op === 'fillRect')).toHaveLength(2);
    expect(softInk('windsock').filter((op) => op.op === 'fill')).toHaveLength(1);
    expect(softInk('windsock', paintTreasureSilhouette)).toHaveLength(0);
    // The bridle stays in the unfound silhouette as outer ink, so the sock never floats free of its hook.
    expect(inkLines('windsock', 1.6, paintTreasureSilhouette).length).toBeGreaterThanOrEqual(1);
    expect(inkLines('windsock', 1.2)).toHaveLength(0);
  });

  it('draws the Pinwheel as four rounded blades in turn pink and teal about a round pin, on a stick in a little mound', () => {
    const [pink, teal] = PINWHEEL_BLADES;
    const blades = record((ctx) => paintTreasureIcon(ctx, 'pinwheel', PX)).ops.filter(
      (op) => op.op === 'fill' && (op.fillStyle === pink || op.fillStyle === teal),
    );
    expect(blades.map((op) => op.fillStyle)).toEqual([pink, teal, pink, teal]);
    // Every blade corner is rounded, so no blade has a sharp point.
    for (const blade of blades) {
      const radii = cornerRadii(blade.args[0] as unknown[][]);
      expect(radii).toHaveLength(3);
      for (const r of radii) expect(r).toBeGreaterThan(0);
    }
    const [pin] = fillsOf('pinwheel', PINWHEEL_PIN);
    expect(commandsIn(pin, 'ellipse')).toBe(1);
    expect(fillsOf('pinwheel', PINWHEEL_STICK)).toHaveLength(1);
    // The mound is the lowest fill edge; the blades are the highest.
    const [mound] = fillsOf('pinwheel', PINWHEEL_BASE);
    const outer = outerFillsOf('pinwheel');
    expect(lowestOf(mound)).toBeCloseTo(Math.max(...outer.map(lowestOf)), 6);
    expect(Math.min(...blades.map(highestOf))).toBeCloseTo(Math.min(...outer.map(highestOf)), 6);
    // A Common item: nothing inside but the one shine.
    expect(inkLines('pinwheel', 1.2)).toHaveLength(0);
  });

  it('draws the Wave socks as one sock with a cuff of two round wave crests and two soft ink waves across the leg', () => {
    const [sock] = fillsOf('wave-socks', WAVE_SOCKS_FILL);
    expect(fillsOf('wave-socks', WAVE_SOCKS_FILL)).toHaveLength(1);
    // The two crests are the cuff's two curves before the leg runs down; the heel and toe are round.
    const cmds = JSON.stringify(sock.args[0]);
    expect(cmds.split('"quadraticCurveTo"').length - 1).toBe(2);
    expect(commandsIn(sock, 'arc')).toBe(1);
    // The waves are soft ink fills (alpha 0.30), never trim; the unfound silhouette drops them.
    expect(softInk('wave-socks')).toHaveLength(2);
    expect(softInk('wave-socks', paintTreasureSilhouette)).toHaveLength(0);
    expect(inkLines('wave-socks', 1.2)).toHaveLength(0);
  });

  it('draws the Twin volcanoes as two snowy stone mountains on a lake plinth, with no crater, smoke, ash or lava (issue #214, ND-8)', () => {
    const mountains = fillsOf('twin-volcanoes', TWIN_VOLCANO_ROCK);
    expect(mountains).toHaveLength(2);
    // Iztaccihuatl, the long low ridge, is drawn first on the left; Popocatepetl, the tall cone, on the right.
    const [iztaccihuatl, popocatepetl] = mountains;
    expect(centreXOf(iztaccihuatl)).toBeLessThan(centreXOf(popocatepetl));
    expect(highestOf(popocatepetl)).toBeLessThan(highestOf(iztaccihuatl));
    // Popocatepetl's peak is the highest fill, and its top is one soft curve, never a point.
    expect(highestOf(popocatepetl)).toBeCloseTo(Math.min(...outerFillsOf('twin-volcanoes').map(highestOf)), 6);
    expect(commandsIn(popocatepetl, 'quadraticCurveTo')).toBe(1);
    // Each carries a snow cap with an ink snow line, inside the mountain; the unfound silhouette drops both.
    expect(fillsOf('twin-volcanoes', TWIN_VOLCANO_SNOW)).toHaveLength(2);
    expect(fillsOf('twin-volcanoes', TWIN_VOLCANO_SNOW, paintTreasureSilhouette)).toHaveLength(0);
    expect(inkLines('twin-volcanoes', 1.2)).toHaveLength(4);
    // No smoke, ash, glow or lava colour anywhere: only stone, snow, the lake plinth, the band and ink.
    const styles = hexStyles((ctx) => paintTreasureIcon(ctx, 'twin-volcanoes', 48));
    expect([...styles].sort()).toEqual([TWIN_VOLCANO_ROCK, TWIN_VOLCANO_SNOW, TWIN_VOLCANO_BASE, BOAT_TRIM, INK].map((c) => c.toLowerCase()).sort());
    for (const fiery of [CANDLE_FLAME_FILL, LANTERN_FLAME, FIREFLY_BULB, PELICAN_BILL]) expect(styles).not.toContain(fiery.toLowerCase());
    // The plinth is the lowest fill edge and carries the band.
    const [plinth] = fillsOf('twin-volcanoes', TWIN_VOLCANO_BASE);
    expect(lowestOf(plinth)).toBeCloseTo(Math.max(...outerFillsOf('twin-volcanoes').map(lowestOf)), 6);
  });

  it('draws the Little sailboat as a deep hull with the band, a mast, a mainsail and a jib, on a cord to a weight', () => {
    expect(fillsOf('little-sailboat', LITTLE_SAILBOAT_HULL)).toHaveLength(1);
    expect(fillsOf('little-sailboat', LITTLE_SAILBOAT_SAIL)).toHaveLength(2);
    const sailboatOps = record((ctx) => paintTreasureIcon(ctx, 'little-sailboat', PX)).ops;
    // Pebble A is the mast and the weight.
    expect(sailboatOps.filter((op) => op.op === 'fill' && op.fillStyle === LITTLE_SAILBOAT_MAST)).toHaveLength(2);
    // Every sail corner is rounded; the mainsail is behind the mast, the jib in front.
    const [mainsail, jib] = fillsOf('little-sailboat', LITTLE_SAILBOAT_SAIL);
    for (const sail of [mainsail, jib]) for (const r of cornerRadii(sail.args[0] as unknown[][])) expect(r).toBeGreaterThan(0);
    expect(centreXOf(mainsail)).toBeLessThan(0);
    expect(centreXOf(jib)).toBeGreaterThan(0);
    // The band's two lines are the only 1.2 lines; the cord stays in the unfound silhouette.
    expect(inkLines('little-sailboat', 1.2)).toHaveLength(2);
    expect(inkLines('little-sailboat', 1.6, paintTreasureSilhouette).length).toBeGreaterThanOrEqual(1);
  });

  it('draws the Cloud scarf as one merged cloud of five band puffs and a tail ending in two puffs, with no line across a joint', () => {
    expect(fillsOf('cloud-scarf', CLOUD_SCARF_FILL)).toHaveLength(8);
    // All the ink first at twice the width, then every fill: no ink line crosses a puff's joint.
    const ops = record((ctx) => paintTreasureIcon(ctx, 'cloud-scarf', PX)).ops;
    const merged = ops.filter((op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 5.6);
    expect(merged).toHaveLength(8);
    const firstFill = ops.findIndex((op) => op.op === 'fill' && op.fillStyle === CLOUD_SCARF_FILL);
    expect(ops.indexOf(merged[merged.length - 1])).toBeLessThan(firstFill);
    expect(inkLines('cloud-scarf', 2.8)).toHaveLength(0);
    // Seven puffs are round; the tail carries the band.
    expect(fillsOf('cloud-scarf', CLOUD_SCARF_FILL).filter((op) => commandsIn(op, 'ellipse') === 1)).toHaveLength(7);
    expect(inkLines('cloud-scarf', 1.2)).toHaveLength(2);
  });

  it('draws the Pelican swim ring as a ring with a hole, under a pelican neck and head with a closed bill', () => {
    const body = fillsOf('pelican-swim-ring', PELICAN_SWIM_RING_FILL);
    expect(body).toHaveLength(3);
    // The ring: an outer ellipse and an inner one drawn the other way round, so the hole stays open.
    const [, ring] = body;
    expect(commandsIn(ring, 'ellipse')).toBe(2);
    expect(JSON.stringify(ring.args[0])).toContain('true');
    // The band crosses the front of the ring, below the hole; the bill is the rightmost part of the bird.
    expect(inkLines('pelican-swim-ring', 1.2)).toHaveLength(3);
    const [bill] = fillsOf('pelican-swim-ring', PELICAN_SWIM_RING_BILL);
    const [neck, , head] = body;
    expect(rightmostOf(bill)).toBeGreaterThan(Math.max(rightmostOf(neck), rightmostOf(head)));
    expect(highestOf(head)).toBeCloseTo(Math.min(...outerFillsOf('pelican-swim-ring').map(highestOf)), 6);
  });

  it('draws the Surfboard as one tilted board with a round nose and tail, an ink stringer and the band', () => {
    const [board] = fillsOf('surfboard', SURFBOARD_FILL);
    expect(fillsOf('surfboard', SURFBOARD_FILL)).toHaveLength(1);
    // Tilted: the nose is up to the right, the tail down to the left.
    const points = pointsOf(board);
    const top = points.reduce((best, p) => (p[1] < best[1] ? p : best));
    const bottom = points.reduce((best, p) => (p[1] > best[1] ? p : best));
    expect(top[0]).toBeGreaterThan(bottom[0]);
    // The nose is a soft curve, never a point.
    expect(commandsIn(board, 'quadraticCurveTo')).toBe(1);
    // The stringer and the band's two lines are the 1.2 lines; the silhouette keeps none.
    expect(inkLines('surfboard', 1.2)).toHaveLength(3);
    expect(inkLines('surfboard', 1.2, paintTreasureSilhouette)).toHaveLength(0);
  });

  it('draws the Pelican slippers as a puffy upper with a soft opening, a round toe head and a closed bill, over an orange sole', () => {
    const body = fillsOf('pelican-slippers', PELICAN_SLIPPER_FILL);
    expect(body).toHaveLength(2);
    // The sole and the bill are the pelican's orange: the sole is the lowest fill, the bill the rightmost.
    const [sole, bill] = fillsOf('pelican-slippers', PELICAN_SLIPPER_BILL);
    const outer = outerFillsOf('pelican-slippers');
    expect(lowestOf(sole)).toBeCloseTo(Math.max(...outer.map(lowestOf)), 6);
    expect(rightmostOf(bill)).toBeCloseTo(Math.max(...outer.map(rightmostOf)), 6);
    // The opening is a soft ink oval inside the upper; the unfound silhouette drops it.
    expect(softInk('pelican-slippers')).toHaveLength(1);
    expect(softInk('pelican-slippers', paintTreasureSilhouette)).toHaveLength(0);
    expect(inkLines('pelican-slippers', 1.2)).toHaveLength(3);
  });

  it.each(PELICAN_SLUGS.map((slug) => [slug] as const))(
    '%s has a closed bill over an empty pouch and a friendly bead eye: it never catches or holds anything (issue #214, ND-8)',
    (slug) => {
      const billColour = slug === 'little-pelican' ? LITTLE_PELICAN_BILL : slug === 'pelican-swim-ring' ? PELICAN_SWIM_RING_BILL : PELICAN_SLIPPER_BILL;
      const bills = fillsOf(slug, billColour).filter((op) => commandsIn(op, 'bezierCurveTo') === 1 && commandsIn(op, 'quadraticCurveTo') === 1);
      expect(bills, slug).toHaveLength(1);
      const [bill] = bills;
      // One closed path: a single start and a close, so the bill is never open.
      expect(commandsIn(bill, 'moveTo'), slug).toBe(1);
      expect(commandsIn(bill, 'closePath'), slug).toBe(1);
      // One bead eye, and the closed bill's seam inside it.
      expect(fillsOf(slug, EYE), slug).toHaveLength(1);
      expect(fillsOf(slug, EYE, paintTreasureSilhouette), slug).toHaveLength(0);
      // Nothing sits in front of the bill tip at the bill's height: every other fill is behind the tip or below the pouch.
      const others = outerFillsOf(slug).filter((op) => op !== bill && JSON.stringify(op.args) !== JSON.stringify(bill.args));
      const tip = rightmostOf(bill);
      const pouch = lowestOf(bill);
      for (const op of others) expect(rightmostOf(op) < tip || highestOf(op) > pouch, slug).toBe(true);
    },
  );

  it('draws the Little pelican as a toy afloat: tail, neck, body and head in the feathers, a long closed bill, a bead eye and a wing line', () => {
    expect(fillsOf('little-pelican', LITTLE_PELICAN_BODY)).toHaveLength(4);
    expect(fillsOf('little-pelican', LITTLE_PELICAN_BILL)).toHaveLength(1);
    expect(fillsOf('little-pelican', DEEP_CANAL_WEIGHT)).toHaveLength(1);
    // The band's two lines, the wing line and the closed bill's seam are the 1.2 lines; the silhouette keeps none.
    expect(inkLines('little-pelican', 1.2)).toHaveLength(4);
    expect(inkLines('little-pelican', 1.2, paintTreasureSilhouette)).toHaveLength(0);
    // The head is the highest fill and the bill is long: more than a third of the icon wide.
    const outer = outerFillsOf('little-pelican');
    const head = fillsOf('little-pelican', LITTLE_PELICAN_BODY).map(highestOf);
    expect(Math.min(...head)).toBeCloseTo(Math.min(...outer.map(highestOf)), 6);
    const [bill] = fillsOf('little-pelican', LITTLE_PELICAN_BILL);
    const xs = pointsOf(bill).map(([x]) => x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(PX / 3);
    // The weight is the lowest fill edge.
    const [weight] = fillsOf('little-pelican', DEEP_CANAL_WEIGHT);
    expect(lowestOf(weight)).toBeCloseTo(Math.max(...outer.map(lowestOf)), 6);
  });
});

describe('Open lake Area 12 Decorations in the Home Tank (issue #214, ND-5)', () => {
  const bakeShipped = (): ReturnType<typeof bakeTankTextures> => {
    bakes.length = 0;
    return bakeTankTextures({} as never, 2, { decorationPx: PX, rand: () => 0.5 });
  };
  const bakeOf = (key: string): BakeCall => bakes.find((b) => b.key === key) as BakeCall;
  const BASED = ['pinwheel', 'little-pelican', 'twin-volcanoes', 'little-sailboat'] as const;
  const FLOATING = ['little-pelican', 'little-sailboat'] as const;

  it('matches the catalogue placement kinds, rarities and standard widths, listed last', () => {
    const decorations = OPEN_LAKE_TREASURES.filter(isDecoration);
    expect(TANK_DECORATION_SLUGS.slice(-5)).toEqual(decorations.map((d) => treasureSlug(d.id)));
    for (const decoration of decorations) {
      const slug = treasureSlug(decoration.id) as TankDecorationSlug;
      expect(decoration.width, decoration.id).toBeUndefined();
      expect(TANK_DECORATION_SHAPES[slug], decoration.id).toEqual({ placement: placementKind(decoration) });
      expect(TANK_DECORATION_BADGES[slug], decoration.id).toBe(badgeShape(decoration.rarity));
    }
    const badges = TANK_DECORATION_BADGES as Readonly<Record<string, BadgeShape>>;
    expect(LAKE_DECORATION_SLUGS.map((slug) => badges[slug])).toEqual(['circle', 'circle', 'diamond', 'diamond', 'diamond']);
    expect(LAKE_DECORATION_SLUGS.map((slug) => TANK_DECORATION_SHAPES[slug].placement)).toEqual([
      'hanging',
      'floor',
      'floating',
      'floor',
      'floating',
    ]);
  });

  it.each(BASED.flatMap((slug) => [48, 80].map((size) => [slug, size] as const)))(
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

  it('rides the Little pelican and the Little sailboat on the waterline, 20 below the top of the 80 box', () => {
    const decks: Readonly<Record<(typeof FLOATING)[number], string>> = { 'little-pelican': LITTLE_PELICAN_BODY, 'little-sailboat': LITTLE_SAILBOAT_HULL };
    for (const slug of FLOATING) {
      // The body or hull top is near the water surface (the waterline is -20 from the icon centre); the head or sails stand in the air.
      const deck = fillsOf(slug, decks[slug]);
      const tops = deck.map(highestOf);
      const back = Math.max(...tops);
      expect(back, slug).toBeLessThan(-20 + 4);
      expect(back, slug).toBeGreaterThan(-20 - 8);
      expect(Math.min(...outerFillsOf(slug).map(highestOf)), slug).toBeLessThan(-20 - 8);
      expect(Math.max(...deck.map(lowestOf)), slug).toBeGreaterThan(-20 + 8);
    }
  });

  it('bakes the Windsock from its icon at 80, hanging from its top-centre hook', () => {
    const tex = bakeShipped();
    const iconFrame = treasureIconTextureSize(PX);
    const sprite = bakeOf(tex.decorations.windsock.key);
    expect(sprite.size).toEqual({ ...iconFrame, originY: iconFrame.originY - PX / 2 });
    expect(sprite.size.originX * 2).toBe(sprite.size.w);
    const before = (ctx: CanvasRenderingContext2D): void => {
      ctx.translate(0, PX / 2);
      paintTreasureIcon(ctx, 'windsock', PX);
    };
    expect(callLogDigest(sprite.paint)).toBe(callLogDigest(before));
    // The hook ring's ink touches the hook point, and the sock's tail reaches the base point one footprint below.
    const reach = inkReach((ctx) => paintTreasureIcon(ctx, 'windsock', PX));
    expect(reach.minY + PX / 2).toBeGreaterThanOrEqual(-0.05);
    expect(reach.minY + PX / 2).toBeLessThan(1);
    expect(reach.maxY + PX / 2).toBeGreaterThan(PX - 1.5);
    expect(reach.maxY + PX / 2).toBeLessThanOrEqual(PX + REACH_TOLERANCE);
  });

  it('centres the Windsock glow on its box, with the sprite anchor at the hook', () => {
    const tex = bakeShipped();
    const glow = bakeOf(tex.decorationGlows.windsock.key);
    const frame = rarityGlowTextureSize(96);
    expect(glow.size).toEqual({ ...frame, originY: frame.originY - PX / 2 });
    const rec = record(glow.paint);
    expect(rec.calls[0]).toEqual(['translate', [0, PX / 2]]);
    expect(parseRgba(rec.gradients[0].stops[0][1]).rgb).toEqual(channelsOf(BADGE_FILL.circle));
  });

  it('glows every Area 12 Decoration in its catalogue rarity: Common and Rare', () => {
    const tex = bakeShipped();
    for (const decoration of OPEN_LAKE_TREASURES.filter(isDecoration)) {
      const slug = treasureSlug(decoration.id) as TankDecorationSlug;
      const rec = record(bakeOf(tex.decorationGlows[slug].key).paint);
      expect(parseRgba(rec.gradients[0].stops[0][1]).rgb, decoration.id).toEqual(channelsOf(BADGE_FILL[badgeShape(decoration.rarity)]));
    }
  });
});

describe('Tule green and Obsidian Paint shells and swatches (issue #214, ND-2)', () => {
  it.each([
    ['tule-green', TULE_GREEN.id, '#043d00'],
    ['obsidian', OBSIDIAN.id, '#1f2925'],
  ] as const)('draws the %s swatch and Paint shell icon as a dark plain tile in its body colour, with the rim light, baked', (id, catalogueId, body) => {
    expect(catalogueId).toBe(id);
    expect(DREAM_SWATCH[id]).toEqual({ body, pattern: 'plain', marks: [], dark: true });
    const icon = hexStyles((ctx) => paintTreasureIcon(ctx, `paint-shell-${id}`, 48));
    const tile = hexStyles((ctx) => paintDreamSwatch(ctx, id, 32));
    expect(icon).toContain(body);
    expect(tile).toContain(body);
    // A dark body: the blob and the tile both get the rim arc, so the dark colour keeps its edge.
    expect(icon).toContain(DREAM_RIM);
    expect(tile).toContain(DREAM_RIM);
    // The Paint shell's own scallop stays the shipped one, so the shell reads as every other Paint shell.
    expect(icon).toContain(PAINT_SHELL_FILL);
  });
});

describe('Open lake Area 12 art digests', () => {
  it('pins the Area 12 icons and swatches as authored, so they change only on purpose', () => {
    for (const size of SIZES) {
      expect(iconDigest(LAKE_DECORATION_SLUGS, size), `decorations ${size}`).toBe(LAKE_DECORATION_DIGESTS[size]);
      expect(iconDigest(LAKE_WEARABLE_SLUGS, size), `wearables ${size}`).toBe(LAKE_WEARABLE_DIGESTS[size]);
      for (const slug of LAKE_SHELL_SLUGS) expect(iconDigest([slug], size), `${slug} ${size}`).toBe(LAKE_SHELL_DIGESTS[slug][size]);
    }
    expect(swatchDigest('tule-green'), 'tule-green swatch').toBe(TULE_GREEN_SWATCH_DIGEST);
    expect(swatchDigest('obsidian'), 'obsidian swatch').toBe(OBSIDIAN_SWATCH_DIGEST);
  });
});
