/**
 * Crayfish painters: the spring cave's signature predator (issue #77; PRD N2, N3; ND-15, ND-18).
 *
 * Every shape, size and colour here is derived (provisional): the crayfish is not in the approved
 * prototype. It follows guide sections 2, 4, 5 and 10, and the tilapia's, heron's, garter snake's
 * and carp's character rules (7c, 7h, 7k): round and friendly, no sharp points, the mouth always
 * closed. The crayfish is never shown holding, pinching down on, biting or hurting the axolotl
 * (A11, ADR 0007, ADR 0008): no frame has the axolotl in it, the pinch is a closed pair of claws
 * pushed straight forward along the floor, and a hit shows only the shared leg-loss poof.
 *
 * Shape: a plump rounded shell (a carapace and a round head, one merged silhouette) in a blue-grey,
 * a pale belly, a tail of three round segments with a rounded fan, four short legs, two small
 * claws, and two round eyes on short stalks. One small closed ink smile. No teeth, no fangs, no
 * tongue, no brows, no red, no sharp points: every claw tip is a rounded ellipse.
 *
 * The claws carry the cue (10). Closed they are small mittens close to the face with an ink seam.
 * In the warning they are raised and opened wide: each is a V of two rounded pincers with a
 * gap between them, so the silhouette is taller, wider and broken into separate lobes, and it
 * reads in greyscale by shape alone. The pale claws against the darker shell back that up by value.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser: walking, the
 * switch between frames, how long the claws stay open and the pinch's motion belong to the scene.
 * Every frame faces right, with its anchor on the shell's centre (the crayfish's logic point); the
 * feet are CRAYFISH_FOOT_Y below it, so the scene puts the anchor that far above the floor. The
 * scene mirrors the sprite with faceSprite and the tail trails behind whichever way it faces.
 */
import { blob, ell, frameFromBounds, inkMany, seg, type Seg, type TexSize } from './canvasKit';
import { EYE, INK, LW, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3g, 10)
// ---------------------------------------------------------------------------

/**
 * Crayfish shell: a soft blue-grey #8aa5c2, luminance 0.3621, 5.65:1 with ink. It is a cue object
 * (3c, 10) in a dark cave: 6.71:1 against the darkest cave tone CAVE_INTERIOR #031d33, so the shell
 * itself holds the edge there, and its opaque ink outline holds it on anything lighter. Cool and
 * muted, nowhere near the hero's pink or the carp's bronze, and not lighter than the hero's belly.
 */
export const CRAYFISH_SHELL = '#8aa5c2';
/**
 * Crayfish claws: a paler blue-grey #b4c8dc, luminance 0.5618, 8.39:1 with ink and 1.48:1 lighter
 * than the shell. The pale claws are the greyscale back-up of the open-claw shape: in the warning
 * two light V shapes stand out from the darker shell.
 */
export const CRAYFISH_CLAW = '#b4c8dc';
/**
 * Crayfish tail segments, tail fan and legs: a deeper blue-grey #617c9c, luminance 0.1936, 3.34:1
 * with ink and 1.69:1 darker than the shell. Darker than the shell, so the tail and legs read as
 * a darker rim in greyscale.
 */
export const CRAYFISH_DARK = '#617c9c';
/** Crayfish belly: a pale mist #dbe6f0, luminance 0.7794, 11.37:1 with ink and 2.01:1 lighter than the shell. Not lighter than the hero's belly #ffe3ed (0.823). Inside the silhouette, never an edge. */
export const CRAYFISH_BELLY = '#dbe6f0';
/** The one shell shine (guide 5). Inside the silhouette, so alpha is allowed. */
export const CRAYFISH_SHINE = 'rgba(255,255,255,0.5)';

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/**
 * Still frames, all facing right with the shell centre at the anchor and the tail trailing to -x:
 * - `stand`: the claws closed, the legs planted; the one held pose for reduced motion, and the
 *   pose between steps;
 * - `walkA`, `walkB`: the legs swing one way and the other, the tail bobbing; the scene cycles
 *   them (`walkA`, `stand`, `walkB`, `stand`) while the crayfish walks;
 * - `warn`: the warning cue, the shell reared a little and both claws raised and opened wide;
 * - `pinch`: the strike, both claws closed and pushed straight forward, level along the floor.
 */
export type CrayfishFrame = 'stand' | 'walkA' | 'walkB' | 'warn' | 'pinch';

