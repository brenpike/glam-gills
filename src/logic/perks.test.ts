import { describe, expect, it } from 'vitest';
import { CANAL_AREA } from './areas';
import {
  ALL_TREASURES,
  CHINAMPA_2_TREASURES,
  CHINAMPA_TREASURES,
  DEEP_CANAL_TREASURES,
  PERK_VALUES,
  POND_2_TREASURES,
  SPRING_CAVE_TREASURES,
  WEARABLE_SLOTS,
  type PerkType,
  type Wearable,
  type WearableSlot,
} from './catalogue';
import { snackDriftMaxSpeed } from './collectibles';
import {
  createEncounter,
  createEncounterContext,
  stepEncounter,
  type EncounterContext,
  type EncounterEvent,
  type EncounterState,
} from './encounter';
import { presentCount } from './legs';
import { emptyOutfit, type Outfit } from './outfit';
import {
  NO_PERKS_TEXT,
  PERK_CAPS,
  PERK_ORDER,
  SNACK_MAGNET_PULL_SPEED,
  outfitPerks,
  outfitSummary,
  perkTotals,
  perkTripContext,
  perkTuning,
  type WornPerk,
} from './perks';
import { createTripContext } from './trip';
import { CARRY, FINDS, HINTS, LEGS, SNACK_REACH, SWIM, TILAPIA } from './tuning';
import { buildCanalZone, swimBounds, type Point } from './zone';

const DT = 1 / 60;
const zone = buildCanalZone();
const routeStart = zone.tilapiaRoutes[0].waypoints[0];
const inRange: Point = { x: routeStart.x + 60, y: routeStart.y };
const target: Point = { x: 600, y: 200 };

function worn(slot: WearableSlot, type: PerkType, value: number): WornPerk {
  return { slot, perk: { type, value } };
}

function legendary(slot: WearableSlot, type: PerkType): WornPerk {
  const value = PERK_VALUES[type].legendary;
  if (value === undefined) throw new Error(`no Legendary value for ${type}`);
  return worn(slot, type, value);
}

/** Two Legendary perks of every type: every cap passed. Synthetic, so slots repeat. */
const ALL_CAPS_OUTFIT: readonly WornPerk[] = PERK_ORDER.flatMap((type, index) => [
  legendary(WEARABLE_SLOTS[index % WEARABLE_SLOTS.length], type),
  legendary(WEARABLE_SLOTS[(index + 1) % WEARABLE_SLOTS.length], type),
]);

/** A tilapia mid-lunge 30 px left of `target`, aimed at it, so the next step connects. */
function lungingAt(state: EncounterState): EncounterState {
  const tilapia = {
    ...createEncounter(zone).predators[0],
    pos: { x: target.x - 30, y: target.y },
    phase: 'lunge' as const,
    elapsed: 0,
    duration: TILAPIA.lungeDuration,
    aim: { x: 1, y: 0 },
  };
  return { ...state, legs: { ...state.legs, protectedLeft: 0 }, predators: [tilapia] };
}

function eventTypes(events: readonly EncounterEvent[]): string[] {
  return events.map((event) => event.type);
}

function countOf(events: readonly EncounterEvent[], type: EncounterEvent['type']): number {
  return events.filter((event) => event.type === type).length;
}

/** Every catalogue Wearable, every area, in catalogue order. */
const CATALOGUE_WEARABLES = ALL_TREASURES.filter((treasure): treasure is Wearable => treasure.category === 'wearable');
const AREA_3_WEARABLE_IDS: readonly string[] = POND_2_TREASURES.filter((treasure) => treasure.category === 'wearable').map(
  (treasure) => treasure.id,
);
const AREA_4_WEARABLE_IDS: readonly string[] = CHINAMPA_TREASURES.filter((treasure) => treasure.category === 'wearable').map(
  (treasure) => treasure.id,
);
const AREA_5_WEARABLE_IDS: readonly string[] = CHINAMPA_2_TREASURES.filter((treasure) => treasure.category === 'wearable').map(
  (treasure) => treasure.id,
);
const AREA_6_WEARABLE_IDS: readonly string[] = SPRING_CAVE_TREASURES.filter((treasure) => treasure.category === 'wearable').map(
  (treasure) => treasure.id,
);
const AREA_8_WEARABLE_IDS: readonly string[] = DEEP_CANAL_TREASURES.filter((treasure) => treasure.category === 'wearable').map(
  (treasure) => treasure.id,
);

