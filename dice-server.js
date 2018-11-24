const nconf = require('nconf');

// TODO move to dedicated module
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

// TODO move imports to top once possible
const { setupDb } = require('./src/api/db-handler');

setupDb();

const controller = require('./src/controller');

controller(nconf.get('server:baseurl'), nconf.get('server:port'));
