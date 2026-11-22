# syntax=docker/dockerfile:1
# 소스와 개발 도구는 컴파일 단계에서만 사용한다.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build

# 개발 의존성과 선택 peer(ts-node 등)가 실행 이미지에 남지 않도록 새로 설치한다.
FROM node:24-bookworm-slim AS production-dependencies
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund

# 실제 배포 이미지에는 실행 JS·운영 의존성만 넣고 .env는 외부에서 전달한다.
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/package.json ./
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
