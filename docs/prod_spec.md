# Product Specification for new-cmms

## Overview

new-cmms is an on-premise computerized maintenance management system for one business group. It supports multiple companies in the group, but it is not a SaaS product.

The system manages organization data, users, roles, permissions, maintenance activities, purchase flow, inventory/stock, reporting, attachments, and general approval documents.

Accounting management is planned for a future phase.

Detailed table and field structures are defined in `docs/db_spec.md`.

## Product Scope

### Common Features
- Organization management
- Code management
- User, role, and permission management
### Equipment Management
- Equipment management
- Preventive maintenance
- Work orders
- Work permits
### Material Management
- Material management
- Purchase requests
- Purchase orders
- Inventory documents
- Stock status and inventory ledger
- Monthly inventory closing lock
### Approval Management
- General approval documents
### Attachment Management
- Attachments
### Reporting
- Reports

## Target Users

- Admin
  - Manages company setup, organization data, users, roles, permissions, and system codes.
- Maintenance Manager
  - Oversees equipment, preventive maintenance, work orders, work permits, maintenance status, and maintenance reports.
- Maintenance Staff
  - Executes maintenance work, records preventive maintenance results, creates work order results, and creates purchase requests.
- Purchase Manager
  - Manages purchase requests, purchase orders, purchasing status, and purchase-related reports.
- Inventory Manager
  - Manages materials, warehouses, stock documents, stock status, inventory ledger, and monthly closing.
- Account Manager / Account Staff
  - Future scope. Handles accounting-related workflows connected to purchasing, inventory valuation, and financial reports.

## Detailed Specifications for new-cmms

### Company and Organization Scope

The system supports multiple companies in one group. All business data is isolated by company.

Each user belongs to exactly one company. No user, including admin/platform users, can access data across companies.

All business tables must include `companyId`.

One company can have several sites, departments, and warehouses. Departments and warehouses belong to one company and can include site information. Site is not part of the primary key for departments or warehouses.

Each user must have a company, site, department, and access scope. The user's site and department define their default organization position.

### Access Scope

Access scope filters business data inside the user's company.

Access scope types:

- `OWN_DEPARTMENT`
  - User can access records related to their own department.
- `OWN_SITE`
  - User can access records related to their own site.
- `COMPANY_ALL`
  - User can access all records in their company.

There is no separate site-level or warehouse-level permission restriction. Site, department, and warehouse are used for data scope/filtering only.

Stock access and stock actions are controlled by RBAC permissions.

Example:

- Maintenance staff can create purchase requests.
- Inventory manager can manage stock documents and stock status.
- Purchase manager can manage purchase flow and view stock status.

### Authentication and Authorization

The system uses JWT-based authentication.

All protected APIs must use JWT guard authentication.

Permissions are controlled by API-level CRUD permissions. Each role can be granted permission for actions such as create, read, update, and delete for each functional API/module.

Example permission codes:

- `equipment:create`
- `equipment:read`
- `equipment:update`
- `equipment:delete`
- `work_order:create`
- `work_order:read`
- `work_order:update`
- `work_order:delete`

Document flow actions are controlled by document business flow, not by generic CRUD permission rules.

## Common Document Status

Business documents use a common document status model.

Status codes:

- `D`: Draft
- `P`: Progress
- `C`: Confirm
- `R`: Reject
- `X`: Cancel

Status flow:

```text
D -> P
P -> C
P -> R
P -> X
```

Status rules:

- Draft documents can be updated, deleted, and moved to progress.
- Draft documents do not need cancel status. A draft document can be deleted instead.
- Progress documents cannot be updated or deleted through normal edit.
- Progress documents can be confirmed, rejected, or cancelled.
- Confirmed documents are final and cannot be reversed.
- Rejected documents are historical and can be referenced when creating a new draft document.
- Cancelled documents are final and used only after a document has moved to progress.

Only documents with status `D` can be updated or deleted in the service layer. This rule does not depend on document owner.

Approval workflow policy is handled by each company outside the system. The system stores and controls document status only.

## Code Management

Codes are managed in the database and must not be hardcoded in application logic.

Code categories represent system-defined code types and are not created by users. Code items are company-specific and managed by company users.

Examples:

- Equipment type/category
- Preventive maintenance type/category
- Work order type/category
- Failure cause type
- Purchase type
- Stock movement type

Code category/type is linked to each module by system design, but actual selectable code items come from the database.

Active/inactive control is not required at this stage.

## Numbering

Document numbers are generated by company, module, year/month, and serial number.

Format:

```text
{companyCode}-{moduleCode}-{YYYYMM}-{serial}
```

Examples:

```text
CR-WO-202610-00001
HPS-PR-202610-00001
```

Rules:

- `companyCode`: company code such as `CR`, `HPS`
- `moduleCode`: module code such as `PM`, `WO`, `WP`, `PR`, `PO`
- `YYYYMM`: document year and month
- `serial`: 5-digit monthly sequence

## Equipment

Equipment is managed per company and site. Department is required.

Equipment includes type/category, location, maker information, operation information, legal inspection information, notes, attachments, soft delete, and audit data.

QR/barcode and parent/child equipment hierarchy are not required at this stage.

## Preventive Maintenance

Preventive maintenance is abbreviated as `prev-maint`.

Preventive maintenance records store maintenance results only. They do not directly convert into work orders.

In the preventive maintenance list, overdue items should be highlighted based on the equipment's last preventive maintenance date and configured maintenance period.

Preventive maintenance includes header data, check/result items, attachments, soft delete, and audit data.

## Work Order

