/**
 * The Home Tank's Sound card (PRD M8, S14; open question 429): the "Sound" hub tile opens it, with
 * the music switch and the sounds switch side by side (stacked, music on top, where the pair does not
 * fit across), and a Close button under them. Sizes come in measured, in CSS px.
 */
import { CARD } from './cardFit';
import type { HudView, Rect, Size } from './hudLayout';

/** The measured parts of the Sound card. */
export interface SoundCardSizes {
  title: Size;
  music: Size;
  sounds: Size;
  close: Size;
}

/** Where the Sound card's parts go. */
export interface SoundCardLayout {
  panel: Rect;
  title: Rect;
  music: Rect;
  sounds: Rect;
  close: Rect;
  /** Whether the sounds switch sits under the music switch instead of beside it. */
  stacked: boolean;
}

/** The Sound card's buttons in focus order: the music switch, the sounds switch, then Close. */
export const SOUND_CARD_FOCUS = Object.freeze(['music', 'sounds', 'close'] as const);

/**
 * Lays out the Sound card centred on `view`: the title, the two switches CARD.buttonGap apart (side
 * by side when they fit across the panel, else stacked) and Close, each row centred and CARD.buttonGap
 * under the last. The padding tightens to CARD.tightPad when the card would not fit the canvas height.
 */
export function soundCardLayout(view: HudView, sizes: SoundCardSizes): SoundCardLayout {
  const gap = CARD.buttonGap;
  const maxPanelW = view.cssW - 2 * CARD.margin;
  const pairW = sizes.music.w + gap + sizes.sounds.w;
  const stacked = pairW + 2 * CARD.pad > maxPanelW;
  const switchesW = stacked ? Math.max(sizes.music.w, sizes.sounds.w) : pairW;
  const switchesH = stacked ? sizes.music.h + gap + sizes.sounds.h : Math.max(sizes.music.h, sizes.sounds.h);
  const contentH = sizes.title.h + gap + switchesH + gap + sizes.close.h;
  const pad = contentH + 2 * CARD.pad <= view.cssH - 2 * CARD.margin ? CARD.pad : CARD.tightPad;
  const contentW = Math.max(sizes.title.w, switchesW, sizes.close.w);
  const panelW = Math.min(maxPanelW, contentW + 2 * pad);
  const panelH = contentH + 2 * pad;
  const panel = { x: (view.cssW - panelW) / 2, y: (view.cssH - panelH) / 2, w: panelW, h: panelH };
  const centred = (size: Size, y: number): Rect => ({ x: (view.cssW - size.w) / 2, y, w: size.w, h: size.h });
  const title = centred(sizes.title, panel.y + pad);
  const switchesY = title.y + title.h + gap;
  const music = stacked ? centred(sizes.music, switchesY) : { x: (view.cssW - pairW) / 2, y: switchesY, ...sizes.music };
  const sounds = stacked
    ? centred(sizes.sounds, switchesY + sizes.music.h + gap)
    : { x: music.x + sizes.music.w + gap, y: switchesY, ...sizes.sounds };
  const close = centred(sizes.close, switchesY + switchesH + gap);
  return { panel, title, music, sounds, close, stacked };
}
