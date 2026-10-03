# dice-server-js
The new TripleA dice server re-written in JavaScript.

## Ops
```
docker container ls
sudo systemctl restart marti.service
sudo journalctl -u marti.service -n 1000
```

## Local Dev

Needs node 22, yarn, just, and docker (or podman).

```
just setup   # once: yarn install and the pre-push hook
just up      # server on the host, restarts on edits; Postgres and Mailpit in docker
```

`just compose-up` runs the whole stack, app included, in docker instead.
`just --list` shows every recipe.

App is at:
http://localhost:7654

Emails console at:
http://localhost:8025


## Configuration
The server reads `config.json` from its working directory. The committed one is
written for the docker stack; command-line flags such as
`--database:host=localhost` override it, which is how `just up` points it at
the host. In production, `config.json`, the secrets and the keys come from the
`marti/service` role in the infrastructure repo.

Secrets come from the environment:
- `DB_PASSWORD`: the database password, the only place it's read from; a
  `database.password` in `config.json` is ignored.
- `SMTP_USER`, `SMTP_PASS`: optional SMTP auth, overriding `email.smtp.auth`.

`config.json` fields:
- `port`: The port node.js will listen on. Default `7654`.
- `database`: Details about the database connection.
   - `username`: Default `postgres`.
   - `host`: Default `localhost`.
   - `port`: Default `5432`.
   - `database`: Default `dicedb`.
- `email`: Settings that are used by the EmailManager.
   - `smtp`: Nodemailer SMTP Configuration, passed to Nodemailer as is. Check the [Nodemailer Docs](https://nodemailer.com/smtp/#general-options). Required.
   - `display`: Display settings how the server will refer to itself in emails.
      - `sender`: The Entry for the `From:` field in the email. The actual email should be the correct one, otherwise the emails will likely land in SPAM Folders. Required.
      - `server`: How the server refers to itself in links in emails.
         - `protocol`: Default `http`.
         - `host`: The hostname, ideally a domain. Default `localhost`.
         - `port`: The public port; behind a reverse proxy, the proxy's port. Default `7654`.
         - `baseurl`: In case your server is in a non-root installation, set this to the folder name. (Example `yourserver.com/dice` -> `/dice`.) Defaults to an empty String.
- `keys`: Paths to the RSA key pair that signs dice rolls. Required. `just up` and
  `just compose-up` generate a local pair in `keys/` (gitignored) if it's missing.
   - `private`
   - `public`

### Testing
`just unit` runs the unit tests and eslint. `just e2e` builds the image and
runs the smoke and game-client tests in `test/e2e/` against it, with a
throwaway Postgres and Mailpit. `just check` runs both; CI runs both on every
pull request and before every deploy, and the pre-push hook from `just setup`
runs `just check` before every push.

## Routes
The dice server is divided into 2 separate routers.
The REST Service handles all calls under `/api`.
All other requests are handled by the _frontend_ which basically wraps the API calls with a nice UI.
### API
All of the requests return JSON in the same format.
When successful:
```json
{
  "status": "OK",
  "result": {
    "some info": "some value",
    "other info": true
  }
}
```
`result` is optional, if it's not present this simply means that the server has no additional information for this request.
On Error:
```json
{
  "status": "Error",
  "errors": ["List", "of", "error", "messages"]
}
```
#### Routes
- POST `/api/roll`:
   - Required Parameters (POST Body, urlencoded):
      - `max` Integer. Specifies the highest outcome for each roll, must be <= 100.
      - `times` Integer. Specifies how many dice should be rolled, must be <= 100.
      - `email1` String. The first email to send the notification email to. This email needs to be registered.
      - `email2` String. The second email to send the notification to. This email needs to be registered.
   - Generates `times` random numbers with a value in `[1, max]`.
   - Result
      - `dice` Integer Array: An array of the rolled dice.
      - `date` Integer: The current UNIX timestamp with millisecond precision. Taken into account for the signature so the signature can't be reused in the future.
      - `signature`: The base64-encoded signature verifying the integrity of the rolled dice.
- GET `/api/verify/:token`:
   - `:token` Parameter:
      - This parameter is actually a base64-encoded, urlencoded JSON string of roughly this scheme: `{ "dice": [1, 2, 3], "date": 121332, "signature": "base64encodedsignature" }`.
      - `dice` Integer Array: An array of the dice rolls to be verified.
      - `date` Integer: A Unix Timestamp of the exact millisecond the original request was made. Important for the signature, and could potentially be used to check if this signature was made with a legacy certificate.
      - `signature` String: A base64-encoded RSA signature that can be verified by the server.
      - Result:
         - `valid`: A Boolean indicating if the integrity could be confirmed.
- POST `/register`:
   - Required Parameters (POST Body, urlencoded):
      - `email` String: The email a confirmation email will be sent to.
   - A request to this endpoint sends an email to the specified email with a signed token that expires after 24 hours. The token is an HMAC over the email, the action and the expiry, so it needs no server-side state: restarts don't invalidate emailed links, and a wrong guess doesn't cancel anything.
- POST `/register/:token`:
   - `:token` Parameter:
      - The token from the confirmation email, `<expiry>.<mac>`, proving that the person registering the email actually has access.
   - Required Parameters (POST Body, urlencoded):
      - `email` String: The email the token was issued for.
- POST `/unregister`
   - Required Parameters (POST Body, urlencoded):
      - `email` String: The email to remove from the database.
   - Sends a confirmation email with a signed 24-hour token to that address if it is registered. The response is `OK` either way, so it doesn't reveal which emails are registered.
- POST `/unregister/:token`
   - `:token` Parameter:
      - The token from the confirmation email. Register and unregister tokens are not interchangeable.
   - Required Parameters (POST Body, urlencoded):
      - `email` String: The email to remove from the database.
### Frontend
The _Frontend_ is being served using templates and the liquid format.
The same template engine is used for emails as well.
Basically all pages consist of a classic HTML form that gets replaced with a responsive AJAX system if JavaScript is available.
#### Routes
- GET `/`:
   - The index page where users can register their emails.
- GET `/verify`:
   - The page the emails redirect to to verify your emails.
   - Parameters:
      - `token` String: The token to pass to the `/api/verify` endpoint.
- GET `/register`:
   - The page the "confirm-registration-email" redirects to to press a confirm button in a user-friendly way.
   - Parameters:
      - `email` String: The email to confirm the registration for.
      - `token` String: The token to pass to the `/api/register/:token` endpoint.
- GET `/unregister`
   - The page where users can ask to unregister their email; with a `token` it is the page the confirmation email redirects to.
   - Parameters:
      - `email` String, optional: The email to remove from the database, used to pre-fill the form.
      - `token` String, optional: The token to pass to the `/api/unregister/:token` endpoint.
