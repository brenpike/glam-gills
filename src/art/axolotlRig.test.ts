/**
 * Axolotl rig parts (issue #46), headless and unit level: pivots, the tail and
 * body seam, part boxes against recorded ink, re-bake keys, the canvas tail
 * strip, and per-frame placement against drawAxolotl's own geometry. The
 * painters run against a recording context (the stub-Path2D approach of
 * wearableArt.test.ts, copied here: a test file is never imported), so every
 * fill and stroke is kept as flattened polygons in local units with its clips.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  AXO_MAX_TAIL_AMP,
  GLINT_MIN_R,
  legGlintRadius,
  legGlintSpots,
  legPoints,
  regenGlintRadius,
  regenGlintSpots,
  type AxolotlPose,
  type LegLook,
} from './drawAxolotl';
import {
  AXO_AGES,
  AXO_BODIES,
  AXO_SEXES,
  AXO_SIZES,
  AXO_TAILS,
  DEFAULT_ART_LOOK,
  EYE_VARIANTS,
  GILL_STYLE_IDS,
  MOUTH_VARIANTS,
  SPOTS_OPTIONS,
  WEARABLE_SLOTS,
  axolotlBodyGeometry,
  gillGeometry,
  gillSpecs,
  legAngle,
  legSlotFrames,
  tailSamples,
  tailSlotFrame,
  type AxolotlArtLook,
  type Bounds,
  type GillGeometry,
  type GillSpec,
  type GillStyleId,
  type WearableSlot,
} from './drawAxolotlParts';
import { isSheenDream } from './drawDreamOverlay';
import { NO_OUTFIT, type ArtOutfit, type WearableArtSlug } from './drawWearables';
import { LEUCISTIC, LW, MORPH_PALETTES, WILD, axolotlPalette, type DreamLookId, type MorphPalette } from './palette';
import {
  EYE_FRAME_BLINKS,
  GILL_FLUTTER_FRAMES,
  RIG_PAD,
  RIG_SEAM_OVERLAP,
  RIG_STILL_POSE,
  SHEEN_STEPS,
  TAIL_STRIP_AMPS,
  TAIL_STRIP_PHASES,
  TWINKLE_BOX,
  TWINKLE_RADII,
  createRigPlacement,
  isStillTail,
  legStateKey,
  nearestTailStrip,
  paintRigPart,
  paintTwinkleFrame,
  rigAppearanceKey,
  rigParts,
  rigPlacement,
  sheenFrame,
  sheenStepValue,
  tailColumnXs,
  tailShear,
  tailStripPose,
  type RigAppearance,
  type RigGillPlacement,
  type RigPartId,
  type RigPartSpec,
  type RigPartVariant,
  type RigTwinkle,
} from './axolotlRigParts';
import { tailStripe } from './axolotlRigStripe';
import type * as AxolotlRigStripe from './axolotlRigStripe';

// tailStripe runs as itself; the spy only counts calls (rigPlacement's stripe memo).
vi.mock('./axolotlRigStripe', async (importOriginal) => {
  const actual = await importOriginal<typeof AxolotlRigStripe>();
  return { ...actual, tailStripe: vi.fn(actual.tailStripe) };
});

const TAU = Math.PI * 2;

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
// Ink of what was painted
// ---------------------------------------------------------------------------

const EMPTY: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

function pointsBounds(subs: readonly SubPath[], hw: number): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of subs) {
    for (const q of s.pts) {
      minX = Math.min(minX, q.x - hw);
      minY = Math.min(minY, q.y - hw);
      maxX = Math.max(maxX, q.x + hw);
      maxY = Math.max(maxY, q.y + hw);
    }
  }
  return { minX, minY, maxX, maxY };
}

function intersect(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.max(a.minX, b.minX),
    minY: Math.max(a.minY, b.minY),
    maxX: Math.min(a.maxX, b.maxX),
    maxY: Math.min(a.maxY, b.maxY),
  };
}

const isEmpty = (b: Bounds): boolean => b.minX > b.maxX || b.minY > b.maxY;

/** The clip as an axis-aligned box when it is one closed four-corner rectangle (the rig's seam bands), else null. */
function rectClip(clip: readonly SubPath[]): Bounds | null {
  if (clip.length !== 1 || !clip[0].closed || clip[0].pts.length !== 4) return null;
  const pts = clip[0].pts;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    if (a.x !== b.x && a.y !== b.y) return null;
  }
  return pointsBounds(clip, 0);
}

