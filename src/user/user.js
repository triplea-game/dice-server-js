const { formatUtc } = require('../core/dates');

const isNonEmptyString = (value) => typeof value === 'string' && value !== '';

module.exports = (router) => {
  router.get('/', (req, res) => res.render('register.html'));
  router.get('/verify', (req, res) => {
    try {
      const tokenInfo = JSON.parse(Buffer.from(req.query.token, 'base64'));
      res.render('verify.html', {
        token: encodeURIComponent(req.query.token),
        dice: tokenInfo.dice,
        date: formatUtc(tokenInfo.date),
        max: tokenInfo.max,
        times: tokenInfo.times,
        email1: tokenInfo.email1,
        email2: tokenInfo.email2,
        // LEGACY: tokens without `v` predate binding max/times/emails into the signature.
        legacy: tokenInfo.v === undefined,
      });
    } catch (e) {
      res.render('verify.html', { invalid: true });
    }
  });
  router.get('/register', (req, res) => {
    const { email, token } = req.query;
    if (!isNonEmptyString(email) || !isNonEmptyString(token)) {
      res.render('confirm-register.html', {});
      return;
    }
    res.render('confirm-register.html', { email, token: encodeURIComponent(token) });
  });
  // With a token the link came from the confirmation email; without one it is
  // the request form (the emails' unsubscribe link lands here too).
  router.get('/unregister', (req, res) => {
    const { email, token } = req.query;
    if (token === undefined) {
      res.render('unregister.html', { email: isNonEmptyString(email) ? email : '' });
      return;
    }
    if (!isNonEmptyString(email) || !isNonEmptyString(token)) {
      res.render('confirm-unregister.html', {});
      return;
    }
    res.render('confirm-unregister.html', { email, token: encodeURIComponent(token) });
  });
  return router;
};
