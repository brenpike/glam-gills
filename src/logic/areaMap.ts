/**
 * Area map (PRD N2; art guide 8 "Area map"): the screen where the player picks an area to explore,
 * shown after the explorer is chosen. The pure CSS px layout of its marker cells, winding path,
 * habitat labels and panels, title, Back and locked message, and its focus, key and scroll rules. Text
 * comes in measured as panel sizes (AreaMapMeasure); nothing here reads the area list, so the scene
 * passes one AreaMapEntry per area, in area order.
 *
 * Fixed parts. Back, the standard wide button (64 px tall), sits top-left inside the 16 px margins.
 * The title panel sits 12 px beside Back, centred down it, when it fits there (as wide as the room
 * and no taller than Back), else centred 12 px under Back. The message line (where "Beat Area N to
 * unlock!" shows) sits on the bottom margin, centred. The title, Back and the message are in screen
 * CSS px and stay fixed on screen: they never scroll.
 *
 * Scrolling parts. `viewport` is the screen rect between the fixed parts (12 px clear of both, the
 * full canvas width) that the map scrolls in, along `axis`: x when the canvas is at least as wide as
 * it is tall, else y. The cells, markers, path, habitat labels and panels are in content CSS px,
 * with the origin at the content's top-left; scrolled by `s` along the axis, content point (cx, cy)
 * shows on screen at (viewport.x + cx - s, viewport.y + cy) on axis x and
 * (viewport.x + cx, viewport.y + cy - s) on axis y. Content shorter than the viewport along the axis
 * takes the viewport's length, with the map centred in it, so it does not scroll.
 *
 * Marker cell. Each area takes an AREA_CELL_W x AREA_CELL_H cell (80 x 112, the same on both axes):
 * from the top, the AREA_PILL_SLOT_PX slot for the "New!" pill, the AREA_MARKER_PX marker (its centre
 * AREA_MARKER_CENTRE_Y down the cell, its tap target the marker's square), AREA_STAR_ROW_GAP_PX, then
 * the star row (three AREA_STAR_PX stars AREA_STAR_GAP_PX apart, AREA_STAR_ROW_W wide, centred across
 * the cell, its top AREA_STAR_ROW_Y down the cell). The "New!" pill (AREA_NEW_PILL) is centred
 * across the cell with its centre on the marker's top ink edge, so it fills the top AREA_NEW_PILL.h of
 * the cell. Along the axis, neighbouring markers are AREA_NODE_GAP_PX apart on axis x (their cells 16
 * apart), and neighbouring cells are AREA_NODE_GAP_PX apart on axis y (their markers 80 apart).
 *
 * Lane and habitats (issue #113, ND-1, ND-2, ND-7). Each run of entries sharing a habitat has a
 * label, its habitat name and its areas (habitatAreasLabel, such as "Lily pad pond: Areas 2 and 3"),
 * on a tab, and a rounded tinted backdrop panel that holds the run's cells with AREA_PANEL_PAD_PX on
 * every side. Locked runs keep their label and panel. The lane of cells ends 16 px before the far
 * content edge across the axis; the panels sit in the 16 px content margin, 8 px or more inside the
 * content, and the first panel starts 8 px in along the axis, so the first cell is 16 px in. Across
 * the axis the cells step middle, one side, middle, the other side, repeating, with up to
 * AREA_WIND_PX between the furthest marker centres: as much as the lane has room for past one cell,
 * down to straight. The path joins the marker centres in entry order and never leaves the lane. A
 * run starts RUN_GAP_PX (32) past the end of the panel before it.
 *   - Axis x, labels in the band (steps 0 and 1): a band across the top, as tall as the tallest tab,
 *     starts 16 px in, and the lane starts AREA_PANEL_PAD_PX past it. Each tab wraps inside its
 *     panel's width (its cells plus the pad each side), and a word longer than that widens the panel.
 *     A panel spans across the used lane (cells plus winding) plus the pad, and its tab sits on its
 *     top edge with their left ends aligned.
 *   - Axis y: there is no band, so the lane starts 16 px in. Each panel spans the whole lane plus the
 *     pad each side, and its tab, wrapping inside that width, sits on its top edge at the run start
 *     along the axis, left ends aligned; the next run starts at its tab.
 *   - Axis x, labels along the axis (step 2): each tab sits inside its panel at the run start,
 *     centred across the lane, 12 px before the run's first cell, wrapping at the canvas width less
 *     the margins. The panel spans the used lane plus the pad, and grows across to hold the tab.
 *
 * Fit order (art guide 8). Text, markers, stars and Back never shrink. When the cells do not fit
 * across the lane, the layout takes these steps in order, each keeping the steps before it, and the
 * first try that fits wins (`fitStep` is the last step taken):
 *   0. The title beside Back and the habitat labels in the band (on axis y, on their panels).
 *   1. The title under Back. This step is taken only when the title does not fit beside Back: moving
 *      it under Back never adds room across the lane (it only shortens the viewport), so a title
 *      that fits beside Back stays there through steps 2 and 3, as in the guide's 460 x 320 example.
 *   2. Axis x only: each habitat label leaves the band and sits along the axis inside its panel; the
 *      band is freed and the lane starts 16 px in from the content edge. Axis y has no band, so this
 *      step frees nothing there and is never taken.
 *   3. The title hides (`title` is null).
 * When no try fits, the try with the most room across the lane is returned (the earliest on a tie,
 * so the title stays when hiding it frees nothing) with `fits` false; the lane then keeps one cell's
 * depth and reaches past the viewport.
 *
 * Focus and keys. Focus indices 0 to n-1 are the markers in entry order and n is Back. Tab and
 * Shift+Tab step through the markers, then Back, wrapping. Right and Down move to the next marker,
 * Left and Up to the previous one, stopping at the ends; from Back, Right and Down move to the first
 * marker and Left and Up to the last (Back follows the last marker in the Tab order). Enter and Space
 * press the focused control, ignoring key repeat: an unlocked marker chooses its area, a locked one
 * asks for the locked message, and Back goes back. Escape is Back, on key repeat too, as on the
 * explorer card.
 */
