import { Button } from './Button'

/** 조회와 검색 상태는 화면이 관리하고 페이지 표시·이동 조건만 공유한다. */
export function Pagination({
  page,
  limit,
  total,
  loading = false,
  error = false,
  onChange,
}: {
  page: number
  limit: number
  total: number
  loading?: boolean
  error?: boolean
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <nav
      aria-label="목록 페이지"
      className="flex items-center justify-end gap-3 text-xs"
    >
      <span>
        {loading
          ? '불러오는 중…'
          : error
            ? '조회에 실패했습니다.'
            : `총 ${total}건 · ${page} / ${pages} 페이지`}
      </span>
      <Button
        variant="secondary"
        disabled={loading || error || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        이전
      </Button>
      <Button
        variant="secondary"
        disabled={loading || error || page * limit >= total}
        onClick={() => onChange(page + 1)}
      >
        다음
      </Button>
    </nav>
  )
}
