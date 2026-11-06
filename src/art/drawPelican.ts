/**
 * Pelican painters: Area 12's signature predator, the American white pelican line (issue #211; ND-5,
 * ND-6; guide 2, 4, 5 and 10).
 *
 * Every shape, size and colour here is derived (provisional): the pelican is not in the approved
 * prototype. It follows the character rules of the cormorant and the other predators (7c, 7h, 7k,
 * 7l, 7m, 7n, 7o): round and friendly, no sharp points, a round bill tip, a bead eye with two
 * glints, no teeth, no brows, no red eyes. A soft white bird with an orange bill and pouch and the
 * single ink outline (LW) on every part. The pouch never closes round anything: it is an empty sac,
 * open or relaxed, and no frame shows the axolotl, a grab, a hold or a carry (ADR 0007, ADR 0008).
 *
 * Pieces. The bird is drawn in pieces, as the heron's stab is, because a bill dips up to the line's
 * dip depth below the water line:
 * - a body frame (PELICAN_TEX) at the water line, facing right, anchored on the water line directly
 *   under the body centre (the pelican's logic point, its pose position at SURF): `floatA`, `floatB`,
 *   `warn` carry the neck, head, bill and pouch; `scoop` and `rise` carry the body and a neck stump
 *   only, because the head is the bill piece below;
 * - the bill piece (PELICAN_BILL_TEX): the round head, the bill pointing down and the pouch, anchored
 *   on the round bill tip, the scoop box's bottom (pose billDepth below SURF). The head centre is
 *   PELICAN_BILL_HEAD_BACK above the anchor;
 * - the neck piece (PELICAN_NECK_TEX): a plain white tube anchored on its top end centre, which the
 *   scene stretches along y between the stump and the head centre;
 * - the scoop splash (PELICAN_SPLASH_TEX): a low ring and a crown of round drops, anchored on the
 *   water line where the bill goes in.
 * Mirror every piece with faceSprite; the neck column PELICAN_NECK_X is mirrored with it.
 *
 * Contrast (10): the feathers are a light soft white (11.5:1 with ink), the bill and pouch orange
 * (7.4:1 and 9.5:1 with ink): ink holds every edge on its own. No fill is lighter than the hero's
 * belly, so the axolotl stays the brightest thing.
 *
 * Greyscale cues (10): floating, a long low body with a bill held level and an S neck; the warning,
 * a tall straight neck with the head tipped back and a wide hanging pouch; the scoop, a body tipped
 * nose down with the tail up and no head; the rise, a body tipped nose up with two wings lifted in a
 * V. None relies on hue.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser: gliding, the bob, the
 * dip, the splash timing and the switch between frames belong to the scene.
 */
import { blob, ell, frameFromBounds, inkMany, line, seg, type TexSize } from './canvasKit';
import { EYE, INK, LW, WHITE } from './palette';
import type { PelicanPhaseName } from '../logic/pelicanLine';

// ---------------------------------------------------------------------------
// Colours (guide 3g, 10)
// ---------------------------------------------------------------------------

/** Feathers: a soft white #e8e4f4, luminance 0.7917, 11.54:1 with ink; below the hero's belly (0.8231). */
export const PELICAN_FEATHER = '#e8e4f4';
/** Bill: a warm orange #ffa63d, luminance 0.4887, 7.38:1 with ink. */
export const PELICAN_BILL = '#ffa63d';
/** Pouch: a pale orange #ffc977, luminance 0.6437, 9.51:1 with ink. */
export const PELICAN_POUCH = '#ffc977';
/** The inside of an open pouch: a deeper orange #e8803a, luminance 0.3290, 5.20:1 with ink. */
export const PELICAN_POUCH_HOLLOW = '#e8803a';
/** Wing line: an internal detail inside the silhouette, never an edge. */
export const PELICAN_WING_LINE = 'rgba(120,110,170,0.45)';
/** The one body shine (guide 5). Inside the silhouette, so alpha is allowed. */
export const PELICAN_SHINE = 'rgba(255,255,255,0.7)';
/** Splash water: a pale blue-white #cfeaf5, luminance 0.7870, 11.47:1 with ink, inked on every part. */
export const PELICAN_SPLASH = '#cfeaf5';

