'use strict';
const roller = {};

roller.roll = function(max, times){
	const dice = [];
	for(var i = 0; i < times; i++){
		dice.push(Math.ceil(Math.random() * max));
	}
	return dice;
};

module.exports = roller;
