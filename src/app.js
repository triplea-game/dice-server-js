const path = require('path');
const express = require('express');
const apiRoutes = require('./api/api');
const userRoutes = require('./user/user');
const { createTemplateEngine } = require('./templates');
const { errorResponse } = require('./core/error-response');

const publicDir = path.join(__dirname, '..', 'public');

// Builds the Express app from its collaborators without listening, so tests
// can run the real routes against in-memory stand-ins.
const createApp = (deps) => {
  const routerParams = { caseSensitive: true, strict: true };
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Express 5 leaves req.body undefined when nothing parsed it (no body, or
  // an unknown Content-Type); the routes validate fields, not the body itself.
  app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });

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
  // Catches what the /api handler never sees, eg: body-parser errors, so
  // Express's fallback handler doesn't answer with a stack trace.
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const { status, errors } = errorResponse(err);
    // A client fault logs one line without `err`: body-parser attaches the raw
    // request body to it, which would let any caller write it into the log.
    if (status < 500) {
      console.warn('[app] Rejected %s %s with %d: %s', req.method, req.path, status, err.type || err.name);
    } else {
      console.error('[app] Unhandled error on %s %s:', req.method, req.path, err);
    }
    res.status(status).json({ status: 'Error', errors });
  });
  return app;
};

module.exports = { createApp };
