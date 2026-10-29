import type * as Phaser from 'phaser';
import { DARK_FADE_BAND, SOFT_LIGHT_RADIUS, SPRING_DARK, darkFadeEdges } from '../art/drawSpringCave';
import { DEPTH } from '../art/layers';
import type { SpringCaveTextures } from '../art/springCaveTextures';
import type { TexInfo } from '../art/textures';
import {
  darkLights,
  glowPlants,
  lightShare,
  type DarkLight,
  type DarkWater,
  type GlowMotion,
} from '../logic/glowPlants';
import type { ElementSpawn } from '../logic/hazards';
import type { Point, ZoneLayout } from '../logic/zone';
import { cssColor, type GameAssets } from './BootScene';

/** The lights before the plant lights in darkLights' result: the axolotl's glow, then the exit's faint glow. */
const LEADING_LIGHTS = 2;
/** Numbers kept per drawn light: x, y and radius, each rounded to whole px. */
const LIGHT_FIELDS = 3;

/** The part of the world the camera shows: Phaser's `camera.worldView` fits. */
export type DarkCaveViewRect = Readonly<Pick<Phaser.Geom.Rectangle, 'x' | 'y' | 'width' | 'height'>>;

/** One frame's input for the lights through the dark water. */
export interface DarkCaveLightFrame {
  /** The axolotl's body centre. */
  axolotl: Readonly<Point>;
  /** The exit's centre. */
  exit: Readonly<Point>;
  /** The glow-plant ids lit this trip (`TripState.litGlowPlants`). */
  lit: readonly string[];
  /** The glow-plant motion for the reduced-motion preference (glowMotion). */
  motion: Readonly<GlowMotion>;
  /** Scene clock in seconds, for a new light growing in. */
  time: number;
}

/**
 * One fading edge's erase: a fade strip anchored at its top-left corner, placed rect-local on the
 * edge and stretched along the whole edge. A negative scale mirrors the strip about that anchor, so
 * its ramp points inward from a right or bottom edge.
 */
interface EdgeFade {
  readonly stamp: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

function springCaveTextures(assets: GameAssets): SpringCaveTextures {
  if (assets.springCave === null) {
    throw new Error('DarkCaveView: dark water needs the baked spring cave soft light and fade strip textures');
  }
  return assets.springCave;
}

/** An off-scene image of `info`, anchored at its top-left corner, for erasing from the dark layer. */
function makeFadeStamp(scene: Phaser.Scene, info: TexInfo): Phaser.GameObjects.Image {
  return scene.make.image({ key: info.key }, false).setOrigin(0, 0);
}

/**
 * The erases for each edge of `dark` that darkFadeEdges says fades, rect-local: the 'x' strip at the
 * left edge (mirrored in x at the right), the 'y' strip at the top edge (mirrored in y at the bottom),
 * each DARK_FADE_BAND deep and as long as its edge, corner to corner.
 */
function edgeFades(
  dark: Readonly<DarkWater>,
  area: Readonly<Pick<ZoneLayout, 'width' | 'bedTop'>>,
  stripX: Phaser.GameObjects.Image,
  stripY: Phaser.GameObjects.Image,
): EdgeFade[] {
  const edges = darkFadeEdges(dark, area);
  const width = dark.x1 - dark.x0;
  const height = dark.y1 - dark.y0;
  const acrossScale = DARK_FADE_BAND / stripX.width;
  const acrossLength = height / stripX.height;
  const downLength = width / stripY.width;
  const downScale = DARK_FADE_BAND / stripY.height;
  const fades: EdgeFade[] = [];
  if (edges.left) fades.push({ stamp: stripX, x: 0, y: 0, scaleX: acrossScale, scaleY: acrossLength });
  if (edges.right) fades.push({ stamp: stripX, x: width, y: 0, scaleX: -acrossScale, scaleY: acrossLength });
  if (edges.top) fades.push({ stamp: stripY, x: 0, y: 0, scaleX: downLength, scaleY: downScale });
  if (edges.bottom) fades.push({ stamp: stripY, x: 0, y: height, scaleX: downLength, scaleY: -downScale });
  return fades;
}

/** True when `view` and the dark water overlap (edges inclusive). */
function viewMeetsDark(view: DarkCaveViewRect, dark: Readonly<DarkWater>): boolean {
  return view.x <= dark.x1 && view.x + view.width >= dark.x0 && view.y <= dark.y1 && view.y + view.height >= dark.y0;
}

/**
 * Draws the darkness over an area's dark part (issue #77, ND-7 and ND-18): one layer at
 * DEPTH.darkWater, the SPRING_DARK colour over the dark water rect. Each edge darkFadeEdges says
 * fades is erased with a baked fade strip stretched along the whole edge, so the darkness fades into
 * the water over DARK_FADE_BAND px (an edge on the world's side, at the surface or at the bed stays
 * hard); where two fading bands meet the darkness compounds to ease(dx) x ease(dy). Then a soft hole
 * is erased for each light darkLights gives: the axolotl's own glow, the exit's faint glow (so the exit, drawn under the
 * layer, always shows) and each lit glow-plant. A newly lit plant's light grows in over
 * `motion.lightFadeIn` (lightShare), so under reduced motion it appears at once. `lights` gives the
 * frame's lights with that growth applied, and the scene uses the same list for the dark rule
 * (shownInDark), so a hint star never shows past the edge of a light still growing in. The layer is
 * redrawn only when the camera view meets the dark water and a light has moved, grown or appeared
 * since the last draw. Per frame it allocates darkLights' result and, on a new light, one lit-time
 * entry; the fading edges are worked out once, so the fade adds no work per frame. Visual only:
 * nothing here changes game state. Throws when the spring cave textures are missing.
 */
export class DarkCaveView {
  private readonly layer: Phaser.GameObjects.RenderTexture;
  private readonly stamp: Phaser.GameObjects.Image;
  private readonly fadeStamps: readonly Phaser.GameObjects.Image[];
  private readonly fades: readonly EdgeFade[];
  private readonly lightInfo: TexInfo;
  private readonly darkColor: number;
  private readonly plantIds: readonly string[];
  /** Scene time each lit plant was first seen lit, by id. */
  private readonly litAt = new Map<string, number>();
  /** The lights of the last draw, LIGHT_FIELDS numbers each, rounded. Null before the first draw. */
  private drawnLights: number[] | null = null;

