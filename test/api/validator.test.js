const crypto = require('crypto');
const Validator = require('../../src/api/validator');

const { signedPayload } = Validator;

// One real RSA-4096 keypair for the file: generating one takes about a second,
// and the key size is what gives the 684-char signatures the API checks for.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('signedPayload', () => {
  it('serializes every roll field in a fixed order under version 2', () => {
    const payload = signedPayload({
      date: 1700000000000,
      email2: 'b@example.com',
      email1: 'a@example.com',
      times: 3,
      max: 300,
      dice: [1, 299, 300],
    });

    expect(payload).toBe('{"v":2,"dice":[1,299,300],"max":300,"times":3,"email1":"a@example.com","email2":"b@example.com","date":1700000000000}');
  });
});

describe('Validator', () => {
  it('produces a 684-char signature that verifies against the same roll', async () => {
    const validator = new Validator(privateKey, publicKey);
    const roll = {
      dice: [1, 299, 300], max: 300, times: 3, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000,
    };

    const signature = await validator.sign(roll);

    expect(signature).toHaveLength(684);
    expect(await validator.verify(roll, signature)).toBe(true);
  });

  it.each([
    ['a die by +1', { dice: [1, 300, 300] }],
    ['a die by +256', { dice: [1, 555, 300] }],
    ['the date by +1', { date: 1700000000001 }],
    ['the date by +256', { date: 1700000000256 }],
    ['max', { max: 400 }],
    ['times', { times: 4 }],
    ['email1', { email1: 'mallory@example.com' }],
    ['email2', { email2: 'mallory@example.com' }],
  ])('rejects the signature after changing %s', async (_, change) => {
    const validator = new Validator(privateKey, publicKey);
    const roll = {
      dice: [1, 299, 300], max: 300, times: 3, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000,
    };
    const signature = await validator.sign(roll);

    expect(await validator.verify({ ...roll, ...change }, signature)).toBe(false);
  });

  it('verifies a legacy signature made over the low bytes of dice and date', async () => {
    const validator = new Validator(privateKey, publicKey);
    const legacySign = crypto.createSign('RSA-SHA512');
    legacySign.update(Buffer.from([4, 2, 1700000000000]));
    const signature = legacySign.sign(privateKey, 'base64');

    expect(await validator.verifyLegacy([4, 2], 1700000000000, signature)).toBe(true);
  });
});
