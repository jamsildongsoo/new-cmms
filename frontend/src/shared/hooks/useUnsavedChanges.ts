import { useCallback, useEffect } from 'react'

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return useCallback(
    () =>
      !dirty ||
      window.confirm(
        '저장하지 않은 변경사항이 있습니다. 목록으로 이동하시겠습니까?',
      ),
    [dirty],
  )
}
