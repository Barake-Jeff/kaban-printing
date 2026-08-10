# ---- Stage 1: Build ----
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# ---- Stage 2: Production image ----
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.output ./.output

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
