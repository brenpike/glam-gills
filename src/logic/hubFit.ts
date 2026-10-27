/**
 * The Home Tank hub fit rule (issue #148, ND-1, ND-2, ND-5 and ND-6): where the Menu button goes, the
 * tank frame of the hub, and the menu (the hub actions, the name panel, the best-stars badge and the
 * focus caption room) on that frame. The Menu button and its folded Refuge nudge never overlap the
 * tank box. Only on canvases where no Menu button spot is off the tank box at the contain-fit scale
 * does the hub's tank shrink, just enough to free one. Then the menu's fold and open rules (PRD C16,
 * ND-6), which save nothing. Pure: sizes come in measured, in CSS px.
 */
import type { HudView, Rect, Size } from './hudLayout';
import { hubStarsBadgeRect, hubStarsBadgeShape, type HubBadgeShape } from './starsUi';
import { TANK, tankBoxCss, tankFrame, tankFrameAt, topKeepClearCss, type TankFrame } from './tank';
import { UI, hubCaptionRect, hubLayout, type HubAction, type HubActionId, type HubLayout } from './tankUi';

/** Float noise allowed when rects touch, in CSS px. */
const TOUCH_EPS = 1e-9;

/** Where the Menu button sits, in the order the spots are tried: left of the tank box, then above its lid. */
export type MenuSpot = 'bottomLeft' | 'topLeft';

/** The Menu button spots in the order they are tried (issue #148, ND-5). */
const MENU_SPOTS: readonly MenuSpot[] = Object.freeze(['bottomLeft', 'topLeft']);

/**
 * The measured hub sizes the rule needs: the Menu button's body, the folded Refuge nudge's overhang
 * past the button's top-right corner, each hub action (full and compact), the name panel, the
 * best-stars badge in each shape, and the longest focus caption.
 */
export interface HubFitSizes {
  menu: Size;
  nudgeOverhang: number;
  actions: readonly HubAction[];
  title: Size | null;
  badge: Readonly<Record<HubBadgeShape, Size>>;
  caption: Size;
}

/**
 * The hub fit: the tank frame of the hub, the Menu button's spot and rect, its footprint with the
 * nudge, the menu on that frame (the hub layout, the badge rect and the caption room, null when the
 * hub is not compact or there is no place), and whether the menu opens by default.
 */
export interface HubFit {
  frame: TankFrame;
  spot: MenuSpot;
  menu: Rect;
  menuFootprint: Rect;
  hub: HubLayout;
  badge: Rect;
  caption: Rect | null;
  openByDefault: boolean;
}

/** A frame and the Menu button spot it frees. */
interface MenuPlacement {
  frame: TankFrame;
  spot: MenuSpot;
}

/** True when `a` and `b` share area; touching edges do not overlap. */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - TOUCH_EPS &&
    b.x < a.x + a.w - TOUCH_EPS &&
    a.y < b.y + b.h - TOUCH_EPS &&
    b.y < a.y + a.h - TOUCH_EPS
  );
}

