# Entity 필드명 검토 및 변경 예정 기록

상태: **Vendor 필드명과 PurchaseOrder 공급처 구조는 코드에 반영, 나머지는 논의용 제안**. 조사일: 2026-11-09. 실제 DB 전환은 수행하지 않았다.

반영: Vendor는 registrationNumber/representativeName/phoneNumber로 통일했다. PurchaseOrder는 supplierName/supplierRegistrationNo/supplierContactName/supplierPhone/supplierEmail 저장 필드를 제거하고, companyId + vendorId로 최신 업체 정보를 조회한다. 삭제된 벤더도 기존 발주에서는 조회한다. 아래 기존 필드 목록은 최초 조사 기록이다.

## 1. 합의 및 보류 사항

- AuditEntity의 createdBy/createdAt/updatedBy/updatedAt 및 현재 상속 범위를 유지한다.
- Company, Site, Department, Warehouse, User는 현재 모든 필드를 유지한다. registrationNumber/title/position을 바꾸자는 이전 제안도 적용하지 않는다.
- companyId/siteId/deptId/userId 등 업무 식별자와 참조 키의 이름·값을 유지한다.
- Entity 자체에서 유추되는 name/title/content/note 등은 공통 이름을 사용한다. companyName/userName 같은 접두사를 무조건 붙이지 않는다.
- 요청자·상신자·담당자, 요청일·점검일·Posting 일자처럼 다른 역할이나 사건은 명칭을 구분한다.
- 현재 값이 우연히 같다는 이유만으로 용도가 다른 필드를 통합하지 않는다. 데이터 타입·길이·nullable 통일은 필드명 합의 후 별도로 검토한다.

### 권한 구조 변경 예정 — 필드명 논의 종료 후 재개

사용자 요청에 따라 다음 방향을 기록한다. 현재 코드는 변경하지 않았다.

1. Role 화면은 roleId와 name을 관리한다.
2. 권한 설정 화면은 Role을 선택하고, 모듈을 행으로, create/read/update/delete를 열로 배치한 체크박스 표를 제공한다. 실제 지원하지 않는 동작은 선택할 수 없다.
3. 권한 배정은 RolePermission에 companyId + roleId + module + action으로 직접 저장하는 방향으로 수정한다. 별도 permissionId를 사용자에게 등록받지 않는다.
4. 현재 Permission Entity의 제거 여부나 시스템 지원 목록으로 유지할지, API·권한 검사 변환·데이터 전환 상세는 필드명 논의가 끝난 후 확정한다. RolePermission의 기존 permissionId 필드는 이 예정 작업에 해당하며 일반 필드명 변경 후보와 분리한다.

## 2. 조사 범위

backend/src의 모든 *.entity.ts를 구문 분석했다. @Entity 클래스 **42개**, 직접 선언 속성 **442개**다. AuditEntity를 상속하는 Entity는 23개다. 상속 감사필드 4개는 각 Entity에 중복 집계하지 않았다.

추가로 JSONB에 저장되는 InspectionItem/LaborItem/MaterialItem/CostItem, PermitDataDto/PermitSection/DocumentFileDto 등 7개 상세 구조의 명칭을 조사했다. 허가요청과 허가가 공유하는 data도 포함한다. Tiptap contentJson은 외부 문서 스키마이므로 그 내부의 type/content/attrs를 업무 Entity 필드명 변경 대상으로 분류하지 않는다.

## 3. 명칭 변경 권고 후보

아래는 아직 사용자 확정 전인 제안이다. organization의 이름은 대상이 신청인 소속임을 나타내도록 구체화하고, phoneNumber는 기존 조직·사용자 명칭을 기준으로 한다.

| 번호 | 저장 위치 | 기존 | 제안 | 근거 |
|---|---|---|---|---|
| A01 | Vendor | phone | phoneNumber | 코드 반영 완료 |
| A02 | PurchaseOrder | supplierPhone | 제거 | vendor.phoneNumber 조회로 대체 완료 |
| A03 | WorkPermit.data / WorkPermitRequest.data | phone | applicantPhoneNumber | 신청인 연락처라는 역할과 전화번호 의미를 함께 표시 |
| A04 | 같은 data | organization | applicantOrganizationName | 신청인 소속·시공사명을 저장하는 문자열임을 명시 |
| A05 | 같은 data | startTime | startDateTime | 현재 YYYYMMDD:HH로 날짜까지 포함하므로 Time만으로는 부정확 |
| A06 | 같은 data | endTime | endDateTime | 시작 일시와 같은 기준으로 종료 일시 명시 |
| A07 | Vendor | representative | representativeName | 코드 반영 완료 |

startDateTime/endDateTime 제안은 이름만 대상이며 날짜 형식이나 시간대 저장 방식 변경을 뜻하지 않는다. phoneNumber도 길이·nullable을 이번에 바꾼다는 의미는 아니다.

## 4. 추가 판단이 필요한 후보

