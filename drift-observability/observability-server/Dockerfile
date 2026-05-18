# syntax=docker/dockerfile:1.7

FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY go.sum* ./
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux \
    go build -trimpath -ldflags="-s -w" -o /out/observability-server ./cmd/server && \
    mkdir -p /out/trace

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/observability-server /usr/local/bin/observability-server
# Default mount path for the shared trace volume.
COPY --from=build --chown=nonroot:nonroot /out/trace /trace
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/observability-server"]
