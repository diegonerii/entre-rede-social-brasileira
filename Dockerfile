FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY --from=build /app /app
RUN mkdir -p /data
EXPOSE 8787
CMD ["node", "scripts/start-magalu.mjs"]
