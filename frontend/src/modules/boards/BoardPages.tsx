import { Pagination } from '@/shared/ui/Pagination'
import { formatDateTime } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { AttachmentManager } from '@/modules/attachments'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { printDocument } from '@/shared/lib/print'
import { toMessage } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { DataTable } from '@/shared/ui/DataTable'
import { TypedSearchForm } from '@/shared/ui/TypedSearchForm'
import {
  boardApi,
  type BoardDetail,
  type BoardComment,
  type BoardPage,
} from './boards.api'

const textareaClass =
  'min-h-24 w-full border border-slate-300 p-2 text-sm disabled:bg-slate-50'
export function BoardListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState(''),
    [searchType, setSearchType] = useState('title'),
    [filter, setFilter] = useState(''),
    [filterType, setFilterType] = useState('title'),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0)
  const [result, setResult] = useState<BoardPage>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  })
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    boardApi
      .list(filter, page, filterType)
      .then((data) => {
        if (active) {
          setResult(data)
          setError('')
        }
      })
      .catch((e) => {
        if (!active) return
        setResult({ items: [], total: 0, page, limit: 20 })
        setError(toMessage(e))
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [filter, filterType, page, reload])
  const print = () =>
    printDocument({
      title: '게시판 목록',
      columns: ['제목', '작성자', '작성일'],
      rows: result.items.map((r) => [
        r.title,
        r.createdBy,
        formatDateTime(r.createdAt),
      ]),
    })
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between">
        <h1 className="text-lg font-semibold">게시판</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || Boolean(error)}
            onClick={print}
          >
            인쇄
          </Button>
          <Button onClick={() => navigate('/boards/new')}>
            신규 작성
          </Button>
        </div>
      </div>
      <TypedSearchForm
        options={[{ value: 'title', label: '제목' }, { value: 'content', label: '본문' },
          { value: 'createdBy', label: '작성자' }]}
        searchType={searchType} onSearchTypeChange={setSearchType}
        search={search} onSearchChange={setSearch} loading={loading}
        onSubmit={(event) => {
          event.preventDefault(); setLoading(true); setPage(1);
          setFilter(search.trim()); setFilterType(searchType); setReload((value) => value + 1)
        }}
        onReset={() => {
          setSearch(''); setSearchType('title'); setLoading(true); setPage(1);
          setFilter(''); setFilterType('title'); setReload((value) => value + 1)
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[750px]">
          <DataTable
            rows={loading || error ? [] : result.items}
            gridTemplateColumns="minmax(200px,1fr) 120px 180px"
            emptyText={
              loading
                ? '불러오는 중…'
                : error
                  ? '조회에 실패했습니다.'
                  : '등록된 게시글이 없습니다.'
            }
            columns={[
              {
                key: 'title',
                label: '제목',
                render: (r) => (
                  <Link
                    className="text-blue-700 underline"
                    to={`/boards/${r.boardId}`}
                  >
                    {r.title}
                  </Link>
                ),
              },
              {
                key: 'createdBy',
                label: '작성자',
                render: (r) => r.createdBy,
              },
              {
                key: 'createdAt',
                label: '작성일',
                render: (r) => formatDateTime(r.createdAt),
              },
            ]}
          />
        </div>
      </div>
      <Pagination
        page={page}
        limit={result.limit}
        total={result.total}
        loading={loading}
        error={Boolean(error)}
        onChange={(page) => {
          setLoading(true)
          setPage(page)
        }}
      />
    </section>
  )
}

