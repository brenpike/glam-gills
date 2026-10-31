/**
 * Black bass painters: the deep canal's signature predator (issue #78; PRD N2, N3).
 *
 * Every shape, size and colour here is derived (provisional): the bass is not in the approved
 * prototype. It follows guide sections 2, 4, 5 and 10, and the character rules of the tilapia, the
 * heron, the garter snake, the carp and the crayfish (7c, 7h, 7k, 7l, 7m): round and friendly, no
 * sharp points, the mouth always closed. The bass is never shown biting, holding or eating the
 * axolotl (A11, ADR 0007, ADR 0008): the strike is a streamlined rush with the mouth shut, and a
 * hit shows only the shared leg-loss poof.
 *
 * Shape: a big, plump, largemouth-style bass in a light sage green: a round body and a round head
 * merged into one inked silhouette, a long closed smile that runs back under the eye, one big bead
 * eye, a rounded two-lobed dorsal fin, a pelvic fin under the belly, a pectoral fin on the flank, a
 * stalk and a rounded fan tail, a pale belly and one dark lateral stripe. No teeth, no fangs, no
 * tongue, no open mouth, no brows, no red, no sharp points.
 *
 * Greyscale cues (10): the warning is a change of shape, not hue. With the fins folded the bass is
 * a smooth low oval; with them flared the dorsal fin stands up in two big lobes, the pelvic and
 * pectoral fins spread below and the tail fan opens, so the silhouette is taller and broken into
 * lobes. The pale flash lightens the body and fins on top of that.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser: swimming, the switch
 * between frames, the flash's timing and the slow turn belong to the scene. Every frame faces
 * right, with its anchor on the body centre (the bass's logic point); the scene mirrors the sprite
 * with faceSprite.
 */
import { blob, ell, frameFromBounds, shape, type TexSize } from './canvasKit';
import { EYE, INK, LW, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3g, 10)
// ---------------------------------------------------------------------------

/**
 * Bass body: a light sage green #b9d97a, luminance 0.6135, 9.09:1 with ink. It reaches the outer
 * edge, so it passes on any background by the pair method (10): the worst case on any canal water
 * is 3.01:1. Greener and yellower than the tilapia's grey-green (#c2d2bb, 0.6115): the two read
 * apart by size, the dark lateral stripe and the long smile, not by value.
 */
export const BASS_BODY = '#b9d97a';
/** Bass fins and tail: a paler sage #cfe69a, luminance 0.7219, 10.58:1 with ink. Lighter than the body, so the fins read as a pale rim; on the outer edge. */
export const BASS_FIN = '#cfe69a';
/** Bass belly: a pale cream-green #e0efb4, luminance 0.8088, 11.77:1 with ink. Inside the silhouette, never an edge. Not lighter than the hero's belly #ffe3ed (0.823). */
export const BASS_BELLY = '#e0efb4';
/**
 * Bass lateral stripe: a dark olive #4f7a3c, luminance 0.1591, 3.17:1 against the body. Inside the
 * silhouette (at least 3 px from every edge), so it is never an edge partner; it is the black
 * bass's greyscale identity.
 */
export const BASS_STRIPE = '#4f7a3c';
/** The pale flash on the warning body: #d6eba6, luminance 0.7647, 11.17:1 with ink and 1.23:1 lighter than the body. */
export const BASS_FLASH_BODY = '#d6eba6';
/** The pale flash on the warning fins and tail: #dcefb0, luminance 0.8008, 11.66:1 with ink and 1.10:1 lighter than the fins. */
export const BASS_FLASH_FIN = '#dcefb0';
/** The one body shine (guide 5). Inside the silhouette, so alpha is allowed. */
export const BASS_SHINE = 'rgba(255,255,255,0.55)';

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/**
 * Still frames, all facing right with the body centre at the anchor and the tail trailing to -x:
 * - `swim0`, `swim1`, `swim2`: the fins folded, the tail one step up, straight and one step down;
 *   the scene cycles them (`swim0`, `swim1`, `swim2`, `swim1`) while the bass patrols;
 * - `warn`: the warning cue, stopped with the fins flared, the head up and the pale flash;
 * - `strike`: the strike, the fins tucked flat, the nose down a little and the tail swept wide;
 *   the mouth stays closed;
 * - `still`: the pose for reduced motion, the fins flared and everything level, with no flash and
 *   no tail swing, so nothing in it suggests movement.
 */
