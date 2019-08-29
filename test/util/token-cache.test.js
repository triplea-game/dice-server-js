const TokenCache = require('../../src/util/token-cache');

describe('A TokenCache entry', () => {
  it('should expire instantly if timeout is 0', async () => {
    const cache = new TokenCache(0);
    cache.put('KEY', 'VALUE');

    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(cache.verify('KEY', 'VALUE')).toBe(false);
  });

  it('should expire when checking for the correct token', () => {
    const cache = new TokenCache();
    cache.put('KEY', 'VALUE');

    expect(cache.verify('KEY', 'VALUE')).toBe(true);
    expect(cache.verify('KEY', 'VALUE')).toBe(false);
  });

  it('should expire when checking for the wrong token', () => {
    const cache = new TokenCache();
    cache.put('KEY', 'VALUE');

    expect(cache.verify('KEY', 'WRONG')).toBe(false);
    expect(cache.verify('KEY', 'VALUE')).toBe(false);
  });

  it('should expire after 60 minutes by default', () => {
    jest.useFakeTimers();
    const cache = new TokenCache();
    cache.put('KEY', 'VALUE');

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 60 * 60 * 1000);

    jest.runAllTimers();
    expect(cache.verify('KEY', 'VALUE')).toBe(false);
  });

  it('should expire after the specified amount of time', () => {
    jest.useFakeTimers();
    const cache = new TokenCache(42);
    cache.put('KEY', 'VALUE');

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 42 * 60 * 1000);

    jest.runAllTimers();
    expect(cache.verify('KEY', 'VALUE')).toBe(false);
  });
});
