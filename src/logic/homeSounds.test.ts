import { describe, expect, it } from 'vitest';
import type { AreaMapEntry } from './areaMap';
import { DREAM_COLOURS } from './catalogue';
import { arrivalSound, buttonPressSound, newAreaSound, restyleSound, surprisePressed, type RestyleWear } from './homeSounds';
import { emptyOutfit, type Outfit } from './outfit';
import { mulberry32 } from './rng';
import { creatorStart, type StylerAction, type StylerState } from './styler';

const SUN_HAT = 'canal/sun-hat';
const FLOWER_CROWN = 'pond/lily-flower-crown';
const NECKLACE = 'canal/shell-necklace';
const MINT = DREAM_COLOURS[0].id;
const SKY_BLUE = DREAM_COLOURS[1].id;

function createWear(dreamColour: RestyleWear['dreamColour'], outfit: Partial<Outfit> = {}): RestyleWear {
  return { dreamColour, outfit: { ...emptyOutfit(), ...outfit } };
}

function createStyler(overrides: Partial<StylerState>): StylerState {
  return { ...creatorStart(mulberry32(1)), ...overrides };
}

function createKey(key: string, shiftKey = false): StylerAction {
  return { type: 'key', key, shiftKey, columns: 3 };
}

function createEntry(number: number, overrides: Partial<AreaMapEntry> = {}): AreaMapEntry {
  return { id: `area-${number}`, number, habitatId: 'canal', habitatName: 'Canal', stars: 0, locked: false, isNew: false, ...overrides };
}

describe('buttonPressSound (issue #167, ND-2)', () => {
  it('taps by default', () => {
    expect(buttonPressSound({})).toBe('tap');
    expect(buttonPressSound({ taps: true })).toBe('tap');
    expect(buttonPressSound({ taps: true, backTap: false })).toBe('tap');
  });

  it('plays back for a back tap', () => {
    expect(buttonPressSound({ backTap: true })).toBe('back');
    expect(buttonPressSound({ taps: true, backTap: true })).toBe('back');
  });

  it('plays nothing for a button that does not tap, even with a back tap', () => {
    expect(buttonPressSound({ taps: false })).toBeNull();
    expect(buttonPressSound({ taps: false, backTap: true })).toBeNull();
  });
});

describe('arrivalSound (issue #167, ND-11)', () => {
  it('plays arrive after Go home and after being carried home', () => {
    expect(arrivalSound('wentHome')).toBe('arrive');
    expect(arrivalSound('carriedHome')).toBe('arrive');
  });

  it('plays nothing after beating the area', () => {
    expect(arrivalSound('areaBeaten')).toBeNull();
  });
});

describe('restyleSound (issue #167, ND-4, ND-5)', () => {
  it('plays nothing when nothing changed', () => {
    expect(restyleSound(createWear(null), createWear(null))).toBeNull();
    expect(restyleSound(createWear(MINT, { head: SUN_HAT }), createWear(MINT, { head: SUN_HAT }))).toBeNull();
  });

  it('plays the Dream colour sound for a new Dream colour, from none or from another', () => {
    expect(restyleSound(createWear(null), createWear(MINT))).toBe('dreamColour');
    expect(restyleSound(createWear(MINT), createWear(SKY_BLUE))).toBe('dreamColour');
  });

  it('plays nothing for removing a Dream colour alone', () => {
    expect(restyleSound(createWear(MINT), createWear(null))).toBeNull();
  });

  it('plays the Dream colour sound over a Wearable put on at the same time', () => {
    expect(restyleSound(createWear(null), createWear(MINT, { head: SUN_HAT }))).toBe('dreamColour');
  });

  it('plays the Dream colour sound over a Wearable taken off at the same time', () => {
    expect(restyleSound(createWear(null, { head: SUN_HAT }), createWear(MINT))).toBe('dreamColour');
  });

  it('plays wear on for a Wearable put on in an empty slot', () => {
    expect(restyleSound(createWear(null), createWear(null, { head: SUN_HAT }))).toBe('wearOn');
  });

  it('plays wear on for a Wearable swapped for another in the same slot', () => {
    expect(restyleSound(createWear(null, { head: SUN_HAT }), createWear(null, { head: FLOWER_CROWN }))).toBe('wearOn');
  });

  it('plays wear on for one Wearable on and another off', () => {
    expect(restyleSound(createWear(null, { neck: NECKLACE }), createWear(null, { head: SUN_HAT }))).toBe('wearOn');
  });

  it('plays wear on for a Wearable put on while a Dream colour comes off', () => {
    expect(restyleSound(createWear(MINT), createWear(null, { head: SUN_HAT }))).toBe('wearOn');
  });

  it('plays wear off for a Wearable taken off', () => {
    expect(restyleSound(createWear(null, { head: SUN_HAT }), createWear(null))).toBe('wearOff');
  });

  it('plays wear off for a Wearable taken off while a Dream colour stays the same', () => {
    expect(restyleSound(createWear(MINT, { head: SUN_HAT, neck: NECKLACE }), createWear(MINT, { neck: NECKLACE }))).toBe('wearOff');
  });
});

