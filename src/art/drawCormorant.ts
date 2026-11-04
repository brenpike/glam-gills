/**
 * Cormorant painters: the diving predator of the deep canal (issue #112; PRD N3, A11; guide 7n).
 *
 * Every shape, size and colour here is derived (provisional): the cormorant is not in the approved
 * prototype. It follows guide sections 2, 4, 5 and 10, and the character rules of the tilapia, the
 * heron, the garter snake, the carp, the crayfish and the black bass (7c, 7h, 7k, 7l, 7m, 7o): round
 * and friendly, no sharp points, the bill always closed with a rounded tip. The cormorant is never
 * shown grabbing, holding, lifting or carrying the axolotl (A11, ADR 0007, ADR 0008): no frame has
 * the axolotl in it, and a hit shows only the shared leg-loss poof.
 *
 * Shape: a small dark water bird: an oval body, a tail tuft, a long neck, a round head and a short
 * closed bill with a pale throat patch, a bead eye with two glints and a teal eye ring, one soft wing
 * line and one shine. No open bill, no teeth, no talons, no brows, no red eyes.
 *
 * Contrast (10): the feathers are a dark body (1.69:1 with ink), so ink alone does not hold the edge.
 * Every feather part carries a 2 px rim light inside its ink, all the way round, so ink or rim is
 * 3.01:1 or better on any background. The bill and throat patch pass on their own (10.65:1 with ink).
 *
 * Greyscale cues (10): floating, a dark body traced by a pale rim with a long upright neck; the
 * warning, a low hump with the tail up and the head at the water; the dive, a long slim shape; the
 * cooldown, a wide T of spread wings. None relies on hue.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser: drifting, the bob,
 * the dive arc, the bubble trail and the switch between frames belong to the scene. Every frame
 * faces right, with its anchor on the body centre and the tail trailing toward -x; the scene mirrors
 * the sprite with faceSprite.
 */
import { blob, ell, frameFromBounds, type TexSize } from './canvasKit';
import { HERON_BEAK } from './drawHeron';
import { EYE, INK, LW, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3g, 10)
// ---------------------------------------------------------------------------

/** Feathers: a dusky blue-black #4b4a66, luminance 0.0735, 1.69:1 with ink, so the rim light holds the edge. */
export const CORMORANT_FEATHER = '#4b4a66';
/**
 * Rim light: the melanoid rim #cec9f0 of the dark Dream bodies (6p), luminance 0.612, 9.07:1 with
 * ink and 5.36:1 against the feathers. 2 px wide, inside the ink.
 */
export const CORMORANT_RIM = '#cec9f0';
/** Bill and throat patch: the heron beak colour #ffd98a, luminance 0.727, 10.65:1 with ink. */
export const CORMORANT_BILL = HERON_BEAK;
/** Eye ring: a teal #55e4d8, 11.18:1 with the bead and 5.45:1 against the feathers. */
export const CORMORANT_EYE_RING = '#55e4d8';
/** Wing line: an internal detail inside the silhouette, never an edge. */
export const CORMORANT_WING_LINE = 'rgba(206,201,240,0.4)';
/** The one body shine (guide 5). Inside the silhouette, so alpha is allowed. */
export const CORMORANT_SHINE = 'rgba(255,255,255,0.5)';

/** Width of the rim light inside the ink, px. */
export const CORMORANT_RIM_W = 2;
/** Ink width of the bill and throat patch (3g), px, outside their fill. */
export const CORMORANT_BILL_INK = 2.4;
/** The bob between the two float frames, px: `floatB` is `floatA` moved this far down. */
export const CORMORANT_BOB = 1.5;

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/**
 * Still frames, all facing right with the body centre at the anchor and the tail trailing to -x:
 * - `floatA`, `floatB`: floating, the neck in a gentle S, the head up and the bill level; the same
 *   pose CORMORANT_BOB apart; the scene swaps them while the cormorant drifts or chases;
 * - `warn`: the dive crouch, the warning cue: the body tipped about 0.35 rad nose down, the tail up
 *   and the neck arched forward and down with the bill at the water;
 * - `dive`: streamlined, the neck straight, the wings folded and the feet trailing; the bill closed;
 * - `dry`: the cooldown, the wings held half open to the sides with rounded ends: a wide T.
 */
export type CormorantFrame = 'floatA' | 'floatB' | 'warn' | 'dive' | 'dry';

