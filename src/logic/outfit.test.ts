import { describe, expect, it, vi } from 'vitest';
import { CANAL_TREASURES, WEARABLE_SLOTS, type Treasure, type Wearable } from './catalogue';
import {
  EMPTY_OUTFIT,
  applyOutfit,
  emptyOutfit,
  repairOutfits,
  takeOff,
  wear,
  wearerOf,
  wornIds,
  type Outfit,
} from './outfit';

/** A second Head Wearable, so a filled slot can be filled again; the canal has one per slot. */
const PARTY_CROWN: Wearable = {
  id: 'test/party-crown',
  name: 'Party crown',
  rarity: 'epic',
  category: 'wearable',
  slot: 'head',
  perk: { type: 'speed', value: 8 },
};

vi.mock('./catalogue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./catalogue')>();
  const findTreasure = (id: string): Treasure | undefined =>
    id === 'test/party-crown' ? PARTY_CROWN : actual.treasureById(id);
  return { ...actual, treasureById: findTreasure };
});

const SUN_HAT = 'canal/sun-hat';
const NECKLACE = 'canal/shell-necklace';
const GLASSES = 'canal/heart-glasses';
const BOW = 'canal/golden-bow';
const SOCKS = 'canal/stripy-socks';
const FLIPPERS = 'canal/flippers';
const CROWN = PARTY_CROWN.id;
const DECORATION = 'canal/pond-plant';
const PAINT_SHELL = 'canal/paint-shell-mint';

/** The canal Wearables plus the Golden bow, the canal's Tail Wearable until it moved to the pond (issue #146). */
const ALL_WEARABLES = [
  ...CANAL_TREASURES.filter((treasure) => treasure.category === 'wearable').map((item) => item.id),
  BOW,
];
const BANKED = [...ALL_WEARABLES, CROWN, DECORATION, PAINT_SHELL];

interface TestAxolotl {
  id: string;
  morph: string;
  look: { sex: string; gills: string };
  dreamColour: string | null;
  outfit: Outfit;
}

function createAxolotl(id: string, worn: Partial<Outfit> = {}): TestAxolotl {
  return {
    id,
    morph: id === 'starter' ? 'wild' : 'leucistic',
    look: { sex: 'girl', gills: 'fluffy' },
    dreamColour: id === 'starter' ? 'mint' : null,
    outfit: { ...emptyOutfit(), ...worn },
  };
}

function createTwoAxolotls(): TestAxolotl[] {
  return [createAxolotl('starter', { head: SUN_HAT, neck: NECKLACE }), createAxolotl('axolotl/leucistic', { face: GLASSES })];
}

function freezeEntries(entries: TestAxolotl[]): readonly TestAxolotl[] {
  for (const entry of entries) {
    Object.freeze(entry.outfit);
    Object.freeze(entry.look);
    Object.freeze(entry);
  }
  return Object.freeze(entries);
}

function expectAtMostOneWearer(entries: readonly TestAxolotl[]): void {
  const worn = entries.flatMap((entry) => wornIds(entry.outfit));
  expect(new Set(worn).size).toBe(worn.length);
}

describe('emptyOutfit and EMPTY_OUTFIT', () => {
  it('has every slot key, each null', () => {
    for (const outfit of [emptyOutfit(), EMPTY_OUTFIT]) {
      expect(Object.keys(outfit).sort()).toEqual([...WEARABLE_SLOTS].sort());
      for (const slot of WEARABLE_SLOTS) expect(outfit[slot]).toBeNull();
    }
  });

  it('gives a new object each time and a frozen constant', () => {
    expect(emptyOutfit()).not.toBe(emptyOutfit());
    expect(Object.isFrozen(EMPTY_OUTFIT)).toBe(true);
  });
});

describe('wornIds', () => {
  it('is empty for an empty outfit', () => {
    expect(wornIds(emptyOutfit())).toEqual([]);
  });

  it('lists worn ids in slot order, whatever the key order', () => {
    const outfit: Outfit = { ...emptyOutfit(), feet: FLIPPERS, head: SUN_HAT, tail: BOW, socks: SOCKS };
    expect(wornIds(outfit)).toEqual([SUN_HAT, BOW, SOCKS, FLIPPERS]);
  });
});

