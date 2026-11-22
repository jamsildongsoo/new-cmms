import { useEffect, useState, type ReactNode } from 'react'
import { http } from '@/shared/api/http'
import { toMessage } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { MetadataContext, type SystemMetadata } from './metadata'

/** 로그인 세션 동안 공통 고정 목록을 한 번 조회해 모든 업무 화면에서 공유한다. */
export function MetadataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SystemMetadata | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    http
      .get<SystemMetadata>('/system/metadata')
      .then(({ data }) => {
        if (active) setData(data)
      })
      .catch((e) => {
        if (active) setError(toMessage(e))
      })
    return () => {
      active = false
    }
  }, [attempt])
  if (!data)
    return (
      <div className="p-6" role="status">
        {error ? (
          <>
            <p role="alert">공통 코드 목록을 불러오지 못했습니다. {error}</p>
            <Button
              onClick={() => {
                setError('')
                setAttempt((n) => n + 1)
              }}
            >
              다시 시도
            </Button>
          </>
        ) : (
          '공통 코드 목록을 불러오는 중…'
        )}
      </div>
    )
  return (
    <MetadataContext.Provider value={data}>{children}</MetadataContext.Provider>
  )
}
