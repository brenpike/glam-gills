import { describe, expect, it } from 'vitest';
import type { GhostNetState } from './ghostNets';
import {
  NO_HAZARD_EDGES,
  hazardSnapshot,
  hazardSoundEdges,
  type HazardSnapshot,
  type HazardSoundTrip,
  type ViewRect,
} from './hazardSounds';
import type { ElementSpawn, MatPair } from './hazards';
import { hyacinthMatSpawn } from './hyacinthMats';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import type { TripState } from './trip';
import type { TripPhase } from './tripEvents';

/** Punting pole cycle from offset 0: rest [0, 1.6), warn [1.6, 2.6), jab [2.6, 2.9), hold [2.9, 3.4), lift [3.4, 4). */
const POLE = movingHazardSpawn('pole-a', PUNTING_POLE, 500, 0);
const POLE_LATER = movingHazardSpawn('pole-b', PUNTING_POLE, 700, 0);

/** Mat cycle from offset 0: opening [0, 1), open [1, 3), closing [3, 4), closed [4, 8). */
const PAIR: MatPair = { x0: 300, x1: 420, rowTop: 100, rowBottom: 300, channelY: 200, openHeight: 72 };
const MATS = hyacinthMatSpawn('mats-a', 0, PAIR);
const MATS_FAR = hyacinthMatSpawn('mats-b', 0, { ...PAIR, x0: 2300, x1: 2420 });

/** A view holding the pole's shaft (x 495..505, y 80..260) and the mat box (x 300..420, y 100..300). */
const ON_SCREEN: ViewRect = { x: 0, y: 0, width: 960, height: 540 };
const OFF_SCREEN: ViewRect = { x: 1000, y: 0, width: 960, height: 540 };

interface TripFixture {
  phase?: TripPhase;
  snagLeft?: number;
  poles?: MovingHazardSpawn[];
  hazardTime?: number;
  elements?: ElementSpawn[];
  elementTime?: number;
}

function createNets(snagLeft: number): GhostNetState {
  return { nets: [], snagLeft, inReach: [] };
}

function createTrip(fixture: TripFixture = {}): HazardSoundTrip {
  const { phase = 'swimming', snagLeft = 0, poles, hazardTime, elements = [], elementTime = 0 } = fixture;
  const encounter = poles === undefined ? {} : { movingHazards: poles, hazardTime: hazardTime ?? 0 };
  return { phase, ghostNets: createNets(snagLeft), encounter, elements, elementTime };
}

function createSnapshot(overrides: Partial<HazardSnapshot> = {}): HazardSnapshot {
  return { snagged: false, hazardTime: undefined, elementTime: 0, ...overrides };
}

function poleEdges(before: number, now: number, view: ViewRect = ON_SCREEN, poles: MovingHazardSpawn[] = [POLE]) {
  return hazardSoundEdges(createSnapshot({ hazardTime: before }), createTrip({ poles, hazardTime: now }), view);
}

function matEdges(before: number, now: number, view: ViewRect = ON_SCREEN, elements: ElementSpawn[] = [MATS]) {
  return hazardSoundEdges(createSnapshot({ elementTime: before }), createTrip({ elements, elementTime: now }), view);
}

describe('hazardSnapshot (issue #166)', () => {
  it('records the snag flag and both clocks', () => {
    const trip = createTrip({ snagLeft: 1.2, poles: [POLE], hazardTime: 3.5, elementTime: 7 });
    expect(hazardSnapshot(trip)).toEqual({ snagged: true, hazardTime: 3.5, elementTime: 7 });
  });

  it('has no hazard clock when the trip has no moving hazards', () => {
    expect(hazardSnapshot(createTrip({ elementTime: 2 }))).toEqual({ snagged: false, hazardTime: undefined, elementTime: 2 });
  });

  it('takes a TripState', () => {
    const fromTrip = (state: TripState): HazardSoundTrip => state;
    expect(typeof fromTrip).toBe('function');
  });
});

