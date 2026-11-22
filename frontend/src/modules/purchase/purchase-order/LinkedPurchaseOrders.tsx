// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { formatDateTime } from '@/shared/lib/format'
import {
  purchaseOrderApi,
  type LinkedPurchaseOrder,
} from './purchase-order.api'

// 확인용 연결 이력이다. 기존 발주 상태나 수량으로 추가 발주를 차단하지 않는다.
export function LinkedPurchaseOrders({ requestId }: { requestId: string }) {
  const { hasPermission } = useAuth()
  const allowed = hasPermission('PURORD:read')
  const [result, setResult] = useState<{
    id: string
    rows: LinkedPurchaseOrder[]
    error: string
  } | null>(null)
  useEffect(() => {
    if (!allowed) return
    let active = true
    purchaseOrderApi
      .linkedOrders(requestId)
      .then((rows) => {
        if (active) setResult({ id: requestId, rows, error: '' })
      })
      .catch((e) => {
        if (active) setResult({ id: requestId, rows: [], error: toMessage(e) })
      })
    return () => {
      active = false
    }
  }, [requestId, allowed])
  if (!allowed) return null
  const current = result?.id === requestId ? result : null
  return (
    <section className="space-y-2 text-xs">
      <h2 className="text-base font-semibold">연결 발주 이력</h2>
      {!current ? (
        <p>불러오는 중…</p>
      ) : current.error ? (
        <p role="alert">{current.error}</p>
      ) : !current.rows.length ? (
        <p>연결된 발주가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {current.rows.map((row) => (
            <li key={row.orderId} className="flex flex-wrap items-center gap-2">
              <Link
                className="text-blue-700 underline"
                to={`/purchase-order/${encodeURIComponent(row.orderId)}`}
              >
                {row.orderId}
              </Link>
              <span>
                {row.documentNo} {row.title}
              </span>
              <StatusBadge status={row.status} />
              <span>{formatDateTime(row.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
