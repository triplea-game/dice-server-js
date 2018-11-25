// This MUST be required before express gets initialized
// in order to support async middleware
// until it gets officially supported in 5.x
require('express-async-errors');

const express = require('express');
const bodyParser = require('body-parser');
const Liquid = require('liquidjs');
const apiMiddleware = require('./api/api');
const userMiddleware = require('./user/user');

const setupRoutes = (db) => {
  const routerParams = { caseSensitive: true, strict: true };
  const router = express.Router(routerParams);

  router.use('/api', apiMiddleware(express.Router(routerParams), db));
  router.use('/', userMiddleware(express.Router(routerParams)));
  return router;
};

const startServer = (router, url, port) => {
  const app = express();
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  const engine = Liquid({ root: __dirname, extname: '.html' });
  app.engine('html', engine.express());
  app.set('views', ['./public/partials', './public/views']);
  app.set('view engine', 'html');

  app.use(url, router);
  app.listen(port, () => console.info(`Running on port ${port}`));
};

module.exports = (url, port, db) => {
  const router = setupRoutes(db);
  startServer(router, url, port);
};
