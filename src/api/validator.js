const fs = require('fs');
const nconf = require('nconf');
const crypto = require('crypto');

const algorithm = 'RSA-SHA512';
const encoding = 'base64';
const privateKey = fs.readFileSync(nconf.get('private-key'));
const publicKey = fs.readFileSync(nconf.get('public-key'));

const validator = {};

validator.sign = async (diceArray) => {
  const sign = crypto.createSign(algorithm);
  sign.update(Buffer.from(diceArray));
  return sign.sign(privateKey, encoding);
};

validator.verify = async (diceArray, signature) => {
  const verify = crypto.createVerify(algorithm);
  verify.update(Buffer.from(diceArray));
  return verify.verify(publicKey, signature, encoding);
};

module.exports = validator;
