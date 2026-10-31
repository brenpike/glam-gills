/**
 * Axolotl rig fidelity (issue #46), headless: the rig's baked parts composed at
 * a live pose the way the glue shows them, against drawAxolotl at the same
 * pose. Gill, leg, wear-leg and Tail item bakes turn about their pivots by
 * rigPlacement's rotations; twinkle frames move to their centres. The tail
 * part on WebGL is the straight bake sheared by tailShear, linear in x between
 * tailColumnXs (what a Rope does); on Canvas it is the strip frame baked at
 * shownTail. A moving Iridescent tail shows as the glue shows it: the tail
 * part baked 'under' (sheared or at the strip pose), then rigPlacement's
 * stripe polygons as unclipped fills, then 'tail-over' the same way as the
 * tail; the still tail is its full still bake. The painters run against a
 * recording context (the stub-Path2D approach of axolotlRig.test.ts, copied
 * here: a test file is never imported), so every fill and stroke is kept as
 * flattened polygons in local units with its clips. drawAxolotl's own
 * recording is cut into its layer painters' runs, each checked equal to that
 * painter recorded alone. The tail parts draw over the body part, so the body
 * shows only past rootX + RIG_SEAM_OVERLAP; a seam guard checks
 * paintBodyLayers there is the same at every tail pose.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  AXO_MAX_TAIL_AMP,
  drawAxolotl,
  paintAxolotlGlints,
  paintAxolotlLeg,
  paintBodyLayers,
  paintEyes,
  paintFaceLayers,
  type AxolotlPose,
  type LegLook,
} from './drawAxolotl';
import {
  AXO_AGES,
  AXO_BODIES,
  AXO_SEXES,
  AXO_TAILS,
  DEFAULT_ART_LOOK,
  EYE_VARIANTS,
  FAR_EYE_ZONE,
  FAR_LASH_REACH,
  GILL_ROOT_ZONE,
  GILL_STYLE_IDS,
  MOUTH_VARIANTS,
  NEAR_EYE_ZONE,
  NEAR_LASH_REACH,
  SPOTS_OPTIONS,
  axolotlBodyGeometry,
  gillSpecs,
  legAngle,
  legSlotFrames,
  paintGill,
  type AxolotlArtLook,
  type Bounds,
  type LocalPoint,
  type WearableSlot,
  type ZoneCircle,
} from './drawAxolotlParts';
import { DREAM_FACE_LIMIT_X, IRIDESCENT_STILL_X, isSheenDream } from './drawDreamOverlay';
import {
  NO_OUTFIT,
  paintBodyWearable,
  paintLegWearables,
  wearsOnLegs,
  type ArtOutfit,
  type WearableArtSlug,
} from './drawWearables';
import {
  DREAM_SLOTS,
  INK,
  LEUCISTIC,
  LW,
  WHITE,
  WILD,
  axolotlPalette,
  type DreamLookId,
  type MorphLookId,
  type MorphPalette,
} from './palette';
import { GLASSES_LENS } from './treasurePalette';
import {
  RIG_SEAM_OVERLAP,
  RIG_STILL_POSE,
  SHEEN_STEPS,
  paintRigPart,
  paintTwinkleFrame,
  rigParts,
  rigPlacement,
  sheenStepValue,
  tailColumnXs,
  type RigAppearance,
  type RigPartId,
  type RigPartSpec,
  type RigPartVariant,
  type RigPlacement,
  type RigRenderer,
  type RigTailPose,
} from './axolotlRigParts';
import type { TailStripe } from './axolotlRigStripe';

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

/** The paints of `draw` against a fresh recorder with Path2D stubbed; it must leave the state as it found it. */
function recordPaints(draw: (ctx: CanvasRenderingContext2D) => void): Paint[] {
  const rec = new Recorder();
  vi.stubGlobal('Path2D', RecPath);
  try {
    draw(rec.context());
  } finally {
    vi.unstubAllGlobals();
  }
  if (rec.depth !== 0 || rec.matrix.some((v, i) => v !== IDENTITY[i])) {
    throw new Error(`painter left save depth ${rec.depth} and matrix ${rec.matrix.join(',')}`);
  }
  return rec.paints;
}

// ---------------------------------------------------------------------------
// Comparing paints
// ---------------------------------------------------------------------------

/** Largest coordinate gap between two runs of subpaths, Infinity when their shapes differ. */
function subsGap(a: readonly SubPath[], b: readonly SubPath[]): number {
  if (a.length !== b.length) return Infinity;
  let worst = 0;
  for (let k = 0; k < a.length; k++) {
    const pa = a[k].pts;
    const pb = b[k].pts;
    if (pa.length !== pb.length || a[k].closed !== b[k].closed) return Infinity;
    for (let i = 0; i < pa.length; i++) worst = Math.max(worst, Math.abs(pa[i].x - pb[i].x), Math.abs(pa[i].y - pb[i].y));
  }
  return worst;
}

/** The points of each subpath at x >= `fromX` (the band a banded part shows). */
function subsFrom(subs: readonly SubPath[], fromX: number): SubPath[] {
  return subs.map((s) => ({ pts: s.pts.filter((p) => p.x >= fromX - 1e-9), closed: s.closed }));
}

/** Same kind, colour, alpha and clip count; a stroke also the same width and cap (a fill reads neither). */
const sameStyle = (a: Paint, b: Paint): boolean =>
  a.kind === b.kind &&
  a.style === b.style &&
  a.alpha === b.alpha &&
  a.clips.length === b.clips.length &&
  (a.kind === 'fill' || (a.lineWidth === b.lineWidth && a.lineCap === b.lineCap));

/**
 * Largest point gap between two paint runs (subpaths and clips), Infinity when
 * a style, count or shape differs. With `fromX`, only points at x >= fromX count.
 */
function paintsGap(a: readonly Paint[], b: readonly Paint[], fromX = -Infinity): number {
  if (a.length !== b.length) return Infinity;
  const cut = (subs: readonly SubPath[]): readonly SubPath[] => (fromX === -Infinity ? subs : subsFrom(subs, fromX));
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    if (!sameStyle(a[i], b[i])) return Infinity;
    worst = Math.max(worst, subsGap(cut(a[i].subs), cut(b[i].subs)));
    for (let c = 0; c < a[i].clips.length; c++) worst = Math.max(worst, subsGap(cut(a[i].clips[c]), cut(b[i].clips[c])));
  }
  return worst;
}

// ---------------------------------------------------------------------------
// drawAxolotl, cut into its layer painters' runs
// ---------------------------------------------------------------------------

/** A drawAxolotl run: rig part ids for the runs one part bakes, 'body-layers' (4 to 8) and 'glints'. */
type DrawnRunId = RigPartId | 'body-layers' | 'glints';

const GILL_PART_IDS: readonly RigPartId[] = [
  'gill-far-0',
  'gill-far-1',
  'gill-far-2',
  'gill-near-0',
  'gill-near-1',
  'gill-near-2',
];
const LEG_PART_IDS: readonly RigPartId[] = ['leg-0', 'leg-1', 'leg-2', 'leg-3'];
const WEAR_LEG_PART_IDS: readonly RigPartId[] = ['wear-leg-0', 'wear-leg-1', 'wear-leg-2', 'wear-leg-3'];

type Painter = (ctx: CanvasRenderingContext2D) => void;

/** drawAxolotl's layer painters in its call order, each named by its run. */
function drawnPainters(pose: AxolotlPose, palette: MorphPalette, look: AxolotlArtLook, outfit: ArtOutfit): [DrawnRunId, Painter][] {
  const geo = axolotlBodyGeometry(look);
  const frames = legSlotFrames(look, pose.swimPhase);
  const steps: [DrawnRunId, Painter][] = [];
  const far = gillSpecs(look.gills, 'far', geo.gillLength);
  const near = gillSpecs(look.gills, 'near', geo.gillLength);
  far.forEach((g, k) =>
    steps.push([GILL_PART_IDS[k], (ctx) => paintGill(ctx, g, look.gills, pose.gillPhase, palette.gillFarStem, palette.gillFarFilament)]),
  );
  const wearLeg = (i: number): [DrawnRunId, Painter] => [
    WEAR_LEG_PART_IDS[i],
    (ctx) => {
      if (wearsOnLegs(outfit) && (pose.legs?.[i]?.status ?? 'present') === 'present') paintLegWearables(ctx, outfit, frames[i]);
    },
  ];
  for (let i = 0; i < 4; i++) {
    steps.push([LEG_PART_IDS[i], (ctx) => paintAxolotlLeg(ctx, look, i, legAngle(i, pose.swimPhase), pose.legs?.[i], palette)]);
    if (i === 1) steps.push(wearLeg(0), wearLeg(1));
    if (i === 3) steps.push(wearLeg(2), wearLeg(3));
  }
  steps.push(['body-layers', (ctx) => paintBodyLayers(ctx, pose, palette, look)]);
  near.forEach((g, k) =>
    steps.push([GILL_PART_IDS[3 + k], (ctx) => paintGill(ctx, g, look.gills, pose.gillPhase, palette.gillNearStem, palette.gillNearFilament)]),
  );
  steps.push(['tail-item', (ctx) => paintBodyWearable(ctx, 'tail', outfit, look, pose.swimPhase, pose.tailAmp)]);
  steps.push(['face', (ctx) => paintFaceLayers(ctx, pose, palette, look, outfit)]);
  steps.push(['eyes', (ctx) => paintEyes(ctx, look, pose.blink, palette)]);
  steps.push(['glints', (ctx) => paintAxolotlGlints(ctx, pose, look)]);
  return steps;
}

