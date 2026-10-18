import {
  matchReasons,
  matchScore,
  SHOWN_FROM,
  STRONG_FROM,
  worthAnEmail,
} from './match-score.js';

describe('matchScore', () => {
  it('gives full marks to the same title, place and day', () => {
    expect(matchScore({ textScore: 1, samePlace: true, daysAfter: 0 })).toBe(1);
  });

  it('counts a day either side of the loss as the same', () => {
    const sameDay = matchScore({
      textScore: 0.5,
      samePlace: false,
      daysAfter: 0,
    });

    expect(
      matchScore({ textScore: 0.5, samePlace: false, daysAfter: -1 }),
    ).toBe(sameDay);
    expect(matchScore({ textScore: 0.5, samePlace: false, daysAfter: 1 })).toBe(
      sameDay,
    );
  });

  it('cares less about dates the longer the item went unfound', () => {
    const score = (daysAfter: number) =>
      matchScore({ textScore: 0.5, samePlace: true, daysAfter });

    expect(score(3)).toBeGreaterThan(score(10));
    expect(score(14)).toBe(0.5 * 0.5 + 0.25);
  });

  it('suggests a same-day item from the same place even with other words', () => {
    const score = matchScore({ textScore: 0, samePlace: true, daysAfter: 0 });

    expect(score).toBeGreaterThanOrEqual(SHOWN_FROM);
    expect(score).toBeLessThan(STRONG_FROM);
  });

  it('only emails about items that are alike in more than one way', () => {
    expect(
      matchScore({ textScore: 0.8, samePlace: false, daysAfter: 10 }),
    ).toBeLessThan(STRONG_FROM);
    expect(
      matchScore({ textScore: 0.8, samePlace: true, daysAfter: 2 }),
    ).toBeGreaterThanOrEqual(STRONG_FROM);
  });
});

describe('matchReasons', () => {
  it('explains a match in plain words', () => {
    expect(
      matchReasons({ textScore: 0.7, samePlace: true, daysAfter: 1 }),
    ).toEqual(['Same place', 'Found the next day', 'Similar title']);
  });

  it('leaves out what does not apply', () => {
    expect(
      matchReasons({ textScore: 0.1, samePlace: false, daysAfter: 5 }),
    ).toEqual(['Found 5 days later']);
    expect(
      matchReasons({ textScore: 0.1, samePlace: false, daysAfter: -1 }),
    ).toEqual(['Found the day before']);
  });
});

describe('worthAnEmail', () => {
  it('needs alike titles as well as a strong match', () => {
    const strong = { textScore: 1, samePlace: true, daysAfter: 0 };

    expect(worthAnEmail({ ...strong, titleScore: 0.6 })).toBe(true);
    expect(worthAnEmail({ ...strong, titleScore: 0.1 })).toBe(false);
  });

  it('needs a strong match as well as alike titles', () => {
    expect(
      worthAnEmail({
        textScore: 0.9,
        titleScore: 0.9,
        samePlace: false,
        daysAfter: 13,
      }),
    ).toBe(false);
  });
});
