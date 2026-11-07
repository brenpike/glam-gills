/**
 * Fading light painter: the lake's puzzle light, a light-bulb-like water plant on the lake bottom
 * (issue #212; PRD N3; guide 7u, 3g and 10).
 *
 * Every shape, size and colour here is derived (provisional): the fading light is not in the approved
 * prototype. It is the lake's cousin of the spring cave glow-plant (7b), told apart by shape: one big
 * round bulb under a small cap and over a small collar, on one hooked stalk, against the glow-plant's
 * three upright pods. Gentle: round everywhere, no sharp points, no face, no flame, no text.
 *
 * Frames. One 88 x 88 frame for all three states (FADING_LIGHT_TEX), anchored on the centre of the
 * touch circle, so a swap is a texture change and the light never moves:
 * - `out`: a dim pale-blue outline round a faint body, always visible, never ink alone. Every shape is
 *   first stroked in a keyline of the lake's darkness (band 4's deep stop), so the outline always sits
 *   on it;
 * - `hint`: the same shapes in a brighter, thicker outline on a wider keyline, over a soft ring of
 *   light. The scene pulses or holds it;
 * - `lit`: full glow. A halo, then the stalk and leaves as inked tubes, the cap and collar, then the
 *   inked bulb with a white core. The scene crossfades it over `out` to dim, and keeps its halo.
 *
 * Greyscale cues (10): out, a hollow pale-blue outline (0.3488); hint, the same shapes in a thicker,
 * much lighter outline (0.8163) with a ring; lit, a filled, inked bulb (0.7295) in a halo. They read
 * by fill and weight, never by hue.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser: the fade, the pulse and
 * the choice of frame belong to the scene.
 */
