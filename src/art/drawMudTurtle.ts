/**
 * Mud turtle painters: the lake's dark-bottom predator, a small friendly Valley of Mexico mud turtle
 * (issue #212; PRD N3, A11; guide 7t, 3g and 10).
 *
 * Every shape, size and colour here is derived (provisional): the turtle is not in the approved
 * prototype. It follows the character rules of the cormorant, the pelican and the other predators
 * (7c, 7h, 7n, 7o, 7r): round and friendly, no sharp points, a round closed toothless beak, a bead
 * eye with two glints, no brows, no red. A low smooth dome of a shell on four stubby round legs. No
 * frame has the axolotl, a snack or any other thing in it, and no beak is ever drawn on, round or over
 * anything: the snap ends in an empty closed beak (ADR 0007, ADR 0008).
 *
 * Pieces. The turtle is drawn in pieces, as the pelican is, because the head goes out up to 110 px:
 * - a body frame (MUD_TURTLE_TEX), facing right, anchored on the shell centre (the turtle's logic
 *   point), the tail trailing toward -x: `crawlA`, `crawlB`, `warn` and `still` carry the neck, head
 *   and beak; `snap` carries the body and a neck stump only, because the head is the piece below;
 * - the head piece (MUD_TURTLE_HEAD_TEX): the round head, the closed beak and the eye, anchored on the
 *   head centre;
 * - the neck piece (MUD_TURTLE_NECK_TEX): a plain skin tube anchored on its top end centre, which the
 *   scene stretches along y between the stump and the head.
 * Mirror every piece with faceSprite.
 *
 * Rim group (7t). Every part but the beak is inked LW outside, filled with the pale sand rim, then
 * its core, 2 px smaller: all the inks first, then all the rims, then all the cores, so the rim runs
 * all the way round the silhouette and no ink or rim shows across a joint. The rim, not the ink, is
 * what holds the edge on the lake's near-black water (ink is only 1.41:1 on band 4).
 *
 * Greyscale cues (10): crawling, a low dark dome traced by a pale rim with a lighter head and legs;
 * warning, the head raised above the dome; snap, a long low shape with a neck stump; still, the round
 * dome. None relies on hue.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser: the crawl swap, the
 * turn, the neck stretch and the switch between frames belong to the scene.
 */
