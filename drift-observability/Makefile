# =============================================================================
# drift-observability — repo-level orchestration
#
# === The handful you'll actually use ===
#   make help                       # this menu (auto-generated)
#   make up                         # boot the local cluster via Tilt + minikube
#   make wheel                      # quick local wheel (uses a venv on the host)
#   make export-drift-python        # Dockerized build → dist/drift-python/<v>/
#   make test-export-drift-python   # install the exported wheel in a clean
#                                   #   container and smoke-test it
#
# Cluster targets delegate to dev/Makefile. The Drift Python package lives in
# drift-python/ and exports a pip/poetry-installable wheel into dist/.
#
# Help is auto-generated: add `## doc string` after any target ':' and it
# shows up in `make help`. `### Section name` lines start a new help section.
# =============================================================================

# --- Config -------------------------------------------------------------------

# Build image: modern Python is fine — the produced wheel is `py3-none-any`
# (pure Python), so the build interpreter does not leak into the artifact.
# Test matrix: space-separated images. test-export-drift-python smoke-tests
# the wheel on each, so the lowest AND highest supported runtimes are gated
# in one command. Bump these independently.
PY_BUILD_IMAGE  ?= python:3.11-slim
PY_TEST_IMAGES  ?= python:3.7-slim python:3.13-slim
DRIFT_DIR    := drift-python
DRIFT_OUT    := dist/drift-python

