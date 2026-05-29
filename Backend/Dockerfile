FROM node:20-alpine
WORKDIR /app
COPY Backend/package*.json ./
RUN npm ci --omit=dev
COPY Backend/ .
EXPOSE 5000
CMD ["node", "server.js"]

