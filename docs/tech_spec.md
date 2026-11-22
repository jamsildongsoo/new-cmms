# CMMS 기술 명세

현재 코드의 구조·저장 계약·검사 책임을 정의한다. 기준일: 2026-11-18. 업무 규칙은 [제품 명세](prod_spec.md), 배포 절차는 [설치 가이드](install_guide.md)를 따른다. 저장 구조의 기준은 Entity와 DTO이며 현행 필드 목록은 이 문서 부록에 둔다. 별도 DB 명세 파일은 두지 않는다.

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
| backend/src/purchase, inventory | 구매·거래처·자재·재고·월 마감 |
| backend/src/approvals, attachments, boards | 결재·로컬 파일·게시글/댓글 |
| backend/src/numbering | 문서번호·저장·첨부 연결 |
| backend/src/bootstrap | 회사·관리자·실제 Controller 권한 초기화 |
| compose.yaml, deploy/nginx | 외부 DB 연결·TLS·업로드 지속성·프록시 |

Controller는 인증·RBAC·DTO 경계, Service는 회사·scope·owner·상태·업무 조건을 담당한다. 프런트 Context와 버튼 숨김은 서버 접근 검사를 대체하지 않는다.

구매는 `purchase-request`와 `purchase-order`가 각자의 Controller·Service·DTO·Entity를 소유한다. 요청 Item은 요청 내부에, 발주 Item은 발주 내부에 둔다. 발주 Service는 요청 Service로 완결 요청을 조회해 최초 복사 데이터를 제공하고, 발주·품목을 하나의 트랜잭션으로 저장한다. allocation 엔티티는 제거했다. `purchase/common`에는 공통 문서 필드와 검색 DTO만 둔다. 결재는 업무별 Service의 상신 검증·상태 반영을 호출하고, 재고의 구매입고 분기는 발주 Service로 원본을 조회한다.

재고는 transactions(전표·대기 수령·취소), stock(창고 잔고 증감·전표 기반 보고서), monthly-closing(월 잠금)으로 구성한다. 회사 advisory lock과 호출자의 EntityManager를 공유하며 전체 재생·파생 테이블 교체는 하지 않는다.

## 2. 인증과 Context

1. 로그인은 회사+사용자로 활성 User를 조회하고 bcrypt 비밀번호를 비교한다.
2. HS256 JWT에 sub와 companyId, tokenVersion을 담고 만료시각을 부여한다. 비밀번호·권한 목록은 토큰에 넣지 않는다.
3. JwtAuthGuard는 Passport의 jwt 전략을 호출한다. 전략은 Bearer 토큰의 알고리즘·서명·만료와 필수 클레임 형식을 확인한다.
4. AuthService가 검증된 회사+사용자로 활성 사용자를 다시 읽고 현재 role/site/department/scope와 회사별 role_permission으로 UserContext를 구성한다.
5. CurrentUser는 이 서버 Context를 전달한다. body/query의 회사·작성자·권한을 인증 주체로 사용하지 않는다.

- DTO는 whitelist/forbidNonWhitelisted/transform을 적용한다. 데이터 식별자와 선택한 업무 요청자는 인증 사용자와 구분한다.
- React는 index.html→main.tsx→BrowserRouter/AuthProvider→RequireAuth→AppLayout 순으로 시작한다. useAuth는 useContext를 사용하고 업무 폼은 화면별 useState로 관리한다.
- localStorage에는 access token만 저장한다. 사용자·권한은 로그인 또는 `/auth/me` 응답을 메모리에 보관하며 JWT를 브라우저에서 해석해 권한으로 사용하지 않는다.
- 최초 복원 중에는 업무 화면을 가리고, 재인증 후 원래 경로·검색·해시로 이동한다. 통신 장애는 토큰을 보존하며 재시도를 제공한다.
- 현재 토큰의 401은 토큰·Context를 해제하고 403은 세션을 유지한다. 이전 토큰의 늦은 401과 오래된 `/me` 응답은 새 세션을 덮어쓰지 않는다.
- storage 이벤트와 focus/visibility 복귀 시 사용자 정보를 갱신한다. 회사/사용자가 바뀌면 Outlet을 다시 생성하고 같은 사용자의 재조회는 입력 화면을 유지한다.
- Refresh/서버 Logout API와 서버 토큰 폐기 목록은 없다. 브라우저 로그아웃은 저장 토큰과 Context 정리다. 기존 토큰은 비밀번호 변경·관리자 비밀번호 재설정에 따른 tokenVersion 증가, 사용자 삭제 또는 만료로 무효화된다.

## 3. 회사 격리와 배포 경계

| 데이터 | 격리 기준 |
|---|---|
| 업무·조직·사용자·역할·코드 항목 | 인증 companyId가 PK와 조회/변경 조건에 포함 |
| 첨부 | 인증 회사+첨부 그룹 확인, 파일 경로에 회사 포함 |
| 결재 | 회사+상신자/결재선 참여자, 참조는 C만 조회 |
| 게시판 | 같은 회사 조회, 게시글/댓글별 createdBy 검사 |
| 권한 배정 | companyId+roleId+permissionId |
| 권한 정의 | 백엔드 MODULE_ACTIONS 상수, DB Permission 엔티티 없음 |

- 예방점검·작업의뢰·작업오더·허가요청·작업허가·구매요청·구매발주·재고전표는 각 서비스 내부에서 회사·삭제 여부·사업장/하위 부서 조건을 구성한다. 공통 applyDocumentScope는 사용하지 않는다. 마스터·회사 단위 보고·월마감·참여자 기반 결재·게시판은 기존 조회 정책을 유지한다.
- 권한 정의는 코드에서만 변경한다. GET /roles/permission-options는 상수 기반 배정 가능 권한과 moduleLabel을 반환한다. 역할 배정 변경은 해당 회사에만 적용하며 미지원 권한 입력은 거부한다. 매핑 교체는 역할 행 잠금과 트랜잭션으로 처리한다.
- 현재 단일 DataSource와 DB를 사용하며 PostgreSQL RLS나 고객별 DB 라우팅은 적용하지 않는다. 회사 조건은 애플리케이션에서 강제하고 DB 관리자 접근까지 격리하는 보장은 아니다.
- 고객별 DB 배포는 고객별 백엔드·DB 계정·JWT 비밀키·업로드 루트·백업을 분리하는 방식이 현재 구조와 맞는다. DB가 달라도 JWT 비밀키를 공유하면 동일 회사/사용자 ID 토큰을 재사용할 위험이 있다.
- 한 백엔드에서 여러 고객 DB를 동적으로 선택하려면 신뢰할 수 있는 고객 식별→토큰 검증→DB 연결 선택을 별도로 구현해야 한다. 요청 body의 companyId를 DB 접속 대상으로 사용하지 않는다.

## 공통 시스템 metadata

GET /api/system/metadata는 JWT 인증 사용자에게 모듈, 문서 상태, 코드 그룹, 수불 조합, 조회 범위, 권한 동작 및 결재선 유형의 코드·표시명을 제공한다. 모듈·코드 그룹의 영문 name은 유지하고 사용자 표시에는 label을 사용한다. 문서 상태 C의 공통 표시명은 ‘완결’이다. 사용자 보유 권한이나 회사별 DB 선택 목록은 포함하지 않는다.

프런트는 로그인 세션(회사+사용자) 단위 MetadataProvider에서 한 번 조회하고 Context로 공유한다. 복원·탭 포커스의 동일 사용자 인증 갱신과 화면 이동 때 다시 조회하지 않는다. 새 세션·페이지 새로고침은 다시 조회한다. 로딩 중 업무 화면을 기다리고 실패 시 재시도를 제공한다. 미등록 표시 코드는 원래 값을 표시한다. 코드 그룹 화면은 수신 목록으로 그룹을 선택·검사하고, 재고 수불 종류·상태·조회 범위 표시는 같은 응답을 재사용한다. 회사별 항목은 기존 업무 options API를 유지한다.

## 4. 모듈과 권한