export function BoardFormPage() {
  const { boardId } = useParams()
  return <BoardEditor key={boardId ?? 'new'} id={boardId} />
}
const empty = {
  title: '',
  content: '',
  attachmentId: null as string | null,
}
function BoardEditor({ id }: { id?: string }) {
  const navigate = useNavigate(),
    { user } = useAuth()

  const [record, setRecord] = useState<BoardDetail | null>(null),
    [form, setForm] = useState(empty)
  const [baseline, setBaseline] = useState(JSON.stringify(empty)),
    [ready, setReady] = useState(!id)
  const [saving, setSaving] = useState(false),
    [attachmentBusy, setAttachmentBusy] = useState(false),
    [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const confirmLeave = useUnsavedChanges(JSON.stringify(form) !== baseline)
  useEffect(() => {
    let active = true
    if (id)
      boardApi
        .get(id)
        .then((row) => {
          if (!active) return
          const loaded = {
            title: row.title,
            content: row.content,
            attachmentId: row.attachmentId,
          }
          setRecord(row)
          setForm(loaded)
          setBaseline(JSON.stringify(loaded))
          setReady(true)
        })
        .catch((e) => active && setError(toMessage(e)))
    return () => {
      active = false
    }
  }, [id])
  const owner = record ? record.createdBy === user?.userId : !id
  const blocked = saving || attachmentBusy || !ready
  async function save() {
    if (!owner || blocked || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError('')
    try {
      const saved = record
        ? await boardApi.update(record.boardId, form)
        : await boardApi.create(form)
      const loaded = {
        title: saved.title,
        content: saved.content,
        attachmentId: saved.attachmentId,
      }
      setRecord(saved)
      setForm(loaded)
      setBaseline(JSON.stringify(loaded))
      if (!id) navigate(`/boards/${saved.boardId}`, { replace: true })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  async function remove() {
    if (
      !record ||
      !owner ||
      blocked ||
      record.comments.length ||
      !window.confirm('게시글을 삭제하시겠습니까?')
    )
      return
    setSaving(true)
    setError('')
    try {
      await boardApi.remove(record.boardId)
      navigate('/boards')
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
    }
  }
  return (
    <section className="space-y-3">
      <form
        ref={formRef}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">
            게시글 {record ? '조회' : '작성'}
          </h1>
          <div className="page-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={saving || attachmentBusy}
              onClick={() => {
                if (confirmLeave()) navigate('/boards')
              }}
            >
              목록
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!record || blocked}
              onClick={() =>
                record &&
                printDocument({
                  title: form.title,
                  fields: [
                    ['작성자', record.createdBy],
                    ['작성일', formatDateTime(record.createdAt)],
                  ],
                  text: form.content,
                })
              }
            >
              인쇄
            </Button>
            {owner && record && (
              <Button
                className="sm:ml-2"
                type="button"
                variant="danger"
                disabled={blocked || record.comments.length > 0}
                title={
                  record.comments.length
                    ? '댓글이 있는 게시글은 삭제할 수 없습니다.'
                    : undefined
                }
                onClick={() => void remove()}
              >
                삭제
              </Button>
            )}
            {owner && (
              <Button type="submit" disabled={blocked}>
                저장
              </Button>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {record && (
          <p className="text-xs text-slate-500">
            작성자: {record.createdBy} · 작성일:{' '}
            {formatDateTime(record.createdAt)}
            {record.updatedAt &&
              ` · 수정일: ${formatDateTime(record.updatedAt)}`}
          </p>
        )}
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          제목
          <Input
            value={form.title}
            required
            maxLength={200}
            readOnly={!owner}
            disabled={blocked}
            onChange={(event) =>
              setForm((f) => ({ ...f, title: event.target.value }))
            }
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          본문
          <textarea
            value={form.content}
            required
            maxLength={50000}
            readOnly={!owner}
            disabled={blocked}
            rows={12}
            className={textareaClass}
            onChange={(event) =>
              setForm((f) => ({ ...f, content: event.target.value }))
            }
          />
        </label>
        <AttachmentManager
          attachmentId={form.attachmentId}
          refModule="BORD"
          refId={record?.boardId ?? null}
          disabled={!owner || blocked}
          onBusyChange={setAttachmentBusy}
          onAttachmentIdChange={(attachmentId) =>
            setForm((f) => ({ ...f, attachmentId }))
          }
          onError={setError}
        />
        {owner && Boolean(record?.comments.length) && (
          <p className="text-xs text-slate-500">
            댓글이 있는 게시글은 삭제할 수 없습니다. 본문은 수정할 수
            있습니다.
          </p>
        )}
      </form>
      {record ? (
        <Comments board={record} onChange={setRecord} />
      ) : (
        <p className="text-xs text-slate-500">
          게시글 저장 후 댓글을 작성할 수 있습니다.
        </p>
      )}
    </section>
  )
}

function Comments({
  board,
  onChange,
}: {
  board: BoardDetail
  onChange: (board: BoardDetail) => void
}) {
  const { user } = useAuth()
  const [content, setContent] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null),
    [editContent, setEditContent] = useState('')
  async function change(
    action: () => Promise<unknown>,
    after: () => void,
  ) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await action()
      after()
      onChange(await boardApi.get(board.boardId))
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const remove = (comment: BoardComment) => {
    if (window.confirm('댓글을 삭제하시겠습니까?'))
      void change(
        () => boardApi.removeComment(board.boardId, comment.commentId),
        () => setEditing(null),
      )
  }
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5">
      <h2 className="text-base font-semibold">
        댓글 ({board.comments.length})
      </h2>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!board.comments.length && (
        <p className="text-xs text-slate-500">등록된 댓글이 없습니다.</p>
      )}
      {board.comments.map((comment) => (
        <article
          key={comment.commentId}
          className="space-y-2 border-b pb-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {comment.createdBy} · {formatDateTime(comment.createdAt)}
              {comment.updatedAt && ' (수정됨)'}
            </p>
            {comment.createdBy === user?.userId &&
              editing !== comment.commentId && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditContent(comment.content)
                      setEditing(comment.commentId)
                    }}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => remove(comment)}
                  >
                    삭제
                  </Button>
                </div>
              )}
          </div>
          {editing === comment.commentId ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (editContent.trim())
                  void change(
                    () =>
                      boardApi.updateComment(
                        board.boardId,
                        comment.commentId,
                        editContent,
                      ),
                    () => setEditing(null),
                  )
              }}
            >
              <textarea
                aria-label="댓글 수정"
                className={textareaClass}
                value={editContent}
                required
                maxLength={5000}
                disabled={busy}
                onChange={(event) => setEditContent(event.target.value)}
              />
              <div className="page-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !editContent.trim()}
                >
                  저장
                </Button>
              </div>
            </form>
          ) : (
            <p className="whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}
        </article>
      ))}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (content.trim())
            void change(
              () => boardApi.createComment(board.boardId, content),
              () => setContent(''),
            )
        }}
      >
        <textarea
          aria-label="댓글 입력"
          className={textareaClass}
          placeholder="댓글을 입력하세요"
          value={content}
          required
          maxLength={5000}
          disabled={busy}
          onChange={(event) => setContent(event.target.value)}
        />
        <Button type="submit" disabled={busy || !content.trim()}>
          댓글 등록
        </Button>
      </form>
    </section>
  )
}
