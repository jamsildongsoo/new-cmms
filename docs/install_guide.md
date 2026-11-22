# CMMS 설치·운영 가이드

기준일: 2026-11-18. 업무 기준은 [제품 명세](prod_spec.md), 구성과 저장 계약은 [기술 명세](tech_spec.md)를 따른다.

## 1. 배포 구성과 실행

- 애플리케이션 서버: Docker Engine·Compose, 빌드된 NestJS와 Nginx 정적 SPA, 업로드 영구 디렉터리.
- DB 서버: 외부 PostgreSQL. Supabase 사용 시 PostgreSQL 접속 정보만 필요하다. Supabase Auth·Storage는 사용하지 않는다.
- 운영 접근: HTTPS 도메인과 신뢰할 수 있는 인증서. NestJS는 외부에 포트를 직접 공개하지 않는다.
- 고객별 배포: 별도 DB/DB 계정·JWT 비밀키·업로드·인증서·백업 경로를 사용하고 루트 .env의 COMPOSE_PROJECT_NAME을 고객별로 구분한다. 회사코드는 해당 DB 안에서 업무 자료를 구분한다.

개발·테스트·운영 모두 `compose.yaml` 하나를 사용한다. 환경은 `backend/.env`의 `NODE_ENV`로 선택한다. 프로젝트 루트에서 `docker compose up -d --build`로 실행하고 `docker compose down`으로 종료한다. 소스 변경 자동 반영은 없으며 변경 후 이미지를 다시 빌드한다. Docker 실행에는 Bash·Docker Engine·Compose, Docker 없는 개별 실행에는 Node.js 24가 필요하다.

Ubuntu 기본 저장소를 사용하는 경우 일반 사용자 터미널에서 다음 명령으로 Docker·Compose·Buildx를 설치한다. Docker 공식 저장소의 docker-ce가 이미 설치되어 있다면 중복 설치하지 않는다.

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 docker-buildx
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
# 로그아웃 후 다시 로그인하거나 다음 명령으로 그룹을 적용한다.
newgrp docker
docker version
docker compose version
docker run --rm hello-world
```

docker 그룹에는 관리자 수준의 권한이 있으므로 개발 서버 사용자에 한해 부여한다. 공식 저장소를 사용하려면 [Docker 공식 설치 절차](https://docs.docker.com/engine/install/ubuntu/)를 따른다.

환경파일은 역할별로 세 곳에 둔다. 기존 파일이 있으면 덮어쓰지 않는다.

| 파일 | 역할 | 예시 |
|---|---|---|
| 루트 `.env` | Docker Compose 치환·프로젝트·포트·호스트 경로 | COMPOSE_PROJECT_NAME, CMMS_HTTP_PORT, UPLOADS_HOST_PATH |
| `backend/.env` | NestJS 실행 설정과 비밀값 | NODE_ENV, DB_*, JWT_*, CORS_ORIGINS, FILE_* |
| `frontend/.env` | 브라우저에 공개되는 API 연결 설정 | VITE_API_BASE_URL |

최초 설정과 개발 DB를 사용하는 Docker 실행(기본 HTTP 80, 인증서 불필요):

```bash
# 기존 환경파일이 없는 경우에만 복사한다.
cp -n .env.example .env
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
# backend/.env의 외부 개발 DB·JWT 값을 채운다. 회사·관리자 정보는 bootstrap에서 입력한다.
mkdir -p backend/uploads deploy/db-certs deploy/tls
sudo chown 1000:1000 backend/uploads
# 개발 HTTP에서는 deploy/tls를 빈 폴더로 준비한다.

docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
curl --fail http://localhost/
curl --fail http://localhost/api/health
```

`NODE_ENV=development`와 `DB_SYNCHRONIZE=true`를 함께 설정한 경우에만 연결된 개발 DB 스키마를 자동 동기화한다. 개발에서도 false로 끌 수 있으며 기본값은 false다. 배포는 `NODE_ENV=production`, `DB_SYNCHRONIZE=false`를 사용한다. test는 자동 검사 전용이며 개발 외 모드에서 true이면 시작을 거부한다. DB 컨테이너는 생성하지 않는다. 최초 관리자 초기화는 이미지의 빌드된 실행파일을 사용한다.

```bash
# 관리자 계정이 없는 최초 설치 시 실행한다.
./bootstrap.sh admin
```

로그는 `docker compose logs -f`, 이미지 빌드만 수행하려면 `docker compose build`, 종료는 `docker compose down`이다. 종료해도 외부 DB와 호스트 업로드는 유지된다. 이전 watch 구성의 frontend 컨테이너가 남아 있으면 최초 전환 시 `docker compose up -d --build --remove-orphans`를 사용한다. 기존 `./start.sh`, `./stop.sh`도 같은 Compose의 단축 명령으로 유지하며 어느 디렉터리에서 호출해도 프로젝트 루트를 기준으로 동작한다.

Docker 없이 개별 개발하려면 별도 터미널에서 실행한다. 각 앱은 자기 디렉터리의 환경파일만 읽으며 루트 `.env`는 사용하지 않는다.

```bash
# 터미널 1: 프로젝트 루트에서
cd backend
npm ci
npm run start:dev