describe('outfitPerks', () => {
  it('gives nothing for an empty outfit', () => {
    expect(outfitPerks(emptyOutfit())).toEqual([]);
  });

  it('gives each worn catalogue Wearable, with its slot and perk, in slot order', () => {
    const outfit: Outfit = emptyOutfit();
    for (const wearable of [...CATALOGUE_WEARABLES].reverse()) outfit[wearable.slot] = wearable.id;
    const expected = WEARABLE_SLOTS.flatMap((slot) => CATALOGUE_WEARABLES.filter((wearable) => wearable.id === outfit[slot]));
    const worn = outfitPerks(outfit);
    expect(worn).toEqual(expected);
    expect(worn.map((item) => item.slot)).toEqual(WEARABLE_SLOTS.filter((slot) => outfit[slot] !== null));
  });

  it('skips empty slots, unknown ids and treasures that are not Wearables', () => {
    const wearable = CATALOGUE_WEARABLES[0];
    const decoration = ALL_TREASURES.find((treasure) => treasure.category === 'decoration');
    if (decoration === undefined) throw new Error('no catalogue Decoration');
    const otherSlot = WEARABLE_SLOTS.find((slot) => slot !== wearable.slot) ?? wearable.slot;
    const outfit: Outfit = { ...emptyOutfit(), [wearable.slot]: wearable.id };
    const withJunk: Outfit = { ...outfit, [otherSlot]: 'canal/no-such-thing' };
    expect(outfitPerks(withJunk)).toEqual([wearable]);
    expect(outfitPerks({ ...outfit, [otherSlot]: decoration.id })).toEqual([wearable]);
  });

  it('gives the same summary as the worn Wearables themselves', () => {
    const outfit: Outfit = emptyOutfit();
    for (const wearable of CATALOGUE_WEARABLES) outfit[wearable.slot] = wearable.id;
    const wornWearables = CATALOGUE_WEARABLES.filter((wearable) => outfit[wearable.slot] === wearable.id);
    expect(outfitSummary(outfitPerks(outfit))).toEqual(outfitSummary(wornWearables));
  });
});

