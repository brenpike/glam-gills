/**
 * UI painters: buttons and icons (guide section 8). Text is not drawn here;
 * the scene lays a label over the button (icons are always paired with a label).
 * Presentational only.
 */
import { INK, LW, BODY_SHINE, WHITE, UI_ACCENT, UI_PANEL } from './palette';
import { TAU, frameFromBounds, type TexSize } from './canvasKit';

/** Wide button, logical px. At least 64 tall (primary actions). */
export const BUTTON_WIDE = { w: 200, h: 64 } as const;
/** Square icon button, logical px. At least 64 tall. */
export const BUTTON_SQUARE = { w: 64, h: 64 } as const;
/** Pressed button moves down by this much (guide section 8). */
export const BUTTON_PRESS_OFFSET = 3;
/** Room around the button for the outline and the double focus ring. */
export const BUTTON_MARGIN = 8;
/** Icon box size, logical px. */
export const ICON_SIZE = 32;

/**
 * Name box look (kids' typeable field). Values only; the scene and the text
 * entry overlay (src/platform/textEntry.ts) read or copy them.
 * Fill #f6f3fd: ink on fill 13.13:1. Placeholder #6e6790 on fill 4.78:1.
 * The inset is a band inside the outline on the top and left edges only.
 * Provisional.
 */
export const NAME_FIELD = Object.freeze({
  fill: '#f6f3fd',
  inset: '#c9c2e0',
  insetW: 3,
  outline: INK,
  outlineW: LW,
  radius: 8,
  placeholder: '#6e6790',
  cursor: INK,
  cursorW: 2.5,
  cursorH: 24,
});

/**
 * Swim pad (on-screen directional stick), nominal logical radii. These are the
 * largest displayed sizes; the HUD only scales down from them.
 */
export const STICK_BASE_R = 64;
export const STICK_KNOB_R = 26;
/** Base fill alpha: low enough that the world shows through the pad. */
const STICK_BASE_ALPHA = 0.45;
/** Guide ring (where the knob rests) and chevron distance, as a fraction of the base radius. */
const STICK_GUIDE_FRAC = 0.5;
const STICK_CHEVRON_FRAC = 0.78;
/** Chevron half-width, logical px. */
const STICK_CHEVRON_S = 8;

export type IconKind =
  | 'dash'
  | 'pause'
  | 'play'
  | 'snack'
  | 'home'
  | 'bag'
  | 'chest'
  | 'decorate'
  | 'close'
  | 'left'
  | 'right'
  | 'check'
  | 'putAway'
  | 'book'
  | 'surprise'
  | 'boy'
  | 'girl'
  | 'pencil'
  | 'shirt'
  | 'lock'
  | 'paintDrop'
  | 'refuge'
  | 'musicOn'
  | 'musicOff';

/**
 * House icon (guide 7d), shared by the Home Spot flag and every "go home" UI.
 * Sizes are to the outer edge of the ink, as for the 32 icon box: a rounded
 * roof 14 wide and 6 tall over a square body 10 x 8, ink 2.4.
 */
export const HOUSE_ICON = { w: 14, h: 14, roofH: 6, bodyW: 10, lw: 2.4 } as const;
/** House icon scale inside the 32 icon box: 21 x 21 outer, ink 3.6. Provisional. */
export const HOUSE_ICON_BOX_SCALE = 1.5;
/** Rounding of the roof peak, at scale 1. Provisional. */
const HOUSE_ROOF_ROUND = 2;

/**
 * Stroke the house icon centred on (cx, cy), `scale` times its guide size.
 * Ink only, round joins and caps; the line width scales with the icon.
 */
export function strokeHouseIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1): void {
  const { w, h, roofH, bodyW, lw } = HOUSE_ICON;
  const half = lw / 2;
  // centreline coordinates, so the outer ink edge lands on the guide sizes
  const top = -h / 2 + half;
  const eave = -h / 2 + roofH;
  const bottom = h / 2 - half;
  const roofX = w / 2 - half;
  const bodyX = bodyW / 2 - half;

  const p = new Path2D();
  p.moveTo(-roofX, eave);
  p.arcTo(0, top, roofX, eave, HOUSE_ROOF_ROUND);
  p.lineTo(roofX, eave);
  p.closePath();
  p.moveTo(-bodyX, eave);
  p.lineTo(-bodyX, bottom);
  p.lineTo(bodyX, bottom);
  p.lineTo(bodyX, eave);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke(p);
  ctx.restore();
}

