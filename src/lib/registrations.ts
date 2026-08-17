import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { EVENT_NAME, type Registration, type RegistrationInput } from '../types'
import { canonicalLinkedInUrl, linkedInKey } from './validation'

export const REGISTRATIONS = 'registrations'
/**
 * PII-free collection whose document ids are the normalised LinkedIn keys.
 * Anyone may read a single key (to check for duplicates before submitting) and
 * create one, but never overwrite one — so the uniqueness guarantee is enforced
 * by security rules, not by trusting the client.
 */
export const LINKEDIN_INDEX = 'linkedinIndex'

export class DuplicateRegistrationError extends Error {
  constructor() {
    super('This LinkedIn profile is already registered.')
    this.name = 'DuplicateRegistrationError'
  }
}

function localParts(now: Date) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const date = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  return { timeZone, registrationDate: date, registrationTime: time }
}

export async function isLinkedInRegistered(rawUrl: string): Promise<boolean> {
  const key = linkedInKey(rawUrl)
  if (!key) return false
  const snap = await getDoc(doc(db, LINKEDIN_INDEX, key))
  return snap.exists()
}

/**
 * Writes the index entry and the registration in one atomic batch. If the index
 * entry already exists the batch is rejected by the rules, which is what makes
 * concurrent double submissions safe.
 */
export async function addRegistration(input: RegistrationInput): Promise<Registration> {
  const rawLinkedInUrl = input.linkedinUrl.trim()
  const parsedKey = rawLinkedInUrl ? linkedInKey(rawLinkedInUrl) : ''
  const parsedLinkedInUrl = rawLinkedInUrl ? canonicalLinkedInUrl(rawLinkedInUrl) : ''
  if (rawLinkedInUrl && (!parsedKey || !parsedLinkedInUrl)) {
    throw new Error('Invalid LinkedIn profile URL.')
  }
  const key = parsedKey ?? ''
  const linkedinUrl = parsedLinkedInUrl ?? ''

  if (key && (await isLinkedInRegistered(rawLinkedInUrl))) throw new DuplicateRegistrationError()

  const now = new Date()
  const record: Omit<Registration, 'id'> = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    // Collapse runs of whitespace so the sheet reads consistently.
    phone: input.phone.trim().replace(/\s+/g, ' '),
    linkedinUrl,
    linkedinKey: key,
    event: EVENT_NAME,
    createdAtIso: now.toISOString(),
    ...localParts(now),
  }

  const registrationRef = doc(collection(db, REGISTRATIONS))
  const batch = writeBatch(db)
  // The rules only grant `create` on the index, so this set is rejected rather
  // than silently overwriting when the key is already taken.
  if (key) batch.set(doc(db, LINKEDIN_INDEX, key), { createdAt: serverTimestamp() })
  batch.set(registrationRef, { ...record, createdAt: serverTimestamp() })

  try {
    await batch.commit()
  } catch (error) {
    // A losing race against a simultaneous submission surfaces as a rules
    // rejection on the already-existing index document.
    if (key && isPermissionDenied(error) && (await isLinkedInRegistered(rawLinkedInUrl))) {
      throw new DuplicateRegistrationError()
    }
    throw error
  }

  return { id: registrationRef.id, ...record }
}

/** Admin-only: the full list, newest first. */
export async function listRegistrations(): Promise<Registration[]> {
  const snap = await getDocs(query(collection(db, REGISTRATIONS), orderBy('createdAtIso', 'desc')))
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Registration>
    return {
      id: d.id,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      linkedinUrl: data.linkedinUrl ?? '',
      linkedinKey: data.linkedinKey ?? '',
      event: data.event ?? EVENT_NAME,
      createdAtIso: data.createdAtIso ?? '',
      registrationDate: data.registrationDate ?? '',
      registrationTime: data.registrationTime ?? '',
      timeZone: data.timeZone ?? '',
    }
  })
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'permission-denied'
  )
}
