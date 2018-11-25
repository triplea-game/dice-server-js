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

    const baseUrl = getServerBaseUrl(this.server);
    const encodedEmail = encodeURIComponent(email);
    const content = await this.engine.renderFile('verify-email.html', {
      url: `${baseUrl}/register?email=${encodedEmail}&token=${encodeURIComponent(token)}`,
      host: this.server.host,
      unsub: `${baseUrl}/unregister?email=${encodedEmail}`
    });

    return this.transport.sendMail({
      from: this.emailsender,
      to: email,
      subject: 'Verify your E-Mail',
      html: content,
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
