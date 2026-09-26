const crypto = require('crypto');
const { Liquid } = require('liquidjs');
const path = require('path');
const TokenCache = require('../util/token-cache');
const { registrationLink, unregisterLink, verifyLink } = require('../core/links');

// Registration and roll emails. `users` is the DbHandler (or anything with its
// checkMail/addUser/removeUser), `transport` a nodemailer transport.
class EmailManager {
  constructor({
    users, transport, server, sender,
  }) {
    this.users = users;
    this.transport = transport;
    this.server = server;
    this.sender = sender;
    this.pendingTokens = new TokenCache();
    this.engine = new Liquid({
      root: path.resolve(__dirname, '../../public/email-templates/'),
      extname: '.html',
    });
  }

  async verifyEmail(email, token) {
    if (!this.pendingTokens.verify(email, token)) {
      return false;
    }
    try {
      await this.users.addUser(email);
    } catch (err) {
      console.error('[email] verifyEmail - DB error adding user: %s', email, err);
      throw err;
    }
    return true;
  }

  async registerEmail(email) {
    console.log('[email] registerEmail - checking if already registered: %s', email);
    let alreadyRegistered;
    try {
      alreadyRegistered = await this.users.checkMail(email);
    } catch (err) {
      console.error('[email] registerEmail - DB error checking email: %s', email, err);
      throw err;
    }
    if (alreadyRegistered) {
      console.log('[email] registerEmail - already registered: %s', email);
      return false;
    }
    const token = crypto.randomBytes(512).toString('base64');
    this.pendingTokens.put(email, token);

    const subject = 'Verify your E-Mail';
    const content = await this.engine.renderFile('verify-email.html', {
      subject,
      url: registrationLink(this.server, email, token),
      host: this.server.host,
      unsub: unregisterLink(this.server, email),
    });

    console.log('[email] registerEmail - sending verification email to: %s', email);
    let info;
    try {
      info = await this.transport.sendMail({
        from: this.sender,
        to: email,
        subject,
        html: content,
      });
    } catch (err) {
      console.error('[email] registerEmail - failed to send email to: %s -', email, err);
      throw err;
    }
    console.log('[email] registerEmail - email sent successfully to: %s', email);
    return info;
  }

  unregisterEmail(email) {
    return this.users.removeUser(email).catch((err) => {
      console.error('[email] unregisterEmail - DB error removing user: %s', email, err);
      throw err;
    });
  }

  async sendDiceVerificationEmail(roll, signature) {
    const subject = 'The dice have been cast!';
    const content = await this.engine.renderFile('verify-dice.html', {
      subject,
      date: new Date(roll.date).toLocaleString('en-US'),
      dice: JSON.stringify(roll.dice),
      url: verifyLink(this.server, roll, signature),
      unsub: unregisterLink(this.server),
    });

    return this.transport.sendMail({
      from: this.sender,
      to: `${roll.email1}, ${roll.email2}`,
      subject,
      html: content,
    });
  }
}

module.exports = EmailManager;