/** Ink width of the bill and pouch (3g), px, outside their fill. */
export const PELICAN_BILL_INK = 2.4;
/** The bob between the two float frames, px: `floatB` is `floatA` moved this far down. */
export const PELICAN_BOB = 1.5;

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/**
 * Body frames, all facing right with the anchor on the water line under the body centre and the tail
 * trailing to -x:
 * - `floatA`, `floatB`: floating, the neck in a gentle S, the head up and the bill level, the pouch
 *   relaxed; the same pose PELICAN_BOB apart; the scene swaps them while the line glides;
 * - `warn`: the warning: the neck straight up, the head tipped back and the pouch open and empty;
 * - `scoop`: the plunge and the hold: the body tipped nose down, the tail up, only a neck stump;
 * - `rise`: the rise: the body tipped nose up, the wings lifted in a V, only a neck stump.
 */
export type PelicanFrame = 'floatA' | 'floatB' | 'warn' | 'scoop' | 'rise';

/** The two float frames, in the order the scene swaps them. */
export const PELICAN_FLOAT_FRAMES: readonly PelicanFrame[] = ['floatA', 'floatB'];
/** Every body frame of the pelican. */
export const PELICAN_FRAMES: readonly PelicanFrame[] = [...PELICAN_FLOAT_FRAMES, 'warn', 'scoop', 'rise'];

/**
 * The body frame to hold for each pose frame (pelicanPose frame, the index of the phase in
 * PELICAN_PHASES): glide `floatA` (the scene swaps in `floatB` while it bobs), warn `warn`, plunge
 * and hold `scoop`, rise `rise`.
 */
export const PELICAN_FRAME_OF_PHASE: Readonly<Record<PelicanPhaseName, PelicanFrame>> = {
  glide: 'floatA',
  warn: 'warn',
  plunge: 'scoop',
  hold: 'scoop',
  rise: 'rise',
};

/** Padding round every sprite (the guide asks for 4 px at 1x). */
const PELICAN_PAD = 6;

type Pt = readonly [number, number];

/** One ellipse of a frame. */
export interface PelicanEllipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly rot: number;
}

/** A cubic piece of a neck path: two control points, then the end. */
type Cubic = readonly [number, number, number, number, number, number];

/** Neck tube width in colour, with ink LW each side. */
export const PELICAN_NECK_W = 9;
/** Head radius: the head is round. */
export const PELICAN_HEAD_R = 8;
/** Bead eye radius. */
export const PELICAN_EYE_R = 2.4;
/** Distance from the head centre to the round bill tip. */
export const PELICAN_HEAD_TO_TIP = 30;
const BILL_HALF = 3.2;
const BILL_TIP_R = 2.2;
/** Where the bill leaves the head, along the bill, from the head centre. */
const BILL_ROOT = 4;
/** Eye in the head's own frame (x along the bill). */
const EYE_IN_HEAD: Pt = [2.5, -3];

/** How wide the pouch hangs. */
type PouchKind = 'relaxed' | 'open' | 'scoop';

/** A pouch in the head's own frame, and its hollow when it is open. */
const POUCHES: Readonly<Record<PouchKind, { readonly sac: PelicanEllipse; readonly hollow: PelicanEllipse | null }>> = {
  // relaxed: a slim sac along the underside of the bill
  relaxed: { sac: { cx: 17, cy: 4.6, rx: 12, ry: 3.4, rot: 0 }, hollow: null },
  // open: a wide, deep sac, empty, the warning cue
  open: {
    sac: { cx: 18, cy: 8.5, rx: 12.5, ry: 8.5, rot: 0.15 },
    hollow: { cx: 18.5, cy: 7.5, rx: 8, ry: 4.8, rot: 0.15 },
  },
  // scoop: a medium sac for the dip
  scoop: { sac: { cx: 17, cy: 6, rx: 12, ry: 5.5, rot: 0.1 }, hollow: null },
};

