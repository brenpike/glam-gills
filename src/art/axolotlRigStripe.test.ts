/**
 * Sheen Dream tail stripe polygons (Iridescent, Crystal shine; issue #46), headless: tailStripe's run
 * polygons against the stripe drawAxolotl paints, recorded with every clip it
 * paints under (silhouette, inset Dream clip, face limit). The recording
 * context is the stub-Path2D one of axolotlRigFidelity.test.ts, copied here
 * (a test file is never imported). Also: paintBodyLayers 'under', the Dream
 * pattern, then 'over' paint exactly what 'all' paints.
 */
import { describe, expect, it, vi } from 'vitest';
import { AXO_MAX_TAIL_AMP, drawAxolotl, paintBodyLayers, type AxolotlPose } from './drawAxolotl';
import {
  AXO_AGES,
  AXO_BODIES,
  AXO_SEXES,
  AXO_TAILS,
  DEFAULT_ART_LOOK,
  HEAD_ELLIPSE,
  TAIL_SEGMENTS,
  axolotlBodyGeometry,
  tailSamples,
  type AxolotlArtLook,
} from './drawAxolotlParts';
import { ell } from './canvasKit';
import { paintDreamPattern } from './drawDreamOverlay';
import { DREAM_SLOTS, MORPH_PALETTES, axolotlPalette, type DreamLookId, type MorphLookId, type MorphPalette } from './palette';
import { DREAM_SWATCH } from './treasurePalette';
import { RIG_SEAM_OVERLAP, RIG_STILL_POSE, SHEEN_STEPS, sheenStepValue } from './axolotlRigParts';
import { tailStripe, type TailStripe } from './axolotlRigStripe';

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

/** Whether a fill of `paint` covers (x, y): inside its own subpaths and every clip. */
function fillCovers(paint: Paint, x: number, y: number): boolean {
  if (winding(paint.subs, x, y) === 0) return false;
  return paint.clips.every((clip) => winding(clip, x, y) !== 0);
}

/** Whether the flat [x0, y0, x1, y1, ...] polygon holds (x, y) (crossing rule). */
function inFlat(poly: readonly number[], x: number, y: number): boolean {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[2 * i];
    const yi = poly[2 * i + 1];
    const xj = poly[2 * j];
    const yj = poly[2 * j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}

/** Distance from (x, y) to the nearest edge of `subs`, each closed. */
function subsDistance(subs: readonly SubPath[], x: number, y: number): number {
  let best = Infinity;
  for (const s of subs) {
    for (let i = 0; i < s.pts.length; i++) {
      const a = s.pts[i];
      const b = s.pts[(i + 1) % s.pts.length];
      best = Math.min(best, segDist(x, y, a.x, a.y, b.x, b.y));
    }
  }
  return best;
}

/** Distance from (x, y) to the nearest edge of the flat polygons. */
function flatDistance(polys: readonly (readonly number[])[], x: number, y: number): number {
  let best = Infinity;
  for (const poly of polys) {
    const n = poly.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      best = Math.min(best, segDist(x, y, poly[2 * j], poly[2 * j + 1], poly[2 * i], poly[2 * i + 1]));
    }
  }
  return best;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function flatBox(poly: readonly number[]): Box {
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let i = 0; i < poly.length; i += 2) {
    box.minX = Math.min(box.minX, poly[i]);
    box.maxX = Math.max(box.maxX, poly[i]);
    box.minY = Math.min(box.minY, poly[i + 1]);
    box.maxY = Math.max(box.maxY, poly[i + 1]);
  }
  return box;
}

function subsBox(subs: readonly SubPath[]): Box {
  return flatBox(subs.flatMap((s) => s.pts.flatMap((p) => [p.x, p.y])));
}

const inBox = (box: Box, x: number, y: number): boolean =>
  x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;

// ---------------------------------------------------------------------------
// What to check
// ---------------------------------------------------------------------------

