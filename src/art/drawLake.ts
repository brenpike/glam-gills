/**
 * Open lake look (issue #211, Area 12; owner look decision Q10; guide 2, 7a and 10): the wide open
 * sky with Popocatepetl and Iztaccihuatl small on the horizon, the streaming clouds of the windy
 * variant, the water colours of each depth band, and the lakebed of silt, smooth stones and tule
 * roots with a light lip on every top edge.
 *
 * Presentational only: no Phaser, no game state, no time. The painters take an explicit context and
 * draw at logical scale. The only randomness is the injected `rand`, so the same rand gives the same
 * pixels. Nothing here is registered in a habitat look table yet; the look wiring comes later.
 *
 * Sky and mountains: the sky band is y 0 to SURF + 6 (the water starts at SURF + 3 and covers the
 * band's last 3 px, as every look). The mountains stand on the horizon, so paint the sky, then the
 * mountains, then the clouds, then the water. Each mountain has a place in world x; a chunk paints
 * every mountain that reaches into it, in world coordinates less the chunk's left edge, so one that
 * crosses a chunk edge is drawn whole in both chunks and meets itself there. Popocatepetl is a
 * snow-capped cone with a rounded top; Iztaccihuatl is a long ridge of rounded snowy humps, wider
 * and lower. Both are small and pale (distant): they never pass the top of the swim area and are
 * painted before the water, so nothing gameplay sits in front of them.
 *
 * Contrast rule (guide 10, the pair method), the same as the pond, chinampa, canal, spring cave and
 * deep canal looks keep: every lit background colour of the lake, band 1 and band 2 alike, has
 * relative luminance 0.1687 or more, so ink #2b2350 (luminance 0.0229) is 3:1 or better against it.
 * That covers every water stop, every haze blend over a water stop, the sky stops, the mountains,
 * the silt (top, bottom and its flecks and shade), the stones, the roots and the lip. Band 2, the
 * dusky blue, is dim on purpose, but never black: its deepest stop is the floor of the rule.
 * Band 3 (dark indigo) and band 4 (near-black) are defined here for the later areas (13 and 14) and
 * are the recorded exceptions: dark on purpose, never used by Area 12, and lit there only by what
 * the player lights (the existing dark-water rule: darkness hides scenery, snacks and treasure, never
 * the axolotl, the exit, predators or hazards).
 *
 * Readability (guide 2): the axolotl stays the brightest thing in the water. Every water stop and
 * every bed fill is darker than the Leucistic belly and the bed fills are less colourful (OKLCH
 * chroma) than the Leucistic body. Shapes: round stones, curved roots, rounded humps and puffs; no
 * letters (never text), no faces, no sharp points, no worm or bug shapes. Nothing in the bed reads
 * as a snack, a hint star, a hazard or a hiding place.
 *
 * Non-hue cues: the lip is a pale band along every top edge, so a ledge reads as a terrace with a
 * flat top (not a wall) in greyscale too. The depth bands are told by value (lighter at band 1,
 * darker with depth), never by hue alone.
 */
