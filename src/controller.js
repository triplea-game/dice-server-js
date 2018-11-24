const express = require('express');
const bodyParser = require('body-parser');
const apiMiddleware = require('./api/api');

const setupRoutes = (db) => {
  const routerParams = { caseSensitive: true, strict: true };
  const router = express.Router(routerParams);

  router.use('/api', apiMiddleware(express.Router(routerParams), db));
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

module.exports = (url, port, db) => {
  const router = setupRoutes(db);
  startServer(router, url, port);
};
