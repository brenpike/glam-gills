/**
 * Area, exit and star text (PRD H1 to H8): kind, short, and readable by an 8-year-old. Areas are
 * named "Area 1" in UI text, never "level"; a habitat's areas read "Areas 2 and 3" (issue #113).
 */
import { STARS_PER_AREA, starCount, type AreaStars } from './stars';

/** Title of the card shown when the open exit is reached (PRD H5). */
export const AREA_BEATEN_TITLE = 'Area beaten!';

/** Title of the area map (art guide section 8, "Area map" row). */
export const AREA_MAP_TITLE = 'Where to?';

/** Tag on a newly unlocked area on the area map. */
export const NEW_AREA_LABEL = 'New!';

/** Locked-area line (art guide section 8): names the area to beat, which is the one before. */
export function lockedAreaText(areaNumber: number): string {
  if (!Number.isInteger(areaNumber) || areaNumber < 2) {
    throw new RangeError(`lockedAreaText needs an integer area number of 2 or more, got ${areaNumber}`);
  }
  return `Beat ${areaLabel(areaNumber - 1)} to unlock!`;
}

/** Stars count for a screen reader or aria-like label, such as "2 of 3 stars". */
export function areaStarsText(count: number): string {
  if (!Number.isInteger(count) || count < 0 || count > STARS_PER_AREA) {
    throw new RangeError(`areaStarsText needs an integer from 0 to ${STARS_PER_AREA}, got ${count}`);
  }
  return `${count} of ${STARS_PER_AREA} stars`;
}

/** UI name of area `areaNumber`, such as "Area 1". */
export function areaLabel(areaNumber: number): string {
  return `Area ${areaNumber}`;
}

/** Throws a RangeError unless `numbers` holds at least one area number, each an integer of 1 or more, none twice. */
function checkAreaNumbers(numbers: readonly number[]): void {
  if (numbers.length === 0) throw new RangeError('areasLine needs at least one area number');
  for (const areaNumber of numbers) {
    if (!Number.isInteger(areaNumber) || areaNumber < 1) {
      throw new RangeError(`areasLine needs integer area numbers of 1 or more, got ${areaNumber}`);
    }
  }
  if (new Set(numbers).size !== numbers.length) throw new RangeError(`areasLine got an area number twice: ${numbers.join(', ')}`);
}

/** Whether ascending `sorted` steps by exactly 1 from each number to the next. */
function isConsecutive(sorted: readonly number[]): boolean {
  return sorted.every((areaNumber, index) => index === 0 || areaNumber === sorted[index - 1] + 1);
}

/**
 * The areas a habitat holds (issue #113, ND-6), in ascending order: "Area 1" for one, "Areas 2 and 3"
 * for two, "Areas 5 to 7" for three or more consecutive, else "Areas 1, 3 and 8". Throws a
 * RangeError for an empty list, a number that is not an integer of 1 or more, or a duplicate.
 */
export function areasLine(numbers: readonly number[]): string {
  checkAreaNumbers(numbers);
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length === 1) return areaLabel(sorted[0]);
  const last = sorted[sorted.length - 1];
  if (sorted.length >= 3 && isConsecutive(sorted)) return `Areas ${sorted[0]} to ${last}`;
  return `Areas ${sorted.slice(0, -1).join(', ')} and ${last}`;
}

/**
 * A habitat's area map label (issue #113, ND-6): its name and the areas it holds, such as
 * "Lily pad pond: Areas 2 and 3". Throws as areasLine does.
 */
export function habitatAreasLabel(habitatName: string, numbers: readonly number[]): string {
  return `${habitatName}: ${areasLine(numbers)}`;
}

/** Snack counter label: the snacks left, such as "5 left". */
export function snacksLeftLabel(left: number): string {
  return `${left} left`;
}

/** "1 snack" or "N snacks". */
function snacksPhrase(count: number): string {
  return count === 1 ? '1 snack' : `${count} snacks`;
}

/** Said when the axolotl reaches the closed exit, with the snacks still left (PRD H2). */
export function exitClosedText(left: number): string {
  return `Eat every snack to open the exit! ${snacksPhrase(left)} left.`;
}

/**
 * Star 3 line (PRD H6): praises the rescue when an axolotl was rescued this trip, otherwise the
 * legs kept. A missing star 3 asks for a rescue only while there is still an axolotl to rescue.
 */
function legsOrRescueLine(earned: boolean, rescued: boolean, rescueOpen: boolean): string {
  if (earned) return rescued ? 'You rescued an axolotl friend!' : 'You kept all four legs!';
  return rescueOpen ? 'Rescue or keep every leg next time.' : 'Keep all four legs next time.';
}

/**
 * One short line per star on the "Area beaten" card, in star order: what was earned, or a kind
 * "next time" for a star still missing. `rescued` is whether an axolotl was rescued this trip;
 * `rescueOpen` is whether any axolotl is still left to rescue.
 */
export function starLines(
  earned: AreaStars,
  specialName: string,
  rescued: boolean,
  rescueOpen: boolean,
): readonly [string, string, string] {
  return [
    earned.exit ? 'You reached the exit!' : 'Reach the exit next time.',
    earned.special ? `You found the ${specialName}!` : `Find the ${specialName} next time.`,
    legsOrRescueLine(earned.legsOrRescue, rescued, rescueOpen),
  ];
}

/** "N of 3 stars". */
function ofStars(stars: AreaStars): string {
  return `${starCount(stars)} of ${STARS_PER_AREA}`;
}

/** The best stars for an area, such as "Area 1: 2 of 3 stars". */
export function bestStarsLine(label: string, best: AreaStars): string {
  return `${label}: ${ofStars(best)} stars`;
}

/** Stars earned this trip and the best so far, such as "2 of 3 stars! Best: 3 of 3." */
export function starsShortLine(earned: AreaStars, best: AreaStars): string {
  return `${ofStars(earned)} stars! Best: ${ofStars(best)}.`;
}
