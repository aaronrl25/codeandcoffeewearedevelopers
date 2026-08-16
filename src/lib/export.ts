import type { WorkSheet } from 'xlsx'
import type { Registration } from '../types'

/** The single source of truth for the centralised list's column order. */
export const COLUMNS = [
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'LinkedIn URL',
  'Event',
  'Registration Date',
  'Registration Time',
] as const

export type Row = Record<(typeof COLUMNS)[number], string>

/**
 * A spreadsheet treats a cell beginning with = + - @ as a formula.
 *
 * .xlsx is safe on its own — every cell here is written with an explicit string
 * type, so Excel never re-parses it. .csv carries no type information, so Excel
 * does re-parse on open, and a perfectly ordinary `+1 555 010 0100` turns into
 * a #NAME? error.
 *
 * Prefixing with U+2060 WORD JOINER — zero-width and non-printing — stops that
 * parse without changing how the value reads. Applied to the CSV path only, so
 * the .xlsx stays byte-for-byte what the attendee typed.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

export function formatPhoneForSheet(phone: string): string {
  return FORMULA_TRIGGER.test(phone) ? `⁠${phone}` : phone
}

export function toRows(registrations: Registration[], csvSafe = false): Row[] {
  return registrations.map((r) => ({
    'First Name': r.firstName,
    'Last Name': r.lastName,
    Email: r.email,
    Phone: csvSafe ? formatPhoneForSheet(r.phone) : r.phone,
    'LinkedIn URL': r.linkedinUrl,
    Event: r.event,
    'Registration Date': r.registrationDate,
    'Registration Time': r.registrationTime,
  }))
}

export function fileName(extension: 'xlsx' | 'csv', now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `code-and-coffee-wearedevelopers-${stamp}.${extension}`
}

// `xlsx` is ~430 kB. Attendees never export, so it is loaded on first use
// rather than bundled into the page everyone downloads.
type XlsxModule = typeof import('xlsx')

function buildSheet(
  XLSX: XlsxModule,
  registrations: Registration[],
  csvSafe: boolean,
): WorkSheet {
  const sheet = XLSX.utils.json_to_sheet(toRows(registrations, csvSafe), {
    header: [...COLUMNS],
  })
  sheet['!cols'] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 30 },
    { wch: 20 },
    { wch: 46 },
    { wch: 42 },
    { wch: 18 },
    { wch: 18 },
  ]
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: registrations.length, c: COLUMNS.length - 1 },
    }),
  }
  return sheet
}

async function writeWorkbook(
  registrations: Registration[],
  bookType: 'xlsx' | 'csv',
): Promise<void> {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  const sheet = buildSheet(XLSX, registrations, bookType === 'csv')
  XLSX.utils.book_append_sheet(book, sheet, 'Registrations')
  XLSX.writeFile(book, fileName(bookType), { bookType })
}

export function exportXlsx(registrations: Registration[]): Promise<void> {
  return writeWorkbook(registrations, 'xlsx')
}

export function exportCsv(registrations: Registration[]): Promise<void> {
  return writeWorkbook(registrations, 'csv')
}
