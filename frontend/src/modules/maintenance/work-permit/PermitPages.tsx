import { Pagination } from '@/shared/ui/Pagination'
import { dateInput, dateValue } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
// 유형·입력 항목 변경 시 백엔드 permit-template.ts/DTO/검증/approvalDraft와 permitPrint.ts를 함께 수정한다.
import { DocumentAudit } from '@/shared/ui/DocumentAudit'
import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { printDocument } from '@/shared/lib/print'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import {
  AttachmentManager,
  getAttachmentItems,
  type AttachmentItem,
} from '@/modules/attachments'
import { toMessage } from '@/shared/api/errors'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Field } from '@/shared/ui/Field'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { DataTable } from '@/shared/ui/DataTable'
import {
  permitApi,
  permitHttp,
  type PermitRecord,
  type PermitListItem,
  type PermitData,
  type PermitOptions,
  type PermitSection,
} from './permit.api'
import {
  printPermit,
  validatePermitPrint,
  permitDataLabels,
} from './permitPrint'
const permitStatusLabel = (status: string, request: boolean) =>
  ({
    D: '작성 중',
    P: request ? '신청 중' : '결재 중',
    C: request ? '신청 완료' : '발행 완료',
    R: '반려',
    X: '취소',
  })[status] ?? '상태 확인 필요'

const emptyData: PermitData = {
  title: '',
  applicationDate: '',
  applicantType: 'INTERNAL',
  applicantName: '',
  organization: '',
  phoneNumber: '',
  workType: 'INTERNAL',
  location: '',
  equipmentNo: '',
  equipmentName: '',
  startTime: '',
  endTime: '',
  summary: '',
}
const timeInput = (v: string) =>
  v ? `${dateInput(v.slice(0, 8))}T${v.slice(9, 11)}:00` : ''
const timeValue = (v: string) =>
  v ? v.slice(0, 10).replaceAll('-', '') + ':' + v.slice(11, 13) : ''
