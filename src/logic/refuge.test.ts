import { describe, expect, it } from 'vitest';
import {
  AREAS,
  CANAL_AREA,
  CANAL_HABITAT,
  CHINAMPA_2_AREA,
  CHINAMPA_AREA,
  CHINAMPA_HABITAT,
  HABITATS,
  POND_2_AREA,
  POND_AREA,
  POND_HABITAT,
  type AreaData,
  type Habitat,
} from './areas';
import { DEV_AREAS } from './devAreas';
import { REGISTRY_KEYS } from './gameEvents';
import {
  EMPTY_REFUGE_PENDING,
  KEEP_EXPLORING_LABEL,
  REFUGE_HIDDEN_NAME,
  REFUGE_MILESTONE_TITLE,
  REFUGE_MORE_TO_COME,
  REFUGE_REGISTRY_KEY,
  REFUGE_SEE_AGAIN_LABEL,
  REFUGE_TITLE,
  habitatPlace,
  hasPendingCleanUps,
  milestoneBody,
  newlyBeatenAreaIds,
  newlyCleanHabitatIds,
  refugeAreaLine,
  refugeHiddenHint,
  refugePendingFrom,
  refugeSections,
  withTripResult,
  withoutCleanUps,
  withoutMilestone,
  type RefugeSection,
} from './refuge';
import { SAVE_GATE_REGISTRY_KEY } from './save';
import { SESSION_REGISTRY_KEY } from './session';
import { NO_STARS, type AreaStarsRecord } from './stars';
import { TRIP_REGISTRY_KEYS } from './tripEvents';
import { KEEP_EXPLORING_LABEL as TRIP_KEEP_EXPLORING_LABEL } from './tripText';

/** The areaText.test and factCards.test banned lists together. */
const BANNED = [
  'die',
  'dead',
  'death',
  'killed',
  'game over',
  'fail',
  'wipe',
  'injury',
  'wound',
  'damage',
  'monster',
  'invulnerab',
  'inventory',
  'checkpoint',
  'loot',
  ' base',
  'level',
  'fish tank',
];

/** A stars record with the exit star saved for each area id. */
function beaten(...areaIds: string[]): AreaStarsRecord {
  return Object.fromEntries(areaIds.map((id) => [id, { ...NO_STARS, exit: true }]));
}

/** A stars record with only the special star for each area id: none of them is beaten. */
function specialOnly(...areaIds: string[]): AreaStarsRecord {
  return Object.fromEntries(areaIds.map((id) => [id, { ...NO_STARS, special: true }]));
}

/** A test-only habitat no real table holds, so its ids never clash with a real habitat or area. */
const MARSH_HABITAT: Readonly<Habitat> = { id: 'reed-marsh', name: 'Reed marsh', look: 'reed-marsh' };

const MARSH_AREA: Readonly<AreaData> = { ...CHINAMPA_AREA, id: 'reed-marsh-1', number: 5, habitatId: MARSH_HABITAT.id };

const MARSH_AREA_2: Readonly<AreaData> = { ...CHINAMPA_AREA, id: 'reed-marsh-2', number: 6, habitatId: MARSH_HABITAT.id };

const FUTURE_AREAS: readonly Readonly<AreaData>[] = [...AREAS, MARSH_AREA, MARSH_AREA_2];

const FUTURE_HABITATS: readonly Readonly<Habitat>[] = [...HABITATS, MARSH_HABITAT];

