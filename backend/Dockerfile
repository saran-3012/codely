# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ── Stage 2: Production ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Only install production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
