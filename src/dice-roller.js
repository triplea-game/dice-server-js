'use strict';
const Promise = require("bluebird");
const randomNumber = require("random-number-csprng");
const roller = {};

roller.roll = function(max, times, callback){
	const promises = [];
	for(var i = 0; i < times; i++){
		promises.push(randomNumber(1, max));
	}
	Promise.all(promises).then(callback);
};

module.exports = roller;
