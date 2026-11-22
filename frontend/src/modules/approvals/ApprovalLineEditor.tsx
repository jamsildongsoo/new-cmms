// 결재 코드 원본: backend/src/approvals/approval.constant.ts.
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import type { ApprovalFormState, ApprovalFormStep } from './approvalForm'
import { changeStepType, stepFromUser } from './approvalForm'
import { UserSearchBox } from './UserSearchBox'

type LineState = Pick<ApprovalFormState, 'line' | 'references'>

export function ApprovalLineEditor({
  line,
  references,
  submitterId,
  locked = false,
  disabled = false,
  onChange,
  onError,
}: LineState & {
  submitterId: string
  locked?: boolean
  disabled?: boolean
  onChange: (value: LineState) => void
  onError: (message: string | null) => void
}) {
  const taken = [
    submitterId,
    ...line.map((step) => step.userId),
    ...references.map((step) => step.userId),
  ]
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (locked || target < 0 || target >= line.length) return
    const next = [...line]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ line: next, references })
  }
  const remove = (step: ApprovalFormStep) =>
    onChange({
      line: line.filter((item) => item.userId !== step.userId),
      references: references.filter((item) => item.userId !== step.userId),
    })

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3 md:col-span-2">
      <legend className="mb-2 text-base font-semibold text-slate-900">
        결재선
      </legend>
      <p className="text-xs text-slate-500">
        결재·합의는 순서대로 처리합니다. 참조자는 승인 완료 후 열람하며 결재
        차례에 포함되지 않습니다.
      </p>
      {locked && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          원문에서 지정한 결재선입니다. 결재자와 순서는 변경할 수 없으며,
          참조자만 추가·삭제할 수 있습니다.
        </p>
      )}
      <UserSearchBox
        placeholder={
          locked
            ? '사용자 ID 또는 이름으로 참조자 검색'
            : '사용자 ID 또는 이름으로 결재선에 추가'
        }
        excludeUserIds={taken}
        onSelect={(user) => {
          if (taken.includes(user.userId)) return
          const step = stepFromUser(user, locked ? 'REFERENCE' : 'APPROVER')
          onChange(
            locked
              ? { line, references: [...references, step] }
              : { line: [...line, step], references },
          )
          onError(null)
        }}
        onError={onError}
      />
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[580px] border-collapse text-xs">
          <thead className="bg-slate-50 text-sm text-slate-700">
            <tr>
              <th className="w-14 px-3 py-2 text-center font-medium">순서</th>
              <th className="px-3 py-2 text-left font-medium">사용자 / 부서</th>
              <th className="w-28 px-3 py-2 text-left font-medium">유형</th>
              <th className="w-32 px-3 py-2 text-right font-medium">조작</th>
            </tr>
          </thead>
          <tbody>
            {[...line, ...references].map((step, index) => {
              const isReference = step.type === 'REFERENCE'
              const name = step.userName || step.userId
              const fixed = locked && !isReference
              return (
                <tr
                  key={step.userId}
                  className={`border-t border-slate-100 ${isReference ? 'bg-slate-50/60' : 'bg-white'}`}
                >
                  <td className="px-3 py-2 text-center font-medium text-slate-600">
                    {isReference ? '—' : index + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">
                      {name}{' '}
                      <span className="font-normal text-slate-500">
                        ({step.userId})
                      </span>
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {[step.deptName, step.title, step.position]
                        .filter(Boolean)
                        .join(' / ')}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      aria-label={`${name} 유형`}
                      value={step.type}
                      disabled={locked}
                      onChange={(event) =>
                        onChange(
                          changeStepType(
                            { line, references },
                            step.userId,
                            event.target.value as ApprovalFormStep['type'],
                          ),
                        )
                      }
                    >
                      <option value={'APPROVER'}>결재</option>
                      <option value={'AGREE'}>합의</option>
                      <option value={'REFERENCE'}>참조</option>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1">
                      {!isReference && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`${name} 위로 이동`}
                            title="위로 이동"
                            disabled={fixed || index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`${name} 아래로 이동`}
                            title="아래로 이동"
                            disabled={fixed || index === line.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`${name} 제거`}
                        title="결재선에서 제거"
                        disabled={fixed}
                        onClick={() => remove(step)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {line.length + references.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  등록된 결재자가 없습니다. 사용자를 검색해 추가해 주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {line.length === 0 && references.length > 0 && (
        <p className="text-xs text-amber-800">
          참조자 외에 결재자 또는 합의자가 한 명 이상 필요합니다.
        </p>
      )}
    </fieldset>
  )
}
