const apiMiddleware = require('./api/api');

module.exports = (router1, router2) => {
  router1.use('/api', apiMiddleware(router2));
  // TODO use templating engine to create user friendly registration sites
};
