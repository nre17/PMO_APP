FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    APP_MODE=live \
    HOST=0.0.0.0 \
    PORT=4310 \
    DATA_DIR=/app/.data/pmo
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/.data/pmo && chown -R node:node /app/.data
USER node
EXPOSE 4310
# The current server deliberately rejects live startup until real identity exists.
# Supply DATABASE_URL through the approved runtime secret configuration later.
CMD ["node", "node_modules/tsx/dist/cli.mjs", "server/index.ts", "--production"]
