/**
 * Exit gate placement (issue #183): every area's exit centre lies inside its gate's clear opening,
 * so the gate is drawn where the exit is; a gate standing on rock stands on it across its whole
 * drawn width; and no gate is drawn into rock. `exitGateBase` reads only the column under the exit
 * centre, so these whole-gate checks run here, over every area's data. No Phaser is loaded.
 */
import { describe, expect, it } from 'vitest';
import { AREAS, type AreaData } from '../logic/areas';
import { DEV_DANGER_AREA, DEV_TEST_AREA } from '../logic/devAreas';
import { exitGateBase } from '../logic/exitGate';
import type { RockWall } from '../logic/pebble';
import { areaSize } from '../logic/zone';
import { GATE_H, GATE_OPENING_H, GATE_TEX } from './drawArea';

const GATE_AREAS: readonly Readonly<AreaData>[] = [...AREAS, DEV_TEST_AREA, DEV_DANGER_AREA];

/**
 * Half the gate's drawn width either side of its base-centre: its texture frame, which holds the
 * open state's folded leaves (the widest state) plus padding, so it is never narrower than the art.
 */
const GATE_HALF_W = Math.max(GATE_TEX.originX, GATE_TEX.w - GATE_TEX.originX);

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

  it('stands a gate on rock only where the rock spans its whole drawn width', () => {
    for (const area of GATE_AREAS) {
      const floor = areaFloor(area);
      const base = exitGateBase(area.exit, floor);
      if (base.y === floor.bedTop) continue;
      const footing = floor.rockWalls.filter(
        (rock) => rock.y0 === base.y && rock.x0 <= base.x - GATE_HALF_W && base.x + GATE_HALF_W <= rock.x1,
      );
      expect(footing.length, area.id).toBeGreaterThan(0);
    }
  });

  it('never draws a gate into rock: its drawn box, from its base to its keystone top, overlaps no rock wall', () => {
    for (const area of GATE_AREAS) {
      const floor = areaFloor(area);
      const base = exitGateBase(area.exit, floor);
      const box = { x0: base.x - GATE_HALF_W, x1: base.x + GATE_HALF_W, y0: base.y - GATE_H, y1: base.y };
      const into = floor.rockWalls.filter(
        (rock) => rock.x0 < box.x1 && box.x0 < rock.x1 && rock.y0 < box.y1 && box.y0 < rock.y1,
      );
      expect(into, area.id).toEqual([]);
    }
  });
});
