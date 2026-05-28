# =============================================================================
# drift — repo-level orchestration
#
# === The handful you'll actually use ===
#   make help                # this menu (auto-generated)
#   make install             # bootstrap Docker Model Runner + pull MODEL
#   make run                 # boot the full stack via docker compose
#   make drift-lab-export    # one-shot production build → dist/drift-lab/<v>/
#
# Sub-projects keep their own Makefiles with deeper targets:
#   - drift-lab/Makefile             (desktop app: dev, compile, ship)
#   - drift-static-profiler/Makefile (CLI analyzer + viewer)
#
# Help is auto-generated: add `## doc string` after any target ':' and it shows
# up in `make help`. `### Section name` lines start a new help section.
# =============================================================================

# --- Config -------------------------------------------------------------------

MODEL        ?= ai/gemma4:latest
CONTEXT_SIZE ?= 40192
DMR_PORT     ?= 12434

# Tauri updater signing keys (gitignored, generated locally by `cargo tauri
# signer generate`). tauri.conf.json's `plugins.updater.pubkey` is set, so
# `cargo tauri build` errors with "A public key has been found, but no
# private key" when these aren't exported. The `.pwd` companion file is
# optional — keys generated with `-w ''` (empty password) don't need it.
TAURI_SIGNING_KEY_FILE      ?= .tauri-keys/drift-lab.key
TAURI_SIGNING_KEY_PWD_FILE  ?= .tauri-keys/drift-lab.key.pwd

