#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$PROJECT_ROOT"

for app in backend frontend; do
    if [[ ! -f "$app/.env" ]]; then
        printf '먼저 cp %s/.env.example %s/.env 실행 후 설정을 채우세요.\n' "$app" "$app" >&2
        exit 1
    fi
done
if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' 'Docker Engine과 Compose를 설치하고 Docker를 실행하세요.' >&2
    exit 1
fi

if [[ $# -eq 0 ]]; then
    set -- up -d --build --remove-orphans
fi

# backend/.env의 COMPOSE_FILE이 루트 YAML을 선택한다. 셸 코드로 source하지 않는다.
exec docker compose --project-directory "$PROJECT_ROOT" \
    --project-name new-cmms --env-file backend/.env --env-file frontend/.env "$@"
