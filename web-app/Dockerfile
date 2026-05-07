FROM oven/bun:1.3-slim AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY web/package.json web/bun.lock ./web/
RUN cd web && bun install --frozen-lockfile

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
COPY web ./web

RUN cd web && bun run build


FROM oven/bun:1.3-slim AS runtime
WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/web/dist ./web/dist

USER bun

EXPOSE 8000
ENV PORT=8000

CMD ["bun", "run", "src/index.ts"]
