# CMMS 설치·운영 가이드

업무 기준은 [제품 명세](prod_spec.md), 구성과 저장 계약은 [기술 명세](tech_spec.md)를 따른다.

## 1. 배포 구성

- 애플리케이션 서버: Docker Engine·Compose, Nginx+NestJS 컨테이너, 업로드 영구 디렉터리.
- DB 서버: 외부 PostgreSQL. Supabase 사용 시 PostgreSQL 접속 정보만 필요하다. Supabase Auth·Storage는 사용하지 않는다.
- 운영 접근: HTTPS 도메인과 신뢰할 수 있는 인증서. NestJS는 외부에 포트를 직접 공개하지 않는다.
- 고객별 배포: 별도 DB/DB 계정·JWT 비밀키·업로드·인증서·백업 경로와 Compose 프로젝트를 사용한다. 회사코드는 해당 DB 안에서 업무 자료를 구분한다.

통합 실행은 루트의 `start.sh`와 `stop.sh`만 사용하며, 설정은 `backend/.env`와 `frontend/.env`로 분리하고 각 디렉터리의 `.env.example`을 복사한다. 루트에는 환경 파일을 두지 않는다. Compose 치환에는 backend/.env 다음 frontend/.env를 읽으므로 프런트 파일에는 공개 VITE_ 값과 개발 프록시 설정만 둔다. backend/frontend의 package.json·Dockerfile, 루트 Compose, deploy/nginx 설정 위치와 하위 디렉터리의 npm 명령은 유지한다. 스크립트는 어느 디렉터리에서 호출해도 프로젝트 루트를 기준으로 동작한다. 통합 실행에는 Bash·Docker Engine·Compose, 개별 실행에는 Node.js 24가 필요하다.

| 설정 | 개발 | 운영 |
|---|---|---|
| COMPOSE_FILE | `compose.dev.yaml` | `compose.yaml:compose.prod.yaml` |
| NODE_ENV | `development` | `production` |
| DB_SYNCHRONIZE | `true` | `false` |
| 접속 | `http://localhost:8080` | 별도 도메인 HTTPS |
| 애플리케이션 | Nginx → Vite / NestJS watch | Nginx 정적 SPA → NestJS 빌드 결과 |

개발·운영 모두 DB는 별도로 구성하며 애플리케이션 서버는 웹·API와 첨부 저장을 담당한다. 운영 서버에서는 `backend/.env`의 위 항목과 URL·DB·비밀값·경로를 수정한다. `backend/.env`의 `COMPOSE_FILE`이 YAML 구성을 선택하고 `NODE_ENV`가 NestJS 실행 환경을 결정하므로 두 항목을 함께 변경한다. Compose 프로젝트 이름은 `new-cmms`로 고정한다. 환경을 바꾸기 전에 `./stop.sh`로 기존 컨테이너를 종료한다.

최초 개발 설정과 통합 실행:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# backend/.env의 외부 개발 DB 접속값·JWT·관리자 비밀번호를 채운다.
mkdir -p backend/uploads deploy/db-certs
sudo chown 1000:1000 backend/uploads
./start.sh config --quiet
./start.sh
./start.sh run --rm --no-deps backend npm run bootstrap:admin
curl --fail http://localhost:8080/api/health
```

`./start.sh`는 기본적으로 `up -d --build --remove-orphans`로 백그라운드 실행한다. `./start.sh logs -f`로 로그를 보고 `./stop.sh`로 컨테이너·네트워크를 제거한다. 첨부 호스트 경로와 외부 DB는 유지된다. 포그라운드 실행은 `./start.sh up --build`, 상태 확인은 `./start.sh ps`다.

개발 Compose는 호스트 소스·설정 파일을 읽기 전용 mount하고 NestJS watch와 Vite HMR(WebSocket)을 Nginx로 연결한다. 파일 변경은 polling으로 감지한다. 소스 변경은 자동 반영되며 package.json·lockfile·Dockerfile 변경 시에는 `./start.sh`로 이미지를 재빌드한다. Nginx 설정 변경 시 `./start.sh restart nginx`를 실행한다. 프런트는 같은 origin의 `/api`를 사용하며 NestJS와 Vite 포트는 호스트에 공개하지 않는다.

Docker 없이 개별 실행하려면 별도 터미널에서 아래 명령을 실행한다. 기존 npm 명령을 그대로 사용하며 NestJS·관리자 bootstrap은 backend/.env, Vite는 frontend/.env를 읽는다. 루트 환경 파일은 사용하지 않는다.

```bash
# 터미널 1 (backend 디렉터리)
cd backend
npm ci
npm run start:dev

