# dice-server-js

- **Pushing `main` deploys to prod** (`.github/workflows/main.yml`). Never push
  unless explicitly told to.
- **yarn, not npm.** `npm install` rewrites `yarn.lock` into a spurious diff; if
  you ran it, `git checkout -- yarn.lock` before committing.
- The `justfile` is the dev loop: `just setup` once (yarn install plus a
  pre-push hook running `just format` and `just check`), `just up` to run the
  server on the host with Postgres and Mailpit in docker, `just unit` for the
  fast jest + eslint run, `just check` for unit plus e2e (what CI gates on).
- `just e2e` runs the contract, smoke and game-client tests against the built
  image with real Postgres and Mailpit.
- Test layout: `test/core/` pure functions with real values; `test/shell/` the
  real Express app with the in-memory fakes in `test/fakes/`; `test/contract/`
  holds each fake to the real Postgres/SMTP behavior (runs under `just e2e`).
  New decision logic goes in `src/core/`; new I/O is injected via `createApp`.
- `just deploy <tag>` deploys to prod; the tag is required, CI passes
  `sha-<commit>`.