import { blob, ell, inkMany, line, seg, shape, type Seg } from './canvasKit';
import { INK, LW, SURF, VIEW_W, WATER_STOP_MID, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Sky and mountains
// ---------------------------------------------------------------------------

/** Bottom of the sky band: the sky fill covers y 0 to here; the water covers from SURF + 3. */
export const LAKE_SKY_BAND_BOTTOM = SURF + 6;

/** The sky: a clear, wide, pale blue at the top to a hazy near-white at the horizon (luminance 0.4143 and 0.7913). */
export const LAKE_SKY_TOP = '#6cb4e4';
export const LAKE_SKY_HORIZON = '#d4eaf0';

/** Popocatepetl's body in the lit side (0.3802) and its shaded side (0.3045): a distant blue-grey. */
export const LAKE_VOLCANO_BODY = '#8fa8c8';
export const LAKE_VOLCANO_SHADE = '#7d98bc';
/** The snow: a pale, cool white (lit) and a blue-white (in shade, 0.6747). */
export const LAKE_SNOW = '#f4f8fc';
export const LAKE_SNOW_SHADE = '#c9d8ea';

/** Every opaque sky and mountain colour, for the contrast rule. */
export const LAKE_SKY_FILLS: readonly string[] = [
  LAKE_SKY_TOP,
  LAKE_SKY_HORIZON,
  LAKE_VOLCANO_BODY,
  LAKE_VOLCANO_SHADE,
  LAKE_SNOW,
  LAKE_SNOW_SHADE,
];

/** A mountain on the horizon: its centre in world x, its width, and its height above the water line. */
export interface LakeMountain {
  readonly x: number;
  readonly w: number;
  readonly h: number;
}

/** Popocatepetl: the snow-capped cone, small on the horizon. Right of Iztaccihuatl, as seen from Xochimilco. */
export const POPOCATEPETL: LakeMountain = { x: 2230, w: 72, h: 34 };
/** Iztaccihuatl: the long snowy ridge, wider and lower than the cone. */
export const IZTACCIHUATL: LakeMountain = { x: 1960, w: 172, h: 20 };

/** Where the mountains' feet are painted: under the water's top (SURF + 3), which covers them. */
export const LAKE_MOUNTAIN_BASE_Y = SURF + 5;
/** Y of a mountain's top, px. */
export const mountainTop = (m: LakeMountain): number => SURF + 3 - m.h;

/** Mountain outline: thin, so far scenery sits under the hero's weight (guide 4b). */
const MOUNTAIN_LW = LW * 0.45;
/** Humps of the ridge, as fractions of its height, left to right; valleys between them rise to 0.3. */
const RIDGE_HUMPS: readonly number[] = [0.55, 0.8, 0.62, 1, 0.7];
const RIDGE_VALLEY = 0.3;

/** A scalloped snow band across x0 to x1, from `yTop` down to a wavy lower edge at `yLine` (made to be clipped to a mountain). */
function snowBand(x0: number, x1: number, yTop: number, yLine: number, bumps: number): Path2D {
  const p = new Path2D();
  p.moveTo(x0, yTop);
  p.lineTo(x1, yTop);
  p.lineTo(x1, yLine);
  const step = (x1 - x0) / bumps;
  for (let i = bumps; i > 0; i--) p.quadraticCurveTo(x0 + (i - 0.5) * step, yLine + 4, x0 + (i - 1) * step, yLine);
  p.closePath();
  return p;
}

function conePath(cx: number, m: LakeMountain): Path2D {
  const top = mountainTop(m);
  const p = new Path2D();
  p.moveTo(cx - m.w / 2, LAKE_MOUNTAIN_BASE_Y);
  p.quadraticCurveTo(cx - m.w * 0.18, LAKE_MOUNTAIN_BASE_Y - m.h * 0.55, cx - m.w * 0.07, top + 2);
  p.quadraticCurveTo(cx, top - 1, cx + m.w * 0.07, top + 2);
  p.quadraticCurveTo(cx + m.w * 0.18, LAKE_MOUNTAIN_BASE_Y - m.h * 0.55, cx + m.w / 2, LAKE_MOUNTAIN_BASE_Y);
  p.closePath();
  return p;
}

function paintCone(ctx: CanvasRenderingContext2D, cx: number, m: LakeMountain): void {
  const top = mountainTop(m);
  const cone = conePath(cx, m);
  ctx.fillStyle = LAKE_VOLCANO_BODY;
  ctx.fill(cone);
  ctx.save();
  ctx.clip(cone);
  ctx.fillStyle = LAKE_VOLCANO_SHADE;
  ctx.fillRect(cx, top - 2, m.w / 2 + 2, LAKE_MOUNTAIN_BASE_Y - top + 2);
  const snowLine = top + m.h * 0.48;
  ctx.fillStyle = LAKE_SNOW;
  ctx.fill(snowBand(cx - m.w / 2, cx, top - 2, snowLine, 3));
  ctx.fillStyle = LAKE_SNOW_SHADE;
  ctx.fill(snowBand(cx, cx + m.w / 2, top - 2, snowLine, 3));
  ctx.restore();
  ctx.lineWidth = MOUNTAIN_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(cone);
}

function ridgePath(cx: number, m: LakeMountain): Path2D {
  const n = RIDGE_HUMPS.length;
  const step = m.w / n;
  const x0 = cx - m.w / 2;
  // Height above the base at valley i (0 and n are the feet).
  const valley = (i: number): number => (i === 0 || i === n ? 0 : RIDGE_VALLEY * m.h);
  const p = new Path2D();
  p.moveTo(x0, LAKE_MOUNTAIN_BASE_Y);
  for (let i = 0; i < n; i++) {
    const h0 = valley(i);
    const h1 = valley(i + 1);
    // A quadratic peaks at (h0 + h1) / 4 + control / 2, so this control puts the hump's apex at its height.
    const control = 2 * RIDGE_HUMPS[i] * m.h - (h0 + h1) / 2;
    p.quadraticCurveTo(x0 + (i + 0.5) * step, LAKE_MOUNTAIN_BASE_Y - control, x0 + (i + 1) * step, LAKE_MOUNTAIN_BASE_Y - h1);
  }
  p.closePath();
  return p;
}

function paintRidge(ctx: CanvasRenderingContext2D, cx: number, m: LakeMountain): void {
  const top = mountainTop(m);
  const ridge = ridgePath(cx, m);
  ctx.fillStyle = LAKE_VOLCANO_BODY;
  ctx.fill(ridge);
  ctx.save();
  ctx.clip(ridge);
  ctx.fillStyle = LAKE_SNOW;
  ctx.fill(snowBand(cx - m.w / 2, cx + m.w / 2, top - 2, top + m.h * 0.5, RIDGE_HUMPS.length * 2));
  ctx.restore();
  ctx.lineWidth = MOUNTAIN_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(ridge);
}

/** Paint the sky gradient over the sky band. */
export function paintLakeSky(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, SURF + 4);
  g.addColorStop(0, LAKE_SKY_TOP);
  g.addColorStop(1, LAKE_SKY_HORIZON);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, LAKE_SKY_BAND_BOTTOM);
}