/** Part of segment a-b inside `box` (Liang-Barsky), or null when it misses. */
function clipSegment(a: Pt, b: Pt, box: Bounds): [Pt, Pt] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: [number, number][] = [
    [-dx, a.x - box.minX],
    [dx, box.maxX - a.x],
    [-dy, a.y - box.minY],
    [dy, box.maxY - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [
    { x: a.x + dx * t0, y: a.y + dy * t0 },
    { x: a.x + dx * t1, y: a.y + dy * t1 },
  ];
}

/**
 * Box of a paint's ink inside a rectangular clip: its edges cut to the clip
 * grown by the ink half-width, grown back by it, then cut to the clip. A fill's
 * part inside a band that spans it is bounded by its own edges there.
 */
function inkInRect(p: Paint, rect: Bounds, hw: number): Bounds {
  const reach = padded(rect, hw);
  const cut: SubPath[] = [];
  for (const s of p.subs) {
    const n = s.pts.length;
    const close = s.closed || p.kind === 'fill';
    for (let i = 0; i < (close ? n : n - 1); i++) {
      const piece = clipSegment(s.pts[i], s.pts[(i + 1) % n], reach);
      if (piece) cut.push({ pts: piece, closed: false });
    }
  }
  return intersect(pointsBounds(cut, hw), rect);
}

const padded = (b: Bounds, pad: number): Bounds => ({
  minX: b.minX - pad,
  minY: b.minY - pad,
  maxX: b.maxX + pad,
  maxY: b.maxY + pad,
});

/**
 * Box of every painted point, ink included: each paint's own box (strokes
 * grown by half their width), cut exactly by rectangular clips and to the box
 * of every other clip it was painted under.
 */
function paintInkBounds(paints: readonly Paint[]): Bounds {
  let out = EMPTY;
  for (const p of paints) {
    const hw = p.kind === 'stroke' ? p.lineWidth / 2 : 0;
    let box = pointsBounds(p.subs, hw);
    for (const clip of p.clips) {
      const rect = rectClip(clip);
      box = intersect(box, rect ? inkInRect(p, rect, hw) : pointsBounds(clip, 0));
    }
    if (isEmpty(box)) continue;
    out = {
      minX: Math.min(out.minX, box.minX),
      minY: Math.min(out.minY, box.minY),
      maxX: Math.max(out.maxX, box.maxX),
      maxY: Math.max(out.maxY, box.maxY),
    };
  }
  return out;
}

/** Room left between `ink` and `box` on the tightest side (negative when ink pokes out). */
function spare(ink: Bounds, box: Bounds): number {
  return Math.min(ink.minX - box.minX, ink.minY - box.minY, box.maxX - ink.maxX, box.maxY - ink.maxY);
}

function partPaints(id: RigPartId, appearance: RigAppearance, variant: RigPartVariant = {}): Paint[] {
  const rec = record((ctx) => paintRigPart(ctx, id, appearance, variant));
  expect(rec.depth).toBe(0);
  expect(rec.matrix).toEqual(IDENTITY);
  return rec.paints;
}

// ---------------------------------------------------------------------------
// What to paint
// ---------------------------------------------------------------------------

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

/** Real morphs plus Dream colours that paint patterns, rims, markers and the Iridescent stripe. */
const PALETTES: readonly MorphPalette[] = [
  LEUCISTIC,
  WILD,
  axolotlPalette('melanoid', 'galaxy'),
  axolotlPalette('leucistic', 'iridescent'),
  axolotlPalette('copper', 'rainbow'),
  axolotlPalette('piebald', 'hearts'),
  axolotlPalette('wild', 'tie-dye'),
  axolotlPalette('axanthic', 'tie-dye-galaxy'),
];
const IRIDESCENT = axolotlPalette('leucistic', 'iridescent');
const CRYSTAL_SHINE = axolotlPalette('copper', 'crystal-shine');
/** The sheen Dream colours (isSheenDream), which split the tail round a live stripe. */
const SHEEN_DREAMS = ['iridescent', 'crystal-shine', 'fiesta-shine'] as const satisfies readonly DreamLookId[];
const isSheen = (palette: MorphPalette): boolean => palette.dream !== undefined && isSheenDream(palette.dream.id);

/**
 * Every Boy or girl, Tail, Body and Age (54 looks; size only scales the bake),
 * with the face, gill and spot options cycled so every option shows up.
 */
function everyBodyLook(): AxolotlArtLook[] {
  const looks: AxolotlArtLook[] = [];
  let n = 0;
  for (const sex of AXO_SEXES)
    for (const tail of AXO_TAILS)
      for (const body of AXO_BODIES)
        for (const age of AXO_AGES) {
          looks.push({
            ...DEFAULT_ART_LOOK,
            sex,
            tail,
            body,
            age,
            gills: GILL_STYLE_IDS[Math.floor(n / 3) % GILL_STYLE_IDS.length],
            eyes: EYE_VARIANTS[n % EYE_VARIANTS.length],
            mouth: MOUTH_VARIANTS[n % MOUTH_VARIANTS.length],
            spots: SPOTS_OPTIONS[n % SPOTS_OPTIONS.length],
          });
          n++;
        }
  return looks;
}
const EVERY_BODY_LOOK = everyBodyLook();
const lookId = (look: AxolotlArtLook): string => [look.sex, look.tail, look.body, look.age].join(' ');
const appearanceOf = (look: AxolotlArtLook, n: number, outfit: ArtOutfit = FULL): RigAppearance => ({
  look,
  palette: PALETTES[n % PALETTES.length],
  outfit,
});

const present: LegLook = { status: 'present', progress: 0 };
const lost: LegLook = { status: 'lost', progress: 0 };
const regrowing = (progress: number): LegLook => ({ status: 'regrowing', progress });
const LEG_LOOKS: readonly LegLook[] = [present, lost, regrowing(0.5), regrowing(1)];
const SWIMS = Array.from({ length: 24 }, (_, i) => (i / 24) * TAU);
const ENUMERATION_TIMEOUT_MS = 30_000;

function specOf(parts: readonly RigPartSpec[], id: RigPartId): RigPartSpec {
  const spec = parts.find((p) => p.id === id);
  if (!spec) throw new Error(`no part ${id}`);
  return spec;
}

/** Every variant a part is baked in, for the box checks. */
function variantsOf(spec: RigPartSpec, palette: MorphPalette): RigPartVariant[] {
  if (spec.id.startsWith('leg-') || spec.id.startsWith('wear-leg-')) return LEG_LOOKS.map((leg) => ({ leg }));
  if (spec.id === 'tail') return [{}, { tailLayers: 'under' }];
  if (spec.id === 'tail-over') return [{}];
  if (spec.id === 'body') {
    const sheens = isSheen(palette) ? [0, 0.5, sheenStepValue(SHEEN_STEPS - 1)] : [];
    return [{}, ...sheens.map((sheen) => ({ sheen }))];
  }
  return Array.from({ length: spec.frames }, (_, frame) => ({ frame }));
}

/** Failures where a part's ink leaves its box with under 1 unit to spare. */
function boxFailures(appearance: RigAppearance, label: string): string[] {
  const failures: string[] = [];
  for (const spec of rigParts(appearance)) {
    for (const variant of variantsOf(spec, appearance.palette)) {
      const ink = paintInkBounds(partPaints(spec.id, appearance, variant));
      if (isEmpty(ink)) continue;
      const room = spare(ink, spec.box);
      if (room < 1) failures.push(`${label} ${spec.id} ${JSON.stringify(variant)}: spare ${room.toFixed(3)}`);
    }
  }
  return failures;
}

/** The strip poses plus the still pose: every bent tail the canvas path bakes. */
const BENT_TAIL_POSES = [
  { swimPhase: RIG_STILL_POSE.swimPhase, tailAmp: RIG_STILL_POSE.tailAmp },
  ...TAIL_STRIP_AMPS.flatMap((_, j) => Array.from({ length: TAIL_STRIP_PHASES }, (__, k) => tailStripPose(k, j))),
];

/** Largest |tailShear| over BENT_TAIL_POSES. */
function bentTailMaxDy(look: AxolotlArtLook): number {
  let most = 0;
  for (const p of BENT_TAIL_POSES) for (const d of tailShear(look, p.swimPhase, p.tailAmp)) most = Math.max(most, Math.abs(d));
  return most;
}

function rotateAbout(px: number, py: number, ox: number, oy: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = px - ox;
  const dy = py - oy;
  return [ox + dx * c - dy * s, oy + dx * s + dy * c];
}

/** gillPoints puts this many stem points first. */
const GILL_STEM_POINTS = 11;

interface GillResidual {
  stem: number;
  filament: number;
}

/** Stem points (u = 0 to 1 by 0.1, GILL_STEM_POINTS of them) and filament ends of a gill. */
function gillPoints(g: GillGeometry): [number, number][] {
  const points: [number, number][] = [];
  for (let k = 0; k <= 10; k++) {
    const u = k / 10;
    const m = 1 - u;
    points.push([m * m * g.bx + 2 * u * m * g.cx + u * u * g.tx, m * m * g.by + 2 * u * m * g.cy + u * u * g.ty]);
  }
  for (const f of g.filaments) points.push([f.x1, f.y1], [f.x2, f.y2]);
  return points;
}

const pose = (over: Partial<AxolotlPose>): AxolotlPose => ({ ...RIG_STILL_POSE, ...over });

/** Farthest a point of leg `i` baked at the still angle, turned by `rotation` about its root, lands from the live leg. */
function legResidual(look: AxolotlArtLook, i: number, rotation: number, swimPhase: number): number {
  const geo = axolotlBodyGeometry(look);
  const root = geo.legRoots[i];
  const baked = legPoints(root.x, root.y, legAngle(i, RIG_STILL_POSE.swimPhase), geo.legLengths[i], geo.toeLength);
  const live = legPoints(root.x, root.y, legAngle(i, swimPhase), geo.legLengths[i], geo.toeLength);
  let worst = 0;
  for (let k = 0; k < baked.length; k++) {
    const [x, y] = rotateAbout(baked[k][0], baked[k][1], root.x, root.y, rotation);
    worst = Math.max(worst, Math.hypot(x - live[k][0], y - live[k][1]));
  }
  return worst;
}

const chordAngle = (g: GillGeometry): number => Math.atan2(g.ty - g.by, g.tx - g.bx);

/**
 * Farthest a stem point and a filament point of the gill's placed frame,
 * turned about the root, land from the live gill. Also checks the turn is the chord angle change.
 */
function gillResidual(spec: GillSpec, style: GillStyleId, placed: RigGillPlacement, gillPhase: number): GillResidual {
  const framePhase = RIG_STILL_POSE.gillPhase + (TAU * placed.frame) / GILL_FLUTTER_FRAMES;
  const baked = gillGeometry(spec, style, framePhase);
  const live = gillGeometry(spec, style, gillPhase);
  expect(placed.rotation).toBeCloseTo(chordAngle(live) - chordAngle(baked), 9);
  const bakedPoints = gillPoints(baked);
  const livePoints = gillPoints(live);
  const residual: GillResidual = { stem: 0, filament: 0 };
  for (let k = 0; k < livePoints.length; k++) {
    const [x, y] = rotateAbout(bakedPoints[k][0], bakedPoints[k][1], spec.bx, spec.by, placed.rotation);
    const error = Math.hypot(x - livePoints[k][0], y - livePoints[k][1]);
    if (k < GILL_STEM_POINTS) residual.stem = Math.max(residual.stem, error);
    else residual.filament = Math.max(residual.filament, error);
  }
  return residual;
}

interface ExpectedTwinkle {
  x: number;
  y: number;
  r: number;
}

/** The glints drawAxolotl paints at `live` (regeneration along the tail, then regrowing legs), r >= GLINT_MIN_R. */
function expectedTwinkles(look: AxolotlArtLook, live: AxolotlPose): ExpectedTwinkle[] {
  const geo = axolotlBodyGeometry(look);
  const out: ExpectedTwinkle[] = [];
  const regen = regenGlintSpots(tailSamples(geo.tail, live.swimPhase, live.tailAmp));
  for (let k = 0; k < regen.length; k++) {
    out.push({ x: regen[k][0], y: regen[k][1], r: regenGlintRadius(live.sparkle, live.swimPhase, k) });
  }
  for (let i = 0; i < 4; i++) {
    const leg = live.legs?.[i];
    if (!leg || leg.status !== 'regrowing') continue;
    const spots = legGlintSpots(geo.legRoots[i], legAngle(i, live.swimPhase), geo.legLengths[i]);
    for (let k = 0; k < spots.length; k++) {
      out.push({ x: spots[k][0], y: spots[k][1], r: legGlintRadius(leg.progress, live.swimPhase, i, k) });
    }
  }
  return out.filter((t) => t.r >= GLINT_MIN_R);
}

/**
 * Radius error of a placed twinkle, after checking its centre. Radii below the
 * smallest frame less half a step (GLINT_MIN_R to 0.45) show at 0.6, at most 0.2 too big; they return 0.
 */
function twinkleError(placed: RigTwinkle, expected: ExpectedTwinkle): number {
  expect(placed.x).toBeCloseTo(expected.x, 9);
  expect(placed.y).toBeCloseTo(expected.y, 9);
  const error = Math.abs(TWINKLE_RADII[placed.frame] - expected.r);
  if (expected.r >= TWINKLE_RADII[0] - 0.15) return error;
  expect(error).toBeLessThanOrEqual(TWINKLE_RADII[0] - GLINT_MIN_R + 1e-9);
  return 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rig constants', () => {
  it('bakes at the scenes\' still pose: tail and gills at t = 1.0 s, eyes open', () => {
    expect(RIG_STILL_POSE).toEqual({ swimPhase: (TAU * 1) / 1.2, gillPhase: (TAU * 1) / 0.8, blink: 1, tailAmp: 1, sparkle: 0 });
  });

  it('overlaps the seam by at least the outline width', () => {
    expect(RIG_SEAM_OVERLAP).toBeGreaterThanOrEqual(LW);
    expect(RIG_PAD).toBe(4);
  });

  it('has 13 twinkle radii from 0.6 to 4.2 by 0.3, and a box that holds the biggest', () => {
    expect(TWINKLE_RADII).toHaveLength(13);
    TWINKLE_RADII.forEach((r, i) => expect(r).toBeCloseTo(0.6 + 0.3 * i, 12));
    const ink = paintInkBounds(record((ctx) => paintTwinkleFrame(ctx, TWINKLE_RADII.length - 1)).paints);
    expect(spare(ink, TWINKLE_BOX)).toBeGreaterThanOrEqual(RIG_PAD - 1e-9);
    expect(() => record((ctx) => paintTwinkleFrame(ctx, TWINKLE_RADII.length))).toThrow(RangeError);
  });

  it('steps the sheen in 16 steps, null for the still stripe', () => {
    expect(sheenFrame(undefined)).toBeNull();
    expect(sheenFrame(0)).toBe(0);
    expect(sheenFrame(0.999)).toBe(SHEEN_STEPS - 1);
    expect(sheenFrame(1)).toBe(SHEEN_STEPS - 1);
    expect(sheenFrame(-0.2)).toBe(0);
    expect(sheenFrame(0.5)).toBe(8);
    for (let m = 0; m < SHEEN_STEPS; m++) expect(sheenFrame(sheenStepValue(m))).toBe(m);
    expect(() => sheenFrame(Number.NaN)).toThrow(RangeError);
  });
});