/** The two walk frames, in the order the scene steps through them (with `stand` between). */
export const CRAYFISH_WALK_FRAMES: readonly CrayfishFrame[] = ['walkA', 'walkB'];
/** Every frame of the crayfish. */
export const CRAYFISH_FRAMES: readonly CrayfishFrame[] = ['stand', ...CRAYFISH_WALK_FRAMES, 'warn', 'pinch'];

/** Padding round every frame (the guide asks for 4 px at 1x). */
const CRAYFISH_PAD = 6;

type Pt = readonly [number, number];

/** One ellipse of a frame, in the frame's own (tilted) coordinates. */
export interface CrayfishEllipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly rot: number;
}

/** One claw: an arm, a round palm and two rounded pincers (lower first, upper second). */
export interface CrayfishClaw {
  /** Where the arm leaves the shell, and the wrist where the palm sits. */
  readonly arm: readonly [Pt, Pt];
  readonly palm: CrayfishEllipse;
  /** The lower pincer, then the upper one. Their tips are rounded ellipse ends. */
  readonly pincers: readonly [CrayfishEllipse, CrayfishEllipse];
  /** The angle between the two pincers, radians: near 0 is closed, over 1 is wide open. */
  readonly gape: number;
  /** The claw's closing seam, from the palm centre to the tip, drawn only when the claw is closed. */
  readonly seam: readonly [Pt, Pt];
}

// ---- geometry, facing right, before any tilt ----

/** Shell radii: the carapace is 42 x 28; the round head overlaps its front. The rules' body radius is 24. */
export const CRAYFISH_SHELL_RX = 21;
export const CRAYFISH_SHELL_RY = 14;
/** The round head: its centre and radii. */
const HEAD: readonly [number, number, number, number] = [16, -1, 11, 10];
/** Round eye ball radius (white, inked), and the pupil bead radius. */
export const CRAYFISH_EYE_BALL_R = 5;
const PUPIL_R = 3.1;
/** Where each pupil sits on its ball, forward and a little down, so the crayfish looks ahead. */
const PUPIL_AT: Pt = [1.3, 0.5];
/** Eye ball ink, thinner than the body's. */
const EYE_OL = 2;
/** Eye stalk colour width and the ink each side. */
const STALK_W = 3.6;
const STALK_OL = 2.2;
/** Where each leg leaves the shell, and the height the foot centre rests at. */
const LEG_BASE_X: readonly number[] = [-12, -4, 4, 12];
const LEG_BASE_Y = 9;
const FOOT_CENTRE_Y = 19;
const LEG_W = 3.6;
const LEG_OL = 2.2;
/** How far a lifted foot rises, px. */
const LEG_LIFT = 2.5;
/** Arm colour width and the ink each side. */
const ARM_W = 4;
const ARM_OL = 2.4;
/** Closing seam of a closed claw: ink line width. */
const SEAM_W = 1.6;
/**
 * The lowest ink of a planted foot, below the anchor, px. A planted foot (every leg in `stand`,
 * and all four in `warn` and `pinch`) is a round-capped tube ending at FOOT_CENTRE_Y.
 */
export const CRAYFISH_FOOT_Y = FOOT_CENTRE_Y + LEG_W / 2 + LEG_OL;

interface ClawSpec {
  readonly shoulder: Pt;
  readonly wrist: Pt;
  /** Direction the claw points along, radians (0 is +x, negative is up). */
  readonly dir: number;
  readonly gape: number;
  /** Pincer length from the wrist, and its half thickness. */
  readonly len: number;
  readonly thick: number;
  readonly palm: number;
}

interface CrayfishPose {
  /** Tilt of the shell, head and claws about the anchor, radians; negative rears the nose up (y is down). */
  readonly tilt: number;
  /** Tail bob, px; positive is down. */
  readonly tailDy: number;
  /** Sideways swing of each of the four feet, px. */
  readonly legDx: readonly number[];
  /** Whether each foot is lifted (1) or planted (0). */
  readonly lift: readonly number[];
  readonly far: ClawSpec;
  readonly near: ClawSpec;
}

/** Closed claws held low and close to the face, small mittens. */
const REST_FAR: ClawSpec = { shoulder: [20, 2], wrist: [32, 3], dir: 0.05, gape: 0.22, len: 11, thick: 4.2, palm: 5.2 };
const REST_NEAR: ClawSpec = { shoulder: [17, 11], wrist: [30, 14], dir: 0.1, gape: 0.22, len: 11, thick: 4.2, palm: 5.2 };