| 번호 | Entity | 기존 | 제안 또는 검토 방향 | 판정 |
|---|---|---|---|---|
| B01 | NumberSequence | yyyymm | yearMonth | 다른 모든 월 집계·마감 Entity의 YYYYMM 월 필드와 같은 의미. 단 복합 PK 필드이므로 키 유지 원칙에 따라 별도 합의 전 보류 |
| B02 | NumberSequence | moduleCode | documentPrefix | 실제 값은 module key가 아니라 PMAINT/PURREQ 같은 documentPrefix. 복합 PK 필드이므로 별도 합의 전 보류 |
| B03 | Equipment | legalNextInspectionDate | nextLegalInspectionDate | nextInspectionDate와 어순을 맞추는 선택적 정리. 현재도 의미는 명확하므로 필수 변경으로 보지 않음 |
| B04 | StockLedger | balanceQuantity | warehouseBalanceQuantity | 실제 값은 해당 수불 처리 후 창고 잔량. 사업장 잔량과 범위를 구분 |
| B05 | StockLedger | siteQuantity | siteBalanceQuantity | 같은 처리 시점의 사업장 잔량으로 B04와 의미 체계 통일 |
| B06 | StockLedger | siteAmount | siteBalanceAmount | 사업장 잔액임을 명시하고 B05와 짝을 맞춤 |
| B07 | StockValuation / StockLedger / MonthlyStockValuation | averagePrice | averageUnitPrice | 실제 계산값은 평균 단가. unitPrice와 용어 체계를 맞추는 선택적 개선이며 세 Entity 모두 동일하게 적용할 경우만 권고 |
| B08 | Vendor | registrationNo | registrationNumber | Company.registrationNumber는 유지하기로 했으므로 동일한 사업자등록번호 의미라면 그 명칭에 맞춤. 번호 종류 동일 여부 확인 후 결정 |
| B09 | PurchaseOrder | supplierRegistrationNo | supplierRegistrationNumber | B08 채택 시 공급처 snapshot에도 같은 명칭 체계 적용 |
| B10 | InventoryDocument | referenceNo | refId와 통합 검토 | 단순 rename 후보가 아님. 현 구현에서는 구매입고·이동입고 모두 원본 시스템 ID를 담아 refId와 같은 값으로 저장. 별도 외부 참조번호 용도가 없다면 중복 제거 검토 |

B04~B06의 근거는 inventory/stock/stock-engine.ts의 수불 처리 코드다. balanceQuantity에는 창고 target.quantity, siteQuantity/siteAmount에는 사업장 평가 v.quantity/v.amount를 기록한다. 일반 재고 잔고 Entity의 quantity/amount는 Entity 문맥에서 대상이 명확하므로 변경을 제안하지 않는다.

B01/B02는 업무 키 값 변경 제안이 아니지만 속성/컬럼 이름도 바뀌므로 사용자 동의 전 적용하지 않는다. B10은 기존 refId를 유지하는 중복 제거 가능성만 기록한다.

## 5. 변경하지 않는 주요 명칭

| 범주 | 유지 필드 | 이유 |
|---|---|---|
| 공통 명칭·내용 | name, title, content, note, spec, location, maker, model | 해당 Entity의 속성으로 해석 가능. 일괄 접두사 추가 불필요 |
| 문서 식별 | pmId, workRequestId, workOrderId, workPermitRequestId, workPermitId, requestId, orderId, inventoryDocumentId, approvalId, boardId | 기존 시스템 식별자·참조 유지 |
| 사용자 관리번호 | documentNo | 시스템 문서 ID와 다른 사용자 입력 관리번호 |
| 관계 | companyId/siteId/deptId/warehouseId/materialId/vendorId/roleId, parentDeptId/parentEquipmentId, refModule/refId/refItemId | 대상과 관계의 역할이 명확함 |
| 업무 담당자 | requesterId, submitterId, inspectorId, issuerId, approverId | 서로 다른 업무 역할. userId나 createdBy로 통합하지 않음 |
| 실체 이름 복사 | materialName, supplierName, supplierContactName, applicantName, equipmentName, workerName | 다른 대상의 표시명 또는 당시 snapshot을 저장하는 역할 |
| 업무 날짜 | requestDate, requiredDate, orderDate, expectedDeliveryDate, occurredDate, workDate, inspectionDate, nextInspectionDate, legalInspectionDate, installDate, applicationDate, postingDate | 서로 다른 사건·업무 기준 날짜. date로 일괄 통합하지 않음 |
| 결재 시각 | submittedAt, completedAt, actedAt | 상신·처리완료·결재선 행동 시각을 구분. completedAt은 승인/반려/취소를 포괄 |
| 기간·월 | yearMonth | 월 마감·월 집계에 같은 의미로 이미 통일됨 |
| 문서·처리 상태 | status, result, locked, summaryDirty, completed, processing | 각 Entity에서 의미를 해석 가능. 자료형/상태값 통일은 별도 논의 |
| 수량·가격 | quantity, unitPrice, amount, totalAmount | 품목 수량·단가·금액·문서 합계의 역할이 다름 |
| 월 집계 | opening/receipt/issue/transferIn/transferOut/adjustIncrease/adjustDecrease/closing + Quantity/Amount | 월별 집계에서 의미가 다른 항목이며 현재 명칭이 일관됨 |
| 이동 중 수량 | dispatchedQuantity, receivedQuantity | 일반 수불 입출고와 다른 이동 중 집계의 역할 |
| 순서 | sortOrder, entryOrder, postingSequence, lastSequence, lastSerial | 표시·품목 순서, 수불 발생 순서, 회사 확정순번, 카운터를 구분 |
| 단위 | Material.baseUnit, 구매/재고 품목 baseUnit, WO MaterialItem.unit, InspectionItem.unit | 재고 기본단위·자유 입력 작업 자재단위·점검 측정단위의 용도가 다르므로 일괄 변경하지 않음 |
| 첨부 상세 | originalName, storageName, fileExtension, mimeType, size, checksum, storagePath | 파일 Entity의 일반 속성. size는 바이트 수라는 계약을 유지 |

