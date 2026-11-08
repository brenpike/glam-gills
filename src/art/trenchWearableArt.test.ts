/**
 * The open lake Area 13 worn Wearables (issue #215; guide 6a, 6i, 6q; PRD F13; ADR 0040), headless: the Turtle socks,
 * Diving goggles, Turtle shell backpack, Lantern tail charm, Mini submarine and Diving suit. The painters run against a
 * recording context and a stub Path2D, as in lakeWearableArt.test.ts: every fill and stroke is kept as flattened
 * polygons in local units with the style, width, alpha and clip it was painted under. The catalogue-driven suite in
 * wearableArt.test.ts holds each item to the size rule over every swim-view case; these hold them to the rest of guide
 * 6i (the keep-clear zones and their footprints, the Mini submarine's big Back box and the Lantern tail charm's Tail
 * reach), to a swim-view fill measure of their own, to the hero rule (the big items' rule, which the Mini submarine
 * takes as a big item and the other five are held to as well), to outlines of their own for the Turtle socks, to the
 * paint digest of every earlier worn look, and to ADR 0007 (no flashing, no weapons, no letters or numbers).
 */
import { describe, expect, it, vi } from 'vitest';
import { AXO_REST_POSE, AXO_TEX, drawAxolotl, type AxolotlPose } from './drawAxolotl';
import {
  AXO_SEXES,
  AXO_AGES,
  AXO_BODIES,
  AXO_SIZES,
  AXO_TAILS,
  BACK_BOX_MIN_V,
  CHEEK_HEART_ZONE,
  DEFAULT_ART_LOOK,
  EYELASH_INK,
  EYELASH_UNDER,
  FAR_EYE_ZONE,
  FAR_LASH_REACH,
  GILL_ROOT_ZONE,
  GLASSES_TEMPLE_MIN_X,
  NEAR_EYE_ZONE,
  NEAR_LASH_REACH,
  SHIRT_BACK_FRONT_LINE_X,
  TAIL_SLOT_REACH,
  axolotlBodyGeometry,
  backBigFootprint,
  backFootprint,
  feetEnvelope,
  legSlotFrames,
  shirtGeometry,
  sockFootPad,
  tailSlotFrame,
  unionBounds,
  type AxolotlArtLook,
  type BodyEllipse,
  type BodyWearableSlot,
  type Bounds,
  type LegRect,
  type LegSlotFrame,
  type WearFrame,
  type ZoneCircle,
} from './drawAxolotlParts';
import {
  BIG_WEARABLE_ART_SLUGS,
  NO_OUTFIT,
  WEARABLE_ART_SLOT,
  artOutfit,
  outfitKey,
  paintBodyWearable,
  paintLegWearables,
  wearsBigItem,
  type ArtOutfit,
  type WearableArtSlug,
} from './drawWearables';
import { INK, LEUCISTIC, LW, type MorphPalette } from './palette';
import { LANTERN_FLAME } from './drawTreasures';
import {
  BADGE_FILL,
  BOAT_TRIM,
  DIVING_GOGGLES_FRAME,
  DIVING_SUIT_FILL,
  FIREFLY_GLOW,
  FIREFLY_HOOK,
  GEM_GLINT,
  GLASSES_GEM,
  GLASSES_LENS,
  GOLD_TRIM,
  LANTERN_CHARM_FILL,
  MINI_SUBMARINE_FILL,
  SOCK_STRIPE_ALPHA,
  TREASURE_SHINE,
  TREASURE_STAR,
  TURTLE_SHELL_FILL,
  TURTLE_SOCKS_FILL,
} from './treasurePalette';
import { SWIM_VIEW_CSS_PX_PER_UNIT, WEARABLE_SWIM_VIEW_MIN_CSS_PX2 } from './wearableFit';
import { ALL_TREASURES, OPEN_LAKE_2_TREASURES, treasureSlug, type Wearable } from '../logic/catalogue';

// The texture modules name Phaser only in types; keep the engine out of the node run regardless.
vi.mock('phaser', () => ({}));

const TAU = Math.PI * 2;
/** Guide 11: at least 4 logical units of padding inside the texture frame. */
const FRAME_PAD = 4;
/** Flattened arcs sit inside their circle by their sagitta; geometry is held to this. */
const TOL = 0.005;
/** The enumerations over 54 looks and a swim cycle take a few seconds each. */
const ENUMERATION_TIMEOUT_MS = 30_000;
/** The Sock sleeve's ink and colour widths (guide 6i). */
const SLEEVE_INK_W = 16.4;
const SLEEVE_COLOUR_W = 11.6;

// ---------------------------------------------------------------------------
// A recording canvas context (as in wearableArt.test.ts)
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
  return clip(-dx, a.x - box.minX) && clip(dx, box.maxX - a.x) && clip(-dy, a.y - box.minY) && clip(dy, box.maxY - a.y);
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
  const probe: Bounds = { minX: box.minX - grow, minY: box.minY - grow, maxX: box.maxX + grow, maxY: box.maxY + grow };
  if (probe.minX >= probe.maxX || probe.minY >= probe.maxY) return false;
  if (r.kind === 'fill' && winding(r.subs, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2) !== 0) return true;
  return edgesOf(r).some(([a, b]) => segHitsBox(a, b, probe));
}

/** Every painted point of `paints` as (point, ink half-width), clips counted as their region. */
function inkPoints(paints: readonly Paint[]): { p: Pt; hw: number }[] {
  return paints.flatMap((paint) => {
    const r = regionOf(paint);
    return r.subs.flatMap((s) => s.pts.map((p) => ({ p, hw: r.hw })));
  });
}

/** Local box of every painted point, ink included. */
function inkBounds(paints: readonly Paint[]): Bounds {
  const pts = inkPoints(paints);
  return {
    minX: Math.min(...pts.map(({ p, hw }) => p.x - hw)),
    minY: Math.min(...pts.map(({ p, hw }) => p.y - hw)),
    maxX: Math.max(...pts.map(({ p, hw }) => p.x + hw)),
    maxY: Math.max(...pts.map(({ p, hw }) => p.y + hw)),
  };
}

function isInside(inner: Bounds, outer: Bounds, eps = TOL): boolean {
  return inner.minX >= outer.minX - eps && inner.minY >= outer.minY - eps && inner.maxX <= outer.maxX + eps && inner.maxY <= outer.maxY + eps;
}

