const crypto = require('crypto');
const { Api } = require('../../src/api/api');
const Validator = require('../../src/api/validator');

// Drives the real /api/verify middleware pair (validateVerifyArgs, then
// handleVerify) with a real Validator; no mocks. One RSA-4096 keypair for the
// file because generating one takes about a second.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const toToken = (properties) => Buffer.from(JSON.stringify(properties)).toString('base64');

const fakeResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; },
});

describe('GET /api/verify', () => {
  it('reports a v2 token as valid when every field matches the signature', async () => {
    const validator = new Validator(privateKey, publicKey);
    const roll = {
      dice: [3, 6], max: 6, times: 2, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000,
    };
    const signature = await validator.sign(roll);
    const req = { params: { token: toToken({ v: 2, ...roll, signature }) } };
    const res = fakeResponse();

    Api.validateVerifyArgs(req, res, () => {});
    await Api.prototype.handleVerify.call({ validator }, req, res);

    expect(res.body).toEqual({ status: 'OK', result: { valid: true } });
  });

  it('reports a v2 token as invalid when the claimed max was changed', async () => {
    const validator = new Validator(privateKey, publicKey);
    const roll = {
      dice: [3, 6], max: 6, times: 2, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000,
    };
    const signature = await validator.sign(roll);
    const req = {
      params: {
        token: toToken({
          v: 2, ...roll, max: 20, signature,
        }),
      },
    };
    const res = fakeResponse();

    Api.validateVerifyArgs(req, res, () => {});
    await Api.prototype.handleVerify.call({ validator }, req, res);

    expect(res.body).toEqual({ status: 'OK', result: { valid: false } });
  });

  it('flags a legacy token (no version) as legacy while still verifying it', async () => {
    const validator = new Validator(privateKey, publicKey);
    const legacySign = crypto.createSign('RSA-SHA512');
    legacySign.update(Buffer.from([3, 6, 1700000000000]));
    const signature = legacySign.sign(privateKey, 'base64');
    const req = { params: { token: toToken({ dice: [3, 6], date: 1700000000000, signature }) } };
    const res = fakeResponse();

    Api.validateVerifyArgs(req, res, () => {});
    await Api.prototype.handleVerify.call({ validator }, req, res);

    expect(res.body).toEqual({ status: 'OK', result: { valid: true, legacy: true } });
  });

  it('rejects with 422 a v2 token that is missing the emails', () => {
    const req = {
      params: {
        token: toToken({
          v: 2, dice: [3, 6], max: 6, times: 2, date: 1700000000000, signature: 'A'.repeat(684),
        }),
      },
    };
    const res = fakeResponse();

    Api.validateVerifyArgs(req, res, () => {});

    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual([
      'The provided email1 parameter is not a string',
      'The provided email2 parameter is not a string',
    ]);
  });

  it('rejects with 422 a token with an unknown version', () => {
    const req = {
      params: {
        token: toToken({
          v: 3, dice: [3, 6], date: 1700000000000, signature: 'A'.repeat(684),
        }),
      },
    };
    const res = fakeResponse();

    Api.validateVerifyArgs(req, res, () => {});

    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(['The provided token version 3 is not supported.']);
  });

  it('rejects with 422 a token that decodes to JSON null', () => {
    const req = { params: { token: toToken(null) } };
    const res = fakeResponse();

    Api.validateVerifyArgs(req, res, () => {});

    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toEqual(['The supplied token parameter is invalid JSON.']);
  });
});
