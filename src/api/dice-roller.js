const randomNumber = require('random-number-csprng');

const roller = {};

roller.roll = (max, times) => {
  const promises = [];
  for (let i = 0; i < times; i += 1) {
    // random-number-csprng throws when min equals max.
    promises.push(max === 1 ? Promise.resolve(1) : randomNumber(1, max));
  }
  return Promise.all(promises);
};

module.exports = roller;
