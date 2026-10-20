FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.js x402.js ./

USER node

CMD ["node", "index.js"]