describe('refugeSections', () => {
  it('has one section per habitat, in the order of each habitat first area', () => {
    const sections = refugeSections({});
    expect(sections.map((section) => section.habitatId)).toEqual([CANAL_HABITAT.id, POND_HABITAT.id, CHINAMPA_HABITAT.id]);
    expect(sections.map((section) => section.firstAreaNumber)).toEqual([1, 2, 4]);
  });

  it('orders sections by area table, not habitat table', () => {
    const sections = refugeSections({}, AREAS, [CHINAMPA_HABITAT, POND_HABITAT, CANAL_HABITAT]);
    expect(sections.map((section) => section.habitatId)).toEqual([CANAL_HABITAT.id, POND_HABITAT.id, CHINAMPA_HABITAT.id]);
  });

  it('skips a habitat with no area', () => {
    const sections = refugeSections({}, AREAS, FUTURE_HABITATS);
    expect(sections.map((section) => section.habitatId)).toEqual([CANAL_HABITAT.id, POND_HABITAT.id, CHINAMPA_HABITAT.id]);
  });

  it('copies the habitat name and look', () => {
    const [canal, pond, chinampa] = refugeSections({});
    expect(canal).toMatchObject({ habitatName: 'Canal', look: 'canal' });
    expect(pond).toMatchObject({ habitatName: 'Lily pad pond', look: 'pond' });
    expect(chinampa).toMatchObject({ habitatName: 'Chinampa gardens', look: 'chinampa' });
  });

  it('has a batch per area of the habitat, in area order', () => {
    const [canal, pond, chinampa] = refugeSections({});
    expect(canal.batches).toEqual([{ areaId: CANAL_AREA.id, areaNumber: 1, cleared: false }]);
    expect(pond.batches).toEqual([
      { areaId: POND_AREA.id, areaNumber: 2, cleared: false },
      { areaId: POND_2_AREA.id, areaNumber: 3, cleared: false },
    ]);
    expect(chinampa.batches).toEqual([
      { areaId: CHINAMPA_AREA.id, areaNumber: 4, cleared: false },
      { areaId: CHINAMPA_2_AREA.id, areaNumber: 5, cleared: false },
    ]);
  });

  it('hides every section on a fresh save', () => {
    expect(refugeSections({}).map((section) => section.state)).toEqual(['hidden', 'hidden', 'hidden']);
  });

  it('keeps a section hidden when its areas have stars but no exit star', () => {
    const [canal, pond] = refugeSections(specialOnly(CANAL_AREA.id, POND_AREA.id, POND_2_AREA.id));
    expect(canal.state).toBe('hidden');
    expect(pond.state).toBe('hidden');
    expect(pond.batches.map((batch) => batch.cleared)).toEqual([false, false]);
  });

  it('cleans a one-area habitat when its area is beaten', () => {
    const [canal, pond] = refugeSections(beaten(CANAL_AREA.id));
    expect(canal.state).toBe('clean');
    expect(canal.batches[0].cleared).toBe(true);
    expect(pond.state).toBe('hidden');
  });

  it('makes a section dirty when only some of its areas are beaten', () => {
    const pond = refugeSections(beaten(CANAL_AREA.id, POND_AREA.id))[1];
    expect(pond.state).toBe('dirty');
    expect(pond.batches.map((batch) => batch.cleared)).toEqual([true, false]);
  });

  it('makes a section dirty when a later area is beaten but not an earlier one', () => {
    const pond = refugeSections(beaten(POND_2_AREA.id))[1];
    expect(pond.state).toBe('dirty');
    expect(pond.batches.map((batch) => batch.cleared)).toEqual([false, true]);
  });

  it('cleans a section when every area in it is beaten', () => {
    const pond = refugeSections(beaten(POND_AREA.id, POND_2_AREA.id))[1];
    expect(pond.state).toBe('clean');
  });

  it('keeps the chinampa section dirty until both Area 4 and Area 5 are beaten (ND-22)', () => {
    const area4Only = refugeSections(beaten(CHINAMPA_AREA.id))[2];
    expect(area4Only.state).toBe('dirty');
    expect(area4Only.batches.map((batch) => batch.cleared)).toEqual([true, false]);
    const area5Only = refugeSections(beaten(CHINAMPA_2_AREA.id))[2];
    expect(area5Only.state).toBe('dirty');
    expect(area5Only.batches.map((batch) => batch.cleared)).toEqual([false, true]);
    const both = refugeSections(beaten(CHINAMPA_AREA.id, CHINAMPA_2_AREA.id))[2];
    expect(both.state).toBe('clean');
    expect(both.batches.map((batch) => batch.cleared)).toEqual([true, true]);
  });

  it('never counts a dev area', () => {
    const devIds = DEV_AREAS.map((area) => area.id);
    expect(refugeSections(beaten(...devIds)).map((section) => section.state)).toEqual(['hidden', 'hidden', 'hidden']);
    expect(newlyBeatenAreaIds({}, beaten(...devIds))).toEqual([]);
  });

  it('adds a section for a future habitat with no code change', () => {
    const sections = refugeSections(beaten(MARSH_AREA.id), FUTURE_AREAS, FUTURE_HABITATS);
    expect(sections.map((section) => section.habitatId)).toEqual(['canal', 'pond', 'chinampa', 'reed-marsh']);
    expect(sections[3]).toEqual({
      habitatId: 'reed-marsh',
      habitatName: 'Reed marsh',
      look: 'reed-marsh',
      firstAreaNumber: 5,
      state: 'dirty',
      batches: [
        { areaId: 'reed-marsh-1', areaNumber: 5, cleared: true },
        { areaId: 'reed-marsh-2', areaNumber: 6, cleared: false },
      ],
    });
  });
});