interface PelicanPose {
  /** Wings held out, painted behind the body (only the `rise` pose). */
  readonly wings: readonly PelicanEllipse[];
  readonly tail: PelicanEllipse;
  readonly body: PelicanEllipse;
  /** Neck start, inside the body. */
  readonly neckFrom: Pt;
  /** The neck from neckFrom: cubic pieces, the last ending on the head centre (or the stump's end). */
  readonly neck: readonly Cubic[];
  /** The head centre; null for the stump frames, whose head is the bill piece. */
  readonly head: Pt | null;
  /** Bill direction in radians: 0 is +x, positive turns down (y is down). */
  readonly billAngle: number;
  readonly pouch: PouchKind;
  /** The soft wing line, [start, control, end]. */
  readonly wingLine: readonly [Pt, Pt, Pt];
  readonly shine: PelicanEllipse;
}

const FLOAT: PelicanPose = {
  wings: [],
  tail: { cx: -28, cy: -11, rx: 8, ry: 4.5, rot: 0.25 },
  body: { cx: 0, cy: -9, rx: 26, ry: 12, rot: 0 },
  neckFrom: [16, -13],
  neck: [[27, -16, 12, -26, 22, -35]],
  head: [22, -35],
  billAngle: 0.18,
  pouch: 'relaxed',
  wingLine: [
    [-18, -10],
    [-4, -2],
    [12, -10],
  ],
  shine: { cx: -6, cy: -16, rx: 7, ry: 1.7, rot: -0.05 },
};

/** The float pose moved down by `dy`. */
function bobbed(pose: PelicanPose, dy: number): PelicanPose {
  const moveEllipse = (e: PelicanEllipse): PelicanEllipse => ({ ...e, cy: e.cy + dy });
  const movePt = (p: Pt): Pt => [p[0], p[1] + dy];
  return {
    wings: pose.wings.map(moveEllipse),
    tail: moveEllipse(pose.tail),
    body: moveEllipse(pose.body),
    neckFrom: movePt(pose.neckFrom),
    neck: pose.neck.map((c) => [c[0], c[1] + dy, c[2], c[3] + dy, c[4], c[5] + dy] as const),
    head: pose.head ? movePt(pose.head) : null,
    billAngle: pose.billAngle,
    pouch: pose.pouch,
    wingLine: [movePt(pose.wingLine[0]), movePt(pose.wingLine[1]), movePt(pose.wingLine[2])],
    shine: moveEllipse(pose.shine),
  };
}

/** The x of the neck column the bill piece and the neck piece hang from, px, facing right. */
export const PELICAN_NECK_X = 22;
/** The y of the top of the neck piece on the stump frames, px from the anchor. */
export const PELICAN_NECK_TOP_Y = 0;

const POSES: Readonly<Record<PelicanFrame, PelicanPose>> = {
  floatA: FLOAT,
  floatB: bobbed(FLOAT, PELICAN_BOB),
  // the warning: the neck straight up, the head tipped back, the pouch open and empty
  warn: {
    wings: [],
    tail: { cx: -28, cy: -11, rx: 8, ry: 4.5, rot: 0.25 },
    body: { cx: 0, cy: -9, rx: 26, ry: 12, rot: 0 },
    neckFrom: [16, -13],
    neck: [[20, -30, 14, -46, 20, -60]],
    head: [20, -60],
    billAngle: -0.4,
    pouch: 'open',
    wingLine: [
      [-18, -10],
      [-4, -2],
      [12, -10],
    ],
    shine: { cx: -6, cy: -16, rx: 7, ry: 1.7, rot: -0.05 },
  },
  // the scoop: the body tipped nose down, the tail up, a neck stump going down; no head
  scoop: {
    wings: [],
    tail: { cx: -23, cy: -23, rx: 8, ry: 4.5, rot: 1.0 },
    body: { cx: 2, cy: -8, rx: 26, ry: 12, rot: 0.4 },
    neckFrom: [17, -6],
    neck: [[19, -3, 21, -1, PELICAN_NECK_X, PELICAN_NECK_TOP_Y]],
    head: null,
    billAngle: 0,
    pouch: 'relaxed',
    wingLine: [
      [-16, -14],
      [-2, -6],
      [12, -8],
    ],
    shine: { cx: -4, cy: -17, rx: 7, ry: 1.7, rot: 0.35 },
  },
  // the rise: the body tipped nose up, two wings lifted in a V; no head
  rise: {
    wings: [
      { cx: -5, cy: -33, rx: 18, ry: 6, rot: 1.04 },
      { cx: 0.4, cy: -36, rx: 18, ry: 6, rot: 1.37 },
    ],
    tail: { cx: -28, cy: -3, rx: 8, ry: 4.5, rot: -0.3 },
    body: { cx: 0, cy: -9, rx: 26, ry: 12, rot: -0.2 },
    neckFrom: [16, -12],
    neck: [[19, -8, 21, -3, PELICAN_NECK_X, PELICAN_NECK_TOP_Y]],
    head: null,
    billAngle: 0,
    pouch: 'relaxed',
    wingLine: [
      [-18, -8],
      [-4, -2],
      [12, -12],
    ],
    shine: { cx: -6, cy: -16, rx: 7, ry: 1.7, rot: -0.2 },
  },
};

