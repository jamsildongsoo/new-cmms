# new-cmms

회사별 설비·보전·구매·재고 및 전자결재·게시판 관리 시스템입니다.

문서는 다음 세 가지로 관리합니다.

- [제품 명세](docs/prod_spec.md): 업무 범위·정책·메뉴·처리 절차
- [기술 명세](docs/tech_spec.md): 모듈·인증·데이터·첨부·재고·배포 구조
- [설치·운영 가이드](docs/install_guide.md): 외부 DB와 Docker Nginx/NestJS 설치·백업·복구

DB는 별도 PostgreSQL(현재 Supabase), 애플리케이션은 Docker의 Nginx/NestJS, 업로드는 애플리케이션 서버의 영구 디렉터리로 구성합니다. 최초 설치는 설치 가이드부터 확인하십시오.

환경 설정은 `backend/.env.example` → `backend/.env`, `frontend/.env.example` → `frontend/.env`로 각각 복사합니다. 루트에는 환경 파일을 두지 않습니다. 통합 실행은 `./start.sh`, 종료는 `./stop.sh`, 로그는 `./start.sh logs -f`입니다. 통합 실행의 개발·운영 YAML은 backend/.env의 COMPOSE_FILE로 선택합니다.

개별 개발은 backend에서 `npm run start:dev`, frontend에서 `npm run dev`를 실행하며 각각 자기 디렉터리의 `.env`를 읽습니다. 통합 개발은 `http://localhost:8080`, 개별 개발은 `http://localhost:5173`으로 접속합니다. 운영 전환 설정과 디렉터리 준비는 설치 가이드를 따릅니다.
