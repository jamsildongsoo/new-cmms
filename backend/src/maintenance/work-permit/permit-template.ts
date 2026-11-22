// 기본 문구 템플릿이다. 항목·허가 유형 변경 시 dto/permit-data.dto.ts, permit-validation.ts, WorkPermitService.approvalDraft와 frontend/src/modules/maintenance/work-permit/{PermitPages.tsx,permitPrint.ts}를 함께 수정한다.
export const PERMIT_NAMES = {
  GENERAL: '일반',
  HOT_WORK: '화기',
  CONFINED_SPACE: '밀폐공간',
  WORK_AT_HEIGHT: '고소',
  ELECTRICAL: '전기',
  HEAVY_LIFTING: '양중',
  EXCAVATION: '굴착',
} as const;
export type PermitType = keyof typeof PERMIT_NAMES;
export interface PermitSection {
  type: PermitType;
  templateVersion: number;
  safetyRequirements: string;
  specialRequirements: string;
  safetyReviewOpinion: string;
}
const safety: Record<PermitType, string> = {
  GENERAL: '작업범위·작업자 교육·비상연락·통행로·사용 공구 상태 확인',
  HOT_WORK: '가연물 제거·소화설비·화재감시인·가스측정 요구',
  CONFINED_SPACE: '환기·가스측정·감시인·구조장비 준비 요구',
  WORK_AT_HEIGHT: '추락방지 설비·작업발판·하부 출입통제 확인',
  ELECTRICAL: '정전/활선 구분·잠금 및 표지·방전·보호구 확인',
  HEAVY_LIFTING: '장비·지반·인양 범위·신호수·출입통제 확인',
  EXCAVATION: '매설물·도면·굴착 범위·붕괴방지 조치 확인',
};
export const PERMIT_TEMPLATES: PermitSection[] = Object.entries(
  PERMIT_NAMES,
).map(([type, name]) => ({
  type: type as PermitType,
  templateVersion: 1,
  safetyRequirements: safety[type as PermitType],
  specialRequirements: `${name} 작업 현장별 추가 요구사항 검토`,
  safetyReviewOpinion: `${name} 위험요인·조치계획 검토 후 의견 보완`,
}));
export const REQUIRED_DOCUMENTS = [
  { id: 'WORK_PLAN', name: '작업계획서' },
  { id: 'RISK_ASSESSMENT', name: '위험성평가서' },
];