/** The geometry of a head: its centre, bill direction, bill tip, pouch, hollow and eye. */
export interface PelicanHeadGeometry {
  readonly head: PelicanEllipse;
  readonly billAngle: number;
  readonly billTip: Pt;
  readonly pouch: PelicanEllipse;
  readonly hollow: PelicanEllipse | null;
  readonly eye: Pt;
}

/** A point in a head's own frame (x along the bill), placed on the head. */
function inHead(head: Pt, angle: number, p: Pt): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [head[0] + p[0] * c - p[1] * s, head[1] + p[0] * s + p[1] * c];
}

/** An ellipse in a head's own frame, placed on the head. */
function ellipseInHead(head: Pt, angle: number, e: PelicanEllipse): PelicanEllipse {
  const [cx, cy] = inHead(head, angle, [e.cx, e.cy]);
  return { cx, cy, rx: e.rx, ry: e.ry, rot: e.rot + angle };
}

/** The geometry of a head at `head`, its bill pointing along `angle`, with the given pouch. */
export function pelicanHeadGeometry(head: Pt, angle: number, pouch: PouchKind): PelicanHeadGeometry {
  const spec = POUCHES[pouch];
  return {
    head: { cx: head[0], cy: head[1], rx: PELICAN_HEAD_R, ry: PELICAN_HEAD_R, rot: 0 },
    billAngle: angle,
    billTip: inHead(head, angle, [PELICAN_HEAD_TO_TIP, 0]),
    pouch: ellipseInHead(head, angle, spec.sac),
    hollow: spec.hollow ? ellipseInHead(head, angle, spec.hollow) : null,
    eye: inHead(head, angle, EYE_IN_HEAD),
  };
}

/** The geometry of a body frame, facing right, around the anchor. */
export interface PelicanGeometry {
  /** Wings held out, behind the body: two in `rise`, none otherwise. */
  readonly wings: readonly PelicanEllipse[];
  /** Tail, body and, when there is a head, the head: the feather ellipses. */
  readonly featherEllipses: readonly PelicanEllipse[];
  readonly neckFrom: Pt;
  readonly neck: readonly Cubic[];
  /** The head, its bill, pouch and eye; null on the stump frames. */
  readonly head: PelicanHeadGeometry | null;
  readonly wingLine: readonly [Pt, Pt, Pt];
  readonly shine: PelicanEllipse;
}

/** The geometry of a frame: every ellipse, tube and point. */
export function pelicanGeometry(frame: PelicanFrame): PelicanGeometry {
  const pose = POSES[frame];
  const head = pose.head ? pelicanHeadGeometry(pose.head, pose.billAngle, pose.pouch) : null;
  return {
    wings: pose.wings,
    featherEllipses: head ? [pose.tail, pose.body, head.head] : [pose.tail, pose.body],
    neckFrom: pose.neckFrom,
    neck: pose.neck,
    head,
    wingLine: pose.wingLine,
    shine: pose.shine,
  };
}

