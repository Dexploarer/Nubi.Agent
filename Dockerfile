# Multi-stage build optimized for Supabase connection using Bun
FROM oven/bun:1-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc-dev \
    pkgconfig

# Copy package files and bun config
COPY package*.json bun.lock bunfig.toml ./

# Install dependencies with cache optimization, skipping optional deps
RUN bun install --frozen-lockfile --production --no-optional && \
    bun pm cache rm

# Create runtime stage
FROM oven/bun:1-alpine AS runtime

# Set working directory
WORKDIR /app

# Install system dependencies (minimal for Supabase connection)
RUN apk add --no-cache \
    curl \
    ca-certificates \
    dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S eliza -u 1001

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code with proper ownership
COPY --chown=eliza:nodejs . .

# Build application using bun
RUN bun run build

# Create logs directory
RUN mkdir -p logs && chown eliza:nodejs logs

# Health check (connects to Supabase)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER eliza

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application using bun
CMD ["bun", "run", "start:production"]