const MARKS = DREAM_SWATCH.iridescent.marks;
/** The sheen Dream colours (isSheenDream), whose stripe tailStripe draws. */
const SHEEN_DREAMS = ['iridescent', 'crystal-shine', 'fiesta-shine'] as const satisfies readonly DreamLookId[];
/** The pattern paints of drawAxolotl carry three clips: silhouette, inset Dream clip, face limit. */
const PATTERN_CLIPS = 3;
const EXACT = 1e-6;
const GRID = 0.25;
const TIMEOUT_MS = 120_000;

/** The 16 rig sheen steps, then the reduced-motion still stripe. */
const SHEENS: readonly (number | undefined)[] = [
  ...Array.from({ length: SHEEN_STEPS }, (_, k) => sheenStepValue(k)),
  undefined,
];

const LOOKS: readonly AxolotlArtLook[] = [
  DEFAULT_ART_LOOK,
  { ...DEFAULT_ART_LOOK, sex: AXO_SEXES[0], tail: AXO_TAILS[2], body: AXO_BODIES[2], age: AXO_AGES[2] },
  { ...DEFAULT_ART_LOOK, sex: AXO_SEXES[1], tail: AXO_TAILS[0], body: AXO_BODIES[0], age: AXO_AGES[0] },
  { ...DEFAULT_ART_LOOK, sex: AXO_SEXES[0], tail: AXO_TAILS[1], body: AXO_BODIES[0], age: AXO_AGES[2] },
];
const lookId = (look: AxolotlArtLook): string => [look.sex, look.tail, look.body, look.age].join(' ');

/** Swim phase and tail amplitude pairs: quarter turns at amplitudes 1 to 1.6, and the straight rig bake (amplitude 0). */
const POSES: readonly { swimPhase: number; tailAmp: number }[] = [
  { swimPhase: 0, tailAmp: 1 },
  { swimPhase: Math.PI / 2, tailAmp: AXO_MAX_TAIL_AMP },
  { swimPhase: Math.PI, tailAmp: 1.2 },
  { swimPhase: (3 * Math.PI) / 2, tailAmp: AXO_MAX_TAIL_AMP },
  { swimPhase: RIG_STILL_POSE.swimPhase, tailAmp: 0 },
];

/** The rig's tail part shows x <= rootX + RIG_SEAM_OVERLAP. */
const seamX = (look: AxolotlArtLook): number => axolotlBodyGeometry(look).tail.rootX + RIG_SEAM_OVERLAP;

/** toX values the coverage sweep cycles through: the rig seam, no cut, and two cuts across the body and tail. */
const toXFor = (look: AxolotlArtLook, k: number): number => [seamX(look), Infinity, 0, -40][k % 4];

interface CoverageTally {
  points: number;
  covered: number;
  mismatches: number;
  overlaps: number;
  strays: number;
  first: string | null;
}

const newTally = (): CoverageTally => ({ points: 0, covered: 0, mismatches: 0, overlaps: 0, strays: 0, first: null });

/** Distance from (x, y) to every boundary either side draws: the paint, its clips, the polygons and x = toX. */
function boundaryDistance(paint: Paint, polys: readonly (readonly number[])[], toX: number, x: number, y: number): number {
  let best = Math.min(subsDistance(paint.subs, x, y), flatDistance(polys, x, y), Math.abs(x - toX));
  for (const clip of paint.clips) best = Math.min(best, subsDistance(clip, x, y));
  return best;
}

/** Grid check of one band's polygons against drawAxolotl's recorded paint of it, at x <= toX. */
function tallyBand(paint: Paint, polys: readonly (readonly number[])[], toX: number, label: string, tally: CoverageTally): void {
  const area = subsBox(paint.clips[1]);
  const boxes = polys.map(flatBox);
  for (const box of boxes) {
    const inside = box.minX >= area.minX - EXACT && box.maxX <= area.maxX + EXACT;
    if (!inside || box.minY < area.minY - EXACT || box.maxY > area.maxY + EXACT) tally.strays++;
  }
  for (let i = Math.floor(area.minX / GRID) - 4; i * GRID <= area.maxX + 1; i++) {
    const x = i * GRID;
    for (let j = Math.floor(area.minY / GRID) - 4; j * GRID <= area.maxY + 1; j++) {
      const y = j * GRID;
      let count = 0;
      for (let k = 0; k < polys.length; k++) if (inBox(boxes[k], x, y) && inFlat(polys[k], x, y)) count++;
      const expected = x <= toX && fillCovers(paint, x, y);
      tally.points++;
      if (expected) tally.covered++;
      if (count > 1 && flatDistance(polys, x, y) > EXACT) tally.overlaps++;
      if (count > 0 === expected || boundaryDistance(paint, polys, toX, x, y) <= EXACT) continue;
      tally.mismatches++;
      tally.first ??= `${label} at (${x}, ${y}): drawn ${expected}, polygons ${count}`;
    }
  }
}