# 터미널 2 (프로젝트 루트에서 시작)
cd frontend
npm ci
npm run dev
```

개별 개발 접속은 `http://localhost:5173`이며 Vite가 `/api`를 frontend/.env의 `API_PROXY_TARGET`(기본 http://127.0.0.1:3000)으로 프록시한다. backend의 PORT를 바꾸면 이 대상 포트도 맞춘다. 각 터미널의 Ctrl+C로 종료한다. `stop.sh`는 Docker 컨테이너만 종료한다. 운영 백엔드 개별 실행은 backend에서 `npm run build` 후 `npm run start:prod`, 프런트는 frontend에서 `npm run build` 후 빌드 결과를 Nginx로 제공한다.

## 2. 환경과 호스트 경로

`backend/.env.example`을 `backend/.env`로 복사해 실제 값으로 채운다. 운영 URL·DB 접속값·비밀값은 빈 설정 또는 주석 예시로 제공한다. 운영 도메인의 DNS를 서버에 연결하고 해당 도메인의 인증서를 준비한다. 환경 파일·인증서·업로드·백업은 Git에 저장하지 않는다. 프런트에는 `VITE_` 접두사가 붙은 공개 설정만 전달하며 DB 접속값·JWT 비밀키는 전달하지 않는다.

| 설정 | 운영 기준 |
|---|---|
| DB_HOST/PORT/USER/PASSWORD/NAME | 고객 DB의 접속값, 애플리케이션 전용 계정 |
| DB_SSL / DB_SSL_REJECT_UNAUTHORIZED | 외부 DB는 true / true, 필요 시 공급자 CA 사용 |
| DB_SYNCHRONIZE / DB_LOGGING | false / false |
| JWT_ACCESS_SECRET | 고객별 별도 무작위 비밀값 |
| JWT_ACCESS_EXPIRES_IN | 기본 15m, 만료 시 재로그인 |
| CORS_ORIGINS | 실제 프런트 origin, 개별 개발은 localhost:5173도 포함 |
| frontend/.env의 VITE_API_BASE_URL | `/api`, 프런트 공개 설정 |
| FILE_LOCAL_ROOT | 개별 실행은 backend 기준 `./uploads`, Docker는 `/app/uploads`로 덮어씀 |
| COMPOSE_FILE / NODE_ENV | 위 표에 따라 개발·운영을 함께 변경 |
| CMMS_BIND_ADDRESS / CMMS_HTTP_PORT / CMMS_HTTPS_PORT | 운영은 공개 주소와 80/443 |
| UPLOADS_HOST_PATH | 업로드 영구 호스트 경로 |
| DB_CERTS_HOST_PATH / TLS_CERT_DIR | DB CA / HTTPS 인증서 경로 |
| FILE_MAX_SIZE_BYTES | 기본 10485760(10 MiB) |
| FILE_MAX_FILES_PER_UPLOAD | 기본 10 |
| FILE_MAX_UPLOAD_TOTAL_BYTES | 기본 52428800(50 MiB) |
| FILE_ALLOWED_MIME_TYPES | 허용 MIME 목록 |
| BOOTSTRAP_COMPANY_* / BOOTSTRAP_ADMIN_* | 최초 회사·관리자 생성 값 |

backend 컨테이너는 backend/.env를 읽는다. 운영 프런트 빌드는 frontend/.env의 공개 VITE_API_BASE_URL만 빌드 인자로 전달하며 프런트 이미지를 재빌드해야 환경 변경이 반영된다. 이 값은 빌드 캐시에도 반영된다. backend 환경 파일과 비밀값은 프런트 빌드에 전달하지 않는다.