const POSES: Readonly<Record<CrayfishFrame, CrayfishPose>> = {
  stand: { tilt: 0, tailDy: 0, legDx: [-1, 0, 0, 1], lift: [0, 0, 0, 0], far: REST_FAR, near: REST_NEAR },
  walkA: { tilt: 0, tailDy: -1.2, legDx: [4, -4, 4, -4], lift: [0, 1, 0, 1], far: REST_FAR, near: REST_NEAR },
  walkB: { tilt: 0, tailDy: 1.2, legDx: [-4, 4, -4, 4], lift: [1, 0, 1, 0], far: REST_FAR, near: REST_NEAR },
  // the warning: the shell reared about 7 degrees, both claws raised and opened wide (about 75 degrees)
  warn: {
    tilt: -0.12,
    tailDy: -2.5,
    legDx: [2, -2, 2, -2],
    lift: [0, 0, 0, 0],
    far: { shoulder: [26, -3], wrist: [37, -22], dir: -1.45, gape: 1.3, len: 19, thick: 4.2, palm: 5.6 },
    near: { shoulder: [21, 8], wrist: [41, 1], dir: -0.3, gape: 1.3, len: 19, thick: 4.2, palm: 5.6 },
  },
  // the pinch: the shell leans a little forward, both claws closed and pushed level along the floor
  pinch: {
    tilt: 0.06,
    tailDy: 1,
    legDx: [5, 3, -3, -5],
    lift: [0, 0, 0, 0],
    far: { shoulder: [20, 3], wrist: [40, 4], dir: 0, gape: 0.22, len: 12, thick: 4.4, palm: 5.4 },
    near: { shoulder: [17, 11], wrist: [39, 13], dir: 0, gape: 0.22, len: 12, thick: 4.4, palm: 5.4 },
  },
};

function turn(x: number, y: number, tilt: number): Pt {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return [x * c - y * s, x * s + y * c];
}

interface CrayfishGeometry {
  /** The tail fan, then the three segments from the far end in: painted in this order. */
  readonly tail: readonly CrayfishEllipse[];
  /** The shell carapace and the round head: one merged silhouette. */
  readonly shell: readonly [CrayfishEllipse, CrayfishEllipse];
  readonly belly: CrayfishEllipse;
  readonly shine: CrayfishEllipse;
  /** The four legs, each [top, foot centre]; the shell is never tilted over the feet. */
  readonly legs: readonly (readonly [Pt, Pt])[];
  /** The two eye stalks, each [base, ball centre]. */
  readonly stalks: readonly (readonly [Pt, Pt])[];
  /** The two eye ball centres, far then near. */
  readonly eyes: readonly [Pt, Pt];
  /** The two pupil centres, far then near. */
  readonly pupils: readonly [Pt, Pt];
  /** The closed smile, [start, control, end]. */
  readonly mouth: readonly [Pt, Pt, Pt];
  readonly far: CrayfishClaw;
  readonly near: CrayfishClaw;
}

