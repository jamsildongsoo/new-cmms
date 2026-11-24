# CMMS 설치·운영 가이드

고객당 호스트 1대를 사용한다. 한 고객 산하 회사는 같은 PostgreSQL DB에서 `companyId`로 구분한다. 외부에는 Nginx의 HTTP 80만 공개한다. NestJS 3000은 Docker 내부 네트워크에서만 사용하고, PostgreSQL 5432는 같은 호스트의 DB 클라이언트용으로 `127.0.0.1:5432`에만 바인딩한다.

## 1. 서버 경로와 이미지

운영 서버의 기준 경로는 `/srv/new-cmms`이다.

```text
/srv/new-cmms/
├── compose.yaml
├── .env
├── nginx/
│   ├── default.conf
│   └── app-locations.conf
├── postgres/init/01-create-app-user.sh
├── data/
│   ├── postgres/
│   └── uploads/
└── images.tar                  # 프런트엔드·백엔드 이미지, 적재 후 필요에 따라 보관
```

`images.tar`는 **프런트엔드·백엔드 두 이미지만 담은 전달 파일**이다. PostgreSQL 이미지는 설치 서버에서 `docker compose pull postgres`로 받으므로 서버에서 이미지 저장소에 접속할 수 있어야 한다. `docker load`·`docker compose pull` 후 이미지는 Docker가 `/var/lib/docker` 또는 설치 버전에 따라 `/var/lib/containerd`에서 관리한다. `/srv/new-cmms`에는 이미지 자체나 프런트엔드·백엔드 소스 디렉터리를 설치하지 않는다. `data/postgres`와 `data/uploads`는 컨테이너를 교체해도 유지하는 고객 데이터이다.

Docker Engine과 Compose를 설치하고 Docker 서비스를 부팅 시 시작하도록 설정한다. Docker 권한이 있는 계정으로 아래 명령을 실행한다. Docker 그룹은 호스트 관리자 수준의 권한을 갖는다.

```bash
sudo systemctl enable --now docker
docker version
docker compose version
```

## 2. 개발 PC에서 배포 파일 만들기

소스가 있는 개발 PC의 프로젝트 루트에서 실행한다. 앱 이미지만 빌드·묶으며 개발 PC에서 PostgreSQL 이미지를 미리 받을 필요는 없다. 새 설치의 PostgreSQL 이미지 태그는 `postgres:18.7`이다. **기존 DB를 이전한다면 기존 PostgreSQL 메이저 버전과 데이터 경로를 먼저 확인**한다. 운영 중 이미지를 `latest`로 자동 교체하지 않는다.

```bash
./scripts/package-release.sh /tmp/new-cmms-release-1.0.0 1.0.0
```

출력 폴더에는 `images.tar`, `compose.yaml`, `nginx/`, `postgres/init/`, `.env.example`, 이 설치 가이드가 포함된다. 실제 `.env`, DB 파일, 첨부파일은 포함되지 않는다. 빌드 PC와 고객 서버의 CPU 아키텍처가 다르면 고객 서버용 플랫폼으로 이미지를 빌드해야 한다. 전송 방법의 한 예시는 다음과 같다.

```bash
scp -r /tmp/new-cmms-release-1.0.0/. 운영자@고객서버:/srv/new-cmms/
```

`/srv/new-cmms` 경로를 먼저 만들고 해당 운영자가 쓸 수 있게 준비한다. 파일 전송 수단은 고객 환경에 맞게 변경할 수 있다. `images.tar`가 크면 전송 전에 용량과 저장 공간을 확인한다.

## 3. 고객 서버 최초 설치 순서

**빈 DB에 처음 설치할 때만** 다음 순서로 실행한다. 기존 DB를 옮겨 쓰는 서버에는 6번의 `InitialSchema`를 그대로 실행하지 않는다.

