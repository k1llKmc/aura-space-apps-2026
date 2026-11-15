FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
COPY .ai_context .ai_context
COPY scripts scripts
COPY .env.example .env.example
RUN npm run db:generate && npm --workspace apps/api run build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "scripts/run.mjs", "api"]
