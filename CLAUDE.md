# dice-server-js

- **Pushing `main` deploys to prod** (`.github/workflows/main.yml`). Never push
  unless explicitly told to.
- **yarn, not npm.** `npm install` rewrites `yarn.lock` into a spurious diff; if
  you ran it, `git checkout -- yarn.lock` before committing.
- `yarn test` runs jest then eslint; it's the full check.
- The `justfile` is docker compose orchestration plus `just deploy` (prod), not
  the local dev loop.