describe('part order and pivots', () => {
  it('lists the parts in the 6a draw order, wear parts only when worn', () => {
    const bare = rigParts(appearanceOf(DEFAULT_ART_LOOK, 0, NO_OUTFIT)).map((p) => p.id);
    expect(bare).toEqual([
      'gill-far-0', 'gill-far-1', 'gill-far-2', 'leg-0', 'leg-1', 'leg-2', 'leg-3', 'body', 'tail',
      'gill-near-0', 'gill-near-1', 'gill-near-2', 'face', 'eyes',
    ]);
    const parts = rigParts(appearanceOf(DEFAULT_ART_LOOK, 0));
    expect(parts.map((p) => p.id)).toEqual([
      'gill-far-0', 'gill-far-1', 'gill-far-2', 'leg-0', 'leg-1', 'wear-leg-0', 'wear-leg-1', 'leg-2', 'leg-3',
      'wear-leg-2', 'wear-leg-3', 'body', 'tail', 'gill-near-0', 'gill-near-1', 'gill-near-2', 'tail-item', 'face',
      'eyes',
    ]);
    const layers = parts.map((p) => p.layer);
    expect([...layers].sort((a, b) => a - b)).toEqual(layers);
    expect(parts.map((p) => p.layer)).toEqual([1, 1, 1, 2, 2, 2.5, 2.5, 3, 3, 3.5, 3.5, 4, 4, 9, 9, 9, 9.2, 9.3, 12]);
    expect(specOf(parts, 'body').topLayer).toBe(8);
    expect(specOf(parts, 'tail-item').topLayer).toBe(9.2);
    expect(specOf(parts, 'face').topLayer).toBe(11.5);
  });

  it('adds the tail-over part (6.5 to 8) right after the tail on a sheen palette only', () => {
    for (const palette of [...PALETTES, CRYSTAL_SHINE]) {
      const parts = rigParts({ look: DEFAULT_ART_LOOK, palette, outfit: FULL });
      const ids = parts.map((p) => p.id);
      const tail = ids.indexOf('tail');
      expect(specOf(parts, 'tail')).toMatchObject({ layer: 4, topLayer: 8 });
      if (!isSheen(palette)) {
        expect(ids, palette.dream?.id ?? 'plain').not.toContain('tail-over');
        continue;
      }
      expect(ids.indexOf('tail-over')).toBe(tail + 1);
      expect(specOf(parts, 'tail-over')).toMatchObject({ layer: 6.5, topLayer: 8, frames: 1 });
      const layers = parts.map((p) => p.layer);
      expect([...layers].sort((a, b) => a - b)).toEqual(layers);
    }
    expect(PALETTES.some(isSheen)).toBe(true);
    expect(isSheen(CRYSTAL_SHINE)).toBe(true);
  });

  it('puts every pivot on the joint drawAxolotl uses, and records it from the box corner', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
    for (const look of EVERY_BODY_LOOK) {
      const geo = axolotlBodyGeometry(look);
      const parts = rigParts({ look, palette: IRIDESCENT, outfit: FULL });
      const gills = [...gillSpecs(look.gills, 'far', geo.gillLength), ...gillSpecs(look.gills, 'near', geo.gillLength)];
      const gillIds: RigPartId[] = ['gill-far-0', 'gill-far-1', 'gill-far-2', 'gill-near-0', 'gill-near-1', 'gill-near-2'];
      for (let i = 0; i < gillIds.length; i++) expect(specOf(parts, gillIds[i]).pivot).toEqual({ x: gills[i].bx, y: gills[i].by });
      for (let i = 0; i < 4; i++) {
        expect(specOf(parts, `leg-${i}` as RigPartId).pivot).toEqual(geo.legRoots[i]);
        const frame = legSlotFrames(look, RIG_STILL_POSE.swimPhase)[i];
        expect(specOf(parts, `wear-leg-${i}` as RigPartId).pivot).toEqual({ x: frame.x, y: frame.y });
      }
      const still = tailSlotFrame(geo.tail, RIG_STILL_POSE.swimPhase, RIG_STILL_POSE.tailAmp);
      expect(specOf(parts, 'tail-item').pivot).toEqual({ x: still.x, y: still.y });
      const tail = specOf(parts, 'tail');
      expect(tail.pivot.x).toBe(geo.tail.rootX);
      expect(tail.pivot.y).toBe(tailSamples(geo.tail, 0, 0)[0].cy);
      const over = specOf(parts, 'tail-over');
      expect(over.pivot).toEqual(tail.pivot);
      expect(over.box).toEqual(tail.box);
      expect(over.pivotOffset).toEqual(tail.pivotOffset);
      for (const spec of parts) {
        expect(spec.pivotOffset.x).toBeCloseTo(spec.pivot.x - spec.box.minX, 12);
        expect(spec.pivotOffset.y).toBeCloseTo(spec.pivot.y - spec.box.minY, 12);
        expect(spec.maxDy).toBe(spec.id === 'tail' || spec.id === 'tail-over' ? tail.maxDy : 0);
      }
    }
  });
});