/** The two float frames, in the order the scene swaps them. */
export const CORMORANT_FLOAT_FRAMES: readonly CormorantFrame[] = ['floatA', 'floatB'];
/** Every frame of the cormorant. */
export const CORMORANT_FRAMES: readonly CormorantFrame[] = [...CORMORANT_FLOAT_FRAMES, 'warn', 'dive', 'dry'];

/** Padding round every frame (the guide asks for 4 px at 1x). */
const CORMORANT_PAD = 6;

type Pt = readonly [number, number];

/** One ellipse of a frame. */
export interface CormorantEllipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly rot: number;
}

/** A cubic piece of a neck path: two control points, then the end. */
type Cubic = readonly [number, number, number, number, number, number];

/** Neck tube width in colour (rim and feathers), with ink LW each side. */
export const CORMORANT_NECK_W = 9;
/** Head radius: the head is round. */
export const CORMORANT_HEAD_R = 8;
/** Bead eye radius. */
export const CORMORANT_EYE_R = 2.6;
/** Eye ring width, centred just outside the bead. */
const EYE_RING_W = 1.4;
/** Bill: from its round tip back into the head. */
const BILL_LEN = 14;
const BILL_HALF = 3;
const BILL_TIP_R = 2;
/** Distance from the head centre to the bill tip. */
const HEAD_TO_TIP = 18;
/** Eye and throat patch, in the head's own frame (x along the bill). */
const EYE_IN_HEAD: Pt = [2.5, -2.2];
const THROAT_IN_HEAD: CormorantEllipse = { cx: 3, cy: 3.6, rx: 3.6, ry: 2.6, rot: 0.2 };

interface CormorantPose {
  /** Wings held out, painted behind the body (only the `dry` pose). */
  readonly wings: readonly CormorantEllipse[];
  readonly tail: CormorantEllipse;
  /** Trailing feet (only the `dive` pose). */
  readonly feet: readonly CormorantEllipse[];
  readonly body: CormorantEllipse;
  /** Neck start, inside the body. */
  readonly neckFrom: Pt;
  /** The neck from neckFrom: cubic pieces, the last ending on the head centre. */
  readonly neck: readonly Cubic[];
  readonly head: Pt;
  /** Bill direction in radians: 0 is +x, positive turns down (y is down). */
  readonly billAngle: number;
  /** The soft wing line, [start, control, end]. */
  readonly wingLine: readonly [Pt, Pt, Pt];
  readonly shine: CormorantEllipse;
}

const FLOAT: CormorantPose = {
  wings: [],
  tail: { cx: -21, cy: -3, rx: 9, ry: 4, rot: 0.25 },
  feet: [],
  body: { cx: 0, cy: 0, rx: 18, ry: 10, rot: 0 },
  neckFrom: [11, -4],
  neck: [[17, -12, 9, -18, 14, -27]],
  head: [14, -27],
  billAngle: 0,
  wingLine: [
    [-14, -3],
    [-2, 4],
    [8, -4],
  ],
  shine: { cx: -3, cy: -5, rx: 5, ry: 1.5, rot: -0.05 },
};

/** The float pose moved down by `dy`. */
function bobbed(pose: CormorantPose, dy: number): CormorantPose {
  const moveEllipse = (e: CormorantEllipse): CormorantEllipse => ({ ...e, cy: e.cy + dy });
  const movePt = (p: Pt): Pt => [p[0], p[1] + dy];
  return {
    wings: pose.wings.map(moveEllipse),
    tail: moveEllipse(pose.tail),
    feet: pose.feet.map(moveEllipse),
    body: moveEllipse(pose.body),
    neckFrom: movePt(pose.neckFrom),
    neck: pose.neck.map((c) => [c[0], c[1] + dy, c[2], c[3] + dy, c[4], c[5] + dy] as const),
    head: movePt(pose.head),
    billAngle: pose.billAngle,
    wingLine: [movePt(pose.wingLine[0]), movePt(pose.wingLine[1]), movePt(pose.wingLine[2])],
    shine: moveEllipse(pose.shine),
  };
}

/** Body tilt of the dive crouch: about 0.35 rad nose down (7n). */
export const CORMORANT_WARN_TILT = 0.35;

