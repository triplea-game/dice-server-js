// Stateless tokens for the emailed register/unregister links: an HMAC over
// (purpose, email, expiry), so a link proves the server issued it for that
// email and action, needs no server-side state, and survives restarts.
const crypto = require('crypto');

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PURPOSES = ['register', 'unregister'];

// The private key is only ever loaded to sign rolls; a fixed HKDF label keeps
// the link key separate from that use without needing a second secret.
const deriveTokenKey = (privateKeyPem) => Buffer.from(
  crypto.hkdfSync('sha256', privateKeyPem, '', 'dice-server-js email link token', 32),
);

// Newlines can't appear in an email or purpose, so they can't be spliced.
const mac = (key, purpose, email, expires) => crypto.createHmac('sha256', key)
  .update(`${purpose}\n${email}\n${expires}`)
  .digest('base64url');

const createEmailToken = (key, { purpose, email, now }) => {
  if (!PURPOSES.includes(purpose)) throw new Error(`Unknown token purpose: ${purpose}`);
  const expires = now + TOKEN_LIFETIME_MS;
  return `${expires}.${mac(key, purpose, email, expires)}`;
};

// A millisecond timestamp and a 32-byte base64url MAC; anything else is
// rejected before touching the key, so a flood of junk costs nothing.
const tokenShape = /^(\d{1,16})\.([A-Za-z0-9_-]{43})$/;

const verifyEmailToken = (key, token, { purpose, email, now }) => {
  if (typeof token !== 'string' || typeof email !== 'string') return false;
  const match = tokenShape.exec(token);
  if (!match) return false;
  const expires = Number(match[1]);
  if (expires <= now) return false;
  const expected = Buffer.from(mac(key, purpose, email, expires));
  const actual = Buffer.from(match[2]);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

module.exports = {
  TOKEN_LIFETIME_MS, deriveTokenKey, createEmailToken, verifyEmailToken,
};