/**
 * drawAxolotl's recording cut into runs, one per layer painter in call order.
 * Each run is checked equal to its painter recorded alone, and the runs cover the whole recording.
 */
function drawnRuns(pose: AxolotlPose, palette: MorphPalette, look: AxolotlArtLook, outfit: ArtOutfit): Map<DrawnRunId, Paint[]> {
  const whole = recordPaints((ctx) => drawAxolotl(ctx, pose, palette, look, outfit));
  const runs = new Map<DrawnRunId, Paint[]>();
  let at = 0;
  for (const [id, paint] of drawnPainters(pose, palette, look, outfit)) {
    const alone = recordPaints(paint);
    const run = whole.slice(at, at + alone.length);
    if (paintsGap(run, alone) !== 0) throw new Error(`drawAxolotl run ${id} is not its painter's paints`);
    runs.set(id, run);
    at += alone.length;
  }
  if (at !== whole.length) throw new Error(`drawAxolotl painted ${whole.length - at} paints past its layer painters`);
  return runs;
}

function runOf(runs: ReadonlyMap<DrawnRunId, Paint[]>, id: DrawnRunId): Paint[] {
  const run = runs.get(id);
  if (!run) throw new Error(`no drawAxolotl run ${id}`);
  return run;
}

// ---------------------------------------------------------------------------
// Composing the rig
// ---------------------------------------------------------------------------

type PointMap = (p: Pt) => Pt;

const keep: PointMap = (p) => p;

function mapSubs(subs: readonly SubPath[], f: PointMap): SubPath[] {
  return subs.map((s) => ({ pts: s.pts.map(f), closed: s.closed }));
}

function mapPaint(p: Paint, f: PointMap): Paint {
  return { ...p, subs: mapSubs(p.subs, f), clips: p.clips.map((c) => mapSubs(c, f)) };
}

/** Turn by `angle` about `pivot`, then move the pivot to `to`. */
function turnAbout(pivot: LocalPoint, angle: number, to: LocalPoint = pivot): PointMap {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (p) => {
    const dx = p.x - pivot.x;
    const dy = p.y - pivot.y;
    return { x: to.x + dx * c - dy * s, y: to.y + dx * s + dy * c };
  };
}

/** Rope bend at local x: `dy` linear in x between the columns `xs` (x falls along them), held past both ends. */
function ropeDyAt(xs: readonly number[], dy: readonly number[], x: number): number {
  if (x >= xs[0]) return dy[0];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i + 1]) return dy[i] + ((dy[i + 1] - dy[i]) * (xs[i] - x)) / (xs[i] - xs[i + 1]);
  }
  return dy[dy.length - 1];
}

/** The WebGL rope's vertical shear of the straight tail bake. */
function ropeShear(xs: readonly number[], dy: readonly number[]): PointMap {
  return (p) => ({ x: p.x, y: p.y + ropeDyAt(xs, dy, p.x) });
}

/** A shown part: a rig part, or the Iridescent stripe pair the glue draws live between 'tail' and 'tail-over'. */
type ShownPartId = RigPartId | 'tail-stripe';

/** One part as shown: its paints in local units, and the x band it is clipped to (the tail parts and body only). */
interface ShownPart {
  readonly id: ShownPartId;
  readonly paints: Paint[];
  readonly band: Bounds | null;
}

/** A composed rig at one pose: the placement, the parts in rigParts order, then the twinkle sprites. */
interface Composition {
  readonly placement: RigPlacement;
  readonly parts: ShownPart[];
  readonly twinkles: Paint[][];
}

