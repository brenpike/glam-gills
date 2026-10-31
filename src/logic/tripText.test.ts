import { describe, expect, it } from 'vitest';
import { AREA_BEATEN_TITLE, bestStarsLine, starLines, starsShortLine } from './areaText';
import { CANAL_TREASURES } from './catalogue';
import { NO_STARS, type AreaStars } from './stars';
import * as tripText from './tripText';
import {
  ALL_SNACKS_BANNER,
  ARRIVAL_OK_LABEL,
  BANKING_HINT,
  GHOST_NET_BANNER,
  PLASTIC_WORM_BANNER,
  TRIP_END_BODY,
  bankedBody,
  bankedBodyShort,
  arrivalText,
  describeTreasures,
  tripBagStatus,
  type ArrivalReason,
  type ArrivalStars,
  type WaitingAxolotl,
} from './tripText';

const BANNED = [
  'die',
  'dead',
  'death',
  'killed',
  'game over',
  'fail',
  'wipe',
  'injury',
  'wound',
  'damage',
  'monster',
  'invulnerab',
  'inventory',
  'checkpoint',
  'loot',
  ' base',
  'level',
  'fish tank',
];

const exportedStrings = Object.entries(tripText).filter(
  (entry): entry is [string, string] => typeof entry[1] === 'string',
);

const NAME_SAMPLES: readonly (readonly string[])[] = [
  [],
  ['Sun hat'],
  ['Pond plant', 'Mint Paint shell'],
  ['Toy boat', 'Castle tower', 'Golden bow'],
  ['Sun hat', 'Pond plant', 'Toy boat', 'Heart glasses', 'Shell necklace'],
];

const SHORT_COUNTS = [0, 1, 2, 5, 20];

const SHORT_TOTALS = [0, 1, 4, 20];

const AXOLOTL_SAMPLES: readonly (readonly string[])[] = [
  [],
  ['Golden albino axolotl'],
  ['Golden albino axolotl', 'Leucistic axolotl'],
];

const WAITING_SAMPLES: readonly (readonly WaitingAxolotl[])[] = [
  [],
  [{ name: 'Golden albino axolotl', sex: 'boy' }],
  [{ name: 'Golden albino axolotl', sex: 'girl' }],
  [
    { name: 'Golden albino axolotl', sex: 'girl' },
    { name: 'Leucistic axolotl', sex: 'boy' },
  ],
];

const AXOLOTL_COUNTS = [0, 1, 2];

function makeNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Treasure ${index + 1}`);
}

function shortBodyFor(reason: 'wentHome' | 'carriedHome', count: number): string {
  return arrivalText({
    reason,
    returnedNames: makeNames(count),
    bankedThisTripNames: makeNames(count),
    bankedTotal: 0,
  }).shortBody;
}

const ALL_STARS: AreaStars = { exit: true, special: true, legsOrRescue: true };

const STAR_SAMPLES: readonly AreaStars[] = [
  NO_STARS,
  { exit: true, special: false, legsOrRescue: false },
  { exit: true, special: true, legsOrRescue: false },
  ALL_STARS,
];

function arrivalStars(earned: AreaStars, best: AreaStars, rescueOpen = true): ArrivalStars {
  return { areaLabel: 'Area 1', specialName: 'Castle tower', earned, best, rescueOpen };
}

/** Area-beaten stars for every star sample with and without an open rescue, and no stars at all. */
function areaBeatenStarSamples(): (ArrivalStars | undefined)[] {
  const samples: (ArrivalStars | undefined)[] = [undefined];
  for (const rescueOpen of [false, true]) {
    samples.push(...STAR_SAMPLES.map((earned) => arrivalStars(earned, ALL_STARS, rescueOpen)));
  }
  return samples;
}

function areaBeatenOutputs(names: readonly string[], total: number): string[] {
  const outputs: string[] = [];
  for (const stars of areaBeatenStarSamples()) {
    for (const rescuedNames of AXOLOTL_SAMPLES) {
      const text = arrivalText({
        reason: 'areaBeaten',
        returnedNames: names,
        bankedThisTripNames: names,
        bankedTotal: total,
        rescuedNames,
        stars,
      });
      outputs.push(text.title, text.body, text.shortBody, text.bankedLine, text.button);
    }
  }
  return outputs;
}

function collectHelperOutputs(): string[] {
  const outputs: string[] = [];
  for (const count of [0, 1, 2, 5]) outputs.push(tripBagStatus(count));
  for (const names of NAME_SAMPLES) {
    outputs.push(describeTreasures(names));
    for (const total of [0, 1, 4]) {
      outputs.push(bankedBody(names, total));
      for (const reason of ['wentHome', 'carriedHome'] as const) {
        const text = arrivalText({
          reason,
          returnedNames: names,
          bankedThisTripNames: names,
          bankedTotal: total,
        });
        outputs.push(text.title, text.body, text.shortBody, text.bankedLine, text.button);
      }
      outputs.push(...areaBeatenOutputs(names, total));
    }
  }
  for (const count of SHORT_COUNTS) {
    for (const total of SHORT_TOTALS) outputs.push(bankedBodyShort(count, total));
    for (const reason of ['wentHome', 'carriedHome'] as const) {
      outputs.push(shortBodyFor(reason, count));
    }
  }
  outputs.push(...collectAxolotlOutputs());
  return outputs;
}

function collectAxolotlArrivalOutputs(names: readonly string[], axolotls: readonly string[]): string[] {
  const outputs: string[] = [];
  for (const reason of ['wentHome', 'carriedHome'] as const) {
    for (const waiting of WAITING_SAMPLES) {
      const text = arrivalText({
        reason,
        returnedNames: names,
        bankedThisTripNames: names,
        bankedTotal: names.length,
        rescuedNames: axolotls,
        waiting,
      });
      outputs.push(text.title, text.body, text.shortBody, text.bankedLine, text.button);
    }
  }
  return outputs;
}

function collectAxolotlOutputs(): string[] {
  const outputs: string[] = [];
  for (const names of NAME_SAMPLES) {
    for (const axolotls of AXOLOTL_SAMPLES) {
      outputs.push(bankedBody(names, names.length, axolotls));
      outputs.push(...collectAxolotlArrivalOutputs(names, axolotls));
    }
  }
  for (const count of SHORT_COUNTS) {
    for (const rescuedCount of AXOLOTL_COUNTS) outputs.push(bankedBodyShort(count, count, rescuedCount));
  }
  return outputs;
}

describe('trip text', () => {
  it('exports every trip string by name', () => {
    expect(exportedStrings.map(([name]) => name).sort()).toEqual([
      'ALL_SNACKS_BANNER',
      'ARRIVAL_OK_LABEL',
      'BANKED_TITLE',
      'BANKING_HINT',
      'GHOST_NET_BANNER',
      'GO_HOME_LABEL',
      'KEEP_EXPLORING_LABEL',
      'LEGS_LABEL',
      'NOT_SAFE_YET',
      'PLASTIC_WORM_BANNER',
      'TRIP_BAG_LABEL',
      'TRIP_END_BODY',
      'TRIP_END_TITLE',
      'WENT_HOME_TITLE',
    ]);
  });

  it.each(exportedStrings)('%s avoids harsh words', (_name, text) => {
    const lower = text.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });

  it('never mentions pebbles in any helper output', () => {
    for (const output of collectHelperOutputs()) {
      expect(output.toLowerCase()).not.toContain('pebble');
    }
  });

  it('keeps every helper output free of harsh or gamey words', () => {
    for (const output of collectHelperOutputs()) {
      const lower = output.toLowerCase();
      for (const word of BANNED) expect(lower).not.toContain(word);
    }
  });

  it('says the axolotl is safe with four legs and the snacks are back', () => {
    const lower = TRIP_END_BODY.toLowerCase();
    expect(lower).toContain('safe');
    expect(lower).toContain('four legs');
    expect(lower).toMatch(/snacks are back/);
    expect(lower).not.toMatch(/kept every snack/);
  });

  it('labels the arrival card button "OK"', () => {
    expect(ARRIVAL_OK_LABEL).toBe('OK');
  });

  it('teaches that the Home Spot keeps finds safe', () => {
    expect(BANKING_HINT).toContain('Home Spot');
    expect(BANKING_HINT.toLowerCase()).toContain('safe');
  });
});

describe('describeTreasures', () => {
  it('says there are no treasures for an empty list', () => {
    expect(describeTreasures([])).toBe('no treasures');
  });

  it('names a single treasure', () => {
    expect(describeTreasures(['Sun hat'])).toBe('Sun hat');
  });

  it('joins two treasures with "and"', () => {
    expect(describeTreasures(['Pond plant', 'Mint Paint shell'])).toBe(
      'Pond plant and Mint Paint shell',
    );
  });

  it('joins three treasures with a comma and "and"', () => {
    expect(describeTreasures(['Toy boat', 'Castle tower', 'Golden bow'])).toBe(
      'Toy boat, Castle tower and Golden bow',
    );
  });

  it('names the first three and counts the rest past three', () => {
    expect(
      describeTreasures(['Sun hat', 'Pond plant', 'Toy boat', 'Heart glasses', 'Shell necklace']),
    ).toBe('Sun hat, Pond plant, Toy boat and 2 more');
  });
});

describe('tripBagStatus', () => {
  it('warns that carried finds are not safe yet', () => {
    expect(tripBagStatus(2)).toContain('not safe yet');
    expect(tripBagStatus(1)).toContain('not safe yet');
  });

  it('says the bag is empty when it holds nothing', () => {
    expect(tripBagStatus(0)).toBe('empty');
  });
});

describe('bankedBody', () => {
  it('names what was banked and gives the Home Spot total', () => {
    expect(bankedBody(['Sun hat', 'Pond plant'], 5)).toBe(
      'Sun hat and Pond plant are safe now! You have 5 treasures safe at the Home Spot.',
    );
  });

  it('uses the singular for one treasure', () => {
    expect(bankedBody(['Sun hat'], 1)).toBe(
      'Sun hat is safe now! You have 1 treasure safe at the Home Spot.',
    );
  });

  it('handles banking nothing new', () => {
    expect(bankedBody([], 3)).toBe(
      'Nothing new to bring in. You have 3 treasures safe at the Home Spot.',
    );
  });

  it('says the Home Spot is empty when the total is zero', () => {
    expect(bankedBody([], 0)).toBe('Nothing new to bring in. No treasures at the Home Spot yet.');
  });
});

describe('arrivalText', () => {
  it('carried home: safe, four legs, returned treasures, and the banked total', () => {
    const text = arrivalText({
      reason: 'carriedHome',
      returnedNames: ['Sun hat', 'Pond plant', 'Toy boat'],
      bankedThisTripNames: [],
      bankedTotal: 4,
    });
    const lower = text.body.toLowerCase();
    expect(text.title).toBe(tripText.TRIP_END_TITLE);
    expect(lower).toContain('safe');
    expect(lower).toContain('four legs');
    expect(text.body).toBe(
      `${TRIP_END_BODY} Sun hat, Pond plant and Toy boat floated off to new hiding spots. ` +
        'Look for them next trip! Treasures at the Home Spot are always safe.',
    );
    expect(text.bankedLine).toBe('You have 4 treasures safe at the Home Spot.');
    expect(text.button).toBe(ARRIVAL_OK_LABEL);
  });

  it('carried home with one treasure says it floated off to a new hiding spot', () => {
    const text = arrivalText({
      reason: 'carriedHome',
      returnedNames: ['Golden bow'],
      bankedThisTripNames: [],
      bankedTotal: 1,
    });
    expect(text.body).toBe(
      `${TRIP_END_BODY} Golden bow floated off to a new hiding spot. Look for it next trip! ` +
        'Treasures at the Home Spot are always safe.',
    );
    expect(text.bankedLine).toBe('You have 1 treasure safe at the Home Spot.');
  });

  it('carried home with nothing in the bag says nothing was lost', () => {
    const text = arrivalText({
      reason: 'carriedHome',
      returnedNames: [],
      bankedThisTripNames: [],
      bankedTotal: 0,
    });
    expect(text.body).toBe(
      `${TRIP_END_BODY} Nothing was lost. Treasures at the Home Spot are always safe.`,
    );
    expect(text.bankedLine).toBe('No treasures at the Home Spot yet.');
    expect(text.button).toBe(ARRIVAL_OK_LABEL);
  });

  it('went home: lists treasures banked this trip and the total', () => {
    const text = arrivalText({
      reason: 'wentHome',
      returnedNames: [],
      bankedThisTripNames: ['Sun hat', 'Mint Paint shell'],
      bankedTotal: 7,
    });
    expect(text.title).toBe(tripText.WENT_HOME_TITLE);
    expect(text.body).toBe(
      'You swam home safe and sound. This trip you brought home Sun hat and Mint Paint shell.',
    );
    expect(text.bankedLine).toBe('You have 7 treasures safe at the Home Spot.');
    expect(text.button).toBe(ARRIVAL_OK_LABEL);
  });

  it('went home with nothing banked this trip', () => {
    const text = arrivalText({
      reason: 'wentHome',
      returnedNames: [],
      bankedThisTripNames: [],
      bankedTotal: 2,
    });
    expect(text.body).toBe('You swam home safe and sound.');
  });
});

describe('bankedBodyShort', () => {
  it('handles banking nothing new', () => {
    expect(bankedBodyShort(0, 0)).toBe('Nothing new to bring in. No treasures at the Home Spot yet.');
    expect(bankedBodyShort(0, 3)).toBe(
      'Nothing new to bring in. You have 3 treasures safe at the Home Spot.',
    );
  });

  it('says "Your treasure" for one', () => {
    expect(bankedBodyShort(1, 1)).toBe(
      'Your treasure is safe now! You have 1 treasure safe at the Home Spot.',
    );
  });

  it('counts two or more', () => {
    expect(bankedBodyShort(2, 5)).toBe(
      '2 treasures are safe now! You have 5 treasures safe at the Home Spot.',
    );
    expect(bankedBodyShort(20, 20)).toBe(
      '20 treasures are safe now! You have 20 treasures safe at the Home Spot.',
    );
  });
});

describe('arrivalText shortBody', () => {
  const OPENING = 'A big bubble floated you home. You are safe!';

  it('carried home with nothing returned', () => {
    expect(shortBodyFor('carriedHome', 0)).toBe(`${OPENING} Nothing was lost.`);
  });

  it('carried home with one returned', () => {
    expect(shortBodyFor('carriedHome', 1)).toBe(
      `${OPENING} Your treasure floated off. Look for it next trip!`,
    );
  });

  it('carried home with several returned', () => {
    expect(shortBodyFor('carriedHome', 2)).toBe(
      `${OPENING} 2 treasures floated off. Look for them next trip!`,
    );
    expect(shortBodyFor('carriedHome', 5)).toBe(
      `${OPENING} 5 treasures floated off. Look for them next trip!`,
    );
  });

  it('went home with nothing banked', () => {
    expect(shortBodyFor('wentHome', 0)).toBe('You swam home safe and sound.');
  });

  it('went home with one banked', () => {
    expect(shortBodyFor('wentHome', 1)).toBe(
      'You swam home safe and sound. You brought home 1 treasure.',
    );
  });

  it('went home with several banked', () => {
    expect(shortBodyFor('wentHome', 2)).toBe(
      'You swam home safe and sound. You brought home 2 treasures.',
    );
    expect(shortBodyFor('wentHome', 20)).toBe(
      'You swam home safe and sound. You brought home 20 treasures.',
    );
  });

  it('uses returnedNames for carried home and bankedThisTripNames for went home', () => {
    const carried = arrivalText({
      reason: 'carriedHome',
      returnedNames: makeNames(3),
      bankedThisTripNames: makeNames(1),
      bankedTotal: 0,
    });
    const went = arrivalText({
      reason: 'wentHome',
      returnedNames: makeNames(3),
      bankedThisTripNames: makeNames(1),
      bankedTotal: 0,
    });
    expect(carried.shortBody).toContain('3 treasures');
    expect(went.shortBody).toContain('1 treasure.');
  });

  it('never contains a catalogue treasure name', () => {
    const outputs: string[] = [];
    for (const count of SHORT_COUNTS) {
      for (const total of SHORT_TOTALS) outputs.push(bankedBodyShort(count, total));
      outputs.push(shortBodyFor('wentHome', count), shortBodyFor('carriedHome', count));
    }
    for (const output of outputs) {
      const lower = output.toLowerCase();
      for (const treasure of CANAL_TREASURES) expect(lower).not.toContain(treasure.name.toLowerCase());
    }
  });
});

describe('rescued and waiting axolotls', () => {
  const GOLDEN = 'Golden albino axolotl';
  const LEUCISTIC = 'Leucistic axolotl';

  function arrivalWith(
    reason: 'wentHome' | 'carriedHome',
    treasures: readonly string[],
    rescuedNames: readonly string[],
    waiting: readonly WaitingAxolotl[],
  ) {
    return arrivalText({
      reason,
      returnedNames: reason === 'carriedHome' ? treasures : [],
      bankedThisTripNames: reason === 'wentHome' ? treasures : [],
      bankedTotal: 2,
      rescuedNames,
      waiting,
    });
  }

  it('bankedBody names a rescued axolotl first and uses "is" for one', () => {
    expect(bankedBody([], 0, [GOLDEN])).toBe(
      `${GOLDEN} is safe now! No treasures at the Home Spot yet.`,
    );
  });

  it('bankedBody uses "are" for an axolotl with a treasure and counts treasures only', () => {
    expect(bankedBody(['Sun hat'], 1, [GOLDEN])).toBe(
      `${GOLDEN} and Sun hat are safe now! You have 1 treasure safe at the Home Spot.`,
    );
  });

  it('bankedBodyShort says the axolotl friend is safe with no treasures', () => {
    expect(bankedBodyShort(0, 3, 1)).toBe(
      'Your axolotl friend is safe now! You have 3 treasures safe at the Home Spot.',
    );
  });

  it('bankedBodyShort pairs the axolotl friend with one treasure', () => {
    expect(bankedBodyShort(1, 1, 1)).toBe(
      'Your axolotl friend and your treasure are safe! You have 1 treasure safe at the Home Spot.',
    );
  });

  it('bankedBodyShort pairs the axolotl friend with several treasures', () => {
    expect(bankedBodyShort(4, 4, 1)).toBe(
      'Your axolotl friend and 4 treasures are safe! You have 4 treasures safe at the Home Spot.',
    );
  });

  it('bankedBodyShort counts more than one axolotl friend', () => {
    expect(bankedBodyShort(0, 0, 2)).toBe(
      '2 axolotl friends are safe now! No treasures at the Home Spot yet.',
    );
    expect(bankedBodyShort(3, 3, 2)).toBe(
      '2 axolotl friends and 3 treasures are safe! You have 3 treasures safe at the Home Spot.',
    );
  });

  it('went home: the rescued axolotl moved into the Home Tank before the treasures', () => {
    const text = arrivalWith('wentHome', ['Sun hat'], [GOLDEN], []);
    expect(text.body).toBe(
      `You swam home safe and sound. ${GOLDEN} moved into your Home Tank! ` +
        'This trip you brought home Sun hat.',
    );
    expect(text.shortBody).toBe(
      'You swam home safe and sound. Your axolotl friend moved into your Home Tank!',
    );
  });

  it('went home: a rescued axolotl with no treasures leaves out the treasure sentence', () => {
    const text = arrivalWith('wentHome', [], [GOLDEN], []);
    expect(text.body).toBe(`You swam home safe and sound. ${GOLDEN} moved into your Home Tank!`);
    expect(text.shortBody).toBe(
      'You swam home safe and sound. Your axolotl friend moved into your Home Tank!',
    );
  });

  it('carried home: a waiting girl is waiting, and "Nothing was lost." is left out', () => {
    const text = arrivalWith('carriedHome', [], [], [{ name: GOLDEN, sex: 'girl' }]);
    expect(text.body).toBe(
      `${TRIP_END_BODY} ${GOLDEN} swam back to where you found her. She's waiting for you! ` +
        'Treasures at the Home Spot are always safe.',
    );
    expect(text.body).toContain("She's waiting for you");
    expect(text.body).not.toContain('Nothing was lost.');
    expect(text.shortBody).toBe(
      'A big bubble floated you home. You are safe! Your axolotl friend is waiting for you!',
    );
    expect(text.shortBody).not.toContain('Nothing was lost.');
  });

  it('carried home: returned treasures, then the waiting axolotl, then the rescued one; short body tells only of axolotls', () => {
    const text = arrivalWith('carriedHome', ['Golden bow'], [LEUCISTIC], [{ name: GOLDEN, sex: 'boy' }]);
    expect(text.body).toBe(
      `${TRIP_END_BODY} Golden bow floated off to a new hiding spot. Look for it next trip! ` +
        `${GOLDEN} swam back to where you found him. He's waiting for you! ` +
        `${LEUCISTIC} is safe in your Home Tank. Treasures at the Home Spot are always safe.`,
    );
    expect(text.shortBody).toBe(
      'A big bubble floated you home. You are safe! Your axolotl friend is waiting for you! ' +
        'Your axolotl friend is safe in your Home Tank.',
    );
  });

  it('carried home: several waiting axolotls use "them" and "They\'re"', () => {
    const text = arrivalWith('carriedHome', [], [], [
      { name: GOLDEN, sex: 'boy' },
      { name: LEUCISTIC, sex: 'girl' },
    ]);
    expect(text.body).toContain(
      `${GOLDEN} and ${LEUCISTIC} swam back to where you found them. They're waiting for you!`,
    );
    expect(text.shortBody).toContain('2 axolotl friends are waiting for you!');
  });

  it('carried home: a waiting boy is waiting, with "him" and "He\'s"', () => {
    const text = arrivalWith('carriedHome', [], [], [{ name: GOLDEN, sex: 'boy' }]);
    expect(text.body).toBe(
      `${TRIP_END_BODY} ${GOLDEN} swam back to where you found him. He's waiting for you! ` +
        'Treasures at the Home Spot are always safe.',
    );
    expect(text.shortBody).toBe(
      'A big bubble floated you home. You are safe! Your axolotl friend is waiting for you!',
    );
  });

  it('carried home: a rescued axolotl alone keeps "Nothing was lost." in the full body and uses "is"', () => {
    const text = arrivalWith('carriedHome', [], [GOLDEN], []);
    expect(text.body).toBe(
      `${TRIP_END_BODY} Nothing was lost. ${GOLDEN} is safe in your Home Tank. ` +
        'Treasures at the Home Spot are always safe.',
    );
    expect(text.shortBody).toBe(
      'A big bubble floated you home. You are safe! Your axolotl friend is safe in your Home Tank.',
    );
  });

  it('carried home: several rescued axolotls use "are"', () => {
    const text = arrivalWith('carriedHome', [], [GOLDEN, LEUCISTIC], []);
    expect(text.body).toContain(`${GOLDEN} and ${LEUCISTIC} are safe in your Home Tank.`);
    expect(text.shortBody).toContain('2 axolotl friends are safe in your Home Tank.');
  });

  it('matches the old wording when the axolotl lists are empty', () => {
    for (const reason of ['wentHome', 'carriedHome'] as const) {
      const withLists = arrivalWith(reason, ['Sun hat'], [], []);
      const without = arrivalText({
        reason,
        returnedNames: reason === 'carriedHome' ? ['Sun hat'] : [],
        bankedThisTripNames: reason === 'wentHome' ? ['Sun hat'] : [],
        bankedTotal: 2,
      });
      expect(withLists).toEqual(without);
    }
    expect(bankedBody(['Sun hat'], 1, [])).toBe(bankedBody(['Sun hat'], 1));
    expect(bankedBodyShort(2, 2, 0)).toBe(bankedBodyShort(2, 2));
  });
});