BLUE   := \033[1;34m
GREEN  := \033[1;32m
YELLOW := \033[1;33m
CYAN   := \033[1;36m
RED    := \033[1;31m
DIM    := \033[2m
BOLD   := \033[1m
RESET  := \033[0m

.DEFAULT_GOAL := help
.PHONY: help \
        install up down stop reset-data nuke \
        wheel test-drift \
        export-drift-python export-drift-python-clean \
        test-export-drift-python export-drift-python-readme \
        images images-app images-obs

### Tier 1 (the ones you'll use)

help: ## Show this help (auto-generated from inline doc strings)
	@printf "\n$(BLUE)drift-observability — make targets$(RESET)\n"
	@awk 'BEGIN { FS = ":.*## " } \
		/^### / { printf "\n  $(GREEN)%s$(RESET)\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*## / { printf "    $(BLUE)%-28s$(RESET) %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)
	@printf "\n  $(GREEN)Sub-project Makefiles$(RESET)\n"
	@printf "    $(BLUE)%-28s$(RESET) %s\n" "make -C dev help"  "cluster ops (minikube + tilt + helm)"
	@printf "\n"

### Cluster ops (delegate to dev/Makefile)

install: ## brew install minikube, kubectl, tilt, helm, k9s
	@$(MAKE) --no-print-directory -C dev install

up: ## Start minikube and run `tilt up`
	@$(MAKE) --no-print-directory -C dev up

down: ## `tilt down` (cluster stays up)
	@$(MAKE) --no-print-directory -C dev down

stop: ## Stop minikube (keeps state)
	@$(MAKE) --no-print-directory -C dev stop

reset-data: ## Reset persistent data volumes
	@$(MAKE) --no-print-directory -C dev reset-data

nuke: ## tilt down + minikube delete
	@$(MAKE) --no-print-directory -C dev nuke

### Drift Python package — local dev loop (host venv)

VENV := .venv-drift

$(VENV)/bin/python:
	@printf "$(BLUE)▶$(RESET) creating venv at $(CYAN)$(VENV)$(RESET)\n"
	@python3 -m venv $(VENV)
	@$(VENV)/bin/pip install -q --upgrade pip
	@$(VENV)/bin/pip install -q -e "$(DRIFT_DIR)[dev]"
	@printf "$(GREEN)✓$(RESET) venv ready\n"

wheel: $(VENV)/bin/python ## Quick local wheel build (uses host venv) → drift-python/dist/
	@printf "$(BLUE)▶$(RESET) building wheel (host venv)\n"
	@rm -rf $(DRIFT_DIR)/dist
	@$(VENV)/bin/python -m build --wheel $(DRIFT_DIR) -o $(DRIFT_DIR)/dist >/dev/null
	@printf "$(GREEN)✓$(RESET) artifacts:\n"
	@ls -1 $(DRIFT_DIR)/dist | sed 's/^/    /'

test-drift: $(VENV)/bin/python ## Run drift unit tests in the host venv
	@$(VENV)/bin/pytest -q $(DRIFT_DIR)/tests/

### Drift Python package — production export (Dockerized)
#
# `export-drift-python` is the one-shot production build:
#   - Builds wheel + sdist inside $(PY_BUILD_IMAGE) (no host Python required)
#   - Drops everything into dist/drift-python/<version>/ (relative to this
#     Makefile), so the artifact is right next to the repo root, including:
#       drift-<v>-py3-none-any.whl    # pip install / poetry add target
#       drift-<v>.tar.gz              # source distribution
#       README.md                     # copied verbatim
#       INSTALL.md                    # generated pip + poetry recipes
#       SHA256SUMS                    # checksum manifest
#   - Prints absolute export path + pip/poetry recipe at the end
#   - Pretty-renders README.md so you can eyeball the docs immediately
#
# `test-export-drift-python` then exercises the wheel in a clean container —
# `pip install` it, import drift, verify the public API. Hermetic; touches
# nothing on the host.
#
# Idempotent — re-runs wipe the version directory before rebuilding.

export-drift-python: ## Dockerized build of drift-python → dist/drift-python/<version>/ + render README
	@VERSION=$$(awk -F'"' '/^version *= */ {print $$2; exit}' $(DRIFT_DIR)/pyproject.toml); \
	if [ -z "$$VERSION" ]; then \
	  printf "$(RED)✗$(RESET) couldn't read version from $(DRIFT_DIR)/pyproject.toml\n"; exit 1; \
	fi; \
	OUT="$(DRIFT_OUT)/$$VERSION"; \
	printf "\n$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	printf "$(BLUE)drift-python / export$(RESET) — building v$$VERSION via Docker\n"; \
	printf "$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	printf "\n$(CYAN)[1/5]$(RESET) pre-flight: docker available?\n"; \
	docker version >/dev/null 2>&1 || { printf "$(RED)✗$(RESET) Docker daemon not reachable\n"; exit 1; }; \
	printf "  $(GREEN)✓$(RESET) docker ok\n"; \
	printf "\n$(CYAN)[2/5]$(RESET) preparing output dir $(CYAN)$$OUT$(RESET)\n"; \
	rm -rf "$$OUT"; mkdir -p "$$OUT"; \
	printf "  $(GREEN)✓$(RESET) clean\n"; \
	printf "\n$(CYAN)[3/5]$(RESET) building wheel + sdist inside $(CYAN)$(PY_BUILD_IMAGE)$(RESET)\n"; \
	docker run --rm \
	  -u $$(id -u):$$(id -g) \
	  -v "$$PWD/$(DRIFT_DIR)":/src:ro \
	  -v "$$PWD/$$OUT":/out \
	  -e HOME=/tmp \
	  -e PIP_DISABLE_PIP_VERSION_CHECK=1 \
	  -e PIP_ROOT_USER_ACTION=ignore \
	  $(PY_BUILD_IMAGE) \
	  sh -c 'set -e; \
	    cp -r /src /tmp/build && cd /tmp/build && \
	    pip install --quiet --no-cache-dir build && \
	    python -m build --outdir /out . 2>&1 | sed "s/^/    /"' \
	  || { printf "$(RED)✗$(RESET) docker build failed\n"; exit 1; }; \
	printf "  $(GREEN)✓$(RESET) wheel + sdist built\n"; \
	printf "\n$(CYAN)[4/5]$(RESET) copying README + writing INSTALL.md + populating $(CYAN)$(DRIFT_DIR)/dist/$(RESET)\n"; \
	cp $(DRIFT_DIR)/README.md "$$OUT/README.md"; \
	[ -f $(DRIFT_DIR)/LICENSE ] && cp $(DRIFT_DIR)/LICENSE "$$OUT/LICENSE" || true; \
	WHEEL=$$(ls "$$OUT"/*.whl 2>/dev/null | head -1 | xargs -n1 basename); \
	SDIST=$$(ls "$$OUT"/*.tar.gz 2>/dev/null | head -1 | xargs -n1 basename); \
	rm -rf $(DRIFT_DIR)/dist; mkdir -p $(DRIFT_DIR)/dist; \
	cp "$$OUT/$$WHEEL" $(DRIFT_DIR)/dist/; \
	cp "$$OUT/$$SDIST" $(DRIFT_DIR)/dist/; \
	printf "  $(GREEN)✓$(RESET) wheel mirrored to $(CYAN)$(DRIFT_DIR)/dist/$$WHEEL$(RESET) (used by Tilt + Dockerfile)\n"; \
	{ \
	  printf '# Installing drift v%s\n\n' "$$VERSION"; \
	  printf 'This directory ships a built wheel (`%s`) and an sdist (`%s`).\n\n' "$$WHEEL" "$$SDIST"; \
	  printf '## pip\n\n```bash\npip install ./%s\n```\n\n' "$$WHEEL"; \
	  printf '## poetry\n\n```bash\npoetry add ./%s\n```\n\n' "$$WHEEL"; \
	  printf '## From sdist (no wheel)\n\n```bash\npip install ./%s\n```\n\n' "$$SDIST"; \
	  printf '## Verify\n\n```bash\nshasum -a 256 -c SHA256SUMS\n```\n'; \
	} > "$$OUT/INSTALL.md"; \
	printf "  $(GREEN)✓$(RESET) README.md + INSTALL.md in place\n"; \
	printf "\n$(CYAN)[5/5]$(RESET) computing SHA256SUMS\n"; \
	( cd "$$OUT" && find . -maxdepth 1 -type f ! -name SHA256SUMS \
	    -exec shasum -a 256 {} + | sed 's|  \./|  |' > SHA256SUMS ); \
	printf "  $(GREEN)✓$(RESET) checksum manifest written\n"; \
	ABS_OUT=$$(cd "$$OUT" && pwd); \
	ABS_WHEEL="$$ABS_OUT/$$WHEEL"; \
	printf "\n$(GREEN)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	printf "$(GREEN)✓ drift v$$VERSION exported (built inside $(PY_BUILD_IMAGE))$(RESET)\n"; \
	printf "$(GREEN)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	printf "  $(BOLD)Location$(RESET)  $(CYAN)$$ABS_OUT$(RESET)\n"; \
	printf "  $(BOLD)Contents$(RESET)\n"; \
	ls -1 "$$OUT" | sed 's/^/      /'; \
	printf "\n  $(BOLD)How to use it$(RESET)\n"; \
	printf "    $(YELLOW)# pip$(RESET)\n"; \
	printf "    $(CYAN)pip install $$ABS_WHEEL$(RESET)\n\n"; \
	printf "    $(YELLOW)# poetry$(RESET)\n"; \
	printf "    $(CYAN)poetry add $$ABS_WHEEL$(RESET)\n\n"; \
	printf "    $(YELLOW)# smoke-test in a clean container$(RESET)\n"; \
	printf "    $(CYAN)make test-export-drift-python$(RESET)\n"; \
	$(MAKE) --no-print-directory export-drift-python-readme README_PATH="$$OUT/README.md" VERSION="$$VERSION"

export-drift-python-clean: ## Wipe dist/drift-python/ so the next export starts fresh
	@printf "$(BLUE)▶$(RESET) rm -rf $(DRIFT_OUT)\n"
	@rm -rf $(DRIFT_OUT)
	@printf "$(GREEN)✓$(RESET) cleaned\n"

# `test-export-drift-python` — installs the exported wheel in clean
# containers (no drift-python source mounted) and runs a tiny smoke test
# that imports drift and verifies the public API (`install` / `uninstall`
# symbols) is reachable. Iterates over $(PY_TEST_IMAGES) so the LOWEST and
# HIGHEST supported runtimes are gated in one command — failures on any
# image are collected and reported together. If the wheel is missing, it
# falls back to running the export first.
test-export-drift-python: ## Install the exported wheel into a fresh container and smoke-test it
	@VERSION=$$(awk -F'"' '/^version *= */ {print $$2; exit}' $(DRIFT_DIR)/pyproject.toml); \
	OUT="$(DRIFT_OUT)/$$VERSION"; \
	WHEEL=$$(ls "$$OUT"/*.whl 2>/dev/null | head -1); \
	if [ -z "$$WHEEL" ]; then \
	  printf "$(YELLOW)!$(RESET) no wheel in $$OUT — running export first\n"; \
	  $(MAKE) --no-print-directory export-drift-python; \
	  WHEEL=$$(ls "$$OUT"/*.whl 2>/dev/null | head -1); \
	fi; \
	WHEEL_NAME=$$(basename "$$WHEEL"); \
	printf "\n$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	printf "$(BLUE)test-export-drift-python$(RESET) — smoke-test $$WHEEL_NAME\n"; \
	printf "$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	printf "\n$(CYAN)[1/2]$(RESET) writing smoke-test script\n"; \
	{ \
	  echo 'import drift, inspect, sys'; \
	  echo "assert callable(drift.install), 'drift.install missing'"; \
	  echo "assert callable(drift.uninstall), 'drift.uninstall missing'"; \
	  echo "print('  drift module    :', drift.__file__)"; \
	  echo "print('  drift.install   :', inspect.signature(drift.install))"; \
	  echo "print('  drift.uninstall :', inspect.signature(drift.uninstall))"; \
	  echo "print('  drift __all__   :', drift.__all__)"; \
	  echo "print('  python          :', sys.version.split()[0])"; \
	} > "$$OUT/.smoke_test.py"; \
	printf "  $(GREEN)✓$(RESET) $$OUT/.smoke_test.py\n"; \
	IMAGES="$(PY_TEST_IMAGES)"; \
	TOTAL=$$(printf '%s\n' $$IMAGES | wc -l | tr -d ' '); \
	printf "$(CYAN)[2/2]$(RESET) smoke-testing on $$TOTAL image(s): $(CYAN)$$IMAGES$(RESET)\n"; \
	IDX=0; FAILED=""; \
	for IMG in $$IMAGES; do \
	  IDX=$$((IDX+1)); \
	  printf "\n$(BLUE)── [$$IDX/$$TOTAL]$(RESET) $(CYAN)$$IMG$(RESET)\n"; \
	  if docker run --rm \
	    -u $$(id -u):$$(id -g) \
	    -v "$$PWD/$$OUT":/wheels:ro \
	    -e HOME=/tmp \
	    -e PIP_DISABLE_PIP_VERSION_CHECK=1 \
	    -e PIP_ROOT_USER_ACTION=ignore \
	    $$IMG \
	    sh -c "set -e; \
	      pip install --quiet --no-cache-dir /wheels/$$WHEEL_NAME && \
	      python /wheels/.smoke_test.py"; then \
	    printf "  $(GREEN)✓$(RESET) $$IMG\n"; \
	  else \
	    printf "  $(RED)✗$(RESET) $$IMG\n"; \
	    FAILED="$$FAILED $$IMG"; \
	  fi; \
	done; \
	rm -f "$$OUT/.smoke_test.py"; \
	if [ -n "$$FAILED" ]; then \
	  printf "\n$(RED)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	  printf "$(RED)✗ smoke test failed on:$$FAILED$(RESET)\n"; \
	  printf "$(RED)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	  exit 1; \
	fi; \
	printf "\n$(GREEN)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	printf "$(GREEN)✓ wheel installs cleanly and imports on all $$TOTAL image(s)$(RESET)\n"; \
	printf "$(GREEN)═══════════════════════════════════════════════════════════════$(RESET)\n"

# Pretty-print a README.md to stdout. Detects glow → mdcat → bat → awk fallback.
# Called by export-drift-python with README_PATH=... VERSION=... but also
# runnable standalone: `make export-drift-python-readme README_PATH=path/to/README.md`.
export-drift-python-readme: ## Pretty-render a README.md (auto-detects glow/mdcat/bat, falls back to awk)
	@README_PATH=$${README_PATH:-$(DRIFT_DIR)/README.md}; \
	VERSION=$${VERSION:-$$(awk -F'"' '/^version *= */ {print $$2; exit}' $(DRIFT_DIR)/pyproject.toml)}; \
	if [ ! -f "$$README_PATH" ]; then \
	  printf "$(RED)✗$(RESET) README not found at $$README_PATH\n"; exit 1; \
	fi; \
	printf "\n$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n"; \
	printf "$(BLUE)README$(RESET) — drift v$$VERSION  $(DIM)($$README_PATH)$(RESET)\n"; \
	printf "$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n\n"; \
	if command -v glow >/dev/null 2>&1; then \
	  glow -s dark "$$README_PATH"; \
	elif command -v mdcat >/dev/null 2>&1; then \
	  mdcat "$$README_PATH"; \
	elif command -v bat >/dev/null 2>&1; then \
	  bat --style=plain --language=md --paging=never "$$README_PATH"; \
	else \
	  awk -v B="$$(printf '\033[1;34m')" -v G="$$(printf '\033[1;32m')" \
	      -v Y="$$(printf '\033[1;33m')" -v C="$$(printf '\033[1;36m')" \
	      -v D="$$(printf '\033[2m')" -v BD="$$(printf '\033[1m')" \
	      -v R="$$(printf '\033[0m')" \
	      'BEGIN { in_code = 0 } \
	       /^```/ { in_code = !in_code; printf "%s%s%s\n", D, $$0, R; next } \
	       in_code { printf "%s%s%s\n", C, $$0, R; next } \
	       /^### /  { printf "%s%s%s\n", Y, $$0, R; next } \
	       /^## /   { printf "%s%s%s\n", G, $$0, R; next } \
	       /^# /    { printf "%s%s%s%s\n", BD, B, $$0, R; next } \
	       { print }' "$$README_PATH"; \
	fi; \
	printf "\n$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)\n\n"

### Docker images (what Tilt also builds)

images: images-app images-obs ## Build both app + observability images

images-app: ## Build test-python-web-server:dev
	@printf "$(BLUE)▶$(RESET) docker build test-python-web-server:dev\n"
	@docker build -f test-python-web-server/Dockerfile -t test-python-web-server:dev .
	@printf "$(GREEN)✓$(RESET) test-python-web-server:dev built\n"

images-obs: ## Build observability-server:dev
	@printf "$(BLUE)▶$(RESET) docker build observability-server:dev\n"
	@docker build -t observability-server:dev observability-server
	@printf "$(GREEN)✓$(RESET) observability-server:dev built\n"
