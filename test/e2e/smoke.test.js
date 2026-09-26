// Smoke tests against the built image. They prove the pieces are wired and
// packaged (templates, static files, Postgres, SMTP, signing keys), which a
// dependency bump can break without failing any unit test. Behavior belongs
// in the unit tests; keep this file to a handful of tests.
const {
  appUrl, uniqueEmail, postForm, waitForEmailTo, linkParam, registerEmail,
} = require('./stack');

describe('the built image', () => {
  it('boots and renders the register page', async () => {
    const response = await fetch(`${appUrl}/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Register for the Dice-Server');
  });

  it('serves static assets', async () => {
    const response = await fetch(`${appUrl}/js/ajax-form.js`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('registerForm');
  });

  it('registers two players, rolls, emails the roll, and verifies the emailed link', async () => {
    const player1 = uniqueEmail('smoke1');
    const player2 = uniqueEmail('smoke2');
    await registerEmail(player1);
    await registerEmail(player2);

    const roll = await (await postForm('/api/roll', {
      times: 3, max: 6, email1: player1, email2: player2,
    })).json();
    const email = await waitForEmailTo(player1, 'The dice have been cast!');
    const verifyToken = linkParam(email.HTML, 'token');
    const verify = await (await fetch(`${appUrl}/api/verify/${encodeURIComponent(verifyToken)}`)).json();

    expect(roll.status).toBe('OK');
    expect(email.To.map((to) => to.Address)).toEqual([player1, player2]);
    expect(verify).toEqual({ status: 'OK', result: { valid: true } });
  });

  it('rejects the emailed verify link once a die is changed', async () => {
    const player1 = uniqueEmail('tamper1');
    const player2 = uniqueEmail('tamper2');
    await registerEmail(player1);
    await registerEmail(player2);
    await postForm('/api/roll', {
      times: 1, max: 6, email1: player1, email2: player2,
    });
    const email = await waitForEmailTo(player1, 'The dice have been cast!');
    const token = JSON.parse(Buffer.from(linkParam(email.HTML, 'token'), 'base64').toString());

    const tampered = { ...token, dice: [token.dice[0] === 6 ? 1 : token.dice[0] + 1] };
    const tamperedToken = Buffer.from(JSON.stringify(tampered)).toString('base64');
    const verify = await (await fetch(`${appUrl}/api/verify/${encodeURIComponent(tamperedToken)}`)).json();

    expect(verify).toEqual({ status: 'OK', result: { valid: false } });
  });
});
