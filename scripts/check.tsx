import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import * as XLSX from 'xlsx'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'
import { linkedInKey, canonicalLinkedInUrl, validate } from '../src/lib/validation'
import { COLUMNS, toRows, fileName, formatPhoneForSheet } from '../src/lib/export'
import { EVENT_NAME, type Registration } from '../src/types'

let passed = 0
const check = (name: string, fn: () => void) => {
  try {
    fn()
    passed++
  } catch (e) {
    console.error(`FAIL ${name}:`, (e as Error).message)
    process.exitCode = 1
  }
}

// --- Duplicate detection -----------------------------------------------
check('equivalent LinkedIn URLs collapse to one key', () => {
  const variants = [
    'https://www.linkedin.com/in/ada-lovelace',
    'linkedin.com/in/ada-lovelace',
    'http://LinkedIn.com/in/Ada-Lovelace/',
    'https://www.linkedin.com/in/ada-lovelace?utm_source=qr&trk=x',
    'https://de.linkedin.com/in/ada-lovelace/',
    '  https://www.linkedin.com/in/ada-lovelace/  ',
  ]
  const keys = new Set(variants.map((v) => linkedInKey(v)))
  assert.deepEqual([...keys], ['in:ada-lovelace'], `got ${[...keys]}`)
})

check('different people get different keys', () => {
  assert.notEqual(linkedInKey('linkedin.com/in/ada'), linkedInKey('linkedin.com/in/alan'))
})

check('non-profile and non-LinkedIn URLs are rejected', () => {
  for (const bad of [
    'https://example.com/in/ada',
    'https://www.linkedin.com/company/acme',
    'https://www.linkedin.com/',
    'not a url',
    'https://linkedin.com.evil.test/in/ada',
    '',
  ]) {
    assert.equal(linkedInKey(bad), null, `should reject: ${bad}`)
  }
})

check('canonical URL matches the firestore.rules pattern', () => {
  const url = canonicalLinkedInUrl('de.linkedin.com/in/ada-lovelace/?trk=1')
  assert.equal(url, 'https://www.linkedin.com/in/ada-lovelace')
  assert.match(url!, /^https:\/\/www\.linkedin\.com\/(in|pub)\/[^/]+$/)
})

// --- Validation --------------------------------------------------------
check('empty form reports only the three required fields', () => {
  const errors = validate({ firstName: '', lastName: '', email: '', phone: '', linkedinUrl: '' })
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'firstName', 'lastName'])
})

check('LinkedIn is optional but validated when supplied', () => {
  const base = { firstName: 'A', lastName: 'B', email: 'a@example.com', phone: '' }
  assert.equal(validate({ ...base, linkedinUrl: '' }).linkedinUrl, undefined)
  assert.equal(validate({ ...base, linkedinUrl: '   ' }).linkedinUrl, undefined)
  assert.ok(validate({ ...base, linkedinUrl: 'https://example.com/in/a' }).linkedinUrl)
  assert.equal(validate({ ...base, linkedinUrl: 'linkedin.com/in/a' }).linkedinUrl, undefined)
})

check('accented and hyphenated names are accepted', () => {
  const errors = validate({
    firstName: 'Renée',
    lastName: "O'Brien-Müller",
    email: 'renee@example.co.uk',
    phone: '',
    linkedinUrl: 'linkedin.com/in/renee',
  })
  assert.deepEqual(errors, {})
})

check('whitespace-only names are rejected', () => {
  const errors = validate({
    firstName: '   ',
    lastName: 'X',
    email: 'x@example.com',
    phone: '',
    linkedinUrl: 'linkedin.com/in/x',
  })
  assert.ok(errors.firstName)
})

check('malformed emails are rejected, valid ones accepted', () => {
  const withEmail = (email: string) =>
    validate({ firstName: 'A', lastName: 'B', email, phone: '', linkedinUrl: 'linkedin.com/in/ab' })
      .email
  for (const bad of ['ada', 'ada@', '@example.com', 'ada@example', 'a b@example.com', 'a@b.c']) {
    assert.ok(withEmail(bad), `should reject: ${bad}`)
  }
  for (const good of ['ada@example.com', 'ada.lovelace+wad@sub.example.co.uk']) {
    assert.equal(withEmail(good), undefined, `should accept: ${good}`)
  }
})

check('phone is optional but validated when supplied', () => {
  const withPhone = (phone: string) =>
    validate({
      firstName: 'A',
      lastName: 'B',
      email: 'a@example.com',
      phone,
      linkedinUrl: 'linkedin.com/in/ab',
    }).phone
  assert.equal(withPhone(''), undefined, 'blank phone must be allowed')
  assert.equal(withPhone('   '), undefined, 'whitespace-only phone must be allowed')
  for (const good of ['+1 555 010 0100', '+43 660 1234567', '(555) 010-0100', '5550100100']) {
    assert.equal(withPhone(good), undefined, `should accept: ${good}`)
  }
  for (const bad of ['12345', 'call me', '+1 555 010 0100 ext 12345678', '=1+1']) {
    assert.ok(withPhone(bad), `should reject: ${bad}`)
  }
})

check('emails that would trigger a spreadsheet formula are rejected', () => {
  const withEmail = (email: string) =>
    validate({ firstName: 'A', lastName: 'B', email, phone: '', linkedinUrl: 'linkedin.com/in/ab' })
      .email
  for (const bad of ['=cmd@example.com', '+x@example.com', '-x@example.com']) {
    assert.ok(withEmail(bad), `should reject: ${bad}`)
  }
})