const POSES: Readonly<Record<CormorantFrame, CormorantPose>> = {
  floatA: FLOAT,
  floatB: bobbed(FLOAT, CORMORANT_BOB),
  // the dive crouch: the body tipped nose down, the tail up, the neck arched forward and down
  warn: {
    wings: [],
    tail: { cx: -18.7, cy: -10, rx: 9, ry: 4, rot: 0.85 },
    feet: [],
    body: { cx: 0, cy: 0, rx: 18, ry: 10, rot: CORMORANT_WARN_TILT },
    neckFrom: [11.5, 0],
    neck: [[16, -14, 30, -16, 32, -5]],
    head: [32, -5],
    billAngle: 0.7,
    wingLine: [
      [-12, -7],
      [-2, 3],
      [8, 0],
    ],
    shine: { cx: -1, cy: -5, rx: 5, ry: 1.5, rot: 0.3 },
  },
  // streamlined: the neck straight, the wings folded, the feet trailing
  dive: {
    wings: [],
    tail: { cx: -24, cy: 0, rx: 9, ry: 3.5, rot: 0 },
    feet: [{ cx: -31, cy: 3, rx: 5, ry: 2.5, rot: 0.2 }],
    body: { cx: 0, cy: 0, rx: 20, ry: 8, rot: 0 },
    neckFrom: [12, 0],
    neck: [[17, 0, 22, 0, 27, 0]],
    head: [27, 0],
    billAngle: 0,
    wingLine: [
      [-15, -1],
      [-2, 4],
      [10, -1],
    ],
    shine: { cx: -3, cy: -3.5, rx: 6, ry: 1.3, rot: 0 },
  },
  // the cooldown: floating, the wings held half open to the sides
  dry: {
    ...FLOAT,
    wings: [
      { cx: -19, cy: -11, rx: 20, ry: 6, rot: 0.3 },
      { cx: 21, cy: -11, rx: 20, ry: 6, rot: -0.3 },
    ],
  },
};

/** The geometry of a frame, facing right, around the body centre. */
export interface CormorantGeometry {
  /** Wings held out, behind the body: two in `dry`, none otherwise. */
  readonly wings: readonly CormorantEllipse[];
  /** Tail, feet, body and head, back to front: the feather ellipses with a rim and ink. */
  readonly featherEllipses: readonly CormorantEllipse[];
  readonly neckFrom: Pt;
  readonly neck: readonly Cubic[];
  readonly head: Pt;
  readonly billAngle: number;
  readonly billTip: Pt;
  readonly throat: CormorantEllipse;
  readonly eye: Pt;
  readonly wingLine: readonly [Pt, Pt, Pt];
  readonly shine: CormorantEllipse;
}

/** A point in a head's own frame (x along the bill), placed on the head. */
function inHead(head: Pt, angle: number, p: Pt): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [head[0] + p[0] * c - p[1] * s, head[1] + p[0] * s + p[1] * c];
}

/** The geometry of a frame: every ellipse, tube and point. */
export function cormorantGeometry(frame: CormorantFrame): CormorantGeometry {
  const pose = POSES[frame];
  const headEllipse: CormorantEllipse = { cx: pose.head[0], cy: pose.head[1], rx: CORMORANT_HEAD_R, ry: CORMORANT_HEAD_R, rot: 0 };
  const [tx, ty] = inHead(pose.head, pose.billAngle, [THROAT_IN_HEAD.cx, THROAT_IN_HEAD.cy]);
  return {
    wings: pose.wings,
    featherEllipses: [pose.tail, ...pose.feet, pose.body, headEllipse],
    neckFrom: pose.neckFrom,
    neck: pose.neck,
    head: pose.head,
    billAngle: pose.billAngle,
    billTip: inHead(pose.head, pose.billAngle, [HEAD_TO_TIP, 0]),
    throat: { ...THROAT_IN_HEAD, cx: tx, cy: ty, rot: THROAT_IN_HEAD.rot + pose.billAngle },
    eye: inHead(pose.head, pose.billAngle, EYE_IN_HEAD),
    wingLine: pose.wingLine,
    shine: pose.shine,
  };
}

/** The bill tip of a frame, relative to the anchor (the body centre), facing right. */
export function cormorantBillTip(frame: CormorantFrame): { readonly x: number; readonly y: number } {
  const [x, y] = cormorantGeometry(frame).billTip;
  return { x, y };
}

interface BillPoints {
  readonly left: Pt;
  readonly right: Pt;
  readonly capLeft: Pt;
  readonly capRight: Pt;
  /** Centre of the round tip. */
  readonly centre: Pt;
}