describe('hazardSoundEdges: first frame and trip phase (issue #166, ND-7)', () => {
  it('gives none on the first frame, even where every edge would fire', () => {
    const trip = createTrip({ poles: [POLE], hazardTime: 1.6, elements: [MATS], elementTime: 0 });
    expect(hazardSoundEdges(undefined, trip, ON_SCREEN)).toBe(NO_HAZARD_EDGES);
  });

  it.each<TripPhase>(['banked', 'carrying', 'ended'])('gives none while %s', (phase) => {
    const prev = createSnapshot({ snagged: true, hazardTime: 1.5, elementTime: 7.9 });
    const trip = createTrip({ phase, poles: [POLE], hazardTime: 1.7, elements: [MATS], elementTime: 8 });
    expect(hazardSoundEdges(prev, trip, ON_SCREEN)).toBe(NO_HAZARD_EDGES);
  });

  it('returns the shared NO_HAZARD_EDGES when nothing changes', () => {
    const prev = createSnapshot({ hazardTime: 0.5, elementTime: 5 });
    const trip = createTrip({ poles: [POLE], hazardTime: 0.6, elements: [MATS], elementTime: 5.1 });
    expect(hazardSoundEdges(prev, trip, ON_SCREEN)).toBe(NO_HAZARD_EDGES);
  });
});

describe('hazardSoundEdges: the snag ends (issue #166, ND-5)', () => {
  it('fires once when the snag runs out while swimming', () => {
    const prev = createSnapshot({ snagged: true });
    const trip = createTrip({ snagLeft: 0 });
    expect(hazardSoundEdges(prev, trip, ON_SCREEN)).toEqual({ snagEnded: true, poleWarned: false, matsOpened: false });
    expect(hazardSoundEdges(hazardSnapshot(trip), trip, ON_SCREEN)).toBe(NO_HAZARD_EDGES);
  });

  it('gives none while still snagged or on a new snag', () => {
    expect(hazardSoundEdges(createSnapshot({ snagged: true }), createTrip({ snagLeft: 0.5 }), ON_SCREEN)).toBe(NO_HAZARD_EDGES);
    expect(hazardSoundEdges(createSnapshot(), createTrip({ snagLeft: 2 }), ON_SCREEN)).toBe(NO_HAZARD_EDGES);
  });

  it('gives no wriggle at the carry start, nor on the frame after it', () => {
    const carrying = createTrip({ phase: 'carrying', snagLeft: 0 });
    expect(hazardSoundEdges(createSnapshot({ snagged: true }), carrying, ON_SCREEN)).toBe(NO_HAZARD_EDGES);
    expect(hazardSoundEdges(hazardSnapshot(carrying), createTrip({ snagLeft: 0 }), ON_SCREEN)).toBe(NO_HAZARD_EDGES);
  });

  it('ends the snag off screen too: it is the explorer, not a hazard in view', () => {
    expect(hazardSoundEdges(createSnapshot({ snagged: true }), createTrip(), OFF_SCREEN).snagEnded).toBe(true);
  });
});

