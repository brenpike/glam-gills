import * as Phaser from 'phaser';
import type { ChinampaTextures } from '../art/chinampaTextures';
import { GAP_EDGE_FLARE, GAP_EDGE_W, OVERHANG_H, OVERHANG_W } from '../art/drawChinampa';
import { ROOT_ARCH_ANCHOR_Y } from '../art/drawPond';
import { ROCK_LEDGE_H, ROCK_LEDGE_W } from '../art/drawSpringCave';
import type { CaveKind, HabitatLook } from '../art/habitatLook';
import { DEPTH } from '../art/layers';
import type { PondTextures } from '../art/pondTextures';
import type { SpringCaveTextures } from '../art/springCaveTextures';
import type { TexInfo } from '../art/textures';
import { treasureById, treasureSlug, type Rarity } from '../logic/catalogue';
import type { DarkWaterPart } from '../logic/glowPlants';
import { pastCurrentBand } from '../logic/hiding';
import { badgeShape, hintSparkleRadius, hintVisible } from '../logic/hints';
import type { MotionProfile } from '../logic/motion';
import type { PlacedFind } from '../logic/placement';
import { canalGlowShows, canalTreasureLook, rarityGlowAlpha } from '../logic/rarityGlow';
import type { TripEvent } from '../logic/trip';
import { isHeld, type FindId, type Holdings } from '../logic/tripBag';
import type { Vec2 } from '../logic/vec';
import type { CurrentZone, Point, ZoneLayout } from '../logic/zone';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

const TAU = Math.PI * 2;
/** The gap edges sit this far from the current's rect, px: the stake tips and streaming roots reach into it. */
const GAP_EDGE_GAP_PX = 2;
/**
 * Cave and marker base below the bed top, like the Home Spot burrow, so both sit in the drawn bed
 * edge (y 321 to 326 under them).
 */
const BED_SINK_PX = 6;
const ICON_SIZE = 28;
/** The rarity glow baked for the 28 px canal icon. */
const GLOW_SIZE = 40;
const ICON_BOB_PX = 2;
const ICON_BOB_PERIOD = 3;
const POP_LIFE_S = 0.4;
const POP_SCALE_TO = 1.3;
const HINT_OFFSET_Y = -20;
const HINT_GROW_FROM = 0.6;
const HINT_GROW_S = 0.4;
const HINT_FADE_S = 0.4;
const HINT_BOB_PX = 2;
const HINT_SPIN_RAD = 0.15;
const HINT_PERIOD = 2.4;
const BUBBLE_OFFSET_Y = -14;
const BUBBLE_LIFE_S = 1.5;
const BUBBLE_GROW_FROM = 0.6;
const BUBBLE_GROW_S = 0.15;
const WOBBLE_RAD = 0.08;
const WOBBLE_LIFE_S = 0.4;
const CRUMBLE_POOL = 3;
const CRUMBLE_LIFE_S = 0.6;
const SHARD_OUT_MIN_PX = 6;
const SHARD_OUT_MAX_PX = 10;
const SHARD_SINK_PX = 16;
/** The shards kept, still, under reduced motion. */
const STILL_SHARDS: readonly number[] = [0, 2, 4];
const TWINKLE_COUNT = 3;
const TWINKLE_SPREAD_PX = 6;
/** Crumble twinkles at about 12 px: the sparkle art is about 26 px across. */
const TWINKLE_SCALE = 0.46;

/**
 * Whether `part` at `at` shows through the area's dark water this frame (glowPlants shownInDark
 * with the frame's lights). Read every frame, so it may close over the trip's live lights.
 */
export type DarkShows = (part: DarkWaterPart, at: Readonly<Point>) => boolean;

/** An area with no dark water: everything shows. */
const ALWAYS_SHOWN: DarkShows = () => true;

