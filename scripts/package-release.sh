#!/usr/bin/env bash
# 실행 이미지와 외부 설정만 전달하는 소스 없는 배포 패키지를 만든다.
# 운영 예시는 NODE_ENV=production / DB_SYNCHRONIZE=false. bootstrap.sh로 초기 설정 후 start.sh 실행.
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
# 운영 서버에는 이미지와 실행 설정만 전달한다. 실제 .env·인증서·첨부는 복사하지 않는다.
mkdir -p "$cmms_release_dir/backend/uploads" "$cmms_release_dir/deploy/nginx" "$cmms_release_dir/deploy/tls" "$cmms_release_dir/deploy/db-certs"
cp "$CMMS_SOURCE_ROOT/compose.yaml" "$cmms_release_dir/compose.yaml"
cp "$CMMS_SOURCE_ROOT/start.sh" "$CMMS_SOURCE_ROOT/stop.sh" "$CMMS_SOURCE_ROOT/bootstrap.sh" "$cmms_release_dir/"
cp "$CMMS_SOURCE_ROOT/.env.example" "$cmms_release_dir/.env.example"
printf '\nCMMS_BACKEND_IMAGE=cmms-backend:%s\nCMMS_FRONTEND_IMAGE=cmms-frontend:%s\n' "$cmms_release_version" "$cmms_release_version" >> "$cmms_release_dir/.env.example"
sed -e 's/^NODE_ENV=development$/NODE_ENV=production/' -e 's/^DB_SYNCHRONIZE=true$/DB_SYNCHRONIZE=false/' "$CMMS_SOURCE_ROOT/backend/.env.example" > "$cmms_release_dir/backend/.env.example"
cp "$CMMS_SOURCE_ROOT/deploy/nginx/default.conf" "$CMMS_SOURCE_ROOT/deploy/nginx/https.conf" "$cmms_release_dir/deploy/nginx/"
# 레지스트리 없이도 설치할 수 있도록 두 실행 이미지를 하나의 파일로 묶는다.
docker save -o "$cmms_release_dir/images.tar" "cmms-backend:$cmms_release_version" "cmms-frontend:$cmms_release_version"
cat > "$cmms_release_dir/INSTALL.txt" <<'INSTALL'
1. docker load -i images.tar
2. cp .env.example .env 및 cp backend/.env.example backend/.env
3. 환경파일에 DB·JWT·외부 바인딩 주소 설정. 운영은 https.conf 선택·인증서 준비·Compose의 443 매핑 주석 해제 (개발 기본 HTTP 80)
4. backend/uploads 소유권을 컨테이너 UID/GID 1000에 맞춤
5. ./bootstrap.sh schema: 빈 public 업무 테이블 설치 (INSTALL 확인, 기존 테이블이 있으면 중단)
6. ./bootstrap.sh admin: 회사·관리자 정보와 비밀번호를 대화형 입력하여 초기값 생성
7. ./start.sh: 서비스 시작
환경파일 수정 후 ./start.sh up -d --force-recreate로 컨테이너 재생성.
운영은 NODE_ENV=production, DB_SYNCHRONIZE=false 유지. 기존 DB 업그레이드는 schema 명령으로 수행하지 않음.
INSTALL
printf '운영 배포 패키지: %s\n' "$cmms_release_dir"