describe('catalogue Wearable perks (F9)', () => {
  it('covers the pond, chinampa and spring cave Wearables', () => {
    const ids = CATALOGUE_WEARABLES.map((wearable) => wearable.id);
    expect(ids.some((id) => id.startsWith('canal/'))).toBe(true);
    expect(ids.some((id) => id.startsWith('pond/'))).toBe(true);
    expect(ids.some((id) => id.startsWith('chinampa/'))).toBe(true);
    expect(ids.some((id) => id.startsWith('spring-cave/'))).toBe(true);
  });

  it('gives every Wearable one existing perk at its PERK_VALUES value', () => {
    for (const wearable of CATALOGUE_WEARABLES) {
      expect(Object.keys(wearable.perk).sort(), wearable.id).toEqual(['type', 'value']);
      expect(PERK_ORDER, wearable.id).toContain(wearable.perk.type);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
    }
  });

  it('gives the Area 3 Wearables existing perks at the canal values for their rarity', () => {
    const area3 = CATALOGUE_WEARABLES.filter((wearable) => AREA_3_WEARABLE_IDS.includes(wearable.id));
    expect(area3.map((wearable) => [wearable.id, wearable.rarity, wearable.slot, wearable.perk])).toEqual([
      ['pond/feather-cap', 'common', 'head', { type: 'speed', value: 4 }],
      ['pond/lily-pad-socks', 'common', 'socks', { type: 'snackMagnet', value: 30 }],
      ['pond/water-lily-shirt', 'rare', 'shirt', { type: 'regrowth', value: 15 }],
      ['pond/pearl-tail-charm', 'epic', 'tail', { type: 'shell', value: 1 }],
      ['pond/firefly-cape', 'legendary', 'back', { type: 'treasureSense', value: 50 }],
    ]);
    const canalPerkTypes = new Set(
      CATALOGUE_WEARABLES.filter((wearable) => wearable.id.startsWith('canal/')).map((wearable) => wearable.perk.type),
    );
    for (const wearable of area3) {
      expect(canalPerkTypes.has(wearable.perk.type), wearable.id).toBe(true);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
    }
  });

  it('gives the Area 4 Wearables existing perks at the PERK_VALUES value for their rarity (issue #76)', () => {
    const area4 = CATALOGUE_WEARABLES.filter((wearable) => AREA_4_WEARABLE_IDS.includes(wearable.id));
    expect(area4.map((wearable) => [wearable.id, wearable.rarity, wearable.slot, wearable.perk])).toEqual([
      ['chinampa/straw-sun-hat', 'common', 'head', { type: 'treasureSense', value: 15 }],
      ['chinampa/marigold-necklace', 'common', 'neck', { type: 'regrowth', value: 10 }],
      ['chinampa/garden-overalls', 'rare', 'shirt', { type: 'snackMagnet', value: 40 }],
      ['chinampa/monarch-hair-clip', 'epic', 'head', { type: 'dash', value: 20 }],
      ['chinampa/monarch-wings', 'legendary', 'back', { type: 'speed', value: 10 }],
    ]);
    for (const wearable of area4) {
      expect(PERK_ORDER, wearable.id).toContain(wearable.perk.type);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
    }
  });

  it('gives the Area 5 Wearables existing perks at the PERK_VALUES value for their rarity (ND-19)', () => {
    const area5 = CATALOGUE_WEARABLES.filter((wearable) => AREA_5_WEARABLE_IDS.includes(wearable.id));
    expect(area5.map((wearable) => [wearable.id, wearable.rarity, wearable.slot, wearable.perk])).toEqual([
      ['chinampa/bee-headband', 'common', 'head', { type: 'snackMagnet', value: 30 }],
      ['chinampa/bandana', 'common', 'neck', { type: 'speed', value: 4 }],
      ['chinampa/sunflower-sunglasses', 'rare', 'face', { type: 'treasureSense', value: 25 }],
      ['chinampa/embroidered-shirt', 'rare', 'shirt', { type: 'regrowth', value: 15 }],
      ['chinampa/hummingbird-tail-ribbon', 'epic', 'tail', { type: 'speed', value: 8 }],
      ['chinampa/rainbow-serape-cape', 'legendary', 'back', { type: 'shell', value: 1 }],
    ]);
    for (const wearable of area5) {
      expect(PERK_ORDER, wearable.id).toContain(wearable.perk.type);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
    }
  });

  it('gives the Area 6 Wearables existing perks at the PERK_VALUES value for their rarity, not all the same (issue #77)', () => {
    const area6 = CATALOGUE_WEARABLES.filter((wearable) => AREA_6_WEARABLE_IDS.includes(wearable.id));
    expect(area6.map((wearable) => [wearable.id, wearable.rarity, wearable.slot, wearable.perk])).toEqual([
      ['spring-cave/miners-headlamp', 'common', 'head', { type: 'treasureSense', value: 15 }],
      ['spring-cave/crystal-pendant', 'common', 'neck', { type: 'regrowth', value: 10 }],
      ['spring-cave/explorer-vest', 'rare', 'shirt', { type: 'dash', value: 15 }],
      ['spring-cave/crystal-tail-cuff', 'epic', 'tail', { type: 'snackMagnet', value: 50 }],
      ['spring-cave/crystal-crown', 'legendary', 'head', { type: 'speed', value: 10 }],
    ]);
    for (const wearable of area6) {
      expect(PERK_ORDER, wearable.id).toContain(wearable.perk.type);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
    }
    expect(new Set(area6.map((wearable) => wearable.perk.type)).size).toBeGreaterThan(1);
  });

  it('gives the Area 8 Wearables existing perks at the PERK_VALUES value for their rarity, no two the same type (ND-14)', () => {
    const area8 = CATALOGUE_WEARABLES.filter((wearable) => AREA_8_WEARABLE_IDS.includes(wearable.id));
    expect(area8.map((wearable) => [wearable.id, wearable.rarity, wearable.slot, wearable.perk])).toEqual([
      ['deep-canal/sailor-cap', 'common', 'head', { type: 'speed', value: 4 }],
      ['deep-canal/striped-scarf', 'common', 'neck', { type: 'regrowth', value: 10 }],
      ['deep-canal/mariachi-jacket', 'rare', 'shirt', { type: 'dash', value: 15 }],
      ['deep-canal/captains-hat', 'epic', 'head', { type: 'treasureSense', value: 35 }],
      ['deep-canal/rainbow-fin-streamers', 'legendary', 'tail', { type: 'snackMagnet', value: 60 }],
    ]);
    for (const wearable of area8) {
      expect(PERK_ORDER, wearable.id).toContain(wearable.perk.type);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
    }
    expect(new Set(area8.map((wearable) => wearable.perk.type)).size).toBe(area8.length);
  });

  it('puts Shell only on Epic or Legendary Wearables', () => {
    for (const wearable of CATALOGUE_WEARABLES.filter((item) => item.perk.type === 'shell')) {
      expect(['epic', 'legendary'], wearable.id).toContain(wearable.rarity);
    }
  });
});

