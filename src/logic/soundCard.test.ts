import { describe, expect, it } from 'vitest';
import { CARD, isSupportedCanvas } from './cardFit';
import type { HudView, Rect } from './hudLayout';
import { MUSIC_OFF_LABEL } from './music';
import { SOUND_CARD_FOCUS, soundCardLayout, type SoundCardSizes } from './soundCard';
import { SOUNDS_OFF_LABEL } from './sounds';
import { CLOSE_LABEL, SOUND_LABEL } from './tankText';
import { LABEL_BOLD_EM, TILE_BUTTON, WIDE_BUTTON, tileButtonWidth, wideButtonWidth } from './tankUi';

/** The Sound card as the scene measures it: a bold 34 px title, the two 64 px switch tiles and a wide Close. */
const SIZES: SoundCardSizes = {
  title: { w: SOUND_LABEL.length * LABEL_BOLD_EM * CARD.titlePx, h: CARD.titlePx * 1.25 },
  music: { w: tileButtonWidth(MUSIC_OFF_LABEL), h: TILE_BUTTON.h },
  sounds: { w: tileButtonWidth(SOUNDS_OFF_LABEL), h: TILE_BUTTON.h },
  close: { w: wideButtonWidth(CLOSE_LABEL), h: WIDE_BUTTON.h },
};

const WIDTHS = [320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024, 1280, 1366];
const HEIGHTS = [320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932];
const CANVASES: HudView[] = WIDTHS.flatMap((cssW) =>
  HEIGHTS.filter((cssH) => isSupportedCanvas(cssW, cssH)).map((cssH) => ({ cssW, cssH })),
);

function inside(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x - 1e-9 && inner.y >= outer.y - 1e-9 && inner.x + inner.w <= outer.x + outer.w + 1e-9 && inner.y + inner.h <= outer.y + outer.h + 1e-9;
}

function apart(a: Rect, b: Rect): boolean {
  return a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
}

describe('soundCardLayout (S14; open question 429)', () => {
  it('fits the card and every part inside it on every supported canvas', () => {
    const problems: string[] = [];
    for (const view of CANVASES) {
      const layout = soundCardLayout(view, SIZES);
      const screen = { x: CARD.margin, y: CARD.margin, w: view.cssW - 2 * CARD.margin, h: view.cssH - 2 * CARD.margin };
      const parts = [layout.title, layout.music, layout.sounds, layout.close];
      if (!inside(layout.panel, screen)) problems.push(`${view.cssW}x${view.cssH}: panel off screen`);
      for (const part of parts) if (!inside(part, layout.panel)) problems.push(`${view.cssW}x${view.cssH}: part outside the panel`);
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) if (!apart(parts[i], parts[j])) problems.push(`${view.cssW}x${view.cssH}: parts ${i} and ${j} overlap`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('puts the sounds switch beside the music switch where the pair fits, at 460 x 320 and wider', () => {
    const layout = soundCardLayout({ cssW: 460, cssH: 320 }, SIZES);
    expect(layout.stacked).toBe(false);
    expect(layout.sounds.y).toBe(layout.music.y);
    expect(layout.sounds.x - (layout.music.x + layout.music.w)).toBe(CARD.buttonGap);
    expect(layout.close.y).toBe(layout.music.y + layout.music.h + CARD.buttonGap);
    for (const view of CANVASES.filter((v) => v.cssW >= 460)) expect(soundCardLayout(view, SIZES).stacked).toBe(false);
  });

  it('stacks the sounds switch under the music switch at 320 x 440', () => {
    const layout = soundCardLayout({ cssW: 320, cssH: 440 }, SIZES);
    expect(layout.stacked).toBe(true);
    expect(layout.sounds.y).toBe(layout.music.y + layout.music.h + CARD.buttonGap);
    expect(layout.close.y).toBe(layout.sounds.y + layout.sounds.h + CARD.buttonGap);
  });

  it('keeps every button at least 48 px (PRD X5)', () => {
    for (const size of [SIZES.music, SIZES.sounds, SIZES.close]) {
      expect(size.w).toBeGreaterThanOrEqual(48);
      expect(size.h).toBeGreaterThanOrEqual(48);
    }
  });

  it('focuses the music switch, then the sounds switch, then Close', () => {
    expect(SOUND_CARD_FOCUS).toEqual(['music', 'sounds', 'close']);
  });
});
