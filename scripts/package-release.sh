#!/usr/bin/env bash
# 실행 이미지와 외부 설정만 전달하는 소스 없는 배포 패키지를 만든다.
set -euo pipefail
CMMS_SOURCE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ $# -ne 2 ]]; then printf '사용법: %s 새출력폴더 버전\n' "$0" >&2; exit 1; fi
cmms_release_dir="$1"
cmms_release_version="$2"
if [[ ! "$cmms_release_version" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$ ]]; then printf '%s\n' '유효한 이미지 버전을 지정하세요.' >&2; exit 1; fi
# 기존 배포본·환경파일을 덮어쓰지 않도록 반드시 새 출력 폴더를 사용한다.
if [[ -e "$cmms_release_dir" ]]; then printf '%s\n' '출력 폴더가 이미 있습니다. 새 경로를 지정하세요.' >&2; exit 1; fi
# 소스는 빌드 단계에서만 사용한다. 최종 이미지에는 실행 산출물만 복사한다.
docker build -f "$CMMS_SOURCE_ROOT/backend/Dockerfile" -t "cmms-backend:$cmms_release_version" "$CMMS_SOURCE_ROOT"
docker build -f "$CMMS_SOURCE_ROOT/frontend/Dockerfile" -t "cmms-frontend:$cmms_release_version" "$CMMS_SOURCE_ROOT"
# 운영 서버에는 이미지와 실행 설정만 전달한다. 실제 .env·DB·첨부는 복사하지 않는다.
mkdir -p "$cmms_release_dir/data/uploads" "$cmms_release_dir/data/postgres" "$cmms_release_dir/nginx" "$cmms_release_dir/postgres/init"
cp "$CMMS_SOURCE_ROOT/compose.yaml" "$cmms_release_dir/compose.yaml"
cp "$CMMS_SOURCE_ROOT/.env.example" "$cmms_release_dir/.env.example"
sed -i -e "s/^CMMS_BACKEND_IMAGE=.*/CMMS_BACKEND_IMAGE=cmms-backend:$cmms_release_version/" -e "s/^CMMS_FRONTEND_IMAGE=.*/CMMS_FRONTEND_IMAGE=cmms-frontend:$cmms_release_version/" -e 's/^NODE_ENV=.*/NODE_ENV=production/' "$cmms_release_dir/.env.example"
cp "$CMMS_SOURCE_ROOT/nginx/default.conf" "$CMMS_SOURCE_ROOT/nginx/app-locations.conf" "$cmms_release_dir/nginx/"
cp "$CMMS_SOURCE_ROOT/postgres/init/01-create-app-user.sh" "$cmms_release_dir/postgres/init/"
# 앱 이미지만 전달한다. PostgreSQL 18.7은 설치 서버에서 내려받는다.
docker save -o "$cmms_release_dir/images.tar" "cmms-backend:$cmms_release_version" "cmms-frontend:$cmms_release_version"
cat > "$cmms_release_dir/INSTALL.txt" <<'INSTALL'
1. /srv/new-cmms에 배포 파일을 복사하고 docker load -i images.tar 실행
2. cp .env.example .env 후 실제 DB_PASSWORD(cmms)·POSTGRES_PASSWORD(postgres)·JWT_ACCESS_SECRET·CORS_ORIGINS·바인딩 주소 입력
3. data/uploads의 소유권을 컨테이너 UID/GID 1000에 맞춤
4. docker compose config --quiet
5. docker compose pull postgres (CMMS_POSTGRES_IMAGE=postgres:18.7, 서버 인터넷 필요)
6. docker compose up -d --wait postgres
7. docker compose run --rm --no-deps backend npm run migration:run
8. docker compose run --rm --no-deps -e DB_SYNCHRONIZE=false backend npm run init:admin
9. docker compose up -d --wait
운영은 NODE_ENV=production, DB_SYNCHRONIZE=false 유지.
기존 DB에 최초 migration을 그대로 실행하지 않는다. INSTALL_GUIDE.md를 먼저 확인한다.
INSTALL
cp "$CMMS_SOURCE_ROOT/docs/install_guide.md" "$cmms_release_dir/INSTALL_GUIDE.md"
printf '운영 배포 패키지: %s\n' "$cmms_release_dir"