describe('tail and body seam', () => {
  it('starts the columns at the overlap, then the tail samples, then past the tip', () => {
    for (const look of EVERY_BODY_LOOK) {
      const geo = axolotlBodyGeometry(look);
      const xs = tailColumnXs(look);
      const samples = tailSamples(geo.tail, 0, 0);
      expect(xs).toEqual([geo.tail.rootX + RIG_SEAM_OVERLAP, ...samples.map((tp) => tp.x), samples[samples.length - 1].x - RIG_PAD - LW]);
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeLessThan(xs[i - 1]);
      expect(specOf(rigParts(appearanceOf(look, 0)), 'tail').box.minX).toBeCloseTo(xs[xs.length - 1], 9);
    }
  });

  it('holds the bend at 0 across the overlap and at the root, and copies the tip', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
    for (const look of EVERY_BODY_LOOK) {
      const geo = axolotlBodyGeometry(look);
      for (const swim of SWIMS) {
        for (const amp of [1, 1.2, AXO_MAX_TAIL_AMP]) {
          const dy = tailShear(look, swim, amp);
          const samples = tailSamples(geo.tail, swim, amp);
          expect(dy).toHaveLength(samples.length + 2);
          expect(dy[0]).toBe(0);
          expect(dy[1]).toBe(0);
          const straight = tailSamples(geo.tail, swim, 0);
          for (let i = 0; i < samples.length; i++) expect(dy[i + 1]).toBeCloseTo(samples[i].cy - straight[i].cy, 12);
          expect(dy[dy.length - 1]).toBe(dy[dy.length - 2]);
        }
      }
    }
  });

  it('reaches at least LW past the root on the tail part, and starts the body at the root', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
    for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
      const look = EVERY_BODY_LOOK[n];
      const appearance = appearanceOf(look, n);
      const rootX = axolotlBodyGeometry(look).tail.rootX;
      const parts = rigParts(appearance);
      const tailInk = paintInkBounds(partPaints('tail', appearance));
      const bodyInk = paintInkBounds(partPaints('body', appearance));
      expect(specOf(parts, 'tail').box.maxX).toBeGreaterThanOrEqual(rootX + LW);
      expect(tailInk.maxX).toBeGreaterThanOrEqual(rootX + LW);
      expect(tailInk.maxX).toBeLessThanOrEqual(rootX + RIG_SEAM_OVERLAP + 1e-9);
      expect(specOf(parts, 'body').box.minX).toBeLessThanOrEqual(rootX);
      expect(bodyInk.minX).toBeGreaterThanOrEqual(rootX - 1e-9);
      expect(bodyInk.minX).toBeLessThanOrEqual(rootX + 1e-9);
    }
  });

  it('splits a sheen Dream tail: under then tail-over paint the full tail less its stripe pair, never the sheen', () => {
    for (const palette of [IRIDESCENT, CRYSTAL_SHINE]) {
      const appearance: RigAppearance = { look: DEFAULT_ART_LOOK, palette, outfit: FULL };
      for (const tailPose of [undefined, ...BENT_TAIL_POSES]) {
        const at = tailPose ? { tailPose } : {};
        const all = partPaints('tail', appearance, at);
        const under = partPaints('tail', appearance, { ...at, tailLayers: 'under' });
        const over = partPaints('tail-over', appearance, at);
        expect(under.length).toBeGreaterThan(0);
        expect(over.length).toBeGreaterThan(0);
        expect(under.length + 2 + over.length).toBe(all.length);
        expect(partPaints('tail', appearance, { ...at, sheen: 0.5 })).toEqual(all);
      }
    }
  });
});

