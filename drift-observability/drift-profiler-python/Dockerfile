# Build the wheel inside a Python container, bundling the native CPU
# profiler (`driftdockerprofiler._profiler`, a C++ extension).
#
# The full `python:${PYTHON_VERSION}` image (Debian-based, multi-arch)
# ships with gcc + g++ + make + unzip in the base layer, so we don't
# need an apt-get install step that can flake on local networks.
#
# Usage:
#
#     # Build and copy the wheel to ./dist
#     docker build --output type=local,dest=./dist --target wheel-export .
#
#     # Smoke-test that the native extension loads in a fresh image
#     docker build --target smoke-test -t drift-profiler-smoke .
#     docker run --rm drift-profiler-smoke

ARG PYTHON_VERSION=3.7

# ----------------------------------------------------------------------
# Stage 1 — build the wheel
# ----------------------------------------------------------------------
FROM python:${PYTHON_VERSION} AS builder

WORKDIR /src

COPY setup.py ./
COPY README.md ./
COPY MANIFEST.in ./
COPY driftdockerprofiler ./driftdockerprofiler

# `build` is the PyPA frontend that respects our build-system in
# setup.py (we removed pyproject.toml's build hooks — pure setuptools).
RUN pip install --no-cache-dir --upgrade pip "build>=1,<2" "setuptools>=68" wheel && \
    python -m build --wheel --outdir /wheels && \
    ls -la /wheels && \
    for whl in /wheels/*.whl; do \
        echo "=== contents of $(basename $whl) ===" ; \
        unzip -l "$whl" | grep -E "\.so|\.py$" | head -40 ; \
    done

# ----------------------------------------------------------------------
# Stage 2 — export the wheel(s) to the local filesystem.
# Used with: docker build --output type=local,dest=./dist --target wheel-export .
# ----------------------------------------------------------------------
FROM scratch AS wheel-export
COPY --from=builder /wheels/ /

# ----------------------------------------------------------------------
# Stage 3 — smoke-test image. `docker run` to verify the wheel installs
# cleanly into a fresh interpreter and the native extension loads.
# ----------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim AS smoke-test
COPY --from=builder /wheels/ /wheels/
RUN pip install --no-cache-dir /wheels/*.whl && \
    python -c "import driftdockerprofiler; \
import driftdockerprofiler._profiler as e; \
print('driftdockerprofiler OK (local-file fork)'); \
print('native _profiler:', e); \
print('cpu_profiling_available:', driftdockerprofiler.cpu_profiling_available()); \
assert driftdockerprofiler.cpu_profiling_available(), 'native ext did not load'"
CMD ["python", "-c", "import driftdockerprofiler as g; print('OK, cpu=', g.cpu_profiling_available())"]

# ----------------------------------------------------------------------
# Stage 4 — C++ unit tests for src/clock.{cc,h} + src/stacktraces.{cc,h}.
#
# These cover the parts of the C++ extension that do NOT depend on a
# running Python interpreter — async-signal-safe data structures, hash
# functions, time arithmetic. Python.h IS included (because the
# headers reference PyCodeObject*) but we never dereference any
# Python object — pointers are opaque identity values.
#
# The compile step runs unconditionally; the test binary is then
# executed during the RUN, so the docker build fails on test failure.
# Use `make test-cpp-driftdockerprofiler` to invoke.
# ----------------------------------------------------------------------
FROM python:${PYTHON_VERSION} AS cpp-test

WORKDIR /src

# Copy ONLY what the C++ tests need — keeps the build context tight.
COPY driftdockerprofiler/src    ./driftdockerprofiler/src
COPY tests/cpp                  ./tests/cpp

# Compile every C++ source from src/ that the tests touch + every
# test_*.cc + the runner. We include the Python development headers
# (already on disk in the `python:3.11` image) because stacktraces.h
# transitively pulls in <Python.h>. `-O0 -g` keeps line numbers in
# failure messages readable.
RUN PY_INCLUDE=$(python -c "import sysconfig; print(sysconfig.get_path('include'))") && \
    echo "Python include path: $PY_INCLUDE" && \
    g++ -std=c++11 -Wall -Wextra -O0 -g \
        -I"$PY_INCLUDE" \
        -Idriftdockerprofiler/src \
        driftdockerprofiler/src/clock.cc \
        driftdockerprofiler/src/stacktraces.cc \
        tests/cpp/main.cc \
        tests/cpp/test_clock.cc \
        tests/cpp/test_stacktraces.cc \
        -o /run_cpp_tests && \
    /run_cpp_tests

CMD ["/run_cpp_tests"]