describe('wearerOf', () => {
  it('names the axolotl wearing the Wearable', () => {
    const entries = createTwoAxolotls();
    expect(wearerOf(entries, SUN_HAT)).toBe('starter');
    expect(wearerOf(entries, GLASSES)).toBe('axolotl/leucistic');
  });

  it('is null when no axolotl wears it', () => {
    expect(wearerOf(createTwoAxolotls(), FLIPPERS)).toBeNull();
    expect(wearerOf([], SUN_HAT)).toBeNull();
  });
});

describe('wear (C10, F8)', () => {
  it('puts a banked Wearable in its own slot', () => {
    const result = wear(createTwoAxolotls(), 'starter', FLIPPERS, BANKED);
    expect(result[0]?.outfit).toEqual({ ...emptyOutfit(), head: SUN_HAT, neck: NECKLACE, feet: FLIPPERS });
  });

  it('keeps one Wearable per slot: a filled slot swaps, and the old one is no longer worn', () => {
    const result = wear(createTwoAxolotls(), 'starter', CROWN, BANKED);
    expect(result[0]?.outfit.head).toBe(CROWN);
    expect(wornIds(result[0]?.outfit ?? emptyOutfit())).toEqual([CROWN, NECKLACE]);
    expect(wearerOf(result, SUN_HAT)).toBeNull();
  });

  it('moves a Wearable from the axolotl wearing it', () => {
    const result = wear(createTwoAxolotls(), 'axolotl/leucistic', SUN_HAT, BANKED);
    expect(result[0]?.outfit.head).toBeNull();
    expect(result[0]?.outfit.neck).toBe(NECKLACE);
    expect(result[1]?.outfit).toEqual({ ...emptyOutfit(), head: SUN_HAT, face: GLASSES });
    expect(wearerOf(result, SUN_HAT)).toBe('axolotl/leucistic');
    expectAtMostOneWearer(result);
  });

  it('keeps the outfit when the axolotl already wears it', () => {
    const result = wear(createTwoAxolotls(), 'starter', SUN_HAT, BANKED);
    expect(result).toEqual(createTwoAxolotls());
  });

  it('accepts banked ids as a set', () => {
    const result = wear(createTwoAxolotls(), 'starter', BOW, new Set([BOW]));
    expect(result[0]?.outfit.tail).toBe(BOW);
  });

  it('throws for an unknown axolotl, unknown id, non-Wearable or unbanked Wearable', () => {
    expect(() => wear(createTwoAxolotls(), 'nobody', BOW, BANKED)).toThrow('wear: no owned axolotl has id nobody');
    expect(() => wear(createTwoAxolotls(), 'starter', 'canal/nothing', BANKED)).toThrow(
      'wear: unknown treasure canal/nothing',
    );
    expect(() => wear(createTwoAxolotls(), 'starter', DECORATION, BANKED)).toThrow(`wear: ${DECORATION} is not a Wearable`);
    expect(() => wear(createTwoAxolotls(), 'starter', PAINT_SHELL, BANKED)).toThrow(
      `wear: ${PAINT_SHELL} is not a Wearable`,
    );
    expect(() => wear(createTwoAxolotls(), 'starter', BOW, [SUN_HAT])).toThrow(`wear: ${BOW} is not banked`);
  });

  it('never mutates input and keeps every non-outfit field', () => {
    const entries = freezeEntries(createTwoAxolotls());
    const result = wear(entries, 'axolotl/leucistic', SUN_HAT, BANKED);
    expect(result).not.toBe(entries);
    expect(entries[0]?.outfit.head).toBe(SUN_HAT);
    for (const [index, entry] of result.entries()) {
      const before = entries[index];
      expect(entry.look).toBe(before?.look);
      expect(entry.morph).toBe(before?.morph);
      expect(entry.dreamColour).toBe(before?.dreamColour);
      expect(entry.id).toBe(before?.id);
      expect(entry.outfit).not.toBe(before?.outfit);
    }
  });

  it('keeps an axolotl the change does not touch as the same object', () => {
    const entries = [...createTwoAxolotls(), createAxolotl('axolotl/golden-albino')];
    const result = wear(entries, 'starter', BOW, BANKED);
    expect(result[1]).toBe(entries[1]);
    expect(result[2]).toBe(entries[2]);
  });
});

