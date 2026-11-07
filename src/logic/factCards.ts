import type { Point, SafeArea } from './zone';

/** A Collection Book fact card. */
export interface FactCard {
  id: string;
  name: string;
  title: string;
  body: string;
  /** Collection Book hint while the card is not found; absent means the habitat rule decides. */
  unfoundHint?: string;
}

/** The tilapia fact card, shown the first time the axolotl meets a tilapia. */
export const TILAPIA_FACT: Readonly<FactCard> = Object.freeze({
  id: 'tilapia',
  name: 'Tilapia',
  title: 'Meet the tilapia',
  body: 'Tilapia are fish that people brought to Xochimilco. They do not belong there. They eat axolotl eggs and food.',
});

/**
 * The boy or girl fact card, always found in the Collection Book (PRD C14).
 * Sources and owner checks: PRD C14 only (ADR 0045).
 */
export const BOY_OR_GIRL_FACT: Readonly<FactCard> = Object.freeze({
  id: 'boyOrGirl',
  name: 'Boy or girl?',
  title: 'Boy or girl?',
  body: 'Grown-up boy axolotls are longer and slimmer, with a bigger bump by the back legs. Girls are rounder and plumper.',
});

/**
 * The plastic worm fact card, shown the first time the axolotl meets a plastic worm (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const PLASTIC_WORM_FACT: Readonly<FactCard> = Object.freeze({
  id: 'plastic-worm',
  name: 'Plastic worm',
  title: 'Plastic is not food',
  body: 'Bits of plastic in the water can look like food. Animals sometimes eat them by mistake, and it makes them feel sick. Keeping rubbish out of the water helps.',
});

/**
 * The heron fact card, shown the first time the axolotl meets a heron (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const HERON_FACT: Readonly<FactCard> = Object.freeze({
  id: 'heron',
  name: 'Heron',
  title: 'Meet the heron',
  body: "Herons are tall birds that live around Xochimilco's canals. They stand very still and watch the water for food. Axolotls are safer down deep, away from the surface.",
});

/**
 * The ghost net fact card, shown the first time the axolotl meets a ghost net (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const GHOST_NET_FACT: Readonly<FactCard> = Object.freeze({
  id: 'ghost-net',
  name: 'Ghost net',
  title: 'Lost fishing nets',
  body: 'Old fishing nets that get lost in the water can tangle up animals. People pull them out of canals and lakes to keep animals safe.',
});

/**
 * The garter snake fact card, shown the first time the axolotl meets a garter snake (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const GARTER_SNAKE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'garter-snake',
  name: 'Garter snake',
  title: 'Meet garter snakes',
  body: 'Garter snakes live near water in Mexico and are good swimmers. They hunt small animals near the surface. Axolotls are safer down deep.',
});

/**
 * The water hyacinth fact card, shown the first time the axolotl meets the hyacinth mats (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const WATER_HYACINTH_FACT: Readonly<FactCard> = Object.freeze({
  id: 'water-hyacinth',
  name: 'Water hyacinth',
  title: 'Water hyacinth',
  body: 'Water hyacinth is a floating plant that grows very fast. In Xochimilco it can cover the canals and block the light. People clear it out to keep the water healthy.',
});

/**
 * The common carp fact card, shown the first time the axolotl meets a carp (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const CARP_FACT: Readonly<FactCard> = Object.freeze({
  id: 'carp',
  name: 'Common carp',
  title: 'Meet the carp',
  body: 'Common carp are big fish that people brought to Xochimilco. They dig in the mud for food and make the water cloudy. They also eat axolotl eggs.',
});

/**
 * The crayfish fact card, shown the first time the axolotl meets a crayfish (PRD C13; issue #77,
 * ND-14).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const CRAYFISH_FACT: Readonly<FactCard> = Object.freeze({
  id: 'crayfish',
  name: 'Crayfish',
  title: 'Meet the crayfish',
  body: 'Crayfish are small cousins of lobsters that walk along the bottom. They open their claws wide to warn other animals. Axolotls stay safe by swimming up and away.',
});

/**
 * The black bass fact card, shown the first time the axolotl meets a black bass (PRD C13; issue
 * #78).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const BLACK_BASS_FACT: Readonly<FactCard> = Object.freeze({
  id: 'black-bass',
  name: 'Black bass',
  title: 'Meet the black bass',
  body: 'Black bass are big fish that people brought to Xochimilco from far away. They hunt fast in open water. Axolotls stay safe by swimming out of the way.',
});

/**
 * The cormorant fact card, shown the first time the axolotl comes within CORMORANT_MEET_RANGE of a
 * cormorant, outside the Home Spot (PRD C13; issue #112, PRD open question 549, ND-6).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const CORMORANT_FACT: Readonly<FactCard> = Object.freeze({
  id: 'cormorant',
  name: 'Cormorant',
  title: 'Meet the cormorant',
  body: 'Cormorants are dark water birds that dive from the surface. They swim underwater by kicking with their feet. Axolotls stay safe by swimming deep or away.',
});

/**
 * The pelican fact card, shown the first time the axolotl comes within PELICAN_MEET_RANGE of a
 * pelican line, outside the Home Spot (PRD C13; issue #211, ND-20).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const PELICAN_FACT: Readonly<FactCard> = Object.freeze({
  id: 'pelican',
  name: 'White pelican',
  title: 'Meet the pelican',
  body: 'Hundreds of white pelicans fly to Xochimilco in winter. They float in a line and dip their bills together to scoop up fish. Axolotls stay safe by swimming down deep.',
});

/**
 * The stalactite fact card, shown the first time the axolotl meets a dripping stalactite (PRD C13;
 * issue #77, ND-3).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const STALACTITE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'stalactite-drip',
  name: 'Stalactite',
  title: 'Stalactites',
  body: 'Stalactites hang from cave roofs like rock icicles. Each drip of water leaves a tiny bit of rock behind, so they grow very slowly.',
});

/**
 * The geyser fact card, shown the first time the axolotl meets a geyser vent (PRD C13; issue #77,
 * ND-3).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const GEYSER_FACT: Readonly<FactCard> = Object.freeze({
  id: 'geyser-vent',
  name: 'Geyser',
  title: 'Geysers',
  body: 'Some geysers are cold. Fizzy gas from deep underground builds up in the water, like in soda, and pushes it out. Then the geyser rests and fills up.',
});

/**
 * The anchor fact card, shown the first time the axolotl meets an anchor drop (PRD C13; issue #194,
 * owner Q1 to Q3 of 2026-11-01).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const ANCHOR_DROP_FACT: Readonly<FactCard> = Object.freeze({
  id: 'anchor-drop',
  name: 'Anchor',
  title: 'Anchors',
  body: 'Boaters lower a heavy anchor on a chain down to the canal bed. It holds the boat still. When it is time to go, they pull it back up.',
});

/**
 * The mud seep fact card, shown the first time the axolotl meets a mud seep (PRD C13; issue #194,
 * owner Q1 to Q3 of 2026-11-01).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const MUD_SEEP_FACT: Readonly<FactCard> = Object.freeze({
  id: 'mud-seep',
  name: 'Mud seep',
  title: 'Mud bubbles',
  body: 'Canal mud is full of tiny living things, too small to see. They break down old leaves and plants and make gas that rises up as bubbles.',
});

/**
 * The underwater springs fact card, shown the first time the axolotl meets a pulsing current (PRD
 * C13; issue #105, the owner's text of 2026-10-22, ND-14).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const UNDERWATER_SPRINGS_FACT: Readonly<FactCard> = Object.freeze({
  id: 'pulsing-current',
  name: 'Underwater springs',
  title: 'Underwater springs',
  body: "Long ago, springs bubbling up from underground filled Xochimilco's canals with clean water. Axolotls need cool, clean water to stay healthy.",
});

/**
 * The dirty water fact card, shown the first time the axolotl's centre enters a murky patch outside
 * the Home Spot (PRD C13; issue #107, ND-1).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const MURKY_WATER_FACT: Readonly<FactCard> = Object.freeze({
  id: 'murky-water',
  name: 'Murky water',
  title: 'Dirty water',
  body: 'When rubbish and dirty water get into the canals, the water turns murky and it is harder for animals to breathe. Keeping the water clean helps axolotls and fish.',
});

/**
 * The fishing lines fact card, shown the first time the axolotl meets a trajinera lure (PRD C13;
 * issue #108).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const LURE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'trajinera-lure',
  name: 'Fishing lines',
  title: 'Fishing lines',
  body: 'People in Xochimilco fish from boats. A worm on a line can be a trap, so look up for the line! Axolotls are protected in Mexico, so people should never fish for them.',
});

/**
 * The fishing nets fact card, shown the first time the axolotl meets a drag net (PRD C13; issue
 * #108).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const DRAG_NET_FACT: Readonly<FactCard> = Object.freeze({
  id: 'drag-net',
  name: 'Fishing nets',
  title: 'Fishing nets',
  body: 'Some fishing nets in Xochimilco catch axolotls by mistake. That is one reason wild axolotls are rare. Safe refuges help them hide.',
});

/**
 * The punting pole fact card, shown the first time the axolotl meets a punting pole (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const PUNTING_POLE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'punting-pole',
  name: 'Punting pole',
  title: 'Trajineras',
  body: 'Trajineras are bright, flat-bottomed boats on the canals of Xochimilco. A boater pushes each one along with a long pole that reaches down to the mud.',
});

/**
 * The tadpole fact card, shown the first time the axolotl meets a tadpole (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const TADPOLE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'tadpole',
  name: 'Tadpole',
  title: 'Meet the tadpole',
  body: 'Tadpoles are baby frogs. They swim by wiggling their tails, and they grow legs as they get bigger. Axolotls hunt small water animals like tadpoles.',
});

/**
 * The freshwater shrimp fact card, shown the first time the axolotl meets a shrimp (PRD C13).
 * Sources and owner checks: PRD C13 only (ADR 0045).
 */
