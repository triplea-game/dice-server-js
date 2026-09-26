class TokenCache {
  constructor(minutesToLive = 60) {
    this.map = {};
    this.timeout = 1000 * 60 * minutesToLive;
  }

  put(key, value) {
    const timeout = setTimeout(() => delete this.map[key], this.timeout);
    // A pending registration shouldn't keep the process alive on shutdown.
    timeout.unref();
    this.map[key] = { value, timeout };
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