/**
 * Paint the two volcanoes that reach into the chunk whose left edge is at world x `chunkX`, over the
 * sky and before the water. A chunk the volcanoes do not reach paints nothing. No randomness.
 */
export function paintLakeVolcanoes(ctx: CanvasRenderingContext2D, chunkX = 0): void {
  const reaches = (m: LakeMountain): boolean => m.x + m.w / 2 + 2 > chunkX && m.x - m.w / 2 - 2 < chunkX + VIEW_W;
  if (reaches(IZTACCIHUATL)) paintRidge(ctx, IZTACCIHUATL.x - chunkX, IZTACCIHUATL);
  if (reaches(POPOCATEPETL)) paintCone(ctx, POPOCATEPETL.x - chunkX, POPOCATEPETL);
}

// ---------------------------------------------------------------------------
// Streaming clouds (the windy variant)
// ---------------------------------------------------------------------------

/** Cloud rows, y of the head puff. Kept above the volcano tops (Popocatepetl's is y 49). */
export const STREAK_ROWS: readonly number[] = [12, 21, 30, 38];
/** Cloud head puff radius at scale 1, and the long streak's half length and half height. */
const STREAK_HEAD_R = 7.5;
const STREAK_HALF_L = 46;
const STREAK_HALF_H = 3.2;
const STREAK_LW = LW * 0.5;
/** The soft shine along a streak's top. */
const STREAK_SHINE = 'rgba(207,238,255,0.9)';

/**
 * Paint the streaming clouds of the windy variant: a rounded head puff with a long thin streak and
 * a trail of shrinking puffs behind it, drawn out to the left by the wind. One per row of
 * STREAK_ROWS, two random draws each (where the head is, and how big). Rounded puffs only.
 */
