# CMMS 설치·운영 가이드

업무 기준은 [제품 명세](prod_spec.md), 구성과 저장 계약은 [기술 명세](tech_spec.md)를 따른다.

## 1. 배포 구성

- 애플리케이션 서버: Docker Engine·Compose, Nginx+NestJS 컨테이너, 업로드 영구 디렉터리.
- DB 서버: 외부 PostgreSQL. Supabase 사용 시 PostgreSQL 접속 정보만 필요하다. Supabase Auth·Storage는 사용하지 않는다.
- 운영 접근: HTTPS 도메인과 신뢰할 수 있는 인증서. NestJS는 외부에 포트를 직접 공개하지 않는다.
- 고객별 배포: 별도 DB/DB 계정·JWT 비밀키·업로드·인증서·백업 경로와 Compose 프로젝트를 사용한다. 회사코드는 해당 DB 안에서 업무 자료를 구분한다.

## 2. 환경과 호스트 경로

루트 `.env.docker.example`을 `.env`로 복사하고 실제 값으로 채운다. 환경 파일·인증서·업로드·백업은 Git에 저장하지 않는다. 프런트에는 DB 접속값이나 JWT 비밀키를 전달하지 않는다.

| 설정 | 운영 기준 |
|---|---|
| DB_HOST/PORT/USER/PASSWORD/NAME | 고객 DB의 접속값, 애플리케이션 전용 계정 |
| DB_SSL / DB_SSL_REJECT_UNAUTHORIZED | 외부 DB는 true / true, 필요 시 공급자 CA 사용 |
| DB_SYNCHRONIZE / DB_LOGGING | false / false |
| JWT_ACCESS_SECRET | 고객별 별도 무작위 비밀값 |
| JWT_ACCESS_EXPIRES_IN | 기본 15m, 만료 시 재로그인 |
| CORS_ORIGINS | 실제 프런트 origin |
| CMMS_BIND_ADDRESS / HTTP_PORT / HTTPS_PORT | 운영은 공개 주소와 80/443 |
| UPLOADS_HOST_PATH | 업로드 영구 호스트 경로 |
| DB_CERTS_HOST_PATH / TLS_CERT_DIR | DB CA / HTTPS 인증서 경로 |
| FILE_MAX_SIZE_BYTES | 기본 10485760(10 MiB) |
| FILE_MAX_FILES_PER_UPLOAD | 기본 10 |
| FILE_MAX_UPLOAD_TOTAL_BYTES | 기본 52428800(50 MiB) |
| FILE_ALLOWED_MIME_TYPES | 허용 MIME 목록 |
| BOOTSTRAP_COMPANY_* / BOOTSTRAP_ADMIN_* | 최초 회사·관리자 생성 값 |

Compose는 NODE_ENV=production, PORT=3000, API_PREFIX=api, FILE_STORAGE_DRIVER=local, FILE_LOCAL_ROOT=/app/uploads를 지정한다. 프런트 빌드는 VITE_API_BASE_URL=/api를 사용한다.

Supabase는 프로젝트 Connect 화면의 Direct 또는 네트워크에 맞는 Session pooler 접속값을 사용한다. IPv4/IPv6·허용 IP·방화벽·DB TLS를 확인한다. CA가 필요하면 DB 인증서 폴더에 넣고 NODE_EXTRA_CA_CERTS=/app/certs/db-ca.crt를 지정한다.

호스트 경로를 먼저 만들고 uploads의 쓰기 권한을 backend 사용자 UID/GID 1000에 부여한다. 인증서는 nginx가 읽을 수 있어야 하며 개인키는 관리자만 변경하도록 관리한다.

```bash
cp .env.docker.example .env
mkdir -p data/uploads deploy/db-certs deploy/tls backups
sudo chown 1000:1000 data/uploads
docker compose config --quiet
docker compose build
```

## 3. DB 스키마와 관리자

새 개발 DB의 초기 스키마는 Entity를 기준으로 생성한다. 이미 데이터가 있는 DB에서는 백업·스키마 영향 검토 없이 synchronize를 실행하지 않는다. 운영 상시 실행은 DB_SYNCHRONIZE=false이며 운영에서 true를 설정하면 시작을 거부한다.

