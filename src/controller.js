'use strict';
module.exports = (router1, router2) => {
	router1.use('/api', require('./api/api')(router2));
	//TODO use templating engine to create user friendly registration sites
};
