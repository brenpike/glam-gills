/**
 * Phaser glue for the Area map (issue #73): bakes the map painters in
 * drawAreaMap.ts into CanvasTextures. Visual only. No game state, no input.
 *
 * Same rules as textures.ts: every texture is drawn at `bakeScale` through the
 * context transform, so the ink stays constant. A sprite shows at logical size
 * with setScale(1 / info.scale). Never upscale a small bake.
 *
 * Place the parts in a marker cell (MAP_CELL, 80 x 112, top-left origin) with
 * the offsets in drawAreaMap.ts: marker, focus ring and padlock badge hang off
 * MAP_MARKER_CENTRE (the badge at MAP_BADGE_OFFSET from it), the pill sits at
 * MAP_PILL_CENTRE, the star row at MAP_STAR_ROW_CENTRE. Depth order, back to
 * front: path, marker, focus ring, padlock badge, pill (guide 8). Text is scene
 * text over these shapes: the area number over the marker, the word "New!"
 * over the pill (kept separate so the pill and its word bob together).
 *
 * Panels, habitat tabs and the path depend on the layout (text width, marker
 * positions), so they are baked on request by {@link bakeAreaMapPanel},
 * {@link bakeAreaMapTab} and {@link bakeAreaMapPath}, not in
 * {@link bakeAreaMapTextures}. Each re-bakes under one fixed key per panel, tab
 * or path, so a new layout replaces its texture rather than adding one. A scene may instead draw its panels with its own
 * drawPanel: the look is the same.
 */
import * as Phaser from 'phaser';
import type { HabitatLookId } from './habitatLook';
import {
  MAP_BADGE_TEX,
  MAP_FOCUS_TEX,
  MAP_MARKER_TEX,
  MAP_PILL_TEX,
  MAP_STAR_COUNT,
  MAP_STAR_ROW_TEX,
  mapPanelTextureSize,
  mapPathTextureSize,
  mapTabTextureSize,
  paintMapFocusRing,
  paintMapMarker,
  paintMapNewPill,
  paintMapPadlockBadge,
  paintMapPanel,
  paintMapPath,
  paintMapStarRow,
  paintMapTab,
  type MapPoint,
  type MapTabFeet,
} from './drawAreaMap';
import { bake, type TexInfo } from './textures';

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const areaMapMarkerKey = (locked: boolean): string => `area-map-marker-${locked ? 'locked' : 'unlocked'}`;
/** Key of a pond-look marker texture (the canal's keys stay {@link areaMapMarkerKey}). */
export const areaMapPondMarkerKey = (locked: boolean): string => `area-map-marker-pond-${locked ? 'locked' : 'unlocked'}`;
/** Key of a chinampa-look marker texture. */
export const areaMapChinampaMarkerKey = (locked: boolean): string => `area-map-marker-chinampa-${locked ? 'locked' : 'unlocked'}`;
export const AREA_MAP_FOCUS_KEY = 'area-map-focus-ring';
export const AREA_MAP_BADGE_KEY = 'area-map-padlock-badge';
export const AREA_MAP_PILL_KEY = 'area-map-new-pill';
/** Star row with `earned` filled stars (0 to 3). */
export const areaMapStarRowKey = (earned: number): string => `area-map-stars-${earned}`;
/**
 * Panel body for one panel `role` (such as 'title', 'message' or 'label-0'). One key per role,
 * never per size, so re-baking at a new size replaces the old body and a resize adds no texture.
 */
export const areaMapPanelKey = (role: string): string => `area-map-panel-${role}`;
/** Folder tab for one tab `role` (such as 'habitat-0'), issue #113: one key per role, never per size, as the panels. */
export const areaMapTabKey = (role: string): string => `area-map-tab-${role}`;

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

/** The two markers of one habitat look: same frame and anchor. */
export interface AreaMapMarkerPair {
  readonly unlocked: TexInfo;
  readonly locked: TexInfo;
}

export interface AreaMapTextures {
  /** Unlocked marker: #ffe14a disc, ink 3.5, 64 px to the ink edge. Anchor is the disc centre (MAP_MARKER_CENTRE in the cell). */
  readonly markerUnlocked: TexInfo;
  /** Locked marker: the same disc in #ffffff. Same frame and anchor. The padlock badge is a separate texture. */
  readonly markerLocked: TexInfo;
  /**
   * Markers by habitat look. `canal` is the same textures as `markerUnlocked` and
   * `markerLocked`; `pond` is the notched lily pad (green unlocked, white locked);
   * `chinampa` is the garden plot with hanging roots (orange unlocked, white locked).
   * All six share one frame and anchor (the marker centre), so they swap freely.
   */
  readonly markersByLook: Readonly<Record<HabitatLookId, AreaMapMarkerPair>>;
  /** Double focus ring (white r 35.25, ink r 38.25). Anchor is the ring centre: put it on the marker centre. */
  readonly focusRing: TexInfo;
  /** White disc r 12 with the 18 px lock icon. Anchor is the disc centre: put it at MAP_BADGE_OFFSET from the marker centre. */
  readonly padlockBadge: TexInfo;
  /** "New!" pill shape, 56 x 24, no text. Anchor is the pill centre (MAP_PILL_CENTRE in the cell); the scene draws the word. */
  readonly newPill: TexInfo;
  /**
   * Star rows by earned count: `starRows[n]` shows n filled stars then
   * 3 - n dashed ones, three 24 px Area stars 4 px apart (80 x 24). Anchor is
   * the row centre (MAP_STAR_ROW_CENTRE in the cell). A locked area uses `starRows[0]`.
   */
  readonly starRows: readonly TexInfo[];
}