export function paintStreamingClouds(ctx: CanvasRenderingContext2D, rand: () => number): void {
  for (const y of STREAK_ROWS) {
    const x = 150 + rand() * 280;
    const s = 0.7 + rand() * 0.3;
    const p = new Path2D();
    ell(p, x, y, STREAK_HEAD_R * s, STREAK_HEAD_R * s);
    ell(p, x - 40 * s, y + 2, STREAK_HALF_L * s, STREAK_HALF_H * s);
    for (let i = 1; i <= 4; i++) {
      const r = (STREAK_HEAD_R - i * 1.4) * s;
      ell(p, x - i * 14 * s, y + 1, r, r * 0.8);
    }
    blob(ctx, p, WHITE, STREAK_LW);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = STREAK_SHINE;
    ctx.stroke(line(x - 70 * s, y - 1.2 * s, x - 6 * s, y - 2.4 * s));
  }
}

// ---------------------------------------------------------------------------
// Water by depth band
// ---------------------------------------------------------------------------

/** A depth band: 1 is the shallows, 2 the middle, 3 and 4 the deeper bands of the later areas. */
export type LakeBand = 1 | 2 | 3 | 4;

/** One band's water: three gradient stops (at 0, WATER_STOP_MID and 1), its haze, and whether the contrast floor holds. */
export interface LakeWaterBand {
  readonly band: LakeBand;
  readonly shallow: string;
  readonly mid: string;
  readonly deep: string;
  /** The haze laid over the water. Only lightens the lit bands' stops, so the rule still holds. */
  readonly haze: string;
  /** True for the lit bands (1 and 2): every colour, haze blends included, is at the luminance floor 0.1687 or more. */
  readonly lit: boolean;
}

/**
 * The luminance floor of the contrast rule: ink #2b2350 (luminance 0.0229) is 3:1 or better on any
 * colour at or above it.
 */
export const LAKE_LUMINANCE_FLOOR = 0.1687;

/**
 * Band 1: sunlit blue-green (luminance 0.4757, 0.3557, 0.2604). Band 2: dusky blue (0.2403, 0.2073,
 * 0.1897), dim but never black. Band 3: dark indigo (later areas). Band 4: near-black (later areas).
 * Bands 3 and 4 are dark on purpose and not held to the floor.
 */
export const LAKE_WATER_BANDS: readonly LakeWaterBand[] = Object.freeze<LakeWaterBand[]>([
  { band: 1, shallow: '#5cc8c4', mid: '#3fb0b8', deep: '#2f98ac', haze: 'rgba(120,215,205,0.12)', lit: true },
  { band: 2, shallow: '#2e8fc0', mid: '#2a85b8', deep: '#2a7fb4', haze: 'rgba(110,170,225,0.12)', lit: true },
  { band: 3, shallow: '#1f2d7a', mid: '#1a2468', deep: '#141a52', haze: 'rgba(60,70,160,0.10)', lit: false },
  { band: 4, shallow: '#0b1030', mid: '#070a1e', deep: '#04060f', haze: 'rgba(20,30,70,0.08)', lit: false },
]);

/** The water of a band. */
export function lakeWaterBand(band: LakeBand): LakeWaterBand {
  return LAKE_WATER_BANDS[band - 1];
}

/** A band's gradient stops, top to bottom. */
export function lakeWaterStops(band: LakeBand): readonly (readonly [number, string])[] {
  const w = lakeWaterBand(band);
  return [
    [0, w.shallow],
    [WATER_STOP_MID, w.mid],
    [1, w.deep],
  ];
}

// ---------------------------------------------------------------------------
// Lakebed
// ---------------------------------------------------------------------------

