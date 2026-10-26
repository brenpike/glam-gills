import * as Phaser from 'phaser';
import { bakeAreaMapTextures, type AreaMapTextures } from '../art/areaMapTextures';
import { bakeAreaTextures, type AreaTextures } from '../art/areaTextures';
import { createAxolotlRigBake, type AxolotlRigBake } from '../art/axolotlRig';
import { bakeChinampaTextures, type ChinampaTextures } from '../art/chinampaTextures';
import type { GhostNetSize } from '../art/drawChinampa';
import { CAVE_H, CAVE_W } from '../art/drawFinds';
import { streamColumnFor, type ReedLook } from '../art/drawScenery';
import { habitatLook, type HabitatLook } from '../art/habitatLook';
import { bakeMobileSnackTextures, type MobileSnackTextures } from '../art/mobileSnackTextures';
import { bakeMorphTextures, type MorphTextures } from '../art/morphTextures';
import { bakeMovingHazardTextures, type MovingHazardTextures } from '../art/movingHazardTextures';
import { INK, LW, UI_FONT } from '../art/palette';
import { bakePondTextures, type PondTextures } from '../art/pondTextures';
import { bakePredatorTextures, type PredatorTextures } from '../art/predatorTextures';
import { bakeRefugeTextures, type RefugeTextures } from '../art/refugeTextures';
import { bakeTankTextures, type ExtraDecorationTextures, type TankTextures } from '../art/tankTextures';
import { bakeTreasureTextures, type TreasureTextures } from '../art/treasureTextures';
import {
  TEX,
  bakeAreaScenery,
  bakeSizedButton,
  bakeTextures,
  buttonKey,
  iconKey,
  sceneryFromBaked,
  type BakedTextures,
  type ButtonFill,
  type ButtonShape,
  type ButtonVisual,
  type SceneryTextures,
  type TexInfo,
} from '../art/textures';
import { BUTTON_PRESS_OFFSET, BUTTON_SQUARE, BUTTON_WIDE, ICON_SIZE, type IconKind } from '../art/drawUi';
import { AREAS, habitatById, type AreaData } from '../logic/areas';
import type { Decoration } from '../logic/catalogue';
import { createGhostNets } from '../logic/ghostNets';
import { createPlasticWorms } from '../logic/plasticWorms';
import { mulberry32 } from '../logic/rng';
import { TANK } from '../logic/tank';
import { VIEW } from '../logic/tuning';
import { fitView, type ViewFit } from '../logic/viewport';
import { CANAL_AREA_ID, DEFAULT_ZONE_SEED, WORLD_H, buildZone, type ReedSpec, type ZoneLayout } from '../logic/zone';

/** Scene keys, in render order (later scenes draw on top). */
export const SCENE_KEYS = Object.freeze({
  boot: 'Boot',
  title: 'Title',
  homeTank: 'HomeTank',
  areaMap: 'AreaMap',
  refuge: 'Refuge',
  swim: 'Swim',
  hud: 'Hud',
  creator: 'Creator',
} as const);

/**
 * Game registry key for a dev area: main.ts sets it (dev builds only, from `?area=<id>`) before the
 * boot scene runs. Never equals a `REGISTRY_KEYS`, `TRIP_REGISTRY_KEYS`, `SESSION_REGISTRY_KEY` or
 * `SAVE_GATE_REGISTRY_KEY` value.
 */
export const DEV_AREA_REGISTRY_KEY = 'devArea';

/**
 * Game registry key for a dev Decoration pack: main.ts sets it (dev builds only, from `?decor`)
 * before the boot scene runs. Never equals a `REGISTRY_KEYS`, `TRIP_REGISTRY_KEYS`,
 * `SESSION_REGISTRY_KEY`, `SAVE_GATE_REGISTRY_KEY` or `DEV_AREA_REGISTRY_KEY` value.
 */
export const DEV_DECOR_REGISTRY_KEY = 'devDecor';

