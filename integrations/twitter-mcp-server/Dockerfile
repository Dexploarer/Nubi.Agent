# Use a Node.js image for building the server
FROM node:20-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies without running scripts (to avoid premature build)
RUN npm ci --ignore-scripts

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Use a smaller Node.js image for the runtime
FROM node:20-alpine

# Set the working directory in the runtime image
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
# Use --ignore-scripts to prevent running the prepare script which requires tsc
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder stage
COPY --from=builder /app/build ./build

# Copy documentation
COPY README.md ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Add metadata labels
LABEL org.opencontainers.image.source="https://github.com/ryanmac/twitter-mcp-server"
LABEL org.opencontainers.image.description="MCP server for Twitter integration using agent-twitter-client"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.documentation="https://github.com/ryanmac/twitter-mcp-server"

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Expose the port
EXPOSE ${PORT}

# Start the application
CMD ["node", "build/index.js"] 