import { habitatAreasLabel } from './areaText';
import type { HudView, Rect, Size } from './hudLayout';
import { BACK_LABEL } from './stylerText';
import { UI, WIDE_BUTTON, nextFocusIndex, wideButtonWidth, type TankKey } from './tankUi';
import type { Vec2 } from './vec';

/** The screen title (art guide 8): bold ink 28 px on a white panel. Defined once, in areaText.ts. */
export { AREA_MAP_TITLE } from './areaText';

/** Side of a square area marker, the map's primary target, in CSS px (art guide 10: primary at least 64). */
export const AREA_MARKER_PX = 64;

/** Width of a marker cell (the marker, its pill and its star row), in CSS px. */
export const AREA_CELL_W = 80;

/** Height of a marker cell: the pill slot, the marker, the gap and the star row, in CSS px. */
export const AREA_CELL_H = 112;

/** Slot at the top of a cell, above the marker's ink edge, for the "New!" pill, in CSS px. */
export const AREA_PILL_SLOT_PX = 12;

/** Distance from a cell's top to its marker centre, in CSS px. */
export const AREA_MARKER_CENTRE_Y = AREA_PILL_SLOT_PX + AREA_MARKER_PX / 2;

/** Room between the marker's bottom ink edge and the star row, in CSS px. */
export const AREA_STAR_ROW_GAP_PX = 12;

/** Side of one area star in a cell's star row, in CSS px. */
export const AREA_STAR_PX = 24;

/** Room between neighbouring stars in a cell's star row, in CSS px. */
export const AREA_STAR_GAP_PX = 4;

/** Stars in a cell's star row. */
export const AREA_STAR_COUNT = 3;

/** Width of a cell's star row, centred across the cell, in CSS px. */
export const AREA_STAR_ROW_W = AREA_STAR_COUNT * AREA_STAR_PX + (AREA_STAR_COUNT - 1) * AREA_STAR_GAP_PX;

/** Distance from a cell's top to its star row's top, in CSS px. */
export const AREA_STAR_ROW_Y = AREA_PILL_SLOT_PX + AREA_MARKER_PX + AREA_STAR_ROW_GAP_PX;

