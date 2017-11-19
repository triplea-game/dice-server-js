'use strict';
const express = require('express');
const nconf = require('nconf');
const app = express();
const routerParams = {caseSensitive: true, strict: true};
const rootRouter = express.Router(routerParams);

nconf.argv().env().file({file: './config.json'});

nconf.defaults({
	server: {
		protocol: 'http',
		host: 'localhost',
		port: 7654,
		baseurl : ''
	},
	database: {
		username: 'postgres',
		password: '',
		host: 'localhost',
		port: 5432,
		database: 'dicedb'
	}
});

nconf.required(['server', 'database', 'smtp', 'private-key', 'public-key']);

require('./src/db-handler').setupDb();

require('./src/controller')(rootRouter, express.Router(routerParams));

app.use(nconf.get('server:baseurl'), rootRouter);
app.listen(nconf.get('server:port'), function(){//TODO allow for https
	console.log('Running on port ' + nconf.get('server:port'));
});
