# syntax=docker/dockerfile:1.7
#
# Build context must be the repo root so both `drift-python/dist/` (the
# prebuilt wheel) and `test-python-web-server/` are visible. See dev/Tiltfile.
#
# The drift wheel is produced by `make export-drift-python` (runs in a
# python:3.11-slim sidecar container) and mirrored to drift-python/dist/.
# This image does NOT build the wheel itself — it consumes the prebuilt one.
# Run `make export-drift-python` before building this image standalone; under
# Tilt, the `drift-python-wheel` local_resource takes care of it.

FROM python:3.12-slim
WORKDIR /app

COPY test-python-web-server/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Prebuilt drift wheel from `make export-drift-python` (mirrored to
# drift-python/dist/ alongside the canonical dist/drift-python/<v>/ output).
COPY drift-python/dist/drift-*.whl /tmp/
RUN pip install --no-cache-dir /tmp/drift-*.whl && rm /tmp/drift-*.whl

COPY test-python-web-server/app.py test-python-web-server/orders.py \
     test-python-web-server/trace-config.yaml /app/

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
