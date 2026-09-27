const {
  emailParamErrors, rollEmailErrors, parseRollArgs, parseVerifyToken,
} = require('../core/requests');

const reject = (res, status, errors) => res.status(status).json({ status: 'Error', errors });

// The /api routes: a thin shell that parses with the core, then calls the
// injected collaborators (users store, email manager, validator, dice roller, clock).
module.exports = (router, {
  users, emailManager, validator, rollDice, now,
}) => {
  router.get('/verify/:token', async (req, res) => {
    const parsed = parseVerifyToken(req.params.token);
    if (parsed.errors) {
      reject(res, 422, parsed.errors);
      return;
    }
    const { roll, signature, legacy } = parsed;
    if (legacy) {
      const valid = await validator.verifyLegacy(roll.dice, roll.date, signature);
      res.json({ status: 'OK', result: { valid, legacy: true } });
      return;
    }
    const valid = await validator.verify(roll, signature);
    res.json({ status: 'OK', result: { valid } });
  });

  router.post('/roll', async (req, res) => {
    const typeErrors = rollEmailErrors(req.body);
    if (typeErrors.length > 0) {
      reject(res, 422, typeErrors);
      return;
    }
    const { email1, email2 } = req.body;
    const registered = await Promise.all([email1, email2].map((email) => users.checkMail(email)));
    const unregistered = [email1, email2]
      .filter((email, i) => !registered[i])
      .map((email) => `Email "${email}" not registered.`);
    if (unregistered.length > 0) {
      reject(res, 403, unregistered);
      return;
    }
    const args = parseRollArgs(req.body);
    if (args.errors) {
      reject(res, 422, args.errors);
      return;
    }

    const roll = {
      dice: await rollDice(args.max, args.times),
      max: args.max,
      times: args.times,
      email1,
      email2,
      date: now(),
    };
    const signature = await validator.sign(roll);
    await emailManager.sendDiceVerificationEmail(roll, signature);
    res.json({
      status: 'OK',
      result: { dice: roll.dice, signature, date: roll.date },
    });
  });

  router.post('/register', async (req, res) => {
    const errors = emailParamErrors(req.body.email);
    if (errors.length > 0) {
      reject(res, 422, errors);
      return;
    }
    console.log('[register] Request received for email: %s', req.body.email);
    const info = await emailManager.registerEmail(req.body.email);
    if (info) {
      console.log('[register] Verification email sent - messageId: %s response: %s', info.messageId, info.response);
      res.status(200).json({ status: 'OK' });
    } else {
      console.log('[register] Email already registered: %s', req.body.email);
      reject(res, 412, ['Mail is already registred']);
    }
  });

  router.post('/register/:token', async (req, res) => {
    const verified = await emailManager.verifyEmail(req.body.email, req.params.token);
    if (verified) {
      res.status(200).json({ status: 'OK' });
    } else {
      reject(res, 403, ['This link is invalid or has expired. Please register again.']);
    }
  });

  // Answers OK whether or not the email is registered; only the mailbox owner
  // learns which, from whether a confirmation email arrives.
  router.post('/unregister', async (req, res) => {
    const errors = emailParamErrors(req.body.email);
    if (errors.length > 0) {
      reject(res, 422, errors);
      return;
    }
    console.log('[unregister] Request received for email: %s', req.body.email);
    await emailManager.requestUnregister(req.body.email);
    res.status(200).json({ status: 'OK' });
  });

  router.post('/unregister/:token', async (req, res) => {
    const confirmed = await emailManager.confirmUnregister(req.body.email, req.params.token);
    if (confirmed) {
      res.status(200).json({ status: 'OK' });
    } else {
      reject(res, 403, ['This link is invalid or has expired. Please unregister again.']);
    }
  });

  // Express only treats a 4-argument function as an error handler, hence the unused `next`.
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    console.error('[api] Unhandled error on %s %s:', req.method, req.path, err);
    reject(res, 500, ['Internal server error']);
  });
  return router;
};
