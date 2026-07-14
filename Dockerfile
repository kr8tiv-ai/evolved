# Evolved — MCP Agentic Service Provider (HTTP mode)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
ENV PORT=8788 NODE_ENV=production
EXPOSE 8788
CMD ["node", "dist/http.js"]
