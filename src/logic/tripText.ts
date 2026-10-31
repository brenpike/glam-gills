import { AREA_BEATEN_TITLE, bestStarsLine, starLines, starsShortLine } from './areaText';
import type { AxolotlSex } from './axolotlLook';
import { axolotlPronouns } from './pronouns';
import type { AreaStars } from './stars';

/** Label next to the four leg icons in the legs display. */
export const LEGS_LABEL = 'Legs';

/** Title of the card shown after the axolotl is carried home. */
export const TRIP_END_TITLE = 'Carried home!';

/** Body of the carried-home card: kind, short, and readable by an 8-year-old. */
export const TRIP_END_BODY =
  'A big bubble floated you home. You are safe, and all four legs grew back. ' +
  'All the snacks are back, too.';

/** Button on the tank arrival card that closes it and shows the Home Tank. */
export const ARRIVAL_OK_LABEL = 'OK';

/** Label on the HUD Trip Bag display. */
export const TRIP_BAG_LABEL = 'Trip Bag';

/** Status shown next to a Trip Bag that holds finds. */
export const NOT_SAFE_YET = 'not safe yet';

/** Title of the celebration card shown after banking finds at the Home Spot. */
export const BANKED_TITLE = 'Safe at the Home Spot!';

/** Button on the banking card that goes back to swimming. */
export const KEEP_EXPLORING_LABEL = 'Keep exploring';

/** Button on the banking card that ends the trip at the Home Spot. */
export const GO_HOME_LABEL = 'Go home';

/** Hint that teaches how banking works. */
export const BANKING_HINT = 'Bring finds to the Home Spot to keep them safe.';

/** HUD banner shown once every snack in the area has been eaten, so the exit is open (PRD H2). */
export const ALL_SNACKS_BANNER = 'Yum! That was the last snack. The exit is open!';

/** HUD banner shown when the explorer eats a plastic worm and spits it out (issue #75). */
export const PLASTIC_WORM_BANNER = 'Bleh! That was plastic, not food.';

/** HUD banner shown when a ghost net snags the explorer (issue #76). */
export const GHOST_NET_BANNER = 'Snagged on an old net! Wriggle free.';

/** Title of the card shown after choosing to go home. */
export const WENT_HOME_TITLE = 'Welcome home!';

const EMPTY_BAG_STATUS = 'empty';

const MAX_LISTED_NAMES = 3;

/**
 * Why the tank arrival card is showing: the player chose to go home, a bubble carried them, or they
 * reached the open exit and beat the area.
 */
export type ArrivalReason = 'wentHome' | 'carriedHome' | 'areaBeaten';

/**
 * The stars on the "Area beaten" card: the area's UI label (such as "Area 1"), its special treasure
 * name, the stars earned this trip and the best stars so far (PRD H5 to H7). `rescueOpen` is whether
 * any axolotl is still left to rescue.
 */
export interface ArrivalStars {
  areaLabel: string;
  specialName: string;
  earned: AreaStars;
  best: AreaStars;
  rescueOpen: boolean;
}

/** An axolotl carried in the Trip Bag that swam back to where it was found: its name and sex. */
export interface WaitingAxolotl {
  name: string;
  sex: AxolotlSex;
}

/**
 * Everything the tank arrival card needs to describe how the trip ended. `stars` is read only when
 * the area was beaten.
 */
export interface ArrivalInput {
  reason: ArrivalReason;
  returnedNames: readonly string[];
  bankedThisTripNames: readonly string[];
  bankedTotal: number;
  /** Axolotls banked at the Home Spot this trip; they now live in the Home Tank. */
  rescuedNames?: readonly string[];
  /** Axolotls carried in the Trip Bag that swam back to where they were found. */
  waiting?: readonly WaitingAxolotl[];
  stars?: ArrivalStars;
}

/** Text for the tank arrival card shown in the Home Tank after a trip. */
export interface ArrivalText {
  title: string;
  body: string;
  shortBody: string;
  bankedLine: string;
  button: string;
}

function joinWithAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Lists treasure names, e.g. "Sun hat and Pond plant"; past three it ends "and 2 more". */
export function describeTreasures(names: readonly string[]): string {
  if (names.length === 0) return 'no treasures';
  if (names.length <= MAX_LISTED_NAMES) return joinWithAnd(names);
  const listed = names.slice(0, MAX_LISTED_NAMES).join(', ');
  return `${listed} and ${names.length - MAX_LISTED_NAMES} more`;
}

/** Short Trip Bag status: warns that carried finds are not safe yet. */
export function tripBagStatus(count: number): string {
  return count > 0 ? NOT_SAFE_YET : EMPTY_BAG_STATUS;
}