허가 JSON의 equipmentNo는 자유 입력 설비번호이며 Equipment FK를 저장하는 equipmentId와 역할이 다르므로 유지한다. DocumentRequest.moduleKey는 실제 모듈 키이고 NumberSequence.moduleCode는 문서 prefix이므로 두 필드를 같은 의미로 취급하지 않는다.

## 6. Entity가 아닌 후속 정리 항목

- 프런트 구매 폼의 date/dueDate는 이미 Entity에 존재하는 requestDate/orderDate/requiredDate/expectedDeliveryDate와 대응한다. Entity rename 목록에 포함하지 않고 폼·어댑터 논의에서 다룬다.
- 구매 저장/미리보기 DTO와 프런트의 requestIds는 Entity의 sourceRequestIds와 같은 원본 요청 목록을 나타낸다. Entity sourceRequestIds는 유지하고 나중에 API/프런트를 맞추는 후보로 기록한다.
- 선택 목록 id/name과 value/label 통일은 화면/API 계약이며 Entity 키와 name을 개명하는 작업으로 취급하지 않는다.
- Permission/RolePermission의 예정 구조 변경은 1절의 사용자 합의 기록을 따른다. 현재 permissionId 필드의 존재를 이번 조사에서 임의로 삭제하지 않는다.

## 7. 전체 Entity별 조사 목록

직접 선언 필드만 아래에 수록한다. AuditEntity 상속 여부를 각 Entity에 표시하며 공통 감사필드는 중복하지 않는다. **유지**는 이번 이름 검토에서 변경 후보로 찾지 않았다는 의미이며 기능·동시성·보안 검증 완료를 뜻하지 않는다.

### ApprovalStep

