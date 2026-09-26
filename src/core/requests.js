// Pure request parsing and validation: values in, values out, no I/O.
// Error strings are user-facing; the TripleA client shows them to players.
const { PAYLOAD_VERSION } = require('./signed-payload');

const MAX_DICE_VALUE = 5000;
const SIGNATURE_LENGTH = 684;

const emailPattern = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const isEmail = (email) => emailPattern.test(email);

// Returns the errors for a body's `email` field; empty when it is usable.
const emailParamErrors = (email) => {
  if (typeof email !== 'string') return ['Body Parameter Email is missing'];
  if (!isEmail(email)) return ['Email has invalid format'];
  return [];
};

const rollEmailErrors = (body) => ['email1', 'email2']
  .filter((name) => typeof body[name] !== 'string')
  .map((name) => `Parameter ${name} is not a string`);

// Parses `max` and `times` from a form or JSON body.
// Returns { errors } or { max, times } as integers.
const parseRollArgs = (body) => {
  const errors = [];
  const parsed = {};
  ['max', 'times'].forEach((name) => {
    if (!body[name]) {
      errors.push(`Parameter ${name} is not defined`);
      return;
    }
    const value = parseInt(body[name], 10);
    if (Number.isNaN(value)) {
      errors.push(`Parameter ${name} is not an Integer`);
    } else if (value > MAX_DICE_VALUE) {
      errors.push(`Parameter ${name} has value ${value} which is higher than ${MAX_DICE_VALUE}`);
    } else if (value <= 0) {
      errors.push(`Parameter ${name} has value ${value} which is 0 or less`);
    } else {
      parsed[name] = value;
    }
  });
  return errors.length > 0 ? { errors } : parsed;
};

const decodeToken = (token) => {
  try {
    const information = JSON.parse(Buffer.from(token, 'base64').toString());
    return information !== null && typeof information === 'object' ? information : undefined;
  } catch (e) {
    return undefined;
  }
};

// Parses a verify token (base64 JSON from an emailed link).
// Returns { errors } or { roll, signature, legacy }.
const parseVerifyToken = (token) => {
  const information = decodeToken(token);
  if (!information) return { errors: ['The supplied token parameter is invalid JSON.'] };

  const errors = [];
  const { dice, date, signature } = information;
  if (!Array.isArray(dice)) {
    errors.push('The provided dice parameter is not an array.');
  } else if (!dice.every(Number.isInteger)) {
    errors.push('The provided dice parameter contains values other than integers.');
  }
  if (typeof signature !== 'string') {
    errors.push('The provided signature is not from type string');
  } else if (signature.length !== SIGNATURE_LENGTH) {
    errors.push('The provided signature has a wrong length.');
  }
  if (!Number.isInteger(date)) {
    errors.push('The provided data is not an int');
  }

  // LEGACY: pre-v2 tokens carry only dice, date and signature.
  const legacy = information.v === undefined;
  if (!legacy && information.v !== PAYLOAD_VERSION) {
    errors.push(`The provided token version ${information.v} is not supported.`);
  } else if (!legacy) {
    ['max', 'times'].forEach((name) => {
      if (!Number.isInteger(information[name])) errors.push(`The provided ${name} parameter is not an int`);
    });
    ['email1', 'email2'].forEach((name) => {
      if (typeof information[name] !== 'string') errors.push(`The provided ${name} parameter is not a string`);
    });
  }
  if (errors.length > 0) return { errors };

  const {
    max, times, email1, email2,
  } = information;
  return {
    roll: {
      dice, max, times, email1, email2, date,
    },
    signature,
    legacy,
  };
};

module.exports = {
  isEmail, emailParamErrors, rollEmailErrors, parseRollArgs, parseVerifyToken,
};
