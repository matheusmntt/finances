# Um container só: a API (Fastify) serve também o build da UI.
FROM node:26-slim AS build

# better-sqlite3 compila o módulo nativo quando não há binário pronto para esta versão do Node.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.8.1

WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/ui/package.json apps/ui/
RUN pnpm install --frozen-lockfile

COPY apps apps
# A chave vai dentro do JavaScript da UI (é pública); quem protege os dados é a senha.
ARG VITE_API_KEY
RUN test -n "$VITE_API_KEY" || (echo "Passe --build-arg VITE_API_KEY=..." && exit 1)
RUN pnpm --filter ui build && pnpm --filter api build \
  && pnpm --filter api deploy --prod /prod/api

FROM node:26-slim

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/financas.db \
    BOLETOS_DIR=/app/boletos \
    UI_DIR=/app/ui

WORKDIR /app
COPY --from=build /prod/api/package.json ./
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/ui/dist ./ui
# Os PDFs só são lidos para semear e importar boletos novos; depois ficam dentro do SQLite.
COPY boletos ./boletos

RUN mkdir -p /data && chown node:node /data
USER node

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "dist/server.js"]
