// Shutdown against a real HTTP server: the ordering it guarantees (drain
// requests, then close the store) is what keeps a mid-flight roll intact.
const http = require('http');
const { stopServer } = require('../../src/server');
const InMemoryUsers = require('../fakes/in-memory-users');

// A failed assertion skips the test's own release, and a held request would
// otherwise keep jest from exiting.
const cleanups = [];
afterEach(() => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

// Listens on a free port with a handler that holds each request open until
// `release` is called, so a test can stop the server mid-request.
const startHeldServer = async () => {
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  let arrived;
  const requestArrived = new Promise((resolve) => { arrived = resolve; });
  const server = http.createServer(async (req, res) => {
    arrived();
    await released;
    res.end('rolled');
  });
  await new Promise((resolve) => { server.listen(0, resolve); });
  cleanups.push(() => {
    release();
    server.closeAllConnections();
    return new Promise((resolve) => { server.close(() => resolve()); });
  });
  return {
    server, release, requestArrived, url: `http://localhost:${server.address().port}/`,
  };
};

describe('stopServer', () => {
  it('finishes an in-flight request before closing the users store', async () => {
    const {
      server, release, requestArrived, url,
    } = await startHeldServer();
    const users = new InMemoryUsers(['player@example.com']);
    const response = fetch(url);
    await requestArrived;

    const stopped = stopServer({ server, users });
    await new Promise((resolve) => { setImmediate(resolve); });
    expect(await users.checkMail('player@example.com')).toBeTruthy();
    release();

    expect(await (await response).text()).toBe('rolled');
    await stopped;
    await expect(users.checkMail('player@example.com')).rejects.toThrow();
  });

  it('refuses new connections once stopping', async () => {
    const {
      server, release, requestArrived, url,
    } = await startHeldServer();
    const inFlight = fetch(url);
    await requestArrived;

    const stopped = stopServer({ server, users: new InMemoryUsers() });

    await expect(fetch(url)).rejects.toThrow();
    release();
    await inFlight;
    await stopped;
  });
});
