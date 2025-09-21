FROM node:20-alpine AS deps
WORKDIR /app
# Include npm lockfile if present. Fall back to npm install when absent.
COPY package.json package-lock.json* bun.lock* .npmrc* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

FROM node:20-alpine AS builder
ARG BUILD_SHA="dev"
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate needs a DATABASE_URL at build time to parse schema,
# but it does not connect. Provide a dummy Postgres URL so CI/buildx succeeds.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
ARG BUILD_SHA="dev"
WORKDIR /app
ENV NODE_ENV=production
ENV BUILD_SHA=$BUILD_SHA
RUN apk add --no-cache openssl curl postgresql-client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/ops/entrypoint.sh ./ops/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["sh","./ops/entrypoint.sh"]