describe('surprisePressed (issue #167, ND-10)', () => {
  const shown = createStyler({ mode: 'creator', step: 'eyes', focus: { kind: 'surprise' } });

  it('is true for a Surprise me press where Surprise me shows', () => {
    expect(surprisePressed(shown, { type: 'surprise' })).toBe(true);
    expect(surprisePressed({ ...shown, focus: { kind: 'next' } }, { type: 'surprise' })).toBe(true);
  });

  it('is true for Enter or Space while Surprise me has the focus', () => {
    expect(surprisePressed(shown, createKey('Enter'))).toBe(true);
    expect(surprisePressed(shown, createKey(' '))).toBe(true);
  });

  it('is false for a confirm key with the focus elsewhere', () => {
    expect(surprisePressed({ ...shown, focus: { kind: 'next' } }, createKey('Enter'))).toBe(false);
    expect(surprisePressed({ ...shown, focus: { kind: 'option', index: 0 } }, createKey(' '))).toBe(false);
  });

  it('is false for a key that does not confirm while Surprise me has the focus', () => {
    expect(surprisePressed(shown, createKey('Tab'))).toBe(false);
    expect(surprisePressed(shown, createKey('Escape'))).toBe(false);
    expect(surprisePressed(shown, createKey('ArrowLeft'))).toBe(false);
  });

  it('is false for other actions', () => {
    expect(surprisePressed(shown, { type: 'next' })).toBe(false);
    expect(surprisePressed(shown, { type: 'done' })).toBe(false);
    expect(surprisePressed(shown, { type: 'pick', index: 0 })).toBe(false);
  });

  it('is false where Surprise me is hidden, for a press and for a confirm key', () => {
    for (const step of ['dream', 'outfit', 'colour', 'sex'] as const) {
      const hidden = createStyler({ mode: 'restyle', step, focus: { kind: 'surprise' } });
      expect(surprisePressed(hidden, { type: 'surprise' })).toBe(false);
      expect(surprisePressed(hidden, createKey('Enter'))).toBe(false);
    }
  });

  it('is true on a restyle step where Surprise me shows', () => {
    expect(surprisePressed(createStyler({ mode: 'restyle', step: 'eyes', focus: { kind: 'surprise' } }), createKey('Enter'))).toBe(true);
  });
});

describe('newAreaSound (issue #167, ND-9)', () => {
  it('plays unlock when an unlocked area is new', () => {
    expect(newAreaSound([createEntry(1), createEntry(2, { isNew: true })])).toBe('unlock');
  });

  it('plays nothing when no area is new', () => {
    expect(newAreaSound([createEntry(1), createEntry(2, { locked: true })])).toBeNull();
  });

  it('plays nothing when the only new area is locked', () => {
    expect(newAreaSound([createEntry(1), createEntry(2, { locked: true, isNew: true })])).toBeNull();
  });

  it('plays nothing for no areas', () => {
    expect(newAreaSound([])).toBeNull();
  });
});