  /**
   * `area` gives the area's size, for which edges of the dark fade; `dark` is the area's dark water;
   * `elements` holds the trip's elements, of which the glow-plants give light.
   */
  constructor(
    scene: Phaser.Scene,
    assets: GameAssets,
    area: Readonly<Pick<ZoneLayout, 'width' | 'bedTop'>>,
    private readonly dark: Readonly<DarkWater>,
    private readonly elements: readonly Readonly<ElementSpawn>[],
  ) {
    const textures = springCaveTextures(assets);
    this.lightInfo = textures.softLight;
    this.darkColor = cssColor(SPRING_DARK).color;
    this.plantIds = glowPlants(elements).map((plant) => plant.id);
    this.layer = scene.add
      .renderTexture(dark.x0, dark.y0, dark.x1 - dark.x0, dark.y1 - dark.y0)
      .setOrigin(0, 0)
      .setDepth(DEPTH.darkWater);
    this.stamp = scene.make
      .image({ key: this.lightInfo.key }, false)
      .setOrigin(this.lightInfo.originNormX, this.lightInfo.originNormY);
    const stripX = makeFadeStamp(scene, textures.darkFadeX);
    const stripY = makeFadeStamp(scene, textures.darkFadeY);
    this.fadeStamps = [stripX, stripY];
    this.fades = edgeFades(dark, area, stripX, stripY);
  }

  /**
   * This frame's lights (darkLights), each plant light's radius scaled by how far it has grown in.
   * Call once per frame, before `render` and before any dark rule check that reads them.
   */
  lights(frame: DarkCaveLightFrame): DarkLight[] {
    this.noteNewLights(frame.lit, frame.time);
    return this.lightsNow(frame);
  }

  /** Draws one frame from `lights`: redraws the layer only when `view` meets the dark water and the lights changed. */
  render(lights: readonly DarkLight[], view: DarkCaveViewRect): void {
    if (!viewMeetsDark(view, this.dark)) return;
    if (this.drawnLights !== null && sameLights(this.drawnLights, lights)) return;
    this.drawLayer(lights);
  }

  destroy(): void {
    this.layer.destroy();
    this.stamp.destroy();
    for (const fadeStamp of this.fadeStamps) fadeStamp.destroy();
  }

  /** Records the scene time of each plant newly lit; forgets them all when the lit list starts over. */
  private noteNewLights(lit: readonly string[], time: number): void {
    if (lit.length < this.litAt.size) this.litAt.clear();
    for (const id of lit) {
      if (!this.litAt.has(id)) this.litAt.set(id, time);
    }
  }

  /** darkLights for this frame, each plant light's radius scaled by how far it has grown in. */
  private lightsNow(frame: DarkCaveLightFrame): DarkLight[] {
    const lights = darkLights({ axolotl: frame.axolotl, exit: frame.exit, elements: this.elements, lit: frame.lit });
    // INVARIANT: darkLights gives LEADING_LIGHTS lights, then one per lit glow-plant in element order,
    // which is plantIds order filtered by `lit`.
    let index = LEADING_LIGHTS;
    for (const id of this.plantIds) {
      if (!frame.lit.includes(id)) continue;
      const since = Math.max(0, frame.time - (this.litAt.get(id) ?? frame.time));
      lights[index].radius *= lightShare(since, frame.motion);
      index += 1;
    }
    return lights;
  }

  /** Fills the layer with the darkness, erases each fading edge, then erases a soft hole for each light. */
  private drawLayer(lights: readonly DarkLight[]): void {
    this.layer.clear().fill(this.darkColor, 1);
    for (const fade of this.fades) {
      fade.stamp.setScale(fade.scaleX, fade.scaleY);
      this.layer.erase(fade.stamp, fade.x, fade.y);
    }
    const drawn: number[] = [];
    for (const light of lights) {
      const x = Math.round(light.x);
      const y = Math.round(light.y);
      const radius = Math.round(light.radius);
      drawn.push(x, y, radius);
      if (radius <= 0) continue;
      this.stamp.setScale(radius / SOFT_LIGHT_RADIUS / this.lightInfo.scale);
      this.layer.erase(this.stamp, x - this.dark.x0, y - this.dark.y0);
    }
    this.drawnLights = drawn;
  }
}

/** True when `lights`, rounded as drawLayer rounds them, match the `drawn` numbers. */
function sameLights(drawn: readonly number[], lights: readonly DarkLight[]): boolean {
  if (drawn.length !== lights.length * LIGHT_FIELDS) return false;
  return lights.every(
    (light, index) =>
      drawn[index * LIGHT_FIELDS] === Math.round(light.x) &&
      drawn[index * LIGHT_FIELDS + 1] === Math.round(light.y) &&
      drawn[index * LIGHT_FIELDS + 2] === Math.round(light.radius),
  );
}