describe('refugeAreaLine (issue #113, ND-8)', () => {
  it('shows no area line on a hidden section', () => {
    expect(refugeSections({}).map(refugeAreaLine)).toEqual([null, null, null]);
    expect(refugeSections(specialOnly(CANAL_AREA.id, POND_AREA.id)).map(refugeAreaLine)).toEqual([null, null, null]);
  });

  it('names the areas of a dirty section', () => {
    const sections = refugeSections(beaten(POND_AREA.id, CHINAMPA_2_AREA.id));
    expect(sections.map((section) => section.state)).toEqual(['hidden', 'dirty', 'dirty']);
    expect(sections.map(refugeAreaLine)).toEqual([null, 'Areas 2 and 3', 'Areas 4 and 5']);
  });

  it('names the areas of a clean section', () => {
    const sections = refugeSections(beaten(...AREAS.map((area) => area.id)));
    expect(sections.map((section) => section.state)).toEqual(['clean', 'clean', 'clean']);
    expect(sections.map(refugeAreaLine)).toEqual(['Area 1', 'Areas 2 and 3', 'Areas 4 and 5']);
  });

  it('takes the area numbers from the area data', () => {
    const renumbered = AREAS.map((area) => ({ ...area, number: area.number + 10 }));
    expect(refugeSections(beaten(CANAL_AREA.id, POND_AREA.id), renumbered).map(refugeAreaLine)).toEqual([
      'Area 11',
      'Areas 12 and 13',
      null,
    ]);
  });

  it('names a future habitat of three areas', () => {
    const marsh: RefugeSection = {
      habitatId: MARSH_HABITAT.id,
      habitatName: MARSH_HABITAT.name,
      look: MARSH_HABITAT.look,
      firstAreaNumber: 6,
      state: 'dirty',
      batches: [
        { areaId: 'reed-marsh-1', areaNumber: 6, cleared: true },
        { areaId: 'reed-marsh-2', areaNumber: 7, cleared: false },
        { areaId: 'reed-marsh-3', areaNumber: 8, cleared: false },
      ],
    };
    expect(refugeAreaLine(marsh)).toBe('Areas 6 to 8');
    expect(refugeAreaLine({ ...marsh, state: 'clean' })).toBe('Areas 6 to 8');
    expect(refugeAreaLine({ ...marsh, state: 'hidden' })).toBeNull();
  });

  it('uses no banned word', () => {
    const lines = refugeSections(beaten(...AREAS.map((area) => area.id))).map(refugeAreaLine);
    for (const line of lines) for (const word of BANNED) expect(line?.toLowerCase()).not.toContain(word);
  });
});

