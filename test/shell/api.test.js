// Collaboration tests for the /api routes: the real Express app and real
// Validator, with the users store and SMTP transport replaced by in-memory
// fakes that the contract tests in test/contract/ hold to the real behavior.
const crypto = require('crypto');
const { createApp } = require('../../src/app');
const EmailManager = require('../../src/api/email-manager');
const Validator = require('../../src/api/validator');
const { deriveTokenKey, TOKEN_LIFETIME_MS } = require('../../src/core/email-token');
const InMemoryUsers = require('../fakes/in-memory-users');
const RecordingTransport = require('../fakes/recording-transport');

// One RSA-4096 keypair for the file: generating one takes about a second.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const tokenKey = deriveTokenKey(privateKey);

const servers = [];
afterAll(() => Promise.all(servers.map((server) => new Promise((resolve) => {
  server.close(resolve);
}))));

// Starts the app on a free port. Collaborators the test doesn't care about get
// working defaults: a validator on the file's keypair, dice that count up from 1,
// and a clock stopped at 1700000000000 (a test can hand in its own clock).
const startApp = async ({
  users = new InMemoryUsers(),
  transport = new RecordingTransport(),
  now = () => 1700000000000,
} = {}) => {
  const server = {
    protocol: 'http', host: 'dice.test', port: 80, baseurl: '',
  };
  const app = createApp({
    users,
    emailManager: new EmailManager({
      users, transport, server, sender: 'dice@dice.test', tokenKey, now,
    }),
    validator: new Validator(privateKey, publicKey),
    rollDice: async (max, times) => Array.from({ length: times }, (_, i) => (i % max) + 1),
    now,
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

// Links in the emails are HTML attributes, so the '&' between parameters is '&amp;'.
const linkParam = (html, param) => decodeURIComponent(html.match(new RegExp(`[?&](?:amp;)?${param}=([^"&]+)`))[1]);

// What nodemailer rejects with; test/contract/smtp-transport.test.js pins the
// refused-connection shape, the recipient rejection is from the prod log.
const refusedConnection = () => Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:25'), {
  code: 'ESOCKET', command: 'CONN',
});
const rejectedRecipient = (email) => Object.assign(new Error(`Can't send mail - all recipients were rejected: 450 4.1.2 <${email}>: Recipient address rejected: Domain not found`), {
  code: 'EENVELOPE',
  response: `450 4.1.2 <${email}>: Recipient address rejected: Domain not found`,
  responseCode: 450,
  command: 'RCPT TO',
});

describe('POST /api/roll', () => {
  it('rejects with 422 an email1 that is not a string, before checking registration', async () => {
    const url = await startApp();

    const response = await postJson(`${url}/api/roll`, {
      max: 6, times: 1, email1: ['a@example.com'], email2: 'b@example.com',
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['Parameter email1 is not a string'] });
  });

  it('rejects with 422 when the request has no body at all', async () => {
    const url = await startApp();

    const response = await fetch(`${url}/api/roll`, { method: 'POST' });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ['Parameter email1 is not a string', 'Parameter email2 is not a string'],
    });
  });

  it('accepts players whose registered casing differs from the request', async () => {
    const url = await startApp({ users: new InMemoryUsers(['Alice@Example.com', 'b@example.com']) });

    const response = await postForm(`${url}/api/roll`, {
      max: '6', times: '1', email1: 'alice@example.com', email2: ' B@EXAMPLE.COM ',
    });

    expect(response.status).toBe(200);
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

  it('emails the roll time in UTC', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ users: new InMemoryUsers(['a@example.com', 'b@example.com']), transport });

    await postForm(`${url}/api/roll`, {
      max: '6', times: '3', email1: 'a@example.com', email2: 'b@example.com',
    });

    expect(transport.sent[0].html).toContain('Roll-Time: 2023-11-14 22:13:20 UTC');
  });

  it('answers 503 asking for a retry, and no dice, when the mail server is unreachable', async () => {
    const transport = { sendMail: async () => { throw refusedConnection(); } };
    const url = await startApp({ users: new InMemoryUsers(['a@example.com', 'b@example.com']), transport });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await postForm(`${url}/api/roll`, {
      max: '6', times: '3', email1: 'a@example.com', email2: 'b@example.com',
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ["The dice server couldn't send the roll email; please try again."],
    });
    errorLog.mockRestore();
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
    expect(linkParam(transport.sent[0].html, 'token')).toMatch(/^\d+\.[A-Za-z0-9_-]{43}$/);
  });

  it('tells the reader the link lasts 24 hours', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ transport });

    await postForm(`${url}/api/register`, { email: 'a@example.com' });

    expect(transport.sent[0].html).toContain('The link expires after 24 hours.');
  });

  it('escapes the address in the email body while keeping the link usable', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/register`, { email: "o'brien@example.com" });
    const token = linkParam(transport.sent[0].html, 'token');

    const confirm = await postForm(`${url}/api/register/${encodeURIComponent(token)}`, { email: "o'brien@example.com" });

    expect(transport.sent[0].html).not.toContain("o'brien");
    expect(transport.sent[0].html).toContain('&amp;token=');
    expect(confirm.status).toBe(200);
    expect(await users.checkMail("o'brien@example.com")).toBeTruthy();
  });

  it('rejects with 412 an email that is already registered, without sending mail', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ users: new InMemoryUsers(['a@example.com']), transport });

    const response = await postForm(`${url}/api/register`, { email: 'a@example.com' });

    expect(response.status).toBe(412);
    expect(transport.sent).toHaveLength(0);
  });

  it('rejects with 412 an email registered under different casing', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ users: new InMemoryUsers(['Alice@Example.com']), transport });

    const response = await postForm(`${url}/api/register`, { email: 'alice@example.com' });

    expect(response.status).toBe(412);
    expect(transport.sent).toHaveLength(0);
  });

  it('rejects with 422 an email longer than the users column, without sending mail', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ transport });

    const response = await postForm(`${url}/api/register`, { email: `${'a'.repeat(243)}@example.com` });

    expect(response.status).toBe(422);
    expect(transport.sent).toHaveLength(0);
  });

  it('rejects with 422 a malformed email', async () => {
    const url = await startApp();

    const response = await postForm(`${url}/api/register`, { email: 'not-an-email' });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['Email has invalid format'] });
  });

  it('answers 422 quoting the mail server when it rejects the recipient', async () => {
    const transport = { sendMail: async () => { throw rejectedRecipient('a@nowhere.invalid'); } };
    const url = await startApp({ transport });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await postForm(`${url}/api/register`, { email: 'a@nowhere.invalid' });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      status: 'Error',
      errors: ['The mail server rejected the address: 450 4.1.2 <a@nowhere.invalid>: Recipient address rejected: Domain not found'],
    });
    errorLog.mockRestore();
  });

  it('answers 503 asking for a retry when the mail server is unreachable', async () => {
    const transport = { sendMail: async () => { throw refusedConnection(); } };
    const url = await startApp({ transport });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await postForm(`${url}/api/register`, { email: 'a@example.com' });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ["The dice server couldn't send the verification email; please try again."],
    });
    errorLog.mockRestore();
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

  it('still registers after a restart, since the link needs no server state', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const before = await startApp({ users, transport });
    await postForm(`${before}/api/register`, { email: 'a@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');
    const after = await startApp({ users });

    const response = await postForm(`${after}/api/register/${encodeURIComponent(token)}`, { email: 'a@example.com' });

    expect(response.status).toBe(200);
    expect(await users.checkMail('a@example.com')).toBeTruthy();
  });

  it('stores the address lowercased, whichever casing the request and confirmation used', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/register`, { email: 'Alice@Example.com' });
    const token = linkParam(transport.sent[0].html, 'token');

    const response = await postForm(`${url}/api/register/${encodeURIComponent(token)}`, { email: 'ALICE@example.com' });

    expect(response.status).toBe(200);
    expect(transport.sent[0].to).toBe('alice@example.com');
    expect(await users.checkMail('alice@example.com')).toEqual({ email: 'alice@example.com' });
  });

  it('rejects with 403 a token that was not emailed, telling the user to register again', async () => {
    const users = new InMemoryUsers();
    const url = await startApp({ users });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });

    const response = await postForm(`${url}/api/register/forged`, { email: 'a@example.com' });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ['This link is invalid or has expired. Please register again.'],
    });
    expect(await users.checkMail('a@example.com')).toBeNull();
  });

  it('keeps the emailed link working after a wrong token was tried', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');
    await postForm(`${url}/api/register/forged`, { email: 'a@example.com' });

    const response = await postForm(`${url}/api/register/${encodeURIComponent(token)}`, { email: 'a@example.com' });

    expect(response.status).toBe(200);
    expect(await users.checkMail('a@example.com')).toBeTruthy();
  });

  it('keeps the first emailed link working after registration is requested again', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });
    const firstToken = linkParam(transport.sent[0].html, 'token');
    await postForm(`${url}/api/register`, { email: 'a@example.com' });

    const response = await postForm(`${url}/api/register/${encodeURIComponent(firstToken)}`, { email: 'a@example.com' });

    expect(response.status).toBe(200);
    expect(await users.checkMail('a@example.com')).toBeTruthy();
  });

  it('rejects with 403 the emailed link for a different email', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');

    const response = await postForm(`${url}/api/register/${encodeURIComponent(token)}`, { email: 'b@example.com' });

    expect(response.status).toBe(403);
    expect(await users.checkMail('b@example.com')).toBeNull();
  });

  it('rejects with 403 a link that is 24 hours old', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    let clock = 1700000000000;
    const url = await startApp({ users, transport, now: () => clock });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');
    clock += TOKEN_LIFETIME_MS;

    const response = await postForm(`${url}/api/register/${encodeURIComponent(token)}`, { email: 'a@example.com' });

    expect(response.status).toBe(403);
    expect(await users.checkMail('a@example.com')).toBeNull();
  });

  it('answers OK again when the link is clicked a second time', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });
    const confirmUrl = `${url}/api/register/${encodeURIComponent(linkParam(transport.sent[0].html, 'token'))}`;
    await postForm(confirmUrl, { email: 'a@example.com' });

    const response = await postForm(confirmUrl, { email: 'a@example.com' });

    expect(response.status).toBe(200);
    expect(await users.checkMail('a@example.com')).toBeTruthy();
  });
});