describe('hazardSoundEdges: a pole warns (issue #166, ND-4)', () => {
  it('fires once when an on-screen pole goes from rest to warn', () => {
    expect(poleEdges(1.55, 1.65)).toEqual({ snagEnded: false, poleWarned: true, matsOpened: false });
    expect(poleEdges(1.65, 1.75)).toBe(NO_HAZARD_EDGES);
  });

  it('fires again on the next cycle', () => {
    expect(poleEdges(5.55, 5.65).poleWarned).toBe(true);
  });

  it('gives none for an off-screen pole', () => {
    expect(poleEdges(1.55, 1.65, OFF_SCREEN)).toBe(NO_HAZARD_EDGES);
  });

  it('counts a shaft partly in view, and not one only touching the view edge', () => {
    expect(poleEdges(1.55, 1.65, { ...OFF_SCREEN, x: 503 }).poleWarned).toBe(true);
    expect(poleEdges(1.55, 1.65, { ...OFF_SCREEN, x: 505 })).toBe(NO_HAZARD_EDGES);
    expect(poleEdges(1.55, 1.65, { x: 0, y: 260, width: 960, height: 540 })).toBe(NO_HAZARD_EDGES);
    expect(poleEdges(1.55, 1.65, { x: 0, y: 250, width: 960, height: 540 }).poleWarned).toBe(true);
  });

  it.each([
    ['jab', 2.55, 2.65],
    ['hold', 2.85, 2.95],
    ['lift', 3.35, 3.45],
    ['rest', 3.95, 4.05],
  ])('gives none when the %s phase starts', (_phase, before, now) => {
    expect(poleEdges(before, now)).toBe(NO_HAZARD_EDGES);
  });

  it('gives one edge for several poles warning in one frame', () => {
    expect(poleEdges(1.55, 1.65, ON_SCREEN, [POLE, POLE_LATER])).toEqual({
      snagEnded: false,
      poleWarned: true,
      matsOpened: false,
    });
  });

  it('fires for an on-screen pole when another warning pole is off screen', () => {
    const farPole = movingHazardSpawn('pole-far', PUNTING_POLE, 3000, 0);
    expect(poleEdges(1.55, 1.65, ON_SCREEN, [farPole, POLE]).poleWarned).toBe(true);
  });

  it('gives none without a hazard clock at either time', () => {
    const trip = createTrip({ poles: [POLE], hazardTime: 1.65 });
    expect(hazardSoundEdges(createSnapshot({ hazardTime: undefined }), trip, ON_SCREEN)).toBe(NO_HAZARD_EDGES);
    expect(hazardSoundEdges(createSnapshot({ hazardTime: 1.55 }), createTrip(), ON_SCREEN)).toBe(NO_HAZARD_EDGES);
  });
});

describe('hazardSoundEdges: mats open (issue #166, ND-6)', () => {
  it('fires once when an on-screen pair goes into opening', () => {
    expect(matEdges(7.95, 8.05)).toEqual({ snagEnded: false, poleWarned: false, matsOpened: true });
    expect(matEdges(8.05, 8.15)).toBe(NO_HAZARD_EDGES);
  });

  it('gives none for an off-screen pair', () => {
    expect(matEdges(7.95, 8.05, OFF_SCREEN)).toBe(NO_HAZARD_EDGES);
  });

  it('counts a box partly in view, and not one only touching the view edge', () => {
    expect(matEdges(7.95, 8.05, { ...OFF_SCREEN, x: 410 }).matsOpened).toBe(true);
    expect(matEdges(7.95, 8.05, { ...OFF_SCREEN, x: 420 })).toBe(NO_HAZARD_EDGES);
  });

  it.each([
    ['open', 0.95, 1.05],
    ['closing', 2.95, 3.05],
    ['closed', 3.95, 4.05],
  ])('gives none when the %s phase starts', (_phase, before, now) => {
    expect(matEdges(before, now)).toBe(NO_HAZARD_EDGES);
  });

  it('gives one edge for two pairs opening in one frame', () => {
    const near = hyacinthMatSpawn('mats-c', 0, { ...PAIR, x0: 600, x1: 700 });
    expect(matEdges(7.95, 8.05, ON_SCREEN, [MATS, near])).toEqual({ snagEnded: false, poleWarned: false, matsOpened: true });
  });

  it('fires for an on-screen pair when another opening pair is off screen', () => {
    expect(matEdges(7.95, 8.05, ON_SCREEN, [MATS_FAR, MATS]).matsOpened).toBe(true);
  });

  it('skips an element with no mat pair', () => {
    const bare: ElementSpawn = { id: MATS.id, type: MATS.type, offset: MATS.offset };
    expect(matEdges(7.95, 8.05, ON_SCREEN, [bare])).toBe(NO_HAZARD_EDGES);
  });
});

describe('hazardSoundEdges: edges together (issue #166)', () => {
  it('reports every edge of one frame', () => {
    const prev = createSnapshot({ snagged: true, hazardTime: 1.55, elementTime: 7.95 });
    const trip = createTrip({ poles: [POLE], hazardTime: 1.65, elements: [MATS], elementTime: 8.05 });
    expect(hazardSoundEdges(prev, trip, ON_SCREEN)).toEqual({ snagEnded: true, poleWarned: true, matsOpened: true });
  });
});