describe('newlyBeatenAreaIds', () => {
  it('lists the area beaten this trip', () => {
    expect(newlyBeatenAreaIds({}, beaten(CANAL_AREA.id))).toEqual([CANAL_AREA.id]);
  });

  it('lists nothing on a replay of a beaten area', () => {
    const stars = beaten(CANAL_AREA.id);
    expect(newlyBeatenAreaIds(stars, { ...stars, [CANAL_AREA.id]: { exit: true, special: true, legsOrRescue: true } })).toEqual([]);
  });

  it('lists nothing when only other stars are new', () => {
    expect(newlyBeatenAreaIds({}, specialOnly(CANAL_AREA.id))).toEqual([]);
  });

  it('lists an edited save that beat Area 3 but not Area 2', () => {
    const before = beaten(CANAL_AREA.id);
    expect(newlyBeatenAreaIds(before, { ...before, ...beaten(POND_2_AREA.id) })).toEqual([POND_2_AREA.id]);
  });

  it('lists several areas in area-table order', () => {
    expect(newlyBeatenAreaIds({}, beaten(POND_2_AREA.id, CANAL_AREA.id))).toEqual([CANAL_AREA.id, POND_2_AREA.id]);
  });
});

describe('newlyCleanHabitatIds', () => {
  it('lists the canal when Area 1 is beaten', () => {
    expect(newlyCleanHabitatIds({}, beaten(CANAL_AREA.id))).toEqual([CANAL_HABITAT.id]);
  });

  it('lists nothing on a replay of a clean habitat', () => {
    const stars = beaten(CANAL_AREA.id);
    expect(newlyCleanHabitatIds(stars, stars)).toEqual([]);
  });

  it('lists nothing when a habitat only becomes dirty', () => {
    const before = beaten(CANAL_AREA.id);
    expect(newlyCleanHabitatIds(before, { ...before, ...beaten(POND_AREA.id) })).toEqual([]);
  });

  it('does not clean the pond for an edited save that beat Area 3 but not Area 2', () => {
    const before = beaten(CANAL_AREA.id);
    const after = { ...before, ...beaten(POND_2_AREA.id) };
    expect(newlyCleanHabitatIds(before, after)).toEqual([]);
    expect(newlyCleanHabitatIds(after, { ...after, ...beaten(POND_AREA.id) })).toEqual([POND_HABITAT.id]);
  });

  it('lists two habitats in section order when both become clean at once', () => {
    expect(newlyCleanHabitatIds({}, beaten(POND_2_AREA.id, POND_AREA.id, CANAL_AREA.id))).toEqual([
      CANAL_HABITAT.id,
      POND_HABITAT.id,
    ]);
  });

  it('lists the chinampa gardens only when Area 4 and Area 5 are both beaten (ND-22)', () => {
    const area4 = beaten(CHINAMPA_AREA.id);
    expect(newlyCleanHabitatIds({}, area4)).toEqual([]);
    expect(newlyCleanHabitatIds(area4, { ...area4, ...beaten(CHINAMPA_2_AREA.id) })).toEqual([CHINAMPA_HABITAT.id]);
    expect(newlyCleanHabitatIds({}, beaten(CHINAMPA_2_AREA.id))).toEqual([]);
    expect(newlyCleanHabitatIds({}, beaten(CHINAMPA_2_AREA.id, CHINAMPA_AREA.id))).toEqual([CHINAMPA_HABITAT.id]);
  });

  it('lists a future habitat with no code change', () => {
    const before = beaten(MARSH_AREA.id);
    const after = { ...before, ...beaten(MARSH_AREA_2.id) };
    expect(newlyCleanHabitatIds(before, after, FUTURE_AREAS, FUTURE_HABITATS)).toEqual(['reed-marsh']);
  });
});