/** Surprise icon star geometry (guide 4e): inner radius and tip rounding as fractions of R. */
const SURPRISE_STAR_INNER = 0.38;
const SURPRISE_STAR_ROUND = 0.15;

/**
 * Concave 4-point star centred on (cx, cy), outer radius r (guide 4e): sharp
 * inner corners, tips rounded by a quadratic cut. Outline only.
 */
function surpriseStarPath(cx: number, cy: number, r: number): Path2D {
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k < 8; k++) {
    const ang = -Math.PI / 2 + (k * Math.PI) / 4;
    const rad = k % 2 === 0 ? r : r * SURPRISE_STAR_INNER;
    pts.push({ x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang) });
  }
  const cut = r * SURPRISE_STAR_ROUND;
  // point `cut` px from `from` towards `to`
  const towards = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    return { x: from.x + ((to.x - from.x) * cut) / len, y: from.y + ((to.y - from.y) * cut) / len };
  };
  const p = new Path2D();
  for (let k = 0; k < 8; k++) {
    const pt = pts[k];
    if (k % 2 === 1) {
      p.lineTo(pt.x, pt.y);
      continue;
    }
    const a = towards(pt, pts[(k + 7) % 8]);
    const b = towards(pt, pts[(k + 1) % 8]);
    if (k === 0) p.moveTo(a.x, a.y);
    else p.lineTo(a.x, a.y);
    p.quadraticCurveTo(pt.x, pt.y, b.x, b.y);
  }
  p.closePath();
  return p;
}

export interface ButtonState {
  /** Draw moved down by BUTTON_PRESS_OFFSET. */
  pressed?: boolean;
  /** Draw the double focus ring: inner white, outer ink. */
  focused?: boolean;
}

/**
 * Texture frame for a w x h button. Identical for every state so state swaps
 * never move the sprite. Origin is the top-left corner of the unpressed button.
 */
export function buttonTextureSize(w: number, h: number): TexSize {
  return {
    w: w + 2 * BUTTON_MARGIN,
    h: h + 2 * BUTTON_MARGIN + BUTTON_PRESS_OFFSET,
    originX: BUTTON_MARGIN,
    originY: BUTTON_MARGIN,
  };
}

/** Corner radius: at least 16, never more than a full pill. */
export function buttonRadius(h: number): number {
  return Math.min(h / 2, Math.max(16, h * 0.3));
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
}

/**
 * Paint a button with its top-left corner at local (0, 0) (or (0, 3) when
 * pressed). Use buttonTextureSize(w, h) for the frame.
 */