describe('part boxes hold all their ink', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
  it('for every look in every variant, with 1 unit to spare', () => {
    const failures = EVERY_BODY_LOOK.flatMap((look, n) => boxFailures(appearanceOf(look, n), lookId(look)));
    expect(failures).toEqual([]);
  });

  it('for every gill style at every Age, eye variant as Boy or girl, and mouth', () => {
    const failures: string[] = [];
    for (const gills of GILL_STYLE_IDS)
      for (const age of AXO_AGES) failures.push(...boxFailures(appearanceOf({ ...DEFAULT_ART_LOOK, gills, age }, 0), `${gills} ${age}`));
    for (const eyes of EYE_VARIANTS)
      for (const sex of AXO_SEXES) failures.push(...boxFailures(appearanceOf({ ...DEFAULT_ART_LOOK, eyes, sex }, 2), `${eyes} ${sex}`));
    for (const mouth of MOUTH_VARIANTS) failures.push(...boxFailures(appearanceOf({ ...DEFAULT_ART_LOOK, mouth }, 1), mouth));
    expect(failures).toEqual([]);
  });

  it('for every bent tail the canvas strip bakes, inside the straight box grown by maxDy', () => {
    const failures: string[] = [];
    for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
      const look = EVERY_BODY_LOOK[n];
      const appearance = appearanceOf(look, n);
      const tail = specOf(rigParts(appearance), 'tail');
      const grown: Bounds = { ...tail.box, minY: tail.box.minY - tail.maxDy, maxY: tail.box.maxY + tail.maxDy };
      for (const tailPose of BENT_TAIL_POSES) {
        const room = spare(paintInkBounds(partPaints('tail', appearance, { tailPose })), grown);
        if (room < 1) failures.push(`${lookId(look)} ${JSON.stringify(tailPose)}: spare ${room.toFixed(3)}`);
      }
      const most = bentTailMaxDy(look);
      expect(tail.maxDy).toBe(most);
    }
    expect(failures).toEqual([]);
  });

  it('for the Iridescent tail under and tail-over parts, straight and at every strip pose', () => {
    const failures: string[] = [];
    let painted = 0;
    for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
      const look = EVERY_BODY_LOOK[n];
      const appearance: RigAppearance = { look, palette: IRIDESCENT, outfit: n % 2 === 0 ? FULL : NO_OUTFIT };
      const parts = rigParts(appearance);
      for (const [id, layers] of [['tail', 'under'], ['tail-over', undefined]] as const) {
        const spec = specOf(parts, id);
        const grown: Bounds = { ...spec.box, minY: spec.box.minY - spec.maxDy, maxY: spec.box.maxY + spec.maxDy };
        for (const tailPose of [undefined, ...BENT_TAIL_POSES]) {
          const variant: RigPartVariant = { ...(tailPose && { tailPose }), ...(layers && { tailLayers: layers }) };
          const ink = paintInkBounds(partPaints(id, appearance, variant));
          if (isEmpty(ink)) continue;
          painted++;
          const room = spare(ink, tailPose ? grown : spec.box);
          if (room < 1) failures.push(`${lookId(look)} ${id} ${JSON.stringify(variant)}: spare ${room.toFixed(3)}`);
        }
      }
    }
    expect(failures).toEqual([]);
    expect(painted).toBe(EVERY_BODY_LOOK.length * 2 * (1 + BENT_TAIL_POSES.length));
  });
});

describe('worn parts', () => {
  const count = (id: RigPartId, appearance: RigAppearance, variant: RigPartVariant = {}): number =>
    partPaints(id, appearance, variant).length;

  it('paint more than bare, the body and tail paint no Wearable, and a lost or regrowing leg wears nothing', () => {
    const worn = appearanceOf(DEFAULT_ART_LOOK, 0);
    const bare = appearanceOf(DEFAULT_ART_LOOK, 0, NO_OUTFIT);
    for (let i = 0; i < 4; i++) {
      const id = `wear-leg-${i}` as RigPartId;
      expect(count(id, worn)).toBeGreaterThan(0);
      expect(count(id, worn, { leg: present })).toBe(count(id, worn));
      expect(count(id, bare)).toBe(0);
      expect(count(id, worn, { leg: lost })).toBe(0);
      expect(count(id, worn, { leg: regrowing(0.99) })).toBe(0);
    }
    expect(count('tail-item', worn)).toBeGreaterThan(0);
    expect(count('tail-item', bare)).toBe(0);
    expect(count('face', worn)).toBeGreaterThan(count('face', bare));
    expect(count('body', worn)).toBe(count('body', bare));
    expect(count('tail', worn)).toBe(count('tail', bare));
  });

  it('rejects frames a part does not have', () => {
    const appearance = appearanceOf(DEFAULT_ART_LOOK, 0);
    expect(() => partPaints('gill-far-0', appearance, { frame: GILL_FLUTTER_FRAMES })).toThrow(RangeError);
    expect(() => partPaints('eyes', appearance, { frame: EYE_FRAME_BLINKS.length })).toThrow(RangeError);
    expect(() => partPaints('eyes', appearance, { frame: 0.5 })).toThrow(RangeError);
  });
});

