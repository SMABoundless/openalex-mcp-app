FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY tsconfig.json vite.config.ts ./
COPY scripts/ ./scripts/
COPY server/ ./server/
COPY ui/ ./ui/

RUN npm run build

ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