/** The geometry of a frame: every ellipse, tube and curve, already tilted. */
export function crayfishGeometry(frame: CrayfishFrame): CrayfishGeometry {
  const pose = POSES[frame];
  const t = pose.tilt;
  const pt = (x: number, y: number): Pt => turn(x, y, t);
  const el = (cx: number, cy: number, rx: number, ry: number, rot = 0): CrayfishEllipse => {
    const [x, y] = pt(cx, cy);
    return { cx: x, cy: y, rx, ry, rot: rot + t };
  };
  const claw = (spec: ClawSpec): CrayfishClaw => {
    const [wx, wy] = spec.wrist;
    const pincer = (angle: number): CrayfishEllipse =>
      el(wx + (spec.len / 2) * Math.cos(angle), wy + (spec.len / 2) * Math.sin(angle), spec.len / 2, spec.thick, angle);
    const lowerAngle = spec.dir + spec.gape / 2;
    const upperAngle = spec.dir - spec.gape / 2;
    return {
      arm: [pt(spec.shoulder[0], spec.shoulder[1]), pt(wx, wy)],
      palm: el(wx, wy, spec.palm, spec.palm * 0.92),
      pincers: [pincer(lowerAngle), pincer(upperAngle)],
      gape: spec.gape,
      seam: [pt(wx, wy), pt(wx + spec.len * Math.cos(spec.dir), wy + spec.len * Math.sin(spec.dir))],
    };
  };

  const tailK = [1.3, 1, 0.6, 0.3];
  const tail = [
    el(-47, 7.5 + pose.tailDy * tailK[0], 6.5, 9, 0.2),
    el(-38.5, 6.5 + pose.tailDy * tailK[1], 6, 5.5),
    el(-31, 5 + pose.tailDy * tailK[2], 7.5, 7),
    el(-22, 3 + pose.tailDy * tailK[3], 9, 8.5),
  ];

  const legs = LEG_BASE_X.map((x, i): readonly [Pt, Pt] => [
    [x, LEG_BASE_Y],
    [x + pose.legDx[i], FOOT_CENTRE_Y - LEG_LIFT * pose.lift[i]],
  ]);

  const eyeA = pt(9, -16);
  const eyeB = pt(20, -17);
  const stalks: readonly (readonly [Pt, Pt])[] = [
    [pt(11, -8), eyeA],
    [pt(18, -9), eyeB],
  ];
  const pupil = (e: Pt): Pt => {
    const [dx, dy] = turn(PUPIL_AT[0], PUPIL_AT[1], t);
    return [e[0] + dx, e[1] + dy];
  };

  return {
    tail,
    shell: [el(0, 0, CRAYFISH_SHELL_RX, CRAYFISH_SHELL_RY), el(HEAD[0], HEAD[1], HEAD[2], HEAD[3])],
    belly: el(2, 7.5, 11, 3.6),
    shine: el(-4, -8.5, 6, 2, -0.1),
    legs,
    stalks,
    eyes: [eyeA, eyeB],
    pupils: [pupil(eyeA), pupil(eyeB)],
    mouth: [pt(26, 0.2), pt(22.5, 6), pt(17.5, 2.2)],
    far: claw(pose.far),
    near: claw(pose.near),
  };
}

/** Axis-aligned box in px. */
interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Box of an ellipse with `reach` px of ink round it; rotation exact. */
function ellipseBox(e: CrayfishEllipse, reach: number): Box {
  const hx = Math.hypot(e.rx * Math.cos(e.rot), e.ry * Math.sin(e.rot)) + reach;
  const hy = Math.hypot(e.rx * Math.sin(e.rot), e.ry * Math.cos(e.rot)) + reach;
  return { minX: e.cx - hx, minY: e.cy - hy, maxX: e.cx + hx, maxY: e.cy + hy };
}

/** Box of points with `reach` px round them. */
function pointsBox(points: readonly Pt[], reach: number): Box {
  return {
    minX: Math.min(...points.map((p) => p[0])) - reach,
    minY: Math.min(...points.map((p) => p[1])) - reach,
    maxX: Math.max(...points.map((p) => p[0])) + reach,
    maxY: Math.max(...points.map((p) => p[1])) + reach,
  };
}

function unionBox(boxes: readonly Box[]): Box {
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}

/** Box of a frame: every outlined ellipse with its ink, and every tube with its ink. */
function frameBox(frame: CrayfishFrame): Box {
  const g = crayfishGeometry(frame);
  const claws = [g.far, g.near];
  const ellipses: CrayfishEllipse[] = [
    ...g.tail,
    ...g.shell,
    ...claws.flatMap((c) => [c.palm, ...c.pincers]),
  ];
  const boxes: Box[] = ellipses.map((e) => ellipseBox(e, LW));
  for (const [a, b] of g.legs) boxes.push(pointsBox([a, b], LEG_W / 2 + LEG_OL));
  for (const [a, b] of g.stalks) boxes.push(pointsBox([a, b], STALK_W / 2 + STALK_OL));
  for (const c of claws) boxes.push(pointsBox(c.arm, ARM_W / 2 + ARM_OL));
  for (const eye of g.eyes) boxes.push(pointsBox([eye], CRAYFISH_EYE_BALL_R + EYE_OL));
  return unionBox(boxes);
}

const FRAME_BOX = unionBox(CRAYFISH_FRAMES.map(frameBox));

/**
 * Texture frame shared by every crayfish frame (provisional): the union of the five frames with
 * their ink, plus 6 px of padding. Anchor is the shell centre, local (0, 0), the crayfish's logic
 * point; the planted feet reach CRAYFISH_FOOT_Y below it. Facing right: the scene mirrors the
 * sprite with faceSprite.
 */
export const CRAYFISH_TEX: TexSize = frameFromBounds(
  FRAME_BOX.minX,
  FRAME_BOX.minY,
  FRAME_BOX.maxX,
  FRAME_BOX.maxY,
  CRAYFISH_PAD,
);

