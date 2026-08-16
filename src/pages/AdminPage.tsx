import { useCallback, useEffect, useMemo, useState } from 'react'
import { Spinner } from '../components/Spinner'
import { useAuth } from '../lib/auth'
import { exportCsv, exportXlsx } from '../lib/export'
import { listRegistrations } from '../lib/registrations'
import type { Registration } from '../types'
import { AdminLogin } from './AdminLogin'
import { isFirebaseConfigured } from '../lib/firebase'

type SortKey = 'newest' | 'oldest' | 'lastName'

export function AdminPage() {
  const { user, isAdmin, loading, signOutAdmin } = useAuth()

  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="text-xl font-semibold text-brand-navy">Firebase is not configured</h1>
        <p className="mt-3 text-sm text-brand-grey">
          Copy <code className="text-brand-blue">.env.example</code> to{' '}
          <code className="text-brand-blue">.env</code> and fill in your Firebase project settings,
          then restart the dev server.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-brand-grey">
        <Spinner label="Checking your session" />
      </div>
    )
  }

  if (!user) return <AdminLogin />

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="text-xl font-semibold text-brand-navy">No organizer access</h1>
        <p className="mt-3 text-sm text-brand-grey">
          {user.email} is signed in but is not an organizer on this event.
        </p>
        <button
          type="button"
          onClick={signOutAdmin}
          className="mt-6 rounded-lg border border-surface-line px-4 py-2.5 text-sm font-medium text-brand-navy transition-colors hover:border-brand-navy hover:text-brand-navy"
        >
          Sign out
        </button>
      </div>
    )
  }

  return <AttendeeDashboard />
}

function AttendeeDashboard() {
  const { user, signOutAdmin } = useAuth()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  async function runExport(format: 'xlsx' | 'csv') {
    if (exporting) return
    setExporting(format)
    setExportError(null)
    try {
      await (format === 'xlsx' ? exportXlsx(registrations) : exportCsv(registrations))
    } catch {
      setExportError(`Could not build the ${format.toUpperCase()} file. Please try again.`)
    } finally {
      setExporting(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRegistrations(await listRegistrations())
    } catch {
      setError('Could not load the attendee list. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dates = useMemo(
    () =>
      Array.from(new Set(registrations.map((r) => r.registrationDate).filter(Boolean))).sort((a, b) =>
        b.localeCompare(a),
      ),
    [registrations],
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = registrations.filter((r) => {
      if (dateFilter && r.registrationDate !== dateFilter) return false
      if (!needle) return true
      return `${r.firstName} ${r.lastName} ${r.email} ${r.phone} ${r.linkedinUrl} ${r.event}`
        .toLowerCase()
        .includes(needle)
    })

    return [...filtered].sort((a, b) => {
      if (sort === 'lastName') {
        return (
          a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' }) ||
          a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' })
        )
      }
      const comparison = a.createdAtIso.localeCompare(b.createdAtIso)
      return sort === 'oldest' ? comparison : -comparison
    })
  }, [registrations, search, dateFilter, sort])

  const filtersActive = Boolean(search.trim() || dateFilter)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl">
            Attendees
          </h1>
          <p className="mt-1 text-sm text-brand-grey">
            Signed in as {user?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={signOutAdmin}
          className="rounded-lg border border-surface-line px-3 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-navy hover:text-brand-navy"
        >
          Sign out
        </button>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total registrations" value={loading ? '—' : registrations.length} />
        <Stat label="Showing" value={loading ? '—' : visible.length} />
        <Stat label="Registration days" value={loading ? '—' : dates.length} />
      </dl>

      <section
        aria-label="Search, filter and export"
        className="mt-6 rounded-2xl border border-surface-line bg-surface-sunken p-4 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label htmlFor="attendee-search" className="sr-only">
              Search attendees by name, email, phone or LinkedIn URL
            </label>
            <input
              id="attendee-search"
              type="search"
              placeholder="Search by name, email, phone or LinkedIn URL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-surface-line bg-surface px-3 py-2.5 text-base text-brand-navy placeholder:text-brand-grey/70 hover:border-brand-grey/60 focus:border-brand-blue"
            />
          </div>

          <div>
            <label htmlFor="date-filter" className="sr-only">
              Filter by registration date
            </label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-surface-line bg-surface px-3 py-2.5 text-base text-brand-navy hover:border-brand-grey/60 focus:border-brand-blue sm:w-44"
            >
              <option value="">All dates</option>
              {dates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sort-order" className="sr-only">
              Sort attendees
            </label>
            <select
              id="sort-order"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full rounded-lg border border-surface-line bg-surface px-3 py-2.5 text-base text-brand-navy hover:border-brand-grey/60 focus:border-brand-blue sm:w-44"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="lastName">Last name A–Z</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void runExport('xlsx')}
            disabled={loading || exporting !== null || registrations.length === 0}
            className="flex items-center gap-2 rounded-lg bg-brand-crimson px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-crimson-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'xlsx' && <Spinner label="Preparing Excel file" />}
            Export Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => void runExport('csv')}
            disabled={loading || exporting !== null || registrations.length === 0}
            className="flex items-center gap-2 rounded-lg border border-surface-line px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-navy hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'csv' && <Spinner label="Preparing CSV file" />}
            Export CSV (.csv)
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-surface-line px-4 py-2.5 text-sm font-medium text-brand-grey transition-colors hover:border-brand-navy hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setDateFilter('')
              }}
              className="rounded-lg px-2 py-2.5 text-sm text-brand-grey underline underline-offset-4 transition-colors hover:text-brand-navy"
            >
              Clear filters
            </button>
          )}
          <p className="text-xs text-brand-grey">Exports always include every registration.</p>
        </div>

        <div aria-live="polite">
          {exportError && (
            <p role="alert" className="mt-3 text-sm text-brand-crimson-ink">
              {exportError}
            </p>
          )}
        </div>
      </section>

      <div aria-live="polite" className="mt-6">
        {loading && (
          <div className="flex justify-center py-16 text-brand-grey">
            <Spinner label="Loading attendees" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-2xl border border-brand-crimson/40 bg-brand-crimson/5 px-4 py-6 text-center"
          >
            <p className="text-sm text-brand-crimson-ink">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-lg border border-brand-crimson/40 px-4 py-2 text-sm font-medium text-brand-crimson-ink transition-colors hover:border-brand-crimson"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <p className="rounded-2xl border border-surface-line bg-surface-sunken px-4 py-16 text-center text-sm text-brand-grey">
            {registrations.length === 0
              ? 'No one has registered yet.'
              : 'No attendees match these filters.'}
          </p>
        )}

        {!loading && !error && visible.length > 0 && <AttendeeTable rows={visible} />}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-surface-line bg-surface-sunken px-4 py-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-brand-grey">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums text-brand-navy">{value}</dd>
    </div>
  )
}

