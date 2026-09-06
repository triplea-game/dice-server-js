# dice-server-js — local dev (docker compose) and prod deploy.
#
# SSH_USER selects the deploy ssh user (defaults to $USER); the prod deploy runs
# the ansible playbook under deploy/.

set shell := ["bash", "-euo", "pipefail", "-c"]

ssh_user := env_var_or_default("SSH_USER", env_var_or_default("USER", ""))

# Show available recipes.
default:
    @just --list

# Create .env, config.json, and RSA keys for a first-time setup.
init:
    #!/usr/bin/env bash
    if [ ! -f .env ]; then
      cp .env.example .env
      echo "Created .env from .env.example - fill in real credentials before running."
    else
      echo ".env already exists, skipping."
    fi
    if [ ! -f config.json ]; then
      cp config.example.json config.json
      echo "Created config.json from config.example.json - update display settings if needed."
    else
      echo "config.json already exists, skipping."
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
      echo "ERROR: config.json not found. Run 'just init' first." >&2
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

# Trigger deployment to prod.
deploy:
    ANSIBLE_CONFIG="deploy/ansible.cfg" ansible-playbook -e ansible_user={{ssh_user}} --inventory deploy/ansible/inventory.linode.yml deploy/ansible/playbook.yml