describe('arrivalText areaBeaten (H5, H6, H7)', () => {
  const OPENING = 'You swam through the open exit!';
  const GOLDEN = 'Golden albino axolotl';

  it('names the treasures banked this trip, then one line per star and the best stars', () => {
    const earned: AreaStars = { exit: true, special: false, legsOrRescue: true };
    const text = arrivalText({
      reason: 'areaBeaten',
      returnedNames: ['Golden bow'],
      bankedThisTripNames: ['Sun hat', 'Pond plant'],
      bankedTotal: 6,
      stars: arrivalStars(earned, ALL_STARS),
    });
    expect(text.title).toBe(AREA_BEATEN_TITLE);
    expect(text.body).toBe(
      [
        `${OPENING} This trip you brought home Sun hat and Pond plant.`,
        'You reached the exit!',
        'Find the Castle tower next time.',
        'You kept all four legs!',
        'Area 1: 3 of 3 stars',
      ].join('\n'),
    );
    expect(text.body.split('\n').slice(1)).toEqual([
      ...starLines(earned, 'Castle tower', false, true),
      bestStarsLine('Area 1', ALL_STARS),
    ]);
    expect(text.shortBody).toBe(starsShortLine(earned, ALL_STARS));
    expect(text.shortBody).toBe('2 of 3 stars! Best: 3 of 3.');
    expect(text.bankedLine).toBe('You have 6 treasures safe at the Home Spot.');
    expect(text.button).toBe(ARRIVAL_OK_LABEL);
    expect(text.body).not.toContain('Golden bow');
  });

  it('says only the exit opening when nothing was banked this trip', () => {
    const text = arrivalText({
      reason: 'areaBeaten',
      returnedNames: [],
      bankedThisTripNames: [],
      bankedTotal: 0,
      stars: arrivalStars(ALL_STARS, ALL_STARS),
    });
    expect(text.body.split('\n')[0]).toBe(OPENING);
    expect(text.bankedLine).toBe('No treasures at the Home Spot yet.');
  });

  it('without stars says the exit opening and what was brought home, with no star lines', () => {
    const text = arrivalText({
      reason: 'areaBeaten',
      returnedNames: [],
      bankedThisTripNames: ['Sun hat'],
      bankedTotal: 1,
    });
    expect(text.title).toBe(AREA_BEATEN_TITLE);
    expect(text.body).toBe(`${OPENING} This trip you brought home Sun hat.`);
    expect(text.shortBody).toBe(OPENING);
  });

  it('keeps the short body to one line of at most 34 characters', () => {
    for (const earned of STAR_SAMPLES) {
      for (const best of STAR_SAMPLES) {
        const text = arrivalText({
          reason: 'areaBeaten',
          returnedNames: [],
          bankedThisTripNames: makeNames(20),
          bankedTotal: 20,
          stars: arrivalStars(earned, best),
        });
        expect(text.shortBody).not.toContain('\n');
        expect(text.shortBody.length).toBeLessThanOrEqual(34);
      }
    }
    expect(OPENING.length).toBeLessThanOrEqual(34);
  });

  it('names the rescued axolotl before the treasures and praises the rescue for star 3', () => {
    const text = arrivalText({
      reason: 'areaBeaten',
      returnedNames: [],
      bankedThisTripNames: ['Sun hat'],
      bankedTotal: 1,
      rescuedNames: [GOLDEN],
      stars: arrivalStars(ALL_STARS, ALL_STARS),
    });
    expect(text.body).toBe(
      [
        `${OPENING} You brought ${GOLDEN} to your Home Tank, plus Sun hat.`,
        'You reached the exit!',
        'You found the Castle tower!',
        'You rescued an axolotl friend!',
        'Area 1: 3 of 3 stars',
      ].join('\n'),
    );
  });

  it('names a rescued axolotl with no treasures banked', () => {
    const text = arrivalText({
      reason: 'areaBeaten',
      returnedNames: [],
      bankedThisTripNames: [],
      bankedTotal: 0,
      rescuedNames: [GOLDEN],
    });
    expect(text.body).toBe(`${OPENING} You brought ${GOLDEN} to your Home Tank.`);
  });

  it('keeps the brought-home sentence as before when no axolotl was rescued', () => {
    for (const rescuedNames of [undefined, []]) {
      const text = arrivalText({
        reason: 'areaBeaten',
        returnedNames: [],
        bankedThisTripNames: ['Sun hat', 'Castle tower'],
        bankedTotal: 2,
        rescuedNames,
      });
      expect(text.body).toBe(`${OPENING} This trip you brought home Sun hat and Castle tower.`);
    }
  });

  it('follows rescuedNames for the earned star 3 line', () => {
    const lineFor = (rescuedNames: readonly string[]): string =>
      arrivalText({
        reason: 'areaBeaten',
        returnedNames: [],
        bankedThisTripNames: [],
        bankedTotal: 0,
        rescuedNames,
        stars: arrivalStars(ALL_STARS, ALL_STARS),
      }).body.split('\n')[3];
    expect(lineFor([GOLDEN])).toBe('You rescued an axolotl friend!');
    expect(lineFor([])).toBe('You kept all four legs!');
  });

  it('asks for a rescue for a missing star 3 only while a rescue is open', () => {
    const lineFor = (rescueOpen: boolean): string =>
      arrivalText({
        reason: 'areaBeaten',
        returnedNames: [],
        bankedThisTripNames: [],
        bankedTotal: 0,
        stars: arrivalStars(NO_STARS, ALL_STARS, rescueOpen),
      }).body.split('\n')[3];
    expect(lineFor(true)).toBe('Rescue or keep every leg next time.');
    expect(lineFor(false)).toBe('Keep all four legs next time.');
  });

  it('keeps the short body the stars line whether or not an axolotl was rescued', () => {
    for (const rescueOpen of [false, true]) {
      for (const rescuedNames of AXOLOTL_SAMPLES) {
        const text = arrivalText({
          reason: 'areaBeaten',
          returnedNames: [],
          bankedThisTripNames: makeNames(20),
          bankedTotal: 20,
          rescuedNames,
          stars: arrivalStars(ALL_STARS, ALL_STARS, rescueOpen),
        });
        expect(text.shortBody).toBe(starsShortLine(ALL_STARS, ALL_STARS));
        expect(text.shortBody.length).toBeLessThanOrEqual(34);
      }
    }
  });
});

