import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { ReportTable, type ReportColumn } from '../common/ReportTable'

import { today } from '../common/inventory.utils'
import {
  monthlyClosingApi,
  type Period,
  type MonthlyReport,
} from './monthly-closing.api'
const monthlyWarehouseColumns: ReportColumn[] = [
  ['siteId', '사업장'],
  ['warehouseId', '창고'],
  ['materialId', '자재'],
  ['openingQuantity', '기초'],
  ['receiptQuantity', '입고'],
  ['issueQuantity', '출고'],
  ['transferInQuantity', '이동 입고'],
  ['transferOutQuantity', '이동 출고'],
  ['adjustIncreaseQuantity', '조정 증가'],
  ['adjustDecreaseQuantity', '조정 감소'],
  ['closingQuantity', '기말'],
]
const monthlySiteColumns: ReportColumn[] = [
  ['siteId', '사업장'],
  ['materialId', '자재'],
  ['openingQuantity', '기초 수량'],
  ['openingAmount', '기초 금액'],
  ['receiptQuantity', '입고 수량'],
  ['receiptAmount', '입고 금액'],
  ['issueQuantity', '출고 수량'],
  ['issueAmount', '출고 금액'],
  ['adjustIncreaseAmount', '조정 증가액'],
  ['adjustDecreaseAmount', '조정 감소액'],
  ['closingQuantity', '기말 수량'],
  ['closingAmount', '기말 금액'],
  ['averagePrice', '평균단가'],
]
const transitColumns: ReportColumn[] = [
  ['siteId', '출발 사이트'],
  ['toSiteId', '도착 사이트'],
  ['materialId', '자재'],
  ['openingQuantity', '기초 수량'],
  ['dispatchedQuantity', '출발 수량'],
  ['receivedQuantity', '입고 수량'],
  ['closingQuantity', '이동 중 수량'],
  ['openingAmount', '기초 금액'],
  ['dispatchedAmount', '출발 금액'],
  ['receivedAmount', '입고 금액'],
  ['closingAmount', '이동 중 금액'],
]
export function MonthlyClosing() {
  const { hasPermission } = useAuth(),
    [month, setMonth] = useState(today().slice(0, 7)),
    [selected, setSelected] = useState(today().slice(0, 7).replace('-', '')),
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
  async function action(value: 'open' | 'unlock' | 'close', target = selected) {
    if (busy) return
    if (
      (value === 'unlock' || value === 'close') &&
      !window.confirm(
        value === 'unlock'
          ? 'Lock 해제 후 재고 처리하면 이 월과 후속 월 수불을 재생성해야 합니다. 해제하시겠습니까?'
          : '월 수불을 생성하고 마감하시겠습니까?',
      )
    )
      return
    setBusy(true)
    setError('')
    try {
      const r = await monthlyClosingApi.periodAction(target, value)
      setReport(r)
      setSelected(target)
      setMonth(target.slice(0, 4) + '-' + target.slice(4))
      setPeriods(await monthlyClosingApi.periods())
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }
  if (!hasPermission('monthly_closing:read')) return <Navigate to="/" replace />
  const canUpdate = hasPermission('monthly_closing:update'),
    period = report?.period
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-base font-semibold">재고 월 마감 · 회사 전체</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!report || busy}
            onClick={() =>
              printDocument({
                title: `월 수불 ${selected}`,
                fields: [
                  ['상태', period?.locked ? 'Lock' : 'Open'],
                  ['재생성 필요', period?.summaryDirty ? '예' : '아니오'],
                ],
                columns: monthlyWarehouseColumns.map((c) => c[1]),
                rows: (report?.warehouses ?? []).map((r) =>
                  monthlyWarehouseColumns.map((c) => String(r[c[0]] ?? '')),
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
                월 Open
              </Button>
              <Button
                disabled={busy || !period}
                onClick={() => void action('close')}
              >
                {period?.locked ? '수불 재생성' : '마감'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !period?.locked}
                onClick={() => void action('unlock')}
              >
                Lock 해제
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !report}
                onClick={() => void action('open', report!.nextMonth)}
              >
                차월 Open
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
          setSelected(month.replace('-', ''))
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
        {period ? (period.locked ? '마감(Lock)' : 'Open') : '미개방'}{' '}
        {period?.summaryDirty && ' · 수불 재생성 필요'} · 초안{' '}
        {report?.draftCount ?? 0}건
      </p>
      <p className="text-xs text-slate-600">
        회사별 여러 월을 Open할 수 있습니다. 재고 처리는 Posting 월의 Lock을
        검사합니다. Lock 해제·소급 처리 후에는 전월부터 순서대로 월 수불을
        재생성합니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <Button
            key={p.yearMonth}
            variant="secondary"
            onClick={() => {
              setSelected(p.yearMonth)
              setMonth(p.yearMonth.slice(0, 4) + '-' + p.yearMonth.slice(4))
            }}
          >
            {p.yearMonth} {p.locked ? 'Lock' : 'Open'}{' '}
            {p.summaryDirty ? '*' : ''}
          </Button>
        ))}
      </div>
      <ReportTable
        title="창고별 월 수불 (수량)"
        rows={report?.warehouses ?? []}
        columns={monthlyWarehouseColumns}
      />
      <ReportTable
        title="사이트별 월 수불 (수량·평가금액)"
        rows={report?.sites ?? []}
        columns={monthlySiteColumns}
      />
      <ReportTable
        title="사이트 간 이동 중 월 수불"
        rows={report?.transits ?? []}
        columns={transitColumns}
      />
      {period && (
        <p className="text-xs text-slate-500">
          등록 {period.createdBy} / {period.createdAt} · 수정{' '}
          {period.updatedBy ?? '-'} / {period.updatedAt ?? '-'}
        </p>
      )}
    </section>
  )
}