/** drawAxolotl's two stripe paints (light, then tint) of sheen colour `dream` at this pose. */
function drawnStripe(dream: DreamLookId, look: AxolotlArtLook, pose: AxolotlPose): Paint[] {
  const paints = recordPaints((ctx) => drawAxolotl(ctx, pose, axolotlPalette('leucistic', dream), look));
  return paints.filter((p) => p.clips.length === PATTERN_CLIPS);
}

function tallyLook(dream: DreamLookId, look: AxolotlArtLook, tally: CoverageTally): void {
  let k = 0;
  for (const { swimPhase, tailAmp } of POSES) {
    for (const sheen of SHEENS) {
      const toX = toXFor(look, k++);
      const drawn = drawnStripe(dream, look, { ...RIG_STILL_POSE, swimPhase, tailAmp, sheen });
      expect(drawn.map((p) => [p.kind, p.style])).toEqual(DREAM_SWATCH[dream].marks.map((m) => ['fill', m]));
      const stripe = tailStripe(dream, look, swimPhase, tailAmp, sheen, toX);
      const label = `${dream} ${lookId(look)} swim ${swimPhase.toFixed(3)} amp ${tailAmp} sheen ${sheen} toX ${toX}`;
      stripe.forEach((band, b) => tallyBand(drawn[b], band.polygons, toX, `${label} band ${b}`, tally));
    }
  }
}

