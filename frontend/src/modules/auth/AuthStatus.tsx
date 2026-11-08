import { Button } from '@/shared/ui/Button'
export function AuthStatus({
  loading,
  error,
  retry,
  onLogin,
}: {
  loading: boolean
  error: string
  retry: () => Promise<void>
  onLogin?: () => Promise<void>
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-xs text-slate-600">
      <div className="space-y-3 text-center">
        {loading ? (
          <p role="status">로그인 정보를 확인하고 있습니다...</p>
        ) : (
          <>
            <p role="alert">{error}</p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => void retry()}>다시 시도</Button>
              {onLogin && (
                <Button variant="secondary" onClick={() => void onLogin()}>
                  다시 로그인
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
