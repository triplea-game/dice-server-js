'use strict';
class TokenCache {
	constructor() {
		this.map = {};
	}

	put(key, value) {
		this.map[key] = {
			value: value,
			timeout: setTimeout(() => delete this.map[key], 1000 * 60 * 60)
		};
	}

	verify(key, token) {
		const value = this.map[key];
		if (value) {
			clearTimeout(value.timeout);
		}
		return delete this.map[key] && value.value === token;
	}
}

module.exports = TokenCache;
