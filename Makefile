.PHONY: run stop restart logs build clean init deploy
SSH_USER ?= $${USER}

## Create .env, config.json, and RSA keys for a first-time setup
init:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example - fill in real credentials before running."; \
	else \
		echo ".env already exists, skipping."; \
	fi
	@if [ ! -f config.json ]; then \
		cp config.example.json config.json; \
		echo "Created config.json from config.example.json - update display settings if needed."; \
	else \
		echo "config.json already exists, skipping."; \
	fi
	@mkdir -p keys
	@if [ ! -f keys/privkey.pem ]; then \
		openssl genrsa -out keys/privkey.pem 4096 && \
		openssl rsa -in keys/privkey.pem -outform PEM -pubout -out keys/pubkey.pem && \
		chmod 644 keys/privkey.pem keys/pubkey.pem && \
		echo "Generated RSA key pair in keys/"; \
	else \
		echo "RSA keys already exist, skipping."; \
	fi

## Start all services in the background
run: _check-config
	docker compose up --build --force-recreate -d

_check-config:
	@if [ ! -f .env ]; then \
		echo "ERROR: .env not found. Run 'make init' and fill in credentials first."; \
		exit 1; \
	fi
	@if [ ! -f config.json ]; then \
		echo "ERROR: config.json not found. Run 'make init' first."; \
		exit 1; \
	fi
	@if [ ! -f keys/privkey.pem ] || [ ! -f keys/pubkey.pem ]; then \
		echo "ERROR: RSA keys not found in keys/. Run 'make init' first."; \
		exit 1; \
	fi

## Stop all running services
stop:
	docker compose down

## Restart all services (rebuilds the app image)
restart:
	docker compose down
	docker compose up --build -d

## Stream logs from all services (Ctrl-C to exit)
logs:
	docker compose logs -f

## Build the app image without starting services
build:
	docker compose build

## Stop services and remove volumes (wipes the database)
clean:
	docker compose down -v

deploy: ## Triggers deployment to prod
        ANSIBLE_CONFIG="deploy/ansible.cfg" \
          ansible-playbook \
            -e ansible_user=$(SSH_USER) \
            --inventory deploy/ansible/linode.inventory.yml \
            deploy/ansible/playbook.yml
