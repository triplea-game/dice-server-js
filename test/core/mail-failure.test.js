const { mailFailure } = require('../../src/core/mail-failure');

// The error shapes are nodemailer's, pinned by test/contract/smtp-transport.test.js
// for a refused connection and taken from the prod log for a rejected recipient.
describe('mailFailure', () => {
  it('answers 422 with the server response when the mail server rejected the recipient', () => {
    const err = Object.assign(new Error("Can't send mail - all recipients were rejected: 450 4.1.2 <a@nowhere.invalid>: Recipient address rejected: Domain not found"), {
      code: 'EENVELOPE',
      response: '450 4.1.2 <a@nowhere.invalid>: Recipient address rejected: Domain not found',
      responseCode: 450,
      command: 'RCPT TO',
    });

    expect(mailFailure(err, 'verification')).toEqual({
      status: 422,
      errors: ['The mail server rejected the address: 450 4.1.2 <a@nowhere.invalid>: Recipient address rejected: Domain not found'],
    });
  });

  it('falls back to the message when an envelope rejection has no server response', () => {
    const err = Object.assign(new Error('No recipients defined'), { code: 'EENVELOPE', command: 'API' });

    expect(mailFailure(err, 'verification').errors).toEqual(['The mail server rejected the address: No recipients defined']);
  });

  it('answers 503 asking for a retry when the mail server could not be reached', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:25'), { code: 'ESOCKET', command: 'CONN' });

    expect(mailFailure(err, 'roll')).toEqual({
      status: 503,
      errors: ["The dice server couldn't send the roll email; please try again."],
    });
  });

  it('answers 503 when the server hung up mid-conversation', () => {
    const err = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT', command: 'DATA' });

    expect(mailFailure(err, 'roll').status).toBe(503);
  });

  it('leaves an error that is not the mail transport alone', () => {
    expect(mailFailure(new Error('there is no parameter $1'), 'roll')).toBeUndefined();
  });
});