describe('PERK_CAPS', () => {
  it('matches the PRD Tuning values for every perk type', () => {
    expect(PERK_CAPS).toEqual({ speed: 15, regrowth: 35, dash: 35, shell: 1, treasureSense: 60, snackMagnet: 70 });
    expect(Object.keys(PERK_CAPS).sort()).toEqual([...PERK_ORDER].sort());
  });

  it('caps every perk type at its total cap and flags it', () => {
    const totals = perkTotals(ALL_CAPS_OUTFIT);
    for (const type of PERK_ORDER) {
      expect(totals[type].raw).toBeGreaterThan(PERK_CAPS[type]);
      expect(totals[type].value).toBe(PERK_CAPS[type]);
      expect(totals[type].capReached).toBe(true);
    }
  });

  it('keeps a total under its cap as the raw sum, not flagged', () => {
    const totals = perkTotals([worn('head', 'speed', 4), worn('neck', 'speed', 6)]);
    expect(totals.speed).toEqual({ raw: 10, value: 10, capReached: false });
  });

  it('flags a total that lands exactly on its cap', () => {
    const totals = perkTotals([legendary('head', 'regrowth'), worn('neck', 'regrowth', 10)]);
    expect(totals.regrowth).toEqual({ raw: 35, value: 35, capReached: true });
  });

  it('gives 0 and no flag for every perk type of an empty outfit', () => {
    const totals = perkTotals([]);
    for (const type of PERK_ORDER) expect(totals[type]).toEqual({ raw: 0, value: 0, capReached: false });
  });

  it('throws RangeError for a non-finite leg count', () => {
    expect(() => perkTotals([], Number.NaN)).toThrow(RangeError);
  });
});

describe('feet rule (F8)', () => {
  const feetOutfit = [worn('socks', 'speed', 4), worn('feet', 'snackMagnet', 30), worn('head', 'dash', 10)];

  it('turns Socks and Feet perks off with 0 legs present', () => {
    const totals = perkTotals(feetOutfit, 0);
    expect(totals.speed.value).toBe(0);
    expect(totals.snackMagnet.value).toBe(0);
    expect(totals.dash.value).toBe(10);
  });

  it('keeps Socks and Feet perks on with 1 leg present', () => {
    const totals = perkTotals(feetOutfit, 1);
    expect(totals.speed.value).toBe(4);
    expect(totals.snackMagnet.value).toBe(30);
    expect(totals.dash.value).toBe(10);
  });

  it('counts every leg by default', () => {
    expect(perkTotals(feetOutfit)).toEqual(perkTotals(feetOutfit, LEGS.count));
  });
});

describe('outfitSummary (F10, F11)', () => {
  it('shows "No perks yet" for an empty outfit', () => {
    expect(outfitSummary([])).toEqual({ rows: [], empty: true });
    expect(NO_PERKS_TEXT).toBe('No perks yet');
  });

  it('lists rows in the fixed perk order with the Treasure Chest wording', () => {
    const summary = outfitSummary([
      worn('feet', 'snackMagnet', 30),
      worn('back', 'shell', 1),
      worn('head', 'speed', 4),
      worn('face', 'treasureSense', 15),
    ]);
    expect(summary.empty).toBe(false);
    expect(summary.rows).toEqual([
      { type: 'speed', value: 4, text: 'Speed +4%', capReached: false },
      { type: 'shell', value: 1, text: 'Shell blocks 1 hit', capReached: true },
      { type: 'treasureSense', value: 15, text: 'Treasure sense +15%', capReached: false },
      { type: 'snackMagnet', value: 30, text: 'Snack magnet +30', capReached: false },
    ]);
  });

  it('shows the capped value and the cap flag past a cap', () => {
    const summary = outfitSummary(ALL_CAPS_OUTFIT);
    expect(summary.rows.map((row) => row.type)).toEqual(PERK_ORDER);
    expect(summary.rows.map((row) => row.text)).toEqual([
      'Speed +15%',
      'Regrowth +35%',
      'Dash +35%',
      'Shell blocks 1 hit',
      'Treasure sense +60%',
      'Snack magnet +70',
    ]);
    expect(summary.rows.every((row) => row.capReached)).toBe(true);
  });

  it('drops Socks and Feet rows with 0 legs present', () => {
    expect(outfitSummary([worn('socks', 'speed', 4)], 0)).toEqual({ rows: [], empty: true });
  });

  it('takes catalogue Wearables as they are', () => {
    const first = CATALOGUE_WEARABLES[0];
    expect(outfitSummary([first]).rows).toHaveLength(1);
    expect(outfitSummary([first]).rows[0].type).toBe(first.perk.type);
  });
});