function AttendeeTable({ rows }: { rows: Registration[] }) {
  return (
    <>
      {/* Cards on small screens: an eight-column table cannot be read on a phone. */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-surface-line bg-surface-sunken p-4">
            <p className="font-semibold text-brand-navy">
              {r.firstName} {r.lastName}
            </p>
            <a
              href={`mailto:${r.email}`}
              className="mt-1 block truncate text-sm text-brand-blue underline underline-offset-2"
            >
              {r.email}
            </a>
            {r.phone && (
              <a
                href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}
                className="mt-1 block text-sm text-brand-blue underline underline-offset-2"
              >
                {r.phone}
              </a>
            )}
            <ProfileLink url={r.linkedinUrl} />
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-brand-grey">
              <div>
                <dt className="text-brand-grey">Event</dt>
                <dd>{r.event}</dd>
              </div>
              <div>
                <dt className="text-brand-grey">Registered</dt>
                <dd className="tabular-nums">
                  {r.registrationDate} · {r.registrationTime}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-surface-line md:block">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Registered Code &amp; Coffee attendees at the WeAreDevelopers World Congress North America
          </caption>
          <thead className="bg-surface-sunken text-xs uppercase tracking-wide text-brand-grey">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                First Name
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Last Name
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Phone
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                LinkedIn URL
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Event
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Registration Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Registration Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-line">
            {rows.map((r) => (
              <tr key={r.id} className="bg-surface transition-colors hover:bg-surface-sunken">
                <td className="px-4 py-3 text-brand-navy">{r.firstName}</td>
                <td className="px-4 py-3 text-brand-navy">{r.lastName}</td>
                <td className="max-w-[16rem] px-4 py-3">
                  <a
                    href={`mailto:${r.email}`}
                    className="block truncate text-brand-blue underline underline-offset-2 hover:text-brand-crimson-ink"
                  >
                    {r.email}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.phone ? (
                    <a
                      href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}
                      className="text-brand-blue underline underline-offset-2 hover:text-brand-crimson-ink"
                    >
                      {r.phone}
                    </a>
                  ) : (
                    <span className="text-brand-grey">—</span>
                  )}
                </td>
                <td className="max-w-xs px-4 py-3">
                  <ProfileLink url={r.linkedinUrl} />
                </td>
                <td className="px-4 py-3 text-brand-grey">{r.event}</td>
                <td className="px-4 py-3 tabular-nums text-brand-grey">{r.registrationDate}</td>
                <td className="px-4 py-3 tabular-nums text-brand-grey">{r.registrationTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ProfileLink({ url }: { url: string }) {
  if (!url) return <span className="text-brand-grey">—</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-1 block truncate text-sm text-brand-blue underline underline-offset-2 hover:text-brand-crimson-ink"
    >
      {url.replace(/^https:\/\/www\./, '')}
    </a>
  )
}
