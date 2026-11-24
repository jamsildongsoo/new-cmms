# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# 공개 API 경로는 프런트 코드의 /api 기본값을 사용한다.
# 최종 이미지에는 빌드된 정적 파일만 복사한다.
RUN npm run build

FROM nginx:stable-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
# 현재 서비스는 HTTP 80을 사용한다.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/app-locations.conf /etc/nginx/snippets/app-locations.conf
EXPOSE 80
# 외부 포트는 compose.yaml에서 80으로 지정한다.
