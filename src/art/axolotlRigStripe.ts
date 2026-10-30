/**
 * The sheen Dream stripe (isSheenDream: Iridescent, Crystal shine) on the tail
 * as flat-colour polygons (issue #46).
 * On WebGL the rig bends its straight tail bake with a Rope, so the tail is
 * baked 'under' and 'over' (paintBodyLayers) and the stripe pair is drawn live
 * between them from these polygons, exact at every pose. Each band is the
 * guide 6p stripe quad (dreamPatternShapes) cut by the nonzero union of the
 * inset Dream clip polygons (dreamClipPolygons, which also hold the x <= 14
 * face limit) and by x <= toX, the part of the body the tail shows. Local
 * units, facing right. Pure: no Phaser, no DOM.
 */
import { axolotlBodyGeometry, tailSamples, type AxolotlArtLook } from './drawAxolotlParts';
import {
  DREAM_INSET_IDS,
  DREAM_PATTERN_INSET,
  dreamClipPolygons,
  dreamPatternShapes,
  isSheenDream,
  type DreamPolygon,
} from './drawDreamOverlay';
import type { DreamLookId } from './palette';
import { DREAM_SWATCH } from './treasurePalette';

/** One sheen band: its flat fill and the run polygons that cover it. */
export interface TailStripeBand {
  /** Fill colour, 0xRRGGBB. */
  colour: number;
  /** Fill alpha, 0 to 1. */
  alpha: number;
  /** Run polygons in local units, each a flat [x0, y0, x1, y1, ...] list. No two overlap. */
  polygons: number[][];
}

/** The two sheen bands, light first, then the tint (the colour's DREAM_SWATCH marks order). */
export type TailStripe = readonly [TailStripeBand, TailStripeBand];

/** Slack when two trapezoid sides are the same side, local units. */
const SIDE_EPS = 1e-9;

const HEX_RE = /^#([0-9a-f]{6})$/i;
const RGBA_RE = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/;

/** A CSS '#rrggbb' or 'rgba(r,g,b,a)' colour as a colour int and alpha. */
function parseFill(css: string): { colour: number; alpha: number } {
  const hex = HEX_RE.exec(css);
  if (hex) return { colour: parseInt(hex[1], 16), alpha: 1 };
  const rgba = RGBA_RE.exec(css);
  if (!rgba) throw new Error(`tailStripe: cannot parse the sheen mark colour ${css}`);
  const [red, green, blue] = [rgba[1], rgba[2], rgba[3]].map(Number);
  return { colour: (red << 16) | (green << 8) | blue, alpha: Number(rgba[4]) };
}

/** Each sheen colour's band fills (its parsed DREAM_SWATCH marks) and clip inset (DREAM_PATTERN_INSET on DREAM_INSET_IDS). */
const SHEEN_STRIPES: ReadonlyMap<DreamLookId, { fills: { colour: number; alpha: number }[]; inset: number }> = new Map(
  (Object.keys(DREAM_SWATCH) as DreamLookId[])
    .filter(isSheenDream)
    .map((id) => [id, { fills: DREAM_SWATCH[id].marks.map(parseFill), inset: DREAM_INSET_IDS.includes(id) ? DREAM_PATTERN_INSET : 0 }]),
);

/** A non-vertical polygon edge, left end first, with its winding direction. */
interface Edge {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** +1 when the polygon runs toward +x along it, else -1. */
  readonly dir: number;
  /** A band quad edge (else a clip polygon edge). */
  readonly band: boolean;
  /** Scratch: y at the left and right of the current slab, then at the middle of the current sub-slab. */
  yl: number;
  yr: number;
  ym: number;
}

function yAt(e: Edge, x: number): number {
  if (x === e.x0) return e.y0;
  if (x === e.x1) return e.y1;
  return e.y0 + ((e.y1 - e.y0) * (x - e.x0)) / (e.x1 - e.x0);
}

function addPolygonEdges(edges: Edge[], polys: readonly DreamPolygon[], band: boolean): void {
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i];
      const [bx, by] = poly[(i + 1) % poly.length];
      if (ax === bx) continue;
      const forward = ax < bx;
      edges.push({
        x0: forward ? ax : bx,
        y0: forward ? ay : by,
        x1: forward ? bx : ax,
        y1: forward ? by : ay,
        dir: forward ? 1 : -1,
        band,
        yl: 0,
        yr: 0,
        ym: 0,
      });
    }
  }
}