export function paintButton(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fill: string,
  state: ButtonState = {},
): void {
  const y = state.pressed ? BUTTON_PRESS_OFFSET : 0;
  const r = buttonRadius(h);

  if (state.focused) {
    // double ring just outside the outline: inner white, outer ink
    const e1 = LW / 2 + 1.5;
    const e2 = LW / 2 + 3 + 1.5;
    ctx.lineWidth = 3;
    ctx.strokeStyle = WHITE;
    ctx.stroke(roundedRect(-e1, y - e1, w + 2 * e1, h + 2 * e1, r + e1));
    ctx.strokeStyle = INK;
    ctx.stroke(roundedRect(-e2, y - e2, w + 2 * e2, h + 2 * e2, r + e2));
  }

  const body = roundedRect(0, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill(body);
  ctx.lineWidth = LW;
  ctx.strokeStyle = INK;
  ctx.stroke(body);

  // small top shine
  const x0 = r + 2;
  const x1 = Math.min(w - r - 2, Math.max(x0 + 10, w * 0.5));
  ctx.lineWidth = 4;
  ctx.strokeStyle = BODY_SHINE;
  ctx.beginPath();
  ctx.moveTo(x0, y + 8);
  ctx.lineTo(x1, y + 8);
  ctx.stroke();
}

/**
 * Paint an icon in the box (0, 0) to (size, size), solid ink with round joins.
 * Ink on the button fills is 9:1 or better. Always pair with a text label.
 */
export function paintIcon(ctx: CanvasRenderingContext2D, kind: IconKind, size: number): void {
  ctx.save();
  ctx.scale(size / ICON_SIZE, size / ICON_SIZE);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (kind) {
    case 'dash': {
      // two chevrons pointing right
      ctx.lineWidth = 4.5;
      const p = new Path2D();
      p.moveTo(7, 9);
      p.lineTo(14, 16);
      p.lineTo(7, 23);
      p.moveTo(17, 9);
      p.lineTo(24, 16);
      p.lineTo(17, 23);
      ctx.stroke(p);
      break;
    }
    case 'pause': {
      ctx.lineWidth = 3;
      const bars = new Path2D();
      bars.rect(8.5, 8, 4, 16);
      bars.rect(19.5, 8, 4, 16);
      ctx.fill(bars);
      ctx.stroke(bars);
      break;
    }
    case 'play': {
      ctx.lineWidth = 3;
      const tri = new Path2D();
      tri.moveTo(11, 7.5);
      tri.lineTo(24, 16);
      tri.lineTo(11, 24.5);
      tri.closePath();
      ctx.fill(tri);
      ctx.stroke(tri);
      break;
    }
    case 'snack': {
      // a small wavy worm
      ctx.lineWidth = 5;
      const w = new Path2D();
      w.moveTo(6, 21);
      w.bezierCurveTo(8, 11, 14, 11, 16, 17);
      w.bezierCurveTo(18, 23, 23, 23, 26, 13);
      ctx.stroke(w);
      break;
    }
    case 'home': {
      // the shared 7d house icon, sized for the 32 box
      strokeHouseIcon(ctx, ICON_SIZE / 2, ICON_SIZE / 2, HOUSE_ICON_BOX_SCALE);
      break;
    }
    case 'bag': {
      // Trip Bag: a drawstring pouch, ink only
      ctx.lineWidth = 3;
      const pouch = new Path2D();
      pouch.moveTo(12.5, 12);
      pouch.bezierCurveTo(5, 16, 4.5, 27.5, 16, 27.5);
      pouch.bezierCurveTo(27.5, 27.5, 27, 16, 19.5, 12);
      pouch.closePath();
      // gathered top above the drawstring
      pouch.moveTo(12.5, 12);
      pouch.lineTo(9.5, 6);
      pouch.quadraticCurveTo(16, 8, 22.5, 6);
      pouch.lineTo(19.5, 12);
      // loose drawstring end
      pouch.moveTo(19.5, 12);
      pouch.quadraticCurveTo(24, 13, 24.5, 17);
      ctx.stroke(pouch);
      break;
    }
    case 'chest': {
      // Treasure Chest: a rounded chest, domed lid over a body, a lock dot. Ink only.
      ctx.lineWidth = 3;
      const chest = new Path2D();
      // body
      chest.moveTo(5.5, 15);
      chest.lineTo(5.5, 24.5);
      chest.quadraticCurveTo(5.5, 27, 8, 27);
      chest.lineTo(24, 27);
      chest.quadraticCurveTo(26.5, 27, 26.5, 24.5);
      chest.lineTo(26.5, 15);
      // domed lid, closed along the seam
      chest.moveTo(5.5, 15);
      chest.lineTo(5.5, 12);
      chest.quadraticCurveTo(5.5, 6.5, 11, 6.5);
      chest.lineTo(21, 6.5);
      chest.quadraticCurveTo(26.5, 6.5, 26.5, 12);
      chest.lineTo(26.5, 15);
      chest.closePath();
      ctx.stroke(chest);
      // lock
      const lock = new Path2D();
      lock.arc(16, 17.5, 2.2, 0, TAU);
      ctx.fill(lock);
      break;
    }
    case 'decorate': {
      // a small leafy sprig: stem with two leaves, not the snack worm
      ctx.lineWidth = 2.8;
      const sprig = new Path2D();
      sprig.moveTo(16, 27.5);
      sprig.lineTo(16, 6.5);
      // lower left leaf
      sprig.moveTo(16, 23);
      sprig.quadraticCurveTo(5.5, 23, 6, 13.5);
      sprig.quadraticCurveTo(16, 13.5, 16, 23);
      // upper right leaf
      sprig.moveTo(16, 16.5);
      sprig.quadraticCurveTo(26.5, 16.5, 26, 7.5);
      sprig.quadraticCurveTo(16, 7.5, 16, 16.5);
      ctx.stroke(sprig);
      break;
    }
    case 'close': {
      // rounded X
      ctx.lineWidth = 4.5;
      const x = new Path2D();
      x.moveTo(9, 9);
      x.lineTo(23, 23);
      x.moveTo(23, 9);
      x.lineTo(9, 23);
      ctx.stroke(x);
      break;
    }
    case 'left': {
      // single chevron pointing left
      ctx.lineWidth = 4.5;
      const c = new Path2D();
      c.moveTo(20, 7);
      c.lineTo(11, 16);
      c.lineTo(20, 25);
      ctx.stroke(c);
      break;
    }
    case 'right': {
      // single chevron pointing right
      ctx.lineWidth = 4.5;
      const c = new Path2D();
      c.moveTo(12, 7);
      c.lineTo(21, 16);
      c.lineTo(12, 25);
      ctx.stroke(c);
      break;
    }
    case 'check': {
      // tick
      ctx.lineWidth = 4.5;
      const t = new Path2D();
      t.moveTo(7, 17);
      t.lineTo(13.5, 23.5);
      t.lineTo(25, 9);
      ctx.stroke(t);
      break;
    }
    case 'putAway': {
      // down arrow into an open tray
      ctx.lineWidth = 3.2;
      const tray = new Path2D();
      tray.moveTo(5.5, 18);
      tray.lineTo(5.5, 24.5);
      tray.quadraticCurveTo(5.5, 27, 8, 27);
      tray.lineTo(24, 27);
      tray.quadraticCurveTo(26.5, 27, 26.5, 24.5);
      tray.lineTo(26.5, 18);
      ctx.stroke(tray);
      const arrow = new Path2D();
      arrow.moveTo(16, 5.5);
      arrow.lineTo(16, 20);
      arrow.moveTo(10, 14);
      arrow.lineTo(16, 20.5);
      arrow.lineTo(22, 14);
      ctx.stroke(arrow);
      break;
    }
    case 'book': {
      // Collection Book: an open book, two rounded pages from a centre spine
      // at x 16, tops curving from y 8 (spine) to y 10 (outer), one text line each. Ink only.
      ctx.lineWidth = 3;
      const book = new Path2D();
      // left page
      book.moveTo(16, 8);
      book.quadraticCurveTo(10, 6.5, 5.5, 10);
      book.lineTo(5.5, 23);
      book.quadraticCurveTo(5.5, 25, 7.5, 25);
      book.lineTo(16, 25);
      book.closePath();
      // right page, mirrored about the spine
      book.moveTo(16, 8);
      book.quadraticCurveTo(22, 6.5, 26.5, 10);
      book.lineTo(26.5, 23);
      book.quadraticCurveTo(26.5, 25, 24.5, 25);
      book.lineTo(16, 25);
      book.closePath();
      // one text line per page
      book.moveTo(9.5, 15.5);
      book.lineTo(12.5, 15.5);
      book.moveTo(19.5, 15.5);
      book.lineTo(22.5, 15.5);
      ctx.stroke(book);
      break;
    }
    case 'surprise': {
      // Surprise me: a big and a small 4-point star, outline only
      ctx.lineWidth = 3;
      ctx.stroke(surpriseStarPath(14, 18, 10));
      ctx.stroke(surpriseStarPath(25, 8, 5));
      break;
    }
    case 'boy': {
      // male sign: ring with an arrow leaving its upper right edge. Paths only, ink 3.5.
      ctx.lineWidth = 3.5;
      const sign = new Path2D();
      sign.arc(13, 19, 7, 0, TAU);
      // shaft starts on the ring edge (13 + 7 cos 45, 19 - 7 sin 45)
      sign.moveTo(13 + 7 * Math.SQRT1_2, 19 - 7 * Math.SQRT1_2);
      sign.lineTo(26, 6);
      // arrowhead: legs to (19, 6) and (26, 13)
      sign.moveTo(19, 6);
      sign.lineTo(26, 6);
      sign.lineTo(26, 13);
      ctx.stroke(sign);
      break;
    }
    case 'girl': {
      // female sign: ring over a stem with a crossbar. Paths only, ink 3.5.
      ctx.lineWidth = 3.5;
      const sign = new Path2D();
      sign.arc(16, 12, 7.5, 0, TAU);
      sign.moveTo(16, 19.5);
      sign.lineTo(16, 29);
      sign.moveTo(11, 24.5);
      sign.lineTo(21, 24.5);
      ctx.stroke(sign);
      break;
    }
    case 'pencil': {
      // diagonal pencil, tip (7, 25) to eraser end (25, 7). Outline only, ink 2.6.
      // t runs along the pencil from the tip, s across it (half width 3.4).
      ctx.lineWidth = 2.6;
      const len = 18 * Math.SQRT2;
      const half = 3.4;
      const pt = (t: number, s: number): [number, number] => [
        7 + (t + s) * Math.SQRT1_2,
        25 + (s - t) * Math.SQRT1_2,
      ];
      const pencil = new Path2D();
      // outline: tip, cone to the shoulders, body, eraser end
      pencil.moveTo(...pt(0, 0));
      pencil.lineTo(...pt(6, -half));
      pencil.lineTo(...pt(len, -half));
      pencil.lineTo(...pt(len, half));
      pencil.lineTo(...pt(6, half));
      pencil.closePath();
      // shoulder line under the cone, and the eraser band line
      pencil.moveTo(...pt(6, -half));
      pencil.lineTo(...pt(6, half));
      pencil.moveTo(...pt(len - 5, -half));
      pencil.lineTo(...pt(len - 5, half));
      ctx.stroke(pencil);
      break;
    }
    case 'shirt': {
      // Shirt (guide 8, Change outfit): a sleeveless top. Outline only, ink 3.0.
      ctx.lineWidth = 3;
      ctx.stroke(shirtIconPath());
      break;
    }
    case 'lock': {
      // Lock (guide 8, Lock icon): the 7g exit sign padlock at x 1.5 about the box centre.
      // Shackle: ink stroke 3.9 (2.6 x 1.5), a half circle of radius 5.1 round (16, 10.38).
      ctx.lineWidth = 3.9;
      const shackle = new Path2D();
      shackle.moveTo(10.9, 14.88);
      shackle.lineTo(10.9, 10.38);
      shackle.arc(16, 10.38, 5.1, Math.PI, TAU);
      shackle.lineTo(21.1, 14.88);
      ctx.stroke(shackle);
      // Body: filled ink rounded rectangle 16.5 x 13.5, corner radius 3.75, white keyhole dot r 1.95.
      ctx.fill(roundedRect(7.75, 15.18, 16.5, 13.5, 3.75));
      const hole = new Path2D();
      hole.arc(16, 22.08, 1.95, 0, TAU);
      ctx.fillStyle = WHITE;
      ctx.fill(hole);
      break;
    }
    case 'paintDrop': {
      // Paint drop (guide 8, Paint drop icon): a leaning drop OUTLINE (never a filled drop, that is the
      // Axanthic badge), a small filled ink droplet, and a splash line. Ink 3.0, no fill, no shine.
      // Body: circle r 7.5 about (13.5, 17.5); tip (20, 4) leaning right. The sides are the two tangents
      // from the tip: left tangent point (9.27, 11.29), right tangent point (20.98, 16.93). Tip rounded r 1.5.
      ctx.lineWidth = 3;
      const drop = new Path2D();
      drop.moveTo(9.27, 11.29);
      drop.arcTo(20, 4, 20.98, 16.93, 1.5);
      drop.lineTo(20.98, 16.93);
      drop.arc(13.5, 17.5, 7.5, Math.atan2(16.93 - 17.5, 20.98 - 13.5), Math.atan2(11.29 - 17.5, 9.27 - 13.5) + TAU, false);
      ctx.stroke(drop);
      // Small ink droplet r 2.2 at (26.5, 21).
      const bead = new Path2D();
      bead.arc(26.5, 21, 2.2, 0, TAU);
      ctx.fill(bead);
      // Splash line under the body, (7, 29) to (20, 29).
      const splash = new Path2D();
      splash.moveTo(7, 29);
      splash.lineTo(20, 29);
      ctx.stroke(splash);
      break;
    }
    case 'refuge': {
      // Xochimilco refuge (guide 8, Refuge icon): a lily pad with a wedge notch over a wave. Ink only, 3.0,
      // no fill. Pad: radius 7.5 about (16, 11), the wedge opening to the lower right (centre angle PI / 4,
      // half angle 0.42), the same notched pad as the Area map pond marker. Wave: one swell from (5.5, 26)
      // to (26.5, 26), crest 1.75 above and trough 1.75 below the line.
      ctx.lineWidth = 3;
      const cx = 16;
      const cy = 11;
      const r = 7.5;
      const open = Math.PI / 4;
      const half = 0.42;
      const pad = new Path2D();
      pad.moveTo(cx, cy);
      pad.lineTo(cx + r * Math.cos(open + half), cy + r * Math.sin(open + half));
      pad.arc(cx, cy, r, open + half, open - half + TAU);
      pad.closePath();
      ctx.stroke(pad);
      const wave = new Path2D();
      wave.moveTo(5.5, 26);
      wave.quadraticCurveTo(10.75, 22.5, 16, 26);
      wave.quadraticCurveTo(21.25, 29.5, 26.5, 26);
      ctx.stroke(wave);
      break;
    }
    case 'musicOn': {
      // Music switch, on (PRD M8): two beamed notes. Ink only.
      strokeBeamedNotes(ctx);
      break;
    }
    case 'musicOff': {
      // Music switch, off (PRD M8): the beamed notes crossed by one slash, readable in greyscale (X2).
      strokeBeamedNotes(ctx);
      ctx.lineWidth = 3.5;
      const slash = new Path2D();
      slash.moveTo(5, 5);
      slash.lineTo(27, 27);
      ctx.stroke(slash);
      break;
    }
  }
  ctx.restore();
}

/**
 * Two beamed eighth notes in the 32 box, ink only: filled heads (radii 4.2 x 3.2, tilted) centred on
 * (10, 24) and (22, 22), stems 3 wide up their right sides to y 9 and 7, and a beam 4 wide joining
 * the stem tops.
 */
function strokeBeamedNotes(ctx: CanvasRenderingContext2D): void {
  const heads = new Path2D();
  heads.ellipse(10, 24, 4.2, 3.2, -0.35, 0, TAU);
  heads.ellipse(22, 22, 4.2, 3.2, -0.35, 0, TAU);
  ctx.fill(heads);
  ctx.lineWidth = 3;
  const stems = new Path2D();
  stems.moveTo(13.6, 23);
  stems.lineTo(13.6, 9);
  stems.moveTo(25.6, 21);
  stems.lineTo(25.6, 7);
  ctx.stroke(stems);
  ctx.lineWidth = 4;
  const beam = new Path2D();
  beam.moveTo(13.6, 9);
  beam.lineTo(25.6, 7);
  ctx.stroke(beam);
}

/**
 * The Shirt icon (art guide 8) in the 32 box: straps (11.5, 4.5) to (11.5, 10) and (20.5, 4.5) to
 * (20.5, 10), the neck scoop arc from (11.5, 4.5) through (16, 9.5) to (20.5, 4.5), and the body
 * from (11.5, 10) curving out to (6.5, 12.5), down to (7.5, 27.5), across with rounded corners to
 * (24.5, 27.5), up to (25.5, 12.5) and back in to (20.5, 10).
 */
function shirtIconPath(): Path2D {
  const path = new Path2D();
  path.moveTo(11.5, 4.5);
  path.lineTo(11.5, 10);
  path.moveTo(20.5, 4.5);
  path.lineTo(20.5, 10);
  const scoopCy = (9.5 * 9.5 - 4.5 * 4.5 - 4.5 * 4.5) / (2 * (9.5 - 4.5));
  const scoopR = 9.5 - scoopCy;
  const scoopSide = Math.atan2(4.5 - scoopCy, 4.5);
  path.moveTo(11.5, 4.5);
  path.arc(16, scoopCy, scoopR, Math.PI - scoopSide, scoopSide, true);
  path.moveTo(11.5, 10);
  path.quadraticCurveTo(8.5, 10.5, 6.5, 12.5);
  path.arcTo(7.5, 27.5, 24.5, 27.5, 3);
  path.arcTo(24.5, 27.5, 25.5, 12.5, 3);
  path.lineTo(25.5, 12.5);
  path.quadraticCurveTo(23.5, 10.5, 20.5, 10);
  return path;
}

// ---------------------------------------------------------------------------
// Perk icons (guide 7b)
// ---------------------------------------------------------------------------

/** One icon per Wearable perk type; the same strings as `PerkType` in src/logic/catalogue.ts (art never imports logic). */
export type PerkIconKind = 'speed' | 'regrowth' | 'dash' | 'shell' | 'treasureSense' | 'snackMagnet';

/** Every perk icon kind, in PRD order (Speed, Regrowth, Dash, Shell, Treasure sense, Snack magnet). */
export const PERK_ICON_KINDS: readonly PerkIconKind[] = ['speed', 'regrowth', 'dash', 'shell', 'treasureSense', 'snackMagnet'];

/** Perk icon ink at the 32 box (guide 7b); it scales with the box. */
const PERK_INK = 3;

/** Texture frame for a perk icon of `size`. Anchor is the icon centre. */
export function perkIconTextureSize(size: number): TexSize {
  const half = size / 2;
  return frameFromBounds(-half, -half, half, half, 1);
}

/** The two points where equal circles of radius `r` at `a` and `b` cross; the upper one (smaller y) first. */
function circleCrossing(a: { x: number; y: number }, b: { x: number; y: number }, r: number): { x: number; y: number } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) * (d / 2)));
  const ux = -(b.y - a.y) / d;
  const uy = (b.x - a.x) / d;
  const p1 = { x: mx + ux * h, y: my + uy * h };
  const p2 = { x: mx - ux * h, y: my - uy * h };
  return p1.y <= p2.y ? p1 : p2;
}

