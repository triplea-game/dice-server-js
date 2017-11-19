'use strict';
const crypto = require('crypto');
const handler = require('./db-handler');
const NodeRSA = require('node-rsa');
const algorithm = 'RSA-SHA512';
const encoding = 'base64';

const validator = {};

validator.sign = function(diceArray, callback){
	const sign = crypto.createSign(algorithm);
	sign.update(Buffer.from(diceArray));
	console.log(diceArray);
	getPrivateKey(key => callback(sign.sign(key, encoding)));
};

validator.verify = function(diceArray, signature, date, callback, errcallback){
	const verify = crypto.createVerify(algorithm);
	verify.update(Buffer.from(diceArray));
	handler.getPublicKey(date, key => callback(verify.verify(key, signature, encoding)), errcallback);
};

function getPrivateKey(callback){
	handler.getPrivateKey(function(key, date){
		if(key == null || monthDiff(date, new Date()) > 4){
			generateKeyPair(() => getPrivateKey(callback));
		} else {
			callback(key);
		}
	});
}

function generateKeyPair(callback){
	const key = new NodeRSA();
	key.generateKeyPair(4096);
	handler.insertKeyPair(key.exportKey('private'), key.exportKey('public'), callback);
}

function monthDiff(d1, d2) {
	var months;
	months = (d2.getFullYear() - d1.getFullYear()) * 12;
	months -= d1.getMonth() + 1;
	months += d2.getMonth();
	return months;
}

module.exports = validator;
