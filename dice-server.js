const nconf = require('nconf');
const controller = require('./src/controller');

nconf.argv().env().file({ file: './config.json' });
nconf.defaults({
  server: {
    protocol: 'http',
    host: 'localhost',
    port: 7654,
    baseurl: '',
  },
  database: {
    username: 'postgres',
    password: '',
    host: 'localhost',
    port: 5432,
    database: 'dicedb',
  },
});
nconf.required(['server', 'database', 'smtp', 'private-key', 'public-key']);
controller(nconf.get('server:baseurl'), nconf.get('server:port'), nconf.get('database'));