describe('POST /api/unregister', () => {
  it('emails a confirmation link to a registered address instead of removing it', async () => {
    const users = new InMemoryUsers(['a+b@example.com']);
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });

    const response = await postForm(`${url}/api/unregister`, { email: 'a+b@example.com' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'OK' });
    expect(await users.checkMail('a+b@example.com')).toBeTruthy();
    expect(transport.sent[0].to).toBe('a+b@example.com');
    expect(transport.sent[0].html).toContain('http://dice.test/unregister?email=a%2Bb%40example.com&amp;token=');
    expect(transport.sent[0].html).toContain('The link expires after 24 hours.');
  });

  it('names the button on the page its link opens', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ users: new InMemoryUsers(['a@example.com']), transport });
    await postForm(`${url}/api/unregister`, { email: 'a@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');

    const page = await (await fetch(`${url}/unregister?email=a%40example.com&token=${encodeURIComponent(token)}`)).text();

    expect(page).toContain('<button id="submit-button" type="submit" name="button">Confirm Unregistering!</button>');
    expect(transport.sent[0].html).toContain("then 'Confirm Unregistering!' on the page it opens");
  });

  it('answers 503 asking for a retry when the mail server is unreachable', async () => {
    const transport = { sendMail: async () => { throw refusedConnection(); } };
    const url = await startApp({ users: new InMemoryUsers(['a@example.com']), transport });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await postForm(`${url}/api/unregister`, { email: 'a@example.com' });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ["The dice server couldn't send the unregister email; please try again."],
    });
    errorLog.mockRestore();
  });

  it('answers the same OK for an unregistered address, without sending mail', async () => {
    const transport = new RecordingTransport();
    const url = await startApp({ transport });

    const response = await postForm(`${url}/api/unregister`, { email: 'a@example.com' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'OK' });
    expect(transport.sent).toHaveLength(0);
  });

  it('rejects with 422 a malformed email', async () => {
    const url = await startApp();

    const response = await postForm(`${url}/api/unregister`, { email: 'not-an-email' });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['Email has invalid format'] });
  });
});