describe('perkTuning (A22, F9, F11)', () => {
  it('gives exactly the base tuning for an empty outfit', () => {
    expect(perkTuning([])).toEqual({
      swim: SWIM,
      legs: LEGS,
      hintMultiplier: 1,
      snackMagnetRadius: 0,
      snackMagnetSpeed: SNACK_MAGNET_PULL_SPEED,
      shell: false,
    });
  });

  it('applies each capped total on top of the base tuning', () => {
    const tuning = perkTuning(ALL_CAPS_OUTFIT);
    expect(tuning.swim.maxSpeed).toBeCloseTo(SWIM.maxSpeed * 1.15);
    expect(tuning.swim.dashDuration).toBeCloseTo(SWIM.dashDuration * 1.35);
    expect(tuning.legs.regrowTime).toBeCloseTo(LEGS.regrowTime * 0.65);
    expect(tuning.hintMultiplier).toBeCloseTo(1.6);
    expect(tuning.snackMagnetRadius).toBe(70);
    expect(tuning.shell).toBe(true);
  });

  it('makes the Tail Dash longer, never the recharge shorter, and keeps dash speed', () => {
    const tuning = perkTuning([legendary('tail', 'dash')]);
    expect(tuning.swim.dashDuration).toBeCloseTo(SWIM.dashDuration * 1.25);
    expect(tuning.swim.dashCooldown).toBe(SWIM.dashCooldown);
    expect(tuning.swim.dashSpeed).toBe(SWIM.dashSpeed);
  });

  it('keeps the snack speed-up a share of one leg under the Regrowth perk', () => {
    const tuning = perkTuning([legendary('shirt', 'regrowth')]);
    expect(tuning.legs.regrowTime).toBeCloseTo(LEGS.regrowTime * 0.75);
    expect(tuning.legs.snackSpeedUp).toBe(LEGS.snackSpeedUp);
  });

  it('never changes protected time, the leg count, leg speed shares or the other swim values', () => {
    const tuning = perkTuning(ALL_CAPS_OUTFIT);
    expect({ ...tuning.legs, regrowTime: LEGS.regrowTime }).toEqual(LEGS);
    expect({ ...tuning.swim, maxSpeed: SWIM.maxSpeed, dashDuration: SWIM.dashDuration }).toEqual(SWIM);
  });

  it('turns the Shell on with one Shell perk and keeps it one flag with two', () => {
    expect(perkTuning([worn('back', 'shell', 1)]).shell).toBe(true);
    expect(perkTuning([worn('back', 'shell', 1), worn('head', 'shell', 1)]).shell).toBe(true);
    expect(perkTotals([worn('back', 'shell', 1), worn('head', 'shell', 1)]).shell.value).toBe(1);
  });

  it('turns Socks and Feet perks off with 0 legs and on with 1', () => {
    const outfit = [worn('feet', 'snackMagnet', 60), worn('socks', 'shell', 1)];
    expect(perkTuning(outfit, 0).snackMagnetRadius).toBe(0);
    expect(perkTuning(outfit, 0).shell).toBe(false);
    expect(perkTuning(outfit, 1).snackMagnetRadius).toBe(60);
    expect(perkTuning(outfit, 1).shell).toBe(true);
  });

  it('never changes the shared base tuning, so the hub still sees the base values', () => {
    const swimBefore = { ...SWIM };
    const legsBefore = { ...LEGS };
    perkTuning(ALL_CAPS_OUTFIT);
    expect(SWIM).toEqual(swimBefore);
    expect(LEGS).toEqual(legsBefore);
    expect(HINTS.range).toEqual({ common: 150, rare: 115, epic: 85, legendary: 60 });
  });

  it('pulls snacks gently: faster than Area 1 drift, slower than a one-leg swim', () => {
    const drift = CANAL_AREA.snackDrift;
    expect(SNACK_MAGNET_PULL_SPEED).toBeGreaterThan(snackDriftMaxSpeed(drift));
    expect(SNACK_MAGNET_PULL_SPEED).toBeLessThan(SWIM.maxSpeed * LEGS.speedByLegs[0]);
  });
});

