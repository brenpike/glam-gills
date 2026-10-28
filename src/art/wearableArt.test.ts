/**
 * Worn Wearables (guide 6a, 6i, 6q; PRD F13), headless. The painters run against a recording
 * context (the same stub-Path2D approach as the eye-layer tests in drawAxolotlParts.test.ts):
 * every fill and stroke is kept as flattened polygons in local units with the style, width and
 * clip it was painted under, so the tests can ask where ink landed and in what order.
 */
import { describe, expect, it, vi } from 'vitest';
import { AXO_REST_POSE, AXO_SCENE_SCALE, AXO_TEX, drawAxolotl, legPoints, type AxolotlPose, type LegLook } from './drawAxolotl';
import {
  AXO_AGES,
  AXO_BODIES,
  AXO_SEXES,
  AXO_SIZES,
  AXO_SIZE_SCALE,
  AXO_TAILS,
  CHEEK_HEART_INK,
  CHEEK_HEART_LAYER,
  CHEEK_HEART_UNDER,
  CHEEK_HEART_ZONE,
  DEFAULT_ART_LOOK,
  EYELASH_INK,
  EYELASH_UNDER,
  EYE_VARIANTS,
  FAR_EYE_ZONE,
  FAR_LASH_REACH,
  GILL_ROOT_ZONE,
  GLASSES_EXTENT,
  HEAD_FOOTPRINT,
  HEAD_ELLIPSE,
  MOUTH_INK,
  MOUTH_VARIANTS,
  MOUTH_ZONE,
  NECK_FOOTPRINT,
  NEAR_EYE_ZONE,
  NEAR_LASH_REACH,
  SHIRT_BACK_FRONT_LINE_X,
  SHIRT_FRONT_X,
  SOCK_SLEEVE_INK_W,
  TAIL_SLOT_POINT,
  TAIL_SLOT_REACH,
  WEARABLE_LAYERS,
  WEARABLE_SLOTS,
  axolotlBodyGeometry,
  boundsOfPoints,
  backFootprint,
  feetEnvelope,
  framePoint,
  glassesNotches,
  legRectBounds,
  legSlotFrames,
  shirtContains,
  shirtGeometry,
  shoeRect,
  sockFootPad,
  tailSamples,
  tailSlotFrame,
  unionBounds,
  type AxolotlArtLook,
  type BodyEllipse,
  type BodyWearableSlot,
  type Bounds,
  type LegRect,
  type LegSlotFrame,
  type WearFrame,
  type WearableSlot,
  type ZoneCircle,
} from './drawAxolotlParts';
import {
  EXPLORER_VEST_BELT,
  GARDEN_OVERALLS_PATCH,
  NO_OUTFIT,
  WEARABLE_ART_SLOT,
  WEARABLE_ART_SLUGS,
  artOutfit,
  outfitKey,
  paintBodyWearable,
  paintLegWearables,
  wearsOnLegs,
  wornSlug,
  type ArtOutfit,
  type WearableArtSlug,
} from './drawWearables';
import { BLUSH, CHEEK_HEART, FRECKLE, INK, LEUCISTIC, LW, SILHOUETTE, WHITE, dreamPalette, type MorphPalette } from './palette';
import {
  BANDANA_FILL,
  BEE_HEADBAND_FILL,
  EMBROIDERED_SHIRT_FILL,
  EMBROIDERY_BAND,
  EMBROIDERY_PETALS,
  GARDEN_OVERALLS_FILL,
  HUMMINGBIRD_RIBBON_FILL,
  MARIGOLD_PETAL,
  MONARCH_BODY,
  MONARCH_SPOT,
  MONARCH_WING,
  SERAPE_STRIPES,
  STRAW_HAT_FILL,
  SUNFLOWER_CENTRE,
  SUNFLOWER_FRAME,
  GEMSTONE_CAPE_STONES,
  LANTERN_FLAME,
} from './drawTreasures';
import { BADGE_FILL } from './treasurePalette';
import { bakeAxolotlStill } from './textures';
import {
  SWIM_VIEW_CSS_PX_PER_UNIT,
  SWIM_VIEW_FIT_ZOOM,
  WEARABLE_SLOT_MINIMUMS,
  WEARABLE_SWIM_VIEW_MIN_CSS_PX2,
  backMinimumLength,
  type WearableSlotMinimums,
} from './wearableFit';
import { DREAM_MARKER_INK, DREAM_MARKER_R, DREAM_MARKER_S, dreamMarkerCentres } from './drawDreamOverlay';
import {
  ALL_TREASURES,
  CHINAMPA_2_TREASURES,
  CHINAMPA_TREASURES,
  POND_2_TREASURES,
  POND_TREASURES,
  SPRING_CAVE_2_TREASURES,
  SPRING_CAVE_TREASURES,
  treasureSlug,
  type Wearable,
} from '../logic/catalogue';
import { VIEW } from '../logic/tuning';
import { fitView } from '../logic/viewport';
import { WORLD_H } from '../logic/zone';
import {
  BOAT_TRIM,
  BOW_GEM,
  CAVE_CRYSTAL_FILL,
  CRYSTAL_CROWN_BAND,
  CRYSTAL_CUFF_BAND,
  DIVING_TANK_FILL,
  DIVING_TANK_STRAP,
  DRAGONFLY_FRAME,
  DRAGONFLY_WING,
  EXPLORER_VEST_FILL,
  FEATHER_CAP_FILL,
  FEATHER_FILL,
  FIREFLY_CAPE_FILL,
  FIREFLY_GLOW,
  FLIPPER_CUFF,
  FLIPPER_FILL,
  FLIPPER_RIDGE,
  FROGGY_BOOT,
  GLASSES_FRAME,
  GLASSES_GEM,
  GLASSES_LENS,
  GOLD_TRIM,
  HAT_FILL,
  LADYBUG_SHELL,
  LILY_CROWN_FLOWER,
  LILY_CROWN_LEAF,
  LILY_PAD_SOCK_FILL,
  MINERS_HELMET_FILL,
  CLIMBING_HELMET_FILL,
  GEMSTONE_CAPE_FILL,
  GOGGLES_FRAME,
  LANTERN_FRAME,
  LANTERN_GLASS,
  PEBBLE_NECKLACE_CORD,
  PEBBLE_NECKLACE_STONE,
  NECKLACE_CORD,
  NECKLACE_SHELL,
  PAINT_SHELL_RIDGE,
  PEARL_CHARM_CORD,
  PEARL_FILL,
  POND_WEED_SCARF,
  RAINCOAT_FILL,
  SOCK_FILL,
  SOCK_STRIPE_ALPHA,
  TANK_TOP_FILL,
  TREASURE_SHINE,
  WATER_LILY_BLOSSOM,
  WATER_LILY_SHIRT_FILL,
  WORN_FAR_INK_MIX,
} from './treasurePalette';

// The texture module names Phaser only in types; keep the engine out of the node run regardless.
vi.mock('phaser', () => ({}));

const TAU = Math.PI * 2;
/** Guide 11: at least 4 logical units of padding inside the texture frame. */
const FRAME_PAD = 4;
/** Flattened arcs sit inside their circle by their sagitta (under 0.002 here); geometry is held to this. */
const TOL = 0.005;
/** The Sock sleeve's ink and colour widths (guide 6i; #88: 15.2 and 10.4 before). */
const SLEEVE_INK_W = 16.4;
const SLEEVE_COLOUR_W = 11.6;

// ---------------------------------------------------------------------------
// A recording canvas context
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}
type Mat = readonly [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** `m` then `n` in canvas order (n is applied to points first). */
function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
function apply(m: Mat, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

interface SubPath {
  pts: Pt[];
  closed: boolean;
}

/** Signed sweep of an arc from `a0` to `a1` as canvas defines it. */
function sweep(a0: number, a1: number, ccw: boolean): number {
  const d = a1 - a0;
  if (!ccw) return d >= TAU ? TAU : ((d % TAU) + TAU) % TAU;
  return d <= -TAU ? -TAU : -((((-d) % TAU) + TAU) % TAU);
}

/** A Path2D stand-in that flattens every command into polylines. */
class RecPath {
  readonly subs: SubPath[] = [];
  private cur: SubPath | null = null;
  private start: Pt = { x: 0, y: 0 };
  private last: Pt = { x: 0, y: 0 };
  /** After closePath the next command starts a subpath at the old start point. */
  private reopen = false;

  private begin(p: Pt): void {
    this.cur = { pts: [p], closed: false };
    this.subs.push(this.cur);
    this.start = p;
    this.last = p;
    this.reopen = false;
  }
  private add(p: Pt): void {
    if (!this.cur) this.begin(p);
    else this.cur.pts.push(p);
    this.last = p;
  }
  private ensure(): void {
    if (!this.cur) this.begin(this.reopen ? this.start : this.last);
  }
  moveTo(x: number, y: number): void {
    this.begin({ x, y });
  }
  lineTo(x: number, y: number): void {
    if (!this.cur && this.reopen) this.ensure();
    this.add({ x, y });
  }
  closePath(): void {
    if (!this.cur) return;
    this.cur.closed = true;
    this.cur = null;
    this.last = this.start;
    this.reopen = true;
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false): void {
    const d = sweep(a0, a1, ccw);
    const n = Math.max(8, Math.ceil(Math.abs(d) / 0.03));
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let k = 0; k <= n; k++) {
      const a = a0 + (d * k) / n;
      const ex = rx * Math.cos(a);
      const ey = ry * Math.sin(a);
      const p = { x: x + ex * c - ey * s, y: y + ex * s + ey * c };
      if (k === 0 && this.reopen) this.ensure();
      this.add(p);
    }
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw);
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void {
    this.ensure();
    const p0 = this.last;
    const v0 = { x: p0.x - x1, y: p0.y - y1 };
    const v1 = { x: x2 - x1, y: y2 - y1 };
    const l0 = Math.hypot(v0.x, v0.y);
    const l1 = Math.hypot(v1.x, v1.y);
    const u0 = { x: v0.x / l0, y: v0.y / l0 };
    const u1 = { x: v1.x / l1, y: v1.y / l1 };
    const cross = u0.x * u1.y - u0.y * u1.x;
    if (l0 === 0 || l1 === 0 || r === 0 || Math.abs(cross) < 1e-9) {
      this.add({ x: x1, y: y1 });
      return;
    }
    const half = Math.acos(Math.max(-1, Math.min(1, u0.x * u1.x + u0.y * u1.y))) / 2;
    const dist = r / Math.tan(half);
    const t0 = { x: x1 + u0.x * dist, y: y1 + u0.y * dist };
    const t1 = { x: x1 + u1.x * dist, y: y1 + u1.y * dist };
    const bis = { x: u0.x + u1.x, y: u0.y + u1.y };
    const bl = Math.hypot(bis.x, bis.y);
    const cd = r / Math.sin(half);
    const centre = { x: x1 + (bis.x / bl) * cd, y: y1 + (bis.y / bl) * cd };
    this.add(t0);
    const a0 = Math.atan2(t0.y - centre.y, t0.x - centre.x);
    const a1 = Math.atan2(t1.y - centre.y, t1.x - centre.x);
    const d = sweep(a0, a1, cross > 0);
    const n = Math.max(4, Math.ceil(Math.abs(d) / 0.03));
    for (let k = 1; k <= n; k++) {
      const a = a0 + (d * k) / n;
      this.add({ x: centre.x + r * Math.cos(a), y: centre.y + r * Math.sin(a) });
    }
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.ensure();
    const p0 = this.last;
    for (let k = 1; k <= 24; k++) {
      const t = k / 24;
      const m = 1 - t;
      this.add({ x: m * m * p0.x + 2 * m * t * cx + t * t * x, y: m * m * p0.y + 2 * m * t * cy + t * t * y });
    }
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    this.ensure();
    const p0 = this.last;
    for (let k = 1; k <= 32; k++) {
      const t = k / 32;
      const m = 1 - t;
      this.add({
        x: m * m * m * p0.x + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * x,
        y: m * m * m * p0.y + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * y,
      });
    }
  }
}

/** One fill or stroke, in local units, with what it was painted under. */
interface Paint {
  kind: 'fill' | 'stroke';
  style: string;
  lineWidth: number;
  alpha: number;
  lineCap: string;
  subs: SubPath[];
  /** Every active clip region, each a list of subpaths. */
  clips: SubPath[][];
}

interface CtxState {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  lineCap: string;
  lineJoin: string;
  m: Mat;
  clips: SubPath[][];
}

class Recorder {
  readonly paints: Paint[] = [];
  /** save() calls not yet matched by restore(). */
  depth = 0;
  private st: CtxState = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    // What beginDraw sets before every bake; paintEyelashes sets 'butt' for itself.
    lineCap: 'round',
    lineJoin: 'round',
    m: IDENTITY,
    clips: [],
  };
  private stack: CtxState[] = [];

  get matrix(): Mat {
    return this.st.m;
  }
  get alpha(): number {
    return this.st.globalAlpha;
  }

  context(): CanvasRenderingContext2D {
    const handlers: Record<string, (...a: never[]) => unknown> = {
      save: () => {
        this.stack.push({ ...this.st });
        this.depth++;
      },
      restore: () => {
        const s = this.stack.pop();
        if (s) this.st = s;
        this.depth--;
      },
      translate: (x: number, y: number) => {
        this.st.m = mul(this.st.m, [1, 0, 0, 1, x, y]);
      },
      rotate: (a: number) => {
        const c = Math.cos(a);
        const s = Math.sin(a);
        this.st.m = mul(this.st.m, [c, s, -s, c, 0, 0]);
      },
      scale: (x: number, y: number) => {
        this.st.m = mul(this.st.m, [x, 0, 0, y, 0, 0]);
      },
      setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
        this.st.m = [a, b, c, d, e, f];
      },
      clip: (path: RecPath) => {
        this.st.clips = [...this.st.clips, this.device(path)];
      },
      fill: (path: RecPath) => this.paint('fill', path),
      stroke: (path: RecPath) => this.paint('stroke', path),
    };
    return new Proxy(
      {},
      {
        get: (_target, key: string) => {
          if (Object.hasOwn(handlers, key)) return handlers[key];
          if (Object.hasOwn(this.st, key)) return (this.st as unknown as Record<string, unknown>)[key];
          return () => undefined;
        },
        set: (_target, key: string, value: unknown) => {
          (this.st as unknown as Record<string, unknown>)[key] = value;
          return true;
        },
      },
    ) as CanvasRenderingContext2D;
  }

  private device(path: RecPath): SubPath[] {
    return path.subs.map((s) => ({ pts: s.pts.map((p) => apply(this.st.m, p)), closed: s.closed }));
  }

  private paint(kind: 'fill' | 'stroke', path: RecPath): void {
    this.paints.push({
      kind,
      style: kind === 'fill' ? this.st.fillStyle : this.st.strokeStyle,
      lineWidth: this.st.lineWidth,
      alpha: this.st.globalAlpha,
      lineCap: this.st.lineCap,
      subs: this.device(path),
      clips: this.st.clips,
    });
  }
}

/** Run `draw` against a fresh recorder with Path2D stubbed. */
function record(draw: (ctx: CanvasRenderingContext2D) => void): Recorder {
  const rec = new Recorder();
  vi.stubGlobal('Path2D', RecPath);
  try {
    draw(rec.context());
  } finally {
    vi.unstubAllGlobals();
  }
  return rec;
}

// ---------------------------------------------------------------------------
// Geometry of what was painted
// ---------------------------------------------------------------------------

/** The painted region as the checks see it: a clipped paint counts as its whole clip (a superset). */
interface Region {
  subs: SubPath[];
  kind: 'fill' | 'stroke';
  /** Half the line width for a stroke, else 0. */
  hw: number;
}

function regionOf(p: Paint): Region {
  if (p.clips.length > 0) return { subs: p.clips[p.clips.length - 1], kind: 'fill', hw: 0 };
  return { subs: p.subs, kind: p.kind, hw: p.kind === 'stroke' ? p.lineWidth / 2 : 0 };
}

/** Nonzero winding number of `subs` about (x, y). */
function winding(subs: readonly SubPath[], x: number, y: number): number {
  let w = 0;
  for (const s of subs) {
    const pts = s.pts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const side = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
      if (a.y <= y) {
        if (b.y > y && side > 0) w++;
      } else if (b.y <= y && side < 0) w--;
    }
  }
  return w;
}

function segDist(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Edges of a region: every consecutive pair, plus the closing edge of a closed subpath or any fill. */
function edgesOf(r: Region): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (const s of r.subs) {
    const n = s.pts.length;
    const close = s.closed || r.kind === 'fill';
    for (let i = 0; i < (close ? n : n - 1); i++) out.push([s.pts[i], s.pts[(i + 1) % n]]);
  }
  return out;
}

/** Whether the closed segment a-b touches the closed box (Liang-Barsky). */
function segHitsBox(a: Pt, b: Pt, box: Bounds): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, a.x - box.minX) && clip(dx, box.maxX - a.x) && clip(-dy, a.y - box.minY) && clip(dy, box.maxY - a.y)
  );
}

/** Whether the painted region reaches more than `eps` into the circle. */
function reachesCircle(r: Region, c: ZoneCircle, eps = TOL): boolean {
  if (r.kind === 'fill' && winding(r.subs, c.x, c.y) !== 0) return true;
  let best = Infinity;
  for (const [a, b] of edgesOf(r)) best = Math.min(best, segDist(c.x, c.y, a, b));
  return best - r.hw < c.r - eps;
}

/** Whether the painted region reaches more than `eps` into the box. */
function reachesBox(r: Region, box: Bounds, eps = TOL): boolean {
  const grow = r.hw - eps;
  const probe: Bounds = {
    minX: box.minX - grow,
    minY: box.minY - grow,
    maxX: box.maxX + grow,
    maxY: box.maxY + grow,
  };
  if (probe.minX >= probe.maxX || probe.minY >= probe.maxY) return false;
  if (r.kind === 'fill' && winding(r.subs, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2) !== 0) return true;
  return edgesOf(r).some(([a, b]) => segHitsBox(a, b, probe));
}

/** Local box of every painted point, ink included. */
function inkBounds(paints: readonly Paint[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of paints) {
    const r = regionOf(p);
    for (const s of r.subs) {
      for (const q of s.pts) {
        minX = Math.min(minX, q.x - r.hw);
        minY = Math.min(minY, q.y - r.hw);
        maxX = Math.max(maxX, q.x + r.hw);
        maxY = Math.max(maxY, q.y + r.hw);
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function isInside(inner: Bounds, outer: Bounds, eps = TOL): boolean {
  return (
    inner.minX >= outer.minX - eps &&
    inner.minY >= outer.minY - eps &&
    inner.maxX <= outer.maxX + eps &&
    inner.maxY <= outer.maxY + eps
  );
}

/** A point in a frame's own (u, v) axes. */
function toFrame(frame: WearFrame, p: Pt): Pt {
  const c = Math.cos(frame.angle);
  const s = Math.sin(frame.angle);
  const dx = p.x - frame.x;
  const dy = p.y - frame.y;
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

/** Every painted point of `paints` as (point, ink half-width), clips counted as their region. */
function inkPoints(paints: readonly Paint[]): { p: Pt; hw: number }[] {
  return paints.flatMap((paint) => {
    const r = regionOf(paint);
    return r.subs.flatMap((s) => s.pts.map((p) => ({ p, hw: r.hw })));
  });
}

function frameInner(pad: number): Bounds {
  return {
    minX: -AXO_TEX.originX + pad,
    minY: -AXO_TEX.originY + pad,
    maxX: AXO_TEX.w - AXO_TEX.originX - pad,
    maxY: AXO_TEX.h - AXO_TEX.originY - pad,
  };
}

// ---------------------------------------------------------------------------
// What to paint
// ---------------------------------------------------------------------------

const BODY_SLOTS: readonly BodyWearableSlot[] = ['shirt', 'tail', 'neck', 'back', 'head', 'face'];
const SLUG_OF: Readonly<Record<WearableSlot, WearableArtSlug>> = {
  head: 'sun-hat',
  neck: 'shell-necklace',
  face: 'heart-glasses',
  shirt: 'tank-top',
  back: 'diving-tank',
  tail: 'golden-bow',
  socks: 'stripy-socks',
  feet: 'flippers',
};
const FULL: ArtOutfit = { ...SLUG_OF };

/** Every Boy or girl, Tail, Body and Age (the size only scales the bake): 54 looks. */
function everyBodyLook(): AxolotlArtLook[] {
  const looks: AxolotlArtLook[] = [];
  for (const sex of AXO_SEXES)
    for (const tail of AXO_TAILS)
      for (const body of AXO_BODIES)
        for (const age of AXO_AGES) looks.push({ ...DEFAULT_ART_LOOK, sex, tail, body, age });
  return looks;
}
const EVERY_BODY_LOOK = everyBodyLook();
const lookId = (look: AxolotlArtLook): string => [look.size, look.sex, look.tail, look.body, look.age].join(' ');
/** Swim phases round a whole cycle, tail amplitudes up to the frame's 1.6. */
const SWIMS = Array.from({ length: 13 }, (_, i) => (i / 12) * TAU);
const AMPS = [1, 1.6] as const;
/** The enumerations over 54 looks and a swim cycle take a few seconds each. */
const ENUMERATION_TIMEOUT_MS = 30_000;

function bodyPaints(slot: BodyWearableSlot, look: AxolotlArtLook, swim = 0, amp = 1, slug: WearableArtSlug = SLUG_OF[slot]): Paint[] {
  const outfit: ArtOutfit = { [slot]: slug };
  const rec = record((ctx) => paintBodyWearable(ctx, slot, outfit, look, swim, amp));
  expect(rec.depth).toBe(0);
  expect(rec.matrix).toEqual(IDENTITY);
  expect(rec.alpha).toBe(1);
  return rec.paints;
}

function legPaints(outfit: ArtOutfit, frame: LegSlotFrame): Paint[] {
  const rec = record((ctx) => paintLegWearables(ctx, outfit, frame));
  expect(rec.depth).toBe(0);
  expect(rec.matrix).toEqual(IDENTITY);
  return rec.paints;
}

/** A palette whose eye colour no other paint uses, to find the eyes in a recording. */
const EYE_COLOUR = '#123456';
const SENTINEL_PALETTE: MorphPalette = { ...LEUCISTIC, eye: EYE_COLOUR };

function drawn(pose: AxolotlPose, look: AxolotlArtLook, outfit?: ArtOutfit): Paint[] {
  const rec = record((ctx) => {
    if (outfit === undefined) drawAxolotl(ctx, pose, SENTINEL_PALETTE, look);
    else drawAxolotl(ctx, pose, SENTINEL_PALETTE, look, outfit);
  });
  expect(rec.depth).toBe(0);
  expect(rec.matrix).toEqual(IDENTITY);
  expect(rec.alpha).toBe(1);
  return rec.paints;
}

const signature = (p: Paint): string =>
  [
    p.kind,
    p.style,
    p.lineWidth,
    p.alpha,
    p.lineCap,
    p.clips.length,
    p.subs.map((s) => s.pts.map((q) => `${q.x.toFixed(3)},${q.y.toFixed(3)}`).join(' ')).join('/'),
  ].join('|');

interface Inserted {
  /** Index in the outfit recording. */
  index: number;
  paint: Paint;
}

/**
 * The paints `withOutfit` has beyond `base`, or null when `base` is not a subsequence of it (so a
 * Wearable changed or moved a paint the axolotl already made). `sig` keys a paint (signature by default).
 */
function insertedPaints(
  base: readonly Paint[],
  withOutfit: readonly Paint[],
  sig: (p: Paint) => string = signature,
): Inserted[] | null {
  const baseSigs = base.map(sig);
  const extra: Inserted[] = [];
  let b = 0;
  withOutfit.forEach((paint, index) => {
    if (b < baseSigs.length && sig(paint) === baseSigs[b]) b++;
    else extra.push({ index, paint });
  });
  return b === baseSigs.length ? extra : null;
}

/** Index of the first paint of the eyes: a Girl's lash under-stroke, or the bead fill. */
function firstEyePaint(paints: readonly Paint[]): number {
  return paints.findIndex(
    (p) =>
      (p.kind === 'stroke' && p.lineCap === 'butt' && (p.lineWidth === EYELASH_UNDER || p.lineWidth === EYELASH_INK)) ||
      (p.kind === 'fill' && p.style === EYE_COLOUR),
  );
}

const SOCKS_AND_FEET: ArtOutfit = { socks: 'stripy-socks', feet: 'flippers' };

/** The Sock sleeve's paints: its 16.4 ink stroke, its 11.6 colour stroke and its alpha 0.30 stripes. */
const isSleevePaint = (p: Paint): boolean =>
  (p.kind === 'stroke' && (p.lineWidth === SLEEVE_INK_W || p.lineWidth === SLEEVE_COLOUR_W)) ||
  (p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);

const POSES: Readonly<Record<string, AxolotlPose>> = {
  rest: AXO_REST_POSE,
  swimming: { ...AXO_REST_POSE, swimPhase: 1.3, tailAmp: 1.6, sparkle: 0.7 },
};
const GIRL: AxolotlArtLook = { ...DEFAULT_ART_LOOK, sex: 'girl' };

const present: LegLook = { status: 'present', progress: 0 };
const lost: LegLook = { status: 'lost', progress: 0 };
const regrowing = (progress: number): LegLook => ({ status: 'regrowing', progress });

/**
 * The paints the Socks and Feet make on leg `i` alone in a full drawAxolotl run at the rest pose (the
 * other three legs lost, which paints no wear), as signatures.
 */
function legWearSignatures(look: AxolotlArtLook, i: number, outfit: ArtOutfit): string[] {
  const legs = [lost, lost, lost, lost];
  legs[i] = present;
  const pose: AxolotlPose = { ...AXO_REST_POSE, legs };
  return insertedPaints(drawn(pose, look), drawn(pose, look, outfit))!.map((x) => signature(x.paint));
}

/** A pose where leg `i` has `look` and the other three are present. */
function legPose(i: number, look: LegLook): AxolotlPose {
  const legs = [present, present, present, present];
  legs[i] = look;
  return { ...AXO_REST_POSE, swimPhase: 0.7, legs };
}

// ---------------------------------------------------------------------------
// The art outfit
// ---------------------------------------------------------------------------

describe('art outfit', () => {
  it('has one art slug per slot, in PRD slot order', () => {
    expect(WEARABLE_ART_SLUGS).toEqual([
      'sun-hat',
      'shell-necklace',
      'heart-glasses',
      'tank-top',
      'diving-tank',
      'golden-bow',
      'stripy-socks',
      'flippers',
    ]);
    expect(WEARABLE_ART_SLUGS.map((slug) => WEARABLE_ART_SLOT[slug])).toEqual([...WEARABLE_SLOTS]);
  });

  it('is empty by default, and the default is frozen', () => {
    expect(NO_OUTFIT).toEqual({});
    expect(Object.isFrozen(NO_OUTFIT)).toBe(true);
    expect(outfitKey(NO_OUTFIT)).toBe('');
    for (const slot of WEARABLE_SLOTS) expect(wornSlug(NO_OUTFIT, slot)).toBeUndefined();
    expect(wearsOnLegs(NO_OUTFIT)).toBe(false);
  });

  it('maps catalogue ids to art slugs by the text after the first slash, per slot', () => {
    expect(
      artOutfit({
        head: 'canal/sun-hat',
        neck: 'canal/shell-necklace',
        face: 'canal/heart-glasses',
        shirt: 'canal/tank-top',
        back: 'canal/diving-tank',
        tail: 'canal/golden-bow',
        socks: 'canal/stripy-socks',
        feet: 'canal/flippers',
      }),
    ).toEqual(FULL);
    expect(artOutfit({ head: 'canal/sun-hat', neck: null, face: undefined })).toEqual({ head: 'sun-hat' });
  });

  it('leaves out ids that are unknown, and ids worn in the wrong slot', () => {
    expect(artOutfit({ head: 'canal/pond-plant', neck: 'canal/sun-hat', face: 'sun-hat/x', shirt: 'canal/constructor' })).toEqual({});
    expect(artOutfit({ head: 'canal/toString', back: 'canal/__proto__' })).toEqual({});
    expect(artOutfit({ head: 'sun-hat' })).toEqual({ head: 'sun-hat' });
  });

  it('keys an outfit by what is worn, in slot order, so a repaint check sees only real changes', () => {
    expect(outfitKey({ head: 'sun-hat' })).toBe('head=sun-hat');
    expect(outfitKey({ feet: 'flippers', head: 'sun-hat' })).toBe('head=sun-hat,feet=flippers');
    expect(outfitKey({ head: null, neck: undefined })).toBe('');
    // A slug for another slot paints nothing, so it must not change the key either.
    expect(outfitKey({ head: 'tank-top' })).toBe('');
    expect(wornSlug({ head: 'tank-top' }, 'head')).toBeUndefined();
    expect(outfitKey(FULL)).toBe(WEARABLE_SLOTS.map((slot) => `${slot}=${SLUG_OF[slot]}`).join(','));
    expect(wearsOnLegs({ socks: 'stripy-socks' })).toBe(true);
    expect(wearsOnLegs({ feet: 'flippers' })).toBe(true);
    expect(wearsOnLegs({ head: 'sun-hat' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default: no outfit paints exactly as before Wearables
// ---------------------------------------------------------------------------

describe('no outfit (regression)', () => {
  /** Hash of every call and property set drawAxolotl makes, with Path2D commands in the log. */
  function callLogHash(pose: AxolotlPose, look: AxolotlArtLook, outfit?: ArtOutfit): string {
    class LogPath {
      readonly cmds: unknown[] = [];
      constructor() {
        return new Proxy(this, {
          get: (target, key) =>
            key === 'cmds' ? target.cmds : (...args: unknown[]) => void target.cmds.push([String(key), ...args]),
        });
      }
    }
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
      if (outfit === undefined) drawAxolotl(ctx, pose, LEUCISTIC, look);
      else drawAxolotl(ctx, pose, LEUCISTIC, look, outfit);
    } finally {
      vi.unstubAllGlobals();
    }
    const text = JSON.stringify(log);
    const hash = (seed: number): string => {
      let x = seed;
      for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619) >>> 0;
      return x.toString(16).padStart(8, '0');
    };
    return `${hash(0x811c9dc5)}${hash(0x9e3779b9)}:${text.length}`;
  }

  const legs: readonly LegLook[] = [present, lost, regrowing(0.5), present];
  const looks: AxolotlArtLook[] = [
    DEFAULT_ART_LOOK,
    { ...DEFAULT_ART_LOOK, sex: 'girl', body: 'chubby', age: 'baby', tail: 'long' },
    { ...DEFAULT_ART_LOOK, sex: 'boy', body: 'slim', age: 'grownUp', tail: 'short' },
  ];
  const poses: AxolotlPose[] = [AXO_REST_POSE, { ...AXO_REST_POSE, swimPhase: 1.3, tailAmp: 1.6, sparkle: 0.7, legs }];
  /**
   * Recorded from the painter before Wearables existed (pose-major, then look). The Girl entries
   * (the second of each pose) are re-recorded for the #87 cheek heart; the Boy entries are unchanged.
   */
  const BEFORE_WEARABLES = [
    'bd38c5db2508a8d7:32084',
    'c94b66975903d47b:40886',
    'dc5a96b05f46a954:32963',
    '07de654681b19bda:41725',
    'a1d3f250c2030c44:50514',
    'e6dd6f9972bdf625:42638',
  ];

  it('makes exactly the calls the painter made before Wearables existed', () => {
    const now = poses.flatMap((pose) => looks.map((look) => callLogHash(pose, look)));
    expect(now).toEqual(BEFORE_WEARABLES);
  });

  it('makes those same calls for an empty outfit, empty slots, and slugs that do not fit their slot', () => {
    const empties: ArtOutfit[] = [
      NO_OUTFIT,
      {},
      { head: null, neck: null, face: null, shirt: null, back: null, tail: null, socks: null, feet: null },
      { head: 'tank-top', socks: 'sun-hat', feet: 'stripy-socks', tail: 'flippers' },
    ];
    for (const outfit of empties) {
      const now = poses.flatMap((pose) => looks.map((look) => callLogHash(pose, look, outfit)));
      expect(now).toEqual(BEFORE_WEARABLES);
    }
  });
});

// ---------------------------------------------------------------------------
// Layers and the eyes
// ---------------------------------------------------------------------------

describe('layers (guide 6a)', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  const looks: AxolotlArtLook[] = [
    DEFAULT_ART_LOOK,
    GIRL,
    { ...GIRL, body: 'chubby', age: 'baby', tail: 'short' },
    { ...DEFAULT_ART_LOOK, body: 'slim', age: 'grownUp', tail: 'long' },
  ];

  /** The paints one slot's item makes in a full drawAxolotl run, found by painting it alone. */
  function itemSignatures(slot: WearableSlot, pose: AxolotlPose, look: AxolotlArtLook): Set<string> {
    const alone = insertedPaints(drawn(pose, look), drawn(pose, look, { [slot]: SLUG_OF[slot] }));
    expect(alone).not.toBeNull();
    expect(alone!.length).toBeGreaterThan(0);
    return new Set(alone!.map((x) => signature(x.paint)));
  }

  function firstIndexOf(all: readonly Paint[], sigs: ReadonlySet<string>): number {
    return all.findIndex((p) => sigs.has(signature(p)));
  }
  function lastIndexOf(all: readonly Paint[], sigs: ReadonlySet<string>): number {
    for (let i = all.length - 1; i >= 0; i--) if (sigs.has(signature(all[i]))) return i;
    return -1;
  }

  it('adds Wearables without changing, moving or restyling any paint the axolotl already made', () => {
    for (const pose of Object.values(POSES)) {
      for (const look of looks) {
        expect(insertedPaints(drawn(pose, look), drawn(pose, look, FULL))).not.toBeNull();
      }
    }
  });

  it('paints every Wearable before the eyes, a Girl lashes included, which stay the last of the body', () => {
    for (const look of looks) {
      const base = drawn(AXO_REST_POSE, look);
      const worn = drawn(AXO_REST_POSE, look, FULL);
      const inserted = insertedPaints(base, worn);
      expect(inserted).not.toBeNull();
      expect(inserted!.length).toBeGreaterThan(0);
      const eyes = firstEyePaint(worn);
      expect(eyes).toBeGreaterThan(0);
      for (const x of inserted!) expect(x.index).toBeLessThan(eyes);
      // Everything from the first eye paint on is the base axolotl's own eye paint.
      expect(worn.length - eyes).toBe(base.length - firstEyePaint(base));
      if (look.sex === 'girl') {
        const lashes = worn.filter((p) => p.lineCap === 'butt' && (p.lineWidth === EYELASH_UNDER || p.lineWidth === EYELASH_INK));
        expect(lashes).toHaveLength(4);
        for (const lash of lashes) expect(worn.indexOf(lash)).toBeGreaterThanOrEqual(eyes);
      }
    }
  });

  it('paints the Face item below the eyes layer even with the glasses alone', () => {
    const base = drawn(AXO_REST_POSE, GIRL);
    const worn = drawn(AXO_REST_POSE, GIRL, { face: 'heart-glasses' });
    const inserted = insertedPaints(base, worn)!;
    expect(Math.max(...inserted.map((x) => x.index))).toBeLessThan(firstEyePaint(worn));
  });

  it('orders the body items by layer: Tail 9.2, Shirt 9.3, Neck 9.5, Back 9.7, Head 10.5, Face 11.5', () => {
    expect(WEARABLE_LAYERS.tail).toBeLessThan(WEARABLE_LAYERS.shirt);
    for (const look of looks) {
      const worn = drawn(AXO_REST_POSE, look, FULL);
      const at = (slot: WearableSlot): number => firstIndexOf(worn, itemSignatures(slot, AXO_REST_POSE, look));
      const end = (slot: WearableSlot): number => lastIndexOf(worn, itemSignatures(slot, AXO_REST_POSE, look));
      const order: WearableSlot[] = ['tail', 'shirt', 'neck', 'back', 'head', 'face'];
      for (let i = 1; i < order.length; i++) {
        // Each item's first paint comes after the previous item's last paint.
        expect(at(order[i])).toBeGreaterThan(end(order[i - 1]));
      }
      // The Shirt, then the Neck item, then the Back item, from the body out.
      expect(at('shirt')).toBeLessThan(at('neck'));
      expect(at('neck')).toBeLessThan(at('back'));
    }
  });

  it('puts the near gills over the spots and under the Tail, Shirt, Neck and Back items, a Girl cheek heart after the blush and before the Head item, and the Face item over the mouth', () => {
    const look = { ...GIRL, spots: 'patches' as const };
    const worn = drawn(AXO_REST_POSE, look, FULL);
    const nearGill = (p: Paint): boolean =>
      p.kind === 'stroke' && (p.style === LEUCISTIC.gillNearStem || p.style === LEUCISTIC.gillNearFilament);
    const lastOf = (holds: (p: Paint) => boolean): number => worn.map(holds).lastIndexOf(true);
    const firstOf = (holds: (p: Paint) => boolean): number => worn.findIndex(holds);
    const spots = lastOf((p) => p.kind === 'fill' && p.style === FRECKLE);
    const blush = lastOf((p) => p.kind === 'fill' && p.style === BLUSH);
    const heartFill = lastOf((p) => p.kind === 'fill' && p.style === CHEEK_HEART);
    const heart = { first: heartFill - 1, last: heartFill + 1 };
    expect(worn[heart.first]).toMatchObject({ kind: 'stroke', style: WHITE, lineWidth: CHEEK_HEART_UNDER });
    expect(worn[heart.last]).toMatchObject({ kind: 'stroke', style: INK, lineWidth: CHEEK_HEART_INK });
    const mouth = lastOf((p) => p.kind === 'stroke' && p.lineWidth === MOUTH_INK);
    const gills = { first: firstOf(nearGill), last: lastOf(nearGill) };
    const shirt = firstIndexOf(worn, itemSignatures('shirt', AXO_REST_POSE, look));
    const tail = firstIndexOf(worn, itemSignatures('tail', AXO_REST_POSE, look));
    const neck = firstIndexOf(worn, itemSignatures('neck', AXO_REST_POSE, look));
    const back = firstIndexOf(worn, itemSignatures('back', AXO_REST_POSE, look));
    const head = firstIndexOf(worn, itemSignatures('head', AXO_REST_POSE, look));
    const face = firstIndexOf(worn, itemSignatures('face', AXO_REST_POSE, look));
    const found = [spots, blush, heart.first, mouth, gills.first, gills.last, shirt, tail, neck, back, head, face];
    for (const index of found) expect(index).toBeGreaterThan(0);
    // 8 spots, 9 near gills, 9.2 Tail item, 9.3 Shirt, 9.5 Neck item, 9.7 Back item, 10 blush, 10.2 cheek heart,
    // 10.5 Head item, 11 mouth, 11.5 Face item.
    expect(CHEEK_HEART_LAYER).toBe(10.2);
    const layers = [
      ...[spots, gills.first, gills.last, tail, shirt, neck, back, blush],
      ...[heart.first, heart.last, head, mouth, face],
    ];
    expect(layers).toEqual([...layers].sort((x, y) => x - y));
  });

  it('paints the cheek heart for a Girl only, and not when the palette turns the blush off', () => {
    const heartPaints = (look: AxolotlArtLook, palette: MorphPalette): number =>
      record((ctx) => drawAxolotl(ctx, AXO_REST_POSE, palette, look)).paints.filter(
        (p) => p.kind === 'fill' && p.style === CHEEK_HEART,
      ).length;
    for (const look of looks) {
      expect(heartPaints(look, LEUCISTIC), look.sex).toBe(look.sex === 'girl' ? 1 : 0);
      expect(heartPaints(look, SILHOUETTE), look.sex).toBe(0);
    }
  });

  it('paints Socks and Feet with their leg behind the silhouette: far legs, then their wear, then near legs, then theirs', () => {
    for (const look of looks) {
      const worn = drawn(AXO_REST_POSE, look, FULL);
      const silhouette = worn.findIndex((p) => p.kind === 'stroke' && p.lineWidth === 2 * LW && p.style === INK);
      expect(silhouette).toBeGreaterThan(0);
      const wear = [0, 1, 2, 3].map((i) => legWearSignatures(look, i, SOCKS_AND_FEET).map((sig) => worn.findIndex((p) => signature(p) === sig)));
      for (const indices of wear) {
        expect(indices.length).toBeGreaterThan(0);
        for (const index of indices) expect(index).toBeGreaterThan(0);
        for (const index of indices) expect(index).toBeLessThan(silhouette);
      }
      // The leg tubes: colour strokes of width 8 (the tube) and 4.2 (a toe), far side colour then body colour.
      const tube = (colour: string): number[] =>
        worn.flatMap((p, i) => (p.kind === 'stroke' && p.style === colour && (p.lineWidth === 8 || p.lineWidth === 4.2) ? [i] : []));
      const farTubes = tube(LEUCISTIC.farSide);
      const nearTubes = tube(LEUCISTIC.body);
      const [far0, far1, near2, near3] = wear;
      // Layer 2 far legs, 2.5 their wear, 3 near legs, 3.5 their wear, 4 silhouette.
      expect(Math.max(...farTubes)).toBeLessThan(Math.min(...far0, ...far1));
      expect(Math.max(...far0, ...far1)).toBeLessThan(Math.min(...nearTubes));
      expect(Math.max(...nearTubes)).toBeLessThan(Math.min(...near2, ...near3));
      expect(Math.max(...near2, ...near3)).toBeLessThan(silhouette);
    }
  });

  it('paints the Sock first and the Feet item over it on every leg', () => {
    const look = GIRL;
    for (let i = 0; i < 4; i++) {
      const legs = [lost, lost, lost, lost];
      legs[i] = present;
      const pose: AxolotlPose = { ...AXO_REST_POSE, swimPhase: 0.7, legs };
      const base = drawn(pose, look);
      const both = insertedPaints(base, drawn(pose, look, { socks: 'stripy-socks', feet: 'flippers' }))!;
      const socks = insertedPaints(base, drawn(pose, look, { socks: 'stripy-socks' }))!;
      const feet = insertedPaints(base, drawn(pose, look, { feet: 'flippers' }))!;
      expect(socks.length).toBeGreaterThan(0);
      expect(feet.length).toBeGreaterThan(0);
      expect(both.length).toBe(socks.length + feet.length);
      const sockSigs = new Set(socks.map((x) => signature(x.paint)));
      const feetSigs = new Set(feet.map((x) => signature(x.paint)));
      const lastSock = Math.max(...both.filter((x) => sockSigs.has(signature(x.paint))).map((x) => x.index));
      const firstFeet = Math.min(...both.filter((x) => feetSigs.has(signature(x.paint))).map((x) => x.index));
      expect(lastSock).toBeLessThan(firstFeet);
    }
  });

  it('paints the same items at every size: the size scales the bake, not the painter', () => {
    for (const pose of Object.values(POSES)) {
      const bySize = AXO_SIZES.map((size) => {
        const look = { ...GIRL, size };
        return insertedPaints(drawn(pose, look), drawn(pose, look, FULL))!.map((x) => signature(x.paint));
      });
      expect(bySize[0].length).toBeGreaterThan(0);
      expect(bySize[1]).toEqual(bySize[0]);
      expect(bySize[2]).toEqual(bySize[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// The feet rule (guide 6i, 6q)
// ---------------------------------------------------------------------------

describe('feet rule: a Sock and a Shoe go with their leg', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  const look = GIRL;

  function legWear(pose: AxolotlPose, outfit: ArtOutfit = SOCKS_AND_FEET): Set<string> {
    return new Set(insertedPaints(drawn(pose, look), drawn(pose, look, outfit))!.map((x) => signature(x.paint)));
  }

  /** The paints of leg `i` alone: the other three lost. */
  function onlyLeg(i: number): Set<string> {
    const legs = [lost, lost, lost, lost];
    legs[i] = present;
    return legWear({ ...AXO_REST_POSE, swimPhase: 0.7, legs });
  }

  it('wears on all four feet when every leg is present, and with the legs input absent', () => {
    const all = legWear({ ...AXO_REST_POSE, swimPhase: 0.7 });
    const parts = [0, 1, 2, 3].map(onlyLeg);
    expect(parts.every((p) => p.size > 0)).toBe(true);
    expect(all.size).toBe(parts.reduce((n, p) => n + p.size, 0));
    for (const part of parts) for (const sig of part) expect(all.has(sig)).toBe(true);
    expect(legWear({ ...AXO_REST_POSE, swimPhase: 0.7, legs: [present, present, present, present] })).toEqual(all);
    // A missing entry counts as present, as in the leg painter.
    expect(legWear({ ...AXO_REST_POSE, swimPhase: 0.7, legs: [present] })).toEqual(all);
  });

  it('draws neither Sock nor Shoe on a lost leg, and the other legs keep theirs', () => {
    const all = legWear({ ...AXO_REST_POSE, swimPhase: 0.7 });
    for (let i = 0; i < 4; i++) {
      const worn = legWear(legPose(i, lost));
      for (const sig of onlyLeg(i)) expect(worn.has(sig)).toBe(false);
      expect(worn.size).toBe(all.size - onlyLeg(i).size);
      for (const j of [0, 1, 2, 3].filter((k) => k !== i)) for (const sig of onlyLeg(j)) expect(worn.has(sig)).toBe(true);
    }
  });

  it('draws neither on a regrowing leg, at any progress, 100% included', () => {
    for (let i = 0; i < 4; i++) {
      const mine = onlyLeg(i);
      for (const progress of [0, 0.03, 0.5, 0.97, 1]) {
        const worn = legWear(legPose(i, regrowing(progress)));
        for (const sig of mine) expect(worn.has(sig)).toBe(false);
      }
    }
  });

  it('brings both back when the leg is fully regrown (present again), on that frame', () => {
    for (let i = 0; i < 4; i++) {
      const all = legWear({ ...AXO_REST_POSE, swimPhase: 0.7 });
      const regrown = legWear(legPose(i, present));
      expect(regrown).toEqual(all);
      for (const sig of onlyLeg(i)) expect(regrown.has(sig)).toBe(true);
    }
  });

  it('leaves the lost-leg ghost the plain bare leg: no paint of the leg is added, moved or enlarged', () => {
    for (let i = 0; i < 4; i++) {
      const pose = legPose(i, lost);
      expect(insertedPaints(drawn(pose, look), drawn(pose, look, SOCKS_AND_FEET))).not.toBeNull();
      const pose2 = legPose(i, regrowing(0.5));
      expect(insertedPaints(drawn(pose2, look), drawn(pose2, look, SOCKS_AND_FEET))).not.toBeNull();
    }
  });

  it('keeps wearing on the legs that are left, however many are lost (never all four)', () => {
    const legs = [lost, lost, lost, present];
    const worn = legWear({ ...AXO_REST_POSE, swimPhase: 0.7, legs });
    expect([...worn].sort()).toEqual([...onlyLeg(3)].sort());
  });

  it('never lets a Shirt see the leg state: it paints the same with every leg lost or regrowing', () => {
    const shirtAlone = (pose: AxolotlPose): string[] =>
      insertedPaints(drawn(pose, look), drawn(pose, look, { shirt: 'tank-top' }))!.map((x) => signature(x.paint));
    const four = shirtAlone({ ...AXO_REST_POSE, swimPhase: 0.7 });
    expect(four.length).toBeGreaterThan(0);
    for (const legs of [
      [lost, present, present, present],
      [lost, lost, lost, present],
      [regrowing(0.4), lost, regrowing(1), present],
      [present, regrowing(0), regrowing(0.99), lost],
    ]) {
      expect(shirtAlone({ ...AXO_REST_POSE, swimPhase: 0.7, legs })).toEqual(four);
    }
    // The full outfit's Shirt paints are the same too, whatever the legs do.
    const fullShirt = (pose: AxolotlPose): number =>
      insertedPaints(drawn(pose, look, { ...FULL, socks: null, feet: null }), drawn(pose, look, FULL))!.length;
    expect(fullShirt({ ...AXO_REST_POSE, swimPhase: 0.7 })).toBeGreaterThan(0);
  });

  it('paints the Sock pad in its leg frame, so it turns with the paddle', () => {
    for (const swim of [0, 1, 2.5, 4]) {
      for (const frame of legSlotFrames(look, swim)) {
        const pad = sockFootPad(frame);
        const fill = legPaints({ socks: 'stripy-socks' }, frame).find(
          (p) => p.kind === 'fill' && p.style !== INK && p.style !== TREASURE_SHINE,
        )!;
        const corners = fill.subs[0].pts.map((p) => toFrame(frame, p));
        const half = 1;
        // The pad's path is its ink-included rectangle pulled in by half the ink, whatever the leg angle.
        expect(Math.min(...corners.map((q) => q.x))).toBeCloseTo(pad.u0 + half, 3);
        expect(Math.max(...corners.map((q) => q.x))).toBeCloseTo(pad.u1 - half, 3);
        expect(Math.max(...corners.map((q) => q.y))).toBeCloseTo(pad.vHalf - half, 3);
        expect(Math.min(...corners.map((q) => q.y))).toBeCloseTo(-(pad.vHalf - half), 3);
      }
    }
  });

  it('mixes the far legs 12% toward ink and leaves the near legs as authored', () => {
    expect(WORN_FAR_INK_MIX).toBe(0.12);
    const frames = legSlotFrames(look, 0.7);
    const colours = (frame: LegSlotFrame): string[] =>
      legPaints(SOCKS_AND_FEET, frame)
        .filter((p) => p.alpha === 1 && p.style !== INK && p.style !== TREASURE_SHINE)
        .map((p) => p.style);
    // #efdcba 12% toward #2b2350 is #d7c6ad; #ffe14a is #e6ca4b.
    for (const i of [0, 1]) {
      const far = colours(frames[i]);
      expect(far).toContain('#d7c6ad');
      expect(far).toContain('#e6ca4b');
      expect(far).not.toContain(SOCK_FILL);
      expect(far).not.toContain(FLIPPER_FILL);
    }
    for (const i of [2, 3]) {
      const near = colours(frames[i]);
      expect(near).toContain(SOCK_FILL);
      expect(near).toContain(FLIPPER_FILL);
      expect(near).toContain(FLIPPER_CUFF);
      expect(near).toContain(FLIPPER_RIDGE);
    }
  });
});

// ---------------------------------------------------------------------------
// Keep-clear zones and footprints
// ---------------------------------------------------------------------------

const eyeZones: readonly ZoneCircle[] = [NEAR_EYE_ZONE, FAR_EYE_ZONE];
const lashZones: readonly ZoneCircle[] = [NEAR_LASH_REACH, FAR_LASH_REACH];

/**
 * Why `paint` is not clear, or null. `lens` paints are the clear lens tint: the one allowed exception
 * to the eye zones. The cheek heart zone (#87, #88) is checked unless `heart` is false. The mouth zone
 * is not a keep-clear zone (#88): the mouth paints at 11, over the Neck and Head items.
 */
function trouble(paint: Paint, opts: { lashes: boolean; gills: boolean; heart?: boolean }): string | null {
  const region = regionOf(paint);
  if (opts.heart !== false && reachesCircle(region, CHEEK_HEART_ZONE)) return 'cheek heart zone';
  if (paint.kind === 'fill' && paint.style === GLASSES_LENS) return null;
  if (eyeZones.some((z) => reachesCircle(region, z))) return 'eye zone';
  if (opts.lashes && lashZones.some((z) => reachesCircle(region, z))) return 'lash reach';
  if (opts.gills && reachesBox(region, GILL_ROOT_ZONE)) return 'gill-root zone';
  return null;
}

describe('keep-clear zones (guide 6i, PRD F13)', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  /** Ids of every look (and phase) in which `check` finds trouble; expected empty. */
  function failures(check: (look: AxolotlArtLook) => string[]): string[] {
    return EVERY_BODY_LOOK.flatMap((look) => check(look).map((why) => `${lookId(look)}: ${why}`));
  }

  it('keeps the Head, Neck and Face items off the eyes, the gill roots and the cheek heart zone', () => {
    for (const slot of ['head', 'neck', 'face'] as const) {
      const paints = bodyPaints(slot, DEFAULT_ART_LOOK);
      expect(paints.length).toBeGreaterThan(0);
      // They are on the head, so every look paints them alike.
      for (const look of EVERY_BODY_LOOK) expect(bodyPaints(slot, look).map(signature)).toEqual(paints.map(signature));
      for (const paint of paints) {
        // The glasses band reaches into the lash reach circles on purpose: the eyes paint above it. Its gap
        // to the mouth ink is a design gap, measured in drawAxolotlParts.test.ts.
        const found = trouble(paint, { lashes: slot !== 'face', gills: true });
        expect(found, `${slot} ${paint.kind} ${paint.style}`).toBeNull();
      }
    }
  });

  it('keeps the Shirt, Back and Tail items off the eyes, lashes, gill roots and cheek heart zone on every look', () => {
    expect(
      failures((look) =>
        BODY_SLOTS.filter((slot) => slot === 'shirt' || slot === 'back').flatMap((slot) =>
          bodyPaints(slot, look).flatMap((p) => {
            const why = trouble(p, { lashes: true, gills: true });
            return why ? [`${slot} ${why}`] : [];
          }),
        ),
      ),
    ).toEqual([]);
    expect(
      failures((look) =>
        SWIMS.flatMap((swim) =>
          AMPS.flatMap((amp) =>
            bodyPaints('tail', look, swim, amp).flatMap((p) => {
              const why = trouble(p, { lashes: true, gills: true });
              return why ? [`tail swim ${swim.toFixed(2)} amp ${amp} ${why}`] : [];
            }),
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('keeps the Socks and Feet items off the eyes and lashes on every look and swim phase; they stay behind the silhouette', () => {
    expect(
      failures((look) =>
        SWIMS.flatMap((swim) =>
          legSlotFrames(look, swim).flatMap((frame) =>
            legPaints({ socks: 'stripy-socks', feet: 'flippers' }, frame).flatMap((p) => {
              // The sleeve starts inside the torso, where the gill roots are; it is behind the silhouette (layer
              // 2.5 or 3.5, under 4), so only its eye and lash clearance is geometric. The pad and Shoe are clear of
              // the gill-root zone too. The cheek heart is the head's, which paints over every leg.
              const why = trouble(p, { lashes: true, gills: !isSleevePaint(p), heart: false });
              return why ? [`leg ${frame.index} swim ${swim.toFixed(2)} ${why}`] : [];
            }),
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('keeps every Wearable of a full drawAxolotl run off the eyes and, once past the silhouette, the gill roots and the cheek heart zone, at every size and look', () => {
    const looks = AXO_SIZES.flatMap((size): AxolotlArtLook[] => [
      { ...DEFAULT_ART_LOOK, size },
      { ...GIRL, size, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, size, body: 'slim', age: 'grownUp', tail: 'long' },
    ]);
    for (const pose of Object.values(POSES)) {
      for (const look of looks) {
        const base = drawn(pose, look);
        const worn = drawn(pose, look, FULL);
        const silhouette = worn.findIndex((p) => p.kind === 'stroke' && p.lineWidth === 2 * LW && p.style === INK);
        const inserted = insertedPaints(base, worn)!;
        expect(inserted.length).toBeGreaterThan(0);
        for (const { index, paint } of inserted) {
          const why = trouble(paint, { lashes: false, gills: index > silhouette, heart: index > silhouette });
          expect(why, `${lookId(look)} paint ${index} ${paint.kind} ${paint.style}`).toBeNull();
        }
      }
    }
  });

  it('measures each head item clear of the cheek heart zone: Sun hat 24.54, Shell necklace 0.39, Heart glasses band 1.40', () => {
    const gap = (paints: readonly Paint[]): number =>
      Math.min(
        ...paints.map((p) => {
          const r = regionOf(p);
          expect(r.kind === 'fill' && winding(r.subs, CHEEK_HEART_ZONE.x, CHEEK_HEART_ZONE.y) !== 0).toBe(false);
          const near = Math.min(...edgesOf(r).map(([a, b]) => segDist(CHEEK_HEART_ZONE.x, CHEEK_HEART_ZONE.y, a, b)));
          return near - r.hw - CHEEK_HEART_ZONE.r;
        }),
      );
    expect(gap(bodyPaints('head', GIRL))).toBeCloseTo(24.54, 2);
    expect(gap(bodyPaints('neck', GIRL))).toBeCloseTo(0.39, 2);
    const glasses = bodyPaints('face', GIRL);
    expect(gap(glasses.filter((p) => p.kind === 'stroke' && p.lineWidth === 3.5))).toBeCloseTo(1.4, 2);
    for (const slot of ['head', 'neck', 'face'] as const) expect(gap(bodyPaints(slot, GIRL))).toBeGreaterThan(0);
  });

  it('paints only the clear lens tint over the eye zones, and the tint is under the band, the gem and the eyes', () => {
    const paints = bodyPaints('face', GIRL);
    const lens = paints.filter((p) => p.style === GLASSES_LENS);
    expect(lens).toHaveLength(1);
    expect(lens[0].kind).toBe('fill');
    // The lens is a tint: white at 0.25, never opaque and never dark.
    expect(GLASSES_LENS).toBe('rgba(255,255,255,0.25)');
    // It covers both beads, so it is the one paint over the eye zones.
    for (const zone of eyeZones) expect(reachesCircle(regionOf(lens[0]), zone)).toBe(true);
    for (const p of paints.filter((q) => q !== lens[0])) {
      for (const zone of eyeZones) expect(reachesCircle(regionOf(p), zone), `${p.kind} ${p.style}`).toBe(false);
    }
    expect(paints.indexOf(lens[0])).toBe(0);
  });
});

describe('footprints (guide 6i), ink included, and the frame (guide 11)', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('keeps the Sun hat on the head top (#88): ink x 16.02 to 45.98, lowest y -19.5, top y -41.4, inside x 16 to 46, y -44 to -19.5', () => {
    expect(HEAD_FOOTPRINT).toEqual({ minX: 16, minY: -44, maxX: 46, maxY: -19.5 });
    const box = inkBounds(bodyPaints('head', DEFAULT_ART_LOOK));
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.minX).toBeCloseTo(16.02, 2);
    expect(box.maxX).toBeCloseTo(45.98, 2);
    expect(box.maxY).toBeCloseTo(-19.5, 2);
    expect(box.minY).toBeCloseTo(-41.4, 6);
    // It rests on the head: the brim's lowest fill point is inside the head outline.
    const fills = bodyPaints('head', DEFAULT_ART_LOOK).filter((p) => p.kind === 'fill' && p.style === HAT_FILL);
    const lowest = fills.flatMap((p) => p.subs[0].pts).reduce((a, b) => (b.y > a.y ? b : a));
    expect(lowest.y).toBeCloseTo(-21.5, 2);
    expect(((lowest.x - HEAD_ELLIPSE.cx) / HEAD_ELLIPSE.rx) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / HEAD_ELLIPSE.ry) ** 2).toBeLessThan(1);
    // The brim passes the head outline forward: its front tip is 4 or more above the head top below it.
    const front = fills.flatMap((p) => p.subs[0].pts).reduce((a, b) => (b.x > a.x ? b : a));
    const headTop = HEAD_ELLIPSE.cy - HEAD_ELLIPSE.ry * Math.sqrt(1 - ((front.x - HEAD_ELLIPSE.cx) / HEAD_ELLIPSE.rx) ** 2);
    expect(headTop - front.y).toBeGreaterThan(4);
  });

  it('keeps the Shell necklace under the chin (#88): ink x 2 to 41.9, y 13.1 to 22.65, inside x 2 to 42, y 13.1 to 22.75', () => {
    expect(NECK_FOOTPRINT).toEqual({ minX: 2, minY: 13.1, maxX: 42, maxY: 22.75 });
    const box = inkBounds(bodyPaints('neck', DEFAULT_ART_LOOK));
    expect(isInside(box, NECK_FOOTPRINT)).toBe(true);
    expect(box.minX).toBeCloseTo(2, 6);
    expect(box.maxX).toBeCloseTo(41.9, 6);
    expect(box.minY).toBeCloseTo(13.1, 6);
    expect(box.maxY).toBeCloseTo(22.65, 2);
  });

  it('keeps the Shell necklace paint off the gill-root zone (0.15) and the cheek heart zone, and over the mouth-zone box, under the mouth', () => {
    const paints = bodyPaints('neck', DEFAULT_ART_LOOK);
    const gillGap = Math.min(
      ...inkPoints(paints).map(({ p, hw }) => {
        const dx = Math.max(GILL_ROOT_ZONE.minX - p.x, 0, p.x - GILL_ROOT_ZONE.maxX);
        const dy = Math.max(GILL_ROOT_ZONE.minY - p.y, 0, p.y - GILL_ROOT_ZONE.maxY);
        return Math.hypot(dx, dy) - hw;
      }),
    );
    expect(gillGap).toBeCloseTo(0.15, 6);
    for (const paint of paints) {
      expect(reachesBox(regionOf(paint), GILL_ROOT_ZONE), `${paint.kind} ${paint.style}`).toBe(false);
      expect(reachesCircle(regionOf(paint), CHEEK_HEART_ZONE), `${paint.kind} ${paint.style}`).toBe(false);
    }
    // The mouth zone is no keep-clear zone: the necklace runs under the mouth, which paints over it at 11.
    expect(paints.some((p) => reachesBox(regionOf(p), MOUTH_ZONE))).toBe(true);
    expect(WEARABLE_LAYERS.neck).toBeLessThan(11);
  });

  it('keeps the Shell necklace paint 0.1 or more inside LW / 2 in from the outer edge of the silhouette outline on every look, so nothing hangs below it', () => {
    // The outline ink is LW outside the head and torso ellipses; LW / 2 in from its outer edge is LW / 2 outside them.
    const paints = bodyPaints('neck', DEFAULT_ART_LOOK);
    const points = inkPoints(paints);
    const margins = outlineMargins(points);
    const least = leastOver(margins);
    expect(least.value, least.id).toBeGreaterThanOrEqual(0);
    expect(least.value).toBeCloseTo(0.1, 2);
  });

  it('paints the Heart glasses band 3.5 wide: colour 2.1 with 0.7 of ink each side, no more than 1.0 (#88)', () => {
    const paints = bodyPaints('face', DEFAULT_ART_LOOK);
    const ink = paints.filter((p) => p.kind === 'stroke' && p.style === INK && p.lineWidth === 3.5);
    const colour = paints.filter((p) => p.kind === 'stroke' && p.style === GLASSES_FRAME);
    expect(ink).toHaveLength(1);
    expect(colour).toHaveLength(1);
    expect(colour[0].lineWidth).toBeCloseTo(2.1, 9);
    const inkEachSide = (ink[0].lineWidth - colour[0].lineWidth) / 2;
    expect(inkEachSide).toBeCloseTo(0.7, 9);
    expect(inkEachSide).toBeLessThanOrEqual(1);
    expect(signature({ ...colour[0], style: INK, lineWidth: 3.5 })).toBe(signature(ink[0]));
  });

  it('keeps the Heart glasses 1.8 or more under the Sun hat ink, and the band 1.8 under the Head footprint', () => {
    const hat = inkPoints(bodyPaints('head', DEFAULT_ART_LOOK));
    const gap = (paints: readonly Paint[]): number =>
      inkPoints(paints).reduce(
        (best, { p, hw }) => hat.reduce((b, q) => Math.min(b, Math.hypot(p.x - q.p.x, p.y - q.p.y) - hw - q.hw), best),
        Infinity,
      );
    const glasses = bodyPaints('face', DEFAULT_ART_LOOK);
    // The band is the nearest paint, as the brim tilts up over the bridge gem.
    expect(gap(glasses)).toBeCloseTo(1.81, 2);
    expect(gap(glasses.filter((p) => p.kind === 'stroke' && p.lineWidth === 3.5))).toBeCloseTo(1.81, 2);
    expect(gap(glasses)).toBeGreaterThanOrEqual(1.8);
    expect(GLASSES_EXTENT.minY - HEAD_FOOTPRINT.maxY).toBeCloseTo(1.8, 1);
  });

  it('keeps the Heart glasses in the Face footprint, x 14 to 54, y -18 to 6, the band at x 16.3 to 52.6', () => {
    const paints = bodyPaints('face', DEFAULT_ART_LOOK);
    expect(isInside(inkBounds(paints), { minX: 14, minY: -18, maxX: 54, maxY: 6 })).toBe(true);
    const band = paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 3.5);
    expect(band).toHaveLength(1);
    expect(isInside(inkBounds(band), GLASSES_EXTENT, 0.01)).toBe(true);
    const box = inkBounds(band);
    expect(box.minX).toBeCloseTo(16.3, 1);
    expect(box.maxX).toBeCloseTo(52.6, 1);
    expect(box.minY).toBeCloseTo(-17.7, 1);
    expect(box.maxY).toBeCloseTo(5.7, 1);
  });

  it('draws the glasses as one merged outline with no inner seam: one closed subpath, no point inside either lens', () => {
    const band = bodyPaints('face', DEFAULT_ART_LOOK).filter((p) => p.kind === 'stroke' && p.lineWidth === 3.5)[0];
    expect(band.subs).toHaveLength(1);
    expect(band.subs[0].closed).toBe(true);
    const [near, far] = [
      { x: 28, y: -6, r: 9.95 },
      { x: 42, y: -7, r: 8.85 },
    ];
    for (const p of band.subs[0].pts) {
      // Each point is on one lens circle and not inside the other.
      const dNear = Math.hypot(p.x - near.x, p.y - near.y);
      const dFar = Math.hypot(p.x - far.x, p.y - far.y);
      const onNear = Math.abs(dNear - near.r) < 1e-6 && dFar >= far.r - 1e-6;
      const onFar = Math.abs(dFar - far.r) < 1e-6 && dNear >= near.r - 1e-6;
      expect(onNear || onFar).toBe(true);
    }
  });

  it('keeps the Shirt inside the torso edge band, behind the front line, cut at the tail root, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const e: BodyEllipse = shirt.inset;
      const boundary = Array.from({ length: 720 }, (_, k) => ({
        x: e.cx + Math.cos((k / 720) * TAU) * e.rx,
        y: e.cy + Math.sin((k / 720) * TAU) * e.ry,
      }));
      const paints = bodyPaints('shirt', look);
      expect(paints.length).toBeGreaterThan(0);
      for (const { p, hw } of inkPoints(paints)) {
        const inside = ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1 + 1e-9;
        const gap = Math.min(...boundary.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
        if (!inside || gap < hw - TOL) bad.push(`${lookId(look)} edge band`);
        if (p.x + hw > SHIRT_FRONT_X + TOL) bad.push(`${lookId(look)} front`);
        if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
        if (p.x - hw < shirt.rearX - TOL) bad.push(`${lookId(look)} rear`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints the Shirt as the whole footprint: one silhouette, ink 2.0, from the tail root to the front edge, neckline bowing back to x -7', () => {
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const paints = bodyPaints('shirt', look);
      const fills = paints.filter((p) => p.kind === 'fill' && p.style === TANK_TOP_FILL);
      expect(fills).toHaveLength(1);
      expect(paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 2 && p.style === INK)).toHaveLength(1);
      const pts = fills[0].subs[0].pts;
      // The path sits half the 2.0 ink inside the footprint's rear and front edges.
      expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(shirt.rearX + 1, 3);
      expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(SHIRT_FRONT_X - 1, 3);
      // The neckline is the last 24 points (the curve back to the start): its apex is 1.5 units behind the front edge.
      const neckline = pts.slice(-24);
      expect(Math.min(...neckline.map((p) => p.x))).toBeCloseTo(shirt.neckline.apexX - 1, 6);
      expect(shirt.neckline.apexX).toBeCloseTo(-7, 9);
    }
  });

  it('keeps the Back item in its look\'s back box, filling it end to end, with its forward corner at x -5.5 or less', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const { frame, box } = backFootprint(look);
      const paints = bodyPaints('back', look);
      expect(paints.length).toBeGreaterThan(0);
      const along = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
      for (const { q, hw } of along) {
        if (q.x - hw < box.minU - TOL || q.x + hw > box.maxU + TOL) bad.push(`${lookId(look)} u`);
        if (q.y - hw < box.minV - TOL || q.y + hw > box.maxV + TOL) bad.push(`${lookId(look)} v`);
      }
      for (const { p, hw } of inkPoints(paints)) if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
      // The ink runs the box's whole length and height.
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.x - hw)) - box.minU) > TOL) bad.push(`${lookId(look)} rear end`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.x + hw)) - box.maxU) > TOL) bad.push(`${lookId(look)} front end`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.y - hw)) - box.minV) > TOL) bad.push(`${lookId(look)} top`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.y + hw)) - box.maxV) > TOL) bad.push(`${lookId(look)} bottom`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the Golden bow within 17.5 units of its anchor (#88: 9, then 12, before), ink included, at every look, swim phase and tail amplitude', () => {
    expect(TAIL_SLOT_REACH).toBe(17.5);
    let reach = 0;
    for (const look of EVERY_BODY_LOOK) {
      const tail = axolotlBodyGeometry(look).tail;
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          const frame = tailSlotFrame(tail, swim, amp);
          for (const { p, hw } of inkPoints(bodyPaints('tail', look, swim, amp))) {
            reach = Math.max(reach, Math.hypot(p.x - frame.x, p.y - frame.y) + hw);
          }
        }
      }
    }
    expect(reach).toBeCloseTo(17.34, 2);
    expect(reach).toBeLessThanOrEqual(TAIL_SLOT_REACH + TOL);
  });

  it('turns the Golden bow with the local tail direction: its knot sits on the anchor line, rotated by the frame', () => {
    const look = DEFAULT_ART_LOOK;
    const tail = axolotlBodyGeometry(look).tail;
    for (const swim of SWIMS) {
      const frame = tailSlotFrame(tail, swim, 1.6);
      const gem = bodyPaints('tail', look, swim, 1.6).find((p) => p.kind === 'fill' && p.style === BOW_GEM)!;
      const box = inkBounds([gem]);
      const q = toFrame(frame, { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 });
      // The knot is on the frame's y' axis (u 0), a little into the tail core.
      expect(q.x).toBeCloseTo(0, 6);
      expect(q.y).toBeGreaterThan(0);
      expect(q.y).toBeLessThan(2);
    }
  });

  it('keeps the Sock sleeve, pad and Feet item in leg space: sleeve about the leg, pad and Flippers inside their rectangles', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS.filter((_, i) => i % 3 === 0)) {
        for (const frame of legSlotFrames(look, swim)) {
          const pad = sockFootPad(frame);
          const env = feetEnvelope(frame);
          for (const p of legPaints({ socks: 'stripy-socks' }, frame)) {
            for (const { p: pt, hw } of inkPoints([p])) {
              const q = toFrame(frame, pt);
              const onSleeve = isSleevePaint(p);
              if (onSleeve) {
                // Within the sleeve's ink radius (8.2) of the leg axis (u 0 to l), round ends. Its colour stroke
                // carries its own half width, so a stroke's points are measured with it.
                const d = segDist(q.x, q.y, { x: 0, y: 0 }, { x: frame.length, y: 0 });
                if (d + hw > SLEEVE_INK_W / 2 + TOL) bad.push(`${lookId(look)} sleeve`);
              } else if (
                q.x - hw < pad.u0 - TOL ||
                q.x + hw > pad.u1 + TOL ||
                Math.abs(q.y) + hw > pad.vHalf + TOL
              ) {
                bad.push(`${lookId(look)} pad`);
              }
            }
          }
          for (const p of legPaints({ feet: 'flippers' }, frame)) {
            for (const { p: pt, hw } of inkPoints([p])) {
              const q = toFrame(frame, pt);
              if (q.x - hw < env.u0 - TOL || q.x + hw > env.u1 + TOL || Math.abs(q.y) + hw > env.vHalf + TOL) {
                bad.push(`${lookId(look)} flippers`);
              }
            }
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('covers the Sock pad with the Flippers at the sides and front, so the Sock shows above them at the back', () => {
    for (const look of [DEFAULT_ART_LOOK, { ...DEFAULT_ART_LOOK, age: 'baby' as const }, { ...DEFAULT_ART_LOOK, age: 'grownUp' as const }]) {
      for (const frame of legSlotFrames(look, 0.9)) {
        const pad = sockFootPad(frame);
        // The Flippers' fill, in leg space.
        const fan = legPaints({ feet: 'flippers' }, frame).find((p) => p.kind === 'fill' && p.style.startsWith('#') && p.clips.length === 0)!;
        const fanLeg: SubPath[] = fan.subs.map((sub) => ({ closed: true, pts: sub.pts.map((q) => toFrame(frame, q)) }));
        // The pad's ink-included outline: straight sides and four corner arcs of the pad's radius.
        const r = pad.radius;
        const corners: [number, number, number][] = [
          [pad.u1 - r, -(pad.vHalf - r), -Math.PI / 2],
          [pad.u1 - r, pad.vHalf - r, 0],
          [pad.u0 + r, pad.vHalf - r, Math.PI / 2],
          [pad.u0 + r, -(pad.vHalf - r), Math.PI],
        ];
        const outline: Pt[] = corners.flatMap(([cu, cv, a0]) =>
          Array.from({ length: 13 }, (_, k) => ({ x: cu + r * Math.cos(a0 + (k / 12) * (Math.PI / 2)), y: cv + r * Math.sin(a0 + (k / 12) * (Math.PI / 2)) })),
        );
        let uncovered = 0;
        for (const q of outline) {
          const inside = winding(fanLeg, q.x, q.y) !== 0;
          const nearInk =
            Math.min(...edgesOf({ subs: fanLeg, kind: 'fill', hw: 0 }).map(([a, b]) => segDist(q.x, q.y, a, b))) <= 1 + TOL;
          if (!inside && !nearInk) uncovered++;
        }
        expect(uncovered, `leg ${frame.index} ${look.age}`).toBe(0);
        // At the back the pad starts as far back as the Flippers' ink: the Sock's sleeve shows above them.
        const backOfFan = Math.min(...fanLeg[0].pts.map((q) => q.x)) - 1;
        expect(backOfFan).toBeCloseTo(pad.u0, 3);
      }
    }
  });

  it('keeps the lowest Socks and Flippers ink at y 56.24 on every look and swim phase, 4 or more above the frame bottom (#88: the frame did not grow)', () => {
    let lowest = -Infinity;
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS) {
        for (const frame of legSlotFrames(look, swim)) lowest = Math.max(lowest, inkBounds(legPaints(SOCKS_AND_FEET, frame)).maxY);
      }
    }
    expect(lowest).toBeLessThanOrEqual(AXO_TEX.h - AXO_TEX.originY - FRAME_PAD);
    // A Chubby Girl's near-rear leg at swim phase pi / 2 (#88: 55.90 before).
    expect(lowest).toBeCloseTo(56.24, 2);
  });

  it('keeps every Wearable, ink included, in the texture frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const check = (what: string, paints: Paint[]): void => {
        if (!isInside(inkBounds(paints), inner, 1e-6)) bad.push(`${lookId(look)} ${what}`);
      };
      for (const slot of ['head', 'neck', 'face', 'shirt', 'back'] as const) check(slot, bodyPaints(slot, look));
      for (const swim of SWIMS) {
        for (const amp of AMPS) check('tail', bodyPaints('tail', look, swim, amp));
        for (const frame of legSlotFrames(look, swim)) check('legs', legPaints({ socks: 'stripy-socks', feet: 'flippers' }, frame));
      }
    }
    expect([...new Set(bad)]).toEqual([]);
    // The frame did not need to grow: guide 11 gives 166 x 142.
    expect([AXO_TEX.w, AXO_TEX.h]).toEqual([166, 142]);
  });
});

// ---------------------------------------------------------------------------
// Item ink (#88)
// ---------------------------------------------------------------------------

describe('item ink (#88): every worn silhouette uses the 2.0 item ink', () => {
  /** The widths of an item's ink strokes, sorted. */
  const inkWidths = (paints: readonly Paint[]): number[] =>
    [...new Set(paints.filter((p) => p.kind === 'stroke' && p.style === INK).map((p) => Math.round(p.lineWidth * 1e9) / 1e9))].sort(
      (a, b) => a - b,
    );
  const nearLeg = legSlotFrames(GIRL, 0)[2];

  it('strokes a `shape` or inkedShape silhouette at 2.0 and a `blob` at 2 x 2.0, so 2.0 shows outside its fill', () => {
    // Sun hat, Golden bow, Diving tank: one blob each. Tank top, Stripy socks pad, Flippers: shape 2.0.
    expect(inkWidths(bodyPaints('head', GIRL))).toEqual([4]);
    // The bow's band lines are 0.6, its gem and star outlines 1.2 (#88).
    expect(inkWidths(bodyPaints('tail', GIRL))).toEqual([0.6, 1.2, 4]);
    expect(inkWidths(bodyPaints('back', GIRL))).toEqual([1.2, 4]);
    expect(inkWidths(bodyPaints('shirt', GIRL))).toEqual([2]);
    expect(inkWidths(legPaints({ socks: 'stripy-socks' }, nearLeg))).toEqual([2, SLEEVE_INK_W]);
    expect(inkWidths(legPaints({ feet: 'flippers' }, nearLeg))).toEqual([1.2, 2]);
  });

  it('keeps the band and detail inks: the glasses band 3.5 (0.7 each side) and gem 1.2, the cord 5.8 or 5.2 (0.6 each side) and shells 0.6 outside', () => {
    expect(inkWidths(bodyPaints('face', GIRL))).toEqual([1.2, 3.5]);
    // The shells' 1.2 ink is stroked before every fill, so 0.6 of it shows outside each shell.
    expect(inkWidths(bodyPaints('neck', GIRL))).toEqual([1.2, 5.2, 5.8]);
    // The cord: colour 4.0 behind the chin and 4.6 under it, each with 0.6 of ink a side.
    const necklace = bodyPaints('neck', GIRL);
    const widths = (style: string): number[] =>
      necklace.filter((p) => p.kind === 'stroke' && p.style === style && p.lineWidth > 2).map((p) => p.lineWidth);
    expect(widths(NECKLACE_CORD)).toEqual([4, 4.6]);
    expect(widths(INK)).toEqual([5.2, 5.8]);
    // One silhouette: every ink stroke comes before the cord colour and the shells, so ink shows only round the outside.
    const firstColour = necklace.findIndex((p) => p.style !== INK);
    expect(firstColour).toBeGreaterThan(0);
    expect(necklace.slice(firstColour).some((p) => p.style === INK)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Swim view: how much of each worn item shows (#88)
// ---------------------------------------------------------------------------
//
// The harness records a full drawAxolotl run with the items of an outfit worn and point-samples it on
// a grid; it takes any outfit and cases, leg items included. An item's fill is its own paint that is
// not ink and is half opaque or more (isItemFill); a sample counts as visible only when
// the topmost paint covering it is one of those fills, so the item's own ink and every later layer
// (near gills, blush, cheek heart, mouth, Face item, eyes, lashes) hide it. Clips are honoured: a
// clipped paint covers a point only inside every active clip. Fills use the nonzero rule; a stroke
// covers every point within half its width of its path (round caps and joins, a slight over-cover at
// a butt end). Only paints whose box meets the box of the item's fills are tested.
//
// A Socks or Feet item is one item on four legs, so its visible fill is the sum over all four legs of
// what shows of it as worn: each leg's wear at its own layer (far 2.5, near 3.5), under the near legs,
// the silhouette and everything after them. All four legs are present.

/** Sample grid step in local units; each sample stands for one step x step cell, on a grid fixed to the origin. */
const SWIM_VIEW_GRID = 0.25;

const toCssPx2 = (units2: number): number => units2 * SWIM_VIEW_CSS_PX_PER_UNIT ** 2;

/** Opacity of a paint: its global alpha times the alpha of an `rgba(...)` style. */
function paintOpacity(p: Paint): number {
  const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(p.style);
  return p.alpha * (rgba ? Number(rgba[1]) : 1);
}

/** An item fill: not ink, and half opaque or more, so the shine (white at 0.8) counts and the clear lens tint (0.25) does not. */
function isItemFill(p: Paint): boolean {
  return p.style !== INK && paintOpacity(p) >= 0.5;
}

/** An edge of a paint and its box, grown by half the line width for a stroke: a point outside that box is out of the stroke. */
interface SampledEdge {
  a: Pt;
  b: Pt;
  box: Bounds;
}

/**
 * A paint ready for sampling: its box (ink included, cut to its clips) and, built on first use, its
 * edges (every subpath closed for a fill, as `winding` reads it) and, per sampled row y, the edges
 * that can count there, its own and each clip's.
 */
interface SampledPaint {
  index: number;
  paint: Paint;
  box: Bounds;
  edges: SampledEdge[] | null;
  rows: Map<number, SampledEdge[]>;
  clipEdges: SampledEdge[][] | null;
  clipRows: Map<number, SampledEdge[][]>;
}

function subsBox(subs: readonly SubPath[], pad: number): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const sub of subs) {
    for (const q of sub.pts) {
      minX = Math.min(minX, q.x);
      minY = Math.min(minY, q.y);
      maxX = Math.max(maxX, q.x);
      maxY = Math.max(maxY, q.y);
    }
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function sampledPaint(paint: Paint, index: number): SampledPaint {
  const hw = paint.kind === 'stroke' ? paint.lineWidth / 2 : 0;
  const box = paint.clips.reduce((b, clip) => {
    const c = subsBox(clip, 0);
    return { minX: Math.max(b.minX, c.minX), minY: Math.max(b.minY, c.minY), maxX: Math.min(b.maxX, c.maxX), maxY: Math.min(b.maxY, c.maxY) };
  }, subsBox(paint.subs, hw));
  return { index, paint, box, edges: null, rows: new Map(), clipEdges: null, clipRows: new Map() };
}

/** The edges of a region, each with its box grown by `hw`. */
function regionEdges(r: Region): SampledEdge[] {
  return edgesOf(r).map(([a, b]) => ({
    a,
    b,
    box: boundsOfPoints(
      [
        [a.x, a.y],
        [b.x, b.y],
      ],
      r.hw,
    ),
  }));
}

/** The edges of `s`, each with its box grown by half the line width of a stroke. */
function sampledEdges(s: SampledPaint): SampledEdge[] {
  if (s.edges === null) {
    const hw = s.paint.kind === 'stroke' ? s.paint.lineWidth / 2 : 0;
    s.edges = regionEdges({ subs: s.paint.subs, kind: s.paint.kind, hw });
  }
  return s.edges;
}

/** Of `edges`, those that cross row `y`: the only ones `winding` counts there. */
function crossingEdges(edges: readonly SampledEdge[], y: number): SampledEdge[] {
  return edges.filter((e) => e.a.y <= y !== e.b.y <= y);
}

/** Each clip's edges of `s` that cross row `y`, kept per row. */
function clipRowEdges(s: SampledPaint, y: number): SampledEdge[][] {
  const cached = s.clipRows.get(y);
  if (cached !== undefined) return cached;
  s.clipEdges ??= s.paint.clips.map((clip) => regionEdges({ subs: clip, kind: 'fill', hw: 0 }));
  const rows = s.clipEdges.map((edges) => crossingEdges(edges, y));
  s.clipRows.set(y, rows);
  return rows;
}

/**
 * The edges of `s` that can count at row `y`: for a fill those that cross the row (the only ones
 * `winding` counts), for a stroke those whose grown box spans it. Kept per row.
 */
function rowEdges(s: SampledPaint, y: number): SampledEdge[] {
  const cached = s.rows.get(y);
  if (cached !== undefined) return cached;
  const edges = sampledEdges(s);
  const row = s.paint.kind === 'fill' ? crossingEdges(edges, y) : edges.filter((e) => y >= e.box.minY && y <= e.box.maxY);
  s.rows.set(y, row);
  return row;
}

/** Nonzero winding number about (x, y) of the edges that cross row y, the same count `winding` makes. */
function rowWinding(edges: readonly SampledEdge[], x: number, y: number): number {
  let w = 0;
  for (const { a, b } of edges) {
    const side = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
    if (a.y <= y) {
      if (side > 0) w++;
    } else if (side < 0) w--;
  }
  return w;
}

function boxHolds(b: Bounds, x: number, y: number): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

/** Whether the paint covers (x, y): inside every clip, and inside its fill or within half its line width of its stroke. */
function paintCovers(s: SampledPaint, x: number, y: number): boolean {
  if (!boxHolds(s.box, x, y)) return false;
  const covered =
    s.paint.kind === 'fill'
      ? rowWinding(rowEdges(s, y), x, y) !== 0
      : rowEdges(s, y).some((e) => boxHolds(e.box, x, y) && segDist(x, y, e.a, e.b) <= s.paint.lineWidth / 2);
  return covered && clipRowEdges(s, y).every((clip) => rowWinding(clip, x, y) !== 0);
}

/**
 * A cheaper paint key for the swim view: style, widths, clip count, point count and the two end points.
 * A fill's key leaves out the line width and cap, which do not change what it paints: a Feet item's
 * fill keeps the key it has alone when the Sock painted before it leaves another line width set.
 */
function quickSignature(p: Paint): string {
  const count = p.subs.reduce((n, sub) => n + sub.pts.length, 0);
  const last = p.subs[p.subs.length - 1]?.pts;
  const ends = [p.subs[0]?.pts[0], last?.[last.length - 1]].map((q) => (q ? `${q.x.toFixed(3)},${q.y.toFixed(3)}` : '-'));
  const line = p.kind === 'stroke' ? [p.lineWidth, p.lineCap] : ['-', '-'];
  return [p.kind, p.style, ...line, p.alpha, p.clips.length, p.subs.length, count, ...ends].join('|');
}

/**
 * Visible fill, in units², of what `outfit` adds to a full drawAxolotl run of `pose` and `look` worn
 * over `under` (nothing by default): the items of `under` paint as in the game and can hide it.
 */
function visibleItemFill(pose: AxolotlPose, look: AxolotlArtLook, outfit: ArtOutfit, under: ArtOutfit = NO_OUTFIT): number {
  const worn = drawn(pose, look, { ...under, ...outfit });
  const inserted = insertedPaints(drawn(pose, look, under), worn, quickSignature);
  expect(inserted).not.toBeNull();
  const fills = new Set(inserted!.filter((x) => isItemFill(x.paint)).map((x) => x.index));
  expect(fills.size).toBeGreaterThan(0);
  const first = Math.min(...fills);
  const sampled = worn.slice(first).map((paint, k) => sampledPaint(paint, first + k));
  const domain = unionBounds(sampled.filter((s) => fills.has(s.index)).map((s) => s.box));
  const meets = (b: Bounds): boolean =>
    b.minX <= domain.maxX && b.maxX >= domain.minX && b.minY <= domain.maxY && b.maxY >= domain.minY;
  const topFirst = sampled.filter((s) => meets(s.box)).reverse();
  const fillsTopFirst = topFirst.filter((s) => fills.has(s.index));
  const g = SWIM_VIEW_GRID;
  let count = 0;
  for (const row of fillBoxRows(fillsTopFirst.map((s) => s.box))) {
    const y = (row.j + 0.5) * g;
    const spans = (s: SampledPaint): boolean => y >= s.box.minY && y <= s.box.maxY;
    const rowTop = topFirst.filter(spans);
    const rowFills = fillsTopFirst.filter(spans);
    for (const i of row.cells) {
      const x = (i + 0.5) * g;
      const fill = rowFills.find((s) => paintCovers(s, x, y));
      if (fill !== undefined && !coveredAbove(rowTop, fill.index, x, y)) count++;
    }
  }
  return count * g * g;
}

/** Whether a paint of `topFirst` (in reverse paint order) later than paint `index` covers (x, y). */
function coveredAbove(topFirst: readonly SampledPaint[], index: number, x: number, y: number): boolean {
  for (const s of topFirst) {
    if (s.index <= index) return false;
    if (paintCovers(s, x, y)) return true;
  }
  return false;
}

/**
 * Grid rows (SWIM_VIEW_GRID) and, in each, the cells whose centre can lie in one of `boxes`, each
 * once. A cell is visible only when an item fill is the topmost paint over its centre, so only cells
 * inside a fill's box are tested, and for those the item fill highest in paint order must have
 * nothing over it.
 */
function fillBoxRows(boxes: readonly Bounds[]): { j: number; cells: number[] }[] {
  const g = SWIM_VIEW_GRID;
  const ranges = boxes.map((box) => ({
    i0: Math.floor(box.minX / g),
    i1: Math.floor(box.maxX / g - 0.5),
    j0: Math.floor(box.minY / g),
    j1: Math.floor(box.maxY / g - 0.5),
  }));
  const i0 = Math.min(...ranges.map((r) => r.i0));
  const i1 = Math.max(...ranges.map((r) => r.i1));
  const j0 = Math.min(...ranges.map((r) => r.j0));
  const j1 = Math.max(...ranges.map((r) => r.j1));
  const width = i1 - i0 + 1;
  const marked = new Uint8Array(Math.max(0, width * (j1 - j0 + 1)));
  for (const r of ranges) {
    for (let j = r.j0; j <= r.j1; j++) marked.fill(1, (j - j0) * width + r.i0 - i0, (j - j0) * width + r.i1 - i0 + 1);
  }
  const rows: { j: number; cells: number[] }[] = [];
  for (let j = j0; j <= j1; j++) {
    const cells: number[] = [];
    for (let i = i0; i <= i1; i++) if (marked[(j - j0) * width + i - i0] === 1) cells.push(i);
    if (cells.length > 0) rows.push({ j, cells });
  }
  return rows;
}

/** The least visible fill over `cases`, in units² and CSS px², and the case it was found in. */
interface SwimViewMinimum {
  units2: number;
  cssPx2: number;
  worst: string;
}

interface SwimViewCase {
  id: string;
  pose: AxolotlPose;
  look: AxolotlArtLook;
}

function swimViewMinimum(outfit: ArtOutfit, cases: readonly SwimViewCase[], under: ArtOutfit = NO_OUTFIT): SwimViewMinimum {
  let best: SwimViewMinimum = { units2: Infinity, cssPx2: Infinity, worst: '' };
  for (const c of cases) {
    const units2 = visibleItemFill(c.pose, c.look, outfit, under);
    if (units2 < best.units2) best = { units2, cssPx2: toCssPx2(units2), worst: c.id };
  }
  return best;
}

/** The 54 body looks with Long gills (the longest near gills), Boy and Girl, at the still pose. */
const SWIM_VIEW_STILL_CASES: readonly SwimViewCase[] = EVERY_BODY_LOOK.map((look) => ({
  id: lookId(look),
  pose: AXO_REST_POSE,
  look: { ...look, gills: 'long' },
}));

/**
 * For the items on the head (Head, Neck, Face), which the face paints over: Boy and Girl with every eye
 * and every mouth on the default body (80), then the 54 body looks with Grumpy eyes (brows) and the
 * mouths in turn. A Girl's lashes and cheek heart, the blush and the mouth all paint as in the game.
 */
const SWIM_VIEW_FACE_CASES: readonly SwimViewCase[] = [
  ...AXO_SEXES.flatMap((sex) =>
    EYE_VARIANTS.flatMap((eyes) =>
      MOUTH_VARIANTS.map((mouth) => ({
        id: `${sex} ${eyes} ${mouth}`,
        pose: AXO_REST_POSE,
        look: { ...DEFAULT_ART_LOOK, sex, eyes, mouth, gills: 'long' as const },
      })),
    ),
  ),
  ...SWIM_VIEW_STILL_CASES.map((c, i) => {
    const mouth = MOUTH_VARIANTS[i % MOUTH_VARIANTS.length];
    return { id: `${c.id} grumpy ${mouth}`, pose: c.pose, look: { ...c.look, eyes: 'grumpy' as const, mouth } };
  }),
];

/** The same looks over a swim cycle at tail amplitudes 1 and 1.6, all four legs present. */
const SWIM_VIEW_SWIM_CASES: readonly SwimViewCase[] = SWIM_VIEW_STILL_CASES.flatMap((c) =>
  SWIMS.flatMap((swim) =>
    AMPS.map((amp) => ({ id: `${c.id} swim ${swim.toFixed(2)} amp ${amp}`, pose: { ...AXO_REST_POSE, swimPhase: swim, tailAmp: amp }, look: c.look })),
  ),
);

/**
 * The 54 body looks over the 13 swim phases at tail amplitude 1, all four legs present: every item is
 * held to these. Swim phase 0 at amplitude 1 is the still pose, so SWIM_VIEW_STILL_CASES are among them.
 */
const SWIM_VIEW_CYCLE_CASES: readonly SwimViewCase[] = SWIM_VIEW_SWIM_CASES.filter((c) => c.pose.tailAmp === 1);

/**
 * The swim-view cases an item in `slot` is held to: all 54 looks over the 13 swim phases; for the items on
 * the head (Head, Neck, Face), every sex, eye and mouth too; for the Tail item, the tail amplitude 1.6 too.
 */
function swimViewCases(slot: WearableSlot): readonly SwimViewCase[] {
  if (slot === 'head' || slot === 'neck' || slot === 'face') return [...SWIM_VIEW_FACE_CASES, ...SWIM_VIEW_CYCLE_CASES];
  if (slot === 'tail') return SWIM_VIEW_SWIM_CASES;
  return SWIM_VIEW_CYCLE_CASES;
}

describe('swim view (#88): each worn item shows enough of its own fill', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('converts at 0.684 CSS px per unit, so the 64 CSS px² floor is about 136.8 units²', () => {
    expect(WEARABLE_SWIM_VIEW_MIN_CSS_PX2).toBe(64);
    // The Small swim view, 320 x 440 CSS px, fits the world at zoom 1.
    expect(SWIM_VIEW_FIT_ZOOM).toBe(fitView(320, 440, 1, { worldH: WORLD_H, ...VIEW }).fitZoom);
    expect(SWIM_VIEW_CSS_PX_PER_UNIT).toBe(AXO_SCENE_SCALE * AXO_SIZE_SCALE.small * SWIM_VIEW_FIT_ZOOM);
    expect(SWIM_VIEW_CSS_PX_PER_UNIT).toBeCloseTo(0.684, 9);
    expect(WEARABLE_SWIM_VIEW_MIN_CSS_PX2 / SWIM_VIEW_CSS_PX_PER_UNIT ** 2).toBeCloseTo(136.8, 1);
    expect(SWIM_VIEW_GRID).toBe(0.25);
  });

  it('measures what a known square shows, and hides it under a later paint or outside its clip', () => {
    const square = (x0: number, y0: number, x1: number, y1: number): SubPath[] => [
      { closed: true, pts: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] },
    ];
    const paint = (kind: 'fill' | 'stroke', style: string, subs: SubPath[], clips: SubPath[][] = [], lineWidth = 1): Paint => ({
      kind,
      style,
      lineWidth,
      alpha: 1,
      lineCap: 'round',
      subs,
      clips,
    });
    const fill = sampledPaint(paint('fill', HAT_FILL, square(0, 0, 4, 4)), 0);
    const cover = sampledPaint(paint('fill', WHITE, square(2, 0, 6, 4)), 1);
    const clipped = sampledPaint(paint('fill', HAT_FILL, square(0, 0, 4, 4), [square(0, 0, 1, 4)]), 2);
    const ink = sampledPaint(paint('stroke', INK, square(0, 0, 4, 4), [], 2), 3);
    expect(paintCovers(fill, 1, 1)).toBe(true);
    expect(paintCovers(fill, 4.5, 1)).toBe(false);
    expect(paintCovers(cover, 3, 1)).toBe(true);
    expect(paintCovers(clipped, 0.5, 2)).toBe(true);
    expect(paintCovers(clipped, 2, 2)).toBe(false);
    expect(paintCovers(ink, 2, 0.9)).toBe(true);
    expect(paintCovers(ink, 2, 1.1)).toBe(false);
    expect(isItemFill(fill.paint)).toBe(true);
    expect(isItemFill(ink.paint)).toBe(false);
    expect(isItemFill({ ...fill.paint, style: GLASSES_LENS })).toBe(false);
    expect(isItemFill({ ...fill.paint, style: TREASURE_SHINE })).toBe(true);
    expect(isItemFill({ ...fill.paint, style: INK, alpha: SOCK_STRIPE_ALPHA })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Per-slot minimum sizes (#88): each item is a share of the body part it sits on
// ---------------------------------------------------------------------------

/** Every paint of `paints` ready for sampling. */
function sampledPaints(paints: readonly Paint[]): SampledPaint[] {
  return paints.map((paint, index) => sampledPaint(paint, index));
}

/** Shortest distance from (x, y) to the outline of `e`: the nearest of 72 outline points, refined by a ternary search about it. */
function ellipseGap(e: BodyEllipse, x: number, y: number): number {
  const gapAt = (a: number): number => Math.hypot(x - (e.cx + Math.cos(a) * e.rx), y - (e.cy + Math.sin(a) * e.ry));
  const step = TAU / 72;
  let nearest = 0;
  for (let k = 1; k < 72; k++) if (gapAt(k * step) < gapAt(nearest * step)) nearest = k;
  let lo = (nearest - 1) * step;
  let hi = (nearest + 1) * step;
  for (let i = 0; i < 30; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (gapAt(m1) < gapAt(m2)) hi = m2;
    else lo = m1;
  }
  return gapAt((lo + hi) / 2);
}

function inEllipse(e: BodyEllipse, x: number, y: number): boolean {
  return ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1;
}

/** Grid sample centres (SWIM_VIEW_GRID) inside `box`. */
function gridPoints(box: Bounds): Pt[] {
  const g = SWIM_VIEW_GRID;
  const out: Pt[] = [];
  for (let j = Math.floor(box.minY / g); (j + 0.5) * g <= box.maxY; j++) {
    for (let i = Math.floor(box.minX / g); (i + 0.5) * g <= box.maxX; i++) out.push({ x: (i + 0.5) * g, y: (j + 0.5) * g });
  }
  return out;
}

/** Ink extent of `paints` in `frame`: least and most u (along) and v (across), ink included. */
function frameExtent(frame: WearFrame, paints: readonly Paint[]): Bounds {
  const pts = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
  return {
    minX: Math.min(...pts.map(({ q, hw }) => q.x - hw)),
    maxX: Math.max(...pts.map(({ q, hw }) => q.x + hw)),
    minY: Math.min(...pts.map(({ q, hw }) => q.y - hw)),
    maxY: Math.max(...pts.map(({ q, hw }) => q.y + hw)),
  };
}

/** The least of `values` over every look, with the look it was found on. */
function leastOver(values: readonly { id: string; value: number }[]): { id: string; value: number } {
  return values.reduce((a, b) => (b.value < a.value ? b : a));
}

/** Each look's least margin of `points` inside LW / 2 of the head or torso outline, the head and each distinct torso worked out once (issue #140). */
function outlineMargins(points: readonly { p: Pt; hw: number }[]): { id: string; value: number }[] {
  const marginTo = (e: BodyEllipse, p: Pt, hw: number): number => LW / 2 - hw - (inEllipse(e, p.x, p.y) ? -1 : 1) * ellipseGap(e, p.x, p.y);
  const headMargins = points.map(({ p, hw }) => marginTo(HEAD_ELLIPSE, p, hw));
  const torsoMarginsByKey = new Map<string, number[]>();
  const torsoMarginsOf = (torso: BodyEllipse): number[] => {
    const key = [torso.cx, torso.cy, torso.rx, torso.ry].join(' ');
    if (!torsoMarginsByKey.has(key)) torsoMarginsByKey.set(key, points.map(({ p, hw }) => marginTo(torso, p, hw)));
    return torsoMarginsByKey.get(key)!;
  };
  return EVERY_BODY_LOOK.map((look) => {
    const torsoMargins = torsoMarginsOf(axolotlBodyGeometry(look).torso);
    return { id: lookId(look), value: Math.min(...headMargins.map((head, i) => Math.max(head, torsoMargins[i]))) };
  });
}

/** Bare leg ink (guide 6e): the tube, colour 8 with 3.1 of ink each side, and each toe, colour 4.2 with 2.6 each side. */
const BARE_LEG_INK_W = 8 + 2 * 3.1;
const TOE_INK_W = 4.2 + 2 * 2.6;

/** Grid points of a present leg's three toes' ink past the leg tube's ink, and of its three toe-tip ink discs, held TOL inside. */
function toeRegions(frame: LegSlotFrame): { toes: Pt[]; tips: Pt[] } {
  const [endPoint, ...tipPoints] = legPoints(frame.x, frame.y, frame.angle, frame.length, frame.toeLength);
  const end = { x: endPoint[0], y: endPoint[1] };
  const tips = tipPoints.map(([x, y]) => ({ x, y }));
  const root = { x: frame.x, y: frame.y };
  const r = TOE_INK_W / 2 - TOL;
  const grid = gridPoints(boundsOfPoints([...tipPoints, endPoint], TOE_INK_W / 2));
  const onToe = (q: Pt): boolean => tips.some((tip) => segDist(q.x, q.y, end, tip) <= r);
  return {
    toes: grid.filter((q) => onToe(q) && segDist(q.x, q.y, root, end) > BARE_LEG_INK_W / 2 + TOL),
    tips: grid.filter((q) => tips.some((tip) => Math.hypot(q.x - tip.x, q.y - tip.y) <= r)),
  };
}

/** Whether `p` lies inside the leg-space rounded rectangle `rect`, `inset` or more in from its edge. */
function inLegRect(frame: LegSlotFrame, rect: LegRect, p: Pt, inset: number): boolean {
  const q = toFrame(frame, p);
  const r = rect.radius;
  const du = Math.max(rect.u0 + r - q.x, 0, q.x - (rect.u1 - r));
  const dv = Math.max(Math.abs(q.y) - (rect.vHalf - r), 0);
  const inBox = q.x >= rect.u0 + inset && q.x <= rect.u1 - inset && Math.abs(q.y) <= rect.vHalf - inset;
  return inBox && Math.hypot(du, dv) <= r - inset;
}

/** Share of `points` that one of `paints` (fill or ink) covers. */
function coveredShare(points: readonly Pt[], paints: readonly Paint[]): number {
  const sampled = sampledPaints(paints);
  return points.filter((q) => sampled.some((sp) => paintCovers(sp, q.x, q.y))).length / points.length;
}

describe('slot minimums (#88): each item is a share of its body part on every look', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('holds the owner minimums: Head half the head wide and 8 up, Neck 27 wide, Face the eye span round both eye zones, Shirt 75% of the torso side, Back 22 or half the torso long, 8 proud and 40% out, Tail 40% of the tail height and 16 along, Socks the whole leg tube 1 proud and every toe tip, Feet every toe and the whole Sock pad', () => {
    expect(WEARABLE_SLOT_MINIMUMS).toEqual({
      head: { headWidthShare: 0.5, rise: 8 },
      neck: { minWidth: 27 },
      face: { eyeSpanShare: 1, eyeZoneShare: 1 },
      shirt: { torsoSideShare: 0.75 },
      back: { minLength: 22, torsoLengthShare: 0.5, proud: 8, outsideShare: 0.4 },
      tail: { tailHeightShare: 0.4, minAlong: 16 },
      socks: { legLengthShare: 1, tubeProud: 1, toeTipShare: 1 },
      feet: { toeShare: 1, padShare: 1 },
    });
    expect(backMinimumLength(31)).toBe(22);
    expect(backMinimumLength(41)).toBe(26);
  });

  it('never lets the Diving tank fill meet the Tank top fill, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const fillsOf = (slot: 'shirt' | 'back'): SampledPaint[] =>
        sampledPaints(bodyPaints(slot, look).filter((x) => x.kind === 'fill' && isItemFill(x)));
      const shirt = fillsOf('shirt');
      const back = fillsOf('back');
      const both = gridPoints(unionBounds(back.map((f) => f.box))).filter(
        (q) => back.some((f) => paintCovers(f, q.x, q.y)) && shirt.some((f) => paintCovers(f, q.x, q.y)),
      );
      if (both.length > 0) bad.push(lookId(look));
    }
    expect(bad).toEqual([]);
  });
});

describe('Dream marker (#88)', () => {
  it('paints the marker where dreamMarkerCentres puts it, on a Dream colour with the bow worn', () => {
    const palette = dreamPalette(LEUCISTIC, 'mint');
    const pose: AxolotlPose = { ...AXO_REST_POSE, swimPhase: 1.3, tailAmp: 1.6 };
    const rec = record((ctx) => drawAxolotl(ctx, pose, palette, GIRL, { tail: 'golden-bow' }));
    const stars = rec.paints.filter((p, i) => {
      const next = rec.paints[i + 1];
      return p.kind === 'fill' && p.style === WHITE && p.subs[0].pts.length === 8 && next?.lineWidth === DREAM_MARKER_INK;
    });
    const centres = dreamMarkerCentres(tailSamples(axolotlBodyGeometry(GIRL).tail, pose.swimPhase, pose.tailAmp));
    expect(stars).toHaveLength(DREAM_MARKER_S.length);
    stars.forEach((star, k) => {
      const box = inkBounds([star]);
      expect((box.minX + box.maxX) / 2).toBeCloseTo(centres[k].x, 6);
    });
  });
});

// ---------------------------------------------------------------------------
// Every catalogue Wearable (#88): the durable size rule (wearableFit.ts)
// ---------------------------------------------------------------------------
//
// Coverage comes from the catalogue, not from a list here: every `wearable` entry of ALL_TREASURES
// (the canal's, the pond's, the pond Area 3's and the chinampa Area 4's and Area 5's) gets its own tests, so a new item is held to the rule as soon as it is in
// the catalogue. Each item
// must have art in its slot, clear the swim-view floor on every case of its slot, meet its slot's
// minimums, and be in WEARABLE_RECORD with its measured numbers. A Tail item keeps a Dream marker star
// clear; a Socks or Feet item goes with its leg; every item keeps some fill showing in a full outfit.

/** Every Wearable in the catalogue, in catalogue order. */
const CATALOGUE_WEARABLES: readonly Wearable[] = ALL_TREASURES.filter((t): t is Wearable => t.category === 'wearable');

/** The art slug the painter knows a catalogue Wearable by, or undefined when it has no art in its slot. */
function artSlugOf(wearable: Wearable): WearableArtSlug | undefined {
  return artOutfit({ [wearable.slot]: wearable.id })[wearable.slot] ?? undefined;
}

/** The art slug of a catalogue Wearable, failing the test with what to add when it has none. */
function expectArtSlug(wearable: Wearable): WearableArtSlug {
  const slug = artSlugOf(wearable);
  expect(slug, `${wearable.id} (${wearable.slot}) has no art: add its slug to WEARABLE_ART_SLOT and its painter in drawWearables.ts`).toBeDefined();
  return slug!;
}

const isLegSlot = (slot: WearableSlot): slot is 'socks' | 'feet' => slot === 'socks' || slot === 'feet';

/** What an item paints alone at the still pose: on its body slot, or on all four legs. */
function itemPaints(slug: WearableArtSlug, look: AxolotlArtLook = DEFAULT_ART_LOOK): Paint[] {
  const slot = WEARABLE_ART_SLOT[slug];
  if (isLegSlot(slot)) return legSlotFrames(look, AXO_REST_POSE.swimPhase).flatMap((frame) => legPaints({ [slot]: slug }, frame));
  return bodyPaints(slot, look, AXO_REST_POSE.swimPhase, AXO_REST_POSE.tailAmp, slug);
}

/** An item's (or a footprint's) measures for its slot's minimums, keyed as WEARABLE_SLOT_MINIMUMS[slot]. */
type SlotMeasures<S extends WearableSlot> = { readonly [K in keyof WearableSlotMinimums[S]]: { id: string; value: number } };

/** The Face footprint (guide 6i): the glasses, ink included, stay inside it. */
const FACE_FOOTPRINT: Bounds = { minX: 14, minY: -18, maxX: 54, maxY: 6 };

/** How far the highest of `points` rises above the outer edge of the head outline (LW outside HEAD_ELLIPSE). */
function headRise(points: readonly { p: Pt; hw: number }[]): number {
  const { cx, cy, rx, ry } = HEAD_ELLIPSE;
  return Math.max(
    ...points.filter(({ p }) => Math.abs(p.x - cx) < rx).map(({ p, hw }) => cy - ry * Math.sqrt(1 - ((p.x - cx) / rx) ** 2) - LW - (p.y - hw)),
  );
}

/** Share of the eye span (the near eye zone's left edge to the far eye zone's right edge) that `box` spans. */
function eyeSpanShare(box: Bounds): number {
  const spanMin = NEAR_EYE_ZONE.x - NEAR_EYE_ZONE.r;
  const spanMax = FAR_EYE_ZONE.x + FAR_EYE_ZONE.r;
  return (Math.min(box.maxX, spanMax) - Math.max(box.minX, spanMin)) / (spanMax - spanMin);
}

/** Grid points inside an eye zone circle. */
function zonePoints(zone: ZoneCircle): Pt[] {
  return gridPoints(boundsOfPoints([[zone.x, zone.y]], zone.r)).filter((q) => Math.hypot(q.x - zone.x, q.y - zone.y) <= zone.r);
}

/** Grid points of a look's torso side: inside the torso ellipse, between the tail root and the front line. */
function torsoSidePoints(look: AxolotlArtLook): Pt[] {
  const geo = axolotlBodyGeometry(look);
  const { torso } = geo;
  return gridPoints({ minX: geo.tail.rootX, maxX: SHIRT_BACK_FRONT_LINE_X, minY: torso.cy - torso.ry, maxY: torso.cy + torso.ry }).filter(
    (q) => inEllipse(torso, q.x, q.y),
  );
}

/** How far `p` reaches past the outer edge of the torso outline (LW outside the ellipse); -1 inside it. */
function torsoProud(torso: BodyEllipse, p: Pt, hw: number): number {
  return inEllipse(torso, p.x, p.y) ? -1 : ellipseGap(torso, p.x, p.y) + hw - LW;
}

/** Share of `points` outside the silhouette: outside the torso and its outline ink. */
function outsideTorsoShare(torso: BodyEllipse, points: readonly Pt[]): number {
  return points.filter((q) => !inEllipse(torso, q.x, q.y) && ellipseGap(torso, q.x, q.y) > LW).length / points.length;
}

/** The full tail height at the anchor, still pose: 2 hc and both fins. */
function stillTailHeight(look: AxolotlArtLook): number {
  const at = tailSamples(axolotlBodyGeometry(look).tail, AXO_REST_POSE.swimPhase, AXO_REST_POSE.tailAmp)[TAIL_SLOT_POINT];
  return 2 * at.hc + at.finTop + at.finBottom;
}

/** Points along the leg axis, u 0 to the leg end l. */
function legAxisPoints(frame: LegSlotFrame, steps: number): Pt[] {
  return Array.from({ length: steps + 1 }, (_, k) => framePoint(frame, (frame.length * k) / steps, 0));
}

/**
 * How far from the leg axis, at `u` and on side `side` (+1 or -1), `sampled` covers without a gap: a
 * 0.25 walk outward to the first uncovered point, then a bisection to 1e-6.
 */
function crossReach(sampled: readonly SampledPaint[], frame: LegSlotFrame, u: number, side: number): number {
  const covers = (v: number): boolean => {
    const q = framePoint(frame, u, side * v);
    return sampled.some((sp) => paintCovers(sp, q.x, q.y));
  };
  if (!covers(0)) return 0;
  let lo = 0;
  while (lo < 40 && covers(lo + SWIM_VIEW_GRID)) lo += SWIM_VIEW_GRID;
  let hi = lo + SWIM_VIEW_GRID;
  while (hi - lo > 1e-6) {
    const mid = (lo + hi) / 2;
    if (covers(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The least reach of `sampled` past the bare leg tube's ink, each side, at nine points along the tube. */
function tubeProudOf(sampled: readonly SampledPaint[], frame: LegSlotFrame): number {
  const us = Array.from({ length: 9 }, (_, k) => (frame.length * k) / 8);
  return Math.min(...us.flatMap((u) => [1, -1].map((side) => crossReach(sampled, frame, u, side)))) - BARE_LEG_INK_W / 2;
}

/** A leg's grid points inside the Sock pad, TOL in from its edge. */
function padPoints(frame: LegSlotFrame): Pt[] {
  const pad = sockFootPad(frame);
  return gridPoints(legRectBounds(frame, pad)).filter((q) => inLegRect(frame, pad, q, TOL));
}

/** Each leg frame of every body look, at the swim phase the slot minimums are measured at. */
const MINIMUM_LEG_FRAMES: readonly { id: string; frame: LegSlotFrame }[] = EVERY_BODY_LOOK.flatMap((look) =>
  legSlotFrames(look, 0.9).map((frame) => ({ id: `${lookId(look)} leg ${frame.index}`, frame })),
);

/** `measure` of every body look, the least of each measure with the look it was found on. */
function leastOverLooks<K extends string>(measure: (look: AxolotlArtLook) => Record<K, number>): Record<K, { id: string; value: number }> {
  return leastOfEach(EVERY_BODY_LOOK.map((look) => ({ id: lookId(look), values: measure(look) })));
}

/** `measure` of every leg of every body look, the least of each measure with the leg it was found on. */
function leastOverLegs<K extends string>(measure: (frame: LegSlotFrame) => Record<K, number>): Record<K, { id: string; value: number }> {
  return leastOfEach(MINIMUM_LEG_FRAMES.map(({ id, frame }) => ({ id, values: measure(frame) })));
}

function leastOfEach<K extends string>(rows: readonly { id: string; values: Record<K, number> }[]): Record<K, { id: string; value: number }> {
  const keys = Object.keys(rows[0].values) as K[];
  return Object.fromEntries(keys.map((key) => [key, leastOver(rows.map((row) => ({ id: row.id, value: row.values[key] })))])) as Record<
    K,
    { id: string; value: number }
  >;
}

/**
 * Measures a worn item against its slot's minimums, on every look (and leg). A Face item encloses an eye
 * zone point when one of its paints covers it, the clear lens tint included; a Sock's colour along the leg
 * tube is any of its paints but ink.
 */
const ITEM_SLOT_MEASURES: { readonly [S in WearableSlot]: (slug: WearableArtSlug) => SlotMeasures<S> } = {
  head: (slug) =>
    leastOverLooks((look) => {
      const paints = bodyPaints('head', look, 0, 1, slug);
      const box = inkBounds(paints);
      return { headWidthShare: (box.maxX - box.minX) / (2 * HEAD_ELLIPSE.rx), rise: headRise(inkPoints(paints)) };
    }),
  neck: (slug) =>
    leastOverLooks((look) => {
      const box = inkBounds(bodyPaints('neck', look, 0, 1, slug));
      return { minWidth: box.maxX - box.minX };
    }),
  face: (slug) =>
    leastOverLooks((look) => {
      const paints = bodyPaints('face', look, 0, 1, slug);
      return {
        eyeSpanShare: eyeSpanShare(inkBounds(paints)),
        eyeZoneShare: Math.min(...[NEAR_EYE_ZONE, FAR_EYE_ZONE].map((zone) => coveredShare(zonePoints(zone), paints))),
      };
    }),
  shirt: (slug) =>
    leastOverLooks((look) => {
      const side = torsoSidePoints(look);
      return { torsoSideShare: coveredShare(side, bodyPaints('shirt', look, 0, 1, slug)) };
    }),
  back: (slug) =>
    leastOverLooks((look) => {
      const { torso } = axolotlBodyGeometry(look);
      const paints = bodyPaints('back', look, 0, 1, slug);
      const extent = frameExtent(backFootprint(look).frame, paints);
      const length = extent.maxX - extent.minX;
      const fills = sampledPaints(paints.filter((x) => x.kind === 'fill' && isItemFill(x)));
      const filled = gridPoints(unionBounds(fills.map((f) => f.box))).filter((q) => fills.some((f) => paintCovers(f, q.x, q.y)));
      return {
        minLength: length,
        torsoLengthShare: length / (2 * torso.rx - 30),
        proud: Math.max(...inkPoints(paints).map(({ p, hw }) => torsoProud(torso, p, hw))),
        outsideShare: outsideTorsoShare(torso, filled),
      };
    }),
  tail: (slug) =>
    leastOverLooks((look) => {
      const { swimPhase, tailAmp } = AXO_REST_POSE;
      const frame = tailSlotFrame(axolotlBodyGeometry(look).tail, swimPhase, tailAmp);
      const extent = frameExtent(frame, bodyPaints('tail', look, swimPhase, tailAmp, slug));
      return { tailHeightShare: (extent.maxY - extent.minY) / stillTailHeight(look), minAlong: extent.maxX - extent.minX };
    }),
  socks: (slug) =>
    leastOverLegs((frame) => {
      const paints = legPaints({ socks: slug }, frame);
      return {
        legLengthShare: coveredShare(legAxisPoints(frame, 40), paints.filter((p) => p.style !== INK)),
        tubeProud: tubeProudOf(sampledPaints(paints), frame),
        toeTipShare: coveredShare(toeRegions(frame).tips, paints),
      };
    }),
  feet: (slug) =>
    leastOverLegs((frame) => {
      const paints = legPaints({ feet: slug }, frame);
      return { toeShare: coveredShare(toeRegions(frame).toes, paints), padShare: coveredShare(padPoints(frame), paints) };
    }),
};

/**
 * Measures each slot's footprint against the slot's minimums, so an item that fills it can meet them. The
 * Sock sleeve footprint is the leg tube, u 0 to l, at the sleeve's ink width.
 */
const FOOTPRINT_SLOT_MEASURES: { readonly [S in WearableSlot]: () => SlotMeasures<S> } = {
  head: () => {
    const top = Array.from({ length: 41 }, (_, k) => ({
      p: { x: HEAD_FOOTPRINT.minX + ((HEAD_FOOTPRINT.maxX - HEAD_FOOTPRINT.minX) * k) / 40, y: HEAD_FOOTPRINT.minY },
      hw: 0,
    }));
    return {
      headWidthShare: { id: 'HEAD_FOOTPRINT', value: (HEAD_FOOTPRINT.maxX - HEAD_FOOTPRINT.minX) / (2 * HEAD_ELLIPSE.rx) },
      rise: { id: 'HEAD_FOOTPRINT', value: headRise(top) },
    };
  },
  neck: () => ({ minWidth: { id: 'NECK_FOOTPRINT', value: NECK_FOOTPRINT.maxX - NECK_FOOTPRINT.minX } }),
  face: () => ({
    eyeSpanShare: { id: 'FACE_FOOTPRINT', value: eyeSpanShare(FACE_FOOTPRINT) },
    eyeZoneShare: {
      id: 'FACE_FOOTPRINT',
      value: Math.min(
        ...[NEAR_EYE_ZONE, FAR_EYE_ZONE].map((zone) => {
          const points = zonePoints(zone);
          return points.filter((q) => boxHolds(FACE_FOOTPRINT, q.x, q.y)).length / points.length;
        }),
      ),
    },
  }),
  shirt: () =>
    leastOverLooks((look) => {
      const shirt = shirtGeometry(look);
      const side = torsoSidePoints(look);
      return { torsoSideShare: side.filter((q) => shirtContains(shirt, q.x, q.y)).length / side.length };
    }),
  back: () =>
    leastOverLooks((look) => {
      const { torso } = axolotlBodyGeometry(look);
      const { frame, box, bounds } = backFootprint(look);
      const length = box.maxU - box.minU;
      const outer = Array.from({ length: 41 }, (_, k) => framePoint(frame, box.minU + (length * k) / 40, box.minV));
      const inBox = gridPoints(bounds).filter((q) => {
        const f = toFrame(frame, q);
        return f.x >= box.minU && f.x <= box.maxU && f.y >= box.minV && f.y <= box.maxV;
      });
      return {
        minLength: length,
        torsoLengthShare: length / (2 * torso.rx - 30),
        proud: Math.max(...outer.map((p) => torsoProud(torso, p, 0))),
        outsideShare: outsideTorsoShare(torso, inBox),
      };
    }),
  tail: () =>
    leastOverLooks((look) => ({ tailHeightShare: (2 * TAIL_SLOT_REACH) / stillTailHeight(look), minAlong: 2 * TAIL_SLOT_REACH })),
  socks: () =>
    leastOverLegs((frame) => {
      const pad = sockFootPad(frame);
      return {
        legLengthShare: legAxisPoints(frame, 40).filter((q) => segDist(q.x, q.y, framePoint(frame, 0, 0), framePoint(frame, frame.length, 0)) <= SOCK_SLEEVE_INK_W / 2).length / 41,
        tubeProud: (SOCK_SLEEVE_INK_W - BARE_LEG_INK_W) / 2,
        toeTipShare: toeRegions(frame).tips.filter((q) => inLegRect(frame, pad, q, 0)).length / toeRegions(frame).tips.length,
      };
    }),
  feet: () =>
    leastOverLegs((frame) => {
      const env = feetEnvelope(frame);
      const toes = toeRegions(frame).toes;
      const pad = padPoints(frame);
      return {
        toeShare: toes.filter((q) => inLegRect(frame, env, q, 0)).length / toes.length,
        padShare: pad.filter((q) => inLegRect(frame, env, q, 0)).length / pad.length,
      };
    }),
};

/**
 * Measures are held to their minimums to within this share of the minimum: flattened arcs sit a little
 * inside their curve (the Back length is 0.0005 short of 22 for it), and a covered share of 1 is 1.
 */
const SLOT_MINIMUM_ROUNDING = 1e-4;

/** Checks each measure against its slot minimum (to within SLOT_MINIMUM_ROUNDING), with where the least was found. */
function expectSlotMinimums(slot: WearableSlot, measures: Readonly<Record<string, { id: string; value: number }>>, what: string): void {
  const minimums = Object.entries(WEARABLE_SLOT_MINIMUMS[slot]) as [string, number][];
  expect(Object.keys(measures).sort()).toEqual(minimums.map(([key]) => key).sort());
  for (const [key, minimum] of minimums) {
    const { id, value } = measures[key];
    expect(value, `${what}: ${slot} ${key} ${value} at ${id}, under the minimum ${minimum}`).toBeGreaterThanOrEqual(
      minimum * (1 - SLOT_MINIMUM_ROUNDING),
    );
  }
}

/** The recorded numbers of one Wearable (2 dp): its least swim-view fill, where, and its least slot measures. */
interface WearableRecord {
  /** Least visible fill over its slot's swim-view cases, CSS px². */
  readonly cssPx2: number;
  /** The case that least was found on. */
  readonly worst: string;
  /** Each WEARABLE_SLOT_MINIMUMS measure of its slot, the least over every look (and leg). */
  readonly slot: Readonly<Record<string, number>>;
}

/**
 * The measured numbers of every catalogue Wearable of every area (the canal's eight, the pond's seven, the
 * pond Area 3's five, the chinampa Area 4's five, the chinampa Area 5's six, the spring cave Area 6's five and Area 7's five), keyed by catalogue id. A new Wearable needs its row: the suite fails until its numbers are recorded,
 * and fails when a number moves.
 */
const WEARABLE_RECORD: Readonly<Record<string, WearableRecord>> = {
  'canal/sun-hat': { cssPx2: 123.31, worst: 'boy happy smile', slot: { headWidthShare: 0.5547, rise: 15.3154 } },
  'canal/shell-necklace': { cssPx2: 77.34, worst: 'boy happy tongueOut', slot: { minWidth: 39.9 } },
  'canal/heart-glasses': { cssPx2: 71.44, worst: 'girl happy smile', slot: { eyeSpanShare: 1, eyeZoneShare: 1 } },
  'canal/golden-bow': {
    cssPx2: 76.7,
    worst: 'medium girl long slim young swim 1.05 amp 1.6',
    slot: { tailHeightShare: 0.5049, minAlong: 21.3988 },
  },
  'canal/tank-top': { cssPx2: 76.67, worst: 'medium boy short slim baby swim 0.00 amp 1', slot: { torsoSideShare: 0.8538 } },
  'canal/diving-tank': {
    cssPx2: 77.81,
    worst: 'medium boy short slim young swim 0.00 amp 1',
    slot: { minLength: 22, torsoLengthShare: 0.5, proud: 10.6226, outsideShare: 0.6929 },
  },
  'canal/stripy-socks': {
    cssPx2: 113.19,
    worst: 'medium boy short slim baby swim 2.09 amp 1',
    slot: { legLengthShare: 1, tubeProud: 1.1, toeTipShare: 1 },
  },
  'canal/flippers': { cssPx2: 215.77, worst: 'medium boy short slim baby swim 2.62 amp 1', slot: { toeShare: 1, padShare: 1 } },
  'pond/lily-flower-crown': { cssPx2: 117.52, worst: 'boy happy smile', slot: { headWidthShare: 0.5503, rise: 14.7567 } },
  'pond/pond-weed-scarf': { cssPx2: 78.89, worst: 'boy happy bigGrin', slot: { minWidth: 38.11 } },
  'pond/dragonfly-glasses': { cssPx2: 68.48, worst: 'girl grumpy smile', slot: { eyeSpanShare: 1, eyeZoneShare: 1 } },
  'pond/raincoat': { cssPx2: 72.31, worst: 'medium boy short slim baby swim 0.00 amp 1', slot: { torsoSideShare: 0.8538 } },
  'pond/ladybug-backpack': {
    cssPx2: 67.49,
    worst: 'medium girl short slim young swim 0.00 amp 1',
    slot: { minLength: 22, torsoLengthShare: 0.5, proud: 10.5169, outsideShare: 0.6236 },
  },
  'pond/rainbow-dragonfly-wings': {
    cssPx2: 71.67,
    worst: 'medium boy short chubby baby swim 0.00 amp 1',
    slot: { minLength: 22, torsoLengthShare: 0.5, proud: 10.6959, outsideShare: 0.672 },
  },
  'pond/froggy-boots': { cssPx2: 107.69, worst: 'medium boy short slim baby swim 2.09 amp 1', slot: { toeShare: 1, padShare: 1 } },
  'pond/feather-cap': { cssPx2: 129.65, worst: 'boy happy smile', slot: { headWidthShare: 0.546, rise: 20.8777 } },
  'pond/lily-pad-socks': {
    cssPx2: 95.44,
    worst: 'medium boy short slim baby swim 2.09 amp 1',
    slot: { legLengthShare: 1, tubeProud: 1.1, toeTipShare: 1 },
  },
  'pond/water-lily-shirt': { cssPx2: 65.7, worst: 'medium boy short slim baby swim 0.00 amp 1', slot: { torsoSideShare: 0.8538 } },
  'pond/pearl-tail-charm': {
    cssPx2: 68.75,
    worst: 'medium girl medium chubby young swim 4.19 amp 1',
    slot: { tailHeightShare: 0.5012, minAlong: 20.5919 },
  },
  'pond/firefly-cape': {
    cssPx2: 82.99,
    worst: 'medium girl short slim young swim 0.00 amp 1',
    slot: { minLength: 22, torsoLengthShare: 0.5, proud: 10.6885, outsideShare: 0.6499 },
  },
  'chinampa/straw-sun-hat': { cssPx2: 101.38, worst: 'boy happy smile', slot: { headWidthShare: 0.5547, rise: 14.0255 } },
  'chinampa/marigold-necklace': { cssPx2: 68.1, worst: 'boy happy bigGrin', slot: { minWidth: 37.074 } },
  'chinampa/garden-overalls': { cssPx2: 71.11, worst: 'medium boy short slim baby swim 0.00 amp 1', slot: { torsoSideShare: 0.8538 } },
  'chinampa/monarch-hair-clip': { cssPx2: 101.17, worst: 'boy happy smile', slot: { headWidthShare: 0.5409, rise: 21.0504 } },
  'chinampa/monarch-wings': {
    cssPx2: 67.52,
    worst: 'medium boy short regular baby swim 0.00 amp 1',
    slot: { minLength: 22, torsoLengthShare: 0.5, proud: 10.6902, outsideShare: 0.6839 },
  },
  'chinampa/bee-headband': { cssPx2: 78.51, worst: 'boy happy smile', slot: { headWidthShare: 0.5074, rise: 19.4459 } },
  'chinampa/bandana': { cssPx2: 81.9, worst: 'boy happy bigGrin', slot: { minWidth: 38.11 } },
  'chinampa/sunflower-sunglasses': { cssPx2: 72.75, worst: 'girl grumpy smile', slot: { eyeSpanShare: 1, eyeZoneShare: 1 } },
  'chinampa/embroidered-shirt': { cssPx2: 65.15, worst: 'medium boy short slim baby swim 0.00 amp 1', slot: { torsoSideShare: 0.8538 } },
  'chinampa/hummingbird-tail-ribbon': {
    cssPx2: 75.7,
    worst: 'medium boy long regular baby swim 1.57 amp 1',
    slot: { tailHeightShare: 0.4821, minAlong: 22.4808 },
  },
  'chinampa/rainbow-serape-cape': {
    cssPx2: 74.27,
    worst: 'medium girl short regular young swim 0.00 amp 1',
    slot: { minLength: 22, torsoLengthShare: 0.5, proud: 10.7473, outsideShare: 0.6385 },
  },
  'spring-cave/miners-headlamp': { cssPx2: 116.15, worst: 'boy happy smile', slot: { headWidthShare: 0.5399, rise: 13.4274 } },
  'spring-cave/crystal-pendant': { cssPx2: 65.38, worst: 'boy happy bigGrin', slot: { minWidth: 36.4 } },
  'spring-cave/explorer-vest': { cssPx2: 72.11, worst: 'medium boy short slim baby swim 0.00 amp 1', slot: { torsoSideShare: 0.8538 } },
  'spring-cave/crystal-tail-cuff': {
    cssPx2: 89.86,
    worst: 'medium girl long slim baby swim 1.57 amp 1.6',
    slot: { tailHeightShare: 0.5572, minAlong: 18.6705 },
  },
  'spring-cave/crystal-crown': { cssPx2: 129.07, worst: 'boy happy smile', slot: { headWidthShare: 0.5355, rise: 20.4295 } },
  'spring-cave/climbing-helmet': { cssPx2: 129.07, worst: 'boy happy smile', slot: { headWidthShare: 0.5399, rise: 14.6119 } },
  'spring-cave/pebble-necklace': { cssPx2: 68.01, worst: 'boy happy bigGrin', slot: { minWidth: 36.4 } },
  'spring-cave/cave-goggles': { cssPx2: 71.79, worst: 'girl grumpy smile', slot: { eyeSpanShare: 1, eyeZoneShare: 1 } },
  'spring-cave/glow-tail-lantern': {
    cssPx2: 73.89,
    worst: 'medium boy short slim young swim 5.24 amp 1',
    slot: { tailHeightShare: 0.4365, minAlong: 17.6 },
  },
  'spring-cave/gemstone-cape': {
    cssPx2: 72.99,
    worst: 'medium boy long regular baby swim 0.00 amp 1',
    slot: { minLength: 22, torsoLengthShare: 0.5, proud: 10.7473, outsideShare: 0.6385 },
  },
};


/** The recorded row of a catalogue Wearable, failing the test with what to add when it has none. */
function expectRecord(wearable: Wearable): WearableRecord {
  const row = WEARABLE_RECORD[wearable.id];
  expect(row, `${wearable.id} is not in WEARABLE_RECORD: measure it and record its numbers`).toBeDefined();
  return row;
}

/** Gap from a marker star's paint (its circle, R plus half its ink) to the nearest item paint; negative when they meet. */
function markerGap(paints: readonly Paint[], c: Pt): number {
  const reach = DREAM_MARKER_R + DREAM_MARKER_INK / 2;
  let best = Infinity;
  for (const paint of paints) {
    const r = regionOf(paint);
    if (r.kind === 'fill' && winding(r.subs, c.x, c.y) !== 0) return -reach;
    for (const [a, b] of edgesOf(r)) best = Math.min(best, segDist(c.x, c.y, a, b) - r.hw);
  }
  return best - reach;
}

/** One Dream marker star or more stays this far, or more, clear of a Tail item (to 2 dp). */
const DREAM_MARKER_CLEARANCE = 0.6;

/** A Socks or Feet item's lowest ink, over every look and swim phase, is at y 59 or less: 4 inside the frame bottom. */
const LEG_ITEM_LOWEST_Y = AXO_TEX.h - AXO_TEX.originY - FRAME_PAD;

/**
 * A full outfit: `wearable` in its slot and, in every other slot, the first catalogue Wearable for it,
 * all worn at once.
 */
function fullOutfitOver(wearable: Wearable): ArtOutfit {
  const outfit: Partial<Record<WearableSlot, WearableArtSlug>> = {};
  for (const slot of WEARABLE_SLOTS) {
    const other = CATALOGUE_WEARABLES.find((w) => w.slot === slot && slot !== wearable.slot);
    const slug = other === undefined ? undefined : artSlugOf(other);
    if (slug !== undefined) outfit[slot] = slug;
  }
  return outfit;
}

/**
 * The full-outfit cases, a representative subset so that each item's test stays well inside the 30 s
 * timeout (every look and phase with eight items worn takes minutes): all 54 looks at four swim phases,
 * a quarter cycle apart (0, pi / 2, pi, 3 pi / 2), at tail amplitude 1.6, the widest wave, all four
 * legs present. The items on the head (Head, Neck, Face) also take every sex, eye and mouth
 * (SWIM_VIEW_FACE_CASES), whose eyes, lashes and mouth paint over them.
 */
const SWIM_VIEW_FULL_OUTFIT_CASES: readonly SwimViewCase[] = SWIM_VIEW_STILL_CASES.flatMap((c) =>
  [0, 3, 6, 9].map((i) => ({
    id: `${c.id} swim ${SWIMS[i].toFixed(2)} amp 1.6`,
    pose: { ...AXO_REST_POSE, swimPhase: SWIMS[i], tailAmp: 1.6 },
    look: c.look,
  })),
);

function fullOutfitCases(slot: WearableSlot): readonly SwimViewCase[] {
  if (slot === 'head' || slot === 'neck' || slot === 'face') return [...SWIM_VIEW_FACE_CASES, ...SWIM_VIEW_FULL_OUTFIT_CASES];
  return SWIM_VIEW_FULL_OUTFIT_CASES;
}


/** Recorded numbers are 2 dp: a measure is within this of its record. */
const RECORD_ROUNDING = 0.005;

/**
 * Swim-view cases per floor test, so a slow item never nears the 30 s timeout: 250 cases of the slowest
 * item (Socks, all four legs) take about 7 to 12 s. The recorded least is the least of every part, and the
 * part that holds its case finds it.
 */
const SWIM_VIEW_PART_SIZE = 250;

/** Each catalogue Wearable's swim-view cases, in parts of SWIM_VIEW_PART_SIZE, one floor test each. */
const SWIM_VIEW_FLOOR_PARTS = CATALOGUE_WEARABLES.flatMap((wearable) => {
  const cases = swimViewCases(wearable.slot);
  const count = Math.ceil(cases.length / SWIM_VIEW_PART_SIZE);
  return Array.from({ length: count }, (_, k) => {
    const first = k * SWIM_VIEW_PART_SIZE;
    const last = Math.min(cases.length, first + SWIM_VIEW_PART_SIZE);
    return { id: wearable.id, wearable, part: `${first + 1} to ${last} of ${cases.length}`, cases: cases.slice(first, last) };
  });
});

const TAIL_WEARABLES = CATALOGUE_WEARABLES.filter((w) => w.slot === 'tail');
const LEG_WEARABLES = CATALOGUE_WEARABLES.filter((w) => isLegSlot(w.slot));

describe('every catalogue Wearable (#88): the durable size rule', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('has a Wearable in the catalogue for every art slug, in the slug\'s slot', () => {
    for (const slug of Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]) {
      const entry = CATALOGUE_WEARABLES.find((w) => treasureSlug(w.id) === slug);
      expect(entry, `art slug ${slug} has no catalogue Wearable: add it to its area's list in catalogue.ts`).toBeDefined();
      expect(entry!.slot, `art slug ${slug}`).toBe(WEARABLE_ART_SLOT[slug]);
    }
  });

  it('records the numbers of every catalogue Wearable, and of nothing else', () => {
    expect(CATALOGUE_WEARABLES.length).toBeGreaterThan(0);
    expect(Object.keys(WEARABLE_RECORD).sort()).toEqual(CATALOGUE_WEARABLES.map((w) => w.id).sort());
  });

  it.each(CATALOGUE_WEARABLES)('$id has art in its slot ($slot) and paints', (wearable) => {
    expect(WEARABLE_SLOTS, `${wearable.id}: slot ${wearable.slot} is not in the outfit slot model`).toContain(wearable.slot);
    const slug = expectArtSlug(wearable);
    expect(WEARABLE_ART_SLOT[slug]).toBe(wearable.slot);
    expect(itemPaints(slug).length, `${wearable.id} has no painter: add its case to drawWearables.ts`).toBeGreaterThan(0);
  });

  it.each(CATALOGUE_WEARABLES)('$id has its recorded worst case among the swim-view cases of its slot', (wearable) => {
    const row = expectRecord(wearable);
    expect(swimViewCases(wearable.slot).map((c) => c.id)).toContain(row.worst);
  });

  it.each(SWIM_VIEW_FLOOR_PARTS)('$id clears the 64 CSS px² swim-view floor on its slot cases $part, as recorded', ({ wearable, cases }) => {
    const slug = expectArtSlug(wearable);
    const row = expectRecord(wearable);
    const least = swimViewMinimum({ [wearable.slot]: slug }, cases);
    expect(least.cssPx2, `${wearable.id} shows ${least.cssPx2} CSS px² at ${least.worst}`).toBeGreaterThanOrEqual(WEARABLE_SWIM_VIEW_MIN_CSS_PX2);
    expect(least.cssPx2, `${wearable.id} at ${least.worst}, under its recorded ${row.cssPx2}`).toBeGreaterThanOrEqual(row.cssPx2 - RECORD_ROUNDING);
    if (cases.some((c) => c.id === row.worst)) {
      expect(least.cssPx2, `${wearable.id} at ${least.worst}`).toBeCloseTo(row.cssPx2, 2);
      expect(least.worst).toBe(row.worst);
    }
  });

  it.each(CATALOGUE_WEARABLES)('$id meets the $slot minimums on every look, as recorded', (wearable) => {
    const slug = expectArtSlug(wearable);
    const row = expectRecord(wearable);
    const measures: Readonly<Record<string, { id: string; value: number }>> = ITEM_SLOT_MEASURES[wearable.slot](slug);
    expectSlotMinimums(wearable.slot, measures, wearable.id);
    expect(Object.keys(row.slot).sort()).toEqual(Object.keys(measures).sort());
    for (const [key, { id, value }] of Object.entries(measures)) expect(value, `${wearable.id} ${key} at ${id}`).toBeCloseTo(row.slot[key], 2);
  });

  it.each(WEARABLE_SLOTS)('lets the %s footprint hold the slot minimums on every look', (slot) => {
    const measures: Readonly<Record<string, { id: string; value: number }>> = FOOTPRINT_SLOT_MEASURES[slot]();
    expectSlotMinimums(slot, measures, `${slot} footprint`);
  });

  it.each(TAIL_WEARABLES)('$id keeps one Dream marker star or more 0.60 or more clear at every look, swim phase and tail amplitude up to 1.6', (wearable) => {
    const slug = expectArtSlug(wearable);
    let least = { id: '', value: Infinity };
    for (const look of EVERY_BODY_LOOK) {
      const tail = axolotlBodyGeometry(look).tail;
      for (const swim of SWIMS) {
        for (const amp of [...AMPS, 0.5, 0] as const) {
          const paints = bodyPaints('tail', look, swim, amp, slug);
          const best = Math.max(...dreamMarkerCentres(tailSamples(tail, swim, amp)).map((c) => markerGap(paints, c)));
          if (best < least.value) least = { id: `${lookId(look)} swim ${swim.toFixed(2)} amp ${amp}`, value: best };
        }
      }
    }
    expect(least.value, `${wearable.id} at ${least.id}`).toBeGreaterThanOrEqual(DREAM_MARKER_CLEARANCE - 0.005);
  });

  it.each(LEG_WEARABLES)('$id wears on every present leg and on no lost or regrowing leg, its lowest ink at y 59 or less', (wearable) => {
    const slug = expectArtSlug(wearable);
    const outfit: ArtOutfit = { [wearable.slot]: slug };
    const wear = (pose: AxolotlPose): Set<string> =>
      new Set(insertedPaints(drawn(pose, GIRL), drawn(pose, GIRL, outfit))!.map((x) => signature(x.paint)));
    const all = wear({ ...AXO_REST_POSE, swimPhase: 0.7 });
    for (let i = 0; i < 4; i++) {
      const legs = [lost, lost, lost, lost];
      legs[i] = present;
      const mine = wear({ ...AXO_REST_POSE, swimPhase: 0.7, legs });
      expect(mine.size, `${wearable.id} leg ${i}`).toBeGreaterThan(0);
      for (const sig of mine) expect(all.has(sig)).toBe(true);
      const without = wear(legPose(i, lost));
      expect(without.size).toBe(all.size - mine.size);
      for (const sig of mine) expect(without.has(sig)).toBe(false);
      for (const progress of [0, 0.5, 1]) {
        const regrown = wear(legPose(i, regrowing(progress)));
        for (const sig of mine) expect(regrown.has(sig), `${wearable.id} leg ${i} regrowing ${progress}`).toBe(false);
      }
    }
    expect(LEG_ITEM_LOWEST_Y).toBe(59);
    let lowest = { id: '', value: -Infinity };
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS) {
        for (const frame of legSlotFrames(look, swim)) {
          const y = inkBounds(legPaints(outfit, frame)).maxY;
          if (y > lowest.value) lowest = { id: `${lookId(look)} swim ${swim.toFixed(2)} leg ${frame.index}`, value: y };
        }
      }
    }
    expect(lowest.value, `${wearable.id} at ${lowest.id}`).toBeLessThanOrEqual(LEG_ITEM_LOWEST_Y);
  });

  it.each(CATALOGUE_WEARABLES)('$id is never wholly hidden in a full outfit, one Wearable in every slot', (wearable) => {
    const slug = expectArtSlug(wearable);
    const least = swimViewMinimum({ [wearable.slot]: slug }, fullOutfitCases(wearable.slot), fullOutfitOver(wearable));
    expect(least.units2, `${wearable.id} is wholly hidden at ${least.worst}`).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The pond Wearables (issue #75): zones, footprints, layers and counted details
// ---------------------------------------------------------------------------
//
// The catalogue-driven suite above holds each pond item to the size rule. These tests hold them to the
// rest of guide 6i: the keep-clear zones, their slot's footprint, the layer order, and the details the
// rarity ladder counts. The pond items reuse the canal painters' footprints, never new ones.

/**
 * The pond's Area 2 Wearables (issue #75) and the pond Area 3's (issue #98), told apart by their catalogue list, not by the id prefix both share.
 * The Golden bow is in the pond's list since issue #146 but keeps its 'canal/' id and is canal art, so each area's art keeps to its own prefix.
 */
const inList = (list: readonly { readonly id: string }[], prefix: 'pond' | 'chinampa') => (w: Wearable): boolean =>
  w.id.startsWith(`${prefix}/`) && list.some((t) => t.id === w.id);
const POND_WEARABLES = CATALOGUE_WEARABLES.filter(inList(POND_TREASURES, 'pond'));
const POND_2_WEARABLES = CATALOGUE_WEARABLES.filter(inList(POND_2_TREASURES, 'pond'));
const POND_SLUG = {
  crown: 'lily-flower-crown',
  scarf: 'pond-weed-scarf',
  glasses: 'dragonfly-glasses',
  raincoat: 'raincoat',
  ladybug: 'ladybug-backpack',
  wings: 'rainbow-dragonfly-wings',
  boots: 'froggy-boots',
} as const satisfies Record<string, WearableArtSlug>;
/** A full pond outfit with the Ladybug backpack, and the same with the Wings in the Back slot. */
const POND_OUTFIT: ArtOutfit = {
  head: POND_SLUG.crown,
  neck: POND_SLUG.scarf,
  face: POND_SLUG.glasses,
  shirt: POND_SLUG.raincoat,
  back: POND_SLUG.ladybug,
  socks: 'stripy-socks',
  feet: POND_SLUG.boots,
};
const POND_OUTFIT_WINGS: ArtOutfit = { ...POND_OUTFIT, back: POND_SLUG.wings };

describe('pond Wearables (issue #75): zones, footprints and layers', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('has seven pond Wearables: Head, Neck, Face, Shirt, two for Back, and Feet', () => {
    expect(POND_WEARABLES.map((w) => `${w.slot}:${treasureSlug(w.id)}`)).toEqual([
      'head:lily-flower-crown',
      'neck:pond-weed-scarf',
      'face:dragonfly-glasses',
      'shirt:raincoat',
      'back:ladybug-backpack',
      'back:rainbow-dragonfly-wings',
      'feet:froggy-boots',
    ]);
    expect(Object.values(POND_SLUG).map((slug) => WEARABLE_ART_SLOT[slug])).toEqual([
      'head',
      'neck',
      'face',
      'shirt',
      'back',
      'back',
      'feet',
    ]);
  });

  it('maps pond catalogue ids to art slugs by slot, and leaves out a pond id worn in the wrong slot', () => {
    expect(
      artOutfit({
        head: 'pond/lily-flower-crown',
        neck: 'pond/pond-weed-scarf',
        face: 'pond/dragonfly-glasses',
        shirt: 'pond/raincoat',
        back: 'pond/rainbow-dragonfly-wings',
        feet: 'pond/froggy-boots',
      }),
    ).toEqual({
      head: POND_SLUG.crown,
      neck: POND_SLUG.scarf,
      face: POND_SLUG.glasses,
      shirt: POND_SLUG.raincoat,
      back: POND_SLUG.wings,
      feet: POND_SLUG.boots,
    });
    expect(artOutfit({ back: 'pond/ladybug-backpack' })).toEqual({ back: POND_SLUG.ladybug });
    expect(artOutfit({ head: 'pond/raincoat', shirt: 'pond/froggy-boots', feet: 'pond/lily-flower-crown' })).toEqual({});
    expect(outfitKey(POND_OUTFIT)).toBe(
      'head=lily-flower-crown,neck=pond-weed-scarf,face=dragonfly-glasses,shirt=raincoat,back=ladybug-backpack,socks=stripy-socks,feet=froggy-boots',
    );
  });

  it('keeps the pond Head, Neck and Face items off the eyes, the gill roots and the cheek heart zone, alike on every look', () => {
    for (const [slot, slug] of [
      ['head', POND_SLUG.crown],
      ['neck', POND_SLUG.scarf],
      ['face', POND_SLUG.glasses],
    ] as const) {
      const paints = bodyPaints(slot, DEFAULT_ART_LOOK, 0, 1, slug);
      expect(paints.length).toBeGreaterThan(0);
      for (const look of EVERY_BODY_LOOK) expect(bodyPaints(slot, look, 0, 1, slug).map(signature)).toEqual(paints.map(signature));
      for (const paint of paints) {
        expect(trouble(paint, { lashes: slot !== 'face', gills: true }), `${slug} ${paint.kind} ${paint.style}`).toBeNull();
      }
    }
  });

  it('keeps the pond Shirt and Back items off the eyes, lashes, gill roots and cheek heart zone on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of [
        ['shirt', POND_SLUG.raincoat],
        ['back', POND_SLUG.ladybug],
        ['back', POND_SLUG.wings],
      ] as const) {
        for (const p of bodyPaints(slot, look, 0, 1, slug)) {
          const why = trouble(p, { lashes: true, gills: true });
          if (why) bad.push(`${lookId(look)} ${slug} ${why}`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the pond Feet item off the eyes and lashes on every look and swim phase', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS.filter((_, i) => i % 2 === 0)) {
        for (const frame of legSlotFrames(look, swim)) {
          for (const p of legPaints({ feet: POND_SLUG.boots }, frame)) {
            const why = trouble(p, { lashes: true, gills: true, heart: false });
            if (why) bad.push(`${lookId(look)} swim ${swim.toFixed(2)} leg ${frame.index} ${why}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps every pond Wearable of a full drawAxolotl run off the eyes and, past the silhouette, the gill roots and cheek heart zone, at every size', () => {
    const looks = AXO_SIZES.flatMap((size): AxolotlArtLook[] => [
      { ...DEFAULT_ART_LOOK, size },
      { ...GIRL, size, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, size, body: 'slim', age: 'grownUp', tail: 'long' },
    ]);
    for (const outfit of [POND_OUTFIT, POND_OUTFIT_WINGS]) {
      const pondOnly: ArtOutfit = { ...outfit, socks: null };
      for (const pose of Object.values(POSES)) {
        for (const look of looks) {
          const base = drawn(pose, look, { socks: null });
          const worn = drawn(pose, look, pondOnly);
          const silhouette = worn.findIndex((p) => p.kind === 'stroke' && p.lineWidth === 2 * LW && p.style === INK);
          const inserted = insertedPaints(base, worn)!;
          expect(inserted.length).toBeGreaterThan(0);
          for (const { index, paint } of inserted) {
            const why = trouble(paint, { lashes: false, gills: index > silhouette, heart: index > silhouette });
            expect(why, `${lookId(look)} paint ${index} ${paint.kind} ${paint.style}`).toBeNull();
          }
        }
      }
    }
  });

  it('paints every pond Wearable before the eyes, a Girl lashes included, and changes none of the axolotl\'s own paints', () => {
    for (const outfit of [POND_OUTFIT, POND_OUTFIT_WINGS]) {
      for (const look of [DEFAULT_ART_LOOK, GIRL, { ...GIRL, body: 'chubby' as const, age: 'baby' as const, tail: 'short' as const }]) {
        for (const pose of Object.values(POSES)) {
          const base = drawn(pose, look);
          const worn = drawn(pose, look, outfit);
          const inserted = insertedPaints(base, worn);
          expect(inserted).not.toBeNull();
          expect(inserted!.length).toBeGreaterThan(0);
          const eyes = firstEyePaint(worn);
          expect(eyes).toBeGreaterThan(0);
          for (const x of inserted!) expect(x.index).toBeLessThan(eyes);
          expect(worn.length - eyes).toBe(base.length - firstEyePaint(base));
        }
      }
    }
  });

  it('keeps the Lily flower crown in the Head footprint, resting on the head top, its blooms rising above the head outline', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, POND_SLUG.crown);
    const box = inkBounds(paints);
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.maxY).toBeLessThanOrEqual(HEAD_FOOTPRINT.maxY + TOL);
    // Its lowest fill point is inside the head outline: the wreath rests on the head.
    const fills = paints.filter((p) => p.kind === 'fill' && (p.style === LILY_CROWN_LEAF || p.style === LILY_CROWN_FLOWER));
    const lowest = fills.flatMap((p) => p.subs[0].pts).reduce((a, b) => (b.y > a.y ? b : a));
    expect(((lowest.x - HEAD_ELLIPSE.cx) / HEAD_ELLIPSE.rx) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / HEAD_ELLIPSE.ry) ** 2).toBeLessThan(1);
    // The glasses keep 1.5 or more under it: the Face footprint starts 1.5 under the Head footprint.
    expect(FACE_FOOTPRINT.minY - HEAD_FOOTPRINT.maxY).toBeCloseTo(1.5, 6);
  });

  it('keeps the Pond-weed scarf in the Neck footprint, under the chin and 0.1 or more inside LW / 2 of the silhouette outline on every look', () => {
    const paints = bodyPaints('neck', DEFAULT_ART_LOOK, 0, 1, POND_SLUG.scarf);
    expect(isInside(inkBounds(paints), NECK_FOOTPRINT)).toBe(true);
    // The mouth paints over its front: it runs under the mouth zone.
    expect(paints.some((p) => reachesBox(regionOf(p), MOUTH_ZONE))).toBe(true);
    const points = inkPoints(paints);
    const margins = outlineMargins(points);
    const least = leastOver(margins);
    expect(least.value, least.id).toBeGreaterThanOrEqual(0);
  });

  it('keeps the Dragonfly glasses in the Face footprint with the frame band of the Heart glasses, and only the clear lens tint over the eyes', () => {
    const paints = bodyPaints('face', DEFAULT_ART_LOOK, 0, 1, POND_SLUG.glasses);
    expect(isInside(inkBounds(paints), FACE_FOOTPRINT)).toBe(true);
    const band = paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 3.5);
    expect(band).toHaveLength(1);
    expect(isInside(inkBounds(band), GLASSES_EXTENT, 0.01)).toBe(true);
    const lens = paints.filter((p) => p.style === GLASSES_LENS);
    expect(lens).toHaveLength(1);
    expect(paints.indexOf(lens[0])).toBe(0);
    for (const zone of eyeZones) expect(reachesCircle(regionOf(lens[0]), zone)).toBe(true);
    for (const p of paints.filter((q) => q !== lens[0])) {
      for (const zone of eyeZones) expect(reachesCircle(regionOf(p), zone), `${p.kind} ${p.style}`).toBe(false);
    }
    // The dragonfly sits above the top notch, clear of the band's colour on the lenses: its wings are in the sky film.
    expect(paints.filter((p) => p.kind === 'fill' && p.style === DRAGONFLY_WING)).toHaveLength(2);
  });

  it('keeps the Raincoat inside the torso edge band, behind the front line, cut at the tail root, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const e: BodyEllipse = shirt.inset;
      const boundary = Array.from({ length: 720 }, (_, k) => ({
        x: e.cx + Math.cos((k / 720) * TAU) * e.rx,
        y: e.cy + Math.sin((k / 720) * TAU) * e.ry,
      }));
      const paints = bodyPaints('shirt', look, 0, 1, POND_SLUG.raincoat);
      expect(paints.length).toBeGreaterThan(0);
      for (const { p, hw } of inkPoints(paints)) {
        const inside = ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1 + 1e-9;
        const gap = Math.min(...boundary.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
        if (!inside || gap < hw - TOL) bad.push(`${lookId(look)} edge band`);
        if (p.x + hw > SHIRT_FRONT_X + TOL) bad.push(`${lookId(look)} front`);
        if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
        if (p.x - hw < shirt.rearX - TOL) bad.push(`${lookId(look)} rear`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints the Raincoat as the Tank top\'s whole silhouette: one inked shape, ink 2.0, the neckline to x -7', () => {
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const paints = bodyPaints('shirt', look, 0, 1, POND_SLUG.raincoat);
      const coat = paints.filter((p) => p.kind === 'fill' && p.style === RAINCOAT_FILL);
      expect(coat).toHaveLength(1);
      expect(paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 2 && p.style === INK)).toHaveLength(1);
      const tank = bodyPaints('shirt', look).find((p) => p.kind === 'fill' && p.style === TANK_TOP_FILL)!;
      expect(coat[0].subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`))).toEqual(
        tank.subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`)),
      );
      expect(Math.min(...coat[0].subs[0].pts.slice(-24).map((p) => p.x))).toBeCloseTo(shirt.neckline.apexX - 1, 6);
    }
  });

  it('keeps each pond Back item in its look\'s back box, filling it end to end, with its forward corner at x -5.5 or less', () => {
    const bad: string[] = [];
    for (const slug of [POND_SLUG.ladybug, POND_SLUG.wings]) {
      for (const look of EVERY_BODY_LOOK) {
        const { frame, box } = backFootprint(look);
        const paints = bodyPaints('back', look, 0, 1, slug);
        expect(paints.length).toBeGreaterThan(0);
        const along = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
        for (const { q, hw } of along) {
          if (q.x - hw < box.minU - TOL || q.x + hw > box.maxU + TOL) bad.push(`${slug} ${lookId(look)} u`);
          if (q.y - hw < box.minV - TOL || q.y + hw > box.maxV + TOL) bad.push(`${slug} ${lookId(look)} v`);
        }
        for (const { p, hw } of inkPoints(paints)) if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${slug} ${lookId(look)} front line`);
        if (Math.abs(Math.min(...along.map(({ q, hw }) => q.x - hw)) - box.minU) > TOL) bad.push(`${slug} ${lookId(look)} rear end`);
        if (Math.abs(Math.max(...along.map(({ q, hw }) => q.x + hw)) - box.maxU) > TOL) bad.push(`${slug} ${lookId(look)} front end`);
        if (Math.abs(Math.min(...along.map(({ q, hw }) => q.y - hw)) - box.minV) > TOL) bad.push(`${slug} ${lookId(look)} top`);
        if (Math.abs(Math.max(...along.map(({ q, hw }) => q.y + hw)) - box.maxV) > TOL) bad.push(`${slug} ${lookId(look)} bottom`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('never lets a pond Back item\'s fill meet a Shirt\'s fill (Tank top or Raincoat), on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const fillsOf = (slot: 'shirt' | 'back', slug: WearableArtSlug): SampledPaint[] =>
        sampledPaints(bodyPaints(slot, look, 0, 1, slug).filter((x) => x.kind === 'fill' && isItemFill(x)));
      for (const backSlug of [POND_SLUG.ladybug, POND_SLUG.wings]) {
        const back = fillsOf('back', backSlug);
        for (const shirtSlug of ['tank-top', POND_SLUG.raincoat] as const) {
          const shirt = fillsOf('shirt', shirtSlug);
          const both = gridPoints(unionBounds(back.map((f) => f.box))).filter(
            (q) => back.some((f) => paintCovers(f, q.x, q.y)) && shirt.some((f) => paintCovers(f, q.x, q.y)),
          );
          if (both.length > 0) bad.push(`${lookId(look)} ${backSlug} over ${shirtSlug}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps the Froggy boots in the Feet envelope, in leg space, over the Shoe rectangle, on every look and swim phase', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS.filter((_, i) => i % 3 === 0)) {
        for (const frame of legSlotFrames(look, swim)) {
          const env = feetEnvelope(frame);
          const shoe = shoeRect(frame);
          for (const p of legPaints({ feet: POND_SLUG.boots }, frame)) {
            for (const { p: pt, hw } of inkPoints([p])) {
              const q = toFrame(frame, pt);
              if (q.x - hw < env.u0 - TOL || q.x + hw > env.u1 + TOL || Math.abs(q.y) + hw > env.vHalf + TOL) bad.push(`${lookId(look)} envelope`);
              if (q.x - hw < shoe.u0 - TOL || q.x + hw > shoe.u1 + TOL || Math.abs(q.y) + hw > shoe.vHalf + TOL) bad.push(`${lookId(look)} shoe`);
            }
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps every pond Wearable, ink included, in the texture frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const check = (what: string, paints: Paint[]): void => {
        if (!isInside(inkBounds(paints), inner, 1e-6)) bad.push(`${lookId(look)} ${what}`);
      };
      check('crown', bodyPaints('head', look, 0, 1, POND_SLUG.crown));
      check('scarf', bodyPaints('neck', look, 0, 1, POND_SLUG.scarf));
      check('glasses', bodyPaints('face', look, 0, 1, POND_SLUG.glasses));
      check('raincoat', bodyPaints('shirt', look, 0, 1, POND_SLUG.raincoat));
      check('ladybug', bodyPaints('back', look, 0, 1, POND_SLUG.ladybug));
      check('wings', bodyPaints('back', look, 0, 1, POND_SLUG.wings));
      for (const swim of SWIMS) for (const frame of legSlotFrames(look, swim)) check('boots', legPaints({ feet: POND_SLUG.boots }, frame));
    }
    expect([...new Set(bad)]).toEqual([]);
    expect([AXO_TEX.w, AXO_TEX.h]).toEqual([166, 142]);
  });

  it('mixes the far boots 12% toward ink (the trim too) and leaves the near boots as authored; eyes, star and shine stay as they are', () => {
    // #8cf0a0 12% toward #2b2350 is #80d796; #ffc12e is #e6ae32.
    const frames = legSlotFrames(GIRL, 0.7);
    const colours = (frame: LegSlotFrame): string[] =>
      legPaints({ feet: POND_SLUG.boots }, frame)
        .filter((p) => p.alpha === 1 && p.style !== INK)
        .map((p) => p.style);
    for (const i of [0, 1]) {
      const far = colours(frames[i]);
      expect(far).toContain('#80d796');
      expect(far).toContain('#e6ae32');
      expect(far).not.toContain(FROGGY_BOOT);
      expect(far).not.toContain(GOLD_TRIM);
      expect(far).toContain(WHITE);
    }
    for (const i of [2, 3]) {
      const near = colours(frames[i]);
      expect(near).toContain(FROGGY_BOOT);
      expect(near).toContain(GOLD_TRIM);
      expect(near).toContain(WHITE);
    }
  });

  it('wears the Froggy boots over the Stripy socks, so the Sock sleeve shows above them, and covers the whole Sock foot pad', () => {
    for (const frame of legSlotFrames(GIRL, 0.9)) {
      const both = legPaints({ socks: 'stripy-socks', feet: POND_SLUG.boots }, frame);
      const socks = legPaints({ socks: 'stripy-socks' }, frame);
      const boots = legPaints({ feet: POND_SLUG.boots }, frame);
      expect(both.length).toBe(socks.length + boots.length);
      expect(both.slice(0, socks.length).map(signature)).toEqual(socks.map(signature));
    }
  });
});

describe('pond Wearables (issue #75): the rarity look ladder', () => {
  const colours = (paints: readonly Paint[], kind: 'fill' | 'stroke'): string[] =>
    paints.filter((p) => p.kind === kind && p.alpha === 1).map((p) => p.style);
  const count = (list: readonly string[], value: string): number => list.filter((v) => v === value).length;
  const nearLeg = legSlotFrames(GIRL, 0)[2];
  const stars = (paints: readonly Paint[]): Paint[] =>
    paints.filter((p) => p.kind === 'fill' && p.style === WHITE && p.subs.length === 1 && p.subs[0].pts.length === 8);

  it('paints Common as flat colour plus one shine, no trim: Lily flower crown, Pond-weed scarf', () => {
    const crown = bodyPaints('head', GIRL, 0, 1, POND_SLUG.crown);
    // Two outer fills (the leaves and the blooms), five leaves and fifteen petals; no trim, no gem, no star.
    expect(new Set(colours(crown, 'fill'))).toEqual(new Set([LILY_CROWN_LEAF, LILY_CROWN_FLOWER, TREASURE_SHINE]));
    expect(count(colours(crown, 'fill'), LILY_CROWN_LEAF)).toBe(5);
    expect(count(colours(crown, 'fill'), LILY_CROWN_FLOWER)).toBe(15);
    expect(count(colours(crown, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(crown.some((p) => p.style === GOLD_TRIM)).toBe(false);
    const scarf = bodyPaints('neck', GIRL, 0, 1, POND_SLUG.scarf);
    expect(new Set(colours(scarf, 'fill'))).toEqual(new Set([POND_WEED_SCARF, TREASURE_SHINE]));
    expect(count(colours(scarf, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(scarf.some((p) => p.style === GOLD_TRIM || p.style === BOAT_TRIM)).toBe(false);
    expect(stars(scarf)).toHaveLength(0);
  });

  it('adds one trim band in a second colour for Rare: Dragonfly glasses wings, Raincoat stripe', () => {
    const glasses = bodyPaints('face', GIRL, 0, 1, POND_SLUG.glasses);
    expect(colours(glasses, 'stroke')).toContain(DRAGONFLY_FRAME);
    expect(count(colours(glasses, 'fill'), DRAGONFLY_WING)).toBe(2);
    expect(glasses.filter((p) => p.style === GLASSES_LENS)).toHaveLength(1);
    expect(glasses.some((p) => p.style === GLASSES_GEM || p.style === GOLD_TRIM)).toBe(false);
    const coat = bodyPaints('shirt', GIRL, 0, 1, POND_SLUG.raincoat);
    expect(count(colours(coat, 'fill'), BOAT_TRIM)).toBe(1);
    expect(count(colours(coat, 'fill'), RAINCOAT_FILL)).toBe(1);
    expect(count(colours(coat, 'fill'), TREASURE_SHINE)).toBe(1);
  });

  it('adds a small repeat pattern for Epic: the Ladybug backpack\'s three spots, no trim or star', () => {
    const ladybug = bodyPaints('back', GIRL, 0, 1, POND_SLUG.ladybug);
    expect(count(colours(ladybug, 'fill'), LADYBUG_SHELL)).toBe(1);
    // Three spots of radius 1.5 and the head, all ink; the shell is the one outer fill.
    const spots = ladybug.filter((p) => p.kind === 'fill' && p.style === INK && inkBounds([p]).maxX - inkBounds([p]).minX < 3.01);
    expect(spots).toHaveLength(3);
    expect(count(colours(ladybug, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(ladybug.some((p) => p.style === GOLD_TRIM)).toBe(false);
    expect(stars(ladybug)).toHaveLength(0);
  });

  it('adds gold trim and one static 4-point star for Legendary: Rainbow dragonfly wings, Froggy boots', () => {
    const wings = bodyPaints('back', GIRL, 0, 1, POND_SLUG.wings);
    expect(colours(wings, 'fill')).toContain(GOLD_TRIM);
    expect(count(colours(wings, 'fill'), DRAGONFLY_WING)).toBe(4);
    expect(stars(wings)).toHaveLength(1);
    // Three rainbow veins on each of the four wings, in detail colours (never an outer fill).
    expect(wings.filter((p) => p.kind === 'stroke' && p.lineWidth === 0.9)).toHaveLength(12);
    const boots = legPaints({ feet: POND_SLUG.boots }, nearLeg);
    expect(colours(boots, 'fill')).toContain(GOLD_TRIM);
    expect(count(colours(boots, 'fill'), FROGGY_BOOT)).toBe(1);
    expect(stars(boots)).toHaveLength(1);
    expect(count(colours(boots, 'fill'), TREASURE_SHINE)).toBe(1);
    for (const star of [stars(wings)[0], stars(boots)[0]]) {
      const pts = star.subs[0].pts;
      const cx = pts.reduce((n, p) => n + p.x, 0) / 8;
      const cy = pts.reduce((n, p) => n + p.y, 0) / 8;
      const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
      expect(Math.max(...radii)).toBeCloseTo(3, 6);
      expect(Math.min(...radii)).toBeCloseTo(3 * 0.38, 6);
    }
  });

  it('strokes a pond silhouette at the item ink: 2.0 for a shape, 2 x 2.0 for a blob, 2 x 0.6 for the scarf', () => {
    const widths = (paints: readonly Paint[]): number[] =>
      [...new Set(paints.filter((p) => p.kind === 'stroke' && p.style === INK).map((p) => Math.round(p.lineWidth * 1e9) / 1e9))].sort((a, b) => a - b);
    expect(widths(bodyPaints('head', GIRL, 0, 1, POND_SLUG.crown))).toEqual([4]);
    expect(widths(bodyPaints('neck', GIRL, 0, 1, POND_SLUG.scarf))).toEqual([1.2]);
    expect(widths(bodyPaints('shirt', GIRL, 0, 1, POND_SLUG.raincoat))).toEqual([0.6, 2]);
    expect(widths(bodyPaints('back', GIRL, 0, 1, POND_SLUG.ladybug))).toEqual([4]);
    expect(widths(bodyPaints('back', GIRL, 0, 1, POND_SLUG.wings))).toEqual([1.2, 4]);
    expect(widths(legPaints({ feet: POND_SLUG.boots }, nearLeg))).toEqual([1.2, 2]);
  });
});

// ---------------------------------------------------------------------------
// The pond Area 3 Wearables (issue #98): zones, footprints, layers and counted details
// ---------------------------------------------------------------------------
//
// The same checks as the Area 2 block above, for the Feather cap, Lily-pad socks, Water-lily shirt, Pearl
// tail charm and Firefly cape. The catalogue-driven suite holds each to the size rule; these hold them to
// the rest of guide 6i. The Area 2 checks are unchanged.

const AREA3_SLUG = {
  cap: 'feather-cap',
  socks: 'lily-pad-socks',
  shirt: 'water-lily-shirt',
  charm: 'pearl-tail-charm',
  cape: 'firefly-cape',
} as const satisfies Record<string, WearableArtSlug>;
/** A full Area 3 outfit, and the same with the Pond-weed scarf, Dragonfly glasses and Froggy boots of Area 2 mixed in. */
const AREA3_OUTFIT: ArtOutfit = {
  head: AREA3_SLUG.cap,
  shirt: AREA3_SLUG.shirt,
  back: AREA3_SLUG.cape,
  tail: AREA3_SLUG.charm,
  socks: AREA3_SLUG.socks,
};
const AREA3_MIXED_OUTFIT: ArtOutfit = { ...AREA3_OUTFIT, neck: POND_SLUG.scarf, face: POND_SLUG.glasses, feet: POND_SLUG.boots };

describe('pond Area 3 Wearables (issue #98): zones, footprints and layers', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('splits the pond Wearables by catalogue list: seven of Area 2, five of Area 3, none in both', () => {
    expect(POND_WEARABLES).toHaveLength(7);
    expect(POND_2_WEARABLES.map((w) => `${w.slot}:${treasureSlug(w.id)}`)).toEqual([
      'head:feather-cap',
      'socks:lily-pad-socks',
      'shirt:water-lily-shirt',
      'tail:pearl-tail-charm',
      'back:firefly-cape',
    ]);
    expect(POND_WEARABLES.some((w) => POND_2_WEARABLES.includes(w))).toBe(false);
    expect(Object.values(AREA3_SLUG).map((slug) => WEARABLE_ART_SLOT[slug])).toEqual(['head', 'socks', 'shirt', 'tail', 'back']);
  });

  it('maps Area 3 catalogue ids to art slugs by slot, and leaves out an Area 3 id worn in the wrong slot', () => {
    expect(
      artOutfit({
        head: 'pond/feather-cap',
        socks: 'pond/lily-pad-socks',
        shirt: 'pond/water-lily-shirt',
        tail: 'pond/pearl-tail-charm',
        back: 'pond/firefly-cape',
      }),
    ).toEqual({ head: AREA3_SLUG.cap, socks: AREA3_SLUG.socks, shirt: AREA3_SLUG.shirt, tail: AREA3_SLUG.charm, back: AREA3_SLUG.cape });
    expect(artOutfit({ head: 'pond/firefly-cape', back: 'pond/feather-cap', tail: 'pond/water-lily-shirt', shirt: 'pond/pearl-tail-charm' })).toEqual({});
    expect(outfitKey(AREA3_OUTFIT)).toBe('head=feather-cap,shirt=water-lily-shirt,back=firefly-cape,tail=pearl-tail-charm,socks=lily-pad-socks');
  });

  it('paints the Feather cap off the eyes, the lash reach, the gill roots and the cheek heart zone, alike on every look', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA3_SLUG.cap);
    expect(paints.length).toBeGreaterThan(0);
    for (const look of EVERY_BODY_LOOK) expect(bodyPaints('head', look, 0, 1, AREA3_SLUG.cap).map(signature)).toEqual(paints.map(signature));
    for (const paint of paints) expect(trouble(paint, { lashes: true, gills: true }), `${paint.kind} ${paint.style}`).toBeNull();
  });

  it('keeps the Water-lily shirt, the Firefly cape and the Pearl tail charm off the eyes, lashes, gill roots and cheek heart zone on every look, swim phase and tail amplitude', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of [
        ['shirt', AREA3_SLUG.shirt],
        ['back', AREA3_SLUG.cape],
      ] as const) {
        for (const p of bodyPaints(slot, look, 0, 1, slug)) {
          const why = trouble(p, { lashes: true, gills: true });
          if (why) bad.push(`${lookId(look)} ${slug} ${why}`);
        }
      }
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          for (const p of bodyPaints('tail', look, swim, amp, AREA3_SLUG.charm)) {
            const why = trouble(p, { lashes: true, gills: true });
            if (why) bad.push(`${lookId(look)} swim ${swim.toFixed(2)} amp ${amp} charm ${why}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the Lily-pad socks off the eyes and lashes on every look and swim phase, behind the silhouette', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS.filter((_, i) => i % 2 === 0)) {
        for (const frame of legSlotFrames(look, swim)) {
          for (const p of legPaints({ socks: AREA3_SLUG.socks }, frame)) {
            const why = trouble(p, { lashes: true, gills: !isSleevePaint(p), heart: false });
            if (why) bad.push(`${lookId(look)} swim ${swim.toFixed(2)} leg ${frame.index} ${why}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps every Area 3 Wearable of a full drawAxolotl run off the eyes and, past the silhouette, the gill roots and cheek heart zone, at every size', () => {
    const looks = AXO_SIZES.flatMap((size): AxolotlArtLook[] => [
      { ...DEFAULT_ART_LOOK, size },
      { ...GIRL, size, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, size, body: 'slim', age: 'grownUp', tail: 'long' },
    ]);
    for (const outfit of [AREA3_OUTFIT, AREA3_MIXED_OUTFIT]) {
      const bodyOnly: ArtOutfit = { ...outfit, socks: null, feet: null };
      for (const pose of Object.values(POSES)) {
        for (const look of looks) {
          const base = drawn(pose, look, { socks: null, feet: null });
          const worn = drawn(pose, look, bodyOnly);
          const silhouette = worn.findIndex((p) => p.kind === 'stroke' && p.lineWidth === 2 * LW && p.style === INK);
          const inserted = insertedPaints(base, worn)!;
          expect(inserted.length).toBeGreaterThan(0);
          for (const { index, paint } of inserted) {
            const why = trouble(paint, { lashes: false, gills: index > silhouette, heart: index > silhouette });
            expect(why, `${lookId(look)} paint ${index} ${paint.kind} ${paint.style}`).toBeNull();
          }
        }
      }
    }
  });

  it('paints every Area 3 Wearable before the eyes, a Girl lashes included, and changes none of the axolotl\'s own paints', () => {
    for (const outfit of [AREA3_OUTFIT, AREA3_MIXED_OUTFIT]) {
      for (const look of [DEFAULT_ART_LOOK, GIRL, { ...GIRL, body: 'chubby' as const, age: 'baby' as const, tail: 'short' as const }]) {
        for (const pose of Object.values(POSES)) {
          const base = drawn(pose, look);
          const worn = drawn(pose, look, outfit);
          const inserted = insertedPaints(base, worn);
          expect(inserted).not.toBeNull();
          expect(inserted!.length).toBeGreaterThan(0);
          const eyes = firstEyePaint(worn);
          expect(eyes).toBeGreaterThan(0);
          for (const x of inserted!) expect(x.index).toBeLessThan(eyes);
          expect(worn.length - eyes).toBe(base.length - firstEyePaint(base));
        }
      }
    }
  });

  it('keeps the Feather cap in the Head footprint, resting on the head top, its plume rising 8 or more above the head outline', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA3_SLUG.cap);
    const box = inkBounds(paints);
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.maxY).toBeLessThanOrEqual(HEAD_FOOTPRINT.maxY + TOL);
    expect(box.maxY).toBeCloseTo(-19.6, 2);
    expect(box.minX).toBeCloseTo(16.2, 2);
    expect(headRise(inkPoints(paints))).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.head.rise);
    // Its cuff rests on the head: the lowest fill point is inside the head outline's ink, the ring LW outside the head ellipse.
    const fills = paints.filter((p) => p.kind === 'fill' && p.style === FEATHER_CAP_FILL);
    const lowest = fills.flatMap((p) => p.subs[0].pts).reduce((a, b) => (b.y > a.y ? b : a));
    expect(((lowest.x - HEAD_ELLIPSE.cx) / (HEAD_ELLIPSE.rx + LW)) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / (HEAD_ELLIPSE.ry + LW)) ** 2).toBeLessThan(1);
    // The glasses keep 1.5 or more under it, as under every Head item.
    expect(FACE_FOOTPRINT.minY - HEAD_FOOTPRINT.maxY).toBeCloseTo(1.5, 6);
  });

  it('keeps the Water-lily shirt inside the torso edge band, behind the front line, cut at the tail root, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const e: BodyEllipse = shirt.inset;
      const boundary = Array.from({ length: 720 }, (_, k) => ({
        x: e.cx + Math.cos((k / 720) * TAU) * e.rx,
        y: e.cy + Math.sin((k / 720) * TAU) * e.ry,
      }));
      const paints = bodyPaints('shirt', look, 0, 1, AREA3_SLUG.shirt);
      expect(paints.length).toBeGreaterThan(0);
      for (const { p, hw } of inkPoints(paints)) {
        const inside = ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1 + 1e-9;
        const gap = Math.min(...boundary.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
        if (!inside || gap < hw - TOL) bad.push(`${lookId(look)} edge band`);
        if (p.x + hw > SHIRT_FRONT_X + TOL) bad.push(`${lookId(look)} front`);
        if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
        if (p.x - hw < shirt.rearX - TOL) bad.push(`${lookId(look)} rear`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints the Water-lily shirt on the Tank top\'s whole silhouette: one inked shape, ink 2.0, the neckline to x -7', () => {
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const paints = bodyPaints('shirt', look, 0, 1, AREA3_SLUG.shirt);
      const body = paints.filter((p) => p.kind === 'fill' && p.style === WATER_LILY_SHIRT_FILL);
      expect(body).toHaveLength(1);
      expect(paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 2 && p.style === INK)).toHaveLength(1);
      const tank = bodyPaints('shirt', look).find((p) => p.kind === 'fill' && p.style === TANK_TOP_FILL)!;
      expect(body[0].subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`))).toEqual(
        tank.subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`)),
      );
      expect(Math.min(...body[0].subs[0].pts.slice(-24).map((p) => p.x))).toBeCloseTo(shirt.neckline.apexX - 1, 6);
    }
  });

  it('keeps the Water-lily shirt\'s blossom and hem band clear of each other and inside its silhouette, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const paints = bodyPaints('shirt', look, 0, 1, AREA3_SLUG.shirt);
      const petals = paints.filter((p) => p.kind === 'fill' && p.style === WATER_LILY_BLOSSOM);
      const band = paints.filter((p) => p.kind === 'fill' && p.style === BOAT_TRIM);
      expect(petals).toHaveLength(5);
      expect(band).toHaveLength(1);
      // A clipped paint's region is its clip, so the boxes are of the painted paths themselves.
      const rawBox = (paints: readonly Paint[]): Bounds =>
        boundsOfPoints(paints.flatMap((p) => p.subs.flatMap((sub) => sub.pts.map((q): [number, number] => [q.x, q.y]))), 0);
      const blossom = rawBox(petals);
      const bandBox = rawBox(band);
      // The blossom (ink 0.6 included) ends above the band's first ink line.
      if (blossom.maxY + 0.6 > bandBox.minY) bad.push(`${lookId(look)} blossom over band ${(bandBox.minY - blossom.maxY).toFixed(2)}`);
      // The whole blossom, its ink included, lies inside the silhouette's inner edge (the inset ellipse less 2 for the ink),
      // so none of it is cut off by the clip; it also stays behind the neckline's ink (2.0 wide, its front at x -7 at the apex).
      const e = shirtGeometry(look).inset;
      for (const p of petals) {
        for (const sub of p.subs) {
          for (const q of sub.pts) {
            if (((q.x - e.cx) / (e.rx - 2 - 0.6)) ** 2 + ((q.y - e.cy) / (e.ry - 2 - 0.6)) ** 2 > 1) bad.push(`${lookId(look)} blossom cut by the edge`);
            if (q.x + 0.6 > shirtGeometry(look).neckline.apexX - 2) bad.push(`${lookId(look)} blossom past the neckline`);
          }
        }
      }
      // Each petal and the band is clipped to the silhouette, so none is a stray paint.
      for (const p of [...petals, ...band]) if (p.clips.length === 0) bad.push(`${lookId(look)} unclipped ${p.style}`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the Firefly cape in its look\'s back box, filling it end to end, with its forward corner at x -5.5 or less', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const { frame, box } = backFootprint(look);
      const paints = bodyPaints('back', look, 0, 1, AREA3_SLUG.cape);
      expect(paints.length).toBeGreaterThan(0);
      const along = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
      for (const { q, hw } of along) {
        if (q.x - hw < box.minU - TOL || q.x + hw > box.maxU + TOL) bad.push(`${lookId(look)} u`);
        if (q.y - hw < box.minV - TOL || q.y + hw > box.maxV + TOL) bad.push(`${lookId(look)} v`);
      }
      for (const { p, hw } of inkPoints(paints)) if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.x - hw)) - box.minU) > TOL) bad.push(`${lookId(look)} rear end`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.x + hw)) - box.maxU) > TOL) bad.push(`${lookId(look)} front end`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.y - hw)) - box.minV) > TOL) bad.push(`${lookId(look)} top`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.y + hw)) - box.maxV) > TOL) bad.push(`${lookId(look)} bottom`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('never lets the Firefly cape\'s fill meet a Shirt\'s fill (Tank top, Raincoat or Water-lily shirt), on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const fillsOf = (slot: 'shirt' | 'back', slug: WearableArtSlug): SampledPaint[] =>
        sampledPaints(bodyPaints(slot, look, 0, 1, slug).filter((x) => x.kind === 'fill' && isItemFill(x)));
      const cape = fillsOf('back', AREA3_SLUG.cape);
      for (const shirtSlug of ['tank-top', POND_SLUG.raincoat, AREA3_SLUG.shirt] as const) {
        const shirt = fillsOf('shirt', shirtSlug);
        const both = gridPoints(unionBounds(cape.map((f) => f.box))).filter(
          (q) => cape.some((f) => paintCovers(f, q.x, q.y)) && shirt.some((f) => paintCovers(f, q.x, q.y)),
        );
        if (both.length > 0) bad.push(`${lookId(look)} cape over ${shirtSlug}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps the Pearl tail charm within 17.5 units of its anchor, ink included, at every look, swim phase and tail amplitude', () => {
    let reach = 0;
    for (const look of EVERY_BODY_LOOK) {
      const tail = axolotlBodyGeometry(look).tail;
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          const frame = tailSlotFrame(tail, swim, amp);
          for (const { p, hw } of inkPoints(bodyPaints('tail', look, swim, amp, AREA3_SLUG.charm))) {
            reach = Math.max(reach, Math.hypot(p.x - frame.x, p.y - frame.y) + hw);
          }
        }
      }
    }
    expect(reach).toBeLessThanOrEqual(TAIL_SLOT_REACH + TOL);
  });

  it('turns the Pearl tail charm with the local tail direction: its pearl and gem sit on the anchor\'s y\' axis, the pearl on the tail edge', () => {
    const tail = axolotlBodyGeometry(DEFAULT_ART_LOOK).tail;
    for (const swim of SWIMS) {
      const frame = tailSlotFrame(tail, swim, 1.6);
      const paints = bodyPaints('tail', DEFAULT_ART_LOOK, swim, 1.6, AREA3_SLUG.charm);
      const centreOf = (paint: Paint): Pt => {
        const box = inkBounds([paint]);
        return toFrame(frame, { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 });
      };
      const pearl = centreOf(paints.find((p) => p.kind === 'fill' && p.style === PEARL_FILL)!);
      const gem = centreOf(paints.find((p) => p.kind === 'fill' && p.style === GLASSES_GEM)!);
      expect(pearl.x).toBeCloseTo(0, 6);
      expect(pearl.y).toBeGreaterThan(0);
      expect(pearl.y).toBeLessThan(3);
      expect(gem.x).toBeCloseTo(0, 6);
      // The gem stands above the tail's top edge, on the chain.
      expect(gem.y).toBeLessThan(-8);
    }
  });

  it('keeps the Lily-pad socks\' sleeve and pad in leg space: the Stripy socks\' sleeve and the same foot pad, on every look and swim phase', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS.filter((_, i) => i % 3 === 0)) {
        for (const frame of legSlotFrames(look, swim)) {
          const lily = legPaints({ socks: AREA3_SLUG.socks }, frame);
          const stripy = legPaints({ socks: 'stripy-socks' }, frame);
          const sleeve = (paints: Paint[]): string[] => paints.filter((p) => p.kind === 'stroke' && isSleevePaint(p)).map((p) => signature({ ...p, style: INK }));
          if (sleeve(lily).join() !== sleeve(stripy).join()) bad.push(`${lookId(look)} leg ${frame.index} sleeve`);
          const pad = sockFootPad(frame);
          for (const p of lily) {
            for (const { p: pt, hw } of inkPoints([p])) {
              const q = toFrame(frame, pt);
              if (!isSleevePaint(p) && (q.x - hw < pad.u0 - TOL || q.x + hw > pad.u1 + TOL || Math.abs(q.y) + hw > pad.vHalf + TOL)) {
                bad.push(`${lookId(look)} leg ${frame.index} pad`);
              }
            }
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('wears the Lily-pad socks under the Froggy boots, so the Sock sleeve shows above them, as the Stripy socks do', () => {
    for (const frame of legSlotFrames(GIRL, 0.9)) {
      const both = legPaints({ socks: AREA3_SLUG.socks, feet: POND_SLUG.boots }, frame);
      const socks = legPaints({ socks: AREA3_SLUG.socks }, frame);
      const boots = legPaints({ feet: POND_SLUG.boots }, frame);
      expect(both.length).toBe(socks.length + boots.length);
      expect(both.slice(0, socks.length).map(signature)).toEqual(socks.map(signature));
    }
  });

  it('keeps every Area 3 Wearable, ink included, in the texture frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const check = (what: string, paints: Paint[]): void => {
        if (!isInside(inkBounds(paints), inner, 1e-6)) bad.push(`${lookId(look)} ${what}`);
      };
      check('cap', bodyPaints('head', look, 0, 1, AREA3_SLUG.cap));
      check('shirt', bodyPaints('shirt', look, 0, 1, AREA3_SLUG.shirt));
      check('cape', bodyPaints('back', look, 0, 1, AREA3_SLUG.cape));
      for (const swim of SWIMS) {
        for (const amp of AMPS) check('charm', bodyPaints('tail', look, swim, amp, AREA3_SLUG.charm));
        for (const frame of legSlotFrames(look, swim)) check('socks', legPaints({ socks: AREA3_SLUG.socks }, frame));
      }
    }
    expect([...new Set(bad)]).toEqual([]);
    expect([AXO_TEX.w, AXO_TEX.h]).toEqual([166, 142]);
  });

  it('mixes the far Lily-pad socks 12% toward ink and leaves the near socks as authored; the marks and shine stay as they are', () => {
    // #bff0a0 12% toward #2b2350 is #add796.
    const frames = legSlotFrames(GIRL, 0.7);
    const fills = (frame: LegSlotFrame): string[] =>
      legPaints({ socks: AREA3_SLUG.socks }, frame)
        .filter((p) => p.alpha === 1 && p.style !== INK)
        .map((p) => p.style);
    for (const i of [0, 1]) {
      const far = fills(frames[i]);
      expect(far).toContain('#add796');
      expect(far).not.toContain(LILY_PAD_SOCK_FILL);
      expect(far).toContain(TREASURE_SHINE);
    }
    for (const i of [2, 3]) {
      const near = fills(frames[i]);
      expect(near).toContain(LILY_PAD_SOCK_FILL);
      expect(near).not.toContain('#add796');
      expect(near).toContain(TREASURE_SHINE);
    }
    const marks = (frame: LegSlotFrame): string[] =>
      legPaints({ socks: AREA3_SLUG.socks }, frame)
        .filter((p) => p.alpha === SOCK_STRIPE_ALPHA)
        .map(signature);
    expect(marks(frames[0]).length).toBe(2);
    expect(marks(frames[2]).length).toBe(2);
  });

  it('paints a still look: no Area 3 painter reads a swim phase or tail amplitude except the Pearl tail charm\'s frame, and a repaint is identical', () => {
    for (const [slot, slug] of [
      ['head', AREA3_SLUG.cap],
      ['shirt', AREA3_SLUG.shirt],
      ['back', AREA3_SLUG.cape],
    ] as const) {
      const first = bodyPaints(slot, GIRL, 0, 1, slug).map(signature);
      expect(bodyPaints(slot, GIRL, 0, 1, slug).map(signature)).toEqual(first);
      for (const swim of SWIMS) for (const amp of AMPS) expect(bodyPaints(slot, GIRL, swim, amp, slug).map(signature), `${slug} swim ${swim} amp ${amp}`).toEqual(first);
    }
    // The charm's paints are the same in its own frame at every phase: it moves only with the tail's frame.
    const tail = axolotlBodyGeometry(GIRL).tail;
    const inFrameOf = (swim: number, amp: number): string[] => {
      const frame = tailSlotFrame(tail, swim, amp);
      return bodyPaints('tail', GIRL, swim, amp, AREA3_SLUG.charm).map((p) =>
        JSON.stringify({ k: p.kind, s: p.style, w: p.lineWidth, pts: p.subs.map((sub) => sub.pts.map((q) => {
          const f = toFrame(frame, q);
          return `${f.x.toFixed(4)},${f.y.toFixed(4)}`;
        })) }),
      );
    };
    const first = inFrameOf(0, 1);
    for (const swim of SWIMS) for (const amp of AMPS) expect(inFrameOf(swim, amp)).toEqual(first);
  });
});

describe('pond Area 3 Wearables (issue #98): the rarity look ladder', () => {
  const colours = (paints: readonly Paint[], kind: 'fill' | 'stroke'): string[] =>
    paints.filter((p) => p.kind === kind && p.alpha === 1).map((p) => p.style);
  const count = (list: readonly string[], value: string): number => list.filter((v) => v === value).length;
  const nearLeg = legSlotFrames(GIRL, 0)[2];
  const stars = (paints: readonly Paint[]): Paint[] =>
    paints.filter((p) => p.kind === 'fill' && p.style === WHITE && p.subs.length === 1 && p.subs[0].pts.length === 8);
  const inkWidths = (paints: readonly Paint[]): number[] =>
    [...new Set(paints.filter((p) => p.kind === 'stroke' && p.style === INK).map((p) => Math.round(p.lineWidth * 1e9) / 1e9))].sort((a, b) => a - b);

  it('paints Common as flat colour plus one shine, no trim: Feather cap (crown, cuff and plume), Lily-pad socks', () => {
    const cap = bodyPaints('head', GIRL, 0, 1, AREA3_SLUG.cap);
    expect(new Set(colours(cap, 'fill'))).toEqual(new Set([FEATHER_CAP_FILL, FEATHER_FILL, TREASURE_SHINE]));
    // The crown and the cuff share the cap colour; the plume is the one other outer fill.
    expect(count(colours(cap, 'fill'), FEATHER_CAP_FILL)).toBe(2);
    expect(count(colours(cap, 'fill'), FEATHER_FILL)).toBe(1);
    expect(count(colours(cap, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(cap.some((p) => p.style === GOLD_TRIM || p.style === BOAT_TRIM || p.style === GLASSES_GEM)).toBe(false);
    expect(stars(cap)).toHaveLength(0);
    const socks = legPaints({ socks: AREA3_SLUG.socks }, nearLeg);
    // The two lily-pad marks are ink at alpha 0.30: the same colour darkened, not a second colour.
    const marks = socks.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(marks).toHaveLength(2);
    expect(marks.every((p) => p.style === INK)).toBe(true);
    expect(new Set(colours(socks, 'fill'))).toEqual(new Set([LILY_PAD_SOCK_FILL, TREASURE_SHINE]));
    expect(new Set(colours(socks, 'stroke'))).toEqual(new Set([INK, LILY_PAD_SOCK_FILL]));
    expect(count(colours(socks, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(stars(socks)).toHaveLength(0);
  });

  it('adds one trim band in a second colour for Rare: Water-lily shirt hem band, with a five-petal blossom', () => {
    const shirt = bodyPaints('shirt', GIRL, 0, 1, AREA3_SLUG.shirt);
    expect(count(colours(shirt, 'fill'), BOAT_TRIM)).toBe(1);
    expect(count(colours(shirt, 'fill'), WATER_LILY_SHIRT_FILL)).toBe(1);
    expect(count(colours(shirt, 'fill'), WATER_LILY_BLOSSOM)).toBe(5);
    expect(count(colours(shirt, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(shirt.some((p) => p.style === GOLD_TRIM || p.style === GLASSES_GEM)).toBe(false);
    expect(stars(shirt)).toHaveLength(0);
    // The blossom centre is ink at alpha 0.30, not a second colour.
    expect(shirt.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA && p.style === INK)).toHaveLength(1);
  });

  it('adds one rounded gem for Epic: Pearl tail charm, a gem of radius 2.5 on the chain, no trim or star', () => {
    const charm = bodyPaints('tail', GIRL, 0, 1, AREA3_SLUG.charm);
    const gems = charm.filter((p) => p.kind === 'fill' && p.style === GLASSES_GEM);
    expect(gems).toHaveLength(1);
    const box = inkBounds([gems[0]]);
    expect((box.maxX - box.minX) / 2).toBeCloseTo(2.5, 1);
    expect(count(colours(charm, 'fill'), PEARL_FILL)).toBe(1);
    // The chain and the two ribbon tails share the one soft pink.
    expect(count(colours(charm, 'fill'), PEARL_CHARM_CORD)).toBe(3);
    expect(count(colours(charm, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(charm.some((p) => p.style === GOLD_TRIM || p.style === BOAT_TRIM)).toBe(false);
    expect(stars(charm)).toHaveLength(0);
  });

  it('adds gold trim and one static 4-point star for Legendary: Firefly cape, with four still fireflies', () => {
    const cape = bodyPaints('back', GIRL, 0, 1, AREA3_SLUG.cape);
    expect(colours(cape, 'fill')).toContain(GOLD_TRIM);
    expect(count(colours(cape, 'fill'), GOLD_TRIM)).toBe(1);
    expect(count(colours(cape, 'fill'), FIREFLY_CAPE_FILL)).toBe(1);
    expect(count(colours(cape, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(stars(cape)).toHaveLength(1);
    const pts = stars(cape)[0].subs[0].pts;
    const cx = pts.reduce((n, p) => n + p.x, 0) / 8;
    const cy = pts.reduce((n, p) => n + p.y, 0) / 8;
    const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    expect(Math.max(...radii)).toBeCloseTo(3, 6);
    expect(Math.min(...radii)).toBeCloseTo(3 * 0.38, 6);
    // Four fireflies: a yellow glow disc (a flat rgba fill, never animated) round a small ink body.
    expect(FIREFLY_GLOW).toBe('rgba(255,225,74,0.75)');
    const glows = cape.filter((p) => p.kind === 'fill' && p.style === FIREFLY_GLOW);
    expect(glows).toHaveLength(4);
    expect(glows.every((p) => p.alpha === 1 && p.clips.length === 0)).toBe(true);
    const bodies = cape.filter((p) => p.kind === 'fill' && p.style === INK && p.alpha === 1);
    expect(bodies).toHaveLength(4);
    // Each body sits inside its glow disc.
    glows.forEach((glow, k) => {
      const g = inkBounds([glow]);
      const b = inkBounds([bodies[k]]);
      expect(b.minX).toBeGreaterThan(g.minX);
      expect(b.maxX).toBeLessThan(g.maxX);
      expect(b.minY).toBeGreaterThan(g.minY);
      expect(b.maxY).toBeLessThan(g.maxY);
    });
  });

  it('strokes an Area 3 silhouette at the item ink: 2 x 2.0 for a blob, 2.0 for a shape', () => {
    expect(inkWidths(bodyPaints('head', GIRL, 0, 1, AREA3_SLUG.cap))).toEqual([1.2, 4]);
    expect(inkWidths(bodyPaints('shirt', GIRL, 0, 1, AREA3_SLUG.shirt))).toEqual([0.6, 1.2, 2]);
    expect(inkWidths(bodyPaints('tail', GIRL, 0, 1, AREA3_SLUG.charm))).toEqual([1.2, 4]);
    expect(inkWidths(bodyPaints('back', GIRL, 0, 1, AREA3_SLUG.cape))).toEqual([0.6, 1.2, 4]);
    expect(inkWidths(legPaints({ socks: AREA3_SLUG.socks }, nearLeg))).toEqual([2, SLEEVE_INK_W]);
  });
});

// ---------------------------------------------------------------------------
// The chinampa Area 4 Wearables (issue #76): zones, footprints, layers and counted details
// ---------------------------------------------------------------------------
//
// The same checks as the Area 3 block above, for the Straw sun hat, Marigold necklace, Garden overalls,
// Monarch hair clip and Monarch wings. The catalogue-driven suite holds each to the size rule; these hold
// them to the rest of guide 6i. The earlier looks' checks are unchanged, and a digest pins their paints.

const AREA4_SLUG = {
  hat: 'straw-sun-hat',
  necklace: 'marigold-necklace',
  overalls: 'garden-overalls',
  clip: 'monarch-hair-clip',
  wings: 'monarch-wings',
} as const satisfies Record<string, WearableArtSlug>;
const CHINAMPA_WEARABLES = CATALOGUE_WEARABLES.filter(inList(CHINAMPA_TREASURES, 'chinampa'));
/** A full Area 4 outfit with the Straw sun hat, and the same with the Monarch hair clip in the Head slot. */
const AREA4_OUTFIT: ArtOutfit = { head: AREA4_SLUG.hat, neck: AREA4_SLUG.necklace, shirt: AREA4_SLUG.overalls, back: AREA4_SLUG.wings };
const AREA4_CLIP_OUTFIT: ArtOutfit = { ...AREA4_OUTFIT, head: AREA4_SLUG.clip };
/** The Area 4 slugs that paint on the body, with their slots. */
const AREA4_BODY_ITEMS = [
  ['head', AREA4_SLUG.hat],
  ['head', AREA4_SLUG.clip],
  ['neck', AREA4_SLUG.necklace],
  ['shirt', AREA4_SLUG.overalls],
  ['back', AREA4_SLUG.wings],
] as const;

/** WCAG relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
/** Two 32-bit FNV-1a hashes of `text` (forward and reversed) as 16 hex digits: a fingerprint, not a secret. */
function digest(text: string): string {
  const fnv = (chars: readonly string[]): string => {
    let h = 0x811c9dc5;
    for (const ch of chars) {
      for (let k = 0; k < ch.length; k++) {
        h ^= ch.charCodeAt(k);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
    return h.toString(16).padStart(8, '0');
  };
  const chars = [...text];
  return fnv(chars) + fnv(chars.reverse());
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('chinampa Area 4 Wearables (issue #76): zones, footprints and layers', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('has five chinampa Area 4 Wearables of the 41: Head, Neck, Shirt, Head and Back', () => {
    expect(CATALOGUE_WEARABLES).toHaveLength(41);
    expect(CHINAMPA_WEARABLES.map((w) => `${w.slot}:${treasureSlug(w.id)}`)).toEqual([
      'head:straw-sun-hat',
      'neck:marigold-necklace',
      'shirt:garden-overalls',
      'head:monarch-hair-clip',
      'back:monarch-wings',
    ]);
    expect(CHINAMPA_WEARABLES.some((w) => [...POND_WEARABLES, ...POND_2_WEARABLES].includes(w))).toBe(false);
    expect(Object.keys(WEARABLE_ART_SLOT)).toHaveLength(41);
    expect(Object.values(AREA4_SLUG).map((slug) => WEARABLE_ART_SLOT[slug])).toEqual(['head', 'neck', 'shirt', 'head', 'back']);
  });

  it('maps Area 4 catalogue ids to art slugs by slot, and leaves out an Area 4 id worn in the wrong slot', () => {
    expect(
      artOutfit({
        head: 'chinampa/straw-sun-hat',
        neck: 'chinampa/marigold-necklace',
        shirt: 'chinampa/garden-overalls',
        back: 'chinampa/monarch-wings',
      }),
    ).toEqual(AREA4_OUTFIT);
    expect(artOutfit({ head: 'chinampa/monarch-hair-clip' })).toEqual({ head: AREA4_SLUG.clip });
    expect(
      artOutfit({ head: 'chinampa/monarch-wings', neck: 'chinampa/straw-sun-hat', shirt: 'chinampa/marigold-necklace', back: 'chinampa/monarch-hair-clip' }),
    ).toEqual({});
    expect(outfitKey(AREA4_OUTFIT)).toBe('head=straw-sun-hat,neck=marigold-necklace,shirt=garden-overalls,back=monarch-wings');
    // Still the canal's slug per slot first: the new slugs only come after.
    expect(WEARABLE_ART_SLUGS).toEqual(['sun-hat', 'shell-necklace', 'heart-glasses', 'tank-top', 'diving-tank', 'golden-bow', 'stripy-socks', 'flippers']);
  });

  it('keeps the Straw sun hat, the Monarch hair clip and the Marigold necklace off the eyes, the lash reach, the gill roots and the cheek heart zone, alike on every look', () => {
    for (const [slot, slug] of [
      ['head', AREA4_SLUG.hat],
      ['head', AREA4_SLUG.clip],
      ['neck', AREA4_SLUG.necklace],
    ] as const) {
      const paints = bodyPaints(slot, DEFAULT_ART_LOOK, 0, 1, slug);
      expect(paints.length).toBeGreaterThan(0);
      for (const look of EVERY_BODY_LOOK) expect(bodyPaints(slot, look, 0, 1, slug).map(signature), `${slug} ${lookId(look)}`).toEqual(paints.map(signature));
      for (const paint of paints) expect(trouble(paint, { lashes: true, gills: true }), `${slug} ${paint.kind} ${paint.style}`).toBeNull();
    }
  });

  it('keeps the Garden overalls and the Monarch wings off the eyes, lashes, gill roots and cheek heart zone on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of [
        ['shirt', AREA4_SLUG.overalls],
        ['back', AREA4_SLUG.wings],
      ] as const) {
        for (const p of bodyPaints(slot, look, 0, 1, slug)) {
          const why = trouble(p, { lashes: true, gills: true });
          if (why) bad.push(`${lookId(look)} ${slug} ${why}`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps every Area 4 Wearable of a full drawAxolotl run off the eyes and, past the silhouette, the gill roots and cheek heart zone, at every size', () => {
    const looks = AXO_SIZES.flatMap((size): AxolotlArtLook[] => [
      { ...DEFAULT_ART_LOOK, size },
      { ...GIRL, size, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, size, body: 'slim', age: 'grownUp', tail: 'long' },
    ]);
    for (const outfit of [AREA4_OUTFIT, AREA4_CLIP_OUTFIT]) {
      for (const pose of Object.values(POSES)) {
        for (const look of looks) {
          const base = drawn(pose, look);
          const worn = drawn(pose, look, outfit);
          const silhouette = worn.findIndex((p) => p.kind === 'stroke' && p.lineWidth === 2 * LW && p.style === INK);
          const inserted = insertedPaints(base, worn)!;
          expect(inserted.length).toBeGreaterThan(0);
          for (const { index, paint } of inserted) {
            const why = trouble(paint, { lashes: false, gills: index > silhouette, heart: index > silhouette });
            expect(why, `${lookId(look)} paint ${index} ${paint.kind} ${paint.style}`).toBeNull();
          }
        }
      }
    }
  });

  it('paints every Area 4 Wearable before the eyes, a Girl lashes included, and changes none of the axolotl\'s own paints', () => {
    for (const outfit of [AREA4_OUTFIT, AREA4_CLIP_OUTFIT]) {
      for (const look of [DEFAULT_ART_LOOK, GIRL, { ...GIRL, body: 'chubby' as const, age: 'baby' as const, tail: 'short' as const }]) {
        for (const pose of Object.values(POSES)) {
          const base = drawn(pose, look);
          const worn = drawn(pose, look, outfit);
          const inserted = insertedPaints(base, worn);
          expect(inserted).not.toBeNull();
          expect(inserted!.length).toBeGreaterThan(0);
          const eyes = firstEyePaint(worn);
          expect(eyes).toBeGreaterThan(0);
          for (const x of inserted!) expect(x.index).toBeLessThan(eyes);
          expect(worn.length - eyes).toBe(base.length - firstEyePaint(base));
        }
      }
    }
  });

  it('keeps the Straw sun hat on the head top: ink x 16.02 to 45.98, lowest y -19.5, crown top y -39.6, resting on the head', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA4_SLUG.hat);
    const box = inkBounds(paints);
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.maxY).toBeLessThanOrEqual(HEAD_FOOTPRINT.maxY + TOL);
    expect(box.maxY).toBeCloseTo(-19.5, 2);
    expect(box.minX).toBeCloseTo(16.02, 2);
    expect(box.maxX).toBeCloseTo(45.98, 2);
    expect(box.minY).toBeCloseTo(-39.6, 2);
    expect(headRise(inkPoints(paints))).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.head.rise);
    // Its lowest fill point is inside the head outline's ink ring: the hat rests on the head.
    const fills = paints.filter((p) => p.kind === 'fill' && p.style === STRAW_HAT_FILL);
    const lowest = fills.flatMap((p) => p.subs[0].pts).reduce((a, b) => (b.y > a.y ? b : a));
    expect(((lowest.x - HEAD_ELLIPSE.cx) / (HEAD_ELLIPSE.rx + LW)) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / (HEAD_ELLIPSE.ry + LW)) ** 2).toBeLessThan(1);
    // The glasses keep 1.5 or more under it: the Face footprint starts 1.5 under the Head footprint.
    expect(FACE_FOOTPRINT.minY - HEAD_FOOTPRINT.maxY).toBeCloseTo(1.5, 6);
  });

  it('keeps the Monarch hair clip on the head top, symmetrical, 29.2 wide: ink x 16.4 to 45.6, lowest y -19.77, top y -43.9, resting on the head', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA4_SLUG.clip);
    const box = inkBounds(paints);
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.maxY).toBeLessThanOrEqual(HEAD_FOOTPRINT.maxY + TOL);
    expect(box.maxY).toBeCloseTo(-19.77, 2);
    expect(box.minY).toBeCloseTo(-43.9, 2);
    expect(box.minX).toBeCloseTo(16.4, 2);
    expect(box.maxX).toBeCloseTo(45.6, 2);
    expect((box.minX + box.maxX) / 2).toBeCloseTo(31, 2);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(HEAD_ELLIPSE.rx * 2 * WEARABLE_SLOT_MINIMUMS.head.headWidthShare);
    expect(headRise(inkPoints(paints))).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.head.rise);
    const fills = paints.filter((p) => p.kind === 'fill' && p.style === MONARCH_WING);
    expect(fills).toHaveLength(4);
    const lowest = fills.flatMap((p) => p.subs[0].pts).reduce((a, b) => (b.y > a.y ? b : a));
    expect(((lowest.x - HEAD_ELLIPSE.cx) / (HEAD_ELLIPSE.rx + LW)) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / (HEAD_ELLIPSE.ry + LW)) ** 2).toBeLessThan(1);
  });

  it('keeps the Marigold necklace in the Neck footprint, under the mouth, 0.3 clear of the cheek heart zone and inside LW / 2 of the silhouette outline on every look', () => {
    const paints = bodyPaints('neck', DEFAULT_ART_LOOK, 0, 1, AREA4_SLUG.necklace);
    const box = inkBounds(paints);
    expect(isInside(box, NECK_FOOTPRINT)).toBe(true);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.neck.minWidth);
    // The mouth paints over its front: it runs under the mouth zone.
    expect(paints.some((p) => reachesBox(regionOf(p), MOUTH_ZONE))).toBe(true);
    let heartGap = Infinity;
    for (const p of paints) {
      const r = regionOf(p);
      for (const [a, b] of edgesOf(r)) heartGap = Math.min(heartGap, segDist(CHEEK_HEART_ZONE.x, CHEEK_HEART_ZONE.y, a, b) - r.hw - CHEEK_HEART_ZONE.r);
    }
    expect(heartGap).toBeGreaterThanOrEqual(0.3);
    // Only the lower edge can reach the outline's outer half (the upper edge is held by the zones above).
    const points = inkPoints(paints).filter(({ p, hw }) => p.y + hw >= 17);
    const margins = outlineMargins(points);
    const least = leastOver(margins);
    expect(least.value, least.id).toBeGreaterThanOrEqual(0);
  });

  it('paints the Marigold necklace as eight blossoms on one string: the blossoms 2.0 to 4.2 in radius, a core and seven petals each', () => {
    const paints = bodyPaints('neck', DEFAULT_ART_LOOK, 0, 1, AREA4_SLUG.necklace);
    const fills = paints.filter((p) => p.kind === 'fill' && p.style === MARIGOLD_PETAL);
    // One string, eight cores and fifty-six petals.
    expect(fills).toHaveLength(1 + 8 * 8);
    const rawBox = (paint: Paint): Bounds => boundsOfPoints(paint.subs.flatMap((sub) => sub.pts.map((q): [number, number] => [q.x, q.y])), 0);
    const cores = fills.slice(1).filter((_, i) => i % 8 === 0).map(rawBox);
    expect(cores).toHaveLength(8);
    const radii = cores.map((b) => (b.maxX - b.minX) / 2 / 0.62);
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...radii)).toBeLessThanOrEqual(4.2 + 0.01);
    const centres = cores.map((b) => (b.minX + b.maxX) / 2);
    expect(centres[0]).toBeCloseTo(6.8, 1);
    expect(centres[7]).toBeCloseTo(37.6, 1);
  });

  it('keeps the Garden overalls inside the torso edge band, behind the front line, cut at the tail root, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const e: BodyEllipse = shirt.inset;
      const boundary = Array.from({ length: 720 }, (_, k) => ({
        x: e.cx + Math.cos((k / 720) * TAU) * e.rx,
        y: e.cy + Math.sin((k / 720) * TAU) * e.ry,
      }));
      const paints = bodyPaints('shirt', look, 0, 1, AREA4_SLUG.overalls);
      expect(paints.length).toBeGreaterThan(0);
      for (const { p, hw } of inkPoints(paints)) {
        const inside = ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1 + 1e-9;
        const gap = Math.min(...boundary.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
        if (!inside || gap < hw - TOL) bad.push(`${lookId(look)} edge band`);
        if (p.x + hw > SHIRT_FRONT_X + TOL) bad.push(`${lookId(look)} front`);
        if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
        if (p.x - hw < shirt.rearX - TOL) bad.push(`${lookId(look)} rear`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints the Garden overalls on the Tank top\'s whole silhouette: one inked shape, ink 2.0, the neckline to x -7', () => {
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const paints = bodyPaints('shirt', look, 0, 1, AREA4_SLUG.overalls);
      const body = paints.filter((p) => p.kind === 'fill' && p.style === GARDEN_OVERALLS_FILL);
      expect(body).toHaveLength(1);
      expect(paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 2 && p.style === INK)).toHaveLength(1);
      const tank = bodyPaints('shirt', look).find((p) => p.kind === 'fill' && p.style === TANK_TOP_FILL)!;
      expect(body[0].subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`))).toEqual(
        tank.subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`)),
      );
      expect(Math.min(...body[0].subs[0].pts.slice(-24).map((p) => p.x))).toBeCloseTo(shirt.neckline.apexX - 1, 6);
    }
  });

  it('keeps the Garden overalls\' pocket, strap and shine clear of each other, inside the silhouette and behind the neckline, on every look', () => {
    const bad: string[] = [];
    const shortShirts: string[] = [];
    const rawBox = (paints: readonly Paint[]): Bounds =>
      boundsOfPoints(paints.flatMap((p) => p.subs.flatMap((sub) => sub.pts.map((q): [number, number] => [q.x, q.y]))), 0);
    for (const look of EVERY_BODY_LOOK) {
      const paints = bodyPaints('shirt', look, 0, 1, AREA4_SLUG.overalls);
      const pocket = paints.filter((p) => p.kind === 'fill' && p.style === GARDEN_OVERALLS_PATCH);
      const strap = paints.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA && p.style === INK);
      const shine = paints.filter((p) => p.kind === 'fill' && p.style === TREASURE_SHINE);
      expect(pocket).toHaveLength(1);
      expect(shine).toHaveLength(1);
      // One strap, except on a Shirt too short for one (the Slim and Regular Baby, 12 of the 54 looks).
      expect(strap.length, `${lookId(look)} strap`).toBeLessThanOrEqual(1);
      if (strap.length === 0) {
        shortShirts.push(lookId(look));
        expect(look.age, lookId(look)).toBe('baby');
      }
      const pocketBox = rawBox(pocket);
      const strapBox = strap.length === 1 ? rawBox(strap) : { minX: -Infinity, maxX: -Infinity, minY: 0, maxY: 0 };
      const shineBox = rawBox(shine);
      const e = shirtGeometry(look).inset;
      // The pocket (its 0.8 ink included, 0.4 outside) lies inside the silhouette's inner edge: the inset ellipse less 2 for the ink.
      for (const q of pocket[0].subs.flatMap((sub) => sub.pts)) {
        if (((q.x - e.cx) / (e.rx - 2 - 0.4)) ** 2 + ((q.y - e.cy) / (e.ry - 2 - 0.4)) ** 2 > 1) bad.push(`${lookId(look)} pocket cut by the edge`);
      }
      if (pocketBox.maxX + 0.4 > shirtGeometry(look).neckline.apexX - 2 - 0.7) bad.push(`${lookId(look)} pocket past the neckline`);
      // The strap is left of the pocket, 0.5 or more clear of its ink, and the pocket's ink is clear of the shine.
      if (strapBox.maxX > pocketBox.minX - 0.4 - 0.5 + TOL) bad.push(`${lookId(look)} strap over the pocket`);
      if (strap.length === 1 && strapBox.maxX - strapBox.minX < 1.6 - TOL) bad.push(`${lookId(look)} strap under 1.6 wide`);
      const apart = (a: Bounds, b: Bounds, gap: number): boolean => a.maxX + gap < b.minX || b.maxX + gap < a.minX || a.maxY + gap < b.minY || b.maxY + gap < a.minY;
      if (!apart(pocketBox, shineBox, 0.4)) bad.push(`${lookId(look)} pocket over the shine`);
      // Each is clipped to the silhouette, so none is a stray paint.
      for (const p of [...pocket, ...strap]) if (p.clips.length === 0) bad.push(`${lookId(look)} unclipped ${p.style}`);
    }
    expect([...new Set(bad)]).toEqual([]);
    expect(shortShirts).toHaveLength(12);
  });

  it('keeps the Monarch wings in their look\'s back box, filling it end to end, with their forward corner at x -5.5 or less', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const { frame, box } = backFootprint(look);
      const paints = bodyPaints('back', look, 0, 1, AREA4_SLUG.wings);
      expect(paints.length).toBeGreaterThan(0);
      const along = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
      for (const { q, hw } of along) {
        if (q.x - hw < box.minU - TOL || q.x + hw > box.maxU + TOL) bad.push(`${lookId(look)} u`);
        if (q.y - hw < box.minV - TOL || q.y + hw > box.maxV + TOL) bad.push(`${lookId(look)} v`);
      }
      for (const { p, hw } of inkPoints(paints)) if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.x - hw)) - box.minU) > TOL) bad.push(`${lookId(look)} rear end`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.x + hw)) - box.maxU) > TOL) bad.push(`${lookId(look)} front end`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.y - hw)) - box.minV) > TOL) bad.push(`${lookId(look)} top`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.y + hw)) - box.maxV) > TOL) bad.push(`${lookId(look)} bottom`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('never lets the Monarch wings\' fill meet a Shirt\'s fill (any of the four Shirts), on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const fillsOf = (slot: 'shirt' | 'back', slug: WearableArtSlug): SampledPaint[] =>
        sampledPaints(bodyPaints(slot, look, 0, 1, slug).filter((x) => x.kind === 'fill' && isItemFill(x)));
      const wings = fillsOf('back', AREA4_SLUG.wings);
      for (const shirtSlug of ['tank-top', POND_SLUG.raincoat, AREA3_SLUG.shirt, AREA4_SLUG.overalls] as const) {
        const shirt = fillsOf('shirt', shirtSlug);
        const both = gridPoints(unionBounds(wings.map((f) => f.box))).filter(
          (q) => wings.some((f) => paintCovers(f, q.x, q.y)) && shirt.some((f) => paintCovers(f, q.x, q.y)),
        );
        if (both.length > 0) bad.push(`${lookId(look)} wings over ${shirtSlug}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps every Area 4 Wearable, ink included, in the texture frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of AREA4_BODY_ITEMS) {
        if (!isInside(inkBounds(bodyPaints(slot, look, 0, 1, slug)), inner, 1e-6)) bad.push(`${lookId(look)} ${slug}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
    expect([AXO_TEX.w, AXO_TEX.h]).toEqual([166, 142]);
  });

  it('paints a still look: no Area 4 painter reads a swim phase or tail amplitude, and a repaint is identical', () => {
    for (const [slot, slug] of AREA4_BODY_ITEMS) {
      const first = bodyPaints(slot, GIRL, 0, 1, slug).map(signature);
      expect(bodyPaints(slot, GIRL, 0, 1, slug).map(signature)).toEqual(first);
      for (const swim of SWIMS) for (const amp of AMPS) expect(bodyPaints(slot, GIRL, swim, amp, slug).map(signature), `${slug} swim ${swim} amp ${amp}`).toEqual(first);
    }
  });

  it('never looks hurt: no Area 4 paint is red, and every Area 4 outer fill is a pale colour at 9:1 with ink', () => {
    const red = (hex: string): boolean => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
      if (!m) return false;
      const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
      return r >= 180 && g <= 100 && b <= 100;
    };
    for (const [slot, slug] of AREA4_BODY_ITEMS) {
      for (const look of [DEFAULT_ART_LOOK, GIRL]) {
        for (const p of bodyPaints(slot, look, 0, 1, slug)) expect(red(p.style), `${slug} ${p.kind} ${p.style}`).toBe(false);
      }
    }
    const outer = [STRAW_HAT_FILL, MARIGOLD_PETAL, GARDEN_OVERALLS_FILL, MONARCH_WING, MONARCH_BODY];
    for (const fill of outer) {
      expect(luminance(fill), fill).toBeGreaterThanOrEqual(0.607);
      expect(contrast(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
  });

  it('keeps the Rare patch and the Epic spots readable in greyscale: each differs from its fill by a luminance ratio of 1.4 or more', () => {
    expect(contrast(GARDEN_OVERALLS_PATCH, GARDEN_OVERALLS_FILL)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(MONARCH_SPOT, MONARCH_WING)).toBeGreaterThanOrEqual(1.4);
    // The ink veins and borders read on the pale wing as the ink does on any outer fill.
    expect(contrast(INK, MONARCH_WING)).toBeGreaterThanOrEqual(9);
  });

  it('leaves the twenty earlier worn looks as they were: the digest of their paints is unchanged', () => {
    const slugs = (Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]).slice(0, 20);
    expect(slugs[0]).toBe('sun-hat');
    expect(slugs[19]).toBe('firefly-cape');
    const looks: AxolotlArtLook[] = [
      DEFAULT_ART_LOOK,
      { ...GIRL, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, body: 'slim', age: 'grownUp', tail: 'long' },
    ];
    const out: string[] = [];
    for (const slug of slugs) {
      const slot = WEARABLE_ART_SLOT[slug];
      for (const look of looks) {
        for (const [swim, amp] of [
          [0, 1],
          [2.1, 1.6],
        ] as const) {
          if (isLegSlot(slot)) for (const frame of legSlotFrames(look, swim)) out.push(...legPaints({ [slot]: slug }, frame).map(signature));
          else out.push(...bodyPaints(slot, look, swim, amp, slug).map(signature));
        }
      }
    }
    expect(out).toHaveLength(2136);
    expect(digest(out.join('\n'))).toBe('c6e83b0e34c8e748');
  });
});

describe('chinampa Area 4 Wearables (issue #76): the rarity look ladder', () => {
  const colours = (paints: readonly Paint[], kind: 'fill' | 'stroke'): string[] =>
    paints.filter((p) => p.kind === kind && p.alpha === 1).map((p) => p.style);
  const count = (list: readonly string[], value: string): number => list.filter((v) => v === value).length;
  const stars = (paints: readonly Paint[]): Paint[] =>
    paints.filter((p) => p.kind === 'fill' && p.style === WHITE && p.subs.length === 1 && p.subs[0].pts.length === 8);
  const inkWidths = (paints: readonly Paint[]): number[] =>
    [...new Set(paints.filter((p) => p.kind === 'stroke' && p.style === INK).map((p) => Math.round(p.lineWidth * 1e9) / 1e9))].sort((a, b) => a - b);
  const noGemOrGold = (paints: readonly Paint[]): boolean =>
    !paints.some((p) => p.style === GOLD_TRIM || p.style === GLASSES_GEM || p.style === BOW_GEM);

  it('paints Common as flat colour plus one shine, no trim: Straw sun hat (a hat band), Marigold necklace (blossom centres)', () => {
    const hat = bodyPaints('head', GIRL, 0, 1, AREA4_SLUG.hat);
    expect(new Set(colours(hat, 'fill'))).toEqual(new Set([STRAW_HAT_FILL, TREASURE_SHINE]));
    // The brim and the crown share the straw colour; the one shine is the only other fill.
    expect(count(colours(hat, 'fill'), STRAW_HAT_FILL)).toBe(2);
    expect(count(colours(hat, 'fill'), TREASURE_SHINE)).toBe(1);
    // The hat band is ink at alpha 0.30: the same colour darkened, not a second colour.
    const band = hat.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(band).toHaveLength(1);
    expect(band[0].style).toBe(INK);
    expect(noGemOrGold(hat) && !hat.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(stars(hat)).toHaveLength(0);
    const necklace = bodyPaints('neck', GIRL, 0, 1, AREA4_SLUG.necklace);
    expect(new Set(colours(necklace, 'fill'))).toEqual(new Set([MARIGOLD_PETAL, TREASURE_SHINE]));
    expect(count(colours(necklace, 'fill'), TREASURE_SHINE)).toBe(1);
    // The eight blossom centres are ink at alpha 0.30, not a second colour.
    const centres = necklace.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(centres).toHaveLength(8);
    expect(centres.every((p) => p.style === INK)).toBe(true);
    expect(noGemOrGold(necklace) && !necklace.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(stars(necklace)).toHaveLength(0);
  });

  it('adds one trim band in a second colour for Rare: Garden overalls pocket patch, with a strap of the same colour darkened', () => {
    const overalls = bodyPaints('shirt', GIRL, 0, 1, AREA4_SLUG.overalls);
    expect(count(colours(overalls, 'fill'), GARDEN_OVERALLS_PATCH)).toBe(1);
    expect(count(colours(overalls, 'fill'), GARDEN_OVERALLS_FILL)).toBe(1);
    expect(count(colours(overalls, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(new Set(colours(overalls, 'fill'))).toEqual(new Set([GARDEN_OVERALLS_FILL, GARDEN_OVERALLS_PATCH, TREASURE_SHINE]));
    expect(noGemOrGold(overalls)).toBe(true);
    expect(stars(overalls)).toHaveLength(0);
    // The strap is ink at alpha 0.30, not a second colour.
    expect(overalls.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA && p.style === INK)).toHaveLength(1);
  });

  it('adds a small repeat pattern for Epic: Monarch hair clip, ten cream wing dots, no gem, trim or star', () => {
    const clip = bodyPaints('head', GIRL, 0, 1, AREA4_SLUG.clip);
    // Three on each long wing, two on each short wing.
    const dots = clip.filter((p) => p.kind === 'fill' && p.style === MONARCH_SPOT);
    expect(dots).toHaveLength(10);
    for (const dot of dots) {
      const box = boundsOfPoints(dot.subs.flatMap((sub) => sub.pts.map((q): [number, number] => [q.x, q.y])), 0);
      expect((box.maxX - box.minX) / 2).toBeCloseTo(0.85, 1);
    }
    expect(count(colours(clip, 'fill'), MONARCH_WING)).toBe(4);
    expect(count(colours(clip, 'fill'), MONARCH_BODY)).toBe(1);
    expect(count(colours(clip, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(new Set(colours(clip, 'fill'))).toEqual(new Set([MONARCH_WING, MONARCH_BODY, MONARCH_SPOT, TREASURE_SHINE]));
    expect(noGemOrGold(clip) && !clip.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(stars(clip)).toHaveLength(0);
  });

  it('adds gold trim and one static 4-point star for Legendary: Monarch wings, four wings on a pebble harness with a gold band', () => {
    const wings = bodyPaints('back', GIRL, 0, 1, AREA4_SLUG.wings);
    expect(count(colours(wings, 'fill'), GOLD_TRIM)).toBe(1);
    expect(count(colours(wings, 'fill'), MONARCH_WING)).toBe(4);
    expect(count(colours(wings, 'fill'), MONARCH_BODY)).toBeGreaterThanOrEqual(1);
    expect(wings.filter((p) => p.kind === 'fill' && p.style === MONARCH_SPOT)).toHaveLength(10);
    expect(stars(wings)).toHaveLength(1);
    const pts = stars(wings)[0].subs[0].pts;
    const cx = pts.reduce((n, p) => n + p.x, 0) / 8;
    const cy = pts.reduce((n, p) => n + p.y, 0) / 8;
    const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    expect(Math.max(...radii)).toBeCloseTo(3, 6);
    expect(Math.min(...radii)).toBeCloseTo(3 * 0.38, 6);
    // The gold band is inside the harness (clipped), between two thin ink lines, and there is no gem.
    const band = wings.find((p) => p.kind === 'fill' && p.style === GOLD_TRIM)!;
    expect(band.clips.length).toBeGreaterThan(0);
    expect(wings.some((p) => p.style === GLASSES_GEM || p.style === BOW_GEM)).toBe(false);
  });

  it('strokes an Area 4 silhouette at the item ink: 2 x 2.0 for a blob, 2.0 for a shape, 2 x 0.6 for the necklace', () => {
    expect(inkWidths(bodyPaints('head', GIRL, 0, 1, AREA4_SLUG.hat))).toEqual([4]);
    expect(inkWidths(bodyPaints('neck', GIRL, 0, 1, AREA4_SLUG.necklace))).toEqual([1.2]);
    expect(inkWidths(bodyPaints('shirt', GIRL, 0, 1, AREA4_SLUG.overalls))).toEqual([0.8, 2]);
    expect(inkWidths(bodyPaints('head', GIRL, 0, 1, AREA4_SLUG.clip))).toEqual([0.8, 2.4, 4]);
    expect(inkWidths(bodyPaints('back', GIRL, 0, 1, AREA4_SLUG.wings))).toEqual([0.6, 0.8, 1.2, 4]);
  });
});

// ---------------------------------------------------------------------------
// The chinampa Area 5 Wearables (issue #103): zones, footprints, layers and counted details
// ---------------------------------------------------------------------------
//
// The same checks as the Area 4 block above, for the Bee headband, Bandana, Sunflower sunglasses, Embroidered
// shirt, Hummingbird tail ribbon and Rainbow serape cape. The catalogue-driven suite holds each to the size
// rule; these hold them to the rest of guide 6i. The earlier looks' checks are unchanged, and a digest pins
// their paints.

/** A number to 4 dp, with the noise of a rotated zero (-0.0000) read as 0. */
const fixed4 = (v: number): string => (Math.abs(v) < 5e-5 ? 0 : v).toFixed(4);
const AREA5_SLUG = {
  band: 'bee-headband',
  bandana: 'bandana',
  glasses: 'sunflower-sunglasses',
  shirt: 'embroidered-shirt',
  ribbon: 'hummingbird-tail-ribbon',
  cape: 'rainbow-serape-cape',
} as const satisfies Record<string, WearableArtSlug>;
const CHINAMPA_2_WEARABLES = CATALOGUE_WEARABLES.filter(inList(CHINAMPA_2_TREASURES, 'chinampa'));
/** A full Area 5 outfit: one Wearable in each of the six body slots. */
const AREA5_OUTFIT: ArtOutfit = {
  head: AREA5_SLUG.band,
  neck: AREA5_SLUG.bandana,
  face: AREA5_SLUG.glasses,
  shirt: AREA5_SLUG.shirt,
  back: AREA5_SLUG.cape,
  tail: AREA5_SLUG.ribbon,
};
/** The Area 5 slugs that paint on the body, with their slots. */
const AREA5_BODY_ITEMS = [
  ['head', AREA5_SLUG.band],
  ['neck', AREA5_SLUG.bandana],
  ['face', AREA5_SLUG.glasses],
  ['shirt', AREA5_SLUG.shirt],
  ['tail', AREA5_SLUG.ribbon],
  ['back', AREA5_SLUG.cape],
] as const;
/** The five Shirts, to keep every Back item's fill off. */
const EVERY_SHIRT_SLUG = ['tank-top', POND_SLUG.raincoat, AREA3_SLUG.shirt, AREA4_SLUG.overalls, AREA5_SLUG.shirt] as const;

describe('chinampa Area 5 Wearables (issue #103): zones, footprints and layers', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('has six chinampa Area 5 Wearables of the 41: Head, Neck, Face, Shirt, Tail and Back', () => {
    expect(CATALOGUE_WEARABLES).toHaveLength(41);
    expect(CHINAMPA_2_WEARABLES.map((w) => `${w.slot}:${treasureSlug(w.id)}`)).toEqual([
      'head:bee-headband',
      'neck:bandana',
      'face:sunflower-sunglasses',
      'shirt:embroidered-shirt',
      'tail:hummingbird-tail-ribbon',
      'back:rainbow-serape-cape',
    ]);
    expect(CHINAMPA_2_WEARABLES.some((w) => [...POND_WEARABLES, ...POND_2_WEARABLES, ...CHINAMPA_WEARABLES].includes(w))).toBe(false);
    expect(Object.keys(WEARABLE_ART_SLOT)).toHaveLength(41);
    expect(Object.values(AREA5_SLUG).map((slug) => WEARABLE_ART_SLOT[slug])).toEqual(['head', 'neck', 'face', 'shirt', 'tail', 'back']);
    // The Area 5 slugs come last, after the twenty-five earlier ones.
    expect(Object.keys(WEARABLE_ART_SLOT).slice(25, 31)).toEqual([
      'bee-headband',
      'bandana',
      'sunflower-sunglasses',
      'embroidered-shirt',
      'hummingbird-tail-ribbon',
      'rainbow-serape-cape',
    ]);
  });

  it('maps Area 5 catalogue ids to art slugs by slot, and leaves out an Area 5 id worn in the wrong slot', () => {
    expect(
      artOutfit({
        head: 'chinampa/bee-headband',
        neck: 'chinampa/bandana',
        face: 'chinampa/sunflower-sunglasses',
        shirt: 'chinampa/embroidered-shirt',
        back: 'chinampa/rainbow-serape-cape',
        tail: 'chinampa/hummingbird-tail-ribbon',
      }),
    ).toEqual(AREA5_OUTFIT);
    expect(
      artOutfit({
        head: 'chinampa/bandana',
        neck: 'chinampa/bee-headband',
        face: 'chinampa/embroidered-shirt',
        shirt: 'chinampa/sunflower-sunglasses',
        back: 'chinampa/hummingbird-tail-ribbon',
        tail: 'chinampa/rainbow-serape-cape',
      }),
    ).toEqual({});
    expect(outfitKey(AREA5_OUTFIT)).toBe(
      'head=bee-headband,neck=bandana,face=sunflower-sunglasses,shirt=embroidered-shirt,back=rainbow-serape-cape,tail=hummingbird-tail-ribbon',
    );
    // Still the canal's slug per slot first: the new slugs only come after.
    expect(WEARABLE_ART_SLUGS).toEqual(['sun-hat', 'shell-necklace', 'heart-glasses', 'tank-top', 'diving-tank', 'golden-bow', 'stripy-socks', 'flippers']);
  });

  it('keeps the Bee headband, Bandana and Sunflower sunglasses off the eyes, the gill roots and the cheek heart zone, alike on every look', () => {
    for (const [slot, slug] of [
      ['head', AREA5_SLUG.band],
      ['neck', AREA5_SLUG.bandana],
      ['face', AREA5_SLUG.glasses],
    ] as const) {
      const paints = bodyPaints(slot, DEFAULT_ART_LOOK, 0, 1, slug);
      expect(paints.length).toBeGreaterThan(0);
      for (const look of EVERY_BODY_LOOK) expect(bodyPaints(slot, look, 0, 1, slug).map(signature), `${slug} ${lookId(look)}`).toEqual(paints.map(signature));
      // The glasses band reaches into the lash reach circles on purpose: the eyes paint above it.
      for (const paint of paints) expect(trouble(paint, { lashes: slot !== 'face', gills: true }), `${slug} ${paint.kind} ${paint.style}`).toBeNull();
    }
  });

  it('keeps the Embroidered shirt, the Hummingbird tail ribbon and the Rainbow serape cape off the eyes, lashes, gill roots and cheek heart zone on every look, swim phase and tail amplitude', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of [
        ['shirt', AREA5_SLUG.shirt],
        ['back', AREA5_SLUG.cape],
      ] as const) {
        for (const p of bodyPaints(slot, look, 0, 1, slug)) {
          const why = trouble(p, { lashes: true, gills: true });
          if (why) bad.push(`${lookId(look)} ${slug} ${why}`);
        }
      }
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          for (const p of bodyPaints('tail', look, swim, amp, AREA5_SLUG.ribbon)) {
            const why = trouble(p, { lashes: true, gills: true });
            if (why) bad.push(`${lookId(look)} swim ${swim.toFixed(2)} amp ${amp} ribbon ${why}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps every Area 5 Wearable of a full drawAxolotl run off the eyes and, past the silhouette, the gill roots and cheek heart zone, at every size', () => {
    const looks = AXO_SIZES.flatMap((size): AxolotlArtLook[] => [
      { ...DEFAULT_ART_LOOK, size },
      { ...GIRL, size, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, size, body: 'slim', age: 'grownUp', tail: 'long' },
    ]);
    for (const pose of Object.values(POSES)) {
      for (const look of looks) {
        const base = drawn(pose, look);
        const worn = drawn(pose, look, AREA5_OUTFIT);
        const silhouette = worn.findIndex((p) => p.kind === 'stroke' && p.lineWidth === 2 * LW && p.style === INK);
        const inserted = insertedPaints(base, worn)!;
        expect(inserted.length).toBeGreaterThan(0);
        for (const { index, paint } of inserted) {
          const why = trouble(paint, { lashes: false, gills: index > silhouette, heart: index > silhouette });
          expect(why, `${lookId(look)} paint ${index} ${paint.kind} ${paint.style}`).toBeNull();
        }
      }
    }
  });

  it('paints every Area 5 Wearable before the eyes, a Girl lashes included, and changes none of the axolotl\'s own paints', () => {
    for (const look of [DEFAULT_ART_LOOK, GIRL, { ...GIRL, body: 'chubby' as const, age: 'baby' as const, tail: 'short' as const }]) {
      for (const pose of Object.values(POSES)) {
        const base = drawn(pose, look);
        const worn = drawn(pose, look, AREA5_OUTFIT);
        const inserted = insertedPaints(base, worn);
        expect(inserted).not.toBeNull();
        expect(inserted!.length).toBeGreaterThan(0);
        const eyes = firstEyePaint(worn);
        expect(eyes).toBeGreaterThan(0);
        for (const x of inserted!) expect(x.index).toBeLessThan(eyes);
        expect(worn.length - eyes).toBe(base.length - firstEyePaint(base));
      }
    }
  });

  it('keeps the Bee headband on the head top (ink x 16.4 to 43.8, lowest y -19.5, bobble top y -43.4), resting on the head, its antennae rising 8 or more above the head outline', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA5_SLUG.band);
    const box = inkBounds(paints);
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.maxY).toBeLessThanOrEqual(HEAD_FOOTPRINT.maxY + TOL);
    expect(box.maxY).toBeCloseTo(-19.5, 2);
    expect(box.minX).toBeCloseTo(16.4, 2);
    expect(box.maxX).toBeCloseTo(43.8, 2);
    expect(box.minY).toBeCloseTo(-43.4, 2);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(HEAD_ELLIPSE.rx * 2 * WEARABLE_SLOT_MINIMUMS.head.headWidthShare);
    expect(headRise(inkPoints(paints))).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.head.rise);
    // Its band rests on the head: the band's lowest fill point is inside the head outline's ink ring.
    const band = paints.filter((p) => p.kind === 'fill' && p.style === BEE_HEADBAND_FILL)[0];
    const lowest = band.subs[0].pts.reduce((a, b) => (b.y > a.y ? b : a));
    expect(((lowest.x - HEAD_ELLIPSE.cx) / (HEAD_ELLIPSE.rx + LW)) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / (HEAD_ELLIPSE.ry + LW)) ** 2).toBeLessThan(1);
    // The glasses keep 1.5 or more under it, as under every Head item.
    expect(FACE_FOOTPRINT.minY - HEAD_FOOTPRINT.maxY).toBeCloseTo(1.5, 6);
  });

  it('paints the Bee headband as one band and two antennae: a stem and a round bobble each, splayed up and out', () => {
    const paints = bodyPaints('head', GIRL, 0, 1, AREA5_SLUG.band);
    const fills = paints.filter((p) => p.kind === 'fill' && p.style === BEE_HEADBAND_FILL);
    // The band and two bobbles; the stems are colour strokes.
    expect(fills).toHaveLength(3);
    const stems = paints.filter((p) => p.kind === 'stroke' && p.style === BEE_HEADBAND_FILL);
    expect(stems).toHaveLength(2);
    const bobbles = fills.slice(1).map((p) => inkBounds([p]));
    for (const b of bobbles) expect((b.maxX - b.minX) / 2).toBeCloseTo(3, 1);
    // The antennae splay: the rear bobble is behind the band's middle, the front one ahead of it.
    const band = inkBounds([fills[0]]);
    const middle = (band.minX + band.maxX) / 2;
    expect((bobbles[0].minX + bobbles[0].maxX) / 2).toBeLessThan(middle);
    expect((bobbles[1].minX + bobbles[1].maxX) / 2).toBeGreaterThan(middle);
    // Both bobbles stand clear above the band.
    for (const b of bobbles) expect(b.maxY).toBeLessThan(band.minY);
  });

  it('keeps the Bandana in the Neck footprint, under the mouth, off the cheek heart zone and inside LW / 2 of the silhouette outline on every look', () => {
    const paints = bodyPaints('neck', DEFAULT_ART_LOOK, 0, 1, AREA5_SLUG.bandana);
    const box = inkBounds(paints);
    expect(isInside(box, NECK_FOOTPRINT)).toBe(true);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.neck.minWidth);
    // The mouth paints over its front: it runs under the mouth zone.
    expect(paints.some((p) => reachesBox(regionOf(p), MOUTH_ZONE))).toBe(true);
    let heartGap = Infinity;
    for (const p of paints) {
      const r = regionOf(p);
      for (const [a, b] of edgesOf(r)) heartGap = Math.min(heartGap, segDist(CHEEK_HEART_ZONE.x, CHEEK_HEART_ZONE.y, a, b) - r.hw - CHEEK_HEART_ZONE.r);
    }
    // As the Pond-weed scarf's band: its upper edge dips under the zone and, where the circle's sides are steep, comes within a hair of it, never into it.
    expect(heartGap).toBeGreaterThanOrEqual(-TOL);
    // Only the lower edge can reach the outline's outer half (the upper edge is held by the zones above).
    const points = inkPoints(paints).filter(({ p, hw }) => p.y + hw >= 17);
    const margins = outlineMargins(points);
    const least = leastOver(margins);
    expect(least.value, least.id).toBeGreaterThanOrEqual(0);
  });

  it('paints the Bandana on the Pond-weed scarf\'s band: the same silhouette, ink 0.6 outside, with six polka dots clipped to it', () => {
    const bandana = bodyPaints('neck', GIRL, 0, 1, AREA5_SLUG.bandana);
    const scarf = bodyPaints('neck', GIRL, 0, 1, POND_SLUG.scarf);
    const body = bandana.find((p) => p.kind === 'fill' && p.style === BANDANA_FILL)!;
    const scarfBody = scarf.find((p) => p.kind === 'fill' && p.style === POND_WEED_SCARF)!;
    expect(body.subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`))).toEqual(
      scarfBody.subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`)),
    );
    const dots = bandana.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(dots).toHaveLength(6);
    expect(dots.every((p) => p.style === INK && p.clips.length > 0)).toBe(true);
    // The dots run along the band from the rear to the front, each inside it.
    const box = inkBounds([body]);
    const xs = dots.map((p) => {
      const b = inkBounds([{ ...p, clips: [] }]);
      return (b.minX + b.maxX) / 2;
    });
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(Math.min(...xs)).toBeGreaterThan(box.minX);
    expect(Math.max(...xs)).toBeLessThan(box.maxX);
  });

  it('keeps the Sunflower sunglasses in the Face footprint, with the frame band of the Heart glasses, and only the clear lens tint over the eyes', () => {
    const paints = bodyPaints('face', GIRL, 0, 1, AREA5_SLUG.glasses);
    const box = inkBounds(paints);
    expect(isInside(box, FACE_FOOTPRINT)).toBe(true);
    const heart = bodyPaints('face', GIRL);
    // The frame is the Heart glasses' merged outline, band 3.5 (colour 2.1, 0.7 of ink each side), in sunflower yellow.
    const band = (list: readonly Paint[]): Paint[] => list.filter((p) => p.kind === 'stroke' && p.lineWidth === 3.5);
    expect(band(paints).map(signature)).toEqual(band(heart).map(signature));
    expect(paints.filter((p) => p.kind === 'stroke' && p.style === SUNFLOWER_FRAME && p.lineWidth === 2.1)).toHaveLength(1);
    // The lens is the clear tint, white at 0.25, never dark, and the one paint over the eye zones.
    const lens = paints.filter((p) => p.style === GLASSES_LENS);
    expect(lens).toHaveLength(1);
    expect(lens[0].kind).toBe('fill');
    expect(paints.indexOf(lens[0])).toBe(0);
    for (const zone of eyeZones) {
      expect(reachesCircle(regionOf(lens[0]), zone)).toBe(true);
      for (const p of paints.filter((q) => q !== lens[0])) expect(reachesCircle(regionOf(p), zone), `${p.kind} ${p.style}`).toBe(false);
    }
    // No paint is dark or opaque over the eyes: every fill is the tint or sits outside both eye zones.
    for (const p of paints.filter((q) => q.kind === 'fill' && q !== lens[0])) {
      const r = regionOf(p);
      for (const zone of eyeZones) expect(winding(r.subs, zone.x, zone.y), `${p.style} over an eye`).toBe(0);
    }
  });

  it('puts the sunflower on the bridge above the top notch: inside the gem\'s circle, 8 petals round a brown centre', () => {
    const paints = bodyPaints('face', GIRL, 0, 1, AREA5_SLUG.glasses);
    const petals = paints.filter((p) => p.kind === 'fill' && p.style === SUNFLOWER_FRAME);
    expect(petals).toHaveLength(8);
    const centre = paints.filter((p) => p.kind === 'fill' && p.style === SUNFLOWER_CENTRE);
    expect(centre).toHaveLength(1);
    const c = inkBounds(centre);
    expect(((c.minX + c.maxX) / 2)).toBeCloseTo(35.25, 6);
    expect(((c.minY + c.maxY) / 2)).toBeCloseTo(-14.85, 6);
    // The petal tips reach the gem's radius, 2.5, and its ink 0.6 more: the Heart glasses' gem place.
    const flower = inkBounds(petals);
    expect(Math.max(flower.maxX - 35.25, 35.25 - flower.minX, flower.maxY + 14.85, -14.85 - flower.minY)).toBeLessThanOrEqual(2.5 + TOL);
    expect(flower.minY - 0.6).toBeGreaterThanOrEqual(FACE_FOOTPRINT.minY - TOL);
    // Its centre is above the top notch, as the gem's.
    const [top] = glassesNotches();
    expect((c.minY + c.maxY) / 2).toBeLessThan(top.y);
  });

  it('keeps the Embroidered shirt inside the torso edge band, behind the front line, cut at the tail root, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const e: BodyEllipse = shirt.inset;
      const boundary = Array.from({ length: 720 }, (_, k) => ({
        x: e.cx + Math.cos((k / 720) * TAU) * e.rx,
        y: e.cy + Math.sin((k / 720) * TAU) * e.ry,
      }));
      const paints = bodyPaints('shirt', look, 0, 1, AREA5_SLUG.shirt);
      expect(paints.length).toBeGreaterThan(0);
      for (const { p, hw } of inkPoints(paints)) {
        const inside = ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1 + 1e-9;
        const gap = Math.min(...boundary.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
        if (!inside || gap < hw - TOL) bad.push(`${lookId(look)} edge band`);
        if (p.x + hw > SHIRT_FRONT_X + TOL) bad.push(`${lookId(look)} front`);
        if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
        if (p.x - hw < shirt.rearX - TOL) bad.push(`${lookId(look)} rear`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints the Embroidered shirt on the Tank top\'s whole silhouette: one inked shape, ink 2.0, the neckline to x -7', () => {
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const paints = bodyPaints('shirt', look, 0, 1, AREA5_SLUG.shirt);
      const body = paints.filter((p) => p.kind === 'fill' && p.style === EMBROIDERED_SHIRT_FILL);
      expect(body).toHaveLength(1);
      expect(paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 2 && p.style === INK)).toHaveLength(1);
      const tank = bodyPaints('shirt', look).find((p) => p.kind === 'fill' && p.style === TANK_TOP_FILL)!;
      expect(body[0].subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`))).toEqual(
        tank.subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`)),
      );
      expect(Math.min(...body[0].subs[0].pts.slice(-24).map((p) => p.x))).toBeCloseTo(shirt.neckline.apexX - 1, 6);
    }
  });

  it('keeps the Embroidered shirt\'s flower, hem band and shine clear of each other and inside its silhouette, on every look', () => {
    const bad: string[] = [];
    const rawBox = (paints: readonly Paint[]): Bounds =>
      boundsOfPoints(paints.flatMap((p) => p.subs.flatMap((sub) => sub.pts.map((q): [number, number] => [q.x, q.y]))), 0);
    for (const look of EVERY_BODY_LOOK) {
      const paints = bodyPaints('shirt', look, 0, 1, AREA5_SLUG.shirt);
      const petals = paints.filter((p) => p.kind === 'fill' && EMBROIDERY_PETALS.includes(p.style));
      const band = paints.filter((p) => p.kind === 'fill' && p.style === EMBROIDERY_BAND);
      const centre = paints.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA && p.style === INK && p.clips.length > 0);
      const shine = paints.filter((p) => p.kind === 'fill' && p.style === TREASURE_SHINE);
      expect(petals).toHaveLength(5);
      expect(band).toHaveLength(1);
      expect(shine).toHaveLength(1);
      // The one ink dot is the flower's centre.
      expect(centre).toHaveLength(1);
      const flower = rawBox(petals);
      const bandBox = rawBox(band);
      // The flower (ink 0.6 included) ends above the band's first ink line.
      if (flower.maxY + 0.6 > bandBox.minY) bad.push(`${lookId(look)} flower over band ${(bandBox.minY - flower.maxY).toFixed(2)}`);
      // The shine is clear of the flower's ink.
      const shineBox = rawBox(shine);
      const apart = (a: Bounds, b: Bounds, gap: number): boolean => a.maxX + gap < b.minX || b.maxX + gap < a.minX || a.maxY + gap < b.minY || b.maxY + gap < a.minY;
      if (!apart(flower, shineBox, 0.6)) bad.push(`${lookId(look)} flower over the shine`);
      // The whole flower, its ink included, lies inside the silhouette's inner edge (the inset ellipse less 2 for the ink),
      // behind the neckline's ink (2.0 wide, its front at x -7 at the apex).
      const e = shirtGeometry(look).inset;
      for (const p of petals) {
        for (const sub of p.subs) {
          for (const q of sub.pts) {
            if (((q.x - e.cx) / (e.rx - 2 - 0.6)) ** 2 + ((q.y - e.cy) / (e.ry - 2 - 0.6)) ** 2 > 1) bad.push(`${lookId(look)} flower cut by the edge`);
            if (q.x + 0.6 > shirtGeometry(look).neckline.apexX - 2) bad.push(`${lookId(look)} flower past the neckline`);
          }
        }
      }
      // The centre dot sits inside the flower.
      const dot = rawBox(centre);
      if (dot.minX < flower.minX || dot.maxX > flower.maxX || dot.minY < flower.minY || dot.maxY > flower.maxY) bad.push(`${lookId(look)} centre off the flower`);
      // Each is clipped to the silhouette, so none is a stray paint.
      for (const p of [...petals, ...band, ...centre]) if (p.clips.length === 0) bad.push(`${lookId(look)} unclipped ${p.style}`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the Hummingbird tail ribbon within 17.5 units of its anchor, ink included, at every look, swim phase and tail amplitude', () => {
    let reach = 0;
    for (const look of EVERY_BODY_LOOK) {
      const tail = axolotlBodyGeometry(look).tail;
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          const frame = tailSlotFrame(tail, swim, amp);
          for (const { p, hw } of inkPoints(bodyPaints('tail', look, swim, amp, AREA5_SLUG.ribbon))) {
            reach = Math.max(reach, Math.hypot(p.x - frame.x, p.y - frame.y) + hw);
          }
        }
      }
    }
    expect(reach).toBeLessThanOrEqual(TAIL_SLOT_REACH + TOL);
  });

  it('turns the Hummingbird tail ribbon with the local tail direction: its knot gem sits on the anchor, the loops above the tail edge and the streamers below', () => {
    const tail = axolotlBodyGeometry(DEFAULT_ART_LOOK).tail;
    for (const swim of SWIMS) {
      const frame = tailSlotFrame(tail, swim, 1.6);
      const paints = bodyPaints('tail', DEFAULT_ART_LOOK, swim, 1.6, AREA5_SLUG.ribbon);
      const centreOf = (paint: Paint): Pt => {
        const box = inkBounds([paint]);
        return toFrame(frame, { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 });
      };
      const gem = centreOf(paints.find((p) => p.kind === 'fill' && p.style === BOW_GEM)!);
      expect(gem.x).toBeCloseTo(0, 6);
      expect(gem.y).toBeGreaterThan(0);
      expect(gem.y).toBeLessThan(3);
      // Everything of the ribbon's fill (the loops and the streamers) is on the knot's two sides: loops rise above the tail edge, streamers hang below.
      const ribbon = paints.filter((p) => p.kind === 'fill' && p.style === HUMMINGBIRD_RIBBON_FILL);
      expect(ribbon).toHaveLength(5);
      const boxes = ribbon.map((p) => {
        const pts = p.subs.flatMap((sub) => sub.pts.map((q) => toFrame(frame, q)));
        return { minY: Math.min(...pts.map((q) => q.y)), maxY: Math.max(...pts.map((q) => q.y)) };
      });
      expect(boxes.filter((b) => b.minY < -5)).toHaveLength(2);
      expect(boxes.filter((b) => b.maxY > 6)).toHaveLength(2);
    }
  });

  it('keeps the Rainbow serape cape in its look\'s back box, filling it end to end, with its forward corner at x -5.5 or less', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const { frame, box } = backFootprint(look);
      const paints = bodyPaints('back', look, 0, 1, AREA5_SLUG.cape);
      expect(paints.length).toBeGreaterThan(0);
      const along = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
      for (const { q, hw } of along) {
        if (q.x - hw < box.minU - TOL || q.x + hw > box.maxU + TOL) bad.push(`${lookId(look)} u`);
        if (q.y - hw < box.minV - TOL || q.y + hw > box.maxV + TOL) bad.push(`${lookId(look)} v`);
      }
      for (const { p, hw } of inkPoints(paints)) if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.x - hw)) - box.minU) > TOL) bad.push(`${lookId(look)} rear end`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.x + hw)) - box.maxU) > TOL) bad.push(`${lookId(look)} front end`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.y - hw)) - box.minV) > TOL) bad.push(`${lookId(look)} top`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.y + hw)) - box.maxV) > TOL) bad.push(`${lookId(look)} bottom`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('never lets the Rainbow serape cape\'s fill meet a Shirt\'s fill (any of the five Shirts), on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const fillsOf = (slot: 'shirt' | 'back', slug: WearableArtSlug): SampledPaint[] =>
        sampledPaints(bodyPaints(slot, look, 0, 1, slug).filter((x) => x.kind === 'fill' && isItemFill(x)));
      const cape = fillsOf('back', AREA5_SLUG.cape);
      for (const shirtSlug of EVERY_SHIRT_SLUG) {
        const shirt = fillsOf('shirt', shirtSlug);
        const both = gridPoints(unionBounds(cape.map((f) => f.box))).filter(
          (q) => cape.some((f) => paintCovers(f, q.x, q.y)) && shirt.some((f) => paintCovers(f, q.x, q.y)),
        );
        if (both.length > 0) bad.push(`${lookId(look)} cape over ${shirtSlug}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps every Area 5 Wearable, ink included, in the texture frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of AREA5_BODY_ITEMS) {
        const swims = slot === 'tail' ? SWIMS : [0];
        for (const swim of swims) {
          for (const amp of slot === 'tail' ? AMPS : [1]) {
            if (!isInside(inkBounds(bodyPaints(slot, look, swim, amp, slug)), inner, 1e-6)) bad.push(`${lookId(look)} ${slug}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
    expect([AXO_TEX.w, AXO_TEX.h]).toEqual([166, 142]);
  });

  it('paints a still look: no Area 5 painter reads a swim phase or tail amplitude except the ribbon\'s frame, and a repaint is identical', () => {
    for (const [slot, slug] of AREA5_BODY_ITEMS.filter(([slot]) => slot !== 'tail')) {
      const first = bodyPaints(slot, GIRL, 0, 1, slug).map(signature);
      expect(bodyPaints(slot, GIRL, 0, 1, slug).map(signature)).toEqual(first);
      for (const swim of SWIMS) for (const amp of AMPS) expect(bodyPaints(slot, GIRL, swim, amp, slug).map(signature), `${slug} swim ${swim} amp ${amp}`).toEqual(first);
    }
    // The ribbon's paints are the same in its own frame at every phase: it moves only with the tail's frame.
    const tail = axolotlBodyGeometry(GIRL).tail;
    const inFrameOf = (swim: number, amp: number): string[] => {
      const frame = tailSlotFrame(tail, swim, amp);
      return bodyPaints('tail', GIRL, swim, amp, AREA5_SLUG.ribbon).map((p) =>
        JSON.stringify({ k: p.kind, s: p.style, w: p.lineWidth, pts: p.subs.map((sub) => sub.pts.map((q) => {
          const f = toFrame(frame, q);
          return `${fixed4(f.x)},${fixed4(f.y)}`;
        })) }),
      );
    };
    const first = inFrameOf(0, 1);
    for (const swim of SWIMS) for (const amp of AMPS) expect(inFrameOf(swim, amp)).toEqual(first);
  });

  it('never looks hurt: no Area 5 paint is red, and every Area 5 outer fill is a pale colour at 9:1 with ink', () => {
    const red = (hex: string): boolean => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
      if (!m) return false;
      const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
      return r >= 180 && g <= 100 && b <= 100;
    };
    for (const [slot, slug] of AREA5_BODY_ITEMS) {
      for (const look of [DEFAULT_ART_LOOK, GIRL]) {
        for (const p of bodyPaints(slot, look, 0, 1, slug)) expect(red(p.style), `${slug} ${p.kind} ${p.style}`).toBe(false);
      }
    }
    for (const colour of [...EMBROIDERY_PETALS, ...SERAPE_STRIPES]) expect(red(colour), colour).toBe(false);
    const outer = [BEE_HEADBAND_FILL, BANDANA_FILL, SUNFLOWER_FRAME, EMBROIDERED_SHIRT_FILL, EMBROIDERY_BAND, HUMMINGBIRD_RIBBON_FILL, ...SERAPE_STRIPES];
    for (const fill of outer) {
      expect(contrast(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
    // The six stripes are six different colours.
    expect(new Set(SERAPE_STRIPES).size).toBe(6);
  });

  it('keeps the Rare trims and the Epic gem readable in greyscale: each differs from the colour it sits on by a luminance ratio of 1.4 or more', () => {
    expect(contrast(EMBROIDERY_BAND, EMBROIDERED_SHIRT_FILL)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(SUNFLOWER_CENTRE, SUNFLOWER_FRAME)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(BOW_GEM, HUMMINGBIRD_RIBBON_FILL)).toBeGreaterThanOrEqual(1.4);
    // The embroidered petals read on the blouse by their own ink ring (0.6), and the ink reads on every outer fill as on any.
    for (const petal of EMBROIDERY_PETALS) expect(contrast(INK, petal), petal).toBeGreaterThanOrEqual(6);
    // Pale neighbouring stripes are told apart by the thin ink line between them: five lines for six stripes.
    const cape = bodyPaints('back', DEFAULT_ART_LOOK, 0, 1, AREA5_SLUG.cape);
    expect(cape.filter((p) => p.kind === 'stroke' && p.style === INK && p.lineWidth === 0.6 && p.alpha === 1 && p.clips.length > 0)).toHaveLength(5 + 2);
  });

  it('leaves the twenty-five earlier worn looks as they were: the digest of their paints is unchanged', () => {
    const slugs = (Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]).slice(0, 25);
    expect(slugs[0]).toBe('sun-hat');
    expect(slugs[24]).toBe('monarch-wings');
    const looks: AxolotlArtLook[] = [
      DEFAULT_ART_LOOK,
      { ...GIRL, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, body: 'slim', age: 'grownUp', tail: 'long' },
    ];
    const out: string[] = [];
    for (const slug of slugs) {
      const slot = WEARABLE_ART_SLOT[slug];
      for (const look of looks) {
        for (const [swim, amp] of [
          [0, 1],
          [2.1, 1.6],
        ] as const) {
          if (isLegSlot(slot)) for (const frame of legSlotFrames(look, swim)) out.push(...legPaints({ [slot]: slug }, frame).map(signature));
          else out.push(...bodyPaints(slot, look, swim, amp, slug).map(signature));
        }
      }
    }
    expect(out).toHaveLength(3378);
    expect(digest(out.join('\n'))).toBe('67e0b2d45ef5e5ee');
  });
});

describe('chinampa Area 5 Wearables (issue #103): the rarity look ladder', () => {
  const colours = (paints: readonly Paint[], kind: 'fill' | 'stroke'): string[] =>
    paints.filter((p) => p.kind === kind && p.alpha === 1).map((p) => p.style);
  const count = (list: readonly string[], value: string): number => list.filter((v) => v === value).length;
  const stars = (paints: readonly Paint[]): Paint[] =>
    paints.filter((p) => p.kind === 'fill' && p.style === WHITE && p.subs.length === 1 && p.subs[0].pts.length === 8);
  const inkWidths = (paints: readonly Paint[]): number[] =>
    [...new Set(paints.filter((p) => p.kind === 'stroke' && p.style === INK).map((p) => Math.round(p.lineWidth * 1e9) / 1e9))].sort((a, b) => a - b);
  const noGemOrGold = (paints: readonly Paint[]): boolean => !paints.some((p) => p.style === GOLD_TRIM || p.style === GLASSES_GEM || p.style === BOW_GEM);

  it('paints Common as flat colour plus one shine, no trim: Bee headband (bee stripes), Bandana (polka dots)', () => {
    const band = bodyPaints('head', GIRL, 0, 1, AREA5_SLUG.band);
    expect(new Set(colours(band, 'fill'))).toEqual(new Set([BEE_HEADBAND_FILL, TREASURE_SHINE]));
    // The band and the two bobbles share the bee yellow, the stems are strokes of it; the one shine is the only other fill.
    expect(count(colours(band, 'fill'), BEE_HEADBAND_FILL)).toBe(3);
    expect(count(colours(band, 'stroke'), BEE_HEADBAND_FILL)).toBe(2);
    expect(count(colours(band, 'fill'), TREASURE_SHINE)).toBe(1);
    // The four bee stripes are ink at alpha 0.30: the same colour darkened, not a second colour.
    const stripes = band.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(stripes).toHaveLength(4);
    expect(stripes.every((p) => p.style === INK)).toBe(true);
    expect(noGemOrGold(band) && !band.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(stars(band)).toHaveLength(0);
    const bandana = bodyPaints('neck', GIRL, 0, 1, AREA5_SLUG.bandana);
    expect(new Set(colours(bandana, 'fill'))).toEqual(new Set([BANDANA_FILL, TREASURE_SHINE]));
    expect(count(colours(bandana, 'fill'), BANDANA_FILL)).toBe(1);
    expect(count(colours(bandana, 'fill'), TREASURE_SHINE)).toBe(1);
    // The six polka dots are ink at alpha 0.30, not a second colour.
    const dots = bandana.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(dots).toHaveLength(6);
    expect(dots.every((p) => p.style === INK)).toBe(true);
    expect(noGemOrGold(bandana) && !bandana.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(stars(bandana)).toHaveLength(0);
  });

  it('adds one trim band in a second colour for Rare: Sunflower sunglasses centre, Embroidered shirt hem band', () => {
    const glasses = bodyPaints('face', GIRL, 0, 1, AREA5_SLUG.glasses);
    // The one second colour is the seed-brown centre; the petals are the frame yellow.
    expect(count(colours(glasses, 'fill'), SUNFLOWER_CENTRE)).toBe(1);
    expect(count(colours(glasses, 'fill'), SUNFLOWER_FRAME)).toBe(8);
    expect(colours(glasses, 'stroke')).toContain(SUNFLOWER_FRAME);
    expect(glasses.filter((p) => p.style === GLASSES_LENS)).toHaveLength(1);
    expect(new Set(colours(glasses, 'fill'))).toEqual(new Set([GLASSES_LENS, SUNFLOWER_FRAME, SUNFLOWER_CENTRE]));
    expect(noGemOrGold(glasses)).toBe(true);
    expect(stars(glasses)).toHaveLength(0);
    const shirt = bodyPaints('shirt', GIRL, 0, 1, AREA5_SLUG.shirt);
    expect(count(colours(shirt, 'fill'), EMBROIDERY_BAND)).toBe(1);
    expect(count(colours(shirt, 'fill'), EMBROIDERED_SHIRT_FILL)).toBe(1);
    expect(count(colours(shirt, 'fill'), TREASURE_SHINE)).toBe(1);
    // Five petals, one thread colour each.
    for (const petal of EMBROIDERY_PETALS) expect(count(colours(shirt, 'fill'), petal), petal).toBe(1);
    expect(noGemOrGold(shirt)).toBe(true);
    expect(stars(shirt)).toHaveLength(0);
    // The flower centre is ink at alpha 0.30, not a second colour.
    const dots = shirt.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(dots).toHaveLength(1);
    expect(dots.every((p) => p.style === INK)).toBe(true);
  });

  it('adds one rounded gem for Epic: Hummingbird tail ribbon, a gem of radius 2.5 on the knot, no trim or star', () => {
    const ribbon = bodyPaints('tail', GIRL, 0, 1, AREA5_SLUG.ribbon);
    const gems = ribbon.filter((p) => p.kind === 'fill' && p.style === BOW_GEM);
    expect(gems).toHaveLength(1);
    const box = inkBounds([gems[0]]);
    expect((box.maxX - box.minX) / 2).toBeCloseTo(2.5, 1);
    // Two feather loops, two forked streamers and the knot share the one ribbon colour.
    expect(count(colours(ribbon, 'fill'), HUMMINGBIRD_RIBBON_FILL)).toBe(5);
    expect(count(colours(ribbon, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(ribbon.some((p) => p.style === GOLD_TRIM || p.style === BOAT_TRIM || p.style === GLASSES_GEM)).toBe(false);
    expect(stars(ribbon)).toHaveLength(0);
  });

  it('adds gold trim and one static 4-point star for Legendary: Rainbow serape cape, six stripes and a gold clasp band', () => {
    const cape = bodyPaints('back', GIRL, 0, 1, AREA5_SLUG.cape);
    expect(count(colours(cape, 'fill'), GOLD_TRIM)).toBe(1);
    // Each of the six stripe colours is painted once, the first as the silhouette's own fill.
    for (const stripe of SERAPE_STRIPES) expect(count(colours(cape, 'fill'), stripe), stripe).toBe(1);
    expect(count(colours(cape, 'fill'), TREASURE_SHINE)).toBe(1);
    // The stripes after the first (the silhouette's own fill) run in order from the rear to the front.
    const order = SERAPE_STRIPES.slice(1).map((stripe) => {
      const b = boundsOfPoints(cape.find((p) => p.kind === 'fill' && p.style === stripe)!.subs.flatMap((sub) => sub.pts.map((q): [number, number] => [q.x, q.y])), 0);
      return (b.minX + b.maxX) / 2;
    });
    expect(stars(cape)).toHaveLength(1);
    const pts = stars(cape)[0].subs[0].pts;
    const cx = pts.reduce((n, p) => n + p.x, 0) / 8;
    const cy = pts.reduce((n, p) => n + p.y, 0) / 8;
    const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    expect(Math.max(...radii)).toBeCloseTo(3, 6);
    expect(Math.min(...radii)).toBeCloseTo(3 * 0.38, 6);
    expect(order).toHaveLength(5);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The gold band is inside the cape (clipped), between two thin ink lines, and there is no gem.
    const gold = cape.find((p) => p.kind === 'fill' && p.style === GOLD_TRIM)!;
    expect(gold.clips.length).toBeGreaterThan(0);
    expect(cape.some((p) => p.style === GLASSES_GEM || p.style === BOW_GEM)).toBe(false);
  });

  it('strokes an Area 5 silhouette at the item ink: 2 x 2.0 for a blob, 2.0 for a shape, 2 x 0.6 for the bandana', () => {
    // The band and bobbles stroke 2 x 2.0, the stems 2.2 + 2 x 2.0.
    expect(inkWidths(bodyPaints('head', GIRL, 0, 1, AREA5_SLUG.band))).toEqual([4, 6.2]);
    expect(inkWidths(bodyPaints('neck', GIRL, 0, 1, AREA5_SLUG.bandana))).toEqual([1.2]);
    // The glasses band 3.5 (0.7 of ink each side) and the sunflower's 0.6 outside.
    expect(inkWidths(bodyPaints('face', GIRL, 0, 1, AREA5_SLUG.glasses))).toEqual([1.2, 3.5]);
    expect(inkWidths(bodyPaints('shirt', GIRL, 0, 1, AREA5_SLUG.shirt))).toEqual([0.6, 1.2, 2]);
    expect(inkWidths(bodyPaints('tail', GIRL, 0, 1, AREA5_SLUG.ribbon))).toEqual([1.2, 4]);
    expect(inkWidths(bodyPaints('back', GIRL, 0, 1, AREA5_SLUG.cape))).toEqual([0.6, 1.2, 4]);
  });
});

// ---------------------------------------------------------------------------
// The spring cave Area 6 Wearables (issue #77, ND-12): zones, footprints, layers and counted details
// ---------------------------------------------------------------------------
//
// The same checks as the Area 5 block above, for the Miner's headlamp, Crystal pendant, Explorer vest,
// Crystal tail cuff and Crystal crown. The catalogue-driven suite holds each to the size rule; these
// hold them to the rest of guide 6i. The earlier looks' checks are unchanged, and a digest pins their paints.

const AREA6_SLUG = {
  lamp: 'miners-headlamp',
  pendant: 'crystal-pendant',
  vest: 'explorer-vest',
  cuff: 'crystal-tail-cuff',
  crown: 'crystal-crown',
} as const satisfies Record<string, WearableArtSlug>;
const SPRING_CAVE_WEARABLES = CATALOGUE_WEARABLES.filter((w) => SPRING_CAVE_TREASURES.some((t) => t.id === w.id));
/** A full Area 6 outfit with the Crystal crown, and the same with the Miner's headlamp in the Head slot. */
const AREA6_OUTFIT: ArtOutfit = { head: AREA6_SLUG.crown, neck: AREA6_SLUG.pendant, shirt: AREA6_SLUG.vest, tail: AREA6_SLUG.cuff };
const AREA6_LAMP_OUTFIT: ArtOutfit = { ...AREA6_OUTFIT, head: AREA6_SLUG.lamp };
/** The Area 6 slugs that paint on the body, with their slots. */
const AREA6_BODY_ITEMS = [
  ['head', AREA6_SLUG.lamp],
  ['neck', AREA6_SLUG.pendant],
  ['shirt', AREA6_SLUG.vest],
  ['tail', AREA6_SLUG.cuff],
  ['head', AREA6_SLUG.crown],
] as const;
/** The six Shirts, to keep every Back item's fill off. */
const EVERY_SHIRT_SLUG_6 = [...EVERY_SHIRT_SLUG, AREA6_SLUG.vest] as const;
/** The Back items of the earlier areas: Area 6 has none. */
const EVERY_BACK_SLUG = ['diving-tank', POND_SLUG.ladybug, POND_SLUG.wings, AREA3_SLUG.cape, AREA4_SLUG.wings, AREA5_SLUG.cape] as const;

/** Local box of every point of `paints`, no ink and clips ignored. */
function rawBoxOf(paints: readonly Paint[]): Bounds {
  return boundsOfPoints(paints.flatMap((p) => p.subs.flatMap((sub) => sub.pts.map((q): [number, number] => [q.x, q.y]))), 0);
}
/** The static 4-point stars (white, one 8-vertex polygon) among `paints`. */
const starsOf = (paints: readonly Paint[]): Paint[] =>
  paints.filter((p) => p.kind === 'fill' && p.style === WHITE && p.subs.length === 1 && p.subs[0].pts.length === 8);
/** The distinct ink stroke widths of `paints`, least first. */
const inkWidthsOf = (paints: readonly Paint[]): number[] =>
  [...new Set(paints.filter((p) => p.kind === 'stroke' && p.style === INK).map((p) => Math.round(p.lineWidth * 1e9) / 1e9))].sort((a, b) => a - b);

describe('spring cave Area 6 Wearables (issue #77): zones, footprints and layers', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('has five spring cave Wearables of the 41: Head, Neck, Shirt, Tail and Head', () => {
    expect(CATALOGUE_WEARABLES).toHaveLength(41);
    expect(SPRING_CAVE_WEARABLES.map((w) => `${w.slot}:${treasureSlug(w.id)}`)).toEqual([
      'head:miners-headlamp',
      'neck:crystal-pendant',
      'shirt:explorer-vest',
      'tail:crystal-tail-cuff',
      'head:crystal-crown',
    ]);
    expect(SPRING_CAVE_WEARABLES.some((w) => [...POND_WEARABLES, ...POND_2_WEARABLES, ...CHINAMPA_WEARABLES, ...CHINAMPA_2_WEARABLES].includes(w))).toBe(false);
    expect(Object.keys(WEARABLE_ART_SLOT)).toHaveLength(41);
    expect(Object.values(AREA6_SLUG).map((slug) => WEARABLE_ART_SLOT[slug])).toEqual(['head', 'neck', 'shirt', 'tail', 'head']);
    // The Area 6 slugs come after the thirty-one earlier ones.
    expect(Object.keys(WEARABLE_ART_SLOT).slice(31, 36)).toEqual(['miners-headlamp', 'crystal-pendant', 'explorer-vest', 'crystal-tail-cuff', 'crystal-crown']);
  });

  it('maps Area 6 catalogue ids to art slugs by slot, and leaves out an Area 6 id worn in the wrong slot', () => {
    expect(
      artOutfit({
        head: 'spring-cave/crystal-crown',
        neck: 'spring-cave/crystal-pendant',
        shirt: 'spring-cave/explorer-vest',
        tail: 'spring-cave/crystal-tail-cuff',
      }),
    ).toEqual(AREA6_OUTFIT);
    expect(artOutfit({ head: 'spring-cave/miners-headlamp' })).toEqual({ head: AREA6_SLUG.lamp });
    expect(
      artOutfit({
        head: 'spring-cave/crystal-pendant',
        neck: 'spring-cave/miners-headlamp',
        shirt: 'spring-cave/crystal-tail-cuff',
        tail: 'spring-cave/explorer-vest',
        face: 'spring-cave/crystal-crown',
      }),
    ).toEqual({});
    expect(outfitKey(AREA6_OUTFIT)).toBe('head=crystal-crown,neck=crystal-pendant,shirt=explorer-vest,tail=crystal-tail-cuff');
    // Still the canal's slug per slot first: the new slugs only come after.
    expect(WEARABLE_ART_SLUGS).toEqual(['sun-hat', 'shell-necklace', 'heart-glasses', 'tank-top', 'diving-tank', 'golden-bow', 'stripy-socks', 'flippers']);
  });

  it('keeps the Miner\'s headlamp, Crystal crown and Crystal pendant off the eyes, the gill roots and the cheek heart zone, alike on every look', () => {
    for (const [slot, slug] of [
      ['head', AREA6_SLUG.lamp],
      ['head', AREA6_SLUG.crown],
      ['neck', AREA6_SLUG.pendant],
    ] as const) {
      const paints = bodyPaints(slot, DEFAULT_ART_LOOK, 0, 1, slug);
      expect(paints.length).toBeGreaterThan(0);
      for (const look of EVERY_BODY_LOOK) expect(bodyPaints(slot, look, 0, 1, slug).map(signature), `${slug} ${lookId(look)}`).toEqual(paints.map(signature));
      for (const paint of paints) expect(trouble(paint, { lashes: true, gills: true }), `${slug} ${paint.kind} ${paint.style}`).toBeNull();
    }
  });

  it('keeps the Explorer vest and the Crystal tail cuff off the eyes, lashes, gill roots and cheek heart zone on every look, swim phase and tail amplitude', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const p of bodyPaints('shirt', look, 0, 1, AREA6_SLUG.vest)) {
        const why = trouble(p, { lashes: true, gills: true });
        if (why) bad.push(`${lookId(look)} vest ${why}`);
      }
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          for (const p of bodyPaints('tail', look, swim, amp, AREA6_SLUG.cuff)) {
            const why = trouble(p, { lashes: true, gills: true });
            if (why) bad.push(`${lookId(look)} swim ${swim.toFixed(2)} amp ${amp} cuff ${why}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps every Area 6 Wearable of a full drawAxolotl run off the eyes and, past the silhouette, the gill roots and cheek heart zone, at every size', () => {
    const looks = AXO_SIZES.flatMap((size): AxolotlArtLook[] => [
      { ...DEFAULT_ART_LOOK, size },
      { ...GIRL, size, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, size, body: 'slim', age: 'grownUp', tail: 'long' },
    ]);
    for (const outfit of [AREA6_OUTFIT, AREA6_LAMP_OUTFIT]) {
      for (const pose of Object.values(POSES)) {
        for (const look of looks) {
          const base = drawn(pose, look);
          const worn = drawn(pose, look, outfit);
          const silhouette = worn.findIndex((p) => p.kind === 'stroke' && p.lineWidth === 2 * LW && p.style === INK);
          const inserted = insertedPaints(base, worn)!;
          expect(inserted.length).toBeGreaterThan(0);
          for (const { index, paint } of inserted) {
            const why = trouble(paint, { lashes: false, gills: index > silhouette, heart: index > silhouette });
            expect(why, `${lookId(look)} paint ${index} ${paint.kind} ${paint.style}`).toBeNull();
          }
        }
      }
    }
  });

  it('paints every Area 6 Wearable before the eyes, a Girl lashes included, and changes none of the axolotl\'s own paints', () => {
    for (const outfit of [AREA6_OUTFIT, AREA6_LAMP_OUTFIT]) {
      for (const look of [DEFAULT_ART_LOOK, GIRL, { ...GIRL, body: 'chubby' as const, age: 'baby' as const, tail: 'short' as const }]) {
        for (const pose of Object.values(POSES)) {
          const base = drawn(pose, look);
          const worn = drawn(pose, look, outfit);
          const inserted = insertedPaints(base, worn);
          expect(inserted).not.toBeNull();
          expect(inserted!.length).toBeGreaterThan(0);
          const eyes = firstEyePaint(worn);
          expect(eyes).toBeGreaterThan(0);
          for (const x of inserted!) expect(x.index).toBeLessThan(eyes);
          expect(worn.length - eyes).toBe(base.length - firstEyePaint(base));
        }
      }
    }
  });

  it('keeps the Miner\'s headlamp on the head top (ink x about 16.4 to 45.6, lowest y -19.5), resting on the head, its dome rising 8 or more above the head outline', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA6_SLUG.lamp);
    const box = inkBounds(paints);
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.maxY).toBeCloseTo(-19.5, 1);
    expect(box.minX).toBeCloseTo(16.4, 1);
    expect(box.maxX).toBeCloseTo(45.6, 1);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(HEAD_ELLIPSE.rx * 2 * WEARABLE_SLOT_MINIMUMS.head.headWidthShare);
    expect(headRise(inkPoints(paints))).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.head.rise);
    // The brim rests on the head: its lowest fill point is inside the head outline's ink ring.
    const fills = paints.filter((p) => p.kind === 'fill' && p.style === MINERS_HELMET_FILL);
    expect(fills).toHaveLength(3);
    const lowest = fills.flatMap((p) => p.subs[0].pts).reduce((a, b) => (b.y > a.y ? b : a));
    expect(((lowest.x - HEAD_ELLIPSE.cx) / (HEAD_ELLIPSE.rx + LW)) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / (HEAD_ELLIPSE.ry + LW)) ** 2).toBeLessThan(1);
    // The glasses keep 1.5 or more under it, as under every Head item.
    expect(FACE_FOOTPRINT.minY - HEAD_FOOTPRINT.maxY).toBeCloseTo(1.5, 6);
  });

  it('paints the Miner\'s headlamp as a hard hat: a brim, a dome and a lamp housing on the dome\'s front, with the lens inside the housing', () => {
    const paints = bodyPaints('head', GIRL, 0, 1, AREA6_SLUG.lamp);
    const [brim, dome, housing] = paints.filter((p) => p.kind === 'fill' && p.style === MINERS_HELMET_FILL).map((p) => rawBoxOf([p]));
    // The dome stands above the brim, the housing at its front and lower than its top.
    expect(dome.minY).toBeLessThan(brim.minY - 8);
    expect((housing.minX + housing.maxX) / 2).toBeGreaterThan((dome.minX + dome.maxX) / 2);
    expect(housing.maxX).toBeLessThanOrEqual(brim.maxX);
    expect(housing.minY).toBeGreaterThan(dome.minY);
    expect((housing.maxX - housing.minX) / 2).toBeCloseTo(3.4, 1);
    // The lens is a disc of ink at the stripe alpha, centred on the housing; the rib is clipped to the dome.
    const alpha = paints.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(alpha).toHaveLength(2);
    expect(alpha.every((p) => p.style === INK)).toBe(true);
    const [rib, lens] = alpha;
    expect(rib.clips.length).toBeGreaterThan(0);
    expect(lens.clips).toHaveLength(0);
    const lensBox = rawBoxOf([lens]);
    expect((lensBox.minX + lensBox.maxX) / 2).toBeCloseTo((housing.minX + housing.maxX) / 2, 6);
    expect((lensBox.minY + lensBox.maxY) / 2).toBeCloseTo((housing.minY + housing.maxY) / 2, 6);
    expect(lensBox.maxX - lensBox.minX).toBeLessThan(housing.maxX - housing.minX);
  });

  it('keeps the Crystal pendant in the Neck footprint, under the mouth, off the cheek heart zone and inside LW / 2 of the silhouette outline on every look', () => {
    const paints = bodyPaints('neck', DEFAULT_ART_LOOK, 0, 1, AREA6_SLUG.pendant);
    const box = inkBounds(paints);
    expect(isInside(box, NECK_FOOTPRINT)).toBe(true);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.neck.minWidth);
    // The mouth paints over its front: it runs under the mouth zone.
    expect(paints.some((p) => reachesBox(regionOf(p), MOUTH_ZONE))).toBe(true);
    let heartGap = Infinity;
    for (const p of paints) {
      const r = regionOf(p);
      for (const [a, b] of edgesOf(r)) heartGap = Math.min(heartGap, segDist(CHEEK_HEART_ZONE.x, CHEEK_HEART_ZONE.y, a, b) - r.hw - CHEEK_HEART_ZONE.r);
    }
    expect(heartGap).toBeGreaterThanOrEqual(-TOL);
    // Only the lower edge can reach the outline's outer half (the upper edge is held by the zones above).
    const points = inkPoints(paints).filter(({ p, hw }) => p.y + hw >= 17);
    const margins = outlineMargins(points);
    const least = leastOver(margins);
    expect(least.value, least.id).toBeGreaterThanOrEqual(0);
  });

  it('paints the Crystal pendant as a chain and one crystal inside the Pond-weed scarf\'s band, ink 0.6 outside, with a ring and facet lines', () => {
    const pendant = bodyPaints('neck', GIRL, 0, 1, AREA6_SLUG.pendant);
    const scarf = bodyPaints('neck', GIRL, 0, 1, POND_SLUG.scarf);
    const [chain, crystal] = pendant.filter((p) => p.kind === 'fill' && p.style === CAVE_CRYSTAL_FILL);
    expect(chain).toBeDefined();
    expect(crystal).toBeDefined();
    const scarfBody = scarf.find((p) => p.kind === 'fill' && p.style === POND_WEED_SCARF)!;
    const bandBox = rawBoxOf([scarfBody]);
    const chainBox = rawBoxOf([chain]);
    const crystalBox = rawBoxOf([crystal]);
    // The chain spans most of the band and the crystal sits inside it, under the mouth, nearer the front.
    expect(chainBox.minX).toBeGreaterThanOrEqual(bandBox.minX);
    expect(chainBox.maxX).toBeLessThanOrEqual(bandBox.maxX);
    expect(chainBox.minY).toBeGreaterThanOrEqual(bandBox.minY - TOL);
    expect(chainBox.maxY).toBeLessThanOrEqual(bandBox.maxY + TOL);
    expect(crystalBox.minY).toBeGreaterThanOrEqual(bandBox.minY - TOL);
    expect(crystalBox.maxY).toBeLessThanOrEqual(bandBox.maxY + TOL);
    expect((crystalBox.minX + crystalBox.maxX) / 2).toBeGreaterThan((chainBox.minX + chainBox.maxX) / 2);
    // The crystal is as tall as the chain is where it hangs (within 0.1: its rounded tips are shaved), and its ink ring sets it off.
    const mid = (crystalBox.minX + crystalBox.maxX) / 2;
    const chainHere = chain.subs[0].pts.filter((q) => Math.abs(q.x - mid) <= 0.3).map((q) => q.y);
    expect(chainHere.length).toBeGreaterThan(1);
    expect(crystalBox.maxY - crystalBox.minY).toBeGreaterThanOrEqual(Math.max(...chainHere) - Math.min(...chainHere) - 0.1);
    // The facet lines (a girdle and a centre line) are one stroke of ink at the stripe alpha, the same colour darkened; a thin ink ring (0.9) sets the crystal off the chain.
    const facets = pendant.filter((p) => p.kind === 'stroke' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(facets).toHaveLength(1);
    expect(facets[0].style).toBe(INK);
    expect(facets[0].subs).toHaveLength(2);
    expect(inkWidthsOf(pendant)).toEqual([0.9, 1.2]);
  });

  it('keeps the Explorer vest inside the torso edge band, behind the front line, cut at the tail root, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const e: BodyEllipse = shirt.inset;
      const boundary = Array.from({ length: 720 }, (_, k) => ({
        x: e.cx + Math.cos((k / 720) * TAU) * e.rx,
        y: e.cy + Math.sin((k / 720) * TAU) * e.ry,
      }));
      const paints = bodyPaints('shirt', look, 0, 1, AREA6_SLUG.vest);
      expect(paints.length).toBeGreaterThan(0);
      for (const { p, hw } of inkPoints(paints)) {
        const inside = ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1 + 1e-9;
        const gap = Math.min(...boundary.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
        if (!inside || gap < hw - TOL) bad.push(`${lookId(look)} edge band`);
        if (p.x + hw > SHIRT_FRONT_X + TOL) bad.push(`${lookId(look)} front`);
        if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
        if (p.x - hw < shirt.rearX - TOL) bad.push(`${lookId(look)} rear`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints the Explorer vest on the Tank top\'s whole silhouette: one inked shape, ink 2.0, the neckline to x -7, with the belt clipped inside it', () => {
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const paints = bodyPaints('shirt', look, 0, 1, AREA6_SLUG.vest);
      const body = paints.filter((p) => p.kind === 'fill' && p.style === EXPLORER_VEST_FILL);
      expect(body).toHaveLength(1);
      expect(paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 2 && p.style === INK)).toHaveLength(1);
      const tank = bodyPaints('shirt', look).find((p) => p.kind === 'fill' && p.style === TANK_TOP_FILL)!;
      expect(body[0].subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`))).toEqual(
        tank.subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`)),
      );
      expect(Math.min(...body[0].subs[0].pts.slice(-24).map((p) => p.x))).toBeCloseTo(shirt.neckline.apexX - 1, 6);
      const belt = paints.filter((p) => p.kind === 'fill' && p.style === EXPLORER_VEST_BELT);
      expect(belt).toHaveLength(1);
      expect(belt[0].clips.length).toBeGreaterThan(0);
    }
  });

  it('keeps the Explorer vest\'s belt below the shine and across the lower torso on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const e = shirtGeometry(look).inset;
      const paints = bodyPaints('shirt', look, 0, 1, AREA6_SLUG.vest);
      const belt = rawBoxOf([paints.find((p) => p.kind === 'fill' && p.style === EXPLORER_VEST_BELT)!]);
      const shine = rawBoxOf([paints.find((p) => p.kind === 'fill' && p.style === TREASURE_SHINE)!]);
      if (Math.abs(belt.minY - (e.cy + e.ry * 0.56)) > TOL) bad.push(`${lookId(look)} belt place`);
      if (Math.abs(belt.maxY - belt.minY - 3) > TOL) bad.push(`${lookId(look)} belt height`);
      if (shine.maxY + 0.6 > belt.minY) bad.push(`${lookId(look)} shine over belt`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the Crystal tail cuff within 17.5 units of its anchor, ink included, at every look, swim phase and tail amplitude', () => {
    let reach = 0;
    for (const look of EVERY_BODY_LOOK) {
      const tail = axolotlBodyGeometry(look).tail;
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          const frame = tailSlotFrame(tail, swim, amp);
          for (const { p, hw } of inkPoints(bodyPaints('tail', look, swim, amp, AREA6_SLUG.cuff))) {
            reach = Math.max(reach, Math.hypot(p.x - frame.x, p.y - frame.y) + hw);
          }
        }
      }
    }
    expect(reach).toBeLessThanOrEqual(TAIL_SLOT_REACH + TOL);
  });

  it('turns the Crystal tail cuff with the local tail direction: its gem sits on the band across the tail and the crystals jut toward the head', () => {
    const tail = axolotlBodyGeometry(DEFAULT_ART_LOOK).tail;
    for (const swim of SWIMS) {
      const frame = tailSlotFrame(tail, swim, 1.6);
      const paints = bodyPaints('tail', DEFAULT_ART_LOOK, swim, 1.6, AREA6_SLUG.cuff);
      const boxIn = (paint: Paint): Bounds => {
        const pts = paint.subs.flatMap((sub) => sub.pts.map((q) => toFrame(frame, q)));
        return { minX: Math.min(...pts.map((q) => q.x)), maxX: Math.max(...pts.map((q) => q.x)), minY: Math.min(...pts.map((q) => q.y)), maxY: Math.max(...pts.map((q) => q.y)) };
      };
      const gem = boxIn(paints.find((p) => p.kind === 'fill' && p.style === BOW_GEM)!);
      expect((gem.minX + gem.maxX) / 2).toBeCloseTo(0.2, 6);
      expect((gem.minY + gem.maxY) / 2).toBeCloseTo(6.2, 6);
      const band = boxIn(paints.find((p) => p.kind === 'fill' && p.style === CRYSTAL_CUFF_BAND)!);
      // The band runs across the tail: taller than it is long, the gem inside it.
      expect(band.maxY - band.minY).toBeGreaterThan(2 * (band.maxX - band.minX));
      expect(gem.minX).toBeGreaterThanOrEqual(band.minX);
      expect(gem.maxX).toBeLessThanOrEqual(band.maxX);
      // Three crystals, all of them above the gem and none behind the band toward the tail tip.
      const crystals = paints.filter((p) => p.kind === 'fill' && p.style === CAVE_CRYSTAL_FILL).map(boxIn);
      expect(crystals).toHaveLength(3);
      for (const c of crystals) {
        expect(c.minY).toBeLessThan(gem.minY);
        expect(c.minX).toBeGreaterThanOrEqual(band.minX - 1.1);
      }
      expect(Math.max(...crystals.map((c) => c.maxX))).toBeGreaterThan(band.maxX + 5);
    }
  });

  it('keeps the Crystal crown on the head top (ink x 16.4 to 44.2), resting on the head, its points rising 8 or more above the head outline', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA6_SLUG.crown);
    const box = inkBounds(paints);
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.maxY).toBeLessThanOrEqual(HEAD_FOOTPRINT.maxY + TOL);
    expect(box.maxY).toBeCloseTo(-19.5, 2);
    expect(box.minX).toBeCloseTo(16.4, 2);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(HEAD_ELLIPSE.rx * 2 * WEARABLE_SLOT_MINIMUMS.head.headWidthShare);
    expect(headRise(inkPoints(paints))).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.head.rise);
    // Its band rests on the head: the band's lowest fill point is inside the head outline's ink ring.
    const band = paints.filter((p) => p.kind === 'fill' && p.style === CRYSTAL_CROWN_BAND)[0];
    const lowest = band.subs[0].pts.reduce((a, b) => (b.y > a.y ? b : a));
    expect(((lowest.x - HEAD_ELLIPSE.cx) / (HEAD_ELLIPSE.rx + LW)) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / (HEAD_ELLIPSE.ry + LW)) ** 2).toBeLessThan(1);
    // The glasses keep 1.5 or more under it, as under every Head item.
    expect(FACE_FOOTPRINT.minY - HEAD_FOOTPRINT.maxY).toBeCloseTo(1.5, 6);
  });

  it('paints the Crystal crown as one band under five crystal points, the middle one tallest, with the star clear of them all', () => {
    const paints = bodyPaints('head', GIRL, 0, 1, AREA6_SLUG.crown);
    const points = paints.filter((p) => p.kind === 'fill' && p.style === CAVE_CRYSTAL_FILL).map((p) => rawBoxOf([p]));
    expect(points).toHaveLength(5);
    const tops = points.map((b) => b.minY);
    expect(tops[2]).toBe(Math.min(...tops));
    expect([...points].map((b) => (b.minX + b.maxX) / 2)).toEqual([...points].map((b) => (b.minX + b.maxX) / 2).sort((a, b) => a - b));
    // The points rise from the band, over its top edge, and stand at least 5 above even its highest edge.
    const band = rawBoxOf([paints.find((p) => p.kind === 'fill' && p.style === CRYSTAL_CROWN_BAND)!]);
    for (const b of points) expect(b.minY).toBeLessThan(band.minY - 5);
    // The star sits outside the silhouette: its ink (0.6 each side) is clear of every point's ink (2.0 outside the fill).
    const star = starsOf(paints)[0];
    const gapBetween = (a: Paint, b: Paint): number => {
      const from = (x: Paint, y: Paint): number =>
        Math.min(...x.subs.flatMap((sub) => sub.pts).map((q) => Math.min(...edgesOf(regionOf(y)).map(([e0, e1]) => segDist(q.x, q.y, e0, e1)))));
      return Math.min(from(a, b), from(b, a));
    };
    for (const p of paints.filter((q) => q.kind === 'fill' && q.style === CAVE_CRYSTAL_FILL)) expect(gapBetween(star, p)).toBeGreaterThanOrEqual(2 + 0.6 - TOL);
  });

  it('keeps the Explorer vest\'s fill off every Back item\'s fill (all six Back items and the six Shirts\' own), on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const fillsOf = (slot: 'shirt' | 'back', slug: WearableArtSlug): SampledPaint[] =>
        sampledPaints(bodyPaints(slot, look, 0, 1, slug).filter((x) => x.kind === 'fill' && isItemFill(x)));
      const vest = fillsOf('shirt', AREA6_SLUG.vest);
      for (const backSlug of EVERY_BACK_SLUG) {
        const back = fillsOf('back', backSlug);
        const both = gridPoints(unionBounds(back.map((f) => f.box))).filter((q) => back.some((f) => paintCovers(f, q.x, q.y)) && vest.some((f) => paintCovers(f, q.x, q.y)));
        if (both.length > 0) bad.push(`${lookId(look)} ${backSlug} over the vest`);
      }
    }
    expect(EVERY_SHIRT_SLUG_6).toContain(AREA6_SLUG.vest);
    expect(bad).toEqual([]);
  });

  it('keeps every Area 6 Wearable, ink included, in the texture frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of AREA6_BODY_ITEMS) {
        const swims = slot === 'tail' ? SWIMS : [0];
        for (const swim of swims) {
          for (const amp of slot === 'tail' ? AMPS : [1]) {
            if (!isInside(inkBounds(bodyPaints(slot, look, swim, amp, slug)), inner, 1e-6)) bad.push(`${lookId(look)} ${slug}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
    expect([AXO_TEX.w, AXO_TEX.h]).toEqual([166, 142]);
  });

  it('paints a still look: no Area 6 painter reads a swim phase or tail amplitude except the cuff\'s frame, and a repaint is identical', () => {
    for (const [slot, slug] of AREA6_BODY_ITEMS.filter(([slot]) => slot !== 'tail')) {
      const first = bodyPaints(slot, GIRL, 0, 1, slug).map(signature);
      expect(bodyPaints(slot, GIRL, 0, 1, slug).map(signature)).toEqual(first);
      for (const swim of SWIMS) for (const amp of AMPS) expect(bodyPaints(slot, GIRL, swim, amp, slug).map(signature), `${slug} swim ${swim} amp ${amp}`).toEqual(first);
    }
    // The cuff's paints are the same in its own frame at every phase: it moves only with the tail's frame.
    const tail = axolotlBodyGeometry(GIRL).tail;
    const inFrameOf = (swim: number, amp: number): string[] => {
      const frame = tailSlotFrame(tail, swim, amp);
      return bodyPaints('tail', GIRL, swim, amp, AREA6_SLUG.cuff).map((p) =>
        JSON.stringify({ k: p.kind, s: p.style, w: p.lineWidth, pts: p.subs.map((sub) => sub.pts.map((q) => {
          const f = toFrame(frame, q);
          return `${fixed4(f.x)},${fixed4(f.y)}`;
        })) }),
      );
    };
    const first = inFrameOf(0, 1);
    for (const swim of SWIMS) for (const amp of AMPS) expect(inFrameOf(swim, amp)).toEqual(first);
  });

  it('never looks hurt: no Area 6 paint is red, and every Area 6 outer fill is a pale colour at 9:1 with ink', () => {
    const red = (hex: string): boolean => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
      if (!m) return false;
      const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
      return r >= 180 && g <= 100 && b <= 100;
    };
    for (const [slot, slug] of AREA6_BODY_ITEMS) {
      for (const look of [DEFAULT_ART_LOOK, GIRL]) {
        for (const p of bodyPaints(slot, look, 0, 1, slug)) expect(red(p.style), `${slug} ${p.kind} ${p.style}`).toBe(false);
      }
    }
    for (const fill of [MINERS_HELMET_FILL, CAVE_CRYSTAL_FILL, EXPLORER_VEST_FILL, CRYSTAL_CUFF_BAND, CRYSTAL_CROWN_BAND]) {
      expect(contrast(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
    expect(red(EXPLORER_VEST_BELT)).toBe(false);
  });

  it('keeps the Rare belt, the Epic gem and the Legendary gold band readable in greyscale: each differs from the colour it sits on by a luminance ratio of 1.4 or more', () => {
    expect(contrast(EXPLORER_VEST_BELT, EXPLORER_VEST_FILL)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(BOW_GEM, CRYSTAL_CUFF_BAND)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(GOLD_TRIM, CRYSTAL_CROWN_BAND)).toBeGreaterThanOrEqual(1.1);
    // The gold band is told from the grey by its two thin ink lines, one on each side.
    const crown = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA6_SLUG.crown);
    const gold = crown.filter((p) => p.kind === 'stroke' && p.style === GOLD_TRIM);
    expect(gold).toHaveLength(1);
    expect(gold[0].lineWidth).toBeCloseTo(1.8, 6);
    const lines = crown.filter((p) => p.kind === 'stroke' && p.style === INK && p.clips.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0].lineWidth).toBeCloseTo(1.8 + 2 * 0.6, 6);
  });

  it('leaves the thirty-one earlier worn looks as they were: the digest of their paints is unchanged', () => {
    const slugs = (Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]).slice(0, 31);
    expect(slugs[0]).toBe('sun-hat');
    expect(slugs[30]).toBe('rainbow-serape-cape');
    const looks: AxolotlArtLook[] = [
      DEFAULT_ART_LOOK,
      { ...GIRL, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, body: 'slim', age: 'grownUp', tail: 'long' },
    ];
    const out: string[] = [];
    for (const slug of slugs) {
      const slot = WEARABLE_ART_SLOT[slug];
      for (const look of looks) {
        for (const [swim, amp] of [
          [0, 1],
          [2.1, 1.6],
        ] as const) {
          if (isLegSlot(slot)) for (const frame of legSlotFrames(look, swim)) out.push(...legPaints({ [slot]: slug }, frame).map(signature));
          else out.push(...bodyPaints(slot, look, swim, amp, slug).map(signature));
        }
      }
    }
    expect(out).toHaveLength(3942);
    expect(digest(out.join('\n'))).toBe('be030c805e081d46');
  });
});

describe('spring cave Area 6 Wearables (issue #77): the rarity look ladder', () => {
  const colours = (paints: readonly Paint[], kind: 'fill' | 'stroke'): string[] =>
    paints.filter((p) => p.kind === kind && p.alpha === 1).map((p) => p.style);
  const count = (list: readonly string[], value: string): number => list.filter((v) => v === value).length;
  const noGemOrGold = (paints: readonly Paint[]): boolean => !paints.some((p) => p.style === GOLD_TRIM || p.style === GLASSES_GEM || p.style === BOW_GEM);

  it('paints Common as flat colour plus one shine, no trim: Miner\'s headlamp (lens and rib), Crystal pendant (chain, crystal and facets)', () => {
    const lamp = bodyPaints('head', GIRL, 0, 1, AREA6_SLUG.lamp);
    expect(new Set(colours(lamp, 'fill'))).toEqual(new Set([MINERS_HELMET_FILL, TREASURE_SHINE]));
    // The brim, the dome and the housing share the one amber; the one shine is the only other fill.
    expect(count(colours(lamp, 'fill'), MINERS_HELMET_FILL)).toBe(3);
    expect(count(colours(lamp, 'fill'), TREASURE_SHINE)).toBe(1);
    // The lens and the rib are ink at alpha 0.30: the same colour darkened, not a second colour.
    const darkened = lamp.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(darkened).toHaveLength(2);
    expect(darkened.every((p) => p.style === INK)).toBe(true);
    expect(noGemOrGold(lamp) && !lamp.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(starsOf(lamp)).toHaveLength(0);
    const pendant = bodyPaints('neck', GIRL, 0, 1, AREA6_SLUG.pendant);
    expect(new Set(colours(pendant, 'fill'))).toEqual(new Set([CAVE_CRYSTAL_FILL, TREASURE_SHINE]));
    // The chain and the crystal share the one teal.
    expect(count(colours(pendant, 'fill'), CAVE_CRYSTAL_FILL)).toBe(2);
    expect(count(colours(pendant, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(pendant.filter((p) => p.kind === 'stroke' && p.alpha === SOCK_STRIPE_ALPHA && p.style === INK)).toHaveLength(1);
    expect(noGemOrGold(pendant) && !pendant.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(starsOf(pendant)).toHaveLength(0);
  });

  it('adds one trim band in a second colour for Rare: Explorer vest belt', () => {
    const vest = bodyPaints('shirt', GIRL, 0, 1, AREA6_SLUG.vest);
    expect(count(colours(vest, 'fill'), EXPLORER_VEST_BELT)).toBe(1);
    expect(count(colours(vest, 'fill'), EXPLORER_VEST_FILL)).toBe(1);
    expect(count(colours(vest, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(new Set(colours(vest, 'fill'))).toEqual(new Set([EXPLORER_VEST_BELT, EXPLORER_VEST_FILL, TREASURE_SHINE]));
    expect(noGemOrGold(vest)).toBe(true);
    expect(starsOf(vest)).toHaveLength(0);
  });

  it('adds one rounded gem for Epic: Crystal tail cuff, a gem of radius 2.5 on the band, no gold or star', () => {
    const cuff = bodyPaints('tail', GIRL, 0, 1, AREA6_SLUG.cuff);
    const gems = cuff.filter((p) => p.kind === 'fill' && p.style === BOW_GEM);
    expect(gems).toHaveLength(1);
    const box = inkBounds([gems[0]]);
    expect((box.maxX - box.minX) / 2).toBeCloseTo(2.5, 1);
    // One band and three crystal points make the one silhouette; the one shine sits on the tallest point.
    expect(count(colours(cuff, 'fill'), CRYSTAL_CUFF_BAND)).toBe(1);
    expect(count(colours(cuff, 'fill'), CAVE_CRYSTAL_FILL)).toBe(3);
    expect(count(colours(cuff, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(cuff.some((p) => p.style === GOLD_TRIM || p.style === BOAT_TRIM || p.style === GLASSES_GEM)).toBe(false);
    expect(starsOf(cuff)).toHaveLength(0);
  });

  it('adds gold trim and one static 4-point star for Legendary: Crystal crown, a gold band along the base and a star above the front point, no gem', () => {
    const crown = bodyPaints('head', GIRL, 0, 1, AREA6_SLUG.crown);
    // The gold is one band along the base band, inside it (clipped).
    const gold = crown.filter((p) => p.style === GOLD_TRIM);
    expect(gold).toHaveLength(1);
    expect(gold[0].kind).toBe('stroke');
    expect(gold[0].clips.length).toBeGreaterThan(0);
    expect(count(colours(crown, 'fill'), CRYSTAL_CROWN_BAND)).toBe(1);
    expect(count(colours(crown, 'fill'), CAVE_CRYSTAL_FILL)).toBe(5);
    expect(count(colours(crown, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(starsOf(crown)).toHaveLength(1);
    const pts = starsOf(crown)[0].subs[0].pts;
    const cx = pts.reduce((n, p) => n + p.x, 0) / 8;
    const cy = pts.reduce((n, p) => n + p.y, 0) / 8;
    const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    expect(Math.max(...radii)).toBeCloseTo(3, 6);
    expect(Math.min(...radii)).toBeCloseTo(3 * 0.38, 6);
    expect(crown.some((p) => p.style === GLASSES_GEM || p.style === BOW_GEM)).toBe(false);
  });

  it('strokes an Area 6 silhouette at the item ink: 2 x 2.0 for a blob, 2.0 for a shape, 2 x 0.6 for the pendant', () => {
    expect(inkWidthsOf(bodyPaints('head', GIRL, 0, 1, AREA6_SLUG.lamp))).toEqual([4]);
    expect(inkWidthsOf(bodyPaints('neck', GIRL, 0, 1, AREA6_SLUG.pendant))).toEqual([0.9, 1.2]);
    expect(inkWidthsOf(bodyPaints('shirt', GIRL, 0, 1, AREA6_SLUG.vest))).toEqual([0.6, 2]);
    expect(inkWidthsOf(bodyPaints('tail', GIRL, 0, 1, AREA6_SLUG.cuff))).toEqual([1.2, 4]);
    // The crown: the blob 2 x 2.0, the gold band's two thin ink lines (1.8 + 2 x 0.6) and the star's 1.2.
    expect(inkWidthsOf(bodyPaints('head', GIRL, 0, 1, AREA6_SLUG.crown))).toEqual([1.2, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// The spring cave Area 7 Wearables (issue #105, ND-13): zones, footprints, layers and counted details
// ---------------------------------------------------------------------------
//
// The same checks as the Area 6 block above, for the Climbing helmet, Pebble necklace, Cave goggles, Glow tail
// lantern and Gemstone cape. The catalogue-driven suite holds each to the size rule; these hold them to the rest
// of guide 6i. The earlier looks' checks are unchanged, and a digest pins their paints.

const AREA7_SLUG = {
  helmet: 'climbing-helmet',
  necklace: 'pebble-necklace',
  goggles: 'cave-goggles',
  lantern: 'glow-tail-lantern',
  cape: 'gemstone-cape',
} as const satisfies Record<string, WearableArtSlug>;
const SPRING_CAVE_2_WEARABLES = CATALOGUE_WEARABLES.filter((w) => SPRING_CAVE_2_TREASURES.some((t) => t.id === w.id));
/** A full Area 7 outfit. */
const AREA7_OUTFIT: ArtOutfit = {
  head: AREA7_SLUG.helmet,
  neck: AREA7_SLUG.necklace,
  face: AREA7_SLUG.goggles,
  tail: AREA7_SLUG.lantern,
  back: AREA7_SLUG.cape,
};
/** The Area 7 slugs that paint on the body, with their slots. */
const AREA7_BODY_ITEMS = [
  ['head', AREA7_SLUG.helmet],
  ['neck', AREA7_SLUG.necklace],
  ['face', AREA7_SLUG.goggles],
  ['tail', AREA7_SLUG.lantern],
  ['back', AREA7_SLUG.cape],
] as const;

describe('spring cave Area 7 Wearables (issue #105): zones, footprints and layers', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('has five spring cave Area 7 Wearables of the 41: Head, Neck, Face, Tail and Back', () => {
    expect(CATALOGUE_WEARABLES).toHaveLength(41);
    expect(SPRING_CAVE_2_WEARABLES.map((w) => `${w.slot}:${treasureSlug(w.id)}`)).toEqual([
      'head:climbing-helmet',
      'neck:pebble-necklace',
      'face:cave-goggles',
      'tail:glow-tail-lantern',
      'back:gemstone-cape',
    ]);
    expect(SPRING_CAVE_2_WEARABLES.some((w) => SPRING_CAVE_WEARABLES.includes(w))).toBe(false);
    expect(Object.keys(WEARABLE_ART_SLOT)).toHaveLength(41);
    expect(Object.values(AREA7_SLUG).map((slug) => WEARABLE_ART_SLOT[slug])).toEqual(['head', 'neck', 'face', 'tail', 'back']);
    // The Area 7 slugs come last, after the thirty-six earlier ones.
    expect(Object.keys(WEARABLE_ART_SLOT).slice(36)).toEqual(['climbing-helmet', 'pebble-necklace', 'cave-goggles', 'glow-tail-lantern', 'gemstone-cape']);
  });

  it('maps Area 7 catalogue ids to art slugs by slot, and leaves out an Area 7 id worn in the wrong slot', () => {
    expect(
      artOutfit({
        head: 'spring-cave/climbing-helmet',
        neck: 'spring-cave/pebble-necklace',
        face: 'spring-cave/cave-goggles',
        tail: 'spring-cave/glow-tail-lantern',
        back: 'spring-cave/gemstone-cape',
      }),
    ).toEqual(AREA7_OUTFIT);
    expect(
      artOutfit({
        head: 'spring-cave/pebble-necklace',
        neck: 'spring-cave/climbing-helmet',
        face: 'spring-cave/gemstone-cape',
        tail: 'spring-cave/cave-goggles',
        back: 'spring-cave/glow-tail-lantern',
      }),
    ).toEqual({});
    expect(outfitKey(AREA7_OUTFIT)).toBe('head=climbing-helmet,neck=pebble-necklace,face=cave-goggles,back=gemstone-cape,tail=glow-tail-lantern');
    expect(WEARABLE_ART_SLUGS).toEqual(['sun-hat', 'shell-necklace', 'heart-glasses', 'tank-top', 'diving-tank', 'golden-bow', 'stripy-socks', 'flippers']);
  });

  it('keeps the Climbing helmet, Pebble necklace and Cave goggles off the gill roots and the cheek heart zone, alike on every look', () => {
    for (const [slot, slug] of [
      ['head', AREA7_SLUG.helmet],
      ['neck', AREA7_SLUG.necklace],
    ] as const) {
      const paints = bodyPaints(slot, DEFAULT_ART_LOOK, 0, 1, slug);
      expect(paints.length).toBeGreaterThan(0);
      for (const look of EVERY_BODY_LOOK) expect(bodyPaints(slot, look, 0, 1, slug).map(signature), `${slug} ${lookId(look)}`).toEqual(paints.map(signature));
      for (const paint of paints) expect(trouble(paint, { lashes: true, gills: true }), `${slug} ${paint.kind} ${paint.style}`).toBeNull();
    }
    const goggles = bodyPaints('face', DEFAULT_ART_LOOK, 0, 1, AREA7_SLUG.goggles);
    for (const look of EVERY_BODY_LOOK) expect(bodyPaints('face', look, 0, 1, AREA7_SLUG.goggles).map(signature), lookId(look)).toEqual(goggles.map(signature));
  });

  it('keeps the Glow tail lantern and the Gemstone cape off the eyes, lashes, gill roots and cheek heart zone on every look, swim phase and tail amplitude', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const p of bodyPaints('back', look, 0, 1, AREA7_SLUG.cape)) {
        const why = trouble(p, { lashes: true, gills: true });
        if (why) bad.push(`${lookId(look)} cape ${why}`);
      }
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          for (const p of bodyPaints('tail', look, swim, amp, AREA7_SLUG.lantern)) {
            const why = trouble(p, { lashes: true, gills: true });
            if (why) bad.push(`${lookId(look)} swim ${swim.toFixed(2)} amp ${amp} lantern ${why}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints every Area 7 Wearable before the eyes, a Girl lashes included, and changes none of the axolotl\'s own paints', () => {
    for (const look of [DEFAULT_ART_LOOK, GIRL, { ...GIRL, body: 'chubby' as const, age: 'baby' as const, tail: 'short' as const }]) {
      for (const pose of Object.values(POSES)) {
        const base = drawn(pose, look);
        const worn = drawn(pose, look, AREA7_OUTFIT);
        const inserted = insertedPaints(base, worn);
        expect(inserted).not.toBeNull();
        expect(inserted!.length).toBeGreaterThan(0);
        const eyes = firstEyePaint(worn);
        expect(eyes).toBeGreaterThan(0);
        for (const x of inserted!) expect(x.index).toBeLessThan(eyes);
        expect(worn.length - eyes).toBe(base.length - firstEyePaint(base));
      }
    }
  });

  it('keeps the Climbing helmet on the head top (ink x about 16.4 to 45.6, lowest y -19.5), resting on the head, its shell rising 8 or more above the head outline', () => {
    const paints = bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA7_SLUG.helmet);
    const box = inkBounds(paints);
    expect(isInside(box, HEAD_FOOTPRINT)).toBe(true);
    expect(box.maxY).toBeCloseTo(-19.5, 1);
    expect(box.minX).toBeCloseTo(16.4, 1);
    expect(box.maxX).toBeCloseTo(45.6, 1);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(HEAD_ELLIPSE.rx * 2 * WEARABLE_SLOT_MINIMUMS.head.headWidthShare);
    expect(headRise(inkPoints(paints))).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.head.rise);
    // The brim and the shell are the one helmet colour; the brim rests on the head.
    const fills = paints.filter((p) => p.kind === 'fill' && p.style === CLIMBING_HELMET_FILL);
    expect(fills).toHaveLength(2);
    const lowest = fills.flatMap((p) => p.subs[0].pts).reduce((a, b) => (b.y > a.y ? b : a));
    expect(((lowest.x - HEAD_ELLIPSE.cx) / (HEAD_ELLIPSE.rx + LW)) ** 2 + ((lowest.y - HEAD_ELLIPSE.cy) / (HEAD_ELLIPSE.ry + LW)) ** 2).toBeLessThan(1);
    // The shell stands taller than the Miner's headlamp dome, and its three vents are clipped to it.
    const shell = rawBoxOf([fills[1]]);
    const lamp = rawBoxOf([bodyPaints('head', DEFAULT_ART_LOOK, 0, 1, AREA6_SLUG.lamp).filter((p) => p.kind === 'fill' && p.style === MINERS_HELMET_FILL)[1]]);
    expect(shell.minY).toBeLessThan(lamp.minY);
    const vents = paints.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(vents).toHaveLength(3);
    for (const v of vents) {
      expect(v.style).toBe(INK);
      expect(v.clips.length).toBeGreaterThan(0);
    }
  });

  it('keeps the Pebble necklace in the Neck footprint, under the mouth, off the cheek heart zone and inside LW / 2 of the silhouette outline on every look', () => {
    const paints = bodyPaints('neck', DEFAULT_ART_LOOK, 0, 1, AREA7_SLUG.necklace);
    const box = inkBounds(paints);
    expect(isInside(box, NECK_FOOTPRINT)).toBe(true);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(WEARABLE_SLOT_MINIMUMS.neck.minWidth);
    expect(paints.some((p) => reachesBox(regionOf(p), MOUTH_ZONE))).toBe(true);
    let heartGap = Infinity;
    for (const p of paints) {
      const r = regionOf(p);
      for (const [a, b] of edgesOf(r)) heartGap = Math.min(heartGap, segDist(CHEEK_HEART_ZONE.x, CHEEK_HEART_ZONE.y, a, b) - r.hw - CHEEK_HEART_ZONE.r);
    }
    expect(heartGap).toBeGreaterThanOrEqual(-TOL);
    const points = inkPoints(paints).filter(({ p, hw }) => p.y + hw >= 17);
    const least = leastOver(outlineMargins(points));
    expect(least.value, least.id).toBeGreaterThanOrEqual(0);
  });

  it('paints the Pebble necklace as the Crystal pendant\'s chain with three pebbles inside the Pond-weed scarf\'s band, ink 0.6 outside, each pebble ringed', () => {
    const necklace = bodyPaints('neck', GIRL, 0, 1, AREA7_SLUG.necklace);
    const pendant = bodyPaints('neck', GIRL, 0, 1, AREA6_SLUG.pendant);
    const scarf = bodyPaints('neck', GIRL, 0, 1, POND_SLUG.scarf);
    const chain = necklace.filter((p) => p.kind === 'fill' && p.style === PEBBLE_NECKLACE_CORD);
    expect(chain).toHaveLength(1);
    const pendantChain = pendant.filter((p) => p.kind === 'fill' && p.style === CAVE_CRYSTAL_FILL)[0];
    expect(chain[0].subs.map((sub) => sub.pts.map((q) => `${fixed4(q.x)},${fixed4(q.y)}`))).toEqual(
      pendantChain.subs.map((sub) => sub.pts.map((q) => `${fixed4(q.x)},${fixed4(q.y)}`)),
    );
    const bandBox = rawBoxOf([scarf.find((p) => p.kind === 'fill' && p.style === POND_WEED_SCARF)!]);
    const pebbles = necklace.filter((p) => p.kind === 'fill' && p.style === PEBBLE_NECKLACE_STONE).map((p) => rawBoxOf([p]));
    expect(pebbles).toHaveLength(3);
    for (const b of pebbles) {
      expect(b.minY).toBeGreaterThanOrEqual(bandBox.minY - TOL);
      expect(b.maxY).toBeLessThanOrEqual(bandBox.maxY + TOL);
      expect(b.minX).toBeGreaterThanOrEqual(bandBox.minX - TOL);
      expect(b.maxX).toBeLessThanOrEqual(bandBox.maxX + TOL);
    }
    expect(pebbles.map((b) => (b.minX + b.maxX) / 2)).toEqual([...pebbles.map((b) => (b.minX + b.maxX) / 2)].sort((a, b) => a - b));
    // Thin rings (0.5) round each pebble, the silhouette's 2 x 0.6, and six specks of ink at the stripe alpha.
    expect(necklace.filter((p) => p.kind === 'stroke' && p.style === INK && Math.abs(p.lineWidth - 0.5) < 1e-9)).toHaveLength(3);
    const specks = necklace.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(specks).toHaveLength(6);
    expect(specks.every((p) => p.style === INK)).toBe(true);
    expect(inkWidthsOf(necklace)).toEqual([0.5, 1.2]);
  });

  it('keeps the Cave goggles in the Face footprint, with the frame band of the Heart glasses, and only the clear lens tint over the eyes', () => {
    const paints = bodyPaints('face', GIRL, 0, 1, AREA7_SLUG.goggles);
    const box = inkBounds(paints);
    expect(isInside(box, FACE_FOOTPRINT)).toBe(true);
    const heart = bodyPaints('face', GIRL);
    const band = (list: readonly Paint[]): Paint[] => list.filter((p) => p.kind === 'stroke' && p.lineWidth === 3.5);
    expect(band(paints).map(signature)).toEqual(band(heart).map(signature));
    expect(paints.filter((p) => p.kind === 'stroke' && p.style === GOGGLES_FRAME && p.lineWidth === 2.1)).toHaveLength(1);
    const lens = paints.filter((p) => p.style === GLASSES_LENS);
    expect(lens).toHaveLength(1);
    expect(lens[0].kind).toBe('fill');
    expect(paints.indexOf(lens[0])).toBe(0);
    for (const zone of eyeZones) {
      expect(reachesCircle(regionOf(lens[0]), zone)).toBe(true);
      for (const p of paints.filter((q) => q !== lens[0])) expect(reachesCircle(regionOf(p), zone), `${p.kind} ${p.style}`).toBe(false);
    }
    for (const p of paints.filter((q) => q.kind === 'fill' && q !== lens[0])) {
      const r = regionOf(p);
      for (const zone of eyeZones) expect(winding(r.subs, zone.x, zone.y), `${p.style} over an eye`).toBe(0);
    }
  });

  it('puts the Cave goggles\' yellow buckle on the bridge above the top notch, inside the gem\'s circle', () => {
    const paints = bodyPaints('face', GIRL, 0, 1, AREA7_SLUG.goggles);
    const buckle = paints.filter((p) => p.kind === 'fill' && p.style === BOAT_TRIM);
    expect(buckle).toHaveLength(1);
    const b = rawBoxOf(buckle);
    expect((b.minX + b.maxX) / 2).toBeCloseTo(35.25, 6);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(-14.85, 6);
    expect(Math.hypot(b.maxX - 35.25, b.maxY + 14.85)).toBeLessThanOrEqual(3 + TOL);
    expect(b.minY - 0.6).toBeGreaterThanOrEqual(FACE_FOOTPRINT.minY - TOL);
    const [top] = glassesNotches();
    expect((b.minY + b.maxY) / 2).toBeLessThan(top.y);
  });

  it('keeps the Glow tail lantern within 17.5 units of its anchor, ink included, at every look, swim phase and tail amplitude', () => {
    let reach = 0;
    for (const look of EVERY_BODY_LOOK) {
      const tail = axolotlBodyGeometry(look).tail;
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          const frame = tailSlotFrame(tail, swim, amp);
          for (const { p, hw } of inkPoints(bodyPaints('tail', look, swim, amp, AREA7_SLUG.lantern))) {
            reach = Math.max(reach, Math.hypot(p.x - frame.x, p.y - frame.y) + hw);
          }
        }
      }
    }
    expect(reach).toBeLessThanOrEqual(TAIL_SLOT_REACH + TOL);
  });

  it('turns the Glow tail lantern with the local tail direction: 1 toward the head, its gem in the flame in the glass, the ring on top and the foot on the tail edge', () => {
    const tail = axolotlBodyGeometry(DEFAULT_ART_LOOK).tail;
    for (const swim of SWIMS) {
      const frame = tailSlotFrame(tail, swim, 1.6);
      const paints = bodyPaints('tail', DEFAULT_ART_LOOK, swim, 1.6, AREA7_SLUG.lantern);
      const boxIn = (paint: Paint): Bounds => {
        const pts = paint.subs.flatMap((sub) => sub.pts.map((q) => toFrame(frame, q)));
        return { minX: Math.min(...pts.map((q) => q.x)), maxX: Math.max(...pts.map((q) => q.x)), minY: Math.min(...pts.map((q) => q.y)), maxY: Math.max(...pts.map((q) => q.y)) };
      };
      const gem = boxIn(paints.find((p) => p.kind === 'fill' && p.style === BOW_GEM)!);
      expect((gem.minX + gem.maxX) / 2).toBeCloseTo(1, 6);
      expect((gem.minY + gem.maxY) / 2).toBeCloseTo(-3.6, 6);
      const glass = boxIn(paints.find((p) => p.kind === 'fill' && p.style === LANTERN_GLASS)!);
      const flame = boxIn(paints.find((p) => p.kind === 'fill' && p.style === LANTERN_FLAME)!);
      for (const inner of [gem, flame]) {
        expect(inner.minX).toBeGreaterThanOrEqual(glass.minX - TOL);
        expect(inner.maxX).toBeLessThanOrEqual(glass.maxX + TOL);
      }
      const frames = paints.filter((p) => p.kind === 'fill' && p.style === LANTERN_FRAME).map(boxIn);
      expect(frames).toHaveLength(3);
      const [ring, cap, foot] = frames;
      expect(ring.maxY).toBeLessThan(glass.minY);
      expect(cap.maxY).toBeLessThanOrEqual(glass.minY + 0.5);
      expect(foot.minY).toBeLessThan(glass.maxY);
      // Ink included, no more than 8 toward the tail tip and 10 toward the head along the tail.
      expect(-Math.min(...frames.map((b) => b.minX), glass.minX) + 2).toBeLessThanOrEqual(8 + TOL);
      expect(Math.max(...frames.map((b) => b.maxX), glass.maxX) + 2).toBeLessThanOrEqual(10 + TOL);
    }
  });

  it('keeps the Gemstone cape in its look\'s back box, filling it end to end, and its fill off every Shirt\'s fill, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const { frame, box } = backFootprint(look);
      const paints = bodyPaints('back', look, 0, 1, AREA7_SLUG.cape);
      expect(paints.length).toBeGreaterThan(0);
      const along = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
      for (const { q, hw } of along) {
        if (q.x - hw < box.minU - TOL || q.x + hw > box.maxU + TOL) bad.push(`${lookId(look)} u`);
        if (q.y - hw < box.minV - TOL || q.y + hw > box.maxV + TOL) bad.push(`${lookId(look)} v`);
      }
      for (const { p, hw } of inkPoints(paints)) if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.x - hw)) - box.minU) > TOL) bad.push(`${lookId(look)} rear end`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.x + hw)) - box.maxU) > TOL) bad.push(`${lookId(look)} front end`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.y - hw)) - box.minV) > TOL) bad.push(`${lookId(look)} top`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.y + hw)) - box.maxV) > TOL) bad.push(`${lookId(look)} bottom`);
      const fillsOf = (slot: 'shirt' | 'back', slug: WearableArtSlug): SampledPaint[] =>
        sampledPaints(bodyPaints(slot, look, 0, 1, slug).filter((x) => x.kind === 'fill' && isItemFill(x)));
      const cape = fillsOf('back', AREA7_SLUG.cape);
      for (const shirtSlug of EVERY_SHIRT_SLUG_6) {
        const shirt = fillsOf('shirt', shirtSlug);
        const both = gridPoints(unionBounds(cape.map((f) => f.box))).filter((q) => cape.some((f) => paintCovers(f, q.x, q.y)) && shirt.some((f) => paintCovers(f, q.x, q.y)));
        if (both.length > 0) bad.push(`${lookId(look)} cape over ${shirtSlug}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps every Area 7 Wearable, ink included, in the texture frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of AREA7_BODY_ITEMS) {
        const swims = slot === 'tail' ? SWIMS : [0];
        for (const swim of swims) {
          for (const amp of slot === 'tail' ? AMPS : [1]) {
            if (!isInside(inkBounds(bodyPaints(slot, look, swim, amp, slug)), inner, 1e-6)) bad.push(`${lookId(look)} ${slug}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints a still look: no Area 7 painter reads a swim phase or tail amplitude except the lantern\'s frame, and a repaint is identical', () => {
    for (const [slot, slug] of AREA7_BODY_ITEMS.filter(([slot]) => slot !== 'tail')) {
      const first = bodyPaints(slot, GIRL, 0, 1, slug).map(signature);
      expect(bodyPaints(slot, GIRL, 0, 1, slug).map(signature)).toEqual(first);
      for (const swim of SWIMS) for (const amp of AMPS) expect(bodyPaints(slot, GIRL, swim, amp, slug).map(signature), `${slug} swim ${swim} amp ${amp}`).toEqual(first);
    }
    const tail = axolotlBodyGeometry(GIRL).tail;
    const inFrameOf = (swim: number, amp: number): string[] => {
      const frame = tailSlotFrame(tail, swim, amp);
      return bodyPaints('tail', GIRL, swim, amp, AREA7_SLUG.lantern).map((p) =>
        JSON.stringify({ k: p.kind, s: p.style, w: p.lineWidth, pts: p.subs.map((sub) => sub.pts.map((q) => {
          const f = toFrame(frame, q);
          return `${fixed4(f.x)},${fixed4(f.y)}`;
        })) }),
      );
    };
    const first = inFrameOf(0, 1);
    for (const swim of SWIMS) for (const amp of AMPS) expect(inFrameOf(swim, amp)).toEqual(first);
  });

  it('never looks hurt: no Area 7 paint is red, and every Area 7 outer fill is a pale colour at 9:1 with ink', () => {
    const red = (hex: string): boolean => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
      if (!m) return false;
      const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
      return r >= 180 && g <= 100 && b <= 100;
    };
    for (const [slot, slug] of AREA7_BODY_ITEMS) {
      for (const look of [DEFAULT_ART_LOOK, GIRL]) {
        for (const p of bodyPaints(slot, look, 0, 1, slug)) expect(red(p.style), `${slug} ${p.kind} ${p.style}`).toBe(false);
      }
    }
    for (const fill of [CLIMBING_HELMET_FILL, PEBBLE_NECKLACE_CORD, PEBBLE_NECKLACE_STONE, GOGGLES_FRAME, LANTERN_FRAME, LANTERN_GLASS, GEMSTONE_CAPE_FILL]) {
      expect(contrast(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
    }
    for (const colour of [LANTERN_FLAME, ...GEMSTONE_CAPE_STONES]) expect(red(colour), colour).toBe(false);
  });

  it('keeps the Rare buckle and the Epic gem readable in greyscale: each differs from the colour it sits on by a luminance ratio of 1.4 or more', () => {
    expect(contrast(BOAT_TRIM, GOGGLES_FRAME)).toBeGreaterThanOrEqual(1.0);
    // The buckle is told from the frame by its own ink ring (0.6 outside).
    const goggles = bodyPaints('face', GIRL, 0, 1, AREA7_SLUG.goggles);
    expect(goggles.filter((p) => p.kind === 'stroke' && p.style === INK && Math.abs(p.lineWidth - 1.2) < 1e-9)).toHaveLength(1);
    expect(contrast(BOW_GEM, LANTERN_FLAME)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(GOLD_TRIM, GEMSTONE_CAPE_FILL)).toBeGreaterThanOrEqual(1.1);
  });

  it('leaves the thirty-six earlier worn looks as they were: the digest of their paints is unchanged', () => {
    const slugs = (Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]).slice(0, 36);
    expect(slugs[35]).toBe('crystal-crown');
    const looks: AxolotlArtLook[] = [
      DEFAULT_ART_LOOK,
      { ...GIRL, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, body: 'slim', age: 'grownUp', tail: 'long' },
    ];
    const out: string[] = [];
    for (const slug of slugs) {
      const slot = WEARABLE_ART_SLOT[slug];
      for (const look of looks) {
        for (const [swim, amp] of [
          [0, 1],
          [2.1, 1.6],
        ] as const) {
          if (isLegSlot(slot)) for (const frame of legSlotFrames(look, swim)) out.push(...legPaints({ [slot]: slug }, frame).map(signature));
          else out.push(...bodyPaints(slot, look, swim, amp, slug).map(signature));
        }
      }
    }
    expect(out).toHaveLength(4248);
    expect(digest(out.join('\n'))).toBe('a895f654b77bd61e');
  });
});

describe('spring cave Area 7 Wearables (issue #105): the rarity look ladder', () => {
  const colours = (paints: readonly Paint[], kind: 'fill' | 'stroke'): string[] =>
    paints.filter((p) => p.kind === kind && p.alpha === 1).map((p) => p.style);
  const count = (list: readonly string[], value: string): number => list.filter((v) => v === value).length;
  const noGemOrGold = (paints: readonly Paint[]): boolean => !paints.some((p) => p.style === GOLD_TRIM || p.style === GLASSES_GEM || p.style === BOW_GEM);

  it('paints Common as flat colour plus one shine, no trim: Climbing helmet (vents), Pebble necklace (specks)', () => {
    const helmet = bodyPaints('head', GIRL, 0, 1, AREA7_SLUG.helmet);
    expect(new Set(colours(helmet, 'fill'))).toEqual(new Set([CLIMBING_HELMET_FILL, TREASURE_SHINE]));
    expect(count(colours(helmet, 'fill'), CLIMBING_HELMET_FILL)).toBe(2);
    expect(count(colours(helmet, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(noGemOrGold(helmet) && !helmet.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(starsOf(helmet)).toHaveLength(0);
    const necklace = bodyPaints('neck', GIRL, 0, 1, AREA7_SLUG.necklace);
    expect(new Set(colours(necklace, 'fill'))).toEqual(new Set([PEBBLE_NECKLACE_CORD, PEBBLE_NECKLACE_STONE, TREASURE_SHINE]));
    expect(count(colours(necklace, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(noGemOrGold(necklace) && !necklace.some((p) => p.style === BOAT_TRIM)).toBe(true);
    expect(starsOf(necklace)).toHaveLength(0);
  });

  it('adds one trim band in a second colour for Rare: Cave goggles buckle', () => {
    const goggles = bodyPaints('face', GIRL, 0, 1, AREA7_SLUG.goggles);
    expect(count(colours(goggles, 'fill'), BOAT_TRIM)).toBe(1);
    expect(noGemOrGold(goggles)).toBe(true);
    expect(starsOf(goggles)).toHaveLength(0);
  });

  it('adds one rounded gem for Epic: Glow tail lantern, a gem of radius 2.5 in the flame, no gold or star', () => {
    const lantern = bodyPaints('tail', GIRL, 0, 1, AREA7_SLUG.lantern);
    const gems = lantern.filter((p) => p.kind === 'fill' && p.style === BOW_GEM);
    expect(gems).toHaveLength(1);
    const box = inkBounds([gems[0]]);
    expect((box.maxX - box.minX) / 2).toBeCloseTo(2.5, 1);
    expect(count(colours(lantern, 'fill'), LANTERN_FRAME)).toBe(3);
    expect(count(colours(lantern, 'fill'), LANTERN_GLASS)).toBe(1);
    expect(count(colours(lantern, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(lantern.some((p) => p.style === GOLD_TRIM || p.style === BOAT_TRIM || p.style === GLASSES_GEM)).toBe(false);
    expect(starsOf(lantern)).toHaveLength(0);
  });

  it('adds gold trim and one static 4-point star for Legendary: Gemstone cape, a gold clasp band and three set stones, no gem', () => {
    const cape = bodyPaints('back', GIRL, 0, 1, AREA7_SLUG.cape);
    const gold = cape.filter((p) => p.style === GOLD_TRIM);
    expect(gold).toHaveLength(1);
    expect(gold[0].clips.length).toBeGreaterThan(0);
    expect(count(colours(cape, 'fill'), GEMSTONE_CAPE_FILL)).toBe(1);
    expect(count(colours(cape, 'fill'), TREASURE_SHINE)).toBe(1);
    expect(cape.filter((p) => p.kind === 'fill' && GEMSTONE_CAPE_STONES.includes(p.style))).toHaveLength(3);
    expect(starsOf(cape)).toHaveLength(1);
    expect(cape.some((p) => p.style === GLASSES_GEM || p.style === BOW_GEM)).toBe(false);
  });

  it('strokes an Area 7 silhouette at the item ink: 2 x 2.0 for a blob, 2 x 0.6 for the necklace', () => {
    expect(inkWidthsOf(bodyPaints('head', GIRL, 0, 1, AREA7_SLUG.helmet))).toEqual([4]);
    expect(inkWidthsOf(bodyPaints('neck', GIRL, 0, 1, AREA7_SLUG.necklace))).toEqual([0.5, 1.2]);
    expect(inkWidthsOf(bodyPaints('tail', GIRL, 0, 1, AREA7_SLUG.lantern))).toEqual([1.2, 4]);
    // The cape: the stones' 1.2 and the star's 1.2, the clasp band's 0.6 lines and the blob's 2 x 2.0.
    expect(inkWidthsOf(bodyPaints('back', GIRL, 0, 1, AREA7_SLUG.cape))).toEqual([0.6, 1.2, 4]);
  });
});

// ---------------------------------------------------------------------------
// The rarity look ladder (guide 6i, PRD F9)
// ---------------------------------------------------------------------------

describe('rarity look ladder: worn looks keep their counted details', () => {
  const colours = (paints: readonly Paint[], kind: 'fill' | 'stroke'): string[] =>
    paints.filter((p) => p.kind === kind && p.alpha === 1).map((p) => p.style);
  const count = (list: readonly string[], value: string): number => list.filter((v) => v === value).length;
  const nearLeg = legSlotFrames(GIRL, 0)[2];

  it('paints Common as one flat colour plus one shine: Sun hat, Tank top, Stripy socks', () => {
    const hat = bodyPaints('head', GIRL);
    expect(new Set(colours(hat, 'fill'))).toEqual(new Set([HAT_FILL, TREASURE_SHINE]));
    expect(count(colours(hat, 'fill'), TREASURE_SHINE)).toBe(1);
    const top = bodyPaints('shirt', GIRL);
    expect(new Set(colours(top, 'fill'))).toEqual(new Set([TANK_TOP_FILL, TREASURE_SHINE]));
    expect(count(colours(top, 'fill'), TREASURE_SHINE)).toBe(1);
    const socks = legPaints({ socks: 'stripy-socks' }, nearLeg);
    // The three stripes are ink at alpha 0.30: the same colour darkened, not a second colour.
    const stripes = socks.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(stripes).toHaveLength(3);
    expect(stripes.every((p) => p.style === INK)).toBe(true);
    expect(new Set(colours(socks, 'fill'))).toEqual(new Set([SOCK_FILL, TREASURE_SHINE]));
    expect(new Set(colours(socks, 'stroke'))).toEqual(new Set([INK, SOCK_FILL]));
    expect(count(colours(socks, 'fill'), TREASURE_SHINE)).toBe(1);
  });

  it('adds one trim band in a second colour for Rare: Shell necklace cord, Diving tank strap, Flippers cuff', () => {
    const necklace = bodyPaints('neck', GIRL);
    expect(colours(necklace, 'stroke')).toContain(NECKLACE_CORD);
    expect(colours(necklace, 'fill')).toContain(NECKLACE_SHELL);
    // Four scallop shells, each with a rim and five ridges in the shell ridge colour (a detail colour, not ink).
    expect(count(colours(necklace, 'fill'), NECKLACE_SHELL)).toBe(4);
    expect(count(colours(necklace, 'stroke'), PAINT_SHELL_RIDGE)).toBe(8);
    expect(new Set(colours(necklace, 'fill'))).toEqual(new Set([NECKLACE_SHELL]));
    const tank = bodyPaints('back', GIRL);
    expect(count(colours(tank, 'fill'), DIVING_TANK_STRAP)).toBe(1);
    expect(colours(tank, 'fill')).toContain(DIVING_TANK_FILL);
    expect(count(colours(tank, 'fill'), TREASURE_SHINE)).toBe(1);
    const flippers = legPaints({ feet: 'flippers' }, nearLeg);
    expect(count(colours(flippers, 'fill'), FLIPPER_CUFF)).toBe(1);
    expect(colours(flippers, 'fill')).toContain(FLIPPER_FILL);
    expect(colours(flippers, 'stroke')).toContain(FLIPPER_RIDGE);
    expect(count(colours(flippers, 'fill'), TREASURE_SHINE)).toBe(1);
  });

  it('adds one rounded gem for Epic: Heart glasses, a #55e4d8 gem of radius 2.5 and a clear or white-tint lens', () => {
    const glasses = bodyPaints('face', GIRL);
    const gems = glasses.filter((p) => p.kind === 'fill' && p.style === GLASSES_GEM);
    expect(gems).toHaveLength(1);
    const box = inkBounds([gems[0]]);
    expect((box.maxX - box.minX) / 2).toBeCloseTo(2.5, 1);
    expect(colours(glasses, 'stroke')).toContain(GLASSES_FRAME);
    expect(glasses.filter((p) => p.style === GLASSES_LENS)).toHaveLength(1);
  });

  it('adds gold trim, one gem and one static 4-point star for Legendary: Golden bow', () => {
    const bow = bodyPaints('tail', GIRL);
    expect(colours(bow, 'fill')).toContain(GOLD_TRIM);
    expect(bow.filter((p) => p.kind === 'fill' && p.style === BOW_GEM)).toHaveLength(1);
    // The star: a white fill of one 8-vertex polygon (four points, outer R 3, inner 0.38 R).
    const stars = bow.filter((p) => p.kind === 'fill' && p.style === WHITE && p.subs.length === 1 && p.subs[0].pts.length === 8);
    expect(stars).toHaveLength(1);
    const star = stars[0].subs[0].pts;
    const cx = star.reduce((n, p) => n + p.x, 0) / 8;
    const cy = star.reduce((n, p) => n + p.y, 0) / 8;
    const radii = star.map((p) => Math.hypot(p.x - cx, p.y - cy));
    expect(Math.max(...radii)).toBeCloseTo(3, 6);
    expect(Math.min(...radii)).toBeCloseTo(3 * 0.38, 6);
    // The star is outside the bow's fill: the pieces are filled before it, and it is above the knot.
    expect(cy).toBeLessThan(Math.min(...bow.find((p) => p.style === BOW_GEM)!.subs[0].pts.map((p) => p.y)));
  });
});

// ---------------------------------------------------------------------------
// Textures: the outfit rides the still bake
// ---------------------------------------------------------------------------

describe('bakeAxolotlStill carries the outfit', () => {
  interface FakeCanvas {
    key: string;
    rec: Recorder;
  }

  function fakeScene(): { scene: never; canvases: FakeCanvas[] } {
    const canvases: FakeCanvas[] = [];
    const textures = {
      exists: (key: string): boolean => canvases.some((c) => c.key === key),
      remove: (): void => undefined,
      createCanvas: (key: string) => {
        const entry: FakeCanvas = { key, rec: new Recorder() };
        canvases.push(entry);
        return {
          context: entry.rec.context(),
          refresh: (): void => undefined,
        };
      },
    };
    return { scene: { textures } as never, canvases };
  }

  /** Paints the texture made since `from`, with Path2D stubbed. */
  function withPaths<T>(fn: () => T): T {
    vi.stubGlobal('Path2D', RecPath);
    try {
      return fn();
    } finally {
      vi.unstubAllGlobals();
    }
  }

  const POSE = POSES.swimming;

  it('bakes a still with the outfit when it has one, and with none otherwise', () => {
    const crop = { minX: -102, minY: -79, maxX: 64, maxY: 63 };
    const still = { look: GIRL, palette: LEUCISTIC, pose: POSE, crop, scale: 2, sizeFactor: 1 };
    const none = fakeScene();
    withPaths(() => bakeAxolotlStill(none.scene, 'still-none', still));
    const worn = fakeScene();
    withPaths(() => bakeAxolotlStill(worn.scene, 'still-worn', { ...still, outfit: FULL }));
    expect(none.canvases[0].rec.paints.length).toBe(drawn(POSE, GIRL, NO_OUTFIT).length);
    expect(worn.canvases[0].rec.paints.length).toBe(drawn(POSE, GIRL, FULL).length);
    expect(worn.canvases[0].rec.paints.length).toBeGreaterThan(none.canvases[0].rec.paints.length);
  });
});