export type BlackBassFrame = 'swim0' | 'swim1' | 'swim2' | 'warn' | 'strike' | 'still';

/** The three swim frames, in the order the scene steps through them (then back through `swim1`). */
export const BLACK_BASS_SWIM_FRAMES: readonly BlackBassFrame[] = ['swim0', 'swim1', 'swim2'];
/** Every frame of the black bass. */
export const BLACK_BASS_FRAMES: readonly BlackBassFrame[] = [...BLACK_BASS_SWIM_FRAMES, 'warn', 'strike', 'still'];

/** Padding round every frame (the guide asks for 4 px at 1x). */
const BASS_PAD = 6;

type Pt = readonly [number, number];

/** One ellipse of a frame, in the frame's own (tilted) coordinates. */
export interface BassEllipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly rot: number;
}

// ---- geometry, facing right, before any tilt ----

/** Body half-length: the bass's body radius in the rules (BLACK_BASS.bodyRadius, 28). */
export const BASS_BODY_RX = 28;
export const BASS_BODY_RY = 17;
/** The round head merged into the body's front. */
export const BASS_HEAD_CX = 19;
export const BASS_HEAD_CY = -1.5;
export const BASS_HEAD_RX = 15;
export const BASS_HEAD_RY = 12.5;
/** Bead eye radius, big for a friendly face. */
export const BASS_EYE_R = 4.4;
const EYE_AT: Pt = [23, -5.5];
/** Where the tail stalk joins the body. */
const TAIL_PIVOT: Pt = [-25, 0];

interface BassPose {
  /** Tilt of the whole fish about the anchor, radians; positive tips the nose down (y is down). */
  readonly tilt: number;
  /** Angle of the tail from straight behind, radians; positive swings the tail toward +y. */
  readonly tail: number;
  /** Half spread of the tail fan across its own axis, px. */
  readonly fan: number;
  /** How far the fins are flared, 0 folded and 1 fully flared. */
  readonly flare: number;
  /** The pale flash on the body and fins. */
  readonly flash: boolean;
}

const POSES: Readonly<Record<BlackBassFrame, BassPose>> = {
  swim0: { tilt: 0, tail: -0.24, fan: 11, flare: 0, flash: false },
  swim1: { tilt: 0, tail: 0, fan: 11, flare: 0, flash: false },
  swim2: { tilt: 0, tail: 0.24, fan: 11, flare: 0, flash: false },
  // the warning: stopped, head up about 6 degrees, the fins flared and the pale flash
  warn: { tilt: -0.1, tail: 0.05, fan: 15, flare: 1, flash: true },
  // the strike: the fins tucked flat, the nose down a little, the tail swept wide
  strike: { tilt: 0.05, tail: -0.55, fan: 14, flare: 0, flash: false },
  // reduced motion: the fins flared, level, no flash
  still: { tilt: 0, tail: 0, fan: 13, flare: 1, flash: false },
};

function turn(x: number, y: number, tilt: number): Pt {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return [x * c - y * s, x * s + y * c];
}

const mix = (folded: number, flared: number, flare: number): number => folded + (flared - folded) * flare;

interface BassGeometry {
  readonly tailFin: BassEllipse;
  readonly stalk: BassEllipse;
  /** The dorsal fin, two lobes in one inked path: front, then soft rear. */
  readonly dorsal: readonly [BassEllipse, BassEllipse];
  readonly pelvic: BassEllipse;
  /** The round body and the round head, merged in one inked path. */
  readonly body: BassEllipse;
  readonly head: BassEllipse;
  readonly belly: BassEllipse;
  readonly stripe: BassEllipse;
  readonly pectoral: BassEllipse;
  readonly shine: BassEllipse;
  readonly eye: Pt;
  /** The gill cover line, [start, control, end]. */
  readonly gill: readonly [Pt, Pt, Pt];
  /** The closed smile, [start, control, end]. */
  readonly mouth: readonly [Pt, Pt, Pt];
}