describe('refuge pending', () => {
  it('starts empty', () => {
    expect(EMPTY_REFUGE_PENDING).toEqual({ cleanUps: [], milestones: [] });
    expect(Object.isFrozen(EMPTY_REFUGE_PENDING)).toBe(true);
    expect(hasPendingCleanUps(EMPTY_REFUGE_PENDING)).toBe(false);
  });

  it('adds the clean-up and milestone of one trip', () => {
    const pending = withTripResult(EMPTY_REFUGE_PENDING, {}, beaten(CANAL_AREA.id));
    expect(pending).toEqual({ cleanUps: [CANAL_AREA.id], milestones: [CANAL_HABITAT.id] });
    expect(hasPendingCleanUps(pending)).toBe(true);
  });

  it('adds nothing on a replay', () => {
    const stars = beaten(CANAL_AREA.id);
    expect(withTripResult(EMPTY_REFUGE_PENDING, stars, stars)).toEqual({ cleanUps: [], milestones: [] });
  });

  it('accumulates across trips in area-table order, each id once', () => {
    const first = beaten(CANAL_AREA.id, POND_2_AREA.id);
    const second = { ...first, ...beaten(POND_AREA.id) };
    let pending = withTripResult(EMPTY_REFUGE_PENDING, {}, first);
    pending = withTripResult(pending, first, second);
    pending = withTripResult(pending, second, second);
    expect(pending).toEqual({
      cleanUps: [CANAL_AREA.id, POND_AREA.id, POND_2_AREA.id],
      milestones: [CANAL_HABITAT.id, POND_HABITAT.id],
    });
  });

  it('keeps two milestones from one return', () => {
    const pending = withTripResult(EMPTY_REFUGE_PENDING, {}, beaten(CANAL_AREA.id, POND_AREA.id, POND_2_AREA.id));
    expect(pending.milestones).toEqual([CANAL_HABITAT.id, POND_HABITAT.id]);
  });

  it('does not change the pending it is given', () => {
    const pending = { cleanUps: [CANAL_AREA.id], milestones: [] };
    withTripResult(pending, beaten(CANAL_AREA.id), beaten(CANAL_AREA.id, POND_AREA.id));
    expect(pending).toEqual({ cleanUps: [CANAL_AREA.id], milestones: [] });
  });

  it('adds a future habitat milestone with no code change', () => {
    const pending = withTripResult(
      EMPTY_REFUGE_PENDING,
      {},
      beaten(MARSH_AREA.id, MARSH_AREA_2.id),
      FUTURE_AREAS,
      FUTURE_HABITATS,
    );
    expect(pending).toEqual({ cleanUps: ['reed-marsh-1', 'reed-marsh-2'], milestones: ['reed-marsh'] });
  });

  it('drops the clean-ups and keeps the milestones', () => {
    const pending = { cleanUps: [CANAL_AREA.id], milestones: [CANAL_HABITAT.id] };
    const cleared = withoutCleanUps(pending);
    expect(cleared).toEqual({ cleanUps: [], milestones: [CANAL_HABITAT.id] });
    expect(hasPendingCleanUps(cleared)).toBe(false);
    expect(pending.cleanUps).toEqual([CANAL_AREA.id]);
  });

  it('drops one milestone and keeps the rest', () => {
    const pending = { cleanUps: [POND_AREA.id], milestones: [CANAL_HABITAT.id, POND_HABITAT.id] };
    expect(withoutMilestone(pending, CANAL_HABITAT.id)).toEqual({ cleanUps: [POND_AREA.id], milestones: [POND_HABITAT.id] });
    expect(withoutMilestone(pending, 'nowhere')).toEqual(pending);
    expect(pending.milestones).toEqual([CANAL_HABITAT.id, POND_HABITAT.id]);
  });
});

