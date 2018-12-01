const mockRandomNumber = jest.fn();
jest.mock('random-number-csprng', () => mockRandomNumber);

const roller = require('../../src/api/dice-roller');

describe('The dice-roller', () => {
  it('should return the right amount of random values in range', async () => {
    mockRandomNumber
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(6);

    const resultPromise = roller.roll(6, 6);
    expect(resultPromise instanceof Promise).toBe(true);
    expect(await resultPromise).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('should call the RNG with the correct bounds', () => {
    roller.roll(0, 0);
    roller.roll(100, 0);
    roller.roll(1000000, 0);

    expect(mockRandomNumber).not.toHaveBeenCalled();

    roller.roll(1, 234);
    roller.roll(12, 34);
    roller.roll(123, 4);
    expect(mockRandomNumber).toMatchSnapshot();
  });
});
