# Halo CRM web image (Next.js standalone server).
#   docker build -t halo-web apps/web
#
# NEXT_PUBLIC_* variables are inlined into the JavaScript at *build* time. By default the image
# is built with an empty API URL, so the browser calls /api/... on the same host and the reverse
# proxy / Kubernetes ingress routes those requests to the API. One image works on any domain.

# ---- deps: install node_modules from the lockfile -------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build: compile the app into .next/standalone --------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runtime: only the standalone server and static assets ----------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=1000:1000 /app/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/.next/static ./.next/static
# Numeric UID (the image's "node" user): Kubernetes' runAsNonRoot can only verify numbers.
USER 1000
EXPOSE 3000
CMD ["node", "server.js"]
