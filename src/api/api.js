const nconf = require('nconf');
const roller = require('./dice-roller');
const Validator = require('./validator');
const EmailManager = require('./email-manager.js');
const Handler = require('./db-handler');

const pushToCopy = (array, object) => {
  const copy = array.slice();
  array.push(object);
  return copy;
};

class Api {
  constructor(database) {
    this.dbHandler = new Handler(database);
    this.emailManager = new EmailManager(this.dbHandler, nconf.get('smtp'), nconf.get('server'), nconf.get('emailsender'));
    this.validator = new Validator();
  }

  async registrationMiddleware(req, res, next) {
    const errors = [];
    await Promise.all([req.body.email1, req.body.email2].map(email => (
      this.dbHandler.checkMail(email).then((result) => {
        if (!result) {
          errors.push(`Email "${email}" not registered.`);
        }
      })
    )));
    if (errors.length > 0) {
      res.status(403).json({
        status: 'Error',
        errors,
      });
    } else {
      next();
    }
  }

  static validateRollArgs(req, res) {
    const errors = [];
    ['max', 'times'].forEach((name) => {
      if (!req.params[name]) {
        errors.push(`${name} parameter is not defined`);
      } else if (!Number.isInteger(req.params[name])) {
        errors.push(`${name} parameter is not a valid number`);
      }
    });
    if (errors.length > 0) {
      res.status(422).json({
        status: 'Error',
        errors,
      });
      return false;
    }
    return true;
  }

  async handleRoll(req, res) {
    req.params.max = parseInt(req.params.max, 10);
    req.params.times = parseInt(req.params.times, 10);
    if (Api.validateRollArgs(req, res)) {
      const dice = await roller.roll(req.params.max, req.params.times);
      const now = new Date();
      const signature = await this.validator.sign(pushToCopy(dice, now.getTime()));
      res.json({
        status: 'OK',
        result: {
          dice,
          signature,
          date: now.toISOString(),
        },
      });
    }
  }

  static validateVerifyArgs(req, res) {
    const errors = [];
    try {
      const information = JSON.parse(Buffer.from(req.params.token, 'base64').toString());
      req.params.dice = information.dice;
      req.params.date = information.date;
      req.params.signature = information.signature;
    } catch (e) {
      errors.push('The supplied diceArray parameter is invalid JSON.');
    }
    if (errors.length === 0) {
      if (Array.isArray(req.params.dice)) {
        if (req.params.dice.some(Number.isNaN)) {
          errors.push('The provided dice parameter contains values other than integers.');
        }
      } else {
        errors.push('The provided dice parameter is not an array.');
      }
    }
    if (typeof req.params.signature === 'string') {
      if (req.params.signature.length !== 684) {
        errors.push('The provided signature has a wrong length.');
      }
    } else {
      errors.push('The provided signature is not from type string');
    }
    if (typeof req.params.date !== 'string') {
      errors.push('The provided data is not from type string');
    }
    if (errors.length > 0) {
      res.status(422).json({
        status: 'Error',
        errors,
      });
      return false;
    }
    return true;
  }

  async handleVerify(req, res) {
    if (Api.validateVerifyArgs(req, res)) {
      req.params.dice.push(new Date(req.params.date).getTime());
      const valid = await this.validator.verify(req.params.dice, req.params.signature);
      res.json({
        status: 'OK',
        valid,
      });
    }
  }

  async handleEmailRegister(req, res) {
    if (req.body.token) {
      const verified = await this.emailManager.verifyEmail(req.params.email);
      if (verified) {
        res.status(200).json({ status: 'OK' });
      } else {
        res.status(403).json({
          status: 'Error',
          errors: 'invalid Token or mail.',
        });
      }
    } else {
      this.emailManager.registerEmail(req.body.email);
      res.status(200).json({ status: 'OK' });
    }
  }

  async handleEmailUnregister(req, res) {
    const rowCount = await this.emailManager.unregisterEmail(req.body.email);
    if (rowCount === 1) {
      res.status(200).json({ status: 'OK' });
    } else if (rowCount === 0) {
      res.status(412).json({
        status: 'Error',
        errors: [`Email "${req.body.email}" does not exist in the database.`],
      });
    }
  }
}

module.exports = (router, database) => {
  const api = new Api(database);
  router.get('/verify/:token', api.handleVerify);
  router.post('/roll', api.registrationMiddleware, api.handleRoll);
  router.post('/register', api.handleEmailRegister);
  router.post('/unregister', api.handleEmailUnregister);
  return router;
};
