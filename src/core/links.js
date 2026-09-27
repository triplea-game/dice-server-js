// Builds the links the server emails out. Pure: config and values in, URLs out.
const { PAYLOAD_VERSION } = require('./signed-payload');

const serverBaseUrl = ({
  port, protocol, host, baseurl,
}) => {
  const isDefaultPort = (port === 80 && protocol === 'http') || (port === 443 && protocol === 'https');
  return `${protocol}://${host}${isDefaultPort ? '' : `:${port}`}${baseurl}`;
};

const registrationLink = (server, email, token) => `${serverBaseUrl(server)}/register?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

const unregisterLink = (server, email) => (email === undefined
  ? `${serverBaseUrl(server)}/unregister`
  : `${serverBaseUrl(server)}/unregister?email=${encodeURIComponent(email)}`);

const unregisterConfirmLink = (server, email, token) => `${serverBaseUrl(server)}/unregister?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

const verifyToken = (roll, signature) => Buffer.from(JSON.stringify({
  v: PAYLOAD_VERSION,
  dice: roll.dice,
  max: roll.max,
  times: roll.times,
  email1: roll.email1,
  email2: roll.email2,
  date: roll.date,
  signature,
})).toString('base64');

const verifyLink = (server, roll, signature) => `${serverBaseUrl(server)}/verify?token=${encodeURIComponent(verifyToken(roll, signature))}`;

module.exports = {
  serverBaseUrl, registrationLink, unregisterLink, unregisterConfirmLink, verifyToken, verifyLink,
};
