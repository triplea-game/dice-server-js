const crypto = require('crypto');
const { PAYLOAD_VERSION, signedPayload, legacySignedPayload } = require('../core/signed-payload');

const algorithm = 'RSA-SHA512';
const encoding = 'base64';

class Validator {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  async sign(roll) {
    const sign = crypto.createSign(algorithm);
    sign.update(signedPayload(roll), 'utf8');
    return sign.sign(this.privateKey, encoding);
  }

  async verify(roll, signature) {
    const verify = crypto.createVerify(algorithm);
    verify.update(signedPayload(roll), 'utf8');
    return verify.verify(this.publicKey, signature, encoding);
  }

  // LEGACY: see legacySignedPayload.
  async verifyLegacy(dice, date, signature) {
    const verify = crypto.createVerify(algorithm);
    verify.update(legacySignedPayload(dice, date));
    return verify.verify(this.publicKey, signature, encoding);
  }
}

module.exports = Validator;
module.exports.signedPayload = signedPayload;
module.exports.PAYLOAD_VERSION = PAYLOAD_VERSION;
