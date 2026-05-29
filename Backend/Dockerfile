FROM node:20-alpine
WORKDIR /app
COPY Backend/package*.json ./
RUN npm install --omit=dev
COPY Backend/ .
EXPOSE 3200
CMD ["node", "server.js"]