describe('tailStripe', () => {
  for (const look of LOOKS) {
    it(`covers exactly the stripe drawAxolotl paints, once, on ${lookId(look)}`, { timeout: TIMEOUT_MS }, () => {
      const tally = newTally();
      tallyLook('iridescent', look, tally);
      expect(tally.first).toBeNull();
      expect(tally.mismatches).toBe(0);
      expect(tally.overlaps).toBe(0);
      expect(tally.strays).toBe(0);
      expect(tally.covered).toBeGreaterThan(1000);
    });
  }

  for (const look of LOOKS) {
    it(`covers exactly the Crystal shine stripe drawAxolotl paints, once, on ${lookId(look)}`, { timeout: TIMEOUT_MS }, () => {
      const tally = newTally();
      tallyLook('crystal-shine', look, tally);
      expect(tally.first).toBeNull();
      expect(tally.mismatches).toBe(0);
      expect(tally.overlaps).toBe(0);
      expect(tally.strays).toBe(0);
      expect(tally.covered).toBeGreaterThan(1000);
    });
  }

  for (const look of LOOKS) {
    it(`covers exactly the Fiesta shine stripe drawAxolotl paints, once, on ${lookId(look)}`, { timeout: TIMEOUT_MS }, () => {
      const tally = newTally();
      tallyLook('fiesta-shine', look, tally);
      expect(tally.first).toBeNull();
      expect(tally.mismatches).toBe(0);
      expect(tally.overlaps).toBe(0);
      expect(tally.strays).toBe(0);
      expect(tally.covered).toBeGreaterThan(1000);
    });
  }

  it('fills each band with its parsed Iridescent mark, white first', () => {
    const parse = (css: string): [number, number] => {
      const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(css);
      if (!m) throw new Error(`unexpected mark ${css}`);
      return [(Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]), Number(m[4])];
    };
    const stripe = tailStripe('iridescent', DEFAULT_ART_LOOK, 0, 1, 0.5, Infinity);
    expect(stripe.map((band) => [band.colour, band.alpha])).toEqual(MARKS.map(parse));
    expect(stripe.map((band) => [band.colour, band.alpha])).toEqual([
      [0xffffff, 0.7],
      [0x8f7fe0, 0.6],
    ]);
  });

  it('fills each band with its parsed Crystal shine mark, white first', () => {
    const stripe = tailStripe('crystal-shine', DEFAULT_ART_LOOK, 0, 1, 0.5, Infinity);
    expect(stripe.map((band) => [band.colour, band.alpha])).toEqual([
      [0xffffff, 0.7],
      [0x96faf5, 0.75],
    ]);
  });

  it('fills each band with its parsed Fiesta shine mark, sunny yellow first', () => {
    const stripe = tailStripe('fiesta-shine', DEFAULT_ART_LOOK, 0, 1, 0.5, Infinity);
    expect(stripe.map((band) => [band.colour, band.alpha])).toEqual([
      [0xffe14a, 0.85],
      [0x40e0d0, 0.8],
    ]);
  });

  it('throws on a Dream colour with no sheen', () => {
    const plain = (Object.keys(DREAM_SLOTS) as DreamLookId[]).filter((id) => !(SHEEN_DREAMS as readonly DreamLookId[]).includes(id));
    expect(plain.length).toBeGreaterThan(0);
    for (const id of plain) expect(() => tailStripe(id, DEFAULT_ART_LOOK, 0, 1, 0.5, Infinity), id).toThrow(`tailStripe: ${id} is not a sheen Dream colour`);
  });

  it('is empty when toX is left of the band', () => {
    for (const look of LOOKS) {
      const tipX = tailSamples(axolotlBodyGeometry(look).tail, 0, 1)[TAIL_SEGMENTS].x;
      for (const sheen of SHEENS) {
        for (const toX of [tipX - 20, -1000]) {
          for (const dream of SHEEN_DREAMS) {
            const stripe = tailStripe(dream, look, 0, 1, sheen, toX);
            expect(stripe.map((band) => band.polygons)).toEqual([[], []]);
          }
        }
      }
    }
  });

  it('is empty when the band misses the tail band', () => {
    for (const look of LOOKS) {
      // Sheen 0 holds the stripe at x 14: across the body axis it is far right of x -40.
      for (const dream of SHEEN_DREAMS) {
        expect(tailStripe(dream, look, 0, 1, 0, Infinity).map((band) => band.polygons.length > 0)).toEqual([true, true]);
        expect(tailStripe(dream, look, 0, 1, 0, -40).map((band) => band.polygons)).toEqual([[], []]);
      }
    }
  });

  it('fills `out` in place, reusing its polygon arrays', () => {
    const out: TailStripe = tailStripe('iridescent', DEFAULT_ART_LOOK, 0, 1, 0.5, Infinity);
    const firstPolygon = out[0].polygons[0];
    expect(firstPolygon).toBeDefined();
    const again = tailStripe('iridescent', DEFAULT_ART_LOOK, 1, AXO_MAX_TAIL_AMP, 0.25, Infinity, out);
    expect(again).toBe(out);
    expect(again[0].polygons[0]).toBe(firstPolygon);
    expect(again).toEqual(tailStripe('iridescent', DEFAULT_ART_LOOK, 1, AXO_MAX_TAIL_AMP, 0.25, Infinity));
    tailStripe('iridescent', DEFAULT_ART_LOOK, 1, AXO_MAX_TAIL_AMP, 0.25, -1000, out);
    expect(out.map((band) => band.polygons)).toEqual([[], []]);
  });

  it('reports its per-call cost (log only)', () => {
    const look = LOOKS[1];
    const seam = seamX(look);
    let out = tailStripe('iridescent', look, 0, 1, 0, seam);
    const run = (calls: number): void => {
      for (let i = 0; i < calls; i++) {
        out = tailStripe('iridescent', look, i * 0.07, AXO_MAX_TAIL_AMP, sheenStepValue(i % SHEEN_STEPS), seam, out);
      }
    };
    run(300);
    const calls = 3000;
    const start = performance.now();
    run(calls);
    const perCall = (performance.now() - start) / calls;
    const polygons = out.map((band) => band.polygons.length).join(' + ');
    console.info(`tailStripe: ${perCall.toFixed(4)} ms per call over ${calls} calls (last call ${polygons} polygons)`);
  });
});

