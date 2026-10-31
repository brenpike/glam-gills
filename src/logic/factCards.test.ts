import { describe, expect, it } from 'vitest';
import {
  AXOLOTL_REFUGES_FACT,
  BLACK_BASS_FACT,
  BLACK_BASS_MEET_RANGE,
  BOY_OR_GIRL_FACT,
  CANAL_CLEAN_UPS_FACT,
  CARP_FACT,
  CARP_MEET_RANGE,
  CRAYFISH_FACT,
  CRAYFISH_MEET_RANGE,
  FACT_CARD_OK_LABEL,
  FACT_CARD_UNFOUND_HINT,
  GARTER_SNAKE_FACT,
  GARTER_SNAKE_MEET_RANGE,
  GEYSER_FACT,
  GHOST_NET_FACT,
  HERON_FACT,
  HERON_MEET_RANGE,
  PLASTIC_WORM_FACT,
  PUNTING_POLE_FACT,
  REFUGE_FACT_CARDS,
  SHRIMP_FACT,
  SHRIMP_MEET_RANGE,
  STALACTITE_FACT,
  TADPOLE_FACT,
  TADPOLE_MEET_RANGE,
  TILAPIA_FACT,
  TILAPIA_MEET_RANGE,
  WATER_HYACINTH_FACT,
  meetsTilapia,
  metThreatIds,
  refugeFactCardsDue,
  unfoundFactCardHint,
  type ThreatSighting,
} from './factCards';
import { BLACK_BASS, CARP, CRAYFISH, GARTER_SNAKE, GHOST_NETS, HERON, HYACINTH_MATS, PUNTING_POLES, TILAPIA } from './tuning';
import type { SafeArea } from './zone';

const BANNED = [
  'die',
  'dead',
  'death',
  'killed',
  'game over',
  'level',
  'fish tank',
  'fail',
  'injury',
  'wound',
  'damage',
  'monster',
  'loot',
  'inventory',
];

const SAFE_AREA: SafeArea = { x0: 0, x1: 100, y0: 0, y1: 100 };

function findBannedWords(text: string): string[] {
  return BANNED.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(text));
}

describe('tilapia fact card copy', () => {
  it('has the tilapia id, name and title', () => {
    expect(TILAPIA_FACT.id).toBe('tilapia');
    expect(TILAPIA_FACT.name).toBe('Tilapia');
    expect(TILAPIA_FACT.title).toBe('Meet the tilapia');
  });

  it('keeps the body non-empty and at most 120 characters', () => {
    expect(TILAPIA_FACT.body.length).toBeGreaterThan(0);
    expect(TILAPIA_FACT.body.length).toBeLessThanOrEqual(120);
  });

  it.each([
    TILAPIA_FACT.name,
    TILAPIA_FACT.title,
    TILAPIA_FACT.body,
    FACT_CARD_OK_LABEL,
    FACT_CARD_UNFOUND_HINT,
  ])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });
});

describe('boy or girl fact card copy', () => {
  it('has the boyOrGirl id, name, title and body', () => {
    expect(BOY_OR_GIRL_FACT.id).toBe('boyOrGirl');
    expect(BOY_OR_GIRL_FACT.name).toBe('Boy or girl?');
    expect(BOY_OR_GIRL_FACT.title).toBe('Boy or girl?');
    expect(BOY_OR_GIRL_FACT.body).toBe(
      'Grown-up boy axolotls are longer and slimmer, with a bigger bump by the back legs. Girls are rounder and plumper.',
    );
  });

  it('keeps the body non-empty and at most 120 characters', () => {
    expect(BOY_OR_GIRL_FACT.body.length).toBeGreaterThan(0);
    expect(BOY_OR_GIRL_FACT.body.length).toBeLessThanOrEqual(120);
  });

  it('has an id apart from the tilapia card', () => {
    expect(BOY_OR_GIRL_FACT.id).not.toBe(TILAPIA_FACT.id);
  });

  it.each([BOY_OR_GIRL_FACT.name, BOY_OR_GIRL_FACT.title, BOY_OR_GIRL_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });
});

