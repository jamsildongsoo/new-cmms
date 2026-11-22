import { Button } from './Button'

export function SearchActions({ loading = false }: { loading?: boolean }) {
  return (
    <div className="page-actions">
      <Button type="reset" variant="secondary" disabled={loading}>
        초기화
      </Button>
      <Button type="submit" disabled={loading}>
        검색
      </Button>
    </div>
  )
}
