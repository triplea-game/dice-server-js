const nconf = require('nconf');
const transport = require('nodemailer').createTransport(nconf.get('smtp'));
const base64url = require('base64-url');
const crypto = require('crypto');
const dbhandler = require('./db-handler');
const TokenCache = require('../util/token-cache.js');

const emailMap = new TokenCache();

const getServerBaseUrl = () => {
  const server = nconf.get('server');
  const isCommonPort = () => (server.port === 80 && server.protocol === 'http') || (server.port === 443 && server.protocol === 'https');
  return `${server.protocol}://${server.host}${isCommonPort() ? '' : (`:${server.port}`)}${server.baseurl}`;
};

const sendEmailWithToken = (email, token) => {
  const url = `${getServerBaseUrl()}/verify/${email}/${base64url.escape(token)}`;
  transport.sendEmail({
    from: nconf.get('emailsender'),
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

const manager = {};

manager.verifyEmail = async (email, token) => {
  if (!emailMap.verify(email, token)) {
    return false;
  }
  await dbhandler.addUser(email);
  return true;
};

manager.registerEmail = (email) => {
  // TODO replace with uuid package
  const token = crypto.randomBytes(512).toString('base64');
  emailMap.put(email, token);
  sendEmailWithToken(email, token);
};

manager.unregisterEmail = email => dbhandler.removeUser(email);

module.exports = manager;
