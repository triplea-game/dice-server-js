const nconf = require('nconf');
const { startServer } = require('./src/server');

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
});
