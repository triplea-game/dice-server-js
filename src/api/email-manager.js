const nodemailer = require('nodemailer');
const crypto = require('crypto');
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
    this.transport = nodemailer.createTransport(transport);
    this.server = server;
    this.emailsender = emailsender;
  }

  async verifyEmail(email, token) {
    if (!this.emailMap.verify(email, token)) {
      return false;
    }
    await this.dbhandler.addUser(email);
    return true;
  }

  async registerEmail(email) {
    if (await this.dbhandler.checkMail(email)) {
      return false;
    }
    // TODO replace with frontend
    const token = crypto.randomBytes(512).toString('base64');
    this.emailMap.put(email, token);
    const url = `${getServerBaseUrl(this.server)}/register?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    return this.transport.sendMail({
      from: this.emailsender,
      to: email,
      subject: 'Confirm your email', // TODO use proper templating engine
      html: `Please click this link to confirm your email adress: <a href="${url}">Confirm!</a>
      <br>
      It will expire after 24 hours or when a new confirmation email is sent.`,
    });
  }

  unregisterEmail(email) {
    return this.dbhandler.removeUser(email);
  }

  sendDiceVerificationEmail(email1, email2, dice, signature, date) {
    // TODO replace with frontend
    const properties = {
      dice,
      signature,
      date,
    };
    const encodedProperties = encodeURIComponent(Buffer.from(JSON.stringify(properties)).toString('base64'));
    const url = `${getServerBaseUrl(this.server)}/verify?token=${encodedProperties}`;
    return this.transport.sendMail({
      from: this.emailsender,
      to: `${email1}, ${email2}`,
      subject: 'Dice were rolled', // TODO use proper templating engine
      html: `The dice have been cast!
      <br>
      Date: ${new Date(date).toLocaleString('en-US')}
      <br>
      Results: ${JSON.stringify(dice)}
      <br>
      <a href="${url}">Verify the validity of this message!</a>`,
    });
  }
}

module.exports = EmailManager;
