const nconf = require('nconf');
const controller = require('./src/controller');

nconf.argv().env().file({ file: './config.json' });
nconf.defaults({
  port: 7654,
  email: {
    display: {
      server: {
        protocol: 'http',
        host: 'localhost',
        port: 7654,
        baseurl: '',
      }
    }
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
  'keys:public'
]);
controller(nconf.get('port'), nconf.get('database'));
