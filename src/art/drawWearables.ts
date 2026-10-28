/**
 * Worn looks of the thirty-six Wearables (guide 6a, 6i, 6q; PRD C10, F9, F13): the
 * canal's Sun hat, Shell necklace, Heart glasses, Golden bow, Tank top, Diving
 * tank, Stripy socks and Flippers, the pond's Lily flower crown, Pond-weed
 * scarf, Dragonfly glasses, Raincoat, Ladybug backpack, Rainbow dragonfly wings
 * and Froggy boots, and the pond Area 3's Feather cap, Lily-pad socks,
 * Water-lily shirt, Pearl tail charm and Firefly cape, and the chinampa Area 4's
 * Straw sun hat, Marigold necklace, Garden overalls, Monarch hair clip and Monarch
 * wings, and the chinampa Area 5's Bee headband, Bandana, Sunflower sunglasses,
 * Embroidered shirt, Hummingbird tail ribbon and Rainbow serape cape, and the spring cave Area 6's
 * Miner's headlamp, Crystal pendant, Explorer vest, Crystal tail cuff and Crystal crown, painted on the anchors
 * and footprints of drawAxolotlParts.ts. Each is the 7e catalogue icon's design re-fitted to its
 * footprint, with ink widths never scaled (guide 4b). Every worn silhouette
 * (`shape`, inkedShape and `blob`) uses the item ink ITEM_LW 2.0 (#88): thinner
 * than the guide's 2.8, so more of each small item shows as colour in the swim
 * view. A `blob` strokes twice that, so 2.0 shows outside its fill.
 *
 * Painters never mutate the context they are given: each item runs between
 * save() and restore(), so drawAxolotl's own state is untouched. Fixed colours
 * and ink only: no time, no randomness, no game state. Art must not import
 * src/logic, so the outfit is an art-level map from slot to art slug
 * (ArtOutfit); a scene maps catalogue ids with artOutfit().
 *
 * Every footprint number is ink included, so each shape's path is inset by half
 * its ink (`shape`, centred on the path) or by all of it (`blob`, outside the
 * fill). Where a guide number cannot hold with the guide's own ink widths, the
 * keep-clear footprint wins; each such choice is commented where it is made.
 * Values are derived (provisional).
 *
 * The pond looks (issue #75) keep the canal painters draw-identical and add
 * only internal detail colours of their own (the rainbow veins of the wings);
 * every outer fill is a treasurePalette.ts colour shared with the icons. The
 * Area 3 looks (issue #98) follow the same rules: the footprints and painters'
 * shapes are the pond's, the outer fills are treasurePalette.ts colours, and
 * the only colours of their own are internal details (ink at the stripe alpha,
 * the firefly glow). None of them moves on its own: a worn look is still, and
 * only the rig (the swim, the legs, the tail wave) moves it.
 *
 * The Area 4 looks (issue #76) keep to the same footprints too. Their outer fills are
 * the icons' own colours, imported by name from drawTreasures.ts (STRAW_HAT_FILL,
 * MARIGOLD_PETAL, GARDEN_OVERALLS_FILL, MONARCH_WING, MONARCH_BODY), so a worn look
 * and its icon cannot drift. Their other colours are internal details: ink at the
 * stripe alpha, the overalls' patch, the cream monarch spots and ink veins. The
 * Monarch hair clip and the Monarch wings never use red, and no look has net-like
 * lines, so no worn look reads as a wound or as a ghost net.
 *
 * The Area 5 looks (issue #103) keep to the same footprints and the same rules. Their
 * outer fills are the icons' own colours, imported by name from drawTreasures.ts
 * (BEE_HEADBAND_FILL, BANDANA_FILL, SUNFLOWER_FRAME, EMBROIDERED_SHIRT_FILL,
 * HUMMINGBIRD_RIBBON_FILL, SERAPE_STRIPES; each 9:1 or better with ink, none red), so
 * a worn look and its icon cannot drift. Their other colours are internal details: ink at the stripe alpha, the
 * sunflower's brown centre, the shirt's embroidery petals and the serape's stripes.
 * The Sunflower sunglasses keep the glasses construction (clear lens tint, never dark),
 * so the eyes always show. No look has net-like lines.
 *
 * The Area 6 looks (issue #77, ND-12) keep to the same footprints and rules. Their outer
 * fills are the icons' own colours, imported by name from treasurePalette.ts
 * (MINERS_HELMET_FILL, CAVE_CRYSTAL_FILL, EXPLORER_VEST_FILL, CRYSTAL_CUFF_BAND,
 * CRYSTAL_CROWN_BAND; each 9:1 or better with ink, none red), so a worn look and its icon
 * cannot drift. Their other colours are internal details: ink at the stripe alpha, the
 * vest's belt, the cuff's gem and the crown's gold band. No look has net-like lines.
 */
import { ell, inkMany, line, seg, shape } from './canvasKit';
import { roundedPolygon, type Pt } from './drawBadges';
import {
  CHEEK_HEART_ZONE,
  FEET_ENVELOPE_FRONT,
  FEET_ENVELOPE_HALF_WIDTH,
  FOOT_BACK_U,
  GLASSES_BAND,
  GLASSES_LENSES,
  HEAD_ELLIPSE,
  SOCK_SLEEVE_OL,
  SOCK_SLEEVE_W,
  WEARABLE_SLOTS,
  axolotlBodyGeometry,
  backFootprint,
  glassesNotches,
  shirtGeometry,
  shoeRect,
  sockFootPad,
  tailSlotFrame,
  type AxolotlArtLook,
  type BackFrameBox,
  type BodyWearableSlot,
  type LegSlotFrame,
  type WearFrame,
  type WearableSlot,
} from './drawAxolotlParts';
import { INK, WHITE } from './palette';
import {
  BANDANA_FILL,
  BEE_HEADBAND_FILL,
  EMBROIDERED_SHIRT_FILL,
  EMBROIDERY_BAND,
  EMBROIDERY_PETALS,
  GARDEN_OVERALLS_FILL,
  HUMMINGBIRD_RIBBON_FILL,
  MARIGOLD_PETAL,
  MONARCH_BODY,
  MONARCH_SPOT,
  MONARCH_WING,
  SERAPE_STRIPES,
  STRAW_HAT_FILL,
  SUNFLOWER_CENTRE,
  SUNFLOWER_FRAME,
} from './drawTreasures';
import {
  BOAT_TRIM,
  BOW_FILL,
  BOW_GEM,
  CAVE_CRYSTAL_FILL,
  CRYSTAL_CROWN_BAND,
  CRYSTAL_CUFF_BAND,
  DIVING_TANK_FILL,
  DIVING_TANK_STRAP,
  DRAGONFLY_FRAME,
  DRAGONFLY_WING,
  EXPLORER_VEST_FILL,
  FLIPPER_CUFF,
  FLIPPER_FILL,
  FEATHER_CAP_FILL,
  FEATHER_FILL,
  FIREFLY_CAPE_FILL,
  FIREFLY_GLOW,
  FLIPPER_RIDGE,
  FROGGY_BOOT,
  GEM_GLINT,
  GLASSES_FRAME,
  GLASSES_GEM,
  GLASSES_LENS,
  GOLD_TRIM,
  HAT_FILL,
  LADYBUG_SHELL,
  LILY_CROWN_FLOWER,
  LILY_CROWN_LEAF,
  LILY_PAD_SOCK_FILL,
  MINERS_HELMET_FILL,
  NECKLACE_CORD,
  NECKLACE_SHELL,
  PAINT_SHELL_RIDGE,
  PEARL_CHARM_CORD,
  PEARL_FILL,
  POND_WEED_SCARF,
  RAINCOAT_FILL,
  SOCK_FILL,
  SOCK_STRIPE_ALPHA,
  TANK_TOP_FILL,
  TREASURE_SHINE,
  TREASURE_STAR,
  WATER_LILY_BLOSSOM,
  WATER_LILY_SHIRT_FILL,
  WORN_FAR_INK_MIX,
} from './treasurePalette';

// ---------------------------------------------------------------------------
// Area 4 detail colours (issue #76)
// ---------------------------------------------------------------------------

/** Garden overalls pocket patch, a clay terracotta: an internal detail colour inside the silhouette, so free. */
export const GARDEN_OVERALLS_PATCH = '#c8782c';

// ---------------------------------------------------------------------------
// Area 6 detail colours (issue #77)
// ---------------------------------------------------------------------------

/** Explorer vest belt strap, a tan leather: an internal detail colour inside the silhouette, so free. 2.5:1 against the vest. */
export const EXPLORER_VEST_BELT = '#b98a50';

// ---------------------------------------------------------------------------
// The art-level outfit
// ---------------------------------------------------------------------------

/** The art slug of each Wearable: the catalogue id text after the area (`canal/`, `pond/`, `chinampa/` or `spring-cave/`). */
export type WearableArtSlug =
  | 'sun-hat'
  | 'shell-necklace'
  | 'heart-glasses'
  | 'golden-bow'
  | 'tank-top'
  | 'diving-tank'
  | 'stripy-socks'
  | 'flippers'
  | 'lily-flower-crown'
  | 'pond-weed-scarf'
  | 'dragonfly-glasses'
  | 'raincoat'
  | 'ladybug-backpack'
  | 'rainbow-dragonfly-wings'
  | 'froggy-boots'
  | 'feather-cap'
  | 'lily-pad-socks'
  | 'water-lily-shirt'
  | 'pearl-tail-charm'
  | 'firefly-cape'
  | 'straw-sun-hat'
  | 'marigold-necklace'
  | 'garden-overalls'
  | 'monarch-hair-clip'
  | 'monarch-wings'
  | 'bee-headband'
  | 'bandana'
  | 'sunflower-sunglasses'
  | 'embroidered-shirt'
  | 'hummingbird-tail-ribbon'
  | 'rainbow-serape-cape'
  | 'miners-headlamp'
  | 'crystal-pendant'
  | 'explorer-vest'
  | 'crystal-tail-cuff'
  | 'crystal-crown';

/**
 * The slot each art slug is worn in (guide 6i). The canal's eight come first, the
 * pond's seven after them, the pond Area 3's five next, the chinampa Area 4's five and the
 * chinampa Area 5's six and the spring cave Area 6's five last, so WEARABLE_ART_SLUGS finds each slot's canal slug first.
 */
export const WEARABLE_ART_SLOT: Readonly<Record<WearableArtSlug, WearableSlot>> = {
  'sun-hat': 'head',
  'shell-necklace': 'neck',
  'heart-glasses': 'face',
  'golden-bow': 'tail',
  'tank-top': 'shirt',
  'diving-tank': 'back',
  'stripy-socks': 'socks',
  flippers: 'feet',
  'lily-flower-crown': 'head',
  'pond-weed-scarf': 'neck',
  'dragonfly-glasses': 'face',
  raincoat: 'shirt',
  'ladybug-backpack': 'back',
  'rainbow-dragonfly-wings': 'back',
  'froggy-boots': 'feet',
  'feather-cap': 'head',
  'lily-pad-socks': 'socks',
  'water-lily-shirt': 'shirt',
  'pearl-tail-charm': 'tail',
  'firefly-cape': 'back',
  'straw-sun-hat': 'head',
  'marigold-necklace': 'neck',
  'garden-overalls': 'shirt',
  'monarch-hair-clip': 'head',
  'monarch-wings': 'back',
  'bee-headband': 'head',
  bandana: 'neck',
  'sunflower-sunglasses': 'face',
  'embroidered-shirt': 'shirt',
  'hummingbird-tail-ribbon': 'tail',
  'rainbow-serape-cape': 'back',
  'miners-headlamp': 'head',
  'crystal-pendant': 'neck',
  'explorer-vest': 'shirt',
  'crystal-tail-cuff': 'tail',
  'crystal-crown': 'head',
};

/** The canal's art slug of each slot, in slot order (PRD order): one per slot, though a slot can hold more than one slug. */
export const WEARABLE_ART_SLUGS: readonly WearableArtSlug[] = WEARABLE_SLOTS.map(
  (slot) => (Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]).find((slug) => WEARABLE_ART_SLOT[slug] === slot)!,
);

/**
 * What an axolotl wears, for the painter: at most one art slug per slot. A slot
 * that is missing, null or holds a slug for another slot paints nothing.
 */
export type ArtOutfit = Readonly<Partial<Record<WearableSlot, WearableArtSlug | null>>>;

/** Nothing worn. The default for drawAxolotl, bakeAxolotlStill and the rig. */
export const NO_OUTFIT: ArtOutfit = Object.freeze({});

/** The slug worn in `slot`, or undefined when the slot is empty or holds a slug that belongs to another slot. */
export function wornSlug(outfit: ArtOutfit, slot: WearableSlot): WearableArtSlug | undefined {
  const slug = outfit[slot];
  return slug != null && WEARABLE_ART_SLOT[slug] === slot ? slug : undefined;
}

/**
 * Art outfit for the catalogue ids a scene holds, such as the logic Outfit
 * (`canal/sun-hat` in `head`). The text after the first `/` is the art slug.
 * An unknown id, or an id worn in the wrong slot, is left out.
 */
export function artOutfit(worn: Readonly<Partial<Record<WearableSlot, string | null | undefined>>>): ArtOutfit {
  const out: Partial<Record<WearableSlot, WearableArtSlug>> = {};
  for (const slot of WEARABLE_SLOTS) {
    const id = worn[slot];
    if (typeof id !== 'string') continue;
    const slug = id.slice(id.indexOf('/') + 1);
    if (Object.hasOwn(WEARABLE_ART_SLOT, slug) && WEARABLE_ART_SLOT[slug as WearableArtSlug] === slot) {
      out[slot] = slug as WearableArtSlug;
    }
  }
  return out;
}

/**
 * Stable text for an outfit, in slot order, empty for no outfit. Use it in a
 * repaint or cache key so a texture repaints only when what is worn changes.
 */
export function outfitKey(outfit: ArtOutfit): string {
  return WEARABLE_SLOTS.flatMap((slot) => {
    const slug = wornSlug(outfit, slot);
    return slug === undefined ? [] : [`${slot}=${slug}`];
  }).join(',');
}

/** Whether the outfit has an item in a leg slot (Socks or Feet). */
export function wearsOnLegs(outfit: ArtOutfit): boolean {
  return wornSlug(outfit, 'socks') !== undefined || wornSlug(outfit, 'feet') !== undefined;
}

// ---------------------------------------------------------------------------
// Ink and drawing helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

/** Wearable silhouette ink (guide 4b, `shape`; guide 6i line rules), thinned from 2.8 for #88. */
const ITEM_LW = 2;
/** Small parts inside an item: gem outline, star outline. */
const DETAIL_LW = 1.6;
/** Thin ink lines on each side of a trim band. */
const BAND_LW = 1.2;
/** Gem radius and Legendary star radius (guide 6i). */
const GEM_R = 2.5;
const STAR_R = 3;
/** Glasses band: colour 2.1 with 0.7 of ink each side, the 3.5 of GLASSES_BAND in all (guide 4b, 6i; #88). */
const GLASSES_BAND_OL = 0.7;
const GLASSES_BAND_W = GLASSES_BAND - 2 * GLASSES_BAND_OL;
/**
 * Necklace cord: colour 4.6 with 0.6 of ink each side, 5.8 in all, under the
 * chin; behind the chin, where the silhouette is shallowest (a Slim body's
 * torso meets the head), it narrows to colour 4.0, 5.2 in all (#88).
 */
const CORD_W = 4.6;
const CORD_BACK_W = 4;
const CORD_OL = 0.6;
/**
 * Flippers fan half widths, ink included, at the back edge and at u = l + 3 (#88: 8.5 and 11.0
 * before), grown with the Feet envelope's half width (FEET_ENVELOPE_HALF_WIDTH, 12 to 13.5).
 */
const FLIPPER_BACK_HALF = 9.5;
const FLIPPER_MID_HALF = 12.4;
/** Flippers ridge ends across the fan, at the 13.5 half width (#88: 6 before). */
const FLIPPER_RIDGE_V = 6.75;

/** Colour of a nearer or farther item: far-leg items are mixed toward ink (guide 6a). */
type Tone = (colour: string) => string;
const NEAR_TONE: Tone = (colour) => colour;
const FAR_TONE: Tone = (colour) => mixToward(colour, INK, WORN_FAR_INK_MIX);

