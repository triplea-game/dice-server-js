const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Liquid = require('liquidjs');
const path = require('path');
const TokenCache = require('../util/token-cache.js');

const getServerBaseUrl = ({
  port, protocol, host, baseurl,
}) => {
  const isCommonPort = () => (port === 80 && protocol === 'http') || (port === 443 && protocol === 'https');
  return `${protocol}://${host}${isCommonPort() ? '' : (`:${port}`)}${baseurl}`;
};

class EmailManager {
  constructor(dbhandler, transport, server, emailsender) {
    this.dbhandler = dbhandler;
    this.emailMap = new TokenCache();
    const transportOptions = {
      ...transport,
      connectionTimeout: 10000,
      socketTimeout: 10000,
    };
    console.log('[email] Creating SMTP transport - host: %s port: %s', transport.host, transport.port);
    this.transport = nodemailer.createTransport(transportOptions);
    this.server = server;
    this.emailsender = emailsender;
    this.engine = Liquid({
      root: path.resolve(__dirname, '../../public/email-templates/'),
      extname: '.html',
    });
  }

  async verifyEmail(email, token) {
    if (!this.emailMap.verify(email, token)) {
      return false;
    }
    try {
      await this.dbhandler.addUser(email);
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
      alreadyRegistered = await this.dbhandler.checkMail(email);
    } catch (err) {
      console.error('[email] registerEmail - DB error checking email: %s', email, err);
      throw err;
    }
    if (alreadyRegistered) {
      console.log('[email] registerEmail - already registered: %s', email);
      return false;
    }
    const token = crypto.randomBytes(512).toString('base64');
    this.emailMap.put(email, token);

    const subject = 'Verify your E-Mail';
    const baseUrl = getServerBaseUrl(this.server);
    const encodedEmail = encodeURIComponent(email);
    const content = await this.engine.renderFile('verify-email.html', {
      subject,
      url: `${baseUrl}/register?email=${encodedEmail}&token=${encodeURIComponent(token)}`,
      host: this.server.host,
      unsub: `${baseUrl}/unregister?email=${encodedEmail}`,
    });

    console.log('[email] registerEmail - sending verification email to: %s via %s:%s', email, this.transport.options.host, this.transport.options.port);
    const info = await this.transport.sendMail({
      from: this.emailsender,
      to: email,
      subject,
      html: content,
    });
    console.log('[email] registerEmail - email sent successfully to: %s', email);
    return info;
  }

  unregisterEmail(email) {
    return this.dbhandler.removeUser(email).catch((err) => {
      console.error('[email] unregisterEmail - DB error removing user: %s', email, err);
      throw err;
    });
  }

  async sendDiceVerificationEmail(email1, email2, dice, signature, date) {
    const properties = {
      dice,
      signature,
      date,
    };
    const subject = 'The dice have been cast!';
    const encodedProperties = encodeURIComponent(Buffer.from(JSON.stringify(properties)).toString('base64'));
    const baseUrl = getServerBaseUrl(this.server);

    const content = await this.engine.renderFile('verify-dice.html', {
      subject,
      date: new Date(date).toLocaleString('en-US'),
      dice: JSON.stringify(dice),
      url: `${baseUrl}/verify?token=${encodedProperties}`,
      unsub: `${baseUrl}/unregister`,
    });

    return this.transport.sendMail({
      from: this.emailsender,
      to: `${email1}, ${email2}`,
      subject,
      html: content,
    });
  }
}

module.exports = EmailManager;
