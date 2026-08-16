import { AuthProvider } from '../lib/auth'
import { AdminPage } from './AdminPage'

/**
 * Entry point for the lazily loaded organizer bundle. The auth provider lives
 * here rather than in App so Firebase Auth is only fetched by organizers.
 */
export default function AdminRoute() {
  return (
    <AuthProvider>
      <AdminPage />
    </AuthProvider>
  )
}
