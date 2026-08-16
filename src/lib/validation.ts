import type { RegistrationInput } from '../types'

export type FieldName = keyof RegistrationInput
export type FieldErrors = Partial<Record<FieldName, string>>

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’\-. ]*$/u

/**
 * Deliberately permissive: the job here is to catch typos, not to adjudicate
 * RFC 5322. One @, something either side, and a dotted domain.
 *
 * The leading character is constrained because these values end up in a
 * spreadsheet, where a cell starting with = + - @ is parsed as a formula.
 */
const EMAIL_PATTERN = /^[^\s@,=+\-][^\s@,]*@[^\s@,]+\.[^\s@,.]{2,}$/

/**
 * Optional field, so this only has to catch obvious nonsense. Accepts the
 * international shapes people actually type — `+1 (555) 010-0100`,
 * `+43 660 1234567`, `555.010.0100` — and requires 7 to 15 digits, the E.164
 * range. A leading + is the one formula-trigger character allowed through;
 * `formatPhoneForSheet` handles it at export time.
 */
const PHONE_PATTERN = /^\+?[\d\s().\-/]{6,24}$/

/**
 * Accepts the forms people actually paste: with or without a scheme, with or
 * without `www.`, on any LinkedIn country subdomain, and with tracking params.
 */
export function parseLinkedInUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null
  if (!/^\/(in|pub)\/[^/]+/.test(url.pathname)) return null

  return url
}

/**
 * Canonical, comparable form of a profile URL. Two people pasting
 * `linkedin.com/in/Ada-Lovelace/` and
 * `https://www.linkedin.com/in/ada-lovelace?utm_source=x` collapse to one key.
 */
export function linkedInKey(raw: string): string | null {
  const url = parseLinkedInUrl(raw)
  if (!url) return null
  const [, kind, handle] = url.pathname.split('/')
  return `${kind.toLowerCase()}:${decodeURIComponent(handle).toLowerCase()}`
}

/** Tidied URL stored in the sheet — scheme normalised, tracking params dropped. */
export function canonicalLinkedInUrl(raw: string): string | null {
  const url = parseLinkedInUrl(raw)
  if (!url) return null
  const [, kind, handle] = url.pathname.split('/')
  return `https://www.linkedin.com/${kind.toLowerCase()}/${handle}`
}

export function validate(values: RegistrationInput): FieldErrors {
  const errors: FieldErrors = {}

  const firstName = values.firstName.trim()
  if (!firstName) errors.firstName = 'Please enter your first name.'
  else if (firstName.length > 60) errors.firstName = 'Please use 60 characters or fewer.'
  else if (!NAME_PATTERN.test(firstName))
    errors.firstName = 'Please use letters, spaces, hyphens or apostrophes only.'

  const lastName = values.lastName.trim()
  if (!lastName) errors.lastName = 'Please enter your last name.'
  else if (lastName.length > 60) errors.lastName = 'Please use 60 characters or fewer.'
  else if (!NAME_PATTERN.test(lastName))
    errors.lastName = 'Please use letters, spaces, hyphens or apostrophes only.'

  const email = values.email.trim()
  if (!email) errors.email = 'Please enter your email address.'
  else if (email.length > 254) errors.email = 'That email address is too long.'
  else if (!EMAIL_PATTERN.test(email))
    errors.email = 'Enter a valid email address, e.g. you@example.com'

  // Optional: only validated when something was actually typed.
  const phone = values.phone.trim()
  if (phone) {
    const digits = phone.replace(/\D/g, '').length
    if (!PHONE_PATTERN.test(phone) || digits < 7 || digits > 15)
      errors.phone = 'Enter a valid phone number, e.g. +1 555 010 0100'
  }

  const linkedin = values.linkedinUrl.trim()
  if (!linkedin) errors.linkedinUrl = 'Please enter your LinkedIn profile URL.'
  else if (!linkedInKey(linkedin))
    errors.linkedinUrl = 'Enter a full profile URL, e.g. linkedin.com/in/your-name'

  return errors
}
