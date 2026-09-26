const { describeResponse } = require('../../public/static/js/ajax-form');

describe('describeResponse', () => {
  it('reports a failed signature check as an error even though status is OK', () => {
    const outcome = describeResponse({ status: 'OK', result: { valid: false } }, 'Success!');

    expect(outcome).toEqual({
      ok: false,
      errors: ['Invalid! These dice do not match what this server rolled.'],
    });
  });

  it('shows the success text for a valid current-format roll', () => {
    const outcome = describeResponse({ status: 'OK', result: { valid: true } }, 'Success!');

    expect(outcome).toEqual({ ok: true, text: 'Success!' });
  });

  it('flags a valid legacy roll as weakly protected instead of plain success', () => {
    const outcome = describeResponse({ status: 'OK', result: { valid: true, legacy: true } }, 'Success!');

    expect(outcome).toEqual({ ok: true, text: 'Valid (old format, weakly protected)' });
  });

  it('shows the success text for OK responses with no result, like registration', () => {
    const outcome = describeResponse({ status: 'OK' }, 'Registered!');

    expect(outcome).toEqual({ ok: true, text: 'Registered!' });
  });

  it('passes through server errors for a non-OK response', () => {
    const outcome = describeResponse({ status: 'Error', errors: ['Email has invalid format'] }, 'Success!');

    expect(outcome).toEqual({ ok: false, errors: ['Email has invalid format'] });
  });
});
