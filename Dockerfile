# ---------------------------------------------------------
# Stage 1: Dependencies
# ---------------------------------------------------------
FROM node:22-alpine AS dependencies

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------
# Stage 2: Build
# ---------------------------------------------------------
FROM dependencies AS build

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

# Build standalone output with inline dummy environment variables scoped only to the build step
# Eliminates Dockerfile layer secret leakage, SecretsUsedInArgOrEnv warnings, and Better Auth entropy warnings
RUN STANDALONE_BUILD="true" \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build_placeholder_secret_32_chars_min_entropy_safe_docker_build" \
    BASE_URL="http://localhost:3000" \
    pnpm build

# ---------------------------------------------------------
# Stage 3: Production Runner
# ---------------------------------------------------------
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system group and user (UID 1001, GID 1001)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 -G nodejs nextjs

# Copy static assets and standalone server output with non-root ownership
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure runtime cache directory exists and is writable by nextjs
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache

USER nextjs

EXPOSE 3000

# Container internal healthcheck using native Node fetch (zero additional Alpine packages)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]