/** `colour` mixed `amount` of the way toward `toward`; both `#rrggbb`. Any other text is returned as is. */
function mixToward(colour: string, toward: string, amount: number): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
  const a = hex.exec(colour);
  const b = hex.exec(toward);
  if (!a || !b) return colour;
  const channel = (i: number): string => {
    const from = parseInt(a[i], 16);
    const to = parseInt(b[i], 16);
    return Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(2)}${channel(3)}`;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  ell(p, cx, cy, rx, ry, rot);
  return p;
}

/** Rounded rectangle from (x0, y0) to (x1, y1); `r` must not exceed half of either side. */
function roundRectPath(x0: number, y0: number, x1: number, y1: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.arc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
  p.lineTo(x1, y1 - r);
  p.arc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  p.lineTo(x0 + r, y1);
  p.arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  p.lineTo(x0, y0 + r);
  p.arc(x0 + r, y0 + r, r, Math.PI, (3 * Math.PI) / 2);
  p.closePath();
  return p;
}

function rectPath(x0: number, y0: number, x1: number, y1: number): Path2D {
  const p = new Path2D();
  p.moveTo(x0, y0);
  p.lineTo(x1, y0);
  p.lineTo(x1, y1);
  p.lineTo(x0, y1);
  p.closePath();
  return p;
}

/** The one white shine of an item. */
function shine(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.fillStyle = TREASURE_SHINE;
  ctx.fill(ellipsePath(x, y, rx, ry, rot));
}

/**
 * One `blob` of several paths: every ink stroke (2 x ITEM_LW, so ITEM_LW shows
 * outside the fills) before every fill, so the paths merge into one silhouette
 * with no ink across a joint.
 */
function blobs(ctx: CanvasRenderingContext2D, paths: readonly Path2D[], fill: string): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * ITEM_LW;
  for (const path of paths) ctx.stroke(path);
  ctx.fillStyle = fill;
  for (const path of paths) ctx.fill(path);
}

/**
 * One silhouette of several parts, each its own fill: every ink stroke (2 x `ol`,
 * so `ol` shows outside the fills) before every fill, so the parts merge into one
 * silhouette with no ink across a joint. The pond Wearables use it where parts
 * differ in colour (the crown's leaves and blooms, the Ladybug's shell and head).
 */
interface SilhouettePart {
  readonly path: Path2D;
  readonly fill: string;
}
function silhouette(ctx: CanvasRenderingContext2D, parts: readonly SilhouettePart[], ol = ITEM_LW): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * ol;
  for (const part of parts) ctx.stroke(part.path);
  for (const part of parts) {
    ctx.fillStyle = part.fill;
    ctx.fill(part.path);
  }
}

/** A pointed leaf: tips `half` either side of (cx, cy) along its axis, `wide` across at the middle, the axis turned by `rot`. */
function leafPath(cx: number, cy: number, half: number, wide: number, rot: number): Path2D {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const at = (u: number, v: number): Pt => ({ x: cx + u * c - v * s, y: cy + u * s + v * c });
  const tipA = at(-half, 0);
  const tipB = at(half, 0);
  const up = at(0, -2 * wide);
  const down = at(0, 2 * wide);
  const p = new Path2D();
  p.moveTo(tipA.x, tipA.y);
  p.quadraticCurveTo(up.x, up.y, tipB.x, tipB.y);
  p.quadraticCurveTo(down.x, down.y, tipA.x, tipA.y);
  p.closePath();
  return p;
}

/** A round gem of radius 2.5 with a small glint. `ink` is the outline width. */
function gem(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, ink = DETAIL_LW): void {
  shape(ctx, ellipsePath(x, y, GEM_R, GEM_R), fill, ink);
  ctx.fillStyle = GEM_GLINT;
  ctx.fill(ellipsePath(x - 0.8, y - 0.9, 0.8, 0.5, -0.7));
}

/** The Legendary static 4-point star (guide 4e): outer R 3, inner 0.38 R, white with ink 1.6 unless `ink` says otherwise. */
function legendStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink = DETAIL_LW): void {
  const p = new Path2D();
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 4;
    const r = k % 2 === 0 ? STAR_R : STAR_R * 0.38;
    if (k === 0) p.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else p.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  p.closePath();
  shape(ctx, p, TREASURE_STAR, ink);
}

/**
 * Fill a silhouette, paint `inner` clipped to it, then stroke the ink on top so
 * inner details never hide the outline (a `shape`).
 */
function inkedShape(ctx: CanvasRenderingContext2D, body: Path2D, fill: string, inner?: () => void): void {
  ctx.fillStyle = fill;
  ctx.fill(body);
  if (inner) {
    ctx.save();
    ctx.clip(body);
    inner();
    ctx.restore();
  }
  ctx.lineWidth = ITEM_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(body);
}

/**
 * One trim band: a coloured strip between two thin ink lines, drawn inside the
 * caller's clip. `horizontal` bands run along x between y0 and y1; the others
 * run along y between x0 and x1. `lines` picks which of the two ink lines show.
 */
function trimBand(
  ctx: CanvasRenderingContext2D,
  box: { x0: number; y0: number; x1: number; y1: number },
  colour: string,
  horizontal: boolean,
  lineWidth = BAND_LW,
  lines: readonly [boolean, boolean] = [true, true],
): void {
  ctx.fillStyle = colour;
  ctx.fill(rectPath(box.x0, box.y0, box.x1, box.y1));
  ctx.strokeStyle = INK;
  ctx.lineWidth = lineWidth;
  const edges = horizontal
    ? [line(box.x0, box.y0, box.x1, box.y0), line(box.x0, box.y1, box.x1, box.y1)]
    : [line(box.x0, box.y0, box.x0, box.y1), line(box.x1, box.y0, box.x1, box.y1)];
  edges.forEach((edge, i) => {
    if (lines[i]) ctx.stroke(edge);
  });
}

// ---------------------------------------------------------------------------
// Head: Sun hat (Common)
// ---------------------------------------------------------------------------

/**
 * Common: a wide brim ellipse and a domed crown merged into one `blob`, so the
 * hat is one colour mass with its ink all outside; one shine, no trim. Ink
 * included it fills HEAD_FOOTPRINT: x 16 to 46, lowest ink y -19.5 on the head
 * top, crown top y -41.4. The brim tilts up toward the snout, keeping 1.8 or
 * more over the glasses band and gem, reaches forward past the head outline,
 * and the crown rises above it, as the Head item may (#88).
 */
function paintSunHat(ctx: CanvasRenderingContext2D): void {
  const brim = ellipsePath(31, -25.18, 13, 3.6, -0.06);
  const crown = new Path2D();
  crown.moveTo(24, -25.6);
  crown.bezierCurveTo(23.4, -32.8, 26, -39.4, 30.8, -39.4);
  crown.bezierCurveTo(35.6, -39.4, 38.2, -32.8, 37.6, -25.6);
  crown.closePath();
  blobs(ctx, [brim, crown], HAT_FILL);
  shine(ctx, 27.2, -33.2, 1.1, 3, 0.2);
}

// ---------------------------------------------------------------------------
// Head: Lily flower crown (Common)
// ---------------------------------------------------------------------------

/** The crown's wreath line: leaf centres follow it, rising toward the snout as the Sun hat's brim does (y at x 31, slope). */
const CROWN_LINE_Y = -25.4;
const CROWN_LINE_SLOPE = -0.06;
/** The five wreath leaves: first and last centre along x, and each leaf's half length, half width and alternate tilt. */
const CROWN_LEAF_X0 = 22.2;
const CROWN_LEAF_X1 = 39.8;
const CROWN_LEAF_COUNT = 5;
const CROWN_LEAF_HALF = 4.2;
const CROWN_LEAF_WIDE = 2.5;
const CROWN_LEAF_TILT = 0.32;
/** The three blooms' centres: back, top and front. */
const CROWN_BLOOMS: readonly Pt[] = [
  { x: 26.2, y: -30.4 },
  { x: 32.4, y: -33 },
  { x: 38.2, y: -29.8 },
];
/** A bloom is five petals round its centre: each petal centred this far out, with these radii (along and across it). */
const BLOOM_PETAL_OUT = 3.1;
const BLOOM_PETAL_RX = 2.5;
const BLOOM_PETAL_RY = 1.9;
/** The dark bloom centre (ink at the stripe alpha, the same colour darkened, not a second colour). */
const BLOOM_CENTRE_R = 1.2;

/**
 * Common (issue #75): a wreath of five lily leaves (#a2f58c) along a line that
 * rises toward the snout, with three blooms (#ffe0ee, five merged petals each)
 * standing on it, all one `blob` silhouette (ink 2.0 all outside, no ink across a
 * joint). The blooms are the crown's rise, the leaves its width. Each bloom has a
 * dark centre (ink at alpha 0.30) and one shine sits on the first leaf; no trim.
 * Ink included it fills HEAD_FOOTPRINT, clear of the gill stems (x 16 or more),
 * the lash reach circles and the cheek heart; the wreath rests on the head top
 * with its lowest fill point inside the head outline.
 */
function paintLilyCrown(ctx: CanvasRenderingContext2D): void {
  const leaves = Array.from({ length: CROWN_LEAF_COUNT }, (_, i) => {
    const x = CROWN_LEAF_X0 + ((CROWN_LEAF_X1 - CROWN_LEAF_X0) * i) / (CROWN_LEAF_COUNT - 1);
    const tilt = (i % 2 === 0 ? 1 : -1) * CROWN_LEAF_TILT + CROWN_LINE_SLOPE;
    return leafPath(x, CROWN_LINE_Y + CROWN_LINE_SLOPE * (x - 31), CROWN_LEAF_HALF, CROWN_LEAF_WIDE, tilt);
  });
  const petals = CROWN_BLOOMS.flatMap((bloom) =>
    Array.from({ length: 5 }, (_, k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      return ellipsePath(bloom.x + Math.cos(a) * BLOOM_PETAL_OUT, bloom.y + Math.sin(a) * BLOOM_PETAL_OUT, BLOOM_PETAL_RX, BLOOM_PETAL_RY, a);
    }),
  );
  silhouette(ctx, [
    ...leaves.map((path) => ({ path, fill: LILY_CROWN_LEAF })),
    ...petals.map((path) => ({ path, fill: LILY_CROWN_FLOWER })),
  ]);
  ctx.save();
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  for (const bloom of CROWN_BLOOMS) ctx.fill(ellipsePath(bloom.x, bloom.y, BLOOM_CENTRE_R, BLOOM_CENTRE_R));
  ctx.restore();
  shine(ctx, CROWN_LEAF_X0 + 0.2, CROWN_LINE_Y + CROWN_LINE_SLOPE * (CROWN_LEAF_X0 - 31) - 0.3, 1.6, 0.6, -0.2);
}

// ---------------------------------------------------------------------------
// Head: Feather cap (Common)
// ---------------------------------------------------------------------------

/** The cap's cuff, fill: x and y edges and corner radius. Ink included it reaches x 16.2 and the head-top limit y -19.6. */
const CAP_CUFF = { x0: 18.2, x1: 40.2, y0: -27.2, y1: -21.6, r: 2.4 } as const;
/** The plume: its base on the cuff's front, its tip up and forward, and half its width. */
const PLUME_BASE: Pt = { x: 36, y: -26.4 };
const PLUME_TIP: Pt = { x: 43.4, y: -40.2 };
const PLUME_WIDE = 3.1;
/** How far along the plume's axis, from the base, the quill runs. */
const QUILL_REACH = 0.88;

/**
 * Common (issue #98): a #c4e6ff beanie, a domed crown over a rolled cuff, with a
 * pale #dde8ff feather plume tucked into the front of the cuff and sweeping up and
 * forward past the dome. Crown, cuff and plume are one `blob` silhouette (ink 2.0
 * all outside, no ink across a joint); the plume is painted last, over the crown,
 * so it reads as tucked in front: a thin ink line (1.2) marks the cuff's top edge
 * and the plume's edge where it lies over the cap, and a quill line runs down the
 * plume. One shine on the crown; no trim. Ink included it fills HEAD_FOOTPRINT: x
 * 16.2 to about 45.5, lowest ink y -19.6, the plume tip about y -42.2. The cuff
 * rests on the head top, far from the gill stems (x 16 or more), the lash reach
 * circles and the cheek heart.
 */
function paintFeatherCap(ctx: CanvasRenderingContext2D): void {
  const dome = new Path2D();
  dome.moveTo(19.6, -24.6);
  dome.bezierCurveTo(19.2, -33, 23.4, -37.4, 29.2, -37.4);
  dome.bezierCurveTo(35, -37.4, 38.8, -33, 38.4, -24.6);
  dome.closePath();
  const cuff = roundRectPath(CAP_CUFF.x0, CAP_CUFF.y0, CAP_CUFF.x1, CAP_CUFF.y1, CAP_CUFF.r);
  const dx = PLUME_TIP.x - PLUME_BASE.x;
  const dy = PLUME_TIP.y - PLUME_BASE.y;
  const plume = leafPath(PLUME_BASE.x + dx / 2, PLUME_BASE.y + dy / 2, Math.hypot(dx, dy) / 2, PLUME_WIDE, Math.atan2(dy, dx));
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * ITEM_LW;
  for (const path of [dome, cuff, plume]) ctx.stroke(path);
  ctx.fillStyle = FEATHER_CAP_FILL;
  ctx.fill(dome);
  ctx.fill(cuff);
  ctx.lineWidth = BAND_LW;
  ctx.stroke(line(CAP_CUFF.x0 + 1.2, CAP_CUFF.y0, CAP_CUFF.x1 - 1.2, CAP_CUFF.y0));
  ctx.fillStyle = FEATHER_FILL;
  ctx.fill(plume);
  for (const under of [dome, cuff]) {
    ctx.save();
    ctx.clip(under);
    ctx.stroke(plume);
    ctx.restore();
  }
  ctx.stroke(line(PLUME_BASE.x, PLUME_BASE.y, PLUME_BASE.x + dx * QUILL_REACH, PLUME_BASE.y + dy * QUILL_REACH));
  shine(ctx, 24.2, -31.6, 1, 2.6, 0.3);
}

// ---------------------------------------------------------------------------
// Neck: Shell necklace (Rare)
// ---------------------------------------------------------------------------

/**
 * The cord's centre line runs this far inside the chin (the head outline, along
 * its normal), so its ink ends LW / 2 or more inside the outline's outer edge.
 */
const CORD_CHIN_INSET = 1.25;
/** Behind the chin the cord runs level at this y: its narrow ink keeps 0.25 below the gill-root zone. */
const CORD_BACK_Y = 15.85;
/**
 * The cord's ends along x, where the narrow back part meets the full cord, and
 * the ellipse angle step (radians) its centre line is sampled at.
 */
const CORD_X0 = 4.6;
const CORD_JOIN_X = 12.5;
const CORD_X1 = 39;
const CORD_STEP = 0.02;
/** Shell ink: the shells and the cord share one silhouette, with this much ink outside each shell's fill. */
const SHELL_OL = 0.6;
/** The shell rim just inside each shell's edge, in the ridge colour. */
const SHELL_RIM_LW = 0.8;

/** A scallop shell hanging from the cord: hinge at (hx, hy), opening downward `half` either side, radius r. */
interface NecklaceShell {
  readonly hx: number;
  readonly hy: number;
  readonly r: number;
  readonly half: number;
}

/**
 * The four shells, back to front: one behind the chin, one under the cheek
 * heart, the largest under the mouth corner, and one under the mouth. Each
 * spans most of the cord's height and stays clear of the gill-root and cheek
 * heart zones.
 */
const NECKLACE_SHELLS: readonly NecklaceShell[] = [
  { hx: 7, hy: 13.75, r: 4.7, half: 1 },
  { hx: 16.8, hy: 15.75, r: 4.8, half: 0.9 },
  { hx: 27, hy: 13.7, r: 8.3, half: 0.85 },
  { hx: 37, hy: 14.8, r: 4.6, half: 1 },
];

/** The point CORD_CHIN_INSET inside the head outline at ellipse angle t, along the outline's normal. */
function chinInsetPoint(t: number): Pt {
  const { cx, cy, rx, ry } = HEAD_ELLIPSE;
  const nx = Math.cos(t) / rx;
  const ny = Math.sin(t) / ry;
  const n = Math.hypot(nx, ny);
  return { x: cx + rx * Math.cos(t) - (CORD_CHIN_INSET * nx) / n, y: cy + ry * Math.sin(t) - (CORD_CHIN_INSET * ny) / n };
}

/** The ellipse angle in (0, pi) of the chin inset point at `x`: x falls as t grows. */
function chinInsetAngleAt(x: number): number {
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (chinInsetPoint(mid).x > x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The cord's centre line from x0 to x1: level at CORD_BACK_Y behind the chin,
 * then CORD_CHIN_INSET inside the head's lower outline.
 */
function necklaceCordPath(x0: number, x1: number): Path2D {
  const t0 = chinInsetAngleAt(x0);
  const t1 = chinInsetAngleAt(x1);
  const steps = Math.max(1, Math.ceil((t0 - t1) / CORD_STEP));
  const cord = new Path2D();
  for (let i = 0; i <= steps; i++) {
    const p = chinInsetPoint(t0 + ((t1 - t0) * i) / steps);
    if (i === 0) cord.moveTo(p.x, Math.max(CORD_BACK_Y, p.y));
    else cord.lineTo(p.x, Math.max(CORD_BACK_Y, p.y));
  }
  return cord;
}

/** A shell's fan: hinge, then the arc of radius r across the bottom. */
function necklaceShellPath(shell: NecklaceShell): Path2D {
  const fan = new Path2D();
  fan.moveTo(shell.hx, shell.hy);
  fan.arc(shell.hx, shell.hy, shell.r, Math.PI / 2 - shell.half, Math.PI / 2 + shell.half);
  fan.closePath();
  return fan;
}

/**
 * A shell's rim and ridges, in the shell ridge colour (a detail colour, not
 * ink): the rim, clipped inside the fan, marks it off the cord, and five ridges
 * fan from the hinge.
 */
function paintShellRidges(ctx: CanvasRenderingContext2D, shell: NecklaceShell, fan: Path2D): void {
  const ridges = new Path2D();
  for (const k of [-0.66, -0.33, 0, 0.33, 0.66]) {
    const a = Math.PI / 2 + k * shell.half;
    ridges.moveTo(shell.hx + Math.cos(a) * shell.r * 0.3, shell.hy + Math.sin(a) * shell.r * 0.3);
    ridges.lineTo(shell.hx + Math.cos(a) * shell.r * 0.82, shell.hy + Math.sin(a) * shell.r * 0.82);
  }
  ctx.strokeStyle = PAINT_SHELL_RIDGE;
  ctx.save();
  ctx.clip(fan);
  ctx.lineWidth = 2 * SHELL_RIM_LW;
  ctx.stroke(fan);
  ctx.restore();
  ctx.lineWidth = BAND_LW;
  ctx.stroke(ridges);
}

/**
 * Rare: a thick cord (the second colour, the Rare detail) following the chin
 * curve, with four big scallop shells on it, the largest in front. Cord and
 * shells are one silhouette: every ink stroke first, then the cord colour and
 * the shell fills, so the ink shows only round the outside and the necklace is
 * one strong colour mass. All of it sits in NECK_FOOTPRINT, clear of the gill-
 * root and cheek heart zones, and LW / 2 or more inside the outer edge of the
 * silhouette outline on every look (#88). The mouth paints over its front.
 */
function paintShellNecklace(ctx: CanvasRenderingContext2D): void {
  const cords = [
    seg(necklaceCordPath(CORD_X0, CORD_JOIN_X), CORD_BACK_W, NECKLACE_CORD, CORD_OL),
    seg(necklaceCordPath(CORD_JOIN_X, CORD_X1), CORD_W, NECKLACE_CORD, CORD_OL),
  ];
  const shells = NECKLACE_SHELLS.map(necklaceShellPath);
  ctx.strokeStyle = INK;
  for (const cord of cords) {
    ctx.lineWidth = cord.w + 2 * cord.ol;
    ctx.stroke(cord.p);
  }
  ctx.lineWidth = 2 * SHELL_OL;
  for (const shell of shells) ctx.stroke(shell);
  ctx.strokeStyle = NECKLACE_CORD;
  for (const cord of cords) {
    ctx.lineWidth = cord.w;
    ctx.stroke(cord.p);
  }
  NECKLACE_SHELLS.forEach((shell, i) => {
    ctx.fillStyle = NECKLACE_SHELL;
    ctx.fill(shells[i]);
    paintShellRidges(ctx, shell, shells[i]);
  });
}

// ---------------------------------------------------------------------------
// Neck: Pond-weed scarf (Common)
// ---------------------------------------------------------------------------

/** The scarf's ends along x (fill), the round ends included. */
const SCARF_X0 = 3.6;
const SCARF_X1 = 40.6;
/** Scarf ink: 0.6 outside the fill all round, as the Shell necklace cord's (the Neck footprint is too shallow for 2.0). */
const SCARF_OL = 0.6;
/**
 * How far the scarf's lower fill edge runs outside the lower edge of the head outline, or of the
 * smallest torso outline (a Slim Grown-up's) behind the chin. Its ink then ends 0.15 inside the
 * outer edge of the silhouette outline, LW / 2 (1.75) outside the ellipse: 1.0 + SCARF_OL + 0.15.
 */
const SCARF_OUT = 1;
/** The smallest torso (Slim Grown-up: cx -10, cy 4, rx 39, ry 15) that the scarf must stay inside on every look. */
const SCARF_TORSO_MIN = { cx: -10, cy: 4, rx: 39, ry: 15 };
/** The scarf's upper fill edge never rises above this y: the gill-root zone's lower edge (13), the ink and a gap of 0.15. */
const SCARF_TOP_FLOOR = 13.75;
/** Gap, past the ink, the scarf keeps from the cheek heart zone. */
const SCARF_HEART_GAP = 0.3;
/** The wraps: ink ticks across the band (the same colour darkened, ink at the stripe alpha), at these x, leaning 1.8 along. */
const SCARF_WRAPS: readonly number[] = [8.5, 27, 35];
const SCARF_WRAP_LEAN = 1.8;

/** y of the head outline's lower edge at x. */
function headBottomAt(x: number): number {
  const { cx, cy, rx, ry } = HEAD_ELLIPSE;
  return cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
}

function scarfLowerAt(x: number): number {
  const t = SCARF_TORSO_MIN;
  const torso = t.cy + t.ry * Math.sqrt(Math.max(0, 1 - ((x - t.cx) / t.rx) ** 2));
  return Math.max(headBottomAt(x), torso) + SCARF_OUT;
}

function scarfUpperAt(x: number): number {
  let y = SCARF_TOP_FLOOR;
  const dx = x - CHEEK_HEART_ZONE.x;
  if (Math.abs(dx) < CHEEK_HEART_ZONE.r) {
    y = Math.max(y, CHEEK_HEART_ZONE.y + Math.sqrt(CHEEK_HEART_ZONE.r ** 2 - dx ** 2) + SCARF_OL + SCARF_HEART_GAP);
  }
  return y;
}

/**
 * The scarf band as one closed path: its upper edge from the rear to the front, a
 * round end at the front, its lower edge back, and a round end at the rear. Each end
 * is a half circle as high as the band there, so the band's fill still spans
 * SCARF_X0 to SCARF_X1.
 */
function scarfBandPath(): Path2D {
  const heightAt = (x: number): number => scarfLowerAt(x) - scarfUpperAt(x);
  const rearR = heightAt(SCARF_X0 + 2.2) / 2;
  const frontR = heightAt(SCARF_X1 - 3.5) / 2;
  const xa = SCARF_X0 + rearR;
  const xb = SCARF_X1 - frontR;
  const steps = Math.round((xb - xa) / 0.5);
  const xs = Array.from({ length: steps + 1 }, (_, i) => xa + ((xb - xa) * i) / steps);
  const band = new Path2D();
  xs.forEach((x, i) => (i === 0 ? band.moveTo(x, scarfUpperAt(x)) : band.lineTo(x, scarfUpperAt(x))));
  band.arc(xb, (scarfUpperAt(xb) + scarfLowerAt(xb)) / 2, heightAt(xb) / 2, -Math.PI / 2, Math.PI / 2);
  for (let i = steps; i >= 0; i--) band.lineTo(xs[i], scarfLowerAt(xs[i]));
  band.arc(xa, (scarfUpperAt(xa) + scarfLowerAt(xa)) / 2, heightAt(xa) / 2, Math.PI / 2, (3 * Math.PI) / 2);
  band.closePath();
  return band;
}

/**
 * Common (issue #75): a #b5ec6c scarf wound under the chin and round the back of
 * the neck, one `blob` silhouette with ink 0.6 outside the fill (as the Shell
 * necklace cord's: the Neck footprint is too shallow for 2.0). Its lower edge
 * follows the head outline (behind the chin, the smallest torso's) 1.0 outside it,
 * so its ink stays LW / 2 or more inside the outer edge of the silhouette outline
 * on every look and nothing hangs below it; its upper edge is the footprint's top,
 * dipping under the cheek heart zone. It is thickest toward the mouth, where the
 * mouth paints over it. Three wraps (ink at alpha 0.30) and one shine; no trim.
 */
function paintPondWeedScarf(ctx: CanvasRenderingContext2D): void {
  silhouette(ctx, [{ path: scarfBandPath(), fill: POND_WEED_SCARF }], SCARF_OL);
  const wraps = new Path2D();
  for (const x of SCARF_WRAPS) {
    wraps.moveTo(x, scarfUpperAt(x) + 0.6);
    wraps.lineTo(x + SCARF_WRAP_LEAN, scarfLowerAt(x + SCARF_WRAP_LEAN) - 0.6);
  }
  ctx.save();
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.strokeStyle = INK;
  ctx.lineWidth = BAND_LW;
  ctx.stroke(wraps);
  ctx.restore();
  shine(ctx, 14.5, 16.4, 2, 0.6);
}

// ---------------------------------------------------------------------------
// Face: Heart glasses (Epic)
// ---------------------------------------------------------------------------

/** Angle of `p` about the centre of lens `c`. */
function lensAngle(c: { x: number; y: number }, p: { x: number; y: number }): number {
  return Math.atan2(p.y - c.y, p.x - c.x);
}

/** The glasses' merged outline: each lens circle less the part inside the other, one closed path. */
function glassesPath(): Path2D {
  const [top, under] = glassesNotches();
  const [near, far] = GLASSES_LENSES;
  const p = new Path2D();
  p.arc(near.x, near.y, near.r, lensAngle(near, top), lensAngle(near, under), true);
  p.arc(far.x, far.y, far.r, lensAngle(far, under), lensAngle(far, top), true);
  p.closePath();
  return p;
}

/**
 * Epic: the glasses construction (guide 6i): one merged frame of two lens
 * circles, drawn as one outline with no inner seam, band 3.5 (colour 2.1, ink
 * 0.7 each side: #88 thins the guide's 1.0 so the band shows more colour, as
 * its inner edge sits on the eye zones and its outer edge keeps 1.8 under the
 * Head item and 0.7 from the mouth, so it cannot widen), a clear lens tint
 * (white at 0.25), one gem at the bridge. The
 * eyes paint above it, so beads, glints and a Girl's lashes always show. The
 * bridge gem sits above the top notch, the only place a radius 2.5 gem clears
 * both eye zones and stays inside the Face footprint (y -18); its outline is
 * the thin band ink (1.2).
 */
function paintHeartGlasses(ctx: CanvasRenderingContext2D): void {
  const frame = glassesPath();
  ctx.fillStyle = GLASSES_LENS;
  ctx.fill(frame);
  inkMany(ctx, [seg(frame, GLASSES_BAND_W, GLASSES_FRAME, GLASSES_BAND_OL)]);
  gem(ctx, 35.25, -14.85, GLASSES_GEM, BAND_LW);
}

// ---------------------------------------------------------------------------
// Face: Dragonfly glasses (Rare)
// ---------------------------------------------------------------------------

/** The dragonfly on the bridge: each wing's centre (back, front), radii and tilt, over the top notch of the frame. */
const DRAGONFLY_WINGS: readonly { readonly x: number; readonly y: number; readonly rot: number }[] = [
  { x: 33, y: -16, rot: 0.35 },
  { x: 37.6, y: -16, rot: -0.35 },
];
const DRAGONFLY_WING_RX = 2.6;
const DRAGONFLY_WING_RY = 1.1;
/** The dragonfly's body: a short ink bar down the bridge, from y -17 to the top notch. */
const DRAGONFLY_BODY_TOP = -17;

/**
 * Rare (issue #75): the glasses construction (guide 6i) in pale aqua #8fe8ff: the
 * same merged two-lens frame with a band of 3.5 (colour 2.1, ink 0.7 each side), a
 * clear lens tint (white at 0.25) and the eyes painting above it. Its one trim is a
 * dragonfly perched on the bridge, above the top notch, in the one place that
 * clears both eye zones and stays in the Face footprint: two wings in the pale sky
 * film #d9f3ff (`shape`, ink 1.2) and a short ink body. No gem (that is the Heart
 * glasses' Epic detail).
 */
function paintDragonflyGlasses(ctx: CanvasRenderingContext2D): void {
  const frame = glassesPath();
  ctx.fillStyle = GLASSES_LENS;
  ctx.fill(frame);
  inkMany(ctx, [seg(frame, GLASSES_BAND_W, DRAGONFLY_FRAME, GLASSES_BAND_OL)]);
  const [top] = glassesNotches();
  ctx.strokeStyle = INK;
  ctx.lineWidth = BAND_LW;
  ctx.stroke(line(top.x, DRAGONFLY_BODY_TOP, top.x, top.y));
  for (const wing of DRAGONFLY_WINGS) {
    shape(ctx, ellipsePath(wing.x, wing.y, DRAGONFLY_WING_RX, DRAGONFLY_WING_RY, wing.rot), DRAGONFLY_WING, BAND_LW);
  }
}

// ---------------------------------------------------------------------------
// Tail: Golden bow (Legendary)
// ---------------------------------------------------------------------------

/** Scale of a piece of the 7e bow icon on the tail: along it (x') and across it (y'). */
interface BowScale {
  readonly x: number;
  readonly y: number;
}
/**
 * #88 grows the 7e icon (0.75 of it before) taller, not wider: the loops stand
 * 1.6 of the icon up off the tail. The ribbon tail toward the tail tip is short
 * (0.9 across), so a Dream marker star past it stays clear at every swim phase;
 * the one toward the head hangs longer (1.4 across), where no marker is.
 */
const BOW_LOOP_SCALE: BowScale = { x: 0.8, y: 1.6 };
const BOW_TIP_TAIL_SCALE: BowScale = { x: 0.75, y: 0.9 };
const BOW_HEAD_TAIL_SCALE: BowScale = { x: 0.8, y: 1.4 };
/** How far the bow centre sits into the tail core (frame y'). */
const BOW_DROP = 0.9;
/** The knot's radii. */
const KNOT_RX = 3;
const KNOT_RY = 3.2;
/** The bow's trim bands' ink lines, and the gem's and star's outlines: thin, so the bow's own ink hides little of it (#88). */
const BOW_BAND_LW = 0.6;
const BOW_DETAIL_LW = 1.2;
/** The 7e icon's bands: across the ribbon tails at icon y 6.4 to 9.2, and up each loop at icon x 5.6 to 8.4. */
const BOW_TAIL_BAND_Y: readonly [number, number] = [6.4, 9.2];
const BOW_LOOP_BAND_X: readonly [number, number] = [5.6, 8.4];

/** Icon points `xy` (x, y pairs) placed in the Tail frame at `scale`, the icon centre BOW_DROP into the core. */
function bowPoints(xy: readonly number[], scale: BowScale): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i] * scale.x, y: xy[i + 1] * scale.y + BOW_DROP });
  return out;
}

/**
 * Legendary: one merged `blob` silhouette (ink 2.0 outside the fill) of two
 * loops, two ribbon tails and a knot, #ffd9e6, with #ffc12e bands on the
 * ribbon tails and the loops, one gem on the knot and one static 4-point star
 * above it. Painted in the Tail frame (x' along the local tail direction toward
 * the head, y' down); everything, ink included, stays within TAIL_SLOT_REACH of
 * the anchor, and the bow is no more than 11 either side of it along the tail.
 */
function paintGoldenBow(ctx: CanvasRenderingContext2D): void {
  const mirror = (xy: readonly number[]): number[] => xy.map((v, i) => (i % 2 === 0 ? -v : v));
  const tailL = [-1.2, 1.2, -10.2, 7.2, -6.4, 10.6, 1.2, 4.6];
  const loopL = [-1, -1.6, -10.8, -8.2, -10.9, 2.6, -1, 0.4];
  interface Piece {
    readonly path: Path2D;
    readonly inner?: () => void;
  }
  const pieces: Piece[] = [];
  for (const [xy, scale] of [
    [tailL, BOW_TIP_TAIL_SCALE],
    [mirror(tailL), BOW_HEAD_TAIL_SCALE],
  ] as const) {
    const [y0, y1] = BOW_TAIL_BAND_Y.map((y) => y * scale.y + BOW_DROP);
    pieces.push({
      path: roundedPolygon(
        bowPoints(xy, scale),
        [1, 2.2, 2.2, 1].map((r) => r * scale.x),
      ),
      inner: () => trimBand(ctx, { x0: -12, x1: 12, y0, y1 }, GOLD_TRIM, true, BOW_BAND_LW),
    });
  }
  const [bandX0, bandX1] = BOW_LOOP_BAND_X.map((x) => x * BOW_LOOP_SCALE.x);
  for (const [x0, x1, xy] of [
    [-bandX1, -bandX0, loopL],
    [bandX0, bandX1, mirror(loopL)],
  ] as const) {
    pieces.push({
      path: roundedPolygon(
        bowPoints(xy, BOW_LOOP_SCALE),
        [1.2, 3.6, 3.6, 1.2].map((r) => r * BOW_LOOP_SCALE.x),
      ),
      inner: () => trimBand(ctx, { x0, x1, y0: -20, y1: 20 }, GOLD_TRIM, false, BOW_BAND_LW),
    });
  }
  const knotY = -0.4 * BOW_LOOP_SCALE.y + BOW_DROP;
  pieces.push({ path: ellipsePath(0, knotY, KNOT_RX, KNOT_RY) });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * ITEM_LW;
  for (const piece of pieces) ctx.stroke(piece.path);
  for (const piece of pieces) {
    ctx.fillStyle = BOW_FILL;
    ctx.fill(piece.path);
    if (piece.inner) {
      ctx.save();
      ctx.clip(piece.path);
      piece.inner();
      ctx.restore();
    }
  }
  gem(ctx, 0, knotY, BOW_GEM, BOW_DETAIL_LW);
  legendStar(ctx, 0, knotY - KNOT_RY - STAR_R, BOW_DETAIL_LW);
}

// ---------------------------------------------------------------------------
// Tail: Pearl tail charm (Epic)
// ---------------------------------------------------------------------------

/** The pearl: centre and radius in the Tail frame (y' + into the core), the centre a little into the core as the bow's knot is. */
const PEARL_CENTRE: Pt = { x: 0, y: 1.8 };
const PEARL_R = 6.4;
/** The chain from the pearl up to the gem: half width, and its top and bottom y'. */
const CHAIN_HALF = 1.2;
const CHAIN_TOP = -10.4;
const CHAIN_BOTTOM = -3.4;
/** The gem sits on the chain's top. */
const CHARM_GEM_Y = -11.4;
/** The two ribbon tails hang from the pearl: tip-side (toward the tail tip, x' negative) shorter, head-side longer. */
const CHARM_RIBBON_TIP: readonly number[] = [-1.6, 2.6, -7.6, 5.4, -5.8, 9.6, -0.6, 5.4];
const CHARM_RIBBON_HEAD: readonly number[] = [1.6, 2.6, 10.2, 5.4, 8.4, 10.2, 0.6, 5.4];

/**
 * Epic (issue #98): a big #fbe6f2 pearl on a short soft pink chain under one aqua
 * gem (radius 2.5, the Epic detail), with two soft pink ribbon tails hanging from
 * the pearl, one merged `blob` silhouette (ink 2.0 all outside the fill). A thin ink
 * ring (1.2) round the pearl sets it off the ribbons, one shine sits on the pearl;
 * no trim. Painted in the Tail frame (x' along the local tail direction toward
 * the head, y' down): the gem and chain stand above the tail's top edge, the pearl
 * rests on it and the ribbons hang over the core. The tip-side ribbon is short, as
 * the Golden bow's, so a Dream marker star past it stays clear at every swim phase.
 * Everything, ink included, stays within TAIL_SLOT_REACH of the anchor.
 */
function paintPearlTailCharm(ctx: CanvasRenderingContext2D): void {
  const toPts = (xy: readonly number[]): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] });
    return out;
  };
  const pearl = ellipsePath(PEARL_CENTRE.x, PEARL_CENTRE.y, PEARL_R, PEARL_R);
  silhouette(ctx, [
    { path: roundedPolygon(toPts(CHARM_RIBBON_TIP), [0.8, 2, 2, 0.8]), fill: PEARL_CHARM_CORD },
    { path: roundedPolygon(toPts(CHARM_RIBBON_HEAD), [0.8, 2, 2, 0.8]), fill: PEARL_CHARM_CORD },
    {
      path: roundedPolygon(toPts([-CHAIN_HALF, CHAIN_TOP, CHAIN_HALF, CHAIN_TOP, CHAIN_HALF, CHAIN_BOTTOM, -CHAIN_HALF, CHAIN_BOTTOM]), 0.6),
      fill: PEARL_CHARM_CORD,
    },
    { path: pearl, fill: PEARL_FILL },
  ]);
  ctx.strokeStyle = INK;
  ctx.lineWidth = BAND_LW;
  ctx.stroke(pearl);
  shine(ctx, PEARL_CENTRE.x - 2.4, PEARL_CENTRE.y - 2.4, 1, 2, 0.5);
  gem(ctx, 0, CHARM_GEM_Y, GLASSES_GEM, BAND_LW);
}

// ---------------------------------------------------------------------------
// Shirt: Tank top (Common)
// ---------------------------------------------------------------------------

/**
 * Common: #86e660 across the whole Shirt footprint, `shape` 2.0 all round, the
 * neckline arc in the same ink, one shine. The footprint is ink included, so the
 * path is the footprint's inset ellipse offset inward by half the ink (an exact
 * offset curve, so the ink never reaches the torso edge band), cut at the tail
 * root at the rear and at the front edge on the front line, whose neckline bows
 * back SHIRT_NECKLINE_DEPTH (1.5). #88 narrows the edge band to 1 and moves the
 * front edge up to the front line, so the top covers the torso side as one
 * strong colour mass.
 */
function paintTankTop(ctx: CanvasRenderingContext2D, look: AxolotlArtLook): void {
  const outline = shirtOutline(look);
  inkedShape(ctx, outline.body, TANK_TOP_FILL);
  shirtShine(ctx, outline);
}

/** The Shirt silhouette of a look and what its shine is placed from; the Tank top and the Raincoat share it. */
interface ShirtOutline {
  /** The closed silhouette path (the ink is stroked on it, centred). */
  readonly body: Path2D;
  /** Half the item ink: the path sits this far inside the footprint's rear and front edges. */
  readonly half: number;
  /** Path x of the rear cut and of the front edge. */
  readonly xr: number;
  readonly xf: number;
  /** y of the upper edge of the silhouette path at x. */
  readonly topAt: (x: number) => number;
}

function shirtOutline(look: AxolotlArtLook): ShirtOutline {
  const shirt = shirtGeometry(look);
  const half = ITEM_LW / 2;
  const e = shirt.inset;
  const xr = shirt.rearX + half;
  const xf = shirt.frontX - half;
  // The upper half of the offset ellipse, t from pi (rear tip) to 2 pi (front tip); x grows with t.
  const offset = (t: number): { x: number; y: number } => {
    const nx = Math.cos(t) / e.rx;
    const ny = Math.sin(t) / e.ry;
    const n = Math.hypot(nx, ny);
    return { x: e.cx + e.rx * Math.cos(t) - (half * nx) / n, y: e.cy + e.ry * Math.sin(t) - (half * ny) / n };
  };
  const tAt = (x: number): number => {
    let lo = Math.PI;
    let hi = 2 * Math.PI;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (offset(mid).x < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const tFront = tAt(xf);
  const tRear = tAt(xr);
  const steps = 32;
  const top = Array.from({ length: steps + 1 }, (_, i) => offset(tFront + ((tRear - tFront) * i) / steps));
  const flip = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x, y: 2 * e.cy - p.y });
  const body = new Path2D();
  top.forEach((p, i) => (i === 0 ? body.moveTo(p.x, p.y) : body.lineTo(p.x, p.y)));
  for (let i = steps; i >= 0; i--) body.lineTo(flip(top[i]).x, flip(top[i]).y);
  // The neckline: a concave front edge whose ink-included apex is x -7, so its path apex is 1.0 further back.
  const apex = shirt.neckline.apexX - half;
  body.quadraticCurveTo(2 * apex - xf, e.cy, top[0].x, top[0].y);
  body.closePath();
  return { body, half, xr, xf, topAt: (x) => offset(tAt(x)).y };
}

/** The shine: 4 x 1.3 (shorter on a short Shirt), tilted along the torso top at the upper left, clear of the ink. */
function shirtShine(ctx: CanvasRenderingContext2D, outline: ShirtOutline): void {
  const { half, xr, xf, topAt } = outline;
  const length = xf - xr;
  const xs = xr + length * 0.35;
  const tilt = Math.atan(topAt(xs + 0.5) - topAt(xs - 0.5));
  shine(ctx, xs, topAt(xs) + half + 2.2, Math.min(4, length * 0.2), 1.3, tilt);
}

// ---------------------------------------------------------------------------
// Shirt: Raincoat (Rare)
// ---------------------------------------------------------------------------

/** The Raincoat's hem stripe: how far down the torso half it starts (share of the inset ry below the centre line), and its height. */
const RAINCOAT_STRIPE_AT = 0.4;
const RAINCOAT_STRIPE_H = 3.2;
/** The Raincoat's stripe lines: thin (as the Golden bow's), so the stripe's ink hides little of the coat. */
const RAINCOAT_STRIPE_LW = 0.6;

/**
 * Rare (issue #75): the Tank top's silhouette (the whole Shirt footprint, `shape`
 * 2.0, the neckline arc) in #ffc79a, with one hem stripe across the torso in the
 * boat yellow (the one trim band, between two 0.6 ink lines, clipped inside the
 * silhouette) and one shine placed as on the Tank top. No sleeves: it never
 * reaches a leg, the tail core or the head.
 */
function paintRaincoat(ctx: CanvasRenderingContext2D, look: AxolotlArtLook): void {
  const outline = shirtOutline(look);
  const e = shirtGeometry(look).inset;
  inkedShape(ctx, outline.body, RAINCOAT_FILL, () => {
    const y0 = e.cy + e.ry * RAINCOAT_STRIPE_AT;
    trimBand(ctx, { x0: outline.xr - 1, x1: outline.xf + 1, y0, y1: y0 + RAINCOAT_STRIPE_H }, BOAT_TRIM, true, RAINCOAT_STRIPE_LW);
  });
  shirtShine(ctx, outline);
}

// ---------------------------------------------------------------------------
// Shirt: Water-lily shirt (Rare)
// ---------------------------------------------------------------------------

/** The hem band's place: how far down the torso half it starts (share of the inset ry below the centre line), and its height. */
const LILY_SHIRT_BAND_AT = 0.56;
const LILY_SHIRT_BAND_H = 3;
/** Thin ink lines on each side of the hem band, as the Raincoat's. */
const LILY_SHIRT_BAND_LW = 0.6;
/** The chest blossom: its centre a share of the way along the Shirt and above the torso centre line (share of the inset ry). */
const LILY_SHIRT_BLOSSOM_AT = 0.5;
const LILY_SHIRT_BLOSSOM_RISE = 0.2;
/** The blossom's petals: five, each centred this far out, with these radii, and the ink round the blossom. */
const LILY_SHIRT_PETAL_OUT = 2.6;
const LILY_SHIRT_PETAL_RX = 2.25;
const LILY_SHIRT_PETAL_RY = 1.7;
/** The dark centre's radius. */
const LILY_SHIRT_CENTRE_R = 0.9;
const LILY_SHIRT_BLOSSOM_OL = 0.6;
/** The gap kept between the blossom's ink and the neckline's ink (2.0 wide, its front at the apex x). */
const LILY_SHIRT_BLOSSOM_GAP = 0.2;

/**
 * Rare (issue #98): the Tank top's silhouette (the whole Shirt footprint, `shape`
 * 2.0, the neckline arc) in #d0ecff, with a #ffe0ee five-petal water-lily blossom
 * on the chest (a small `blob` of merged petals, ink 0.6 outside, a dark centre of
 * ink at alpha 0.30) and one hem band in the boat yellow (the one trim band,
 * between two 0.6 ink lines, clipped inside the silhouette), one shine placed as
 * on the Tank top. The blossom and band sit inside the silhouette, so they never
 * reach the torso edge band, the front line, the tail root or a leg, and the
 * blossom is clear of the band and of the shine. No sleeves.
 */
function paintWaterLilyShirt(ctx: CanvasRenderingContext2D, look: AxolotlArtLook): void {
  const outline = shirtOutline(look);
  const e = shirtGeometry(look).inset;
  inkedShape(ctx, outline.body, WATER_LILY_SHIRT_FILL, () => {
    const y0 = e.cy + e.ry * LILY_SHIRT_BAND_AT;
    trimBand(ctx, { x0: outline.xr - 1, x1: outline.xf + 1, y0, y1: y0 + LILY_SHIRT_BAND_H }, BOAT_TRIM, true, LILY_SHIRT_BAND_LW);
    // Half way along the Shirt, or further back where the neckline would cut the blossom: its front stays behind the neckline apex.
    const reach = LILY_SHIRT_PETAL_OUT + LILY_SHIRT_PETAL_RX + LILY_SHIRT_BLOSSOM_OL;
    const cx = Math.min(
      outline.xr + (outline.xf - outline.xr) * LILY_SHIRT_BLOSSOM_AT,
      shirtGeometry(look).neckline.apexX - 2 * outline.half - reach - LILY_SHIRT_BLOSSOM_GAP,
    );
    const cy = e.cy - e.ry * LILY_SHIRT_BLOSSOM_RISE;
    const petals = Array.from({ length: 5 }, (_, k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      return ellipsePath(
        cx + Math.cos(a) * LILY_SHIRT_PETAL_OUT,
        cy + Math.sin(a) * LILY_SHIRT_PETAL_OUT,
        LILY_SHIRT_PETAL_RX,
        LILY_SHIRT_PETAL_RY,
        a,
      );
    });
    silhouette(
      ctx,
      petals.map((path) => ({ path, fill: WATER_LILY_BLOSSOM })),
      LILY_SHIRT_BLOSSOM_OL,
    );
    ctx.save();
    ctx.globalAlpha = SOCK_STRIPE_ALPHA;
    ctx.fillStyle = INK;
    ctx.fill(ellipsePath(cx, cy, LILY_SHIRT_CENTRE_R, LILY_SHIRT_CENTRE_R));
    ctx.restore();
  });
  shirtShine(ctx, outline);
}

// ---------------------------------------------------------------------------
// Back: Diving tank (Rare)
// ---------------------------------------------------------------------------

/** The Diving tank's domed ends: half-ellipses this deep along the tank, the tank's full height across. */
const TANK_CAP_RX = 4;
/** The Diving tank's valve: how far it stands out of the tank's front end, its height, and its corner radius. */
const VALVE_OUT = 3;
const VALVE_H = 8;
const VALVE_R = 1.5;
/** The strap band's width, and where its centre sits along the capsule from the rear. */
const STRAP_W = 4;
const STRAP_AT = 0.55;

/**
 * Rare: #d4cfe6. A tank with domed ends lying along the back and a valve block
 * on its front end merged into one `blob` (ink 2.0, all outside the fill), one
 * #ffe14a strap band across the tank's full height between two 1.2 ink lines,
 * one shine on the rear dome, clear of the strap. Painted in the Back frame (x'
 * along the torso edge toward the snout, y' + into the body). The box
 * (backFrameBox, by look) is ink included, so the fills are ITEM_LW inside it:
 * the tank runs the box's length less the valve, the valve reaches the front of
 * the box, and the tank stands proud of the back against the water (#88).
 */
function paintDivingTank(ctx: CanvasRenderingContext2D, box: BackFrameBox): void {
  const top = box.minV + ITEM_LW;
  const bottom = box.maxV - ITEM_LW;
  const rear = box.minU + ITEM_LW;
  const front = box.maxU - ITEM_LW;
  const capFront = front - VALVE_OUT;
  const r = (bottom - top) / 2;
  const mid = top + r;
  const body = new Path2D();
  body.moveTo(rear + TANK_CAP_RX, top);
  body.lineTo(capFront - TANK_CAP_RX, top);
  body.ellipse(capFront - TANK_CAP_RX, mid, TANK_CAP_RX, r, 0, -Math.PI / 2, Math.PI / 2);
  body.lineTo(rear + TANK_CAP_RX, bottom);
  body.ellipse(rear + TANK_CAP_RX, mid, TANK_CAP_RX, r, 0, Math.PI / 2, (3 * Math.PI) / 2);
  body.closePath();
  const valve = roundRectPath(capFront - TANK_CAP_RX, mid - VALVE_H / 2, front, mid + VALVE_H / 2, VALVE_R);
  blobs(ctx, [body, valve], DIVING_TANK_FILL);
  const strap = rear + (capFront - rear) * STRAP_AT;
  ctx.save();
  ctx.clip(body);
  trimBand(ctx, { x0: strap - STRAP_W / 2, x1: strap + STRAP_W / 2, y0: top - 1, y1: bottom + 1 }, DIVING_TANK_STRAP, false);
  ctx.restore();
  shine(ctx, rear + TANK_CAP_RX - 0.4, top + 3, 2, 1, -0.3);
}

// ---------------------------------------------------------------------------
// Back: Ladybug backpack (Epic)
// ---------------------------------------------------------------------------

/** The Ladybug's shell: its top corners' radius, and its share of the fill length that the dark head takes at the front. */
const LADYBUG_TOP_R = 7;
const LADYBUG_HEAD_RX = 2.6;
const LADYBUG_HEAD_RY = 3.2;
/** The shell's spots (a small repeat pattern, the Epic detail): centre as shares of the shell's half length and height, radius. */
const LADYBUG_SPOTS: readonly { readonly fx: number; readonly fy: number }[] = [
  { fx: -0.5, fy: 0.5 },
  { fx: 0.02, fy: 0.74 },
  { fx: 0.52, fy: 0.46 },
];
const LADYBUG_SPOT_R = 1.5;

/**
 * Epic (issue #75): a #ffbcc0 shell with a round top, lying along the back, and a
 * dark head at its front end, merged into one `blob` (ink 2.0 all outside the
 * fill) in the Back box of the look, ink included: the fills are ITEM_LW inside
 * the box, so the shell runs the box's length and stands 13 proud of the back. The
 * small repeat pattern is three spots (ink, radius 1.5); one shine on the upper
 * rear. Painted in the Back frame (x' along the torso edge toward the snout, y' +
 * into the body), so its lower edge, y' +1, keeps off the Shirt.
 */
function paintLadybugBackpack(ctx: CanvasRenderingContext2D, box: BackFrameBox): void {
  const top = box.minV + ITEM_LW;
  const bottom = box.maxV - ITEM_LW;
  const rear = box.minU + ITEM_LW;
  const front = box.maxU - ITEM_LW;
  const shellFront = front - LADYBUG_HEAD_RX;
  const r = Math.min(LADYBUG_TOP_R, (shellFront - rear) / 2, bottom - top);
  const shell = new Path2D();
  shell.moveTo(rear, bottom);
  shell.arcTo(rear, top, shellFront, top, r);
  shell.arcTo(shellFront, top, shellFront, bottom, r);
  shell.lineTo(shellFront, bottom);
  shell.closePath();
  const head = ellipsePath(front - LADYBUG_HEAD_RX, bottom - LADYBUG_HEAD_RY, LADYBUG_HEAD_RX, LADYBUG_HEAD_RY);
  silhouette(ctx, [
    { path: shell, fill: LADYBUG_SHELL },
    { path: head, fill: INK },
  ]);
  const cx = (rear + shellFront) / 2;
  const a = (shellFront - rear) / 2;
  const b = bottom - top;
  ctx.fillStyle = INK;
  for (const spot of LADYBUG_SPOTS) ctx.fill(ellipsePath(cx + spot.fx * a, bottom - spot.fy * b, LADYBUG_SPOT_R, LADYBUG_SPOT_R));
  shine(ctx, cx - 0.5 * a, bottom - 0.84 * b, 1.7, 0.8, -0.5);
}

// ---------------------------------------------------------------------------
// Back: Rainbow dragonfly wings (Legendary)
// ---------------------------------------------------------------------------

/** Internal rainbow veins on the wings (detail colours, never outer fills): pink, mint and lilac. */
const RAINBOW_VEINS: readonly string[] = ['#ff8fc0', '#6fdca0', '#a99cff'];
const VEIN_LW = 0.9;
/** The gold harness the wings hang from: half length, and its top and bottom (the bottom is the box's fill bottom). */
const HARNESS_HALF = 5;
const HARNESS_TOP = -3.4;
const HARNESS_R = 1.6;

/**
 * A wing: its half length and half width, its angle above the back line (radians,
 * pointing outward and up), how much of the fill half length its outer end reaches
 * (the end of its bounding box, so 1 is the box end), and its highest y'. The wing
 * is placed from these so its bounding box is exact: its outer end at `reach` and
 * its top at `topV`.
 */
interface WingSpec {
  readonly rx: number;
  readonly ry: number;
  readonly angle: number;
  readonly reach: number;
  readonly topV: number;
}
/** The long pair rises steeply; the short, lower pair lies back along the tail and snout, and reaches the box ends. */
const WINGS_UPPER: WingSpec = { rx: 7.2, ry: 3.1, angle: 1.05, reach: 0.84, topV: -12 };
const WINGS_LOWER: WingSpec = { rx: 6, ry: 2.6, angle: 0.4, reach: 1, topV: -6.2 };

/**
 * Legendary (issue #75): four dragonfly wings in the pale sky film #d9f3ff (two
 * long pairs rising and two short, lower), rooted on one #ffc12e harness (the
 * Legendary trim), merged into one `blob` silhouette (ink 2.0 all outside) in the
 * Back box of the look, ink included: the fills are ITEM_LW inside the box and the
 * wings run the box's length. Each wing has three rainbow veins (pink, mint, lilac,
 * detail colours) along its length, and one static 4-point star (R 3, outline 1.2)
 * sits at the apex between the long pair. Painted in the Back frame, so its lower edge, y' +1,
 * keeps off the Shirt.
 */
function paintRainbowWings(ctx: CanvasRenderingContext2D, box: BackFrameBox): void {
  const top = box.minV + ITEM_LW;
  const bottom = box.maxV - ITEM_LW;
  const rear = box.minU + ITEM_LW;
  const front = box.maxU - ITEM_LW;
  const cx = (rear + front) / 2;
  const half = (front - rear) / 2;
  interface Wing {
    readonly path: Path2D;
    readonly axis: { readonly a: Pt; readonly b: Pt };
    readonly ry: number;
  }
  const wings: Wing[] = [WINGS_UPPER, WINGS_LOWER].flatMap((w) =>
    ([-1, 1] as const).map((side): Wing => {
      const c = Math.cos(w.angle);
      const s = Math.sin(w.angle);
      // The bounding box half extents of an ellipse of radii rx, ry whose axis is turned by `angle`.
      const ex = Math.hypot(w.rx * c, w.ry * s);
      const ey = Math.hypot(w.rx * s, w.ry * c);
      const centre = { x: cx + side * (w.reach * half - ex), y: w.topV + ey };
      // The axis runs from the lower inner end to the upper outer end.
      const dir = { x: side * c, y: -s };
      return {
        path: ellipsePath(centre.x, centre.y, w.rx, w.ry, -side * w.angle),
        axis: { a: { x: centre.x - dir.x * w.rx, y: centre.y - dir.y * w.rx }, b: { x: centre.x + dir.x * w.rx, y: centre.y + dir.y * w.rx } },
        ry: w.ry,
      };
    }),
  );
  const harness = roundRectPath(cx - HARNESS_HALF, HARNESS_TOP, cx + HARNESS_HALF, bottom, HARNESS_R);
  silhouette(ctx, [
    ...wings.map((w) => ({ path: w.path, fill: DRAGONFLY_WING })),
    { path: harness, fill: GOLD_TRIM },
  ]);
  for (const w of wings) {
    ctx.save();
    ctx.clip(w.path);
    const dx = w.axis.b.x - w.axis.a.x;
    const dy = w.axis.b.y - w.axis.a.y;
    const length = Math.hypot(dx, dy);
    const nx = -dy / length;
    const ny = dx / length;
    ctx.lineWidth = VEIN_LW;
    RAINBOW_VEINS.forEach((colour, k) => {
      const off = (k - 1) * (w.ry * 0.5);
      ctx.strokeStyle = colour;
      ctx.stroke(line(w.axis.a.x + dx * 0.3 + nx * off, w.axis.a.y + dy * 0.3 + ny * off, w.axis.b.x - dx * 0.1 + nx * off, w.axis.b.y - dy * 0.1 + ny * off));
    });
    ctx.restore();
  }
  legendStar(ctx, cx, top + STAR_R + BAND_LW / 2, BAND_LW);
}

// ---------------------------------------------------------------------------
// Back: Firefly cape (Legendary)
// ---------------------------------------------------------------------------

/** Where the cape's upper edge starts to fall toward the rear (share of the length from the rear), and how far down its rear end starts. */
const CAPE_FALL_AT = 0.45;
const CAPE_REAR_DROP = 3.4;
/** The cape's collar corner radius, and the scallops of its rear hem: how many, and how far the points sit in from the rear end. */
const CAPE_COLLAR_R = 3;
const CAPE_SCALLOPS = 3;
const CAPE_SCALLOP_IN = 1;
/** The gold clasp band at the front: from this far behind the front end to this far, and the star's place behind the front. */
const CAPE_BAND_FROM = 4.4;
const CAPE_BAND_TO = 2;
/** Thin ink lines on each side of the clasp band, as the Golden bow's. */
const CAPE_BAND_LW = 0.6;
const CAPE_STAR_BACK = 9;
const CAPE_STAR_V = -7;
/** A firefly: glow radius and body radii. */
const FIREFLY_GLOW_R = 2;
const FIREFLY_BODY_RX = 0.9;
const FIREFLY_BODY_RY = 0.8;
/** The four fireflies: three in a low row at these shares of the length from the rear, one high at the rear; (share, v). */
const CAPE_FIREFLIES: readonly { readonly share: number; readonly lead: number; readonly v: number }[] = [
  { share: 0.19, lead: 0, v: -1 },
  { share: 0.42, lead: 0, v: -1 },
  { share: 0.62, lead: 0, v: -1 },
  { share: 0, lead: 3, v: -5.4 },
];

/**
 * Legendary (issue #98): a #d4d9ff cape lying along the back, tall and rounded at
 * the front where it is clasped, its upper edge flat and then falling toward the
 * rear, and a scalloped hem of three scallops at the rear end. It is one `blob`
 * silhouette (ink 2.0 all outside the fill) in the Back box of the look, ink
 * included: the fills are ITEM_LW inside the box, so the cape runs the box's length
 * and stands 13 proud of the back. The Legendary trim is one #ffc12e clasp band
 * across the front (between two 0.6 ink lines, clipped inside the cape) and one
 * static 4-point star (R 3, outline 1.2) behind it. Four fireflies sit still on the
 * cape: a yellow glow disc round a small ink body, no motion and no glow animation;
 * the glow is a flat fill inside the silhouette, so it is free. One shine. Painted
 * in the Back frame (x' along the torso edge toward the snout, y' + into the
 * body), so its lower edge, y' +1, keeps off the Shirt.
 */
function paintFireflyCape(ctx: CanvasRenderingContext2D, box: BackFrameBox): void {
  const top = box.minV + ITEM_LW;
  const bottom = box.maxV - ITEM_LW;
  const rear = box.minU + ITEM_LW;
  const front = box.maxU - ITEM_LW;
  const length = front - rear;
  const cape = new Path2D();
  cape.moveTo(front, bottom);
  cape.lineTo(front, top + CAPE_COLLAR_R);
  cape.quadraticCurveTo(front, top, front - CAPE_COLLAR_R, top);
  cape.lineTo(rear + length * CAPE_FALL_AT, top);
  cape.bezierCurveTo(rear + length * 0.3, top, rear + length * 0.12, top + 1, rear + CAPE_SCALLOP_IN, top + CAPE_REAR_DROP);
  const step = (bottom - (top + CAPE_REAR_DROP)) / CAPE_SCALLOPS;
  for (let i = 0; i < CAPE_SCALLOPS; i++) {
    const y0 = top + CAPE_REAR_DROP + step * i;
    cape.quadraticCurveTo(rear - CAPE_SCALLOP_IN, y0 + step / 2, rear + CAPE_SCALLOP_IN, y0 + step);
  }
  cape.closePath();
  silhouette(ctx, [{ path: cape, fill: FIREFLY_CAPE_FILL }]);
  ctx.save();
  ctx.clip(cape);
  trimBand(ctx, { x0: front - CAPE_BAND_FROM, x1: front - CAPE_BAND_TO, y0: top - 1, y1: bottom + 1 }, GOLD_TRIM, false, CAPE_BAND_LW);
  ctx.restore();
  for (const fly of CAPE_FIREFLIES) {
    const u = rear + length * fly.share + fly.lead + FIREFLY_GLOW_R + CAPE_SCALLOP_IN;
    ctx.fillStyle = FIREFLY_GLOW;
    ctx.fill(ellipsePath(u, fly.v, FIREFLY_GLOW_R, FIREFLY_GLOW_R));
    ctx.fillStyle = INK;
    ctx.fill(ellipsePath(u, fly.v, FIREFLY_BODY_RX, FIREFLY_BODY_RY));
  }
  shine(ctx, rear + 3.4, top + 3, 1.1, 0.8, -0.1);
  legendStar(ctx, front - CAPE_STAR_BACK, CAPE_STAR_V, BAND_LW);
}

// ---------------------------------------------------------------------------
// Socks: Stripy socks (Common), in leg space
// ---------------------------------------------------------------------------

/** The Sock's foot pad as a closed path in leg space: its ink-included rectangle pulled in by half the ink. */
function footPadPath(frame: LegSlotFrame): Path2D {
  const pad = sockFootPad(frame);
  const half = ITEM_LW / 2;
  const v = pad.vHalf - half;
  const u0 = pad.u0 + half;
  const u1 = pad.u1 - half;
  return roundRectPath(u0, -v, u1, v, Math.min(pad.radius, (u1 - u0) / 2, v));
}

/**
 * Common: a #efdcba sleeve (colour 11.6, `ol` 2.4) from the leg root to the leg
 * end, a foot pad over the toes, three stripes across the sleeve (the same
 * colour darkened: ink at alpha 0.30, not a second colour) and one shine on the
 * pad. In leg space: u along the leg from the root, v across it.
 */
function paintStripySocks(ctx: CanvasRenderingContext2D, frame: LegSlotFrame, tone: Tone): void {
  const l = frame.length;
  inkMany(ctx, [seg(line(0, 0, l, 0), SOCK_SLEEVE_W, tone(SOCK_FILL), SOCK_SLEEVE_OL)]);
  ctx.save();
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  for (const u of [l - 3, l - 5.4, l - 7.8]) ctx.fill(rectPath(u - 0.8, -SOCK_SLEEVE_W / 2, u + 0.8, SOCK_SLEEVE_W / 2));
  ctx.restore();
  shape(ctx, footPadPath(frame), tone(SOCK_FILL), ITEM_LW);
  shine(ctx, l + 5, -4.5, 2.2, 0.9);
}

// ---------------------------------------------------------------------------
// Socks: Lily-pad socks (Common), in leg space
// ---------------------------------------------------------------------------

/** A lily-pad mark: a pad of radius `r` at (cx, cy), turned by `rot`, with a wedge notch cut to its centre, as one path. */
function padMarkPath(cx: number, cy: number, r: number, rot: number): Path2D {
  const notch = 0.75;
  const start = 0.2;
  const p = new Path2D();
  p.moveTo(cx, cy);
  p.ellipse(cx, cy, r, r * 0.78, rot, start, start + TAU - notch);
  p.closePath();
  return p;
}

/**
 * Common (issue #98): a #bff0a0 sleeve (colour 11.6, `ol` 2.4) from the leg root to
 * the leg end, a foot pad over the toes (the Stripy socks' pad), two notched lily-pad
 * marks (ink at alpha 0.30, the same colour darkened, not a second colour: one
 * across the sleeve, one on the pad, clipped to it) and one shine on the pad. In
 * leg space: u along the leg from the root, v across it. Far legs use the fill
 * mixed toward ink; the marks, ink and shine are as on the near legs.
 */
function paintLilyPadSocks(ctx: CanvasRenderingContext2D, frame: LegSlotFrame, tone: Tone): void {
  const l = frame.length;
  const t = frame.toeLength;
  inkMany(ctx, [seg(line(0, 0, l, 0), SOCK_SLEEVE_W, tone(LILY_PAD_SOCK_FILL), SOCK_SLEEVE_OL)]);
  ctx.save();
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  ctx.fill(padMarkPath(l - 5.4, 0, 3, 2.4));
  ctx.restore();
  inkedShape(ctx, footPadPath(frame), tone(LILY_PAD_SOCK_FILL), () => {
    ctx.globalAlpha = SOCK_STRIPE_ALPHA;
    ctx.fillStyle = INK;
    ctx.fill(padMarkPath(l + (t + 6) / 2 + 1.2, 2.6, 3.2, 0.6));
  });
  shine(ctx, l + 5, -4.5, 2.2, 0.9);
}

// ---------------------------------------------------------------------------
// Feet: Flippers (Rare), in leg space
// ---------------------------------------------------------------------------

/**
 * Rare: a #ffe14a fan from the ankle (guide 6i Flippers construction), `shape`
 * 2.0, one #ff82bf cuff band, three internal fan ridges (texture, not a counted
 * detail) and one shine. The construction is ink included and fills the Feet
 * envelope's width and front (#88), so the path is 1.0 inside it: the back edge
 * at the pad's back, u l - 1, with v +/-8.5, opening to v +/-11.4 at u l + 3 and
 * +/-12.5 at u l + t + 4, and a rounded tip at u l + t + 9.3. It fully covers
 * the Sock's foot pad at the sides and front, so the Sock shows above it at the
 * back. The cuff starts at the back edge, which is its first ink line; the
 * shine sits clear of the ink.
 */
function paintFlippers(ctx: CanvasRenderingContext2D, frame: LegSlotFrame, tone: Tone): void {
  const l = frame.length;
  const t = frame.toeLength;
  const half = ITEM_LW / 2;
  const back = l - FOOT_BACK_U + half;
  const mid = l + 3;
  const side = l + t + 4;
  const tip = l + t + FEET_ENVELOPE_FRONT - half;
  const vBack = FLIPPER_BACK_HALF - half;
  const vMid = FLIPPER_MID_HALF - half;
  const vSide = FEET_ENVELOPE_HALF_WIDTH - half;
  const fan = new Path2D();
  fan.moveTo(back, -vBack);
  fan.lineTo(mid, -vMid);
  fan.lineTo(side, -vSide);
  fan.bezierCurveTo(side + 3, -vSide, tip, -vSide * 0.55, tip, 0);
  fan.bezierCurveTo(tip, vSide * 0.55, side + 3, vSide, side, vSide);
  fan.lineTo(mid, vMid);
  fan.lineTo(back, vBack);
  fan.closePath();
  inkedShape(ctx, fan, tone(FLIPPER_FILL), () => {
    const cuff = { x0: back - 1, x1: l + 2, y0: -vSide - 1, y1: vSide + 1 };
    trimBand(ctx, cuff, tone(FLIPPER_CUFF), false, BAND_LW, [false, true]);
    const ridges = new Path2D();
    for (const [u, v] of [
      [tip - 1.6, 0],
      [tip - 2.2, -FLIPPER_RIDGE_V],
      [tip - 2.2, FLIPPER_RIDGE_V],
    ]) {
      ridges.moveTo(l + 3.5, 0);
      ridges.lineTo(u, v);
    }
    ctx.strokeStyle = tone(FLIPPER_RIDGE);
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(ridges);
  });
  shine(ctx, l + 4.5, -5.5, 2.6, 0.9);
}

// ---------------------------------------------------------------------------
// Feet: Froggy boots (Legendary), in leg space
// ---------------------------------------------------------------------------

/** The frog eyes on the toe cap: u past the toe tips, how far in from the boot's side, radii of eye and pupil. */
const FROG_EYE_PAST_TOES = 3.4;
const FROG_EYE_IN = 5.2;
const FROG_EYE_R = 2.3;
const FROG_PUPIL_R = 1;
/** The star's place along the boot, past the leg end. */
const BOOT_STAR_AT = 5.4;

/**
 * Legendary (issue #75): a #8cf0a0 round-toed boot, the Shoe's rounded rectangle
 * (shoeRect: `shape` 2.0, u from l - 2.0 to l + t + 7.6, v +/-13.2, a Baby +/-12.2,
 * corner radius 8, ink included) so it stays inside the Feet envelope and fully
 * covers the Sock's foot pad and every toe. One #ffc12e cuff band across the full
 * width from the back edge to one 1.2 ink line at u = l + 2.0 (the Legendary trim),
 * one static 4-point star (R 3, outline 1.2) on the instep, a pair of frog eyes (white, ink 1.2,
 * ink pupils) on the toe cap, and one shine. The eyes and star keep their colours
 * on a far leg, as the ink and shine do.
 */
function paintFroggyBoots(ctx: CanvasRenderingContext2D, frame: LegSlotFrame, tone: Tone): void {
  const l = frame.length;
  const t = frame.toeLength;
  const half = ITEM_LW / 2;
  const rect = shoeRect(frame);
  const v = rect.vHalf - half;
  const boot = roundRectPath(rect.u0 + half, -v, rect.u1 - half, v, rect.radius - half);
  inkedShape(ctx, boot, tone(FROGGY_BOOT), () => {
    trimBand(ctx, { x0: rect.u0 + half - 1, x1: l + 2, y0: -v - 1, y1: v + 1 }, tone(GOLD_TRIM), false, BAND_LW, [false, true]);
  });
  const eyeU = l + t + FROG_EYE_PAST_TOES;
  const eyeV = v - FROG_EYE_IN;
  for (const side of [-1, 1]) {
    shape(ctx, ellipsePath(eyeU, side * eyeV, FROG_EYE_R, FROG_EYE_R), WHITE, BAND_LW);
    ctx.fillStyle = INK;
    ctx.fill(ellipsePath(eyeU + 0.3, side * eyeV, FROG_PUPIL_R, FROG_PUPIL_R));
  }
  legendStar(ctx, l + BOOT_STAR_AT, 0, BAND_LW);
  shine(ctx, l + 4.5, -5.5, 2.6, 0.9);
}

// ---------------------------------------------------------------------------
// Head: Straw sun hat (Common)
// ---------------------------------------------------------------------------

/** The Straw sun hat's crown: its sides, its flat top and the radius of its two top corners. */
const STRAW_CROWN = { x0: 24.4, x1: 37.6, yTop: -37.6, yBottom: -25.6, r: 4.4 } as const;
/** The hat band round the crown: y edges. Ink at the stripe alpha, the same colour darkened, not a second colour. */
const STRAW_BAND_Y0 = -30.6;
const STRAW_BAND_Y1 = -27.6;

/**
 * Common (issue #76): a #f3dd96 straw hat, a wide brim (the Sun hat's brim ellipse,
 * which tilts up toward the snout) under a tall flat-topped crown with square
 * sides and two rounded top corners, so it reads as a garden hat beside the Sun
 * hat's domed one. Brim and crown are one `blob` silhouette (ink 2.0 all outside);
 * the hat band is ink at alpha 0.30 across the crown, clipped to it; one shine on
 * the crown; no trim. Ink included it fills HEAD_FOOTPRINT: x 16 to 46, lowest ink
 * y -19.5 on the head top, crown top y -39.6.
 */
function paintStrawSunHat(ctx: CanvasRenderingContext2D): void {
  const { x0, x1, yTop, yBottom, r } = STRAW_CROWN;
  const brim = ellipsePath(31, -25.18, 13, 3.6, -0.06);
  const crown = new Path2D();
  crown.moveTo(x0, yBottom);
  crown.lineTo(x0, yTop + r);
  crown.arcTo(x0, yTop, x0 + r, yTop, r);
  crown.lineTo(x1 - r, yTop);
  crown.arcTo(x1, yTop, x1, yTop + r, r);
  crown.lineTo(x1, yBottom);
  crown.closePath();
  blobs(ctx, [brim, crown], STRAW_HAT_FILL);
  ctx.save();
  ctx.clip(crown);
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  ctx.fill(rectPath(x0 - 1, STRAW_BAND_Y0, x1 + 1, STRAW_BAND_Y1));
  ctx.restore();
  shine(ctx, 27.8, -34.2, 1, 2.2, 0.1);
}

// ---------------------------------------------------------------------------
// Neck: Marigold necklace (Common)
// ---------------------------------------------------------------------------

/** The garland: how many blossoms, the x of the first and last, and the largest blossom radius. */
const MARIGOLD_COUNT = 8;
const MARIGOLD_X0 = 6.8;
const MARIGOLD_X1 = 37.6;
const MARIGOLD_MAX_R = 4.2;
/** The string the blossoms hang on: this share of the Pond-weed scarf's band height, so no gap shows between blossoms. */
const MARIGOLD_STRING_SHARE = 0.8;
/** A blossom is a core and seven petals, all inside its radius r: core radius, petal radius and petal distance, each a share of r. */
const MARIGOLD_PETALS = 7;
const MARIGOLD_CORE_R = 0.62;
const MARIGOLD_PETAL_R = 0.4;
const MARIGOLD_PETAL_OUT = 0.6;
/** The dark blossom centre: ink at the stripe alpha, the same colour darkened; its radius as a share of r, and least radius. */
const MARIGOLD_DOT_SHARE = 0.2;
const MARIGOLD_DOT_MIN = 0.7;

/** A marigold blossom: centre and radius. */
interface Blossom {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * The largest blossom, up to MARIGOLD_MAX_R, centred on the middle of the scarf's
 * band at x whose circle stays inside the band (its upper edge dips under the
 * cheek heart zone, its lower edge keeps LW / 2 inside the outline). The Pond-weed
 * scarf's band is the footprint every Neck item keeps to, so the blossoms inherit
 * its clearances.
 */
function marigoldBlossom(x: number): Blossom {
  const y = (scarfUpperAt(x) + scarfLowerAt(x)) / 2;
  for (let r = Math.min(MARIGOLD_MAX_R, (scarfLowerAt(x) - scarfUpperAt(x)) / 2); r > 0.5; r -= 0.05) {
    let fits = true;
    for (let k = 0; k < 24 && fits; k++) {
      const a = (k * TAU) / 24;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      fits = py >= scarfUpperAt(px) && py <= scarfLowerAt(px);
    }
    if (fits) return { x, y, r };
  }
  return { x, y, r: 0.5 };
}

/** The garland's string: a band MARIGOLD_STRING_SHARE of the scarf band's height, from the first blossom to the last. */
function marigoldStringPath(): Path2D {
  const inset = (1 - MARIGOLD_STRING_SHARE) / 2;
  const upper = (x: number): number => scarfUpperAt(x) + inset * (scarfLowerAt(x) - scarfUpperAt(x));
  const lower = (x: number): number => scarfLowerAt(x) - inset * (scarfLowerAt(x) - scarfUpperAt(x));
  const steps = Math.round((MARIGOLD_X1 - MARIGOLD_X0) / 0.5);
  const xs = Array.from({ length: steps + 1 }, (_, i) => MARIGOLD_X0 + ((MARIGOLD_X1 - MARIGOLD_X0) * i) / steps);
  const band = new Path2D();
  xs.forEach((x, i) => (i === 0 ? band.moveTo(x, upper(x)) : band.lineTo(x, upper(x))));
  for (let i = steps; i >= 0; i--) band.lineTo(xs[i], lower(xs[i]));
  band.closePath();
  return band;
}

/**
 * Common (issue #76): a garland of eight #ffd06a marigold blossoms (a core and
 * seven petals each, the radius of each fitted to the Pond-weed scarf's band, 2.0
 * to 4.2) strung round the neck on a string of the same colour, all one `blob`
 * silhouette with ink 0.6 outside the fill (as the scarf: the Neck footprint is too
 * shallow for 2.0). Each blossom has a dark centre (ink at alpha 0.30) and one shine
 * sits on the largest; no trim. Everything lies inside the scarf's band, so it
 * keeps the gill-root zone, the cheek heart zone and the silhouette outline's
 * outer half as the scarf does; the mouth paints over its front.
 */
function paintMarigoldNecklace(ctx: CanvasRenderingContext2D): void {
  const blossoms = Array.from({ length: MARIGOLD_COUNT }, (_, i) =>
    marigoldBlossom(MARIGOLD_X0 + ((MARIGOLD_X1 - MARIGOLD_X0) * i) / (MARIGOLD_COUNT - 1)),
  );
  const parts: SilhouettePart[] = [{ path: marigoldStringPath(), fill: MARIGOLD_PETAL }];
  for (const b of blossoms) {
    parts.push({ path: ellipsePath(b.x, b.y, b.r * MARIGOLD_CORE_R, b.r * MARIGOLD_CORE_R), fill: MARIGOLD_PETAL });
    for (let k = 0; k < MARIGOLD_PETALS; k++) {
      const a = -Math.PI / 2 + (k * TAU) / MARIGOLD_PETALS;
      parts.push({
        path: ellipsePath(
          b.x + Math.cos(a) * b.r * MARIGOLD_PETAL_OUT,
          b.y + Math.sin(a) * b.r * MARIGOLD_PETAL_OUT,
          b.r * MARIGOLD_PETAL_R,
          b.r * MARIGOLD_PETAL_R,
        ),
        fill: MARIGOLD_PETAL,
      });
    }
  }
  silhouette(ctx, parts, SCARF_OL);
  ctx.save();
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  for (const b of blossoms) {
    const r = Math.max(MARIGOLD_DOT_MIN, b.r * MARIGOLD_DOT_SHARE);
    ctx.fill(ellipsePath(b.x, b.y, r, r));
  }
  ctx.restore();
  const big = blossoms.reduce((a, b) => (b.r > a.r ? b : a));
  const a = -2.3;
  shine(ctx, big.x + Math.cos(a) * big.r * MARIGOLD_PETAL_OUT, big.y + Math.sin(a) * big.r * MARIGOLD_PETAL_OUT, big.r * 0.34, big.r * 0.17, -0.5);
}

// ---------------------------------------------------------------------------
// Shirt: Garden overalls (Rare)
// ---------------------------------------------------------------------------

/**
 * The overalls' strap: a band of the same colour darkened (ink at the stripe alpha), this wide, this far along the
 * Shirt from the rear (share); it keeps this far clear of the pocket's ink and of the rear edge, and gets
 * narrower rather than meet either (a Baby's Shirt is only 10.5 long). Under OVERALLS_STRAP_MIN wide it is left
 * out, as the Slim and Regular Baby's: a sliver would only hide the denim the swim-view floor counts.
 */
const OVERALLS_STRAP_W = 2.4;
const OVERALLS_STRAP_MIN = 1.6;
const OVERALLS_STRAP_AT = 0.55;
const OVERALLS_STRAP_GAP = 0.5;
const OVERALLS_STRAP_REAR = 1.2;
/**
 * The bib pocket patch: width (or this share of the Shirt's length when that is less), height, corner radius and ink;
 * the gap kept behind the neckline's ink, and below the top ink (the Tank top's shine, 4 x 1.3 at 2.2 below it, ends 4.5
 * below the top path, so the pocket sits clear under it, also on a Chubby Baby's steep front).
 */
const OVERALLS_POCKET_W = 4.4;
const OVERALLS_POCKET_SHARE = 0.34;
const OVERALLS_POCKET_H = 4.4;
const OVERALLS_POCKET_R = 1;
const OVERALLS_POCKET_OL = 0.8;
const OVERALLS_NECK_GAP = 0.8;
const OVERALLS_TOP_GAP = 5;

/**
 * Rare (issue #76): the Tank top's silhouette (the whole Shirt footprint, `shape`
 * 2.0, the neckline arc) in #bcd2ff pale denim, with one clay #c8782c patch pocket
 * on the bib (the one trim, a rounded patch with 0.8 of ink, clipped inside the
 * silhouette), one strap down the torso behind it (ink at alpha 0.30: the same
 * colour darkened, not a second colour; none on the Slim and Regular Baby, whose Shirt is too short) and one shine placed as on the Tank top.
 * The pocket sits behind the neckline's ink and under the shine, so it never
 * reaches the torso edge band, the front line or the neckline; the strap clears
 * the pocket. No sleeves: it never reaches a leg, the tail core or the head.
 */
function paintGardenOveralls(ctx: CanvasRenderingContext2D, look: AxolotlArtLook): void {
  const outline = shirtOutline(look);
  const shirt = shirtGeometry(look);
  const e = shirt.inset;
  const length = outline.xf - outline.xr;
  inkedShape(ctx, outline.body, GARDEN_OVERALLS_FILL, () => {
    const right = shirt.neckline.apexX - 2 * outline.half - OVERALLS_NECK_GAP - OVERALLS_POCKET_OL / 2;
    const left = right - Math.min(OVERALLS_POCKET_W, OVERALLS_POCKET_SHARE * length);
    const strapRight = Math.min(
      outline.xr + length * OVERALLS_STRAP_AT + OVERALLS_STRAP_W / 2,
      left - OVERALLS_POCKET_OL / 2 - OVERALLS_STRAP_GAP,
    );
    const strapLeft = Math.max(strapRight - OVERALLS_STRAP_W, outline.xr + OVERALLS_STRAP_REAR);
    if (strapRight - strapLeft >= OVERALLS_STRAP_MIN) {
      ctx.save();
      ctx.globalAlpha = SOCK_STRIPE_ALPHA;
      ctx.fillStyle = INK;
      ctx.fill(rectPath(strapLeft, e.cy - e.ry - 1, strapRight, e.cy + e.ry + 1));
      ctx.restore();
    }
    const top = Math.max(outline.topAt(left), outline.topAt(right)) + outline.half + OVERALLS_TOP_GAP;
    const pocket = roundRectPath(left, top, right, top + OVERALLS_POCKET_H, OVERALLS_POCKET_R);
    shape(ctx, pocket, GARDEN_OVERALLS_PATCH, OVERALLS_POCKET_OL);
  });
  shirtShine(ctx, outline);
}

// ---------------------------------------------------------------------------
// Monarch wings, shared by the Monarch hair clip and the Monarch wings
// ---------------------------------------------------------------------------

/**
 * Ink just inside the Monarch hair clip's wing edge (with the 2.0 outside it, a dark border); the Monarch wings have
 * none, as their fill is what the swim-view floor counts and their outer 2.0 is the border. The vein width, and the cream border dots.
 */
const CLIP_BORDER = 1.2;
const WINGS_BORDER = 0;
const MONARCH_VEIN_LW = 0.8;
const MONARCH_DOT_R = 0.85;
/** How far in from the wing's edge the cream border dots sit, the least that clears the border ink. */
const MONARCH_DOT_IN = 2.1;
/** The dot places round the wing's outer end (ellipse angle from its outward axis): three on a long wing, two on a short one. Cream, not white. */
const MONARCH_DOTS_LONG: readonly number[] = [-0.8, 0, 0.8];
const MONARCH_DOTS_SHORT: readonly number[] = [-0.85, 0.85];
/** The vein ends round the outer end of a long wing (one down its axis; a short wing has none), and how far along the wing they start and end (shares of rx). */
const MONARCH_VEINS_LONG: readonly number[] = [0];
const MONARCH_VEINS_SHORT: readonly number[] = [];
const MONARCH_VEIN_ROOT = 0.6;
const MONARCH_VEIN_REACH = 0.8;
/** A long wing's dots and veins, and a short wing's. */
const MONARCH_LONG = { dots: MONARCH_DOTS_LONG, veins: MONARCH_VEINS_LONG } as const;
const MONARCH_SHORT = { dots: MONARCH_DOTS_SHORT, veins: MONARCH_VEINS_SHORT } as const;

/** One monarch wing: an ellipse, the unit vector along its axis pointing away from the body, and where its dots go. */
interface MonarchWing {
  readonly path: Path2D;
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly out: Pt;
  readonly dots: readonly number[];
  readonly veins: readonly number[];
}

/** A wing ellipse (rotation `rot`) whose outward axis points away from `body`. */
function monarchWing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  body: Pt,
  places: { readonly dots: readonly number[]; readonly veins: readonly number[] },
): MonarchWing {
  const ax = Math.cos(rot);
  const ay = Math.sin(rot);
  const sign = (cx - body.x) * ax + (cy - body.y) * ay >= 0 ? 1 : -1;
  return { path: ellipsePath(cx, cy, rx, ry, rot), cx, cy, rx, ry, out: { x: sign * ax, y: sign * ay }, ...places };
}

/**
 * A wing's details, clipped to the wing: the dark border just inside its edge (`border` wide, none when 0), two
 * veins fanning from near the body, and the cream border dots (the repeat pattern).
 * Red is never used, so a wing never reads as a wound.
 */
function paintMonarchWingDetail(ctx: CanvasRenderingContext2D, w: MonarchWing, border: number): void {
  const nrm = { x: -w.out.y, y: w.out.x };
  const at = (u: number, v: number): Pt => ({ x: w.cx + w.out.x * u + nrm.x * v, y: w.cy + w.out.y * u + nrm.y * v });
  ctx.save();
  ctx.clip(w.path);
  if (border > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2 * border;
    ctx.stroke(w.path);
  }
  const root = at(-MONARCH_VEIN_ROOT * w.rx, 0);
  ctx.lineWidth = MONARCH_VEIN_LW;
  for (const phi of w.veins) {
    const tip = at(MONARCH_VEIN_REACH * w.rx * Math.cos(phi), MONARCH_VEIN_REACH * w.ry * Math.sin(phi));
    ctx.stroke(line(root.x, root.y, tip.x, tip.y));
  }
  ctx.fillStyle = MONARCH_SPOT;
  for (const phi of w.dots) {
    const d = at((w.rx - MONARCH_DOT_IN) * Math.cos(phi), (w.ry - MONARCH_DOT_IN) * Math.sin(phi));
    ctx.fill(ellipsePath(d.x, d.y, MONARCH_DOT_R, MONARCH_DOT_R));
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Head: Monarch hair clip (Epic)
// ---------------------------------------------------------------------------

/** The clip's body: centre and radii. Pebble A (MONARCH_BODY), as the icon's body. */
const CLIP_BODY = { x: 31, y: -29.4, rx: 1.8, ry: 5.2 } as const;

/**
 * Epic (issue #76): a monarch butterfly clip on the head top. Two broad upper
 * wings tilt up and out, two short lower wings lie back toward the head top, all in
 * #ffc487 pale monarch orange with a dark border, two ink veins and cream dots round
 * the edge (the small repeat pattern, the Epic detail: three on each upper wing, two
 * on each lower wing), on a slim pebble A body. Wings and body are one `blob` silhouette
 * (ink 2.0 all outside); one shine on the rear upper wing; no trim, no gem. It is a
 * hair clip as big as the Head slot's minimums ask: ink included it fills
 * HEAD_FOOTPRINT, x 16.4 to 45.6, lowest ink y -19.7 on the head top, top y -43.9.
 * Symmetrical about x 31.
 */
function paintMonarchHairClip(ctx: CanvasRenderingContext2D): void {
  const body: Pt = { x: CLIP_BODY.x, y: CLIP_BODY.y };
  const wings = [
    monarchWing(25.94, -34.6, 9, 5.4, 0.75, body, MONARCH_LONG),
    monarchWing(36.06, -34.6, 9, 5.4, -0.75, body, MONARCH_LONG),
    monarchWing(26.6, -26.1, 6.4, 3.9, -0.38, body, MONARCH_SHORT),
    monarchWing(35.4, -26.1, 6.4, 3.9, 0.38, body, MONARCH_SHORT),
  ];
  silhouette(ctx, [
    ...wings.map((w) => ({ path: w.path, fill: MONARCH_WING })),
    { path: ellipsePath(CLIP_BODY.x, CLIP_BODY.y, CLIP_BODY.rx, CLIP_BODY.ry), fill: MONARCH_BODY },
  ]);
  for (const w of wings) paintMonarchWingDetail(ctx, w, CLIP_BORDER);
  shine(ctx, 24.4, -35.8, 1.4, 0.7, -0.6);
}

// ---------------------------------------------------------------------------
// Back: Monarch wings (Legendary)
// ---------------------------------------------------------------------------

/** The long pair rises steeply and the short, lower pair lies back; reach, top and angle as the Rainbow wings'. */
const MONARCH_UPPER: WingSpec = { rx: 7.2, ry: 4.5, angle: 0.95, reach: 1, topV: -12 };
const MONARCH_LOWER: WingSpec = { rx: 6.2, ry: 4, angle: 0.25, reach: 1, topV: -7.4 };
/** The harness the wings join on, in pebble A: half width, its top (its bottom is the box's fill bottom) and corner radius. */
const MONARCH_BODY_HALF = 3.4;
const MONARCH_BODY_TOP = -3.8;
const MONARCH_BODY_R = 1.4;
/** The gold band across the harness (the Legendary trim): its y' edges, between two thin ink lines. */
const MONARCH_BAND_Y0 = -1.8;
const MONARCH_BAND_Y1 = 0.2;

/**
 * Legendary (issue #76): four monarch wings in #ffc487, two long ones rising and two
 * short, lower ones lying back along the tail and snout, rooted on one pebble A
 * harness with a #ffc12e band across it (the Legendary trim, between two 0.6 ink
 * lines so it reads in greyscale), merged into one `blob` silhouette (ink 2.0 all outside) in the Back box
 * of the look, ink included: the fills are ITEM_LW inside the box and the wings run
 * the box's length. Each wing has two ink veins and cream border dots, its dark border the 2.0 of ink round it
 * (three on a long wing, two on a short one), and one static 4-point star (R 3,
 * outline 1.2) sits at the apex between the long pair. Painted in the Back frame, so
 * its lower edge, y' +1, keeps off the Shirt.
 */
function paintMonarchWings(ctx: CanvasRenderingContext2D, box: BackFrameBox): void {
  const top = box.minV + ITEM_LW;
  const bottom = box.maxV - ITEM_LW;
  const rear = box.minU + ITEM_LW;
  const front = box.maxU - ITEM_LW;
  const cx = (rear + front) / 2;
  const half = (front - rear) / 2;
  const root: Pt = { x: cx, y: bottom };
  const pairs = [
    { spec: MONARCH_UPPER, places: MONARCH_LONG },
    { spec: MONARCH_LOWER, places: MONARCH_SHORT },
  ] as const;
  const wings = pairs.flatMap(({ spec: w, places }) =>
    ([-1, 1] as const).map((side): MonarchWing => {
      const c = Math.cos(w.angle);
      const s = Math.sin(w.angle);
      // The bounding box half extents of an ellipse of radii rx, ry whose axis is turned by `angle`.
      const ex = Math.hypot(w.rx * c, w.ry * s);
      const ey = Math.hypot(w.rx * s, w.ry * c);
      return monarchWing(cx + side * (w.reach * half - ex), w.topV + ey, w.rx, w.ry, -side * w.angle, root, places);
    }),
  );
  const bodyPath = roundRectPath(cx - MONARCH_BODY_HALF, MONARCH_BODY_TOP, cx + MONARCH_BODY_HALF, bottom, MONARCH_BODY_R);
  silhouette(ctx, [...wings.map((w) => ({ path: w.path, fill: MONARCH_WING })), { path: bodyPath, fill: MONARCH_BODY }]);
  for (const w of wings) paintMonarchWingDetail(ctx, w, WINGS_BORDER);
  ctx.fillStyle = MONARCH_BODY;
  ctx.fill(bodyPath);
  ctx.save();
  ctx.clip(bodyPath);
  trimBand(ctx, { x0: cx - MONARCH_BODY_HALF - 1, y0: MONARCH_BAND_Y0, x1: cx + MONARCH_BODY_HALF + 1, y1: MONARCH_BAND_Y1 }, GOLD_TRIM, true, BOW_BAND_LW);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = BAND_LW;
  ctx.stroke(bodyPath);
  legendStar(ctx, cx, top + STAR_R + BAND_LW / 2, BAND_LW);
}

// ---------------------------------------------------------------------------
// Head: Bee headband (Common)
// ---------------------------------------------------------------------------

/** The band's fill ends along x (the round ends included), and its thickness. */
const BEE_BAND_X0 = 18.4;
const BEE_BAND_X1 = 41.8;
const BEE_BAND_THICK = 4.6;
/** The band's lowest fill y: its ink (2.0) then ends at the Head footprint's lowest y, -19.5. */
const BEE_BAND_FLOOR = -21.5;
/** How far inside the head outline's fill (below its top edge) the band's lower edge rests, where the floor allows. */
const BEE_BAND_SINK = 0.6;
/** The bee stripes: ink bars at the stripe alpha across the band, at these x, this wide. */
const BEE_STRIPES: readonly number[] = [22, 25.8, 36.2, 39.4];
const BEE_STRIPE_W = 1.8;
/** The two antennae: where each leaves the band (x), the curve's control point and the bobble centre, and the stem and bobble sizes. */
const BEE_ANTENNAE: readonly { readonly baseX: number; readonly ctrl: Pt; readonly tip: Pt }[] = [
  { baseX: 28.4, ctrl: { x: 26.4, y: -33.4 }, tip: { x: 24.4, y: -38.4 } },
  { baseX: 33.6, ctrl: { x: 36.2, y: -33.4 }, tip: { x: 38.4, y: -38.2 } },
];
const BEE_STEM_W = 2.2;
const BEE_BOBBLE_R = 3;

/** y of the head outline's upper edge at x. */
function headTopAt(x: number): number {
  const { cx, cy, rx, ry } = HEAD_ELLIPSE;
  return cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
}

/** y of the band's lower edge at x: on the head top, or the floor where the head falls away toward the snout. */
function beeBandLowerAt(x: number): number {
  return Math.min(headTopAt(x) + BEE_BAND_SINK, BEE_BAND_FLOOR);
}

/** The band as one closed path: its upper edge rear to front, a round front end, its lower edge back, a round rear end. */
function beeBandPath(): Path2D {
  const r = BEE_BAND_THICK / 2;
  const xa = BEE_BAND_X0 + r;
  const xb = BEE_BAND_X1 - r;
  const steps = Math.round((xb - xa) / 0.5);
  const xs = Array.from({ length: steps + 1 }, (_, i) => xa + ((xb - xa) * i) / steps);
  const band = new Path2D();
  xs.forEach((x, i) => (i === 0 ? band.moveTo(x, beeBandLowerAt(x) - BEE_BAND_THICK) : band.lineTo(x, beeBandLowerAt(x) - BEE_BAND_THICK)));
  band.arc(xb, beeBandLowerAt(xb) - r, r, -Math.PI / 2, Math.PI / 2);
  for (let i = steps; i >= 0; i--) band.lineTo(xs[i], beeBandLowerAt(xs[i]));
  band.arc(xa, beeBandLowerAt(xa) - r, r, Math.PI / 2, (3 * Math.PI) / 2);
  band.closePath();
  return band;
}

/**
 * Common (issue #103): a #ffe566 bee-yellow headband hugging the head top, with two
 * little bee antennae (a curved stem and a round bobble each) springing from it and
 * splaying up and out. Band, stems and bobbles are one silhouette: every ink stroke
 * (2.0 outside the fill all round) before every fill, so no ink crosses a joint. The
 * bee stripes are four bars of ink at alpha 0.30 across the band (the same colour
 * darkened, not a second colour); one shine on the rear bobble; no trim. The band rests
 * on the head: its lower edge sits 0.6 inside the head outline's fill, except toward the
 * snout, where the head falls away and it keeps the Head footprint's floor (lowest ink
 * y -19.5). Ink included it fills HEAD_FOOTPRINT, x 16.4 to 43.8, the bobbles' top about
 * y -43.4, clear of the gill stems (x 16 or more), the lash reach circles and the cheek
 * heart.
 */
function paintBeeHeadband(ctx: CanvasRenderingContext2D): void {
  const band = beeBandPath();
  const stems = BEE_ANTENNAE.map((a) => {
    const base: Pt = { x: a.baseX, y: beeBandLowerAt(a.baseX) - BEE_BAND_THICK * 0.6 };
    const stem = new Path2D();
    stem.moveTo(base.x, base.y);
    stem.quadraticCurveTo(a.ctrl.x, a.ctrl.y, a.tip.x, a.tip.y);
    return stem;
  });
  const bobbles = BEE_ANTENNAE.map((a) => ellipsePath(a.tip.x, a.tip.y, BEE_BOBBLE_R, BEE_BOBBLE_R));
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * ITEM_LW;
  ctx.stroke(band);
  for (const bobble of bobbles) ctx.stroke(bobble);
  ctx.lineWidth = BEE_STEM_W + 2 * ITEM_LW;
  for (const stem of stems) ctx.stroke(stem);
  ctx.fillStyle = BEE_HEADBAND_FILL;
  ctx.fill(band);
  for (const bobble of bobbles) ctx.fill(bobble);
  ctx.strokeStyle = BEE_HEADBAND_FILL;
  ctx.lineWidth = BEE_STEM_W;
  for (const stem of stems) ctx.stroke(stem);
  ctx.save();
  ctx.clip(band);
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  for (const x of BEE_STRIPES) ctx.fill(rectPath(x - BEE_STRIPE_W / 2, -40, x + BEE_STRIPE_W / 2, -15));
  ctx.restore();
  shine(ctx, BEE_ANTENNAE[0].tip.x - 1, BEE_ANTENNAE[0].tip.y - 1, 1.1, 0.6, -0.6);
}

// ---------------------------------------------------------------------------
// Neck: Bandana (Common)
// ---------------------------------------------------------------------------

/** The polka dots: x of each along the band (clear of the shine at x 12.5 to 16.5), alternating between these shares of the band's height, and the dot radius. */
const BANDANA_DOT_X: readonly number[] = [9, 19.5, 23.8, 28.1, 32.4, 36.7];
const BANDANA_DOT_AT: readonly [number, number] = [0.62, 0.38];
const BANDANA_DOT_R = 0.8;

/**
 * Common (issue #103): the Pond-weed scarf's band (the whole Neck footprint, under the
 * chin and round the back of the neck, one `blob` with 0.6 of ink outside the fill,
 * kept inside LW / 2 of the silhouette outline) in a #f2c8ff orchid kerchief, with
 * six polka dots in ink at alpha 0.30, alternating high and low along the band (the
 * same colour darkened, not a second colour), clipped to it, and one shine. No trim.
 * It keeps every clearance of the scarf's band, so it keeps off the gill-root zone
 * and the cheek heart zone; the mouth paints over its front.
 */
function paintBandana(ctx: CanvasRenderingContext2D): void {
  const band = scarfBandPath();
  silhouette(ctx, [{ path: band, fill: BANDANA_FILL }], SCARF_OL);
  ctx.save();
  ctx.clip(band);
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  BANDANA_DOT_X.forEach((x, i) => {
    const upper = scarfUpperAt(x);
    const y = upper + BANDANA_DOT_AT[i % 2] * (scarfLowerAt(x) - upper);
    ctx.fill(ellipsePath(x, y, BANDANA_DOT_R, BANDANA_DOT_R));
  });
  ctx.restore();
  shine(ctx, 14.5, 16.4, 2, 0.6);
}

// ---------------------------------------------------------------------------
// Face: Sunflower sunglasses (Rare)
// ---------------------------------------------------------------------------

/** The sunflower on the bridge: centre (the Heart glasses' gem place), petal count, how far out each petal sits and its radii. */
const SUNFLOWER_AT: Pt = { x: 35.25, y: -14.85 };
const SUNFLOWER_PETALS = 8;
const SUNFLOWER_PETAL_OUT = 1.6;
const SUNFLOWER_PETAL_RX = 0.9;
const SUNFLOWER_PETAL_RY = 0.7;
const SUNFLOWER_CENTRE_R = 1.25;
/** Ink round the sunflower: the thin band ink (1.2, 0.6 outside), as the gem's outline. */
const SUNFLOWER_OL = BAND_LW / 2;

/**
 * Rare (issue #103): the glasses construction (guide 6i) in #ffed7a sunflower yellow:
 * the same merged two-lens frame with a band of 3.5 (colour 2.1, ink 0.7 each side), a
 * clear lens tint (white at 0.25, never dark) and the eyes painting above it, so
 * the eyes always show. Its one trim is a small sunflower perched on the bridge,
 * above the top notch, in the one place that clears both eye zones and stays in the
 * Face footprint (the Heart glasses' gem place): eight petals in the frame yellow,
 * merged into one `blob` with 0.6 of ink outside, round a #a8682a seed-brown centre.
 * Its petal tips reach the gem's radius, 2.5. No gem (that is the Heart glasses' Epic detail).
 */
function paintSunflowerSunglasses(ctx: CanvasRenderingContext2D): void {
  const frame = glassesPath();
  ctx.fillStyle = GLASSES_LENS;
  ctx.fill(frame);
  inkMany(ctx, [seg(frame, GLASSES_BAND_W, SUNFLOWER_FRAME, GLASSES_BAND_OL)]);
  const petals = Array.from({ length: SUNFLOWER_PETALS }, (_, k) => {
    const a = -Math.PI / 2 + (k * TAU) / SUNFLOWER_PETALS;
    return ellipsePath(
      SUNFLOWER_AT.x + Math.cos(a) * SUNFLOWER_PETAL_OUT,
      SUNFLOWER_AT.y + Math.sin(a) * SUNFLOWER_PETAL_OUT,
      SUNFLOWER_PETAL_RX,
      SUNFLOWER_PETAL_RY,
      a,
    );
  });
  silhouette(
    ctx,
    [
      ...petals.map((path) => ({ path, fill: SUNFLOWER_FRAME })),
      { path: ellipsePath(SUNFLOWER_AT.x, SUNFLOWER_AT.y, SUNFLOWER_CENTRE_R, SUNFLOWER_CENTRE_R), fill: SUNFLOWER_CENTRE },
    ],
    SUNFLOWER_OL,
  );
}

// ---------------------------------------------------------------------------
// Shirt: Embroidered shirt (Rare)
// ---------------------------------------------------------------------------

/** The embroidered hem band's place: how far down the torso half it starts (share of the inset ry below the centre line), and its height. */
const EMBROIDERY_BAND_AT = 0.56;
const EMBROIDERY_BAND_H = 3;
/** Thin ink lines on each side of the hem band, as the Water-lily shirt's. */
const EMBROIDERY_BAND_LW = 0.6;
/** The chest flower: its centre a share of the way along the Shirt and above the torso centre line (share of the inset ry). */
const EMBROIDERY_FLOWER_AT = 0.5;
const EMBROIDERY_FLOWER_RISE = 0.1;
/** The flower's five petals, one thread colour each: each centred this far out, with these radii, and the ink round the flower. */
const EMBROIDERY_PETAL_OUT = 2.6;
const EMBROIDERY_PETAL_RX = 2.25;
const EMBROIDERY_PETAL_RY = 1.7;
const EMBROIDERY_FLOWER_OL = 0.6;
const EMBROIDERY_CENTRE_R = 0.9;
/** The gap kept between the flower's ink and the neckline's ink (2.0 wide, its front at the apex x). */
const EMBROIDERY_NECK_GAP = 0.2;

/**
 * Rare (issue #103): the Tank top's silhouette (the whole Shirt footprint, `shape`
 * 2.0, the neckline arc) in a #fff4dc cream blouse, with one hem band in #7ee0c8 teal thread
 * (the one trim band, between two 0.6 ink lines, clipped inside the silhouette), and one
 * colourful flower embroidered on the chest: five merged petals in pink, orange, yellow, sky and lilac, a small `blob` with 0.6
 * of ink outside, round a centre of ink at alpha 0.30. The flower sits half way along the Shirt
 * (or further back, where the neckline would cut it, keeping 0.2 from the neckline ink) and
 * 0.1 of the inset ry above the centre line, clear of the band and of the shine. One shine
 * placed as on the Tank top. The flower is a picture detail; the counted Rare detail is
 * the band. It sits inside the silhouette, so it never reaches the torso edge band, the
 * front line, the tail root or a leg. No sleeves.
 */
function paintEmbroideredShirt(ctx: CanvasRenderingContext2D, look: AxolotlArtLook): void {
  const outline = shirtOutline(look);
  const shirt = shirtGeometry(look);
  const e = shirt.inset;
  inkedShape(ctx, outline.body, EMBROIDERED_SHIRT_FILL, () => {
    const y0 = e.cy + e.ry * EMBROIDERY_BAND_AT;
    trimBand(ctx, { x0: outline.xr - 1, x1: outline.xf + 1, y0, y1: y0 + EMBROIDERY_BAND_H }, EMBROIDERY_BAND, true, EMBROIDERY_BAND_LW);
    const reach = EMBROIDERY_PETAL_OUT + EMBROIDERY_PETAL_RX + EMBROIDERY_FLOWER_OL;
    const cx = Math.min(
      outline.xr + (outline.xf - outline.xr) * EMBROIDERY_FLOWER_AT,
      shirt.neckline.apexX - 2 * outline.half - reach - EMBROIDERY_NECK_GAP,
    );
    const cy = e.cy - e.ry * EMBROIDERY_FLOWER_RISE;
    const petals = EMBROIDERY_PETALS.map((fill, k) => {
      const a = -Math.PI / 2 + (k * TAU) / EMBROIDERY_PETALS.length;
      return {
        path: ellipsePath(
          cx + Math.cos(a) * EMBROIDERY_PETAL_OUT,
          cy + Math.sin(a) * EMBROIDERY_PETAL_OUT,
          EMBROIDERY_PETAL_RX,
          EMBROIDERY_PETAL_RY,
          a,
        ),
        fill,
      };
    });
    silhouette(ctx, petals, EMBROIDERY_FLOWER_OL);
    ctx.save();
    ctx.globalAlpha = SOCK_STRIPE_ALPHA;
    ctx.fillStyle = INK;
    ctx.fill(ellipsePath(cx, cy, EMBROIDERY_CENTRE_R, EMBROIDERY_CENTRE_R));
    ctx.restore();
  });
  shirtShine(ctx, outline);
}

// ---------------------------------------------------------------------------
// Tail: Hummingbird tail ribbon (Epic)
// ---------------------------------------------------------------------------

/** The knot, in the Tail frame: its centre (a little into the core, as the bow's knot) and radii. */
const HUMMINGBIRD_KNOT: Pt = { x: 0, y: 1.4 };
const HUMMINGBIRD_KNOT_RX = 3.2;
const HUMMINGBIRD_KNOT_RY = 3.4;
/** The two feather loops that rise from the knot, the head-side one first: axis angle, half length and half width. */
const HUMMINGBIRD_LOOPS: readonly { readonly rot: number; readonly half: number; readonly wide: number }[] = [
  { rot: -1.15, half: 6.8, wide: 3.3 },
  { rot: -Math.PI + 1.15, half: 5.8, wide: 3 },
];
/**
 * The two forked streamers that hang from the knot like a hummingbird's tail: which side, how far the axis tips
 * down from the tail line (radians) and its length. The one toward the tail tip is short, as the Golden bow's and the
 * Pearl tail charm's, so a Dream marker star past it stays clear at every swim phase.
 */
const HUMMINGBIRD_STREAMERS: readonly { readonly side: 1 | -1; readonly angle: number; readonly length: number }[] = [
  { side: 1, angle: 0.5, length: 14 },
  { side: -1, angle: 0.8, length: 8 },
];
/** A streamer's shape along its axis (a) and across it (b): where the base is, the half widths, and how deep the fork cuts. */
const STREAMER_BASE_A = 0.5;
const STREAMER_BASE_HALF = 2.1;
const STREAMER_END_HALF = 3;
const STREAMER_FORK = 3;

/** A forked streamer from the knot, a closed path in the Tail frame. */
function streamerPath(side: 1 | -1, angle: number, length: number): Path2D {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const at = (a: number, b: number): Pt => ({ x: HUMMINGBIRD_KNOT.x + side * (a * c - b * s), y: HUMMINGBIRD_KNOT.y + a * s + b * c });
  return roundedPolygon(
    [
      at(STREAMER_BASE_A, -STREAMER_BASE_HALF),
      at(length, -STREAMER_END_HALF),
      at(length - STREAMER_FORK, 0),
      at(length, STREAMER_END_HALF),
      at(STREAMER_BASE_A, STREAMER_BASE_HALF),
    ],
    [0.8, 0.8, 0.5, 0.8, 0.8],
  );
}

/**
 * Epic (issue #103): a bow of #9eecd6 iridescent ribbon: two feather loops rising from
 * the knot and two forked streamers hanging over the tail core like a hummingbird's
 * tail, one merged `blob` silhouette (ink 2.0 all outside the fill), with one rounded
 * gem (radius 2.5, outline 1.2, the Golden bow's pink) on the knot: the Epic detail. One
 * shine on the head-side loop; no trim. Painted in the Tail frame (x' along the local tail
 * direction toward the head, y' down). The streamer toward the tail tip is short (to
 * x' about -7.7), as the Golden bow's, so a Dream marker star past it stays clear at
 * every swim phase. Everything, ink included, stays within TAIL_SLOT_REACH of the anchor.
 */
function paintHummingbirdTailRibbon(ctx: CanvasRenderingContext2D): void {
  const loops = HUMMINGBIRD_LOOPS.map((l) => {
    const dx = Math.cos(l.rot);
    const dy = Math.sin(l.rot);
    return leafPath(HUMMINGBIRD_KNOT.x + dx * l.half, HUMMINGBIRD_KNOT.y + dy * l.half, l.half, l.wide, l.rot);
  });
  const streamers = HUMMINGBIRD_STREAMERS.map((s) => streamerPath(s.side, s.angle, s.length));
  const knot = ellipsePath(HUMMINGBIRD_KNOT.x, HUMMINGBIRD_KNOT.y, HUMMINGBIRD_KNOT_RX, HUMMINGBIRD_KNOT_RY);
  silhouette(ctx, [...loops, ...streamers, knot].map((path) => ({ path, fill: HUMMINGBIRD_RIBBON_FILL })));
  const head = HUMMINGBIRD_LOOPS[0];
  const along = { x: Math.cos(head.rot), y: Math.sin(head.rot) };
  shine(ctx, HUMMINGBIRD_KNOT.x + along.x * head.half - along.y * -0.9, HUMMINGBIRD_KNOT.y + along.y * head.half + along.x * -0.9, 1.2, 0.55, head.rot);
  gem(ctx, HUMMINGBIRD_KNOT.x, HUMMINGBIRD_KNOT.y, BOW_GEM, BAND_LW);
}

// ---------------------------------------------------------------------------
// Back: Rainbow serape cape (Legendary)
// ---------------------------------------------------------------------------

/** How far the cape's top edge sags between the shoulders (a draped blanket), and its collar corner radius. */
const SERAPE_SAG = 1.8;
const SERAPE_CORNER_R = 2.4;
/** Thin ink lines between the stripes, so pale neighbours read apart. */
const SERAPE_LINE_LW = 0.6;
/** The gold clasp band at the front: from this far behind the front end to this far, and the star's place behind the front. */
const SERAPE_BAND_FROM = 4.4;
const SERAPE_BAND_TO = 2;
const SERAPE_BAND_LW = 0.6;
const SERAPE_STAR_BACK = 9;
const SERAPE_STAR_V = -7;

/**
 * Legendary (issue #103): a serape draped along the back, its top edge sagging a little between square, softly
 * rounded ends, striped from the rear to the front in six pale rainbow stripes (pink, orange, yellow, green, blue
 * and violet, none red) with thin ink lines between them. It is one `blob` silhouette (ink 2.0 all outside the
 * fill) in the Back box of the look, ink included: the fills are 2.0 inside the box, so the serape runs the box's
 * length and stands 13 proud of the back. The stripes are clipped inside the silhouette; the first stripe is the
 * silhouette's own fill. The Legendary trim is one #ffc12e clasp band across the front (between two 0.6 ink
 * lines, clipped inside) and one static 4-point star (R 3, outline 1.2) behind it. One shine. No gem. Painted in
 * the Back frame (x' along the torso edge toward the snout, y' + into the body), so its lower edge, y' +1,
 * keeps off the Shirt.
 */
function paintRainbowSerapeCape(ctx: CanvasRenderingContext2D, box: BackFrameBox): void {
  const top = box.minV + ITEM_LW;
  const bottom = box.maxV - ITEM_LW;
  const rear = box.minU + ITEM_LW;
  const front = box.maxU - ITEM_LW;
  const length = front - rear;
  const cape = new Path2D();
  cape.moveTo(rear, bottom);
  cape.lineTo(rear, top + SERAPE_CORNER_R);
  cape.quadraticCurveTo(rear, top, rear + SERAPE_CORNER_R, top);
  cape.quadraticCurveTo(rear + length / 2, top + 2 * SERAPE_SAG, front - SERAPE_CORNER_R, top);
  cape.quadraticCurveTo(front, top, front, top + SERAPE_CORNER_R);
  cape.lineTo(front, bottom);
  cape.closePath();
  silhouette(ctx, [{ path: cape, fill: SERAPE_STRIPES[0] }]);
  ctx.save();
  ctx.clip(cape);
  const edge = (i: number): number => rear + (length * i) / SERAPE_STRIPES.length;
  SERAPE_STRIPES.forEach((fill, i) => {
    if (i === 0) return;
    ctx.fillStyle = fill;
    ctx.fill(rectPath(edge(i), top - 1, i === SERAPE_STRIPES.length - 1 ? front + 1 : edge(i + 1), bottom + 1));
  });
  ctx.strokeStyle = INK;
  ctx.lineWidth = SERAPE_LINE_LW;
  for (let i = 1; i < SERAPE_STRIPES.length; i++) ctx.stroke(line(edge(i), top - 1, edge(i), bottom + 1));
  trimBand(ctx, { x0: front - SERAPE_BAND_FROM, x1: front - SERAPE_BAND_TO, y0: top - 1, y1: bottom + 1 }, GOLD_TRIM, false, SERAPE_BAND_LW);
  ctx.restore();
  shine(ctx, rear + 2, top + 3.4, 1, 0.7, -0.1);
  legendStar(ctx, front - SERAPE_STAR_BACK, SERAPE_STAR_V, BAND_LW);
}

// ---------------------------------------------------------------------------
// Head: Miner's headlamp (Common)
// ---------------------------------------------------------------------------

/** The hard hat's brim: the Sun hat's tilted ellipse, a little narrower (centre x, y, radii and tilt). */
const LAMP_BRIM = { cx: 31, cy: -25.18, rx: 12.6, ry: 3.6, rot: -0.06 } as const;
/** The helmet dome: its base on the brim (x from, x to, y) and its top y. */
const LAMP_DOME = { x0: 23, x1: 39.2, base: -25.6, top: -37.4 } as const;
/** The lamp housing on the dome's front: centre and radius; the lens inside it (ink at the stripe alpha) is this share of the radius. */
const LAMP_HOUSING: Pt = { x: 38.4, y: -31.6 };
const LAMP_HOUSING_R = 3.4;
const LAMP_LENS_SHARE = 0.55;
/** The helmet's centre rib: ink at the stripe alpha, this wide, along the dome from its top to its base, at this x. */
const LAMP_RIB_X = 29.4;
const LAMP_RIB_W = 1.4;

/** The dome as one closed path: rising from the base at the rear, over the top, down to the base at the front. */
function lampDomePath(): Path2D {
  const { x0, x1, base, top } = LAMP_DOME;
  const mid = (x0 + x1) / 2;
  const dome = new Path2D();
  dome.moveTo(x0, base);
  dome.bezierCurveTo(x0 - 0.6, base - (base - top) * 0.7, mid - 4.4, top, mid, top);
  dome.bezierCurveTo(mid + 4.4, top, x1 + 0.6, base - (base - top) * 0.7, x1, base);
  dome.closePath();
  return dome;
}

/**
 * Common (issue #77): a #ffd98a pale amber hard hat, the Sun hat's hat construction: a tilted
 * brim ellipse and a domed crown merged with a round lamp housing on the front, one `blob`
 * silhouette (ink 2.0 all outside the fill). Inside it, the lamp lens (a disc of ink at the stripe
 * alpha: the same colour darkened, not a second colour) and one centre rib down the dome (the
 * same ink alpha), clipped to the hat; one shine; no trim. Ink included it fills HEAD_FOOTPRINT:
 * x 16.4 to 45.6, lowest ink y -19.5 on the brim, as the Sun hat's, so the glasses keep their
 * clearance; the dome's top is about y -39.4.
 */
function paintMinersHeadlamp(ctx: CanvasRenderingContext2D): void {
  const brim = ellipsePath(LAMP_BRIM.cx, LAMP_BRIM.cy, LAMP_BRIM.rx, LAMP_BRIM.ry, LAMP_BRIM.rot);
  const dome = lampDomePath();
  const housing = ellipsePath(LAMP_HOUSING.x, LAMP_HOUSING.y, LAMP_HOUSING_R, LAMP_HOUSING_R);
  blobs(ctx, [brim, dome, housing], MINERS_HELMET_FILL);
  ctx.save();
  ctx.clip(dome);
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  ctx.fill(rectPath(LAMP_RIB_X - LAMP_RIB_W / 2, LAMP_DOME.top - 1, LAMP_RIB_X + LAMP_RIB_W / 2, LAMP_DOME.base + 1));
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.fillStyle = INK;
  ctx.fill(ellipsePath(LAMP_HOUSING.x, LAMP_HOUSING.y, LAMP_HOUSING_R * LAMP_LENS_SHARE, LAMP_HOUSING_R * LAMP_LENS_SHARE));
  ctx.restore();
  shine(ctx, 26, -33.4, 1.1, 3, 0.2);
}

// ---------------------------------------------------------------------------
// Neck: Crystal pendant (Common)
// ---------------------------------------------------------------------------

/** The chain: from this x to this x, and its share of the Pond-weed scarf's band height (it hangs inside the band). */
const PENDANT_CHAIN_X0 = 4.4;
const PENDANT_CHAIN_X1 = 39.6;
const PENDANT_CHAIN_SHARE = 0.92;
/** The crystal: centre x, its half width, its most half height (fitted to the band), and the share of the half height its widest point sits above the centre. */
const PENDANT_X = 27.6;
const PENDANT_HALF_W = 4.2;
const PENDANT_MAX_HALF_H = 4.3;
const PENDANT_WAIST = 0.18;
/** The ink ring round the crystal that sets it off the chain (as the Pearl tail charm's ring), and its facet lines (ink at the stripe alpha), each this wide. */
const PENDANT_RING_LW = 0.9;
const PENDANT_FACET_LW = 0.9;

/** The chain: a band PENDANT_CHAIN_SHARE of the scarf band's height from the first x to the last, centred in the band. */
function pendantChainPath(): Path2D {
  const inset = (1 - PENDANT_CHAIN_SHARE) / 2;
  const upper = (x: number): number => scarfUpperAt(x) + inset * (scarfLowerAt(x) - scarfUpperAt(x));
  const lower = (x: number): number => scarfLowerAt(x) - inset * (scarfLowerAt(x) - scarfUpperAt(x));
  const steps = Math.round((PENDANT_CHAIN_X1 - PENDANT_CHAIN_X0) / 0.5);
  const xs = Array.from({ length: steps + 1 }, (_, i) => PENDANT_CHAIN_X0 + ((PENDANT_CHAIN_X1 - PENDANT_CHAIN_X0) * i) / steps);
  const chain = new Path2D();
  xs.forEach((x, i) => (i === 0 ? chain.moveTo(x, upper(x)) : chain.lineTo(x, upper(x))));
  for (let i = steps; i >= 0; i--) chain.lineTo(xs[i], lower(xs[i]));
  chain.closePath();
  return chain;
}

/** The crystal's four corners (a long diamond with the widest point above the middle), fitted inside the scarf band at PENDANT_X. */
function pendantCrystal(): { readonly points: readonly Pt[]; readonly centre: Pt } {
  const upper = scarfUpperAt(PENDANT_X);
  const lower = scarfLowerAt(PENDANT_X);
  const centre: Pt = { x: PENDANT_X, y: (upper + lower) / 2 };
  const half = Math.min(PENDANT_MAX_HALF_H, (lower - upper) / 2 - 0.1);
  const waistY = centre.y - half * PENDANT_WAIST;
  return {
    centre,
    points: [
      { x: centre.x, y: centre.y - half },
      { x: centre.x + PENDANT_HALF_W, y: waistY },
      { x: centre.x, y: centre.y + half },
      { x: centre.x - PENDANT_HALF_W, y: waistY },
    ],
  };
}

/**
 * Common (issue #77): a #c9f3ea pale teal crystal on a chain of the same colour, strung round the
 * neck: the Pond-weed scarf's band, with the chain a share of its height and the crystal a long
 * diamond that fits it, merged into one `blob` silhouette with ink 0.6 outside the fill (as the
 * scarf: the Neck footprint is too shallow for 2.0). A thin ink ring (0.9) sets the crystal off the
 * chain, as the Pearl tail charm's ring does the pearl. The crystal has a girdle line and a centre
 * line (ink at the stripe alpha, the same colour darkened, not a second colour) and one shine on
 * it; no trim. Everything lies inside the scarf's band, so it keeps the gill-root zone, the cheek
 * heart zone and the silhouette outline's outer half as the scarf does; the mouth paints over its front.
 */
function paintCrystalPendant(ctx: CanvasRenderingContext2D): void {
  const crystal = pendantCrystal();
  const gemPath = roundedPolygon(crystal.points, 0.35);
  silhouette(
    ctx,
    [
      { path: pendantChainPath(), fill: CAVE_CRYSTAL_FILL },
      { path: gemPath, fill: CAVE_CRYSTAL_FILL },
    ],
    SCARF_OL,
  );
  ctx.strokeStyle = INK;
  ctx.lineWidth = PENDANT_RING_LW;
  ctx.stroke(gemPath);
  const [top, right, bottom, left] = crystal.points;
  const facets = new Path2D();
  facets.moveTo(left.x, left.y);
  facets.lineTo(right.x, right.y);
  facets.moveTo(top.x, top.y);
  facets.lineTo(crystal.centre.x - 0.6, left.y);
  facets.lineTo(bottom.x, bottom.y);
  ctx.save();
  ctx.globalAlpha = SOCK_STRIPE_ALPHA;
  ctx.strokeStyle = INK;
  ctx.lineWidth = PENDANT_FACET_LW;
  ctx.stroke(facets);
  ctx.restore();
  shine(ctx, crystal.centre.x + 1.5, crystal.points[0].y + 2.6, 0.5, 1.2, 0.5);
}

// ---------------------------------------------------------------------------
// Shirt: Explorer vest (Rare)
// ---------------------------------------------------------------------------

/** The belt's place: how far down the torso half it starts (share of the inset ry below the centre line), and its height. */
const VEST_BELT_AT = 0.56;
const VEST_BELT_H = 3;
/** Thin ink lines on each side of the belt, as the Embroidered shirt's hem band. */
const VEST_BELT_LW = 0.6;
/**
 * Rare (issue #77): the Tank top's silhouette (the whole Shirt footprint, `shape` 2.0, the neckline
 * arc) in a #e4ecb4 pale khaki canvas, with one #b98a50 belt strap across the lower torso (the one
 * trim band, between two 0.6 ink lines, clipped inside the silhouette) and one shine placed as on
 * the Tank top. No pocket: a patch of ink would hide the canvas the swim-view floor counts on a
 * Baby's short Shirt. It sits inside the silhouette, so it never reaches the torso edge band, the
 * front line, the tail root or a leg. No sleeves.
 */
function paintExplorerVest(ctx: CanvasRenderingContext2D, look: AxolotlArtLook): void {
  const outline = shirtOutline(look);
  const shirt = shirtGeometry(look);
  const e = shirt.inset;
  inkedShape(ctx, outline.body, EXPLORER_VEST_FILL, () => {
    const y0 = e.cy + e.ry * VEST_BELT_AT;
    trimBand(ctx, { x0: outline.xr - 1, x1: outline.xf + 1, y0, y1: y0 + VEST_BELT_H }, EXPLORER_VEST_BELT, true, VEST_BELT_LW);
  });
  shirtShine(ctx, outline);
}

// ---------------------------------------------------------------------------
// Tail: Crystal tail cuff (Epic)
// ---------------------------------------------------------------------------

/** The cuff band across the tail, in the Tail frame: x' from, x' to, y' from (above the core top), y' to, and its corner radius. */
const CUFF_BAND = { x0: -3.4, x1: 3.8, y0: -3.6, y1: 13, r: 2.4 } as const;
/**
 * The three crystal points that jut from the band toward the head and up, the head-side ones leaning
 * further: where each leaves the band, its lean (radians from straight up, toward the head), its
 * length and half width. Nothing reaches toward the tail tip past the band, so a Dream marker star
 * past it stays clear at every swim phase.
 */
const CUFF_CRYSTALS: readonly { readonly base: Pt; readonly lean: number; readonly length: number; readonly half: number }[] = [
  { base: { x: -0.4, y: -2.6 }, lean: 0.05, length: 9.4, half: 2.5 },
  { base: { x: 2.6, y: -2.4 }, lean: 0.62, length: 9, half: 2.4 },
  { base: { x: 3.4, y: 0.6 }, lean: 1.2, length: 8.8, half: 2.3 },
];
/** The gem on the band: its centre. */
const CUFF_GEM: Pt = { x: 0.2, y: 6.2 };

/** One crystal point: a pentagon from its base along the lean, a long tip and shoulders at 0.7 of its length. */
function cuffCrystalPath(c: (typeof CUFF_CRYSTALS)[number]): Path2D {
  const ux = Math.sin(c.lean);
  const uy = -Math.cos(c.lean);
  const at = (a: number, b: number): Pt => ({ x: c.base.x + a * ux - b * uy, y: c.base.y + a * uy + b * ux });
  return roundedPolygon([at(-1, -c.half), at(c.length * 0.68, -c.half), at(c.length, 0), at(c.length * 0.68, c.half), at(-1, c.half)], [0.5, 0.9, 0.7, 0.9, 0.5]);
}

/**
 * Epic (issue #77): a cuff of CRYSTAL_CUFF_BAND pebble grey wrapped across the tail, with three #c9f3ea
 * pale teal crystal points jutting from it up and toward the head, one merged `blob` silhouette
 * (ink 2.0 all outside the fill), and one rounded gem (radius 2.5, outline 1.2, the Golden bow's pink)
 * on the band: the Epic detail. One shine on the tallest crystal; no trim. Painted in the Tail frame
 * (x' along the local tail direction toward the head, y' down). Everything is behind the band toward the
 * tail tip, so a Dream marker star past it stays clear at every swim phase; everything, ink included,
 * stays within TAIL_SLOT_REACH of the anchor.
 */
function paintCrystalTailCuff(ctx: CanvasRenderingContext2D): void {
  const { x0, x1, y0, y1, r } = CUFF_BAND;
  silhouette(ctx, [
    ...CUFF_CRYSTALS.map((c) => ({ path: cuffCrystalPath(c), fill: CAVE_CRYSTAL_FILL })),
    { path: roundRectPath(x0, y0, x1, y1, r), fill: CRYSTAL_CUFF_BAND },
  ]);
  const tall = CUFF_CRYSTALS[0];
  shine(ctx, tall.base.x - 0.7, tall.base.y - tall.length * 0.5, 0.55, 1.5, 0.05);
  gem(ctx, CUFF_GEM.x, CUFF_GEM.y, BOW_GEM, BAND_LW);
}

// ---------------------------------------------------------------------------
// Head: Crystal crown (Legendary)
// ---------------------------------------------------------------------------

/** The crown's base band: fill ends along x (round ends included), thickness, and how its lower edge rests on the head (as the Bee headband's). */
const CROWN_BAND_X0 = 18.4;
const CROWN_BAND_X1 = 42.2;
const CROWN_BAND_THICK = 5.4;
const CROWN_BAND_FLOOR = -21.5;
const CROWN_BAND_SINK = 0.6;
/** The gold band along the crown band's middle: its colour width, and the thin ink lines on each side. */
const CROWN_GOLD_W = 1.8;
const CROWN_GOLD_LW = 0.6;
/**
 * The five crystal points: x of each base centre, height above the band's top edge, and half width at the
 * shoulders. A point is wider at its foot, CROWN_POINT_FOOT more each side, so neighbours meet at the band
 * and part above it.
 */
const CROWN_POINTS: readonly { readonly x: number; readonly height: number; readonly half: number }[] = [
  { x: 22.2, height: 7.6, half: 2 },
  { x: 27, height: 11, half: 2.2 },
  { x: 31.8, height: 14, half: 2.4 },
  { x: 36.4, height: 10.4, half: 2.2 },
  { x: 40.4, height: 7, half: 1.9 },
];
const CROWN_POINT_FOOT = 1.1;
/** How far below the band's top edge each point's base sinks, so the two merge. */
const CROWN_POINT_SINK = 1.6;
/** The star's centre: above the front point, clear of it. */
const CROWN_STAR: Pt = { x: 41.4, y: -39.4 };

function crownLowerAt(x: number): number {
  return Math.min(headTopAt(x) + CROWN_BAND_SINK, CROWN_BAND_FLOOR);
}

/** The band as one closed path: its upper edge rear to front, a round front end, its lower edge back, a round rear end. */
function crownBandPath(): Path2D {
  const r = CROWN_BAND_THICK / 2;
  const xa = CROWN_BAND_X0 + r;
  const xb = CROWN_BAND_X1 - r;
  const steps = Math.round((xb - xa) / 0.5);
  const xs = Array.from({ length: steps + 1 }, (_, i) => xa + ((xb - xa) * i) / steps);
  const band = new Path2D();
  xs.forEach((x, i) => (i === 0 ? band.moveTo(x, crownLowerAt(x) - CROWN_BAND_THICK) : band.lineTo(x, crownLowerAt(x) - CROWN_BAND_THICK)));
  band.arc(xb, crownLowerAt(xb) - r, r, -Math.PI / 2, Math.PI / 2);
  for (let i = steps; i >= 0; i--) band.lineTo(xs[i], crownLowerAt(xs[i]));
  band.arc(xa, crownLowerAt(xa) - r, r, Math.PI / 2, (3 * Math.PI) / 2);
  band.closePath();
  return band;
}

/**
 * Legendary (issue #77): a pebble grey band hugging the head top (as the Bee headband's) under five
 * #c9f3ea pale teal crystal points, the middle one tallest, all one merged silhouette (ink 2.0 all
 * outside the fill; the band and the points share no ink between them). The Legendary trim is one
 * #ffc12e gold band along the middle of the base band (between two 0.6 ink lines, clipped inside it)
 * and one static 4-point star (R 3, outline 1.2) above the front point, outside the silhouette. One
 * shine on the middle point; no gem. The band rests on the head: its lower edge sits 0.6 inside the
 * head outline's fill, except toward the snout, where it keeps the Head footprint's floor (lowest ink
 * y -19.5). Ink included it fills HEAD_FOOTPRINT, x 16.4 to 44.2, the tallest point's top about y -41.
 */
function paintCrystalCrown(ctx: CanvasRenderingContext2D): void {
  const band = crownBandPath();
  const points = CROWN_POINTS.map((p) => {
    const bandTop = crownLowerAt(p.x) - CROWN_BAND_THICK;
    const baseY = bandTop + CROWN_POINT_SINK;
    return {
      path: roundedPolygon(
        [
          { x: p.x - p.half - CROWN_POINT_FOOT, y: baseY },
          { x: p.x - p.half, y: bandTop - p.height * 0.58 },
          { x: p.x, y: bandTop - p.height },
          { x: p.x + p.half, y: bandTop - p.height * 0.58 },
          { x: p.x + p.half + CROWN_POINT_FOOT, y: baseY },
        ],
        [0.4, 0.8, 0.9, 0.8, 0.4],
      ),
      fill: CAVE_CRYSTAL_FILL,
      bandTop,
    };
  });
  silhouette(ctx, [{ path: band, fill: CRYSTAL_CROWN_BAND }, ...points.map(({ path, fill }) => ({ path, fill }))]);
  ctx.save();
  ctx.clip(band);
  const mid = new Path2D();
  const xa = CROWN_BAND_X0 - 1;
  const xb = CROWN_BAND_X1 + 1;
  for (let x = xa; x <= xb + 1e-9; x += 0.5) {
    const y = crownLowerAt(x) - CROWN_BAND_THICK / 2;
    if (x === xa) mid.moveTo(x, y);
    else mid.lineTo(x, y);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = CROWN_GOLD_W + 2 * CROWN_GOLD_LW;
  ctx.stroke(mid);
  ctx.strokeStyle = GOLD_TRIM;
  ctx.lineWidth = CROWN_GOLD_W;
  ctx.stroke(mid);
  ctx.restore();
  const middle = points[2];
  shine(ctx, CROWN_POINTS[2].x - 0.8, middle.bandTop - 6.4, 0.55, 1.7, 0.1);
  legendStar(ctx, CROWN_STAR.x, CROWN_STAR.y, BAND_LW);
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Run `paint` in `frame`: origin at the frame origin, u along x, v along y. */
function inFrame(ctx: CanvasRenderingContext2D, frame: WearFrame, paint: () => void): void {
  ctx.translate(frame.x, frame.y);
  ctx.rotate(frame.angle);
  paint();
}

/**
 * Paint the item `outfit` wears in a body slot (Shirt, Tail, Neck, Back, Head
 * or Face), or nothing when the slot is empty. The caller picks the layer by
 * calling this at the slot's layer (WEARABLE_LAYERS, guide 6a). `swim` and
 * `tailAmp` place the Tail item on the waving tail.
 */
export function paintBodyWearable(
  ctx: CanvasRenderingContext2D,
  slot: BodyWearableSlot,
  outfit: ArtOutfit,
  look: AxolotlArtLook,
  swim: number,
  tailAmp: number,
): void {
  const slug = wornSlug(outfit, slot);
  if (slug === undefined) return;
  ctx.save();
  switch (slug) {
    case 'sun-hat':
      paintSunHat(ctx);
      break;
    case 'shell-necklace':
      paintShellNecklace(ctx);
      break;
    case 'heart-glasses':
      paintHeartGlasses(ctx);
      break;
    case 'golden-bow':
      inFrame(ctx, tailSlotFrame(axolotlBodyGeometry(look).tail, swim, tailAmp), () => paintGoldenBow(ctx));
      break;
    case 'tank-top':
      paintTankTop(ctx, look);
      break;
    case 'diving-tank': {
      const back = backFootprint(look);
      inFrame(ctx, back.frame, () => paintDivingTank(ctx, back.box));
      break;
    }
    case 'lily-flower-crown':
      paintLilyCrown(ctx);
      break;
    case 'pond-weed-scarf':
      paintPondWeedScarf(ctx);
      break;
    case 'dragonfly-glasses':
      paintDragonflyGlasses(ctx);
      break;
    case 'raincoat':
      paintRaincoat(ctx, look);
      break;
    case 'ladybug-backpack': {
      const back = backFootprint(look);
      inFrame(ctx, back.frame, () => paintLadybugBackpack(ctx, back.box));
      break;
    }
    case 'rainbow-dragonfly-wings': {
      const back = backFootprint(look);
      inFrame(ctx, back.frame, () => paintRainbowWings(ctx, back.box));
      break;
    }
    case 'feather-cap':
      paintFeatherCap(ctx);
      break;
    case 'water-lily-shirt':
      paintWaterLilyShirt(ctx, look);
      break;
    case 'pearl-tail-charm':
      inFrame(ctx, tailSlotFrame(axolotlBodyGeometry(look).tail, swim, tailAmp), () => paintPearlTailCharm(ctx));
      break;
    case 'firefly-cape': {
      const back = backFootprint(look);
      inFrame(ctx, back.frame, () => paintFireflyCape(ctx, back.box));
      break;
    }
    case 'straw-sun-hat':
      paintStrawSunHat(ctx);
      break;
    case 'marigold-necklace':
      paintMarigoldNecklace(ctx);
      break;
    case 'garden-overalls':
      paintGardenOveralls(ctx, look);
      break;
    case 'monarch-hair-clip':
      paintMonarchHairClip(ctx);
      break;
    case 'monarch-wings': {
      const back = backFootprint(look);
      inFrame(ctx, back.frame, () => paintMonarchWings(ctx, back.box));
      break;
    }
    case 'bee-headband':
      paintBeeHeadband(ctx);
      break;
    case 'bandana':
      paintBandana(ctx);
      break;
    case 'sunflower-sunglasses':
      paintSunflowerSunglasses(ctx);
      break;
    case 'embroidered-shirt':
      paintEmbroideredShirt(ctx, look);
      break;
    case 'hummingbird-tail-ribbon':
      inFrame(ctx, tailSlotFrame(axolotlBodyGeometry(look).tail, swim, tailAmp), () => paintHummingbirdTailRibbon(ctx));
      break;
    case 'rainbow-serape-cape': {
      const back = backFootprint(look);
      inFrame(ctx, back.frame, () => paintRainbowSerapeCape(ctx, back.box));
      break;
    }
    case 'miners-headlamp':
      paintMinersHeadlamp(ctx);
      break;
    case 'crystal-pendant':
      paintCrystalPendant(ctx);
      break;
    case 'explorer-vest':
      paintExplorerVest(ctx, look);
      break;
    case 'crystal-tail-cuff':
      inFrame(ctx, tailSlotFrame(axolotlBodyGeometry(look).tail, swim, tailAmp), () => paintCrystalTailCuff(ctx));
      break;
    case 'crystal-crown':
      paintCrystalCrown(ctx);
      break;
    default:
      break;
  }
  ctx.restore();
}

/**
 * Paint the Socks and Feet items on one present leg, in its frame (it turns
 * with the paddle): the Sock first, then the Feet item over it so the Sock
 * shows above it. The caller draws this only for a leg that is present, at the
 * leg's wearable layer (2.5 far legs, 3.5 near legs, guide 6a). Far legs use
 * the item colours mixed toward ink.
 */
export function paintLegWearables(ctx: CanvasRenderingContext2D, outfit: ArtOutfit, frame: LegSlotFrame): void {
  const socks = wornSlug(outfit, 'socks');
  const feet = wornSlug(outfit, 'feet');
  if (socks === undefined && feet === undefined) return;
  const tone = frame.side === 'far' ? FAR_TONE : NEAR_TONE;
  ctx.save();
  inFrame(ctx, frame, () => {
    if (socks === 'stripy-socks') paintStripySocks(ctx, frame, tone);
    if (socks === 'lily-pad-socks') paintLilyPadSocks(ctx, frame, tone);
    if (feet === 'flippers') paintFlippers(ctx, frame, tone);
    if (feet === 'froggy-boots') paintFroggyBoots(ctx, frame, tone);
  });
  ctx.restore();
}
