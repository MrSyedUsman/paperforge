# Build from the repository root: docker build -f paperforge-backend/Dockerfile .
# The root context is needed because both apps depend on ../paperforge-shared.
FROM node:22-alpine AS build
WORKDIR /repo
COPY paperforge-shared ./paperforge-shared
WORKDIR /repo/paperforge-backend
COPY paperforge-backend/package*.json ./
RUN npm ci
COPY paperforge-backend ./
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY paperforge-shared ./paperforge-shared
WORKDIR /repo/paperforge-backend
COPY paperforge-backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /repo/paperforge-backend/dist ./dist
USER node
# Cloud Run injects PORT (8080).
CMD ["node", "dist/main.js"]