/** The "New!" pill, centred across the cell with its centre on the marker's top ink edge, in CSS px. */
export const AREA_NEW_PILL: Size = Object.freeze({ w: 56, h: 24 });

/** Room along the scroll axis between neighbouring markers on axis x, and between neighbouring cells on axis y, in CSS px. */
export const AREA_NODE_GAP_PX = 32;

/** Most room across the lane between the path's furthest-apart marker centres, in CSS px. */
export const AREA_WIND_PX = 48;

/** Label of the button that leaves the map. */
export const AREA_MAP_BACK_LABEL = BACK_LABEL;

/** Back: the standard wide button, 64 px tall, sized to its label. */
export const AREA_MAP_BACK_BUTTON: Size = Object.freeze({ w: wideButtonWidth(AREA_MAP_BACK_LABEL), h: WIDE_BUTTON.h });

/** Room between a habitat panel's edge and the cells it holds, in CSS px (issue #113, ND-7). */
export const AREA_PANEL_PAD_PX = 8;

/** Room along the scroll axis between the end of one habitat panel and the start of the next run, in CSS px. */
const RUN_GAP_PX = 32;

/** Cross-lane steps of the winding path, repeating from the first marker: middle, one side, middle, the other side. */
const WIND_STEPS: readonly number[] = Object.freeze([0, -1, 0, 1]);

/** Stars an area shows: its best so far. */
export type AreaMapStars = 0 | 1 | 2 | 3;

/** One area on the map, in area order: its marker number, its habitat, its best stars and its state. */
export interface AreaMapEntry {
  readonly id: string;
  readonly number: number;
  readonly habitatId: string;
  readonly habitatName: string;
  readonly stars: AreaMapStars;
  readonly locked: boolean;
  readonly isNew: boolean;
}

/**
 * Measured panel sizes in CSS px: each text with its panel padding (art guide 8: title 8 all round,
 * habitat labels and the message 8 across and 4 down), the panel at most `wrapW` wide, so the text
 * wraps at `wrapW` less the padding across.
 */
export interface AreaMapMeasure {
  /** The screen title panel. */
  title: (wrapW: number) => Size;
  /** A habitat label panel (its tab): the label text, such as "Lily pad pond: Areas 2 and 3". */
  habitat: (label: string, wrapW: number) => Size;
  /** The panel of the largest locked message the map can show, such as "Beat Area 9 to unlock!". */
  message: (wrapW: number) => Size;
}

/** The scroll axis: x scrolls left and right, y up and down. */
export type AreaMapAxis = 'x' | 'y';

/**
 * One area: its entry id, its AREA_CELL_W x AREA_CELL_H cell, its marker's square tap target and the
 * marker centre, in content CSS px.
 */
export interface AreaMapNode {
  id: string;
  cell: Rect;
  target: Rect;
  centre: Vec2;
}

/**
 * One habitat run (issue #113, ND-1): its habitat id and name, its label (habitatAreasLabel of the
 * run's area numbers), the label's tab panel `rect` and the run's backdrop `panel`, in content CSS px.
 */
export interface AreaMapHabitat {
  id: string;
  name: string;
  label: string;
  rect: Rect;
  panel: Rect;
}

/**
 * The map layout (module doc). `title` (null when hidden), `back`, `message` and `viewport` are fixed
 * screen rects; `nodes` (in entry order), `path` and `habitats` (one per run of entries sharing a
 * habitat) are in content CSS px within `content`. `fitStep` is the last fit step taken (0 to 3) and
 * `labelsAlong` whether the habitat labels sit along the axis inside their panels (step 2, axis x
 * only) instead of on their panels' top edges. `fits`
 * is false only when no fit step makes room across the axis for one cell; the lane then keeps a
 * cell's depth and reaches past the viewport.
 */
export interface AreaMapLayout {
  axis: AreaMapAxis;
  viewport: Rect;
  content: Size;
  nodes: AreaMapNode[];
  path: Vec2[];
  habitats: AreaMapHabitat[];
  title: Rect | null;
  back: Rect;
  message: Rect;
  fitStep: number;
  labelsAlong: boolean;
  fits: boolean;
}

/** What a key asks the scene to do: nothing, choose the focused area, show the locked message, or go back. */
export type AreaMapAction = 'none' | 'choose' | 'locked' | 'back';