describe('perkTripContext (A22, F12)', () => {
  it('equals the base trip context for an empty outfit', () => {
    expect(perkTripContext(perkTuning([]))).toEqual(createTripContext());
    const bounds = { ...swimBounds(), maxX: 900 };
    expect(perkTripContext(perkTuning([]), bounds)).toEqual(
      createTripContext({ encounter: createEncounterContext({ bounds }) }),
    );
  });

  it('carries the perk legs and Shell; tilapia, carry, finds and snack reach stay the base values', () => {
    const tuning = perkTuning(ALL_CAPS_OUTFIT);
    const ctx = perkTripContext(tuning);
    expect(ctx.encounter.legs).toEqual(tuning.legs);
    expect(ctx.encounter.shell).toBe(true);
    expect(ctx.encounter.tilapia).toBe(TILAPIA);
    expect(ctx.carry).toBe(CARRY);
    expect(ctx.finds).toBe(FINDS);
    expect(ctx.encounter.legs.protectedTime).toBe(LEGS.protectedTime);
    expect(ctx.encounter.legs.count).toBe(LEGS.count);
    expect(SNACK_REACH).toEqual({ headAhead: 25, radius: 36 });
  });

  it('applies only the explorer outfit: another axolotl outfit is never an input', () => {
    const explorerOutfit: WornPerk[] = [];
    const otherAxolotlOutfit = ALL_CAPS_OUTFIT;
    expect(perkTuning(otherAxolotlOutfit).shell).toBe(true);
    expect(perkTripContext(perkTuning(explorerOutfit))).toEqual(createTripContext());
  });
});

describe('a full Legendary outfit still loses legs (A22, F11)', () => {
  const ctx: EncounterContext = perkTripContext(perkTuning(ALL_CAPS_OUTFIT)).encounter;

  it('blocks the first hit with the Shell, then loses one leg to every hit and ends on the fourth', () => {
    const blocked = stepEncounter(lungingAt(createEncounter(zone)), target, DT, ctx);
    expect(eventTypes(blocked.events)).toEqual(['shellBlock']);
    expect(presentCount(blocked.state.legs)).toBe(LEGS.count);

    let state = blocked.state;
    for (let hit = 1; hit <= LEGS.count; hit++) {
      const result = stepEncounter(lungingAt(state), target, DT, ctx);
      expect(countOf(result.events, 'hit')).toBe(1);
      expect(countOf(result.events, 'shellBlock')).toBe(0);
      expect(presentCount(result.state.legs)).toBe(LEGS.count - hit);
      state = result.state;
    }
    expect(state.tripOver).toBe(true);
    expect(state.shellUsed).toBe(true);
  });

  it('blocks once per trip: a second Shell perk adds no second block', () => {
    const twoShells = perkTripContext(perkTuning([worn('back', 'shell', 1), worn('head', 'shell', 1)])).encounter;
    const blocked = stepEncounter(lungingAt(createEncounter(zone)), target, DT, twoShells).state;
    const result = stepEncounter(lungingAt(blocked), target, DT, twoShells);
    expect(eventTypes(result.events)).toEqual(['hit', 'regrowStart']);
    expect(presentCount(result.state.legs)).toBe(LEGS.count - 1);
  });

  it('gives a fresh trip its Shell again', () => {
    const blocked = stepEncounter(lungingAt(createEncounter(zone)), target, DT, ctx).state;
    expect(blocked.shellUsed).toBe(true);
    const fresh = stepEncounter(lungingAt(createEncounter(zone)), target, DT, ctx);
    expect(eventTypes(fresh.events)).toEqual(['shellBlock']);
  });

  it('loses exactly one leg per unblocked hit over a live encounter and is carried home', () => {
    let state = createEncounter(zone);
    const seen: EncounterEvent[] = [];
    for (let t = 0; t < 120 && !state.tripOver; t += DT) {
      const before = presentCount(state.legs);
      const result = stepEncounter(state, inRange, DT, ctx);
      const hits = countOf(result.events, 'hit');
      const regrown = countOf(result.events, 'regrown');
      expect(presentCount(result.state.legs)).toBe(before - hits + regrown);
      seen.push(...result.events);
      state = result.state;
    }
    expect(countOf(seen, 'shellBlock')).toBe(1);
    expect(countOf(seen, 'hit')).toBeGreaterThanOrEqual(LEGS.count);
    expect(countOf(seen, 'carriedHome')).toBe(1);
    expect(state.tripOver).toBe(true);
    expect(presentCount(state.legs)).toBe(0);
  });
});