# 터미널 2: 프로젝트 루트에서
cd frontend
npm ci
npm run dev
```

개별 개발 접속은 `http://localhost:5173`이며 Vite가 `/api`를 vite.config.ts의 기본 대상 http://127.0.0.1:3000으로 프록시한다. 다른 개발 주소는 실행 환경변수 API_PROXY_TARGET으로 지정한다. backend의 PORT를 바꾸면 프록시 대상도 맞춘다. 각 터미널의 Ctrl+C로 종료한다. Docker의 프런트는 Vite 서버 대신 Nginx를 사용하므로 API_PROXY_TARGET은 사용하지 않는다.

프런트 명령은 `npm run dev`(개발 서버), `npm run build`(타입 검사·정적 빌드), `npm run lint`(코드 검사)로 구분한다. `npm run preview`는 빌드 결과의 로컬 확인용이며 운영 서비스에는 Nginx를 사용한다. 마운트된 소스의 파일 변경 감지가 동작하지 않는 환경에서만 `CMMS_USE_POLLING=true npm run dev`를 사용한다. 다른 개발 백엔드 주소는 예를 들어 `API_PROXY_TARGET=http://127.0.0.1:4000 npm run dev`로 지정한다.

개발 기본 서비스는 호스트 80 → Nginx 컨테이너 80의 HTTP이며 인증서가 필요 없다. HTTPS 443 매핑과 환경값은 주석으로 남겨 둔다. 운영 전환 시 루트 .env에서 CMMS_NGINX_CONFIG를 https.conf로 교체하고 CMMS_HTTPS_PORT=443의 주석을 해제한다. 인증서·개인키를 준비한 뒤 compose.yaml의 443 매핑 주석을 해제한다. 이때 80을 유지하면 HTTPS 이동용으로 사용하고, 443만 제공하려면 80 매핑을 주석 처리한다. 백엔드 내부 HTTP 3000은 변경하지 않는다. NODE_ENV 변경만으로 HTTP/HTTPS가 자동 전환되지는 않는다.

## 2. 환경과 호스트 경로

실제 환경파일·인증서·업로드·백업은 Git에 저장하지 않는다. 루트 `.env`는 Compose 설정에만 사용하고 DB·JWT 비밀값은 `backend/.env`에 둔다. 셸에 같은 환경변수가 설정되어 있으면 Compose 파일 치환에서 `.env`보다 우선한다. `docker compose config`는 비밀값을 출력할 수 있으므로 일반 검사는 `config --quiet`를 사용한다.

| 파일 | 설정 | 기준 |
|---|---|---|
| 루트 .env | COMPOSE_PROJECT_NAME | 기본 new-cmms. 고객별 구분하며 compose.yaml의 name보다 우선 |
| 루트 .env | CMMS_BIND_ADDRESS / CMMS_HTTP_PORT / CMMS_HTTPS_PORT | 개발 기본 HTTP 80, 운영 HTTPS 443은 주석 해제하여 전환. 로컬 바인딩 127.0.0.1, 외부 공개 시 주소 변경 |
| 루트 .env | CMMS_NGINX_CONFIG | 개발 default.conf, 운영 전환 시 https.conf 선택 |
| 루트 .env | UPLOADS_HOST_PATH | 기본 ./backend/uploads, 기존 파일 경로 유지 |
| 루트 .env | DB_CERTS_HOST_PATH / TLS_CERT_DIR | DB CA / HTTPS 인증서 호스트 경로 |
| backend/.env | NODE_ENV | 개발 development / 배포 production (test는 검사 전용), DB_SYNCHRONIZE는 개발 true/false, 운영 false |
| backend/.env | DB_HOST/PORT/USER/PASSWORD/NAME | 외부 PostgreSQL, 애플리케이션 전용 계정 |
| backend/.env | DB_SSL / DB_SSL_REJECT_UNAUTHORIZED | 운영 외부 DB는 true / true, 필요 시 공급자 CA |
| backend/.env | JWT_ACCESS_SECRET / JWT_ACCESS_EXPIRES_IN | 고객별 무작위 비밀값 / 기본 15m |
| backend/.env | CORS_ORIGINS | 실제 프런트 origin, 개별 개발은 localhost:5173 포함 |
| backend/.env | FILE_LOCAL_ROOT | 개별 실행은 backend 기준 ./uploads, Docker는 /app/uploads로 덮어씀 |
| backend/.env | FILE_MAX_SIZE_BYTES | 기본 10485760(10 MiB) |
| backend/.env | FILE_MAX_FILES_PER_UPLOAD | 기본 10 |
| backend/.env | FILE_MAX_UPLOAD_TOTAL_BYTES | 기본 52428800(50 MiB) |
| backend/.env | FILE_ALLOWED_MIME_TYPES | 허용 MIME 목록 |
| frontend/.env | VITE_API_BASE_URL | 기본 /api, 브라우저에 공개 |
| 개발 실행 환경변수 | API_PROXY_TARGET | 선택 사항. Vite 개발 프록시 기본 주소를 덮어쓰며 운영에는 사용하지 않음 |