/** The geometry of a frame: every ellipse and curve, already tilted. */
export function blackBassGeometry(frame: BlackBassFrame): BassGeometry {
  const pose = POSES[frame];
  const t = pose.tilt;
  const f = pose.flare;
  const el = (cx: number, cy: number, rx: number, ry: number, rot = 0): BassEllipse => {
    const [x, y] = turn(cx, cy, t);
    return { cx: x, cy: y, rx, ry, rot: rot + t };
  };
  const pt = (x: number, y: number): Pt => turn(x, y, t);
  const curve = (a: Pt, b: Pt, c: Pt): readonly [Pt, Pt, Pt] => [pt(a[0], a[1]), pt(b[0], b[1]), pt(c[0], c[1])];

  // the tail runs from the pivot in direction (-cos, sin) of the tail angle
  const dx = -Math.cos(pose.tail);
  const dy = Math.sin(pose.tail);
  const dir = Math.atan2(dy, dx);
  const along = (n: number): Pt => [TAIL_PIVOT[0] + dx * n, TAIL_PIVOT[1] + dy * n];
  const stalkAt = along(7);
  const finAt = along(19);

  return {
    tailFin: el(finAt[0], finAt[1], 7, pose.fan, dir),
    stalk: el(stalkAt[0], stalkAt[1], 8, 6, dir),
    dorsal: [
      el(mix(4, 3, f), mix(-16.5, -23, f), mix(12, 11, f), mix(4.5, 10, f), mix(-0.05, -0.1, f)),
      el(mix(-15, -16, f), mix(-14.5, -19.5, f), mix(9, 8.5, f), mix(4, 8, f), mix(0.1, 0.15, f)),
    ],
    pelvic: el(mix(6, 9, f), mix(12.5, 22, f), mix(7, 6.5, f), mix(3.5, 9, f), mix(0.2, -0.5, f)),
    body: el(0, 0, BASS_BODY_RX, BASS_BODY_RY),
    head: el(BASS_HEAD_CX, BASS_HEAD_CY, BASS_HEAD_RX, BASS_HEAD_RY),
    belly: el(0, 7.5, 19, 5.5),
    stripe: el(-4, -1.5, 20, 2.6),
    pectoral: el(mix(9, 5, f), mix(5, 11, f), mix(8, 11, f), mix(4.5, 6.5, f), mix(0.55, 1.0, f)),
    shine: el(8, -11, 7, 2, -0.1),
    eye: pt(EYE_AT[0], EYE_AT[1]),
    gill: curve([9, -8], [6, 0], [9, 8]),
    mouth: curve([32, 1], [26, 9.5], [16.5, 5.5]),
  };
}

/** The nose tip of a frame, relative to the anchor: the front of the head ellipse, tilted. */
export function blackBassNoseTip(frame: BlackBassFrame): { readonly x: number; readonly y: number } {
  const [x, y] = turn(BASS_HEAD_CX + BASS_HEAD_RX, BASS_HEAD_CY, POSES[frame].tilt);
  return { x, y };
}

/** Whether a frame has the pale flash on its body and fins. */
export function blackBassHasFlash(frame: BlackBassFrame): boolean {
  return POSES[frame].flash;
}

/** The body and fin colours of a frame: the flash lightens both. */
export function blackBassColours(frame: BlackBassFrame): { readonly body: string; readonly fin: string } {
  return POSES[frame].flash ? { body: BASS_FLASH_BODY, fin: BASS_FLASH_FIN } : { body: BASS_BODY, fin: BASS_FIN };
}

/** The ellipses that reach the outer edge of a frame (with ink round them), back to front. */
export function blackBassOuterEllipses(frame: BlackBassFrame): readonly BassEllipse[] {
  const g = blackBassGeometry(frame);
  return [g.tailFin, g.stalk, g.dorsal[0], g.dorsal[1], g.pelvic, g.body, g.head];
}

