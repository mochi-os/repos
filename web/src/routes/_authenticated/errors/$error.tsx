import { createFileRoute } from '@tanstack/react-router'
import { ConfigDrawer } from '@mochi/web'
import { Header } from '@mochi/web'
import { ProfileDropdown } from '@mochi/web'
import { Search } from '@mochi/web'
import { ThemeSwitch } from '@mochi/web'
import { ForbiddenError } from '@mochi/web'
import { GeneralError } from '@mochi/web'
import { MaintenanceError } from '@mochi/web'
import { NotFoundError } from '@mochi/web'
import { UnauthorisedError } from '@mochi/web'

export const Route = createFileRoute('/_authenticated/errors/$error')({
  component: RouteComponent,
})

function RouteComponent() {
  const { error } = Route.useParams()

  const errorMap: Record<string, React.ComponentType> = {
    unauthorized: UnauthorisedError,
    forbidden: ForbiddenError,
    'not-found': NotFoundError,
    'internal-server-error': GeneralError,
    'maintenance-error': MaintenanceError,
  }
  const ErrorComponent = errorMap[error] || NotFoundError

  return (
    <>
      <Header fixed className='border-b'>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <div className='flex-1 [&>div]:h-full'>
        <ErrorComponent />
      </div>
    </>
  )
}
