#!/usr/bin/env bash
# 서비스 실행 전용: ./start.sh (소스가 있으면 빌드), ./start.sh logs/ps 등.
# 모드는 backend/.env의 NODE_ENV: 개발 development / 배포 production.
# DB_SYNCHRONIZE는 개발 true/false, 운영 false. 초기 설정은 ./bootstrap.sh schema 또는 admin.
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$PROJECT_ROOT"
# 실제 비밀값은 외부 환경파일에 두며 스크립트에서 source/eval로 실행하지 않는다.
for config_file in .env backend/.env; do
    if [[ ! -f "$config_file" ]]; then
        printf '설정 파일을 준비하세요: %s\n' "$config_file" >&2
        exit 1
    fi
done
if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' 'Docker Engine과 Compose를 설치하고 Docker를 실행하세요.' >&2
    exit 1
fi
# logs/ps/down 등 명시적인 명령에는 초기 설정 질문을 넣지 않는다.
if [[ $# -gt 0 ]]; then
    exec docker compose --project-directory "$PROJECT_ROOT" "$@"
fi
compose=(docker compose --project-directory "$PROJECT_ROOT")
# 소스 작업 폴더에서는 빌드하고, 소스 없는 배포 폴더에서는 로드된 이미지를 사용한다.
if [[ -f backend/Dockerfile && -f frontend/Dockerfile ]]; then
    "${compose[@]}" build
fi
# 서비스 시작은 스키마 설치·관리자 부트스트랩을 실행하지 않는다.
exec docker compose --project-directory "$PROJECT_ROOT" up -d --no-build --remove-orphans
