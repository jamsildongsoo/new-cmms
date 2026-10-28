# Technical Specification for new-cmms

## Development Stack

- Backend: Node.js LTS, NestJS, TypeORM, PostgreSQL, REST API.
- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router.
- Rich text: Tiptap; store approval content as JSON.
- Database schema: follow `docs/db_spec.md`; use `timestamptz` for timestamps.
- Use dependency lockfiles; add specified frontend libraries as needed.

## Backend Requirements

- Protect non-public endpoints with JWT authentication and API-level RBAC.
- Apply `companyId` isolation and user access scope on every business-data query and mutation.
- Restrict approval access to related submitters, approvers, and reference users.
- Enforce DTO validation, common API responses/errors, and centralized logging.
- Use environment-based configuration; do not commit secrets or log tokens/passwords.
- Implement audit fields and `deleteYn` soft deletes as defined by the database spec.
- Use TypeORM migrations; disable schema synchronization outside local development.
- Apply common pagination (`page`, `limit`) and filtering (`searchType`, `searchVal`).
- Enforce document statuses and allow update/delete only while status is `D`.
- Generate unique monthly document numbers by company and module: `{companyCode}-{moduleCode}-{YYYYMM}-{serial}`.
- Use database transactions for document workflows, numbering, and inventory updates.
- On inventory confirmation, atomically update stock and ledger using moving-average valuation.
- Enforce monthly inventory closing locks on all affected transactions.
- Validate company ownership and references for related records and attachments.
- Use access and refresh JWTs; hash passwords and support refresh-token rotation/revocation.

## Frontend Requirements

- Use a shared API client with base URL, timeout, JWT handling, and common error handling.
- Keep frontend state simple at this stage; add a state library only when repeated cross-page state needs it.
- Provide app shell, sidebar, top bar, toast messages, pagination, and common filters.
- Keep API authorization authoritative; UI permissions are not a security boundary.
- Use Tailwind CSS as the primary styling system.
- Use direct Tailwind layout classes for grids and spans, such as `grid`, `grid-cols-4`, and `col-span-2`; do not create unnecessary grid abstraction components.
- Standardize text sizes: input labels, table text, and button text use `text-xs`; section and middle-level titles use `text-sm`; page titles use `text-base` or `text-lg` only when needed.
- Standardize button sizes, variants, and action order through shared button components.
- Standardize page shells for list, form, create, edit, and view modes.
- Form pages must support `create`, `edit`, and `view` modes, with controls read-only or disabled in view mode.
- Each process module form must be able to embed approval submission content when approval is required.
- Use Tiptap JSON for approval content; do not trust submitted HTML.
- Generate reports from dedicated printable templates, not React screen printouts.

## Infrastructure

- Deploy on customer-controlled on-premise infrastructure; isolate data by company.
- Separate frontend, API, PostgreSQL, and persistent file storage components.
- Serve frontend assets through a web server/reverse proxy; route API requests to NestJS.
- Use HTTPS in deployed environments and least-privilege service/database credentials.
- Support local, test/CI, and production configurations through environment variables.
- Store files locally or in MinIO-compatible storage; configure size/type limits by environment.
- Use containers/Compose for reproducible local development; production orchestration is deployment-specific.
- Apply database migrations as an explicit deployment step; persist database and file data.
- Back up PostgreSQL and attachments; periodically verify restoration.
- Provide health checks, structured logs, and monitoring for service, database, storage, and backups.
- Define production retention and recovery objectives with the deploying organization.

## Quality and Delivery

- Test authorization, tenant/access-scope filtering, document flows, numbering, inventory, and approvals.
- Run backend lint/build/unit/e2e checks and frontend lint/build checks in CI.
- Use isolated test data; never run automated tests against production.