export const SHRIMP_FACT: Readonly<FactCard> = Object.freeze({
  id: 'shrimp',
  name: 'Freshwater shrimp',
  title: 'Freshwater shrimp',
  body: 'Freshwater shrimp are tiny animals with many legs. When something comes near, they flick their tails and zip backward. Axolotls hunt small water animals like these.',
});

/**
 * The axolotl refuges fact card, found on a visit to the refuge (PRD C14).
 * Sources and owner checks: PRD C14 only (ADR 0045).
 */
export const AXOLOTL_REFUGES_FACT: Readonly<FactCard> = Object.freeze({
  id: 'axolotl-refuges',
  name: 'Axolotl refuges',
  title: 'Axolotl refuges',
  body: 'In Xochimilco, people make safe canals for axolotls next to chinampa gardens. Filters of volcanic rock let water in but keep big fish like tilapia out.',
  unfoundHint: 'Visit the refuge to find this card.',
});

/**
 * The canal clean-ups fact card, found on a visit to the refuge once an area is beaten (PRD C14).
 * Sources and owner checks: PRD C14 only (ADR 0045).
 */
export const CANAL_CLEAN_UPS_FACT: Readonly<FactCard> = Object.freeze({
  id: 'canal-clean-ups',
  name: 'Canal clean-ups',
  title: 'Canal clean-ups',
  body: 'People in Xochimilco pull rubbish, like plastic bottles, out of the canals. Keeping the water clean helps keep axolotls safe.',
  unfoundHint: 'Beat an area, then visit the refuge to find this card.',
});

