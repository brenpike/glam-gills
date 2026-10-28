import type * as Phaser from 'phaser';
import { SOFT_LIGHT_RADIUS, SPRING_DARK } from '../art/drawSpringCave';
import { DEPTH } from '../art/layers';
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
import type { Point } from '../logic/zone';
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

function softLightTexture(assets: GameAssets): TexInfo {
  if (assets.springCave === null) {
    throw new Error('DarkCaveView: dark water needs the baked spring cave soft light texture');
  }
  return assets.springCave.softLight;
}

/** True when `view` and the dark water overlap (edges inclusive). */
function viewMeetsDark(view: DarkCaveViewRect, dark: Readonly<DarkWater>): boolean {
  return view.x <= dark.x1 && view.x + view.width >= dark.x0 && view.y <= dark.y1 && view.y + view.height >= dark.y0;
}

/**
 * Draws the darkness over an area's dark part (issue #77, ND-7 and ND-18): one layer at
 * DEPTH.darkWater, the SPRING_DARK colour over the dark water rect, with a soft hole erased for each
 * light darkLights gives: the axolotl's own glow, the exit's faint glow (so the exit, drawn under the
 * layer, always shows) and each lit glow-plant. A newly lit plant's light grows in over
 * `motion.lightFadeIn` (lightShare), so under reduced motion it appears at once. `lights` gives the
 * frame's lights with that growth applied, and the scene uses the same list for the dark rule
 * (shownInDark), so a hint star never shows past the edge of a light still growing in. The layer is
 * redrawn only when the camera view meets the dark water and a light has moved, grown or appeared
 * since the last draw. Per frame it allocates darkLights' result and, on a new light, one lit-time
 * entry. Visual only: nothing here changes game state. Throws when the spring cave textures are missing.
 */
export class DarkCaveView {
  private readonly layer: Phaser.GameObjects.RenderTexture;
  private readonly stamp: Phaser.GameObjects.Image;
  private readonly lightInfo: TexInfo;
  private readonly darkColor: number;
  private readonly plantIds: readonly string[];
  /** Scene time each lit plant was first seen lit, by id. */
  private readonly litAt = new Map<string, number>();
  /** The lights of the last draw, LIGHT_FIELDS numbers each, rounded. Null before the first draw. */
  private drawnLights: number[] | null = null;

  /** `dark` is the area's dark water; `elements` holds the trip's elements, of which the glow-plants give light. */
  constructor(
    scene: Phaser.Scene,
    assets: GameAssets,
    private readonly dark: Readonly<DarkWater>,
    private readonly elements: readonly Readonly<ElementSpawn>[],
  ) {
    this.lightInfo = softLightTexture(assets);
    this.darkColor = cssColor(SPRING_DARK).color;
    this.plantIds = glowPlants(elements).map((plant) => plant.id);
    this.layer = scene.add
      .renderTexture(dark.x0, dark.y0, dark.x1 - dark.x0, dark.y1 - dark.y0)
      .setOrigin(0, 0)
      .setDepth(DEPTH.darkWater);
    this.stamp = scene.make
      .image({ key: this.lightInfo.key }, false)
      .setOrigin(this.lightInfo.originNormX, this.lightInfo.originNormY);
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

  /** Fills the layer with the darkness and erases a soft hole for each light. */
  private drawLayer(lights: readonly DarkLight[]): void {
    this.layer.clear().fill(this.darkColor, 1);
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