/** The bill tip of a body frame with a head, relative to the anchor, facing right; null on the stump frames. */
export function pelicanBillTip(frame: PelicanFrame): { readonly x: number; readonly y: number } | null {
  const head = pelicanGeometry(frame).head;
  return head ? { x: head.billTip[0], y: head.billTip[1] } : null;
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
  const base: Pt = [tip[0] - dx * (PELICAN_HEAD_TO_TIP - BILL_ROOT), tip[1] - dy * (PELICAN_HEAD_TO_TIP - BILL_ROOT)];
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
function ellipseBox(e: PelicanEllipse, reach: number): Box {
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

/** Box of a head with its bill and pouch and their ink. */
function headBox(h: PelicanHeadGeometry): Box {
  const bill = billPoints(h.billTip, h.billAngle);
  return unionBox([
    ellipseBox(h.head, LW),
    pointsBox([bill.left, bill.right, bill.capLeft, bill.capRight, h.billTip], PELICAN_BILL_INK),
    ellipseBox(h.pouch, PELICAN_BILL_INK),
  ]);
}

/** Box of a body frame: the feather parts and the neck with their ink, the bill and pouch with theirs. */
function frameBox(frame: PelicanFrame): Box {
  const g = pelicanGeometry(frame);
  const neckPoints: Pt[] = [g.neckFrom];
  for (const c of g.neck) neckPoints.push([c[0], c[1]], [c[2], c[3]], [c[4], c[5]]);
  const boxes = [
    ...[...g.wings, ...g.featherEllipses].map((e) => ellipseBox(e, LW)),
    pointsBox(neckPoints, PELICAN_NECK_W / 2 + LW),
  ];
  if (g.head) boxes.push(headBox(g.head));
  return unionBox(boxes);
}

/**
 * Texture frame shared by every pelican body frame (provisional): the union of the five frames with
 * their ink, plus 6 px of padding. Anchor is the water line under the body centre, local (0, 0), the
 * pelican's logic point. Facing right: the scene mirrors the sprite with faceSprite.
 */
export const PELICAN_TEX: TexSize = (() => {
  const box = unionBox(PELICAN_FRAMES.map(frameBox));
  return frameFromBounds(box.minX, box.minY, box.maxX, box.maxY, PELICAN_PAD);
})();

/** The bill piece's head: pointing straight down, the round bill tip at the anchor. */
const BILL_PIECE = pelicanHeadGeometry([0, -PELICAN_HEAD_TO_TIP], Math.PI / 2, 'scoop');

/** Distance in px from the bill piece's anchor (the round bill tip) up to the head centre. */
export const PELICAN_BILL_HEAD_BACK = PELICAN_HEAD_TO_TIP;

/** The geometry of the bill piece: the head over the bill tip, the bill pointing down and the pouch. */
export function pelicanBillPieceGeometry(): PelicanHeadGeometry {
  return BILL_PIECE;
}

/**
 * Texture frame of the bill piece (provisional): the head, bill, pouch and their ink plus 6 px of
 * padding. Anchor is the round bill tip, local (0, 0), with the bill pointing down (+y) and the head
 * centre PELICAN_BILL_HEAD_BACK above it. Facing right: the scene mirrors it with faceSprite.
 */
export const PELICAN_BILL_TEX: TexSize = (() => {
  const box = headBox(BILL_PIECE);
  return frameFromBounds(box.minX, box.minY, box.maxX, box.maxY, PELICAN_PAD);
})();

/**
 * Length in px of the neck piece as baked, from its top end centre (local (0, 0)) down to local
 * (0, PELICAN_NECK_LEN). The scene sets its scaleY to (distance from the stump to the head centre)
 * / PELICAN_NECK_LEN, with the top at the higher of the two.
 */
export const PELICAN_NECK_LEN = 48;

/**
 * Texture frame of the neck piece (provisional): the tube from local (0, 0) to (0, PELICAN_NECK_LEN),
 * its ink, and 5 px of padding. Anchor is the top end centre.
 */
export const PELICAN_NECK_TEX: TexSize = frameFromBounds(
  -(PELICAN_NECK_W / 2 + LW),
  -LW - PELICAN_NECK_W / 2,
  PELICAN_NECK_W / 2 + LW,
  PELICAN_NECK_LEN + PELICAN_NECK_W / 2 + LW,
  5,
);

// ---------------------------------------------------------------------------
// Splash
// ---------------------------------------------------------------------------

/** One round drop of the splash crown: centre and radius. */
interface Drop {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** The crown of five round drops, fanned above the water line, symmetric about x = 0. */
export const PELICAN_SPLASH_DROPS: readonly Drop[] = [
  { x: -17, y: -11, r: 3.2 },
  { x: -8.5, y: -17, r: 3.8 },
  { x: 0, y: -20, r: 4.2 },
  { x: 8.5, y: -17, r: 3.8 },
  { x: 17, y: -11, r: 3.2 },
];

/** The low ring the bill leaves on the water line: half-width and half-height. */
export const PELICAN_SPLASH_RING = { rx: 18, ry: 4 } as const;

/**
 * Texture frame of the splash (provisional): the ring and the crown with their ink plus 6 px of
 * padding. Anchor is the water line where the bill goes in, the ring's centre.
 */
export const PELICAN_SPLASH_TEX: TexSize = (() => {
  const ink = PELICAN_BILL_INK;
  const drops = PELICAN_SPLASH_DROPS.map((d) => ({ minX: d.x - d.r - ink, minY: d.y - d.r - ink, maxX: d.x + d.r + ink, maxY: d.y + d.r + ink }));
  const ring = { minX: -PELICAN_SPLASH_RING.rx - ink, minY: -PELICAN_SPLASH_RING.ry - ink, maxX: PELICAN_SPLASH_RING.rx + ink, maxY: PELICAN_SPLASH_RING.ry + ink };
  const box = unionBox([...drops, ring]);
  return frameFromBounds(box.minX, box.minY, box.maxX, box.maxY, PELICAN_PAD);
})();

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

function ellipsePath(e: PelicanEllipse, shrink = 0): Path2D {
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
 * One merged group of feather parts: every ink first, then every fill, so overlapping parts merge
 * into one silhouette with no ink across a joint. The neck tube is stroked the same way.
 */
function paintFeatherGroup(ctx: CanvasRenderingContext2D, ellipses: readonly PelicanEllipse[], neck: Path2D | null): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * LW;
  for (const e of ellipses) ctx.stroke(ellipsePath(e));
  if (neck) {
    ctx.lineWidth = PELICAN_NECK_W + 2 * LW;
    ctx.stroke(neck);
  }
  ctx.fillStyle = PELICAN_FEATHER;
  for (const e of ellipses) ctx.fill(ellipsePath(e));
  if (neck) {
    ctx.lineWidth = PELICAN_NECK_W;
    ctx.strokeStyle = PELICAN_FEATHER;
    ctx.stroke(neck);
  }
}

function quadPath(c: readonly [Pt, Pt, Pt]): Path2D {
  const p = new Path2D();
  p.moveTo(c[0][0], c[0][1]);
  p.quadraticCurveTo(c[1][0], c[1][1], c[2][0], c[2][1]);
  return p;
}

/** The soft line along a lifted wing, on its long axis. */
function wingAxisPath(e: PelicanEllipse): Path2D {
  const reach = e.rx * 0.6;
  const dx = Math.cos(e.rot) * reach;
  const dy = Math.sin(e.rot) * reach;
  const p = new Path2D();
  p.moveTo(e.cx - dx, e.cy - dy);
  p.lineTo(e.cx + dx, e.cy + dy);
  return p;
}

/** The face over the head: the bead eye and two white glints. */
function paintEye(ctx: CanvasRenderingContext2D, eye: Pt): void {
  const bead = new Path2D();
  ell(bead, eye[0], eye[1], PELICAN_EYE_R, PELICAN_EYE_R);
  ctx.fillStyle = EYE;
  ctx.fill(bead);
  const glints = new Path2D();
  const r = PELICAN_EYE_R;
  ell(glints, eye[0] + 0.3 * r, eye[1] - 0.35 * r, 0.38 * r, 0.38 * r);
  ell(glints, eye[0] - 0.35 * r, eye[1] + 0.35 * r, 0.17 * r, 0.17 * r);
  ctx.fillStyle = WHITE;
  ctx.fill(glints);
}

/** The pouch behind the bill: an inked sac, and when open, its empty deeper hollow with a thin ink rim. */
function paintPouch(ctx: CanvasRenderingContext2D, h: PelicanHeadGeometry): void {
  blob(ctx, ellipsePath(h.pouch), PELICAN_POUCH, PELICAN_BILL_INK);
  if (h.hollow) {
    ctx.fillStyle = PELICAN_POUCH_HOLLOW;
    ctx.fill(ellipsePath(h.hollow));
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = INK;
    ctx.stroke(ellipsePath(h.hollow));
  }
}

/**
 * Paint one pelican body frame around the anchor. Layer order, back to front: the lifted wings
 * (`rise` only; one feather group, with a soft line along each), the pouch, the closed bill, the
 * tail, body, neck and head (one feather group, so no seam shows), the wing line, the one shine and
 * the bead eye. The bill is one closed path with a round tip: never open. The pouch is an empty sac.
 */
export function paintPelican(ctx: CanvasRenderingContext2D, frame: PelicanFrame): void {
  const g = pelicanGeometry(frame);
  if (g.wings.length > 0) {
    paintFeatherGroup(ctx, g.wings, null);
    ctx.lineWidth = 2;
    ctx.strokeStyle = PELICAN_WING_LINE;
    for (const wing of g.wings) ctx.stroke(wingAxisPath(wing));
  }
  if (g.head) {
    paintPouch(ctx, g.head);
    blob(ctx, billPath(g.head.billTip, g.head.billAngle), PELICAN_BILL, PELICAN_BILL_INK);
  }
  paintFeatherGroup(ctx, g.featherEllipses, neckPath(g.neckFrom, g.neck));

  ctx.lineWidth = 2;
  ctx.strokeStyle = PELICAN_WING_LINE;
  ctx.stroke(quadPath(g.wingLine));
  ctx.fillStyle = PELICAN_SHINE;
  ctx.fill(ellipsePath(g.shine));
  if (g.head) paintEye(ctx, g.head.eye);
}

/**
 * Paint the bill piece around the round bill tip: the pouch, the bill pointing down, the round head
 * and the bead eye. No neck: the neck piece joins at the head centre.
 */
export function paintPelicanBill(ctx: CanvasRenderingContext2D): void {
  const h = BILL_PIECE;
  paintPouch(ctx, h);
  blob(ctx, billPath(h.billTip, h.billAngle), PELICAN_BILL, PELICAN_BILL_INK);
  paintFeatherGroup(ctx, [h.head], null);
  paintEye(ctx, h.eye);
}

/** Paint the neck piece: one PELICAN_FEATHER tube with its ink, round at both ends. */
export function paintPelicanNeck(ctx: CanvasRenderingContext2D): void {
  inkMany(ctx, [seg(line(0, 0, 0, PELICAN_NECK_LEN), PELICAN_NECK_W, PELICAN_FEATHER, LW)]);
}

/**
 * Paint the scoop splash around the water line: a low ring (inked, pale water inside) and a crown of
 * five round drops, each with the 2.4 px ink outline of the bill. Only water: nothing in it, nothing held.
 */
export function paintPelicanSplash(ctx: CanvasRenderingContext2D): void {
  const ring = new Path2D();
  ell(ring, 0, 0, PELICAN_SPLASH_RING.rx, PELICAN_SPLASH_RING.ry);
  blob(ctx, ring, PELICAN_SPLASH, PELICAN_BILL_INK);
  for (const d of PELICAN_SPLASH_DROPS) {
    const p = new Path2D();
    ell(p, d.x, d.y, d.r, d.r);
    blob(ctx, p, PELICAN_SPLASH, PELICAN_BILL_INK);
  }
}