describe('takeOff (C10)', () => {
  it('empties the slot; the Wearable is no longer worn', () => {
    const result = takeOff(createTwoAxolotls(), 'starter', 'head');
    expect(result[0]?.outfit).toEqual({ ...emptyOutfit(), neck: NECKLACE });
    expect(wearerOf(result, SUN_HAT)).toBeNull();
    expect(result[1]?.outfit).toEqual(createTwoAxolotls()[1]?.outfit);
  });

  it('leaves an empty slot empty', () => {
    const result = takeOff(createTwoAxolotls(), 'starter', 'feet');
    expect(result[0]?.outfit).toEqual(createTwoAxolotls()[0]?.outfit);
  });

  it('throws for an unknown axolotl or slot', () => {
    expect(() => takeOff(createTwoAxolotls(), 'nobody', 'head')).toThrow('takeOff: no owned axolotl has id nobody');
    expect(() => takeOff(createTwoAxolotls(), 'starter', 'hands' as 'head')).toThrow('takeOff: hands is not a slot');
  });

  it('never mutates input and keeps every non-outfit field', () => {
    const entries = freezeEntries(createTwoAxolotls());
    const result = takeOff(entries, 'starter', 'neck');
    expect(entries[0]?.outfit.neck).toBe(NECKLACE);
    expect(result[0]?.look).toBe(entries[0]?.look);
    expect(result[0]?.morph).toBe(entries[0]?.morph);
    expect(result[0]?.dreamColour).toBe(entries[0]?.dreamColour);
    expect(result[1]).toBe(entries[1]);
  });
});

describe('applyOutfit (restyle Done)', () => {
  it('sets the whole outfit, emptying slots it leaves empty', () => {
    const outfit: Outfit = { ...emptyOutfit(), tail: BOW, socks: SOCKS, feet: FLIPPERS };
    const result = applyOutfit(createTwoAxolotls(), 'starter', outfit, BANKED);
    expect(result[0]?.outfit).toEqual(outfit);
    expect(result[0]?.outfit).not.toBe(outfit);
  });

  it('takes its Wearables off every other axolotl', () => {
    const outfit: Outfit = { ...emptyOutfit(), head: SUN_HAT, face: GLASSES };
    const result = applyOutfit(createTwoAxolotls(), 'starter', outfit, BANKED);
    expect(result[0]?.outfit).toEqual(outfit);
    expect(result[1]?.outfit).toEqual(emptyOutfit());
    expectAtMostOneWearer(result);
  });

  it('applies an empty outfit', () => {
    const result = applyOutfit(createTwoAxolotls(), 'starter', EMPTY_OUTFIT, BANKED);
    expect(result[0]?.outfit).toEqual(emptyOutfit());
    expect(Object.isFrozen(result[0]?.outfit)).toBe(false);
  });

  it('throws for an unknown axolotl, unknown id, non-Wearable, unbanked or wrong-slot Wearable', () => {
    const entries = createTwoAxolotls();
    expect(() => applyOutfit(entries, 'nobody', EMPTY_OUTFIT, BANKED)).toThrow(
      'applyOutfit: no owned axolotl has id nobody',
    );
    expect(() => applyOutfit(entries, 'starter', { ...emptyOutfit(), head: 'canal/nothing' }, BANKED)).toThrow(
      'applyOutfit: unknown treasure canal/nothing',
    );
    expect(() => applyOutfit(entries, 'starter', { ...emptyOutfit(), head: DECORATION }, BANKED)).toThrow(
      `applyOutfit: ${DECORATION} is not a Wearable`,
    );
    expect(() => applyOutfit(entries, 'starter', { ...emptyOutfit(), tail: BOW }, [SUN_HAT])).toThrow(
      `applyOutfit: ${BOW} is not banked`,
    );
    expect(() => applyOutfit(entries, 'starter', { ...emptyOutfit(), head: BOW }, BANKED)).toThrow(
      `applyOutfit: ${BOW} does not fit slot head`,
    );
  });

  it('never mutates input and keeps every non-outfit field', () => {
    const entries = freezeEntries(createTwoAxolotls());
    const result = applyOutfit(entries, 'axolotl/leucistic', { ...emptyOutfit(), head: SUN_HAT }, BANKED);
    expect(entries[0]?.outfit.head).toBe(SUN_HAT);
    expect(entries[1]?.outfit.face).toBe(GLASSES);
    for (const [index, entry] of result.entries()) {
      expect(entry.look).toBe(entries[index]?.look);
      expect(entry.morph).toBe(entries[index]?.morph);
      expect(entry.dreamColour).toBe(entries[index]?.dreamColour);
    }
  });
});

