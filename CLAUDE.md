# dice-server-js

Node dice-roll server for the TripleA lobby. See `README.md` for setup and
config; the `justfile` targets are all docker-compose orchestration (build /
run / stop), not the local dev loop.

## Package manager: yarn, not npm

This repo locks with `yarn.lock`; use `yarn install` / `yarn test`. Running
`npm install` rewrites `yarn.lock` in place — a spurious diff that is easy to
commit by accident. If you ran npm here, `git checkout -- yarn.lock` before
committing anything else.

## Tests

`yarn test` runs `jest` then `eslint .`. Two API-validation cases in
`test/api/api.test.js` (rejecting an out-of-range `times` / `max`) currently
fail on a clean checkout — a pre-existing red, not an environment problem, so
don't chase it as a setup gap. The rest of the suite is green.
