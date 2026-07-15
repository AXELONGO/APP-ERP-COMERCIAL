# Etapa Base
FROM node:20-alpine AS base
RUN apk add --no-cache busybox-extras
RUN addgroup -S lumark && adduser -S lumark -G lumark
WORKDIR /usr/src/app
COPY package*.json ./

# Etapa Desarrollo
FROM base AS dev
RUN npm install
COPY . .
RUN chmod +x /usr/src/app/entrypoint.sh
USER lumark
EXPOSE 3000
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
CMD ["node", "--watch", "server.js"]

# Etapa Producción
FROM base AS production
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN chmod +x /usr/src/app/entrypoint.sh && chown -R lumark:lumark /usr/src/app
USER lumark
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
CMD ["node", "server.js"]