/** A point in a frame's own (u, v) axes. */
function toFrame(frame: WearFrame, p: Pt): Pt {
  const c = Math.cos(frame.angle);
  const s = Math.sin(frame.angle);
  const dx = p.x - frame.x;
  const dy = p.y - frame.y;
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

/** A frame's (u, v) as a local point. */
function fromFrame(frame: WearFrame, u: number, v: number): Pt {
  const c = Math.cos(frame.angle);
  const s = Math.sin(frame.angle);
  return { x: frame.x + u * c - v * s, y: frame.y + u * s + v * c };
}

function frameInner(pad: number): Bounds {
  return {
    minX: -AXO_TEX.originX + pad,
    minY: -AXO_TEX.originY + pad,
    maxX: AXO_TEX.w - AXO_TEX.originX - pad,
    maxY: AXO_TEX.h - AXO_TEX.originY - pad,
  };
}

/** Local box of every point of `paints`, no ink and clips ignored. */
function rawBoxOf(paints: readonly Paint[]): Bounds {
  const pts = paints.flatMap((p) => p.subs.flatMap((sub) => sub.pts));
  return {
    minX: Math.min(...pts.map((q) => q.x)),
    minY: Math.min(...pts.map((q) => q.y)),
    maxX: Math.max(...pts.map((q) => q.x)),
    maxY: Math.max(...pts.map((q) => q.y)),
  };
}

// ---------------------------------------------------------------------------
// Sampling what was painted
// ---------------------------------------------------------------------------

/** Opacity of a paint: its global alpha times the alpha of an `rgba(...)` style. */
function paintOpacity(p: Paint): number {
  const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(p.style);
  return p.alpha * (rgba ? Number(rgba[1]) : 1);
}

/** An item fill: not ink, and half opaque or more, so the shine counts and the clear lens tint and the stripe-alpha marks do not (as wearableArt.test.ts: a coloured stroke counts too). */
function isItemFill(p: Paint): boolean {
  return p.style !== INK && paintOpacity(p) >= 0.5;
}

/** An edge of a paint and its box, grown by half the line width for a stroke. */
interface SampledEdge {
  a: Pt;
  b: Pt;
  box: Bounds;
}

/**
 * A paint ready for sampling: its box (ink included, cut to its clips) and, per sampled row y, the edges that can count
 * there, its own and each clip's, built on first use.
 */
interface SampledPaint {
  index: number;
  paint: Paint;
  box: Bounds;
  edges: SampledEdge[];
  clipEdges: SampledEdge[][];
  rows: Map<number, SampledEdge[]>;
  clipRows: Map<number, SampledEdge[][]>;
}

function subsBox(subs: readonly SubPath[], pad: number): Bounds {
  const pts = subs.flatMap((sub) => sub.pts);
  return {
    minX: Math.min(...pts.map((q) => q.x)) - pad,
    minY: Math.min(...pts.map((q) => q.y)) - pad,
    maxX: Math.max(...pts.map((q) => q.x)) + pad,
    maxY: Math.max(...pts.map((q) => q.y)) + pad,
  };
}

/** The edges of a region, each with its box grown by its half line width. */
function regionEdges(r: Region): SampledEdge[] {
  return edgesOf(r).map(([a, b]) => ({
    a,
    b,
    box: { minX: Math.min(a.x, b.x) - r.hw, minY: Math.min(a.y, b.y) - r.hw, maxX: Math.max(a.x, b.x) + r.hw, maxY: Math.max(a.y, b.y) + r.hw },
  }));
}

function sampledPaint(paint: Paint, index: number): SampledPaint {
  const hw = paint.kind === 'stroke' ? paint.lineWidth / 2 : 0;
  const box = paint.clips.reduce((b, clip) => {
    const c = subsBox(clip, 0);
    return { minX: Math.max(b.minX, c.minX), minY: Math.max(b.minY, c.minY), maxX: Math.min(b.maxX, c.maxX), maxY: Math.min(b.maxY, c.maxY) };
  }, subsBox(paint.subs, hw));
  return {
    index,
    paint,
    box,
    edges: regionEdges({ subs: paint.subs, kind: paint.kind, hw }),
    clipEdges: paint.clips.map((clip) => regionEdges({ subs: clip, kind: 'fill', hw: 0 })),
    rows: new Map(),
    clipRows: new Map(),
  };
}

/** Of `edges`, those that cross row `y`: the only ones a winding count makes there. */
function crossingEdges(edges: readonly SampledEdge[], y: number): SampledEdge[] {
  return edges.filter((e) => e.a.y <= y !== e.b.y <= y);
}

/** The edges of `s` that can count at row `y`: for a fill those that cross it, for a stroke those whose grown box spans it. */
function rowEdges(s: SampledPaint, y: number): SampledEdge[] {
  const cached = s.rows.get(y);
  if (cached !== undefined) return cached;
  const row = s.paint.kind === 'fill' ? crossingEdges(s.edges, y) : s.edges.filter((e) => y >= e.box.minY && y <= e.box.maxY);
  s.rows.set(y, row);
  return row;
}

/** Each clip's edges of `s` that cross row `y`. */
function clipRowEdges(s: SampledPaint, y: number): SampledEdge[][] {
  const cached = s.clipRows.get(y);
  if (cached !== undefined) return cached;
  const rows = s.clipEdges.map((edges) => crossingEdges(edges, y));
  s.clipRows.set(y, rows);
  return rows;
}

/** Nonzero winding number about (x, y) of the edges that cross row y. */
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

/** Whether the paint covers (x, y): inside every clip, and inside its fill or within half its line width of its stroke. */
function paintCovers(s: SampledPaint, x: number, y: number): boolean {
  if (x < s.box.minX || x > s.box.maxX || y < s.box.minY || y > s.box.maxY) return false;
  const covered =
    s.paint.kind === 'fill'
      ? rowWinding(rowEdges(s, y), x, y) !== 0
      : rowEdges(s, y).some((e) => x >= e.box.minX && x <= e.box.maxX && segDist(x, y, e.a, e.b) <= s.paint.lineWidth / 2);
  return covered && clipRowEdges(s, y).every((clip) => rowWinding(clip, x, y) !== 0);
}

/** Grid rows `step` apart inside `box`, each with its sample centres, on a grid fixed to the origin. */
function gridRows(box: Bounds, step: number): { y: number; xs: number[] }[] {
  const xs: number[] = [];
  for (let i = Math.floor(box.minX / step); (i + 0.5) * step <= box.maxX; i++) xs.push((i + 0.5) * step);
  const rows: { y: number; xs: number[] }[] = [];
  for (let j = Math.floor(box.minY / step); (j + 0.5) * step <= box.maxY; j++) rows.push({ y: (j + 0.5) * step, xs });
  return rows;
}

/** Grid sample centres `step` apart inside `box`, on a grid fixed to the origin. */
function gridPoints(box: Bounds, step: number): Pt[] {
  const out: Pt[] = [];
  for (let j = Math.floor(box.minY / step); (j + 0.5) * step <= box.maxY; j++) {
    for (let i = Math.floor(box.minX / step); (i + 0.5) * step <= box.maxX; i++) out.push({ x: (i + 0.5) * step, y: (j + 0.5) * step });
  }
  return out;
}

// ---------------------------------------------------------------------------
// What to paint
// ---------------------------------------------------------------------------

const TRENCH_SLUG = {
  socks: 'turtle-socks',
  goggles: 'diving-goggles',
  pack: 'turtle-shell-backpack',
  charm: 'lantern-tail-charm',
  sub: 'mini-submarine',
  suit: 'diving-suit',
} as const satisfies Record<string, WearableArtSlug>;
/** The Area 13 body items with their slots. */
const TRENCH_BODY_ITEMS = [
  ['face', TRENCH_SLUG.goggles],
  ['back', TRENCH_SLUG.pack],
  ['tail', TRENCH_SLUG.charm],
  ['back', TRENCH_SLUG.sub],
  ['shirt', TRENCH_SLUG.suit],
] as const;
/** A full Area 13 outfit: the Turtle shell backpack in the Back slot with one item in every other slot of the six. */
const TRENCH_OUTFIT: ArtOutfit = { socks: TRENCH_SLUG.socks, face: TRENCH_SLUG.goggles, back: TRENCH_SLUG.pack, tail: TRENCH_SLUG.charm, shirt: TRENCH_SLUG.suit };
/** The same with the big Mini submarine in the Back slot instead. */
const TRENCH_BIG_OUTFIT: ArtOutfit = { ...TRENCH_OUTFIT, back: TRENCH_SLUG.sub };
/** Every earlier Socks and Feet item, whose outlines the Turtle socks' must not repeat. */
const EARLIER_LEG_SLUGS = ['stripy-socks', 'lily-pad-socks', 'wave-socks', 'flippers', 'froggy-boots', 'pelican-slippers'] as const satisfies readonly WearableArtSlug[];

const GIRL: AxolotlArtLook = { ...DEFAULT_ART_LOOK, sex: 'girl' };
/** Every Boy or girl, Tail, Body and Age (the size only scales the bake): 54 looks. */
const EVERY_BODY_LOOK: readonly AxolotlArtLook[] = AXO_SEXES.flatMap((sex) =>
  AXO_TAILS.flatMap((tail) => AXO_BODIES.flatMap((body) => AXO_AGES.map((age): AxolotlArtLook => ({ ...DEFAULT_ART_LOOK, sex, tail, body, age })))),
);
const lookId = (look: AxolotlArtLook): string => [look.size, look.sex, look.tail, look.body, look.age].join(' ');
/** Swim phases round a whole cycle, tail amplitudes up to the frame's 1.6. */
const SWIMS = Array.from({ length: 13 }, (_, i) => (i / 12) * TAU);
const AMPS = [1, 1.6] as const;
/** The smallest look, the least of the axolotl's own paint: a Girl's Short-tailed Slim Baby, at Medium. */
const SMALLEST: AxolotlArtLook = { ...DEFAULT_ART_LOOK, sex: 'girl', tail: 'short', body: 'slim', age: 'baby' };

function bodyPaints(slot: BodyWearableSlot, look: AxolotlArtLook, slug: WearableArtSlug, swim = 0, amp = 1): Paint[] {
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
  expect(rec.alpha).toBe(1);
  return rec.paints;
}

/** A palette whose eye colour no other paint uses, to find the eyes in a recording. */
const EYE_COLOUR = '#123456';
const SENTINEL_PALETTE: MorphPalette = { ...LEUCISTIC, eye: EYE_COLOUR };

function drawn(pose: AxolotlPose, look: AxolotlArtLook, outfit: ArtOutfit = NO_OUTFIT): Paint[] {
  const rec = record((ctx) => drawAxolotl(ctx, pose, SENTINEL_PALETTE, look, outfit));
  expect(rec.depth).toBe(0);
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

/** The paints `withOutfit` has beyond `base`, by index, or null when `base` is not a subsequence of it. */
function insertedPaints(base: readonly Paint[], withOutfit: readonly Paint[]): { index: number; paint: Paint }[] | null {
  const baseSigs = base.map(signature);
  const extra: { index: number; paint: Paint }[] = [];
  let b = 0;
  withOutfit.forEach((paint, index) => {
    if (b < baseSigs.length && signature(paint) === baseSigs[b]) b++;
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

/** The Sock sleeve's paints: its 16.4 ink stroke, its 11.6 colour stroke and the waves across it at the stripe alpha (outside any clip). */
const isSleevePaint = (p: Paint): boolean =>
  (p.kind === 'stroke' && (p.lineWidth === SLEEVE_INK_W || p.lineWidth === SLEEVE_COLOUR_W)) ||
  (p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA && p.clips.length === 0);

const eyeZones: readonly ZoneCircle[] = [NEAR_EYE_ZONE, FAR_EYE_ZONE];
const lashZones: readonly ZoneCircle[] = [NEAR_LASH_REACH, FAR_LASH_REACH];

/** Why `paint` is not clear, or null: the cheek heart zone (unless `heart` is false), the eye zones, the lash reach and the gill-root zone. */
function trouble(paint: Paint, opts: { lashes: boolean; gills: boolean; heart?: boolean }): string | null {
  const region = regionOf(paint);
  if (opts.heart !== false && reachesCircle(region, CHEEK_HEART_ZONE)) return 'cheek heart zone';
  if (eyeZones.some((z) => reachesCircle(region, z))) return 'eye zone';
  if (opts.lashes && lashZones.some((z) => reachesCircle(region, z))) return 'lash reach';
  if (opts.gills && reachesBox(region, GILL_ROOT_ZONE)) return 'gill-root zone';
  return null;
}

/** Relative luminance of `#rrggbb` (WCAG). */
function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

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

/** The most turn, in radians, at any corner of the flattened outline of `paint`: a rounded end turns a little at many corners, a sharp one a lot at one. */
function sharpestTurn(paint: Paint): number {
  let most = 0;
  for (const sub of paint.subs) {
    const pts = sub.pts.filter((q, i) => i === 0 || Math.hypot(q.x - sub.pts[i - 1].x, q.y - sub.pts[i - 1].y) > 1e-9);
    if (pts.length > 1 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-9) pts.pop();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n];
      const b = pts[i];
      const c = pts[(i + 1) % n];
      const turn = Math.abs(Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)));
      most = Math.max(most, turn);
    }
  }
  return most;
}


// ---------------------------------------------------------------------------
// The measures: the swim-view fill, the hero rule and the leg outlines
// ---------------------------------------------------------------------------

/** Sample step of the swim-view fill, in local units, as wearableArt.test.ts's SWIM_VIEW_GRID. */
const FILL_GRID = 0.25;
/** Sample step of the hero rule's visible paint, as wearableArt.test.ts's HERO_GRID. */
const HERO_GRID = 0.5;
/** Sample step of the leg-space outlines. */
const OUTLINE_GRID = 0.25;

interface TrenchCase {
  id: string;
  pose: AxolotlPose;
  look: AxolotlArtLook;
}

/** The 54 body looks with Long gills, Boy and Girl, at the still pose. */
const STILL_CASES: readonly TrenchCase[] = EVERY_BODY_LOOK.map((look) => ({ id: lookId(look), pose: AXO_REST_POSE, look: { ...look, gills: 'long' } }));
/** The smallest look, with Long gills, over the swim cycle at tail amplitude `amp`, all four legs present. */
const smallestSwimCases = (amp: number): TrenchCase[] =>
  SWIMS.map((swim) => ({
    id: `${lookId(SMALLEST)} swim ${swim.toFixed(2)} amp ${amp}`,
    pose: { ...AXO_REST_POSE, swimPhase: swim, tailAmp: amp },
    look: { ...SMALLEST, gills: 'long' },
  }));
/**
 * Visible fill, in units², of what `outfit` adds to a full drawAxolotl run: each FILL_GRID cell whose centre lies in an
 * item fill (half opaque or more, not ink) with no later paint over it. Its own ink and every later layer hide it.
 */
function visibleItemFill(pose: AxolotlPose, look: AxolotlArtLook, outfit: ArtOutfit): number {
  const worn = drawn(pose, look, outfit);
  const inserted = insertedPaints(drawn(pose, look), worn);
  expect(inserted).not.toBeNull();
  const fills = new Set(inserted!.filter((x) => isItemFill(x.paint)).map((x) => x.index));
  expect(fills.size).toBeGreaterThan(0);
  const first = Math.min(...fills);
  const sampled = worn.slice(first).map((paint, k) => sampledPaint(paint, first + k));
  const domain = unionBounds(sampled.filter((s) => fills.has(s.index)).map((s) => s.box));
  const meets = (b: Bounds): boolean => b.minX <= domain.maxX && b.maxX >= domain.minX && b.minY <= domain.maxY && b.maxY >= domain.minY;
  const topFirst = sampled.filter((s) => meets(s.box)).reverse();
  let count = 0;
  for (const { y, xs } of gridRows(domain, FILL_GRID)) {
    const row = topFirst.filter((s) => y >= s.box.minY && y <= s.box.maxY);
    for (const x of xs) {
      const top = row.find((s) => paintCovers(s, x, y));
      if (top !== undefined && fills.has(top.index)) count++;
    }
  }
  return count * FILL_GRID ** 2;
}

/** The least visible fill of `outfit` over `cases`, in CSS px² at the Small swim view, and where it was found. */
function leastFill(outfit: ArtOutfit, cases: readonly TrenchCase[]): { cssPx2: number; worst: string } {
  let least = { cssPx2: Infinity, worst: '' };
  for (const c of cases) {
    const cssPx2 = visibleItemFill(c.pose, c.look, outfit) * SWIM_VIEW_CSS_PX_PER_UNIT ** 2;
    if (cssPx2 < least.cssPx2) least = { cssPx2, worst: c.id };
  }
  return least;
}

/** Visible paint, in units², of a run wearing `outfit`: each HERO_GRID cell goes to the topmost half-opaque paint over its centre, the axolotl's own or the item's. */
function visiblePaint(pose: AxolotlPose, look: AxolotlArtLook, outfit: ArtOutfit): { own: number; item: number } {
  const worn = drawn(pose, look, outfit);
  const inserted = insertedPaints(drawn(pose, look), worn);
  expect(inserted).not.toBeNull();
  const items = new Set(inserted!.map((x) => x.index));
  const topFirst = worn
    .map((paint, index) => sampledPaint(paint, index))
    .filter((s) => paintOpacity(s.paint) >= 0.5)
    .reverse();
  let own = 0;
  let item = 0;
  for (const { y, xs } of gridRows(unionBounds(topFirst.map((s) => s.box)), HERO_GRID)) {
    const row = topFirst.filter((s) => y >= s.box.minY && y <= s.box.maxY);
    for (const x of xs) {
      const top = row.find((s) => paintCovers(s, x, y));
      if (top === undefined) continue;
      if (items.has(top.index)) item++;
      else own++;
    }
  }
  return { own: own * HERO_GRID ** 2, item: item * HERO_GRID ** 2 };
}

/** The leg frames the outlines are compared on: every leg of a Girl at every Age, mid-paddle. */
const OUTLINE_FRAMES: readonly { id: string; frame: LegSlotFrame }[] = AXO_AGES.map((age): AxolotlArtLook => ({ ...GIRL, age })).flatMap((look) =>
  legSlotFrames(look, 0.9).map((frame) => ({ id: `${look.age} leg ${frame.index}`, frame })),
);

const outlines = new Map<string, Set<string>>();
/**
 * The leg-space cells (OUTLINE_GRID) that `slug`'s half-opaque paint covers, worn alone on `frame`, over the foot: the
 * Feet envelope grown by 1 and the leg end behind it, where the body never hides the leg. Kept per item and frame.
 */
function legOutline(slug: WearableArtSlug, id: string, frame: LegSlotFrame): Set<string> {
  const key = `${slug} ${id}`;
  const cached = outlines.get(key);
  if (cached !== undefined) return cached;
  const slot = WEARABLE_ART_SLOT[slug];
  const sampled = legPaints({ [slot]: slug }, frame)
    .filter((p) => paintOpacity(p) >= 0.5)
    .map((paint, index) => sampledPaint(paint, index));
  const env = feetEnvelope(frame);
  const cells = new Set<string>();
  for (const q of gridPoints({ minX: env.u0 - 4, minY: -env.vHalf - 1, maxX: env.u1 + 1, maxY: env.vHalf + 1 }, OUTLINE_GRID)) {
    const p = fromFrame(frame, q.x, q.y);
    if (sampled.some((s) => paintCovers(s, p.x, p.y))) cells.add(`${q.x},${q.y}`);
  }
  outlines.set(key, cells);
  return cells;
}

/** The area, in units², of the cells in one outline and not the other: what tells the two apart. */
function outlineDifference(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let only = 0;
  for (const cell of a) if (!b.has(cell)) only++;
  for (const cell of b) if (!a.has(cell)) only++;
  return only * OUTLINE_GRID ** 2;
}

/** Whether leg-space point `q` lies inside `rect` (ink included), within TOL. */
function inLegRect(rect: LegRect, q: Pt, hw: number): boolean {
  return q.x - hw >= rect.u0 - TOL && q.x + hw <= rect.u1 + TOL && Math.abs(q.y) + hw <= rect.vHalf + TOL;
}

// ---------------------------------------------------------------------------
// The records (2 dp): measured by this suite, which fails when a number moves
// ---------------------------------------------------------------------------

/** Each item's least visible fill over its trench cases, in CSS px² at the Small swim view, and where. */
const TRENCH_FILL_RECORD: Readonly<Record<(typeof TRENCH_SLUG)[keyof typeof TRENCH_SLUG], { readonly cssPx2: number; readonly worst: string }>> = {
  'turtle-socks': { cssPx2: 82.43, worst: 'medium girl short slim baby swim 2.09 amp 1' },
  'diving-goggles': { cssPx2: 76.61, worst: 'medium girl short slim baby' },
  'turtle-shell-backpack': { cssPx2: 74.59, worst: 'medium girl short chubby baby' },
  'lantern-tail-charm': { cssPx2: 69.01, worst: 'medium girl short slim baby swim 5.24 amp 1.6' },
  'mini-submarine': { cssPx2: 99.68, worst: 'medium boy short slim baby' },
  'diving-suit': { cssPx2: 65.7, worst: 'medium boy short slim baby' },
};
/**
 * Each item's least share of the axolotl's own visible paint over the item's (over 1, the axolotl stays the hero), on
 * the still looks and on the smallest look's swim cycle, and where. The rule is the big items' (guide 6i, the Mini
 * submarine here); the other five are held to it too.
 */
const HERO_RECORD: Readonly<Record<string, { readonly share: number; readonly worst: string }>> = {
  'turtle-socks still': { share: 6.56, worst: 'medium girl short slim young' },
  'turtle-socks swim': { share: 7.73, worst: 'medium girl short slim baby swim 5.76 amp 1.6' },
  'diving-goggles still': { share: 18.47, worst: 'medium boy short slim baby' },
  'diving-goggles swim': { share: 21.69, worst: 'medium girl short slim baby swim 1.57 amp 1' },
  'turtle-shell-backpack still': { share: 19.22, worst: 'medium girl short slim baby' },
  'turtle-shell-backpack swim': { share: 18.73, worst: 'medium girl short slim baby swim 1.57 amp 1' },
  'lantern-tail-charm still': { share: 18.59, worst: 'medium girl short slim baby' },
  'lantern-tail-charm swim': { share: 18.15, worst: 'medium girl short slim baby swim 1.57 amp 1.6' },
  'mini-submarine still': { share: 13.18, worst: 'medium girl short slim baby' },
  'mini-submarine swim': { share: 12.84, worst: 'medium girl short slim baby swim 1.57 amp 1' },
  'diving-suit still': { share: 5.17, worst: 'medium girl short chubby grownUp' },
  'diving-suit swim': { share: 15.87, worst: 'medium girl short slim baby swim 1.57 amp 1' },
};
/** The least outline difference, in units², of the Turtle socks from each earlier leg item, over OUTLINE_FRAMES, and where. */
const OUTLINE_RECORD: Readonly<Record<string, { readonly units2: number; readonly worst: string }>> = {
  'turtle-socks stripy-socks': { units2: 16.5, worst: 'baby leg 0' },
  'turtle-socks lily-pad-socks': { units2: 16.5, worst: 'baby leg 0' },
  'turtle-socks wave-socks': { units2: 25.5, worst: 'baby leg 0' },
  'turtle-socks flippers': { units2: 260.25, worst: 'young leg 0' },
  'turtle-socks froggy-boots': { units2: 170.5, worst: 'baby leg 0' },
  'turtle-socks pelican-slippers': { units2: 188.125, worst: 'baby leg 2' },
};
/** Outlines differ by this much or more, in units² on each leg: about 5.6 CSS px² in the Small swim view. */
const OUTLINE_MIN_DIFFERENCE = 12;
/** The sixty-six earlier worn looks' paints: how many, and their digest. */
const EARLIER_66_PAINTS = 6828;
const EARLIER_66_DIGEST = '53d15c095de23ad9';

const TRENCH_WEARABLES: readonly Wearable[] = ALL_TREASURES.filter(
  (t): t is Wearable => t.category === 'wearable' && OPEN_LAKE_2_TREASURES.some((trench) => trench.id === t.id),
);

// ---------------------------------------------------------------------------
// The tests
// ---------------------------------------------------------------------------

describe('open lake Area 13 Wearables (issue #215): art, slots and the one big item', () => {
  it('has six trench Wearables, the last six art slugs: Socks, Face, Back, Tail, Back and Shirt in catalogue order, each with its art', () => {
    expect(TRENCH_WEARABLES.map((w) => `${w.slot}:${treasureSlug(w.id)}`)).toEqual([
      'socks:turtle-socks',
      'face:diving-goggles',
      'back:turtle-shell-backpack',
      'tail:lantern-tail-charm',
      'back:mini-submarine',
      'shirt:diving-suit',
    ]);
    // The Area 13 slugs come after the sixty-six earlier ones, in catalogue order.
    expect(Object.keys(WEARABLE_ART_SLOT).slice(66, 72)).toEqual(Object.values(TRENCH_SLUG));
    for (const wearable of TRENCH_WEARABLES) expect(artOutfit({ [wearable.slot]: wearable.id })[wearable.slot]).toBe(treasureSlug(wearable.id));
  });

  it('makes the Mini submarine the one big Area 13 item: it alone grows its picture, to the big Back box', () => {
    for (const slug of Object.values(TRENCH_SLUG)) {
      const slot = WEARABLE_ART_SLOT[slug];
      expect(wearsBigItem({ [slot]: slug }, slot), slug).toBe(slug === TRENCH_SLUG.sub);
    }
    expect(BIG_WEARABLE_ART_SLUGS.has(TRENCH_SLUG.sub)).toBe(true);
    for (const slug of ['propeller-cap', 'jetpack', 'wizard-hat', 'surfboard'] as const) expect(BIG_WEARABLE_ART_SLUGS.has(slug), slug).toBe(true);
  });

  it('maps Area 13 catalogue ids to art slugs by slot, and leaves out an Area 13 id worn in the wrong slot', () => {
    expect(
      artOutfit({
        socks: 'open-lake/turtle-socks',
        face: 'open-lake/diving-goggles',
        back: 'open-lake/turtle-shell-backpack',
        tail: 'open-lake/lantern-tail-charm',
        shirt: 'open-lake/diving-suit',
      }),
    ).toEqual(TRENCH_OUTFIT);
    expect(artOutfit({ back: 'open-lake/mini-submarine' })).toEqual({ back: TRENCH_SLUG.sub });
    expect(
      artOutfit({
        feet: 'open-lake/turtle-socks',
        neck: 'open-lake/diving-goggles',
        tail: 'open-lake/turtle-shell-backpack',
        face: 'open-lake/lantern-tail-charm',
        shirt: 'open-lake/mini-submarine',
        back: 'open-lake/diving-suit',
      }),
    ).toEqual({});
    expect(outfitKey(TRENCH_OUTFIT)).toBe('face=diving-goggles,shirt=diving-suit,back=turtle-shell-backpack,tail=lantern-tail-charm,socks=turtle-socks');
  });

  it('leaves the sixty-six earlier worn looks as they were: the digest of their paints is unchanged', () => {
    const slugs = (Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]).slice(0, 66);
    expect(slugs[65]).toBe('pelican-slippers');
    const looks: AxolotlArtLook[] = [DEFAULT_ART_LOOK, { ...GIRL, body: 'chubby', age: 'baby', tail: 'short' }, { ...GIRL, body: 'slim', age: 'grownUp', tail: 'long' }];
    const out: string[] = [];
    for (const slug of slugs) {
      const slot = WEARABLE_ART_SLOT[slug];
      for (const look of looks) {
        for (const [swim, amp] of [
          [0, 1],
          [2.1, 1.6],
        ] as const) {
          if (slot === 'socks' || slot === 'feet') for (const frame of legSlotFrames(look, swim)) out.push(...legPaints({ [slot]: slug }, frame).map(signature));
          else out.push(...bodyPaints(slot, look, slug, swim, amp).map(signature));
        }
      }
    }
    expect(out).toHaveLength(EARLIER_66_PAINTS);
    expect(digest(out.join('\n'))).toBe(EARLIER_66_DIGEST);
  });
});

