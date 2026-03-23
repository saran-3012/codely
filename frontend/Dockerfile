# ── Stage 1: Install workspace dependencies ─────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy workspace root manifest
COPY package*.json ./

# Copy each package/app manifest so npm workspaces resolves correctly
COPY packages/ui/package*.json ./packages/ui/
COPY apps/studio/package*.json ./apps/studio/
COPY apps/admin/package*.json ./apps/admin/

RUN npm ci

# ── Stage 2: Build @codely/ui ────────────────────────────────────
FROM deps AS ui-builder

COPY packages/ui ./packages/ui/

# @codely/ui has no separate build step (source is imported directly),
# so nothing to run — the files just need to be present for the app builds.

# ── Stage 3: Build Studio ────────────────────────────────────────
FROM ui-builder AS studio-builder

COPY apps/studio ./apps/studio/

RUN npm run build -w studio

# ── Stage 4: Build Admin ─────────────────────────────────────────
FROM ui-builder AS admin-builder

COPY apps/admin ./apps/admin/

RUN npm run build -w admin

# ── Stage 5: Production (nginx) ──────────────────────────────────
FROM nginx:alpine AS production

# Studio → /studio, Admin → /admin
COPY --from=studio-builder /app/apps/studio/dist /usr/share/nginx/html/studio
COPY --from=admin-builder  /app/apps/admin/dist  /usr/share/nginx/html/admin

# Copy template — BACKEND_URL is substituted at container start
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# nginx official image processes /etc/nginx/templates/*.template via envsubst
# automatically on startup — no custom entrypoint needed.
# Set a safe default for local Docker Compose usage.
ENV BACKEND_URL=http://backend:3000

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
