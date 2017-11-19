'use strict';
const base64url = require('base64-url');
const emailManager = require('./email-manager.js');

function handleEmailVerify(req){
	if(!emailManager.verifyEmail(req.params.email, base64url.unescape(req.params.token), function(){
		//Error
	})){
		//Success
	} else {
		//Failure
	}
}

function handleEmailRegister(req){
	emailManager.registerEmail(req.params.email);
}

function handleEmailUnegister(req){
	emailManager.unregisterEmail(req.params.email, function(){
		//Error
	});
}

module.exports = function(router1, router2){
	router1.use('/api', require('./api')(router2));
	router1.get('/verify/:email/:token', handleEmailVerify);
	router1.get('/register/:email', handleEmailRegister);
	router1.get('/unregister/:email', handleEmailUnegister);
};
