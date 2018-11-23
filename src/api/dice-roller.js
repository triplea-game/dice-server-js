const Promise = require('bluebird');
const randomNumber = require('random-number-csprng');

const roller = {};

roller.roll = (max, times) => {
  const promises = [];
  for (let i = 0; i < times; i += 1) {
    promises.push(randomNumber(1, max));
  }
  return Promise.all(promises);
};

module.exports = roller;