function xRange(polys: readonly DreamPolygon[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const poly of polys) {
    for (const [x] of poly) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return [lo, hi];
}

/** A run polygon being built left to right: its top and bottom chains and the edges they now follow. */
interface Run {
  readonly top: number[];
  readonly bottom: number[];
  topEdge: Edge;
  bottomEdge: Edge;
  /** Its right side: x, then the top and bottom y there. */
  x: number;
  yt: number;
  yb: number;
}

/** Extend a chain to (x, y): a point on the same edge as the last one replaces it. */
function extendChain(chain: number[], sameEdge: boolean, x: number, y: number): void {
  if (sameEdge) chain.length -= 2;
  chain.push(x, y);
}

/** Builds the run polygons of one band from its trapezoids, one sub-slab at a time. */
class RunBuilder {
  private open: Run[] = [];
  private next: Run[] = [];
  private cursor = 0;
  count = 0;

  constructor(private readonly polygons: number[][]) {}

  /** Add the trapezoid of sub-slab [p, q] between edges `topEdge` (smaller y) and `bottomEdge`. */
  add(topEdge: Edge, bottomEdge: Edge, p: number, q: number): void {
    const ytl = yAt(topEdge, p);
    const ybl = yAt(bottomEdge, p);
    const ytr = yAt(topEdge, q);
    const ybr = yAt(bottomEdge, q);
    if (ybl - ytl <= SIDE_EPS && ybr - ytr <= SIDE_EPS) return;
    const open = this.open;
    while (this.cursor < open.length && open[this.cursor].yt < ytl - SIDE_EPS) this.cursor++;
    const run = open[this.cursor];
    if (run && run.x === p && Math.abs(run.yt - ytl) <= SIDE_EPS && Math.abs(run.yb - ybl) <= SIDE_EPS) {
      open.splice(this.cursor, 1);
      extendChain(run.top, run.topEdge === topEdge, q, ytr);
      extendChain(run.bottom, run.bottomEdge === bottomEdge, q, ybr);
      run.topEdge = topEdge;
      run.bottomEdge = bottomEdge;
      run.x = q;
      run.yt = ytr;
      run.yb = ybr;
      this.next.push(run);
      return;
    }
    this.next.push({ top: [p, ytl, q, ytr], bottom: [p, ybl, q, ybr], topEdge, bottomEdge, x: q, yt: ytr, yb: ybr });
  }

  /** End a sub-slab: runs it did not continue are finished. */
  endSubSlab(): void {
    for (const run of this.open) this.emit(run);
    const done = this.open;
    done.length = 0;
    this.open = this.next;
    this.next = done;
    this.cursor = 0;
  }

  /** Finish every open run and drop unused polygon arrays. */
  finish(): void {
    this.endSubSlab();
    this.polygons.length = this.count;
  }

  private emit(run: Run): void {
    const poly = this.polygons[this.count] ?? [];
    this.polygons[this.count] = poly;
    this.count++;
    poly.length = 0;
    for (const v of run.top) poly.push(v);
    const { top, bottom } = run;
    const last = bottom.length - 2;
    for (let i = last; i >= 0; i -= 2) {
      const tipRight = i === last && bottom[i + 1] === top[top.length - 1];
      const tipLeft = i === 0 && bottom[1] === top[1];
      if (!tipRight && !tipLeft) poly.push(bottom[i], bottom[i + 1]);
    }
  }
}

const byLeftThenRight = (a: Edge, b: Edge): number => a.yl - b.yl || a.yr - b.yr;
const byMiddle = (a: Edge, b: Edge): number => a.ym - b.ym;
const byLeftEnd = (a: Edge, b: Edge): number => a.x0 - b.x0;

/**
 * The x of every crossing of two edges inside slab (a, b), ascending: edges
 * sorted by y at a, then insertion-sorted by y at b; each swap is one crossing.
 */
function slabCrossings(active: Edge[], a: number, b: number, out: number[]): void {
  out.length = 0;
  for (const e of active) {
    e.yl = yAt(e, a);
    e.yr = yAt(e, b);
  }
  active.sort(byLeftThenRight);
  for (let i = 1; i < active.length; i++) {
    for (let j = i; j > 0 && active[j - 1].yr > active[j].yr; j--) {
      const upper = active[j - 1];
      const lower = active[j];
      const dl = lower.yl - upper.yl;
      const x = a + ((b - a) * dl) / (dl - (lower.yr - upper.yr));
      if (x > a && x < b) out.push(x);
      active[j - 1] = lower;
      active[j] = upper;
    }
  }
  out.sort((p, q) => p - q);
}

/** Trapezoids of sub-slab [p, q]: a nonzero sweep of the spanning edges, inside the clip union and the band. */
function addSubSlab(active: Edge[], p: number, q: number, runs: RunBuilder): void {
  const m = (p + q) / 2;
  for (const e of active) e.ym = yAt(e, m);
  active.sort(byMiddle);
  let clipWinding = 0;
  let bandWinding = 0;
  let top: Edge | null = null;
  for (const e of active) {
    if (e.band) bandWinding += e.dir;
    else clipWinding += e.dir;
    const inside = clipWinding !== 0 && bandWinding !== 0;
    if (inside && !top) top = e;
    else if (!inside && top) {
      runs.add(top, e, p, q);
      top = null;
    }
  }
  runs.endSubSlab();
}

/** Run polygons of `bandQuad` cut by the nonzero union of `clip` (as `clipEdges`) and by x <= toX, into `polygons`. */
function bandPolygons(
  clip: readonly DreamPolygon[],
  clipEdges: readonly Edge[],
  bandQuad: DreamPolygon,
  toX: number,
  polygons: number[][],
): void {
  const [clipLo, clipHi] = xRange(clip);
  const [bandLo, bandHi] = xRange([bandQuad]);
  const lo = Math.max(clipLo, bandLo);
  const hi = Math.min(clipHi, bandHi, toX);
  const runs = new RunBuilder(polygons);
  if (!(hi > lo)) {
    runs.finish();
    return;
  }
  const edges = [...clipEdges];
  addPolygonEdges(edges, [bandQuad], true);
  edges.sort(byLeftEnd);
  const xsSet = new Set<number>([lo, hi]);
  for (const e of edges) {
    if (e.x0 > lo && e.x0 < hi) xsSet.add(e.x0);
    if (e.x1 > lo && e.x1 < hi) xsSet.add(e.x1);
  }
  const xs = [...xsSet].sort((p, q) => p - q);
  const active: Edge[] = [];
  const crossings: number[] = [];
  let nextEdge = 0;
  for (let j = 0; j < xs.length - 1; j++) {
    const a = xs[j];
    const b = xs[j + 1];
    while (nextEdge < edges.length && edges[nextEdge].x0 <= a) active.push(edges[nextEdge++]);
    let kept = 0;
    for (const e of active) if (e.x1 > a) active[kept++] = e;
    active.length = kept;
    slabCrossings(active, a, b, crossings);
    let p = a;
    for (const c of crossings) {
      if (c <= p) continue;
      addSubSlab(active, p, c, runs);
      p = c;
    }
    addSubSlab(active, p, b, runs);
  }
  runs.finish();
}

function emptyStripe(): TailStripe {
  return [
    { colour: 0, alpha: 0, polygons: [] },
    { colour: 0, alpha: 0, polygons: [] },
  ];
}

/**
 * The stripe pair drawAxolotl paints for sheen Dream colour `id` on `look` at
 * this swim phase, tail amplitude and sheen (undefined: the reduced-motion
 * still stripe), on the part of the body at x <= toX, as flat-fill polygons in
 * local units: light band first, then the tint, in that colour's marks and
 * clip inset. Throws when `id` is not a sheen colour. `out` (a previous
 * result) is filled in place and returned, reusing its polygon arrays.
 */
export function tailStripe(
  id: DreamLookId,
  look: AxolotlArtLook,
  swimPhase: number,
  tailAmp: number,
  sheen: number | undefined,
  toX: number,
  out: TailStripe = emptyStripe(),
): TailStripe {
  const sheenStripe = SHEEN_STRIPES.get(id);
  if (!sheenStripe) throw new Error(`tailStripe: ${id} is not a sheen Dream colour`);
  const geo = axolotlBodyGeometry(look);
  const tail = tailSamples(geo.tail, swimPhase, tailAmp);
  const clip = dreamClipPolygons(geo.torso, tail, sheenStripe.inset);
  const clipEdges: Edge[] = [];
  addPolygonEdges(clipEdges, clip, false);
  const shapes = dreamPatternShapes(id, geo.torso, tail, sheen);
  for (let k = 0; k < out.length; k++) {
    const shape = shapes[k];
    if (shape?.kind !== 'polygon') throw new Error(`tailStripe: ${id} shape ${k} is not a band quad`);
    out[k].colour = sheenStripe.fills[k].colour;
    out[k].alpha = sheenStripe.fills[k].alpha;
    bandPolygons(clip, clipEdges, shape.points, toX, out[k].polygons);
  }
  return out;
}
