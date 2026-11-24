#!/usr/bin/env bash
set -euo pipefail

# 공식 postgres 이미지가 빈 데이터 디렉터리를 초기화할 때만 실행한다.
# cmms는 DB와 public 스키마의 소유자이며 슈퍼유저가 아니다.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$CMMS_APP_DB_PASSWORD" --set=app_db="$POSTGRES_DB" <<'SQL'
CREATE ROLE cmms LOGIN PASSWORD :'app_password';
ALTER DATABASE :"app_db" OWNER TO cmms;
ALTER SCHEMA public OWNER TO cmms;
SQL
