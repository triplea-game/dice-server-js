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
  // TODO replace with frontend
  const url = `${getServerBaseUrl(server)}/api/register/${email}/${encodeURIComponent(token)}`;
  return transport.sendMail({
    from: sender,
    to: email,
    subject: 'Confirm your email', // TODO use proper templating engine
    html: `Please click this link to confirm your email adress: <a href="${url}">Confirm!</a><br>It will expire after 24 hours or when a new confirmation email is sent.`,
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
    return sendEmailWithToken(email, token, this.transport, this.emailsender, this.server);
  }

  unregisterEmail(email) {
    return this.dbhandler.removeUser(email);
  }
}

module.exports = EmailManager;
