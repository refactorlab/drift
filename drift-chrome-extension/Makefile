# =============================================================================
# drift-chrome-extension — Drift side-panel app (MV3 + React + Vite/CRXJS)
#
#   make dev     # hot-reload dev server — load dist/ unpacked, then just save
#   make build   # production build → dist/
#   make test    # vitest (parser unit + real-comment integration)
#
# Help is auto-generated: add `## doc` after a target ':'.
# =============================================================================

NPM ?= npm
# Vite/CRXJS uses 5181 and walks upward when it's busy — cover a small range.
DEV_PORTS ?= 5181 5182 5183 5184 5185 5186

BLUE   := \033[1;34m
GREEN  := \033[1;32m
YELLOW := \033[1;33m
CYAN   := \033[1;36m
RESET  := \033[0m

.DEFAULT_GOAL := help
.PHONY: help install dev build test typecheck zip store-assets release clean kill

help: ## Show this help
	@printf "\n$(BLUE)drift-chrome-extension — make targets$(RESET)\n\n"
	@awk 'BEGIN { FS = ":.*## " } \
		/^[a-zA-Z0-9_.-]+:.*## / { printf "    $(BLUE)%-12s$(RESET) %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)
	@printf "\n"

# Install only when the lockfile/manifest is newer than node_modules. The touch
# bumps the dir mtime so the prerequisite is satisfied for the rest of the run.
node_modules: package.json package-lock.json
	@printf "$(BLUE)▶$(RESET) npm install\n"
	@$(NPM) install
	@touch node_modules

install: node_modules ## Install npm deps (idempotent)
	@printf "$(GREEN)✓$(RESET) deps installed\n"

dev: node_modules ## Dev server with hot-reload (Vite + CRXJS); writes dist/, reloads on save
	@printf "$(YELLOW)→$(RESET) Load $(CYAN)$(CURDIR)/dist$(RESET) at chrome://extensions (Developer mode → Load unpacked)\n"
	@printf "$(YELLOW)→$(RESET) Then click the $(CYAN)Drift$(RESET) toolbar icon to open the side panel. Saving a file hot-reloads it.\n\n"
	@$(NPM) run dev

build: node_modules ## Production build → dist/
	@printf "$(BLUE)▶$(RESET) vite build\n"
	@$(NPM) run build
	@printf "$(GREEN)✓$(RESET) built → $(CYAN)dist/$(RESET)\n"

test: node_modules ## Run the test suite (vitest: parser unit + integration)
	@$(NPM) run test

typecheck: node_modules ## Type-check without emitting (tsc --noEmit)
	@$(NPM) run typecheck

zip: node_modules ## Build + zip → release/drift.zip (store upload)
	@$(NPM) run zip

store-assets: node_modules ## Generate Web Store listing images → release/store-assets/
	@printf "$(BLUE)▶$(RESET) generating store assets\n"
	@$(NPM) run store-assets

release: node_modules ## Full Chrome Web Store release bundle: store images + upload zip
	@printf "$(BLUE)▶$(RESET) building Chrome Web Store release\n"
	@$(NPM) run store-assets
	@$(NPM) run zip
	@printf "$(GREEN)✓$(RESET) release ready → $(CYAN)release/drift-lens.zip$(RESET) + $(CYAN)release/store-assets/$(RESET)\n"

clean: ## Remove build artifacts (dist/, release/, generated icons)
	@rm -rf dist release public/icons
	@printf "$(GREEN)✓$(RESET) cleaned\n"

kill: ## Stop any running dev servers (frees the Vite/CRXJS ports 5181+)
	@stopped=0; \
	for p in $(DEV_PORTS); do \
	  pids=$$(lsof -ti tcp:$$p 2>/dev/null); \
	  if [ -n "$$pids" ]; then \
	    printf "$(YELLOW)→$(RESET) port $$p → killing %s\n" "$$pids"; \
	    kill $$pids 2>/dev/null || true; stopped=1; \
	  fi; \
	done; \
	pkill -f "$(CURDIR).*vite" 2>/dev/null || true; \
	if [ "$$stopped" = "0" ]; then printf "$(GREEN)✓$(RESET) no dev servers were running\n"; \
	else printf "$(GREEN)✓$(RESET) dev servers stopped\n"; fi
