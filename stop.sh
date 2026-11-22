#!/usr/bin/env bash
# 서비스 종료 전용: ./stop.sh. 외부 DB·업로드 파일은 유지한다.
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$PROJECT_ROOT/start.sh" down --remove-orphans "$@"
