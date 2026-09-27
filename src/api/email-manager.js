const { Liquid } = require('liquidjs');
const path = require('path');
const { createEmailToken, verifyEmailToken } = require('../core/email-token');
const {
  registrationLink, unregisterLink, unregisterConfirmLink, verifyLink,
} = require('../core/links');

// Registration and roll emails. `users` is the DbHandler (or anything with its
// checkMail/addUser/removeUser), `transport` a nodemailer transport, `tokenKey`
// the key from deriveTokenKey, and `now` the clock the link tokens expire by.
class EmailManager {
  constructor({
    users, transport, server, sender, tokenKey, now = Date.now,
  }) {
    this.users = users;
    this.transport = transport;
    this.server = server;
    this.sender = sender;
    this.tokenKey = tokenKey;
    this.now = now;
    this.engine = new Liquid({
      root: path.resolve(__dirname, '../../public/email-templates/'),
      extname: '.html',
    });
  }

  async verifyEmail(email, token) {
    if (!verifyEmailToken(this.tokenKey, token, { purpose: 'register', email, now: this.now() })) {
      return false;
    }
    // The link stays valid until it expires, so a second click must not fail
    // on the duplicate row.
    if (await this.users.checkMail(email)) {
      return true;
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
    const token = createEmailToken(this.tokenKey, { purpose: 'register', email, now: this.now() });

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

  // Emails a signed unregister link, and only to a registered address: the
  // mailbox owner is the one who gets to remove it. Callers answer the same
  // way either way so the request doesn't reveal who is registered.
  async requestUnregister(email) {
    let registered;
    try {
      registered = await this.users.checkMail(email);
    } catch (err) {
      console.error('[email] requestUnregister - DB error checking email: %s', email, err);
      throw err;
    }
    if (!registered) {
      console.log('[email] requestUnregister - not registered, no email sent: %s', email);
      return;
    }
    const token = createEmailToken(this.tokenKey, { purpose: 'unregister', email, now: this.now() });

    const subject = 'Confirm unregistering your E-Mail';
    const content = await this.engine.renderFile('confirm-unregister.html', {
      subject,
      url: unregisterConfirmLink(this.server, email, token),
      host: this.server.host,
      unsub: unregisterLink(this.server, email),
    });

    console.log('[email] requestUnregister - sending confirmation email to: %s', email);
    try {
      await this.transport.sendMail({
        from: this.sender,
        to: email,
        subject,
        html: content,
      });
    } catch (err) {
      console.error('[email] requestUnregister - failed to send email to: %s -', email, err);
      throw err;
    }
    console.log('[email] requestUnregister - email sent successfully to: %s', email);
  }

  async confirmUnregister(email, token) {
    if (!verifyEmailToken(this.tokenKey, token, { purpose: 'unregister', email, now: this.now() })) {
      return false;
    }
    try {
      await this.users.removeUser(email);
    } catch (err) {
      console.error('[email] confirmUnregister - DB error removing user: %s', email, err);
      throw err;
    }
    return true;
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
