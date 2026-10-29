FROM node:20-alpine AS base

# Install git and bash for workspace terminal and git workflows
RUN apk add --no-cache git bash

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.mjs"]