/** `value` when it is finite and positive, else 0. */
function lengthOrZero(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** `value` when it is finite and positive, else 1: the canvas length tankFrame uses for a degenerate size. */
function canvasLength(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** The Menu button's rect at `spot`: a corner inside the `UI.margin` edges. */
function menuRectAt(view: HudView, menu: Size, spot: MenuSpot): Rect {
  const y = spot === 'bottomLeft' ? view.cssH - UI.margin - menu.h : UI.margin;
  return { x: UI.margin, y, w: menu.w, h: menu.h };
}

/** The Menu button's rect grown by the nudge's `overhang` on its top and right. */
function menuFootprint(menu: Rect, overhang: number): Rect {
  const grow = lengthOrZero(overhang);
  return { x: menu.x, y: menu.y - grow, w: menu.w + grow, h: menu.h + grow };
}

/** True when the Menu button at `spot` is off the tank box of `frame` (with its nudge) and out of the top keep-clear band. */
function isSpotFree(view: HudView, frame: TankFrame, sizes: HubFitSizes, spot: MenuSpot): boolean {
  const menu = menuRectAt(view, sizes.menu, spot);
  const band = topKeepClearCss(frame);
  const inBand = menu.y < band.y1 - TOUCH_EPS && menu.y + menu.h > band.y0 + TOUCH_EPS;
  return !inBand && !rectsOverlap(menuFootprint(menu, sizes.nudgeOverhang), tankBoxCss(frame));
}

/** The first spot free on `frame`, or null when none is. */
function firstFreeSpot(view: HudView, frame: TankFrame, sizes: HubFitSizes): MenuPlacement | null {
  const spot = MENU_SPOTS.find((candidate) => isSpotFree(view, frame, sizes, candidate));
  return spot === undefined ? null : { frame, spot };
}

/**
 * The largest scale at which a spot is off the tank box (issue #148, ND-2): the left strip
 * `cssW / 2 - (viewW / 2 - glass.x0) * scale` holds the footprint's width with the margin, or the top
 * strip `cssH - (viewH - lidTop) * scale` holds the button's height with the margin.
 */
function freeingScale(view: HudView, sizes: HubFitSizes): number {
  const footprintW = UI.margin + sizes.menu.w + lengthOrZero(sizes.nudgeOverhang);
  const leftScale = (view.cssW / 2 - footprintW) / (TANK.viewW / 2 - TANK.glass.x0);
  const topScale = (view.cssH - UI.margin - sizes.menu.h) / (TANK.viewH - TANK.lidTop);
  return Math.max(leftScale, topScale);
}

/** The frame at the freeing scale and the first spot it frees; null when the scale is not positive or frees none. */
function shrunkPlacement(view: HudView, sizes: HubFitSizes): MenuPlacement | null {
  const scale = freeingScale(view, sizes);
  if (!(scale > 0)) return null;
  return firstFreeSpot(view, tankFrameAt(view.cssW, view.cssH, scale), sizes);
}

/** Every menu rect of the fit that shows: the hub actions, the name panel, the badge and the caption room. */
function menuRects(fit: Pick<HubFit, 'hub' | 'badge' | 'caption'>): Rect[] {
  const rects = fit.hub.actions.map((action) => action.rect);
  if (fit.hub.title !== null) rects.push(fit.hub.title);
  rects.push(fit.badge);
  if (fit.caption !== null) rects.push(fit.caption);
  return rects;
}

/**
 * The hub fit on `view` (issue #148, ND-2, ND-5 and ND-6). The Menu button takes the first spot of
 * MENU_SPOTS whose footprint (with the nudge) is off the tank box of tankFrame and out of the top
 * keep-clear band; the frame is then tankFrame. Where neither spot is free, the frame is the largest
 * scale below the contain-fit one that frees a spot, centred across and bottom-aligned, and the button
 * takes that spot. The menu goes on the frame by hubLayout, hubStarsBadgeRect and hubCaptionRect, each
 * a gap from the button's footprint. The menu opens by default only when none of it overlaps the tank
 * box. Degenerate canvases keep tankFrame and the first spot. A canvas size that is zero, negative or
 * not finite counts as 1 CSS px, as tankFrame counts it, for every rect, so each rect is finite.
 */
export function hubFit(rawView: HudView, sizes: HubFitSizes): HubFit {
  const view: HudView = { ...rawView, cssW: canvasLength(rawView.cssW), cssH: canvasLength(rawView.cssH) };
  const full = tankFrame(view.cssW, view.cssH);
  const placement = firstFreeSpot(view, full, sizes) ?? shrunkPlacement(view, sizes) ?? { frame: full, spot: MENU_SPOTS[0] };
  return menuOnFrame(view, placement, sizes);
}

/** The Menu button at the placement's spot and the menu on its frame. */
function menuOnFrame(view: HudView, placement: MenuPlacement, sizes: HubFitSizes): HubFit {
  const { frame, spot } = placement;
  const menu = menuRectAt(view, sizes.menu, spot);
  const footprint = menuFootprint(menu, sizes.nudgeOverhang);
  const hub = hubLayout(view, frame, sizes.actions, sizes.title, footprint);
  const badge = hubStarsBadgeRect(view, frame, hub, sizes.badge[hubStarsBadgeShape(hub)], footprint);
  const caption = hub.compact ? hubCaptionRect(view, frame, hub, sizes.caption, [badge, footprint]) : null;
  const box = tankBoxCss(frame);
  const openByDefault = menuRects({ hub, badge, caption }).every((rect) => !rectsOverlap(rect, box));
  return { frame, spot, menu, menuFootprint: footprint, hub, badge, caption, openByDefault };
}

/**
 * The tank frame a Home Tank mode draws on (issue #148, ND-3): the full-size tankFrame in decorate
 * mode, so decorating (PRD C9) keeps its size, else `hubFrame`, the hub fit's frame (HubFit.frame).
 * The two differ only on the shrunk set.
 */
export function modeTankFrame(view: HudView, hubFrame: TankFrame, decorating: boolean): TankFrame {
  return decorating ? tankFrame(view.cssW, view.cssH) : hubFrame;
}

/** Whether the hub menu is open, and the canvas default it was last set from (PRD C16, issue #148, ND-6). Never saved. */
export interface HubMenuState {
  open: boolean;
  openByDefault: boolean;
}

/**
 * What the hub menu reacts to: a resize with the canvas's new default, a press on the Menu button,
 * coming back from a screen a menu action opened (the explorer card for Go exploring), or coming back
 * from a screen an axolotl opened (its choices card, and restyle from that card).
 */
export type HubMenuEvent =
  | { kind: 'resize'; openByDefault: boolean }
  | { kind: 'toggle' }
  | { kind: 'returnFromAction'; id: HubActionId }
  | { kind: 'returnFromAxolotl' };

/** The hub menu after an event, and the hub action the focus goes to (null: the focus stays where it is). */
export interface HubMenuStep {
  state: HubMenuState;
  focus: HubActionId | null;
}

/** The hub menu when the Home Tank starts: open when the canvas opens it by default (HubFit.openByDefault). */
export function startHubMenu(openByDefault: boolean): HubMenuState {
  return { open: openByDefault, openByDefault };
}

/**
 * The hub menu after `event` (PRD C16, ND-6). Coming back from a menu action's screen opens the menu
 * with the focus on that action. Coming back from an axolotl's screen keeps the state. A resize that
 * changes the default takes the new default; one that keeps it changes nothing. A Menu button press
 * folds an open menu and opens a folded one.
 */
export function stepHubMenu(state: HubMenuState, event: HubMenuEvent): HubMenuStep {
  switch (event.kind) {
    case 'resize':
      if (event.openByDefault === state.openByDefault) return { state, focus: null };
      return { state: startHubMenu(event.openByDefault), focus: null };
    case 'toggle':
      return { state: { ...state, open: !state.open }, focus: null };
    case 'returnFromAction':
      return { state: { ...state, open: true }, focus: event.id };
    case 'returnFromAxolotl':
      return { state, focus: null };
  }
}