describe('POST /api/unregister/:token', () => {
  it('removes the email when confirmed with the emailed token', async () => {
    const users = new InMemoryUsers(['a@example.com']);
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/unregister`, { email: 'a@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');

    const response = await postForm(`${url}/api/unregister/${encodeURIComponent(token)}`, { email: 'a@example.com' });

    expect(response.status).toBe(200);
    expect(await users.checkMail('a@example.com')).toBeNull();
  });

  it('removes an email registered under different casing than the request and confirmation', async () => {
    const users = new InMemoryUsers(['Alice@Example.com']);
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/unregister`, { email: 'alice@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');

    const response = await postForm(`${url}/api/unregister/${encodeURIComponent(token)}`, { email: 'ALICE@example.com' });

    expect(response.status).toBe(200);
    expect(transport.sent[0].to).toBe('alice@example.com');
    expect(await users.checkMail('alice@example.com')).toBeNull();
  });

  it('rejects with 403 a token that was not emailed, telling the user to unregister again', async () => {
    const users = new InMemoryUsers(['a@example.com']);
    const url = await startApp({ users });

    const response = await postForm(`${url}/api/unregister/forged`, { email: 'a@example.com' });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ['This link is invalid or has expired. Please unregister again.'],
    });
    expect(await users.checkMail('a@example.com')).toBeTruthy();
  });

  it('rejects with 403 a registration token, which cannot double as an unregister one', async () => {
    const users = new InMemoryUsers();
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/register`, { email: 'a@example.com' });
    const registerToken = linkParam(transport.sent[0].html, 'token');
    await postForm(`${url}/api/register/${encodeURIComponent(registerToken)}`, { email: 'a@example.com' });

    const response = await postForm(`${url}/api/unregister/${encodeURIComponent(registerToken)}`, { email: 'a@example.com' });

    expect(response.status).toBe(403);
    expect(await users.checkMail('a@example.com')).toBeTruthy();
  });

  it('rejects with 403 the emailed link for a different email', async () => {
    const users = new InMemoryUsers(['a@example.com', 'b@example.com']);
    const transport = new RecordingTransport();
    const url = await startApp({ users, transport });
    await postForm(`${url}/api/unregister`, { email: 'a@example.com' });
    const token = linkParam(transport.sent[0].html, 'token');

    const response = await postForm(`${url}/api/unregister/${encodeURIComponent(token)}`, { email: 'b@example.com' });

    expect(response.status).toBe(403);
    expect(await users.checkMail('b@example.com')).toBeTruthy();
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

  it('answers 400 with a fixed message, not a stack trace, for malformed JSON', async () => {
    const url = await startApp();
    const warnLog = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await fetch(`${url}/api/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"canary-7f3a',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['The request body is not valid JSON.'] });
    // The logged line must not carry `err`: body-parser hangs the raw body on it.
    expect(warnLog.mock.calls).toEqual([
      ['[app] Rejected %s %s with %d: %s', 'POST', '/api/roll', 400, 'entity.parse.failed'],
    ]);
    expect(errorLog).not.toHaveBeenCalled();
    warnLog.mockRestore();
    errorLog.mockRestore();
  });

  it('answers the same JSON 400 outside /api, since the handler is app-wide', async () => {
    const url = await startApp();
    const warnLog = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await fetch(`${url}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['The request body is not valid JSON.'] });
    warnLog.mockRestore();
  });

  it('answers 400 naming the nesting for a form nested past the 32-level default', async () => {
    const url = await startApp();
    const warnLog = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await fetch(`${url}/api/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `a${'[b]'.repeat(33)}=1`,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['The request body nests form fields too deeply.'] });
    warnLog.mockRestore();
  });

  it('answers 415 naming the charset for a JSON body in an unsupported charset', async () => {
    const url = await startApp();
    const warnLog = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await fetch(`${url}/api/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=latin1' },
      body: '{}',
    });

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      status: 'Error', errors: ['The request body uses an unsupported charset; send it as UTF-8.'],
    });
    warnLog.mockRestore();
  });

  it('answers 413 naming the field count for a form over the 1000-field default', async () => {
    const url = await startApp();
    const warnLog = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fields = Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`f${i}`, '1']));

    const response = await postForm(`${url}/api/roll`, fields);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['The request body has too many fields.'] });
    warnLog.mockRestore();
  });

  it('answers 413 with a fixed message, not a stack trace, for an oversized form', async () => {
    const url = await startApp();
    const warnLog = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Twice express.urlencoded's default 100kb limit.
    const overDefaultLimit = 'x'.repeat(200 * 1024);

    const response = await postForm(`${url}/api/roll`, { max: overDefaultLimit });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['The request body is too large.'] });
    warnLog.mockRestore();
  });
});

describe('GET /health', () => {
  it('reports OK when the users store answers a ping', async () => {
    const url = await startApp();

    const response = await fetch(`${url}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'OK' });
  });

  it('reports 503 when the users store cannot be reached', async () => {
    const users = new InMemoryUsers();
    users.ping = async () => { throw new Error('connect ECONNREFUSED'); };
    const url = await startApp({ users });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await fetch(`${url}/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'Error', errors: ['Database unavailable'] });
    errorLog.mockRestore();
  });
});
