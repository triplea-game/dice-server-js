const express = require('express');
const bodyParser = require('body-parser');
const apiMiddleware = require('./api/api');

const nestMiddleware = (router, middleware) => {
  middleware(router);
  return router;
};

const setupRoutes = () => {
  const routerParams = { caseSensitive: true, strict: true };
  const router = express.Router(routerParams);

  router.use('/api', nestMiddleware(express.Router(routerParams), apiMiddleware));
  // TODO use templating engine to create user friendly registration sites
  return router;
};

const startServer = (router, url, port) => {
  const app = express();
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(url, router);
  app.listen(port, () => console.info(`Running on port ${port}`));
};

module.exports = (url, port) => {
  const router = setupRoutes();
  startServer(router, url, port);
};