/** The scallop shell outline: base line, left side, three round bumps, right side (guide 7b). */
function perkShellPath(): Path2D {
  const r = 5.2;
  const c = [
    { x: 10, y: 13 },
    { x: 16, y: 10.5 },
    { x: 22, y: 13 },
  ];
  const angleOn = (centre: { x: number; y: number }, pt: { x: number; y: number }): number =>
    Math.atan2(pt.y - centre.y, pt.x - centre.x);
  const upLeft = circleCrossing(c[0], c[1], r);
  const upRight = circleCrossing(c[1], c[2], r);
  const leftEdge = { x: 5.5, y: 17 };
  const rightEdge = { x: 26.5, y: 17 };
  const start = angleOn(c[0], leftEdge);
  const p = new Path2D();
  p.moveTo(11, 27.5);
  p.lineTo(leftEdge.x, leftEdge.y);
  p.lineTo(c[0].x + r * Math.cos(start), c[0].y + r * Math.sin(start));
  // Left bump from its lower left, over the top, to the crossing with the middle bump.
  p.arc(c[0].x, c[0].y, r, start, angleOn(c[0], upLeft) + TAU, false);
  p.arc(c[1].x, c[1].y, r, angleOn(c[1], upLeft), angleOn(c[1], upRight), false);
  const end = angleOn(c[2], rightEdge);
  p.arc(c[2].x, c[2].y, r, angleOn(c[2], upRight), end, false);
  p.lineTo(rightEdge.x, rightEdge.y);
  p.lineTo(21, 27.5);
  p.closePath();
  return p;
}

