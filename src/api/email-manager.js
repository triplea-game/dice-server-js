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
    this.transport = nodemailer.createTransport(transport);
    this.server = server;
    this.emailsender = emailsender;
    this.engine = Liquid({
      root: path.resolve(__dirname, '../../public/email-templates/'),
      extname: '.html'
    });
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
    const token = crypto.randomBytes(512).toString('base64');
    this.emailMap.put(email, token);

    const subject = 'Verify your E-Mail';
    const baseUrl = getServerBaseUrl(this.server);
    const encodedEmail = encodeURIComponent(email);
    const content = await this.engine.renderFile('verify-email.html', {
      subject,
      url: `${baseUrl}/register?email=${encodedEmail}&token=${encodeURIComponent(token)}`,
      host: this.server.host,
      unsub: `${baseUrl}/unregister?email=${encodedEmail}`
    });

    return this.transport.sendMail({
      from: this.emailsender,
      to: email,
      subject,
      html: content,
    });
  }

  unregisterEmail(email) {
    return this.dbhandler.removeUser(email);
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
      unsub: `${baseUrl}/unregister`
    });

    return this.transport.sendMail({
      from: this.emailsender,
      to: `${email1}, ${email2}`,
      subject: subject,
      html: content,
    });
  }
}

module.exports = EmailManager;
