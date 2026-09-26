// Pins what RecordingTransport (test/fakes) assumes of a real nodemailer SMTP
// transport: sendMail resolves with a messageId, and a comma-separated `to`
// reaches every recipient with the subject and HTML intact. Runs against
// Mailpit from test/e2e/compose.yml (via `just e2e`). Guards nodemailer bumps.
const nodemailer = require('nodemailer');
const { uniqueEmail, waitForEmailTo } = require('../e2e/stack');

describe('nodemailer SMTP transport', () => {
  it('delivers one message to both comma-separated recipients with its subject and HTML', async () => {
    const transport = nodemailer.createTransport({ host: 'localhost', port: 11025 });
    const player1 = uniqueEmail('smtp1');
    const player2 = uniqueEmail('smtp2');

    const info = await transport.sendMail({
      from: '"TripleA Dice Server" <dice@example.com>',
      to: `${player1}, ${player2}`,
      subject: 'Contract check',
      html: '<p>dice: [3,5]</p>',
    });
    const received = await waitForEmailTo(player2, 'Contract check');

    expect(info.messageId).toEqual(expect.any(String));
    expect(received.To.map((to) => to.Address)).toEqual([player1, player2]);
    expect(received.HTML).toContain('<p>dice: [3,5]</p>');
  });
});