/**
 * Extra Decorations and the function that bakes their textures. The dev build's pack lives in
 * src/art/devDecorationArt.ts; this file never imports it, so it never ships.
 */
export interface DecorationPack {
  readonly decorations: readonly Decoration[];
  bake(scene: Phaser.Scene, bakeScale: number, decorationPx: number): ExtraDecorationTextures;
}

/** A baked Decoration pack: its Decorations and their textures, keyed by Decoration id. */
export interface BakedDecorationPack {
  readonly decorations: readonly Decoration[];
  readonly textures: ExtraDecorationTextures;
}

/**
 * Everything the boot scene prepares, handed from scene to scene as start data. `areas` is AREAS
 * plus the dev area when one was asked for; `zones` and `scenery` hold each of those areas' layout
 * and baked scenery by area id. `devAreaId` is the dev area's id, or null. `devDecor` is the dev
 * Decoration pack baked at the tank Decoration size, or null when none was asked for. `pond` holds
 * the pond props (hollow log, plastic worms, queasy cheek tint), with the root arch and the firefly
 * when some area's look needs them, baked only when some area needs any of them, else null.
 * `chinampa` holds the chinampa props (the root tangle cave, the bank overhang, the gap edges, the
 * ghost nets of every size the areas' ghost nets have, and the snag cue), baked only when some area's
 * look needs them or some area has ghost nets, else null. `refuge` holds the Xochimilco refuge art.
 * `movingHazards` holds the moving hazard textures by look id, only for the looks some area's moving
 * hazards use, or null when no area has a moving hazard. `mobileSnacks` holds the tadpole and shrimp
 * textures, baked only when some area has mobile snacks, else null. "Some area" counts the dev area
 * when one was loaded. The carp frames are part of `predator`.
 */
export interface GameAssets {
  areas: readonly Readonly<AreaData>[];
  zones: Readonly<Record<string, ZoneLayout>>;
  scenery: Readonly<Record<string, SceneryTextures>>;
  devAreaId: string | null;
  baked: BakedTextures;
  axolotl: AxolotlRigBake;
  predator: PredatorTextures;
  treasure: TreasureTextures;
  tank: TankTextures;
  morph: MorphTextures;
  area: AreaTextures;
  areaMap: AreaMapTextures;
  devDecor: BakedDecorationPack | null;
  pond: PondTextures | null;
  chinampa: ChinampaTextures | null;
  refuge: RefugeTextures;
  movingHazards: MovingHazardTextures | null;
  mobileSnacks: MobileSnackTextures | null;
}

/** What the swim scene and its HUD start from: the game assets and the id of the area to swim in. */
export interface SwimStart {
  assets: GameAssets;
  areaId: string;
}

/** The area with id `areaId` among the assets' areas. Throws when there is none. */
export function areaFor(assets: GameAssets, areaId: string): Readonly<AreaData> {
  const area = assets.areas.find((candidate) => candidate.id === areaId);
  if (area === undefined) throw new Error(`areaFor: no area ${areaId}`);
  return area;
}

/** The zone layout of area `areaId`. Throws when the assets hold none. */
export function zoneFor(assets: GameAssets, areaId: string): ZoneLayout {
  const zone: ZoneLayout | undefined = assets.zones[areaId];
  if (zone === undefined) throw new Error(`zoneFor: no zone for area ${areaId}`);
  return zone;
}

/** The baked scenery of area `areaId`. Throws when the assets hold none. */
export function sceneryFor(assets: GameAssets, areaId: string): SceneryTextures {
  const scenery: SceneryTextures | undefined = assets.scenery[areaId];
  if (scenery === undefined) throw new Error(`sceneryFor: no scenery for area ${areaId}`);
  return scenery;
}

/**
 * The look of area `area`: the variant its `look` names when set, else its habitat's `look`.
 * Throws when the habitat or the look is unknown.
 */
export function areaLook(area: Readonly<AreaData>): HabitatLook {
  const habitat = habitatById(area.habitatId);
  if (habitat === undefined) throw new Error(`areaLook: no habitat ${area.habitatId} for area ${area.id}`);
  return habitatLook(area.look ?? habitat.look);
}

