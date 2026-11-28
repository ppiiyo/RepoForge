# RepoForge — multi-stage production image
# Build:  docker build -t repoforge:0.3 .
# Run:    docker run --rm -v "$PWD":/work -w /work repoforge:0.3 harden . --apply

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    npm_config_update_notifier=false

# Non-root user
RUN groupadd --system --gid 1001 repoforge \
  && useradd --system --uid 1001 --gid repoforge --create-home repoforge

COPY --from=build --chown=repoforge:repoforge /app/package.json /app/package-lock.json ./
COPY --from=build --chown=repoforge:repoforge /app/node_modules ./node_modules
COPY --from=build --chown=repoforge:repoforge /app/dist ./dist
COPY --chown=repoforge:repoforge README.md LICENSE SECURITY.md ./

USER repoforge

ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["--help"]