/** The corners of a closed bill whose round tip is at `tip` and which points along `angle`. */
function billPoints(tip: Pt, angle: number): BillPoints {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const centre: Pt = [tip[0] - dx * BILL_TIP_R, tip[1] - dy * BILL_TIP_R];
  const base: Pt = [tip[0] - dx * BILL_LEN, tip[1] - dy * BILL_LEN];
  return {
    left: [base[0] + nx * BILL_HALF, base[1] + ny * BILL_HALF],
    right: [base[0] - nx * BILL_HALF, base[1] - ny * BILL_HALF],
    capLeft: [centre[0] + nx * BILL_TIP_R, centre[1] + ny * BILL_TIP_R],
    capRight: [centre[0] - nx * BILL_TIP_R, centre[1] - ny * BILL_TIP_R],
    centre,
  };
}

// ---------------------------------------------------------------------------
// Frame size
// ---------------------------------------------------------------------------

/** Axis-aligned box in px. */
interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Box of an ellipse with `reach` px of ink round it; rotation exact. */
function ellipseBox(e: CormorantEllipse, reach: number): Box {
  const hx = Math.hypot(e.rx * Math.cos(e.rot), e.ry * Math.sin(e.rot)) + reach;
  const hy = Math.hypot(e.rx * Math.sin(e.rot), e.ry * Math.cos(e.rot)) + reach;
  return { minX: e.cx - hx, minY: e.cy - hy, maxX: e.cx + hx, maxY: e.cy + hy };
}

function pointsBox(points: readonly Pt[], grow: number): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs) - grow, minY: Math.min(...ys) - grow, maxX: Math.max(...xs) + grow, maxY: Math.max(...ys) + grow };
}

function unionBox(boxes: readonly Box[]): Box {
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}

/** Box of a frame: the feather parts and the neck with their ink, the bill and throat patch with theirs. */
function frameBox(frame: CormorantFrame): Box {
  const g = cormorantGeometry(frame);
  const neckPoints: Pt[] = [g.neckFrom];
  for (const c of g.neck) neckPoints.push([c[0], c[1]], [c[2], c[3]], [c[4], c[5]]);
  const bill = billPoints(g.billTip, g.billAngle);
  return unionBox([
    ...[...g.wings, ...g.featherEllipses].map((e) => ellipseBox(e, LW)),
    pointsBox(neckPoints, CORMORANT_NECK_W / 2 + LW),
    pointsBox([bill.left, bill.right, bill.capLeft, bill.capRight, g.billTip], CORMORANT_BILL_INK),
    ellipseBox(g.throat, CORMORANT_BILL_INK),
  ]);
}

/**
 * Texture frame shared by every cormorant frame (provisional): the union of the five frames with
 * their ink, plus 6 px of padding. Anchor is the body centre, local (0, 0), the cormorant's logic
 * point. Facing right: the scene mirrors the sprite with faceSprite.
 */
export const CORMORANT_TEX: TexSize = (() => {
  const box = unionBox(CORMORANT_FRAMES.map(frameBox));
  return frameFromBounds(box.minX, box.minY, box.maxX, box.maxY, CORMORANT_PAD);
})();

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

function ellipsePath(e: CormorantEllipse, shrink = 0): Path2D {
  const p = new Path2D();
  ell(p, e.cx, e.cy, e.rx - shrink, e.ry - shrink, e.rot);
  return p;
}

function neckPath(from: Pt, neck: readonly Cubic[]): Path2D {
  const p = new Path2D();
  p.moveTo(from[0], from[1]);
  for (const c of neck) p.bezierCurveTo(c[0], c[1], c[2], c[3], c[4], c[5]);
  return p;
}

/** Closed bill: straight sides from inside the head to a round tip. */
function billPath(tip: Pt, angle: number): Path2D {
  const b = billPoints(tip, angle);
  const p = new Path2D();
  p.moveTo(b.left[0], b.left[1]);
  p.lineTo(b.capLeft[0], b.capLeft[1]);
  p.arc(b.centre[0], b.centre[1], BILL_TIP_R, angle + Math.PI / 2, angle - Math.PI / 2, true);
  p.lineTo(b.right[0], b.right[1]);
  p.closePath();
  return p;
}

/**
 * One merged group of feather parts with the rim light: every ink first, then every rim, then every
 * feather core, so overlapping parts merge into one silhouette with no ink or rim across a joint.
 * Each ellipse is inked outside (LW), filled with the rim, then its core (CORMORANT_RIM_W smaller)
 * is filled with the feathers. The neck tube is stroked the same way: ink, rim, then a feather core
 * 2 x CORMORANT_RIM_W narrower.
 */
