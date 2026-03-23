# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src/
COPY tailwind.config.js ./
COPY postcss.config.js ./

RUN npm run build

# ── Stage 2: Production (nginx) ─────────────────────────────────
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