/** The refuge fact cards, in Collection Book order: the axolotl refuges, then the canal clean-ups. */
export const REFUGE_FACT_CARDS: readonly Readonly<FactCard>[] = Object.freeze([AXOLOTL_REFUGES_FACT, CANAL_CLEAN_UPS_FACT]);

/**
 * The refuge fact cards to show now, in REFUGE_FACT_CARDS order: each not yet in `found`, the canal
 * clean-ups card only when `clearedTrashShown` (the refuge shows the trash cleared).
 */
export function refugeFactCardsDue(found: readonly string[], clearedTrashShown: boolean): Readonly<FactCard>[] {
  return REFUGE_FACT_CARDS.filter(
    (card) => !found.includes(card.id) && (clearedTrashShown || card.id !== CANAL_CLEAN_UPS_FACT.id),
  );
}

/** Label of the button that closes a fact card. */
export const FACT_CARD_OK_LABEL = 'OK';

/** Collection Book hint of a fact card not yet found, naming the place to explore. */
export function unfoundFactCardHint(place: string): string {
  return `Explore ${place} to find this card.`;
}

/** Collection Book hint of a fact card not yet found in the canal. */
export const FACT_CARD_UNFOUND_HINT = unfoundFactCardHint('the canal');

/**
 * Centre distance in px within which the axolotl meets a tilapia. Provisional; tune in play.
 * Larger than the tilapia lunge range so the card can show before the first lunge.
 */
export const TILAPIA_MEET_RANGE = 180;

/**
 * Centre distance in px from the heron's position within which the axolotl meets a heron. The heron
 * is always shown (no shadow cycle any more, issue #111). Provisional; tune in play. The same as the
 * tilapia's, and larger than the heron's 110 px reach so the card can show before the first strike.
 */
export const HERON_MEET_RANGE = 180;

/**
 * Centre distance in px from the garter snake's head within which the axolotl meets a garter snake.
 * Provisional; tune in play. The same as the tilapia's and the heron's, and larger than the snake's
 * 110 px lunge range so the card can show before the first dart.
 */
export const GARTER_SNAKE_MEET_RANGE = 180;

/**
 * Centre distance in px within which the axolotl meets a carp (PRD open question 253, ND-6).
 * Provisional; tune in play. The same as the tilapia's, and larger than the carp's 120 px lunge
 * range so the card can show before the first sweep.
 */
