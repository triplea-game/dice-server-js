module.exports = (router) => {
  router.get('/verify/:token', (req, res) => res.render('verify.html', JSON.parse(Buffer.from(req.params.token, 'base64').toString())));
  router.get('/register', (req, res) => res.render('register.html'));
  router.get('/register/:email/:token', (req, res) => res.render('confirm-register.html', { email: req.params.email, token: req.params.token }));
  router.get('/unregister/:email', (req, res) => res.render('unregister.html', { email: req.params.email }));
  return router;
};
