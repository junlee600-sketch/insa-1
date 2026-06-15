FROM node:22-alpine

WORKDIR /app

COPY insa-1-main/package*.json ./
RUN npm ci

COPY insa-1-main/ .

RUN npm run build

RUN npm prune --production

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

USER node

CMD ["node", "server.js"]