백엔드는 시작 시 환경변수의 기본값·타입·허용 범위를 검증하고, 변환한 동일 설정을 DB·JWT·첨부 서비스에 전달한다. 설정 누락에는 정의된 기본값을 적용하고, 빈 값이나 잘못된 값에는 설정 항목명을 포함한 오류를 반환한다. 비밀값은 오류에 출력하지 않는다. PORT·DB_PORT는 1~65535, 업로드 크기·개수는 양의 정수다. 업로드 합계 제한은 파일 하나의 제한 이상이어야 한다. LOGIN_HISTORY_RETENTION_DAYS=0은 자동 삭제 비활성화, TRUST_PROXY_HOPS=0은 프록시 비신뢰를 뜻한다.

JWT_ACCESS_EXPIRES_IN은 `15m`, `1h`, `7d`처럼 단위(ms/s/m/h/d/w/y)를 붙이고 최소 1초로 지정한다. CORS_ORIGINS에는 경로·끝 슬래시 없는 HTTP(S) origin을 쉼표로 구분해 지정한다. 첨부 상대 경로는 프로세스 실행 위치와 무관하게 backend 디렉터리 기준으로 해석하며, 절대 경로는 그대로 사용한다. Docker에서는 /app/uploads를 유지한다. Docker 없는 실행에서도 파일 수신 단계의 크기·개수 제한이 적용되고 서비스가 합계 용량과 유형을 추가 검사한다.

backend 컨테이너는 `env_file: backend/.env`로 설정을 전달받는다. Compose는 PORT=3000, API_PREFIX=api, TRUST_PROXY_HOPS=1, FILE_STORAGE_DRIVER=local, FILE_LOCAL_ROOT=/app/uploads를 지정한다. NODE_ENV는 backend/.env의 값을 사용하므로 빌드된 앱도 개발 DB로 테스트할 수 있다. 운영에서는 반드시 NODE_ENV=production으로 변경한다.

프런트 빌드는 `frontend/.env`를 Vite가 직접 읽으며 VITE_ 공개 설정만 브라우저 코드에 노출한다. frontend/.env에는 DB·JWT 등 비밀값을 넣지 않는다. 이 파일은 프런트 빌드 단계에만 포함되고 최종 Nginx 이미지에는 정적 빌드 결과만 복사한다. 루트·backend 환경파일은 Docker 빌드 컨텍스트에서 제외한다. 프런트 환경파일 변경도 COPY 캐시를 갱신하므로 `docker compose up -d --build`로 반영된다. 루트 .env의 VITE_API_BASE_URL이나 셸 변수는 프런트 빌드에 전달하지 않는다.

Supabase는 프로젝트 Connect 화면의 Direct 또는 네트워크에 맞는 Session pooler 접속값을 사용한다. IPv4/IPv6·허용 IP·방화벽·DB TLS를 확인한다. CA가 필요하면 DB 인증서 폴더에 넣고 backend/.env에 NODE_EXTRA_CA_CERTS=/app/certs/db-ca.crt를 지정한다. Docker 없는 실행에서는 Node 시작 전 호스트 인증서 절대 경로를 환경변수로 지정한다.

호스트 경로를 먼저 만들고 uploads의 쓰기 권한을 backend 사용자 UID/GID 1000에 부여한다. TLS 디렉터리는 HTTP 테스트에서도 빈 디렉터리로 준비한다. 인증서는 Nginx가 읽을 수 있어야 하며 개인키는 관리자만 변경하도록 관리한다. 루트 .env에서 경로를 바꿨다면 해당 실제 디렉터리를 준비한다.

