const roller = require('../../src/api/dice-roller');

describe('roller.roll', () => {
  it('returns one die per requested roll', async () => {
    expect(await roller.roll(6, 20)).toHaveLength(20);
  });

  it('keeps every die between 1 and max', async () => {
    const dice = await roller.roll(6, 1000);

    expect(dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6)).toBe(true);
  });

  it('can roll every face, not just a subset', async () => {
    const dice = await roller.roll(6, 1000);

    expect(new Set(dice)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('rolls only 1s for a one-sided die', async () => {
    expect(await roller.roll(1, 3)).toEqual([1, 1, 1]);
  });
});