// --- Export ------------------------------------------------------------
const sample: Registration[] = [
  {
    id: '1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '+1 555 010 0100',
    linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace',
    linkedinKey: 'in:ada-lovelace',
    event: EVENT_NAME,
    createdAtIso: '2026-08-16T12:00:00.000Z',
    registrationDate: '2026-08-16',
    registrationTime: '14:00:00',
    timeZone: 'Europe/Berlin',
  },
  {
    id: '2',
    firstName: 'Grace',
    lastName: 'Hopper, PhD',
    email: 'grace@example.com',
    phone: '',
    linkedinUrl: 'https://www.linkedin.com/in/grace-hopper',
    linkedinKey: 'in:grace-hopper',
    event: EVENT_NAME,
    createdAtIso: '2026-08-16T13:30:00.000Z',
    registrationDate: '2026-08-16',
    registrationTime: '15:30:00',
    timeZone: 'Europe/Berlin',
  },
]

check('rows carry exactly the required columns, in order', () => {
  const rows = toRows(sample)
  assert.deepEqual(Object.keys(rows[0]), [...COLUMNS])
})

const sheet = XLSX.utils.json_to_sheet(toRows(sample), { header: [...COLUMNS] })
const csvSheet = XLSX.utils.json_to_sheet(toRows(sample, true), { header: [...COLUMNS] })
const book = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(book, sheet, 'Registrations')

check('xlsx round-trips with correct headers and data', () => {
  const buf = XLSX.write(book, { bookType: 'xlsx', type: 'buffer' })
  const reread = XLSX.read(buf)
  const grid = XLSX.utils.sheet_to_json<string[]>(reread.Sheets.Registrations, { header: 1 })
  assert.deepEqual(grid[0], [...COLUMNS])
  assert.deepEqual(grid[1], [
    'Ada',
    'Lovelace',
    'ada@example.com',
    '+1 555 010 0100',
    'https://www.linkedin.com/in/ada-lovelace',
    'WeAreDevelopers World Congress North America',
    '2026-08-16',
    '14:00:00',
  ])
  assert.equal(grid.length, 3)
})

check('csv quotes the comma inside a name', () => {
  const csv = XLSX.utils.sheet_to_csv(csvSheet)
  const lines = csv.trim().split('\n')
  assert.equal(
    lines[0],
    'First Name,Last Name,Email,Phone,LinkedIn URL,Event,Registration Date,Registration Time',
  )
  assert.ok(lines[2].includes('"Hopper, PhD"'), `csv row was: ${lines[2]}`)
})

check('a leading + phone is neutralised in csv but left alone in xlsx', () => {
  // U+2060 is zero-width, so the number still reads as +1 555 010 0100.
  assert.equal(formatPhoneForSheet('+1 555 010 0100'), '\u2060+1 555 010 0100')
  assert.equal(formatPhoneForSheet('555 010 0100'), '555 010 0100')
  assert.equal(formatPhoneForSheet(''), '')

  const csv = XLSX.utils.sheet_to_csv(csvSheet)
  assert.ok(!/(^|,)[=+\-@]/m.test(csv), 'no CSV cell may start with a formula trigger')

  // The xlsx keeps exactly what was typed — its cells are explicitly typed text.
  const reread = XLSX.read(XLSX.write(book, { bookType: 'xlsx', type: 'buffer' })).Sheets
    .Registrations
  const phoneCell = reread['D2']
  assert.equal(phoneCell.v, '+1 555 010 0100')
  // Type 's' (string) is precisely why Excel will not evaluate the leading +.
  assert.equal(phoneCell.t, 's', `phone cell type was '${phoneCell.t}', expected 's'`)
})

check('empty optional phone stays empty in both formats', () => {
  assert.equal(toRows(sample)[1].Phone, '')
  assert.equal(toRows(sample, true)[1].Phone, '')
})

check('file names are dated and correctly suffixed', () => {
  assert.equal(
    fileName('xlsx', new Date('2026-08-16T22:00:00Z')),
    'code-and-coffee-wearedevelopers-2026-08-16.xlsx',
  )
  assert.match(fileName('csv'), /\.csv$/)
})

// --- Rendering ---------------------------------------------------------
// react-router calls useLayoutEffect, which React warns about under the server
// renderer. Irrelevant here — these checks only assert on the markup.
const consoleError = console.error
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing')) return
  consoleError(...args)
}

const renderAt = (path: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

check('registration page renders the required copy', () => {
  const html = renderAt('/')
  assert.ok(html.includes('Join Code &amp; Coffee at WeAreDevelopers'), 'missing heading')
  assert.ok(html.includes('Join the Community'), 'missing submit button')
  for (const label of [
    'First Name',
    'Last Name',
    'Email Address',
    'Phone Number',
    'LinkedIn Profile URL',
  ]) {
    assert.ok(html.includes(label), `missing field label: ${label}`)
  }
})

check('every form input is associated with a label', () => {
  const html = renderAt('/')
  const inputIds = [...html.matchAll(/<input[^>]*\sid="([^"]+)"/g)].map((m) => m[1])
  const labelFors = new Set([...html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]))
  assert.equal(inputIds.length, 5, `expected 5 inputs, found ${inputIds.length}`)
  for (const id of inputIds) assert.ok(labelFors.has(id), `input ${id} has no label`)
})

check('unknown routes render the not-found page', () => {
  assert.ok(renderAt('/nope').includes('Page not found'))
})

console.log(`${passed} checks passed`)
