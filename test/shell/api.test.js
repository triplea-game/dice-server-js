// Collaboration tests for the /api routes: the real Express app and real
// Validator, with the users store and SMTP transport replaced by in-memory
// fakes that the contract tests in test/contract/ hold to the real behavior.
const crypto = require('crypto');
const { createApp } = require('../../src/app');
const EmailManager = require('../../src/api/email-manager');
const Validator = require('../../src/api/validator');
const InMemoryUsers = require('../fakes/in-memory-users');
const RecordingTransport = require('../fakes/recording-transport');

// One RSA-4096 keypair for the file: generating one takes about a second.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const servers = [];
afterAll(() => Promise.all(servers.map((server) => new Promise((resolve) => {
  server.close(resolve);
}))));

// Starts the app on a free port. Collaborators the test doesn't care about get
// working defaults: a validator on the file's keypair, dice that count up from 1,
// and a clock stopped at 1700000000000.
const startApp = async ({
  users = new InMemoryUsers(),
  transport = new RecordingTransport(),
} = {}) => {
  const server = {
    protocol: 'http', host: 'dice.test', port: 80, baseurl: '',
  };
  const app = createApp({
    users,
    emailManager: new EmailManager({
      users, transport, server, sender: 'dice@dice.test',
    }),
    validator: new Validator(privateKey, publicKey),
    rollDice: async (max, times) => Array.from({ length: times }, (_, i) => (i % max) + 1),
    now: () => 1700000000000,
  });
  const listening = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(listening);
  return `http://localhost:${listening.address().port}`;
};

const postForm = (url, fields) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

const postJson = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const linkParam = (html, param) => decodeURIComponent(html.match(new RegExp(`[?&]${param}=([^"&]+)`))[1]);

describe('POST /api/roll', () => {
  it('rejects with 422 an email1 that is not a string, before checking registration', async () => {
    const url = await startApp();

    const response = await postJson(`${url}/api/roll`, {
      max: 6, times: 1, email1: ['a@example.com'], email2: 'b@example.com',
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['Parameter email1 is not a string'] });
  });

  it('rejects with 403 naming each unregistered player', async () => {
    const url = await startApp({ users: new InMemoryUsers(['a@example.com']) });

    const response = await postForm(`${url}/api/roll`, {
      max: '6', times: '1', email1: 'a@example.com', email2: 'b@example.com',
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['Email "b@example.com" not registered.'] });
  });

  it('rejects with 403 before checking dice arguments, so bad args from strangers get 403', async () => {
    const url = await startApp();

    const response = await postForm(`${url}/api/roll`, {
      max: '9999', times: '1', email1: 'a@example.com', email2: 'b@example.com',
    });

    expect(response.status).toBe(403);
  });

  it('rejects with 422 out-of-range dice arguments from registered players', async () => {
    const url = await startApp({ users: new InMemoryUsers(['a@example.com', 'b@example.com']) });

    const response = await postForm(`${url}/api/roll`, {
      max: '9999', times: '1', email1: 'a@example.com', email2: 'b@example.com',
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ['Parameter max has value 9999 which is higher than 5000'],
    });
  });

  it('returns the rolled dice, the clock time, and a signature over the whole roll', async () => {
    const url = await startApp({ users: new InMemoryUsers(['a@example.com', 'b@example.com']) });

    const body = await (await postForm(`${url}/api/roll`, {
      max: '6', times: '3', email1: 'a@example.com', email2: 'b@example.com',
    })).json();
    const signatureValid = await new Validator(privateKey, publicKey).verify({
      dice: [1, 2, 3], max: 6, times: 3, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000,
    }, body.result.signature);

    expect(body.status).toBe('OK');
    expect(body.result.dice).toEqual([1, 2, 3]);
    expect(body.result.date).toBe(1700000000000);
    expect(signatureValid).toBe(true);
  });

  it('emails one message addressed to both players with a verify link', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ users: new InMemoryUsers(['a@example.com', 'b@example.com']), transport });

    await postForm(`${url}/api/roll`, {
      max: '6', times: '3', email1: 'a@example.com', email2: 'b@example.com',
    });

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].to).toBe('a@example.com, b@example.com');
    expect(transport.sent[0].html).toContain('http://dice.test/verify?token=');
  });
});