A work order consists of two independent parts:

- Plan
- Result

Each part has its own document status, labor, cost, and note.

The result can be created and processed without a confirmed plan.

Work orders include equipment, failure cause, department, user, plan information, result information, items, attachments, soft delete, and audit data.

## Work Permit

Work permits are managed by company and site.

Work permit equipment information is entered as text, not selected by equipment master. This allows one permit to describe several equipment items or work areas flexibly.

When users create a work permit, they use built-in templates for each permit type and modify the content as needed for the actual work requirement.

Work permits contain plan data only.

The current stage only needs basic hour-level time handling:

- `date`: `YYYYMMDD`
- `startTime`: `YYYYMMDD:HH`
- `endTime`: `YYYYMMDD:HH`

Minute-level time is not required.

## Material

Materials are managed per company.

Materials include type/category, unit, inventory information, maker information, soft delete, and audit data.

Materials are not lot-controlled or serial-controlled in the current stage. Materials are not directly linked to equipment or work orders in the material master.

## Purchase Request

Purchase requests are mainly created by maintenance staff.

Purchase requests include request header data, requested material items, document status, soft delete, and audit data.

The abbreviated document ID is `requestId`.

## Purchase Order

Purchase orders are created by purchaser/admin users.

The expected delivery date can be calculated based on the material master lead time.

Purchase orders include order header data, material items with price/currency/quantity, document status, soft delete, and audit data.

## Purchase Allocation

Purchase allocation links purchase request items to purchase order items and future delivery items.

Allocation is managed by request item. Quantity is not stored in the allocation table because partial allocation and partial delivery are not supported.

Rules:

- Partial allocation is not supported.
- Partial delivery is not supported.
- Allocation is handled by full request item.
- Multiple request items can be merged into one purchase order item.
- A request item is either allocated or not allocated.
- Purchase delivery is future scope.

## Inventory

Material stock stores the current quantity and moving-average price of each material by company and warehouse.

Inventory documents manage stock movements.

Inventory document types:

- `RECEIPT`
- `ISSUE`
- `TRANSFER`
- `ADJUSTMENT`

Inventory document rules:

- Receipt is created from a purchase order.
- Issue is done without department or work order reference.
- Transfer creates both issue movement from source warehouse and receipt movement to target warehouse.
- Adjustment can increase or decrease stock.
- Inventory document status follows the common document status flow.

## Inventory Ledger

The inventory ledger is generated when an inventory document is confirmed.

The ledger is used for stock history, moving-average calculation, and audit trail.

Ledger records store movement quantity, unit price, amount, balance quantity, moving average price, and balance amount after each confirmed transaction.

## Moving Average Price

Material stock value is calculated using moving average price.

When stock is received, the moving average price is recalculated:

```text
newMovingAveragePrice =
(currentBalanceAmount + receiptAmount) / (currentBalanceQty + receiptQty)
```

Issue, transfer out, and adjustment out use the current moving average price.

The material stock table stores the latest quantity and moving average price.

The inventory ledger stores historical movement and balance after each confirmed transaction.

## Inventory Closing Lock

Inventory closing is performed monthly at company level.

Closing is not handled as an inventory document. It is managed by a separate closing lock table.

Rules:

- Closing is managed by company and month.
- Once a month is closed, inventory documents dated in that month or earlier cannot be created, updated, deleted, cancelled, or confirmed.
- Closing locks inventory transactions for the closed period.
- Closing does not create stock movement by itself.

## General Approval Module

The general approval module is used for general-purpose internal documents.

It is separate from business document status rules.

Features:

- Tiptap editor content
- Required attachment
- Approval/reject/reference handling
- Approval history
- Comment/note for approval or rejection
- Tab-separated approval lists

The approval list only displays approval documents linked to the logged-in user.

A user can see an approval document only when they are related to it as one of the following:

- requester / submitter
- current approver
- previous approver
- future approver
- reference user

Even if a user has company-level access scope, they should not see unrelated approval documents unless they are linked to the approval document.

Approval tabs:

- Submit
  - Documents submitted by the logged-in user.
- Pending
  - Documents currently waiting for the logged-in user's approval.
- Processed
  - Documents where the logged-in user already approved, but the full approval flow is still in progress.
- Closed
  - Documents completed, rejected, or cancelled where the logged-in user is linked as submitter or approver.
- Reference
  - Documents shared with the logged-in user as reference documents.

The pending tab/box shows only documents where the logged-in user is the current step approver.

If the logged-in user is a future approver, the document must not appear in the pending box until the approval flow reaches that user's step.

Reference steps do not require action. They become visible in the reference box when the approval is submitted.


## Attachments

A common attachment module is required.

Attachment metadata is stored in the database. Physical files are stored in local storage with MinIO-compatible object storage support.

Maximum file size and allowed file types are controlled by `.env`.

The attachment module must support upload, download, draft-stage delete, file metadata, entity/module reference, local/MinIO storage, and `.env`-based validation.

Attachments are required for:

- Equipment
- Preventive maintenance
- Work order
- Work permit
- General approval documents

## Reports

Reports use dedicated printable report forms, not React screen rendering.

The report form can be implemented as dedicated HTML/template output optimized for print/export.

Landscape reports:

- Material list
- Equipment list
- Preventive maintenance list
- Work order list
- Work permit list
- Purchase request list
- Purchase order list
- Stock list

Portrait reports:

- Preventive maintenance detail
- Work order detail
- Work permit detail
- Purchase request detail
- Purchase order detail
- Stock document detail

Material and equipment detail reports are not required.

