# CMMS 기술 명세

현재 코드의 구조·저장 계약·검사 책임을 정의한다. 업무 규칙은 [제품 명세](prod_spec.md), 배포 절차는 [설치 가이드](install_guide.md)를 따른다. 저장 구조의 기준은 Entity와 DTO이며 별도 DB 명세는 두지 않는다.

## 1. 구성

브라우저 React SPA → Nginx → NestJS → 외부 PostgreSQL 구조다. Nginx는 Vite 정적 빌드와 `/api` 프록시를 제공하고 NestJS는 서버 업로드 디렉터리를 사용한다. DB 컨테이너와 브라우저 직접 DB 연결은 없다.

| 경로 | 책임 |
|---|---|
| frontend/src/main.tsx, app, layout | Router·AuthProvider·보호 경로·메뉴 |
| frontend/src/modules | 업무 화면·API·출력·결재 본문 생성 |
| frontend/src/shared | HTTP·토큰·공통 입력·인쇄·계산 |
| backend/src/auth | 로그인·현재 사용자·Passport JWT·권한 Guard |
| backend/src/identity, organization, codes | 사용자·역할·권한·조직·공통코드 |
| backend/src/maintenance | 설비·PM·작업의뢰·WO·허가요청·허가 |
| backend/src/purchase, inventory | 구매·벤더·자재·재고·월 마감 |
| backend/src/approvals, attachments, boards | 결재·로컬 파일·게시글/댓글 |
| backend/src/numbering | 문서번호·생성 요청 재시도·첨부 연결 |
| backend/src/bootstrap | 회사·관리자·실제 Controller 권한 초기화 |
| compose*.yaml, deploy/nginx | 외부 DB 연결·TLS·업로드 지속성·프록시 |

Controller는 인증·RBAC·DTO 경계, Service는 회사·scope·owner·상태·업무 조건을 담당한다. 프런트 Context와 버튼 숨김은 서버 접근 검사를 대체하지 않는다.

## 2. 인증과 Context

1. 로그인은 회사+사용자로 활성 User를 조회하고 bcrypt 비밀번호를 비교한다.
2. HS256 JWT에 sub와 companyId를 담고 만료시각을 부여한다. 비밀번호·권한 목록은 토큰에 넣지 않는다.
3. JwtAuthGuard는 Passport의 jwt 전략을 호출한다. 전략은 Bearer 토큰의 알고리즘·서명·만료와 필수 클레임 형식을 확인한다.
4. AuthService가 검증된 회사+사용자로 활성 사용자를 다시 읽고 현재 role/site/department/scope와 회사별 role_permission으로 UserContext를 구성한다.
5. CurrentUser는 이 서버 Context를 전달한다. body/query의 회사·작성자·권한을 인증 주체로 사용하지 않는다.

- DTO는 whitelist/forbidNonWhitelisted/transform을 적용한다. 데이터 식별자와 선택한 업무 요청자는 인증 사용자와 구분한다.
- React는 index.html→main.tsx→BrowserRouter/AuthProvider→RequireAuth→AppLayout 순으로 시작한다. useAuth는 useContext를 사용하고 업무 폼은 화면별 useState로 관리한다.
- localStorage에는 access token만 저장한다. 사용자·권한은 로그인 또는 `/auth/me` 응답을 메모리에 보관하며 JWT를 브라우저에서 해석해 권한으로 사용하지 않는다.
- 최초 복원 중에는 업무 화면을 가리고, 재인증 후 원래 경로·검색·해시로 이동한다. 통신 장애는 토큰을 보존하며 재시도를 제공한다.
- 현재 토큰의 401은 토큰·Context를 해제하고 403은 세션을 유지한다. 이전 토큰의 늦은 401과 오래된 `/me` 응답은 새 세션을 덮어쓰지 않는다.
- storage 이벤트와 focus/visibility 복귀 시 사용자 정보를 갱신한다. 회사/사용자가 바뀌면 Outlet을 다시 생성하고 같은 사용자의 재조회는 입력 화면을 유지한다.
- Refresh/서버 Logout API와 서버 토큰 폐기 목록은 없다. 브라우저 로그아웃은 저장 토큰과 Context 정리다. 탈취 토큰은 사용자 삭제 또는 만료 전까지 유효할 수 있다.

## 3. 회사 격리와 배포 경계

