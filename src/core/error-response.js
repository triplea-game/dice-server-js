// Turns an error that escaped every route into the answer the client sees.
// Error strings are user-facing and fixed: `err.message` is never echoed,
// because body-parser's messages can quote the request body.
//
// Keys are the body-parser `err.type` values worth naming to the client; any
// other client fault answers 'Bad request'.
const clientFaults = {
  // Only express.json() raises this here: the form parser re-types its faults.
  'entity.parse.failed': 'The request body is not valid JSON.',
  'entity.too.large': 'The request body is too large.',
  'parameters.too.many': 'The request body has too many fields.',
  'querystring.parse.rangeError': 'The request body nests form fields too deeply.',
  // UTF-8 is the one charset both express.json() and express.urlencoded() accept.
  'charset.unsupported': 'The request body uses an unsupported charset; send it as UTF-8.',
  // Mirrors the decoders in body-parser's lib/read.js; update if that set changes.
  'encoding.unsupported': 'The request body uses an unsupported Content-Encoding; use gzip, deflate, br, or none.',
};

const errorResponse = (err) => {
  const isClientFault = Number.isInteger(err.status) && err.status >= 400 && err.status < 500;
  if (!isClientFault) {
    return { status: 500, errors: ['Internal server error'] };
  }
  return { status: err.status, errors: [clientFaults[err.type] || 'Bad request'] };
};

module.exports = { errorResponse };
