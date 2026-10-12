# Build from the repository root: docker build -f paperforge-frontend/Dockerfile .
# The root context is needed because both apps depend on ../paperforge-shared.
FROM node:22-alpine AS build
WORKDIR /repo
COPY paperforge-shared ./paperforge-shared
WORKDIR /repo/paperforge-frontend
COPY paperforge-frontend/package*.json paperforge-frontend/.npmrc ./
RUN npm ci
COPY paperforge-frontend ./
# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=8080
WORKDIR /app
# Next traces from the repo root, so the server lives in a paperforge-frontend/ subfolder.
COPY --from=build /repo/paperforge-frontend/.next/standalone ./
WORKDIR /app/paperforge-frontend
USER node
CMD ["node", "server.js"]
