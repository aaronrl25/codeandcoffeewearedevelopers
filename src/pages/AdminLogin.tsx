import { useState, type FormEvent } from 'react'
import { Field } from '../components/Field'
import { Spinner } from '../components/Spinner'
import { authErrorMessage, useAuth } from '../lib/auth'

export function AdminLogin({ notice }: { notice?: string }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (!email.trim() || !password) {
      setError('Enter both your email and password.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">Organizer sign-in</h1>
      <p className="mt-2 text-sm text-brand-grey">
        The attendee list is private. Sign in with your organizer account.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 rounded-2xl border border-surface-line bg-surface-sunken p-6"
      >
        <div aria-live="polite" className={notice || error ? 'mb-5 space-y-3' : 'sr-only'}>
          {notice && (
            <p className="rounded-lg border border-brand-blue/40 bg-brand-blue/5 px-4 py-3 text-sm text-brand-navy">
              {notice}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-brand-crimson/40 bg-brand-crimson/5 px-4 py-3 text-sm text-brand-crimson-ink"
            >
              {error}
            </p>
          )}
        </div>

        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          disabled={submitting}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          className="mt-5"
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          disabled={submitting}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-crimson px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-crimson-ink disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Spinner label="Signing in" />
              <span>Signing in…</span>
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </div>
  )
}
