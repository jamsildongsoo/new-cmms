// 프런트 전용 참고값. 입력·목록·검색에서 함께 사용한다.
// 백엔드는 priorityCode를 문자열로 저장하며 코드 그룹 조회나 허용값 검증을 하지 않는다.
export const PRIORITIES = [
  { value: '상', label: '상' },
  { value: '중', label: '중' },
  { value: '하', label: '하' },
] as const
