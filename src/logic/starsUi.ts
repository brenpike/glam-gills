/**
 * Star UI sizes and placement in CSS px (PRD H5, H7, H8): the star row on the "Area beaten" card
 * and the best-stars badge in the Home Tank hub. Sizes come in measured; nothing here shrinks them.
 */
import type { HudView, Rect, Size } from './hudLayout';
import { STARS_PER_AREA } from './stars';
import type { TankFrame } from './tank';
import { UI, type HubLayout } from './tankUi';

/** One star on the "Area beaten" card and the gap between stars, in CSS px. */
export const STAR_ROW = Object.freeze({ starPx: 40, gap: 12 });

/** The hub best-stars badge: star size and gap, label text size, panel padding, label-to-stars gap. */
export const HUB_STARS_BADGE = Object.freeze({ starPx: 24, starGap: 4, labelPx: 18, pad: 12, gap: 8 });

/** Size of the row of 3 stars on the "Area beaten" card. */
export function starRowSize(): Size {
  return {
    w: STARS_PER_AREA * STAR_ROW.starPx + (STARS_PER_AREA - 1) * STAR_ROW.gap,
    h: STAR_ROW.starPx,
  };
}

/** Top of the first free row under the hub title and actions, or the top of their room when there are none. */
function belowHub(hub: HubLayout): number {
  const rects = hub.actions.map((action) => action.rect);
  if (hub.title) rects.push(hub.title);
  if (rects.length === 0) return hub.room.top;
  return Math.max(...rects.map((rect) => rect.y + rect.h)) + UI.gap;
}

/** How the hub best-stars badge is laid out: the area label beside the stars, or stacked above them. */
export type HubBadgeShape = 'beside' | 'stacked';

/**
 * The hub best-stars badge shape for `hub`: stacked when the hub rows reach over the floor
 * Decorations (it then sits in the bottom-right corner), else beside. Text and star sizes are the same.
 */
export function hubStarsBadgeShape(hub: HubLayout): HubBadgeShape {
  return hub.reach ? 'stacked' : 'beside';
}

/** True when `a` and `b` are at least `UI.gap` apart across or down. */
function isGapApart(a: Rect, b: Rect): boolean {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy) >= UI.gap - 1e-9;
}

/**
 * Where the hub best-stars badge of size `badge` goes. When the hub rows reach over the floor
 * Decorations, always the bottom-right corner inside the edge margins. Else centred a gap under the
 * hub title and actions (at the top of the hub's room when there are none) when it fits across and
 * inside the room of the hub's last row, else that corner. `frame` is unused and kept for callers.
 *
 * `avoid` (hub only, issue #148, ND-5) is the Menu button's rect with its nudge. With it, the centred
 * place is used only when it is at least `UI.gap` from `avoid`, and the bottom-right corner only when
 * it is at least `UI.gap` from the hub title and actions; else the top-right corner inside the edge
 * margins when that is a gap from them and from `avoid`; else the bottom-right corner. Without
 * `avoid`, as above.
 */
export function hubStarsBadgeRect(view: HudView, _frame: TankFrame, hub: HubLayout, badge: Size, avoid?: Rect): Rect {
  const corner: Rect = { x: view.cssW - UI.margin - badge.w, y: view.cssH - UI.margin - badge.h, w: badge.w, h: badge.h };
  if (avoid === undefined && hub.reach) return corner;
  const top = belowHub(hub);
  const fitsAcross = badge.w <= view.cssW - 2 * UI.margin;
  if (!hub.reach && fitsAcross && top + badge.h <= hub.room.bottom) {
    const centred: Rect = { x: (view.cssW - badge.w) / 2, y: top, w: badge.w, h: badge.h };
    if (avoid === undefined || isGapApart(centred, avoid)) return centred;
  }
  if (avoid === undefined) return corner;
  return clearCorner(hub, corner, { ...corner, y: UI.margin }, avoid);
}

/** `corner` when it is a gap from the hub title and actions; else `topCorner` when it is a gap from them and `avoid`; else `corner`. */
function clearCorner(hub: HubLayout, corner: Rect, topCorner: Rect, avoid: Rect): Rect {
  const rects = hub.actions.map((action) => action.rect);
  if (hub.title !== null) rects.push(hub.title);
  if (rects.every((rect) => isGapApart(corner, rect))) return corner;
  return [...rects, avoid].every((rect) => isGapApart(topCorner, rect)) ? topCorner : corner;
}