function paintFeatherGroup(ctx: CanvasRenderingContext2D, ellipses: readonly CormorantEllipse[], neck: Path2D | null): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * LW;
  for (const e of ellipses) ctx.stroke(ellipsePath(e));
  if (neck) {
    ctx.lineWidth = CORMORANT_NECK_W + 2 * LW;
    ctx.stroke(neck);
  }
  ctx.fillStyle = CORMORANT_RIM;
  for (const e of ellipses) ctx.fill(ellipsePath(e));
  if (neck) {
    ctx.lineWidth = CORMORANT_NECK_W;
    ctx.strokeStyle = CORMORANT_RIM;
    ctx.stroke(neck);
  }
  ctx.fillStyle = CORMORANT_FEATHER;
  for (const e of ellipses) ctx.fill(ellipsePath(e, CORMORANT_RIM_W));
  if (neck) {
    ctx.lineWidth = CORMORANT_NECK_W - 2 * CORMORANT_RIM_W;
    ctx.strokeStyle = CORMORANT_FEATHER;
    ctx.stroke(neck);
  }
}

function quadPath(c: readonly [Pt, Pt, Pt]): Path2D {
  const p = new Path2D();
  p.moveTo(c[0][0], c[0][1]);
  p.quadraticCurveTo(c[1][0], c[1][1], c[2][0], c[2][1]);
  return p;
}

/** The soft line along a held-out wing, on its long axis. */
function wingAxisPath(e: CormorantEllipse): Path2D {
  const reach = e.rx * 0.6;
  const dx = Math.cos(e.rot) * reach;
  const dy = Math.sin(e.rot) * reach;
  const p = new Path2D();
  p.moveTo(e.cx - dx, e.cy - dy);
  p.lineTo(e.cx + dx, e.cy + dy);
  return p;
}

/** The face over the head: the bead eye with its teal ring and two white glints. */
function paintEye(ctx: CanvasRenderingContext2D, eye: Pt): void {
  const ring = new Path2D();
  ell(ring, eye[0], eye[1], CORMORANT_EYE_R + EYE_RING_W / 2, CORMORANT_EYE_R + EYE_RING_W / 2);
  ctx.lineWidth = EYE_RING_W;
  ctx.strokeStyle = CORMORANT_EYE_RING;
  ctx.stroke(ring);

  const bead = new Path2D();
  ell(bead, eye[0], eye[1], CORMORANT_EYE_R, CORMORANT_EYE_R);
  ctx.fillStyle = EYE;
  ctx.fill(bead);
  const glints = new Path2D();
  const r = CORMORANT_EYE_R;
  ell(glints, eye[0] + 0.3 * r, eye[1] - 0.35 * r, 0.38 * r, 0.38 * r);
  ell(glints, eye[0] - 0.35 * r, eye[1] + 0.35 * r, 0.17 * r, 0.17 * r);
  ctx.fillStyle = WHITE;
  ctx.fill(glints);
}

/**
 * Paint one cormorant frame around the anchor (the body centre). Layer order, back to front: the
 * held-out wings (`dry` only; one feather group, with a soft line along each), the closed bill
 * (inked CORMORANT_BILL_INK), the tail, feet, body, neck and head (one feather group, so no seam
 * shows), the wing line, the one shine, the throat patch (inked CORMORANT_BILL_INK) and the bead
 * eye with its teal ring and two glints. The bill is one closed path with a round tip: never open.
 */
export function paintCormorant(ctx: CanvasRenderingContext2D, frame: CormorantFrame): void {
  const g = cormorantGeometry(frame);
  if (g.wings.length > 0) {
    paintFeatherGroup(ctx, g.wings, null);
    ctx.lineWidth = 2;
    ctx.strokeStyle = CORMORANT_WING_LINE;
    for (const wing of g.wings) ctx.stroke(wingAxisPath(wing));
  }
  blob(ctx, billPath(g.billTip, g.billAngle), CORMORANT_BILL, CORMORANT_BILL_INK);
  paintFeatherGroup(ctx, g.featherEllipses, neckPath(g.neckFrom, g.neck));

  ctx.lineWidth = 2;
  ctx.strokeStyle = CORMORANT_WING_LINE;
  ctx.stroke(quadPath(g.wingLine));
  ctx.fillStyle = CORMORANT_SHINE;
  ctx.fill(ellipsePath(g.shine));

  blob(ctx, ellipsePath(g.throat), CORMORANT_BILL, CORMORANT_BILL_INK);
  paintEye(ctx, g.eye);
}
