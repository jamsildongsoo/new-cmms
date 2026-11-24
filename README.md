# new-cmms

회사별 설비·보전·구매·재고 및 전자결재·게시판 관리 시스템입니다.

- [제품 명세](docs/prod_spec.md)
- [기술 명세](docs/tech_spec.md)
- [설치·운영 가이드](docs/install_guide.md)

고객당 호스트 1대에 Nginx, NestJS, PostgreSQL을 Docker Compose로 실행합니다. 고객 산하 회사는 같은 DB의 `companyId`로 구분합니다. 외부에는 HTTP 80만 공개하며 데이터와 첨부는 `/srv/new-cmms/data`에 보관합니다.

배포 환경값은 루트 `.env` 하나에 둡니다. 운영 서버에는 소스 없이 프런트엔드·백엔드 이미지와 `compose.yaml`, Nginx 설정, PostgreSQL 최초 계정 생성 스크립트를 전달합니다. 앱 이미지는 `docker load`로 등록하고 PostgreSQL 18.7 이미지는 서버에서 `docker compose pull postgres`로 받습니다.

빈 DB 최초 설치는 `docker compose pull postgres` → `docker compose up -d --wait postgres` → `docker compose run --rm --no-deps backend npm run migration:run` → `docker compose run --rm --no-deps -e DB_SYNCHRONIZE=false backend npm run init:admin` → `docker compose up -d --wait` 순서로 진행합니다. 기존 DB에는 최초 migration을 그대로 실행하지 않습니다. 자세한 경로와 명령은 설치 가이드를 따릅니다.