/** Bake every fixed Area map part (markers, ring, badge, pill, star rows). */
export function bakeAreaMapTextures(scene: Phaser.Scene, bakeScale: number): AreaMapTextures {
  const starRows: TexInfo[] = [];
  for (let n = 0; n <= MAP_STAR_COUNT; n++) {
    starRows.push(bake(scene, areaMapStarRowKey(n), MAP_STAR_ROW_TEX, bakeScale, (ctx) => paintMapStarRow(ctx, n)));
  }
  const markerUnlocked = bake(scene, areaMapMarkerKey(false), MAP_MARKER_TEX, bakeScale, (ctx) => paintMapMarker(ctx, false));
  const markerLocked = bake(scene, areaMapMarkerKey(true), MAP_MARKER_TEX, bakeScale, (ctx) => paintMapMarker(ctx, true));
  const pondUnlocked = bake(scene, areaMapPondMarkerKey(false), MAP_MARKER_TEX, bakeScale, (ctx) =>
    paintMapMarker(ctx, false, 'pond'),
  );
  const pondLocked = bake(scene, areaMapPondMarkerKey(true), MAP_MARKER_TEX, bakeScale, (ctx) =>
    paintMapMarker(ctx, true, 'pond'),
  );
  const chinampaUnlocked = bake(scene, areaMapChinampaMarkerKey(false), MAP_MARKER_TEX, bakeScale, (ctx) =>
    paintMapMarker(ctx, false, 'chinampa'),
  );
  const chinampaLocked = bake(scene, areaMapChinampaMarkerKey(true), MAP_MARKER_TEX, bakeScale, (ctx) =>
    paintMapMarker(ctx, true, 'chinampa'),
  );
  return {
    markerUnlocked,
    markerLocked,
    markersByLook: {
      canal: { unlocked: markerUnlocked, locked: markerLocked },
      pond: { unlocked: pondUnlocked, locked: pondLocked },
      chinampa: { unlocked: chinampaUnlocked, locked: chinampaLocked },
    },
    focusRing: bake(scene, AREA_MAP_FOCUS_KEY, MAP_FOCUS_TEX, bakeScale, paintMapFocusRing),
    padlockBadge: bake(scene, AREA_MAP_BADGE_KEY, MAP_BADGE_TEX, bakeScale, paintMapPadlockBadge),
    newPill: bake(scene, AREA_MAP_PILL_KEY, MAP_PILL_TEX, bakeScale, paintMapNewPill),
    starRows,
  };
}

/**
 * Bake (re-bake under the same key) a w x h panel body in `fill` (the habitat
 * panels and, along the axis, their tabs, and the message and title panels) under `key`, from
 * {@link areaMapPanelKey}. Anchor is the panel's top-left corner. The key names
 * the panel, not its size, so the panel textures stay one per panel however
 * often the layout changes; set the panel's image texture again after each bake.
 */
export function bakeAreaMapPanel(
  scene: Phaser.Scene,
  key: string,
  fill: string,
  w: number,
  h: number,
  bakeScale: number,
): TexInfo {
  return bake(scene, key, mapPanelTextureSize(w, h), bakeScale, (ctx) => paintMapPanel(ctx, w, h, fill));
}

/**
 * Bake (re-bake under the same key) a w x h habitat folder tab in `fill` (issue #113, ND-1) under
 * `key`, from {@link areaMapTabKey}, its sides running down to `feet` (mapTabFeet of the tab and
 * its panel). Anchor is the tab's top-left corner: put it at the tab rect, on its panel's top edge,
 * over the panel. Set the tab's image texture again after each bake.
 */
export function bakeAreaMapTab(
  scene: Phaser.Scene,
  key: string,
  fill: string,
  w: number,
  h: number,
  feet: MapTabFeet,
  bakeScale: number,
): TexInfo {
  return bake(scene, key, mapTabTextureSize(w, h, feet), bakeScale, (ctx) => paintMapTab(ctx, w, h, fill, feet));
}

/**
 * Bake (re-bake under the same key) the path tube through `points`, the marker
 * centres in area order in map space. Anchor is map space (0, 0): put the
 * sprite at the map origin and the path meets the markers. `fraction` (0 to 1)
 * bakes only that share of the length, for one step of the draw-in; a scene
 * that animates the growth may rather stroke mapPathPolyline itself.
 */
export function bakeAreaMapPath(
  scene: Phaser.Scene,
  key: string,
  points: readonly MapPoint[],
  bakeScale: number,
  fraction = 1,
): TexInfo {
  return bake(scene, key, mapPathTextureSize(points), bakeScale, (ctx) => paintMapPath(ctx, points, fraction));
}
