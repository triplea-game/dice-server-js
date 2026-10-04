// Pins what RecordingTransport (test/fakes) assumes of a real nodemailer SMTP
// transport: sendMail resolves with a messageId, a `to` of { address } objects
// reaches every recipient with the subject and HTML intact, and those objects
// are taken as given rather than re-parsed as header text. Runs against
// Mailpit from test/e2e/compose.yml (via `just e2e`). Guards nodemailer bumps.
const net = require('net');
const nodemailer = require('nodemailer');
const { stackEnv, uniqueEmail, waitForEmailTo } = require('../e2e/stack');

describe('nodemailer SMTP transport', () => {
  it('delivers one message to both { address } recipients with its subject and HTML', async () => {
    const transport = nodemailer.createTransport({ host: 'localhost', port: Number(stackEnv('E2E_SMTP_PORT')) });
    const player1 = uniqueEmail('smtp1');
    const player2 = uniqueEmail('smtp2');

    const info = await transport.sendMail({
      from: '"TripleA Dice Server" <dice@example.com>',
      to: [{ address: player1 }, { address: player2 }],
      subject: 'Contract check',
      html: '<p>dice: [3,5]</p>',
    });
    const received = await waitForEmailTo(player2, 'Contract check');

    expect(info.messageId).toEqual(expect.any(String));
    expect(received.To.map((to) => to.Address)).toEqual([player1, player2]);
    expect(received.HTML).toContain('<p>dice: [3,5]</p>');
  });

  // A string `to` would be re-parsed into y@evil.com alone; EmailManager
  // relies on the object form keeping both intended recipients.
  it('does not re-parse an { address } with a quoted local part into a different recipient', async () => {
    const transport = nodemailer.createTransport({ host: 'localhost', port: Number(stackEnv('E2E_SMTP_PORT')) });
    const player2 = uniqueEmail('smtp-quoted');

    const info = await transport.sendMail({
      from: 'dice@example.com',
      to: [{ address: '"x" <y@evil.com>"@example.com' }, { address: player2 }],
      subject: 'Quoted local part',
      text: 'x',
    });

    expect(info.envelope.to).toHaveLength(2);
    expect(info.envelope.to[0]).toMatch(/@example\.com$/);
    expect(info.envelope.to[1]).toBe(player2);
    expect(info.envelope.to).not.toContain('y@evil.com');
  });

  // What src/core/mail-failure.js keys on to answer 503 rather than 500.
  it('rejects a refused connection with the failed command and a non-envelope code', async () => {
    const occupant = net.createServer();
    await new Promise((resolve) => { occupant.listen(0, '127.0.0.1', resolve); });
    const { port } = occupant.address();
    await new Promise((resolve) => { occupant.close(resolve); });
    const transport = nodemailer.createTransport({ host: '127.0.0.1', port });

    const failure = await transport.sendMail({
      from: 'dice@example.com', to: 'a@example.com', subject: 'x', text: 'x',
    }).catch((err) => err);

    expect(failure).toMatchObject({ command: 'CONN', code: 'ESOCKET' });
  });
});