/**
 * Paint the perk icon for `kind` in the box (0, 0) to (size, size), like {@link paintIcon}:
 * ink only, no fill, round joins and caps, ink 3.0 at the 32 box (guide 7b). The ink scales with
 * the box, so it is 2.25 at 24 px and 1.7 at 18 px. Always pair with the perk's name and value as
 * text. Still frame, so also the reduced-motion version.
 */
export function paintPerkIcon(ctx: CanvasRenderingContext2D, kind: PerkIconKind, size: number): void {
  ctx.save();
  ctx.scale(size / ICON_SIZE, size / ICON_SIZE);
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = PERK_INK;
  const p = new Path2D();
  switch (kind) {
    case 'speed':
      // lightning bolt, one closed outline
      p.moveTo(19, 3.5);
      p.lineTo(8.5, 17.5);
      p.lineTo(15.5, 17.5);
      p.lineTo(12.5, 28.5);
      p.lineTo(23.5, 13.5);
      p.lineTo(16.5, 13.5);
      p.closePath();
      ctx.stroke(p);
      break;
    case 'regrowth': {
      // a leg (capsule outline, 9 wide, y 4 to 19) with three toes, and a spark
      p.moveTo(12.5, 4);
      p.arcTo(17, 4, 17, 8.5, 4.5);
      p.lineTo(17, 14.5);
      p.arcTo(17, 19, 12.5, 19, 4.5);
      p.arcTo(8, 19, 8, 14.5, 4.5);
      p.lineTo(8, 8.5);
      p.arcTo(8, 4, 12.5, 4, 4.5);
      p.closePath();
      for (const x of [8, 12.5, 17]) {
        p.moveTo(12.5, 19);
        p.lineTo(x, x === 12.5 ? 26 : 25);
      }
      ctx.stroke(p);
      ctx.lineWidth = 2;
      ctx.stroke(surpriseStarPath(23.5, 9, 6));
      break;
    }
    case 'dash':
      // the Dash button's two right-pointing chevrons
      p.moveTo(7, 9);
      p.lineTo(14, 16);
      p.lineTo(7, 23);
      p.moveTo(17, 9);
      p.lineTo(24, 16);
      p.lineTo(17, 23);
      ctx.stroke(p);
      break;
    case 'shell':
      ctx.stroke(perkShellPath());
      ctx.lineWidth = 2;
      p.moveTo(16, 27);
      p.lineTo(11.5, 16);
      p.moveTo(16, 27);
      p.lineTo(20.5, 16);
      ctx.stroke(p);
      break;
    case 'treasureSense':
      // a magnifying glass; the hint star sits inside the ring
      p.arc(13.5, 13.5, 8.5, 0, TAU);
      p.moveTo(19.8, 19.8);
      p.lineTo(27.5, 27.5);
      ctx.stroke(p);
      ctx.lineWidth = 1.8;
      ctx.stroke(surpriseStarPath(13.5, 13.5, 4.2));
      break;
    case 'snackMagnet':
      // a horseshoe magnet: the U, then a band across each pole
      p.moveTo(8, 5);
      p.lineTo(8, 16);
      p.arc(16, 16, 8, Math.PI, 0, true);
      p.lineTo(24, 5);
      p.moveTo(4.5, 8.5);
      p.lineTo(11.5, 8.5);
      p.moveTo(20.5, 8.5);
      p.lineTo(27.5, 8.5);
      ctx.stroke(p);
      break;
  }
  ctx.restore();
}

