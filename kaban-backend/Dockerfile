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

# font-carlito / font-liberation are metric-compatible substitutes for
# Calibri / Arial+Times New Roman+Courier New — keeps docx->pdf line-wrap
# and page counts accurate even without the proprietary MS fonts installed.
RUN apk add --no-cache libreoffice openjdk17-jre font-noto font-carlito font-liberation

# Real Microsoft fonts (licensed on the machine that builds this image — see
# kaban-backend/fonts/README.md) for pixel/metric-accurate docx->pdf conversion.
# Not present in git; must exist locally at build time.
COPY fonts/msfonts /usr/share/fonts/msfonts
RUN fc-cache -f

COPY package*.json ./
RUN npm install --omit=dev && \
    mkdir -p /app/uploads/originals /app/uploads/pdfs && \
    chown -R node:node /app

COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 3001

CMD ["node", "dist/main"]
