# Use Node.js 20
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
# --legacy-peer-deps: the `openai` SDK peer-requires zod@^3 but we use zod@^4
# everywhere else; this flag lets both coexist without downgrading zod.
RUN npm ci --legacy-peer-deps

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Remove .tsbuildinfo if exists
RUN rm -f .tsbuildinfo dist || true

# Build TypeScript - fail hard on errors instead of masking them
RUN npm run build

# Verify build - fail hard if the expected outputs aren't there
RUN npm run verify:build
RUN test -f dist/src/main.js || (echo "FATAL: dist/src/main.js missing after build" && exit 1)

# Expose port (Railway uses 3000)
EXPOSE 3000

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'npx prisma migrate deploy' >> /app/start.sh && \
    echo 'exec node dist/src/main.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start command
CMD ["/app/start.sh"]

