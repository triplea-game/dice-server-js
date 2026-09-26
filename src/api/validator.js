const fs = require('fs');
const nconf = require('nconf');
const crypto = require('crypto');

const algorithm = 'RSA-SHA512';
const encoding = 'base64';

const PAYLOAD_VERSION = 2;

// Key order is fixed by this literal, so the same roll always yields the same bytes.
const signedPayload = ({
  dice, max, times, email1, email2, date,
}) => JSON.stringify({
  v: PAYLOAD_VERSION, dice, max, times, email1, email2, date,
});

// LEGACY (tokens without `v`): delete once old emailed links no longer matter.
// Buffer.from(number[]) keeps only each number's low byte, so this binds almost nothing.
const legacySignedPayload = (dice, date) => Buffer.from([...dice, date]);

class Validator {
  constructor(
    privateKey = fs.readFileSync(nconf.get('keys:private')),
    publicKey = fs.readFileSync(nconf.get('keys:public')),
  ) {
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

  async verifyLegacy(dice, date, signature) {
    const verify = crypto.createVerify(algorithm);
    verify.update(legacySignedPayload(dice, date));
    return verify.verify(this.publicKey, signature, encoding);
  }
}

module.exports = Validator;
module.exports.signedPayload = signedPayload;
module.exports.PAYLOAD_VERSION = PAYLOAD_VERSION;
