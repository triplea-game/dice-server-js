const fs = require('fs');
const nodemailer = require('nodemailer');
const DbHandler = require('./api/db-handler');
const EmailManager = require('./api/email-manager');
const Validator = require('./api/validator');
const roller = require('./api/dice-roller');
const { createApp } = require('./app');
const { deriveTokenKey } = require('./core/email-token');

// Resolves with the listening server, or rejects if the port can't be bound:
// Express hands a listen error (EADDRINUSE, EACCES) to the callback, and
// ignoring it would log "Running" for a server that never was.
const listen = (app, port) => new Promise((resolve, reject) => {
  const server = app.listen(port, (err) => (err ? reject(err) : resolve(server)));
});

// Composition root: turns config into real collaborators and starts listening.
const startServer = async (config) => {
  const users = new DbHandler(config.database);
  // Serving without the users table would fail every request, so fail startup
  // instead and let the container restart until Postgres is reachable.
  await users.setupDb();

  console.log('[email] Creating SMTP transport - host: %s port: %s', config.smtp.host, config.smtp.port);
  const transport = nodemailer.createTransport({
    ...config.smtp,
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
  const privateKey = fs.readFileSync(config.keys.private);
  const app = createApp({
    users,
    emailManager: new EmailManager({
      users,
      transport,
      server: config.server,
      sender: config.sender,
      tokenKey: deriveTokenKey(privateKey),
    }),
    validator: new Validator(privateKey, fs.readFileSync(config.keys.public)),
    rollDice: roller.roll,
    now: Date.now,
  });
  const server = await listen(app, config.port);
  console.info(`Running on port ${config.port}`);
  return { server, users };
};

module.exports = { startServer, listen };