```bash
cd /srv/new-cmms

# 1. 앱 이미지를 Docker 저장소에 등록
docker load -i images.tar

# 2. 고객 서버의 설정을 작성한다. .env는 Git·이미지·배포 묶음에 넣지 않는다.
cp -n .env.example .env
chmod 600 .env
# .env에서 DB_PASSWORD(cmms), POSTGRES_PASSWORD(postgres), JWT_ACCESS_SECRET, CORS_ORIGINS,
# CMMS_BIND_ADDRESS, 앱 이미지 버전, CMMS_POSTGRES_IMAGE=postgres:18.7, NODE_ENV=production,
# DB_SYNCHRONIZE=false를 확인한다.

# 3. 고객 데이터 디렉터리 준비
mkdir -p data/postgres data/uploads
sudo chown 1000:1000 data/uploads

# 4. Compose 설정 확인 및 PostgreSQL 18.7 이미지 다운로드
docker compose config --quiet
docker compose pull postgres

# 5. PostgreSQL 최초 기동
docker compose up -d --wait postgres

# 6. 검토·배포된 migration으로 업무 테이블 생성
docker compose run --rm --no-deps backend npm run migration:run

# 7. 회사와 첫 화면 관리자 생성. 대화형 터미널에서 입력
docker compose run --rm --no-deps -e DB_SYNCHRONIZE=false backend npm run init:admin

# 8. 전체 서비스 시작 및 확인
docker compose up -d --wait
docker compose ps
curl --fail http://127.0.0.1/api/health
```

외부 IP로 직접 접속하려면 `.env`의 `CMMS_BIND_ADDRESS=0.0.0.0` 또는 해당 서버 IP를 지정하고 호스트 방화벽에서 80을 허용한다. `CORS_ORIGINS`도 실제 접속 주소의 origin(`http://IP` 또는 `http://도메인`)으로 설정한다. `127.0.0.1`은 서버 내부 접속만 허용한다.

첫 PostgreSQL 기동은 `postgres` 슈퍼유저와 DB를 만들고 `postgres/init/01-create-app-user.sh`가 비슈퍼유저 `cmms`를 만든다. 루트 `.env`의 `POSTGRES_PASSWORD`는 `postgres`, `DB_PASSWORD`는 `cmms`에 사용하며 두 항목 모두 필수다. 같은 값을 쓰려면 각각 같은 값을 입력한다. 기존 `data/postgres`가 있으면 초기화 스크립트는 다시 실행되지 않는다. `.env` 변경만으로 기존 DB 계정의 비밀번호가 바뀌지도 않는다.

`init:admin`은 **회사 코드, 관리자 사용자 ID, 비밀번호**만 입력받는다. 회사가 새로 만들어질 때 임시 회사명은 회사 코드이고, 사용자 이름은 ID이다. 로그인 후 회사 관리 화면에서 회사명을 수정한다. 같은 호스트에서 다른 회사 코드를 입력해 다시 실행하면 그 `companyId`에 별도 관리자를 만들 수 있다. 이미 존재하는 회사명은 덮어쓰지 않으며, 같은 회사에 동일한 사용자 ID가 있으면 명령이 실패한다. 비밀번호는 `.env`나 명령 인자에 저장하지 않는다. 로그인에는 회사 코드·사용자 ID·비밀번호를 사용한다.

초기 관리자는 회사 전체 조회 범위로 생성하며 사업장·부서는 지정하지 않는다. 일반 사용자는 사용자 관리 화면에서 사업장·부서를 모두 선택해야 한다. 기존 DB에 migration을 적용하면 초기 관리자의 `ADMIN` 소속을 비우고, 다른 데이터가 참조하지 않는 `Administration` 임시 사업장·부서만 목록에서 숨긴다.

## 4. 실행과 설정

`compose.yaml`과 루트 `.env`가 고객별 배포 설정이다. 루트 `.env`의 변수는 Compose 파일에서 명시적으로 연결한 서비스에만 전달된다. Nginx의 요청 처리 규칙은 `nginx/*.conf`에 둔다. 프런트엔드는 동일 출처의 `/api`를 사용하며 운영용 `frontend/.env` 파일을 요구하지 않는다.