function ellipsePath(e: CrayfishEllipse): Path2D {
  const p = new Path2D();
  ell(p, e.cx, e.cy, e.rx, e.ry, e.rot);
  return p;
}

function linePath(a: Pt, b: Pt): Path2D {
  const p = new Path2D();
  p.moveTo(a[0], a[1]);
  p.lineTo(b[0], b[1]);
  return p;
}

function curvePath(c: readonly [Pt, Pt, Pt]): Path2D {
  const p = new Path2D();
  p.moveTo(c[0][0], c[0][1]);
  p.quadraticCurveTo(c[1][0], c[1][1], c[2][0], c[2][1]);
  return p;
}

/** A claw closes (with a seam) when its gape is under this many radians. */
const CLOSED_GAPE = 0.5;

/** Paint one claw: its arm tube, then the palm and the two pincers as inked rounded ellipses, then the seam of a closed one. */
function paintClaw(ctx: CanvasRenderingContext2D, c: CrayfishClaw): void {
  inkMany(ctx, [seg(linePath(c.arm[0], c.arm[1]), ARM_W, CRAYFISH_SHELL, ARM_OL)]);
  for (const pincer of c.pincers) blob(ctx, ellipsePath(pincer), CRAYFISH_CLAW);
  blob(ctx, ellipsePath(c.palm), CRAYFISH_CLAW);
  if (c.gape < CLOSED_GAPE) {
    ctx.lineWidth = SEAM_W;
    ctx.strokeStyle = INK;
    ctx.stroke(linePath(c.seam[0], c.seam[1]));
  }
}

/**
 * Paint one crayfish frame around the anchor (the shell centre). Layer order, back to front: the
 * tail fan and the three tail segments (each an inked ellipse), the far claw, the four legs and the two eye
 * stalks (each one `inkMany` group), the shell (carapace and head merged in one inked path, so no seam shows
 * between them), the pale belly, the one shine, the closed ink smile, the near claw, and the two round eyes (a white ball with ink, a bead pupil
 * and two glints). No teeth, no fangs, no tongue, no brows, no red anywhere.
 */
export function paintCrayfish(ctx: CanvasRenderingContext2D, frame: CrayfishFrame): void {
  const g = crayfishGeometry(frame);

  g.tail.forEach((e, i) => blob(ctx, ellipsePath(e), i < 3 ? CRAYFISH_DARK : CRAYFISH_SHELL));

  paintClaw(ctx, g.far);

  const legs: Seg[] = g.legs.map(([a, b]) => seg(linePath(a, b), LEG_W, CRAYFISH_DARK, LEG_OL));
  inkMany(ctx, legs);

  // behind the shell, so only the part above the head shows
  inkMany(
    ctx,
    g.stalks.map(([a, b]) => seg(linePath(a, b), STALK_W, CRAYFISH_SHELL, STALK_OL)),
  );

  const shell = new Path2D();
  for (const e of g.shell) ell(shell, e.cx, e.cy, e.rx, e.ry, e.rot);
  blob(ctx, shell, CRAYFISH_SHELL);

  ctx.fillStyle = CRAYFISH_BELLY;
  ctx.fill(ellipsePath(g.belly));
  ctx.fillStyle = CRAYFISH_SHINE;
  ctx.fill(ellipsePath(g.shine));

  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke(curvePath(g.mouth));

  paintClaw(ctx, g.near);

  g.eyes.forEach((eye, i) => {
    const ball = new Path2D();
    ell(ball, eye[0], eye[1], CRAYFISH_EYE_BALL_R, CRAYFISH_EYE_BALL_R);
    blob(ctx, ball, WHITE, EYE_OL);
    const pupil = g.pupils[i];
    const bead = new Path2D();
    ell(bead, pupil[0], pupil[1], PUPIL_R, PUPIL_R);
    ctx.fillStyle = EYE;
    ctx.fill(bead);
    const glints = new Path2D();
    ell(glints, pupil[0] + 0.3 * PUPIL_R, pupil[1] - 0.35 * PUPIL_R, 0.38 * PUPIL_R, 0.38 * PUPIL_R);
    ell(glints, pupil[0] - 0.35 * PUPIL_R, pupil[1] + 0.35 * PUPIL_R, 0.17 * PUPIL_R, 0.17 * PUPIL_R);
    ctx.fillStyle = WHITE;
    ctx.fill(glints);
  });
}