describe('plastic worm fact card copy', () => {
  it('has the plastic-worm id, name, title and body', () => {
    expect(PLASTIC_WORM_FACT).toEqual({
      id: 'plastic-worm',
      name: 'Plastic worm',
      title: 'Plastic is not food',
      body: 'Bits of plastic in the water can look like food. Animals sometimes eat them by mistake, and it makes them feel sick. Keeping rubbish out of the water helps.',
    });
  });

  it('has an id apart from the other cards', () => {
    expect(PLASTIC_WORM_FACT.id).not.toBe(TILAPIA_FACT.id);
    expect(PLASTIC_WORM_FACT.id).not.toBe(BOY_OR_GIRL_FACT.id);
  });

  it.each([PLASTIC_WORM_FACT.name, PLASTIC_WORM_FACT.title, PLASTIC_WORM_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });
});

describe('heron fact card copy', () => {
  it('has the heron id, name, title and body', () => {
    expect(HERON_FACT).toEqual({
      id: 'heron',
      name: 'Heron',
      title: 'Meet the heron',
      body: "Herons are tall birds that live around Xochimilco's canals. They stand very still and watch the water for food. Axolotls are safer down deep, away from the surface.",
    });
  });

  it('has an id apart from the other cards', () => {
    expect([TILAPIA_FACT.id, BOY_OR_GIRL_FACT.id, PLASTIC_WORM_FACT.id]).not.toContain(HERON_FACT.id);
  });

  it.each([HERON_FACT.name, HERON_FACT.title, HERON_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it('uses a meet range larger than the heron reach band', () => {
    expect(HERON_MEET_RANGE).toBeGreaterThan(HERON.lungeRange);
  });
});

describe('ghost net fact card copy', () => {
  it('has the ghost-net id, name, title and body, and no hint of its own', () => {
    expect(GHOST_NET_FACT).toEqual({
      id: 'ghost-net',
      name: 'Ghost net',
      title: 'Lost fishing nets',
      body: 'Old fishing nets that get lost in the water can tangle up animals. People pull them out of canals and lakes to keep animals safe.',
    });
    expect(GHOST_NET_FACT.unfoundHint).toBeUndefined();
  });

  it('has an id apart from the other cards', () => {
    const others = [
      TILAPIA_FACT.id,
      BOY_OR_GIRL_FACT.id,
      PLASTIC_WORM_FACT.id,
      HERON_FACT.id,
      ...REFUGE_FACT_CARDS.map((card) => card.id),
    ];
    expect(others).not.toContain(GHOST_NET_FACT.id);
  });

  it.each([GHOST_NET_FACT.name, GHOST_NET_FACT.title, GHOST_NET_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it('never says an animal is trapped or hurt', () => {
    const lower = GHOST_NET_FACT.body.toLowerCase();
    expect(lower).not.toContain('trap');
    expect(lower).not.toContain('hurt');
  });

  it('uses a meet range larger than the snag reach', () => {
    expect(GHOST_NETS.meetRange).toBeGreaterThan(GHOST_NETS.reach);
  });
});

describe('garter snake fact card copy', () => {
  it('has the garter-snake id, name, title and body, and no hint of its own', () => {
    expect(GARTER_SNAKE_FACT).toEqual({
      id: 'garter-snake',
      name: 'Garter snake',
      title: 'Meet garter snakes',
      body: 'Garter snakes live near water in Mexico and are good swimmers. They hunt small animals near the surface. Axolotls are safer down deep.',
    });
    expect(GARTER_SNAKE_FACT.unfoundHint).toBeUndefined();
  });

  it('has an id apart from the other cards', () => {
    const others = [
      TILAPIA_FACT.id,
      BOY_OR_GIRL_FACT.id,
      PLASTIC_WORM_FACT.id,
      HERON_FACT.id,
      GHOST_NET_FACT.id,
      WATER_HYACINTH_FACT.id,
      ...REFUGE_FACT_CARDS.map((card) => card.id),
    ];
    expect(others).not.toContain(GARTER_SNAKE_FACT.id);
  });

  it.each([GARTER_SNAKE_FACT.name, GARTER_SNAKE_FACT.title, GARTER_SNAKE_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it('uses a meet range of 180 px, larger than the lunge range', () => {
    expect(GARTER_SNAKE_MEET_RANGE).toBe(180);
    expect(GARTER_SNAKE_MEET_RANGE).toBeGreaterThan(GARTER_SNAKE.lungeRange);
  });
});

describe('water hyacinth fact card copy', () => {
  it('has the water-hyacinth id, name, title and body, and no hint of its own', () => {
    expect(WATER_HYACINTH_FACT).toEqual({
      id: 'water-hyacinth',
      name: 'Water hyacinth',
      title: 'Water hyacinth',
      body: 'Water hyacinth is a floating plant that grows very fast. In Xochimilco it can cover the canals and block the light. People clear it out to keep the water healthy.',
    });
    expect(WATER_HYACINTH_FACT.unfoundHint).toBeUndefined();
  });

  it('has an id apart from the other cards', () => {
    const others = [
      TILAPIA_FACT.id,
      BOY_OR_GIRL_FACT.id,
      PLASTIC_WORM_FACT.id,
      HERON_FACT.id,
      GHOST_NET_FACT.id,
      ...REFUGE_FACT_CARDS.map((card) => card.id),
    ];
    expect(others).not.toContain(WATER_HYACINTH_FACT.id);
  });

  it.each([WATER_HYACINTH_FACT.name, WATER_HYACINTH_FACT.title, WATER_HYACINTH_FACT.body])(
    '"%s" avoids banned words',
    (text) => {
      expect(findBannedWords(text)).toEqual([]);
    },
  );

  it('uses a meet range larger than the body grow', () => {
    expect(HYACINTH_MATS.meetRange).toBeGreaterThan(HYACINTH_MATS.bodyGrow);
  });
});

const EARLIER_CARD_IDS = [
  TILAPIA_FACT.id,
  BOY_OR_GIRL_FACT.id,
  PLASTIC_WORM_FACT.id,
  HERON_FACT.id,
  GHOST_NET_FACT.id,
  GARTER_SNAKE_FACT.id,
  WATER_HYACINTH_FACT.id,
  ...REFUGE_FACT_CARDS.map((card) => card.id),
];

describe('carp fact card copy', () => {
  it('has the carp id, name, title and body, and no hint of its own', () => {
    expect(CARP_FACT).toEqual({
      id: 'carp',
      name: 'Common carp',
      title: 'Meet the carp',
      body: 'Common carp are big fish that people brought to Xochimilco. They dig in the mud for food and make the water cloudy. They also eat axolotl eggs.',
    });
    expect(CARP_FACT.unfoundHint).toBeUndefined();
  });

  it('has an id apart from the other cards', () => {
    expect(EARLIER_CARD_IDS).not.toContain(CARP_FACT.id);
  });

  it.each([CARP_FACT.name, CARP_FACT.title, CARP_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it('uses a meet range of 180 px, larger than the lunge range', () => {
    expect(CARP_MEET_RANGE).toBe(180);
    expect(CARP_MEET_RANGE).toBeGreaterThan(CARP.lungeRange);
  });
});

describe('punting pole fact card copy', () => {
  it('has the punting-pole id, name, title and body, and no hint of its own', () => {
    expect(PUNTING_POLE_FACT).toEqual({
      id: 'punting-pole',
      name: 'Punting pole',
      title: 'Trajineras',
      body: 'Trajineras are bright, flat-bottomed boats on the canals of Xochimilco. A boater pushes each one along with a long pole that reaches down to the mud.',
    });
    expect(PUNTING_POLE_FACT.unfoundHint).toBeUndefined();
  });

  it('has an id apart from the other cards', () => {
    expect([...EARLIER_CARD_IDS, CARP_FACT.id]).not.toContain(PUNTING_POLE_FACT.id);
  });

  it.each([PUNTING_POLE_FACT.name, PUNTING_POLE_FACT.title, PUNTING_POLE_FACT.body])(
    '"%s" avoids banned words',
    (text) => {
      expect(findBannedWords(text)).toEqual([]);
    },
  );

  it('uses a meet range of 180 px, larger than the touch reach', () => {
    expect(PUNTING_POLES.meetRange).toBe(180);
    expect(PUNTING_POLES.meetRange).toBeGreaterThan(PUNTING_POLES.halfWidth + PUNTING_POLES.touchReach);
  });
});

describe('tadpole fact card copy', () => {
  it('has the tadpole id, name, title and body, and no hint of its own', () => {
    expect(TADPOLE_FACT).toEqual({
      id: 'tadpole',
      name: 'Tadpole',
      title: 'Meet the tadpole',
      body: 'Tadpoles are baby frogs. They swim by wiggling their tails, and they grow legs as they get bigger. Axolotls hunt small water animals like tadpoles.',
    });
    expect(TADPOLE_FACT.unfoundHint).toBeUndefined();
  });

  it('has an id apart from the other cards', () => {
    expect([...EARLIER_CARD_IDS, CARP_FACT.id, PUNTING_POLE_FACT.id]).not.toContain(TADPOLE_FACT.id);
  });

  it.each([TADPOLE_FACT.name, TADPOLE_FACT.title, TADPOLE_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it('uses a meet range of 120 px', () => {
    expect(TADPOLE_MEET_RANGE).toBe(120);
  });
});

describe('shrimp fact card copy', () => {
  it('has the shrimp id, name, title and body, and no hint of its own', () => {
    expect(SHRIMP_FACT).toEqual({
      id: 'shrimp',
      name: 'Freshwater shrimp',
      title: 'Freshwater shrimp',
      body: 'Freshwater shrimp are tiny animals with many legs. When something comes near, they flick their tails and zip backward. Axolotls hunt small water animals like these.',
    });
    expect(SHRIMP_FACT.unfoundHint).toBeUndefined();
  });

  it('has an id apart from the other cards', () => {
    expect([...EARLIER_CARD_IDS, CARP_FACT.id, PUNTING_POLE_FACT.id, TADPOLE_FACT.id]).not.toContain(SHRIMP_FACT.id);
  });

  it.each([SHRIMP_FACT.name, SHRIMP_FACT.title, SHRIMP_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it('uses a meet range of 120 px', () => {
    expect(SHRIMP_MEET_RANGE).toBe(120);
  });
});

describe('crayfish fact card copy (issue #77, ND-14)', () => {
  it("has the crayfish id, name and title, the owner's body, and no hint of its own", () => {
    expect(CRAYFISH_FACT).toEqual({
      id: 'crayfish',
      name: 'Crayfish',
      title: 'Meet the crayfish',
      body: 'Crayfish are small cousins of lobsters that walk along the bottom. They open their claws wide to warn other animals. Axolotls stay safe by swimming up and away.',
    });
    expect(CRAYFISH_FACT.unfoundHint).toBeUndefined();
    expect(Object.isFrozen(CRAYFISH_FACT)).toBe(true);
  });

  it('has an id apart from the other cards', () => {
    expect([...EARLIER_CARD_IDS, CARP_FACT.id, PUNTING_POLE_FACT.id, TADPOLE_FACT.id, SHRIMP_FACT.id]).not.toContain(
      CRAYFISH_FACT.id,
    );
  });

  it.each([CRAYFISH_FACT.name, CRAYFISH_FACT.title, CRAYFISH_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it('uses a meet range of 180 px, larger than the lunge range', () => {
    expect(CRAYFISH_MEET_RANGE).toBe(180);
    expect(CRAYFISH_MEET_RANGE).toBeGreaterThan(CRAYFISH.lungeRange);
  });
});

describe('stalactite and geyser fact card copy (issue #77, ND-3, option B)', () => {
  it('has the stalactite id, name, title and body, and no hint of its own', () => {
    expect(STALACTITE_FACT).toEqual({
      id: 'stalactite-drip',
      name: 'Stalactite',
      title: 'Stalactites',
      body: 'Stalactites hang from cave roofs like rock icicles. Each drip of water leaves a tiny bit of rock behind, so they grow very slowly.',
    });
    expect(STALACTITE_FACT.unfoundHint).toBeUndefined();
    expect(Object.isFrozen(STALACTITE_FACT)).toBe(true);
  });

  it('has the geyser id, name, title and body, and no hint of its own', () => {
    expect(GEYSER_FACT).toEqual({
      id: 'geyser-vent',
      name: 'Geyser',
      title: 'Geysers',
      body: 'Some geysers are cold. Fizzy gas from deep underground builds up in the water, like in soda, and pushes it out. Then the geyser rests and fills up.',
    });
    expect(GEYSER_FACT.unfoundHint).toBeUndefined();
    expect(Object.isFrozen(GEYSER_FACT)).toBe(true);
  });

  it('has ids apart from the other cards and from each other', () => {
    const others = [...EARLIER_CARD_IDS, CARP_FACT.id, PUNTING_POLE_FACT.id, TADPOLE_FACT.id, SHRIMP_FACT.id, CRAYFISH_FACT.id];
    expect(others).not.toContain(STALACTITE_FACT.id);
    expect(others).not.toContain(GEYSER_FACT.id);
    expect(STALACTITE_FACT.id).not.toBe(GEYSER_FACT.id);
  });

  it.each([STALACTITE_FACT, GEYSER_FACT].flatMap((card) => [card.name, card.title, card.body]))('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });
});

describe('black bass fact card copy (issue #78)', () => {
  it("has the black-bass id and name, the owner's title and body, and no hint of its own", () => {
    expect(BLACK_BASS_FACT).toEqual({
      id: 'black-bass',
      name: 'Black bass',
      title: 'Meet the black bass',
      body: 'Black bass are big fish that people brought to Xochimilco from far away. They hunt fast in open water. Axolotls stay safe by swimming out of the way.',
    });
    expect(BLACK_BASS_FACT.unfoundHint).toBeUndefined();
    expect(Object.isFrozen(BLACK_BASS_FACT)).toBe(true);
  });

  it('has an id apart from the other cards', () => {
    const others = [
      ...EARLIER_CARD_IDS,
      CARP_FACT.id,
      PUNTING_POLE_FACT.id,
      TADPOLE_FACT.id,
      SHRIMP_FACT.id,
      CRAYFISH_FACT.id,
      STALACTITE_FACT.id,
      GEYSER_FACT.id,
      ...REFUGE_FACT_CARDS.map((card) => card.id),
    ];
    expect(others).not.toContain(BLACK_BASS_FACT.id);
  });

  it.each([BLACK_BASS_FACT.name, BLACK_BASS_FACT.title, BLACK_BASS_FACT.body])('"%s" avoids banned words', (text) => {
    expect(findBannedWords(text)).toEqual([]);
  });

  it('uses a meet range of 180 px, no less than the lunge range', () => {
    expect(BLACK_BASS_MEET_RANGE).toBe(180);
    expect(BLACK_BASS_MEET_RANGE).toBeGreaterThanOrEqual(BLACK_BASS.lungeRange);
  });
});

describe('refuge fact card copy', () => {
  it('has the axolotl-refuges id, name, title, body and hint', () => {
    expect(AXOLOTL_REFUGES_FACT).toEqual({
      id: 'axolotl-refuges',
      name: 'Axolotl refuges',
      title: 'Axolotl refuges',
      body: 'In Xochimilco, people make safe canals for axolotls next to chinampa gardens. Filters of volcanic rock let water in but keep big fish like tilapia out.',
      unfoundHint: 'Visit the refuge to find this card.',
    });
  });

  it('has the canal-clean-ups id, name, title, body and hint', () => {
    expect(CANAL_CLEAN_UPS_FACT).toEqual({
      id: 'canal-clean-ups',
      name: 'Canal clean-ups',
      title: 'Canal clean-ups',
      body: 'People in Xochimilco pull rubbish, like plastic bottles, out of the canals. Keeping the water clean helps keep axolotls safe.',
      unfoundHint: 'Beat an area, then visit the refuge to find this card.',
    });
  });

  it('lists the axolotl refuges card, then the canal clean-ups card', () => {
    expect(REFUGE_FACT_CARDS).toEqual([AXOLOTL_REFUGES_FACT, CANAL_CLEAN_UPS_FACT]);
  });

  it('has ids apart from every other card', () => {
    const others = [TILAPIA_FACT.id, BOY_OR_GIRL_FACT.id, PLASTIC_WORM_FACT.id, HERON_FACT.id];
    for (const card of REFUGE_FACT_CARDS) expect(others).not.toContain(card.id);
    expect(AXOLOTL_REFUGES_FACT.id).not.toBe(CANAL_CLEAN_UPS_FACT.id);
  });

  it.each(REFUGE_FACT_CARDS.flatMap((card) => [card.name, card.title, card.body, card.unfoundHint ?? '']))(
    '"%s" avoids banned words',
    (text) => {
      expect(findBannedWords(text)).toEqual([]);
    },
  );
});

describe('refugeFactCardsDue', () => {
  it('gives the axolotl refuges card alone before the trash shows cleared', () => {
    expect(refugeFactCardsDue([], false)).toEqual([AXOLOTL_REFUGES_FACT]);
  });

  it('gives both refuge cards, refuges first, once the trash shows cleared', () => {
    expect(refugeFactCardsDue([], true)).toEqual([AXOLOTL_REFUGES_FACT, CANAL_CLEAN_UPS_FACT]);
  });

  it('leaves out cards already found', () => {
    expect(refugeFactCardsDue(['axolotl-refuges'], true)).toEqual([CANAL_CLEAN_UPS_FACT]);
    expect(refugeFactCardsDue(['axolotl-refuges'], false)).toEqual([]);
    expect(refugeFactCardsDue(['canal-clean-ups', 'tilapia'], true)).toEqual([AXOLOTL_REFUGES_FACT]);
    expect(refugeFactCardsDue(['axolotl-refuges', 'canal-clean-ups'], true)).toEqual([]);
  });
});

describe('unfound fact card hint', () => {
  it('keeps the canal hint unchanged', () => {
    expect(FACT_CARD_UNFOUND_HINT).toBe('Explore the canal to find this card.');
  });

  it('names the place to explore', () => {
    expect(unfoundFactCardHint('the lily pad pond')).toBe('Explore the lily pad pond to find this card.');
  });
});

describe('meetsTilapia', () => {
  it('uses a meet range larger than the lunge range', () => {
    expect(TILAPIA_MEET_RANGE).toBeGreaterThan(TILAPIA.lungeRange);
  });

  it('is true when a tilapia is at exactly the meet range', () => {
    const pos = { x: 200, y: 50 };
    const tilapias = [{ pos: { x: 200 + TILAPIA_MEET_RANGE, y: 50 } }];
    expect(meetsTilapia(pos, tilapias, SAFE_AREA)).toBe(true);
  });

  it('is false when the nearest tilapia is just past the meet range', () => {
    const pos = { x: 200, y: 50 };
    const tilapias = [{ pos: { x: 200 + TILAPIA_MEET_RANGE + 0.001, y: 50 } }];
    expect(meetsTilapia(pos, tilapias, SAFE_AREA)).toBe(false);
  });

  it('is false inside the safe area, edges included, even with a tilapia in range', () => {
    for (const pos of [
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]) {
      const tilapias = [{ pos: { x: pos.x + 10, y: pos.y } }];
      expect(meetsTilapia(pos, tilapias, SAFE_AREA)).toBe(false);
    }
  });

  it('is true when any one of several tilapias is in range', () => {
    const pos = { x: 400, y: 50 };
    const tilapias = [{ pos: { x: 2000, y: 50 } }, { pos: { x: 400, y: 50 + TILAPIA_MEET_RANGE / 2 } }];
    expect(meetsTilapia(pos, tilapias, SAFE_AREA)).toBe(true);
  });

  it('is false with no tilapias', () => {
    expect(meetsTilapia({ x: 400, y: 50 }, [], SAFE_AREA)).toBe(false);
  });

  it('honours a custom range', () => {
    const pos = { x: 200, y: 50 };
    const tilapias = [{ pos: { x: 250, y: 50 } }];
    expect(meetsTilapia(pos, tilapias, SAFE_AREA, 50)).toBe(true);
    expect(meetsTilapia(pos, tilapias, SAFE_AREA, 49)).toBe(false);
  });
});

describe('metThreatIds', () => {
  const pos = { x: 200, y: 50 };

  it('gives the ids of the sightings within their meet range (inclusive), in sighting order', () => {
    const sightings: ThreatSighting[] = [
      { id: 'test-mud', distance: 60, meetRange: 60 },
      { id: 'test-far', distance: 60.001, meetRange: 60 },
      { id: 'tilapia', distance: 10, meetRange: TILAPIA_MEET_RANGE },
    ];
    expect(metThreatIds(pos, SAFE_AREA, sightings)).toEqual(['test-mud', 'tilapia']);
  });

  it('gives each id once', () => {
    const sightings: ThreatSighting[] = [
      { id: 'tilapia', distance: 10, meetRange: TILAPIA_MEET_RANGE },
      { id: 'test-mud', distance: 0, meetRange: 60 },
      { id: 'tilapia', distance: 20, meetRange: TILAPIA_MEET_RANGE },
    ];
    expect(metThreatIds(pos, SAFE_AREA, sightings)).toEqual(['tilapia', 'test-mud']);
  });

  it('meets nothing inside the safe area, edges included', () => {
    const sightings: ThreatSighting[] = [{ id: 'tilapia', distance: 0, meetRange: TILAPIA_MEET_RANGE }];
    expect(metThreatIds({ x: 50, y: 50 }, SAFE_AREA, sightings)).toEqual([]);
    expect(metThreatIds({ x: 100, y: 50 }, SAFE_AREA, sightings)).toEqual([]);
  });

  it('meets nothing with no sightings', () => {
    expect(metThreatIds(pos, SAFE_AREA, [])).toEqual([]);
  });
});