import { blob, ell, frameFromBounds, type TexSize } from './canvasKit';
import { EYE, INK, LW, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours and widths (guide 3g, 7t)
// ---------------------------------------------------------------------------

/** Shell core: a dark olive-brown #5a4a2c, luminance 0.0725, 1.68:1 with ink. */
export const MUD_TURTLE_SHELL = '#5a4a2c';
/** Rim: a pale sand #e6dcb0, luminance 0.7114, 10.44:1 with ink; 2 px, just inside the ink, all round. */
export const MUD_TURTLE_RIM = '#e6dcb0';
/** Skin (head, neck, legs, tail): a lighter olive #8c8650, luminance 0.2320, 3.87:1 with ink. */
export const MUD_TURTLE_SKIN = '#8c8650';
/** Beak: #d8cda0, luminance 0.6080, 9.02:1 with ink. */
export const MUD_TURTLE_BEAK = '#d8cda0';
/** The three scute lines: internal detail inside the silhouette, never an edge. */
export const MUD_TURTLE_SCUTE = 'rgba(230,220,176,0.45)';
/** The one shine on the dome's upper left. Inside the silhouette, so alpha is allowed. */
export const MUD_TURTLE_SHINE = 'rgba(255,255,255,0.35)';

/** Ink width of the beak (3g), px, outside its fill. */
export const MUD_TURTLE_BEAK_INK = 2.4;
/** Width of the rim, px: the core of every part is this much smaller on every side. */
export const MUD_TURTLE_RIM_W = 2;
/** Width of a scute line, px. */
export const MUD_TURTLE_SCUTE_W = 1.6;
/** Width of the smile line, px, in ink. */
export const MUD_TURTLE_SMILE_W = 1.6;

/** Head radius to the rim's outer edge: the head is round. */
export const MUD_TURTLE_HEAD_R = 7;
/** Bead eye radius. */
export const MUD_TURTLE_EYE_R = 2.2;
/** Neck tube width to the rim's outer edge. */
export const MUD_TURTLE_NECK_W = 7;
/** Length in px of the neck piece as baked, from local (0, 0) down to local (0, MUD_TURTLE_NECK_LEN). */
export const MUD_TURTLE_NECK_LEN = 48;
/** The beak's round tip radius. */
export const MUD_TURTLE_BEAK_TIP_R = 2.5;
/** Distance from the head centre to the round beak tip. */
export const MUD_TURTLE_HEAD_TO_TIP = 11;
/** The beak's half width at its root. */
const BEAK_HALF = 3;
/** Where the beak leaves the head, along the beak, from the head centre. */
const BEAK_ROOT = 4;
/** The eye in the head's own frame (x along the beak). */
const EYE_IN_HEAD: Pt = [1.8, -2];

/** Shell dome: half width, height, and the y of its flat base. */
export const MUD_TURTLE_SHELL_RX = 20;
export const MUD_TURTLE_SHELL_RY = 13;
export const MUD_TURTLE_SHELL_BASE_Y = 4;

/** Keys the later bake step uses (guide 7t). */
export const MUD_TURTLE_KEYS = {
  crawlA: 'mud-turtle-crawl-a',
  crawlB: 'mud-turtle-crawl-b',
  warn: 'mud-turtle-warn',
  snap: 'mud-turtle-snap',
  still: 'mud-turtle-still',
  head: 'mud-turtle-head',
  neck: 'mud-turtle-neck',
} as const;

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/**
 * Body frames, all facing right with the anchor on the shell centre and the tail trailing to -x:
 * - `crawlA`, `crawlB`: crawling, the head out level on a short neck; the diagonal leg pairs swing
 *   MUD_TURTLE_SWING px one way and the other, and `crawlB` has the shell moved MUD_TURTLE_BODY_BOB
 *   px down;
 * - `warn`: the warning: the shell tipped nose up, the front legs wide, the neck raised and the head
 *   up with the beak tipped up, closed;
 * - `snap`: the shell tipped nose down, the legs braced and a short neck stump; the head and neck are
 *   the pieces;
 * - `still`: rest, the cooldown and reduced motion: the legs level, the head out level.
 */
export type MudTurtleFrame = 'crawlA' | 'crawlB' | 'warn' | 'snap' | 'still';

/** The two crawl frames, in the order the scene swaps them. */
export const MUD_TURTLE_CRAWL_FRAMES: readonly MudTurtleFrame[] = ['crawlA', 'crawlB'];
/** Every body frame of the mud turtle. */
export const MUD_TURTLE_FRAMES: readonly MudTurtleFrame[] = ['crawlA', 'crawlB', 'warn', 'snap', 'still'];

/** How far the diagonal leg pairs swing in a crawl frame, px. */
export const MUD_TURTLE_SWING = 3;
/** How far `crawlB`'s shell sits below `crawlA`'s, px. */
export const MUD_TURTLE_BODY_BOB = 1;

/** Padding round every sprite (the guide asks for 4 px at 1x). */
const PAD = 6;

type Pt = readonly [number, number];
/** A cubic piece of a neck path: two control points, then the end. */
type Cubic = readonly [number, number, number, number, number, number];

/** One ellipse of a frame. */
export interface MudTurtleEllipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly rot: number;
}

type LegName = 'nearBack' | 'nearFront' | 'farBack' | 'farFront';

/** Leg ovals: rounded, about 5 x 3.5, the feet reaching about 8 below the anchor. */
const LEG_RX = 5;
const LEG_RY = 3.5;
const NEAR_LEG_Y = 4.5;
const FAR_LEG_Y = 3.5;
/** The tail nub: tiny, round, trailing toward -x. */
const TAIL: MudTurtleEllipse = { cx: -22, cy: 2, rx: 4, ry: 3, rot: 0 };

