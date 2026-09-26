// Talks to the stack in compose.yml: the dice server and Mailpit's HTTP API.
const appUrl = process.env.E2E_APP_URL || 'http://localhost:17654';
const mailpitUrl = process.env.E2E_MAILPIT_URL || 'http://localhost:18025';

const uniqueEmail = (label) => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

const postForm = (path, fields, headers = {}) => fetch(`${appUrl}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
  body: new URLSearchParams(fields).toString(),
});

// Mail delivery is asynchronous, so poll until a message to `address` shows up.
const waitForEmailTo = async (address, subject) => {
  const query = encodeURIComponent(`to:"${address}" subject:"${subject}"`);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const search = await (await fetch(`${mailpitUrl}/api/v1/search?query=${query}`)).json();
    if (search.messages.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      return (await fetch(`${mailpitUrl}/api/v1/message/${search.messages[0].ID}`)).json();
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, 250); });
  }
  throw new Error(`No "${subject}" email to ${address} within 15s`);
};

// Links in the emails are HTML attributes, so '&' may arrive as '&amp;'.
const linkParam = (html, param) => {
  const match = html.match(new RegExp(`[?&](?:amp;)?${param}=([^"&]+)`));
  if (!match) throw new Error(`No ${param}= link parameter in email`);
  return decodeURIComponent(match[1]);
};

// Registers through the real flow: request, read the emailed token, confirm.
const registerEmail = async (address) => {
  const request = await postForm('/api/register', { email: address });
  if (request.status !== 200) throw new Error(`register ${address}: HTTP ${request.status}`);
  const email = await waitForEmailTo(address, 'Verify your E-Mail');
  const token = linkParam(email.HTML, 'token');
  const confirm = await postForm(`/api/register/${encodeURIComponent(token)}`, { email: address });
  if (confirm.status !== 200) throw new Error(`confirm ${address}: HTTP ${confirm.status}`);
};

module.exports = {
  appUrl, uniqueEmail, postForm, waitForEmailTo, linkParam, registerEmail,
};