export const CARP_MEET_RANGE = 180;

/**
 * Centre distance in px within which the axolotl meets a crayfish (issue #77, ND-14). Provisional;
 * tune in play. The same as the tilapia's, and larger than the crayfish's 90 px lunge range so the
 * card can show before the first pinch.
 */
export const CRAYFISH_MEET_RANGE = 180;

/**
 * Centre distance in px within which the axolotl meets a black bass (issue #78). Provisional; tune in
 * play. The same as the tilapia's, and equal to the bass's 180 px lunge range, so the card shows no
 * later than the first warning.
 */
export const BLACK_BASS_MEET_RANGE = 180;

/**
 * Centre distance in px within which the axolotl meets a cormorant (issue #112, PRD open question
 * 549). Provisional; tune in play. Equal to the cormorant's 180 px lunge range, so the card shows no
 * later than the first warning.
 */
export const CORMORANT_MEET_RANGE = 180;

/**
 * Centre distance in px to a bird of a pelican line within which the axolotl meets the pelicans
 * (issue #211, ND-20). Provisional; tune in play. The same as the cormorant's, so the card can show
 * before the first warning.
 */
export const PELICAN_MEET_RANGE = 180;

/**
 * Distance in px from a pulsing current's band within which the axolotl meets it (issue #105,
 * ND-6). Provisional; tune in play. Short, so the card shows as the axolotl comes up to a vent.
 */
export const PULSING_CURRENT_MEET_RANGE = 60;

/**
 * Distance in px from a murky patch within which the axolotl meets it (issue #107, ND-1): 0, so the
 * card shows when the axolotl's centre first enters a patch.
 */
export const MURKY_WATER_MEET_RANGE = 0;

/**
 * Centre distance in px within which the axolotl meets a trajinera lure (issue #108). Provisional;
 * tune in play.
 */
export const LURE_MEET_RANGE = 120;

/**
 * Centre distance in px within which the axolotl meets a drag net (issue #108). Provisional; tune in
 * play. The same as the tilapia's.
 */
export const DRAG_NET_MEET_RANGE = 180;

/**
 * Centre distance in px from an uncollected tadpole, where it is drawn, within which the axolotl
 * meets a tadpole (PRD open question 276, ND-29). Provisional; tune in play.
 */
export const TADPOLE_MEET_RANGE = 120;

/**
 * Centre distance in px from an uncollected shrimp, where it is drawn, within which the axolotl
 * meets a shrimp (PRD open question 276, ND-29). Provisional; tune in play.
 */
export const SHRIMP_MEET_RANGE = 120;

/**
 * Whether a point lies inside the safe area (inclusive edges). Mirrors zone.ts `inSafeArea` so
 * factCards stays a leaf module with no runtime import: zone.ts loads movingHazards.ts, which
 * reads PUNTING_POLE_FACT from here while this module would still be loading.
 */
function isInSafeArea(point: Point, safeArea: SafeArea): boolean {
  return (
    point.x >= safeArea.x0 && point.x <= safeArea.x1 && point.y >= safeArea.y0 && point.y <= safeArea.y1
  );
}

/**
 * Whether the axolotl at `pos` meets a tilapia: `pos` is outside the safe area (edges count as
 * inside) and some tilapia centre is within `range` (inclusive).
 */
export function meetsTilapia(
  pos: Point,
  tilapias: readonly { pos: Point }[],
  safeArea: SafeArea,
  range = TILAPIA_MEET_RANGE,
): boolean {
  if (isInSafeArea(pos, safeArea)) return false;
  return tilapias.some((tilapia) => Math.hypot(tilapia.pos.x - pos.x, tilapia.pos.y - pos.y) <= range);
}

/**
 * One hazard or predator as the axolotl sees it: its id, its distance in px from the axolotl (as
 * that threat measures it) and the range within which the axolotl meets it.
 */
export interface ThreatSighting {
  id: string;
  distance: number;
  meetRange: number;
}

/**
 * Ids of the threats the axolotl at `pos` meets: none inside the safe area (edges count as inside),
 * else each sighting within its meet range (inclusive), each id once, in sighting order.
 */
export function metThreatIds(pos: Point, safeArea: SafeArea, sightings: readonly ThreatSighting[]): string[] {
  if (isInSafeArea(pos, safeArea)) return [];
  const metIds: string[] = [];
  for (const sighting of sightings) {
    if (sighting.distance <= sighting.meetRange && !metIds.includes(sighting.id)) metIds.push(sighting.id);
  }
  return metIds;
}
