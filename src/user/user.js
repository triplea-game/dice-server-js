module.exports = (router) => {
  router.get('/', (req, res) => res.render('register.html'));
  router.get('/verify', (req, res) => {
    try {
      const tokenInfo = JSON.parse(Buffer.from(req.query.token, 'base64'));
      res.render('verify.html', { token: req.query.token, dice: tokenInfo.dice, date: tokenInfo.date })
    } catch (e) {
      res.render('verify.html', { invalid: true })
    }
  });
  router.get('/register', (req, res) => res.render('confirm-register.html', { email: req.query.email, token: req.query.token }));
  router.get('/unregister', (req, res) => res.render('unregister.html', { email: req.query.email || '' }));
  return router;
};