/** The clip as an axis-aligned box when it is one closed four-corner rectangle (the rig's seam bands), else null. */
function rectClip(clip: readonly SubPath[]): Bounds | null {
  if (clip.length !== 1 || !clip[0].closed || clip[0].pts.length !== 4) return null;
  const pts = clip[0].pts;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    if (a.x !== b.x && a.y !== b.y) return null;
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function bakedPaints(id: RigPartId, appearance: RigAppearance, variant: RigPartVariant): Paint[] {
  return recordPaints((ctx) => paintRigPart(ctx, id, appearance, variant));
}

function shownPart(id: RigPartId, paints: readonly Paint[], f: PointMap): ShownPart {
  return { id, paints: paints.map((p) => mapPaint(p, f)), band: null };
}

/** A tail or body bake: every paint sits under the seam band first; keep the band apart and move the rest. */
function bandedPart(id: RigPartId, paints: readonly Paint[], f: PointMap): ShownPart {
  const band = rectClip(paints[0]?.clips[0] ?? []);
  if (!band) throw new Error(`${id} bake is not under a seam band`);
  for (const p of paints) {
    const own = rectClip(p.clips[0] ?? []);
    if (!own || own.minX !== band.minX || own.maxX !== band.maxX) throw new Error(`${id} paint outside its seam band`);
  }
  return { id, paints: paints.map((p) => mapPaint({ ...p, clips: p.clips.slice(1) }, f)), band };
}

const sheenOf = (placement: RigPlacement): number | undefined =>
  placement.sheenFrame === null ? undefined : sheenStepValue(placement.sheenFrame);

/** The palette's sheen Dream colour (isSheenDream), else null. */
const sheenDreamOf = (palette: MorphPalette): DreamLookId | null =>
  palette.dream !== undefined && isSheenDream(palette.dream.id) ? palette.dream.id : null;

/** Whether the tail shows split round the live stripe: a sheen Dream tail that is not 'still'. */
const splitsTail = (appearance: RigAppearance, placement: RigPlacement): boolean =>
  sheenDreamOf(appearance.palette) !== null && placement.tail.mode !== 'still';

/** How the tail parts show: the pose they are baked at (none: straight, for the rope) and the map onto the live drawing. */
function tailView(appearance: RigAppearance, placement: RigPlacement): { variant: RigPartVariant; f: PointMap } {
  if (placement.tail.mode === 'rope') return { variant: {}, f: ropeShear(tailColumnXs(appearance.look), placement.tail.dy) };
  const tailPose: RigTailPose = { swimPhase: placement.shownTail.swimPhase, tailAmp: placement.shownTail.tailAmp };
  return { variant: { tailPose }, f: keep };
}

/** A flat [x0, y0, x1, y1, ...] polygon as a closed subpath. */
function polygonSub(poly: readonly number[]): SubPath {
  const pts: Pt[] = [];
  for (let i = 0; i < poly.length; i += 2) pts.push({ x: poly[i], y: poly[i + 1] });
  return { pts, closed: true };
}

/** One stripe band as an unclipped fill of its run polygons. */
function stripeBandPaint(band: TailStripe[number]): Paint {
  return {
    kind: 'fill',
    style: `#${band.colour.toString(16).padStart(6, '0')}`,
    lineWidth: 1,
    alpha: band.alpha,
    lineCap: 'round',
    subs: band.polygons.map(polygonSub),
    clips: [],
  };
}

/** The live stripe pair as unclipped fills, white band first. */
function stripePart(stripe: TailStripe): ShownPart {
  return { id: 'tail-stripe', paints: stripe.map(stripeBandPaint), band: null };
}

/** The tail as shown: the full bake; or, split, the 'under' bake then the live stripe pair. */
function showTail(appearance: RigAppearance, placement: RigPlacement): ShownPart[] {
  const { variant, f } = tailView(appearance, placement);
  if (!splitsTail(appearance, placement)) return [bandedPart('tail', bakedPaints('tail', appearance, variant), f)];
  return [
    bandedPart('tail', bakedPaints('tail', appearance, { ...variant, tailLayers: 'under' }), f),
    stripePart(placement.stripe),
  ];
}

/** 'tail-over' as shown: like the tail when split, and hidden on a still tail. */
function showTailOver(appearance: RigAppearance, placement: RigPlacement): ShownPart[] {
  if (!splitsTail(appearance, placement)) return [];
  const { variant, f } = tailView(appearance, placement);
  return [bandedPart('tail-over', bakedPaints('tail-over', appearance, variant), f)];
}

/** One part shown at the placement: turned about its pivot, bent, or as baked (the tail parts may show as none or two). */
function showPart(spec: RigPartSpec, appearance: RigAppearance, live: AxolotlPose, placement: RigPlacement): ShownPart[] {
  const { id, pivot } = spec;
  const gill = GILL_PART_IDS.indexOf(id);
  if (gill >= 0) {
    const g = placement.gills[gill];
    return [shownPart(id, bakedPaints(id, appearance, { frame: g.frame }), turnAbout(pivot, g.rotation))];
  }
  const leg = Math.max(LEG_PART_IDS.indexOf(id), WEAR_LEG_PART_IDS.indexOf(id));
  if (leg >= 0) {
    const turn = turnAbout(pivot, placement.legs[leg].rotation);
    return [shownPart(id, bakedPaints(id, appearance, { leg: live.legs?.[leg] }), turn)];
  }
  switch (id) {
    case 'tail':
      return showTail(appearance, placement);
    case 'tail-over':
      return showTailOver(appearance, placement);
    case 'body':
      return [bandedPart(id, bakedPaints(id, appearance, { sheen: sheenOf(placement) }), keep)];
    case 'tail-item': {
      const item = placement.tailItem;
      return [shownPart(id, bakedPaints(id, appearance, {}), turnAbout(pivot, item.rotation, item))];
    }
    case 'eyes':
      return [shownPart(id, bakedPaints(id, appearance, { frame: placement.eyesFrame }), keep)];
    default:
      return [shownPart(id, bakedPaints(id, appearance, {}), keep)];
  }
}

/** The tail parts and the body, which every tail check composes. */
const TAIL_AND_BODY: readonly RigPartId[] = ['tail', 'tail-over', 'body'];

/** Compose the rig at `live` on `renderer`: every part (or only those in `only`) and every twinkle. */
function composeRig(
  appearance: RigAppearance,
  live: AxolotlPose,
  renderer: RigRenderer,
  only?: readonly RigPartId[],
): Composition {
  const placement = rigPlacement(appearance.look, live, renderer, sheenDreamOf(appearance.palette));
  const parts = rigParts(appearance)
    .filter((spec) => !only || only.includes(spec.id))
    .flatMap((spec) => showPart(spec, appearance, live, placement));
  const twinkles = placement.twinkles.map((t) =>
    recordPaints((ctx) => paintTwinkleFrame(ctx, t.frame)).map((p) => mapPaint(p, (q) => ({ x: q.x + t.x, y: q.y + t.y }))),
  );
  return { placement, parts, twinkles };
}

function partOf(composition: Composition, id: ShownPartId): ShownPart {
  const part = composition.parts.find((p) => p.id === id);
  if (!part) throw new Error(`no shown part ${id}`);
  return part;
}

const hasPart = (composition: Composition, id: ShownPartId): boolean => composition.parts.some((p) => p.id === id);

/** The shown tail parts and body, in draw order. */
const tailAndBody = (composition: Composition): ShownPart[] =>
  composition.parts.filter((p) => p.id === 'tail' || p.id === 'tail-over' || p.id === 'body');

/**
 * The x band where a banded part shows: a tail part's whole band; the body's
 * only past rootX + RIG_SEAM_OVERLAP (its band starts at rootX), as the tail parts draw over the overlap.
 */
function shownBand(part: ShownPart): Bounds | null {
  if (part.id !== 'body' || !part.band) return part.band;
  return { ...part.band, minX: part.band.minX + RIG_SEAM_OVERLAP };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

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

const inBand = (band: Bounds | null, x: number): boolean => !band || (x >= band.minX && x <= band.maxX);

/** Whether a fill of `paint` covers (x, y): inside its own subpaths, every clip and its part's band. */
function fillCovers(paint: Paint, band: Bounds | null, x: number, y: number): boolean {
  if (!inBand(band, x) || winding(paint.subs, x, y) === 0) return false;
  return paint.clips.every((clip) => winding(clip, x, y) !== 0);
}

/** Per integer x, the lowest and highest y where the edges of `subs` (closed) cross it, for x in [fromX, toX]. */
type Envelope = Map<number, { min: number; max: number }>;

function addEnvelope(env: Envelope, subs: readonly SubPath[], fromX: number, toX: number): void {
  const put = (x: number, y: number): void => {
    const e = env.get(x);
    if (!e) env.set(x, { min: y, max: y });
    else {
      e.min = Math.min(e.min, y);
      e.max = Math.max(e.max, y);
    }
  };
  for (const s of subs) {
    const n = s.pts.length;
    for (let i = 0; i < n; i++) {
      const a = s.pts[i];
      const b = s.pts[(i + 1) % n];
      const lo = Math.max(Math.ceil(Math.min(a.x, b.x)), Math.ceil(fromX));
      const hi = Math.min(Math.floor(Math.max(a.x, b.x)), Math.floor(toX));
      for (let x = lo; x <= hi; x++) {
        if (a.x === b.x) {
          put(x, a.y);
          put(x, b.y);
        } else put(x, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
      }
    }
  }
}

/** Largest gap between two envelopes, Infinity when they cover different x. */
function envelopeGap(a: Envelope, b: Envelope): number {
  if (a.size !== b.size) return Infinity;
  let worst = 0;
  for (const [x, ea] of a) {
    const eb = b.get(x);
    if (!eb) return Infinity;
    worst = Math.max(worst, Math.abs(ea.min - eb.min), Math.abs(ea.max - eb.max));
  }
  return worst;
}

/** The layer 4 silhouette ink: the 2 LW ink stroke round tail, torso and head (three subpaths). */
const isSilhouette = (p: Paint): boolean => p.kind === 'stroke' && p.style === INK && p.lineWidth === 2 * LW && p.subs.length === 3;

/** The silhouette ink in a run of paints: the first paint of a body bake, the first such stroke of drawAxolotl. */
function silhouetteOf(paints: readonly Paint[], label: string): Paint {
  const sil = paints.find(isSilhouette);
  if (!sil) throw new Error(`${label}: no silhouette ink`);
  return sil;
}

/** Envelope of the composed silhouette ink: the tail part's (bent) within its band, the body part's where it shows. */
function composedSilhouette(composition: Composition): Envelope {
  const env: Envelope = new Map();
  for (const id of ['tail', 'body'] as const) {
    const part = partOf(composition, id);
    const band = shownBand(part)!;
    addEnvelope(env, silhouetteOf(part.paints, id).subs, band.minX, band.maxX);
  }
  return env;
}

/** Envelope of drawAxolotl's silhouette ink in `paints` (its whole recording or its layer 4 to 8 run). */
function drawnSilhouette(paints: readonly Paint[]): Envelope {
  const env: Envelope = new Map();
  addEnvelope(env, silhouetteOf(paints, 'drawAxolotl').subs, -Infinity, Infinity);
  return env;
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
/** One item in every slot. */
const FULL: ArtOutfit = { ...SLUG_OF };

/** The twelve Dream colours, in the guide 3f order. */
const DREAM_IDS = Object.keys(DREAM_SLOTS) as DreamLookId[];
const MORPHS: readonly MorphLookId[] = ['leucistic', 'wild', 'melanoid', 'copper', 'axanthic', 'piebald'];

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

const present: LegLook = { status: 'present', progress: 0 };
const lost: LegLook = { status: 'lost', progress: 0 };
const regrowing = (progress: number): LegLook => ({ status: 'regrowing', progress });
/** Leg looks per pose: all present (undefined), and mixes of lost and regrowing (0.02 is below the fill). */
const LEG_SETS: readonly (readonly LegLook[] | undefined)[] = [
  undefined,
  [lost, regrowing(0.3), present, regrowing(1)],
  [regrowing(0.02), present, lost, regrowing(0.6)],
  [present, lost, regrowing(0.8), lost],
];

const pose = (over: Partial<AxolotlPose>): AxolotlPose => ({ ...RIG_STILL_POSE, ...over });
const STILL_SWIM = RIG_STILL_POSE.swimPhase;
const STILL_GILL = RIG_STILL_POSE.gillPhase;
/** Swim phases of the envelope sweep: four quarter turns and the still phase. */
const SWIMS: readonly number[] = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, STILL_SWIM];
const GILL_PHASES: readonly number[] = [0, Math.PI, STILL_GILL];
const AMPS: readonly number[] = [1, 1.2, AXO_MAX_TAIL_AMP];
const RENDERERS: readonly RigRenderer[] = ['webgl', 'canvas'];

/** The pose drawAxolotl must match for the tail: the live pose on WebGL, the shown strip pose on Canvas. */
const shownPose = (live: AxolotlPose, composition: Composition): AxolotlPose => ({
  ...live,
  swimPhase: composition.placement.shownTail.swimPhase,
  tailAmp: composition.placement.shownTail.tailAmp,
});

const EXACT = 1e-6;
/** Envelope tolerance in local units (assertion family a). */
const ENVELOPE_TOL = 1;
const TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// (a) Silhouette envelope
// ---------------------------------------------------------------------------

describe('silhouette envelope against drawAxolotl', { timeout: TIMEOUT_MS }, () => {
  it('bends the rope tail within 1.0 of drawAxolotl on WebGL, and matches the strip pose exactly on Canvas', () => {
    const worst: Record<RigRenderer, { gap: number; at: string }> = {
      webgl: { gap: 0, at: '' },
      canvas: { gap: 0, at: '' },
    };
    for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
      const look = EVERY_BODY_LOOK[n];
      const appearance: RigAppearance = { look, palette: LEUCISTIC, outfit: NO_OUTFIT };
      for (const swimPhase of SWIMS) {
        for (const tailAmp of AMPS) {
          const gillPhase = GILL_PHASES[(n + AMPS.indexOf(tailAmp)) % GILL_PHASES.length];
          const live = pose({ swimPhase, gillPhase, tailAmp });
          for (const renderer of RENDERERS) {
            const composed = composeRig(appearance, live, renderer, ['tail', 'body']);
            const drawn = recordPaints((ctx) => drawAxolotl(ctx, shownPose(live, composed), LEUCISTIC, look, NO_OUTFIT));
            const gap = envelopeGap(composedSilhouette(composed), drawnSilhouette(drawn));
            if (gap > worst[renderer].gap) worst[renderer] = { gap, at: `${lookId(look)} swim ${swimPhase.toFixed(3)} amp ${tailAmp}` };
          }
        }
      }
    }
    // Measured (ADR 0013): WebGL rope 0.928 units (Girl Short Chubby Baby, still swim phase, amplitude
    // 1.6), where the rope also bends the torso's back end behind the tail root; Canvas strip 0.
    expect(worst.webgl.gap, worst.webgl.at).toBeLessThanOrEqual(ENVELOPE_TOL);
    expect(worst.canvas.gap, worst.canvas.at).toBeLessThanOrEqual(EXACT);
  });

  it('turns the gill frames without moving the silhouette: the gill phase never reaches the envelope', () => {
    const look = EVERY_BODY_LOOK[EVERY_BODY_LOOK.length - 1];
    const appearance: RigAppearance = { look, palette: LEUCISTIC, outfit: NO_OUTFIT };
    const envelopes = GILL_PHASES.map((gillPhase) =>
      composedSilhouette(composeRig(appearance, pose({ swimPhase: 1.1, gillPhase, tailAmp: 1.2 }), 'webgl', ['tail', 'body'])),
    );
    for (const env of envelopes) expect(envelopeGap(env, envelopes[0])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (b) Legs, wear legs, Tail item and twinkles
// ---------------------------------------------------------------------------

/** paintTwinkle paints five paints per twinkle, the horizontal arm's ink stroke first. */
const TWINKLE_PAINTS = 5;
/** Regeneration glints along the tail (REGEN_GLINT_S); at sparkle 0.5 or more every one is painted. */
const REGEN_GLINTS = 5;

/** Centres of the twinkles in a run of paintTwinkle paints: the midpoint of each horizontal arm. */
function twinkleCentres(paints: readonly Paint[]): Pt[] {
  if (paints.length % TWINKLE_PAINTS !== 0) throw new Error(`${paints.length} paints are not whole twinkles`);
  const centres: Pt[] = [];
  for (let k = 0; k < paints.length; k += TWINKLE_PAINTS) {
    const [a, b] = paints[k].subs[0].pts;
    centres.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return centres;
}

const pointGap = (a: Pt, b: Pt): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

interface PlacementGaps {
  legs: number;
  wear: number;
  tailItem: number;
  twinkles: number;
  /** Lost and regrowing legs met, and how many of them had an empty wear part. */
  lost: number;
  regrowing: number;
  bareWear: number;
}

/** Twinkle centres drawAxolotl paints: regeneration glints along the shown tail, then the regrowing legs' at the live pose. */
function drawnTwinkles(drawnShown: ReadonlyMap<DrawnRunId, Paint[]>, drawnLive: ReadonlyMap<DrawnRunId, Paint[]>): Pt[] {
  return [
    ...twinkleCentres(runOf(drawnShown, 'glints')).slice(0, REGEN_GLINTS),
    ...twinkleCentres(runOf(drawnLive, 'glints')).slice(REGEN_GLINTS),
  ];
}

/** Largest gap of the placed twinkles and their composed sprites from drawAxolotl's, Infinity when the counts differ. */
function twinkleGap(composed: Composition, expected: readonly Pt[]): number {
  const placed = composed.placement.twinkles;
  if (placed.length !== expected.length || composed.twinkles.length !== expected.length) return Infinity;
  let worst = 0;
  for (let k = 0; k < expected.length; k++) {
    const sprite = twinkleCentres(composed.twinkles[k])[0];
    worst = Math.max(worst, pointGap(placed[k], expected[k]), pointGap(sprite, expected[k]));
  }
  return worst;
}

const PLACED_PARTS: readonly RigPartId[] = [...LEG_PART_IDS, ...WEAR_LEG_PART_IDS, 'tail-item'];

/** Compare the legs, wear legs, Tail item and twinkles of the rig at `live` with drawAxolotl, on both renderers. */
function addPlacementGaps(gaps: PlacementGaps, appearance: RigAppearance, live: AxolotlPose): void {
  const { look, palette, outfit } = appearance;
  const drawnLive = drawnRuns(live, palette, look, outfit);
  for (const renderer of RENDERERS) {
    const composed = composeRig(appearance, live, renderer, PLACED_PARTS);
    const drawnShown = renderer === 'webgl' ? drawnLive : drawnRuns(shownPose(live, composed), palette, look, outfit);
    for (let i = 0; i < 4; i++) {
      const status = live.legs?.[i]?.status ?? 'present';
      if (status === 'lost') gaps.lost++;
      if (status === 'regrowing') gaps.regrowing++;
      gaps.legs = Math.max(gaps.legs, paintsGap(partOf(composed, LEG_PART_IDS[i]).paints, runOf(drawnLive, LEG_PART_IDS[i])));
      const wear = partOf(composed, WEAR_LEG_PART_IDS[i]).paints;
      gaps.wear = Math.max(gaps.wear, paintsGap(wear, runOf(drawnLive, WEAR_LEG_PART_IDS[i])));
      if (status !== 'present' && wear.length === 0) gaps.bareWear++;
    }
    gaps.tailItem = Math.max(gaps.tailItem, paintsGap(partOf(composed, 'tail-item').paints, runOf(drawnShown, 'tail-item')));
    gaps.twinkles = Math.max(gaps.twinkles, twinkleGap(composed, drawnTwinkles(drawnShown, drawnLive)));
  }
}

describe('legs, wear legs, Tail item and twinkles against drawAxolotl', { timeout: TIMEOUT_MS }, () => {
  it('lands every turned leg and wear leg, the Tail item and every twinkle exactly where drawAxolotl paints them', () => {
    const worst: PlacementGaps = { legs: 0, wear: 0, tailItem: 0, twinkles: 0, lost: 0, regrowing: 0, bareWear: 0 };
    for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
      const appearance: RigAppearance = { look: EVERY_BODY_LOOK[n], palette: PALETTES[n % PALETTES.length], outfit: FULL };
      for (let s = 0; s < SWIMS.length; s++) {
        const legs = LEG_SETS[(n + s) % LEG_SETS.length];
        const tailAmp = AMPS[(n + s) % AMPS.length];
        addPlacementGaps(worst, appearance, pose({ swimPhase: SWIMS[s], tailAmp, sparkle: 0.6, legs, gillPhase: 0 }));
      }
    }
    expect(worst.lost).toBeGreaterThan(0);
    expect(worst.regrowing).toBeGreaterThan(0);
    expect(worst.bareWear).toBe(worst.lost + worst.regrowing);
    // Measured: legs 2.1e-14, wear legs 1.4e-14, Tail item 1.4e-14, twinkles 7.1e-15 units (float noise).
    expect(worst.legs).toBeLessThanOrEqual(EXACT);
    expect(worst.wear).toBeLessThanOrEqual(EXACT);
    expect(worst.tailItem).toBeLessThanOrEqual(EXACT);
    expect(worst.twinkles).toBeLessThanOrEqual(EXACT);
  });
});

// ---------------------------------------------------------------------------
// (c) Keep-clear with a full outfit
// ---------------------------------------------------------------------------

/** Region reach slack, as wearableArt.test.ts measures keep-clear zones. */
const TOL = 0.005;

/** The painted region as the checks see it: a clipped paint counts as its last clip (a superset). */
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

/** The paints `withOutfit` has beyond `base`, or null when `base` is not a subsequence of it. */
function insertedPaints(base: readonly Paint[], withOutfit: readonly Paint[]): Paint[] | null {
  const baseSigs = base.map(signature);
  const extra: Paint[] = [];
  let b = 0;
  for (const paint of withOutfit) {
    if (b < baseSigs.length && signature(paint) === baseSigs[b]) b++;
    else extra.push(paint);
  }
  return b === baseSigs.length ? extra : null;
}

/** One Wearable paint of a composed rig, with the zones it must keep clear of. */
interface WearPaint {
  readonly part: RigPartId;
  readonly paint: Paint;
  /** Painted over the silhouette (layer 4 or later), so it must keep off the gill-root zone too. */
  readonly overSilhouette: boolean;
  /** The Heart glasses reach into the lash reach on purpose (the eyes paint over them); every other item keeps off it. */
  readonly lashes: boolean;
}

function insertedOrThrow(base: ShownPart, worn: ShownPart): Paint[] {
  const inserted = insertedPaints(base.paints, worn.paints);
  if (!inserted) throw new Error(`a Wearable moved or changed a ${worn.id} paint`);
  return inserted;
}

/**
 * Every Wearable paint of the rig composed at `live` in `outfit`: the wear-leg
 * and Tail item parts whole, and what the outfit adds to the tail, tail-over
 * (when shown), body and face parts.
 */
function wearPaints(appearance: RigAppearance, live: AxolotlPose, renderer: RigRenderer): { composed: Composition; wear: WearPaint[] } {
  const composed = composeRig(appearance, live, renderer);
  const bare = composeRig({ ...appearance, outfit: NO_OUTFIT }, live, renderer, [...TAIL_AND_BODY, 'face']);
  const noGlasses = composeRig({ ...appearance, outfit: { ...appearance.outfit, face: null } }, live, renderer, ['face']);
  const wear: WearPaint[] = [];
  const add = (part: RigPartId, paints: readonly Paint[], overSilhouette: boolean, lashes: boolean): void => {
    for (const paint of paints) wear.push({ part, paint, overSilhouette, lashes });
  };
  for (const id of WEAR_LEG_PART_IDS) add(id, partOf(composed, id).paints, false, true);
  add('tail-item', partOf(composed, 'tail-item').paints, true, true);
  for (const id of TAIL_AND_BODY) {
    if (hasPart(composed, id)) add(id, insertedOrThrow(partOf(bare, id), partOf(composed, id)), true, true);
  }
  add('face', insertedOrThrow(partOf(bare, 'face'), partOf(noGlasses, 'face')), true, true);
  add('face', insertedOrThrow(partOf(noGlasses, 'face'), partOf(composed, 'face')), true, false);
  return { composed, wear };
}

const EYE_ZONES: readonly ZoneCircle[] = [NEAR_EYE_ZONE, FAR_EYE_ZONE];
const LASH_ZONES: readonly ZoneCircle[] = [NEAR_LASH_REACH, FAR_LASH_REACH];

/** Why a Wearable paint is not clear, or null. The clear lens tint is the one paint allowed over the eyes. */
function trouble(w: WearPaint): string | null {
  const region = regionOf(w.paint);
  if (w.paint.kind === 'fill' && w.paint.style === GLASSES_LENS) return null;
  if (EYE_ZONES.some((z) => reachesCircle(region, z))) return 'eye zone';
  if (w.lashes && LASH_ZONES.some((z) => reachesCircle(region, z))) return 'lash reach';
  if (w.overSilhouette && reachesBox(region, GILL_ROOT_ZONE)) return 'gill-root zone';
  return null;
}

describe('keep-clear on the composed rig with a full outfit', { timeout: TIMEOUT_MS }, () => {
  it('keeps every Wearable off the eyes and lash reach, and over the silhouette off the gill roots; eyes paint last', () => {
    const failures: string[] = [];
    const perPart = new Map<RigPartId, number>();
    for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
      const look = EVERY_BODY_LOOK[n];
      const appearance: RigAppearance = { look, palette: PALETTES[n % PALETTES.length], outfit: FULL };
      const poses: [AxolotlPose, RigRenderer][] = [
        [pose({ swimPhase: SWIMS[n % SWIMS.length], tailAmp: AXO_MAX_TAIL_AMP, gillPhase: 0 }), 'webgl'],
        [pose({ swimPhase: SWIMS[(n + 2) % SWIMS.length], tailAmp: 1.2, gillPhase: Math.PI }), 'canvas'],
      ];
      for (const [live, renderer] of poses) {
        const { composed, wear } = wearPaints(appearance, live, renderer);
        for (const w of wear) {
          perPart.set(w.part, (perPart.get(w.part) ?? 0) + 1);
          const why = trouble(w);
          if (why) failures.push(`${lookId(look)} ${renderer} ${w.part} ${w.paint.kind} ${w.paint.style}: ${why}`);
        }
        const ids = composed.parts.map((p) => p.id);
        const eyes = ids.indexOf('eyes');
        expect(eyes).toBe(ids.length - 1);
        for (const w of wear) expect(ids.indexOf(w.part)).toBeLessThan(eyes);
        expect(partOf(composed, 'eyes').paints.length).toBeGreaterThan(0);
      }
    }
    expect(failures).toEqual([]);
    for (const id of [...WEAR_LEG_PART_IDS, 'tail-item', 'face'] as const) expect(perPart.get(id) ?? 0, id).toBeGreaterThan(0);
    for (const id of TAIL_AND_BODY) expect(perPart.get(id) ?? 0, id).toBe(0);
  });

  it('paints nothing on a lost or regrowing leg\'s wear part', () => {
    const legs = [lost, regrowing(0.4), present, regrowing(1)];
    for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
      const appearance: RigAppearance = { look: EVERY_BODY_LOOK[n], palette: LEUCISTIC, outfit: FULL };
      for (const renderer of RENDERERS) {
        const composed = composeRig(appearance, pose({ swimPhase: SWIMS[n % SWIMS.length], legs }), renderer, [
          ...LEG_PART_IDS,
          ...WEAR_LEG_PART_IDS,
        ]);
        expect(composed.placement.legs.map((l) => l.wears)).toEqual([false, false, true, false]);
        expect(WEAR_LEG_PART_IDS.map((id) => partOf(composed, id).paints.length > 0)).toEqual([false, false, true, false]);
        for (const id of LEG_PART_IDS) expect(partOf(composed, id).paints.length, id).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// (d) Dream colours
// ---------------------------------------------------------------------------

/** Dream pattern paints sit under the silhouette, the inset clip polygons and the face limit: three clips. */
const PATTERN_CLIPS = 3;

const patternPaints = (paints: readonly Paint[]): Paint[] => paints.filter((p) => p.clips.length === PATTERN_CLIPS);

/** A Dream marker star: an unclipped white 8-point fill (the pattern's white stars are clipped). */
const isMarker = (p: Paint): boolean =>
  p.kind === 'fill' && p.style === WHITE && p.clips.length === 0 && p.subs.length === 1 && p.subs[0].pts.length === 8;

function centroid(pts: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/** Marker centres the composed rig shows: each tail part's and the body's markers whose centre lies where it shows. */
function composedMarkers(composition: Composition): Pt[] {
  return tailAndBody(composition).flatMap((part) => {
    const band = shownBand(part);
    return part.paints
      .filter(isMarker)
      .map((p) => centroid(p.subs[0].pts))
      .filter((c) => inBand(band, c.x));
  });
}

const drawnMarkers = (runs: ReadonlyMap<DrawnRunId, Paint[]>): Pt[] =>
  runOf(runs, 'body-layers')
    .filter(isMarker)
    .map((p) => centroid(p.subs[0].pts));

/** Whether (x, y) is inside the composed silhouette: the tail part's within its band, or the body part's where it shows. */
function insideComposedSilhouette(composition: Composition, x: number, y: number): boolean {
  return (['tail', 'body'] as const).some((id) => {
    const part = partOf(composition, id);
    return inBand(shownBand(part), x) && winding(silhouetteOf(part.paints, id).subs, x, y) !== 0;
  });
}

/** Distance from (x, y) to the nearest silhouette edge of the composed tail and body parts. */
function composedSilhouetteDistance(composition: Composition, x: number, y: number): number {
  let best = Infinity;
  for (const id of ['tail', 'body'] as const) {
    for (const sub of silhouetteOf(partOf(composition, id).paints, id).subs) {
      for (let i = 0; i < sub.pts.length; i++) best = Math.min(best, segmentDistance(sub.pts[i], sub.pts[(i + 1) % sub.pts.length], x, y));
    }
  }
  return best;
}

/** Distance from (x, y) to the segment a-b. */
function segmentDistance(a: Pt, b: Pt, x: number, y: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2));
  return Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
}

/**
 * Whether a shown pattern sample leaks: outside the composed silhouette, and
 * for the live stripe also more than STRIPE_TOL from its edge. The live stripe
 * of a sheen colour with no inset (Crystal shine) is cut on the Dream clip
 * polygon itself, whose tail edges are chords between tail samples where
 * drawAxolotl's silhouette curves, so its corners sit on or just past the edge
 * (measured: at most 0.0023 units past it, on both renderers).
 */
function leaksAt(composition: Composition, part: ShownPart, q: Pt): boolean {
  if (insideComposedSilhouette(composition, q.x, q.y)) return false;
  return part.id !== 'tail-stripe' || composedSilhouetteDistance(composition, q.x, q.y) > STRIPE_TOL;
}

/** Sample points of a pattern paint: its points and each subpath's centroid. */
const patternSamples = (p: Paint): Pt[] => p.subs.flatMap((s) => [...s.pts, centroid(s.pts)]);

/** The pattern paints of a shown part: the clipped pattern of a bake, or every live stripe band. */
const shownPatternPaints = (part: ShownPart): Paint[] => (part.id === 'tail-stripe' ? part.paints : patternPaints(part.paints));

/**
 * Pattern sample points the composed rig shows (where their part shows, and in
 * every clip) that fall outside its silhouette: the tail and body bakes' patterns and the live stripe pair.
 */
function patternLeaks(composition: Composition): { shown: number; leaks: number } {
  let shown = 0;
  let leaks = 0;
  for (const part of composition.parts) {
    const band = shownBand(part);
    for (const paint of shownPatternPaints(part)) {
      for (const q of patternSamples(paint)) {
        if (!inBand(band, q.x) || !paint.clips.every((clip) => winding(clip, q.x, q.y) !== 0)) continue;
        shown++;
        if (leaksAt(composition, part, q)) leaks++;
      }
    }
  }
  return { shown, leaks };
}

/** Grid step for the Iridescent stripe cover checks, local units. */
const STRIPE_STEP = 0.5;
const STRIPE_REACH_Y = 45;

/** Grid points where the composed body part's stripe and drawAxolotl's cover differently, x from the tail root to `toX`. */
function bodyStripeMismatches(body: ShownPart, drawn: readonly Paint[], toX: number): number {
  const stripes = patternPaints(body.paints);
  let mismatches = 0;
  for (let x = Math.ceil(body.band!.minX); x <= toX; x += STRIPE_STEP) {
    for (let y = -STRIPE_REACH_Y; y <= STRIPE_REACH_Y; y += STRIPE_STEP) {
      for (let k = 0; k < stripes.length; k++) {
        if (fillCovers(stripes[k], body.band, x, y) !== fillCovers(drawn[k], null, x, y)) mismatches++;
      }
    }
  }
  return mismatches;
}

/** A closed y interval on one column, low end first. */
type Interval = readonly [number, number];

/**
 * The y intervals of column x inside the nonzero winding of `subs` (each
 * closed), from the exact crossings of their edges; an edge counts from its left
 * end up to, not at, its right end, so a column on a shared vertex counts it once.
 */
function columnCover(subs: readonly SubPath[], x: number): Interval[] {
  const crossings: { y: number; dir: number }[] = [];
  for (const s of subs) {
    const n = s.pts.length;
    for (let i = 0; i < n; i++) {
      const a = s.pts[i];
      const b = s.pts[(i + 1) % n];
      if ((a.x <= x) === (b.x <= x)) continue;
      crossings.push({ y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x), dir: b.x > a.x ? 1 : -1 });
    }
  }
  crossings.sort((p, q) => p.y - q.y);
  const out: Interval[] = [];
  let w = 0;
  let from = 0;
  for (const c of crossings) {
    const before = w;
    w += c.dir;
    if (before === 0 && w !== 0) from = c.y;
    else if (before !== 0 && w === 0 && c.y > from) out.push([from, c.y]);
  }
  return out;
}

/** Where two sorted interval lists overlap. */
function intersectCover(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (hi > lo) out.push([lo, hi]);
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return out;
}

/** The y span a fill covers in column x (inside its subpaths, every clip and its part's band), or null. */
function coverSpan(paint: Paint, band: Bounds | null, x: number): { min: number; max: number } | null {
  if (!inBand(band, x)) return null;
  let cover = columnCover(paint.subs, x);
  for (const clip of paint.clips) cover = intersectCover(cover, columnCover(clip, x));
  return cover.length === 0 ? null : { min: cover[0][0], max: cover[cover.length - 1][1] };
}

/** Column step of the tail cover checks, local units. */
const COLUMN_STEP = 0.25;

/**
 * Largest per-column gap between composed fills (in their part's band) and
 * drawAxolotl's, paint by paint, over x every COLUMN_STEP from the tail tip to
 * the tail root: the shift of the covered y span's ends, or the whole span
 * where only one side covers.
 */
function tailCoverGap(composed: readonly Paint[], band: Bounds | null, drawn: readonly Paint[], look: AxolotlArtLook): number {
  if (composed.length !== drawn.length) return Infinity;
  const { rootX, length } = axolotlBodyGeometry(look).tail;
  let worst = 0;
  for (let i = 0; rootX - length + i * COLUMN_STEP <= rootX; i++) {
    const x = rootX - length + i * COLUMN_STEP;
    for (let k = 0; k < composed.length; k++) {
      const a = coverSpan(composed[k], band, x);
      const b = coverSpan(drawn[k], null, x);
      if (a && b) worst = Math.max(worst, Math.abs(a.min - b.min), Math.abs(a.max - b.max));
      else if (a || b) worst = Math.max(worst, (a ?? b)!.max - (a ?? b)!.min);
    }
  }
  return worst;
}

/** Live tail stripe tolerance per column, local units. */
const STRIPE_TOL = 0.1;
/** Across offsets of the still stripe pair from (x -10, torso cy) (guide 6p): white 5 wide, a gap of 2, tint 3. */
const STILL_STRIPE_OFFSETS: readonly Interval[] = [
  [-2.5, 2.5],
  [-7.5, -4.5],
];
/** Dream patterns the rope bends with the tail bake, measured for ADR 0013. */
const ROPE_PATTERN_DREAMS = ['hearts', 'tie-dye', 'tie-dye-galaxy', 'glowworm'] as const satisfies readonly DreamLookId[];
/** Measured per-column bound of each rope-bent tail pattern, rounded up (ADR 0013; measured 4.88, 12.38, 2.37, 3.68). */
const ROPE_PATTERN_BOUND: Readonly<Record<(typeof ROPE_PATTERN_DREAMS)[number], number>> = {
  hearts: 5,
  'tie-dye': 12.5,
  'tie-dye-galaxy': 2.5,
  glowworm: 4,
};

/** Iridescent cases: every look at one sheen step on one renderer, and the default look at every step on both. */
const IRIDESCENT_CASES: readonly [AxolotlArtLook, number, RigRenderer][] = [
  ...EVERY_BODY_LOOK.map((look, n): [AxolotlArtLook, number, RigRenderer] => [look, n % SHEEN_STEPS, RENDERERS[n % 2]]),
  ...Array.from({ length: SHEEN_STEPS }, (_, m) => RENDERERS.map((r): [AxolotlArtLook, number, RigRenderer] => [DEFAULT_ART_LOOK, m, r])).flat(),
];

/** The sheen Dream colours (isSheenDream) and the names their checks carry. */
const SHEEN_DREAMS = ['iridescent', 'crystal-shine', 'fiesta-shine'] as const satisfies readonly DreamLookId[];
const SHEEN_NAME: Readonly<Record<(typeof SHEEN_DREAMS)[number], string>> = {
  iridescent: 'Iridescent',
  'crystal-shine': 'Crystal shine',
  'fiesta-shine': 'Fiesta shine',
};

const sheenPalette = (dream: DreamLookId, n: number): MorphPalette => axolotlPalette(MORPHS[n % MORPHS.length], dream);
const iridescentPose = (n: number, m: number): AxolotlPose =>
  pose({ swimPhase: SWIMS[n % SWIMS.length] + 0.3, tailAmp: AXO_MAX_TAIL_AMP, sheen: m / SHEEN_STEPS });

/** The rig composed in sheen colour `dream` at case `n` (sheen step `m`), and drawAxolotl's runs and stripe pair at the shown pose. */
function sheenAt(
  dream: DreamLookId,
  look: AxolotlArtLook,
  n: number,
  m: number,
  renderer: RigRenderer,
): { composed: Composition; runs: Map<DrawnRunId, Paint[]>; drawnBody: Paint[] } {
  const palette = sheenPalette(dream, n);
  const live = iridescentPose(n, m);
  const composed = composeRig({ look, palette, outfit: NO_OUTFIT }, live, renderer, TAIL_AND_BODY);
  expect(composed.placement.sheenFrame).toBe(m);
  const runs = drawnRuns(shownPose(live, composed), palette, look, NO_OUTFIT);
  return { composed, runs, drawnBody: patternPaints(runOf(runs, 'body-layers')) };
}

describe('Dream colours on the composed rig', { timeout: TIMEOUT_MS }, () => {
  it('keeps every Dream pattern inside the composed silhouette and the markers within 1.0 of drawAxolotl', () => {
    const cases: [AxolotlArtLook, MorphPalette, AxolotlPose, RigRenderer][] = [];
    for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
      const palette = axolotlPalette(MORPHS[n % MORPHS.length], DREAM_IDS[n % DREAM_IDS.length]);
      for (const renderer of RENDERERS) {
        cases.push([EVERY_BODY_LOOK[n], palette, pose({ swimPhase: SWIMS[n % SWIMS.length], tailAmp: AXO_MAX_TAIL_AMP, sheen: 0.4 }), renderer]);
      }
    }
    for (const dream of DREAM_IDS) {
      for (const renderer of RENDERERS) {
        for (const swimPhase of [0.4, 3.9]) {
          cases.push([DEFAULT_ART_LOOK, axolotlPalette('leucistic', dream), pose({ swimPhase, tailAmp: 1.2, sheen: 0.7 }), renderer]);
        }
      }
    }
    const worst: Record<RigRenderer, number> = { webgl: 0, canvas: 0 };
    const shownByDream = new Map<DreamLookId, number>();
    const leaks: string[] = [];
    for (const [look, palette, live, renderer] of cases) {
      const appearance: RigAppearance = { look, palette, outfit: NO_OUTFIT };
      const composed = composeRig(appearance, live, renderer, TAIL_AND_BODY);
      const dream = palette.dream!.id;
      const pattern = patternLeaks(composed);
      shownByDream.set(dream, (shownByDream.get(dream) ?? 0) + pattern.shown);
      if (pattern.leaks > 0) leaks.push(`${lookId(look)} ${dream} ${renderer}: ${pattern.leaks} of ${pattern.shown}`);
      const runs = drawnRuns(renderer === 'webgl' ? live : shownPose(live, composed), palette, look, NO_OUTFIT);
      const ours = composedMarkers(composed);
      const theirs = drawnMarkers(runs);
      expect(ours).toHaveLength(3);
      expect(theirs).toHaveLength(3);
      for (let k = 0; k < 3; k++) worst[renderer] = Math.max(worst[renderer], pointGap(ours[k], theirs[k]));
    }
    expect(leaks).toEqual([]);
    for (const dream of DREAM_IDS) {
      const solid = patternPaints(recordPaints((ctx) => paintBodyLayers(ctx, RIG_STILL_POSE, axolotlPalette('leucistic', dream), DEFAULT_ART_LOOK))).length === 0;
      if (!solid) expect(shownByDream.get(dream) ?? 0, dream).toBeGreaterThan(0);
    }
    // Measured: marker centres 0.283 units off on the WebGL rope, 0 on the Canvas strip.
    expect(worst.webgl).toBeLessThanOrEqual(ENVELOPE_TOL);
    expect(worst.canvas).toBeLessThanOrEqual(EXACT);
  });

  for (const dream of SHEEN_DREAMS) {
    it(`shows the ${SHEEN_NAME[dream]} stripe exactly on the body piece at every sheen step`, () => {
      let bodyMismatches = 0;
      let bodyGap = 0;
      const envelope: Record<RigRenderer, number> = { webgl: 0, canvas: 0 };
      for (let n = 0; n < IRIDESCENT_CASES.length; n++) {
        const [look, m, renderer] = IRIDESCENT_CASES[n];
        const { composed, runs, drawnBody } = sheenAt(dream, look, n, m, renderer);
        const body = partOf(composed, 'body');
        const stripes = patternPaints(body.paints);
        expect(stripes).toHaveLength(2);
        expect(drawnBody).toHaveLength(2);
        for (let k = 0; k < 2; k++) bodyGap = Math.max(bodyGap, subsGap(stripes[k].subs, drawnBody[k].subs));
        bodyMismatches += bodyStripeMismatches(body, drawnBody, DREAM_FACE_LIMIT_X);
        envelope[renderer] = Math.max(envelope[renderer], envelopeGap(composedSilhouette(composed), drawnSilhouette(runOf(runs, 'body-layers'))));
      }
      // Measured: body stripe 0 with no cover mismatch; tail silhouette envelope 0.654 on WebGL, 0 on Canvas.
      expect(bodyGap).toBeLessThanOrEqual(EXACT);
      expect(bodyMismatches).toBe(0);
      expect(envelope.webgl).toBeLessThanOrEqual(ENVELOPE_TOL);
      expect(envelope.canvas).toBeLessThanOrEqual(EXACT);
    });

    // FINDING (#46, fixed): the WebGL rope once bent the whole tail bake, Iridescent stripe included, but
    // drawAxolotl's stripe pair is two straight 45 degree bands the waving tail swims through: the rope
    // moved the stripe by the tail's own bend, up to 10.4 units per column off drawAxolotl's (amplitude
    // 1.6). And the Canvas strip frames baked the tail without the sheen, so their stripe sat at the
    // still x -10 whatever the sheen. A moving Iridescent tail now shows 'under', the live stripe pair
    // (rigPlacement's stripe: tailStripe at the shown tail and sheen step) and 'tail-over', on both renderers.
    it(`draws the live ${SHEEN_NAME[dream]} tail stripe within 0.1 of drawAxolotl on WebGL and Canvas`, () => {
      const worst: Record<RigRenderer, { gap: number; at: string }> = {
        webgl: { gap: 0, at: '' },
        canvas: { gap: 0, at: '' },
      };
      IRIDESCENT_CASES.forEach(([look, m], n) => {
        for (const renderer of RENDERERS) {
          const { composed, drawnBody } = sheenAt(dream, look, n, m, renderer);
          expect(composed.parts.map((p) => p.id)).toEqual(['body', 'tail', 'tail-stripe', 'tail-over']);
          expect(patternPaints(partOf(composed, 'tail').paints)).toEqual([]);
          expect(patternPaints(partOf(composed, 'tail-over').paints)).toEqual([]);
          const gap = tailCoverGap(partOf(composed, 'tail-stripe').paints, null, drawnBody, look);
          if (gap > worst[renderer].gap) worst[renderer] = { gap, at: `${lookId(look)} sheen step ${m}` };
        }
      });
      // Measured: Iridescent 3.6e-14 units on WebGL, 4.3e-14 on Canvas (float noise): the live polygons are
      // drawAxolotl's stripe quads cut by its own inset Dream clip, at the shown tail and sheen step.
      // Crystal shine (no inset) 0.0018 on both: its clip's tail edges are chords where drawAxolotl's
      // silhouette, its other clip, curves.
      expect(worst.webgl.gap, worst.webgl.at).toBeLessThanOrEqual(STRIPE_TOL);
      expect(worst.canvas.gap, worst.canvas.at).toBeLessThanOrEqual(STRIPE_TOL);
    });

    it(`holds the still ${SHEEN_NAME[dream]} stripe at x -10 when the sheen is undefined`, () => {
      const bandsShown = [0, 0];
      for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
        const look = EVERY_BODY_LOOK[n];
        const palette = sheenPalette(dream, n);
        const renderer = RENDERERS[n % 2];
        const live = pose({ swimPhase: 2.2, tailAmp: 1.2 });
        const composed = composeRig({ look, palette, outfit: NO_OUTFIT }, live, renderer, TAIL_AND_BODY);
        expect(composed.placement.sheenFrame).toBeNull();
        const torsoCy = axolotlBodyGeometry(look).torso.cy;
        const stripe = partOf(composed, 'tail-stripe').paints;
        STILL_STRIPE_OFFSETS.forEach(([from, to], k) => {
          const pts = stripe[k].subs.flatMap((s) => s.pts);
          if (pts.length > 0) bandsShown[k]++;
          for (const p of pts) {
            const across = (p.x - IRIDESCENT_STILL_X + (p.y - torsoCy)) * Math.SQRT1_2;
            expect(across).toBeGreaterThanOrEqual(from - EXACT);
            expect(across).toBeLessThanOrEqual(to + EXACT);
          }
        });
        const white = patternPaints(partOf(composed, 'body').paints)[0];
        const centre = centroid(white.subs[0].pts);
        expect(centre.x).toBeCloseTo(IRIDESCENT_STILL_X, 9);
        expect(centre.y).toBeCloseTo(torsoCy, 9);
        const drawn = patternPaints(runOf(drawnRuns(shownPose(live, composed), palette, look, NO_OUTFIT), 'body-layers'));
        expect(bodyStripeMismatches(partOf(composed, 'body'), drawn, DREAM_FACE_LIMIT_X)).toBe(0);
        expect(tailCoverGap(stripe, null, drawn, look)).toBeLessThanOrEqual(STRIPE_TOL);
      }
      expect(bandsShown.every((count) => count > 0)).toBe(true);
    });
  }

  // FINDING (#46, for ADR 0013; measured only, no fix): the Hearts, Tie-dye, Tie-dye galaxy and Glowworm
  // tail patterns ride the rope's bend with the tail bake, while drawAxolotl places them on the live tail.
  // Per-column covered span (every 0.25 units, tip to root) at amplitude 1.6 over every look, measured
  // against drawAxolotl: Hearts 4.88 units (Girl Short Slim Baby, swim 3.442), Tie-dye 12.38 (Boy
  // Medium Chubby Baby, swim 0.300), Tie-dye galaxy 2.37 (Girl Medium Regular Baby, swim 5.536),
  // Glowworm 3.68 (Girl Short Chubby Baby, swim 5.012).
  // The bounds below hold these on record; they are not a fidelity claim.
  it('measures the rope tail\'s Hearts, Tie-dye, Tie-dye galaxy and Glowworm patterns against drawAxolotl', () => {
    const worst = new Map<DreamLookId, { gap: number; at: string }>();
    for (const dream of ROPE_PATTERN_DREAMS) {
      worst.set(dream, { gap: 0, at: '' });
      for (let n = 0; n < EVERY_BODY_LOOK.length; n++) {
        const look = EVERY_BODY_LOOK[n];
        const palette = axolotlPalette(MORPHS[n % MORPHS.length], dream);
        const live = pose({ swimPhase: SWIMS[n % SWIMS.length] + 0.3, tailAmp: AXO_MAX_TAIL_AMP });
        const composed = composeRig({ look, palette, outfit: NO_OUTFIT }, live, 'webgl', ['tail']);
        expect(composed.placement.tail.mode).toBe('rope');
        const tail = partOf(composed, 'tail');
        const fills = patternPaints(tail.paints).filter((p) => p.kind === 'fill');
        const drawn = patternPaints(runOf(drawnRuns(live, palette, look, NO_OUTFIT), 'body-layers')).filter((p) => p.kind === 'fill');
        expect(fills.length).toBeGreaterThan(0);
        const gap = tailCoverGap(fills, tail.band, drawn, look);
        if (gap > worst.get(dream)!.gap) worst.set(dream, { gap, at: `${lookId(look)} swim ${live.swimPhase.toFixed(3)}` });
      }
    }
    for (const dream of ROPE_PATTERN_DREAMS) {
      const { gap, at } = worst.get(dream)!;
      expect(gap, `${dream} ${at}`).toBeLessThanOrEqual(ROPE_PATTERN_BOUND[dream]);
    }
  });
});

// ---------------------------------------------------------------------------
// (e) The still pose
// ---------------------------------------------------------------------------

/**
 * Failures where a still composition's parts miss drawAxolotl's runs by more
 * than EXACT, on both renderers. The tail part is compared in full. The body
 * bake is the straight tail and the tail part draws over it up to
 * rootX + RIG_SEAM_OVERLAP, so the body is compared only where it shows, past that.
 */
function stillGaps(look: AxolotlArtLook, palette: MorphPalette, outfit: ArtOutfit): string[] {
  const runs = drawnRuns(RIG_STILL_POSE, palette, look, outfit);
  const bodyLayers = runOf(runs, 'body-layers');
  const bodyShowsFrom = axolotlBodyGeometry(look).tail.rootX + RIG_SEAM_OVERLAP;
  const failures: string[] = [];
  for (const renderer of RENDERERS) {
    const composed = composeRig({ look, palette, outfit }, RIG_STILL_POSE, renderer);
    expect(composed.placement.tail.mode).toBe('still');
    expect(composed.twinkles).toEqual([]);
    const shown = new Set<DrawnRunId>(['body-layers', 'glints']);
    for (const part of composed.parts) {
      if (part.id === 'tail-stripe' || part.id === 'tail-over') {
        failures.push(`${lookId(look)} ${renderer}: ${part.id} shown on the still tail`);
        continue;
      }
      shown.add(part.id);
      let gap: number;
      if (part.id === 'tail') gap = paintsGap(part.paints, bodyLayers);
      else if (part.id === 'body') gap = paintsGap(part.paints, bodyLayers, bodyShowsFrom);
      else gap = paintsGap(part.paints, runOf(runs, part.id));
      if (gap > EXACT) failures.push(`${lookId(look)} ${renderer} ${part.id}: ${gap}`);
    }
    for (const [id, run] of runs) if (!shown.has(id) && run.length > 0) failures.push(`${lookId(look)} ${renderer}: drawAxolotl run ${id} not shown`);
    if (runOf(runs, 'glints').length > 0) failures.push(`${lookId(look)}: glints at the still pose`);
  }
  return failures;
}

/** Every morph plain, then every Dream colour on the morphs in turn. */
const SEAM_PALETTES: readonly MorphPalette[] = [
  ...MORPHS.map((morph) => axolotlPalette(morph, null)),
  ...DREAM_IDS.map((dream, k) => axolotlPalette(MORPHS[k % MORPHS.length], dream)),
];

/**
 * Failures where paintBodyLayers at a SWIMS x AMPS pose paints other than at
 * the straight tail (the body bake's pose) at x >= rootX + RIG_SEAM_OVERLAP,
 * where the body part shows. Points of each paint compared there; counts must match.
 */
function seamGaps(look: AxolotlArtLook, palette: MorphPalette): string[] {
  const from = axolotlBodyGeometry(look).tail.rootX + RIG_SEAM_OVERLAP;
  const straight = recordPaints((ctx) => paintBodyLayers(ctx, pose({ tailAmp: 0 }), palette, look));
  const failures: string[] = [];
  for (const swimPhase of SWIMS) {
    for (const tailAmp of AMPS) {
      const posed = recordPaints((ctx) => paintBodyLayers(ctx, pose({ swimPhase, tailAmp }), palette, look));
      const at = `${lookId(look)} ${look.spots} ${palette.dream?.id ?? 'plain'} swim ${swimPhase.toFixed(3)} amp ${tailAmp}`;
      if (posed.length !== straight.length) failures.push(`${at}: ${posed.length} paints, straight ${straight.length}`);
      else {
        const gap = paintsGap(posed, straight, from);
        if (gap > EXACT) failures.push(`${at}: ${gap}`);
      }
    }
  }
  return failures;
}

describe('the composed rig at the still pose', { timeout: TIMEOUT_MS }, () => {
  it('paints what drawAxolotl paints at RIG_STILL_POSE, within 1e-6', () => {
    const failures = EVERY_BODY_LOOK.flatMap((look, n) => stillGaps(look, PALETTES[n % PALETTES.length], n % 3 === 0 ? NO_OUTFIT : FULL));
    expect(failures).toEqual([]);
  });

  // FINDING (#46, fixed): a tail-space spot mark can reach past the tail root. Patches' first tail
  // mark (s 0.2, rx 6.2) on a Girl Short Baby tail (length 30.6) reaches 6.2 - 0.2 x 30.6 = 0.08
  // units past the root, and the body bake (the straight tail, clipped to x >= the root) once showed
  // that sliver at the straight-tail place: 2.03 units off drawAxolotl's mark at the still pose, up
  // to 3.52 on a dashing tail. The tail part now draws over the body part, so the seam overlap shows
  // the tail's posed copy; the body shows only past rootX + RIG_SEAM_OVERLAP (seam guard below).
  it('paints the Patches tail mark exactly at the still pose on a Girl Short Baby', () => {
    const failures = AXO_BODIES.flatMap((body) =>
      stillGaps({ ...DEFAULT_ART_LOOK, sex: 'girl', tail: 'short', age: 'baby', body, spots: 'patches' }, LEUCISTIC, NO_OUTFIT),
    );
    expect(failures).toEqual([]);
  });

  it('paints every Spots option exactly at the still pose on every look', () => {
    const failures = EVERY_BODY_LOOK.flatMap((look) => SPOTS_OPTIONS.flatMap((spots) => stillGaps({ ...look, spots }, LEUCISTIC, NO_OUTFIT)));
    expect(failures).toEqual([]);
  });

  it('paints the body layers past the seam overlap the same at every tail pose as on the straight tail', () => {
    const failures = EVERY_BODY_LOOK.flatMap((look, l) =>
      SPOTS_OPTIONS.flatMap((spots, s) => {
        const palette = SEAM_PALETTES[(l * SPOTS_OPTIONS.length + s) % SEAM_PALETTES.length];
        return seamGaps({ ...look, spots }, palette);
      }),
    );
    expect(failures).toEqual([]);
  });
});