function message(e: unknown) {
  return e instanceof Error && !('response' in e)
    ? e.message
    : toMessage(e)
}
export function PermitList({ request = false }: { request?: boolean }) {
  return (
    <PermitListView
      key={request ? 'request' : 'permit'}
      request={request}
    />
  )
}
function PermitListView({ request = false }: { request?: boolean }) {
  const base = request ? '/work-permit-request' : '/work-permit',
    module = request ? 'PERREQ' : 'PERMIT'
  const { hasPermission } = useAuth(),
    navigate = useNavigate()
  const [rows, setRows] = useState<PermitListItem[]>([]),
    [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState({ page: 1, search: '' })
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    permitApi
      .list(base, { page: query.page, search: query.search || undefined })
      .then((data) => {
        if (!active) return
        setRows(data.items)
        setTotal(data.total)
        setLimit(data.limit)
        setError(null)
      })
      .catch((e) => {
        if (!active) return
        setRows([])
        setTotal(0)
        setError(message(e))
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [base, query])
  if (!hasPermission(`${module}:read`)) return <Navigate to="/" replace />
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap justify-between">
        <h1>{request ? '허가 요청서' : '작업 허가서'}</h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={loading || Boolean(error)}
            onClick={() =>
              printDocument({
                title: request ? '허가 요청서 목록' : '작업 허가서 목록',
                columns: [
                  '문서번호',
                  '관리번호',
                  '작업명',
                  '신청인',
                  '상태',
                ],
                rows: rows.map((r) => [
                  r.workPermitRequestId ?? r.workPermitId,
                  r.documentNo,
                  r.title,
                  r.applicantName,
                  r.status,
                ]),
              })
            }
          >
            현재 페이지 인쇄
          </Button>
          <Button
            disabled={!hasPermission(`${module}:create`)}
            onClick={() => navigate(`${base}/new`)}
          >
            신규 작성
          </Button>
        </div>
      </div>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault()
          setLoading(true)
          setQuery({ page: 1, search: search.trim() })
        }}
      >
        <Input
          aria-label="허가 문서 검색"
          placeholder="문서번호·관리번호·작업명"
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => {
            setSearch('')
            setLoading(true)
            setQuery({ page: 1, search: '' })
          }}
        >
          초기화
        </Button>
        <Button type="submit" disabled={loading}>
          검색
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      <DataTable<PermitListItem>
        gridTemplateColumns={
          request
            ? '200px 150px minmax(180px,1fr) 120px 90px 90px'
            : '200px 150px minmax(180px,1fr) 120px 90px'
        }
        rows={loading || error ? [] : rows}
        emptyText={
          loading
            ? '불러오는 중…'
            : error
              ? '조회에 실패했습니다.'
              : '등록된 문서가 없습니다.'
        }
        columns={[
          {
            key: 'systemDocumentId',
            label: '문서번호',
            render: (r) => r.workPermitRequestId ?? r.workPermitId,
          },
          {
            key: 'documentNo',
            label: '관리번호',
            render: (r) => r.documentNo,
          },
          {
            key: 'title',
            label: '작업명',
            render: (r) => (
              <Link
                className="text-blue-700 underline"
                to={`${base}/${request ? r.workPermitRequestId : r.workPermitId}`}
              >
                {r.title}
              </Link>
            ),
          },
          {
            key: 'applicant',
            label: '신청인',
            render: (r) => r.applicantName,
          },
          {
            key: 'status',
            label: '상태',
            render: (r) => permitStatusLabel(r.status, request),
          },
          ...(request
            ? [
                {
                  key: 'permit',
                  label: '작업허가',
                  render: (r: PermitListItem) =>
                    r.status === 'C' && hasPermission('PERMIT:create') ? (
                      <Button
                        onClick={() =>
                          navigate(
                            `/work-permit/new?requestId=${r.workPermitRequestId}`,
                          )
                        }
                      >
                        작업허가
                      </Button>
                    ) : null,
                },
              ]
            : []),
        ]}
      />
      <Pagination
        page={query.page}
        limit={limit}
        total={total}
        loading={loading}
        error={Boolean(error)}
        onChange={(page) => {
          setLoading(true)
          setQuery((value) => ({ ...value, page }))
        }}
      />
    </section>
  )
}
export function PermitForm({ request = false }: { request?: boolean }) {
  const { id } = useParams(),
    [params] = useSearchParams()
  return (
    <Editor
      key={`${request}:${id ?? 'new'}:${params.get('requestId') ?? ''}`}
      request={request}
      id={id}
      requestId={params.get('requestId')}
    />
  )
}
function Editor({
  request,
  id,
  requestId,
}: {
  request: boolean
  id?: string
  requestId: string | null
}) {
  const base = request ? '/work-permit-request' : '/work-permit',
    module = request ? 'PERREQ' : 'PERMIT'
  const navigate = useNavigate(),
    { user, hasPermission } = useAuth()
  const [row, setRow] = useState<PermitRecord | null>(null),
    [data, setData] = useState({ ...emptyData }),
    [documentNo, setNo] = useState(''),
    [attachmentId, setAttachment] = useState<string | null>(null),
    [source, setSource] = useState<PermitRecord | null>(null)
  const [options, setOptions] = useState<PermitOptions>({
      templates: [],
      names: {},
      documents: [],
      users: [],
    }),
    [sections, setSections] = useState<PermitSection[]>([]),
    [issuerId, setIssuer] = useState(''),
    [approverId, setApprover] = useState(''),
    [files, setFiles] = useState<PermitRecord['documentFiles']>([]),
    [items, setItems] = useState<AttachmentItem[]>([])
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [sourceBusy, setSourceBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [baseline, setBaseline] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const state = JSON.stringify({
    data,
    documentNo,
    attachmentId,
    sections,
    issuerId,
    approverId,
    files,
  })
  const confirmLeave = useUnsavedChanges(ready && state !== baseline)
  useEffect(() => {
    let active = true
    Promise.all([
      request ? Promise.resolve(null) : permitApi.options(),
      id ? permitApi.get(`${base}/${id}`) : Promise.resolve(null),
      requestId && !request
        ? permitApi.get(`/work-permit-request/${requestId}`)
        : Promise.resolve(null),
    ])
      .then(async ([opt, saved, src]) => {
        if (!active) return
        if (src && src.status !== 'C')
          throw new Error(
            '신청 완료로 확정된 요청서만 참조할 수 있습니다.',
          )
        if (opt) setOptions(opt)
        if (saved) {
          setRow(saved)
          setData(saved.data)
          setNo(saved.documentNo)
          setAttachment(saved.attachmentId)
          setSections(saved.sections ?? [])
          setIssuer(saved.issuerId ?? '')
          setApprover(saved.approverId ?? '')
          setFiles(saved.documentFiles ?? [])
          if (saved.refId) {
            const linked = await permitApi.get(
              `/work-permit-request/${saved.refId}`,
            )
            if (!active) return
            setSource(linked)
          }
        } else {
          if (src) {
            setSource(src)
            setData(src.data)
          }
          if (opt)
            setSections(opt.templates.filter((s) => s.type === 'GENERAL'))
        }
        const initial = {
          data: saved?.data ?? src?.data ?? emptyData,
          documentNo: saved?.documentNo ?? '',
          attachmentId: saved?.attachmentId ?? null,
          sections:
            saved?.sections ??
            opt?.templates.filter((s) => s.type === 'GENERAL') ??
            [],
          issuerId: saved?.issuerId ?? '',
          approverId: saved?.approverId ?? '',
          files: saved?.documentFiles ?? [],
        }
        setBaseline(JSON.stringify(initial))
        setReady(true)
      })
      .catch((e) => active && setError(message(e)))
    return () => {
      active = false
    }
  }, [base, id, request, requestId])
  useEffect(() => {
    let active = true
    if (!request) {
      Promise.all([
        attachmentId
          ? getAttachmentItems(attachmentId)
          : Promise.resolve([]),
        source?.attachmentId
          ? getAttachmentItems(source.attachmentId)
          : Promise.resolve([]),
      ])
        .then((v) => active && setItems(v.flat()))
        .catch((e) => active && setError(message(e)))
    }
    return () => {
      active = false
    }
  }, [attachmentId, busy, source?.attachmentId, request])
  if (!hasPermission(`${module}:${id ? 'read' : 'create'}`))
    return <Navigate to={base} replace />
  const readOnly = Boolean(
    row &&
    (row.status !== 'D' ||
      row.createdBy !== user?.userId ||
      !hasPermission(`${module}:update`)),
  )
  const blocked = !ready || saving || busy || sourceBusy,
    disabled = readOnly || blocked
  const body = () => ({
    documentNo,
    data,
    attachmentId,
    ...(!request
      ? {
          refModule: source ? 'PERREQ' : null,
          refId: source?.workPermitRequestId ?? null,
          permitTypes: sections.map((s) => s.type),
          sections,
          issuerId,
          approverId,
          documentFiles: files,
        }
      : {}),
  })
  const save = async (submit: boolean) => {
    if (disabled || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError(null)
    try {
      const payload = body()
      let saved = await permitApi.save(
        row
          ? `${base}/${request ? row.workPermitRequestId : row.workPermitId}`
          : base,
        payload,
        !row,
      )
      setRow(saved)
      setBaseline(state)
      if (submit) {
        if (request)
          saved = await permitApi.request(
            `${base}/${saved.workPermitRequestId}`,
          )
        else {
          await validatePermitPrint(
            saved,
            options.names,
            Object.fromEntries(
              options.users.map((u) => [u.value, u.label]),
            ),
          )
          const prefill = (
            await permitHttp.get(
              `/work-permit/${saved.workPermitId}/approval-draft`,
            )
          ).data
          navigate('/approvals/new', { state: { prefill } })
          return
        }
      }
      navigate(
        `${base}/${request ? saved.workPermitRequestId : saved.workPermitId}`,
        { replace: !row },
      )
      setRow(saved)
      setBaseline(state)
    } catch (e) {
      setError(message(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (
      !row ||
      disabled ||
      !hasPermission(`${module}:delete`) ||
      !window.confirm('삭제하시겠습니까?')
    )
      return
    setSaving(true)
    try {
      await permitApi.remove(
        `${base}/${request ? row.workPermitRequestId : row.workPermitId}`,
      )
      navigate(base)
    } catch (e) {
      setError(message(e))
      setSaving(false)
    }
  }
  const print = async () => {
    if (!row) return
    if (request) {
      printDocument({
        title: '허가 요청서',
        fields: [
          ['문서번호', row.workPermitRequestId ?? row.workPermitId],
          ['관리번호', row.documentNo],
          ...Object.entries(row.data).map(
            ([key, value]) =>
              [
                permitDataLabels[key as keyof PermitData] ?? key,
                value,
              ] as [string, string],
          ),
        ],
      })
      return
    }
    try {
      const result = (
        await permitHttp.get(`/work-permit/${row.workPermitId}/print-data`)
      ).data
      await printPermit(
        result.permit,
        options.names,
        result.approvals,
        Object.fromEntries(options.users.map((u) => [u.value, u.label])),
      )
    } catch (e) {
      setError(message(e))
    }
  }
  return (
    <form
      ref={formRef}
      data-readonly={readOnly}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void save(false)
      }}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <h1>
          {request ? '허가 요청서' : '작업 허가서'}{' '}
          {row && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
              {permitStatusLabel(row.status, request)}
            </span>
          )}
        </h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving || busy || sourceBusy}
            onClick={() => {
              if (confirmLeave()) navigate(base)
            }}
          >
            목록
          </Button>
          {
            <Button
              type="button"
              variant="secondary"
              disabled={!row || blocked}
              onClick={() => void print()}
            >
              {request || row?.status === 'C' ? '인쇄' : '인쇄 미리보기'}
            </Button>
          }
          {row && !readOnly && hasPermission(`${module}:delete`) && (
            <Button
              className="sm:ml-2"
              type="button"
              variant="danger"
              disabled={blocked}
              onClick={() => void remove()}
            >
              삭제
            </Button>
          )}
          {!readOnly && (
            <Button variant="secondary" disabled={blocked}>
              임시저장
            </Button>
          )}
          {!readOnly && (
            <Button
              type="button"
              disabled={blocked}
              onClick={() => void save(true)}
            >
              {request ? '신청' : '상신'}
            </Button>
          )}
        </div>
      </div>
      <DocumentIdField
        value={row?.workPermitRequestId ?? row?.workPermitId}
        documentNo={documentNo}
        onDocumentNoChange={(value) => setNo(value)}
        disabled={disabled}
        readOnly={readOnly}
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {!ready && <p>불러오는 중…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="사업장">
          <Input
            readOnly
            value={row ? (row.siteId ?? '') : (user?.siteId ?? '')}
          />
        </Field>
        <Field label="부서">
          <Input
            readOnly
            value={row ? (row.deptId ?? '') : (user?.deptId ?? '')}
          />
        </Field>
        {(
          [
            { key: 'title', label: '작업명', max: 100 },
            { key: 'applicationDate', label: '신청일', date: true },
            { key: 'applicantName', label: '신청인', max: 50 },
            { key: 'organization', label: '소속·시공사', max: 100 },
            {
              key: 'phoneNumber',
              label: '연락처',
              optional: true,
              max: 50,
            },
            { key: 'location', label: '작업지역', max: 100 },
            {
              key: 'equipmentNo',
              label: '설비번호',
              optional: true,
              max: 50,
            },
            {
              key: 'equipmentName',
              label: '설비명',
              optional: true,
              max: 100,
            },
            { key: 'startTime', label: '허가기간 시작', time: true },
            { key: 'endTime', label: '허가기간 종료', time: true },
          ] as {
            key: keyof PermitData
            label: string
            max?: number
            optional?: boolean
            date?: boolean
            time?: boolean
          }[]
        ).map((f) => (
          <Field key={f.key} label={f.label} required={!f.optional}>
            <Input
              type={f.date ? 'date' : f.time ? 'datetime-local' : 'text'}
              step={f.time ? 3600 : undefined}
              maxLength={f.max}
              required={!f.optional}
              value={
                f.date
                  ? dateInput(data[f.key])
                  : f.time
                    ? timeInput(data[f.key])
                    : data[f.key]
              }
              disabled={disabled}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  [f.key]: f.date
                    ? dateValue(e.target.value)
                    : f.time
                      ? timeValue(e.target.value)
                      : e.target.value,
                }))
              }
            />
          </Field>
        ))}
        <Field label="신청인 구분">
          <Select
            value={data.applicantType}
            disabled={disabled}
            onChange={(e) =>
              setData((d) => ({ ...d, applicantType: e.target.value }))
            }
          >
            <option value="INTERNAL">내부</option>
            <option value="EXTERNAL">외부</option>
          </Select>
        </Field>
        <Field label="작업 유형">
          <Select
            value={data.workType}
            disabled={disabled}
            onChange={(e) =>
              setData((d) => ({ ...d, workType: e.target.value }))
            }
          >
            <option value="INTERNAL">자체</option>
            <option value="OUTSOURCED">외주</option>
          </Select>
        </Field>
      </div>
      <Field label="작업개요" required>
        <Textarea
          required
          maxLength={250}
          rows={3}
          value={data.summary}
          disabled={disabled}
          onChange={(e) =>
            setData((d) => ({ ...d, summary: e.target.value }))
          }
        />
      </Field>

      {!request && (
        <>
          <h2>보충허가 필요 여부 (일반 필수)</h2>
          <div className="flex flex-wrap gap-3">
            {options.templates.map((t) => (
              <label key={t.type} className="text-xs">
                <input
                  type="checkbox"
                  checked={sections.some((s) => s.type === t.type)}
                  disabled={disabled || t.type === 'GENERAL'}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSections((s) => [...s, { ...t }])
                    else if (
                      window.confirm(
                        '해당 유형의 편집 내용을 제외하시겠습니까?',
                      )
                    )
                      setSections((s) =>
                        s.filter((v) => v.type !== t.type),
                      )
                  }}
                />{' '}
                {options.names[t.type]}
              </label>
            ))}
          </div>
          {sections.map((s, i) => (
            <section
              key={s.type}
              className="grid gap-2 border p-2 md:grid-cols-3"
            >
              <h3 className="md:col-span-3">{options.names[s.type]}</h3>
              {(
                [
                  ['safetyRequirements', '안전조치요구사항', 100],
                  ['specialRequirements', '특별요구사항', 60],
                  ['safetyReviewOpinion', '안전검토의견', 60],
                ] as const
              ).map(([key, label, max]) => (
                <Field key={key} label={label}>
                  <Textarea
                    rows={2}
                    required={key === 'safetyRequirements'}
                    maxLength={max}
                    value={s[key]}
                    disabled={disabled}
                    onChange={(e) =>
                      setSections((a) =>
                        a.map((v, n) =>
                          n === i ? { ...v, [key]: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
              ))}
            </section>
          ))}
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['발급자', issuerId, setIssuer],
              ['승인자', approverId, setApprover],
            ].map(([label, value, setter]) => (
              <Field key={String(label)} label={String(label)} required>
                <Select
                  required
                  disabled={disabled}
                  value={String(value)}
                  onChange={(e) =>
                    (setter as (v: string) => void)(e.target.value)
                  }
                >
                  <option value="">선택</option>
                  {options.users.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label} ({u.value})
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </>
      )}
      {source && (
        <section className="space-y-2">
          <Link to={`/work-permit-request/${source.workPermitRequestId}`}>
            허가 요청서 조회
          </Link>
          <AttachmentManager
            key={source.workPermitRequestId}
            attachmentId={source.attachmentId}
            refModule="PERREQ"
            refId={source.workPermitRequestId!}
            disabled
            onBusyChange={setSourceBusy}
            onAttachmentIdChange={() => undefined}
            onError={setError}
          />
        </section>
      )}
      <AttachmentManager
        attachmentId={attachmentId}
        refModule={module}
        refId={
          row
            ? request
              ? row.workPermitRequestId
              : row.workPermitId
            : null
        }
        disabled={disabled}
        onBusyChange={setBusy}
        onAttachmentIdChange={setAttachment}
        onError={setError}
      />
      {!request && (
        <section className="space-y-2">
          <h2>필수 첨부서류</h2>
          <p className="text-xs">
            해당 서류를 업로드한 뒤 실제 파일을 선택하십시오.
          </p>
          {options.documents.map((d) => {
            const chosen = files.find((f) => f.requirementId === d.id)
            return (
              <Field key={d.id} label={`${d.name} (필수)`}>
                <Select
                  disabled={disabled}
                  value={
                    chosen ? `${chosen.attachmentId}:${chosen.itemNo}` : ''
                  }
                  onChange={(e) => {
                    const item = items.find(
                      (v) =>
                        `${v.attachmentId}:${v.itemNo}` === e.target.value,
                    )
                    setFiles((v) => [
                      ...v.filter((f) => f.requirementId !== d.id),
                      ...(item
                        ? [
                            {
                              requirementId: d.id,
                              attachmentId: item.attachmentId,
                              itemNo: item.itemNo,
                            },
                          ]
                        : []),
                    ])
                  }}
                >
                  <option value="">실제 파일 선택</option>
                  {items.map((item) => (
                    <option
                      key={`${item.attachmentId}:${item.itemNo}`}
                      value={`${item.attachmentId}:${item.itemNo}`}
                    >
                      {item.originalName}
                    </option>
                  ))}
                </Select>
              </Field>
            )
          })}
        </section>
      )}
      {row && <DocumentAudit record={row} />}
    </form>
  )
}