interface Pose {
  /** The shell and its detail moved down by this much. */
  readonly shellDy: number;
  /** The shell tipped by this much, radians, about the base centre; negative is nose up. */
  readonly shellRot: number;
  /** The x of each leg centre. */
  readonly legX: Readonly<Record<LegName, number>>;
  /** Neck start, inside the shell. */
  readonly neckFrom: Pt;
  /** The neck from neckFrom, ending on the head centre (or the stump's end). */
  readonly neck: Cubic;
  /** The head centre; null for the stump frame, whose head is the head piece. */
  readonly head: Pt | null;
  /** Beak direction in radians: 0 is +x, negative turns up (y is down). */
  readonly beakAngle: number;
}

/** The level legs: swung by +/- MUD_TURTLE_SWING in the crawl frames, braced or wide in the others. */
const LEVEL_LEGS: Readonly<Record<LegName, number>> = { nearBack: -14, nearFront: 7, farBack: -5, farFront: 15 };

/** Neck start, inside the shell. */
const NECK_FROM: Pt = [13, -1];
/** The head's level place in the crawl and still frames. */
const HEAD_LEVEL: Pt = [21, -1];
const NECK_LEVEL: Cubic = [16, -1, 19, -1, HEAD_LEVEL[0], HEAD_LEVEL[1]];
const HEAD_WARN: Pt = [23, -14];

/** Where the neck stump of the snap frame ends. */
export const MUD_TURTLE_STUMP: Pt = [17, -3];

const swung = (s: number): Readonly<Record<LegName, number>> => ({
  nearBack: LEVEL_LEGS.nearBack - s,
  nearFront: LEVEL_LEGS.nearFront + s,
  farBack: LEVEL_LEGS.farBack + s,
  farFront: LEVEL_LEGS.farFront - s,
});

const POSES: Readonly<Record<MudTurtleFrame, Pose>> = {
  crawlA: { shellDy: 0, shellRot: 0, legX: swung(MUD_TURTLE_SWING), neckFrom: NECK_FROM, neck: NECK_LEVEL, head: HEAD_LEVEL, beakAngle: 0 },
  crawlB: { shellDy: MUD_TURTLE_BODY_BOB, shellRot: 0, legX: swung(-MUD_TURTLE_SWING), neckFrom: NECK_FROM, neck: NECK_LEVEL, head: HEAD_LEVEL, beakAngle: 0 },
  // the warning: shell nose up, the front legs planted wide, the neck up and a little forward
  warn: {
    shellDy: 0,
    shellRot: -0.08,
    legX: { ...LEVEL_LEGS, nearFront: 10, farFront: 19 },
    neckFrom: [13, -2],
    neck: [20, -3, 22, -8, HEAD_WARN[0], HEAD_WARN[1]],
    head: HEAD_WARN,
    beakAngle: -0.35,
  },
  // the snap: shell nose down, the legs braced, a neck stump; no head
  snap: {
    shellDy: 0,
    shellRot: 0.05,
    legX: { nearBack: -17, nearFront: 10, farBack: -8, farFront: 18 },
    neckFrom: [13, -2],
    neck: [14, -2, 16, -3, MUD_TURTLE_STUMP[0], MUD_TURTLE_STUMP[1]],
    head: null,
    beakAngle: 0,
  },
  still: { shellDy: 0, shellRot: 0, legX: LEVEL_LEGS, neckFrom: NECK_FROM, neck: NECK_LEVEL, head: HEAD_LEVEL, beakAngle: 0 },
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** A point rotated by `rot` about `pivot`. */
function rotateAbout(p: Pt, pivot: Pt, rot: number): Pt {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const dx = p[0] - pivot[0];
  const dy = p[1] - pivot[1];
  return [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c];
}

/** The shell: the dome (a half ellipse on a flat base) and its core, 2 px smaller. */
export interface MudTurtleShell {
  /** Centre of the dome's base: the half ellipse's centre. */
  readonly base: Pt;
  /** The outer dome: its centre is `base`. */
  readonly outer: MudTurtleEllipse;
  /** The core dome, 2 px inside the outer on every side. */
  readonly core: MudTurtleEllipse;
  readonly scuteLines: readonly (readonly [Pt, Pt, Pt])[];
  readonly shine: MudTurtleEllipse;
}

/** Scute lines in the untipped shell's own frame: three curved lines on the dome, inside the core. */
const SCUTES: readonly (readonly [Pt, Pt, Pt])[] = [
  [[-9, 1], [-11, -3], [-8, -4.5]],
  [[0, 1], [1.5, -3], [0, -5.2]],
  [[9, 1], [11, -3], [8, -4.5]],
];
/** The one shine, in the untipped shell's own frame. */
const SHINE: MudTurtleEllipse = { cx: -8, cy: -3.5, rx: 4, ry: 1, rot: -0.3 };

function shellOf(pose: Pose): MudTurtleShell {
  const dy = pose.shellDy;
  const rot = pose.shellRot;
  const base: Pt = [0, MUD_TURTLE_SHELL_BASE_Y + dy];
  const move = (p: Pt): Pt => rotateAbout([p[0], p[1] + dy], base, rot);
  const coreCentre = move([0, MUD_TURTLE_SHELL_BASE_Y - MUD_TURTLE_RIM_W]);
  const shineCentre = move([SHINE.cx, SHINE.cy]);
  return {
    base,
    outer: { cx: base[0], cy: base[1], rx: MUD_TURTLE_SHELL_RX, ry: MUD_TURTLE_SHELL_RY, rot },
    core: {
      cx: coreCentre[0],
      cy: coreCentre[1],
      rx: MUD_TURTLE_SHELL_RX - MUD_TURTLE_RIM_W,
      ry: MUD_TURTLE_SHELL_RY - 2 * MUD_TURTLE_RIM_W,
      rot,
    },
    scuteLines: SCUTES.map((q) => [move(q[0]), move(q[1]), move(q[2])] as const),
    shine: { cx: shineCentre[0], cy: shineCentre[1], rx: SHINE.rx, ry: SHINE.ry, rot: SHINE.rot + rot },
  };
}

/** The geometry of a head: its centre, beak direction, beak tip and eye. */
export interface MudTurtleHeadGeometry {
  readonly head: MudTurtleEllipse;
  readonly beakAngle: number;
  readonly beakTip: Pt;
  readonly eye: Pt;
}

/** A point in a head's own frame (x along the beak), placed on the head. */
function inHead(head: Pt, angle: number, p: Pt): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [head[0] + p[0] * c - p[1] * s, head[1] + p[0] * s + p[1] * c];
}