/** The focus after a key, and what the scene must do. */
export interface AreaMapKeyResult {
  focus: number;
  action: AreaMapAction;
}

/** A run of consecutive entries sharing a habitat: its id, name, its entries' area numbers, and its label. */
interface HabitatRun {
  id: string;
  name: string;
  numbers: number[];
  label: string;
}

/** A box in axis terms: `u` and `along` on the scroll axis, `v` and `cross` across it. */
interface AxisBox {
  u: number;
  v: number;
  along: number;
  cross: number;
}

/** Where one run's tab, panel and first cell start along the scroll axis, and where its panel ends. */
interface RunAlong {
  tab: number;
  panel: number;
  firstCell: number;
  panelEnd: number;
}

/** Where each run and cell sits along the scroll axis, and the content length they use. */
interface AlongPlacement {
  runs: RunAlong[];
  cellStarts: number[];
  used: number;
}

/** The lane across the scroll axis: its start, its depth, its middle, and the depth the cells and winding use. */
interface LaneCross {
  start: number;
  depth: number;
  mid: number;
  used: number;
}

/** Where one run's tab and panel start across the scroll axis, and the panel's depth across it. */
interface RunCross {
  tab: number;
  panel: number;
  panelCross: number;
}

/** The fixed top: Back, the title (null when hidden), whether it is under Back, and the bottom edge of the lowest. */
interface MapHeader {
  back: Rect;
  title: Rect | null;
  titleUnder: boolean;
  bottom: number;
}

/** What one fit level does: its fit step, whether the labels sit along the axis, and whether the title shows. */
interface FitLevel {
  fitStep: number;
  labelsAlong: boolean;
  title: boolean;
}

/** Fit levels (module doc): level N has taken steps 1 to N; step 1 depends on the title's room and is folded into each. */
const FIT_LEVELS: readonly FitLevel[] = Object.freeze([
  { fitStep: 0, labelsAlong: false, title: true },
  { fitStep: 2, labelsAlong: true, title: true },
  { fitStep: 3, labelsAlong: true, title: false },
]);

/** One try: its fit level, header, viewport, label tabs, and the lane's start and room across the axis. */
interface FitTry {
  level: FitLevel;
  header: MapHeader;
  viewport: Rect;
  tabs: Size[];
  laneStart: number;
  laneRoom: number;
  need: number;
}

/** Throws a RangeError when there is no entry or two entries share an id. */
function checkEntries(entries: readonly AreaMapEntry[]): void {
  if (entries.length === 0) throw new RangeError('areaMapLayout: no area');
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) throw new RangeError('areaMapLayout: two areas share an id');
}

/** Throws a RangeError unless `focus` is a marker index or Back (`count`). */
function checkFocus(focus: number, count: number): void {
  if (!Number.isInteger(focus) || focus < 0 || focus > count) {
    throw new RangeError(`area map focus must be a whole number from 0 to ${count}: ${focus}`);
  }
}

/** Returns `value` clamped to [min, max], or `min` when the range is empty. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** The length of `size` along the scroll axis. */
function alongOf(axis: AreaMapAxis, size: Size): number {
  return axis === 'x' ? size.w : size.h;
}

/** The length of `size` across the scroll axis. */
function crossOf(axis: AreaMapAxis, size: Size): number {
  return axis === 'x' ? size.h : size.w;
}

/** The content rect of an axis box. */
function boxRect(axis: AreaMapAxis, box: AxisBox): Rect {
  if (axis === 'x') return { x: box.u, y: box.v, w: box.along, h: box.cross };
  return { x: box.v, y: box.u, w: box.cross, h: box.along };
}

/** The marker cell's size in axis terms: its length along the scroll axis and across it. */
function cellOnAxis(axis: AreaMapAxis): { along: number; cross: number } {
  const cell = { w: AREA_CELL_W, h: AREA_CELL_H };
  return { along: alongOf(axis, cell), cross: crossOf(axis, cell) };
}

/** Distance along the axis from one cell's start to the next: markers AREA_NODE_GAP_PX apart on x, cells on y. */
function cellStep(axis: AreaMapAxis): number {
  return axis === 'x' ? AREA_MARKER_PX + AREA_NODE_GAP_PX : AREA_CELL_H + AREA_NODE_GAP_PX;
}

