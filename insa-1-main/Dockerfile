FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --production

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

USER node

CMD ["node", "server.js"]