describe('ALL_SNACKS_BANNER (H2)', () => {
  it('kindly says the last snack opened the exit', () => {
    expect(ALL_SNACKS_BANNER).toBe('Yum! That was the last snack. The exit is open!');
    expect(ALL_SNACKS_BANNER.toLowerCase()).not.toContain('pond');
  });
});

describe('PLASTIC_WORM_BANNER (issue #75)', () => {
  it('kindly says the plastic worm was not food', () => {
    expect(PLASTIC_WORM_BANNER).toBe('Bleh! That was plastic, not food.');
    const lower = PLASTIC_WORM_BANNER.toLowerCase();
    expect(lower).toContain('plastic');
    expect(lower).toContain('not food');
  });

  it('names no area and never calls the plastic worm a snack', () => {
    const lower = PLASTIC_WORM_BANNER.toLowerCase();
    expect(lower).not.toContain('pond');
    expect(lower).not.toContain('canal');
    expect(lower).not.toContain('snack');
  });

  it('is no longer than the all-snacks banner, so it fits wherever that banner fits (X10)', () => {
    expect(PLASTIC_WORM_BANNER.length).toBeLessThanOrEqual(ALL_SNACKS_BANNER.length);
  });
});

describe('GHOST_NET_BANNER (issue #76)', () => {
  it('kindly says an old net snagged the axolotl, which wriggles free', () => {
    expect(GHOST_NET_BANNER).toBe('Snagged on an old net! Wriggle free.');
    const lower = GHOST_NET_BANNER.toLowerCase();
    expect(lower).toContain('net');
    expect(lower).toContain('wriggle free');
  });

  it('never says trapped or hurt, and names no area', () => {
    const lower = GHOST_NET_BANNER.toLowerCase();
    for (const word of ['trap', 'hurt', 'stuck', 'pond', 'canal', 'chinampa']) expect(lower).not.toContain(word);
  });

  it('is no longer than the all-snacks banner, so it fits wherever that banner fits (X10)', () => {
    expect(GHOST_NET_BANNER.length).toBeLessThanOrEqual(ALL_SNACKS_BANNER.length);
  });
});