| 데이터 | 격리 기준 |
|---|---|
| 업무·조직·사용자·역할·코드 항목 | 인증 companyId가 PK와 조회/변경 조건에 포함 |
| 첨부 | 인증 회사+첨부 그룹 확인, 파일 경로에 회사 포함 |
| 결재 | 회사+상신자/결재선 참여자, 참조는 C만 조회 |
| 게시판 | 같은 회사 조회, 게시글/댓글별 createdBy 검사 |
| 권한 배정 | companyId+roleId+permissionId |
| Permission 정의 | permissionId를 키로 사용하는 DB 공용 시스템 카탈로그 |

- 일반 업무는 회사에 더해 applyDocumentScope가 소속 범위를 적용한다. OWN_DEPARTMENT의 재귀 조회도 회사 조건을 유지한다. PM·마스터·회사 단위 보고와 참여자 기반 결재는 각각의 조회 정책을 사용한다.
- Permission 관리 API는 공용 카탈로그를 변경한다. 같은 DB 안에서 이 정의까지 회사별로 독립된 구조는 아니다. 역할·권한 배정 변경은 해당 회사에만 적용한다.
- 현재 단일 DataSource와 DB를 사용하며 PostgreSQL RLS나 고객별 DB 라우팅은 적용하지 않는다. 회사 조건은 애플리케이션에서 강제하고 DB 관리자 접근까지 격리하는 보장은 아니다.
- 고객별 DB 배포는 고객별 백엔드·DB 계정·JWT 비밀키·업로드 루트·백업을 분리하는 방식이 현재 구조와 맞는다. DB가 달라도 JWT 비밀키를 공유하면 동일 회사/사용자 ID 토큰을 재사용할 위험이 있다.
- 한 백엔드에서 여러 고객 DB를 동적으로 선택하려면 신뢰할 수 있는 고객 식별→토큰 검증→DB 연결 선택을 별도로 구현해야 한다. 요청 body의 companyId를 DB 접속 대상으로 사용하지 않는다.

## 4. 모듈과 권한

MODULES는 backend/src/common/constants/modules.ts에 key/name/rbac/documentPrefix를 정의한다. AppModuleKey는 여기서 파생한다. 지원 CRUD는 Controller 선언이 기준이며 true라고 모든 동작을 자동 허용하지 않는다.

- approval·attachment·board는 rbac=false다. Controller는 JWT를 적용하며 CRUD RequirePermission을 선언하지 않는다.
- 일반 Controller는 JwtAuthGuard와 PermissionsGuard, 동작별 RequirePermission을 사용한다. 메타데이터가 없는 요청을 PermissionsGuard가 자동 차단하지는 않는다.
- bootstrap은 등록된 Controller의 실제 권한 선언을 수집한다. 회사는 read/update, 재고 보고는 read, 월 마감은 read/update 등 제공 동작만 생성한다.
- Permission은 시스템 정의, Role/RolePermission은 회사별 배정이다. 기준정보 삭제는 기존 사용자 연결값을 자동 변경하지 않는다. 권한 회수는 배정 또는 사용자 정보를 변경한다.

## 5. 식별자와 요청 계약

| 업무 | prefix | 헤더 ID |
|---|---|---|
| PM / 작업의뢰 / WO | PMAINT / WRKREQ / WRKORD | pmId / workRequestId / workOrderId |
| 허가요청 / 허가 | PERREQ / PERMIT | workPermitRequestId / workPermitId |
| 구매요청 / 발주 | PURREQ / PURORD | requestId / orderId |
| 재고전표 / 결재 / 게시판 | INVDOC / APPROV / BORD | inventoryDocumentId / approvalId / boardId |

- 형식은 prefix-YYYYMM-00001, 범위는 회사+모듈+한국 시간 발급월이다. 발급 후 ID는 불변이며 월 99999건을 넘으면 오류다. documentNo는 별도 선택 입력 관리번호다.
- NumberSequence는 회사/약어/연월/lastSerial을 저장한다. 같은 범위의 pg_advisory_xact_lock을 획득한 transaction manager에서 조회·증가한다.
- 생성 POST의 Idempotency-Key는 브라우저가 한 번 생성한 UUID다. DocumentRequest는 회사/모듈/요청 키와 요청자·문서 ID를 보존한다. 서버가 발급한 ID를 사용하며 이후 편집은 해당 ID의 PATCH다.
- processing은 같은 요청의 동시 실행, completed는 전체 생성 완료를 구분한다. 일반 오류에서는 선점을 해제한다. 서버 강제 종료로 남은 processing은 실행 중이 아님을 확인한 관리자가 해제한다. 다른 요청에 번호를 재사용하지 않는다.
- 결재 부분 생성 재시도는 D 문서의 결재선·상신을 재개한다. 이미 진행한 결재 결과를 되돌리지 않는다.
- 첨부·파일명·품목·배분·댓글은 내부 UUID다. 마스터는 사용자 관리 코드, 창고는 회사+사업장+창고 복합 키다.
- 날짜는 YYYYMMDD, 허가 기간은 YYYYMMDD:HH, 감사 시각은 timestamptz다. AuditEntity와 deleteYn은 별도로 정의한다.