## 3. DB 스키마와 관리자

개발 DB는 NODE_ENV=development, DB_SYNCHRONIZE=true일 때 Entity를 기준으로 스키마를 생성·갱신한다. 개발용 자동 동기화 대상은 개발 전용 DB로 제한한다. test/production에서는 자동 동기화하지 않는다.

운영 DB·접속 계정은 시스템 관리자가 별도로 준비한다. 빈 public 업무 테이블은 `./bootstrap.sh schema`를 실행하고 INSTALL을 입력하여 생성한다. 기존 테이블·뷰·시퀀스가 하나라도 있으면 중단하며 서비스 실행으로 넘어가지 않는다. 명령은 서버 시작 때 자동 실행하지 않는다. 직접 실행도 가능하다.

```bash
./bootstrap.sh schema
```

테이블 설치 후 회사·관리자 초기 데이터는 아래 별도 명령으로 등록한다.

```bash
# 실행 중 회사 코드·회사명·관리자 ID/이름·비밀번호를 입력한다. 비밀번호는 표시하지 않는다.
# backend/.env의 NODE_ENV=production을 확인한다. test/production에서는 스키마를 자동 변경하지 않는다.
./bootstrap.sh admin
```

- 부트스트랩은 지정 회사·ADMIN 사업장/부서·역할·관리자를 하나의 트랜잭션으로 생성·갱신하고 상수 권한 전체를 관리자에게 배정한다. DB나 PostgreSQL 계정을 생성하지 않는다.
- 재실행은 관리자 이름·역할·부서·범위 및 관리자 권한을 갱신한다. 기존 비밀번호는 재설정 질문에 y로 답한 경우에만 변경한다. 일반 역할은 변경하지 않는다.
- `./start.sh`는 모드·대화형 여부와 관계없이 서비스만 시작한다. `./bootstrap.sh schema`는 INSTALL 확인 후 빈 public만 설치하고, `./bootstrap.sh admin`은 대화형으로 회사·관리자 정보를 입력받아 초기 데이터를 생성·갱신한다. 입력값은 환경파일에 저장하지 않으며 비밀번호는 숨김 입력·확인을 거친다. 두 명령 모두 DB_SYNCHRONIZE=false로 실행하고 서비스를 시작하지 않는다.
- Docker 없는 개별 실행은 `npm run bootstrap:schema --prefix backend`, `npm run bootstrap:admin --prefix backend`를 사용한다. schema npm 명령은 빈 public 검사 후 바로 설치하므로 대상 DB를 먼저 확인한다. `package.json`의 실행 명령은 NODE_ENV를 지정하지 않는다. 실행 모드는 backend/.env에서 읽으며 외부 실행 환경변수가 있으면 우선한다. `start:dev`는 watch, `start:debug`는 디버그·watch, `start:prod`는 빌드된 코드 실행을 선택한다. 명령 이름과 관계없이 실제 모드는 NODE_ENV 값을 따른다.
- 고객별 DB·전용 접속 계정, 각 DB의 public 스키마를 사용한다. 관리자가 PUBLIC의 CONNECT를 회수하고 해당 고객 계정만 접속·테이블 사용을 허용한다. 고객마다 별도 컨테이너·환경파일·파일 경로를 둔다.

## 4. HTTPS 운영

`deploy/tls/fullchain.pem`, `deploy/tls/privkey.pem`을 준비한다. 루트 `.env`에서 다음 항목을 변경한다.

```dotenv
CMMS_BIND_ADDRESS=0.0.0.0
CMMS_HTTP_PORT=80  # HTTPS 이동용. 443만 제공하려면 Compose의 80 매핑을 주석 처리
CMMS_HTTPS_PORT=443
CMMS_NGINX_CONFIG=./deploy/nginx/https.conf
TLS_CERT_DIR=./deploy/tls
```

인증서·개인키를 준비하고 `compose.yaml`에서 주석 처리된 443 포트 매핑을 활성화한다. 80 매핑은 HTTPS 이동용으로 유지하거나 필요에 따라 주석 처리한다.

`backend/.env`는 NODE_ENV=production으로 설정하고 CORS_ORIGINS를 실제 HTTPS origin에 맞춘다. 운영 DB·JWT·관리자 비밀번호도 개발 환경과 분리한다. 운영 도메인의 DNS를 서버에 연결한다.

```bash
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose exec nginx nginx -t
curl --fail https://cmms.example.com/api/health
```

