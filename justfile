# dice-server-js — dev loop, tests, local docker compose stack, and prod deploy.
#
# SSH_USER selects the deploy ssh user (defaults to $USER); the prod deploy runs
# the ansible playbook under deploy/.

set shell := ["bash", "-euo", "pipefail", "-c"]

ssh_user := env_var_or_default("SSH_USER", env_var_or_default("USER", ""))

alias test := check

# Show available recipes.
default:
    @just --list

# Install node dependencies and pre-commit as a pre-push git hook (format + check).
setup:
    uv tool install pre-commit
    pre-commit install --hook-type pre-push
    yarn install --frozen-lockfile

# Run the server on the host, restarting on file changes; Postgres and Mailpit run in docker.
dev: (_keys "keys")
    #!/usr/bin/env bash
    set -euo pipefail
    # The app container from 'just run' would hold port 7654.
    docker compose stop app
    docker compose up -d --wait postgres mailpit
    host_port() { docker compose port "$1" "$2" | head -n 1 | sed 's/.*://'; }
    echo "App at http://localhost:7654, emails at http://localhost:8025"
    DB_PASSWORD=change-me exec node --watch dice-server.js \
      --database:host=localhost --database:port="$(host_port postgres 5432)" \
      --email:smtp:host=localhost --email:smtp:port="$(host_port mailpit 1025)" \
      --keys:private=keys/privkey.pem --keys:public=keys/pubkey.pem

# Run the unit tests and eslint (fast, no docker).
unit:
    yarn test

# Run every test CI gates on: unit tests and eslint, then the e2e suite.
check: unit e2e

# Fix eslint findings in place.
format:
    yarn eslint --fix .

# Auto-format then verify — the recommended pre-push loop.
verify: format check

# Start the full stack, app included, in docker in the background.
run: (_keys "keys")
    docker compose up --build --force-recreate -d

# Stop all running services.
stop:
    docker compose down

# Restart all services (rebuilds the app image).
restart:
    docker compose down
    docker compose up --build -d

# Stream logs from all services (Ctrl-C to exit).
logs:
    docker compose logs -f

# Open a psql shell on the database started by 'just run' or 'just dev'.
psql:
    docker compose exec postgres psql -U postgres dicedb

# Build the app image without starting services.
build:
    docker compose build

# Stop services and remove volumes (wipes the database).
clean:
    docker compose down -v

# Deploy an image tag to prod, eg: just deploy sha-<full commit sha> (what CI passes).
deploy tag:
    ANSIBLE_CONFIG="deploy/ansible.cfg" ansible-playbook -e ansible_user={{ssh_user}} -e marti_tag={{tag}} --inventory deploy/ansible/inventory.linode.yml deploy/ansible/playbook.yml

# Run the smoke and game-client tests against a throwaway stack built from this checkout
e2e: (_keys "test/e2e/.keys")
    #!/usr/bin/env bash
    set -euo pipefail
    # A per-run project keeps concurrent runs' containers, networks and images apart.
    project="dice-e2e-$$"
    compose() { docker compose -p "$project" -f test/e2e/compose.yml "$@"; }
    cleanup() {
      local status=$?
      # A first `down` under rootless Podman sometimes leaves a container behind.
      # `--rmi local` drops the per-run app image; its layers stay cached.
      compose down -v --remove-orphans --rmi local >/dev/null 2>&1 \
        || compose down -v --remove-orphans --rmi local >/dev/null 2>&1 \
        || echo "warning: e2e stack cleanup failed; run: docker compose -p $project -f test/e2e/compose.yml down -v --rmi local" >&2
      exit "$status"
    }
    trap cleanup EXIT
    if ! compose up --build --wait --wait-timeout 180; then
      compose logs
      exit 1
    fi
    host_port() { compose port "$1" "$2" | head -n 1 | sed 's/.*://'; }
    export E2E_APP_URL="http://localhost:$(host_port app 7654)"
    export E2E_MAILPIT_URL="http://localhost:$(host_port mailpit 8025)"
    export E2E_SMTP_PORT="$(host_port mailpit 1025)"
    export E2E_DB_PORT="$(host_port postgres 5432)"
    if ! npx --no-install jest --config jest.e2e.config.js; then
      compose logs app
      exit 1
    fi

# Generate the RSA signing key pair in a directory unless it already exists.
_keys dir:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p "{{dir}}"
    if [ ! -f "{{dir}}/privkey.pem" ]; then
      # 4096 bits: the verify API only accepts 684-char signatures.
      openssl genrsa -out "{{dir}}/privkey.pem" 4096 2>/dev/null
      openssl rsa -in "{{dir}}/privkey.pem" -pubout -out "{{dir}}/pubkey.pem" 2>/dev/null
      # The image runs as a non-root user that must read the mounted keys.
      # Only chmod here: keys another user generated can't be chmodded by us.
      chmod 644 "{{dir}}"/*.pem
    fi
