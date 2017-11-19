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
	},
	smtp: {
		host: 'smtp.example.com',
		port: 465,
		secure: true, // secure:true for port 465, secure:false for port 587
		auth: {
			user: 'username@example.com',
			pass: 'userpass'
		}
	},
	emailsender: '"TripleA dice server🎲" <noreply@triplea-game.org>'
});

require('./src/db-handler').setupDb();

require('./src/controller')(rootRouter, express.Router(routerParams));

app.use(nconf.get('server:baseurl'), rootRouter);
app.listen(nconf.get('server:port'), function(){//TODO allow for https
	console.log('Running on port ' + nconf.get('server:port'));
});
