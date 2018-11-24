const roller = require('./dice-roller');
const validator = require('./validator');
const emailManager = require('./email-manager.js');
const dbhandler = require('./db-handler');

const pushToCopy = (array, object) => {
  const copy = array.slice();
  array.push(object);
  return copy;
};

const registrationMiddleware = async (req, res, next) => {
  const errors = [];
  await Promise.all([req.body.email1, req.body.email2].map(email => (
    dbhandler.checkMail(email).then((result) => {
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
};

const validateRollArgs = (req, res) => {
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
};

const handleRoll = async (req, res) => {
  req.params.max = parseInt(req.params.max, 10);
  req.params.times = parseInt(req.params.times, 10);
  if (validateRollArgs(req, res)) {
    const dice = await roller.roll(req.params.max, req.params.times);
    const now = new Date();
    const signature = await validator.sign(pushToCopy(dice, now.getTime()));
    res.json({
      status: 'OK',
      result: {
        dice,
        signature,
        date: now.toISOString(),
      },
    });
  }
};

const validateVerifyArgs = (req, res) => {
  const errors = [];
  try {
    req.params.diceArray = JSON.parse(req.params.diceArray);
  } catch (e) {
    if (e instanceof SyntaxError) {
      errors.push('The supplied diceArray parameter is invalid JSON.');
    } else {
      throw e;
    }
  }
  if (errors.length === 0) {
    if (Array.isArray(req.params.diceArray)) {
      req.params.diceArray = req.params.diceArray.map(o => parseInt(o, 10));
      if (req.params.diceArray.some(Number.isNaN)) {
        errors.push('The provided diceArray parameter contains values other than integers.');
      }
    } else {
      errors.push('The provided diceArray parameter is not an array.');
    }
  }
  if (req.params.signature.length !== 684) {
    errors.push('The provided signature has a wrong length.');
  }
  if (errors.length > 0) {
    res.status(422).json({
      status: 'Error',
      errors,
    });
    return false;
  }
  return true;
};

const handleVerify = async (req, res) => {
  if (validateVerifyArgs(req, res)) {
    req.params.diceArray.push(new Date(req.params.date).getTime());
    const valid = await validator.verify(req.params.diceArray, req.params.signature);
    res.json({
      status: 'OK',
      valid,
    });
  }
};

const handleEmailRegister = async (req, res) => {
  if (req.body.token) {
    const verified = await emailManager.verifyEmail(req.params.email);
    if (verified) {
      res.status(200).json({ status: 'OK' });
    } else {
      res.status(403).json({
        status: 'Error',
        errors: 'invalid Token or mail.',
      });
    }
  } else {
    emailManager.registerEmail(req.body.email);
    res.status(200).json({ status: 'OK' });
  }
};

const handleEmailUnregister = async (req, res) => {
  const rowCount = await emailManager.unregisterEmail(req.body.email);
  if (rowCount === 1) {
    res.status(200).json({ status: 'OK' });
  } else if (rowCount === 0) {
    res.status(412).json({
      status: 'Error',
      errors: [`Email "${req.body.email}" does not exist in the database.`],
    });
  }
};

module.exports = (router) => {
  router.get('/verify/:diceArray/:signature/:date', handleVerify);
  router.post('/roll', registrationMiddleware, handleRoll);
  router.post('/register', handleEmailRegister);
  router.post('/unregister', handleEmailUnregister);
};
