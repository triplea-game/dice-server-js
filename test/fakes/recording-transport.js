// Stands in for a nodemailer transport: keeps each message instead of sending.
// test/contract/smtp-transport.test.js pins the real transport's behavior for
// the same message shape.
class RecordingTransport {
  constructor() {
    this.sent = [];
  }

  async sendMail(message) {
    this.sent.push(message);
    return { messageId: `<recorded-${this.sent.length}@test>`, response: '250 recorded' };
  }
}

module.exports = RecordingTransport;
