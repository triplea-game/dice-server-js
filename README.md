[![Travis](https://img.shields.io/travis/triplea-game/dice-server-js.svg?style=flat-square)](https://travis-ci.org/triplea-game/dice-server-js)
# dice-server-js
The new TripleA dice server powered by Node.js
## Usage
Roll using `/roll/:max/:times/:email1/:email2`:
It returns a dice array, a signature and a date (the date is used to salt the signature, so we get a different one even if the dice are rolled the same). Emails are supposed to be sent to the given adresses, as long as they are registered, not implemented yet.

Verify using `/verify/:diceArray/:signature/:date`:
The date param is used to deteremine the correct public key (updates after 4 months), and is the required salt, when converted to a UNIX epoch (in ms).
