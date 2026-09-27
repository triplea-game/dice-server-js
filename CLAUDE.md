# dice-server-js

- **Pushing `main` deploys to prod** (`.github/workflows/main.yml`). Never push
  unless explicitly told to.
- **yarn, not npm.** `npm install` rewrites `yarn.lock` into a spurious diff; if
  you ran it, `git checkout -- yarn.lock` before committing.
- `yarn test` runs jest then eslint (unit tests). `just e2e` runs the smoke and
  game-client tests in `test/e2e/` against the built image with real Postgres
  and Mailpit; run it for dependency, Dockerfile, or wiring changes.
- Test layout: `test/core/` pure functions with real values; `test/shell/` the
  real Express app with the in-memory fakes in `test/fakes/`; `test/contract/`
  holds each fake to the real Postgres/SMTP behavior (runs under `just e2e`).
  New decision logic goes in `src/core/`; new I/O is injected via `createApp`.
- The `justfile` is docker compose orchestration plus `just deploy <tag>` (prod;
  the tag is required, CI passes `sha-<commit>`), not the local dev loop.
