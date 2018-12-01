const fs = require('fs');
const nconf = require('nconf');
const crypto = require('crypto');

const algorithm = 'RSA-SHA512';
const encoding = 'base64';

class Validator {
  constructor() {
    this.privateKey = fs.readFileSync(nconf.get('keys:private'));
    this.publicKey = fs.readFileSync(nconf.get('keys:public'));
  }

  async sign(diceArray) {
    const sign = crypto.createSign(algorithm);
    sign.update(Buffer.from(diceArray));
    return sign.sign(this.privateKey, encoding);
  }

  async verify(diceArray, signature) {
    const verify = crypto.createVerify(algorithm);
    verify.update(Buffer.from(diceArray));
    return verify.verify(this.publicKey, signature, encoding);
  }
}

module.exports = Validator;
