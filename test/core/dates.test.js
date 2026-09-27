const { formatUtc } = require('../../src/core/dates');

describe('formatUtc', () => {
  it('shows the full date and time in UTC with a four-digit year', () => {
    expect(formatUtc(1700000000000)).toBe('2023-11-14 22:13:20 UTC');
  });

  it('tells two rolls on the same day apart', () => {
    expect(formatUtc(1700000000000)).not.toBe(formatUtc(1700000001000));
  });
});
