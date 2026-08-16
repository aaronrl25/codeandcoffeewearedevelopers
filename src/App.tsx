import { Suspense, lazy } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/Spinner'
import { RegisterPage } from './pages/RegisterPage'

// Organizer-only code — the admin UI, Firebase Auth and the xlsx export —
// stays out of the bundle attendees download on conference wifi.
const AdminRoute = lazy(() => import('./pages/AdminRoute'))

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RegisterPage />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AdminRoute />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

function RouteFallback() {
  return (
    <div className="flex justify-center py-24 text-espresso-300">
      <Spinner label="Loading organizer tools" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-espresso-50">Page not found</h1>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-amber-300"
      >
        Back to registration
      </Link>
    </div>
  )
}