/** CSS viewport size plus the fitted view derived from the Scale Manager. */
export interface SceneView {
  cssW: number;
  cssH: number;
  fit: ViewFit;
}

const ART_SEED = DEFAULT_ZONE_SEED ^ 0x5eed;
const TANK_ART_SEED = ART_SEED ^ 0x7a4c;
const BLINK_PERIOD = 4.6;
const BLINK_LENGTH = 0.14;
const BLINK_CLOSED = 0.12;
const BUTTON_LABEL_PX = 24;
const SQUARE_LABEL_PX = 22;
const BUTTON_ICON_GAP = 8;
/** Icon size of an icon-only button in CSS px, whatever its size (tankUi ICON_TILE.iconPx). */
const ICON_ONLY_PX = 32;

/** Container data key holding a button's label, drawn or not, for focus captions. */
export const BUTTON_LABEL_DATA_KEY = 'label';

/**
 * Reads the CSS viewport from the Scale Manager. main.ts sizes the canvas to
 * CSS size x DPR and sets the Scale Manager zoom to 1 / DPR.
 */
export function readSceneView(scale: Phaser.Scale.ScaleManager): SceneView {
  const zoom = scale.zoom > 0 ? scale.zoom : 1;
  const cssW = scale.width * zoom;
  const cssH = scale.height * zoom;
  return { cssW, cssH, fit: fitView(cssW, cssH, 1 / zoom, { worldH: WORLD_H, ...VIEW }) };
}

/** Points a camera at CSS-pixel space: (0, 0) is the top-left of the canvas, 1 unit = 1 CSS px. */
export function useCssCamera(camera: Phaser.Cameras.Scene2D.Camera, dpr: number): void {
  camera.setOrigin(0, 0);
  camera.setZoom(dpr);
  camera.setScroll(0, 0);
}

/**
 * Zooms a camera to the fitted world view and sets bounds so the world is
 * centred on any axis where the view is larger than the world.
 */
export function fitWorldCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  fit: ViewFit,
  worldW: number,
  worldH: number,
): void {
  camera.setZoom(fit.zoom);
  const viewW = camera.width / fit.zoom;
  const viewH = camera.height / fit.zoom;
  camera.setBounds(
    Math.min(0, (worldW - viewW) / 2),
    Math.min(0, (worldH - viewH) / 2),
    Math.max(worldW, viewW),
    Math.max(worldH, viewH),
  );
}

/** Converts a CSS colour string (hex or rgb/rgba) to a Phaser colour int and 0..1 alpha. */
export function cssColor(value: string): { color: number; alpha: number } {
  const parsed = Phaser.Display.Color.ValueToColor(value);
  return { color: parsed.color, alpha: parsed.alphaGL };
}

/** Eye height factor for the blink cycle (guide section 9). */
export function blinkAt(seconds: number): number {
  return seconds % BLINK_PERIOD < BLINK_LENGTH ? BLINK_CLOSED : 1;
}