/** Silt, a warm pale grey-tan: top (0.3787) to bottom (0.2084) of a rect. */
export const LAKE_SILT_TOP = '#b4a482';
export const LAKE_SILT_BOTTOM = '#8c7c60';
/** Silt flecks: a darker one (over the bottom stop, 0.1845) and a lighter one. Alpha, no ink. */
export const LAKE_SILT_FLECK_DARK = 'rgba(120,104,78,0.35)';
export const LAKE_SILT_FLECK_LIGHT = 'rgba(255,245,215,0.3)';
/** The soft shade under the lip, on the silt. */
export const LAKE_LIP_SHADE = 'rgba(70,56,40,0.16)';
/** Smooth stones: grey-tan (0.3272), darker (0.2307) and lighter (0.4487). */
export const LAKE_STONE = '#a69a7e';
export const LAKE_STONE_DARK = '#8f8368';
export const LAKE_STONE_LIGHT = '#bcb29a';
/** Shine on a stone. */
export const LAKE_STONE_SHINE = 'rgba(255,255,255,0.5)';
/** Tule roots, a pale root brown (0.2740). */
export const LAKE_ROOT = '#a08c70';
/** The lip on every top edge: a pale sand (0.5264), lighter than the silt, so a ledge reads as a terrace. */
export const LAKE_LIP = '#cdbf9c';
/** The lip's top highlight and its underside line. Alpha, inside the lip. */
export const LAKE_LIP_HIGHLIGHT = 'rgba(255,255,255,0.35)';
export const LAKE_LIP_UNDERLINE = 'rgba(110,92,66,0.35)';

/** Every opaque bed fill, for the contrast and readability rules. */
export const LAKE_BED_FILLS: readonly string[] = [
  LAKE_SILT_TOP,
  LAKE_SILT_BOTTOM,
  LAKE_STONE,
  LAKE_STONE_DARK,
  LAKE_STONE_LIGHT,
  LAKE_ROOT,
  LAKE_LIP,
];

/** Height of the lip, px (less on a rect shorter than it), and of its highlight, underside line and the shade under it. */
export const LAKE_LIP_H = 6;
const LIP_HIGHLIGHT_H = 2;
const LIP_UNDERLINE_H = 1.5;
const LIP_SHADE_H = 3;

/** A solid rect of the area, in the painter's coordinates (px). */
export interface LakeRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const STONE_FILLS: readonly string[] = [LAKE_STONE, LAKE_STONE_DARK, LAKE_STONE_LIGHT];
/** Stone outline: thin, scenery under the hero's weight. */
const STONE_LW = LW * 0.45;
const STONE_PAD = STONE_LW / 2 + 1;
const ROOT_W = 2.2;
const ROOT_OL = 0.9;
/** Room a root needs on every side: half its ink width plus a px. */
const ROOT_PAD = ROOT_W / 2 + ROOT_OL + 1;
/** One fleck per this many px squared, at most FLECK_MAX per rect. */
const FLECK_AREA = 1400;
const FLECK_MAX = 90;
/** Room a fleck needs from the rect's sides: its widest half-width (3) and a px. */
const FLECK_PAD = 4;
const STONE_SPACING = 70;
const STONE_MAX = 8;
const ROOT_SPACING = 110;
const ROOT_MAX = 5;

