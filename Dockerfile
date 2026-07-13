# Scala 40 — one small container serving the game and the multiplayer referee.
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY www ./www
COPY server ./server

ENV PORT=3040
EXPOSE 3040
# runs as root: Fly volumes mount root-owned and the ladder file lives there
CMD ["node", "server/server.js"]