MODULES는 backend/src/common/constants/modules.ts에 고정 모듈 코드와 전체 영문명·한글 표시명을 정의한다. ModuleCode는 여기서 파생하며 문서번호 접두사도 같은 코드를 사용한다. 프런트는 모듈·권한을 사용처에 직접 지정하고 백엔드 정의 경로를 주석으로 남긴다. 선택 목록·표시명은 metadata API에서 받으며 고정 코드 타입은 프런트에 직접 선언한다. 상세 대응표는 [코드·상수 관리 기준](#11-코드상수-관리-기준)을 참고한다.

- 권한은 WRKORD:read처럼 모듈 코드와 동작을 조합한다. 별도 rbac 플래그는 없다.
- 결재·첨부·게시판 Controller는 JWT를 적용하며 CRUD RequirePermission을 선언하지 않는다. 개별 업무 조건은 서비스에서 검사한다.
- bootstrap은 MODULE_ACTIONS의 지원 권한을 지정 회사 관리자 역할에 배정한다. 시작 시 Controller 조사나 Controller·상수 비교는 수행하지 않는다.
- MODULE_ACTIONS는 시스템 정의, Role/RolePermission은 회사별 배정이다. 기준정보 삭제는 기존 사용자 연결값을 자동 변경하지 않는다. 권한 회수는 배정 또는 사용자 정보를 변경한다.

## 5. 식별자와 요청 계약

| 업무 | prefix | 헤더 ID |
|---|---|---|
| PM / 작업의뢰 / WO | PMAINT / WRKREQ / WRKORD | pmId / workRequestId / workOrderId |
| 허가요청 / 허가 | PERREQ / PERMIT | workPermitRequestId / workPermitId |
| 구매요청 / 발주 | PURREQ / PURORD | requestId / orderId |
| 재고전표 / 결재 / 게시판 | INVDOC / APPROV / BORD | inventoryDocumentId / approvalId / boardId |

- 형식은 prefix-YYYYMM-00001, 범위는 회사+모듈+한국 시간 발급월이다. 발급 후 ID는 불변이며 월 99999건을 넘으면 오류다. documentNo는 별도 선택 입력 관리번호다.
- NumberSequence는 회사/약어/연월/lastSerial을 저장한다. 같은 범위의 pg_advisory_xact_lock을 획득한 transaction manager에서 조회·증가한다.
- 생성 POST는 요청 키 없이 매번 새 번호를 발급한다. DocumentRequest·Idempotency-Key는 사용하지 않는다. 저장 응답이 불확실하면 목록에서 확인하고, 저장된 문서의 편집은 해당 ID의 PATCH로 처리한다.
- 첨부·파일명·품목·배분·댓글은 내부 UUID다. 마스터는 사용자 관리 코드, 창고는 회사+사업장+창고 복합 키다.
- 날짜는 YYYYMMDD, 허가 기간은 YYYYMMDD:HH, 감사 시각은 timestamptz다. AuditEntity와 deleteYn은 별도로 정의한다.

## 6. 조직과 공통코드

- Code 그룹은 backend common/constants/code.ts에서 정의한다. 영문 name·한글 label을 유지하고 프런트 그룹 목록·표시명은 /system/metadata로 제공한다. 회사별 CodeItem은 기존 업무 options API에서 조회한다.
- CodeItem(code_item)의 PK는 companyId/codeId/codeItemId이며 name·sortOrder를 저장한다. Code 엔티티는 없다. 항목 삭제는 실제 삭제다. 업무 코드 검증도 회사 조건을 사용한다.
- 사업장·부서·역할은 활성 선택 목록을 제공하며 저장 시 별도 존재 검증은 하지 않는다. 부서는 사업장과 독립적이고 자기 참조만 서버에서 거부한다.
- 회사 정보는 인증 회사의 조회·수정만 제공한다. 사용자 응답에는 passwordHash를 포함하지 않는다.
- 조직관리 DTO의 문자열 최대 길이는 기존 DB 컬럼과 일치시킨다. 코드 30자·명칭 100자, 회사 사업자등록번호·전화번호 50자·담당자명 100자이며 text 비고에는 별도 길이 제한을 추가하지 않는다. 화면 입력 길이·너비는 이 한도 내에서 디자인에 맞춘다. 사업장·부서는 저장 응답의 정규화된 값으로 화면 상태와 상세 이동 경로를 설정한다.

## 7. 업무 저장 구조

| 영역 | 주요 Entity·구조 |
|---|---|
| 설비·PM | Equipment, PreventiveMaintenance(점검 상세 JSONB) |
| 작업의뢰·WO | WorkRequest, WorkOrder(공수·자재·비용 JSONB) |
| 허가 | WorkPermitRequest, WorkPermit(data·sections·필수서류 연결 JSONB) |
| 구매 | PurchaseRequest/PurchaseRequestItem, PurchaseOrder/PurchaseOrderItem, Vendor |
| 결재 | Approval(Tiptap JSONB), ApprovalStep |
| 게시판 | Board, BoardComment |
| 첨부 | Attachment, AttachmentItem |

- 설비 DTO의 varchar 길이는 DB 컬럼과 일치시키고 text 사양·비고에는 별도 길이 제한을 추가하지 않는다. 설비번호·설비명 부분검색은 %·_·역슬래시를 일반 문자로 처리한다. 목록은 서버 페이지네이션을 사용한다. 트리는 목록과 별도 API이지만 현재 사업장별 전체 활성 노드를 한 번에 조회하여 모두 펼쳐 표시하며, 최상위·하위 노드 지연 조회 방식은 아직 적용하지 않았다.
- 설비 계층은 회사·사업장·활성 부모·순환을 검사한다. PM 완료 시 PM 날짜를 설비에 직접 반영하며 법정점검 값은 변경하지 않는다.
- WO의 PLAN은 C 작업의뢰, ACTUAL은 완결(C)된 계획 WO를 선택 참조한다. refModule/refId는 쌍으로 저장한다. 금액·시간 합계는 서버 계산이다.
- 허가요청은 신청 API로 C 처리하고, 허가는 GENERAL+선택 유형의 템플릿·발급자/승인자·실제 필수 첨부를 검증한다. 출력은 permitPrint.ts에서 유형별 A4 페이지를 생성한다.
- 구매요청은 수량만, 발주는 가격을 저장한다. 발주 refModule=PURREQ/refId는 원 요청 한 건의 선택적 참조이며 단독 발주에서는 둘 다 null이다. POST /purchase-order/request-preview는 {requestId}를 받아 제목·납기·본문·비고·새 품목 ID가 부여된 품목 배열을 반환한다. 저장·상신에서 요청 품목·수량과 일치 여부를 검사하지 않는다. 품목 spec은 발주 입력값을 저장하며 자재·단위와 양수 수량·금액 등 기본 검증은 유지한다.
- GET /purchase-order/request/:requestId/orders는 회사·문서 범위 내 연결 발주의 번호·관리번호·제목·상태·작성일을 반환한다. 반려·취소 이력을 포함하며 중복 발주를 차단하지 않는다.
- 구매 목록은 PurchaseSearchDto(page/limit/search), {items,total,page,limit} 계약이다. 기본 20건·최대 100건, 문서번호·관리번호·제목 OR 검색, 특수문자 리터럴 처리, createdAt/문서 ID 내림차순을 적용한다. 구매요청의 listForReference는 발주 작성용 전체 완결 선택 목록이다. 입고용 발주 목록은 재고 서비스가 회사·입고 예정 사업장 기준으로 직접 조회한다. 프런트 purchase.types.ts·각 api.ts와 함께 수정한다.
- 결재 본문은 type=doc인 Tiptap JSON만 허용한다. 결재 원본은 SOURCE_DOCUMENTS에 등록된 모듈만 허용한다. 결재와 합의의 미처리 최소 순번을 검사하며 참조는 처리 순번에서 제외한다.
- 원본 첨부는 원본 화면에서 관리하고 연계 결재에서 조회한다. 결재 결과 저장→원본 동기화는 순차 처리하며 실패를 로그와 정상 저장 응답의 sourceSyncWarning으로 알린다. 결재 결과는 유지하며 화면은 반환된 결재 상태와 안내를 표시한다.
- 게시판 목록은 서버 검색·페이지네이션을 사용하고 boardId·title·createdBy·createdAt만 반환한다. 본문 검색은 유지하되 본문은 상세 API에서만 반환한다. 검색의 %·_·역슬래시는 결재와 동일하게 일반 문자로 처리한다. 프런트는 조회 중·실패 시 이전 목록을 숨기고 실패 시 이전 조회 결과를 비운다. 페이지 범위 자동 보정은 추가하지 않는다.
- 게시글·댓글에는 상태 필드가 없다. 각각 owner를 검사하고 부모 행 잠금 아래 댓글 등록/변경·원문 삭제를 처리한다. 활성 댓글이 있으면 삭제를 거부한다.

## 8. 재고·금액·월 마감

| Entity / 테이블 | 역할 |
|---|---|
| InventoryDocument / inventory_document | 헤더, W/C/X, 전기일, 확정순번, confirmedBy/At, 취소 이력 |
| InventoryItem / inventory_item | 원 수량·정수 단가·확정 금액·참조 품목 |
| InventoryControl / inventory_control | InventoryService가 관리하는 회사별 확정순번 카운터. 문서번호 채번과 별개 |
| InventoryPeriodLock / inventory_period_lock | 회사·월 Open/Lock |
| StockBalance / stock_balance | 회사·사업장·창고·자재별 수량·금액 |

- InventoryService는 회사 잠금→권한 범위·기간·원본 검증→품목 금액 계산→전표/품목/잔고 저장 순서로 처리한다. 타창고출고는 같은 트랜잭션에서 W 입고도 저장하며 채번은 공통 정책대로 저장 전에 확보한다.
- StockProcessingService.apply는 해당 창고·자재만 갱신한다. 출고단가는 floor(잔고금액×10^6/스케일 수량)로 계산한다. 출고금액은 round(정수 단가×스케일 출고수량/10^6)이다. BigInt 정수 연산을 사용하고 수량 6자리 내부 정밀도를 유지한다. 전량 출고에도 잔액 전액 차감 분기를 두지 않으며 단수 잔액은 보존한다. 창고·사업장 보고서의 평균단가도 원 미만 버림을 적용한다. 취소는 저장 증감을 반대로 반영하며 반복 자재 품목은 역순이다. 음수 수량·금액은 거부한다.
- 출고 계산 내역은 기존 inventory_item.note(품목 적요)에 사용자 입력 뒤 줄바꿈으로 덧붙인다. 재고 반영 전의 잔고금액·수량, 확정 단가, 수량 곱셈·원 단위 반올림 금액을 남긴다. 이동입고는 원 품목 적요를 복사하고 확정·취소 시 재계산하지 않는다.
- W 입고는 postingSequence/confirmedBy/confirmedAt=null이다. POST /inventory-document/:id/confirm {postingDate}는 수령 범위와 W 상태를 다시 확인하고 출고 전기일 이상·Open된 월에서 원 수량·금액을 그대로 반영한다. 확정 시 새 순번과 확정 감사정보를 기록한다.
- POST /inventory-document에는 read+create, confirm/cancel에는 read+update가 필요하다. 원문 조회는 사업장 범위를 따르고, 타 사업장 담당자는 자기 사업장 W 입고로 처리한다. 회사 내 수령 창고 지정은 출고 권한에 포함한다. 사용자별 창고 범위는 추가하지 않는다.
- GET /inventory-document/purchase-order/:id는 구매입고 전용 원문 API다. 제목·입고 사업장 siteId·전체 품목만 반환하며, 범용 reference/:module/:id와 별도 incoming API는 제거했다. 수령 대기는 일반 목록에서 type=IN/status=W로 조회한다.
- 구매입고 원본은 PURORD만 허용하고 COMPANY_ALL은 회사 전체, 나머지는 원본 toSiteId 기준으로 참조한다. 회사 잠금 안에서 같은 회사 유효 C 입고를 검사하므로 분할·중복 입고는 없다. 추가 유일 인덱스는 만들지 않는다.
- StockQueryService는 창고 현재고와 사업장 합계를 반환하고 수불은 C 헤더/품목에서 확정순번으로 조회한다. 기간 보고서는 전기일 기준 기초·증감·기말을 산출한다. ledger/valuation/transit/monthly 테이블의 Entity와 실행 의존성을 제거했다. 기존 DB 실물의 잔여 테이블 삭제는 별도 작업이다.
- 월 Open/Close는 잠금만 수행한다. summaryDirty·수불 재생성은 제거한다. 전월 마감 순서와 후속 마감월 소급 보호는 유지한다. 대기 입고는 월 마감을 막지 않는다.
- 수량 입력 2자리·DB 6자리, 단가·금액 정수, 내부 BigInt 계산을 유지한다. 조정은 signed quantity/amount이며 수량 0·금액 잔액을 허용한다. 표시 평균단가는 조회에서 계산하며 수량 0이면 null이다.
- 전환 대상 기존 재고 데이터가 없다는 전제로 자동 데이터 이관은 제공하지 않는다. 제거한 Entity의 기존 테이블은 자동 삭제한다고 가정하지 않는다.

## 9. 첨부와 파일 경계

- 첫 첨부는 UUID 그룹과 refModule, refId=null로 만든다. null 그룹을 다른 신규 문서와 공유하지 않고 attachmentId로 재사용한다.
- 문서 저장 경계는 같은 회사·모듈·기존 연결을 검사한다. 헤더 저장 후 그룹의 refId를 연결하며 같은 문서 재시도는 허용하고 다른 문서 재연결은 거부한다. 연결 실패가 앞선 문서 저장을 롤백하지 않는다.
- refModule은 MODULES에 등록된 키만 받는다. 파일 경로는 companyId/refModule/attachmentId/UUID.확장자이며 로컬 저장소는 절대경로·상위 경로·루트 밖 접근을 거부한다.
- 수신 단계에서 파일 크기·개수를 제한하고, 서비스에서 합계 용량·허용 MIME을 검사한다. 파일 저장 후 DB 메타데이터를 기록하며 고아 파일을 허용한다. 내용 기반 MIME 판별은 하지 않는다.
- 첨부 API는 JWT 인증 후 프런트의 첨부 키를 사용한다. 회사는 프런트 전송값과 관계없이 인증된 UserContext.companyId로 결정한다. 목록·업로드·다운로드·삭제에 회사+그룹을 확인하고, 개별 파일에는 항목 번호도 적용한다. 별도 첨부 owner/CRUD RBAC·원 호출 모듈 접근 권한 검사는 추가하지 않는다. 부모 문서의 disabled는 UI 추가·삭제 제어다.
- Nginx는 uploads를 공개하지 않는다. 첨부 상세 삭제는 실제 파일을 지우고 빈 헤더는 유지한다.

## 10. 런타임·검증

운영 배포는 Nginx와 NestJS를 **동일한 물리 서버의 별도 Docker 컨테이너**에서 실행하는 구성을 기준으로 한다. 브라우저의 운영 접속은 **HTTPS 443**을 사용하며, HTTPS 전환 후 HTTP 80 매핑을 유지한 경우 HTTPS로 리다이렉트하며, 필요하지 않으면 80 매핑을 닫는다. 화면·로그인·API·첨부 전송 모두 브라우저와 Nginx 사이에서 TLS로 보호한다.

```text
브라우저 ── HTTPS :443 ── Nginx ── HTTP backend:3000 ── NestJS
                         TLS 종료       동일 서버 Docker 내부망
```

Nginx가 TLS를 종료하고 `/api` 요청을 `http://backend:3000`으로 전달한다. 동일 물리 서버의 Docker 내부 통신을 전제로 이 구간에는 별도 TLS를 구성하지 않으며, NestJS 3000 포트는 호스트 외부에 공개하지 않는다. HTTPS 인증서와 개인키는 Nginx에서만 사용한다. 향후 Nginx와 NestJS를 서로 다른 서버로 분리할 경우 내부 구간의 TLS 정책을 다시 검토한다.

운영 적용에는 `CMMS_NGINX_CONFIG=./deploy/nginx/https.conf`, 실제 서비스 도메인에 유효한 인증서·개인키, 외부 접속 가능한 바인딩 주소 및 443 포트 허용이 필요하다. 현재 개발 기본 구성은 default.conf와 HTTP 80 매핑을 사용한다. 운영 HTTPS 전환에 사용할 https.conf 선택과 443 설정·매핑은 환경파일과 Compose에 주석으로 병기한다. NODE_ENV에 따라 HTTP/HTTPS를 자동 선택하지 않고 운영자가 명시적으로 전환한다. 인증서·개인키가 없으면 HTTPS Nginx는 시작할 수 없다.

- Node.js 24, npm ci, NestJS/TypeORM/PostgreSQL, React/Vite를 사용한다. Docker는 개발·테스트·운영 공통 compose.yaml에서 빌드된 backend+nginx 정적 SPA를 실행하고 소스 변경은 이미지 재빌드로 반영한다. 파일은 UID/GID 1000의 호스트 디렉터리에 bind mount한다. 루트 .env는 Compose의 프로젝트 이름·포트·호스트 경로·Nginx 설정 선택만 담당한다. NestJS·관리자 bootstrap은 backend/.env, Vite는 frontend/.env를 읽는다. Docker의 backend env_file은 backend/.env를 전달하며 프런트 빌드는 공개 설정만 담은 frontend/.env를 읽는다. 최종 프런트 이미지에는 정적 빌드 결과만 포함한다. 실행은 docker compose up -d --build, 종료는 docker compose down이며 start.sh / stop.sh도 단축 명령으로 유지한다. 개별 개발은 NestJS watch와 Vite를 사용하고 Vite는 /api를 NestJS로 프록시한다. 개발 DB는 synchronize=true, 운영 DB는 false이며 두 환경 모두 외부 DB를 사용한다.
- Nginx는 /api prefix를 유지하고 SPA 경로는 index.html로 복원한다. API no-store, 해시 자산 immutable, index no-cache이며 본문 제한은 60 MiB다.
- /api/health는 SELECT 1의 성공/503만 제공한다. 스키마·관리자 준비나 전체 업무 정상성을 보장하는 검사는 아니다.
- 환경변수는 env.schema.ts와 .env 예시가 기준이다. `NODE_ENV=development`와 `DB_SYNCHRONIZE=true`를 함께 설정한 경우에만 연결된 개발 DB 스키마를 자동 동기화한다. 개발에서도 false로 끌 수 있으며 기본값은 false다. 배포는 `NODE_ENV=production`, `DB_SYNCHRONIZE=false`를 사용한다. test는 자동 검사 전용이며 개발 외 모드에서 true이면 시작을 거부한다. JWT_ACCESS_SECRET/EXPIRES_IN과 local 업로드 설정을 사용한다.
- PostgreSQL 전용 잠금·재귀 조회·JSONB 사용을 허용한다. 잠금은 transaction manager와 일관된 순서로 적용하고 사용자 편집 대기 동안 유지하지 않는다.
- 빌드·lint·Jest를 기본 검사로 사용한다. SQL/HTTP 테스트는 독립 PGlite DB, 브라우저 테스트는 빌드된 SPA와 API fixture를 사용하며 실제 사용 DB를 변경하지 않는다. 다중 PostgreSQL 세션 잠금 경합과 실제 Docker/TLS/백업 복구는 배포 환경에서 검증한다.

## 11. 코드·상수 관리 기준

프런트와 백엔드는 독립 실행·빌드한다. 루트 shared 폴더나 공유 패키지는 추가하지 않는다. 실행 시 사용하는 공통 목록·표시명의 원본은 백엔드 상수이며 프런트는 /system/metadata 응답을 공유한다. 프런트 고정 코드 타입은 직접 선언하고, 화면의 모듈·권한 사용처에는 인라인 코드와 백엔드 원본 경로 주석을 둔다. 시스템 코드 변경 시 관련 API 계약·타입·사용처를 개발 단계에서 함께 수정한다. Controller·MODULE_ACTIONS 비교 조사는 추가하지 않는다.

| 백엔드 원본 | 프런트 사용 방식 |
| --- | --- |
| common/constants/modules.ts | metadata의 모듈 목록·표시명, 화면에는 인라인 모듈 코드·MODULE_PATHS |
| common/constants/code.ts | metadata의 코드 그룹 목록, 회사별 항목은 업무 options API |
| common/constants/document-status.ts | metadata의 상태 표시명, 프런트 DocumentStatus는 타입만 선언 |
| common/constants/permissions.ts | MODULE_ACTIONS에서 permission-options 생성, 화면 권한은 인라인 문자열 |
| identity/users/user.constant.ts | metadata의 조회 범위 선택·표시 목록 |
| inventory/inventory.constant.ts | metadata의 수불 조합, 프런트 수불 타입은 직접 선언 |
| approvals/approval.constant.ts | metadata의 결재선 유형 표시명, 프런트 유형·결과는 타입만 선언 |

위 경로는 각각 backend/src, frontend/src 기준이다. 모듈 코드는 URL과 별개이며 프런트 MODULE_PATHS가 기존 라우트와 연결한다. 권한은 `{모듈 코드}:{동작}` 형식이다. 메뉴는 모두 표시하며 프런트 권한은 업무 화면 조회·버튼 제어용이고 실제 요청은 백엔드 Controller/Guard가 검사한다. 별도 rbac 플래그는 없다. 삭제 여부는 Y/N을 그대로 사용한다.

### 모듈 코드

| 기존 식별값 | 고정 코드 | 전체 이름 | 표시명 |
| --- | --- | --- | --- |
| company | COMP | COMPANY | 회사 |
| site | SITE | SITE | 사업장 |
| department | DEPT | DEPARTMENT | 부서 |
| warehouse | WHSE | WAREHOUSE | 창고 |
| user | USER | USER | 사용자 |
| role | ROLE | ROLE | 역할 |
| login_history | LOGHIST | LOGIN_HISTORY | 로그인 이력 |
| code | CODE | CODE | 공통코드 |
| board | BORD | BOARD | 게시판 |
| attachment | ATTACH | ATTACHMENT | 첨부파일 |
| equipment | EQUIP | EQUIPMENT | 설비 |
| preventive_maintenance | PMAINT | PREVENTIVE_MAINTENANCE | 예방점검 |
| work_request | WRKREQ | WORK_REQUEST | 작업의뢰서 |
| work_order | WRKORD | WORK_ORDER | 작업오더 |
| work_permit_request | PERREQ | WORK_PERMIT_REQUEST | 허가요청서 |
| work_permit | PERMIT | WORK_PERMIT | 작업허가서 |
| material | MATL | MATERIAL | 자재 |
| vendor | VENDOR | VENDOR | 거래처 |
| purchase_request | PURREQ | PURCHASE_REQUEST | 구매요청서 |
| purchase_order | PURORD | PURCHASE_ORDER | 구매발주서 |
| inventory_document | INVDOC | INVENTORY_DOCUMENT | 재고처리 |
| stock_status | STOCK | STOCK_STATUS | 재고 현황 |
| stock_ledger | LEDGER | STOCK_LEDGER | 수불장 |
| monthly_closing | MCLOSE | MONTHLY_CLOSING | 월 마감 |
| approval | APPROV | APPROVAL | 결재문서 |

자동채번 여부는 각 업무 Controller가 createDocument를 호출하는지로 결정한다. 등록부에 플래그나 별도 대상 목록을 두지 않는다. 코드는 문서번호 접두사로도 사용한다. 기존 문서 모듈의 접두사는 유지된다.

### 코드 그룹

| 전체 이름 | 저장·조회 키 | 표시명 |
| --- | --- | --- |
| EQUIPMENT_TYPE | EQUIP_TYPE | 설비 유형 |
| PREVENTIVE_MAINTENANCE_TYPE | PMAINT_TYPE | 예방점검 유형 |
| WORK_ORDER_TYPE | WRKORD_TYPE | 작업 유형 |
| FAILURE_CAUSE_TYPE | FAILURE_CAUSE_TYPE | 고장 원인 유형 |
| WORK_PERMIT_TYPE | PERMIT_TYPE | 작업허가 유형 |
| MATERIAL_TYPE | MATL_TYPE | 자재 유형 |
| PURCHASE_REQUEST_TYPE | PURREQ_TYPE | 구매요청 유형 |
| PURCHASE_ORDER_TYPE | PURORD_TYPE | 구매발주 유형 |
| UNIT | UNIT | 단위 |

UNIT 내부 항목은 회사별 공통코드 관리에서 등록한다. 단위 환산은 하지 않는다. 자재 기본단위·작업 투입자재 단위·예방점검 상세 단위는 동일 UNIT 그룹을 조회한다. 구매·재고의 자재 단위는 기존처럼 자재 기본단위를 따른다. 이미 저장된 값이 선택 목록에 없으면 기존 값을 표시·보존한다.

PRIORITY는 프런트 work-request/priority.ts의 상·중·하 고정 참고값이다. 입력·목록·검색이 같은 옵션을 사용하고, 백엔드는 문자열 저장·검색만 하며 공통코드 목록 조회·허용값 검증을 하지 않는다. CURRENCY는 KRW 고정을 유지한다. 고장코드 그룹 재설계는 이번 변경에서 제외한다.

### 채번·저장

createDocument는 회사·모듈·한국시간 발급월별 순번을 확정하고 문서를 저장한 뒤 첨부를 연결한다. saveDocument는 전달받은 ID로 저장하며 채번하지 않는다. 채번 DB 잠금과 5자리 순번, 실패 번호 미재사용 정책은 유지한다.

DocumentRequest 엔티티·Idempotency-Key·프런트 요청 키·생성 복구 로직은 제거했다. 생성 POST는 매번 새 번호를 발급한다. 응답이 불확실하면 목록에서 저장 여부를 확인한다. 화면의 저장 중 버튼 비활성화는 유지한다.

## 12. 사용자 설정·로그인 이력·결재선 계약

### 사용자 설정

상단 사용자 메뉴에서 **내 정보 수정**, **비밀번호 변경**, **로그아웃**을 제공한다. 관리자 사용자 조회 권한 없이 본인 정보를 조회·수정할 수 있다.

본인 정보와 비밀번호 관리는 백엔드·프런트 모두 identity 모듈이 담당한다. auth는 로그인·JWT·권한 검사·로그인 이력과 인증 문맥을 반환하는 `GET /api/auth/me`를 담당한다. 기존 `/api/auth/profile`, `/api/auth/password` 경로는 사용자 API로 옮겼다. 비밀번호 정책은 서비스 코드에 유지하며 비밀번호 이력을 별도로 저장하지 않는다.

| API | 동작 |
| --- | --- |
| `GET /api/users/me/profile` | 로그인한 본인의 이름·회사·사업장·부서·직책·직위·역할·조회 범위·연락처 |
| `PATCH /api/users/me/profile` | 본인의 이메일·전화번호 수정. 빈 값은 null로 저장 |
| `PATCH /api/users/me/password` | 현재 비밀번호 확인 후 새 비밀번호 저장 |

사용자·회사 ID는 JWT로 결정한다. 프로필 수정에서 이름·소속·역할·권한·비밀번호·토큰 버전 등 추가 필드를 전송하면 거부한다. 비밀번호 해시와 토큰 버전은 프로필 응답에 포함하지 않는다.

새 비밀번호는 영문과 숫자를 포함한 10자 이상, UTF-8 기준 72바이트 이내이다. 현재 비밀번호 재사용은 거부한다. 변경 시 토큰 버전을 원자적으로 증가시켜 다른 기기를 포함한 기존 토큰을 무효화한다. 관리자 비밀번호 재설정도 같은 방식으로 기존 토큰을 무효화한다. 변경 성공 후 화면은 로그아웃하고 새 비밀번호로 재로그인을 안내한다. 토큰 버전이 없는 변경 전 JWT도 재로그인이 필요하다.

### 로그인 이력

- `GET /api/auth/login-history`: `LOGHIST:read` 권한을 가진 사용자만 자기 회사 이력을 조회한다.
- 관리자 메뉴 **사용자·권한관리 → 로그인 이력**에서 날짜·사용자 ID·성공/실패로 검색하고 페이지를 이동한다.
- API 필터: `from`, `to`, `userId`(정확히 일치), `result=success|failure`, `page`(1부터), `limit`(기본 20, 최대 100).
- 날짜만 주면 한국 시간 기준 시작일 00:00부터 종료일 23:59:59.999까지 조회한다.
- 이력에는 시각·회사·사용자·성공 여부·내부 실패 사유·IP·브라우저 정보만 저장한다. 비밀번호, 토큰, 전체 요청은 저장하지 않는다. 사용자 정보 재조회나 페이지 이동은 로그인 시도로 기록하지 않는다.
- `LOGIN_HISTORY_RETENTION_DAYS` 기본값은 90일이다. 시작 시와 매일 보관기간이 지난 이력을 삭제한다. 0은 자동 삭제를 비활성화한다.
- 직접 실행은 `TRUST_PROXY_HOPS=0`으로 전달 헤더를 신뢰하지 않는다. 현재 Compose는 외부로 직접 노출하지 않는 백엔드 앞의 Nginx 한 단계만 신뢰하도록 `1`로 지정한다. 프록시 경로가 바뀌면 이 설정도 경로에 맞춰 변경한다.

새 지원 권한은 MODULE_ACTIONS에 추가한다. 역할 화면에서 회사별 역할에 배정하거나 `npm run bootstrap:admin --prefix backend`로 대상 회사 관리자 역할을 갱신한다. bootstrap에서 비밀번호 재설정을 선택하지 않으면 기존 관리자 비밀번호는 유지한다.

### 결재 목록·원문 반영 실패

GET /api/approvals/boxes/:box는 ApprovalQueryDto의 page·limit·search·status를 받는다. 기본 20건·최대 100건으로 공통 페이지 계산을 사용하고 items·total·page·limit를 반환한다. 회사·삭제 여부·문서함 참여 조건과 검색은 페이지 제한 전에 DB에서 적용한다. 통합 검색은 문서번호·관리번호·제목·상신자 ID를 대상으로 하며 %·_는 일반 문자로 검색한다. 정렬은 작성일시와 결재번호 내림차순이다. EXISTS로 결재선 참여·현재 순번을 판단하여 문서 중복 집계를 방지한다. 목록은 approvalId·documentNo·title·submitterId·status·createdAt만 반환하고 본문·결재선은 상세에서 조회한다. 프런트는 검색·문서함 변경 시 1페이지로 이동한다. 목록 인쇄는 제공하지 않고 상세 인쇄는 유지한다.

결재 저장 후 원문 반영 실패는 결재를 되돌리지 않는다. 응답의 sourceSyncWarning에 “결재 처리는 완료되었으나 원문 상태 반영에 실패했습니다. 관리자에게 문의해 주세요.”를 넣고 화면은 결재 상태와 안내를 함께 표시한다. 회사·결재번호·원문·상태·오류 로그를 유지한다. 안내는 해당 처리 응답용이며 DB 오류 이력·재반영 버튼·시스템 복구 기능은 추가하지 않는다.

### 결재선

입력 순서가 `결재 A → 참조 C → 합의 B`여도 서버는 `결재 A(1) → 합의 B(2) → 참조 C(3)`로 정렬한다. 결재·합의끼리의 순서와 참조끼리의 순서는 유지한다. 상신자는 순번 0이다. 참조는 DB에 숫자로 저장하고 화면에만 `—`로 표시한다.

중복 사용자, 상신자 본인, 다른 회사·비활성 사용자를 거부한다. 상신할 때도 활성 사용자를 다시 검증하며 결재·합의가 하나 이상 있어야 한다. 작업허가의 발급자·승인자 입력값은 결재선과 무관하다. 결재·합의·참조는 상신 시 별도 입력하며 원문 제목·본문은 유지한다.

문서·결재선 변경을 트랜잭션으로 처리하고 회사·문서별 PostgreSQL advisory lock으로 상신·수정·승인·반려·취소·삭제 요청을 직렬화한다. 현재 차례의 담당자만 처리할 수 있다. 모든 결재·합의가 완료되면 승인 완료, 반려·부동의면 반려, 상신 취소면 취소로 종결한다. 참조자는 승인 완료 후 열람하며 승인·확인 동작을 요구하지 않는다.

연계 검증과 조회는 결재 트랜잭션의 DB 연결을 공유한다. 원문 상태 동기화는 결재 저장이 커밋된 뒤 수행한다. 같은 문서 잠금 아래 최신 결재 결과를 읽어 오래된 상태가 원문을 덮어쓰지 않게 한다. 원문 동기화 실패 시 결재 결과를 롤백하지 않고 기존 방식으로 오류를 기록한다. 원문 동기화 동안에는 같은 연결의 세션 잠금을 사용하고 완료·실패 시 해제한다. DB는 기존 설치 가이드와 같이 Direct 또는 Session pooler로 연결한다.

### 허가요청·작업허가 계약

목록은 SearchPermitDto의 page·limit·search를 사용한다. 기본 20건·최대 100건으로 회사·삭제·사업장/부서 범위 안에서 문서번호·관리번호·data.title만 부분 검색하고 %·_·역슬래시는 일반 문자로 처리한다. 설비번호는 직접 입력하는 참고값으로 검색에서 제외한다. 요약 응답은 시스템 문서번호·관리번호·작업명·신청인·상태만 반환한다. 상세 JSON·템플릿·첨부 연결 정보는 단건 조회에서 제공한다. 프런트는 검색·초기화 시 1페이지로 이동하고 목록 인쇄는 현재 페이지를 대상으로 한다.

발급자·승인자와 전자결재 참여자는 별도다. approvalDraft는 결재선을 자동 구성하지 않고, 결재 생성·수정은 사용자가 입력한 결재선을 보존한다. 작업허가 결재의 원문 제목·본문·첨부 연계는 유지한다. 출력은 연결 결재의 완결 여부를 확인하되 발급자·승인자와 결재자 수·이름을 일치시키지 않는다. 과거 사용자 이름은 회사 조건으로 조회하고 삭제 여부로 숨기지 않는다. 발급자·승인자·첨부 ID는 DB varchar 50자와 DTO를 맞춘다.

허가 유형 7개와 일반 필수 정책, 버전 1 기본 문구 템플릿은 유지한다. 항목 변경 시 permit-template.ts, dto/permit-data.dto.ts, permit-validation.ts, WorkPermitService.approvalDraft와 프런트 PermitPages.tsx·permitPrint.ts를 함께 수정한다. 동적 항목 설정 기능은 추가하지 않는다. 요청서 인쇄의 항목명은 permitDataLabels로 한글 표시한다.

### 작업의뢰·작업오더 목록·참조 계약

두 목록은 page·limit·search로 공통 서버 페이지네이션(기본 20건·최대 100건)을 사용한다. 회사·삭제·사업장/부서 범위 안에서 시스템 문서번호·관리번호·제목·설비번호를 OR 부분 검색하고 %·_·역슬래시는 일반 문자로 처리한다. 기존 상태·긴급도·기간·계획/실적 검색 필터는 제거하고 구분·상태·긴급도 등의 목록 표시는 유지한다. 문서번호와 관리번호는 각각 별도 열에 표시한다. 작성일시와 시스템 문서번호 내림차순으로 정렬하고 요약 응답에서 본문·비고·공수/자재/비용 배열을 제외한다. 작업오더 총비용은 조회한 페이지의 저장 상세에서 계산해 반환하며 합계를 별도 저장하지 않는다. 목록 인쇄는 현재 페이지를 대상으로 한다. 계획 선택·관련 문서 조회는 별도 API로 유지한다.

실적은 완결(C)된 계획만 참조한다. 서버 선택 목록·실적 생성·참조 변경·상신 시 검증과 프런트 복사에서 같은 기준을 적용한다. 계획 하나에 여러 실적, 원문 없는 단독 문서 작성은 유지한다. 작업의뢰 초기 문서 조회는 사용자 인증 정보 재조회와 분리하여 동일 문서의 미저장 입력을 덮어쓰지 않는다.

### 예방점검 입력·목록 계약

신규 점검일은 프런트에서 한국 날짜 기준 오늘로 제안하고 사용자가 변경할 수 있다. 저장 시 점검일은 필수이며 백엔드가 실제 날짜를 검사한다. 부분 수정은 점검일을 생략할 수 있으나 null·빈 값으로 지울 수 없고, 점검일이 없는 과거 문서는 상신을 차단한다. 기존 DB의 과거 날짜 값은 자동 보정하지 않는다. 설비번호·점검 유형 DTO는 기존 varchar 50자에 맞춘다.

예방점검 화면의 점검 주기·단위는 선택한 설비 마스터 값을 읽기 전용으로 표시하며 PM 입력·저장 필드로 추가하지 않는다. 고정 주기 단위는 기존 프런트 equipmentForm.ts의 일(DAY)·주(WEEK)·월(MONTH)·년(YEAR) 선택값을 사용하고 별도 상수 파일을 추가하지 않는다. 다음 점검일 제안·사용자 보정 및 완결 시 저장 날짜 반영 정책은 유지한다. 측정 항목의 UNIT 공통코드와 구분한다.

GET /api/preventive-maintenance는 page·limit·search로 서버 페이지네이션을 수행한다. 기본 20건·최대 100건이며 회사·삭제·사업장/부서 조건 뒤에 문서번호·관리번호·제목·설비번호 통합 검색을 적용한다. %·_·역슬래시는 일반 문자로 검색하고 작성일시·문서번호 내림차순으로 정렬한다. 상태·판정·점검일 검색 필터는 제공하지 않는다. items·total·page·limit를 반환하며 목록 요약에서 본문·점검 상세 JSON을 제외하고, 단건 조회는 기존 구조를 유지한다. 목록 인쇄는 현재 페이지를 대상으로 표시한다.

## 13. 업무 문서 조회 조건 관리

조회 정책은 해당 업무 서비스가 소유한다. 같은 모듈의 목록·단건·변경 대상 조회는 내부 조회 함수를 재사용하고, 검색·상태·ID 조건은 andWhere로 추가한다. 별도 공통 범위 함수나 범용 Repository를 두지 않는다. 트랜잭션에서 사용하던 EntityManager는 유지한다.

### 대상과 제외 범위

대상은 예방점검, 작업의뢰, 작업오더, 허가요청, 작업허가, 구매요청, 구매발주, 재고전표 8개다. 회사 전체/사업장/하위 부서 범위를 각 서비스 내부에서 판단한다. 관련 작업오더 조회도 작업의뢰 서비스 안에 명시한다.

설비·자재 등 마스터와 조직·사용자·권한·공통코드는 회사 기준으로 관리한다. 재고 보고서는 회사+허용 사업장 범위를 적용하고 월 잠금은 회사 단위다. 결재·게시판·첨부는 각 모듈의 참여자·작성자·회사 정책을 따른다. 모든 회사별 데이터는 인증된 companyId 조건을 필수로 사용한다. 공통 시스템 정의는 DB 대신 코드 상수에서 제공한다.

### 첨부의 회사 확인

첨부는 JWT 로그인 확인 후 프런트가 전달한 attachmentId와 itemNo를 사용한다. 별도의 첨부 업무 권한·작성자 권한·원 호출 모듈의 문서 접근 권한 검사는 추가하지 않는다. 원 호출 모듈 권한 연계는 후속 작업으로 두지 않는다.

회사 기준은 프런트 전송값과 관계없이 인증된 UserContext.companyId다. 생성 시 이 값을 저장하고, 목록·업로드·다운로드·삭제는 회사+첨부 키로 확인한다. 개별 파일은 회사+첨부 키+항목 번호로 조회한다. 다른 회사의 첨부 키로는 접근할 수 없다. 상세 기준은 backend/src/attachments/attachments.controller.ts와 attachments.service.ts에 유지한다.

### 입력과 감사 필드

회사별 선택 목록으로 제공한 부서·사용자 등은 저장 시 단순 존재 여부 재검증을 추가하지 않는다. 범위 제한 사용자가 선택한 문서 담당 부서가 허용된 하위 부서인지는 문서 접근 정책으로 판단한다.

선택 목록은 활성 항목을 제공한다. 다만 삭제된 소속이라도 로그인 사용자에게 남아 있는 값은 신규 화면의 기본값으로 유지한다. 기존 문서의 소속값도 유지하며, 목록에 없다는 이유로 초기화하거나 다른 값으로 교체하지 않는다. 이러한 값 보존과 문서 접근 범위 판정은 구분하고, 활성 부서 트리에 따른 기존 범위 정책은 변경하지 않는다.

감사 필드는 common/entities/audit.entity.ts의 공통 정의를 유지한다. createdBy/updatedBy는 백엔드 사용자 정보, createdAt/updatedAt은 DB·서버 시각으로 설정하며 프런트의 업무 입력값과 구분한다. 페이지네이션은 common/dto/pagination-query.dto.ts, paginated-response.dto.ts, common/utils/pagination.util.ts의 공통 구조와 계산을 유지한다. 날짜·수량 계산 유틸리티도 유지한다.

### 예방점검 계약 변경

backend/src/maintenance/preventive-maintenance와 frontend/src/modules/maintenance/preventive-maintenance는 API의 deptId/deptName을 함께 관리한다. 기존 inspectionDeptId/inspectionDeptName은 deptId/deptName으로 이름을 바꿨다. 별도 담당 부서를 중복 저장하지 않는다. 화면 표시명은 점검부서다.

siteId는 작성 시 로그인 사용자의 사업장을 저장하며 API 입력으로 변경하지 않는다. deptId는 선택한 점검부서를 저장하고 부서 범위에도 사용한다. 값이 생략되면 로그인 부서를 기본값으로 사용한다. 목록·상세·수정·삭제·상신 원문 검사는 문서 범위를 적용한다. 내부 결재 결과 동기화는 회사+문서 ID로 처리한다.

모든 모듈의 표시용 기준정보 조회도 회사 조건과 deleteYn=N을 적용한다. 삭제된 부서·사용자·거래처의 이름을 표시하기 위한 예외 조회나 기존 옵션 보완은 제공하지 않는다. 기존 ID와 문서 자체에 저장된 내용은 유지하며, 기준정보가 복구되면 일반 조회로 다시 이름을 표시한다. 부서 트리의 활성 노드 기준은 기존 정책을 유지한다.

## 14. 코드 정리와 테스트 구성

공통화 기준: constants에는 수량 2자리·단가 정수 등 기준값만 두고, common/utils에는 날짜·숫자 변환과 검증·페이지 처리만 둔다. Date·Intl·BigInt, 기존 class-validator/class-transformer·TypeORM을 우선 사용하며 새 라이브러리를 추가하지 않는다. common/utils/decimal.util.ts는 숫자 문자열과 배율 적용 정수 변환·자릿수 검사·나눗셈 반올림을 제공한다. 입력 자릿수와 DB·내부 계산 정밀도는 구분한다. 금액·합계·점검일 등 업무 계산은 해당 모듈에 둔다. 재고 평균단가는 inventory/stock/stock-calculation.ts에서 처리하고 구매·입고의 품목금액은 각 서비스가 계산한다. API·DB 숫자 자료형은 유지한다.

날짜 전용 값의 검증은 common/utils/date.util.ts를 사용한다. 작업요청·작업오더·설비·PM·작업허가의 중복 달력 검사는 제거하되 필수 여부·빈 값 처리·점검 주기·허가기간 규칙은 각 업무가 관리한다. 업무 날짜는 API·저장 YYYYMMDD, 화면 YYYY-MM-DD이며 시각은 기존 timestamptz/ISO와 한국 시간 표시를 유지한다. 작업허가의 YYYYMMDD:HH 변환은 해당 모듈에 둔다.

프론트는 shared/lib/format.ts에서 날짜 표시·입력 변환과 한국의 오늘·일시 표시를 제공한다. 구매·재고의 중복 날짜 유틸은 제거하고 구매오더 금액 미리 계산은 purchase-order 내부에 둔다. shared/lib/numeric.ts는 자릿수 표시·입력 검사·배율 변환을 제공하고 재고 컬럼별 표시는 inventory/common/report-format.ts에 둔다. shared/ui/Pagination.tsx는 공통 이전/다음 버튼과 페이지 표시만 담당하며 조회·검색·로딩 상태는 각 화면에 둔다. 로그인 이력 백엔드는 기존 페이지 공통을 사용하되 limit 100 초과 거부 규칙은 유지한다.

주요 구매·재고·보전·결재 Controller와 Service에는 권한과 업무 범위의 검사 위치, 트랜잭션 경계, 참조 원문 확인, 확정·취소 순서 및 후속 동기화 정책을 주석으로 설명한다. 함수 이름을 반복하는 주석보다 정책과 호출 조건을 기록한다.

백엔드 Entity는 개별 파일에서 직접 import하고 각 모듈의 TypeOrmModule.forFeature 배열에 명시적으로 등록한다. 재고의 transactions·stock·monthly-closing도 같은 방식을 사용하며 entities/index.ts와 Object.values 기반 등록은 사용하지 않는다. 프론트의 index.ts/index.tsx는 모듈 공개 API 또는 라우트 구성 용도로 유지한다.

- 재고는 신규 수동 이동입고·수령 창고 재선택 분기를 제거했다. 구매입고만 원문 선택으로 생성하고 타창고 입고는 서버가 생성한 W 전표를 확정한다. /inventory-document/:id 상세는 유지하며 옛 목록·신규 화면 리다이렉트는 제거했다.
- 구매요청/발주의 공용 처리 시절 블록·별칭과 요청 단가 검사 중복을 제거했다. 구매요청은 DTO 경계에서 금액 필드를 거부한다. 거래처·품목 snapshot과 기존 값 보존 정책은 유지한다.
- 보전 화면은 현재 API가 필수로 제공하는 공수·자재·경비·선택목록 배열을 사용하고 구버전 응답 대체 분기를 제거했다. 서버의 날짜·작성자·회사 범위·결재 상태 검사는 유지한다.
- 공통코드는 실제 삭제 모델에 맞춰 내부 조회 명칭을 정리했다. 미사용 CODE_GROUP_LIST/isModuleCode/재고 타입 별칭과 전체 Controller 권한 조사 도우미는 제거했다. MODULE_ACTIONS를 실제 권한 원본으로 사용하며 런타임·부트스트랩에서 Controller를 조사하지 않는다.
- 결재 처리 순서·참조 원문 동기화·첨부 연결·게시글/댓글 작성자·부모 행 잠금은 현재 기능이므로 유지한다. 화면과 홈·사이드바는 menuGroups 정의를 직접 공유한다.

| 대상 | 테스트 위치·기준 |
|---|---|
| 구매 | purchase/purchase-request/purchasing.integration.spec.ts: 요청→독립 발주·거래처·품목·목록 |
| 재고 | inventory/transactions/inventory.integration.spec.ts: 해당 잔고 증감·원금액·대기 수령·취소·범위·원자성 |
| 월 마감 | inventory/monthly-closing/monthly-closing.integration.spec.ts: 월 잠금 순서·소급 보호·전표 기반 기초/기간/기말 |
| 권한 | auth/guards/permissions.guard.spec.ts: read+동작 권한의 실제 허용·거부 |
| 공통 DB 준비 | backend/test/support/purchase-inventory.fixture.ts: 임시 PGlite DB·입력 준비. 운영 DB 미사용 |
| 브라우저 | frontend/test의 인증·구매/재고·업무 UI 테스트. support/browser.cjs에서 CDP·대기 공유 |
| 메타데이터 | support/metadata.cjs가 백엔드 MetadataController 원본에서 생성. 복사 JSON·backend/dist 불필요 |
| 초기 실행 | scripts/test-start.py: 모드·명시적 설치 확인·기존 테이블 설치 실패 후 중단·배포 패키지 파일 구성 |

Jest는 src/**/*.spec.ts만 대상으로 하고 미사용 libs/apps/별칭 설정을 두지 않는다. 기존 유효한 보전·결재·게시판·공통코드·회사 격리 테스트는 유지한다. 테스트 fixture의 타입·class spread도 정리했으며 소스·테스트를 함께 TypeScript 검사한다.

2026-11-18 검증 기준: 백엔드 33개 스위트·373개 테스트, 브라우저 3종, 숫자 헬퍼 및 스크립트 7개 테스트 통과. 양쪽 린트는 오류·경고 없이 통과했다. 검증 후 dist·tsbuildinfo·프런트 TypeScript/Vite 캐시를 삭제했으며 DB·실행 서비스·환경파일·의존성·첨부는 변경하지 않았다. 실행 명령과 재빌드는 [설치 가이드](install_guide.md#7-로컬-개발과-검사)를 따른다.

출고 단가 버림 정책 반영 후 관련 4개 스위트·35개 테스트와 구매/재고 브라우저 테스트, 프런트 빌드·양쪽 린트·전체 TypeScript 검사를 통과했다. 적요 기록·전량 출고 잔액·소수 수량 반올림·이동입고와 취소의 원금액 보존을 확인했다.

## 15. 후속 검토와 운영 한계

- 창고 삭제 전 잔고·미수령 이동 확인은 사용자 운영 절차로 관리한다. 서버의 자동 삭제 제한은 적용하지 않는다. 추가 인덱스·실행계획 검토는 보류한다.
- 부서 조회는 재귀 CTE의 UNION으로 중복 탐색을 종료하며, 다단계 순환 저장을 추가 차단하지 않는다. 부서 트리·순환/고아 노드 표시 기능은 아직 없다.
- 첨부 목록은 인증 회사+attachmentId로 조회한다. refId가 null이어도 원문이 attachmentId를 가지고 있으면 조회할 수 있으며 고아 첨부가 다른 문서에 자동 혼입되지는 않는다.
- 업로드 응답만 유실된 경우 실제 등록 여부를 재조회한 뒤 재시도해야 중복 업로드를 피할 수 있다. 문서 저장 후 첨부 refId 연결 실패는 원문을 되돌리지 않으므로 저장 성공 뒤 API가 실패할 수 있다. 원자적 저장 또는 부분 성공 응답 정책은 미결정이다.
- AttachmentManager의 대상 ID 초기화·조회 실패 시 이전 목록이 남을 수 있는 표시 문제는 미수정이다. DB의 첨부 혼입과 구분한다.
- 결재 원문 반영 실패는 로그와 sourceSyncWarning 응답으로 안내한다. 재반영 큐·오류 이력 DB·복구 버튼은 추가하지 않는다.
- 확정 전표 수량·금액과 문서 필드는 취소 후에도 보존한다. 월 스냅샷이 없으므로 재Open·정정하면 과거 기간 보고서도 달라질 수 있다. 과거 출력본 고정 보관은 별도 범위다.
- 고객별 DB는 접속 경계를 분리하지만 같은 PostgreSQL 인스턴스의 자원과 장애는 공유한다. DB 계정은 인스턴스 단위이고 public 등 스키마는 DB 단위다. 운영 계정의 CONNECT·스키마·테이블 권한은 고객별로 설정한다.

## 부록 A. 현행 Entity와 필드

2026-11-18의 `backend/src/**/*.entity.ts` 정의를 기준으로 정리했다. DB 실물 조사 결과가 아니며 설치된 DB 스키마가 자동으로 변경되지는 않는다. 삭제된 Permission·평가·수불·이동 중·월 집계 Entity와 과거 필드명 변경 제안은 포함하지 않는다. 현재 33개 Entity의 직접 선언 컬럼을 기록한다. nullable·길이·numeric 정밀도·기본값은 각 저장 정의를 따른다.

### ApprovalStep / approval_step

소스: [backend/src/approvals/entities/approval-step.entity.ts](../backend/src/approvals/entities/approval-step.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `approvalId` | string | PK; { type: 'varchar', length: 50 } |
| `stepNo` | number | PK; { type: 'integer' } |
| `type` | ApprovalStepType | { type: 'varchar', length: 30 } |
| `userId` | string | { type: 'varchar', length: 50 } |
| `status` | ApprovalStepResult \| null | { type: 'char', length: 1, nullable: true } |
| `comment` | string \| null | { type: 'text', nullable: true } |
| `actedAt` | Date \| null | { type: 'timestamptz', nullable: true } |

### Approval / approval

소스: [backend/src/approvals/entities/approval.entity.ts](../backend/src/approvals/entities/approval.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `approvalId` | string | PK; { type: 'varchar', length: 50 } |
| `documentNo` | string | { type: 'varchar', length: 50, default: '' } |
| `refModule` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `refId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `title` | string | { type: 'varchar', length: 200 } |
| `contentJson` | unknown | { type: 'jsonb' } |
| `submitterId` | string | { type: 'varchar', length: 50 } |
| `status` | DocumentStatus | { type: 'char', length: 1, default: DocumentStatus.DRAFT } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `submittedAt` | Date \| null | { type: 'timestamptz', nullable: true } |
| `completedAt` | Date \| null | { type: 'timestamptz', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### AttachmentItem / attachment_item

소스: [backend/src/attachments/entities/attachment-item.entity.ts](../backend/src/attachments/entities/attachment-item.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `attachmentId` | string | PK; { type: 'varchar', length: 50 } |
| `itemNo` | number | PK; { type: 'integer' } |
| `originalName` | string | { type: 'varchar', length: 255 } |
| `storageName` | string | { type: 'varchar', length: 255 } |
| `fileExtension` | string \| null | { type: 'varchar', length: 20, nullable: true } |
| `mimeType` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `size` | string | { type: 'bigint' } |
| `checksum` | string \| null | { type: 'varchar', length: 128, nullable: true } |
| `storagePath` | string | { type: 'varchar', length: 500 } |

### Attachment / attachment

소스: [backend/src/attachments/entities/attachment.entity.ts](../backend/src/attachments/entities/attachment.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `attachmentId` | string | PK; { type: 'varchar', length: 50 } |
| `refModule` | string | { type: 'varchar', length: 50 } |
| `refId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### LoginHistory / login_history

소스: [backend/src/auth/entities/login-history.entity.ts](../backend/src/auth/entities/login-history.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `id` | string | PK; { type: 'uuid', default: () => 'gen_random_uuid()' } |
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `userId` | string | { type: 'varchar', length: 50 } |
| `success` | boolean | { type: 'boolean' } |
| `failureReason` | string \| null | { type: 'varchar', length: 40, nullable: true } |
| `ipAddress` | string \| null | { type: 'varchar', length: 64, nullable: true } |
| `userAgent` | string \| null | { type: 'varchar', length: 512, nullable: true } |

### BoardComment / board_comment

소스: [backend/src/boards/entities/board-comment.entity.ts](../backend/src/boards/entities/board-comment.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `boardId` | string | PK; { type: 'varchar', length: 50 } |
| `commentId` | string | PK; { type: 'varchar', length: 36 } |
| `content` | string | { type: 'text' } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### Board / board

소스: [backend/src/boards/entities/board.entity.ts](../backend/src/boards/entities/board.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `boardId` | string | PK; { type: 'varchar', length: 50 } |
| `title` | string | { type: 'varchar', length: 200 } |
| `content` | string | { type: 'text' } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### CodeItem / code_item

소스: [backend/src/codes/code-items/entities/code-item.entity.ts](../backend/src/codes/code-items/entities/code-item.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `codeId` | string | PK; { type: 'varchar', length: 50 } |
| `codeItemId` | string | PK; { type: 'varchar', length: 50 } |
| `name` | string | { type: 'varchar', length: 100 } |
| `sortOrder` | number | { type: 'integer', default: 0 } |

### RolePermission / role_permission

소스: [backend/src/identity/roles/entities/role-permission.entity.ts](../backend/src/identity/roles/entities/role-permission.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `roleId` | string | PK; { type: 'varchar', length: 30 } |
| `permissionId` | string | PK; { type: 'varchar', length: 100 } |

### Role / role

소스: [backend/src/identity/roles/entities/role.entity.ts](../backend/src/identity/roles/entities/role.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `roleId` | string | PK; { type: 'varchar', length: 30 } |
| `name` | string | { type: 'varchar', length: 100 } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### User / user

소스: [backend/src/identity/users/entities/user.entity.ts](../backend/src/identity/users/entities/user.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `userId` | string | PK; { type: 'varchar', length: 50 } |
| `passwordHash` | string | { type: 'varchar', length: 255 } |
| `tokenVersion` | number | { type: 'integer', default: 0 } |
| `name` | string | { type: 'varchar', length: 100 } |
| `email` | string \| null | { type: 'varchar', length: 255, nullable: true } |
| `phoneNumber` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `title` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `position` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `roleId` | string | { type: 'varchar', length: 30 } |
| `siteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deptId` | string | { type: 'varchar', length: 30 } |
| `accessScope` | AccessScope | { type: 'varchar', length: 30 } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### Material / material

소스: [backend/src/inventory/material/entities/material.entity.ts](../backend/src/inventory/material/entities/material.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `materialId` | string | PK; { type: 'varchar', length: 50 } |
| `name` | string | { type: 'varchar', length: 150 } |
| `typeCode` | string | { type: 'varchar', length: 50 } |
| `baseUnit` | string | { type: 'varchar', length: 30 } |
| `spec` | string \| null | { type: 'text', nullable: true } |
| `maker` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `model` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### InventoryPeriodLock / inventory_period_lock

소스: [backend/src/inventory/monthly-closing/entities/inventory-period-lock.entity.ts](../backend/src/inventory/monthly-closing/entities/inventory-period-lock.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `yearMonth` | string | PK; { type: 'char', length: 6 } |
| `locked` | boolean | { type: 'boolean', default: false } |

### InventoryControl / inventory_control

InventoryControl은 transactions/entities에서 InventoryModule에 등록한다. StockModule의 잔고 Entity는 StockBalance만 둔다. 회사별 lastSequence를 InventoryService가 확정 시 1씩 증가시킨다. 월 초기화·취소 시 감소·번호 재사용은 하지 않는다. W 입고는 확정 시에만 순번을 받는다. 회사 전체 최신 확정 전표 취소 및 수불장 순서의 기준이다. NumberingService의 회사·모듈·발급월별 문서번호와는 별개다.

소스: [backend/src/inventory/transactions/entities/inventory-control.entity.ts](../backend/src/inventory/transactions/entities/inventory-control.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `lastSequence` | string | { type: 'bigint', default: 0 } |

### StockBalance / stock_balance

소스: [backend/src/inventory/stock/entities/stock-balance.entity.ts](../backend/src/inventory/stock/entities/stock-balance.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `siteId` | string | PK; { type: 'varchar', length: 30 } |
| `warehouseId` | string | PK; { type: 'varchar', length: 30 } |
| `materialId` | string | PK; { type: 'varchar', length: 50 } |
| `quantity` | string | { type: 'numeric', precision: 20, scale: 6, default: 0 } |
| `amount` | string | { type: 'numeric', precision: 20, scale: 0, default: 0 } |

### InventoryDocument / inventory_document

소스: [backend/src/inventory/transactions/entities/inventory-document.entity.ts](../backend/src/inventory/transactions/entities/inventory-document.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `inventoryDocumentId` | string | PK; { type: 'varchar', length: 50 } |
| `documentNo` | string | { type: 'varchar', length: 50 } |
| `title` | string | { type: 'varchar', length: 200 } |
| `type` | 'IN' \| 'OUT' \| 'ADJUST' | { type: 'varchar', length: 10 } |
| `kind` | 'GENERAL' \| 'PURCHASE' \| 'TRANSFER' \| null | { type: 'varchar', length: 10, nullable: true } |
| `postingDate` | string | { type: 'char', length: 8 } |
| `siteId` | string | { type: 'varchar', length: 30 } |
| `warehouseId` | string | { type: 'varchar', length: 30 } |
| `deptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `toSiteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `toWarehouseId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `refModule` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `refId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `reason` | string \| null | { type: 'text', nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `status` | InventoryStatus | { type: 'char', length: 1, default: 'C' } |
| `confirmedBy` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `confirmedAt` | Date \| null | { type: 'timestamptz', nullable: true } |
| `cancelledBy` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `cancelledAt` | Date \| null | { type: 'timestamptz', nullable: true } |
| `cancelReason` | string \| null | { type: 'text', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |
| `postingSequence` | string \| null | { type: 'bigint', nullable: true } |

### InventoryItem / inventory_item

소스: [backend/src/inventory/transactions/entities/inventory-item.entity.ts](../backend/src/inventory/transactions/entities/inventory-item.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `inventoryDocumentId` | string | PK; { type: 'varchar', length: 50 } |
| `itemId` | string | PK; { type: 'varchar', length: 50 } |
| `sortOrder` | number | { type: 'integer' } |
| `materialId` | string | { type: 'varchar', length: 50 } |
| `materialName` | string | { type: 'varchar', length: 150 } |
| `baseUnit` | string | { type: 'varchar', length: 30 } |
| `spec` | string \| null | { type: 'text', nullable: true } |
| `quantity` | string | { type: 'numeric', precision: 20, scale: 6, default: 0 } |
| `unitPrice` | string | { type: 'numeric', precision: 24, scale: 0, default: 0 } |
| `amount` | string | { type: 'numeric', precision: 24, scale: 0, default: 0 } |
| `refItemId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |

### Equipment / equipment

소스: [backend/src/maintenance/equipment/entities/equipment.entity.ts](../backend/src/maintenance/equipment/entities/equipment.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `siteId` | string | { type: 'varchar', length: 30 } |
| `equipmentId` | string | PK; { type: 'varchar', length: 50 } |
| `parentEquipmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `pmTargetYn` | string | { type: 'char', length: 1, default: 'N' } |
| `permitTargetYn` | string | { type: 'char', length: 1, default: 'N' } |
| `legalInspectionDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `legalNextInspectionDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `name` | string | { type: 'varchar', length: 150 } |
| `typeCode` | string | { type: 'varchar', length: 50 } |
| `location` | string \| null | { type: 'varchar', length: 200, nullable: true } |
| `maker` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `model` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `spec` | string \| null | { type: 'text', nullable: true } |
| `serialNo` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `installDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `deptId` | string | { type: 'varchar', length: 30 } |
| `inspectionPeriod` | number \| null | { type: 'integer', nullable: true } |
| `inspectionUnit` | string \| null | { type: 'varchar', length: 20, nullable: true } |
| `inspectionDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `nextInspectionDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `legalInspectionPeriod` | number \| null | { type: 'integer', nullable: true } |
| `legalInspectionUnit` | string \| null | { type: 'varchar', length: 20, nullable: true } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### PreventiveMaintenance / preventive_maintenance

소스: [backend/src/maintenance/preventive-maintenance/entities/preventive-maintenance.entity.ts](../backend/src/maintenance/preventive-maintenance/entities/preventive-maintenance.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `pmId` | string | PK; { type: 'varchar', length: 50 } |
| `documentNo` | string | { type: 'varchar', length: 50 } |
| `title` | string | { type: 'varchar', length: 200 } |
| `equipmentId` | string | { type: 'varchar', length: 50 } |
| `inspectionDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `nextInspectionDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `items` | InspectionItem[] | { type: 'jsonb', default: () => "'[]'::jsonb" } |
| `typeCode` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `result` | 'OK' \| 'NOK' \| null | { type: 'varchar', length: 3, nullable: true } |
| `siteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `inspectorId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `content` | string \| null | { type: 'text', nullable: true } |
| `requesterId` | string | { type: 'varchar', length: 50 } |
| `status` | DocumentStatus | { type: 'char', length: 1, default: DocumentStatus.DRAFT } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### WorkOrder / work_order

소스: [backend/src/maintenance/work-order/entities/work-order.entity.ts](../backend/src/maintenance/work-order/entities/work-order.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `workOrderId` | string | PK; { type: 'varchar', length: 50 } |
| `documentNo` | string | { type: 'varchar', length: 50 } |
| `title` | string | { type: 'varchar', length: 200 } |
| `orderKind` | OrderKind | { type: 'varchar', length: 10 } |
| `refModule` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `refId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `siteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `equipmentId` | string | { type: 'varchar', length: 50 } |
| `workDate` | string | { type: 'char', length: 8 } |
| `typeCode` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `content` | string \| null | { type: 'text', nullable: true } |
| `laborItems` | LaborItem[] | { type: 'jsonb', default: () => "'[]'::jsonb" } |
| `materials` | MaterialItem[] | { type: 'jsonb', default: () => "'[]'::jsonb" } |
| `costItems` | CostItem[] | { type: 'jsonb', default: () => "'[]'::jsonb" } |
| `requesterId` | string | { type: 'varchar', length: 50 } |
| `status` | DocumentStatus | { type: 'char', length: 1, default: DocumentStatus.DRAFT } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### WorkPermitRequest / work_permit_request

소스: [backend/src/maintenance/work-permit-request/entities/work-permit-request.entity.ts](../backend/src/maintenance/work-permit-request/entities/work-permit-request.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `workPermitRequestId` | string | PK; { type: 'varchar', length: 50 } |
| `documentNo` | string | { type: 'varchar', length: 50 } |
| `data` | PermitDataDto | { type: 'jsonb' } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `siteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `status` | string | { type: 'char', length: 1, default: 'D' } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### WorkPermit / work_permit

소스: [backend/src/maintenance/work-permit/entities/work-permit.entity.ts](../backend/src/maintenance/work-permit/entities/work-permit.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `workPermitId` | string | PK; { type: 'varchar', length: 50 } |
| `documentNo` | string | { type: 'varchar', length: 50 } |
| `data` | PermitDataDto | { type: 'jsonb' } |
| `refModule` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `refId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `permitTypes` | PermitType[] | { type: 'jsonb' } |
| `sections` | PermitSection[] | { type: 'jsonb' } |
| `issuerId` | string | { type: 'varchar', length: 50 } |
| `approverId` | string | { type: 'varchar', length: 50 } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `documentFiles` | DocumentFileDto[] | { type: 'jsonb', default: () => "'[]'::jsonb" } |
| `siteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `status` | DocumentStatus | { type: 'char', length: 1, default: 'D' } |
| `approvalId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### WorkRequest / work_request

소스: [backend/src/maintenance/work-request/entities/work-request.entity.ts](../backend/src/maintenance/work-request/entities/work-request.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `workRequestId` | string | PK; { type: 'varchar', length: 50 } |
| `documentNo` | string | { type: 'varchar', length: 50 } |
| `title` | string | { type: 'varchar', length: 200 } |
| `equipmentId` | string | { type: 'varchar', length: 50 } |
| `occurredDate` | string | { type: 'char', length: 8 } |
| `content` | string | { type: 'text' } |
| `priorityCode` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `requesterId` | string | { type: 'varchar', length: 50 } |
| `siteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `status` | DocumentStatus | { type: 'char', length: 1, default: DocumentStatus.DRAFT } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### NumberSequence / number_sequence

소스: [backend/src/numbering/entities/number-sequence.entity.ts](../backend/src/numbering/entities/number-sequence.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `moduleCode` | string | PK; { type: 'varchar', length: 20 } |
| `yyyymm` | string | PK; { type: 'char', length: 6 } |
| `lastSerial` | number | { type: 'integer', default: 0 } |

### Company / company

소스: [backend/src/organization/companies/entities/company.entity.ts](../backend/src/organization/companies/entities/company.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `name` | string | { type: 'varchar', length: 100 } |
| `registrationNumber` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `contactName` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `phoneNumber` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### Department / department

소스: [backend/src/organization/departments/entities/department.entity.ts](../backend/src/organization/departments/entities/department.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `deptId` | string | PK; { type: 'varchar', length: 30 } |
| `name` | string | { type: 'varchar', length: 100 } |
| `parentDeptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### Site / site

소스: [backend/src/organization/sites/entities/site.entity.ts](../backend/src/organization/sites/entities/site.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `siteId` | string | PK; { type: 'varchar', length: 30 } |
| `name` | string | { type: 'varchar', length: 100 } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### Warehouse / warehouse

소스: [backend/src/organization/warehouses/entities/warehouse.entity.ts](../backend/src/organization/warehouses/entities/warehouse.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `warehouseId` | string | PK; { type: 'varchar', length: 30 } |
| `siteId` | string | PK; { type: 'varchar', length: 30 } |
| `name` | string | { type: 'varchar', length: 100 } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

### PurchaseOrderItem / purchase_order_item

소스: [backend/src/purchase/purchase-order/entities/purchase-order-item.entity.ts](../backend/src/purchase/purchase-order/entities/purchase-order-item.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `orderId` | string | PK; { type: 'varchar', length: 50 } |
| `itemId` | string | PK; { type: 'varchar', length: 50 } |
| `sortOrder` | number | { type: 'integer' } |
| `materialId` | string | { type: 'varchar', length: 50 } |
| `materialName` | string | { type: 'varchar', length: 150 } |
| `baseUnit` | string | { type: 'varchar', length: 30 } |
| `spec` | string \| null | { type: 'text', nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `quantity` | string | { type: 'numeric', precision: 20, scale: 6 } |
| `unitPrice` | string \| null | { type: 'numeric', precision: 24, scale: 0, nullable: true } |
| `amount` | string \| null | { type: 'numeric', precision: 24, scale: 0, nullable: true } |

### PurchaseOrder / purchase_order

소스: [backend/src/purchase/purchase-order/entities/purchase-order.entity.ts](../backend/src/purchase/purchase-order/entities/purchase-order.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `orderId` | string | PK; { type: 'varchar', length: 50 } |
| `vendorId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `documentNo` | string | { type: 'varchar', length: 50 } |
| `title` | string | { type: 'varchar', length: 200 } |
| `typeCode` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `expectedDeliveryDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `content` | string \| null | { type: 'text', nullable: true } |
| `requesterId` | string | { type: 'varchar', length: 50 } |
| `status` | DocumentStatus | { type: 'char', length: 1, default: DocumentStatus.DRAFT } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |
| `toSiteId` | string | { type: 'varchar', length: 30 } |
| `siteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `orderDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `totalAmount` | string | { type: 'numeric', precision: 24, scale: 0, default: 0 } |
| `deliveryLocation` | string \| null | { type: 'varchar', length: 300, nullable: true } |
| `currency` | string | { type: 'varchar', length: 3, default: 'KRW' } |
| `refModule` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `refId` | string \| null | { type: 'varchar', length: 50, nullable: true } |

### PurchaseRequestItem / purchase_request_item

소스: [backend/src/purchase/purchase-request/entities/purchase-request-item.entity.ts](../backend/src/purchase/purchase-request/entities/purchase-request-item.entity.ts)

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `requestId` | string | PK; { type: 'varchar', length: 50 } |
| `itemId` | string | PK; { type: 'varchar', length: 50 } |
| `sortOrder` | number | { type: 'integer' } |
| `materialId` | string | { type: 'varchar', length: 50 } |
| `materialName` | string | { type: 'varchar', length: 150 } |
| `baseUnit` | string | { type: 'varchar', length: 30 } |
| `spec` | string \| null | { type: 'text', nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `quantity` | string | { type: 'numeric', precision: 20, scale: 6 } |

### PurchaseRequest / purchase_request

소스: [backend/src/purchase/purchase-request/entities/purchase-request.entity.ts](../backend/src/purchase/purchase-request/entities/purchase-request.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `requestId` | string | PK; { type: 'varchar', length: 50 } |
| `documentNo` | string | { type: 'varchar', length: 50 } |
| `title` | string | { type: 'varchar', length: 200 } |
| `typeCode` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `requiredDate` | string \| null | { type: 'char', length: 8, nullable: true } |
| `content` | string \| null | { type: 'text', nullable: true } |
| `requesterId` | string | { type: 'varchar', length: 50 } |
| `status` | DocumentStatus | { type: 'char', length: 1, default: DocumentStatus.DRAFT } |
| `attachmentId` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |
| `siteId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `deptId` | string \| null | { type: 'varchar', length: 30, nullable: true } |
| `requestDate` | string \| null | { type: 'char', length: 8, nullable: true } |

### Vendor / vendor

소스: [backend/src/purchase/vendor/entities/vendor.entity.ts](../backend/src/purchase/vendor/entities/vendor.entity.ts)

공통 감사필드 `createdBy`, `createdAt`, `updatedBy`, `updatedAt`을 상속한다.

| 필드 | TypeScript 타입 | 저장 정의 |
|---|---|---|
| `companyId` | string | PK; { type: 'varchar', length: 30 } |
| `vendorId` | string | PK; { type: 'varchar', length: 50 } |
| `name` | string | { type: 'varchar', length: 150 } |
| `registrationNumber` | string \| null | { type: 'varchar', length: 50, nullable: true } |
| `representativeName` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `contactName` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `phoneNumber` | string \| null | { type: 'varchar', length: 100, nullable: true } |
| `email` | string \| null | { type: 'varchar', length: 200, nullable: true } |
| `address` | string \| null | { type: 'varchar', length: 300, nullable: true } |
| `note` | string \| null | { type: 'text', nullable: true } |
| `deleteYn` | string | { type: 'char', length: 1, default: 'N' } |

## 부록 B. 공통 감사필드와 JSON 상세

### AuditEntity

| 필드 | 타입 | 의미 |
|---|---|---|
| createdBy | string | 생성 사용자 |
| createdAt | Date | 생성 시각 |
| updatedBy | string \| null | 최종 수정 사용자 |
| updatedAt | Date \| null | 최종 수정 시각 |

### InspectionItem

소스: [backend/src/maintenance/preventive-maintenance/entities/preventive-maintenance.entity.ts](../backend/src/maintenance/preventive-maintenance/entities/preventive-maintenance.entity.ts)

| 필드 | 타입 |
|---|---|
| `name` | string |
| `standardValue` | string |
| `inspectionValue` | string |
| `unit` | string |

### LaborItem

소스: [backend/src/maintenance/work-order/entities/work-order.entity.ts](../backend/src/maintenance/work-order/entities/work-order.entity.ts)

| 필드 | 타입 |
|---|---|
| `workerName` | string |
| `content` | string |
| `hours` | number |

### MaterialItem

소스: [backend/src/maintenance/work-order/entities/work-order.entity.ts](../backend/src/maintenance/work-order/entities/work-order.entity.ts)

| 필드 | 타입 |
|---|---|
| `name` | string |
| `spec` | string |
| `quantity` | number |
| `unit` | string |
| `unitPrice` | number |
| `amount` | number |

### CostItem

소스: [backend/src/maintenance/work-order/entities/work-order.entity.ts](../backend/src/maintenance/work-order/entities/work-order.entity.ts)

| 필드 | 타입 |
|---|---|
| `name` | string |
| `amount` | number |
| `note` | string |

### PermitDataDto

소스: [backend/src/maintenance/work-permit/dto/permit-data.dto.ts](../backend/src/maintenance/work-permit/dto/permit-data.dto.ts)

| 필드 | 타입 |
|---|---|
| `title` | string |
| `applicationDate` | string |
| `applicantType` | string |
| `applicantName` | string |
| `organization` | string |
| `phoneNumber?` | string |
| `workType` | string |
| `location` | string |
| `equipmentNo?` | string |
| `equipmentName?` | string |
| `startTime` | string |
| `endTime` | string |
| `summary` | string |

### PermitSectionDto

소스: [backend/src/maintenance/work-permit/dto/permit-data.dto.ts](../backend/src/maintenance/work-permit/dto/permit-data.dto.ts)

| 필드 | 타입 |
|---|---|
| `type` | PermitType |
| `templateVersion` | number |
| `safetyRequirements` | string |
| `specialRequirements` | string |
| `safetyReviewOpinion` | string |

### DocumentFileDto

소스: [backend/src/maintenance/work-permit/dto/permit-data.dto.ts](../backend/src/maintenance/work-permit/dto/permit-data.dto.ts)

| 필드 | 타입 |
|---|---|
| `requirementId` | string |
| `attachmentId` | string |
| `itemNo` | number |

### SaveWorkPermitDto

소스: [backend/src/maintenance/work-permit/dto/permit-data.dto.ts](../backend/src/maintenance/work-permit/dto/permit-data.dto.ts)

| 필드 | 타입 |
|---|---|
| `documentNo?` | string |
| `data` | PermitDataDto |
| `refModule?` | string \| null |
| `refId?` | string \| null |
| `permitTypes` | PermitType[] |
| `sections` | PermitSectionDto[] |
| `issuerId` | string |
| `approverId` | string |
| `attachmentId?` | string \| null |
| `documentFiles` | DocumentFileDto[] |

### PermitSection

소스: [backend/src/maintenance/work-permit/permit-template.ts](../backend/src/maintenance/work-permit/permit-template.ts)

| 필드 | 타입 |
|---|---|
| `type` | PermitType |
| `templateVersion` | number |
| `safetyRequirements` | string |
| `specialRequirements` | string |
| `safetyReviewOpinion` | string |

공통 헬퍼 분리 반영 검증: 백엔드 전체 34개 스위트·379개 테스트와 추가 날짜 테스트 3개를 통과했다. 작업오더 숫자 변환 변경 후 관련 23개 테스트를 재확인했다. 프론트 날짜·숫자 검사, 브라우저 3종, 프론트 빌드, 양쪽 타입·린트 검사도 통과했다. 페이지 표시 기준은 공통 컴포넌트의 `현재 / 전체 페이지`로 통일했다.
