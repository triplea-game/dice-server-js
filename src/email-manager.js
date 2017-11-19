'use strict';
const dbhandler = require('./db-handler');
const nconf = require('nconf');
const transport = require('nodemailer').createTransport(nconf.get('smtp'));
const base64url = require('base64-url');
const crypto = require('crypto');
const emailMap = new (require('./token-cache.js'))();

const manager = {};

manager.verifyEmail = function(email, token, callback){
	if(emailMap.verify(email, token)){
		dbhandler.addUser(email, callback);
		return true;
	}
	return false;
};

manager.registerEmail = function(email){
	const token = crypto.randomBytes(512).toString('base64');
	emailMap.put(email, token);
	sendEmailWithToken(email, token);
};

function sendEmailWithToken(email, token){
	const url = getServerBaseUrl() + '/verify/' + email + '/' + base64url.escape(token);
	transport.sendEmail({
		from: nconf.get('emailsender'),
		to: email,
		subject: 'Confirm your email',
		html: 'Please click this link to confirm your email adress: <a href="' + url + '">Confirm!</a><br>It will expire after 24 hours or when a new confirmation email is sent.'
	}, (error, info) => {
		if (error) {
			return console.log(error);
		}
		console.log('Message %s sent: %s', info.messageId, info.response);
	});
}

function getServerBaseUrl(){
	const server = nconf.get('server');
	function isCommonPort(){
		return (server.port === 80 && server.protocol === 'http') || (server.port === 443 && server.protocol === 'https');
	}
	return server.protocol + '://' + server.host + (isCommonPort() ? '' : (':' + server.port)) + server.baseurl;
}


manager.unregisterEmail = function(email, callback){
	dbhandler.removeUser(email, callback);
};

module.exports = manager;