import { FADING_LIGHT_RADIUS } from '../logic/hazards';
import { ell, frameFromBounds, inkMany, seg, blob, type Seg, type TexSize } from './canvasKit';
import { WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours and widths (guide 3g, 7u)
// ---------------------------------------------------------------------------

/** Lit halo at the centre, fading to nothing at FADING_LIGHT_HALO_RADIUS. */
export const FADING_LIGHT_HALO = 'rgba(255,236,150,0.55)';
/** The halo's colour at its edge: the same colour with no alpha, so it fades without a grey band. */
const HALO_CLEAR = 'rgba(255,236,150,0)';
/** Lit stalk and leaves: a green, luminance 0.2521. */
export const FADING_LIGHT_STALK = '#3f9a6a';
/** Lit cap and collar: a dull gold, luminance 0.4570. */
export const FADING_LIGHT_CAP = '#c9b36a';
/** Lit bulb: a warm yellow, luminance 0.7295, below the Leucistic belly (0.8231). */
export const FADING_LIGHT_BULB = '#f2de8a';

/** Out outline: a pale blue, luminance 0.3488, 7.68:1 against its keyline. */
export const FADING_LIGHT_OUT = '#6aa8c0';
/** Out body: a faint wash of the outline colour. */
export const FADING_LIGHT_OUT_FILL = 'rgba(106,168,192,0.16)';
/** The keyline under the out and hint outlines: band 4's deep stop, the lake's darkness (3c). */
export const FADING_LIGHT_KEYLINE = '#04060f';
/** How far the keyline reaches past its outline on each side, px: the keyline is the outline's width plus twice this. */
export const FADING_LIGHT_KEYLINE_PAD = 1.2;
/** Hint outline: a bright ice blue, luminance 0.8163, 16.69:1 against the keyline. */
export const FADING_LIGHT_HINT = '#cfeeff';
/** The soft ring of light round the hint, at its centre. It fades to nothing at FADING_LIGHT_RING_RADIUS. */
export const FADING_LIGHT_HINT_RING = 'rgba(207,238,255,0.30)';
/** The hint ring's colour at its edge: the same colour with no alpha. */
const RING_CLEAR = 'rgba(207,238,255,0)';

/** Outline widths: the out outline, the hint's thicker one, and the ink of the lit cap, collar and bulb, px. */
export const FADING_LIGHT_OUT_LW = 2.6;
export const FADING_LIGHT_HINT_LW = 3.6;
export const FADING_LIGHT_LIT_LW = 2.6;
/** Ink a side of the lit stalk and leaf tubes, px. */
export const FADING_LIGHT_TUBE_OL = 2;

// ---------------------------------------------------------------------------
// Frame, keys and geometry (guide 7u)
// ---------------------------------------------------------------------------

/** The three states of a fading light the painter draws: out, hint-bright and lit. */
export type FadingLightFrame = 'out' | 'hint' | 'lit';

/** Every frame of the fading light, in the order the bake step lists them. */
export const FADING_LIGHT_FRAMES: readonly FadingLightFrame[] = ['out', 'hint', 'lit'];

/** Keys the later bake step uses (guide 7u). */
export const FADING_LIGHT_KEYS = {
  out: 'fading-light-out',
  hint: 'fading-light-hint',
  lit: 'fading-light-lit',
} as const;

/** Half the frame, px: the halo reaches 40, so the frame is 88 across. */
export const FADING_LIGHT_HALF = 44;
/**
 * Texture frame shared by every state (88 x 88). Anchor is the centre of the touch circle, local
 * (0, 0), which is also the centre of the bulb.
 */
export const FADING_LIGHT_TEX: TexSize = frameFromBounds(-FADING_LIGHT_HALF, -FADING_LIGHT_HALF, FADING_LIGHT_HALF, FADING_LIGHT_HALF, 0);
/** Radius of the lit halo, px. */
export const FADING_LIGHT_HALO_RADIUS = 40;
/** Radius of the hint ring, px. */
export const FADING_LIGHT_RING_RADIUS = 34;
/** The bulb's radius: the touch circle's, so what is drawn is what is touched. */
export const FADING_LIGHT_BULB_R = FADING_LIGHT_RADIUS;
/** The cap on the bulb: radii and centre. */
export const FADING_LIGHT_CAP_GEOM = { cx: 0, cy: -15, rx: 6, ry: 3.5 } as const;
/** The collar under the bulb: radii and centre. */
export const FADING_LIGHT_COLLAR_GEOM = { cx: 0, cy: 14, rx: 9, ry: 3.5 } as const;
/** Where the hooked stalk starts: its base, and the point under the collar it ends at. */
export const FADING_LIGHT_STALK_BASE = [0, 32] as const;
export const FADING_LIGHT_STALK_TOP = [0, 17] as const;
/** The stalk's width in the lit frame, px. The outline states stroke it at their own outline width. */
export const FADING_LIGHT_STALK_W = 3;
/** The two leaves at the base: radii 7 x 4, tilted a little away from the stalk. */
export const FADING_LIGHT_LEAVES: readonly { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number; readonly rot: number }[] = [
  { cx: -10, cy: 32.5, rx: 7, ry: 4, rot: -0.3 },
  { cx: 10, cy: 32.5, rx: 7, ry: 4, rot: 0.3 },
];
/** Radius of the lit bulb's white core, px, and its centre. */
export const FADING_LIGHT_CORE_R = 5;
export const FADING_LIGHT_CORE_AT = [-2, -2] as const;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function bulbPath(): Path2D {
  const p = new Path2D();
  ell(p, 0, 0, FADING_LIGHT_BULB_R, FADING_LIGHT_BULB_R);
  return p;
}

function partPath(g: { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number }): Path2D {
  const p = new Path2D();
  ell(p, g.cx, g.cy, g.rx, g.ry);
  return p;
}

/** The hooked stalk: up from the base and bowing out to the right, curling back in to the collar. One round curve. */
function stalkPath(): Path2D {
  const p = new Path2D();
  p.moveTo(FADING_LIGHT_STALK_BASE[0], FADING_LIGHT_STALK_BASE[1]);
  p.bezierCurveTo(5, 25, 18, 22, FADING_LIGHT_STALK_TOP[0], FADING_LIGHT_STALK_TOP[1]);
  return p;
}

function leafPaths(): readonly Path2D[] {
  return FADING_LIGHT_LEAVES.map((l) => {
    const p = new Path2D();
    ell(p, l.cx, l.cy, l.rx, l.ry, l.rot);
    return p;
  });
}

/**
 * A leaf as a tube for the lit group: a short centre line with round ends, as wide as the leaf is
 * tall (2 * ry), so its outline is a rounded oval of the leaf's size (radii rx x ry).
 */
function leafTube(l: (typeof FADING_LIGHT_LEAVES)[number]): Seg {
  const half = l.rx - l.ry;
  const dx = half * Math.cos(l.rot);
  const dy = half * Math.sin(l.rot);
  const p = new Path2D();
  p.moveTo(l.cx - dx, l.cy - dy);
  p.lineTo(l.cx + dx, l.cy + dy);
  return seg(p, 2 * l.ry, FADING_LIGHT_STALK, FADING_LIGHT_TUBE_OL);
}

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

/** A soft round light at the centre: `colour` in the middle, fading to `clear` at `radius`. One round path, so its extent is its radius. */
function paintSoftLight(ctx: CanvasRenderingContext2D, colour: string, clear: string, radius: number): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, colour);
  g.addColorStop(1, clear);
  const disc = new Path2D();
  ell(disc, 0, 0, radius, radius);
  ctx.fillStyle = g;
  ctx.fill(disc);
}

