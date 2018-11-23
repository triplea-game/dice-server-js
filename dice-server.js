const express = require('express');
const nconf = require('nconf');
const bodyParser = require('body-parser');

const app = express();
const routerParams = { caseSensitive: true, strict: true };
const rootRouter = express.Router(routerParams);


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
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

nconf.required(['server', 'database', 'smtp', 'private-key', 'public-key']);

const { setupDb } = require('./src/api/db-handler');

setupDb();

require('./src/controller')(rootRouter, express.Router(routerParams));

app.use(nconf.get('server:baseurl'), rootRouter);
app.listen(nconf.get('server:port'), () => console.info(`Running on port ${nconf.get('server:port')}`));
