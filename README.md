[![Travis](https://img.shields.io/travis/triplea-game/dice-server-js.svg?style=flat-square)](https://travis-ci.org/triplea-game/dice-server-js)
# dice-server-js
The new TripleA dice server re-written in JavaScript.

## Setup
### Prequisites
In order to be able to run the server you need to have a couple of things installed on your system:
 - `node.js` >= 10
 - `yarn`
 - `postgres` >= 10
After those are installed on your system you can follow the steps below to get yourself up and running.
The steps assume node and yarn are on the `PATH` of your system, if that's not the case, you need to replace `node` and `yarn` with the fully-qualified path name to the executable.

### One-Time-Setup
1. Clone this Repository in a directory of your choice.
2. Open a terminal and navigate to the newly checked out directory.
3. Run `yarn install`, this will resolve all dependencies for you and install them in `node_modules`
4. - Generate an RSA key-pair. If you have installed `openssl` and it's on your PATH, you can simply run `yarn generate-keypair`, which will create the files `privkey.pem` and `pubkey.pem` in the current directory.
   - On production systems you should move them into a "save directory" and (at least on UNIX-like systems) restrict read access of the private key to the user that's going to run the server and root.
5. - Create a file `config.json` which contains all information the server needs to start.
   - Alternatively those configuration options can be passed via CLI directly or as environment variables. Check the [nconf docs](https://github.com/indexzero/nconf#example) for more information.
   - The config files' layout will be explained below.
6. Create a database in Postgres to be used by the server.
   
#### config.json
```json
{
  "port": 7654,
  "database": {
    "username": "postgres",
    "password": "",
    "host": "localhost",
    "port": 5432,
    "database": "dicedb"
  },
  "email": {
    "smtp": {
      "host": "smtp.provider.com",
      "port": 587,
      "auth": {
        "user": "your.email@provider.com",
        "pass": "super secret password no one will ever guess"
      }
    },
    "display": {
      "sender": "\"Display Name\" <your.email@provider.com>",
      "server": {
        "protocol": "http",
        "host": "localhost",
        "port": 7654,
        "baseurl": ""
      }
    }
  },
  "keys": {
    "private": "./privkey.pem",
    "public": "./pubkey.pem"
  }
}
```
- `port`: The port node.js will listen on. Required.
- `database`: Details about the database connection. Required.
   - `username`: Username to authenticate with the Database. Default: `postgres`.
   - `password`: Password to authenticate with the Database. Default ` `.
   - `host`: Hostname to connect to the Database. Default `localhost`.
   - `port`: Port to connect to the Database. Default `5432`.
   - `database`: Name of the Database to use, this should be the Database you created in the one-time setup. Default `dicedb`.
- `email`: Settings that are used by the EmailManager. Required.
   - `smtp`: Nodemailer SMTP Configuration, this object will be passed directly to Nodemailer without any further processing. Check the [Nodemailer Docs](https://nodemailer.com/smtp/#general-options). If you need a service to test emails locally you can use [Ethereal](https://ethereal.email/), a dummy email service that doesn't actually sends emails but simulates a fully-featured SMTP server.
   - `display`: Display settings how the server will refer to itself in emails.
      - `sender`: The Entry for the `From:` field in the email. The actual email should be the correct one, otherwise the emails will likely land in SPAM Folders. Required.
      - `server`: Settings that define how the Server will refer to itself in E-Mails. Required.
         - `protocol`: The protocol that should be used to connect to this server. Default `http`.
         - `host`: The hostname that should be used to refer to this server, ideally a domain. Default `localhost`.
         - `port`: The port that should be used to connect to this server, if used behind a reverse-proxy this should be the public port. Default: `7654`.
         - `baseurl`: In case your server is in a non-root installation, set this to the folder name. (Example `yourserver.com/dice` -> `/dice`.) Default ` `.
- `keys`:
   - `private`: Path to the private key used to sign dice rolls. Required.
   - `public`: Path to the public key used to sign dice rolls. Required.
   
### Starting
In order to start the server run
`node dice-server.js`
It can be terminated using `SIGTERM`, i.e. `Ctrl+C`.

### Testing
In order to run all local tests and eslint, you can simply run
`yarn test`
This is also the command that will be executed by Travis.

## Routes
The dice server is divided into 2 seperate routers.
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
   - A request to this endpoint sends an email to the specified email with a random 512-bit token that is only saved in the RAM and will expire after a maximum amount of 60 minutes.
- POST `/register/:token`:
   - `:token` Parameter:
      - This parameter is a base64-encoded random number to verify that the person registering the email actually has access.
      - If the token is wrong, the actual token automatically expires and a new confirmation email needs to be sent.
   - Required Parameters (POST Body, urlencoded):
      - `email` String: The email to compare the token with.
- POST `/unregister`
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
   - The Page where users can unregister their email.
   - Paramaters:
      - `email` String, optional: The email to remove from the database, used to pre-fill the form.
