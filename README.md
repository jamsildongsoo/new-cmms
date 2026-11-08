# new-cmms

회사별 설비·보전·구매·재고 및 전자결재·게시판 관리 시스템입니다.

문서는 다음 세 가지로 관리합니다.

- [제품 명세](docs/prod_spec.md): 업무 범위·정책·메뉴·처리 절차
- [기술 명세](docs/tech_spec.md): 모듈·인증·데이터·첨부·재고·배포 구조
- [설치·운영 가이드](docs/install_guide.md): 외부 DB와 Docker Nginx/NestJS 설치·백업·복구

DB는 별도 PostgreSQL(현재 Supabase), 애플리케이션은 Docker의 Nginx/NestJS, 업로드는 애플리케이션 서버의 영구 디렉터리로 구성합니다. 최초 설치는 설치 가이드부터 확인하십시오.
