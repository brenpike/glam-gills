import { describe, expect, it } from 'vitest';
import { AREAS, SPRING_CAVE_2_AREA, type AreaData } from './areas';
import { exitGateBase } from './exitGate';
import type { RockWall } from './pebble';
import { areaSize } from './zone';

const EXIT = { x: 500, y: 200 };
const BED_TOP = 600;

function wall(x0: number, x1: number, y0: number, y1: number): RockWall {
  return { x0, x1, y0, y1 };
}

/** The area's floor as exitGateBase reads it: the bed from the area size and the rock walls. */
function areaFloor(area: Readonly<AreaData>): { bedTop: number; rockWalls: RockWall[] } {
  const { bedTop } = areaSize(area.layout.screensWide, area.layout.screensTall);
  return { bedTop, rockWalls: (area.layout.rockWalls ?? []).map((rock) => ({ ...rock })) };
}

describe('exitGateBase', () => {
  it('stands the gate on the bed under the exit centre when there are no rock walls', () => {
    expect(exitGateBase(EXIT, { bedTop: BED_TOP })).toEqual({ x: 500, y: BED_TOP });
    expect(exitGateBase(EXIT, { bedTop: BED_TOP, rockWalls: [] })).toEqual({ x: 500, y: BED_TOP });
  });

  it('ignores a wall above the exit centre and a wall not under its x', () => {
    const above = wall(400, 600, 100, 150);
    const aside = wall(520, 700, 300, 340);
    const behind = wall(300, 499, 300, 340);
    expect(exitGateBase(EXIT, { bedTop: BED_TOP, rockWalls: [above, aside, behind] })).toEqual({ x: 500, y: BED_TOP });
  });

  it('stands the gate on the nearest of two walls under the exit centre', () => {
    const lower = wall(400, 600, 450, 480);
    const nearer = wall(450, 500, 300, 340);
    expect(exitGateBase(EXIT, { bedTop: BED_TOP, rockWalls: [lower, nearer] })).toEqual({ x: 500, y: 300 });
  });

  it('keeps the gate on the bed in each of Areas 1 to 6', () => {
    const bedAreas = AREAS.filter((area) => area.number <= 6);
    expect(bedAreas.map((area) => area.number)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const area of bedAreas) {
      const floor = areaFloor(area);
      expect(exitGateBase(area.exit, floor), area.id).toEqual({ x: area.exit.x, y: floor.bedTop });
    }
  });

  it("stands Area 7's gate on the pebble room's lid at y 340, not the bed at 678", () => {
    const floor = areaFloor(SPRING_CAVE_2_AREA);
    expect(floor.bedTop).toBe(678);
    expect(exitGateBase(SPRING_CAVE_2_AREA.exit, floor)).toEqual({ x: 3720, y: 340 });
  });
});
