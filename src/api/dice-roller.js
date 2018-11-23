'use strict';
const Promise = require('bluebird');
const randomNumber = require('random-number-csprng');
const roller = {};

roller.roll = (max, times) => {
	const promises = [];
	for (let i = 0; i < times; i++) {
		promises.push(randomNumber(1, max));
	}
	return Promise.all(promises);
};

module.exports = roller;
