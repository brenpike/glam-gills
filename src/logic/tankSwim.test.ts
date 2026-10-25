import { describe, expect, it } from 'vitest';
import { STARTER_AXOLOTL_ID } from './session';
import { TANK_SWIM, tankLapPeriod, tankLaneY, tankSwimPose, type TankSwimPose } from './tankSwim';

const STEP_S = 0.1;
const LONG_S = 200;
const IDS = [
  STARTER_AXOLOTL_ID,
  'rescued-leucistic',
  'rescued-wild',
  'rescued-golden-albino',
  'rescued-melanoid',
  'rescued-white-albino',
  'rescued-copper',
  'rescued-piebald',
  'rescued-axanthic',
];
const TANK_AXOLOTL_COUNT = 8;
const MIN_LANE_GAP_PX = 15;
const END_SLACK_PX = 2;

/** Poses of one axolotl from 0 to `untilS` every STEP_S seconds. */
function poses(id: string, index: number, untilS: number, reduced: boolean): TankSwimPose[] {
  const steps = Math.round(untilS / STEP_S);
  return Array.from({ length: steps + 1 }, (_, step) => tankSwimPose(id, index, step * STEP_S, reduced));
}

describe('reduced motion', () => {
  it('holds one still pose from 0 to 200 s', () => {
    for (let index = 0; index < 4; index++) {
      const still = tankSwimPose(STARTER_AXOLOTL_ID, index, 0, true);
      expect(still.tilt).toBe(0);
      for (const pose of poses(STARTER_AXOLOTL_ID, index, LONG_S, true)) expect(pose).toEqual(still);
    }
  });

  it('keeps still poses inside the lap and the water', () => {
    for (let index = 0; index < 8; index++) {
      const pose = tankSwimPose('any', index, 12, true);
      expect(pose.x).toBeGreaterThanOrEqual(TANK_SWIM.lapX0);
      expect(pose.x).toBeLessThanOrEqual(TANK_SWIM.lapX1);
      expect(pose.y).toBeGreaterThanOrEqual(TANK_SWIM.waterY0);
      expect(pose.y).toBeLessThanOrEqual(TANK_SWIM.waterY1);
    }
  });
});

describe('full motion', () => {
  it('stays inside the lap and the water at every 0.1 s step', () => {
    for (const [index, id] of IDS.entries()) {
      for (const pose of poses(id, index, LONG_S, false)) {
        expect(pose.x).toBeGreaterThanOrEqual(TANK_SWIM.lapX0);
        expect(pose.x).toBeLessThanOrEqual(TANK_SWIM.lapX1);
        expect(pose.y).toBeGreaterThanOrEqual(TANK_SWIM.waterY0);
        expect(pose.y).toBeLessThanOrEqual(TANK_SWIM.waterY1);
        expect(Math.abs(pose.tilt)).toBeLessThanOrEqual(TANK_SWIM.maxTilt);
      }
    }
  }, 30_000);

  it('flips facing only at the ends of the lap', () => {
    const list = poses(STARTER_AXOLOTL_ID, 0, 60, false);
    let flips = 0;
    for (let step = 1; step < list.length; step++) {
      if (list[step].facing === list[step - 1].facing) continue;
      flips += 1;
      const atEnd =
        list[step].x - TANK_SWIM.lapX0 <= END_SLACK_PX || TANK_SWIM.lapX1 - list[step].x <= END_SLACK_PX;
      expect(atEnd).toBe(true);
    }
    expect(flips).toBeGreaterThanOrEqual(4);
  });

  it('faces the way it swims', () => {
    const list = poses(STARTER_AXOLOTL_ID, 0, 30, false);
    for (let step = 1; step < list.length; step++) {
      const dx = list[step].x - list[step - 1].x;
      if (list[step].facing !== list[step - 1].facing || Math.abs(dx) < 1e-9) continue;
      expect(Math.sign(dx)).toBe(list[step].facing);
    }
  });

  it('bobs about the lane by the bob amplitude', () => {
    const ys = poses(STARTER_AXOLOTL_ID, 0, 6, false).map((pose) => pose.y);
    const lane = tankLaneY(0);
    expect(Math.max(...ys) - lane).toBeCloseTo(TANK_SWIM.bobPx, 0);
    expect(lane - Math.min(...ys)).toBeCloseTo(TANK_SWIM.bobPx, 0);
  });

  it('is the same for the same id, index and time', () => {
    expect(tankSwimPose('a', 1, 12.3, false)).toEqual(tankSwimPose('a', 1, 12.3, false));
  });
});

describe('lap period and lanes', () => {
  it('gives every id a stable period from 16 to 24 s', () => {
    for (let n = 0; n < 200; n++) {
      const id = `axolotl-${n}`;
      const period = tankLapPeriod(id);
      expect(period).toBeGreaterThanOrEqual(16);
      expect(period).toBeLessThanOrEqual(24);
      expect(tankLapPeriod(id)).toBe(period);
    }
  });

  it('swims different ids differently', () => {
    const periods = new Set(IDS.map(tankLapPeriod));
    expect(periods.size).toBe(IDS.length);
    const first = poses(IDS[0], 0, 10, false);
    const second = poses(IDS[1], 0, 10, false);
    expect(first.some((pose, step) => Math.abs(pose.x - second[step].x) > 1)).toBe(true);
  });

  it('gives four indexes distinct lanes inside the water (#13 ready)', () => {
    const lanes = [0, 1, 2, 3].map(tankLaneY);
    expect(new Set(lanes).size).toBe(4);
    const sorted = [...lanes].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(20);
    for (const lane of lanes) {
      expect(lane - TANK_SWIM.bobPx).toBeGreaterThanOrEqual(TANK_SWIM.waterY0);
      expect(lane + TANK_SWIM.bobPx).toBeLessThanOrEqual(TANK_SWIM.waterY1);
    }
  });

  it('gives four indexes distinct still poses', () => {
    const still = [0, 1, 2, 3].map((index) => tankSwimPose(STARTER_AXOLOTL_ID, index, 0, true));
    expect(new Set(still.map((pose) => `${pose.x},${pose.y}`)).size).toBe(4);
  });

  it('gives eight indexes distinct lanes inside the water', () => {
    const lanes = Array.from({ length: TANK_AXOLOTL_COUNT }, (_, index) => tankLaneY(index));
    expect(new Set(lanes).size).toBe(TANK_AXOLOTL_COUNT);
    const sorted = [...lanes].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(MIN_LANE_GAP_PX);
    for (const lane of lanes) {
      expect(lane - TANK_SWIM.bobPx).toBeGreaterThanOrEqual(TANK_SWIM.waterY0);
      expect(lane + TANK_SWIM.bobPx).toBeLessThanOrEqual(TANK_SWIM.waterY1);
    }
  });

  it('gives eight indexes distinct still poses', () => {
    const still = Array.from({ length: TANK_AXOLOTL_COUNT }, (_, index) =>
      tankSwimPose(STARTER_AXOLOTL_ID, index, 0, true),
    );
    expect(new Set(still.map((pose) => `${pose.x},${pose.y}`)).size).toBe(TANK_AXOLOTL_COUNT);
  });
});
