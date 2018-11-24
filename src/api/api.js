const nconf = require('nconf');
const roller = require('./dice-roller');
const Validator = require('./validator');
const EmailManager = require('./email-manager.js');
const Handler = require('./db-handler');

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

  static validateRollArgs(req, res, next) {
    const errors = [];
    ['max', 'times'].forEach((name) => {
      if (!req.body[name]) {
        errors.push(`${name} parameter is not defined`);
      } else {
        req.body[name] = parseInt(req.body[name], 10);
      }
    });
    if (errors.length > 0) {
      res.status(422).json({
        status: 'Error',
        errors,
      });
    } else {
      next();
    }
  }

  async handleRoll(req, res) {
    const dice = await roller.roll(req.body.max, req.body.times);
    const now = Date.now();
    const signature = await this.validator.sign([...dice, now]);
    res.json({
      status: 'OK',
      result: {
        dice,
        signature,
        date: now,
      },
    });
  }

  static validateVerifyArgs(req, res, next) {
    const errors = [];
    try {
      const information = JSON.parse(Buffer.from(req.params.token, 'base64').toString());
      req.params.dice = information.dice;
      req.params.date = information.date;
      req.params.signature = information.signature;
    } catch (e) {
      errors.push('The supplied token parameter is invalid JSON.');
    }
    if (errors.length === 0) {
      if (Array.isArray(req.params.dice)) {
        if (!req.params.dice.every(Number.isInteger)) {
          errors.push('The provided dice parameter contains values other than integers.');
        }
      } else {
        errors.push('The provided dice parameter is not an array.');
      }
      if (typeof req.params.signature === 'string') {
        if (req.params.signature.length !== 684) {
          errors.push('The provided signature has a wrong length.');
        }
      } else {
        errors.push('The provided signature is not from type string');
      }
      if (!Number.isInteger(req.params.date)) {
        errors.push('The provided data is not an int');
      }
    }
    if (errors.length > 0) {
      res.status(422).json({
        status: 'Error',
        errors,
      });
    } else {
      next();
    }
  }

  async handleVerify(req, res) {
    const timedArray = [...req.params.dice, req.params.date];
    const valid = await this.validator.verify(timedArray, req.params.signature);
    res.json({
      status: 'OK',
      valid,
    });
  }

  async handleEmailRegister(req, res) {
    const info = await this.emailManager.registerEmail(req.body.email);
    console.log('Message %s sent: %s', info.messageId, info.response);
    res.status(200).json({ status: 'OK' });
  }

  async handleEmailRegisterConfirm(req, res) {
    const verified = await this.emailManager.verifyEmail(req.params.email, req.params.token);
    if (verified) {
      res.status(200).json({ status: 'OK' });
    } else {
      res.status(403).json({
        status: 'Error',
        errors: 'invalid Token or mail.',
      });
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

  static verifyEmailParam(req, res, next) {
    if (typeof req.body.email === 'string') {
      next();
    } else {
      res.status(422).json({
        status: 'Error',
        errors: ['Body Parameter Email is missing'],
      });
    }
  }
}

module.exports = (router, database) => {
  const api = new Api(database);
  router.get('/verify/:token', Api.validateVerifyArgs, api.handleVerify.bind(api));
  router.post('/roll', api.registrationMiddleware.bind(api), Api.validateRollArgs, api.handleRoll.bind(api));
  router.post('/register', Api.verifyEmailParam, api.handleEmailRegister.bind(api));
  // TODO replace with frontend and merge with middleware above
  router.get('/register/:email/:token', api.handleEmailRegisterConfirm.bind(api));
  router.post('/unregister', Api.verifyEmailParam, api.handleEmailUnregister.bind(api));

  // express.js behaves differently if no next parameter is used here
  // so we call next in case something's odd to please ESLint
  router.use((err, req, res, next) => res.status(500).json({ status: 'Error', errors: [err.toString()] }) || next());
  return router;
};