describe('POST /api/register', () => {
  it('emails a registration link carrying the email and a token', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ transport });

    const response = await postForm(`${url}/api/register`, { email: 'a+b@example.com' });

    expect(response.status).toBe(200);
    expect(transport.sent[0].to).toBe('a+b@example.com');
    expect(linkParam(transport.sent[0].html, 'email')).toBe('a+b@example.com');
    expect(linkParam(transport.sent[0].html, 'token')).toHaveLength(684);
  });

  it('rejects with 412 an email that is already registered, without sending mail', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ users: new InMemoryUsers(['a@example.com']), transport });

    const response = await postForm(`${url}/api/register`, { email: 'a@example.com' });

    expect(response.status).toBe(412);
    expect(transport.sent).toHaveLength(0);
  });

  it('rejects with 422 a malformed email', async () => {
    const url = await startApp();

    const response = await postForm(`${url}/api/register`, { email: 'not-an-email' });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['Email has invalid format'] });
  });
});

describe('POST /api/register/:token', () => {
  it('registers the email when confirmed with the emailed token', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');

    const response = await postForm(`${url}/api/register/${encodeURIComponent(token)}`, { email: 'a@example.com' });

    expect(response.status).toBe(200);
    expect(await users.checkMail('a@example.com')).toBeTruthy();
  });

  it('rejects with 403 a token that was not emailed', async () => {
    const users = new InMemoryUsers();
    const url = await startApp({ users });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });

    const response = await postForm(`${url}/api/register/forged`, { email: 'a@example.com' });

    expect(response.status).toBe(403);
    expect(await users.checkMail('a@example.com')).toBeNull();
  });

  it('rejects with 403 a token that was already used', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ transport });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });
    const confirmUrl = `${url}/api/register/${encodeURIComponent(linkParam(transport.sent[0].html, 'token'))}`;
    await postForm(confirmUrl, { email: 'a@example.com' });

    const response = await postForm(confirmUrl, { email: 'a@example.com' });

    expect(response.status).toBe(403);
  });
});

describe('POST /api/unregister', () => {
  it('removes a registered email', async () => {
    const users = new InMemoryUsers(['a@example.com']);
    const url = await startApp({ users });

    const response = await postForm(`${url}/api/unregister`, { email: 'a@example.com' });

    expect(response.status).toBe(200);
    expect(await users.checkMail('a@example.com')).toBeNull();
  });

  it('rejects with 412 an email that is not registered', async () => {
    const url = await startApp();

    const response = await postForm(`${url}/api/unregister`, { email: 'a@example.com' });

    expect(response.status).toBe(412);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ['Email "a@example.com" does not exist in the database.'],
    });
  });
});

describe('GET /api/verify/:token', () => {
  it('reports the emailed link of a real roll as valid', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ users: new InMemoryUsers(['a@example.com', 'b@example.com']), transport });
    await postForm(`${url}/api/roll`, {
      max: '6', times: '3', email1: 'a@example.com', email2: 'b@example.com',
    });
    const token = linkParam(transport.sent[0].html, 'token');

    const body = await (await fetch(`${url}/api/verify/${encodeURIComponent(token)}`)).json();

    expect(body).toEqual({ status: 'OK', result: { valid: true } });
  });

  it('reports a roll link as invalid once the claimed max is changed', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ users: new InMemoryUsers(['a@example.com', 'b@example.com']), transport });
    await postForm(`${url}/api/roll`, {
      max: '6', times: '3', email1: 'a@example.com', email2: 'b@example.com',
    });
    const token = JSON.parse(Buffer.from(linkParam(transport.sent[0].html, 'token'), 'base64').toString());
    const tampered = Buffer.from(JSON.stringify({ ...token, max: 20 })).toString('base64');

    const body = await (await fetch(`${url}/api/verify/${encodeURIComponent(tampered)}`)).json();

    expect(body).toEqual({ status: 'OK', result: { valid: false } });
  });

  it('verifies a legacy token under the old scheme and flags it as legacy', async () => {
    const url = await startApp();
    const legacySign = crypto.createSign('RSA-SHA512');
    legacySign.update(Buffer.from([3, 6, 1700000000000]));
    const token = Buffer.from(JSON.stringify({
      dice: [3, 6], date: 1700000000000, signature: legacySign.sign(privateKey, 'base64'),
    })).toString('base64');

    const body = await (await fetch(`${url}/api/verify/${encodeURIComponent(token)}`)).json();

    expect(body).toEqual({ status: 'OK', result: { valid: true, legacy: true } });
  });

  it('rejects with 422 a token that is not base64 JSON', async () => {
    const url = await startApp();

    const response = await fetch(`${url}/api/verify/garbage`);

    expect(response.status).toBe(422);
  });
});

describe('API errors', () => {
  it('answers 500 with a generic message, hiding the internal error', async () => {
    const users = new InMemoryUsers();
    users.checkMail = async () => { throw new Error('there is no parameter $1'); };
    const url = await startApp({ users });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await postForm(`${url}/api/roll`, {
      max: '6', times: '1', email1: 'a@example.com', email2: 'b@example.com',
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['Internal server error'] });
    errorLog.mockRestore();
  });
});