describe('one axolotl is never "it" or "they" (C5)', () => {
  const NAME = 'Golden albino axolotl';
  const NOT_ONE_AXOLOTL = /\b(it|its|it's|they|them|their|they're)\b/i;
  const REASONS: readonly ArrivalReason[] = ['wentHome', 'carriedHome', 'areaBeaten'];

  /** Every arrival output for one axolotl, waiting or rescued, with no treasures. */
  function oneAxolotlArrivalOutputs(sex: 'boy' | 'girl'): string[] {
    const outputs: string[] = [];
    const cases = [
      { rescuedNames: [NAME], waiting: [] },
      { rescuedNames: [], waiting: [{ name: NAME, sex }] },
    ];
    for (const reason of REASONS) {
      for (const stars of areaBeatenStarSamples()) {
        for (const axolotls of cases) {
          const text = arrivalText({
            reason,
            returnedNames: [],
            bankedThisTripNames: [],
            bankedTotal: 0,
            ...axolotls,
            stars,
          });
          outputs.push(text.title, text.body, text.shortBody, text.bankedLine, text.button);
        }
      }
    }
    return outputs;
  }

  it.each(['boy', 'girl'] as const)('arrival text for one %s uses no "it" or "they" words', (sex) => {
    for (const output of oneAxolotlArrivalOutputs(sex)) expect(output).not.toMatch(NOT_ONE_AXOLOTL);
  });

  it('banking text for one rescued axolotl uses no "it" or "they" words', () => {
    for (const total of [0, 1, 4]) {
      expect(bankedBody([], total, [NAME])).not.toMatch(NOT_ONE_AXOLOTL);
      expect(bankedBodyShort(0, total, 1)).not.toMatch(NOT_ONE_AXOLOTL);
    }
  });

  it('gives a waiting boy "him" and "He\'s" and a waiting girl "her" and "She\'s"', () => {
    const bodyFor = (sex: 'boy' | 'girl'): string =>
      arrivalText({
        reason: 'carriedHome',
        returnedNames: [],
        bankedThisTripNames: [],
        bankedTotal: 0,
        waiting: [{ name: NAME, sex }],
      }).body;
    expect(bodyFor('boy')).toContain(`${NAME} swam back to where you found him. He's waiting for you!`);
    expect(bodyFor('girl')).toContain(`${NAME} swam back to where you found her. She's waiting for you!`);
    expect(bodyFor('boy')).not.toMatch(/\b(she|her)\b/i);
    expect(bodyFor('girl')).not.toMatch(/\b(he|him|his)\b/i);
  });
});
