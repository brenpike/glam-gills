/**
 * Spring cave Area 7 props (issue #105, ND-7, ND-8 and ND-15; guide 3c, 7 and 10): the pebble that
 * plugs the side room's doorway, its hint arrow, the solid rock walls of the room, and the pulsing
 * vent's mouth, warning bubble and surge streak.
 *
 * Every value is derived (provisional). Presentational only: no Phaser, no game state, no
 * randomness. The painters take an explicit context and draw at logical scale; the bakes live in
 * springCaveTextures.ts. Every painter is a still frame, so each one is also its reduced-motion
 * version: the scene moves, fades or holds the sprites, never the painters.
 *
 * Contrast rule (guide 10, the pair method), as for the rest of the spring cave: the rock and the
 * pebble have relative luminance 0.1687 or more, so ink #2b2350 is 3:1 or better against them. The
 * pebble is a cue object, so it keeps a full LW ink outline; the rock walls are scenery with a
 * lighter ink edge. The hint arrow is white with an ink outline, the brightest thing near it, so it
 * reads in greyscale. The surge streak only lightens (white at an alpha), like the outflow marks.
 */
import { ell, frameFromBounds, line, shape, type TexSize } from './canvasKit';
import { SPRING_ROCK, SPRING_ROCK_CRACK, SPRING_ROCK_DARK, SPRING_ROCK_LIGHT, SPRING_ROCK_SHINE } from './drawSpringCave';
import { INK, LW, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Pebble
// ---------------------------------------------------------------------------

/** Radius of the pebble as drawn, the logic's pebble radius (springCave2Layout.ts). */
export const PEBBLE_RADIUS = 40;
/** Pebble fill: pebble D of the canal bed (guide 3a), luminance 0.3699, 5.87:1 with ink. */
export const PEBBLE_FILL = '#97a6c4';
/** The pebble's lower shade, a darker rock blue, still 3:1 or better with ink. */
export const PEBBLE_SHADE = SPRING_ROCK_DARK;
/** Texture frame of the pebble: its circle plus the ink and a little room. Anchor is the centre. */
export const PEBBLE_TEX: TexSize = frameFromBounds(-PEBBLE_RADIUS, -PEBBLE_RADIUS, PEBBLE_RADIUS, PEBBLE_RADIUS, 4);

/** Speckles on the pebble: [x, y, radius]. */
const PEBBLE_SPECKLES: readonly (readonly [number, number, number])[] = [
  [-14, 10, 2.4],
  [6, 18, 2],
  [18, -2, 1.8],
  [-4, -6, 1.6],
  [24, 14, 2.2],
];

/**
 * Paint the pebble centred on local (0, 0): a big round grey-blue pebble, a darker shade on its
 * lower half, a few speckles, a strata crack, a shine, and the full ink outline of a cue object.
 * It rolls, so nothing on it reads as up or down: the scene turns it as it rolls.
 */
export function paintPebble(ctx: CanvasRenderingContext2D): void {
  const body = new Path2D();
  ell(body, 0, 0, PEBBLE_RADIUS, PEBBLE_RADIUS);
  ctx.fillStyle = PEBBLE_FILL;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  const shade = new Path2D();
  ell(shade, 4, 22, PEBBLE_RADIUS * 1.05, PEBBLE_RADIUS * 0.62);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = PEBBLE_SHADE;
  ctx.fill(shade);
  ctx.globalAlpha = 1;
  ctx.restore();
  for (const [x, y, r] of PEBBLE_SPECKLES) {
    const speck = new Path2D();
    ell(speck, x, y, r, r);
    ctx.fillStyle = SPRING_ROCK_CRACK;
    ctx.fill(speck);
  }
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SPRING_ROCK_CRACK;
  ctx.stroke(line(-22, 2, 4, -10));
  const shine = new Path2D();
  ell(shine, -14, -18, 11, 6, -0.5);
  ctx.fillStyle = SPRING_ROCK_SHINE;
  ctx.fill(shine);
  ctx.lineWidth = LW;
  ctx.strokeStyle = INK;
  ctx.stroke(body);
}

/** Length of the hint arrow from its tail to its tip. */
export const PEBBLE_HINT_LENGTH = 56;
/** Texture frame of the hint arrow, pointing along +x. Anchor is the middle of its tail. */
export const PEBBLE_HINT_TEX: TexSize = frameFromBounds(0, -18, PEBBLE_HINT_LENGTH, 18, 4);

/**
 * Paint the hint arrow (issue #105, ND-8) with its tail at local (0, 0), pointing along +x: a
 * chunky white arrow with an ink outline. The scene turns it to the way the pebble rolls and holds
 * it still: the hint is still under reduced motion too.
 */
export function paintPebbleHint(ctx: CanvasRenderingContext2D): void {
  const p = new Path2D();
  p.moveTo(0, -7);
  p.lineTo(PEBBLE_HINT_LENGTH - 22, -7);
  p.lineTo(PEBBLE_HINT_LENGTH - 22, -16);
  p.lineTo(PEBBLE_HINT_LENGTH, 0);
  p.lineTo(PEBBLE_HINT_LENGTH - 22, 16);
  p.lineTo(PEBBLE_HINT_LENGTH - 22, 7);
  p.lineTo(0, 7);
  p.closePath();
  shape(ctx, p, WHITE, LW);
}

// ---------------------------------------------------------------------------
// Rock walls
// ---------------------------------------------------------------------------

/** Padding round a rock wall's frame for its ink and its bumps. */
const WALL_PAD = 6;
/** Px between the bumps along a wall's edge. */
const WALL_BUMP_STEP = 24;
/** How far a bump stands out from the wall's edge. */
const WALL_BUMP = 3;
/** Ink width of a rock wall's edge: scenery, so lighter than a cue object's. */
const WALL_LW = LW * 0.8;

/** Texture frame of a rock wall `w` x `h` logical px. Anchor is its top-left corner. */
export function rockWallTex(w: number, h: number): TexSize {
  return frameFromBounds(0, 0, w, h, WALL_PAD);
}

/** A wall's outline: its rect with gentle bumps along every edge, so it reads as rock, not a box. */
function wallPath(w: number, h: number): Path2D {
  const p = new Path2D();
  p.moveTo(0, 0);
  for (let x = WALL_BUMP_STEP; x <= w; x += WALL_BUMP_STEP) p.quadraticCurveTo(x - WALL_BUMP_STEP / 2, -WALL_BUMP, Math.min(x, w), 0);
  p.lineTo(w, 0);
  for (let y = WALL_BUMP_STEP; y <= h; y += WALL_BUMP_STEP) p.quadraticCurveTo(w + WALL_BUMP, y - WALL_BUMP_STEP / 2, w, Math.min(y, h));
  p.lineTo(w, h);
  for (let x = w - WALL_BUMP_STEP; x >= 0; x -= WALL_BUMP_STEP) p.quadraticCurveTo(x + WALL_BUMP_STEP / 2, h + WALL_BUMP, Math.max(x, 0), h);
  p.lineTo(0, h);
  for (let y = h - WALL_BUMP_STEP; y >= 0; y -= WALL_BUMP_STEP) p.quadraticCurveTo(-WALL_BUMP, y + WALL_BUMP_STEP / 2, 0, Math.max(y, 0));
  p.closePath();
  return p;
}

/**
 * Paint a solid rock wall `w` x `h` logical px with its top-left corner at local (0, 0): grey-blue
 * cave rock with a bumpy inked edge, lighter and darker patches, strata cracks and a shine along
 * its top. Drawn in front of the water and every snack, so it reads as solid.
 */
export function paintRockWall(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const body = wallPath(w, h);
  ctx.fillStyle = SPRING_ROCK;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  for (let x = 12; x < w; x += 60) {
    for (let y = 14; y < h; y += 44) {
      const patch = new Path2D();
      ell(patch, x + ((y / 44) % 2) * 26, y, 16, 10);
      ctx.fillStyle = (x + y) % 3 === 0 ? SPRING_ROCK_LIGHT : SPRING_ROCK_DARK;
      ctx.globalAlpha = 0.6;
      ctx.fill(patch);
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SPRING_ROCK_CRACK;
  for (let y = 18; y < h - 6; y += 36) ctx.stroke(line(8, y, Math.min(w - 8, 8 + w * 0.6), y + 4));
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = SPRING_ROCK_SHINE;
  ctx.stroke(line(6, 4, Math.max(6, w - 6), 4));
  ctx.restore();
  ctx.lineWidth = WALL_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(body);
}

// ---------------------------------------------------------------------------
// Pulsing vent
// ---------------------------------------------------------------------------

/** Half the height of the vent's mouth, across its flow. */
export const VENT_MOUTH_HALF = 26;
/** Depth of the vent's mouth into the rock, along its flow. */
export const VENT_MOUTH_DEPTH = 22;
/** Texture frame of the vent mouth, blowing along -x (to the left). Anchor is the middle of the mouth's opening. */
export const VENT_MOUTH_TEX: TexSize = frameFromBounds(0, -VENT_MOUTH_HALF - 6, VENT_MOUTH_DEPTH + 10, VENT_MOUTH_HALF + 6, 4);
/** The dark of the vent's throat: the grotto interior's blue-black. */
export const VENT_THROAT = '#1c2d45';

/**
 * Paint the pulsing vent's mouth (issue #105, ND-7) with the middle of its opening at local (0, 0),
 * blowing along -x: a rock lip round a dark cleft that the water comes out of. The scene turns it
 * to its flow. A cue object, so the lip has a full LW ink outline.
 */
export function paintVentMouth(ctx: CanvasRenderingContext2D): void {
  const lip = new Path2D();
  lip.moveTo(0, -VENT_MOUTH_HALF - 4);
  lip.quadraticCurveTo(VENT_MOUTH_DEPTH + 10, -VENT_MOUTH_HALF, VENT_MOUTH_DEPTH + 10, 0);
  lip.quadraticCurveTo(VENT_MOUTH_DEPTH + 10, VENT_MOUTH_HALF, 0, VENT_MOUTH_HALF + 4);
  lip.closePath();
  shape(ctx, lip, SPRING_ROCK, LW);
  const throat = new Path2D();
  ell(throat, VENT_MOUTH_DEPTH / 2 + 2, 0, VENT_MOUTH_DEPTH / 2, VENT_MOUTH_HALF - 6);
  ctx.fillStyle = VENT_THROAT;
  ctx.fill(throat);
  ctx.lineWidth = LW * 0.6;
  ctx.strokeStyle = INK;
  ctx.stroke(throat);
}

/** Radius of one warning bubble. */
export const VENT_BUBBLE_RADIUS = 6;
/** Texture frame of a warning bubble. Anchor is its centre. */
export const VENT_BUBBLE_TEX: TexSize = frameFromBounds(-VENT_BUBBLE_RADIUS, -VENT_BUBBLE_RADIUS, VENT_BUBBLE_RADIUS, VENT_BUBBLE_RADIUS, 3);

/** Paint one warning bubble (issue #105, ND-7) centred on local (0, 0): a pale bubble, an ink ring and a shine. */
export function paintVentBubble(ctx: CanvasRenderingContext2D): void {
  const ring = new Path2D();
  ell(ring, 0, 0, VENT_BUBBLE_RADIUS, VENT_BUBBLE_RADIUS);
  ctx.fillStyle = 'rgba(232,251,255,0.55)';
  ctx.fill(ring);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.stroke(ring);
  const shine = new Path2D();
  ell(shine, -2, -2.4, 1.8, 1.2, -0.6);
  ctx.fillStyle = WHITE;
  ctx.fill(shine);
}

/** Length of one surge streak, along its flow. */
export const SURGE_STREAK_LENGTH = 44;
/** Texture frame of a surge streak, along +x. Anchor is its middle. */
export const SURGE_STREAK_TEX: TexSize = frameFromBounds(-SURGE_STREAK_LENGTH / 2, -6, SURGE_STREAK_LENGTH / 2, 6, 3);

/**
 * Paint one surge streak (issue #105, ND-7) centred on local (0, 0) along +x: a white dash with a
 * chevron at its head, at an alpha, so it only lightens the water. The scene turns it to the flow
 * and moves it along the band while the vent surges.
 */
export function paintSurgeStreak(ctx: CanvasRenderingContext2D): void {
  const half = SURGE_STREAK_LENGTH / 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.stroke(line(-half, 0, half - 4, 0));
  const head = new Path2D();
  head.moveTo(half - 12, -5);
  head.lineTo(half, 0);
  head.lineTo(half - 12, 5);
  ctx.stroke(head);
}
