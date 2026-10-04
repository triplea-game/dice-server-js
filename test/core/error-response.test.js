const { errorResponse } = require('../../src/core/error-response');

// Client-fault shapes mirror body-parser's http-errors (`status` plus `type`);
// the rest probe the status bounds.
describe('errorResponse', () => {
  it('answers 400 naming JSON for a malformed body', () => {
    const err = Object.assign(new SyntaxError('Unexpected token b in JSON at position 1'), {
      status: 400, type: 'entity.parse.failed', body: '{bad',
    });

    expect(errorResponse(err)).toEqual({ status: 400, errors: ['The request body is not valid JSON.'] });
  });

  it('answers 413 naming the size for an oversized body', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413, type: 'entity.too.large' });

    expect(errorResponse(err)).toEqual({ status: 413, errors: ['The request body is too large.'] });
  });

  it('answers 413 naming the field count for a form with too many fields', () => {
    const err = Object.assign(new Error('too many parameters'), { status: 413, type: 'parameters.too.many' });

    expect(errorResponse(err)).toEqual({ status: 413, errors: ['The request body has too many fields.'] });
  });

  it('answers 400 naming the nesting for a form nested too deeply', () => {
    const err = Object.assign(new Error('The input exceeded the depth'), {
      status: 400, type: 'querystring.parse.rangeError',
    });

    expect(errorResponse(err)).toEqual({ status: 400, errors: ['The request body nests form fields too deeply.'] });
  });

  it('answers 415 naming the charset for an unsupported charset', () => {
    const err = Object.assign(new Error('unsupported charset "LATIN-9"'), { status: 415, type: 'charset.unsupported' });

    expect(errorResponse(err)).toEqual({
      status: 415, errors: ['The request body uses an unsupported charset; send it as UTF-8.'],
    });
  });

  it('answers 415 naming Content-Encoding for an unsupported content encoding', () => {
    const err = Object.assign(new Error('unsupported content encoding "compress"'), {
      status: 415, type: 'encoding.unsupported',
    });

    expect(errorResponse(err)).toEqual({
      status: 415, errors: ['The request body uses an unsupported Content-Encoding; use gzip, deflate, br, or none.'],
    });
  });

  it('answers a generic bad request for a client fault it has no message for', () => {
    const err = Object.assign(new URIError("Failed to decode param '%E0%A4%A'"), { status: 400 });

    expect(errorResponse(err)).toEqual({ status: 400, errors: ['Bad request'] });
  });

  it('answers 500 for an error with no status', () => {
    expect(errorResponse(new Error('there is no parameter $1'))).toEqual({ status: 500, errors: ['Internal server error'] });
  });

  it('answers 500 for a server fault, hiding its own status', () => {
    const err = Object.assign(new Error('stream is not readable'), { status: 500, type: 'stream.not.readable' });

    expect(errorResponse(err)).toEqual({ status: 500, errors: ['Internal server error'] });
  });

  it('answers 500 for a 503', () => {
    expect(errorResponse(Object.assign(new Error('down'), { status: 503 })).status).toBe(500);
  });

  it('answers 500 for a status below the 4xx range', () => {
    expect(errorResponse(Object.assign(new Error('odd'), { status: 399 })).status).toBe(500);
  });

  it('answers 500 for a status that is a string, not a number', () => {
    expect(errorResponse(Object.assign(new Error('odd'), { status: '400' })).status).toBe(500);
  });
});
