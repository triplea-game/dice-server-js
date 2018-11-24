class TokenCache {
  constructor(minutesToLive = 60) {
    this.map = {};
    this.timeout = 100 * 60 * minutesToLive;
  }

  put(key, value) {
    this.map[key] = {
      value,
      timeout: setTimeout(() => delete this.map[key], this.timeout),
    };
  }

  verify(key, token) {
    const value = this.map[key];
    if (value) {
      clearTimeout(value.timeout);
      delete this.map[key];
      return value.value === token;
    }
    return false;
  }
}

module.exports = TokenCache;
