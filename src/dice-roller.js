'use strict';
const crypto = require('crypto');
const roller = {};

function getByteCount(max, times){
	return Math.ceil(Math.log2(Math.pow(max, times)) / 8);
}

roller.roll = function(max, times){
	const byteCount = getByteCount(max, times);
	const randomToken = crypto.randomBytes(byteCount).readUIntBE(0, byteCount);
	var remainingToken = randomToken;
	const dice = [];
	for(var i = 0; i < times; i++){
		dice.push(remainingToken % max);
		remainingToken = Math.floor(remainingToken / max);
	}
	return dice;
};

module.exports = roller;
