# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Nginx가 같은 origin의 /api를 NestJS로 전달한다. DB/JWT 비밀값은 빌드에 전달하지 않는다.
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM nginx:stable-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/app-locations.conf /etc/nginx/snippets/app-locations.conf
EXPOSE 80 443
