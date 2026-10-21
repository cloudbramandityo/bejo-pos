# =====================================================================
#  BEJO STIKER POS - Image produksi (Docker / Cloud Run / VPS)
#  Build:  docker build -t bejo-pos:latest .
#  Run  :  docker run -d -p 3000:3000 --env-file .env bejo-pos:latest
# =====================================================================

# ---------- Tahap 1: build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# dependency ringan untuk proses build (native module firebase/admin)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Tahap 2: runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/index.html ./index.html
COPY --from=build /app/firestore.rules ./firestore.rules

RUN mkdir -p /app/logs /app/data && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.cjs"]
