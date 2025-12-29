# Mochi Repositories app

all: web

web:
	cd web && pnpm run build

dev:
	cd web && pnpm run dev

clean:
	rm -rf web/dist web/node_modules

.PHONY: all web dev clean