describe('open lake Area 13 Wearables (issue #215): keep-clear zones, footprints and layers', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('draws the Diving goggles alike on every look, in the Face footprint, with the lens a clear tint and only the strap tab beyond the glasses frame, clear of the eye zones, gill roots and cheek heart zone', () => {
    const paints = bodyPaints('face', DEFAULT_ART_LOOK, TRENCH_SLUG.goggles);
    for (const look of EVERY_BODY_LOOK) expect(bodyPaints('face', look, TRENCH_SLUG.goggles).map(signature), lookId(look)).toEqual(paints.map(signature));
    // The glasses frame: the clear lens tint (never dark) and the band in the goggles' colour.
    expect(paints[0].kind === 'fill' && paints[0].style === GLASSES_LENS).toBe(true);
    expect(paints.some((p) => p.kind === 'stroke' && p.style === DIVING_GOGGLES_FRAME)).toBe(true);
    // The strap tab is the last two paints: its ink outline, then its trim fill. The temple stub reaches back to x 14, no further.
    const tab = paints.slice(-2);
    expect([tab[0].kind, tab[0].style, tab[0].lineWidth, tab[1].kind, tab[1].style]).toEqual(['stroke', INK, 1.2, 'fill', BOAT_TRIM]);
    for (const paint of tab) expect(trouble(paint, { lashes: false, gills: true }), `${paint.kind} ${paint.style}`).toBeNull();
    const box = inkBounds(paints);
    expect(box.minX).toBeCloseTo(GLASSES_TEMPLE_MIN_X, 6);
    expect(box.maxX).toBeLessThanOrEqual(54 + TOL);
    expect(box.minY).toBeGreaterThanOrEqual(-18 - TOL);
    expect(box.maxY).toBeLessThanOrEqual(6 + TOL);
    // The frame spans the whole eye span, and no half-opaque paint but the band and the tab reaches an eye zone.
    expect(box.minX).toBeLessThanOrEqual(NEAR_EYE_ZONE.x - NEAR_EYE_ZONE.r);
    expect(box.maxX).toBeGreaterThanOrEqual(FAR_EYE_ZONE.x + FAR_EYE_ZONE.r);
  });

  it('keeps the Turtle shell backpack, the Mini submarine and the Diving suit off the eyes, lashes, gill roots and cheek heart zone on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of TRENCH_BODY_ITEMS.filter(([slot]) => slot === 'back' || slot === 'shirt')) {
        for (const p of bodyPaints(slot, look, slug)) {
          const why = trouble(p, { lashes: true, gills: true });
          if (why) bad.push(`${lookId(look)} ${slug} ${why}`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the Turtle socks off the eyes and lashes on every look and swim phase; the pads clear the gill roots too', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS) {
        for (const frame of legSlotFrames(look, swim)) {
          for (const p of legPaints({ socks: TRENCH_SLUG.socks }, frame)) {
            // The sleeve starts inside the torso, behind the silhouette; the cheek heart is the head's, which paints over every leg.
            const why = trouble(p, { lashes: true, gills: !isSleevePaint(p), heart: false });
            if (why) bad.push(`${lookId(look)} leg ${frame.index} swim ${swim.toFixed(2)} ${why}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps every Area 13 Wearable but the goggles of a full drawAxolotl run off the eyes and, past the silhouette, the gill roots and cheek heart zone, at every size, with either Back item', () => {
    const looks = AXO_SIZES.flatMap((size): AxolotlArtLook[] => [
      { ...DEFAULT_ART_LOOK, size },
      { ...GIRL, size, body: 'chubby', age: 'baby', tail: 'short' },
      { ...GIRL, size, body: 'slim', age: 'grownUp', tail: 'long' },
    ]);
    for (const outfit of [TRENCH_OUTFIT, TRENCH_BIG_OUTFIT]) {
      const withoutFace: ArtOutfit = { ...outfit, face: null };
      for (const pose of [AXO_REST_POSE, { ...AXO_REST_POSE, swimPhase: 1.3, tailAmp: 1.6 }]) {
        for (const look of looks) {
          const worn = drawn(pose, look, withoutFace);
          const silhouette = worn.findIndex((p) => p.kind === 'stroke' && p.lineWidth === 2 * LW && p.style === INK);
          const inserted = insertedPaints(drawn(pose, look), worn)!;
          expect(inserted.length).toBeGreaterThan(0);
          for (const { index, paint } of inserted) {
            const why = trouble(paint, { lashes: false, gills: index > silhouette, heart: index > silhouette });
            expect(why, `${outfitKey(outfit)} ${lookId(look)} paint ${index} ${paint.kind} ${paint.style}`).toBeNull();
          }
        }
      }
    }
  });

  it("paints every Area 13 Wearable before the eyes, a Girl's lashes included, and changes none of the axolotl's own paints", () => {
    for (const outfit of [TRENCH_OUTFIT, TRENCH_BIG_OUTFIT]) {
      for (const look of [DEFAULT_ART_LOOK, GIRL, { ...GIRL, body: 'chubby' as const, age: 'baby' as const, tail: 'short' as const }]) {
        for (const pose of [AXO_REST_POSE, { ...AXO_REST_POSE, swimPhase: 1.3, tailAmp: 1.6 }]) {
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

  it('keeps the Diving suit inside the torso edge band, behind the front line, cut at the tail root, on every look', () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const shirt = shirtGeometry(look);
      const e: BodyEllipse = shirt.inset;
      const boundary = Array.from({ length: 720 }, (_, k) => ({ x: e.cx + Math.cos((k / 720) * TAU) * e.rx, y: e.cy + Math.sin((k / 720) * TAU) * e.ry }));
      for (const { p, hw } of inkPoints(bodyPaints('shirt', look, TRENCH_SLUG.suit))) {
        const inside = ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1 + 1e-9;
        const gap = Math.min(...boundary.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
        if (!inside || gap < hw - TOL) bad.push(`${lookId(look)} edge band`);
        if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
        if (p.x - hw < shirt.rearX - TOL) bad.push(`${lookId(look)} rear`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("paints the Diving suit on the Tank top's whole silhouette, with one gold collar ring behind the neckline and one star on the chest, all clipped inside it", () => {
    for (const look of EVERY_BODY_LOOK) {
      const paints = bodyPaints('shirt', look, TRENCH_SLUG.suit);
      const body = paints.filter((p) => p.kind === 'fill' && p.style === DIVING_SUIT_FILL);
      expect(body).toHaveLength(1);
      const tank = bodyPaints('shirt', look, 'tank-top').find((p) => p.kind === 'fill' && p.alpha === 1 && p.style !== TREASURE_SHINE)!;
      expect(body[0].subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`))).toEqual(
        tank.subs.map((sub) => sub.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`)),
      );
      // The one 2.0 outline, painted last of the silhouette, over every inner detail.
      const outline = paints.filter((p) => p.kind === 'stroke' && p.lineWidth === 2 && p.style === INK);
      expect(outline).toHaveLength(1);
      const inner = paints.slice(paints.indexOf(body[0]) + 1, paints.indexOf(outline[0]));
      expect(inner.length).toBeGreaterThan(0);
      for (const p of inner) expect(p.clips.length, `${lookId(look)} ${p.kind} ${p.style}`).toBeGreaterThan(0);
      const collar = inner.filter((p) => p.kind === 'fill' && p.style === GOLD_TRIM);
      const star = inner.filter((p) => p.kind === 'fill' && p.style === TREASURE_STAR);
      expect([collar.length, star.length], lookId(look)).toEqual([1, 1]);
      // The star stands on the chest, behind the collar ring, clear of the shine's place at the upper rear.
      const collarBox = rawBoxOf(collar);
      const starBox = rawBoxOf(star);
      expect(starBox.maxX, lookId(look)).toBeLessThan(collarBox.minX);
      expect(collarBox.maxX, lookId(look)).toBeLessThan(shirtGeometry(look).neckline.apexX);
    }
  });

  it("keeps every Back item's fill off the Diving suit's, and the Turtle shell backpack's and the Mini submarine's off every Shirt item's, on every look", () => {
    const slugsOf = (slot: 'shirt' | 'back'): WearableArtSlug[] => (Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]).filter((slug) => WEARABLE_ART_SLOT[slug] === slot);
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const fillsOf = (slot: 'shirt' | 'back', slug: WearableArtSlug): SampledPaint[] =>
        bodyPaints(slot, look, slug)
          .filter(isItemFill)
          .map((paint, index) => sampledPaint(paint, index));
      const meet = (back: readonly SampledPaint[], shirt: readonly SampledPaint[]): boolean =>
        gridPoints(unionBounds(back.map((f) => f.box)), FILL_GRID).some((q) => back.some((f) => paintCovers(f, q.x, q.y)) && shirt.some((f) => paintCovers(f, q.x, q.y)));
      const suit = fillsOf('shirt', TRENCH_SLUG.suit);
      for (const backSlug of slugsOf('back')) if (meet(fillsOf('back', backSlug), suit)) bad.push(`${lookId(look)} ${backSlug} over the diving suit`);
      for (const backSlug of [TRENCH_SLUG.pack, TRENCH_SLUG.sub]) {
        const pack = fillsOf('back', backSlug);
        for (const shirtSlug of slugsOf('shirt')) if (meet(pack, fillsOf('shirt', shirtSlug))) bad.push(`${lookId(look)} ${backSlug} over ${shirtSlug}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("keeps the Turtle shell backpack in its look's Back box, running it end to end and out to its outer edge, behind the front line, on every look", () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const { frame, box } = backFootprint(look);
      const paints = bodyPaints('back', look, TRENCH_SLUG.pack);
      const along = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
      for (const { q, hw } of along) {
        if (q.x - hw < box.minU - TOL || q.x + hw > box.maxU + TOL) bad.push(`${lookId(look)} u`);
        if (q.y - hw < box.minV - TOL || q.y + hw > box.maxV + TOL) bad.push(`${lookId(look)} v`);
      }
      for (const { p, hw } of inkPoints(paints)) if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.x - hw)) - box.minU) > TOL) bad.push(`${lookId(look)} rear end`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.x + hw)) - box.maxU) > TOL) bad.push(`${lookId(look)} front end`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.y - hw)) - box.minV) > TOL) bad.push(`${lookId(look)} top`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("keeps the Mini submarine in its look's big Back box, running it end to end and out to its outer edge, past the Back box, behind the front line, on every look", () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      const { frame, box } = backBigFootprint(look);
      expect(backFootprint(look).frame).toEqual(frame);
      const paints = bodyPaints('back', look, TRENCH_SLUG.sub);
      const along = inkPoints(paints).map(({ p, hw }) => ({ q: toFrame(frame, p), hw }));
      for (const { q, hw } of along) {
        if (q.x - hw < box.minU - TOL || q.x + hw > box.maxU + TOL) bad.push(`${lookId(look)} u`);
        if (q.y - hw < box.minV - TOL || q.y + hw > box.maxV + TOL) bad.push(`${lookId(look)} v`);
      }
      for (const { p, hw } of inkPoints(paints)) if (p.x + hw > SHIRT_BACK_FRONT_LINE_X + TOL) bad.push(`${lookId(look)} front line`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.x - hw)) - box.minU) > TOL) bad.push(`${lookId(look)} rear end`);
      if (Math.abs(Math.max(...along.map(({ q, hw }) => q.x + hw)) - box.maxU) > TOL) bad.push(`${lookId(look)} front end`);
      if (Math.abs(Math.min(...along.map(({ q, hw }) => q.y - hw)) - box.minV) > TOL) bad.push(`${lookId(look)} top`);
      if (Math.min(...along.map(({ q, hw }) => q.y - hw)) >= BACK_BOX_MIN_V) bad.push(`${lookId(look)} not past the Back box`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('paints the Mini submarine lying along the back: a long round-ended hull, a conning tower and a periscope rising to the outer edge, two propeller blades at the rear and a porthole gem, no torpedo', () => {
    const { frame, box } = backBigFootprint(GIRL);
    const paints = bodyPaints('back', GIRL, TRENCH_SLUG.sub);
    const hull = paints.filter((p) => p.kind === 'fill' && p.style === MINI_SUBMARINE_FILL);
    expect(hull).toHaveLength(4);
    const hullBox = rawBoxOf([hull[0]]);
    const hullPts = hull[0].subs.flatMap((sub) => sub.pts.map((q) => toFrame(frame, q)));
    const along = Math.max(...hullPts.map((q) => q.x)) - Math.min(...hullPts.map((q) => q.x));
    const across = Math.max(...hullPts.map((q) => q.y)) - Math.min(...hullPts.map((q) => q.y));
    expect(hullBox.maxX).toBeGreaterThan(hullBox.minX);
    // Longer along the back than it is deep, and the hull fills the box's length but for the propeller.
    expect(along).toBeGreaterThan(1.4 * across);
    expect(along).toBeGreaterThan(box.maxU - box.minU - 8);
    // The periscope reaches the outer edge, well above the hull.
    const top = Math.min(...hull.flatMap((p) => p.subs.flatMap((sub) => sub.pts.map((q) => toFrame(frame, q).y))));
    expect(top).toBeCloseTo(box.minV + 2, 6);
    expect(Math.min(...hullPts.map((q) => q.y))).toBeGreaterThan(top + 12);
    // Two pebble propeller blades behind the hull, and one porthole gem.
    expect(paints.filter((p) => p.kind === 'fill' && p.style === FIREFLY_HOOK)).toHaveLength(2);
    expect(paints.filter((p) => p.kind === 'fill' && p.style === GLASSES_GEM)).toHaveLength(1);
    // Rounded ends, no sharp point and no tube or gun (ADR 0007).
    for (const p of hull) expect(sharpestTurn(p)).toBeLessThan(0.35);
    expect(new Set(paints.filter((p) => p.kind === 'fill' && p.alpha === 1).map((p) => p.style))).toEqual(
      new Set([MINI_SUBMARINE_FILL, FIREFLY_HOOK, GLASSES_GEM, GEM_GLINT, TREASURE_SHINE]),
    );
  });

  it('paints the Turtle shell backpack as a dome on the back with a rim band and two scute lines, clipped to the shell, every corner round', () => {
    const { frame, box } = backFootprint(GIRL);
    const paints = bodyPaints('back', GIRL, TRENCH_SLUG.pack);
    const shell = paints.filter((p) => p.kind === 'fill' && p.style === TURTLE_SHELL_FILL);
    expect(shell).toHaveLength(1);
    const pts = shell[0].subs.flatMap((sub) => sub.pts.map((q) => toFrame(frame, q)));
    // A dome: tallest in the middle, lower at both ends, as wide as the box and as tall.
    const middle = pts.filter((q) => Math.abs(q.x - (box.minU + box.maxU) / 2) < 0.6);
    const ends = pts.filter((q) => q.x < box.minU + 3.5 || q.x > box.maxU - 3.5);
    expect(Math.min(...middle.map((q) => q.y))).toBeLessThan(Math.min(...ends.map((q) => q.y)) - 3);
    expect(sharpestTurn(shell[0])).toBeLessThan(0.35);
    const clipped = paints.filter((p) => p.clips.length > 0);
    expect(clipped.filter((p) => p.kind === 'fill' && p.style === BOAT_TRIM)).toHaveLength(1);
    // The rim band's two lines and the two scute lines: 1.2 ink each.
    expect(clipped.filter((p) => p.kind === 'stroke' && p.style === INK && Math.abs(p.lineWidth - 1.2) < 1e-9)).toHaveLength(4);
  });

  it("keeps the Lantern tail charm within the Tail footprint's reach of its anchor, glow included, on every look, swim phase and tail amplitude", () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS) {
        for (const amp of AMPS) {
          const anchor = tailSlotFrame(axolotlBodyGeometry(look).tail, swim, amp);
          for (const { p, hw } of inkPoints(bodyPaints('tail', look, TRENCH_SLUG.charm, swim, amp))) {
            if (Math.hypot(p.x - anchor.x, p.y - anchor.y) + hw > TAIL_SLOT_REACH + TOL) bad.push(`${lookId(look)} swim ${swim.toFixed(2)} amp ${amp}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("keeps the Turtle socks' sleeve about the leg and their pad inside the Sock's foot pad, in leg space, on every look and swim phase", () => {
    const bad: string[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIMS.filter((_, i) => i % 3 === 0)) {
        for (const frame of legSlotFrames(look, swim)) {
          const pad = sockFootPad(frame);
          for (const p of legPaints({ socks: TRENCH_SLUG.socks }, frame)) {
            for (const { p: pt, hw } of inkPoints([p])) {
              const q = toFrame(frame, pt);
              if (isSleevePaint(p)) {
                const d = segDist(q.x, q.y, { x: 0, y: 0 }, { x: frame.length, y: 0 });
                if (d + hw > SLEEVE_INK_W / 2 + TOL) bad.push(`${lookId(look)} sleeve`);
              } else if (!inLegRect(pad, q, hw)) bad.push(`${lookId(look)} pad`);
            }
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the lowest Turtle socks ink at y 59 or less on every look and swim phase, and every Area 13 Wearable in the texture frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const bad: string[] = [];
    let lowest = -Infinity;
    for (const look of EVERY_BODY_LOOK) {
      for (const [slot, slug] of TRENCH_BODY_ITEMS) {
        for (const swim of slot === 'tail' ? SWIMS : [0]) {
          for (const amp of slot === 'tail' ? AMPS : [1]) if (!isInside(inkBounds(bodyPaints(slot, look, slug, swim, amp)), inner, 1e-6)) bad.push(`${lookId(look)} ${slug}`);
        }
      }
      for (const swim of SWIMS) {
        for (const frame of legSlotFrames(look, swim)) {
          const box = inkBounds(legPaints({ socks: TRENCH_SLUG.socks }, frame));
          lowest = Math.max(lowest, box.maxY);
          if (!isInside(box, inner, 1e-6)) bad.push(`${lookId(look)} legs`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
    expect(lowest).toBeLessThanOrEqual(AXO_TEX.h - AXO_TEX.originY - FRAME_PAD);
  });

  it('paints still looks: no Area 13 body painter but the Tail charm reads a swim phase or tail amplitude, the charm never changes colour, alpha or width with one, and a repaint is identical', () => {
    for (const [slot, slug] of TRENCH_BODY_ITEMS.filter(([slot]) => slot !== 'tail')) {
      const first = bodyPaints(slot, GIRL, slug).map(signature);
      expect(bodyPaints(slot, GIRL, slug).map(signature)).toEqual(first);
      for (const swim of SWIMS) for (const amp of AMPS) expect(bodyPaints(slot, GIRL, slug, swim, amp).map(signature), `${slug} swim ${swim} amp ${amp}`).toEqual(first);
    }
    // The charm rides the tail: its position follows the wave, its paint never does. The glow is one still disc at one alpha.
    const look = (p: Paint): string => [p.kind, p.style, p.lineWidth, p.alpha, p.clips.length].join('|');
    const first = bodyPaints('tail', GIRL, TRENCH_SLUG.charm).map(look);
    expect(bodyPaints('tail', GIRL, TRENCH_SLUG.charm).map((p) => signature(p))).toEqual(bodyPaints('tail', GIRL, TRENCH_SLUG.charm).map((p) => signature(p)));
    for (const swim of SWIMS) for (const amp of AMPS) expect(bodyPaints('tail', GIRL, TRENCH_SLUG.charm, swim, amp).map(look), `charm swim ${swim} amp ${amp}`).toEqual(first);
    const glow = bodyPaints('tail', GIRL, TRENCH_SLUG.charm).filter((p) => p.alpha < 1);
    expect(glow).toHaveLength(1);
    expect(glow[0].alpha).toBeLessThanOrEqual(0.5);
    expect(glow[0].style).toBe(LANTERN_CHARM_FILL);
  });

  it("mixes the far legs' Turtle socks 12% toward ink and leaves the near legs as authored; the marks, ink and shine stay as they are", () => {
    const frames = legSlotFrames(GIRL, 0.7);
    const colours = (frame: LegSlotFrame): string[] =>
      legPaints({ socks: TRENCH_SLUG.socks }, frame)
        .filter((p) => p.alpha === 1 && p.style !== INK && p.style !== TREASURE_SHINE)
        .map((p) => p.style);
    for (const i of [0, 1]) expect(colours(frames[i])).not.toContain(TURTLE_SOCKS_FILL);
    for (const i of [2, 3]) expect(colours(frames[i])).toContain(TURTLE_SOCKS_FILL);
    const marks = (frame: LegSlotFrame): number => legPaints({ socks: TRENCH_SLUG.socks }, frame).filter((p) => p.style === INK && p.alpha === SOCK_STRIPE_ALPHA).length;
    expect(frames.map(marks)).toEqual([2, 2, 2, 2]);
  });
});

describe('open lake Area 13 Wearables (issue #215): the swim-view fill', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  /** The cases each item is measured on here: the still looks and the smallest look's swim cycle (both tail amplitudes for the Tail charm, which rides the wave). */
  const casesOf = (slug: WearableArtSlug): readonly TrenchCase[] =>
    WEARABLE_ART_SLOT[slug] === 'tail' ? [...STILL_CASES, ...smallestSwimCases(1), ...smallestSwimCases(1.6)] : [...STILL_CASES, ...smallestSwimCases(1)];

  it.each(Object.values(TRENCH_SLUG))("shows 64 CSS px² or more of the %s's own fill in the swim view, as recorded", (slug) => {
    const least = leastFill({ [WEARABLE_ART_SLOT[slug]]: slug }, casesOf(slug));
    const row = TRENCH_FILL_RECORD[slug];
    expect(least.cssPx2, `${slug} at ${least.worst}`).toBeGreaterThanOrEqual(WEARABLE_SWIM_VIEW_MIN_CSS_PX2);
    expect(least.cssPx2, `${slug} at ${least.worst}`).toBeCloseTo(row.cssPx2, 2);
    expect(least.worst).toBe(row.worst);
  });
});

describe('open lake Area 13 Wearables (issue #215): every item keeps the axolotl the hero', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  const parts = [
    ['still', STILL_CASES],
    ['swim', [...smallestSwimCases(1), ...smallestSwimCases(1.6)]],
  ] as const;
  it.each(Object.values(TRENCH_SLUG).flatMap((slug) => parts.map(([part, cases]) => [slug, part, cases] as const)))(
    "keeps the %s's visible paint under the axolotl's own on the %s cases, as recorded",
    (slug, part, cases) => {
      let least = { id: '', share: Infinity, item: 0, own: 0 };
      for (const c of cases) {
        const { own, item } = visiblePaint(c.pose, c.look, { [WEARABLE_ART_SLOT[slug]]: slug });
        if (own / item < least.share) least = { id: c.id, share: own / item, item, own };
      }
      const row = HERO_RECORD[`${slug} ${part}`];
      expect(least.share, `${slug} at ${least.id}: ${least.item} units² over ${least.own}`).toBeGreaterThan(1);
      expect(row, `${slug} ${part} is not in HERO_RECORD: measured ${least.share} at ${least.id}`).toBeDefined();
      expect(least.share, least.id).toBeCloseTo(row.share, 2);
      expect(least.id).toBe(row.worst);
    },
  );
});

describe('open lake Area 13 Wearables (issue #215): outlines of their own', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  const pairs = EARLIER_LEG_SLUGS.map((earlier) => [TRENCH_SLUG.socks, earlier] as const);

  it.each(pairs)("gives the %s an outline unlike the %s's on every leg at every Age, as recorded", (slug, earlier) => {
    let least = { units2: Infinity, worst: '' };
    for (const { id, frame } of OUTLINE_FRAMES) {
      const units2 = outlineDifference(legOutline(slug, id, frame), legOutline(earlier, id, frame));
      if (units2 < least.units2) least = { units2, worst: id };
    }
    const row = OUTLINE_RECORD[`${slug} ${earlier}`];
    expect(least.units2, `${slug} and ${earlier} at ${least.worst}`).toBeGreaterThanOrEqual(OUTLINE_MIN_DIFFERENCE);
    expect(row, `${slug} ${earlier} is not in OUTLINE_RECORD: measured ${least.units2} units² at ${least.worst}`).toBeDefined();
    expect(least.units2, least.worst).toBeCloseTo(row.units2, 2);
    expect(least.worst).toBe(row.worst);
  });

  it("draws the Turtle socks' pad as a six-sided shell: widest at the middle, narrower at the ankle and at the toes, every corner round, covering every toe tip's pad", () => {
    for (const { id, frame } of OUTLINE_FRAMES.filter((f) => f.frame.side === 'near')) {
      const pad = sockFootPad(frame);
      const shell = legPaints({ socks: TRENCH_SLUG.socks }, frame).find((p) => p.kind === 'fill' && p.alpha === 1 && p.style === TURTLE_SOCKS_FILL && p.clips.length === 0 && p.subs.length === 1 && p.subs[0].pts.length > 100 && rawBoxOf([p]).maxX - rawBoxOf([p]).minX > 0)!;
      const q = shell.subs.flatMap((sub) => sub.pts.map((pt) => toFrame(frame, pt)));
      const mid = (pad.u0 + pad.u1) / 2;
      const widthAt = (u: number): number => {
        const near = q.filter((pt) => Math.abs(pt.x - u) < 0.4);
        return Math.max(...near.map((pt) => pt.y)) - Math.min(...near.map((pt) => pt.y));
      };
      expect(widthAt(mid), id).toBeGreaterThan(widthAt(pad.u0 + 2.5) + 2);
      expect(widthAt(mid), id).toBeGreaterThan(widthAt(pad.u1 - 2.5) + 2);
      expect(sharpestTurn(shell), id).toBeLessThan(0.35);
    }
  });
});

describe('open lake Area 13 Wearables (issue #215): the rarity look ladder and kid safety', () => {
  const nearLeg = legSlotFrames(GIRL, 0)[2];
  const colours = (paints: readonly Paint[]): string[] => paints.filter((p) => p.kind === 'fill' && p.alpha === 1).map((p) => p.style);
  const count = (list: readonly string[], value: string): number => list.filter((v) => v === value).length;
  const trenchPaints = (slug: WearableArtSlug): Paint[] => {
    const slot = WEARABLE_ART_SLOT[slug];
    return slot === 'socks' || slot === 'feet' ? legPaints({ [slot]: slug }, nearLeg) : bodyPaints(slot, GIRL, slug);
  };

  it('paints Common as one flat colour plus one shine, no trim: the Turtle socks, their two scute marks ink at the stripe alpha', () => {
    const socks = trenchPaints(TRENCH_SLUG.socks);
    expect(new Set(colours(socks))).toEqual(new Set([TURTLE_SOCKS_FILL, TREASURE_SHINE]));
    expect(count(colours(socks), TREASURE_SHINE)).toBe(1);
    const marks = socks.filter((p) => p.kind === 'fill' && p.alpha === SOCK_STRIPE_ALPHA);
    expect(marks).toHaveLength(2);
    expect(marks.every((p) => p.style === INK)).toBe(true);
    expect(socks.some((p) => p.style === BOAT_TRIM || p.style === GOLD_TRIM)).toBe(false);
  });

  it('adds one #ffe14a trim band for Rare, with no gem, gold or star: Diving goggles, Turtle shell backpack, Lantern tail charm', () => {
    for (const slug of [TRENCH_SLUG.goggles, TRENCH_SLUG.pack, TRENCH_SLUG.charm]) {
      const paints = trenchPaints(slug);
      expect(count(colours(paints), BOAT_TRIM), slug).toBe(1);
      expect(paints.some((p) => p.style === GOLD_TRIM || p.style === TREASURE_STAR || p.style === GLASSES_GEM), slug).toBe(false);
    }
    // One shine on the shell and on the glass; the goggles, like the other glasses, carry none.
    expect(count(colours(trenchPaints(TRENCH_SLUG.pack)), TREASURE_SHINE)).toBe(1);
    expect(count(colours(trenchPaints(TRENCH_SLUG.charm)), TREASURE_SHINE)).toBe(1);
    expect(count(colours(trenchPaints(TRENCH_SLUG.goggles)), TREASURE_SHINE)).toBe(0);
    expect(new Set(colours(trenchPaints(TRENCH_SLUG.goggles)))).toEqual(new Set([GLASSES_LENS, BOAT_TRIM]));
    expect(new Set(colours(trenchPaints(TRENCH_SLUG.pack)))).toEqual(new Set([TURTLE_SHELL_FILL, BOAT_TRIM, TREASURE_SHINE]));
    expect(new Set(colours(trenchPaints(TRENCH_SLUG.charm)))).toEqual(new Set([LANTERN_CHARM_FILL, FIREFLY_HOOK, BOAT_TRIM, TREASURE_SHINE]));
  });

  it('adds one rounded gem for Epic and no trim band, gold or star: the Mini submarine, its porthole', () => {
    const sub = trenchPaints(TRENCH_SLUG.sub);
    expect(count(colours(sub), GLASSES_GEM)).toBe(1);
    expect(count(colours(sub), TREASURE_SHINE)).toBe(1);
    expect(sub.some((p) => p.style === BOAT_TRIM || p.style === GOLD_TRIM)).toBe(false);
  });

  it('adds #ffc12e trim and one static 4-point star for Legendary: the Diving suit', () => {
    const suit = trenchPaints(TRENCH_SLUG.suit);
    expect(new Set(colours(suit))).toEqual(new Set([DIVING_SUIT_FILL, GOLD_TRIM, TREASURE_STAR, TREASURE_SHINE]));
    for (const style of [GOLD_TRIM, TREASURE_STAR, TREASURE_SHINE]) expect(count(colours(suit), style), style).toBe(1);
    expect(suit.some((p) => p.style === BOAT_TRIM || p.style === GLASSES_GEM)).toBe(false);
  });

  it('never looks hurt or scary: no Area 13 paint is red or a flame colour, and every Area 13 outer fill is pale, 9:1 or more with ink and not a rarity badge fill', () => {
    const red = (hex: string): boolean => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
      if (!m) return false;
      const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
      return r >= 180 && g <= 100 && b <= 100;
    };
    for (const slug of Object.values(TRENCH_SLUG)) {
      for (const p of trenchPaints(slug)) {
        expect(red(p.style), `${slug} ${p.kind} ${p.style}`).toBe(false);
        expect([LANTERN_FLAME, FIREFLY_GLOW], `${slug} ${p.style}`).not.toContain(p.style);
      }
    }
    const fills = [TURTLE_SOCKS_FILL, DIVING_GOGGLES_FRAME, TURTLE_SHELL_FILL, LANTERN_CHARM_FILL, MINI_SUBMARINE_FILL, DIVING_SUIT_FILL];
    expect(new Set(fills).size).toBe(fills.length);
    for (const fill of fills) {
      expect(contrast(fill, INK), fill).toBeGreaterThanOrEqual(9);
      expect(Object.values(BADGE_FILL), fill).not.toContain(fill);
      expect(red(fill), fill).toBe(false);
    }
  });

  it("keeps every unclipped silhouette fill of the six rounded, never pointed (ADR 0007; the Diving suit's is the Tank top's, its corners the Shirt footprint's), and every trim band flanked by its own ink lines", () => {
    for (const slug of Object.values(TRENCH_SLUG)) {
      for (const p of trenchPaints(slug).filter((x) => x.kind === 'fill' && x.alpha === 1 && x.clips.length === 0 && x.style !== TREASURE_STAR && x.style !== GLASSES_LENS && x.style !== DIVING_SUIT_FILL)) {
        expect(sharpestTurn(p), `${slug} ${p.style}`).toBeLessThan(0.35);
      }
    }
    for (const slug of [TRENCH_SLUG.pack, TRENCH_SLUG.charm, TRENCH_SLUG.suit]) {
      const paints = trenchPaints(slug);
      const band = paints.findIndex((p) => p.kind === 'fill' && (p.style === BOAT_TRIM || p.style === GOLD_TRIM));
      expect(paints.slice(band + 1, band + 3).map((p) => [p.kind, p.style]), slug).toEqual([
        ['stroke', INK],
        ['stroke', INK],
      ]);
    }
    // The goggles' tab carries its own 1.2 ink outline.
    const goggles = trenchPaints(TRENCH_SLUG.goggles);
    const tab = goggles.findIndex((p) => p.kind === 'fill' && p.style === BOAT_TRIM);
    expect([goggles[tab - 1].kind, goggles[tab - 1].style]).toEqual(['stroke', INK]);
  });
});
