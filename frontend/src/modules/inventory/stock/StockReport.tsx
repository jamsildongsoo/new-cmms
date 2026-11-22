import { dateValue } from '@/shared/lib/format'
import { formatStockValue } from '../common/report-format'

// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { SearchActions } from '@/shared/ui/SearchActions'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { ReportTable, type ReportColumn } from '../common/ReportTable'
import type { ReportRow } from '../common/report.types'
import { inventoryLabel, useMetadata } from '@/shared/metadata/metadata'
import { stockApi } from './stock.api'
const warehouseColumns: ReportColumn[] = [
  ['siteId', '사업장'],
  ['warehouseId', '창고'],
  ['materialId', '자재'],
  ['quantity', '수량'],
  ['amount', '금액'],
  ['averagePrice', '평균단가'],
]
const siteColumns: ReportColumn[] = [
  ['siteId', '사업장'],
  ['materialId', '자재'],
  ['quantity', '사업장 수량'],
  ['amount', '평가금액'],
  ['averagePrice', '평균단가'],
]
const ledgerColumns: ReportColumn[] = [
  ['postingDate', '전기일'],
  ['typeLabel', '유형'],
  ['siteId', '사업장'],
  ['warehouseId', '창고'],
  ['materialId', '자재'],
  ['quantityChange', '수량 증감'],
  ['amountChange', '금액 증감'],
  ['balanceQuantity', '창고 잔량'],
  ['balanceAmount', '창고 잔액'],
]
export function StockReport({ ledger = false }: { ledger?: boolean }) {
  const { inventoryVariants, numericPrecision } = useMetadata()
  const { hasPermission } = useAuth(),
    [filter, setFilter] = useState({
      siteId: '',
      warehouseId: '',
      materialId: '',
      from: '',
      to: '',
    }),
    [query, setQuery] = useState<Record<string, string>>({}),
    [data, setData] = useState<{
      warehouses: ReportRow[]
      sites: ReportRow[]
      ledger: ReportRow[]
    }>({ warehouses: [], sites: [], ledger: [] }),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const request = ledger
      ? stockApi.ledger(query).then((rows) => ({
          warehouses: [],
          sites: [],
          ledger: rows.map((r) => ({
            ...r,
            typeLabel: inventoryLabel(
              inventoryVariants,
              String(r.type),
              r.kind == null ? null : String(r.kind),
            ),
          })),
        }))
      : stockApi.balances(query).then((r) => ({ ...r, ledger: [] }))
    request
      .then((r) => active && setData(r))
      .catch((e) => {
        if (active) {
          setData({ warehouses: [], sites: [], ledger: [] })
          setError(toMessage(e))
        }
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [ledger, query, inventoryVariants])
  if (!hasPermission(ledger ? 'LEDGER:read' : 'STOCK:read'))
    return <Navigate to="/" replace />
  const print = () => {
    const cols = ledger ? ledgerColumns : siteColumns
    const rows = ledger ? data.ledger : data.sites
    printDocument({
      title: ledger ? '재고 수불장' : '사업장 재고평가',
      columns: cols.map((c) => c[1]),
      rows: rows.map((r) =>
        cols.map((c) => formatStockValue(c[0], r[c[0]], numericPrecision)),
      ),
    })
  }
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap justify-between">
        <h1 className="text-lg font-semibold">
          {ledger ? '재고 수불장' : '재고 현황'}
        </h1>
        <Button
          variant="secondary"
          disabled={loading || !!error}
          onClick={print}
        >
          인쇄
        </Button>
      </div>
      <form
        onReset={() => {
          setFilter({
            siteId: '',
            warehouseId: '',
            materialId: '',
            from: '',
            to: '',
          })
          setLoading(true)
          setError('')
          setQuery({})
        }}
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault()
          setLoading(true)
          setError('')
          setQuery(
            Object.fromEntries(
              Object.entries(filter)
                .filter(([, v]) => v)
                .map(([k, v]) => [
                  k,
                  k === 'from' || k === 'to' ? dateValue(v) : v,
                ]),
            ),
          )
        }}
      >
        {(['siteId', 'warehouseId', 'materialId'] as const).map(
          (key, i) => (
            <Input
              key={key}
              aria-label={['사업장', '창고', '자재'][i]}
              placeholder={['사업장 코드', '창고 코드', '자재번호'][i]}
              value={filter[key]}
              onChange={(e) =>
                setFilter((f) => ({ ...f, [key]: e.target.value }))
              }
            />
          ),
        )}
        {ledger &&
          (['from', 'to'] as const).map((key, i) => (
            <Input
              key={key}
              type="date"
              aria-label={i ? '종료일' : '시작일'}
              value={filter[key]}
              onChange={(e) =>
                setFilter((f) => ({ ...f, [key]: e.target.value }))
              }
            />
          ))}
        <SearchActions loading={loading} />
      </form>
      {error && <p role="alert">{error}</p>}
      {loading && <p>불러오는 중…</p>}
      {ledger ? (
        <>
          <ReportTable
            title="확정순번 기준 수불"
            rows={data.ledger}
            columns={ledgerColumns}
          />
          <div className="space-y-1 text-xs">
            {[
              ...new Set(
                data.ledger.map((r) => String(r.inventoryDocumentId)),
              ),
            ].map((id) => (
              <Link
                key={id}
                className="mr-3 text-blue-700 underline"
                to={`/inventory-document/${id}`}
              >
                원본 {id}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <ReportTable
            title="창고별 수량·금액"
            rows={data.warehouses}
            columns={warehouseColumns}
          />
          <p className="text-xs text-slate-500">
            수령 대기 재고는 창고·사업장 잔고에 포함하지 않습니다.
          </p>
          <ReportTable
            title="사업장별 평가"
            rows={data.sites}
            columns={siteColumns}
          />
        </>
      )}
    </section>
  )
}