/** Axis-aligned box in px. */
interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Box of an ellipse with `reach` px of ink round it; rotation exact. */
function ellipseBox(e: BassEllipse, reach: number): Box {
  const hx = Math.hypot(e.rx * Math.cos(e.rot), e.ry * Math.sin(e.rot)) + reach;
  const hy = Math.hypot(e.rx * Math.sin(e.rot), e.ry * Math.cos(e.rot)) + reach;
  return { minX: e.cx - hx, minY: e.cy - hy, maxX: e.cx + hx, maxY: e.cy + hy };
}

function unionBox(boxes: readonly Box[]): Box {
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}

/** Box of a frame: the outlined ellipses with their ink, and the pectoral fin with its centred ink. */
function frameBox(frame: BlackBassFrame): Box {
  const g = blackBassGeometry(frame);
  return unionBox([...blackBassOuterEllipses(frame).map((e) => ellipseBox(e, LW)), ellipseBox(g.pectoral, LW)]);
}

const FRAME_BOX = unionBox(BLACK_BASS_FRAMES.map(frameBox));

/**
 * Texture frame shared by every black bass frame (provisional): the union of the six frames with
 * their ink, plus 6 px of padding. Anchor is the body centre, local (0, 0), the bass's logic point.
 * Facing right: the scene mirrors the sprite with faceSprite.
 */
export const BLACK_BASS_TEX: TexSize = frameFromBounds(FRAME_BOX.minX, FRAME_BOX.minY, FRAME_BOX.maxX, FRAME_BOX.maxY, BASS_PAD);

function ellipsePath(...es: readonly BassEllipse[]): Path2D {
  const p = new Path2D();
  for (const e of es) ell(p, e.cx, e.cy, e.rx, e.ry, e.rot);
  return p;
}

function curvePath(c: readonly [Pt, Pt, Pt]): Path2D {
  const p = new Path2D();
  p.moveTo(c[0][0], c[0][1]);
  p.quadraticCurveTo(c[1][0], c[1][1], c[2][0], c[2][1]);
  return p;
}

/**
 * Paint one black bass frame around the anchor (the body centre). Layer order, back to front: the
 * tail fan, the stalk, the dorsal fin (both lobes in one path), the pelvic fin (each an inked
 * `blob`, so the ink sits outside and the body's outline hides the joins), the body and head
 * (merged in one inked path, so no seam shows), the pale belly, the dark lateral stripe, the
 * pectoral fin (a centred ink line, on the flank), the one shine, the gill line, the closed ink
 * smile and the bead eye with two glints. No teeth, no fangs, no tongue, no brows, no red anywhere.
 */
export function paintBlackBass(ctx: CanvasRenderingContext2D, frame: BlackBassFrame): void {
  const g = blackBassGeometry(frame);
  const { body, fin } = blackBassColours(frame);
  blob(ctx, ellipsePath(g.tailFin), fin);
  blob(ctx, ellipsePath(g.stalk), body);
  blob(ctx, ellipsePath(...g.dorsal), fin);
  blob(ctx, ellipsePath(g.pelvic), fin);
  blob(ctx, ellipsePath(g.body, g.head), body);

  ctx.fillStyle = BASS_BELLY;
  ctx.fill(ellipsePath(g.belly));
  ctx.fillStyle = BASS_STRIPE;
  ctx.fill(ellipsePath(g.stripe));

  shape(ctx, ellipsePath(g.pectoral), fin, 2);

  ctx.fillStyle = BASS_SHINE;
  ctx.fill(ellipsePath(g.shine));

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke(curvePath(g.gill));

  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke(curvePath(g.mouth));

  const bead = new Path2D();
  ell(bead, g.eye[0], g.eye[1], BASS_EYE_R, BASS_EYE_R);
  ctx.fillStyle = EYE;
  ctx.fill(bead);
  const glints = new Path2D();
  ell(glints, g.eye[0] + 0.3 * BASS_EYE_R, g.eye[1] - 0.35 * BASS_EYE_R, 0.38 * BASS_EYE_R, 0.38 * BASS_EYE_R);
  ell(glints, g.eye[0] - 0.35 * BASS_EYE_R, g.eye[1] + 0.35 * BASS_EYE_R, 0.17 * BASS_EYE_R, 0.17 * BASS_EYE_R);
  ctx.fillStyle = WHITE;
  ctx.fill(glints);
}
