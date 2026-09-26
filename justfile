# dice-server-js — local dev (docker compose) and prod deploy.
#
# SSH_USER selects the deploy ssh user (defaults to $USER); the prod deploy runs
# the ansible playbook under deploy/.

set shell := ["bash", "-euo", "pipefail", "-c"]

ssh_user := env_var_or_default("SSH_USER", env_var_or_default("USER", ""))

# Show available recipes.
default:
    @just --list

# Create .env and RSA keys for a first-time setup (config.json is committed).
init:
    #!/usr/bin/env bash
    if [ ! -f .env ]; then
      cp .env.example .env
      echo "Created .env from .env.example - fill in real credentials before running."
    else
      echo ".env already exists, skipping."
    fi
    mkdir -p keys
    if [ ! -f keys/privkey.pem ]; then
      openssl genrsa -out keys/privkey.pem 4096
      openssl rsa -in keys/privkey.pem -outform PEM -pubout -out keys/pubkey.pem
      chmod 644 keys/privkey.pem keys/pubkey.pem
      echo "Generated RSA key pair in keys/"
    else
      echo "RSA keys already exist, skipping."
    fi

# Start all services in the background.
run: _check-config
    docker compose up --build --force-recreate -d

_check-config:
    #!/usr/bin/env bash
    if [ ! -f .env ]; then
      echo "ERROR: .env not found. Run 'just init' and fill in credentials first." >&2
      exit 1
    fi
    if [ ! -f config.json ]; then
      echo "ERROR: config.json not found. It is committed; restore it with 'git checkout -- config.json'." >&2
      exit 1
    fi
    if [ ! -f keys/privkey.pem ] || [ ! -f keys/pubkey.pem ]; then
      echo "ERROR: RSA keys not found in keys/. Run 'just init' first." >&2
      exit 1
    fi

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

# Build the app image without starting services.
build:
    docker compose build

# Stop services and remove volumes (wipes the database).
clean:
    docker compose down -v

# Deploy an image tag to prod (CI passes sha-<commit>).
deploy tag="latest":
    ANSIBLE_CONFIG="deploy/ansible.cfg" ansible-playbook -e ansible_user={{ssh_user}} -e marti_tag={{tag}} --inventory deploy/ansible/inventory.linode.yml deploy/ansible/playbook.yml

# Run the smoke and game-client tests against a throwaway stack built from this checkout
e2e:
    #!/usr/bin/env bash
    set -euo pipefail
    keys=test/e2e/.keys
    mkdir -p "$keys"
    if [ ! -f "$keys/privkey.pem" ]; then
      # 4096 bits: the verify API only accepts 684-char signatures.
      openssl genrsa -out "$keys/privkey.pem" 4096 2>/dev/null
      openssl rsa -in "$keys/privkey.pem" -pubout -out "$keys/pubkey.pem" 2>/dev/null
      # The image runs as a non-root user that must read the mounted keys.
      # Only chmod here: keys another user generated can't be chmodded by us.
      chmod 644 "$keys"/*.pem
    fi
    compose() { docker compose -f test/e2e/compose.yml "$@"; }
    cleanup() {
      local status=$?
      # A first `down` under rootless Podman sometimes leaves a container behind.
      compose down -v --remove-orphans >/dev/null 2>&1 \
        || compose down -v --remove-orphans >/dev/null 2>&1 \
        || echo "warning: e2e stack cleanup failed; run: docker compose -f test/e2e/compose.yml down -v" >&2
      exit "$status"
    }
    trap cleanup EXIT
    if ! compose up --build --wait --wait-timeout 180; then
      compose logs
      exit 1
    fi
    if ! npx --no-install jest --config jest.e2e.config.js; then
      compose logs app
      exit 1
    fi