/** UI text style: ink, rounded system font, crisp at the device pixel ratio. */
export function uiTextStyle(sizePx: number, dpr: number, bold = true): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: UI_FONT,
    fontSize: `${sizePx}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color: INK,
    resolution: dpr,
  };
}

/** Draws a rounded light panel with the ink outline into a Graphics object. */
export function drawPanel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  const radius = Math.min(h / 2, 18);
  graphics.clear();
  graphics.fillStyle(cssColor(fill).color, 1);
  graphics.fillRoundedRect(x, y, w, h, radius);
  graphics.lineStyle(LW, cssColor(INK).color, 1);
  graphics.strokeRoundedRect(x, y, w, h, radius);
}

export interface ButtonOptions {
  fill: ButtonFill;
  shape: ButtonShape;
  /**
   * Uniform size multiplier on the 1x button (wide 200 x 64, square 64 x 64 CSS px).
   * Sets the body height, icon, label size and press offset; sets the body width too unless `width` is given.
   */
  size: number;
  /**
   * Body width in CSS px, used instead of the 1x width times `size`. Height, icon,
   * label size and press offset still follow `size`. Omit for the standard baked body.
   */
  width?: number;
  /** The button's name. Drawn unless `iconOnly`; always kept as UiButton.label and container data. */
  label: string;
  icon: IconKind;
  /**
   * Draw no label, only a 32 px icon (not scaled by `size`) centred on the body. A square button
   * at size 0.75 makes the 48 x 48 tile of tankUi ICON_TILE.
   */
  iconOnly?: boolean;
  dpr: number;
  /** Fire on pointer down (for held, multi-touch actions) instead of pointer up. */
  pressOnDown: boolean;
  onPress: () => void;
}

/** A baked button with an icon and a text label, laid out in CSS px. */
export interface UiButton {
  container: Phaser.GameObjects.Container;
  /** The button's name (`ButtonOptions.label`, or the last setLabel), also when it is not drawn. */
  readonly label: string;
  /** Button body size in CSS px; the container origin is the body's top-left corner. */
  width: number;
  height: number;
  setFocused(focused: boolean): void;
  setResolution(dpr: number): void;
  /** Changes the name and icon in place, such as the music switch's (PRD M8). The body keeps its size. */
  setLabel(label: string, icon: IconKind): void;
}

function placeButtonContent(
  icon: Phaser.GameObjects.Image,
  label: Phaser.GameObjects.Text | null,
  shape: ButtonShape,
  width: number,
  height: number,
  offsetY: number,
): void {
  if (label === null) {
    icon.setPosition(width / 2 - icon.displayWidth / 2, height / 2 - icon.displayHeight / 2 + offsetY);
    return;
  }
  if (shape === 'wide') {
    const rowW = icon.displayWidth + BUTTON_ICON_GAP + label.width;
    const left = (width - rowW) / 2;
    icon.setPosition(left, height / 2 - icon.displayHeight / 2 + offsetY);
    label.setPosition(left + icon.displayWidth + BUTTON_ICON_GAP, height / 2 - label.height / 2 + offsetY);
    return;
  }
  const stackH = icon.displayHeight + label.height;
  const top = (height - stackH) / 2;
  icon.setPosition(width / 2 - icon.displayWidth / 2, top + offsetY);
  label.setPosition(width / 2 - label.width / 2, top + icon.displayHeight + offsetY);
}

/**
 * Bakes (or reuses) the custom-width body visuals at the standard body's bake scale.
 * Returns undefined when `opts.width` is omitted, so the standard baked body is used.
 */
function bakeCustomWidthBodies(
  scene: Phaser.Scene,
  baked: BakedTextures,
  opts: ButtonOptions,
  logicalH: number,
): Readonly<Record<ButtonVisual, TexInfo>> | undefined {
  if (opts.width === undefined) return undefined;
  if (!Number.isFinite(opts.width) || opts.width <= 0) {
    throw new RangeError('createButton: width must be a positive finite number');
  }
  const stdInfo = baked.info[buttonKey(opts.fill, opts.shape, 'normal')];
  return bakeSizedButton(scene, opts.fill, opts.width / opts.size, logicalH, stdInfo.scale);
}

/** Icon display size as a multiple of the 1x ICON_SIZE icon. */
function buttonIconScale(opts: ButtonOptions): number {
  if (opts.iconOnly === true) return ICON_ONLY_PX / ICON_SIZE;
  return opts.shape === 'wide' ? opts.size : opts.size * 0.85;
}

/** The label text, or null for an icon-only button. */
function addButtonLabel(scene: Phaser.Scene, opts: ButtonOptions): Phaser.GameObjects.Text | null {
  if (opts.iconOnly === true) return null;
  const labelPx = opts.shape === 'wide' ? Math.round(BUTTON_LABEL_PX * Math.min(1, opts.size)) : SQUARE_LABEL_PX;
  return scene.add.text(0, 0, opts.label, uiTextStyle(Math.max(SQUARE_LABEL_PX, labelPx), opts.dpr));
}

/**
 * Builds a baked button (body texture + icon + label, or only the icon when `iconOnly`) inside a
 * container at (0, 0). The container's BUTTON_LABEL_DATA_KEY data holds the label.
 */
export function createButton(scene: Phaser.Scene, baked: BakedTextures, opts: ButtonOptions): UiButton {
  const dims = opts.shape === 'wide' ? BUTTON_WIDE : BUTTON_SQUARE;
  const width = opts.width ?? dims.w * opts.size;
  const height = dims.h * opts.size;
  let focused = false;
  let pressed = false;

  const bodies = bakeCustomWidthBodies(scene, baked, opts, dims.h);
  const bodyInfo = bodies?.normal ?? baked.info[buttonKey(opts.fill, opts.shape, 'normal')];
  const body = scene.add
    .image(0, 0, bodyInfo.key)
    .setOrigin(bodyInfo.originNormX, bodyInfo.originNormY)
    .setScale(opts.size / bodyInfo.scale);
  const iconInfo = baked.icons[opts.icon];
  const icon = scene.add
    .image(0, 0, iconKey(opts.icon))
    .setOrigin(0, 0)
    .setScale(buttonIconScale(opts) / iconInfo.scale);
  const label = addButtonLabel(scene, opts);
  const container = scene.add.container(0, 0, label === null ? [body, icon] : [body, icon, label]);
  container.setData(BUTTON_LABEL_DATA_KEY, opts.label);
  let name = opts.label;

  const refresh = (): void => {
    const visual: ButtonVisual = pressed ? 'pressed' : focused ? 'focused' : 'normal';
    body.setTexture(bodies ? bodies[visual].key : buttonKey(opts.fill, opts.shape, visual));
    placeButtonContent(icon, label, opts.shape, width, height, pressed ? BUTTON_PRESS_OFFSET * opts.size : 0);
  };
  const release = (): void => {
    pressed = false;
    refresh();
  };
  const handleDown = (): void => {
    pressed = true;
    refresh();
    if (opts.pressOnDown) opts.onPress();
  };
  const handleUp = (): void => {
    const wasPressed = pressed;
    release();
    if (wasPressed && !opts.pressOnDown) opts.onPress();
  };

  body.setInteractive({ useHandCursor: true });
  body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, handleDown);
  body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, handleUp);
  body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, release);
  refresh();

  return {
    container,
    get label(): string {
      return name;
    },
    width,
    height,
    setFocused(next: boolean): void {
      focused = next;
      refresh();
    },
    setResolution(dpr: number): void {
      label?.setResolution(dpr);
      refresh();
    },
    setLabel(next: string, nextIcon: IconKind): void {
      name = next;
      container.setData(BUTTON_LABEL_DATA_KEY, next);
      label?.setText(next);
      icon.setTexture(iconKey(nextIcon)).setScale(buttonIconScale(opts) / baked.icons[nextIcon].scale);
      refresh();
    },
  };
}

function toReedLook(reed: ReedSpec): ReedLook {
  return {
    height: reed.by - reed.tipY,
    lean: reed.lean,
    bend: reed.bend,
    cat: reed.cat,
    leafU: reed.leafU,
    leafDir: reed.leafDir,
    light: reed.light,
  };
}

/**
 * Every area's scenery by area id: the canal's from its `bakeTextures` result, every other area
 * baked with its id as the key prefix, in its area look (areaLook). A look with a stream adds the
 * stream, its mouth at the right edge of the column that holds the area's first current
 * (streamColumnOf).
 */
function bakeScenery(
  scene: Phaser.Scene,
  areas: readonly Readonly<AreaData>[],
  zones: Readonly<Record<string, ZoneLayout>>,
  baked: BakedTextures,
  bakeScale: number,
): Record<string, SceneryTextures> {
  const scenery: Record<string, SceneryTextures> = {};
  for (const area of areas) {
    const id = area.id;
    const zone = zones[id];
    if (zone === undefined) throw new Error(`bakeScenery: no zone for area ${id}`);
    const look = areaLook(area);
    scenery[id] =
      id === CANAL_AREA_ID
        ? sceneryFromBaked(baked)
        : bakeAreaScenery(scene, {
            keyPrefix: `${id}:`,
            bakeScale,
            bgScale: Math.min(bakeScale, 2),
            screensWide: zone.chunks,
            screensTall: zone.rows,
            bankChunks: zone.bankChunks,
            sunChunk: zone.sunChunk,
            rand: mulberry32(ART_SEED),
            reeds: zone.reeds.map(toReedLook),
            pads: zone.pads,
            look: look.id,
            stream: look.stream,
            streamColumn: look.stream ? streamColumnOf(zone, id) : undefined,
          });
  }
  return scenery;
}

/**
 * The column whose right edge is area `id`'s stream mouth: the column that holds the right end of
 * its first current (streamColumnFor). Throws when the area has no current.
 */
function streamColumnOf(zone: ZoneLayout, id: string): number {
  const current = zone.currents[0];
  if (current === undefined) throw new Error(`bakeScenery: area ${id} has a stream but no current`);
  return streamColumnFor(current.x1, zone.chunks);
}

/** Whether area `area` has plastic worms, which need the pond props (worms and queasy cheeks) in any look. */
function hasPlasticWorms(area: Readonly<AreaData>): boolean {
  return createPlasticWorms(area.layout.hazards).worms.length > 0;
}

/**
 * The pond props at the cave's size, so the hollow log takes the cave's place, baked once for every
 * area: when some area's look needs them or some area has plastic worms. The root arch is added
 * when some look's cave is the root arch, and the firefly when some look has fireflies. Null when no
 * area needs any of them.
 */
function bakePondProps(scene: Phaser.Scene, areas: readonly Readonly<AreaData>[], bakeScale: number): PondTextures | null {
  const looks = areas.map(areaLook);
  const rootArch = looks.some((look) => look.cave.kind === 'rootArch');
  const firefly = looks.some((look) => look.firefliesPerScreen > 0);
  const props = looks.some((look) => look.pondProps) || areas.some(hasPlasticWorms);
  if (!props && !rootArch && !firefly) return null;
  return bakePondTextures(scene, bakeScale, { caveW: CAVE_W, caveH: CAVE_H }, { rootArch, firefly });
}

/**
 * The rect sizes of the ghost nets of every area, each size once: one ghost net texture is baked for
 * each. A ghost net is a rect hazard; the texture is drawn to the rect's size.
 */
function ghostNetSizes(areas: readonly Readonly<AreaData>[]): GhostNetSize[] {
  const sizes = new Map<string, GhostNetSize>();
  for (const area of areas) {
    for (const net of createGhostNets(area.layout.hazards).nets) {
      if (net.shape.kind !== 'rect') continue;
      const size = { w: net.shape.x1 - net.shape.x0, h: net.shape.y1 - net.shape.y0 };
      sizes.set(`${size.w}x${size.h}`, size);
    }
  }
  return [...sizes.values()];
}

/**
 * The chinampa props, baked once for every area: when some area's look has the root tangle cave or
 * says it needs the chinampa props, or some area has ghost nets (in any look). Null when no area
 * needs them.
 */
function bakeChinampaProps(
  scene: Phaser.Scene,
  areas: readonly Readonly<AreaData>[],
  bakeScale: number,
): ChinampaTextures | null {
  const sizes = ghostNetSizes(areas);
  const needed = areas.map(areaLook).some((look) => look.cave.kind === 'rootTangle' || look.chinampaProps);
  return needed || sizes.length > 0 ? bakeChinampaTextures(scene, bakeScale, { ghostNetSizes: sizes }) : null;
}

/** The look ids of every area's moving hazards, each once, in first-use order. */
function movingHazardLooks(areas: readonly Readonly<AreaData>[]): string[] {
  const looks = new Set<string>();
  for (const area of areas) {
    for (const spawn of area.layout.movingHazards ?? []) looks.add(spawn.type.look);
  }
  return [...looks];
}

/** The moving hazard textures of the looks the areas use, baked once each. Null when no area has a moving hazard. */
function bakeMovingHazards(
  scene: Phaser.Scene,
  areas: readonly Readonly<AreaData>[],
  bakeScale: number,
): MovingHazardTextures | null {
  const looks = movingHazardLooks(areas);
  return looks.length > 0 ? bakeMovingHazardTextures(scene, bakeScale, looks) : null;
}

/** Whether area `area` has any tadpole wander loop or shrimp home (issue #131, ND-13). */
function hasMobileSnacks(area: Readonly<AreaData>): boolean {
  const mix = area.layout.mobileSnacks;
  return mix !== undefined && mix.wanders.length + mix.homes.length > 0;
}

/** Builds every area's zone, bakes every texture at the fitted scale, then starts the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    const { fit } = readSceneView(this.scale);
    const bakeScale = Math.min(VIEW.bakeScaleMax, Math.max(fit.bakeScale, fit.dpr));
    const devArea = this.registry.get(DEV_AREA_REGISTRY_KEY) as Readonly<AreaData> | undefined;
    const devDecorPack = this.registry.get(DEV_DECOR_REGISTRY_KEY) as DecorationPack | undefined;
    const areas = devArea === undefined ? [...AREAS] : [...AREAS, devArea];
    const zones: Record<string, ZoneLayout> = {};
    for (const area of areas) zones[area.id] = buildZone(area.layout, DEFAULT_ZONE_SEED);
    const zone = zones[CANAL_AREA_ID];
    if (zone === undefined) throw new Error('BootScene: no canal area');
    const baked = bakeTextures(this, {
      bakeScale,
      bgScale: Math.min(bakeScale, 2),
      chunks: zone.chunks,
      bankChunks: zone.bankChunks,
      sunChunk: zone.sunChunk,
      rand: mulberry32(ART_SEED),
      reeds: zone.reeds.map(toReedLook),
      pads: zone.pads,
    });
    const scenery = bakeScenery(this, areas, zones, baked, bakeScale);
    const axolotl = createAxolotlRigBake(this, TEX.axolotl, bakeScale);
    const predator = bakePredatorTextures(this, bakeScale);
    const treasure = bakeTreasureTextures(this, bakeScale);
    const morph = bakeMorphTextures(this, bakeScale);
    const tank = bakeTankTextures(this, bakeScale, {
      decorationPx: TANK.decorationPx,
      rand: mulberry32(TANK_ART_SEED),
    });
    const area = bakeAreaTextures(this, bakeScale);
    const areaMap = bakeAreaMapTextures(this, bakeScale);
    const refuge = bakeRefugeTextures(this, bakeScale);
    const devDecor: BakedDecorationPack | null =
      devDecorPack === undefined
        ? null
        : { decorations: devDecorPack.decorations, textures: devDecorPack.bake(this, bakeScale, TANK.decorationPx) };
    const pond = bakePondProps(this, areas, bakeScale);
    const chinampa = bakeChinampaProps(this, areas, bakeScale);
    const movingHazards = bakeMovingHazards(this, areas, bakeScale);
    const mobileSnacks = areas.some(hasMobileSnacks) ? bakeMobileSnackTextures(this, bakeScale) : null;
    const assets: GameAssets = {
      areas,
      zones,
      scenery,
      devAreaId: devArea?.id ?? null,
      baked,
      axolotl,
      predator,
      treasure,
      tank,
      morph,
      area,
      areaMap,
      devDecor,
      pond,
      chinampa,
      refuge,
      movingHazards,
      mobileSnacks,
    };
    this.scene.start(SCENE_KEYS.title, assets);
  }
}