function bankedTotalLine(total: number): string {
  if (total === 0) return 'No treasures at the Home Spot yet.';
  return `You have ${total} ${total === 1 ? 'treasure' : 'treasures'} safe at the Home Spot.`;
}

/**
 * Body of the banking card: which axolotls and treasures were just banked, then the Home Spot
 * total. Rescued axolotl names come first; the total counts treasures only.
 */
export function bankedBody(
  names: readonly string[],
  total: number,
  rescuedNames: readonly string[] = [],
): string {
  const totalLine = bankedTotalLine(total);
  const banked = [...rescuedNames, ...names];
  if (banked.length === 0) return `Nothing new to bring in. ${totalLine}`;
  const verb = banked.length === 1 ? 'is' : 'are';
  return `${describeTreasures(banked)} ${verb} safe now! ${totalLine}`;
}

/** "Your axolotl friend" for one axolotl, "<count> axolotl friends" for more. */
function axolotlFriends(count: number): string {
  return count === 1 ? 'Your axolotl friend' : `${count} axolotl friends`;
}

function rescuedBankedOpening(rescuedCount: number, count: number): string {
  const friends = axolotlFriends(rescuedCount);
  if (count === 0) return `${friends} ${rescuedCount === 1 ? 'is' : 'are'} safe now!`;
  if (count === 1) return `${friends} and your treasure are safe!`;
  return `${friends} and ${count} treasures are safe!`;
}

/** Short body of the banking card: counts axolotls and treasures instead of naming them. */
export function bankedBodyShort(count: number, total: number, rescuedCount = 0): string {
  const totalLine = bankedTotalLine(total);
  if (rescuedCount > 0) return `${rescuedBankedOpening(rescuedCount, count)} ${totalLine}`;
  if (count === 0) return `Nothing new to bring in. ${totalLine}`;
  if (count === 1) return `Your treasure is safe now! ${totalLine}`;
  return `${count} treasures are safe now! ${totalLine}`;
}

function returnedSentence(returnedNames: readonly string[]): string {
  if (returnedNames.length === 0) return 'Nothing was lost.';
  if (returnedNames.length === 1) {
    return `${returnedNames[0]} floated off to a new hiding spot. Look for it next trip!`;
  }
  return `${describeTreasures(returnedNames)} floated off to new hiding spots. Look for them next trip!`;
}

/** One waiting axolotl reads "him. He's" or "her. She's"; more than one reads "them. They're". */
function waitingSentence(waiting: readonly WaitingAxolotl[]): string {
  if (waiting.length === 1) {
    const { name, sex } = waiting[0];
    const pronouns = axolotlPronouns(sex);
    return `${name} swam back to where you found ${pronouns.object}. ${pronouns.Subject}'s waiting for you!`;
  }
  const names = waiting.map((axolotl) => axolotl.name);
  return `${describeTreasures(names)} swam back to where you found them. They're waiting for you!`;
}

function safeInTankSentence(rescuedNames: readonly string[]): string {
  const verb = rescuedNames.length === 1 ? 'is' : 'are';
  return `${describeTreasures(rescuedNames)} ${verb} safe in your Home Tank.`;
}

function carriedHomeBody(input: ArrivalInput): string {
  const waiting = input.waiting ?? [];
  const rescuedNames = input.rescuedNames ?? [];
  const parts = [TRIP_END_BODY];
  if (input.returnedNames.length > 0 || waiting.length === 0) {
    parts.push(returnedSentence(input.returnedNames));
  }
  if (waiting.length > 0) parts.push(waitingSentence(waiting));
  if (rescuedNames.length > 0) parts.push(safeInTankSentence(rescuedNames));
  parts.push('Treasures at the Home Spot are always safe.');
  return parts.join(' ');
}

function wentHomeBody(input: ArrivalInput): string {
  const rescuedNames = input.rescuedNames ?? [];
  const parts = ['You swam home safe and sound.'];
  if (rescuedNames.length > 0) parts.push(`${describeTreasures(rescuedNames)} moved into your Home Tank!`);
  if (input.bankedThisTripNames.length > 0) {
    parts.push(`This trip you brought home ${describeTreasures(input.bankedThisTripNames)}.`);
  }
  return parts.join(' ');
}

const CARRIED_HOME_SHORT_OPENING = 'A big bubble floated you home. You are safe!';

const WENT_HOME_SHORT_OPENING = 'You swam home safe and sound.';

function returnedShortSentence(returnedCount: number): string {
  if (returnedCount === 0) return 'Nothing was lost.';
  if (returnedCount === 1) return 'Your treasure floated off. Look for it next trip!';
  return `${returnedCount} treasures floated off. Look for them next trip!`;
}

