# new-cmms

회사별 설비·보전·구매·재고 및 전자결재·게시판 관리 시스템입니다.

문서는 다음 세 가지로 관리합니다.

- [제품 명세](docs/prod_spec.md): 업무 범위·정책·메뉴·처리 절차
- [기술 명세](docs/tech_spec.md): 모듈·인증·상수·문서 접근·데이터·첨부·재고 구조와 현행 Entity 필드
- [설치·운영 가이드](docs/install_guide.md): 외부 DB와 Docker Nginx/NestJS 설치·백업·복구

DB는 별도 PostgreSQL(현재 Supabase), 애플리케이션은 Docker의 Nginx/NestJS, 업로드는 애플리케이션 서버의 영구 디렉터리로 구성합니다. 최초 설치는 설치 가이드부터 확인하십시오.

환경 설정은 `.env.example` → `.env`(Docker), `backend/.env.example` → `backend/.env`(NestJS), `frontend/.env.example` → `frontend/.env`(Vite)로 각각 복사합니다. 기존 환경파일이 있으면 덮어쓰지 않습니다. 루트 `.env`에는 포트·호스트 경로 등 Docker 설정만 두고 DB·JWT는 backend에, 공개 API 주소는 frontend에 둡니다.

프로젝트 루트에서 `docker compose up -d --build`로 실행하고 `docker compose down`으로 종료합니다. 로그는 `docker compose logs -f`입니다. 기존 `./start.sh`, `./stop.sh`도 같은 Compose를 실행하는 단축 명령으로 사용할 수 있습니다.

`compose.yaml` 하나로 개발·테스트·운영의 NestJS와 Nginx 정적 SPA를 실행하고 외부 PostgreSQL을 사용합니다. `backend/.env`에서 개발은 `NODE_ENV=development`, `DB_SYNCHRONIZE=true`(필요 시 false), 배포는 `NODE_ENV=production`, `DB_SYNCHRONIZE=false`로 설정합니다. 개발 외 모드에서 동기화를 켜면 시작을 거부합니다. 초기 설정은 `./bootstrap.sh schema`(빈 public 설치), `./bootstrap.sh admin`(회사·관리자 정보를 대화형 입력하여 생성/갱신)으로 별도 실행합니다. `./start.sh`는 서비스만 시작합니다. 환경파일을 변경하면 `docker compose up -d --force-recreate`로 반영합니다. 소스 변경 자동 반영은 없으며 수정 후 다시 `docker compose up -d --build`를 실행합니다. 개발 기본 서비스는 HTTP 80(`http://localhost`)이며 인증서 없이 실행합니다. 운영 전환 시 환경파일에서 https.conf를 선택하고 인증서·개인키를 준비한 뒤 Compose의 주석 처리된 443 매핑을 활성화합니다. 전환 후 80은 HTTPS 이동용으로 유지하거나 닫을 수 있습니다. 상세 절차는 설치 가이드를 따릅니다.

Docker 없이 개별 개발할 때는 backend에서 `npm run start:dev`, frontend에서 `npm run dev`를 실행하며 각각 자기 디렉터리의 `.env`만 읽습니다. 개별 개발 접속은 `http://localhost:5173`입니다.