/**
 * The outline states (out and hint): a line of one colour round a body, no ink. Every stalk, leaf, cap,
 * collar and bulb path is stroked first in FADING_LIGHT_KEYLINE, FADING_LIGHT_KEYLINE_PAD px wider on
 * each side, so the outline always sits on the dark keyline. `fill` is null for no body.
 */
function paintOutline(ctx: CanvasRenderingContext2D, stroke: string, fill: string | null, lw: number): void {
  const bodies = [...leafPaths(), partPath(FADING_LIGHT_CAP_GEOM), partPath(FADING_LIGHT_COLLAR_GEOM), bulbPath()];
  const stalk = stalkPath();

  ctx.lineWidth = lw + 2 * FADING_LIGHT_KEYLINE_PAD;
  ctx.strokeStyle = FADING_LIGHT_KEYLINE;
  ctx.stroke(stalk);
  for (const body of bodies) ctx.stroke(body);

  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke(stalk);
  for (const body of bodies) {
    if (fill !== null) {
      ctx.fillStyle = fill;
      ctx.fill(body);
    }
    ctx.stroke(body);
  }
}

/**
 * Paint one fading light state with its centre at local (0, 0), the centre of the touch circle.
 * - 'out': a pale-blue outline (FADING_LIGHT_OUT), 2.6 wide, on its keyline round a faint body; no ink
 *   and no gradient.
 * - 'hint': the same shapes in a brighter, thicker outline (3.6) on a wider keyline (6.0), over a soft
 *   ring of light out to radius 34. No body fill.
 * - 'lit': the halo (radius 40), then the stalk and leaves as one inked tube group, the cap and collar
 *   with ink 2.6, and the bulb with ink 2.6 and a white core.
 * The three share one silhouette and one frame, so a swap is a texture change and the light never moves.
 */
export function paintFadingLight(ctx: CanvasRenderingContext2D, frame: FadingLightFrame): void {
  if (frame === 'out') {
    paintOutline(ctx, FADING_LIGHT_OUT, FADING_LIGHT_OUT_FILL, FADING_LIGHT_OUT_LW);
    return;
  }
  if (frame === 'hint') {
    paintSoftLight(ctx, FADING_LIGHT_HINT_RING, RING_CLEAR, FADING_LIGHT_RING_RADIUS);
    paintOutline(ctx, FADING_LIGHT_HINT, null, FADING_LIGHT_HINT_LW);
    return;
  }
  paintSoftLight(ctx, FADING_LIGHT_HALO, HALO_CLEAR, FADING_LIGHT_HALO_RADIUS);
  inkMany(ctx, [seg(stalkPath(), FADING_LIGHT_STALK_W, FADING_LIGHT_STALK, FADING_LIGHT_TUBE_OL), ...FADING_LIGHT_LEAVES.map(leafTube)]);
  blob(ctx, partPath(FADING_LIGHT_CAP_GEOM), FADING_LIGHT_CAP, FADING_LIGHT_LIT_LW);
  blob(ctx, partPath(FADING_LIGHT_COLLAR_GEOM), FADING_LIGHT_CAP, FADING_LIGHT_LIT_LW);
  blob(ctx, bulbPath(), FADING_LIGHT_BULB, FADING_LIGHT_LIT_LW);
  const core = new Path2D();
  ell(core, FADING_LIGHT_CORE_AT[0], FADING_LIGHT_CORE_AT[1], FADING_LIGHT_CORE_R, FADING_LIGHT_CORE_R);
  ctx.fillStyle = WHITE;
  ctx.fill(core);
}