describe('repairOutfits (D1 load)', () => {
  it('keeps a valid outfit', () => {
    const result = repairOutfits(createTwoAxolotls(), BANKED);
    expect(result.map((entry) => entry.outfit)).toEqual(createTwoAxolotls().map((entry) => entry.outfit));
  });

  it('loads a missing or malformed outfit as empty', () => {
    const raw = [
      { id: 'a' },
      { id: 'b', outfit: null },
      { id: 'c', outfit: 'head' },
      { id: 'd', outfit: 7 },
      { id: 'e', outfit: [SUN_HAT] },
    ];
    for (const entry of repairOutfits(raw, BANKED)) expect(entry.outfit).toEqual(emptyOutfit());
  });

  it('fills slots missing from a saved outfit as empty', () => {
    const [entry] = repairOutfits([{ id: 'a', outfit: { tail: BOW } }], BANKED);
    expect(entry?.outfit).toEqual({ ...emptyOutfit(), tail: BOW });
  });

  it('drops unknown, unbanked, non-Wearable, wrong-slot and non-string ids', () => {
    const raw = [
      {
        id: 'a',
        outfit: {
          head: 'canal/nothing',
          neck: NECKLACE,
          face: DECORATION,
          shirt: PAINT_SHELL,
          back: SOCKS,
          tail: 5,
          socks: SOCKS,
          feet: FLIPPERS,
          hands: SUN_HAT,
        },
      },
    ];
    const [entry] = repairOutfits(raw, BANKED.filter((id) => id !== NECKLACE));
    expect(entry?.outfit).toEqual({ ...emptyOutfit(), socks: SOCKS, feet: FLIPPERS });
    expect(Object.keys(entry?.outfit ?? {}).sort()).toEqual([...WEARABLE_SLOTS].sort());
  });

  it('keeps a Wearable on two axolotls on the first in order only', () => {
    const raw = [
      { id: 'a', outfit: { head: SUN_HAT } },
      { id: 'b', outfit: { head: SUN_HAT, feet: FLIPPERS } },
      { id: 'c', outfit: { feet: FLIPPERS } },
    ];
    const result = repairOutfits(raw, BANKED);
    expect(result.map((entry) => entry.outfit)).toEqual([
      { ...emptyOutfit(), head: SUN_HAT },
      { ...emptyOutfit(), feet: FLIPPERS },
      emptyOutfit(),
    ]);
  });

  it('does not let a dropped id claim its Wearable', () => {
    const raw = [
      { id: 'a', outfit: { head: FLIPPERS } },
      { id: 'b', outfit: { feet: FLIPPERS } },
    ];
    const result = repairOutfits(raw, BANKED);
    expect(result[0]?.outfit).toEqual(emptyOutfit());
    expect(result[1]?.outfit.feet).toBe(FLIPPERS);
  });

  it('never mutates input and keeps every other field', () => {
    const entries = freezeEntries(createTwoAxolotls());
    const result = repairOutfits(entries, [SUN_HAT]);
    expect(entries[0]?.outfit.neck).toBe(NECKLACE);
    expect(result[0]?.outfit).toEqual({ ...emptyOutfit(), head: SUN_HAT });
    for (const [index, entry] of result.entries()) {
      expect(entry).not.toBe(entries[index]);
      expect(entry.outfit).not.toBe(entries[index]?.outfit);
      expect(entry.id).toBe(entries[index]?.id);
      expect(entry.look).toBe(entries[index]?.look);
      expect(entry.morph).toBe(entries[index]?.morph);
      expect(entry.dreamColour).toBe(entries[index]?.dreamColour);
    }
  });
});