/** Along length of a run of `count` cells, from its first cell's start to its last cell's end. */
function cellsSpan(axis: AreaMapAxis, count: number): number {
  return (count - 1) * cellStep(axis) + cellOnAxis(axis).along;
}

/**
 * Groups consecutive entries sharing a habitat id into runs, in entry order, each labelled with its
 * habitat name and area numbers (issue #113, ND-6). Throws as habitatAreasLabel does.
 */
function habitatRuns(entries: readonly AreaMapEntry[]): HabitatRun[] {
  const runs: HabitatRun[] = [];
  for (const entry of entries) {
    const last = runs[runs.length - 1];
    if (last !== undefined && last.id === entry.habitatId) last.numbers.push(entry.number);
    else runs.push({ id: entry.habitatId, name: entry.habitatName, numbers: [entry.number], label: '' });
  }
  for (const run of runs) run.label = habitatAreasLabel(run.name, run.numbers);
  return runs;
}

/**
 * Places Back top-left and, when `showTitle`, the title beside it when it fits there (as wide as the
 * room and no taller than Back), else centred under it.
 */
function headerLayout(view: HudView, measure: AreaMapMeasure, showTitle: boolean): MapHeader {
  const back: Rect = { x: UI.margin, y: UI.margin, w: AREA_MAP_BACK_BUTTON.w, h: AREA_MAP_BACK_BUTTON.h };
  const backBottom = back.y + back.h;
  if (!showTitle) return { back, title: null, titleUnder: false, bottom: backBottom };
  const besideX = back.x + back.w + UI.gap;
  const besideW = view.cssW - UI.margin - besideX;
  if (besideW > 0) {
    const beside = measure.title(besideW);
    if (beside.w <= besideW && beside.h <= back.h) {
      const x = Math.max(besideX, (view.cssW - beside.w) / 2);
      const title = { x, y: back.y + (back.h - beside.h) / 2, w: beside.w, h: beside.h };
      return { back, title, titleUnder: false, bottom: backBottom };
    }
  }
  const under = measure.title(Math.max(0, view.cssW - 2 * UI.margin));
  const y = backBottom + UI.gap;
  const title = { x: Math.max(UI.margin, (view.cssW - under.w) / 2), y, w: under.w, h: under.h };
  return { back, title, titleUnder: true, bottom: y + under.h };
}

/** Places the message line on the bottom margin, centred. */
function messageRect(view: HudView, measure: AreaMapMeasure): Rect {
  const size = measure.message(Math.max(0, view.cssW - 2 * UI.margin));
  return { x: Math.max(UI.margin, (view.cssW - size.w) / 2), y: view.cssH - UI.margin - size.h, w: size.w, h: size.h };
}

/**
 * Width a run's tab wraps at (module doc, issue #113 ND-7): on axis y the panel's width (the canvas
 * less the panel insets); on axis x along the axis the canvas less its margins; on axis x in the band
 * the run's cells plus the pad each side.
 */
function tabWrapWidth(axis: AreaMapAxis, view: HudView, run: HabitatRun, labelsAlong: boolean): number {
  if (axis === 'y') return Math.max(0, view.cssW - 2 * (UI.margin - AREA_PANEL_PAD_PX));
  if (labelsAlong) return Math.max(0, view.cssW - 2 * UI.margin);
  return cellsSpan(axis, run.numbers.length) + 2 * AREA_PANEL_PAD_PX;
}

/**
 * Depth across the axis the lane needs: a cell, and also the tallest tab when the labels sit along
 * the axis, or on axis y the widest tab less the panel's pad each side.
 */
function laneNeed(axis: AreaMapAxis, labelsAlong: boolean, tabCross: number): number {
  const cellCross = cellOnAxis(axis).cross;
  if (labelsAlong) return Math.max(cellCross, tabCross);
  if (axis === 'y') return Math.max(cellCross, tabCross - 2 * AREA_PANEL_PAD_PX);
  return cellCross;
}

