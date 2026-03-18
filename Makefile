SHELL := /bin/sh

.PHONY: install build lint test typecheck up down logs migrate risk-import risk-verify

install:
	pnpm install

build:
	pnpm build

lint:
	pnpm lint

test:
	pnpm test

typecheck:
	pnpm typecheck

up:
	docker-compose up --build

down:
	docker-compose down --remove-orphans

logs:
	docker-compose logs -f

migrate:
	pnpm db:migrate

risk-import:
	pnpm risk:import

risk-verify:
	pnpm risk:verify
