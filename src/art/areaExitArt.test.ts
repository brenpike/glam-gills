/**
 * Exit gate placement (issue #183): every area's exit centre lies inside its gate's clear opening,
 * so the gate is drawn where the exit is, and a gate standing on rock stands on it across its whole
 * width. No Phaser is loaded.
 */
import { describe, expect, it } from 'vitest';
import { AREAS, type AreaData } from '../logic/areas';
import { DEV_DANGER_AREA, DEV_TEST_AREA } from '../logic/devAreas';
import { exitGateBase } from '../logic/exitGate';
import type { RockWall } from '../logic/pebble';
import { areaSize } from '../logic/zone';
import { GATE_ARCH_W, GATE_OPENING_H } from './drawArea';

const GATE_AREAS: readonly Readonly<AreaData>[] = [...AREAS, DEV_TEST_AREA, DEV_DANGER_AREA];

/** The area's floor as exitGateBase reads it: the bed from the area size and the rock walls. */
function areaFloor(area: Readonly<AreaData>): { bedTop: number; rockWalls: RockWall[] } {
  const { bedTop } = areaSize(area.layout.screensWide, area.layout.screensTall);
  return { bedTop, rockWalls: (area.layout.rockWalls ?? []).map((rock) => ({ ...rock })) };
}

describe('exit gate placement', () => {
  it("puts every area's exit centre inside its gate's clear opening", () => {
    for (const area of GATE_AREAS) {
      const base = exitGateBase(area.exit, areaFloor(area));
      expect(base.x, area.id).toBe(area.exit.x);
      expect(area.exit.y, area.id).toBeGreaterThanOrEqual(base.y - GATE_OPENING_H);
      expect(area.exit.y, area.id).toBeLessThan(base.y);
    }
  });

  it('stands a gate on rock only where the rock spans its whole outer width', () => {
    for (const area of GATE_AREAS) {
      const floor = areaFloor(area);
      const base = exitGateBase(area.exit, floor);
      if (base.y === floor.bedTop) continue;
      const footing = floor.rockWalls.filter(
        (rock) => rock.y0 === base.y && rock.x0 <= base.x - GATE_ARCH_W / 2 && base.x + GATE_ARCH_W / 2 <= rock.x1,
      );
      expect(footing.length, area.id).toBeGreaterThan(0);
    }
  });
});
