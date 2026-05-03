.PHONY: run stop restart logs build clean init

## Copy config.example.json to config.json and create the keys/ directory
init:
	@if [ ! -f config.json ]; then \
		cp config.example.json config.json; \
		echo "Created config.json from config.example.json - edit it before running."; \
	else \
		echo "config.json already exists, skipping."; \
	fi
	@mkdir -p keys

## Start all services in the background
run: _check-config
	docker compose up --build -d

_check-config:
	@if [ ! -f config.json ]; then \
		echo "ERROR: config.json not found. Run 'make init' and edit config.json first."; \
		exit 1; \
	fi
	@if [ ! -d keys ]; then \
		echo "ERROR: keys/ directory not found. Run 'make init' and generate keys first."; \
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

