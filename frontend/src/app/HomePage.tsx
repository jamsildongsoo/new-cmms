import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { menuGroups } from '@/layout/menu'
export function HomePage() {
  const { user } = useAuth()
  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">홈</h1>
      <p className="text-xs text-slate-600">
        회사 {user?.companyId} · 사용자 {user?.userId} · 사업장{' '}
        {user?.siteId ?? '-'} · 부서 {user?.deptId ?? '-'}
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {menuGroups
          .filter((g) => g.label !== '홈')
          .map((group) => (
            <section
              key={group.label}
              className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
            >
              <h2 className="text-base font-semibold">{group.label}</h2>
              <div className="grid gap-1">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="p-2 text-xs text-blue-700 hover:bg-slate-50"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
      </div>
    </section>
  )
}
