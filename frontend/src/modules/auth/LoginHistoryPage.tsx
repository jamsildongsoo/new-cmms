// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import type { LoginHistoryItem, LoginHistoryQuery } from '@/shared/types/auth'
import { formatDateTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Field } from '@/shared/ui/Field'
import { SearchActions } from '@/shared/ui/SearchActions'
import { useAuth } from './useAuth'
import { getLoginHistory } from './auth.api'

const empty = {
  from: '',
  to: '',
  userId: '',
  result: '' as LoginHistoryQuery['result'],
}
const reasonLabels: Record<string, string> = {
  USER_NOT_ACTIVE: '사용자 없음 또는 사용 중지',
  INVALID_PASSWORD: '비밀번호 불일치',
  USER_CHANGED: '로그인 중 계정 정보 변경',
}

export function LoginHistoryPage() {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('LOGHIST:read')
  const [filter, setFilter] = useState(empty)
  const [query, setQuery] = useState<LoginHistoryQuery>({ page: 1 })
  const [data, setData] = useState({
    items: [] as LoginHistoryItem[],
    total: 0,
    limit: 20,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (canRead)
      getLoginHistory(query)
        .then((result) => {
          if (active) setData(result)
        })
        .catch((failure) => {
          if (active) setError(toMessage(failure))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    return () => {
      active = false
    }
  }, [query, canRead])
  if (!canRead) return <Navigate to="/" replace />
  const search = (next: LoginHistoryQuery) => {
    setError('')
    setLoading(true)
    setQuery(next)
  }
  const page = query.page || 1
  const pages = Math.max(1, Math.ceil(data.total / data.limit))
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">로그인 이력</h1>
          <p className="text-xs text-slate-500">
            현재 회사의 로그인 성공·실패 기록을 확인합니다. 일시는 한국 시간
            기준입니다.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => search({ ...query })}
        >
          새로고침
        </Button>
      </div>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault()
          search({ ...filter, page: 1 })
        }}
        onReset={() => {
          setFilter(empty)
          search({ page: 1 })
        }}
      >
        <Field label="시작일">
          <Input
            type="date"
            value={filter.from}
            max={filter.to || undefined}
            onChange={(event) =>
              setFilter((value) => ({ ...value, from: event.target.value }))
            }
          />
        </Field>
        <Field label="종료일">
          <Input
            type="date"
            value={filter.to}
            min={filter.from || undefined}
            onChange={(event) =>
              setFilter((value) => ({ ...value, to: event.target.value }))
            }
          />
        </Field>
        <Field label="사용자 ID">
          <Input
            value={filter.userId}
            maxLength={50}
            placeholder="사용자 ID 정확히 입력"
            onChange={(event) =>
              setFilter((value) => ({ ...value, userId: event.target.value }))
            }
          />
        </Field>
        <Field label="결과">
          <Select
            value={filter.result}
            onChange={(event) =>
              setFilter((value) => ({
                ...value,
                result: event.target.value as LoginHistoryQuery['result'],
              }))
            }
          >
            <option value="">전체 결과</option>
            <option value="success">성공</option>
            <option value="failure">실패</option>
          </Select>
        </Field>
        <SearchActions loading={loading} />
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      <p role="status" className="text-xs text-slate-500">
        {loading
          ? '불러오는 중…'
          : error
            ? '조회에 실패했습니다.'
            : `검색 결과 ${data.total.toLocaleString('ko-KR')}건`}
      </p>
      <DataTable
        rows={loading || error ? [] : data.items}
        gridTemplateColumns="180px 120px 80px 200px 150px minmax(240px,1fr)"
        emptyText={
          loading
            ? '불러오는 중…'
            : error
              ? '조회에 실패했습니다.'
              : '조회된 로그인 이력이 없습니다.'
        }
        columns={[
          {
            key: 'attemptedAt',
            label: '로그인 시각',
            render: (row) => formatDateTime(row.attemptedAt),
          },
          { key: 'userId', label: '사용자 ID', render: (row) => row.userId },
          {
            key: 'success',
            label: '결과',
            align: 'center',
            render: (row) => (
              <span
                className={`rounded-md border px-2 py-0.5 ${row.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}
              >
                {row.success ? '성공' : '실패'}
              </span>
            ),
          },
          {
            key: 'failureReason',
            label: '실패 사유',
            render: (row) =>
              row.failureReason
                ? reasonLabels[row.failureReason] || '인증 실패'
                : '-',
          },
          {
            key: 'ipAddress',
            label: '접속 IP',
            render: (row) => row.ipAddress || '-',
          },
          {
            key: 'userAgent',
            label: '브라우저·기기 정보',
            render: (row) => (
              <span title={row.userAgent || ''} className="block truncate">
                {row.userAgent || '-'}
              </span>
            ),
          },
        ]}
      />
      <nav
        aria-label="로그인 이력 페이지"
        className="page-actions text-xs text-slate-600"
      >
        <Button
          variant="secondary"
          disabled={loading || page <= 1}
          onClick={() => search({ ...query, page: page - 1 })}
        >
          이전
        </Button>
        <span>
          {page} / {pages} 페이지
        </span>
        <Button
          variant="secondary"
          disabled={loading || page >= pages}
          onClick={() => search({ ...query, page: page + 1 })}
        >
          다음
        </Button>
      </nav>
    </section>
  )
}
