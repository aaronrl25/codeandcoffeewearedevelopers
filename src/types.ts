/** Official event name, as it appears on the World Congress banner. */
export const EVENT_NAME = 'WeAreDevelopers World Congress North America'
export const EVENT_DATES = 'September 23–25, 2026'
export const EVENT_LOCATION = 'San José, CA'

export interface Registration {
  /** Firestore document id. */
  id: string
  firstName: string
  lastName: string
  /** Lower-cased contact address — this is where ticket details are sent. */
  email: string
  /** Optional. Empty string when the attendee did not provide one. */
  phone: string
  linkedinUrl: string
  /** Normalised LinkedIn handle used as the duplicate key. */
  linkedinKey: string
  event: string
  /** ISO-8601 UTC timestamp of the registration. */
  createdAtIso: string
  /** Local calendar date at registration time, e.g. 2026-08-16. */
  registrationDate: string
  /** Local wall-clock time at registration time, e.g. 14:07:31. */
  registrationTime: string
  /** IANA zone the date/time strings above were captured in. */
  timeZone: string
}

export type RegistrationInput = Pick<
  Registration,
  'firstName' | 'lastName' | 'email' | 'phone' | 'linkedinUrl'
>
