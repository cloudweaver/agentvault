FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@8 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/package.json ./app/
COPY runtime/package.json ./runtime/
RUN pnpm install --frozen-lockfile

FROM base AS runtime-build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/runtime/node_modules ./runtime/node_modules
COPY runtime ./runtime
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm --filter runtime build

FROM base AS app-build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/app/node_modules ./app/node_modules
COPY app ./app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm --filter app build

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=runtime-build /app/runtime/dist ./dist
COPY --from=runtime-build /app/runtime/package.json ./
RUN npm install --omit=dev
CMD ["node", "dist/index.js"]

FROM node:20-slim AS app
WORKDIR /app
COPY --from=app-build /app/app/.next ./.next
COPY --from=app-build /app/app/public ./public
COPY --from=app-build /app/app/package.json ./
RUN npm install --omit=dev
CMD ["npm", "start"]
