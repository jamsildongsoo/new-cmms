import type { RouteObject } from 'react-router-dom'
import { IdentityListPage } from './IdentityListPage'
import { IdentityFormPage } from './IdentityFormPage'
import type { Resource } from './identity.api'

export const identityRoutes: RouteObject[] = (
  ['users', 'roles', 'permissions'] as Resource[]
).flatMap((resource) => [
  {
    path: resource,
    element: <IdentityListPage key={`${resource}-list`} resource={resource} />,
  },
  {
    path: `${resource}/new`,
    element: (
      <IdentityFormPage
        key={`${resource}-create`}
        resource={resource}
        mode="create"
      />
    ),
  },
  {
    path: `${resource}/:id`,
    element: (
      <IdentityFormPage
        key={`${resource}-view`}
        resource={resource}
        mode="view"
      />
    ),
  },
  {
    path: `${resource}/:id/edit`,
    element: (
      <IdentityFormPage
        key={`${resource}-edit`}
        resource={resource}
        mode="edit"
      />
    ),
  },
])
