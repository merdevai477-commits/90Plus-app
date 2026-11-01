# Use Node.js 20
FROM node:20-slim

# Keep glibc from retaining freed pages in per-thread arenas and huge pages.
# Railway reports RSS; without this the process climbs toward 2GB while the
# V8 heap stays near 200MB. Production on Railpack gets the same values from
# the service variables, because this image is not the live builder.
ENV MALLOC_ARENA_MAX=2 \
    MALLOC_TRIM_THRESHOLD_=131072 \
    MALLOC_MMAP_THRESHOLD_=131072 \
    GLIBC_TUNABLES=glibc.malloc.arena_max=2:glibc.malloc.trim_threshold=131072:glibc.malloc.mmap_threshold=131072:glibc.malloc.hugetlb=0

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
RUN test -f dist/src/main.js || (echo "FATAL: dist/src/main.js missing after build" && exit 1)

# Expose port (Railway uses 3000)
EXPOSE 3000

# Migrations run as the Railway pre-deploy command (railway.toml), never at boot:
# boot-time migrate raced during deploy overlap and its failures went unnoticed.
CMD ["node", "dist/src/main.js"]