/**
 * Short carried-home body. With an axolotl to tell about, the axolotl sentences replace the
 * treasure sentence so the short wording stays short.
 */
function carriedHomeShortBody(input: ArrivalInput): string {
  const waitingCount = input.waiting?.length ?? 0;
  const rescuedCount = input.rescuedNames?.length ?? 0;
  const parts = [CARRIED_HOME_SHORT_OPENING];
  if (waitingCount === 0 && rescuedCount === 0) parts.push(returnedShortSentence(input.returnedNames.length));
  if (waitingCount > 0) {
    parts.push(`${axolotlFriends(waitingCount)} ${waitingCount === 1 ? 'is' : 'are'} waiting for you!`);
  }
  if (rescuedCount > 0) {
    parts.push(`${axolotlFriends(rescuedCount)} ${rescuedCount === 1 ? 'is' : 'are'} safe in your Home Tank.`);
  }
  return parts.join(' ');
}

/**
 * Short went-home body. With a rescued axolotl, its sentence replaces the treasure count so the
 * short wording stays short.
 */
function wentHomeShortBody(input: ArrivalInput): string {
  const bankedCount = input.bankedThisTripNames.length;
  const rescuedCount = input.rescuedNames?.length ?? 0;
  if (rescuedCount > 0) return `${WENT_HOME_SHORT_OPENING} ${axolotlFriends(rescuedCount)} moved into your Home Tank!`;
  if (bankedCount === 0) return WENT_HOME_SHORT_OPENING;
  if (bankedCount === 1) return `${WENT_HOME_SHORT_OPENING} You brought home 1 treasure.`;
  return `${WENT_HOME_SHORT_OPENING} You brought home ${bankedCount} treasures.`;
}

const AREA_BEATEN_OPENING = 'You swam through the open exit!';

/**
 * First line of the "Area beaten" card: the exit, then the treasures banked this trip, or an axolotl
 * rescued this trip with any treasures after it, such as "You swam through the open exit! You brought
 * Wild axolotl to your Home Tank, plus Sun hat."
 */
function areaBeatenBroughtLine(rescuedNames: readonly string[], bankedThisTripNames: readonly string[]): string {
  if (rescuedNames.length === 0) {
    if (bankedThisTripNames.length === 0) return AREA_BEATEN_OPENING;
    return `${AREA_BEATEN_OPENING} This trip you brought home ${describeTreasures(bankedThisTripNames)}.`;
  }
  const toTank = `${AREA_BEATEN_OPENING} You brought ${describeTreasures(rescuedNames)} to your Home Tank`;
  if (bankedThisTripNames.length === 0) return `${toTank}.`;
  return `${toTank}, plus ${describeTreasures(bankedThisTripNames)}.`;
}

/**
 * Body of the "Area beaten" card: the exit, what was brought home (a rescued axolotl first), then
 * one line per star and the best stars.
 */
function areaBeatenBody(input: ArrivalInput): string {
  const rescuedNames = input.rescuedNames ?? [];
  const brought = areaBeatenBroughtLine(rescuedNames, input.bankedThisTripNames);
  const { stars } = input;
  if (stars === undefined) return brought;
  const lines = [
    ...starLines(stars.earned, stars.specialName, rescuedNames.length > 0, stars.rescueOpen),
    bestStarsLine(stars.areaLabel, stars.best),
  ];
  return [brought, ...lines].join('\n');
}

/** Text for the "Area beaten" card (PRD H5): the short body is one line of stars earned and best. */
function areaBeatenText(input: ArrivalInput): ArrivalText {
  const { stars } = input;
  return {
    title: AREA_BEATEN_TITLE,
    body: areaBeatenBody(input),
    shortBody: stars === undefined ? AREA_BEATEN_OPENING : starsShortLine(stars.earned, stars.best),
    bankedLine: bankedTotalLine(input.bankedTotal),
    button: ARRIVAL_OK_LABEL,
  };
}

/**
 * Builds the tank arrival card text for going home, being carried home or beating the area. A beaten
 * area names the treasures banked this trip, as going home does.
 */
export function arrivalText(input: ArrivalInput): ArrivalText {
  if (input.reason === 'areaBeaten') return areaBeatenText(input);
  const isCarried = input.reason === 'carriedHome';
  return {
    title: isCarried ? TRIP_END_TITLE : WENT_HOME_TITLE,
    body: isCarried ? carriedHomeBody(input) : wentHomeBody(input),
    shortBody: isCarried ? carriedHomeShortBody(input) : wentHomeShortBody(input),
    bankedLine: bankedTotalLine(input.bankedTotal),
    button: ARRIVAL_OK_LABEL,
  };
}