/** The geometry of a head at `head`, its beak pointing along `angle`. */
export function mudTurtleHeadGeometry(head: Pt, angle: number): MudTurtleHeadGeometry {
  return {
    head: { cx: head[0], cy: head[1], rx: MUD_TURTLE_HEAD_R, ry: MUD_TURTLE_HEAD_R, rot: 0 },
    beakAngle: angle,
    beakTip: inHead(head, angle, [MUD_TURTLE_HEAD_TO_TIP, 0]),
    eye: inHead(head, angle, EYE_IN_HEAD),
  };
}

/** The geometry of a body frame, facing right, around the anchor. */
export interface MudTurtleGeometry {
  readonly shell: MudTurtleShell;
  /** The legs, far pair first, then near: each a rounded oval, outer size. */
  readonly farLegs: readonly MudTurtleEllipse[];
  readonly nearLegs: readonly MudTurtleEllipse[];
  readonly tail: MudTurtleEllipse;
  readonly neckFrom: Pt;
  readonly neck: Cubic;
  /** The head, its beak and eye; null on the snap frame. */
  readonly head: MudTurtleHeadGeometry | null;
}

/** The geometry of a frame: every dome, oval, tube and point. */
export function mudTurtleGeometry(frame: MudTurtleFrame): MudTurtleGeometry {
  const pose = POSES[frame];
  const leg = (name: LegName, y: number): MudTurtleEllipse => ({ cx: pose.legX[name], cy: y, rx: LEG_RX, ry: LEG_RY, rot: 0 });
  return {
    shell: shellOf(pose),
    farLegs: [leg('farBack', FAR_LEG_Y), leg('farFront', FAR_LEG_Y)],
    nearLegs: [leg('nearBack', NEAR_LEG_Y), leg('nearFront', NEAR_LEG_Y)],
    tail: TAIL,
    neckFrom: pose.neckFrom,
    neck: pose.neck,
    head: pose.head ? mudTurtleHeadGeometry(pose.head, pose.beakAngle) : null,
  };
}

