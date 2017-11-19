'use strict';
const fs = require('fs');
const nconf = require('nconf');
const crypto = require('crypto');
const algorithm = 'RSA-SHA512';
const encoding = 'base64';
const privateKey = fs.readFileSync(nconf.get('private-key'));
const publicKey = fs.readFileSync(nconf.get('public-key'));

const validator = {};

validator.sign = function(diceArray, callback){
	const sign = crypto.createSign(algorithm);
	sign.update(Buffer.from(diceArray));
	callback(sign.sign(privateKey, encoding));
};

validator.verify = function(diceArray, signature, callback){
	const verify = crypto.createVerify(algorithm);
	verify.update(Buffer.from(diceArray));
	callback(verify.verify(publicKey, signature, encoding));
};

module.exports = validator;