BLUE   := \033[1;34m
GREEN  := \033[1;32m
YELLOW := \033[1;33m
CYAN   := \033[1;36m
RED    := \033[1;31m
RESET  := \033[0m

.DEFAULT_GOAL := help
.PHONY: help \
        install check run run-llm db \
        kill-port kill-port-test kill-bun-sock kill-dev \
        dev setup \
        test test-fast test-all test-profiler test-lab test-clean test-clean-target \
        drift-lab-viewer-bundle \
        drift-lab-build drift-lab-build-release drift-lab-verify \
        drift-lab-export drift-lab-export-clean \
        drift-lab-ci-preflight \
        action-scan-demo action-scan-demo-kotlin-exposed action-test action-build \
        action-render-comment action-render-comment-kotlin action-render-comments \
        hello-test hello-test-clean

# Internal: assert the Tauri signing key exists before invoking cargo. Cheaper
# to fail here than wait for the bundle stage to hit the same wall. The key
# file is base64-wrapped — decode the first line and look for "encrypted" to
# detect when a passphrase is required (rsign/minisign tags encrypted keys as
# "rsign encrypted secret key" vs plain "rsign secret key").
define require_tauri_key
	@test -f $(TAURI_SIGNING_KEY_FILE) || { \
	  printf "$(RED)✗$(RESET) Missing $(TAURI_SIGNING_KEY_FILE) — generate with:\n"; \
	  printf "   cd drift-lab/src-tauri && cargo tauri signer generate -w ''\n"; \
	  printf "   (then move the .key / .key.pub files into .tauri-keys/)\n"; \
	  exit 1; \
	}
endef

# Internal: resolve the Tauri signing-key passphrase into $$PASS. Precedence:
#   1. $$TAURI_SIGNING_PRIVATE_KEY_PASSWORD already exported (CI, scripted use)
#   2. .tauri-keys/drift-lab.key.pwd file (gitignored convenience cache —
#      create with `echo -n "yourpass" > .tauri-keys/drift-lab.key.pwd`)
#   3. interactive prompt (default for fresh shells; only happens when the
#      key looks encrypted, so plain-text keys generated with `-w ''` skip it)
#
# Must be invoked inline with the cargo command (single shell line, joined by
# `&& \`) so $$PASS stays in scope — Make spawns a fresh /bin/sh for each
# recipe line, which would otherwise lose the variable.
#
# The `stty -echo` dance hides keystrokes during the prompt without relying
# on `read -s` (a bashism not honoured by /bin/sh on Debian where dash is
# default).
define resolve_tauri_pwd
	if [ -n "$$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ]; then \
	  PASS="$$TAURI_SIGNING_PRIVATE_KEY_PASSWORD"; \
	elif [ -f "$(TAURI_SIGNING_KEY_PWD_FILE)" ]; then \
	  PASS="$$(cat $(TAURI_SIGNING_KEY_PWD_FILE))"; \
	elif openssl base64 -d -A < $(TAURI_SIGNING_KEY_FILE) 2>/dev/null \
	     | head -c 80 | grep -qi "encrypted"; then \
	  printf "$(BLUE)?$(RESET) Updater key passphrase (input hidden): " >&2; \
	  stty -echo 2>/dev/null; \
	  IFS= read -r PASS; rc=$$?; \
	  stty echo 2>/dev/null; \
	  echo >&2; \
	  [ $$rc -eq 0 ] || { printf "$(RED)✗$(RESET) read aborted\n"; exit 1; }; \
	  [ -n "$$PASS" ] || { printf "$(RED)✗$(RESET) empty passphrase\n"; exit 1; }; \
	else \
	  PASS=""; \
	fi
endef

### Tier 1 (the ones you'll use)

help: ## Show this help (auto-generated from inline doc strings)
	@printf "\n$(BLUE)drift — make targets$(RESET)\n"
	@awk 'BEGIN { FS = ":.*## " } \
		/^### / { printf "\n  $(GREEN)%s$(RESET)\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*## / { printf "    $(BLUE)%-26s$(RESET) %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)
	@printf "\n  $(GREEN)Sub-project Makefiles$(RESET)\n"
	@printf "    $(BLUE)%-26s$(RESET) %s\n" "make -C drift-lab help"             "desktop app targets (dev, compile, ship)"
	@printf "    $(BLUE)%-26s$(RESET) %s\n" "make -C drift-static-profiler help" "CLI analyzer + viewer targets"
	@printf "\n"

### Whole-repo bootstrap

# `make setup` is the single command a fresh clone runs to become buildable:
# every subproject's deps + the viewer dist that `drift-lab` embeds.
#
# Order is deliberate:
#   1. drift-lab/setup        → rustup, cargo-tauri, icons, npm deps for desktop-ui
#   2. drift-static-profiler/setup → npm deps for viewer/ (rust is a no-op after #1)
#   3. drift-lab-viewer-bundle    → vite build, so cargo doesn't embed the build.rs stub
#   4. action/ npm ci            → GitHub Action source (best-effort)
#   5. web-app/ bun install      → web app (best-effort; only run when bun is installed)
#
# Idempotent — re-running after a `git pull` is the recommended way to re-sync deps.
setup: ## Install everything across all subprojects (rust + tauri-cli + npm deps + viewer dist + action + web-app). Idempotent — run after fresh clone or git pull
	@printf "$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n"
	@printf "$(BLUE)drift / setup$(RESET) — bootstrapping the entire repo\n"
	@printf "$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n"

	@printf "\n$(CYAN)[1/5] drift-lab — rust + tauri-cli + icons + desktop-ui npm deps$(RESET)\n"
	@$(MAKE) --no-print-directory -C drift-lab setup

	@printf "\n$(CYAN)[2/5] drift-static-profiler — viewer npm deps$(RESET)\n"
	@$(MAKE) --no-print-directory -C drift-static-profiler setup

	@printf "\n$(CYAN)[3/5] viewer dist (so cargo embeds the real viewer, not the build.rs stub)$(RESET)\n"
	@$(MAKE) --no-print-directory drift-lab-viewer-bundle

	@printf "\n$(CYAN)[4/5] action — npm ci$(RESET)\n"
	@if command -v npm >/dev/null 2>&1; then \
	  cd action && npm ci && printf "$(GREEN)✓$(RESET) action deps installed\n"; \
	else \
	  printf "$(YELLOW)!$(RESET) npm not on PATH — skipping action/ (install Node 22+ and re-run if you need it)\n"; \
	fi

	@printf "\n$(CYAN)[5/5] web-app — bun install$(RESET)\n"
	@if command -v bun >/dev/null 2>&1; then \
	  cd web-app && bun install --frozen-lockfile && printf "$(GREEN)✓$(RESET) web-app deps installed\n"; \
	else \
	  printf "$(YELLOW)!$(RESET) bun not on PATH — skipping web-app/ (https://bun.sh/install — only needed if you work on web-app/)\n"; \
	fi

	@printf "\n$(GREEN)═══════════════════════════════════════════════════════════════$(RESET)\n"
	@printf "$(GREEN)✓$(RESET) setup complete\n"
	@printf "  Next: $(CYAN)make dev$(RESET) (launches the desktop app + localhost:5151 HTTP server)\n"
	@printf "        $(CYAN)make help$(RESET) (full target list)\n"
	@printf "$(GREEN)═══════════════════════════════════════════════════════════════$(RESET)\n"

### Docker Model Runner

install: ## Enable Model Runner, pull MODEL=..., set CONTEXT_SIZE=... (override on CLI)
	@docker version >/dev/null || { printf "$(RED)✗$(RESET) Docker not running\n"; exit 1; }
	@docker model version >/dev/null 2>&1 || { \
	  printf "$(RED)✗$(RESET) docker model plugin missing — update Docker Desktop to 4.41+\n"; exit 1; }
	@printf "$(BLUE)▶$(RESET) enabling Model Runner on tcp:$(DMR_PORT)\n"
	@docker desktop enable model-runner --tcp $(DMR_PORT) || true
	@printf "$(BLUE)▶$(RESET) pulling $(CYAN)$(MODEL)$(RESET)\n"
	@docker model pull $(MODEL)
	@printf "$(BLUE)▶$(RESET) setting context size to $(CONTEXT_SIZE)\n"
	@docker model configure --context-size $(CONTEXT_SIZE) $(MODEL)
	@printf "$(GREEN)✓$(RESET) ready — try: make check\n"

check: ## Show runner status, loaded models, and current config
	@printf "$(CYAN)── docker model status ──$(RESET)\n"
	@docker model status
	@printf "\n$(CYAN)── docker model list ──$(RESET)\n"
	@docker model list
	@printf "\n$(CYAN)── docker model inspect $(MODEL) ──$(RESET)\n"
	@docker model inspect $(MODEL)

run: ## Start the full stack (docker compose up --build)
	@printf "$(BLUE)▶$(RESET) docker compose up --build\n"
	@docker compose up --build

run-llm: ## Reconfigure context-size on a secondary model (ai/gemma4:E4B)
	@docker model configure --context-size 40960 ai/gemma4:E4B

db: ## Start just the postgres database
	@printf "$(BLUE)▶$(RESET) starting postgres\n"
	@docker compose up -d db

### Dev hygiene

kill-port: ## Kill processes on PORT (default 8000)
	@PORT=$${PORT:-8000}; \
	PIDS=$$(lsof -ti tcp:$$PORT); \
	if [ -z "$$PIDS" ]; then \
	  printf "$(GREEN)✓$(RESET) nothing on port $$PORT\n"; \
	else \
	  printf "$(BLUE)▶$(RESET) killing PIDs on port $$PORT: $$PIDS\n"; \
	  kill -9 $$PIDS; \
	fi

kill-port-test: ## Kill processes on PORT (default 8000) — test-suite variant
	@PORT=$${PORT:-8000}; \
	PIDS=$$(lsof -ti tcp:$$PORT); \
	if [ -z "$$PIDS" ]; then \
	  printf "$(GREEN)✓$(RESET) nothing on port $$PORT\n"; \
	else \
	  printf "$(BLUE)▶$(RESET) killing PIDs on port $$PORT: $$PIDS\n"; \
	  kill -9 $$PIDS; \
	fi

kill-bun-sock: ## Remove stale Bun debugger unix sockets in TMPDIR
	@DIR="$${TMPDIR:-/tmp}"; \
	find "$$DIR" -maxdepth 1 -type s -name '*.sock' \
	  ! -name '*-*' ! -name '*_*' ! -name '*.*.sock' 2>/dev/null \
	  | while read -r s; do \
	    base=$$(basename "$$s" .sock); \
	    case "$$base" in *[!a-z0-9]*) continue;; esac; \
	    [ $${#base} -gt 13 ] && continue; \
	    if ! lsof "$$s" >/dev/null 2>&1; then \
	      printf "$(BLUE)▶$(RESET) removing stale Bun socket: $$s\n"; \
	      rm -f "$$s"; \
	    fi; \
	  done

kill-dev: kill-port kill-port-test kill-bun-sock ## kill-port + kill-port-test + kill-bun-sock (one shot)

### Testing
#
# `make test` is the fast green gate (drift-static-profiler ONLY): the
# 380-ish unit + integration tests for the ORM analyzer. Every test runs
# against the tiny synthetic fixtures in `drift-static-profiler/tests/
# fixtures/` — never against any real / large external codebase.
# Typical wall time on a clean target/: < 5s after the initial build.
#
# `make test-all` adds drift-lab/src-tauri tests. Those include heavy
# live integration tests (openai_live.rs hits Docker Model Runner; the
# repo carries a 469MB GGUF model in tests/.gguf-cache/) — slow and
# environment-dependent. Run when you actually need them, not by default.

test: test-profiler test-lab test-clean ## Run every cargo test suite (drift-static-profiler + drift-lab) and tidy up scan artifacts. ≈5s warm, ≈45s cold

test-fast: test-profiler test-clean ## Fast subset: drift-static-profiler only — skips drift-lab's slow live-LLM tests (≈5s warm)

test-all: test ## Alias for `make test` (kept for backwards compatibility)

test-profiler: ## drift-static-profiler tests (380+ tests, all on small synthetic fixtures, ≈5s total)
	@printf "$(BLUE)▶$(RESET) cargo test — drift-static-profiler\n"
	@cd drift-static-profiler && cargo test --quiet 2>&1 | tee /tmp/.drift-profiler-test.log | \
	  grep -E "^test result|FAILED|error\[" || true
	@if grep -q "FAILED" /tmp/.drift-profiler-test.log 2>/dev/null; then \
	  printf "$(RED)✗$(RESET) drift-static-profiler tests failed\n"; \
	  rm -f /tmp/.drift-profiler-test.log; exit 1; \
	fi
	@rm -f /tmp/.drift-profiler-test.log
	@printf "$(GREEN)✓$(RESET) drift-static-profiler tests passed\n"

test-lab: drift-lab-viewer-bundle ## drift-lab/src-tauri tests (depends on viewer bundle for RustEmbed; includes openai_live.rs)
	@if [ -f drift-lab/src-tauri/Cargo.toml ]; then \
	  printf "$(BLUE)▶$(RESET) cargo test — drift-lab/src-tauri\n"; \
	  cd drift-lab/src-tauri && cargo test --quiet 2>&1 | tee /tmp/.drift-lab-test.log | \
	    grep -E "^test result|FAILED|error\[" || true; \
	  if grep -q "FAILED" /tmp/.drift-lab-test.log 2>/dev/null; then \
	    printf "$(RED)✗$(RESET) drift-lab tests failed\n"; \
	    rm -f /tmp/.drift-lab-test.log; exit 1; \
	  fi; \
	  rm -f /tmp/.drift-lab-test.log; \
	  printf "$(GREEN)✓$(RESET) drift-lab tests passed\n"; \
	else \
	  printf "$(YELLOW)!$(RESET) drift-lab/src-tauri/Cargo.toml not found — skipping\n"; \
	fi

test-clean: ## Remove test scan artifacts (/tmp scans + temp files from older test runs)
	@DIR="$${TMPDIR:-/tmp}"; \
	REMOVED=$$( \
	  find "$$DIR" -maxdepth 2 -name "drift-mg-*" -delete -print 2>/dev/null; \
	  find /tmp -maxdepth 2 -name "drift-mg-*" -delete -print 2>/dev/null; \
	  find "$$DIR" -maxdepth 2 -name "drift-walker-*" -delete -print 2>/dev/null; \
	  find "$$DIR" -maxdepth 2 -name "drift-analyze-*" -delete -print 2>/dev/null; \
	  rm -rf /tmp/orm-out 2>/dev/null && echo "/tmp/orm-out"; \
	); \
	if [ -n "$$REMOVED" ]; then \
	  printf "$(BLUE)▶$(RESET) cleaned test artifacts:\n"; \
	  echo "$$REMOVED" | sed 's/^/    /'; \
	else \
	  printf "$(GREEN)✓$(RESET) no leftover test artifacts\n"; \
	fi

test-clean-target: ## Wipe cargo's target/ dirs (frees the ~1.5 GB of test/dep binaries cargo accumulates). Next build will rebuild from scratch
	@printf "$(BLUE)▶$(RESET) cargo clean (drift-static-profiler)\n"
	@cd drift-static-profiler && cargo clean 2>&1 | tail -1
	@if [ -d drift-lab/src-tauri/target ]; then \
	  printf "$(BLUE)▶$(RESET) cargo clean (drift-lab/src-tauri)\n"; \
	  cd drift-lab/src-tauri && cargo clean 2>&1 | tail -1; \
	fi
	@printf "$(GREEN)✓$(RESET) target/ directories cleaned — next build re-compiles\n"

### Drift Lab — desktop app
# These mirror what .github/workflows/{ci,drift-lab-desktop-build}.yml run,
# so passing locally is strong evidence CI will too. `cargo tauri build`
# internally runs the frontend build via tauri.conf.json's
# beforeBuildCommand, so one target covers the *desktop UI* pipeline — but
# the static-profiler viewer is a SEPARATE frontend that the Rust crate
# embeds at compile time via rust-embed. Every build target below depends
# on `drift-lab-viewer-bundle` so the embedded viewer reflects the live
# `drift-static-profiler/viewer/` sources, not the stub `build.rs` creates
# for fresh clones.

drift-lab-viewer-bundle: ## Build the embedded static-profiler viewer (drift-static-profiler/viewer → dist/). Required before every drift-lab build
	@printf "$(BLUE)▶$(RESET) building static-profiler viewer (npm ci + vite build)\n"
	@cd drift-static-profiler/viewer && \
	  if [ -f package-lock.json ]; then npm ci; else npm install; fi && \
	  npm run build
	@test -f drift-static-profiler/viewer/dist/index.html || { \
	  printf "$(RED)✗$(RESET) viewer build did not produce dist/index.html\n"; exit 1; }
	@printf "$(GREEN)✓$(RESET) viewer dist ready → drift-static-profiler/viewer/dist/\n"

dev: drift-lab-viewer-bundle ## Run the entire desktop app in dev mode (viewer bundled + hot-reload desktop-ui + Rust backend + localhost:5151 HTTP server)
	@printf "$(BLUE)▶$(RESET) launching drift-lab in dev mode — Ctrl+C to stop\n"
	@printf "    Desktop window: opens automatically (Tauri dev)\n"
	@printf "    HTTP server:    $(CYAN)http://127.0.0.1:5151$(RESET) (viewer at /, Swagger at /docs)\n"
	@$(MAKE) --no-print-directory -C drift-lab dev

drift-lab-build: drift-lab-viewer-bundle ## Debug-profile desktop build (~30s, no LTO). Prompts for the updater key passphrase if not cached
	$(require_tauri_key)
	@printf "$(BLUE)▶$(RESET) cargo tauri build --debug\n"
	@$(resolve_tauri_pwd) && cd drift-lab && \
	  TAURI_SIGNING_PRIVATE_KEY="$$(cat ../$(TAURI_SIGNING_KEY_FILE))" \
	  TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$$PASS" \
	  cargo tauri build --debug
	@printf "$(GREEN)✓$(RESET) bundles → $(CYAN)drift-lab/src-tauri/target/debug/bundle/$(RESET)\n"

drift-lab-build-release: drift-lab-viewer-bundle ## Release-profile desktop build (matches CI, full LTO, ~5-10min). Prompts for passphrase if not cached
	$(require_tauri_key)
	@printf "$(BLUE)▶$(RESET) cargo tauri build (release)\n"
	@$(resolve_tauri_pwd) && cd drift-lab && \
	  TAURI_SIGNING_PRIVATE_KEY="$$(cat ../$(TAURI_SIGNING_KEY_FILE))" \
	  TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$$PASS" \
	  cargo tauri build
	@printf "$(GREEN)✓$(RESET) bundles → $(CYAN)drift-lab/src-tauri/target/release/bundle/$(RESET)\n"

drift-lab-verify: drift-lab-viewer-bundle ## Pre-flight: viewer build + cargo check --release + unit tests + desktop-ui prod build (~30s sanity gate)
	@printf "$(BLUE)▶$(RESET) [1/3] cargo check --release\n"
	@cd drift-lab/src-tauri && cargo check --release
	@printf "$(BLUE)▶$(RESET) [2/3] cargo test --lib\n"
	@cd drift-lab/src-tauri && cargo test --lib
	@printf "$(BLUE)▶$(RESET) [3/3] npm run build (desktop-ui)\n"
	@cd drift-lab/desktop-ui && npm run build
	@printf "$(GREEN)✓$(RESET) verify passed — safe to push\n"

# drift-lab-export — one-shot production export
#
# Runs the release-profile build and copies every distributable artifact
# (.app bundle, .dmg installer, updater tarball + signature, Linux .deb /
# AppImage if present) into dist/drift-lab/<version>/. Produces a clean,
# versioned drop folder you can hand off to QA, attach to a GitHub release,
# or sync to a download bucket — no hunting through target/.
#
# Output layout:
#   dist/drift-lab/<version>/
#     Drift Lab.app/                        # macOS bundle (recursive copy)
#     Drift Lab_<v>_<arch>.dmg              # installer image
#     Drift Lab_<v>_<arch>.app.tar.gz       # updater payload (if signed)
#     Drift Lab_<v>_<arch>.app.tar.gz.sig   # updater signature
#     drift-lab_<v>_amd64.deb               # linux (if compile-linux ran)
#     drift-lab_<v>_amd64.AppImage          # linux (if compile-linux ran)
#     SHA256SUMS                            # checksum manifest
drift-lab-export: ## Production export: release build + copy every artifact → dist/drift-lab/<version>/ + SHA256SUMS
	@VERSION=$$(awk -F\" '/^version *= */ {print $$2; exit}' drift-lab/src-tauri/Cargo.toml); \
	if [ -z "$$VERSION" ]; then \
	  printf "$(RED)✗$(RESET) couldn't read version from drift-lab/src-tauri/Cargo.toml\n"; exit 1; \
	fi; \
	OUT="dist/drift-lab/$$VERSION"; \
	printf "$(BLUE)▶$(RESET) exporting Drift Lab v$$VERSION → $(CYAN)$$OUT$(RESET)\n"; \
	$(MAKE) --no-print-directory drift-lab-build-release; \
	rm -rf "$$OUT"; mkdir -p "$$OUT"; \
	SRC_REL="drift-lab/src-tauri/target/release/bundle"; \
	SRC_LINUX="drift-lab/src-tauri/target-linux/release/bundle"; \
	if [ -d "$$SRC_REL/macos/Drift Lab.app" ]; then \
	  printf "  $(BLUE)•$(RESET) copying macOS .app\n"; \
	  cp -R "$$SRC_REL/macos/Drift Lab.app" "$$OUT/"; \
	fi; \
	find "$$SRC_REL" -maxdepth 3 -type f \
	  \( -name '*.dmg' -o -name '*.app.tar.gz' -o -name '*.app.tar.gz.sig' \) \
	  -exec cp {} "$$OUT/" \; 2>/dev/null || true; \
	if [ -d "$$SRC_LINUX" ]; then \
	  printf "  $(BLUE)•$(RESET) copying Linux bundles\n"; \
	  find "$$SRC_LINUX" -maxdepth 3 -type f \
	    \( -name '*.deb' -o -name '*.AppImage' -o -name '*.rpm' \) \
	    -exec cp {} "$$OUT/" \; 2>/dev/null || true; \
	fi; \
	printf "  $(BLUE)•$(RESET) computing SHA256SUMS\n"; \
	( cd "$$OUT" && find . -maxdepth 1 -type f ! -name SHA256SUMS \
	    -exec shasum -a 256 {} + | sed 's|  \./|  |' > SHA256SUMS ) || true; \
	printf "$(GREEN)✓$(RESET) exported to $(CYAN)$$OUT$(RESET)\n"; \
	ls -1 "$$OUT" | sed 's/^/    /'

drift-lab-export-clean: ## Wipe dist/drift-lab/ so the next drift-lab-export starts clean
	@printf "$(BLUE)▶$(RESET) rm -rf dist/drift-lab\n"
	@rm -rf dist/drift-lab
	@printf "$(GREEN)✓$(RESET) cleaned\n"

# drift-lab-ci-preflight — cheap local mirror of the PR-build workflow
#
# Runs everything the CI workflow runs that's host-independent:
#   1. Build the embedded static-profiler viewer (required for the desktop
#      crate's RustEmbed to pick up the real dist/, not the build.rs stub).
#   2. Read the drift-lab version via the same script CI uses.
#   3. Run the CI helper-script self-tests (compute-shasums, read-version)
#      against synthetic fixtures — so logic bugs surface here, not on the
#      ~10-minute matrix runners.
#
# Skipped on purpose: `cargo tauri build` (5-10min, needs a signing key)
# and `cargo test --lib` — those live in `drift-lab-verify` / `drift-lab-
# build-release`. Run those first if you want the full mirror.
drift-lab-ci-preflight: drift-lab-viewer-bundle ## CI parity check — viewer + helper-script tests + version sanity (skips cargo build/test; cheap)
	@printf "$(BLUE)▶$(RESET) reading drift-lab version\n"
	@v=$$(bash drift-lab/scripts/ci/read-version.sh); \
	  printf "    drift-lab v$(CYAN)%s$(RESET)\n" "$$v"
	@printf "$(BLUE)▶$(RESET) running CI helper-script self-tests\n"
	@bash drift-lab/scripts/ci/test.sh
	@printf "$(GREEN)✓$(RESET) preflight passed\n"
	@printf "    (run $(CYAN)make drift-lab-verify$(RESET) for the heavier mirror: cargo check + lib tests)\n"

### Drift Action — GitHub Action (action/) + scan-pr integration
# Targets that exercise the end-to-end scanner → action JSON contract,
# simulating EXACTLY what the GitHub Action wrapper has access to at
# runtime. Per
#   - actions/checkout@v4 docs (https://github.com/actions/checkout)
#   - tj-actions/changed-files docs (https://github.com/tj-actions/changed-files)
#   - github.event.pull_request context
# the Action can compute:
#   - changed files list      → `git diff --name-only --diff-filter=ACMRT $BASE $HEAD`
#   - diff stats              → `git diff --numstat $BASE $HEAD`
#   - commit messages         → `git log $BASE..$HEAD --format=%B%x00`
#   - PR title/body/labels    → from `$GITHUB_EVENT_PATH` JSON
# These four artifacts are everything the algorithms need. The make
# targets below SIMULATE all four with realistic fixture data so the
# downstream renderer (action/dist/index.js) sees the SAME JSON shape
# it will see in production.

# Config — override on CLI to point at a different fixture:
#   make action-scan-demo FIXTURE=java-spring
DRIFT_ACTION_FIXTURE        ?= python-fastapi
DRIFT_ACTION_CHANGED        ?= app/services.py app/repositories.py app/db.py
DRIFT_ACTION_OUTPUT         ?= tmp/scan-pr-output.json
DRIFT_ACTION_TMPDIR         ?= tmp/action-inputs
# Rendered PR-comment markdown (what `octokit.rest.issues.createComment` would
# upload as the `body` field). Same string the action posts in CI — handy for
# eyeballing the comment before pushing.
DRIFT_ACTION_COMMENT        ?= tmp/pr-comment-python-fastapi.md
DRIFT_ACTION_COMMENT_KOTLIN ?= tmp/pr-comment-kotlin-ktor.md

# Realistic synthesized inputs that mirror what the Action wrapper
# pipes into scan-pr on a real PR. Override any of these with custom
# files if you want to test edge cases.
#   commits:      4 conventional-commit messages (feat / fix / perf / docs)
#   diff stats:   git numstat format (additions TAB deletions TAB path)
#   pr-context:   JSON matching the OpenAPI PrContext component shape
### Drift Action — local CI parity test (act)
# Runs the action's own self-test workflow inside a Docker-based GitHub
# runner (via `nektos/act`) — the closest you can get to a real GitHub
# Actions run without pushing to a remote.
#
# `--bind` mounts the local repo into the container (vs. the default
# copy), so `uses: ./` in the workflow resolves to OUR action.yml.
# This is the canonical self-test pattern used by actions/checkout,
# actions/setup-node, etc. — checkout the workspace, then `uses: ./`
# the local action.
#
# Required tools (installed via `brew install act` and Docker Desktop):
#   - act    ≥ 0.2.88
#   - docker daemon running
#
# Event payload: action/.dev/event.json (mock pull_request webhook).

# Cross-compile drift-static-profiler to linux/amd64 inside a Linux Docker
# container so it runs in the act-emulated GitHub runner. The host (macOS,
# Windows) produces a binary that wouldn't otherwise be executable in the
# Linux container.
#
# Why a separate target dir? `target/` on the host holds the host-arch
# build artifacts (macOS .dylib paths, .rmeta, etc.); reusing it for a
# Linux cross-build corrupts both. `tmp/drift-profiler-linux/target` is
# entirely owned by the docker build, gitignored, and dropped by
# `hello-test-clean` below.
DRIFT_PROFILER_LINUX_TARGET := $(PWD)/tmp/drift-profiler-linux/target
DRIFT_PROFILER_LINUX_BIN    := $(DRIFT_PROFILER_LINUX_TARGET)/release/drift-static-profiler

$(DRIFT_PROFILER_LINUX_BIN): drift-static-profiler/Cargo.toml drift-static-profiler/Cargo.lock
	@docker info >/dev/null 2>&1 || { \
	  printf "$(RED)✗$(RESET) Docker daemon not running — start Docker Desktop and retry\n"; exit 1; }
	@mkdir -p $(DRIFT_PROFILER_LINUX_TARGET)
	@printf "$(BLUE)▶$(RESET) cross-building drift-static-profiler for linux/amd64 via docker\n"
	@printf "    (one-time pull + first build ~3-5 min; rebuilds are incremental ~10s)\n"
	@docker run --rm \
	  --platform linux/amd64 \
	  -v $(PWD)/drift-static-profiler:/src \
	  -v $(DRIFT_PROFILER_LINUX_TARGET):/src/target \
	  -w /src \
	  rust:bookworm \
	  cargo build --release --quiet
	@test -x $(DRIFT_PROFILER_LINUX_BIN) || { printf "$(RED)✗$(RESET) cross-build produced no binary\n"; exit 1; }
	@printf "$(GREEN)✓$(RESET) linux binary at $(CYAN)$(DRIFT_PROFILER_LINUX_BIN)$(RESET)\n"

hello-test: $(DRIFT_PROFILER_LINUX_BIN) ## Run hello+scan action locally via `act` (uses cross-built linux binary)
	@command -v act >/dev/null 2>&1 || { \
	  printf "$(RED)✗$(RESET) act not installed — run: $(CYAN)brew install act$(RESET)\n"; exit 1; }
	@printf "$(BLUE)▶$(RESET) running .github/workflows/drift-hello-test.yml under act\n"
	@# DRIFT_PROFILER_LOCAL_BIN inside the container points at the SAME
	@# path the host sees (because --bind mounts the workspace), so the
	@# install-profiler.sh local-fast-path triggers and skips the
	@# GitHub-Release download. The cross-built linux/amd64 binary
	@# matches the runner-container arch so it executes cleanly.
	@act pull_request \
	  -W .github/workflows/drift-hello-test.yml \
	  -e action/.dev/event.json \
	  -P ubuntu-latest=catthehacker/ubuntu:act-latest \
	  --container-architecture linux/amd64 \
	  --bind \
	  --env DRIFT_PROFILER_LOCAL_BIN=$(DRIFT_PROFILER_LINUX_BIN) \
	  2>&1 | grep -E "(👋|🛠|📂|🌿|🔁|🔖|📦|🔬|📊|^  (schema|mode|tool|changed|roots|unreachable|pr_review|suggestions):|Success|Failure|error)" | head -40
	@printf "$(GREEN)✓$(RESET) hello-test complete — see output above\n"

hello-test-clean: ## Drop the cross-built linux binary + its target dir (forces a fresh build next time)
	@rm -rf $(PWD)/tmp/drift-profiler-linux
	@printf "$(GREEN)✓$(RESET) cleaned tmp/drift-profiler-linux\n"

action-scan-demo: ## scan-pr on fastapi WITH realistic Action inputs (commits + diff-stats + pr-context)
	@mkdir -p $$(dirname $(DRIFT_ACTION_OUTPUT)) $(DRIFT_ACTION_TMPDIR)
	@if [ ! -x drift-static-profiler/target/debug/drift-static-profiler ]; then \
	  printf "$(BLUE)▶$(RESET) building drift-static-profiler (debug)\n"; \
	  cd drift-static-profiler && cargo build --quiet; \
	fi
	@printf "$(BLUE)▶$(RESET) synthesizing realistic Action-context inputs (commits, diff-stats, pr-context)\n"
	@# Realistic Conventional-Commits stream — what `git log --format=%B%x00 $$BASE..$$HEAD` emits
	@printf 'feat(orders): introduce OrderService layer\0fix: handle empty payload\n\nFixes #42\0perf: batch validation pass\0docs(README): document the new endpoint\0' \
	  > $(DRIFT_ACTION_TMPDIR)/commits.txt
	@# Realistic `git diff --numstat` output — additions TAB deletions TAB path
	@printf '32\t5\tapp/services.py\n18\t2\tapp/repositories.py\n4\t8\tapp/db.py\n' \
	  > $(DRIFT_ACTION_TMPDIR)/diff-stats.tsv
	@# Realistic PR-context JSON — mirrors $$GITHUB_EVENT_PATH .pull_request shape
	@printf '%s\n' \
	    '{' \
	    '  "title": "feat(orders): introduce OrderService layer",' \
	    '  "body": "Splits order creation into a dedicated service. Fixes #42. Resolves #58. Replaces inline DB writes with a thin repository.",' \
	    '  "number": 36,' \
	    '  "base": { "sha": "deadbeef" }, "head": { "sha": "cafebabe" }' \
	    '}' \
	  > $(DRIFT_ACTION_TMPDIR)/pr-context.json
	@printf "$(BLUE)▶$(RESET) scan-pr (fastapi · $(words $(DRIFT_ACTION_CHANGED)) changed files · with FULL Action context)\n"
	@printf '%s\n' $(DRIFT_ACTION_CHANGED) | \
	  drift-static-profiler/target/debug/drift-static-profiler scan-pr \
	    drift-static-profiler/tests/fixtures/$(DRIFT_ACTION_FIXTURE) \
	    --changed-files-stdin \
	    --commits $(DRIFT_ACTION_TMPDIR)/commits.txt \
	    --diff-stats $(DRIFT_ACTION_TMPDIR)/diff-stats.tsv \
	    --pr-context-file $(DRIFT_ACTION_TMPDIR)/pr-context.json \
	    --pretty \
	    --output $(DRIFT_ACTION_OUTPUT) \
	  2>&1 | grep -E "^(✓|✗|note:) " || true
	@SIZE=$$(wc -c < $(DRIFT_ACTION_OUTPUT) | tr -d ' '); \
	  printf "$(GREEN)✓$(RESET) wrote $(CYAN)$(DRIFT_ACTION_OUTPUT)$(RESET) ($$SIZE bytes)\n"
	@if command -v jq >/dev/null 2>&1; then \
	  printf "    pr_scope changed:        "; jq -r '.pr_scope.changed_files | length' $(DRIFT_ACTION_OUTPUT); \
	  printf "    pr_review present?       "; jq -r 'has("pr_review")' $(DRIFT_ACTION_OUTPUT); \
	  printf "    counts: feat / fix / issues / new_tests: "; \
	    jq -r '[.pr_review.counts.features.value, .pr_review.counts.bug_fixes.value, .pr_review.counts.issues_resolved.value, .pr_review.counts.new_test_files.value] | @csv' $(DRIFT_ACTION_OUTPUT); \
	  printf "    business_logic.summary:  "; jq -r '.pr_review.business_logic.summary | tostring | .[0:80]' $(DRIFT_ACTION_OUTPUT); \
	  printf "    value_money loc_added:   "; jq -r '.pr_review.value_card.axes[0].inputs.loc_added' $(DRIFT_ACTION_OUTPUT); \
	  printf "    bottom_line:             "; jq -r '.pr_review.value_card.bottom_line' $(DRIFT_ACTION_OUTPUT); \
	  printf "    risks count:             "; jq -r '.pr_review.visual_summary.risks.items | length' $(DRIFT_ACTION_OUTPUT); \
	  printf "    code_suggestions:        "; jq -r '.pr_review.code_suggestions | length' $(DRIFT_ACTION_OUTPUT); \
	fi
	@printf "    Open $(CYAN)$(DRIFT_ACTION_OUTPUT)$(RESET) to inspect the full JSON.\n"
	@# Render the exact PR-comment markdown the action would post for this scan,
	@# so reviewers can preview the comment body next to the raw JSON.
	@$(MAKE) --no-print-directory action-render-comment

# Per-fixture demo for the Kotlin / Ktor + Exposed-ORM fixture.
# Same realistic-Action-context plumbing as action-scan-demo but pinned
# to the kotlin-ktor fixture's actual file layout
# (`src/main/kotlin/com/example/...`). The pr_review block then
# surfaces Kotlin-specific signals (kotlin schema-validation libs,
# kotlin test discovery patterns, kotlin file-language detection).
DRIFT_ACTION_KOTLIN_OUTPUT ?= tmp/scan-pr-output-kotlin-ktor.json
DRIFT_ACTION_KOTLIN_TMPDIR ?= tmp/action-inputs-kotlin
action-scan-demo-kotlin-exposed: ## scan-pr on kotlin-ktor WITH realistic Action inputs
	@mkdir -p $$(dirname $(DRIFT_ACTION_KOTLIN_OUTPUT)) $(DRIFT_ACTION_KOTLIN_TMPDIR)
	@if [ ! -x drift-static-profiler/target/debug/drift-static-profiler ]; then \
	  printf "$(BLUE)▶$(RESET) building drift-static-profiler (debug)\n"; \
	  cd drift-static-profiler && cargo build --quiet; \
	fi
	@printf "$(BLUE)▶$(RESET) synthesizing realistic Action-context inputs (commits, diff-stats, pr-context)\n"
	@printf 'feat(orders): introduce OrdersService\0fix: handle null order ids\n\nFixes #11\0perf: batch query loop in OrdersRepository\0refactor: thin OrdersHandler\0' \
	  > $(DRIFT_ACTION_KOTLIN_TMPDIR)/commits.txt
	@printf '24\t3\tsrc/main/kotlin/com/example/handlers/OrdersHandler.kt\n18\t1\tsrc/main/kotlin/com/example/services/OrdersService.kt\n12\t4\tsrc/main/kotlin/com/example/repos/OrdersRepository.kt\n' \
	  > $(DRIFT_ACTION_KOTLIN_TMPDIR)/diff-stats.tsv
	@printf '%s\n' \
	    '{' \
	    '  "title": "feat(orders): introduce OrdersService layer",' \
	    '  "body": "Split orders into Handler/Service/Repository. Resolves #11.",' \
	    '  "number": 7,' \
	    '  "base": { "sha": "00000000" }, "head": { "sha": "11111111" }' \
	    '}' \
	  > $(DRIFT_ACTION_KOTLIN_TMPDIR)/pr-context.json
	@printf "$(BLUE)▶$(RESET) scan-pr (kotlin-ktor · 3 changed files · with FULL Action context)\n"
	@printf '%s\n' \
	    "src/main/kotlin/com/example/handlers/OrdersHandler.kt" \
	    "src/main/kotlin/com/example/services/OrdersService.kt" \
	    "src/main/kotlin/com/example/repos/OrdersRepository.kt" \
	  | drift-static-profiler/target/debug/drift-static-profiler scan-pr \
	      drift-static-profiler/tests/fixtures/kotlin-ktor \
	      --changed-files-stdin \
	      --commits $(DRIFT_ACTION_KOTLIN_TMPDIR)/commits.txt \
	      --diff-stats $(DRIFT_ACTION_KOTLIN_TMPDIR)/diff-stats.tsv \
	      --pr-context-file $(DRIFT_ACTION_KOTLIN_TMPDIR)/pr-context.json \
	      --pretty \
	      --output $(DRIFT_ACTION_KOTLIN_OUTPUT) \
	  2>&1 | grep -E "^(✓|✗|note:) " || true
	@SIZE=$$(wc -c < $(DRIFT_ACTION_KOTLIN_OUTPUT) | tr -d ' '); \
	  printf "$(GREEN)✓$(RESET) wrote $(CYAN)$(DRIFT_ACTION_KOTLIN_OUTPUT)$(RESET) ($$SIZE bytes)\n"
	@if command -v jq >/dev/null 2>&1; then \
	  printf "    pr_scope changed:        "; jq -r '.pr_scope.changed_files | length' $(DRIFT_ACTION_KOTLIN_OUTPUT); \
	  printf "    counts: feat / fix / issues / new_tests: "; \
	    jq -r '[.pr_review.counts.features.value, .pr_review.counts.bug_fixes.value, .pr_review.counts.issues_resolved.value, .pr_review.counts.new_test_files.value] | @csv' $(DRIFT_ACTION_KOTLIN_OUTPUT); \
	  printf "    business_logic.summary:  "; jq -r '.pr_review.business_logic.summary | tostring | .[0:80]' $(DRIFT_ACTION_KOTLIN_OUTPUT); \
	  printf "    value_money loc_added:   "; jq -r '.pr_review.value_card.axes[0].inputs.loc_added' $(DRIFT_ACTION_KOTLIN_OUTPUT); \
	  printf "    bottom_line:             "; jq -r '.pr_review.value_card.bottom_line' $(DRIFT_ACTION_KOTLIN_OUTPUT); \
	  printf "    risks count:             "; jq -r '.pr_review.visual_summary.risks.items | length' $(DRIFT_ACTION_KOTLIN_OUTPUT); \
	  printf "    data_structures:         "; jq -r '.pr_review.architecture_flow.data_structures | length' $(DRIFT_ACTION_KOTLIN_OUTPUT); \
	  printf "    kotlin schema-val libs:  "; jq -r '.pr_review_ext.tech_debt.schema_validation.per_language_known_libraries.kotlin | length' $(DRIFT_ACTION_KOTLIN_OUTPUT); \
	fi
	@printf "    Open $(CYAN)$(DRIFT_ACTION_KOTLIN_OUTPUT)$(RESET) to inspect the full JSON.\n"
	@$(MAKE) --no-print-directory action-render-comment-kotlin

# ── PR-comment renderers ────────────────────────────────────────────────
# Render the scan-pr JSON into the exact GitHub-Flavored Markdown body the
# action would POST as `issues.createComment.body`. Useful for:
#   - eyeballing the comment before opening a PR
#   - diffing rendered output across fixtures
#   - feeding the .md into a markdown previewer (VS Code, GitHub gist) to
#     confirm mermaid / quadrantChart / mindmap / <details> render the way
#     the spec mockup at action/pr36-github-ui-example.html expects.
#
# Inputs: tmp/scan-pr-output*.json (produced by action-scan-demo[-kotlin-exposed])
# Outputs: tmp/pr-comment-*.md
action-render-comment: ## Render tmp/scan-pr-output.json → tmp/pr-comment-python-fastapi.md (markdown the action would post)
	@test -s $(DRIFT_ACTION_OUTPUT) || { \
	  printf "$(RED)✗$(RESET) $(DRIFT_ACTION_OUTPUT) missing or empty — run $(CYAN)make action-scan-demo$(RESET) first\n"; \
	  exit 1; }
	@printf "$(BLUE)▶$(RESET) rendering PR-comment markdown ($(DRIFT_ACTION_OUTPUT) → $(DRIFT_ACTION_COMMENT))\n"
	@node --experimental-strip-types --no-warnings \
	  action/scripts/render-comment.ts $(DRIFT_ACTION_OUTPUT) $(DRIFT_ACTION_COMMENT) action/.dev/event.json \
	  | sed 's/^/    /'

action-render-comment-kotlin: ## Render tmp/scan-pr-output-kotlin-ktor.json → tmp/pr-comment-kotlin-ktor.md
	@test -s $(DRIFT_ACTION_KOTLIN_OUTPUT) || { \
	  printf "$(RED)✗$(RESET) $(DRIFT_ACTION_KOTLIN_OUTPUT) missing or empty — run $(CYAN)make action-scan-demo-kotlin-exposed$(RESET) first\n"; \
	  exit 1; }
	@printf "$(BLUE)▶$(RESET) rendering PR-comment markdown ($(DRIFT_ACTION_KOTLIN_OUTPUT) → $(DRIFT_ACTION_COMMENT_KOTLIN))\n"
	@node --experimental-strip-types --no-warnings \
	  action/scripts/render-comment.ts $(DRIFT_ACTION_KOTLIN_OUTPUT) $(DRIFT_ACTION_COMMENT_KOTLIN) action/.dev/event.json \
	  | sed 's/^/    /'

action-render-comments: action-render-comment action-render-comment-kotlin ## Render BOTH fixtures' PR-comment markdown

action-build: ## Build the Drift Action bundle (action/src/* → dist/index.js via esbuild)
	@printf "$(BLUE)▶$(RESET) npm run build (Drift Action)\n"
	@cd action && npm run build
	@printf "$(GREEN)✓$(RESET) bundled → $(CYAN)dist/index.js$(RESET)\n"

action-test: ## Run the Drift Action test suite (contract + render + e2e — uses tmp scan output if present)
	@printf "$(BLUE)▶$(RESET) npm test (Drift Action)\n"
	@cd action && npm test 2>&1 | grep -E "^(✔|✖|ℹ tests|ℹ pass|ℹ fail) "

### LLM smoke tests

.PHONY: llm-ollama
llm-ollama:                             ## curl-test local Ollama (http://localhost:11434) with gemma4:e4b
	@echo "→ ollama /api/tags"; curl -sf http://localhost:11434/api/tags | jq '.models[].name' || { echo "ollama not reachable on :11434"; exit 1; }
	@echo "→ ollama /api/generate (gemma4:e4b)"
	@curl -sf http://localhost:11434/api/generate \
	  -H 'Content-Type: application/json' \
	  -d '{"model":"gemma4:e4b","prompt":"Reply with the single word: pong","stream":false}' \
	  | jq '{model, response, done, total_duration}'

.PHONY: llm-docker
llm-docker:                             ## curl-test Docker Model Runner (http://localhost:12434) with ai/gemma4:E4B
	@docker model configure --context-size 40960 ai/gemma4:E4B
	@echo "→ docker model runner /engines/v1/models"; curl -sf http://localhost:12434/engines/v1/models | jq '.data[].id' || { echo "docker model runner not reachable on :12434 — enable it in Docker Desktop"; exit 1; }
	@echo "→ docker model runner /engines/v1/chat/completions (ai/gemma4:E4B)"
	@curl -sf http://localhost:12434/engines/v1/chat/completions \
	  -H 'Content-Type: application/json' \
	  -d '{"model":"ai/gemma4:E4B","messages":[{"role":"user","content":"Reply with the single word: pong"}]}' \
	  | jq '{model, choices: .choices[0].message.content, usage}'
