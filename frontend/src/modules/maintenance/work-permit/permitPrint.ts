/** 일반과 선택 보충 허가를 동일한 A4 양식의 별도 페이지로 만들고 현장 서명란은 빈칸으로 둔다. */
import type { PermitRecord } from './permit.api'
export const permitPrintCss = `@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:'Noto Sans CJK KR','Malgun Gothic',sans-serif;font-size:9pt;line-height:1.15;color:#000;margin:0}h1{font-size:17pt;text-align:center;margin:0 0 3mm}h2{font-size:10pt;margin:1.5mm 0 .7mm}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #333;padding:.7mm;overflow-wrap:anywhere;white-space:pre-wrap;vertical-align:middle}th{font-weight:600;background:#eee}p{margin:1mm 0}.blank{height:8mm}.note{font-size:8pt}section{break-inside:avoid;margin-bottom:1.5mm} .stamp{font-size:8pt}.permit-page{break-after:page}.permit-page:last-child{break-after:auto}`
export function permitPrintHtml(
  row: PermitRecord,
  names: Record<string, string>,
  _approvals: { userId: string; actedAt: string }[],
  _userNames: Record<string, string> = {},
) {
  // 시스템 결재 이력은 발행 검증에 사용하고 인쇄 서명 칸은 자필 작성용으로 비운다.
  void _approvals
  void _userNames
  const esc = (v: unknown) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c]!,
    )
  const cell = (value: unknown) => `<td>${esc(value)}</td>`
  const data = row.data
  const types = [
    'GENERAL',
    ...row.permitTypes.filter((type) => type !== 'GENERAL'),
  ]
  const titles = types.map((type) => `${names[type] ?? type}작업 허가서`)
  const columns =
    '<colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col style="width:35%"></colgroup>'
  const requirementColumns =
    '<colgroup><col style="width:15%"><col style="width:35%"><col style="width:35%"><col style="width:15%"></colgroup>'
  const confirmations = `<section><table aria-label="안전조치 및 작업완료 확인">${columns}<tr><th colspan="2">안전조치 확인</th><th colspan="2">작업완료 확인</th></tr>${['날짜/시간', '입회자', '작업자'].map((label) => `<tr class="blank"><th>${label}</th><td></td><th>${label}</th><td></td></tr>`).join('')}</table></section>`
  const supplements = Object.entries(names)
    .filter(([type]) => type !== 'GENERAL')
    .map(
      ([type, name]) =>
        `${row.permitTypes.includes(type) ? '☑' : '□'} ${esc(name)}`,
    )
    .join(' ')
  const pages = types
    .map((type, index) => {
      const sections = (row.sections ?? []).filter(
        (section) => section.type === type,
      )
      if (!sections.length)
        throw new Error(`${names[type] ?? type} 허가서의 내용이 없습니다.`)
      const title = titles[index]
      const text = (key: 'specialRequirements' | 'safetyReviewOpinion') =>
        sections.map((section) => section[key]).join('\n')
      const requirements = sections
        .map(
          (section) =>
            `<tr><th>${esc(names[section.type] ?? section.type)}</th><td colspan="2">${esc(section.safetyRequirements)}</td><td></td></tr>`,
        )
        .join('')
      return `<article class="permit-page" data-permit-type="${esc(type)}">
<h1>${esc(title)}</h1>
<section><h2>작업 정보</h2><table>${columns}
<tr><th>허가번호</th>${cell(row.workPermitId ?? row.workPermitRequestId ?? row.documentNo)}<th>유형</th>${cell(data.workType === 'INTERNAL' ? '자체' : '외주')}</tr>
<tr><th>작업명</th>${cell(data.title)}<th>작업지역</th>${cell(data.location)}</tr>
<tr><th>설비번호</th>${cell(data.equipmentNo)}<th>설비명</th>${cell(data.equipmentName)}</tr>
<tr><th>신청인 / 소속</th><td>${esc(data.applicantName)} / ${esc(data.organization)} / ${esc(data.phone)}</td><th>허가기간</th><td>${esc(data.startTime)} ~ ${esc(data.endTime)}</td></tr>
<tr><th>작업개요</th><td colspan="3">${esc(data.summary)}</td></tr>
<tr><th>보충허가</th><td colspan="3">${supplements}</td></tr></table></section>
<section><h2>안전조치 요구사항</h2><table>${requirementColumns}<tr><th>제목</th><th colspan="2">내용</th><th>확인</th></tr>${requirements}</table></section>
<section><table aria-label="특별요구사항 및 안전검토의견">${columns}<tr><th>특별요구사항</th>${cell(text('specialRequirements'))}<th>안전검토의견</th>${cell(text('safetyReviewOpinion'))}</tr></table></section>
<section><h2>가스 검침 — 현장 작성</h2><table><tr>${['가스명', '결과', '점검시간', '점검기기', '측정자', '확인자'].map((label) => `<th>${label}</th>`).join('')}</tr>${[0, 1].map(() => `<tr class="blank">${'<td></td>'.repeat(6)}</tr>`).join('')}</table></section>
${confirmations}
<section><table aria-label="발급·승인 서명">${columns}<tr class="blank"><th>발급자</th><td></td><th>승인자</th><td></td></tr></table></section>
<section><table aria-label="비고">${columns}<tr style="height:10mm"><th>비고</th><td colspan="3"></td></tr></table></section>
<section><h2>첨부서류</h2><p>작업계획서 ${row.documentFiles?.some((file) => file.requirementId === 'WORK_PLAN') ? '☑' : '□'} 위험성평가서 ${row.documentFiles?.some((file) => file.requirementId === 'RISK_ASSESSMENT') ? '☑' : '□'}</p></section>
</article>`
    })
    .join('')
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(titles.join(' / '))}</title><style>${permitPrintCss}</style></head><body>${pages}</body></html>`
}

async function preparedFrame(
  row: PermitRecord,
  names: Record<string, string>,
  approvals: { userId: string; actedAt: string }[],
  userNames: Record<string, string>,
) {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;left:-10000px;width:190mm;height:1px'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(permitPrintHtml(row, names, approvals, userNames))
  doc.close()
  await doc.fonts.ready
  const pages = [...doc.querySelectorAll<HTMLElement>('.permit-page')]
  if (
    pages.some(
      (page) =>
        Math.ceil(page.getBoundingClientRect().height) >
        Math.floor((277 / 25.4) * 96),
    )
  ) {
    frame.remove()
    throw new Error(
      '허가서 한 페이지가 A4를 초과합니다. 해당 유형의 요구사항과 의견 분량을 줄여 주세요.',
    )
  }
  return frame
}
export async function validatePermitPrint(
  row: PermitRecord,
  names: Record<string, string>,
  userNames: Record<string, string> = {},
) {
  const approvals = [row.issuerId, row.approverId].map((userId) => ({
    userId,
    actedAt: new Date().toISOString(),
  }))
  const frame = await preparedFrame(row, names, approvals, userNames)
  frame.remove()
}
export async function printPermit(
  row: PermitRecord,
  names: Record<string, string>,
  approvals: { userId: string; actedAt: string }[],
  userNames: Record<string, string> = {},
) {
  const frame = await preparedFrame(row, names, approvals, userNames)
  frame.contentWindow?.addEventListener('afterprint', () => frame.remove(), {
    once: true,
  })
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
}
