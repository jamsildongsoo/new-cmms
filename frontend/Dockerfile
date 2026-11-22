# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# frontend/.env의 공개 설정은 빌드 시 반영한다. 변경 시 이미지 재빌드가 필요하다.
# 최종 이미지에는 빌드된 정적 파일만 복사한다.
RUN npm run build

FROM nginx:stable-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
# 개발 기본 HTTP. 운영 HTTPS는 Compose에서 https.conf와 인증서 디렉터리를 마운트한다.
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/app-locations.conf /etc/nginx/snippets/app-locations.conf
EXPOSE 80
# 운영 HTTPS 포트 공개는 compose.yaml의 주석 처리된 443 매핑으로 활성화한다.