/** Builds the try for `level`: the header, the viewport under it, the label panels and the lane across the axis. */
function fitTry(
  view: HudView,
  axis: AreaMapAxis,
  runs: readonly HabitatRun[],
  measure: AreaMapMeasure,
  message: Rect,
  level: FitLevel,
): FitTry {
  const header = headerLayout(view, measure, level.title);
  const top = header.bottom + UI.gap;
  const viewport: Rect = { x: 0, y: top, w: Math.max(0, view.cssW), h: Math.max(0, message.y - UI.gap - top) };
  const tabs = runs.map((run) => measure.habitat(run.label, tabWrapWidth(axis, view, run, level.labelsAlong)));
  const tabCross = Math.max(0, ...tabs.map((tab) => crossOf(axis, tab)));
  const inBand = axis === 'x' && !level.labelsAlong;
  const laneStart = inBand ? UI.margin + tabCross + AREA_PANEL_PAD_PX : UI.margin;
  const laneRoom = crossOf(axis, viewport) - UI.margin - laneStart;
  const need = laneNeed(axis, level.labelsAlong, tabCross);
  return { level, header, viewport, tabs, laneStart, laneRoom, need };
}

/** The fit levels open on `axis`: axis y has no band, so it never takes step 2 (module doc). */
function fitLevelsFor(axis: AreaMapAxis): readonly FitLevel[] {
  return axis === 'x' ? FIT_LEVELS : FIT_LEVELS.filter((level) => !level.labelsAlong);
}

/** The first try whose lane holds a cell (and the labels along it), else the one with the most room, earliest on a tie. */
function chooseTry(tries: readonly FitTry[]): FitTry {
  const fitting = tries.find((each) => each.laneRoom >= each.need);
  if (fitting !== undefined) return fitting;
  return tries.reduce((best, each) => (each.laneRoom - each.need > best.laneRoom - best.need ? each : best));
}

/**
 * Where one run starting at `start` along the axis puts its tab, panel and first cell, and where its
 * panel ends (module doc): on axis y the tab, then the panel under it; on axis x along the axis the
 * tab inside the panel, UI.gap before the first cell; on axis x in the band the tab over the panel's
 * start, the panel at least as long as the tab.
 */
function runAlong(axis: AreaMapAxis, tab: Size, count: number, labelsAlong: boolean, start: number): RunAlong {
  const pad = AREA_PANEL_PAD_PX;
  const span = cellsSpan(axis, count);
  if (axis === 'y') {
    const panel = start + tab.h;
    return { tab: start, panel, firstCell: panel + pad, panelEnd: panel + pad + span + pad };
  }
  if (labelsAlong) {
    const firstCell = start + pad + tab.w + UI.gap;
    return { tab: start + pad, panel: start, firstCell, panelEnd: firstCell + span + pad };
  }
  return { tab: start, panel: start, firstCell: start + pad, panelEnd: start + Math.max(span + 2 * pad, tab.w) };
}

/**
 * Places the runs along the scroll axis, the first panel AREA_PANEL_PAD_PX inside the margin: each
 * run as runAlong places it, its cells cellStep apart from its first cell, and the next run
 * RUN_GAP_PX past the end of its panel. `runs` holds at least one run.
 */
function placeAlong(
  axis: AreaMapAxis,
  runs: readonly HabitatRun[],
  tabs: readonly Size[],
  labelsAlong: boolean,
): AlongPlacement {
  const placed: RunAlong[] = [];
  const cellStarts: number[] = [];
  const step = cellStep(axis);
  let cursor = UI.margin - AREA_PANEL_PAD_PX;
  runs.forEach((run, runIndex) => {
    const along = runAlong(axis, tabs[runIndex], run.numbers.length, labelsAlong, cursor);
    placed.push(along);
    for (let i = 0; i < run.numbers.length; i += 1) cellStarts.push(along.firstCell + i * step);
    cursor = along.panelEnd + RUN_GAP_PX;
  });
  const end = placed[placed.length - 1].panelEnd;
  return { runs: placed, cellStarts, used: end + UI.margin - AREA_PANEL_PAD_PX };
}

/**
 * Where a run's tab and panel sit across the axis (module doc): on axis y the panel spans the lane
 * plus the pad, the tab at its start; on axis x the panel spans the used lane plus the pad, centred
 * on the lane, with the tab on its top edge, or along the axis centred on the lane with the panel
 * grown to hold it.
 */
