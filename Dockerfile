# Dockerfile -- production multi-stage build
#
# Stage 1 (frontend-builder): builds the React/Vite frontend into static assets.
# Stage 2 (production):       copies the built assets into the backend image;
#                             the Express server serves them from /public.
#
# The image is built by CI and pushed to ghcr.io/ORG/braindump:staging.
# It is promoted to :latest by the operator after Nexus approval at Demo Sign-off.

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# Install dependencies first (cached unless package-lock.json changes).
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts

# Copy frontend source and build.
COPY frontend/ ./
RUN npm run build
# Output: /build/frontend/dist


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as a non-root user.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install production backend dependencies only.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy backend source.
COPY backend/ ./

# Copy the built frontend assets into the directory Express serves as static files.
# The backend is expected to serve from /app/public (configure in server.js).
COPY --from=frontend-builder /build/frontend/dist ./public

# Copy the entrypoint script and make it executable.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The container exposes port 3000; Traefik routes external traffic here.
# Port 3000 is never exposed directly to the internet.
EXPOSE 3000

# Drop to non-root before the process starts.
USER appuser

# Entrypoint: runs migrations then starts the server (FF-D43).
# If migrations fail, the entrypoint exits non-zero and the container does not
# replace the running container (Watchtower leaves the old one in place).
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]

# Health check used by Docker and the container orchestrator (FF-D34).
# Traefik and Uptime Kuma use the /api/health route directly.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