function paintRect(ctx: CanvasRenderingContext2D, r: LakeRect, rand: () => number): void {
  const lipH = Math.min(LAKE_LIP_H, r.h);
  const below = r.y + lipH;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Silt.
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, LAKE_SILT_TOP);
  g.addColorStop(1, LAKE_SILT_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Flecks of darker and lighter silt, inside the rect under the lip.
  const flecks = r.h > lipH + 4 && r.w > 2 * FLECK_PAD ? Math.min(FLECK_MAX, Math.floor((r.w * r.h) / FLECK_AREA)) : 0;
  const dark = new Path2D();
  const light = new Path2D();
  for (let i = 0; i < flecks; i++) {
    const fx = r.x + FLECK_PAD + rand() * (r.w - 2 * FLECK_PAD);
    const fy = below + 2 + rand() * (r.h - lipH - 4);
    const rx = 1.5 + rand() * 1.5;
    ell(i % 2 ? light : dark, fx, fy, rx, rx * 0.55);
  }
  ctx.fillStyle = LAKE_SILT_FLECK_DARK;
  ctx.fill(dark);
  ctx.fillStyle = LAKE_SILT_FLECK_LIGHT;
  ctx.fill(light);

  // The shade the lip throws on the silt below it.
  if (r.h > lipH) {
    ctx.fillStyle = LAKE_LIP_SHADE;
    ctx.fillRect(r.x, below, r.w, Math.min(LIP_SHADE_H, r.h - lipH));
  }

  // Smooth stones lying in the silt.
  const stones = Math.min(STONE_MAX, Math.floor(r.w / STONE_SPACING));
  for (let i = 0; i < stones; i++) {
    const rx = 7 + rand() * 8;
    const ry = 4 + rand() * 4;
    const fx = rand();
    const fy = rand();
    const fill = STONE_FILLS[Math.floor(rand() * STONE_FILLS.length)];
    const xMin = r.x + STONE_PAD + rx;
    const xMax = r.x + r.w - STONE_PAD - rx;
    const yMin = below + STONE_PAD + ry + 1;
    const yMax = r.y + r.h - STONE_PAD - ry;
    if (xMax < xMin || yMax < yMin) continue;
    const sx = xMin + fx * (xMax - xMin);
    const sy = yMin + fy * (yMax - yMin);
    const stone = new Path2D();
    ell(stone, sx, sy, rx, ry);
    shape(ctx, stone, fill, STONE_LW);
    const shine = new Path2D();
    ell(shine, sx - rx * 0.35, sy - ry * 0.45, rx * 0.22, ry * 0.12, -0.4);
    ctx.fillStyle = LAKE_STONE_SHINE;
    ctx.fill(shine);
  }

  // Tule roots hanging from under the lip into the silt: a curved strand with one short branch.
  const roomH = r.y + r.h - below - ROOT_PAD;
  const roots = roomH >= 14 && r.w >= 2 * ROOT_PAD + 8 ? Math.min(ROOT_MAX, Math.floor(r.w / ROOT_SPACING)) : 0;
  const clampX = (v: number): number => Math.min(r.x + r.w - ROOT_PAD, Math.max(r.x + ROOT_PAD, v));
  for (let i = 0; i < roots; i++) {
    const x0 = clampX(r.x + 12 + rand() * (r.w - 24));
    const len = Math.min(roomH, 14 + rand() * 20);
    const sway = (rand() - 0.5) * 16;
    const y1 = below + len;
    const main = new Path2D();
    main.moveTo(x0, below + 0.5);
    main.quadraticCurveTo(clampX(x0 + sway), below + len * 0.5, clampX(x0 + sway * 0.6), y1);
    const branch = new Path2D();
    branch.moveTo(clampX(x0 + sway * 0.3), below + len * 0.5);
    branch.quadraticCurveTo(clampX(x0 - sway * 0.8), below + len * 0.65, clampX(x0 - sway), below + len * 0.8);
    const segs: Seg[] = [seg(main, ROOT_W, LAKE_ROOT, ROOT_OL), seg(branch, ROOT_W * 0.75, LAKE_ROOT, ROOT_OL)];
    inkMany(ctx, segs);
  }

  // The lip, last: a flat pale top on every ledge, so it reads as a terrace.
  ctx.fillStyle = LAKE_LIP;
  ctx.fillRect(r.x, r.y, r.w, lipH);
  ctx.fillStyle = LAKE_LIP_HIGHLIGHT;
  ctx.fillRect(r.x, r.y, r.w, Math.min(LIP_HIGHLIGHT_H, lipH));
  ctx.fillStyle = LAKE_LIP_UNDERLINE;
  ctx.fillRect(r.x, r.y + lipH - Math.min(LIP_UNDERLINE_H, lipH), r.w, Math.min(LIP_UNDERLINE_H, lipH));

  ctx.restore();
}

/**
 * Paint the lakebed into the given solid rects: silt with flecks, smooth stones and tule roots, and a
 * light lip along each rect's top edge. Every mark stays inside its rect (the geometry is kept
 * inside, with its ink, and the rect is also a clip), so nothing is painted outside them. A rect
 * with no width or height paints nothing. The same rects and the same `rand` paint the same pixels.
 */
export function paintLakebed(ctx: CanvasRenderingContext2D, rects: readonly LakeRect[], rand: () => number): void {
  for (const r of rects) {
    if (!(r.w > 0 && r.h > 0)) continue;
    paintRect(ctx, r, rand);
  }
}
