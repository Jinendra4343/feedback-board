FROM node:26-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=4000
EXPOSE 4000

CMD ["node", "index.js"]
