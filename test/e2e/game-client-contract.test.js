// Pins what the TripleA game client depends on. The requests mirror
// MartiDiceRoller.java (triplea repo, game-core ... engine/random/): a
// form-encoded POST to /api/roll with times, max, email1, email2 and a
// 'triplea/<version>' User-Agent. The client reads status, result.dice (each
// die 1..max) and, on failure, errors[] as strings.
const { uniqueEmail, postForm, registerEmail } = require('./stack');

const gameClientHeaders = { 'User-Agent': 'triplea/2.7.14' };

describe('POST /api/roll as the TripleA game client sends it', () => {
  it('returns times dice, each between 1 and max', async () => {
    const player1 = uniqueEmail('client1');
    const player2 = uniqueEmail('client2');
    await registerEmail(player1);
    await registerEmail(player2);

    const response = await postForm('/api/roll', {
      times: '20', max: '6', email1: player1, email2: player2,
    }, gameClientHeaders);
    const body = await response.json();

    expect(body.status).toBe('OK');
    expect(body.result.dice).toHaveLength(20);
    body.result.dice.forEach((die) => {
      expect(Number.isInteger(die)).toBe(true);
      expect(die).toBeGreaterThanOrEqual(1);
      expect(die).toBeLessThanOrEqual(6);
    });
  });

  it('answers unregistered players with a non-OK status and string errors', async () => {
    const response = await postForm('/api/roll', {
      times: '1', max: '6', email1: uniqueEmail('stranger1'), email2: uniqueEmail('stranger2'),
    }, gameClientHeaders);
    const body = await response.json();

    expect(body.status).not.toBe('OK');
    expect(body.errors.length).toBeGreaterThan(0);
    body.errors.forEach((error) => expect(typeof error).toBe('string'));
  });
});
