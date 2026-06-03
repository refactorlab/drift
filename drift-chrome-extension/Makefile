# =============================================================================
# drift-chrome-extension — Drift side-panel app (MV3 + React + Vite/CRXJS)
#
#   make dev     # hot-reload dev server — load dist/ unpacked, then just save
#   make build   # production build → dist/
#   make prod    # standalone production deploy → dist/ (no dev server, verified dev-free)
#   make test    # vitest (parser unit + real-comment integration)
#
# Help is auto-generated: add `## doc` after a target ':'.
# =============================================================================

NPM ?= npm
# Vite/CRXJS uses 5181 and walks upward when it's busy — cover a small range.
DEV_PORTS ?= 5181 5182 5183 5184 5185 5186
# The live scan loads this packaged WASM scanner; dev/build stage it if missing.
WASM := public/drift-static-profiler.wasm

BLUE   := \033[1;34m
GREEN  := \033[1;32m
YELLOW := \033[1;33m
CYAN   := \033[1;36m
RESET  := \033[0m

.DEFAULT_GOAL := help
.PHONY: help install dev build prod test typecheck zip store-assets release clean kill ensure-wasm wasm tts doctor logs

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

# Stage the scanner WASM into public/ so the live scan can load it. Builds it
# ONCE if missing. The build script self-bootstraps its toolchain (auto-installs
# wasi-sdk for your OS/arch + the rustup wasm target), so no manual prereqs.
# Never hard-fails dev: if the build can't complete we warn loudly and continue,
# so the extension still loads (the live scan surfaces a clear error until staged).
ensure-wasm: ## Stage the scanner WASM into public/ (builds once if missing)
	@if [ -f "$(WASM)" ]; then \
	  printf "$(GREEN)✓$(RESET) scanner wasm present ($$(du -h "$(WASM)" | cut -f1))\n"; \
	else \
	  printf "$(YELLOW)→$(RESET) scanner wasm missing — building once (auto-installs wasi-sdk + cargo)…\n"; \
	  bash scripts/build-wasm.sh || \
	    printf "$(YELLOW)⚠ scanner wasm not built$(RESET) — live scan stays disabled until $(CYAN)make wasm$(RESET) succeeds (needs network for the one-time wasi-sdk download + a Rust toolchain).\n"; \
	fi

wasm: node_modules ## Force-rebuild the scanner WASM → public/ (auto-installs wasi-sdk + cargo)
	@bash scripts/build-wasm.sh
	@printf "$(GREEN)✓$(RESET) scanner wasm staged → $(CYAN)$(WASM)$(RESET)\n"

tts: node_modules ## Bundle the on-device Kokoro voice into the extension (ort engine + ~105 MB model, staged into public/)
	@printf "$(BLUE)▶$(RESET) staging onnxruntime-web engine → public/ort/\n"
	@node scripts/stage-ort.mjs
	@printf "$(BLUE)▶$(RESET) staging Kokoro-82M model + voices → public/models/ (downloads ~105 MB once)\n"
	@node scripts/stage-kokoro.mjs
	@printf "$(GREEN)✓$(RESET) Kokoro bundled — it now ships INSIDE the extension (offline, no runtime download)\n"

dev: node_modules ensure-wasm ## Dev server with hot-reload (Vite + CRXJS); writes dist/, reloads on save
	@printf "$(YELLOW)→$(RESET) Load $(CYAN)$(CURDIR)/dist$(RESET) at chrome://extensions (Developer mode → Load unpacked)\n"
	@printf "$(YELLOW)→$(RESET) Then click the $(CYAN)Drift$(RESET) toolbar icon to open the side panel. Saving a file hot-reloads it.\n\n"
	@$(NPM) run dev

build: node_modules ensure-wasm ## Production build → dist/
	@printf "$(BLUE)▶$(RESET) vite build\n"
	@$(NPM) run build
	@printf "$(GREEN)✓$(RESET) built → $(CYAN)dist/$(RESET)\n"

# Standalone production deploy. Unlike `dev`, the result has NO Vite/CRXJS HMR
# client and no dependency on a running server: load dist/ unpacked once and it
# runs entirely inside Chrome (the bundled WASM scanner + UI), with this terminal
# closed. Behaviourally identical to the shipped store build — `release` just
# zips this same dist/ for Web Store upload.
prod: node_modules ## Standalone production deploy → dist/ (no dev server, verified dev-free)
	@printf "$(BLUE)▶$(RESET) Production deploy build — no HMR, no dev server\n"
	@$(MAKE) --no-print-directory kill          # 1. ensure nothing is watching/overwriting dist/
	@rm -rf dist                                # 2. drop any dev-contaminated build
	@$(MAKE) --no-print-directory ensure-wasm   # 3. stage the bundled scanner WASM
	@$(NPM) run build                           # 4. icons → ort → tsc --noEmit → vite build
	@$(NPM) run verify:assets                   # 5. sanity-check the bundle
	@# 6. Guard: a real production dist must carry NO dev-server references.
	@#    -I skips binaries (the 22 MB scanner wasm can match these bytes by chance).
	@if grep -rIq -e "@vite/client" -e "localhost:518" dist 2>/dev/null; then \
	  printf "$(YELLOW)⚠ dist/ still references the Vite dev server — NOT a clean production build:$(RESET)\n"; \
	  grep -rIl -e "@vite/client" -e "localhost:518" dist 2>/dev/null | sed 's/^/    /'; \
	  exit 1; \
	fi
	@printf "$(GREEN)✓$(RESET) dist/ is dev-free — fully self-contained, runs with no server\n"
	@printf "\n$(BLUE)Load it as production:$(RESET)\n"
	@printf "  1. Open $(CYAN)chrome://extensions$(RESET) → enable $(CYAN)Developer mode$(RESET)\n"
	@printf "  2. $(YELLOW)Remove$(RESET) any previously dev-loaded Drift (it points at a now-dead dev server)\n"
	@printf "  3. $(CYAN)Load unpacked$(RESET) → select $(CYAN)$(CURDIR)/dist$(RESET)\n"
	@printf "  4. Close this terminal if you like — the extension runs entirely in Chrome.\n\n"
	@printf "$(CYAN)i$(RESET) For the on-device voice that ships in the store build: $(CYAN)make tts && make prod$(RESET)\n"
	@printf "$(CYAN)i$(RESET) For the literal Web Store upload artifact (same bits, zipped): $(CYAN)make release$(RESET)\n"

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
	if command -v lsof >/dev/null 2>&1; then \
	  for p in $(DEV_PORTS); do \
	    pids=$$(lsof -ti tcp:$$p 2>/dev/null); \
	    if [ -n "$$pids" ]; then \
	      printf "$(YELLOW)→$(RESET) port $$p → killing %s\n" "$$pids"; \
	      kill $$pids 2>/dev/null || true; \
	      sleep 1; kill -9 $$pids 2>/dev/null || true; stopped=1; \
	    fi; \
	  done; \
	fi; \
	pkill -f "$(CURDIR).*vite" 2>/dev/null && stopped=1 || true; \
	pkill -f "$(CURDIR).*crxjs" 2>/dev/null && stopped=1 || true; \
	if [ "$$stopped" = "0" ]; then printf "$(GREEN)✓$(RESET) no dev servers were running\n"; \
	else printf "$(GREEN)✓$(RESET) dev servers stopped\n"; fi; \
	exit 0

logs: node_modules ## Stream the live console (side panel + worker) into this terminal via Chrome DevTools Protocol
	@if [ ! -d dist ]; then \
	  printf "$(YELLOW)→$(RESET) dist/ missing — run $(CYAN)make build$(RESET) (or $(CYAN)make dev$(RESET) in another terminal) first\n"; exit 1; \
	fi
	@printf "$(BLUE)▶$(RESET) launching a dedicated Chrome with the live console attached\n"
	@printf "$(YELLOW)→$(RESET) Set $(CYAN)ALL=1$(RESET) to also tail github.com pages (content script)\n\n"
	@node scripts/tail-logs.mjs

doctor: ## Diagnose live-scan prerequisites (node, rust wasm target, wasi-sdk, staged engines)
	@printf "$(BLUE)▶ drift extension doctor$(RESET)\n"
	@command -v node >/dev/null 2>&1 && printf "  $(GREEN)✓$(RESET) node $$(node -v)\n" || printf "  $(YELLOW)⚠$(RESET) node missing\n"
	@[ -d node_modules ] && printf "  $(GREEN)✓$(RESET) npm deps installed\n" || printf "  $(YELLOW)⚠$(RESET) deps missing → make install\n"
	@command -v cargo >/dev/null 2>&1 && printf "  $(GREEN)✓$(RESET) cargo present\n" || printf "  $(YELLOW)⚠$(RESET) cargo missing (only needed to rebuild the wasm)\n"
	@rustup target list --installed 2>/dev/null | grep -q wasm32-wasip1 && printf "  $(GREEN)✓$(RESET) rust target wasm32-wasip1\n" || printf "  $(YELLOW)⚠$(RESET) run: rustup target add wasm32-wasip1\n"
	@[ -x "$${WASI_SDK:-$$HOME/wasi-sdk}/bin/clang" ] && printf "  $(GREEN)✓$(RESET) wasi-sdk\n" || printf "  $(YELLOW)⚠$(RESET) wasi-sdk missing → https://github.com/WebAssembly/wasi-sdk/releases\n"
	@[ -f "$(WASM)" ] && printf "  $(GREEN)✓$(RESET) scanner wasm staged ($$(du -h "$(WASM)" | cut -f1))\n" || printf "  $(YELLOW)⚠$(RESET) scanner wasm not staged → make wasm\n"
	@[ -f public/kokoro.meta.json ] && printf "  $(GREEN)✓$(RESET) Kokoro model bundled ($$(du -sh public/models 2>/dev/null | cut -f1))\n" || printf "  $(CYAN)i$(RESET) Kokoro model not bundled — audio uses the system voice → make tts\n"
	@[ -f public/ort/ort-wasm-simd-threaded.jsep.wasm ] && printf "  $(GREEN)✓$(RESET) onnxruntime-web engine staged\n" || printf "  $(CYAN)i$(RESET) ort engine not staged → make tts (or npm run stage:ort)\n"
