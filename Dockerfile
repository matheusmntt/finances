FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/financas.db

WORKDIR /app

COPY package.json ./
COPY server ./server
COPY app ./app
COPY index.html login.html ./
# Os PDFs só são lidos para semear o banco na primeira vez; depois ficam dentro do SQLite.
COPY boletos ./boletos

RUN mkdir -p /data && chown node:node /data
USER node

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.js"]