/** The corners of the closed beak: root corners inside the head, cap corners at the round tip. */
interface BeakPoints {
  readonly left: Pt;
  readonly right: Pt;
  readonly capLeft: Pt;
  readonly capRight: Pt;
  /** Centre of the round tip. */
  readonly centre: Pt;
}

function beakPoints(h: MudTurtleHeadGeometry): BeakPoints {
  const head: Pt = [h.head.cx, h.head.cy];
  const capAt = MUD_TURTLE_HEAD_TO_TIP - MUD_TURTLE_BEAK_TIP_R;
  return {
    left: inHead(head, h.beakAngle, [BEAK_ROOT, BEAK_HALF]),
    right: inHead(head, h.beakAngle, [BEAK_ROOT, -BEAK_HALF]),
    capLeft: inHead(head, h.beakAngle, [capAt, MUD_TURTLE_BEAK_TIP_R]),
    capRight: inHead(head, h.beakAngle, [capAt, -MUD_TURTLE_BEAK_TIP_R]),
    centre: inHead(head, h.beakAngle, [capAt, 0]),
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
function ellipseBox(e: MudTurtleEllipse, reach: number): Box {
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

/** Points along the outer dome, base corner to base corner, rotated as the shell is. */
function domePoints(e: MudTurtleEllipse): Pt[] {
  const points: Pt[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI + (Math.PI * i) / 32;
    const u = e.rx * Math.cos(a);
    const v = e.ry * Math.sin(a);
    points.push([e.cx + u * Math.cos(e.rot) - v * Math.sin(e.rot), e.cy + u * Math.sin(e.rot) + v * Math.cos(e.rot)]);
  }
  return points;
}

/** Box of a head with its beak and their ink. */
function headBox(h: MudTurtleHeadGeometry): Box {
  const b = beakPoints(h);
  return unionBox([
    ellipseBox(h.head, LW),
    pointsBox([b.left, b.right, b.capLeft, b.capRight, h.beakTip], MUD_TURTLE_BEAK_INK),
  ]);
}

/** Box of a body frame: every part with its ink, the beak with its own. */
function frameBox(frame: MudTurtleFrame): Box {
  const g = mudTurtleGeometry(frame);
  const neckPoints: Pt[] = [g.neckFrom, [g.neck[0], g.neck[1]], [g.neck[2], g.neck[3]], [g.neck[4], g.neck[5]]];
  const boxes = [
    pointsBox(domePoints(g.shell.outer), LW),
    ...[...g.farLegs, ...g.nearLegs, g.tail].map((e) => ellipseBox(e, LW)),
    pointsBox(neckPoints, MUD_TURTLE_NECK_W / 2 + LW),
  ];
  if (g.head) boxes.push(headBox(g.head));
  return unionBox(boxes);
}

/**
 * Texture frame shared by every mud turtle body frame (provisional): the union of the five frames
 * with their ink, plus 6 px of padding. Anchor is the shell centre, local (0, 0), the turtle's logic
 * point. Facing right: the scene mirrors the sprite with faceSprite.
 */
export const MUD_TURTLE_TEX: TexSize = (() => {
  const box = unionBox(MUD_TURTLE_FRAMES.map(frameBox));
  return frameFromBounds(box.minX, box.minY, box.maxX, box.maxY, PAD);
})();

/** The head piece's head: level, beak pointing +x, the head centre at the anchor. */
const HEAD_PIECE = mudTurtleHeadGeometry([0, 0], 0);

/** The geometry of the head piece: the round head, the closed beak and the eye, centred on the anchor. */
export function mudTurtleHeadPieceGeometry(): MudTurtleHeadGeometry {
  return HEAD_PIECE;
}

/**
 * Texture frame of the head piece (provisional): the head, beak and their ink plus 6 px of padding.
 * Anchor is the head centre, local (0, 0), the beak pointing +x. Facing right: the scene mirrors it.
 */
export const MUD_TURTLE_HEAD_TEX: TexSize = (() => {
  const box = headBox(HEAD_PIECE);
  return frameFromBounds(box.minX, box.minY, box.maxX, box.maxY, PAD);
})();

/**
 * Texture frame of the neck piece (provisional): the tube from local (0, 0) to (0, MUD_TURTLE_NECK_LEN),
 * its ink, and 5 px of padding. Anchor is the top end centre.
 */
export const MUD_TURTLE_NECK_TEX: TexSize = frameFromBounds(
  -(MUD_TURTLE_NECK_W / 2 + LW),
  -LW - MUD_TURTLE_NECK_W / 2,
  MUD_TURTLE_NECK_W / 2 + LW,
  MUD_TURTLE_NECK_LEN + MUD_TURTLE_NECK_W / 2 + LW,
  5,
);

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

function ellipsePath(e: MudTurtleEllipse, shrink = 0): Path2D {
  const p = new Path2D();
  ell(p, e.cx, e.cy, e.rx - shrink, e.ry - shrink, e.rot);
  return p;
}

/** The dome: the upper half of the ellipse and its flat base, closed. */
function domePath(e: MudTurtleEllipse): Path2D {
  const p = new Path2D();
  p.ellipse(e.cx, e.cy, e.rx, e.ry, e.rot, Math.PI, 2 * Math.PI);
  p.closePath();
  return p;
}

function neckPath(from: Pt, neck: Cubic): Path2D {
  const p = new Path2D();
  p.moveTo(from[0], from[1]);
  p.bezierCurveTo(neck[0], neck[1], neck[2], neck[3], neck[4], neck[5]);
  return p;
}

function quadPath(q: readonly [Pt, Pt, Pt]): Path2D {
  const p = new Path2D();
  p.moveTo(q[0][0], q[0][1]);
  p.quadraticCurveTo(q[1][0], q[1][1], q[2][0], q[2][1]);
  return p;
}

/** One part of a rim group: a filled shape or a tube, with its core colour. */
type RimPart =
  | { readonly kind: 'fill'; readonly outer: Path2D; readonly core: Path2D; readonly colour: string }
  | { readonly kind: 'tube'; readonly path: Path2D; readonly w: number; readonly colour: string };

const ovalPart = (e: MudTurtleEllipse, colour: string): RimPart => ({
  kind: 'fill',
  outer: ellipsePath(e),
  core: ellipsePath(e, MUD_TURTLE_RIM_W),
  colour,
});

/**
 * One merged rim group: every ink first (LW outside each part), then every rim, then every core, so
 * overlapping parts merge into one inked, rimmed silhouette with no ink or rim across a joint.
 */
function paintRimGroup(ctx: CanvasRenderingContext2D, parts: readonly RimPart[]): void {
  ctx.strokeStyle = INK;
  for (const part of parts) {
    ctx.lineWidth = part.kind === 'fill' ? 2 * LW : part.w + 2 * LW;
    ctx.stroke(part.kind === 'fill' ? part.outer : part.path);
  }
  for (const part of parts) {
    if (part.kind === 'fill') {
      ctx.fillStyle = MUD_TURTLE_RIM;
      ctx.fill(part.outer);
    } else {
      ctx.strokeStyle = MUD_TURTLE_RIM;
      ctx.lineWidth = part.w;
      ctx.stroke(part.path);
    }
  }
  for (const part of parts) {
    if (part.kind === 'fill') {
      ctx.fillStyle = part.colour;
      ctx.fill(part.core);
    } else {
      ctx.strokeStyle = part.colour;
      ctx.lineWidth = part.w - 2 * MUD_TURTLE_RIM_W;
      ctx.stroke(part.path);
    }
  }
}

/** The closed beak: straight sides from inside the head to a round tip. One closed path, never open. */
function beakPath(h: MudTurtleHeadGeometry): Path2D {
  const b = beakPoints(h);
  const p = new Path2D();
  p.moveTo(b.left[0], b.left[1]);
  p.lineTo(b.capLeft[0], b.capLeft[1]);
  p.arc(b.centre[0], b.centre[1], MUD_TURTLE_BEAK_TIP_R, h.beakAngle + Math.PI / 2, h.beakAngle - Math.PI / 2, true);
  p.lineTo(b.right[0], b.right[1]);
  p.closePath();
  return p;
}

/** The face over the head: the bead eye, two white glints and the one tiny closed smile line. */
function paintFace(ctx: CanvasRenderingContext2D, h: MudTurtleHeadGeometry): void {
  const head: Pt = [h.head.cx, h.head.cy];
  const smile = quadPath([inHead(head, h.beakAngle, [3.5, 2.8]), inHead(head, h.beakAngle, [1.5, 4.3]), inHead(head, h.beakAngle, [-0.8, 3.4])]);
  ctx.lineWidth = MUD_TURTLE_SMILE_W;
  ctx.strokeStyle = INK;
  ctx.stroke(smile);

  const bead = new Path2D();
  ell(bead, h.eye[0], h.eye[1], MUD_TURTLE_EYE_R, MUD_TURTLE_EYE_R);
  ctx.fillStyle = EYE;
  ctx.fill(bead);
  const glints = new Path2D();
  const r = MUD_TURTLE_EYE_R;
  ell(glints, h.eye[0] + 0.3 * r, h.eye[1] - 0.35 * r, 0.38 * r, 0.38 * r);
  ell(glints, h.eye[0] - 0.35 * r, h.eye[1] + 0.35 * r, 0.17 * r, 0.17 * r);
  ctx.fillStyle = WHITE;
  ctx.fill(glints);
}

/**
 * Paint one mud turtle body frame around the anchor. Layer order, back to front: one rim group (the
 * far legs, the tail nub, the near legs, the neck, the head when there is one, then the shell), the
 * closed beak (ink 2.4 outside its fill), the three scute lines and the one shine, then the face. The
 * beak is one closed path with a round tip: never open. Nothing else is in any frame.
 */
export function paintMudTurtle(ctx: CanvasRenderingContext2D, frame: MudTurtleFrame): void {
  const g = mudTurtleGeometry(frame);
  const parts: RimPart[] = [
    ...g.farLegs.map((e) => ovalPart(e, MUD_TURTLE_SKIN)),
    ovalPart(g.tail, MUD_TURTLE_SKIN),
    ...g.nearLegs.map((e) => ovalPart(e, MUD_TURTLE_SKIN)),
    { kind: 'tube', path: neckPath(g.neckFrom, g.neck), w: MUD_TURTLE_NECK_W, colour: MUD_TURTLE_SKIN },
  ];
  if (g.head) parts.push(ovalPart(g.head.head, MUD_TURTLE_SKIN));
  parts.push({ kind: 'fill', outer: domePath(g.shell.outer), core: domePath(g.shell.core), colour: MUD_TURTLE_SHELL });
  paintRimGroup(ctx, parts);

  if (g.head) blob(ctx, beakPath(g.head), MUD_TURTLE_BEAK, MUD_TURTLE_BEAK_INK);

  ctx.lineWidth = MUD_TURTLE_SCUTE_W;
  ctx.strokeStyle = MUD_TURTLE_SCUTE;
  for (const q of g.shell.scuteLines) ctx.stroke(quadPath(q));
  ctx.fillStyle = MUD_TURTLE_SHINE;
  ctx.fill(ellipsePath(g.shell.shine));

  if (g.head) paintFace(ctx, g.head);
}

/**
 * Paint the head piece around the head centre: the round head, the closed beak and the face. No
 * neck: the neck piece joins at the head centre. The beak is empty and closed.
 */
export function paintMudTurtleHead(ctx: CanvasRenderingContext2D): void {
  const h = HEAD_PIECE;
  paintRimGroup(ctx, [ovalPart(h.head, MUD_TURTLE_SKIN)]);
  blob(ctx, beakPath(h), MUD_TURTLE_BEAK, MUD_TURTLE_BEAK_INK);
  paintFace(ctx, h);
}

/** Paint the neck piece: one skin tube with its rim and ink, round at both ends. */
export function paintMudTurtleNeck(ctx: CanvasRenderingContext2D): void {
  const path = new Path2D();
  path.moveTo(0, 0);
  path.lineTo(0, MUD_TURTLE_NECK_LEN);
  paintRimGroup(ctx, [{ kind: 'tube', path, w: MUD_TURTLE_NECK_W, colour: MUD_TURTLE_SKIN }]);
}
