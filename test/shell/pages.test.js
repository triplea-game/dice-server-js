// The HTML pages, rendered by the real app and templates. The API
// collaborators are unused here, so the app gets an in-memory users store and
// nothing else.
const { createApp } = require('../../src/app');
const InMemoryUsers = require('../fakes/in-memory-users');

const servers = [];
afterAll(() => Promise.all(servers.map((server) => new Promise((resolve) => {
  server.close(resolve);
}))));

const startApp = async () => {
  const app = createApp({ users: new InMemoryUsers() });
  const listening = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(listening);
  return `http://localhost:${listening.address().port}`;
};

const toToken = (properties) => encodeURIComponent(Buffer.from(JSON.stringify(properties)).toString('base64'));

describe('GET /', () => {
  it('renders the registration form posting to the register API', async () => {
    const url = await startApp();

    const html = await (await fetch(`${url}/`)).text();

    expect(html).toContain('<form id="form" action="./api/register" method="POST">');
  });
});

describe('GET /verify', () => {
  it('shows a v2 roll with its range and players, and no legacy warning', async () => {
    const url = await startApp();
    const token = toToken({
      v: 2, dice: [3, 6], max: 6, times: 2, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000, signature: 'S',
    });

    const html = await (await fetch(`${url}/verify?token=${token}`)).text();

    expect(html).toContain('<p>Dice Rolled: 3, 6</p>');
    expect(html).toContain('<p>2 dice with max 6, rolled for a@example.com and b@example.com</p>');
    expect(html).not.toContain('old-format roll');
  });

  it('warns that a legacy roll is only weakly protected', async () => {
    const url = await startApp();
    const token = toToken({ dice: [3, 6], date: 1700000000000, signature: 'S' });

    const html = await (await fetch(`${url}/verify?token=${token}`)).text();

    expect(html).toContain('this is an old-format roll');
  });

  it('points the verify form at the API with the same token', async () => {
    const url = await startApp();
    const token = toToken({ dice: [3], date: 1700000000000, signature: 'S' });

    const html = await (await fetch(`${url}/verify?token=${token}`)).text();

    expect(html).toContain(`action="./api/verify/${token}"`);
  });

  it('says the link is invalid when there is no token', async () => {
    const url = await startApp();

    const html = await (await fetch(`${url}/verify`)).text();

    expect(html).toContain('<h2>Invalid link!</h2>');
  });
});

describe('GET /register', () => {
  it('renders a confirm form carrying the email and posting the token to the API', async () => {
    const url = await startApp();

    const html = await (await fetch(`${url}/register?email=a%40example.com&token=ab%2B%2F%3D`)).text();

    expect(html).toContain('<input type="hidden" name="email" value="a@example.com" required>');
    expect(html).toContain('action="./api/register/ab%2B%2F%3D"');
  });
});

describe('GET /unregister', () => {
  it('prefills the email from the link', async () => {
    const url = await startApp();

    const html = await (await fetch(`${url}/unregister?email=a%40example.com`)).text();

    expect(html).toContain('<form id="form" action="./api/unregister" method="POST">');
    expect(html).toContain('value="a@example.com"');
  });

  it('renders a confirm form carrying the email and posting the token to the API when the link has one', async () => {
    const url = await startApp();

    const html = await (await fetch(`${url}/unregister?email=a%40example.com&token=1700.ab_-`)).text();

    expect(html).toContain('<input type="hidden" name="email" value="a@example.com" required>');
    expect(html).toContain('action="./api/unregister/1700.ab_-"');
  });

  it('calls the arguments invalid when a token comes without an email', async () => {
    const url = await startApp();

    const html = await (await fetch(`${url}/unregister?token=1700.ab_-`)).text();

    expect(html).toContain('<h2>Invalid Arguments!</h2>');
  });
});
