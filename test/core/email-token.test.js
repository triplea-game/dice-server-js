const {
  TOKEN_LIFETIME_MS, deriveTokenKey, createEmailToken, verifyEmailToken,
} = require('../../src/core/email-token');

// Any bytes serve as a PEM here: derivation only needs them to be secret.
const key = deriveTokenKey('-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n');
const otherKey = deriveTokenKey('-----BEGIN PRIVATE KEY-----\nMIIF\n-----END PRIVATE KEY-----\n');

const issuedAt = 1700000000000;
const register = { purpose: 'register', email: 'a@example.com', now: issuedAt };

describe('deriveTokenKey', () => {
  it('yields a 32-byte key that differs from the PEM it came from', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n';

    const derived = deriveTokenKey(pem);

    expect(derived).toHaveLength(32);
    expect(derived.toString()).not.toContain('MIIE');
  });

  it('is deterministic, so a restart derives the same key', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n';

    expect(deriveTokenKey(pem)).toEqual(deriveTokenKey(pem));
  });
});

describe('createEmailToken', () => {
  it('carries the expiry, 24 hours after issue, in front of the MAC', () => {
    const token = createEmailToken(key, register);

    expect(token.split('.')[0]).toBe(String(issuedAt + 24 * 60 * 60 * 1000));
    expect(TOKEN_LIFETIME_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('refuses a purpose it does not know, so a typo cannot mint a free-form token', () => {
    expect(() => createEmailToken(key, { ...register, purpose: 'delete' })).toThrow('Unknown token purpose');
  });
});

describe('verifyEmailToken', () => {
  it('accepts its own token for the same purpose and email before expiry', () => {
    const token = createEmailToken(key, register);
    const justBeforeExpiry = issuedAt + TOKEN_LIFETIME_MS - 1;

    expect(verifyEmailToken(key, token, { ...register, now: justBeforeExpiry })).toBe(true);
  });

  it('rejects the token once its expiry has passed', () => {
    const token = createEmailToken(key, register);
    const atExpiry = issuedAt + TOKEN_LIFETIME_MS;

    expect(verifyEmailToken(key, token, { ...register, now: atExpiry })).toBe(false);
  });

  it('rejects a token issued for another email', () => {
    const token = createEmailToken(key, register);

    expect(verifyEmailToken(key, token, { ...register, email: 'b@example.com' })).toBe(false);
  });

  it('rejects a register token presented as an unregister token', () => {
    const token = createEmailToken(key, register);

    expect(verifyEmailToken(key, token, { ...register, purpose: 'unregister' })).toBe(false);
  });

  it('rejects a token minted under another key', () => {
    const token = createEmailToken(otherKey, register);

    expect(verifyEmailToken(key, token, register)).toBe(false);
  });

  it('rejects a token whose expiry was pushed forward', () => {
    const [, mac] = createEmailToken(key, register).split('.');
    const extended = `${issuedAt + 10 * TOKEN_LIFETIME_MS}.${mac}`;
    const afterRealExpiry = issuedAt + 2 * TOKEN_LIFETIME_MS;

    expect(verifyEmailToken(key, extended, { ...register, now: afterRealExpiry })).toBe(false);
  });

  it.each([
    ['not a token at all', 'forged'],
    ['an empty string', ''],
    ['a MAC of the wrong length', `${issuedAt + 1}.abc`],
    ['an expiry that is not digits', `1.7e12.${'a'.repeat(43)}`],
    ['an overlong expiry', `${'9'.repeat(17)}.${'a'.repeat(43)}`],
  ])('rejects %s without throwing', (_, token) => {
    expect(verifyEmailToken(key, token, register)).toBe(false);
  });

  it('rejects a non-string token or email, as a JSON body can send', () => {
    const token = createEmailToken(key, register);

    expect(verifyEmailToken(key, ['forged'], register)).toBe(false);
    expect(verifyEmailToken(key, token, { ...register, email: ['a@example.com'] })).toBe(false);
  });
});
