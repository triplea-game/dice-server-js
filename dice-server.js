const nconf = require('nconf');
const { startServer, stopServer } = require('./src/server');

// Under compose's default 10s stop grace period, after which the container is
// SIGKILLed; a hung drain gives up and exits nonzero before that.
const shutdownTimeoutMs = 8000;

// Node's default SIGTERM handling exits at once, which on every container
// recreate could cut a roll after its dice are cast but before the verification
// email is sent and the response written, so a client retry casts different dice.
const exitOnSignal = (running) => (signal) => {
  console.info(`[shutdown] ${signal}: draining in-flight requests`);
  setTimeout(() => {
    console.error(`[shutdown] Still draining after ${shutdownTimeoutMs}ms; exiting`);
    process.exit(1);
  }, shutdownTimeoutMs).unref();
  stopServer(running).then(() => process.exit(0), (err) => {
    console.error('[shutdown] Failed:', err);
    process.exit(1);
  });
};

nconf.argv().env({
  allowlist: ['SMTP_USER', 'SMTP_PASS'],
  transform(obj) {
    const map = {
      SMTP_USER: 'email:smtp:auth:user',
      SMTP_PASS: 'email:smtp:auth:pass',
    };
    return map[obj.key] ? { key: map[obj.key], value: obj.value } : obj;
  },
}).file({ file: './config.json' });
nconf.defaults({
  port: 7654,
  email: {
    display: {
      server: {
        protocol: 'http',
        host: 'localhost',
        port: 7654,
        baseurl: '',
      },
    },
  },
  database: {
    username: 'postgres',
    password: '',
    host: 'localhost',
    port: 5432,
    database: 'dicedb',
  },
});
nconf.required([
  'port',
  'database',
  'email:smtp',
  'email:display:sender',
  'email:display:server',
  'keys:private',
  'keys:public',
]);
startServer({
  port: nconf.get('port'),
  database: { ...nconf.get('database'), password: process.env.DB_PASSWORD },
  smtp: nconf.get('email:smtp'),
  server: nconf.get('email:display:server'),
  sender: nconf.get('email:display:sender'),
  keys: nconf.get('keys'),
}).then((running) => {
  const onSignal = exitOnSignal(running);
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
}).catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
