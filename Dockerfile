# ============================================================
# Build Stage
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ============================================================
# Production Stage
# ============================================================
FROM node:20-alpine

LABEL maintainer="Bridge APLICARE → SIRANAP"
LABEL description="Aplikasi bridge pengiriman data ketersediaan tempat tidur ke SIRANAP Kemenkes"

# Install build tools untuk better-sqlite3 dan tzdata untuk timezone WIB
RUN apk add --no-cache python3 make g++ tzdata

WORKDIR /app

# Copy dependencies dari builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY package*.json ./
COPY src/ ./src/

# Buat direktori data untuk SQLite
RUN mkdir -p /app/data && chown -R node:node /app

# Gunakan user non-root untuk keamanan
USER node

# Volume untuk persistensi database
VOLUME ["/app/data"]

# Expose port aplikasi
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/status || exit 1

# Start aplikasi
CMD ["node", "src/app.js"]