인증서 경로는 용도별로 분리한다. TLS_CERT_DIR(deploy/tls)은 브라우저 ↔ Nginx HTTPS용 인증서·서버 개인키를 보관한다. DB_CERTS_HOST_PATH(deploy/db-certs)는 백엔드가 DB 서버 인증서를 검증할 공급자 CA 인증서를 보관하며 DB_SSL 설정과 함께 사용한다. JWT는 사용자 인증용이고 통신 암호화는 TLS가 담당한다. 브라우저는 공개 인증서를 검증하고 TLS 연결을 협상하며, 서버 개인키나 JWT 비밀값을 전달받지 않는다. 운영 브라우저 접속은 HTTPS 443을 사용하고 HTTPS 전환 후 HTTP 80 매핑을 유지한 경우 HTTPS로 리다이렉트한다. Nginx와 NestJS는 동일 물리 서버의 별도 Docker 컨테이너에서 실행하며, Nginx에서 TLS를 종료한 뒤 백엔드와 HTTP backend:3000으로 통신한다. 동일 서버 내부 구간에는 별도 TLS를 구성하지 않고 NestJS 3000 포트는 외부에 공개하지 않는다. 배포 기준은 [기술 명세의 런타임 구성](tech_spec.md#10-런타임검증)을 따른다.

기본 compose.yaml과 Nginx 이미지는 개발용 HTTP 설정을 사용한다. 운영 HTTPS는 환경파일의 설정 선택·443 매핑·인증서 준비를 함께 적용한다. 인증서 디렉터리는 읽기 전용 mount한다. API는 같은 origin의 /api로 전달한다. HTTPS 설정에서는 인증서·개인키가 없으면 Nginx가 시작할 수 없다. 운영은 HTTPS를 사용하며 인증서 발급·갱신은 운영자가 관리한다. 인증서 교체 후 nginx -t와 nginx -s reload를 실행한다.

## 5. 업로드·업데이트·백업

- 파일은 호스트 업로드 디렉터리의 companyId/refModule/attachmentId/UUID.확장자 아래에 저장한다. DB에는 상대 경로·원본명·MIME·크기·checksum을 기록한다.
- Nginx에 업로드를 mount하지 않으며 /uploads 직접 접근은 404다. 파일은 JWT 첨부 API로만 내려받는다.
- Nginx 요청 제한은 60 MiB다. 앱 한도를 바꾸면 프록시 제한도 함께 검토한다. 파일 삭제는 즉시 반영하며 고아 파일의 자동 정리는 없다.
- 업데이트 전 DB와 파일을 백업하고 같은 호스트 bind 경로를 유지한다. 환경 변경은 restart만 하지 말고 up -d로 컨테이너를 재생성한다.
- 일관된 백업은 쓰기를 중지한 뒤 외부 DB 백업과 업로드를 같은 시점에 확보한다. 서버 외부에도 사본을 둔다. DB 백업만으로 첨부 파일을 복구할 수 없다.

```bash
docker compose stop nginx backend
docker compose run --rm --no-deps -T --entrypoint tar backend -C /app/uploads -czf - . > backups/uploads.tar.gz
# 중지 구간에 DB 공급자의 백업/내보내기도 완료한다.
docker compose up -d
```

복구는 검증 환경에서 먼저 시험한다. 서비스를 멈추고 대응하는 DB와 파일을 함께 복원한 뒤 uploads의 UID/GID·권한, health·로그인·기존 첨부·수불을 확인한다. 정상적인 컨테이너 교체는 외부 DB와 호스트 업로드를 삭제하지 않는다.

## 6. 운영 확인과 장애 대응

창고 삭제 담당자는 재고 현황에서 해당 회사·사업장·창고의 모든 자재 수량과 금액을 확인한다. 잔고가 남아 있으면 정상 재고 거래로 정리한다. 이어 입고 목록에서 같은 창고를 수령지로 하는 W(수령 대기) 전표를 확인하고 수령 확정 등 필요한 업무 처리를 마친다. 두 확인을 마친 뒤 창고 관리 화면의 삭제 안내를 확인하고 삭제한다. 서버는 이 조건을 자동 검사하지 않으므로 삭제 담당자가 절차를 이행한다.

| 확인·증상 | 점검 |
|---|---|
| 시작 실패 / health 503 | DB 접속·TLS CA·환경변수·운영 synchronize=false |
| Nginx 대기 / 502 | backend health·Docker 네트워크·인증서·로그 |
| 로그인 / 새로고침 | 올바른 회사, 사용자 복원, 원래 URL 유지 |
| 401 / 403 | 만료는 재로그인, 권한 거부는 역할 배정 확인 |
| 업로드 EACCES / 413 | uploads UID/GID 1000·호스트 권한 / 프록시·앱 용량 제한 |
| 첨부 다운로드 실패 | 인증 회사·그룹, 파일 bind 경로, DB/파일 백업 시점 |
| 결재 후 원본 불일치 | 결재·원본 번호와 sync 로그 확인, 앞선 결재 결과 보존 |
| 마감 차단 | 전월 마감·누락 월 확인. 소급 처리 시 후속 마감월도 해제 |
| 생성 응답 유실 | 목록에서 저장 여부를 먼저 확인한다. 생성 재요청은 새 번호를 발급한다 |

설치 후 다른 회사 자료 접근 거부, BORD 채번과 작성자 규칙, 구매요청 최초 복사·독립 발주 수정·전량입고, 단가 버림×수량의 출고금액·품목 적요·전량 출고 후 단수 잔액, 대기 입고 확정·원금액 취소, 월 Lock·해제, 컨테이너 교체 후 파일 지속성을 확인한다. 완전한 고객 격리에는 고객별 DB·비밀키·파일 경계도 필요하다.

## 7. 로컬 개발과 검사

테스트는 개발 의존성이 설치된 소스 작업 폴더에서 실행한다. 백엔드 SQL 통합 테스트는 임시 PGlite DB를 사용하며 고객 DB를 사용하지 않는다. 브라우저 테스트는 Chromium과 로컬 테스트 서버를 사용한다.

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm test --prefix backend -- --runInBand
npm run lint --prefix backend
npm run lint --prefix frontend
npm run test:browser --prefix frontend
npm run test:numeric --prefix frontend
python3 scripts/test-start.py
```

`test:browser`는 프런트를 새로 빌드한 뒤 인증·구매/재고·업무 UI 테스트를 실행한다. CHROME_PATH로 Chromium 실행파일 경로를 지정할 수 있다. 메타데이터는 백엔드 원본에서 생성하므로 backend/dist와 별도 JSON 복사본이 필요하지 않다. `scripts/test-start.py`는 Docker 모형으로 실행 흐름을 검증하며 실제 Docker·DB는 변경하지 않는다.

```bash
# 실행 이미지 빌드: 서비스나 DB를 기동하지 않는다.
docker compose build
# 또는 Docker 없이 실행 산출물만 생성
npm run build --prefix backend
npm run build --prefix frontend
```

2026-11-18 정리 시점에 백엔드 33개 스위트·373개 테스트, 브라우저 3종, 숫자 헬퍼·스크립트 7개 테스트를 통과했다. 소스·테스트의 TypeScript 미사용 변수/인자 검사와 양쪽 린트도 통과했다. 검증 완료 후 backend/dist·frontend/dist·기존 tsbuildinfo·프런트 TypeScript/Vite 캐시는 삭제했다. 새 빌드에 필요한 설정 파일과 의존성 설치·환경파일·첨부는 유지한다.

## 8. 개발 DB 변경 반영

개발 단계에서는 마이그레이션 파일을 사용하지 않는다. `backend/.env`의 `NODE_ENV=development`, `DB_SYNCHRONIZE=true` 설정으로 백엔드를 다시 시작하면 사용자 `tokenVersion` 컬럼과 `login_history` 테이블을 엔티티 기준으로 반영한다. 운영 설정에서는 기존대로 자동 동기화를 금지한다.

마이그레이션 파일은 만들지 않는다. 실제 DB 데이터를 자동 변환하거나 삭제하지 않는다. 기존 개발 DB를 재사용하면 역할 배정·원문 참조·코드 그룹 ID를 [기술 명세의 모듈·코드 그룹 키](tech_spec.md#11-코드상수-관리-기준)에 맞춰야 한다. 기존 개발 데이터를 초기화하는 경우 관리자 부트스트랩과 공통코드 등록을 다시 수행한다. 제거한 document_request 테이블은 엔티티 제거만으로 삭제된다고 가정하지 않으며, 실제 잔여 테이블 정리는 별도 DB 작업이다. 기존 첨부의 storagePath는 보존하고 새 업로드부터 새 모듈 코드 경로를 사용한다.

마이그레이션 파일·기존 데이터 자동 보정은 추가하지 않는다. 실제 DB나 서버를 이번 코드 수정으로 직접 변경하지 않는다. 개발 설정 NODE_ENV=development, DB_SYNCHRONIZE=true로 다시 시작할 때 엔티티의 deptId와 신규 siteId 컬럼을 반영해야 한다. 기존 행의 siteId는 알 수 없으므로 현재 소속으로 임의 추정하지 않는다. siteId가 없는 과거 행은 사업장 제한 사용자에게 조회되지 않을 수 있으며, 개발 데이터 정비 시 처리한다. 실제 컬럼 이름 변경 시 기존 값 보존 여부는 DB 반영 전에 확인한다.

## 9. 로그인 이력 운영·추가 검증

LOGIN_HISTORY_RETENTION_DAYS 기본값은 90일이며 시작 시와 매일 보관기간이 지난 이력을 삭제한다. 0은 자동 삭제를 비활성화한다. 직접 실행은 TRUST_PROXY_HOPS=0으로 전달 헤더를 신뢰하지 않고 현재 Compose는 Nginx 한 단계를 신뢰하도록 1로 지정한다. 프록시 구성이 바뀌면 실제 경로에 맞춘다.

로그인 이력 조회 권한 LOGHIST:read는 MODULE_ACTIONS에 정의돼 있다. 역할 화면에서 배정하거나 기존 부트스트랩 절차(`npm run bootstrap:admin --prefix backend`)로 대상 회사 초기 관리자 역할에 배정한다. 비밀번호 재설정 질문의 기본값은 아니오이며 기존 관리자 비밀번호를 유지한다.

백엔드 인증 API 테스트는 격리된 PostgreSQL WASM DB와 실제 Passport/JWT·HTTP 검증을 사용한다. 결재 테스트는 정렬·검증·롤백·중복 처리를 확인한다. WASM DB는 연결을 직렬 실행하므로 여러 PostgreSQL 서버 세션 사이의 잠금 경합 자체를 재현하는 환경은 아니다. 프런트 브라우저 테스트는 모의 API로 개인정보 수정·비밀번호 변경·로그아웃·로그인 이력 필터·결재선·모바일 배치를 검증한다.

```bash
npm run build --prefix backend
npm test --prefix backend -- --runInBand
npm run lint --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
npm run test:ui --prefix frontend
npm test --prefix frontend
npm run test:purchase-inventory --prefix frontend
```

backend/src/common/document-access.spec.ts는 실제 격리 PostgreSQL SQL로 8개 서비스의 회사 격리, 동일 ID, 삭제 제외, 사업장, 하위 부서, 단건과 삭제 접근 차단, 소속 누락 거부를 확인한다. 예방점검의 선택 부서·서버 사업장 저장과 범위 밖 부서 변경 거부도 검증한다. 각 모듈의 기존 업무 테스트와 프런트 브라우저에서 deptId 입력·응답 연결을 함께 확인한다.

재고 유형은 고정 상수로 제공하므로 기본 수불코드 등록은 실행하지 않는다. 재고 schema는 즉시확정 C/취소 X, type/kind, 발주 필수 toSiteId 및 ledger 복합 PK 기준이다. 개발 단계로 마이그레이션이나 실제 DB 데이터 변경은 수행하지 않는다.


### 권한 상수 전환 시 기존 DB

Permission 엔티티와 /permissions CRUD는 제거되었다. 앱은 MODULE_ACTIONS를 사용하며 기존 permission 테이블이 남아 있어도 조회하지 않는다. 운영 DB 테이블이나 매핑 행은 이 변경으로 자동 삭제하지 않는다. 기존 RolePermission의 유효한 permissionId는 유지하며 PERM:* 등 미지원 행은 인증 권한에서 제외된다. 관리자 역할을 bootstrap으로 동기화하면 지정 회사 관리자 배정만 지원 목록에 맞춰 갱신된다. 잔여 테이블·미지원 매핑의 물리 정리는 백업·참조 확인 후 별도 DB 작업으로 수행한다. 프런트와 백엔드는 metadata API를 포함한 같은 버전으로 배포한다.


### 단가 정수 컬럼 전환

구매발주·재고 품목의 unitPrice Entity는 numeric scale=0이다. 창고 평균단가는 별도 컬럼 없이 잔고 수량·금액에서 정수로 계산한다. 실제 DB 변경이나 기존 소수 단가 자동 변환은 실행하지 않는다. 운영 DB는 NODE_ENV=production을 유지하고, 기존 소수 단가와 발주·입고 금액의 관계를 확인한 뒤 백업 및 별도 스키마·데이터 전환 작업을 수행한다. 수량 DB scale=6은 유지한다. numericPrecision metadata가 추가되므로 프런트와 백엔드는 함께 배포한다.

## 운영 이미지와 외부 설정

- 최종 백엔드 이미지는 실행 JS·운영 의존성·package.json을 포함한다. 애플리케이션 원본 TS·테스트·문서·source map·타입 선언·빌드 캐시는 제외한다. 운영 의존성은 별도 단계에서 dev/optional을 제외해 새로 설치하며 TypeScript·ts-node·Jest 도구를 넣지 않는다. 프런트는 정적 빌드 결과와 Nginx 실행 설정만 포함한다.
- 배포 서버는 이미지와 Compose·환경파일·Nginx 설정·인증서·uploads만 필요하다. frontend/.env나 소스·Node 빌드 도구는 필요하지 않다. 프런트 API는 동일 도메인의 /api를 사용한다.
- 모든 환경에서 기본 파일명 compose.yaml을 자동 사용하므로 루트 .env에 COMPOSE_FILE을 지정하지 않는다. 소스 없는 배포에서는 CMMS_BACKEND_IMAGE/CMMS_FRONTEND_IMAGE에 로드한 이미지 버전을 지정한다. NODE_ENV는 Compose에서 고정하지 않으며 backend/.env에서 development/test/production으로 선택한다. DB_SYNCHRONIZE는 개발 true/false, 운영 false로 명시한다. 미설정 기본 모드는 production, 동기화는 false이며 개발 외 true는 오류다.
- backend/.env와 루트 .env를 수정한 뒤 docker compose up -d --force-recreate로 반영한다. restart만으로 env_file 변경이 적용되지는 않는다. 소스 없는 배포 폴더에서는 --build를 사용하지 않는다. Compose가 고정한 PORT/API_PREFIX/프록시·파일 경로는 backend/.env보다 우선한다.
- 운영 재고 테이블은 최신 Entity 기준으로 별도 설치해야 한다: stock_balance.amount 추가, inventory_document.status W 및 confirmedBy/At 추가, inventory_period_lock.summaryDirty 제거, valuation/ledger/transit/monthly_stock_* 미사용. 실제 운영 DB는 이번 작업으로 변경하지 않는다.

소스 없는 배포 폴더는 `./scripts/package-release.sh 새출력폴더 버전`으로 만든다. 스크립트는 두 이미지를 빌드하고 images.tar, 소스 작업 폴더와 동일한 compose.yaml, start/stop/bootstrap 스크립트, 환경파일 예시, Nginx 설정과 설치 안내만 포함한다. 실제 비밀 환경파일은 복사하지 않는다. 소스 작업 폴더의 start.sh는 이미지를 빌드하고, Dockerfile이 없는 배포 폴더에서는 빌드를 생략하고 로드된 이미지를 사용한다. Compose의 pull_policy=never로 레지스트리에서 자동 다운로드하지 않는다. 수신 서버는 docker load 후 환경파일·인증서·DB를 준비하고 bootstrap.sh schema → bootstrap.sh admin → start.sh 순서로 진행한다.

코드 정리·테스트 구성은 [기술 명세](tech_spec.md#14-코드-정리와-테스트-구성)를 따른다. 검증 후 dist·빌드 캐시를 비워 두었으므로 다음 실행 전 새 이미지를 빌드해야 한다. 재고 API도 함께 정리했으므로 프런트와 백엔드는 같은 버전으로 재빌드·배포한다.

운영 초기 설정은 서비스 시작과 별도로 실행한다.

```bash
./bootstrap.sh schema  # INSTALL 입력, 기존 public 객체가 있으면 중단
./bootstrap.sh admin   # 회사·관리자 정보를 대화형 입력
./start.sh             # 서비스 시작
```

schema는 DB·PostgreSQL 계정 자체를 생성하지 않으며 시스템 관리자가 미리 준비한다. 기존 DB 업데이트에는 사용하지 않는다. admin은 대화형 터미널에서 회사 코드·회사명·관리자 ID/이름·비밀번호를 입력받고, 기존 비밀번호는 재설정을 선택한 경우에만 변경한다. 회사·관리자 정보를 환경파일이나 명령 인자에 두지 않는다.

고객별 DB에는 PUBLIC의 CONNECT를 회수하고 해당 고객 계정에만 접속권한을 부여한다. 접속권한과 스키마/테이블 권한은 별도로 설정하고 서비스 계정에 슈퍼유저 권한을 사용하지 않는다. 설치용 DDL 계정과 운영 서비스 계정은 분리하는 것을 기본안으로 둔다.

출고 단가 정책 변경은 코드 계산과 기존 품목 적요(note)를 사용하므로 신규 컬럼을 요구하지 않는다. 기존 확정 전표를 재평가하거나 과거 적요를 자동 생성하지 않는다. 새 출고부터 단가 버림→수량 곱셈→잔고 차감을 적용하고, 수량 0에 남은 금액은 필요하면 금액 조정으로 정리한다.

날짜 공통 헬퍼 검사는 `npm run test:format --prefix frontend`, 숫자 변환·표시 검사는 `npm run test:numeric --prefix frontend`로 실행한다. 두 검사는 별도 빌드나 실행 DB가 필요 없다.
