#!/usr/bin/env bash
# 초기 설정 전용: ./bootstrap.sh schema (빈 public 설치), ./bootstrap.sh admin (회사·관리자 생성/갱신).
# DB 접속은 backend/.env를 사용한다. 회사·관리자 정보는 대화형 입력하며 파일·명령 인자에 남기지 않는다.
# 모든 모드에서 자동 동기화를 끈다. schema는 INSTALL 확인 후 실행하며 기존 객체가 있으면 중단한다.
# 서비스 시작은 ./start.sh로 별도 실행한다. 기존 DB 업그레이드에는 schema를 사용하지 않는다.
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$PROJECT_ROOT"
if [[ $# -ne 1 || ! "$1" =~ ^(schema|admin)$ ]]; then
    printf '사용법: %s schema|admin\n' "$0" >&2
    exit 1
fi
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
compose=(docker compose --project-directory "$PROJECT_ROOT")
case "$1" in
    schema)
        printf '%s\n' 'backend/.env의 DB에 빈 public 업무 테이블을 설치합니다. 기존 테이블·뷰·시퀀스가 있으면 중단합니다.'
        read -r -p '설치를 실행하려면 INSTALL을 입력하세요: ' cmms_confirm
        if [[ "$cmms_confirm" != INSTALL ]]; then printf '%s\n' '설치를 취소했습니다.'; exit 0; fi
        cmms_script=schema-init
        ;;
    admin)
        if [[ ! -t 0 || ! -t 1 ]]; then
            printf '%s\n' '회사·관리자 초기 설정은 대화형 터미널에서 실행하세요.' >&2
            exit 1
        fi
        cmms_script=bootstrap-admin
        ;;
esac
# 소스 없는 배포 폴더는 로드된 이미지를 사용한다.
if [[ -f backend/Dockerfile ]]; then
    "${compose[@]}" build backend
fi
if [[ "$1" == admin ]]; then
    exec "${compose[@]}" run --rm --no-deps -it -e DB_SYNCHRONIZE=false backend node "dist/bootstrap/$cmms_script.js"
fi
exec "${compose[@]}" run --rm --no-deps -T -e DB_SYNCHRONIZE=false backend node "dist/bootstrap/$cmms_script.js"
