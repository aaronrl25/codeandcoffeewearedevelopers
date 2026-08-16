import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EVENT_DATES, EVENT_LOCATION } from '../types'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-navy focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <header className="border-b border-surface-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span aria-hidden="true" className="text-lg">
              ☕
            </span>
            <span className="text-sm font-bold tracking-tight text-brand-navy">
              Code &amp; Coffee
            </span>
          </Link>
          <Link
            to="/admin"
            className="rounded-md px-2 py-1 text-sm font-medium text-brand-grey transition-colors hover:text-brand-navy"
          >
            Organizers
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-surface-line px-4 py-6 text-center text-xs text-brand-grey sm:px-6">
        <p className="font-medium text-brand-navy">
          Code &amp; Coffee · Community Partner
        </p>
        <p className="mt-1">
          WeAreDevelopers World Congress North America · {EVENT_DATES} · {EVENT_LOCATION}
        </p>
      </footer>
    </div>
  )
}
