import { useRef, useState, type FormEvent } from 'react'
import bannerUrl from '../assets/wearedevelopers-banner.jpg'
import { Field } from '../components/Field'
import { Spinner } from '../components/Spinner'
import { isFirebaseConfigured } from '../lib/firebase'
import { addRegistration, DuplicateRegistrationError } from '../lib/registrations'
import { validate, type FieldErrors, type FieldName } from '../lib/validation'
import { EVENT_DATES, EVENT_LOCATION, type RegistrationInput } from '../types'

const EMPTY: RegistrationInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  linkedinUrl: '',
}
const FIELD_ORDER: FieldName[] = ['firstName', 'lastName', 'email', 'phone', 'linkedinUrl']

type Status = 'idle' | 'submitting' | 'success' | 'error'

function Banner() {
  return (
    <img
      src={bannerUrl}
      width={1600}
      height={853}
      alt="WeAreDevelopers World Congress North America. Developers. AI Builders. Tech Leaders. September 23–25, 2026, San José, CA. Code &amp; Coffee, Community Partner."
      // Above the fold on every visit, so it stays eagerly loaded (the default)
      // rather than lazy. Intrinsic width/height are set so the form below does
      // not jump once the image arrives.
      className="mx-auto block h-auto w-full max-w-2xl"
    />
  )
}

export function RegisterPage() {
  const [values, setValues] = useState<RegistrationInput>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [formError, setFormError] = useState<string | null>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function update(field: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    // Clear a field's error as soon as the person starts fixing it.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'submitting') return

    const nextErrors = validate(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFormError(null)
      setStatus('idle')
      const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field])
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus()
      return
    }

    if (!isFirebaseConfigured) {
      setStatus('error')
      setFormError('Registration is not connected yet. Please contact an organizer.')
      return
    }

    setStatus('submitting')
    setFormError(null)

    try {
      await addRegistration(values)
      setStatus('success')
      // Move focus to the confirmation so screen reader users land on it.
      window.setTimeout(() => successRef.current?.focus(), 0)
    } catch (error) {
      setStatus('error')
      if (error instanceof DuplicateRegistrationError) {
        setErrors({ linkedinUrl: 'This LinkedIn profile is already registered.' })
        setFormError("You're already on the list — no need to register twice.")
      } else {
        setFormError('Something went wrong saving your registration. Please try again.')
      }
    }
  }

  if (status === 'success') {
    return (
      <>
        <Banner />
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-20">
          <div
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="w-full rounded-2xl border border-surface-line bg-surface-sunken p-8 sm:p-10"
          >
            <span aria-hidden="true" className="text-4xl">
              ☕
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">
              You&rsquo;re in! We look forward to connecting with you at WeAreDevelopers.
            </h1>
            <p className="mt-4 text-sm text-brand-grey">
              Thanks, <strong className="font-semibold text-brand-navy">{values.firstName.trim()}</strong>.
              Ticket details are on their way to{' '}
              <strong className="font-semibold text-brand-navy">{values.email.trim()}</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setValues(EMPTY)
              setErrors({})
              setFormError(null)
              setStatus('idle')
            }}
            className="mt-8 rounded-lg border border-surface-line px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-navy"
          >
            Register someone else
          </button>
        </div>
      </>
    )
  }

  const submitting = status === 'submitting'

  return (
    <>
      <Banner />

      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-brand-navy sm:text-4xl">
            Join Code &amp; Coffee at WeAreDevelopers
          </h1>
          <p className="mt-3 text-sm font-semibold text-brand-blue">
            {EVENT_DATES} · {EVENT_LOCATION}
          </p>
          <p className="mx-auto mt-4 max-w-md text-base text-brand-grey">
            Sign up for the Code &amp; Coffee list and we&rsquo;ll email you ticket details for the
            World Congress.
          </p>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="mt-10 rounded-2xl border border-surface-line bg-surface-sunken p-6 sm:p-8"
        >
          <div
            aria-live="polite"
            role={formError ? 'alert' : undefined}
            className={formError ? 'mb-6' : 'sr-only'}
          >
            {formError && (
              <p className="rounded-lg border border-brand-crimson/40 bg-brand-crimson/5 px-4 py-3 text-sm font-medium text-brand-crimson-ink">
                {formError}
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="First Name"
              name="firstName"
              autoComplete="given-name"
              required
              maxLength={60}
              placeholder="Ada"
              value={values.firstName}
              error={errors.firstName}
              disabled={submitting}
              onChange={(e) => update('firstName', e.target.value)}
            />
            <Field
              label="Last Name"
              name="lastName"
              autoComplete="family-name"
              required
              maxLength={60}
              placeholder="Lovelace"
              value={values.lastName}
              error={errors.lastName}
              disabled={submitting}
              onChange={(e) => update('lastName', e.target.value)}
            />
          </div>

          <Field
            className="mt-5"
            label="Email Address"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="ada@example.com"
            hint="Where we send your ticket details."
            value={values.email}
            error={errors.email}
            disabled={submitting}
            onChange={(e) => update('email', e.target.value)}
          />

          <Field
            className="mt-5"
            label="Phone Number"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={24}
            placeholder="+1 555 010 0100"
            hint="Optional. Only used if we need to reach you about your ticket."
            value={values.phone}
            error={errors.phone}
            disabled={submitting}
            onChange={(e) => update('phone', e.target.value)}
          />

          <Field
            className="mt-5"
            label="LinkedIn Profile URL"
            name="linkedinUrl"
            type="url"
            inputMode="url"
            autoComplete="url"
            required
            placeholder="https://www.linkedin.com/in/ada-lovelace"
            hint="We use this to connect with you and to keep the list free of duplicates."
            value={values.linkedinUrl}
            error={errors.linkedinUrl}
            disabled={submitting}
            onChange={(e) => update('linkedinUrl', e.target.value)}
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-crimson px-5 py-3 text-base font-bold text-white transition-colors hover:bg-brand-crimson-ink disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Spinner label="Saving your registration" />
                <span>Joining…</span>
              </>
            ) : (
              'Join the Community'
            )}
          </button>

          <p className="mt-4 text-center text-xs text-brand-grey">
            Fields marked <span aria-hidden="true">*</span>
            <span className="sr-only">with an asterisk</span> are required.
          </p>
        </form>
      </div>
    </>
  )
}