```bash
docker compose up -d             # 기동·설정 변경 반영
docker compose ps                # 상태
docker compose logs -f           # 로그
docker compose stop              # 일시 정지
docker compose start             # 정지한 컨테이너 시작
docker compose down              # 컨테이너와 네트워크 제거, bind 데이터는 보존
```

`DB_SYNCHRONIZE=true`는 `NODE_ENV=development`인 개발 전용 DB에서만 허용한다. 운영은 `NODE_ENV=production`, `DB_SYNCHRONIZE=false`를 유지한다. 운영의 스키마 변경은 새 버전의 migration을 **서비스 업데이트 전에 명시적으로** 실행한다. `docker compose up -d`는 migration이나 관리자 생성을 자동 실행하지 않는다. 기존 서버에 새 배포본을 적용할 때도 실제 `.env`는 보존하고 `CMMS_POSTGRES_IMAGE=postgres:18.7`을 직접 확인한다. 새 `images.tar`를 적재한 뒤 PostgreSQL 이미지는 서버에서 받는다.

```bash
docker load -i images.tar
docker compose pull postgres
docker compose run --rm --no-deps backend npm run migration:show
docker compose run --rm --no-deps backend npm run migration:run
docker compose up -d --wait
```

`data-source.ts`는 TypeORM CLI의 DB 연결·Entity·migration 목록을 정의한다. 빈 DB의 `InitialSchema` 파일은 개발 단계에서 TypeORM이 Entity와 빈 DB를 비교해 생성한 뒤 SQL을 검토해 이미지에 포함한다. **운영 서버에서 migration을 생성하지 않는다.** 실행 명령은 업무 객체가 있는데 migration 이력이 없으면 중단한다. 이미 예전 `schema-init.ts`로 만든 DB는 기존 스키마와 기준 migration을 비교하고 이력을 등록한 뒤 다음 migration부터 실행해야 한다.

## 5. 백업과 운영 유의사항

`data/postgres`의 실행 중 단순 파일 복사를 DB 백업으로 사용하지 않는다. PostgreSQL의 물리 전체 백업과 WAL 보관·증분 백업을 운영 정책에 맞게 구성하고, `data/uploads`도 같은 복구 시점에 맞춰 별도 백업한다. 외부 백업 서버에서 작업을 예약할 수 있으며, 복원 시험으로 DB 데이터와 첨부를 함께 확인한다.

현재 외부 공개는 HTTP 80이다. 외부 로그인 정보는 전송 중 암호화되지 않는다. HTTPS를 도입할 때는 Nginx 또는 앞단 장비의 TLS 설정을 별도로 추가한다. DB의 5432는 호스트의 `127.0.0.1`에만 바인딩하고 NestJS의 3000은 호스트에 바인딩하지 않는다. 같은 호스트의 DB 클라이언트에서는 `127.0.0.1:5432`로 접속한다.

관리자는 창고 삭제 전에 해당 회사·사업장·창고의 모든 자재 수량과 금액을 확인한다. 이어 같은 창고가 수령지인 W(수령 대기) 입고 전표를 처리한 후 삭제한다. 서버는 이 두 조건을 자동 검사하지 않으므로 담당자가 절차를 이행한다.

## 6. 개발과 검사

개발 소스에서 이미지를 빌드하려면 프로젝트 루트의 `.env`를 준비하고 다음을 실행한다. `frontend/.env`는 Docker 빌드에 포함되지 않으며 공개 API 기본값은 `/api`다. Docker 밖에서 NestJS를 직접 실행할 때는 루트 `.env`의 `DB_HOST`를 직접 접근 가능한 개발 DB로 지정해야 한다.

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
npm test --prefix backend -- --runInBand
npm run lint --prefix backend
npm run lint --prefix frontend
docker compose up -d --build
```

새 migration은 개발용 DB의 **직전 스키마**에 연결해 생성하고 SQL을 검토한다. `DB_SYNCHRONIZE=true`로 변경을 이미 반영한 DB에서는 차이가 없어 생성되지 않을 수 있다. 운영 이미지에는 컴파일된 `.js` migration과 실행에 필요한 운영 의존성만 포함한다.