## 6. 조직과 공통코드

- Code 그룹은 backend common/constants/code.ts와 프런트 shared/constants/code.ts에서 정의한다. 코드 값의 종류는 같고 표시명은 프런트가 제공한다.
- CodeItem(code_item)의 PK는 companyId/codeId/codeItemId이며 name·sortOrder를 저장한다. Code 엔티티는 없다. 항목 삭제는 실제 삭제다. 업무 코드 검증도 회사 조건을 사용한다.
- 사업장·부서·역할은 활성 선택 목록을 제공하며 저장 시 별도 존재 검증은 하지 않는다. 부서는 사업장과 독립적이고 자기 참조만 서버에서 거부한다.
- 회사 정보는 인증 회사의 조회·수정만 제공한다. 사용자 응답에는 passwordHash를 포함하지 않는다.

## 7. 업무 저장 구조

| 영역 | 주요 Entity·구조 |
|---|---|
| 설비·PM | Equipment, PreventiveMaintenance(점검 상세 JSONB) |
| 작업의뢰·WO | WorkRequest, WorkOrder(공수·자재·비용 JSONB) |
| 허가 | WorkPermitRequest, WorkPermit(data·sections·필수서류 연결 JSONB) |
| 구매 | PurchaseRequest/PurchaseRequestItem, PurchaseOrder/PurchaseOrderItem, PurchaseOrderAllocation, Vendor |
| 결재 | Approval(Tiptap JSONB), ApprovalStep |
| 게시판 | Board, BoardComment |
| 첨부 | Attachment, AttachmentItem |

- 설비 계층은 회사·사업장·활성 부모·순환을 검사한다. PM 완료 시 PM 날짜를 설비에 직접 반영하며 법정점검 값은 변경하지 않는다.
- WO의 PLAN은 C 작업의뢰, ACTUAL은 계획 WO를 선택 참조한다. refModule/refId는 쌍으로 저장한다. 금액·시간 합계는 서버 계산이다.
- 허가요청은 신청 API로 C 처리하고, 허가는 GENERAL+선택 유형의 템플릿·발급자/승인자·실제 필수 첨부를 검증한다. 출력은 permitPrint.ts에서 유형별 A4 페이지를 생성한다.
- 구매요청은 수량만, 발주는 가격을 저장한다. 병합 sourceItems는 C 요청 전체를 읽고 allocation에 원 품목별 수량을 보존한다. 원본 선택은 회사·문서 범위를 적용한다.
- 결재 본문은 type=doc인 Tiptap JSON만 허용한다. 결재 원본은 SOURCE_DOCUMENTS에 등록된 모듈만 허용한다. 결재와 합의의 미처리 최소 순번을 검사하며 참조는 처리 순번에서 제외한다.
- 원본 첨부는 원본 화면에서 관리하고 연계 결재에서 조회한다. 결재 결과 저장→원본 동기화는 순차 처리하며 실패를 로그와 오류 응답으로 알린다.
- 게시글·댓글에는 상태 필드가 없다. 각각 owner를 검사하고 부모 행 잠금 아래 댓글 등록/변경·원문 삭제를 처리한다. 활성 댓글이 있으면 삭제를 거부한다.

## 8. 재고·금액·월 마감

| Entity / 테이블 | 단위·역할 |
|---|---|
| InventoryDocument / inventory_document | 재고전표 헤더·postingDate·확정순번 |
| InventoryItem / inventory_item | 수량·가격·원본 품목·snapshot |
| InventoryTypeRule / inventory_type_rule | 회사별 유형 코드→실행 유형 |
| InventoryControl / inventory_control | 회사별 확정 카운터 |
| InventoryPeriodLock / inventory_period_lock | 회사/월 Open·Lock·재생성 필요 여부 |
| StockBalance / stock_balance | 회사/사업장/창고/자재 수량 |
| StockValuation / stock_valuation | 회사/사업장/자재 수량·금액·평균단가 |
| StockLedger / stock_ledger | 전표/품목/처리 leg별 수불 이력 |
| StockInTransit / stock_in_transit | 출고 품목별 이동 중 수량·금액·연결 입고 |
| MonthlyStockBalance / monthly_stock_balance | 월별 창고 수량 수불 |
| MonthlyStockValuation / monthly_stock_valuation | 월별 사업장 수량·금액 수불 |
| MonthlyStockInTransit / monthly_stock_in_transit | 월별 이동 중 수량·금액 수불 |