function runCross(axis: AreaMapAxis, labelsAlong: boolean, tab: Size, lane: LaneCross): RunCross {
  const pad = AREA_PANEL_PAD_PX;
  if (axis === 'y') {
    const panel = lane.start - pad;
    return { tab: panel, panel, panelCross: lane.depth + 2 * pad };
  }
  const tabCross = crossOf(axis, tab);
  const panelCross = (labelsAlong ? Math.max(lane.used, tabCross) : lane.used) + 2 * pad;
  const panel = lane.mid - panelCross / 2;
  return { tab: labelsAlong ? lane.mid - tabCross / 2 : panel - tabCross, panel, panelCross };
}

/** The habitat of `run`: its label, its tab rect and its panel rect, shifted `shift` along the axis. */
function habitatAt(
  axis: AreaMapAxis,
  run: HabitatRun,
  tab: Size,
  along: RunAlong,
  cross: RunCross,
  shift: number,
): AreaMapHabitat {
  const tabBox = { u: along.tab + shift, v: cross.tab, along: alongOf(axis, tab), cross: crossOf(axis, tab) };
  const panelBox = { u: along.panel + shift, v: cross.panel, along: along.panelEnd - along.panel, cross: cross.panelCross };
  return { id: run.id, name: run.name, label: run.label, rect: boxRect(axis, tabBox), panel: boxRect(axis, panelBox) };
}

/** The node for a cell at `cell`: the marker centre AREA_MARKER_CENTRE_Y down and its square target. */
function nodeAt(id: string, cell: Rect): AreaMapNode {
  const centre = { x: cell.x + AREA_CELL_W / 2, y: cell.y + AREA_MARKER_CENTRE_Y };
  const half = AREA_MARKER_PX / 2;
  return { id, cell, target: { x: centre.x - half, y: centre.y - half, w: AREA_MARKER_PX, h: AREA_MARKER_PX }, centre };
}

/**
 * Lays out the area map for the CSS canvas `view` (module doc). `entries` holds at least one area,
 * ids unique, and each habitat run's area numbers are integers of 1 or more, none twice; else throws
 * RangeError.
 */
export function areaMapLayout(view: HudView, entries: readonly AreaMapEntry[], measure: AreaMapMeasure): AreaMapLayout {
  checkEntries(entries);
  const axis: AreaMapAxis = view.cssW >= view.cssH ? 'x' : 'y';
  const message = messageRect(view, measure);
  const runs = habitatRuns(entries);
  const chosen = chooseTry(fitLevelsFor(axis).map((level) => fitTry(view, axis, runs, measure, message, level)));
  const { header, viewport, tabs, laneStart, level } = chosen;

  const cell = cellOnAxis(axis);
  const lane = Math.max(chosen.need, chosen.laneRoom);
  const wind = clamp(chosen.laneRoom - cell.cross, 0, AREA_WIND_PX);
  const laneMid = laneStart + lane / 2;

  const placed = placeAlong(axis, runs, tabs, level.labelsAlong);
  const contentAlong = Math.max(alongOf(axis, viewport), placed.used);
  const shift = (contentAlong - placed.used) / 2;
  const contentCross = Math.max(crossOf(axis, viewport), laneStart + lane + UI.margin);

  const nodes = entries.map((entry, index) => {
    const v = laneMid + (WIND_STEPS[index % WIND_STEPS.length] * wind) / 2 - cell.cross / 2;
    return nodeAt(entry.id, boxRect(axis, { u: placed.cellStarts[index] + shift, v, along: cell.along, cross: cell.cross }));
  });
  const laneCross: LaneCross = { start: laneStart, depth: lane, mid: laneMid, used: cell.cross + wind };
  const habitats = runs.map((run, runIndex) => {
    const tab = tabs[runIndex];
    const cross = runCross(axis, level.labelsAlong, tab, laneCross);
    return habitatAt(axis, run, tab, placed.runs[runIndex], cross, shift);
  });

  return {
    axis,
    viewport,
    content: axis === 'x' ? { w: contentAlong, h: contentCross } : { w: contentCross, h: contentAlong },
    nodes,
    path: nodes.map((node) => ({ x: node.centre.x, y: node.centre.y })),
    habitats,
    title: header.title,
    back: header.back,
    message,
    fitStep: level.fitStep === 0 && header.titleUnder ? 1 : level.fitStep,
    labelsAlong: level.labelsAlong,
    fits: chosen.laneRoom >= chosen.need,
  };
}

