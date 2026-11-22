import { todayDateInput, dateValue, monthInput } from '@/shared/lib/format'
import { formatStockValue } from '../common/report-format'
import { useMetadata } from '@/shared/metadata/metadata'

// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { DocumentAudit } from '@/shared/ui/DocumentAudit'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { ReportTable, type ReportColumn } from '../common/ReportTable'

import {
  monthlyClosingApi,
  type Period,
  type MonthlyReport,
} from './monthly-closing.api'
const monthlyWarehouseColumns: ReportColumn[] = [
  ['siteId', '사업장'],
  ['warehouseId', '창고'],
  ['materialId', '자재'],
  ['openingQuantity', '기초 수량'],
  ['openingAmount', '기초 금액'],
  ['receiptQuantity', '입고 수량'],
  ['receiptAmount', '입고 금액'],
  ['issueQuantity', '출고 증감'],
  ['issueAmount', '출고 금액 증감'],
  ['adjustQuantity', '조정 수량'],
  ['adjustAmount', '조정 금액'],
  ['closingQuantity', '기말 수량'],
  ['closingAmount', '기말 금액'],
]
export function MonthlyClosing() {
  const { numericPrecision } = useMetadata()
  const { hasPermission } = useAuth(),
    [month, setMonth] = useState(todayDateInput().slice(0, 7)),
    [selected, setSelected] = useState(
      dateValue(todayDateInput()).slice(0, 6),
    ),
    [report, setReport] = useState<MonthlyReport | null>(null),
    [periods, setPeriods] = useState<Period[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([
      monthlyClosingApi.monthly(selected),
      monthlyClosingApi.periods(),
    ])
      .then(([r, p]) => {
        if (active) {
          setReport(r)
          setPeriods(p)
        }
      })
      .catch((e) => active && setError(toMessage(e)))
    return () => {
      active = false
    }
  }, [selected])
  async function action(
    value: 'open' | 'unlock' | 'close',
    target = selected,
  ) {
    if (busy) return
    if (
      (value === 'unlock' || value === 'close') &&
      !window.confirm(
        value === 'unlock'
          ? '마감을 해제하시겠습니까? 정정하면 과거 기간 보고서도 변경됩니다.'
          : '해당 월의 재고 거래를 마감하시겠습니까?',
      )
    )
      return
    setBusy(true)
    setError('')
    try {
      const r = await monthlyClosingApi.periodAction(target, value)
      setReport(r)
      setSelected(target)
      setMonth(monthInput(target))
      setPeriods(await monthlyClosingApi.periods())
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }
  if (!hasPermission('MCLOSE:read')) return <Navigate to="/" replace />
  const canUpdate = hasPermission('MCLOSE:update'),
    period = report?.period
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-lg font-semibold">재고 월 마감 · 회사 전체</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={!report || busy}
            onClick={() =>
              printDocument({
                title: `월 수불 ${selected}`,
                fields: [['상태', period?.locked ? '마감' : '개시']],
                columns: monthlyWarehouseColumns.map((c) => c[1]),
                rows: (report?.warehouses ?? []).map((r) =>
                  monthlyWarehouseColumns.map((c) =>
                    formatStockValue(c[0], r[c[0]], numericPrecision),
                  ),
                ),
              })
            }
          >
            인쇄
          </Button>
          {canUpdate && (
            <>
              <Button
                variant="secondary"
                disabled={busy || Boolean(period?.locked)}
                onClick={() => void action('open')}
              >
                월 개시
              </Button>
              <Button
                disabled={busy || !period || period.locked}
                onClick={() => void action('close')}
              >
                마감
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !period?.locked}
                onClick={() => void action('unlock')}
              >
                마감 해제
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !report}
                onClick={() => void action('open', report!.nextMonth)}
              >
                다음 월 개시
              </Button>
            </>
          )}
        </div>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          setSelected(dateValue(month))
        }}
      >
        <Input
          aria-label="대상 월"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          required
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          조회
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs">
        {selected}:{' '}
        {period ? (period.locked ? '월 마감' : '개시') : '미개방'}{' '}
      </p>
      <p className="text-xs text-slate-600">
        회사별로 여러 월을 개시할 수 있습니다. 재고 처리 시 전기월의 마감
        여부를 확인합니다. 마감은 거래 잠금만 수행하며 기간 수불은 확정
        전표에서 조회합니다. 수령 대기는 집계에서 제외합니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <Button
            key={p.yearMonth}
            variant="secondary"
            onClick={() => {
              setSelected(p.yearMonth)
              setMonth(monthInput(p.yearMonth))
            }}
          >
            {p.yearMonth} {p.locked ? '마감' : '개시'}{' '}
          </Button>
        ))}
      </div>
      <ReportTable
        title="창고별 월 수불 (수량·금액)"
        rows={report?.warehouses ?? []}
        columns={monthlyWarehouseColumns}
      />
      {period && <DocumentAudit record={period} />}
    </section>
  )
}