- 수량·금액은 PostgreSQL numeric과 BigInt 정수 환산으로 계산한다. 구매/재고 수량 소수 6자리·단가 8자리·금액 KRW 정수 반올림이며 WO는 수량/공수 4자리·단가 2자리다.
- inventory:<companyId>의 트랜잭션 advisory lock 아래 확정·Open·마감·해제를 직렬화한다. 재고 내부의 잔고·평가·수불은 하나의 트랜잭션으로 처리한다.
- postingDate→회사 확정순번→품목 순서로 확정 이력을 재생한다. 확정순번은 문서 월별 번호와 별개이며 월 초기화하지 않는다. 소급 posting은 이후 평가도 다시 계산한다.
- PURCHASE_IN은 C 발주, SITE_IN은 도착 범위의 미입고 SITE_OUT만 선택한다. 전체 품목·수량·가격을 검증하고 중복/부분 입고를 차단한다. referenceNo에는 원 시스템 ID를 기록한다.
- TRANSFER는 같은 사업장 창고 간 수량 이동이다. SITE_OUT/SITE_IN은 이동 중 금액을 보존한다. 음수재고는 거부한다.
- 월 마감은 전월 기말을 기초로 결과를 저장하고 Lock하며 최초 월 기초는 0이다. Open/해제/소급 확정은 해당 월 이후 summaryDirty를 표시하며 순서대로 재마감한다.

## 9. 첨부와 파일 경계

- 첫 첨부는 UUID 그룹과 refModule, refId=null로 만든다. null 그룹을 다른 신규 문서와 공유하지 않고 attachmentId로 재사용한다.
- 문서 저장 경계는 같은 회사·모듈·기존 연결을 검사한다. 헤더 저장 후 그룹의 refId를 연결하며 같은 문서 재시도는 허용하고 다른 문서 재연결은 거부한다. 연결 실패가 앞선 문서 저장을 롤백하지 않는다.
- refModule은 MODULES에 등록된 키만 받는다. 파일 경로는 companyId/refModule/attachmentId/UUID.확장자이며 로컬 저장소는 절대경로·상위 경로·루트 밖 접근을 거부한다.
- 파일을 메모리 버퍼로 수신한 뒤 개수·크기·합계·허용 MIME을 검사한다. 파일 저장 후 DB 메타데이터를 기록하며 고아 파일을 허용한다. 내용 기반 MIME 판별은 하지 않는다.
- 다운로드·삭제는 회사+그룹+상세를 확인한다. 별도 첨부 owner/CRUD RBAC는 적용하지 않는다. 부모 문서의 disabled는 UI 추가·삭제 제어이며 독립 첨부 API의 owner 권한 검사를 뜻하지 않는다.
- Nginx는 uploads를 공개하지 않는다. 첨부 상세 삭제는 실제 파일을 지우고 빈 헤더는 유지한다.

## 10. 런타임·검증

- Node.js 24, npm ci, NestJS/TypeORM/PostgreSQL, React/Vite를 사용한다. Docker는 backend+nginx이며 파일은 UID/GID 1000의 호스트 디렉터리에 bind mount한다.
- Nginx는 /api prefix를 유지하고 SPA 경로는 index.html로 복원한다. API no-store, 해시 자산 immutable, index no-cache이며 본문 제한은 60 MiB다.
- /api/health는 SELECT 1의 성공/503만 제공한다. 스키마·관리자 준비나 전체 업무 정상성을 보장하는 검사는 아니다.
- 환경변수는 env.schema.ts와 .env 예시가 기준이다. 운영 DB_SYNCHRONIZE=true는 거부한다. JWT_ACCESS_SECRET/EXPIRES_IN과 local 업로드 설정을 사용한다.
- PostgreSQL 전용 잠금·재귀 조회·JSONB 사용을 허용한다. 잠금은 transaction manager와 일관된 순서로 적용하고 사용자 편집 대기 동안 유지하지 않는다.
- 빌드·lint·Jest를 기본 검사로 사용한다. SQL/HTTP 테스트는 독립 PGlite DB, 브라우저 테스트는 빌드된 SPA와 API fixture를 사용하며 실제 사용 DB를 변경하지 않는다. 다중 PostgreSQL 세션 잠금 경합과 실제 Docker/TLS/백업 복구는 배포 환경에서 검증한다.
