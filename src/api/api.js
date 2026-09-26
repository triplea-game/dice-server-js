const nconf = require('nconf');
const roller = require('./dice-roller');
const Validator = require('./validator');
const EmailManager = require('./email-manager');
const Handler = require('./db-handler');

const { PAYLOAD_VERSION } = Validator;

const emailValidation = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

class Api {
  constructor(database) {
    this.dbHandler = new Handler(database);
    this.dbHandler.setupDb();
    this.emailManager = new EmailManager(this.dbHandler, nconf.get('email:smtp'), nconf.get('email:display:server'), nconf.get('email:display:sender'));
    this.validator = new Validator();
  }

  static isEmail(email) {
    return emailValidation.test(email);
  }

  async registrationMiddleware(req, res, next) {
    const errors = [];
    await Promise.all([req.body.email1, req.body.email2].map((email) => (
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
        errors.push(`Parameter ${name} is not defined`);
      } else {
        req.body[name] = parseInt(req.body[name], 10);
        const maxLimit = 5000;
        if (Number.isNaN(req.body[name])) {
          errors.push(`Parameter ${name} is not an Integer`);
        } else if (req.body[name] > maxLimit) {
          errors.push(`Parameter ${name} has value ${req.body[name]} which is higher than ${maxLimit}`);
        } else if (req.body[name] <= 0) {
          errors.push(`Parameter ${name} has value ${req.body[name]} which is 0 or less`);
        }
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
    const {
      max, times, email1, email2,
    } = req.body;
    const dice = await roller.roll(max, times);
    const roll = {
      dice, max, times, email1, email2, date: Date.now(),
    };
    const signature = await this.validator.sign(roll);
    await this.emailManager.sendDiceVerificationEmail(roll, signature);
    res.json({
      status: 'OK',
      result: {
        dice,
        signature,
        date: roll.date,
      },
    });
  }

  static validateVerifyArgs(req, res, next) {
    const errors = [];
    let information;
    try {
      information = JSON.parse(Buffer.from(req.params.token, 'base64').toString());
      if (information === null || typeof information !== 'object') {
        throw new TypeError('token is not a JSON object');
      }
    } catch (e) {
      errors.push('The supplied token parameter is invalid JSON.');
    }
    if (errors.length === 0) {
      const { dice, date, signature } = information;
      if (Array.isArray(dice)) {
        if (!dice.every(Number.isInteger)) {
          errors.push('The provided dice parameter contains values other than integers.');
        }
      } else {
        errors.push('The provided dice parameter is not an array.');
      }
      if (typeof signature === 'string') {
        if (signature.length !== 684) {
          errors.push('The provided signature has a wrong length.');
        }
      } else {
        errors.push('The provided signature is not from type string');
      }
      if (!Number.isInteger(date)) {
        errors.push('The provided data is not an int');
      }
      if (information.v === undefined) {
        // LEGACY: pre-v2 tokens carry only dice, date and signature.
        req.params.legacy = true;
      } else if (information.v === PAYLOAD_VERSION) {
        ['max', 'times'].forEach((name) => {
          if (!Number.isInteger(information[name])) {
            errors.push(`The provided ${name} parameter is not an int`);
          }
        });
        ['email1', 'email2'].forEach((name) => {
          if (typeof information[name] !== 'string') {
            errors.push(`The provided ${name} parameter is not a string`);
          }
        });
      } else {
        errors.push(`The provided token version ${information.v} is not supported.`);
      }
      req.params.roll = {
        dice,
        max: information.max,
        times: information.times,
        email1: information.email1,
        email2: information.email2,
        date,
      };
      req.params.signature = signature;
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
    const { roll, signature } = req.params;
    if (req.params.legacy) {
      const valid = await this.validator.verifyLegacy(roll.dice, roll.date, signature);
      res.json({ status: 'OK', result: { valid, legacy: true } });
      return;
    }
    const valid = await this.validator.verify(roll, signature);
    res.json({
      status: 'OK',
      result: {
        valid,
      },
    });
  }

  async handleEmailRegister(req, res) {
    console.log('[register] Request received for email: %s', req.body.email);
    const info = await this.emailManager.registerEmail(req.body.email);
    if (info) {
      console.log('[register] Verification email sent - messageId: %s response: %s', info.messageId, info.response);
      res.status(200).json({ status: 'OK' });
    } else {
      console.log('[register] Email already registered: %s', req.body.email);
      res.status(412).json({ status: 'Error', errors: ['Mail is already registred'] });
    }
  }

  async handleEmailRegisterConfirm(req, res) {
    const verified = await this.emailManager.verifyEmail(req.body.email, req.params.token);
    if (verified) {
      res.status(200).json({ status: 'OK' });
    } else {
      res.status(403).json({
        status: 'Error',
        errors: ['Invalid Token or E-Mail.'],
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
      if (Api.isEmail(req.body.email)) {
        next();
      } else {
        res.status(422).json({
          status: 'Error',
          errors: ['Email has invalid format'],
        });
      }
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
  router.post('/register/:token', api.handleEmailRegisterConfirm.bind(api));
  router.post('/unregister', Api.verifyEmailParam, api.handleEmailUnregister.bind(api));

  // express.js behaves differently if no next parameter is used here
  // so we call next in case something's odd to please ESLint
  router.use((err, req, res, next) => {
    console.error('[api] Unhandled error on %s %s:', req.method, req.path, err);
    res.status(500).json({ status: 'Error', errors: [err.toString()] });
    next();
  });
  return router;
};

module.exports.Api = Api;