최초 빈 DB의 일회성 초기화는 컨테이너만 development로 실행한다. 이후 운영 컨테이너에는 이 값을 유지하지 않는다.

```bash
docker compose run --rm --no-deps -e NODE_ENV=development -e DB_SYNCHRONIZE=true backend node dist/bootstrap/bootstrap-admin.js
docker compose up -d
docker compose ps
curl --fail http://localhost:8080/api/health
```

- bootstrap은 지정 회사·관리 소속·관리자 역할/사용자, 실제 Controller 권한과 재고 유형을 초기화한다. 일반 회사 생성 API는 없다.
- 비밀번호는 최초 생성 시 설정한다. 기존 비밀번호 변경은 BOOTSTRAP_ADMIN_FORCE_PASSWORD=true를 명시한 경우에만 한다.
- 여러 회사가 같은 DB를 쓰면 각 회사의 bootstrap을 별도 설정으로 실행한다. Permission 정의는 같은 DB 전체 공용이며 역할 배정은 회사별이다.
- 모든 업무 Entity와 number_sequence/document_request, board/board_comment, 첨부·재고 집계 테이블을 준비한다. 별도 migration 파일이나 DB 명세 문서는 두지 않는다.
- health 성공은 DB 접속 확인이다. 관리자·테이블·권한과 업무 흐름도 직접 확인한다.

## 4. HTTPS 운영

`deploy/tls/fullchain.pem`, `deploy/tls/privkey.pem`을 준비하고 `.env`의 공개 주소·80/443·CORS origin을 실제 도메인에 맞춘다. 인증서 디렉터리는 읽기 전용 mount한다. 원격 일반 HTTP에서는 브라우저 UUID 생성 기능이 제한될 수 있으므로 운영은 HTTPS를 사용한다.

```bash
docker compose -f compose.yaml -f compose.prod.yaml config --quiet
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
docker compose -f compose.yaml -f compose.prod.yaml exec nginx nginx -t
curl --fail https://cmms.example.com/api/health
```

운영 명령은 두 Compose 파일을 함께 지정한다. HTTP는 HTTPS로 이동하고 API는 같은 origin의 /api로 전달한다. 인증서 발급·갱신은 운영자가 관리하며 교체 후 nginx -t와 nginx -s reload를 실행한다.

## 5. 업로드·업데이트·백업

- 파일은 호스트 업로드 디렉터리의 companyId/refModule/attachmentId/UUID.확장자 아래에 저장한다. DB에는 상대 경로·원본명·MIME·크기·checksum을 기록한다.
- Nginx에 업로드를 mount하지 않으며 /uploads 직접 접근은 404다. 파일은 JWT 첨부 API로만 내려받는다.
- Nginx 요청 제한은 60 MiB다. 앱 한도를 바꾸면 프록시 제한도 함께 검토한다. 파일 삭제는 즉시 반영하며 고아 파일의 자동 정리는 없다.
- 업데이트 전 DB와 파일을 백업하고 같은 호스트 bind 경로를 유지한다. 환경 변경은 restart만 하지 말고 up -d로 컨테이너를 재생성한다.
- 일관된 백업은 쓰기를 중지한 뒤 외부 DB 백업과 업로드를 같은 시점에 확보한다. 서버 외부에도 사본을 둔다. DB 백업만으로 첨부 파일을 복구할 수 없다.

```bash
docker compose -f compose.yaml -f compose.prod.yaml stop nginx backend
docker compose -f compose.yaml -f compose.prod.yaml run --rm --no-deps --entrypoint tar backend -C /app/uploads -czf - . > backups/uploads.tar.gz
# 중지 구간에 DB 공급자의 백업/내보내기도 완료한다.
docker compose -f compose.yaml -f compose.prod.yaml up -d
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

Node.js 24를 사용한다. backend/.env.example과 frontend/.env.example을 기준으로 개발 환경을 구성하며 실제 비밀값은 커밋하지 않는다.

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