/**
 * The focus index the map opens on: the area `lastAreaId` when it is on the map, else the newest
 * unlocked area (the highest-numbered one not locked), else 0.
 */
export function initialFocus(entries: readonly AreaMapEntry[], lastAreaId: string | null): number {
  const last = entries.findIndex((entry) => entry.id === lastAreaId);
  if (last >= 0) return last;
  let newest = -1;
  entries.forEach((entry, index) => {
    if (!entry.locked && (newest < 0 || entry.number > entries[newest].number)) newest = index;
  });
  return newest >= 0 ? newest : 0;
}

/** The focus after an arrow `step` (+1 next, -1 previous) along the path, from a marker or from Back (`count`). */
function arrowFocus(focus: number, count: number, step: number): number {
  if (count === 0) return focus;
  if (focus === count) return step > 0 ? 0 : count - 1;
  return clamp(focus + step, 0, count - 1);
}

/** What a press of the focused control asks for: Back goes back; a marker chooses its area, or the locked message. */
function pressAction(focus: number, entries: readonly AreaMapEntry[]): AreaMapAction {
  if (focus === entries.length) return 'back';
  return entries[focus].locked ? 'locked' : 'choose';
}

/**
 * Applies one key to the map focus (module doc). `key` is the tankKeyFor action of the key press
 * (Tab is next, Shift+Tab previous, Enter and Space confirm, Escape cancel), or null for any other
 * key; `repeat` is whether the press is a key repeat. Keys with no map meaning give 'none' and keep
 * the focus. `focus` must be a marker index or Back (entries.length); else throws RangeError.
 */
export function areaMapKey(
  focus: number,
  key: TankKey | null,
  repeat: boolean,
  entries: readonly AreaMapEntry[],
): AreaMapKeyResult {
  const back = entries.length;
  checkFocus(focus, back);
  switch (key) {
    case 'next':
    case 'previous':
      return { focus: nextFocusIndex(focus, back + 1, key === 'next' ? 1 : -1), action: 'none' };
    case 'right':
    case 'down':
      return { focus: arrowFocus(focus, back, 1), action: 'none' };
    case 'left':
    case 'up':
      return { focus: arrowFocus(focus, back, -1), action: 'none' };
    case 'confirm':
      return { focus, action: repeat ? 'none' : pressAction(focus, entries) };
    case 'cancel':
      return { focus, action: 'back' };
    default:
      return { focus, action: 'none' };
  }
}

/**
 * The scroll along `layout.axis` that shows the whole focused marker with UI.margin round it in a
 * scroll area of size `viewport` (normally layout.viewport), moving as little as it can from
 * `scroll` (itself first clamped to 0 through the content length less the viewport length, 0 when
 * the content fits), and clamped to that range. Back is fixed on screen, so focusing Back (index
 * layout.nodes.length) returns `scroll` unchanged. Throws RangeError for any other index that is not
 * a marker, or a scroll that is not finite.
 */
export function scrollToFocus(layout: AreaMapLayout, focusIndex: number, scroll: number, viewport: Size): number {
  checkFocus(focusIndex, layout.nodes.length);
  if (focusIndex === layout.nodes.length) return scroll;
  if (!Number.isFinite(scroll)) throw new RangeError(`scrollToFocus: scroll must be finite: ${scroll}`);
  const target = layout.nodes[focusIndex].target;
  const start = (layout.axis === 'x' ? target.x : target.y) - UI.margin;
  const end = start + alongOf(layout.axis, target) + 2 * UI.margin;
  const viewAlong = alongOf(layout.axis, viewport);
  const max = Math.max(0, alongOf(layout.axis, layout.content) - viewAlong);
  let next = clamp(scroll, 0, max);
  if (end > next + viewAlong) next = end - viewAlong;
  if (start < next) next = start;
  return clamp(next, 0, max);
}