describe('re-bake keys', () => {
  const base: RigAppearance = { look: DEFAULT_ART_LOOK, palette: LEUCISTIC, outfit: NO_OUTFIT };
  const key = rigAppearanceKey(base, 2);
  const OPTIONS: Readonly<Record<keyof AxolotlArtLook, readonly string[]>> = {
    eyes: EYE_VARIANTS,
    mouth: MOUTH_VARIANTS,
    gills: GILL_STYLE_IDS,
    spots: SPOTS_OPTIONS,
    size: AXO_SIZES,
    sex: AXO_SEXES,
    tail: AXO_TAILS,
    body: AXO_BODIES,
    age: AXO_AGES,
  };

  it('changes on every look field', () => {
    for (const field of Object.keys(DEFAULT_ART_LOOK) as (keyof AxolotlArtLook)[]) {
      for (const value of OPTIONS[field]) {
        if (value === DEFAULT_ART_LOOK[field]) continue;
        const look = { ...DEFAULT_ART_LOOK, [field]: value } as AxolotlArtLook;
        expect(rigAppearanceKey({ ...base, look }, 2), `${field}=${value}`).not.toBe(key);
      }
    }
  });

  it('changes on morph, Dream colour, every outfit slot and scale', () => {
    const keys = new Set<string>();
    for (const palette of Object.values(MORPH_PALETTES)) keys.add(rigAppearanceKey({ ...base, palette }, 2));
    expect(keys.size).toBe(Object.keys(MORPH_PALETTES).length);
    expect(rigAppearanceKey({ ...base, palette: axolotlPalette('leucistic', 'mint') }, 2)).not.toBe(key);
    expect(rigAppearanceKey({ ...base, palette: axolotlPalette('leucistic', 'mint') }, 2)).not.toBe(
      rigAppearanceKey({ ...base, palette: axolotlPalette('leucistic', 'sky-blue') }, 2),
    );
    for (const slot of WEARABLE_SLOTS) {
      expect(rigAppearanceKey({ ...base, outfit: { [slot]: SLUG_OF[slot] } }, 2), slot).not.toBe(key);
    }
    expect(rigAppearanceKey(base, 1)).not.toBe(key);
  });

  it('never reads a pose', () => {
    const withPose = { ...base, ...RIG_STILL_POSE, pose: pose({ swimPhase: 3, blink: 0.12, sheen: 0.4 }) };
    expect(rigAppearanceKey(withPose, 2)).toBe(key);
    expect(rigAppearanceKey({ ...base, look: { ...DEFAULT_ART_LOOK } }, 2)).toBe(key);
  });

  it('keys each leg by its state', () => {
    expect(legStateKey()).toBe('present');
    expect(legStateKey(present)).toBe('present');
    expect(legStateKey({ status: 'present', progress: 0.4 })).toBe('present');
    expect(legStateKey(lost)).toBe('lost');
    expect(legStateKey({ status: 'lost', progress: 0.7 })).toBe('lost');
    expect(legStateKey(regrowing(0.3))).toBe('regrowing:0.3');
    expect(legStateKey(regrowing(0.3))).not.toBe(legStateKey(regrowing(0.4)));
  });
});

describe('canvas tail strip', () => {
  it('picks the strip frame nearest a tail pose', () => {
    for (let j = 0; j < TAIL_STRIP_AMPS.length; j++) {
      for (let k = 0; k < TAIL_STRIP_PHASES; k++) {
        const p = tailStripPose(k, j);
        expect(p.tailAmp).toBe(TAIL_STRIP_AMPS[j]);
        expect(p.swimPhase).toBeCloseTo(RIG_STILL_POSE.swimPhase + (TAU * k) / TAIL_STRIP_PHASES, 12);
        const near = { phaseIndex: k, ampIndex: j, frame: j * TAIL_STRIP_PHASES + k };
        expect(nearestTailStrip(p.swimPhase, p.tailAmp)).toEqual(near);
        expect(nearestTailStrip(p.swimPhase + TAU, p.tailAmp)).toEqual(near);
        expect(nearestTailStrip(p.swimPhase - TAU, p.tailAmp)).toEqual(near);
        const half = TAU / TAIL_STRIP_PHASES / 2;
        expect(nearestTailStrip(p.swimPhase + half * 0.99, p.tailAmp)).toEqual(near);
        expect(nearestTailStrip(p.swimPhase - half * 0.99, p.tailAmp)).toEqual(near);
      }
    }
    const still = RIG_STILL_POSE.swimPhase;
    expect(nearestTailStrip(still, 0).ampIndex).toBe(0);
    expect(nearestTailStrip(still, 1.09).ampIndex).toBe(0);
    expect(nearestTailStrip(still, 1.11).ampIndex).toBe(1);
    expect(nearestTailStrip(still, 1.5).ampIndex).toBe(2);
    expect(nearestTailStrip(still, 3).ampIndex).toBe(2);
  });

  it('knows the still tail', () => {
    const still = RIG_STILL_POSE.swimPhase;
    expect(isStillTail(still, 1)).toBe(true);
    expect(isStillTail(still + TAU, 1)).toBe(true);
    expect(isStillTail(still - TAU, 1)).toBe(true);
    expect(isStillTail(still + 5e-10, 1)).toBe(true);
    expect(isStillTail(still - 5e-10, 1)).toBe(true);
    expect(isStillTail(still + 1e-6, 1)).toBe(false);
    expect(isStillTail(still, AXO_MAX_TAIL_AMP)).toBe(false);
    expect(isStillTail(still, 1.2)).toBe(false);
    expect(isStillTail(0, 1)).toBe(false);
  });
});