/** One frame of treasure rendering input. `time` is the scene clock in seconds (frozen while paused). */
export interface TreasureFrame {
  placed: readonly PlacedFind[];
  holdings: Holdings;
  axolotl: Point;
  motion: MotionProfile;
  dt: number;
  time: number;
}

/**
 * One catalogue find's sprites and effect state. Ages count up from 0 while their effect runs,
 * else null. `hintInRange` is the latest hint range result (the hysteresis input); `hintShownAge`
 * runs while the star is shown and `hintFadeAge` while it fades out; `hintScale` is the star scale
 * when it last showed, so a fade keeps it. `glow` is the rarity glow behind a revealed or popping
 * icon, at `glowBaseScale`.
 */
interface FindSprites {
  id: FindId;
  rarity: Rarity;
  phase: number;
  iconBaseScale: number;
  starBaseScale: number;
  glowBaseScale: number;
  icon: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  pot: Phaser.GameObjects.Image;
  star: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Image;
  popAge: number | null;
  bubbleAge: number | null;
  wobbleAge: number | null;
  hintInRange: boolean;
  hintShownAge: number | null;
  hintFadeAge: number | null;
  hintScale: number;
}

interface CrumblePiece {
  image: Phaser.GameObjects.Image;
  direction: Vec2;
  distance: number;
}

interface Crumble {
  shards: CrumblePiece[];
  twinkles: CrumblePiece[];
  at: Point;
  age: number;
}

/** A running effect's age after `dt` more seconds, or null when it is not running or is over. */
function nextAge(age: number | null, dt: number, lifeS: number): number | null {
  if (age === null) return null;
  const next = age + dt;
  return next >= lifeS ? null : next;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, x: number, y: number, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth);
}

