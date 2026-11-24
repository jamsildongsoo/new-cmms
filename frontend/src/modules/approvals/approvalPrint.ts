import { getAttachmentItems } from '@/modules/attachments'
import { printDocument } from '@/shared/lib/print'
import type { Approval } from './approvals.api'
import { formatDate, stepStatus } from './approvalForm'

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  )
}

export async function printApprovalDetail(
  approval: Approval,
  stepLabels: Record<string, string>,
) {
  const steps = [...approval.steps].sort(
    (a, b) =>
      Number(a.type === 'REFERENCE') - Number(b.type === 'REFERENCE') ||
      a.stepNo - b.stepNo,
  )
  const lineRows = steps.map((step) => `
    <tr>
      <td>${escapeHtml(step.userName || step.userId)}</td>
      <td>${escapeHtml(step.deptName || step.deptId || '-')}</td>
      <td>${escapeHtml(step.position || '-')}</td>
      <td>${escapeHtml(step.title || '-')}</td>
      <td>${escapeHtml(stepLabels[step.type] ?? step.type)}</td>
      <td>${escapeHtml(stepStatus(step))}</td>
      <td>${escapeHtml(step.type === 'REFERENCE' ? '-' : formatDate(step.actedAt) || '-')}</td>
      <td>${escapeHtml(step.comment || '-')}</td>
    </tr>`).join('')
  const attachmentGroups = [
    ...new Set([
      ...(approval.sourceAttachmentIds ?? []),
      ...(approval.attachmentId ? [approval.attachmentId] : []),
    ]),
  ]
  const files = (await Promise.all(
    attachmentGroups.map((attachmentId) => getAttachmentItems(attachmentId)),
  )).flat()
  const attachmentRows = files.length
    ? files.map((file, index) => `
        <tr><td>${index + 1}</td><td>${escapeHtml(file.originalName)}</td></tr>`).join('')
    : '<tr><td colspan="2">첨부파일 없음</td></tr>'

  printDocument({
    title: approval.title,
    landscape: true,
    fields: [
      ['문서번호', approval.approvalId],
      ['관리번호', approval.documentNo || '-'],
    ],
    htmlBeforeContent: `
      <section><h2>결재선</h2>
      <table><thead><tr>
        <th>이름</th><th>부서</th><th>직급</th><th>직책</th>
        <th>유형</th><th>상태</th><th>일시</th><th>의견</th>
      </tr></thead><tbody>${lineRows || '<tr><td colspan="8">결재선 없음</td></tr>'}</tbody></table>
      </section><section><h2>본문</h2>`,
    contentJson: approval.contentJson,
    htmlAfterContent: `
      </section><section><h2>첨부</h2>
      <table><thead><tr><th style="width:50px">순서</th><th>파일명</th></tr></thead>
      <tbody>${attachmentRows}</tbody></table></section>`,
  })
}