운영 Compose는 NODE_ENV=production, PORT=3000, API_PREFIX=api, FILE_STORAGE_DRIVER=local, FILE_LOCAL_ROOT=/app/uploads를 지정한다. 프런트 빌드는 frontend/.env의 VITE_API_BASE_URL(기본 /api)을 사용한다.

Supabase는 프로젝트 Connect 화면의 Direct 또는 네트워크에 맞는 Session pooler 접속값을 사용한다. IPv4/IPv6·허용 IP·방화벽·DB TLS를 확인한다. CA가 필요하면 DB 인증서 폴더에 넣고 NODE_EXTRA_CA_CERTS=/app/certs/db-ca.crt를 지정한다.

호스트 경로를 먼저 만들고 uploads의 쓰기 권한을 backend 사용자 UID/GID 1000에 부여한다. 인증서는 nginx가 읽을 수 있어야 하며 개인키는 관리자만 변경하도록 관리한다.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
mkdir -p backend/uploads deploy/db-certs deploy/tls backups
sudo chown 1000:1000 backend/uploads
# backend/.env의 운영 항목(COMPOSE_FILE·NODE_ENV·DB_SYNCHRONIZE·주소·포트)을 바꾸고 인증서를 배치한다.
./start.sh config --quiet
./start.sh build
```

## 3. DB 스키마와 관리자

개발 DB의 스키마는 Entity를 기준으로 synchronize로 생성·갱신한다. 개발용 자동 동기화 대상은 개발 전용 DB로 제한한다. 운영 상시 실행은 DB_SYNCHRONIZE=false이며 운영에서 true를 설정하면 시작을 거부한다.

최초 빈 DB의 일회성 초기화는 컨테이너만 development로 실행한다. 이후 운영 컨테이너에는 이 값을 유지하지 않는다.

```bash
./start.sh run --rm --no-deps -e NODE_ENV=development -e DB_SYNCHRONIZE=true backend node dist/bootstrap/bootstrap-admin.js
./start.sh
./start.sh ps
curl --fail https://cmms.example.com/api/health
```

- bootstrap은 지정 회사·관리 소속·관리자 역할/사용자, 실제 Controller 권한과 재고 유형을 초기화한다. 일반 회사 생성 API는 없다.
- 비밀번호는 최초 생성 시 설정한다. 기존 비밀번호 변경은 BOOTSTRAP_ADMIN_FORCE_PASSWORD=true를 명시한 경우에만 한다.
- 여러 회사가 같은 DB를 쓰면 각 회사의 bootstrap을 별도 설정으로 실행한다. Permission 정의는 같은 DB 전체 공용이며 역할 배정은 회사별이다.
- 모든 업무 Entity와 number_sequence/document_request, board/board_comment, 첨부·재고 집계 테이블을 준비한다. 별도 migration 파일이나 DB 명세 문서는 두지 않는다.
- health 성공은 DB 접속 확인이다. 관리자·테이블·권한과 업무 흐름도 직접 확인한다.

## 4. HTTPS 운영

`deploy/tls/fullchain.pem`, `deploy/tls/privkey.pem`을 준비하고 `backend/.env`의 공개 주소·80/443·CORS origin을 실제 도메인에 맞춘다. 인증서 디렉터리는 읽기 전용 mount한다. 원격 일반 HTTP에서는 브라우저 UUID 생성 기능이 제한될 수 있으므로 운영은 HTTPS를 사용한다.

```bash
./start.sh config --quiet
./start.sh
./start.sh exec nginx nginx -t
curl --fail https://cmms.example.com/api/health
```

루트 스크립트는 `backend/.env`의 `COMPOSE_FILE=compose.yaml:compose.prod.yaml` 설정으로 운영 YAML 두 개를 선택한다. HTTP는 HTTPS로 이동하고 API는 같은 origin의 /api로 전달한다. 인증서 발급·갱신은 운영자가 관리하며 교체 후 nginx -t와 nginx -s reload를 실행한다.

## 5. 업로드·업데이트·백업

- 파일은 호스트 업로드 디렉터리의 companyId/refModule/attachmentId/UUID.확장자 아래에 저장한다. DB에는 상대 경로·원본명·MIME·크기·checksum을 기록한다.
- Nginx에 업로드를 mount하지 않으며 /uploads 직접 접근은 404다. 파일은 JWT 첨부 API로만 내려받는다.
- Nginx 요청 제한은 60 MiB다. 앱 한도를 바꾸면 프록시 제한도 함께 검토한다. 파일 삭제는 즉시 반영하며 고아 파일의 자동 정리는 없다.
- 업데이트 전 DB와 파일을 백업하고 같은 호스트 bind 경로를 유지한다. 환경 변경은 restart만 하지 말고 up -d로 컨테이너를 재생성한다.
- 일관된 백업은 쓰기를 중지한 뒤 외부 DB 백업과 업로드를 같은 시점에 확보한다. 서버 외부에도 사본을 둔다. DB 백업만으로 첨부 파일을 복구할 수 없다.

```bash
./start.sh stop nginx backend
./start.sh run --rm --no-deps -T --entrypoint tar backend -C /app/uploads -czf - . > backups/uploads.tar.gz
# 중지 구간에 DB 공급자의 백업/내보내기도 완료한다.
./start.sh up -d
```

복구는 검증 환경에서 먼저 시험한다. 서비스를 멈추고 대응하는 DB와 파일을 함께 복원한 뒤 uploads의 UID/GID·권한, health·로그인·기존 첨부·수불을 확인한다. 정상적인 컨테이너 교체는 외부 DB와 호스트 업로드를 삭제하지 않는다.

## 6. 운영 확인과 장애 대응

| 확인·증상 | 점검 |
|---|---|
| 시작 실패 / health 503 | DB 접속·TLS CA·환경변수·운영 synchronize=false |
| Nginx 대기 / 502 | backend health·Docker 네트워크·인증서·로그 |
| 로그인 / 새로고침 | 올바른 회사, 사용자 복원, 원래 URL 유지 |
| 401 / 403 | 만료는 재로그인, 권한 거부는 역할 배정 확인 |
| 업로드 EACCES / 413 | uploads UID/GID 1000·호스트 권한 / 프록시·앱 용량 제한 |
| 첨부 다운로드 실패 | 인증 회사·그룹, 파일 bind 경로, DB/파일 백업 시점 |
| 결재 후 원본 불일치 | 결재·원본 번호와 sync 로그 확인, 앞선 결재 결과 보존 |
| 재마감 차단 | 전월 정상 마감·누락 월·summaryDirty 확인 |
| 생성 요청이 계속 처리 중 | 실행 중이 아닌지 확인 후 해당 document_request.processing 해제, 같은 요청 키로 재시도 |

설치 후 다른 회사 자료 접근 거부, BORD 채번과 작성자 규칙, 구매요청 병합·전량입고, 이동 중 입고, 월 Lock·해제·재생성, 컨테이너 교체 후 파일 지속성을 확인한다. 완전한 고객 격리에는 고객별 DB·비밀키·파일 경계도 필요하다.

## 7. 로컬 개발과 검사

Node.js 24를 사용한다. backend와 frontend 각각의 `.env.example`을 기준으로 각자의 `.env`를 구성하며 실제 비밀값은 커밋하지 않는다.

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend test -- --runInBand
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix frontend test
npm --prefix backend run lint
npm --prefix frontend run lint
```

SQL·HTTP 테스트는 임시 PGlite DB와 로컬 포트를 사용한다. 프런트 test는 빌드된 SPA를 Chromium으로 검증하며 API는 테스트 fixture다. Chromium 실행 경로는 CHROME_PATH로 지정하고 기본값은 /opt/google/chrome/chrome이다. 실제 사용 DB를 변경하지 않는다. Docker 이미지 기동·TLS·실제 DB 잠금 경합·백업 복구는 별도 배포 검증 대상이다.