describe('placement', () => {
  it('at the still pose turns nothing and shows frame 0 and the still tail', () => {
    for (const renderer of ['webgl', 'canvas'] as const) {
      for (const sheenDream of [null, ...SHEEN_DREAMS]) {
        const placed = rigPlacement(DEFAULT_ART_LOOK, RIG_STILL_POSE, renderer, sheenDream);
        for (const gill of placed.gills) expect(gill).toEqual({ frame: 0, rotation: 0 });
        for (const leg of placed.legs) expect(leg).toEqual({ rotation: 0, stateKey: 'present', wears: true });
        expect(placed.tail.mode).toBe('still');
        expect(placed.tail.frame).toBe(0);
        expect(placed.tail.dy).toEqual(tailShear(DEFAULT_ART_LOOK, RIG_STILL_POSE.swimPhase, 1));
        expect(placed.shownTail).toEqual({ swimPhase: RIG_STILL_POSE.swimPhase, tailAmp: 1 });
        expect(placed.tailItem.rotation).toBe(0);
        expect(placed.eyesFrame).toBe(0);
        expect(placed.sheenFrame).toBeNull();
        expect(placed.stripe.map((band) => band.polygons.length)).toEqual([0, 0]);
        expect(placed.twinkles).toEqual([]);
      }
    }
  });

  it('fills the stripe with tailStripe at the shown tail on a moving sheen Dream tail, else leaves it empty', () => {
    const out = createRigPlacement();
    expect(out.stripe.map((band) => band.polygons.length)).toEqual([0, 0]);
    const filled = new Map<DreamLookId, number>();
    for (const dream of SHEEN_DREAMS) {
      for (const look of [DEFAULT_ART_LOOK, EVERY_BODY_LOOK[EVERY_BODY_LOOK.length - 1]]) {
        const toX = axolotlBodyGeometry(look).tail.rootX + RIG_SEAM_OVERLAP;
        for (const renderer of ['webgl', 'canvas'] as const) {
          for (const live of [pose({ swimPhase: 1.3, tailAmp: 1.4 }), pose({ swimPhase: 4, tailAmp: AXO_MAX_TAIL_AMP, sheen: 0.3 }), pose({ sheen: 0.7 })]) {
            const plain = rigPlacement(look, live, renderer, null, out);
            expect(plain.stripe.map((band) => band.polygons.length)).toEqual([0, 0]);
            const placed = rigPlacement(look, live, renderer, dream, out);
            expect(placed.tail.mode).not.toBe('still');
            const sheen = placed.sheenFrame === null ? undefined : sheenStepValue(placed.sheenFrame);
            const { swimPhase, tailAmp } = placed.shownTail;
            expect(placed.stripe).toEqual(tailStripe(dream, look, swimPhase, tailAmp, sheen, toX));
            filled.set(dream, (filled.get(dream) ?? 0) + (placed.stripe[0].polygons.length > 0 ? 1 : 0));
            expect(rigPlacement(look, RIG_STILL_POSE, renderer, dream, out).stripe.map((band) => band.polygons.length)).toEqual([0, 0]);
          }
        }
      }
    }
    for (const dream of SHEEN_DREAMS) expect(filled.get(dream) ?? 0, dream).toBeGreaterThan(0);
  });

  it('runs tailStripe only when the sheen colour, the look, the shown tail or the sheen step changes', () => {
    const calls = vi.mocked(tailStripe);
    const toX = axolotlBodyGeometry(DEFAULT_ART_LOOK).tail.rootX + RIG_SEAM_OVERLAP;
    const live = pose({ swimPhase: 1.3, tailAmp: 1.4, sheen: 0.3 });
    const nudged = pose({ swimPhase: 1.3 + 1e-3, tailAmp: 1.4, sheen: 0.3, gillPhase: 2 });
    const reSheened = pose({ swimPhase: 1.3 + 1e-3, tailAmp: 1.4, sheen: 0.7 });

    // Canvas: a nudge inside one strip frame shows the same tail, so the stripe is kept as filled.
    const canvas = createRigPlacement();
    calls.mockClear();
    rigPlacement(DEFAULT_ART_LOOK, live, 'canvas', 'iridescent', canvas);
    const shown = { ...canvas.shownTail };
    rigPlacement(DEFAULT_ART_LOOK, nudged, 'canvas', 'iridescent', canvas);
    expect(canvas.shownTail).toEqual(shown);
    expect(calls).toHaveBeenCalledTimes(1);
    rigPlacement(DEFAULT_ART_LOOK, reSheened, 'canvas', 'iridescent', canvas);
    expect(calls).toHaveBeenCalledTimes(2);
    const sheen = sheenStepValue(canvas.sheenFrame ?? 0);
    expect(canvas.stripe).toEqual(tailStripe('iridescent', DEFAULT_ART_LOOK, shown.swimPhase, shown.tailAmp, sheen, toX));

    // WebGL shows the live tail: a new swim phase re-runs it, an unchanged tail and sheen step do not.
    const webgl = createRigPlacement();
    calls.mockClear();
    rigPlacement(DEFAULT_ART_LOOK, live, 'webgl', 'iridescent', webgl);
    rigPlacement(DEFAULT_ART_LOOK, pose({ swimPhase: 1.3, tailAmp: 1.4, sheen: 0.3, gillPhase: 2 }), 'webgl', 'iridescent', webgl);
    expect(calls).toHaveBeenCalledTimes(1);
    rigPlacement(DEFAULT_ART_LOOK, nudged, 'webgl', 'iridescent', webgl);
    expect(calls).toHaveBeenCalledTimes(2);

    // A still tail empties the stripe and forgets it; another look re-runs it.
    rigPlacement(DEFAULT_ART_LOOK, RIG_STILL_POSE, 'webgl', 'iridescent', webgl);
    expect(webgl.stripe.map((band) => band.polygons.length)).toEqual([0, 0]);
    rigPlacement(DEFAULT_ART_LOOK, nudged, 'webgl', 'iridescent', webgl);
    expect(calls).toHaveBeenCalledTimes(3);
    rigPlacement({ ...DEFAULT_ART_LOOK }, nudged, 'webgl', 'iridescent', webgl);
    expect(calls).toHaveBeenCalledTimes(4);

    // Another sheen colour on the same look, tail and sheen step re-runs it in that colour.
    rigPlacement(DEFAULT_ART_LOOK, nudged, 'webgl', 'iridescent', webgl);
    expect(calls).toHaveBeenCalledTimes(5);
    rigPlacement(DEFAULT_ART_LOOK, nudged, 'webgl', 'crystal-shine', webgl);
    expect(calls).toHaveBeenCalledTimes(6);
    const { swimPhase, tailAmp } = webgl.shownTail;
    const step = sheenStepValue(webgl.sheenFrame ?? 0);
    expect(webgl.stripe).toEqual(tailStripe('crystal-shine', DEFAULT_ART_LOOK, swimPhase, tailAmp, step, toX));
  });

  it('bends the tail by renderer, and moves a still sheen Dream sheen off the still tail', () => {
    const live = pose({ swimPhase: 1.3, tailAmp: 1.4 });
    const rope = rigPlacement(DEFAULT_ART_LOOK, live, 'webgl', null);
    expect(rope.tail.mode).toBe('rope');
    expect(rope.shownTail).toEqual({ swimPhase: 1.3, tailAmp: 1.4 });
    expect(rope.tail.dy).toEqual(tailShear(DEFAULT_ART_LOOK, 1.3, 1.4));
    const strip = rigPlacement(DEFAULT_ART_LOOK, live, 'canvas', null);
    const near = nearestTailStrip(1.3, 1.4);
    expect(strip.tail.mode).toBe('strip');
    expect(strip.tail.frame).toBe(near.frame);
    expect(strip.shownTail).toEqual(tailStripPose(near.phaseIndex, near.ampIndex));
    const shimmering = pose({ sheen: 0.3 });
    expect(rigPlacement(DEFAULT_ART_LOOK, shimmering, 'webgl', null).tail.mode).toBe('still');
    expect(rigPlacement(DEFAULT_ART_LOOK, shimmering, 'webgl', 'iridescent').tail.mode).toBe('rope');
    expect(rigPlacement(DEFAULT_ART_LOOK, shimmering, 'canvas', 'iridescent').tail).toMatchObject({ mode: 'strip', frame: 0 });
    expect(rigPlacement(DEFAULT_ART_LOOK, shimmering, 'webgl', 'iridescent').sheenFrame).toBe(sheenFrame(0.3));
    expect(rigPlacement(DEFAULT_ART_LOOK, shimmering, 'webgl', null).sheenFrame).toBeNull();
    expect(rigPlacement(DEFAULT_ART_LOOK, shimmering, 'webgl', 'crystal-shine').tail.mode).toBe('rope');
    expect(rigPlacement(DEFAULT_ART_LOOK, shimmering, 'canvas', 'crystal-shine').tail).toMatchObject({ mode: 'strip', frame: 0 });
    expect(rigPlacement(DEFAULT_ART_LOOK, shimmering, 'webgl', 'crystal-shine').sheenFrame).toBe(sheenFrame(0.3));
  });

  it('picks the nearest eye frame and keys and dresses each leg', () => {
    const blinks: [number, number][] = [[1, 0], [0.8, 0], [0.7, 1], [0.56, 1], [0.3, 2], [0.12, 2]];
    for (const [blink, frame] of blinks) expect(rigPlacement(DEFAULT_ART_LOOK, pose({ blink }), 'webgl', null).eyesFrame).toBe(frame);
    const legs = [present, lost, regrowing(0.5), regrowing(1)];
    const placed = rigPlacement(DEFAULT_ART_LOOK, pose({ legs }), 'webgl', null);
    expect(placed.legs.map((l) => l.stateKey)).toEqual(['present', 'lost', 'regrowing:0.5', 'regrowing:1']);
    expect(placed.legs.map((l) => l.wears)).toEqual([true, false, false, false]);
  });

  it('turns legs and moves the Tail item exactly onto the live drawing', { timeout: ENUMERATION_TIMEOUT_MS }, () => {
    const out = createRigPlacement();
    let worst = 0;
    for (const look of EVERY_BODY_LOOK) {
      const geo = axolotlBodyGeometry(look);
      const still = tailSlotFrame(geo.tail, RIG_STILL_POSE.swimPhase, RIG_STILL_POSE.tailAmp);
      for (const swimPhase of SWIMS) {
        for (const tailAmp of [1, AXO_MAX_TAIL_AMP]) {
          for (const renderer of ['webgl', 'canvas'] as const) {
            const placed = rigPlacement(look, pose({ swimPhase, tailAmp }), renderer, null, out);
            expect(placed).toBe(out);
            for (let i = 0; i < 4; i++) worst = Math.max(worst, legResidual(look, i, placed.legs[i].rotation, swimPhase));
            const shown = renderer === 'webgl' ? { swimPhase, tailAmp } : placed.shownTail;
            const live = tailSlotFrame(geo.tail, shown.swimPhase, shown.tailAmp);
            worst = Math.max(
              worst,
              Math.abs(placed.tailItem.x - live.x),
              Math.abs(placed.tailItem.y - live.y),
              Math.abs(still.angle + placed.tailItem.rotation - live.angle),
            );
          }
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(1e-6);
  });

  // With 10 flutter frames, stems measure 0.46 units and filament ends 1.28 (9 frames: filaments 1.45).
  it('turns each gill frame onto the live gill: stems and filaments within 1.5 units, over 24 phases', () => {
    const worst: GillResidual = { stem: 0, filament: 0 };
    for (const gills of GILL_STYLE_IDS) {
      for (const age of AXO_AGES) {
        const look: AxolotlArtLook = { ...DEFAULT_ART_LOOK, gills, age };
        const geo = axolotlBodyGeometry(look);
        const specs = [...gillSpecs(gills, 'far', geo.gillLength), ...gillSpecs(gills, 'near', geo.gillLength)];
        for (let p = 0; p < 24; p++) {
          const gillPhase = RIG_STILL_POSE.gillPhase + (p / 24) * TAU;
          const placed = rigPlacement(look, pose({ gillPhase }), 'webgl', null);
          for (let i = 0; i < specs.length; i++) {
            const residual = gillResidual(specs[i], gills, placed.gills[i], gillPhase);
            worst.stem = Math.max(worst.stem, residual.stem);
            worst.filament = Math.max(worst.filament, residual.filament);
          }
        }
      }
    }
    expect(worst.stem).toBeLessThanOrEqual(1.5);
    expect(worst.filament).toBeLessThanOrEqual(1.5);
  });

  it('places the regeneration and regrowth twinkles where drawAxolotl paints them, radius within 0.15', () => {
    const out = createRigPlacement();
    let worst = 0;
    for (const look of [DEFAULT_ART_LOOK, EVERY_BODY_LOOK[EVERY_BODY_LOOK.length - 1]]) {
      for (const swimPhase of SWIMS) {
        for (const sparkle of [0, 0.05, 0.1, 0.3, 0.6, 1]) {
          for (const progress of [0, 0.3, 1]) {
            const live = pose({ swimPhase, tailAmp: 1.3, sparkle, legs: [regrowing(progress), present, lost, regrowing(1 - progress)] });
            const placed = rigPlacement(look, live, 'webgl', null, out);
            const shown = expectedTwinkles(look, live);
            expect(placed.twinkles).toHaveLength(shown.length);
            for (let k = 0; k < shown.length; k++) worst = Math.max(worst, twinkleError(placed.twinkles[k], shown[k]));
          }
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(0.15);
  });
});