function unitAt(index: number, count: number): Vec2 {
  const angle = (index / count) * TAU - Math.PI / 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** The marker x: the middle of the current's past band (pastCurrentBand). Throws when it has none. */
function pastCurrentMarkerX(current: CurrentZone): number {
  const band = pastCurrentBand(current);
  if (band === null) {
    throw new Error(`TreasureView: current "${current.id}" has no sideways flow, so it has no past band`);
  }
  return (band.edgeX + band.farX) / 2;
}

/** The baked pond props for a cave of kind `kind`. Throws when they were not baked. */
function pondTexturesFor(assets: GameAssets, kind: CaveKind): PondTextures {
  if (assets.pond === null) {
    throw new Error(`TreasureView: a "${kind}" cave needs the baked pond textures`);
  }
  return assets.pond;
}

/** The baked spring cave props. Throws when they were not baked. */
function springCaveTexturesFor(assets: GameAssets, what: string): SpringCaveTextures {
  if (assets.springCave === null) {
    throw new Error(`TreasureView: ${what} needs the baked spring cave textures`);
  }
  return assets.springCave;
}

/**
 * The back and front of the cave for `look`'s cave kind: the canal's small cave of rocks, the
 * pond's hollow log, the dusk pond's root arch, the chinampa's root tangle, or the spring cave's
 * side grotto.
 */
function caveTextures(assets: GameAssets, look: HabitatLook): { back: TexInfo; front: TexInfo } {
  const kind = look.cave.kind;
  switch (kind) {
    case 'rocks':
      return { back: assets.baked.hiding.caveBack, front: assets.baked.hiding.caveFront };
    case 'log': {
      const pond = pondTexturesFor(assets, kind);
      return { back: pond.logBack, front: pond.logFront };
    }
    case 'rootArch': {
      const rootArch = pondTexturesFor(assets, kind).rootArch;
      if (rootArch === null) {
        throw new Error('TreasureView: a "rootArch" cave needs the baked root arch');
      }
      return rootArch;
    }
    case 'rootTangle': {
      if (assets.chinampa === null) {
        throw new Error('TreasureView: a "rootTangle" cave needs the baked chinampa textures');
      }
      return assets.chinampa.rootTangle;
    }
    case 'grotto':
      return springCaveTexturesFor(assets, 'a "grotto" cave').grotto;
  }
}

/**
 * The y of the cave's anchor for `look`'s cave anchor: on the bed (base centre, sunk like the
 * Home Spot burrow), or at the waterline under the bank (top centre, ROOT_ARCH_ANCHOR_Y).
 */
function caveAnchorY(look: HabitatLook, zone: ZoneLayout): number {
  return look.cave.anchor === 'bank' ? ROOT_ARCH_ANCHOR_Y : zone.bedTop + BED_SINK_PX;
}

/** The baked chinampa props. Throws when they were not baked. */
function chinampaTexturesFor(assets: GameAssets, what: string): ChinampaTextures {
  if (assets.chinampa === null) {
    throw new Error(`TreasureView: ${what} needs the baked chinampa textures`);
  }
  return assets.chinampa;
}

/**
 * The overhang texture for `look` and its nominal size: the spring cave's rock ledge for a look with
 * the spring cave props, else the chinampa's bank overhang.
 */
function overhangArt(assets: GameAssets, look: HabitatLook): { info: TexInfo; w: number; h: number } {
  if (look.springCaveProps) {
    return { info: springCaveTexturesFor(assets, 'a rock ledge').rockLedge, w: ROCK_LEDGE_W, h: ROCK_LEDGE_H };
  }
  return { info: chinampaTexturesFor(assets, 'a bank overhang').overhang, w: OVERHANG_W, h: OVERHANG_H };
}

/**
 * One overhang sprite at each of the zone's bank overhang rects (a rock ledge for a look with the
 * spring cave props), stretched to the rect and drawn at the cave front's depth: above the hidden
 * treasure icons (DEPTH.hiddenTreasure) and under the haze, so what is under the bank reads as hidden
 * and tinted, like what is under the reeds. Placed from zone data only; a zone with no overhangs
 * places none.
 */
function placeBankOverhangs(scene: Phaser.Scene, assets: GameAssets, zone: ZoneLayout, look: HabitatLook): void {
  const overhangs = zone.bankOverhangs;
  if (overhangs === undefined || overhangs.length === 0) return;
  const { info, w, h } = overhangArt(assets, look);
  for (const rect of overhangs) {
    scene.add
      .image(rect.x0, rect.y0, info.key)
      .setOrigin(info.originNormX, info.originNormY)
      .setScale((rect.x1 - rect.x0) / w / info.scale, (rect.y1 - rect.y0) / h / info.scale)
      .setDepth(DEPTH.caveFront);
  }
}

/**
 * The chinampa edges either side of a current, the gap between two chinampas: one above the current's
 * rect and one below it, centred on it and flared past its ends. Their roots stream to the left, so a
 * current that flows right faces them the other way (the mirror is about the anchor, the centre of the
 * edge). Placed from the current's rect only.
 */
function placeGapEdges(scene: Phaser.Scene, assets: GameAssets, current: CurrentZone): void {
  const art = chinampaTexturesFor(assets, 'the gap between two chinampas').gapEdges;
  const x = (current.x0 + current.x1) / 2;
  const stretch = (current.x1 - current.x0 + 2 * GAP_EDGE_FLARE) / GAP_EDGE_W;
  const facing = current.force.x > 0 ? -1 : 1;
  for (const [info, y] of [
    [art.top, current.y0 - GAP_EDGE_GAP_PX],
    [art.bottom, current.y1 + GAP_EDGE_GAP_PX],
  ] as const) {
    const image = scene.add.image(x, y, info.key).setOrigin(info.originNormX, info.originNormY).setDepth(DEPTH.reeds);
    faceSprite(image, facing, stretch / info.scale, 1 / info.scale);
  }
}

function rarityOf(id: FindId): Rarity {
  const treasure = treasureById(id);
  if (!treasure) {
    throw new Error(`TreasureView: no catalogue treasure "${id}"`);
  }
  return treasure.rarity;
}

/**
 * Draws the hidden treasures and their hiding places: the cave (the canal's small cave of rocks or
 * the pond's hollow log on the bed, the dusk pond's root arch under the bank, the chinampa's root
 * tangle, or the spring cave's side grotto; interior and front), the overhang under each of the
 * zone's overhanging banks (a rock ledge in the spring cave), the chinampa
 * edges either side of a current of a look with a gap (`HabitatLook.currentGap`), the
 * past-the-current marker, one treasure icon per catalogue find (hidden under cover, or revealed by
 * a crumble), the Dash pots, the hint stars, the dash-needed bubble and pot wobble, the crumble and
 * the pickup pop. Visual only: every timer here is driven by the frame `dt` and the scene clock, so
 * it freezes with the scene, and nothing here changes game state. Every effect reads the current
 * motion setting each frame, so reduced motion applies mid-effect. Cue-object alpha only ever
 * decreases: stars grow in at full alpha and never fade in. Under the area's dark water (`shows`),
 * a find's icon and glow and its hint star are hidden until a light reaches the spot: the hint
 * stars draw above the axolotl, so the dark layer cannot cover them.
 */
export class TreasureView {
  private readonly assets: GameAssets;
  private readonly finds: FindSprites[];
  private readonly spritesById: ReadonlyMap<FindId, FindSprites>;
  private readonly crumbles: Crumble[];
  private crumbleCursor = 0;
  /** The placed list `placedById` indexes; the trip keeps the same array until a pot breaks or a trip starts. */
  private placedRef: readonly PlacedFind[] | null = null;
  private placedById: ReadonlyMap<FindId, PlacedFind> = new Map();
  /** Hint range multiplier from the explorer's Treasure sense perk (PRD B7), 1 with none; fixed for the trip. */
  private readonly hintMultiplier: number;
  /** Whether a part shows through the dark water this frame; everything shows in an area with none. */
  private readonly shows: DarkShows;

  constructor(
    scene: Phaser.Scene,
    assets: GameAssets,
    zone: ZoneLayout,
    look: HabitatLook,
    placed: readonly PlacedFind[],
    hintMultiplier: number,
    shows: DarkShows = ALWAYS_SHOWN,
  ) {
    this.assets = assets;
    this.hintMultiplier = hintMultiplier;
    this.shows = shows;
    const hiding = assets.baked.hiding;
    const baseY = zone.bedTop + BED_SINK_PX;
    const caveX = (zone.cave.x0 + zone.cave.x1) / 2;
    const caveY = caveAnchorY(look, zone);
    const cave = caveTextures(assets, look);
    bakedImage(scene, cave.back, caveX, caveY, DEPTH.caveBack);
    bakedImage(scene, cave.front, caveX, caveY, DEPTH.caveFront);
    placeBankOverhangs(scene, assets, zone, look);
    if (look.currentGap) for (const gap of zone.currents) placeGapEdges(scene, assets, gap);
    const current = zone.currents[0];
    if (!current) {
      throw new Error('TreasureView: the zone has no current for the past-the-current marker');
    }
    bakedImage(scene, hiding.currentMarker, pastCurrentMarkerX(current), baseY, DEPTH.currentMarker);
    this.finds = zone.finds.map((find, i) => this.createFindSprites(scene, find.id, i));
    this.spritesById = new Map(this.finds.map((sprites) => [sprites.id, sprites]));
    this.crumbles = Array.from({ length: CRUMBLE_POOL }, () => this.createCrumble(scene));
    this.reset(placed);
  }

  /** Starts the effects for this step's trip events: the dash-needed bubble and wobble, crumbles, pickup pops. */
  handleEvents(events: readonly TripEvent[]): void {
    for (const event of events) {
      if (event.type === 'dashNeeded') this.startDashNeeded(event.id);
      if (event.type === 'containerBroken') this.startCrumble(event.id, event.at);
      if (event.type === 'pickedUp') this.findSprites(event.id).popAge = 0;
    }
  }

  /** Draws one frame. */
  render(frame: TreasureFrame): void {
    const placedById = this.placedIndex(frame.placed);
    for (const sprites of this.finds) {
      const find = placedById.get(sprites.id);
      if (find) {
        this.renderFind(sprites, find, frame);
      } else {
        this.hideFind(sprites);
      }
    }
    for (const crumble of this.crumbles) this.renderCrumble(crumble, frame);
  }

  /**
   * New trip: re-places every sprite at its spot for `placed`, shows every placed pot sealed and
   * clears every effect, hint state and timer.
   */
  reset(placed: readonly PlacedFind[]): void {
    const placedById = this.placedIndex(placed);
    for (const sprites of this.finds) {
      this.hideFind(sprites);
      const find = placedById.get(sprites.id);
      if (!find) continue;
      sprites.icon.setPosition(find.x, find.y);
      sprites.glow.setPosition(find.x, find.y);
      sprites.pot.setPosition(find.x, find.y).setRotation(0).setVisible(find.sealed);
      sprites.star.setPosition(find.x, find.y + HINT_OFFSET_Y);
      sprites.bubble.setPosition(find.x, find.y + BUBBLE_OFFSET_Y);
    }
    for (const crumble of this.crumbles) {
      crumble.age = CRUMBLE_LIFE_S;
      for (const piece of [...crumble.shards, ...crumble.twinkles]) piece.image.setVisible(false);
    }
  }

  private createFindSprites(scene: Phaser.Scene, id: FindId, index: number): FindSprites {
    const hiding = this.assets.baked.hiding;
    const rarity = rarityOf(id);
    const icons: Readonly<Record<string, TexInfo | undefined>> = this.assets.treasure.icons[ICON_SIZE];
    const iconInfo = icons[treasureSlug(id)];
    if (!iconInfo) {
      throw new Error(`TreasureView: no ${ICON_SIZE} px icon for treasure "${id}"`);
    }
    const starInfo: TexInfo | undefined = hiding.hintStars[hintSparkleRadius(rarity)];
    if (!starInfo) {
      throw new Error(`TreasureView: no hint star for rarity "${rarity}"`);
    }
    const glowInfo: TexInfo | undefined = this.assets.treasure.glows[GLOW_SIZE][badgeShape(rarity)];
    if (!glowInfo) {
      throw new Error(`TreasureView: no ${GLOW_SIZE} px rarity glow for rarity "${rarity}"`);
    }
    return {
      id,
      rarity,
      phase: index,
      iconBaseScale: 1 / iconInfo.scale,
      starBaseScale: 1 / starInfo.scale,
      glowBaseScale: 1 / glowInfo.scale,
      icon: bakedImage(scene, iconInfo, 0, 0, DEPTH.hiddenTreasure).setVisible(false),
      glow: bakedImage(scene, glowInfo, 0, 0, DEPTH.treasureGlow).setVisible(false),
      pot: bakedImage(scene, hiding.pot, 0, 0, DEPTH.treasure).setVisible(false),
      star: bakedImage(scene, starInfo, 0, 0, DEPTH.hint).setVisible(false),
      bubble: bakedImage(scene, hiding.dashBubble, 0, 0, DEPTH.fx).setVisible(false),
      popAge: null,
      bubbleAge: null,
      wobbleAge: null,
      hintInRange: false,
      hintShownAge: null,
      hintFadeAge: null,
      hintScale: 1,
    };
  }

  private createCrumble(scene: Phaser.Scene): Crumble {
    const hiding = this.assets.baked.hiding;
    const span = SHARD_OUT_MAX_PX - SHARD_OUT_MIN_PX;
    const shards = hiding.shards.map((info, k) => ({
      image: bakedImage(scene, info, 0, 0, DEPTH.fx).setVisible(false),
      direction: unitAt(k, hiding.shards.length),
      distance: SHARD_OUT_MIN_PX + (span * k) / Math.max(1, hiding.shards.length - 1),
    }));
    const twinkles = Array.from({ length: TWINKLE_COUNT }, (_, k) => ({
      image: bakedImage(scene, this.assets.baked.sparkle, 0, 0, DEPTH.fx).setVisible(false),
      direction: unitAt(k, TWINKLE_COUNT),
      distance: TWINKLE_SPREAD_PX,
    }));
    return { shards, twinkles, at: { x: 0, y: 0 }, age: CRUMBLE_LIFE_S };
  }

  /** The placed treasures by id, rebuilt only when `placed` is a different array from last time. */
  private placedIndex(placed: readonly PlacedFind[]): ReadonlyMap<FindId, PlacedFind> {
    if (placed !== this.placedRef) {
      this.placedRef = placed;
      this.placedById = new Map(placed.map((find) => [find.id, find]));
    }
    return this.placedById;
  }

  private findSprites(id: FindId): FindSprites {
    const sprites = this.spritesById.get(id);
    if (!sprites) {
      throw new Error(`TreasureView: no sprites for find "${id}"`);
    }
    return sprites;
  }

  private startDashNeeded(id: FindId): void {
    const sprites = this.findSprites(id);
    sprites.bubbleAge = 0;
    sprites.wobbleAge = 0;
  }

  private startCrumble(id: FindId, at: Point): void {
    const sprites = this.findSprites(id);
    sprites.bubbleAge = null;
    sprites.wobbleAge = null;
    sprites.pot.setVisible(false);
    sprites.bubble.setVisible(false);
    const crumble = this.crumbles[this.crumbleCursor];
    this.crumbleCursor = (this.crumbleCursor + 1) % this.crumbles.length;
    crumble.at = { x: at.x, y: at.y };
    crumble.age = 0;
  }

  /** Not placed this trip (banked before it started): everything hidden, every effect over. */
  private hideFind(sprites: FindSprites): void {
    sprites.popAge = null;
    sprites.bubbleAge = null;
    sprites.wobbleAge = null;
    sprites.hintInRange = false;
    sprites.hintShownAge = null;
    sprites.hintFadeAge = null;
    sprites.hintScale = 1;
    sprites.icon.setVisible(false);
    sprites.glow.setVisible(false);
    sprites.pot.setVisible(false);
    sprites.star.setVisible(false);
    sprites.bubble.setVisible(false);
  }

  private renderFind(sprites: FindSprites, find: PlacedFind, frame: TreasureFrame): void {
    const held = isHeld(frame.holdings, find.id);
    const revealed = find.container && !find.sealed;
    this.renderPot(sprites, find, frame);
    this.renderBubble(sprites, find, frame);
    this.renderIcon(sprites, find, held, frame);
    if (!this.shows('find', find)) {
      sprites.icon.setVisible(false);
      sprites.glow.setVisible(false);
    }
    this.renderHint(sprites, find, !held && !revealed && this.shows('hint-sparkle', find), frame);
  }

  /** A sealed pot sits at the spot; a dash-needed bump wobbles it (full motion only). */
  private renderPot(sprites: FindSprites, find: PlacedFind, frame: TreasureFrame): void {
    sprites.wobbleAge = find.sealed ? nextAge(sprites.wobbleAge, frame.dt, WOBBLE_LIFE_S) : null;
    const wobble =
      frame.motion.ambient && sprites.wobbleAge !== null
        ? WOBBLE_RAD * Math.sin((TAU * sprites.wobbleAge) / WOBBLE_LIFE_S)
        : 0;
    sprites.pot.setVisible(find.sealed).setPosition(find.x, find.y).setRotation(wobble);
  }

  /** The dash-needed bubble holds over a sealed pot for its life; full motion grows it in first. */
  private renderBubble(sprites: FindSprites, find: PlacedFind, frame: TreasureFrame): void {
    sprites.bubbleAge = find.sealed ? nextAge(sprites.bubbleAge, frame.dt, BUBBLE_LIFE_S) : null;
    if (sprites.bubbleAge === null) {
      sprites.bubble.setVisible(false);
      return;
    }
    const grow = frame.motion.ambient
      ? BUBBLE_GROW_FROM + (1 - BUBBLE_GROW_FROM) * Math.min(1, sprites.bubbleAge / BUBBLE_GROW_S)
      : 1;
    sprites.bubble
      .setVisible(true)
      .setPosition(find.x, find.y + BUBBLE_OFFSET_Y)
      .setScale(grow / this.assets.baked.hiding.dashBubble.scale);
  }

  /**
   * Held: hidden, except while the pickup pop runs (full motion only, above the haze). Sealed:
   * hidden in its pot. Otherwise the icon bobs (full motion only) at the spot: above the haze once a
   * crumble revealed it, else under cover. The rarity glow follows the icon only while it is
   * revealed or popping (`canalGlowShows`).
   */
  private renderIcon(sprites: FindSprites, find: PlacedFind, held: boolean, frame: TreasureFrame): void {
    const ambient = frame.motion.ambient;
    const icon = sprites.icon;
    const base = sprites.iconBaseScale;
    const bob = ambient ? ICON_BOB_PX * Math.sin((TAU * frame.time) / ICON_BOB_PERIOD + sprites.phase) : 0;
    sprites.popAge = held ? nextAge(sprites.popAge, frame.dt, POP_LIFE_S) : null;
    const look = canalTreasureLook({
      sealed: find.sealed,
      container: find.container,
      held,
      popping: sprites.popAge !== null,
      ambient,
    });
    const life = sprites.popAge === null ? 0 : sprites.popAge / POP_LIFE_S;
    const popScale = 1 + (POP_SCALE_TO - 1) * life;
    this.renderGlow(sprites, canalGlowShows(look), find.x, find.y + bob, popScale, 1 - life, frame);
    if (held) {
      if (sprites.popAge === null || !ambient) {
        icon.setVisible(false);
        return;
      }
      icon
        .setVisible(true)
        .setDepth(DEPTH.treasure)
        .setPosition(find.x, find.y + bob)
        .setScale(base * popScale)
        .setAlpha(1 - life);
      return;
    }
    if (find.sealed) {
      icon.setVisible(false);
      return;
    }
    icon
      .setVisible(true)
      .setDepth(find.container ? DEPTH.treasure : DEPTH.hiddenTreasure)
      .setPosition(find.x, find.y + bob)
      .setScale(base)
      .setAlpha(1);
  }

  /**
   * The rarity glow at the icon's spot (bob included), breathing under full motion; `scale` and
   * `fade` carry the pickup pop's grow and fade (1 and 1 outside a pop). Hidden unless `shows`.
   */
  private renderGlow(
    sprites: FindSprites,
    shows: boolean,
    x: number,
    y: number,
    scale: number,
    fade: number,
    frame: TreasureFrame,
  ): void {
    const glow = sprites.glow;
    if (!shows) {
      glow.setVisible(false);
      return;
    }
    glow
      .setVisible(true)
      .setPosition(x, y)
      .setScale(sprites.glowBaseScale * scale)
      .setAlpha(rarityGlowAlpha(frame.time, frame.motion.ambient, sprites.phase) * fade);
  }

  /**
   * The hint star shows while its find is in range, the range scaled by the Treasure sense
   * multiplier. Not `eligible` (held or revealed): hidden at
   * once. Full motion: it grows in at full alpha, bobs and spins, and fades out on leaving range; a
   * star back in range mid-fade finishes the fade first, so its alpha never rises. Reduced motion:
   * it appears and leaves at once, still.
   */
  private renderHint(sprites: FindSprites, find: PlacedFind, eligible: boolean, frame: TreasureFrame): void {
    const ambient = frame.motion.ambient;
    const inRange =
      eligible &&
      hintVisible(find, sprites.rarity, frame.axolotl, frame.holdings, sprites.hintInRange, this.hintMultiplier);
    sprites.hintInRange = inRange;
    if (!eligible) {
      sprites.hintShownAge = null;
      sprites.hintFadeAge = null;
      sprites.star.setVisible(false);
      return;
    }
    // The frame a fade ends stays hidden, so a star back in range restarts after it, not from it.
    const wasFading = sprites.hintFadeAge !== null;
    sprites.hintFadeAge = ambient ? nextAge(sprites.hintFadeAge, frame.dt, HINT_FADE_S) : null;
    if (!wasFading) {
      this.advanceHintShown(sprites, inRange, ambient, frame.dt);
    }
    const star = sprites.star;
    if (sprites.hintShownAge === null && sprites.hintFadeAge === null) {
      star.setVisible(false);
      return;
    }
    if (sprites.hintShownAge !== null) {
      const grow = Math.min(1, sprites.hintShownAge / HINT_GROW_S);
      sprites.hintScale = ambient ? HINT_GROW_FROM + (1 - HINT_GROW_FROM) * grow : 1;
    }
    const alpha = sprites.hintFadeAge === null ? 1 : 1 - sprites.hintFadeAge / HINT_FADE_S;
    const wave = (TAU * frame.time) / HINT_PERIOD + sprites.phase;
    star
      .setVisible(true)
      .setPosition(find.x, find.y + HINT_OFFSET_Y + (ambient ? HINT_BOB_PX * Math.sin(wave) : 0))
      .setRotation(ambient ? HINT_SPIN_RAD * Math.cos(wave) : 0)
      .setScale(sprites.hintScale * sprites.starBaseScale)
      .setAlpha(alpha);
  }

  /** Starts, continues or ends the shown star; ending under full motion starts its fade-out. */
  private advanceHintShown(sprites: FindSprites, inRange: boolean, ambient: boolean, dt: number): void {
    if (inRange) {
      sprites.hintShownAge = sprites.hintShownAge === null ? 0 : sprites.hintShownAge + dt;
      return;
    }
    if (sprites.hintShownAge !== null && ambient) sprites.hintFadeAge = 0;
    sprites.hintShownAge = null;
  }

  /**
   * Full motion: the shards move out and sink while fading, and the twinkles burst out while
   * fading. Reduced motion: three still shards at full alpha, no twinkles. Either way the crumble
   * is gone after its life. No flash.
   */
  private renderCrumble(crumble: Crumble, frame: TreasureFrame): void {
    crumble.age = Math.min(crumble.age + frame.dt, CRUMBLE_LIFE_S);
    const life = crumble.age / CRUMBLE_LIFE_S;
    const active = life < 1;
    const ambient = frame.motion.ambient;
    const spread = ambient ? life : 1;
    const sink = ambient ? SHARD_SINK_PX * life : 0;
    crumble.shards.forEach((shard, k) => {
      shard.image
        .setVisible(active && (ambient || STILL_SHARDS.includes(k)))
        .setPosition(
          crumble.at.x + shard.direction.x * shard.distance * spread,
          crumble.at.y + shard.direction.y * shard.distance * spread + sink,
        )
        .setAlpha(ambient ? 1 - life : 1);
    });
    const twinkleScale = TWINKLE_SCALE / this.assets.baked.sparkle.scale;
    for (const twinkle of crumble.twinkles) {
      twinkle.image
        .setVisible(active && ambient)
        .setPosition(
          crumble.at.x + twinkle.direction.x * twinkle.distance * life,
          crumble.at.y + twinkle.direction.y * twinkle.distance * life,
        )
        .setScale(twinkleScale)
        .setAlpha(1 - life);
    }
  }
}
