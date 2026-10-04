// Pure request parsing and validation: values in, values out, no I/O.
// Error strings are user-facing; the TripleA client shows them to players.
const { PAYLOAD_VERSION } = require('./signed-payload');

const MAX_DICE_VALUE = 5000;
// The users table stores emails as varchar(254), the RFC 5321 address limit.
const MAX_EMAIL_LENGTH = 254;
const SIGNATURE_LENGTH = 684;

// A dot-atom local part only. nodemailer re-parses addresses as header text,
// so a quoted string, address-list delimiter, whitespace or control character
// in the local part can make it deliver to a different address than the one
// validated here.
const emailPattern = /^[^<>()[\]\\.,;:\s@"\p{Cc}]+(\.[^<>()[\]\\.,;:\s@"\p{Cc}]+)*@(\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\]|([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,})$/u;

const isEmail = (email) => emailPattern.test(email);

// The stored form of an address: the same person may type it with any casing
// or stray whitespace, and lookups treat those as one registration. A
// non-string passes through for the validators to reject.
const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : email);

// Returns the errors for a body's `email` field; empty when it is usable.
const emailParamErrors = (email) => {
  if (typeof email !== 'string') return ['Body Parameter Email is missing'];
  if (email.length > MAX_EMAIL_LENGTH) return [`Email is longer than ${MAX_EMAIL_LENGTH} characters`];
  if (!isEmail(email)) return ['Email has invalid format'];
  return [];
};

// Checks the format too rather than trusting the users table, which may hold
// addresses that emailPattern now refuses.
const rollEmailErrors = (body) => ['email1', 'email2'].flatMap((name) => {
  if (typeof body[name] !== 'string') return [`Parameter ${name} is not a string`];
  if (body[name].length > MAX_EMAIL_LENGTH) return [`Parameter ${name} is longer than ${MAX_EMAIL_LENGTH} characters`];
  if (!isEmail(normalizeEmail(body[name]))) return [`Parameter ${name} has invalid format`];
  return [];
});

// A JSON integer or a form-encoded string of digits (a leading minus is kept
// so "-1" reports as 0 or less); anything else (a float, "6abc") is NaN.
const parseWholeNumber = (value) => {
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return NaN;
};

// Parses `max` and `times` from a form or JSON body.
// Returns { errors } or { max, times } as integers.
const parseRollArgs = (body) => {
  const errors = [];
  const parsed = {};
  ['max', 'times'].forEach((name) => {
    if (body[name] === undefined || body[name] === null || body[name] === '') {
      errors.push(`Parameter ${name} is not defined`);
      return;
    }
    const value = parseWholeNumber(body[name]);
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
  isEmail, normalizeEmail, emailParamErrors, rollEmailErrors, parseRollArgs, parseVerifyToken,
};
