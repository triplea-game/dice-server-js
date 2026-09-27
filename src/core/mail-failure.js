// Turns a failed send into the answer the player sees, or undefined when the
// error is not the mail transport's and should stay an internal error.
// Error strings are user-facing; the TripleA client shows them to players.
//
// nodemailer tags every SMTP failure with the command that failed ('CONN',
// 'RCPT TO', ...) and sets code 'EENVELOPE' when the server refused the
// envelope, ie: a recipient it will not deliver to; the server's own response
// ("450 4.1.2 ... Domain not found") is the most useful thing to show then.
// `purpose` names the email in the retry message: 'roll', 'verification'.
const mailFailure = (err, purpose) => {
  if (err.code === 'EENVELOPE') {
    return {
      status: 422,
      errors: [`The mail server rejected the address: ${err.response || err.message}`],
    };
  }
  if (typeof err.command === 'string') {
    return {
      status: 503,
      errors: [`The dice server couldn't send the ${purpose} email; please try again.`],
    };
  }
  return undefined;
};

module.exports = { mailFailure };