describe('refugePendingFrom', () => {
  it.each([undefined, null, 7, 'refuge', true, [CANAL_AREA.id]])('reads %j as nothing pending', (value) => {
    expect(refugePendingFrom(value)).toEqual({ cleanUps: [], milestones: [] });
  });

  it('keeps a valid pending as it is', () => {
    const pending = { cleanUps: [CANAL_AREA.id, POND_AREA.id], milestones: [CANAL_HABITAT.id] };
    expect(refugePendingFrom(pending)).toEqual(pending);
  });

  it('repairs junk: known ids only, each once, in table order', () => {
    const junk = {
      cleanUps: [CHINAMPA_AREA.id, POND_2_AREA.id, 'nowhere', 3, CANAL_AREA.id, POND_2_AREA.id, null, DEV_AREAS[0].id, MARSH_AREA.id],
      milestones: [POND_HABITAT.id, {}, MARSH_HABITAT.id, CHINAMPA_HABITAT.id, CANAL_HABITAT.id, POND_HABITAT.id],
    };
    expect(refugePendingFrom(junk)).toEqual({
      cleanUps: [CANAL_AREA.id, POND_2_AREA.id, CHINAMPA_AREA.id],
      milestones: [CANAL_HABITAT.id, POND_HABITAT.id, CHINAMPA_HABITAT.id],
    });
  });

  it('reads missing or non-array lists as empty', () => {
    expect(refugePendingFrom({ cleanUps: 'canal-1' })).toEqual({ cleanUps: [], milestones: [] });
    expect(refugePendingFrom({ milestones: [CANAL_HABITAT.id] })).toEqual({ cleanUps: [], milestones: [CANAL_HABITAT.id] });
  });

  it('keeps future habitat ids when given the future tables', () => {
    const stored = { cleanUps: ['reed-marsh-2'], milestones: ['reed-marsh'] };
    expect(refugePendingFrom(stored, FUTURE_AREAS, FUTURE_HABITATS)).toEqual(stored);
  });
});

describe('refuge copy', () => {
  it('has the screen words', () => {
    expect(REFUGE_TITLE).toBe('Xochimilco refuge');
    expect(REFUGE_HIDDEN_NAME).toBe('???');
    expect(REFUGE_MORE_TO_COME).toBe('More to come');
    expect(REFUGE_SEE_AGAIN_LABEL).toBe('See it again');
    expect(REFUGE_MILESTONE_TITLE).toBe('All clean!');
  });

  it('reuses the banking card Keep exploring label', () => {
    expect(KEEP_EXPLORING_LABEL).toBe(TRIP_KEEP_EXPLORING_LABEL);
  });

  it('hints the area that opens a hidden section', () => {
    expect(refugeHiddenHint(1)).toBe('Beat Area 1');
    expect(refugeHiddenHint(4)).toBe('Beat Area 4');
    expect(refugeSections({}).map((section) => refugeHiddenHint(section.firstAreaNumber))).toEqual([
      'Beat Area 1',
      'Beat Area 2',
      'Beat Area 4',
    ]);
  });

  it('names a habitat as a place in lower case', () => {
    expect(habitatPlace('Canal')).toBe('the canal');
    expect(habitatPlace('Lily pad pond')).toBe('the lily pad pond');
    expect(habitatPlace('Chinampa gardens')).toBe('the chinampa gardens');
  });

  it('thanks the axolotl and names the real work', () => {
    expect(milestoneBody('Pip', 'Canal')).toBe(
      'You and Pip cleaned up the canal! Real people in Xochimilco do this work too.',
    );
    expect(milestoneBody('Pip', 'Lily pad pond')).toBe(
      'You and Pip cleaned up the lily pad pond! Real people in Xochimilco do this work too.',
    );
    expect(milestoneBody('Pip', 'Chinampa gardens')).toBe(
      'You and Pip cleaned up the chinampa gardens! Real people in Xochimilco do this work too.',
    );
  });

  it.each([
    REFUGE_TITLE,
    REFUGE_HIDDEN_NAME,
    REFUGE_MORE_TO_COME,
    REFUGE_SEE_AGAIN_LABEL,
    REFUGE_MILESTONE_TITLE,
    refugeHiddenHint(3),
    ...FUTURE_HABITATS.map((habitat) => milestoneBody('Pip', habitat.name)),
  ])('"%s" avoids banned words', (text) => {
    const lower = text.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });
});

describe('REFUGE_REGISTRY_KEY', () => {
  it('differs from every other registry key', () => {
    const others = [
      ...Object.values(REGISTRY_KEYS),
      ...Object.values(TRIP_REGISTRY_KEYS),
      SESSION_REGISTRY_KEY,
      SAVE_GATE_REGISTRY_KEY,
      'devArea',
      'devDecor',
    ];
    expect(REFUGE_REGISTRY_KEY).toBe('refuge');
    expect(others).not.toContain(REFUGE_REGISTRY_KEY);
  });
});
