const path = require('path');
const { Liquid } = require('liquidjs');

const publicDir = path.join(__dirname, '..', 'public');

// Templates print values taken from request links (verify tokens, emails),
// so every {{ }} output is HTML-escaped unless a template opts out.
const createTemplateEngine = () => new Liquid({
  root: [path.join(publicDir, 'partials'), path.join(publicDir, 'views')],
  extname: '.html',
  outputEscape: 'escape',
});

module.exports = { createTemplateEngine };
