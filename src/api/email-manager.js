const nodemailer = require('nodemailer');
const crypto = require('crypto');
const TokenCache = require('../util/token-cache.js');

const getServerBaseUrl = ({
  port, protocol, host, baseurl,
}) => {
  const isCommonPort = () => (port === 80 && protocol === 'http') || (port === 443 && protocol === 'https');
  return `${protocol}://${host}${isCommonPort() ? '' : (`:${port}`)}${baseurl}`;
};

const sendEmailWithToken = (email, token, transport, sender, server) => {
  const url = `${getServerBaseUrl(server)}/verify/${email}/${encodeURIComponent(token)}`;
  transport.sendEmail({
    from: sender,
    to: email,
    subject: 'Confirm your email', // TODO use proper templating engine
    html: `Please click this link to confirm your email adress: <a href="${url}">Confirm!</a><br>It will expire after 24 hours or when a new confirmation email is sent.`,
  }, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Message %s sent: %s', info.messageId, info.response);
    }
  });
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

  registerEmail(email) {
    const token = crypto.randomBytes(512).toString('base64');
    this.emailMap.put(email, token);
    sendEmailWithToken(email, token, this.transport, this.emailsender, this.server);
  }

  unregisterEmail(email) {
    return this.dbhandler.removeUser(email);
  }
}

module.exports = EmailManager;
