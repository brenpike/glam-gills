/**
 * Where an area's exit gate stands (issue #183): on the nearest solid floor right under the exit
 * centre, so the gate's opening is drawn around the exit circle the axolotl has to reach.
 */
import type { AreaExit } from './areas';
import type { Point, ZoneLayout } from './zone';

/**
 * The gate's base-centre (issue #183). Its x is the exit's x. Its y is the top of the nearest rock
 * wall right under the exit centre: the smallest `y0` of a wall with `x0 <= exit.x <= x1` and
 * `y0 > exit.y`. With no such wall it is the bed, `floor.bedTop`.
 */
export function exitGateBase(
  exit: Pick<AreaExit, 'x' | 'y'>,
  floor: Pick<ZoneLayout, 'bedTop'> & Partial<Pick<ZoneLayout, 'rockWalls'>>,
): Point {
  const rockTops = (floor.rockWalls ?? [])
    .filter((wall) => wall.x0 <= exit.x && exit.x <= wall.x1 && wall.y0 > exit.y)
    .map((wall) => wall.y0);
  return { x: exit.x, y: rockTops.length > 0 ? Math.min(...rockTops) : floor.bedTop };
}
