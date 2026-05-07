MODEL        ?= ai/gemma4:E4B
CONTEXT_SIZE ?= 40192
DMR_PORT     ?= 12434

.PHONY: install check run kill-port kill-bun-sock kill-dev

install: ## Enable Model Runner, pull the model, set context size
	@docker version >/dev/null || (echo "❌ Docker not running"; exit 1)
	@docker model version >/dev/null 2>&1 || \
	  (echo "❌ docker model plugin missing — update Docker Desktop to 4.41+"; exit 1)
	docker desktop enable model-runner --tcp $(DMR_PORT) || true
	docker model pull $(MODEL)
	docker model configure --context-size $(CONTEXT_SIZE) $(MODEL)

check: ## Show runner status, loaded models, and current config
	@docker model status
	@echo
	@docker model list
	@echo
	@docker model inspect $(MODEL)

run: ## Start the stack
	docker compose up --build

kill-port: ## Kill all processes listening on PORT (default 3000)
	@PORT=$${PORT:-8000}; \
	PIDS=$$(lsof -ti tcp:$$PORT); \
	if [ -z "$$PIDS" ]; then \
	  echo "No processes on port $$PORT"; \
	else \
	  echo "Killing PIDs on port $$PORT: $$PIDS"; \
	  kill -9 $$PIDS; \
	fi

kill-port-test: ## Kill all processes listening on PORT (default 8000)
	@PORT=$${PORT:-8000}; \
	PIDS=$$(lsof -ti tcp:$$PORT); \
	if [ -z "$$PIDS" ]; then \
	  echo "No processes on port $$PORT"; \
	else \
	  echo "Killing PIDs on port $$PORT: $$PIDS"; \
	  kill -9 $$PIDS; \
	fi


kill-bun-sock: ## Remove stale Bun debugger unix sockets in $TMPDIR with no live owner
	@DIR="$${TMPDIR:-/tmp}"; \
	find "$$DIR" -maxdepth 1 -type s -name '*.sock' \
	  ! -name '*-*' ! -name '*_*' ! -name '*.*.sock' 2>/dev/null \
	  | while read -r s; do \
	    base=$$(basename "$$s" .sock); \
	    case "$$base" in *[!a-z0-9]*) continue;; esac; \
	    [ $${#base} -gt 13 ] && continue; \
	    if ! lsof "$$s" >/dev/null 2>&1; then \
	      echo "Removing stale Bun socket: $$s"; \
	      rm -f "$$s"; \
	    fi; \
	  done

kill-dev: kill-port kill-port-test kill-bun-sock ## Kill dev server (port 3000) and clean stale Bun sockets

run-llm: ## Run a test LLM query against the model runner
	@docker model configure --context-size 40960 ai/gemma4:E4B

db: ## Start the postgres database
	docker compose up -d db