'use strict';
const Promise = require('bluebird');
const fs = require('fs');
const nconf = require('nconf');
const crypto = require('crypto');
const algorithm = 'RSA-SHA512';
const encoding = 'base64';
const privateKey = fs.readFileSync(nconf.get('private-key'));
const publicKey = fs.readFileSync(nconf.get('public-key'));

const validator = {};

validator.sign = (diceArray, callback) => {
	new Promise(resolve => {
		const sign = crypto.createSign(algorithm);
		sign.update(Buffer.from(diceArray));
		resolve(sign.sign(privateKey, encoding));
	}).asCallback(callback);
};

validator.verify = (diceArray, signature, callback) => {
	new Promise(resolve => {
		const verify = crypto.createVerify(algorithm);
		verify.update(Buffer.from(diceArray));
		resolve(verify.verify(publicKey, signature, encoding));
	}).asCallback(callback);
};

module.exports = validator;