소스: [backend/src/approvals/entities/approval-step.entity.ts](../backend/src/approvals/entities/approval-step.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `approvalId` | string | 예 | 유지 |
| `stepNo` | number | 예 | 유지 |
| `type` | ApprovalStepType |  | 유지 |
| `userId` | string |  | 유지 |
| `status` | string \| null |  | 유지 |
| `comment` | string \| null |  | 유지 |
| `actedAt` | Date \| null |  | 유지 |

### Approval

소스: [backend/src/approvals/entities/approval.entity.ts](../backend/src/approvals/entities/approval.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `approvalId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `refModule` | string \| null |  | 유지 |
| `refId` | string \| null |  | 유지 |
| `title` | string |  | 유지 |
| `contentJson` | unknown |  | 유지 |
| `submitterId` | string |  | 유지 |
| `status` | DocumentStatus |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `submittedAt` | Date \| null |  | 유지 |
| `completedAt` | Date \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### AttachmentItem

소스: [backend/src/attachments/entities/attachment-item.entity.ts](../backend/src/attachments/entities/attachment-item.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `attachmentId` | string | 예 | 유지 |
| `itemNo` | number | 예 | 유지 |
| `originalName` | string |  | 유지 |
| `storageName` | string |  | 유지 |
| `fileExtension` | string \| null |  | 유지 |
| `mimeType` | string \| null |  | 유지 |
| `size` | string |  | 유지 |
| `checksum` | string \| null |  | 유지 |
| `storagePath` | string |  | 유지 |

### Attachment

소스: [backend/src/attachments/entities/attachment.entity.ts](../backend/src/attachments/entities/attachment.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `attachmentId` | string | 예 | 유지 |
| `refModule` | string |  | 유지 |
| `refId` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### BoardComment

소스: [backend/src/boards/entities/board-comment.entity.ts](../backend/src/boards/entities/board-comment.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `boardId` | string | 예 | 유지 |
| `commentId` | string | 예 | 유지 |
| `content` | string |  | 유지 |
| `deleteYn` | string |  | 유지 |

### Board

소스: [backend/src/boards/entities/board.entity.ts](../backend/src/boards/entities/board.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `boardId` | string | 예 | 유지 |
| `title` | string |  | 유지 |
| `content` | string |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### CodeItem

소스: [backend/src/codes/code-items/entities/code-item.entity.ts](../backend/src/codes/code-items/entities/code-item.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `codeId` | string | 예 | 유지 |
| `codeItemId` | string | 예 | 유지 |
| `name` | string |  | 유지 |
| `sortOrder` | number |  | 유지 |

### Permission

소스: [backend/src/identity/permissions/entities/permission.entity.ts](../backend/src/identity/permissions/entities/permission.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `permissionId` | string | 예 | 현재 필드 유지 / 권한 구조 변경 시 별도 검토 |
| `module` | string |  | 현재 필드 유지 / 권한 구조 변경 시 별도 검토 |
| `action` | string |  | 현재 필드 유지 / 권한 구조 변경 시 별도 검토 |
| `name` | string |  | 현재 필드 유지 / 권한 구조 변경 시 별도 검토 |
| `deleteYn` | string |  | 현재 필드 유지 / 권한 구조 변경 시 별도 검토 |

### RolePermission

소스: [backend/src/identity/roles/entities/role-permission.entity.ts](../backend/src/identity/roles/entities/role-permission.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `roleId` | string | 예 | 유지 |
| `permissionId` | string | 예 | 권한 구조 변경 예정 / 미적용 |

### Role

소스: [backend/src/identity/roles/entities/role.entity.ts](../backend/src/identity/roles/entities/role.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `roleId` | string | 예 | 유지 |
| `name` | string |  | 유지 |
| `deleteYn` | string |  | 유지 |

### User

소스: [backend/src/identity/users/entities/user.entity.ts](../backend/src/identity/users/entities/user.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `userId` | string | 예 | 유지 |
| `passwordHash` | string |  | 유지 |
| `name` | string |  | 유지 |
| `email` | string \| null |  | 유지 |
| `phoneNumber` | string \| null |  | 유지 |
| `title` | string \| null |  | 유지 |
| `position` | string \| null |  | 유지 |
| `roleId` | string |  | 유지 |
| `siteId` | string \| null |  | 유지 |
| `deptId` | string |  | 유지 |
| `accessScope` | AccessScope |  | 유지 |
| `deleteYn` | string |  | 유지 |

### Material

소스: [backend/src/inventory/material/entities/material.entity.ts](../backend/src/inventory/material/entities/material.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `materialId` | string | 예 | 유지 |
| `name` | string |  | 유지 |
| `typeCode` | string |  | 유지 |
| `baseUnit` | string |  | 유지 |
| `spec` | string \| null |  | 유지 |
| `maker` | string \| null |  | 유지 |
| `model` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### InventoryDocument

소스: [backend/src/inventory/transactions/entities/inventory-document.entity.ts](../backend/src/inventory/transactions/entities/inventory-document.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `inventoryDocumentId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `title` | string |  | 유지 |
| `typeCode` | string |  | 유지 |
| `processingKind` | string |  | 유지 |
| `postingDate` | string |  | 유지 |
| `siteId` | string |  | 유지 |
| `warehouseId` | string |  | 유지 |
| `deptId` | string \| null |  | 유지 |
| `toSiteId` | string \| null |  | 유지 |
| `toWarehouseId` | string \| null |  | 유지 |
| `toDeptId` | string \| null |  | 유지 |
| `refModule` | string \| null |  | 유지 |
| `refId` | string \| null |  | 유지 |
| `referenceNo` | string \| null |  | B10: refId와 중복 / 구조 검토 |
| `attachmentId` | string \| null |  | 유지 |
| `reason` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `status` | 'D' \| 'C' |  | 유지 |
| `deleteYn` | string |  | 유지 |
| `postingSequence` | string \| null |  | 유지 |

### InventoryItem

소스: [backend/src/inventory/transactions/entities/inventory-item.entity.ts](../backend/src/inventory/transactions/entities/inventory-item.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `inventoryDocumentId` | string | 예 | 유지 |
| `itemId` | string | 예 | 유지 |
| `sortOrder` | number |  | 유지 |
| `materialId` | string |  | 유지 |
| `materialName` | string |  | 유지 |
| `baseUnit` | string |  | 유지 |
| `spec` | string \| null |  | 유지 |
| `quantity` | string |  | 유지 |
| `unitPrice` | string |  | 유지 |
| `amount` | string |  | 유지 |
| `refItemId` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |

### InventoryTypeRule

소스: [backend/src/inventory/transactions/entities/inventory-type-rule.entity.ts](../backend/src/inventory/transactions/entities/inventory-type-rule.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `typeCode` | string | 예 | 유지 |
| `processingKind` | string |  | 유지 |

### InventoryControl

소스: [backend/src/inventory/stock/entities/inventory-control.entity.ts](../backend/src/inventory/stock/entities/inventory-control.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `lastSequence` | string |  | 유지 |

### InventoryPeriodLock

소스: [backend/src/inventory/monthly-closing/entities/inventory-period-lock.entity.ts](../backend/src/inventory/monthly-closing/entities/inventory-period-lock.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `yearMonth` | string | 예 | 유지 |
| `locked` | boolean |  | 유지 |
| `summaryDirty` | boolean |  | 유지 |

### StockBalance

소스: [backend/src/inventory/stock/entities/stock-balance.entity.ts](../backend/src/inventory/stock/entities/stock-balance.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `siteId` | string | 예 | 유지 |
| `warehouseId` | string | 예 | 유지 |
| `materialId` | string | 예 | 유지 |
| `quantity` | string |  | 유지 |

### StockValuation

소스: [backend/src/inventory/stock/entities/stock-valuation.entity.ts](../backend/src/inventory/stock/entities/stock-valuation.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `siteId` | string | 예 | 유지 |
| `materialId` | string | 예 | 유지 |
| `quantity` | string |  | 유지 |
| `amount` | string |  | 유지 |
| `averagePrice` | string |  | B07: averageUnitPrice / 선택 |

### StockLedger

소스: [backend/src/inventory/stock/entities/stock-ledger.entity.ts](../backend/src/inventory/stock/entities/stock-ledger.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `ledgerId` | string | 예 | 유지 |
| `inventoryDocumentId` | string |  | 유지 |
| `itemId` | string |  | 유지 |
| `postingDate` | string |  | 유지 |
| `postingSequence` | string |  | 유지 |
| `entryOrder` | number |  | 유지 |
| `typeCode` | string |  | 유지 |
| `processingKind` | string |  | 유지 |
| `siteId` | string |  | 유지 |
| `warehouseId` | string |  | 유지 |
| `materialId` | string |  | 유지 |
| `quantityChange` | string |  | 유지 |
| `amountChange` | string |  | 유지 |
| `balanceQuantity` | string |  | B04: warehouseBalanceQuantity |
| `siteQuantity` | string |  | B05: siteBalanceQuantity |
| `siteAmount` | string |  | B06: siteBalanceAmount |
| `averagePrice` | string |  | B07: averageUnitPrice / 선택 |

### StockInTransit

소스: [backend/src/inventory/stock/entities/stock-in-transit.entity.ts](../backend/src/inventory/stock/entities/stock-in-transit.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `outDocumentId` | string | 예 | 유지 |
| `outItemId` | string | 예 | 유지 |
| `siteId` | string |  | 유지 |
| `warehouseId` | string |  | 유지 |
| `toSiteId` | string |  | 유지 |
| `toWarehouseId` | string |  | 유지 |
| `toDeptId` | string \| null |  | 유지 |
| `materialId` | string |  | 유지 |
| `materialName` | string |  | 유지 |
| `baseUnit` | string |  | 유지 |
| `spec` | string \| null |  | 유지 |
| `quantity` | string |  | 유지 |
| `amount` | string |  | 유지 |
| `postingDate` | string |  | 유지 |
| `receivedDocumentId` | string \| null |  | 유지 |

### MonthlyStockBalance

소스: [backend/src/inventory/monthly-closing/entities/monthly-stock-balance.entity.ts](../backend/src/inventory/monthly-closing/entities/monthly-stock-balance.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `yearMonth` | string | 예 | 유지 |
| `siteId` | string | 예 | 유지 |
| `warehouseId` | string | 예 | 유지 |
| `materialId` | string | 예 | 유지 |
| `openingQuantity` | string |  | 유지 |
| `receiptQuantity` | string |  | 유지 |
| `issueQuantity` | string |  | 유지 |
| `transferInQuantity` | string |  | 유지 |
| `transferOutQuantity` | string |  | 유지 |
| `adjustIncreaseQuantity` | string |  | 유지 |
| `adjustDecreaseQuantity` | string |  | 유지 |
| `closingQuantity` | string |  | 유지 |

### MonthlyStockValuation

소스: [backend/src/inventory/monthly-closing/entities/monthly-stock-valuation.entity.ts](../backend/src/inventory/monthly-closing/entities/monthly-stock-valuation.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `yearMonth` | string | 예 | 유지 |
| `siteId` | string | 예 | 유지 |
| `materialId` | string | 예 | 유지 |
| `openingQuantity` | string |  | 유지 |
| `receiptQuantity` | string |  | 유지 |
| `issueQuantity` | string |  | 유지 |
| `transferInQuantity` | string |  | 유지 |
| `transferOutQuantity` | string |  | 유지 |
| `adjustIncreaseQuantity` | string |  | 유지 |
| `adjustDecreaseQuantity` | string |  | 유지 |
| `closingQuantity` | string |  | 유지 |
| `openingAmount` | string |  | 유지 |
| `receiptAmount` | string |  | 유지 |
| `issueAmount` | string |  | 유지 |
| `adjustIncreaseAmount` | string |  | 유지 |
| `adjustDecreaseAmount` | string |  | 유지 |
| `closingAmount` | string |  | 유지 |
| `averagePrice` | string |  | B07: averageUnitPrice / 선택 |

### MonthlyStockInTransit

소스: [backend/src/inventory/monthly-closing/entities/monthly-stock-in-transit.entity.ts](../backend/src/inventory/monthly-closing/entities/monthly-stock-in-transit.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `yearMonth` | string | 예 | 유지 |
| `outDocumentId` | string | 예 | 유지 |
| `outItemId` | string | 예 | 유지 |
| `siteId` | string |  | 유지 |
| `toSiteId` | string |  | 유지 |
| `materialId` | string |  | 유지 |
| `openingQuantity` | string |  | 유지 |
| `dispatchedQuantity` | string |  | 유지 |
| `receivedQuantity` | string |  | 유지 |
| `closingQuantity` | string |  | 유지 |
| `openingAmount` | string |  | 유지 |
| `dispatchedAmount` | string |  | 유지 |
| `receivedAmount` | string |  | 유지 |
| `closingAmount` | string |  | 유지 |

### Equipment

소스: [backend/src/maintenance/equipment/entities/equipment.entity.ts](../backend/src/maintenance/equipment/entities/equipment.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `siteId` | string |  | 유지 |
| `equipmentId` | string | 예 | 유지 |
| `parentEquipmentId` | string \| null |  | 유지 |
| `pmTargetYn` | string |  | 유지 |
| `permitTargetYn` | string |  | 유지 |
| `legalInspectionDate` | string \| null |  | 유지 |
| `legalNextInspectionDate` | string \| null |  | B03: nextLegalInspectionDate / 선택 |
| `name` | string |  | 유지 |
| `typeCode` | string |  | 유지 |
| `location` | string \| null |  | 유지 |
| `maker` | string \| null |  | 유지 |
| `model` | string \| null |  | 유지 |
| `spec` | string \| null |  | 유지 |
| `serialNo` | string \| null |  | 유지 |
| `installDate` | string \| null |  | 유지 |
| `deptId` | string |  | 유지 |
| `inspectionPeriod` | number \| null |  | 유지 |
| `inspectionUnit` | string \| null |  | 유지 |
| `inspectionDate` | string \| null |  | 유지 |
| `nextInspectionDate` | string \| null |  | 유지 |
| `legalInspectionPeriod` | number \| null |  | 유지 |
| `legalInspectionUnit` | string \| null |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### PreventiveMaintenance

소스: [backend/src/maintenance/preventive-maintenance/entities/preventive-maintenance.entity.ts](../backend/src/maintenance/preventive-maintenance/entities/preventive-maintenance.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `pmId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `title` | string |  | 유지 |
| `equipmentId` | string |  | 유지 |
| `inspectionDate` | string \| null |  | 유지 |
| `nextInspectionDate` | string \| null |  | 유지 |
| `items` | InspectionItem[] |  | 유지 |
| `typeCode` | string \| null |  | 유지 |
| `result` | 'OK' \| 'NOK' \| null |  | 유지 |
| `inspectionDeptId` | string \| null |  | 유지 |
| `inspectorId` | string \| null |  | 유지 |
| `content` | string \| null |  | 유지 |
| `requesterId` | string |  | 유지 |
| `status` | DocumentStatus |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### WorkOrder

소스: [backend/src/maintenance/work-order/entities/work-order.entity.ts](../backend/src/maintenance/work-order/entities/work-order.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `workOrderId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `title` | string |  | 유지 |
| `orderKind` | OrderKind |  | 유지 |
| `refModule` | string \| null |  | 유지 |
| `refId` | string \| null |  | 유지 |
| `siteId` | string \| null |  | 유지 |
| `deptId` | string \| null |  | 유지 |
| `equipmentId` | string |  | 유지 |
| `workDate` | string |  | 유지 |
| `typeCode` | string \| null |  | 유지 |
| `content` | string \| null |  | 유지 |
| `laborItems` | LaborItem[] |  | 유지 |
| `materials` | MaterialItem[] |  | 유지 |
| `costItems` | CostItem[] |  | 유지 |
| `requesterId` | string |  | 유지 |
| `status` | DocumentStatus |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### WorkPermit

소스: [backend/src/maintenance/work-permit/entities/work-permit.entity.ts](../backend/src/maintenance/work-permit/entities/work-permit.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `workPermitId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `data` | PermitDataDto |  | 필드 유지 / 내부 A03~A06 검토 |
| `refModule` | string \| null |  | 유지 |
| `refId` | string \| null |  | 유지 |
| `permitTypes` | PermitType[] |  | 유지 |
| `sections` | PermitSection[] |  | 유지 |
| `issuerId` | string |  | 유지 |
| `approverId` | string |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `documentFiles` | DocumentFileDto[] |  | 유지 |
| `siteId` | string \| null |  | 유지 |
| `deptId` | string \| null |  | 유지 |
| `status` | DocumentStatus |  | 유지 |
| `approvalId` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### WorkPermitRequest

소스: [backend/src/maintenance/work-permit-request/entities/work-permit-request.entity.ts](../backend/src/maintenance/work-permit-request/entities/work-permit-request.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `workPermitRequestId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `data` | PermitDataDto |  | 필드 유지 / 내부 A03~A06 검토 |
| `attachmentId` | string \| null |  | 유지 |
| `siteId` | string \| null |  | 유지 |
| `deptId` | string \| null |  | 유지 |
| `status` | string |  | 유지 |
| `deleteYn` | string |  | 유지 |

### WorkRequest

소스: [backend/src/maintenance/work-request/entities/work-request.entity.ts](../backend/src/maintenance/work-request/entities/work-request.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `workRequestId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `title` | string |  | 유지 |
| `equipmentId` | string |  | 유지 |
| `occurredDate` | string |  | 유지 |
| `content` | string |  | 유지 |
| `priorityCode` | string \| null |  | 유지 |
| `requesterId` | string |  | 유지 |
| `siteId` | string \| null |  | 유지 |
| `deptId` | string \| null |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `status` | DocumentStatus |  | 유지 |
| `deleteYn` | string |  | 유지 |

### DocumentRequest

소스: [backend/src/numbering/entities/document-request.entity.ts](../backend/src/numbering/entities/document-request.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `moduleKey` | string | 예 | 유지 |
| `requestKey` | string | 예 | 유지 |
| `documentId` | string |  | 유지 |
| `userId` | string |  | 유지 |
| `completed` | boolean |  | 유지 |
| `processing` | boolean |  | 유지 |

### NumberSequence

소스: [backend/src/numbering/entities/number-sequence.entity.ts](../backend/src/numbering/entities/number-sequence.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `moduleCode` | string | 예 | B02: documentPrefix / 키 필드로 보류 |
| `yyyymm` | string | 예 | B01: yearMonth / 키 필드로 보류 |
| `lastSerial` | number |  | 유지 |

### Company

소스: [backend/src/organization/companies/entities/company.entity.ts](../backend/src/organization/companies/entities/company.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `name` | string |  | 유지 |
| `registrationNumber` | string \| null |  | 유지 |
| `contactName` | string \| null |  | 유지 |
| `phoneNumber` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### Department

소스: [backend/src/organization/departments/entities/department.entity.ts](../backend/src/organization/departments/entities/department.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `deptId` | string | 예 | 유지 |
| `name` | string |  | 유지 |
| `parentDeptId` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

### Site

소스: [backend/src/organization/sites/entities/site.entity.ts](../backend/src/organization/sites/entities/site.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `siteId` | string | 예 | 유지 |
| `name` | string |  | 유지 |
| `deleteYn` | string |  | 유지 |

### Warehouse

소스: [backend/src/organization/warehouses/entities/warehouse.entity.ts](../backend/src/organization/warehouses/entities/warehouse.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `warehouseId` | string | 예 | 유지 |
| `siteId` | string | 예 | 유지 |
| `name` | string |  | 유지 |
| `deleteYn` | string |  | 유지 |

### PurchaseOrderAllocation

소스: [backend/src/purchase/purchase-order/entities/purchase-order-allocation.entity.ts](../backend/src/purchase/purchase-order/entities/purchase-order-allocation.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `allocationId` | string | 예 | 유지 |
| `orderId` | string |  | 유지 |
| `orderItemId` | string |  | 유지 |
| `requestId` | string |  | 유지 |
| `requestItemId` | string |  | 유지 |
| `quantity` | string |  | 유지 |

### PurchaseOrderItem

소스: [backend/src/purchase/purchase-order/entities/purchase-order-item.entity.ts](../backend/src/purchase/purchase-order/entities/purchase-order-item.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `orderId` | string | 예 | 유지 |
| `itemId` | string | 예 | 유지 |
| `sortOrder` | number |  | 유지 |
| `materialId` | string |  | 유지 |
| `materialName` | string |  | 유지 |
| `baseUnit` | string |  | 유지 |
| `spec` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `quantity` | string |  | 유지 |
| `unitPrice` | string \| null |  | 유지 |
| `amount` | string \| null |  | 유지 |

### PurchaseRequestItem

소스: [backend/src/purchase/purchase-request/entities/purchase-request-item.entity.ts](../backend/src/purchase/purchase-request/entities/purchase-request-item.entity.ts) · AuditEntity 상속: 아니오

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `requestId` | string | 예 | 유지 |
| `itemId` | string | 예 | 유지 |
| `sortOrder` | number |  | 유지 |
| `materialId` | string |  | 유지 |
| `materialName` | string |  | 유지 |
| `baseUnit` | string |  | 유지 |
| `spec` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `quantity` | string |  | 유지 |

### PurchaseOrder

소스: [backend/src/purchase/purchase-order/entities/purchase-order.entity.ts](../backend/src/purchase/purchase-order/entities/purchase-order.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `vendorId` | string \| null |  | 유지 |
| `companyId` | string | 예 | 유지 |
| `orderId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `title` | string |  | 유지 |
| `typeCode` | string \| null |  | 유지 |
| `expectedDeliveryDate` | string \| null |  | 유지 |
| `content` | string \| null |  | 유지 |
| `requesterId` | string |  | 유지 |
| `status` | DocumentStatus |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |
| `siteId` | string \| null |  | 유지 |
| `deptId` | string \| null |  | 유지 |
| `orderDate` | string \| null |  | 유지 |
| `totalAmount` | string |  | 유지 |
| `supplierName` | string \| null |  | 제거 / vendor.name 조회 |
| `supplierRegistrationNo` | string \| null |  | 제거 / vendor.registrationNumber 조회 |
| `supplierContactName` | string \| null |  | 제거 / vendor.contactName 조회 |
| `supplierPhone` | string \| null |  | 제거 / vendor.phoneNumber 조회 |
| `supplierEmail` | string \| null |  | 제거 / vendor.email 조회 |
| `deliveryLocation` | string \| null |  | 유지 |
| `currency` | string |  | 유지 |
| `sourceRequestIds` | string[] |  | 유지 |

### PurchaseRequest

소스: [backend/src/purchase/purchase-request/entities/purchase-request.entity.ts](../backend/src/purchase/purchase-request/entities/purchase-request.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `requestId` | string | 예 | 유지 |
| `documentNo` | string |  | 유지 |
| `title` | string |  | 유지 |
| `typeCode` | string \| null |  | 유지 |
| `requiredDate` | string \| null |  | 유지 |
| `content` | string \| null |  | 유지 |
| `requesterId` | string |  | 유지 |
| `status` | DocumentStatus |  | 유지 |
| `attachmentId` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |
| `siteId` | string \| null |  | 유지 |
| `deptId` | string \| null |  | 유지 |
| `requestDate` | string \| null |  | 유지 |

### Vendor

소스: [backend/src/purchase/vendor/entities/vendor.entity.ts](../backend/src/purchase/vendor/entities/vendor.entity.ts) · AuditEntity 상속: 예

| 기존 필드 | 현재 TS 타입 | PK | 이름 검토 결과 |
|---|---|---|---|
| `companyId` | string | 예 | 유지 |
| `vendorId` | string | 예 | 유지 |
| `name` | string |  | 유지 |
| `registrationNo` | string \| null |  | registrationNumber로 변경 완료 |
| `representative` | string \| null |  | representativeName으로 변경 완료 |
| `contactName` | string \| null |  | 유지 |
| `phone` | string \| null |  | phoneNumber로 변경 완료 |
| `email` | string \| null |  | 유지 |
| `address` | string \| null |  | 유지 |
| `note` | string \| null |  | 유지 |
| `deleteYn` | string |  | 유지 |

## 8. 감사필드 및 JSON 상세 구조

### AuditEntity

- `createdBy`: `string` — 유지
- `createdAt`: `Date` — 유지
- `updatedBy`: `string | null` — 유지
- `updatedAt`: `Date | null` — 유지

### InspectionItem

- `name`: `string` — 유지
- `standardValue`: `string` — 유지
- `inspectionValue`: `string` — 유지
- `unit`: `string` — 유지

### LaborItem

- `workerName`: `string` — 유지
- `content`: `string` — 유지
- `hours`: `number` — 유지

### MaterialItem

- `name`: `string` — 유지
- `spec`: `string` — 유지
- `quantity`: `number` — 유지
- `unit`: `string` — 유지
- `unitPrice`: `number` — 유지
- `amount`: `number` — 유지

### CostItem

- `name`: `string` — 유지
- `amount`: `number` — 유지
- `note`: `string` — 유지

### PermitDataDto

소스: [backend/src/maintenance/work-permit/dto/permit-data.dto.ts](../backend/src/maintenance/work-permit/dto/permit-data.dto.ts)

| 기존 필드 | 현재 TS 타입 | 이름 검토 결과 |
|---|---|---|
| `title` | string | 유지 |
| `applicationDate` | string | 유지 |
| `applicantType` | string | 유지 |
| `applicantName` | string | 유지 |
| `organization` | string | A04: applicantOrganizationName |
| `phone?` | string | A03: applicantPhoneNumber |
| `workType` | string | 유지 |
| `location` | string | 유지 |
| `equipmentNo?` | string | 유지 |
| `equipmentName?` | string | 유지 |
| `startTime` | string | A05: startDateTime |
| `endTime` | string | A06: endDateTime |
| `summary` | string | 유지 |

### DocumentFileDto

소스: [backend/src/maintenance/work-permit/dto/permit-data.dto.ts](../backend/src/maintenance/work-permit/dto/permit-data.dto.ts)

| 기존 필드 | 현재 TS 타입 | 이름 검토 결과 |
|---|---|---|
| `requirementId` | string | 유지 |
| `attachmentId` | string | 유지 |
| `itemNo` | number | 유지 |

### PermitSection

소스: [backend/src/maintenance/work-permit/permit-template.ts](../backend/src/maintenance/work-permit/permit-template.ts)

| 기존 필드 | 현재 TS 타입 | 이름 검토 결과 |
|---|---|---|
| `type` | PermitType | 유지 |
| `templateVersion` | number | 유지 |
| `safetyRequirements` | string | 유지 |
| `specialRequirements` | string | 유지 |
| `safetyReviewOpinion` | string | 유지 |

## 9. 반영 절차

Vendor와 PurchaseOrder의 반영 사항은 문서 상단에 기록했다. 나머지는 다음 논의에서 후보별 유지/변경을 확정한 뒤 Entity·저장 JSON·DTO·서비스·프런트·출력·bootstrap·테스트의 영향을 함께 수정한다. 기존 키 값과 날짜 의미를 보존하며, 컬럼·JSON 키 이름 변경 시 기존 데이터의 변환·보존 방법을 먼저 준비한다. 실제 DB 작업이나 synchronize 실행은 이번 조사에서 수행하지 않았다.
