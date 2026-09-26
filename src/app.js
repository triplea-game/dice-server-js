const path = require('path');
const express = require('express');
const apiRoutes = require('./api/api');
const userRoutes = require('./user/user');
const { createTemplateEngine } = require('./templates');

const publicDir = path.join(__dirname, '..', 'public');

// Builds the Express app from its collaborators without listening, so tests
// can run the real routes against in-memory stand-ins.
const createApp = (deps) => {
  const routerParams = { caseSensitive: true, strict: true };
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.engine('html', createTemplateEngine().express());
  app.set('views', [path.join(publicDir, 'partials'), path.join(publicDir, 'views')]);
  app.set('view engine', 'html');

  app.use(express.static(path.join(publicDir, 'static')));
  app.get('/health', async (req, res) => {
    try {
      await deps.users.ping();
      res.json({ status: 'OK' });
    } catch (err) {
      console.error('[health] Database check failed:', err);
      res.status(503).json({ status: 'Error', errors: ['Database unavailable'] });
    }
  });
  app.use('/api', apiRoutes(express.Router(routerParams), deps));
  app.use('/', userRoutes(express.Router(routerParams)));
  return app;
};

module.exports = { createApp };
