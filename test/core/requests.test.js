const {
  isEmail, normalizeEmail, emailParamErrors, rollEmailErrors, parseRollArgs, parseVerifyToken,
} = require('../../src/core/requests');

const toToken = (properties) => Buffer.from(JSON.stringify(properties)).toString('base64');

describe('isEmail', () => {
  it('accepts a plain address', () => {
    expect(isEmail('name.sirname@provider.tl')).toBe(true);
  });

  it('accepts a plus-tagged address', () => {
    expect(isEmail('prefix+something@gmail.com')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isEmail('')).toBe(false);
  });

  it('rejects a domain without a top-level domain', () => {
    expect(isEmail('me@google')).toBe(false);
  });

  it('rejects two addresses separated by a space', () => {
    expect(isEmail('me@gmail.com you@gmail.com')).toBe(false);
  });

  it('rejects a display-name address', () => {
    expect(isEmail('"Display Name" <actual@email.com>')).toBe(false);
  });

  it('accepts a plus-tagged address on a subdomain', () => {
    expect(isEmail('player+dice@mail.example.co.uk')).toBe(true);
  });

  // nodemailer's address parser reads this as display name "x @example.com"
  // for y@evil.com, so mail meant for example.com goes to evil.com.
  it('rejects a quoted local part that hides a different recipient', () => {
    expect(isEmail('"x" <y@evil.com>"@example.com')).toBe(false);
  });

  it('rejects a plain quoted local part', () => {
    expect(isEmail('"john"@example.com')).toBe(false);
  });

  // nodemailer drops control characters, so this would be sent to ab@example.com.
  it('rejects a control character in the local part', () => {
    expect(isEmail('a\u0001b@example.com')).toBe(false);
  });

  it.each([
    ['<', 'a<b@example.com'],
    ['>', 'a>b@example.com'],
    [',', 'a,b@example.com'],
    [';', 'a;b@example.com'],
    ['parentheses', 'a(b)@example.com'],
    ['a space', 'a b@example.com'],
    ['a tab', 'a\tb@example.com'],
    ['DEL', 'a\u007fb@example.com'],
  ])('rejects a local part containing %s', (_, email) => {
    expect(isEmail(email)).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('lowercases the address and trims surrounding whitespace', () => {
    expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com');
  });
});

describe('emailParamErrors', () => {
  it('returns no errors for a valid address', () => {
    expect(emailParamErrors('a@example.com')).toEqual([]);
  });

  it('accepts an address of 254 characters, the users column width', () => {
    expect(emailParamErrors(`${'a'.repeat(242)}@example.com`)).toEqual([]);
  });

  it('rejects an address of 255 characters before checking its format', () => {
    expect(emailParamErrors(`${'a'.repeat(243)}@example.com`)).toEqual(['Email is longer than 254 characters']);
  });

  it('reports a missing email', () => {
    expect(emailParamErrors(undefined)).toEqual(['Body Parameter Email is missing']);
  });

  it('reports a non-string email, such as a repeated form field', () => {
    expect(emailParamErrors(['a@example.com', 'b@example.com'])).toEqual(['Body Parameter Email is missing']);
  });

  it('reports a malformed email', () => {
    expect(emailParamErrors('not-an-email')).toEqual(['Email has invalid format']);
  });
});

describe('rollEmailErrors', () => {
  it('returns no errors when both emails are strings', () => {
    expect(rollEmailErrors({ email1: 'a@example.com', email2: 'b@example.com' })).toEqual([]);
  });

  it('reports each email that is not a string', () => {
    expect(rollEmailErrors({ email1: ['a@example.com'] })).toEqual([
      'Parameter email1 is not a string',
      'Parameter email2 is not a string',
    ]);
  });

  it('rejects an email of 255 characters, which would not fit the users column', () => {
    expect(rollEmailErrors({ email1: `${'a'.repeat(243)}@example.com`, email2: 'b@example.com' })).toEqual([
      'Parameter email1 is longer than 254 characters',
    ]);
  });

  // The users table may hold such an address, so registration alone is no guard.
  it('rejects an email with a quoted local part', () => {
    expect(rollEmailErrors({ email1: 'a@example.com', email2: '"x" <y@evil.com>"@example.com' })).toEqual([
      'Parameter email2 has invalid format',
    ]);
  });

  it('accepts an email with surrounding whitespace and capitals, which the roll normalizes away', () => {
    expect(rollEmailErrors({ email1: ' A@Example.com ', email2: 'b@example.com' })).toEqual([]);
  });
});

describe('parseRollArgs', () => {
  it('parses form-encoded string values into integers', () => {
    expect(parseRollArgs({ max: '6', times: '3' })).toEqual({ max: 6, times: 3 });
  });

  it('accepts the upper limit of 5000', () => {
    expect(parseRollArgs({ max: 5000, times: 5000 })).toEqual({ max: 5000, times: 5000 });
  });

  it('rejects times above 5000', () => {
    expect(parseRollArgs({ max: 6, times: 5001 })).toEqual({
      errors: ['Parameter times has value 5001 which is higher than 5000'],
    });
  });

  it('rejects max above 5000', () => {
    expect(parseRollArgs({ max: 5001, times: 1 })).toEqual({
      errors: ['Parameter max has value 5001 which is higher than 5000'],
    });
  });

  it('rejects a negative max', () => {
    expect(parseRollArgs({ max: -1, times: 1 })).toEqual({
      errors: ['Parameter max has value -1 which is 0 or less'],
    });
  });

  it('rejects a form-encoded zero as 0 or less', () => {
    expect(parseRollArgs({ max: '6', times: '0' })).toEqual({
      errors: ['Parameter times has value 0 which is 0 or less'],
    });
  });

  it('rejects a JSON zero as 0 or less', () => {
    expect(parseRollArgs({ max: 6, times: 0 })).toEqual({
      errors: ['Parameter times has value 0 which is 0 or less'],
    });
  });

  it('rejects a form-encoded negative number as 0 or less', () => {
    expect(parseRollArgs({ max: '-1', times: 1 })).toEqual({
      errors: ['Parameter max has value -1 which is 0 or less'],
    });
  });

  it('rejects a value that is not a number', () => {
    expect(parseRollArgs({ max: 'six', times: 1 })).toEqual({
      errors: ['Parameter max is not an Integer'],
    });
  });

  it('rejects a number with trailing garbage rather than reading its prefix', () => {
    expect(parseRollArgs({ max: '6abc', times: 1 })).toEqual({
      errors: ['Parameter max is not an Integer'],
    });
  });

  it('rejects a form-encoded decimal rather than truncating it', () => {
    expect(parseRollArgs({ max: '1.9', times: 1 })).toEqual({
      errors: ['Parameter max is not an Integer'],
    });
  });

  it('rejects a JSON decimal rather than truncating it', () => {
    expect(parseRollArgs({ max: 6, times: 2.5 })).toEqual({
      errors: ['Parameter times is not an Integer'],
    });
  });

  it('reports an empty form field as not defined', () => {
    expect(parseRollArgs({ max: '', times: '1' })).toEqual({
      errors: ['Parameter max is not defined'],
    });
  });

  it('reports both missing parameters', () => {
    expect(parseRollArgs({})).toEqual({
      errors: ['Parameter max is not defined', 'Parameter times is not defined'],
    });
  });
});

describe('parseVerifyToken', () => {
  it('parses a v2 token into the roll, signature, and not-legacy', () => {
    const signature = 'S'.repeat(684);
    const token = toToken({
      v: 2, dice: [3, 6], max: 6, times: 2, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000, signature,
    });

    expect(parseVerifyToken(token)).toEqual({
      roll: {
        dice: [3, 6], max: 6, times: 2, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000,
      },
      signature,
      legacy: false,
    });
  });

  it('marks a token without a version as legacy', () => {
    const token = toToken({ dice: [3, 6], date: 1700000000000, signature: 'S'.repeat(684) });

    expect(parseVerifyToken(token).legacy).toBe(true);
  });

  it('rejects a v2 token that is missing the emails', () => {
    const token = toToken({
      v: 2, dice: [3, 6], max: 6, times: 2, date: 1700000000000, signature: 'S'.repeat(684),
    });

    expect(parseVerifyToken(token)).toEqual({
      errors: [
        'The provided email1 parameter is not a string',
        'The provided email2 parameter is not a string',
      ],
    });
  });

  it('rejects an unknown token version', () => {
    const token = toToken({
      v: 3, dice: [3, 6], date: 1700000000000, signature: 'S'.repeat(684),
    });

    expect(parseVerifyToken(token)).toEqual({
      errors: ['The provided token version 3 is not supported.'],
    });
  });

  it('rejects a signature that is not 684 characters, the length of an RSA-4096 signature', () => {
    const token = toToken({ dice: [3], date: 1700000000000, signature: 'S'.repeat(683) });

    expect(parseVerifyToken(token)).toEqual({ errors: ['The provided signature has a wrong length.'] });
  });

  it('rejects dice that are not all integers', () => {
    const token = toToken({ dice: [3, 'six'], date: 1700000000000, signature: 'S'.repeat(684) });

    expect(parseVerifyToken(token)).toEqual({
      errors: ['The provided dice parameter contains values other than integers.'],
    });
  });

  it('rejects a token that decodes to JSON null', () => {
    expect(parseVerifyToken(toToken(null))).toEqual({
      errors: ['The supplied token parameter is invalid JSON.'],
    });
  });

  it('rejects a token that is not base64 JSON', () => {
    expect(parseVerifyToken('not a token')).toEqual({
      errors: ['The supplied token parameter is invalid JSON.'],
    });
  });
});