// ---------------------------------------------------------------------------
// paintBodyLayers 'under' + pattern + 'over' = 'all'
// ---------------------------------------------------------------------------

/** paintDreamPattern as paintBodyLayers calls it: clipped to the layer 4 silhouette. */
function paintPattern(ctx: CanvasRenderingContext2D, pose: AxolotlPose, palette: MorphPalette, look: AxolotlArtLook): void {
  if (!palette.dream) return;
  const geo = axolotlBodyGeometry(look);
  const tail = tailSamples(geo.tail, pose.swimPhase, pose.tailAmp);
  const sil = new Path2D();
  const top = (i: number): [number, number] => [tail[i].x, tail[i].cy - tail[i].hc - tail[i].finTop];
  const bottom = (i: number): [number, number] => [tail[i].x, tail[i].cy + tail[i].hc + tail[i].finBottom];
  sil.moveTo(...top(TAIL_SEGMENTS));
  for (let i = TAIL_SEGMENTS; i >= 0; i--) sil.lineTo(...top(i));
  for (let i = 0; i <= TAIL_SEGMENTS; i++) sil.lineTo(...bottom(i));
  sil.closePath();
  ell(sil, geo.torso.cx, geo.torso.cy, geo.torso.rx, geo.torso.ry);
  ell(sil, HEAD_ELLIPSE.cx, HEAD_ELLIPSE.cy, HEAD_ELLIPSE.rx, HEAD_ELLIPSE.ry);
  paintDreamPattern(ctx, sil, { id: palette.dream.id, torso: geo.torso, tail, sheen: pose.sheen });
}

const MORPH_IDS = Object.keys(MORPH_PALETTES) as MorphLookId[];
const DREAM_IDS = Object.keys(DREAM_SLOTS) as DreamLookId[];
const SPLIT_POSES: readonly AxolotlPose[] = [
  { ...RIG_STILL_POSE, sheen: 0.3 },
  { ...RIG_STILL_POSE, swimPhase: Math.PI / 2, tailAmp: AXO_MAX_TAIL_AMP },
];

/** A paint as a canvas shows it: a fill reads neither the line width nor the cap in force. */
const shownPaint = (p: Paint): Paint => (p.kind === 'fill' ? { ...p, lineWidth: 0, lineCap: '' } : p);
const shownPaints = (paints: readonly Paint[]): string => JSON.stringify(paints.map(shownPaint));

/** Labels of the cases where 'under', the pattern, then 'over' do not paint what 'all' paints. */
function splitFailures(morph: MorphLookId, dream: DreamLookId | null): string[] {
  const failures: string[] = [];
  const palette = axolotlPalette(morph, dream);
  for (const look of LOOKS) {
    for (const pose of SPLIT_POSES) {
      const all = recordPaints((ctx) => paintBodyLayers(ctx, pose, palette, look));
      const under = recordPaints((ctx) => paintBodyLayers(ctx, pose, palette, look, 'under'));
      const pattern = recordPaints((ctx) => paintPattern(ctx, pose, palette, look));
      const over = recordPaints((ctx) => paintBodyLayers(ctx, pose, palette, look, 'over'));
      const patterned = dream !== null && DREAM_SWATCH[dream].pattern !== 'plain';
      const split = shownPaints([...under, ...pattern, ...over]) === shownPaints(all);
      if (!split || under.length === 0 || over.length === 0 || (pattern.length > 0) !== patterned) {
        failures.push(`${morph} ${dream} ${lookId(look)} swim ${pose.swimPhase.toFixed(3)}`);
      }
    }
  }
  return failures;
}

describe("paintBodyLayers 'under' and 'over'", () => {
  for (const morph of MORPH_IDS) {
    it(`paint 'all' around the Dream pattern for ${morph}, plain and in all twelve Dream colours`, { timeout: TIMEOUT_MS }, () => {
      const failures = [null, ...DREAM_IDS].flatMap((dream) => splitFailures(morph, dream));
      expect(failures).toEqual([]);
    });
  }
});