/** Room around a stick disc for half the outline plus a pixel of bake slack. */
const STICK_PAD = LW / 2 + 1;

/** Texture frame for a stick disc of radius r. Origin is the disc centre. */
export function stickTextureSize(r: number): TexSize {
  return frameFromBounds(-r, -r, r, r, STICK_PAD);
}

/** Arc stroke used for the small top shine on both stick parts. */
function stickShine(ctx: CanvasRenderingContext2D, radius: number, from: number, to: number, width: number): void {
  ctx.save();
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = BODY_SHINE;
  ctx.beginPath();
  ctx.arc(0, 0, radius, (from * Math.PI) / 180, (to * Math.PI) / 180);
  ctx.stroke();
  ctx.restore();
}

/**
 * Paint the swim pad base centred at local (0, 0): translucent light disc, ink
 * outline, thin guide ring, four ink chevrons (N, E, S, W: direction by shape),
 * small top shine. Use stickTextureSize(r) for the frame.
 */
export function paintStickBase(ctx: CanvasRenderingContext2D, r: number): void {
  const disc = new Path2D();
  disc.arc(0, 0, r, 0, TAU);

  ctx.save();
  ctx.globalAlpha = STICK_BASE_ALPHA;
  ctx.fillStyle = UI_PANEL;
  ctx.fill(disc);
  ctx.restore();

  ctx.lineWidth = LW;
  ctx.strokeStyle = INK;
  ctx.stroke(disc);

  // thin inner guide ring
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, r * STICK_GUIDE_FRAC, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // four chevrons, each pointing outward from the centre
  const s = STICK_CHEVRON_S;
  const d = r * STICK_CHEVRON_FRAC;
  ctx.save();
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(-s, -d + s * 0.5);
    ctx.lineTo(0, -d - s * 0.5);
    ctx.lineTo(s, -d + s * 0.5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  stickShine(ctx, r * 0.86, -150, -118, 4);
}

/**
 * Paint the swim pad knob centred at local (0, 0): solid accent disc, ink
 * outline, small top shine. Use stickTextureSize(r) for the frame.
 */
export function paintStickKnob(ctx: CanvasRenderingContext2D, r: number): void {
  const disc = new Path2D();
  disc.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = UI_ACCENT;
  ctx.fill(disc);
  ctx.lineWidth = LW;
  ctx.strokeStyle = INK;
  ctx.stroke(disc);

  stickShine(ctx, r * 0.62, -150, -100, 3.5);
}
