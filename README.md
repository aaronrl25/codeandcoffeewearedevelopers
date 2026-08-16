# Code & Coffee — WeAreDevelopers registration

Sign-up page for the Code & Coffee community list at the **WeAreDevelopers
World Congress North America** (September 23–25, 2026 · San José, CA), plus a
private organizer dashboard for viewing and exporting the list. Registrants are
emailed their ticket details.

Code & Coffee is a Community Partner of the event; the page uses the official
banner artwork and a palette sampled from it.

React 18 · TypeScript · Tailwind CSS v4 · Firebase (Firestore + Auth) · xlsx · Vite

---

## What it does

**`/` — public registration**

The event banner, then First Name, Last Name, Email Address, Phone Number
(optional) and LinkedIn Profile URL. On submit the record is written to
Firestore and the attendee sees:

> You're in! We look forward to connecting with you at WeAreDevelopers.

**`/admin` — organizers only**

Sign in with a Firebase Auth account that has been added to the organizer
allowlist, then view every attendee, search by name, email, phone or LinkedIn
URL, filter by registration date, sort, see the total, and export the whole list as `.xlsx`
or `.csv`.

**The exported columns**, in this order:

| First Name | Last Name | Email | Phone | LinkedIn URL | Event | Registration Date | Registration Time |
| ---------- | --------- | ----- | ----- | ------------ | ----- | ----------------- | ----------------- |

`Phone` is blank for attendees who skipped it.

`Event` is always `WeAreDevelopers World Congress North America`.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create the Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project.
2. **Build → Firestore Database → Create database** (production mode).
3. **Build → Authentication → Get started → Email/Password → Enable.**
4. **Project settings → Your apps → Add app → Web**, and copy the config values.

### 3. Configure the app

```bash
cp .env.example .env
```

Fill in the six `VITE_FIREBASE_*` values (already done for project
`faas-9c562`). These are public by design — a Firebase
web API key identifies the project, it does not authorise anything. Access is
controlled entirely by `firestore.rules`.

### 4. Deploy the security rules

The rules are what make the app safe: they keep the attendee list private and
enforce the duplicate guard on the server. **Deploy them before going live.**

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # select your project
firebase deploy --only firestore:rules
```

### 5. Create an organizer

Organizer access = a Firebase Auth account **plus** a document at `admins/<UID>`.
Both are required; the account alone gets you "No organizer access".

**Script (only works before step 4 deploys the rules):**

```bash
./scripts/add-organizer.sh you@example.com 'a-strong-password'
```

It creates the account, prints the UID, and writes the `admins` document.

**Console (works any time):**

1. **Authentication → Users → Add user** — set an email and password.
2. Copy that user's **User UID**.
3. **Firestore → Start collection → `admins`** → add a document whose **document
   ID is the UID**. The contents don't matter; an empty document is enough.

Repeat per organizer. To revoke access, delete the `admins` document.

Once `firestore.rules` is deployed, `admins` is write-protected by design, so
the script's second half will fail — use the console from then on.

### 6. Run

```bash
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm run check      # logic and rendering checks
```

### 7. Deploy

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` is already set up to serve `dist/` with SPA rewrites, so
`/admin` resolves on a hard refresh.

---

## How duplicate prevention works

A LinkedIn URL is normalised into a comparison key before anything is stored, so
all of these are recognised as the same person:

```
https://www.linkedin.com/in/ada-lovelace
linkedin.com/in/ada-lovelace
http://LinkedIn.com/in/Ada-Lovelace/
https://de.linkedin.com/in/ada-lovelace/
https://www.linkedin.com/in/ada-lovelace?utm_source=qr
                      ↓
                 in:ada-lovelace
```

That key is the document ID in a separate `linkedinIndex` collection which holds
**no personal data** — only a timestamp. The registration itself lives in
`registrations`.

Both documents are written in a single atomic batch, and the rules grant
`create` on the index but never `update`. So a duplicate is rejected by the
server, not merely hidden by the UI: if two people submit the same profile at
the same instant, one batch fails in its entirety and that person is told they
are already registered. There is no window in which a duplicate can land.

The client checks the index first purely so the common case gets an instant,
friendly error rather than a failed write.

## A note on spreadsheets and the `+` in phone numbers

Excel evaluates any cell whose text starts with `=`, `+`, `-` or `@`. That makes
an ordinary international number like `+1 555 010 0100` a problem — and, in the
general case, is how CSV-injection attacks work.

Two defences, applied where each is appropriate:

- **Validation** rejects any email beginning with `=`, `+` or `-`. Names are
  already restricted to letters. So no free-text field can smuggle in a formula.
- **The CSV writer** prefixes a leading `+` with U+2060 WORD JOINER, which is
  zero-width and non-printing: the number still reads and copies as
  `+1 555 010 0100`, but Excel no longer tries to evaluate it.

The `.xlsx` writer does **not** do this and does not need to — SheetJS writes
every cell with an explicit string type, so Excel never re-parses the contents.
The Excel export is therefore byte-for-byte what the attendee typed. `npm run
check` asserts both halves of this, including that the phone cell's type is `s`.

## How access control works

| Collection      | Public                            | Organizer      |
| --------------- | --------------------------------- | -------------- |
| `registrations` | create only (validated by rules)  | read / write   |
| `linkedinIndex` | `get` one key, `create` one key   | list / delete  |
| `admins`        | read own entry only               | —              |

Attendee names, **email addresses, phone numbers** and LinkedIn URLs are **never
readable** without an organizer account. Rules also validate every incoming
registration — field allowlist, length limits, and regexes on the email, phone
and LinkedIn URL — so a hand-crafted write cannot put junk in the sheet.

The UI checks `isAdmin` to decide what to render, but that is only presentation.
The real boundary is `firestore.rules`, evaluated server-side.

---

## Accessibility

- Every input has a real `<label>`; errors are wired up with `aria-describedby`
  and `aria-invalid`, and announced via `role="alert"`.
- Failed validation moves focus to the first invalid field; a successful submit
  moves focus to the confirmation.
- Skip-to-content link, visible focus rings, semantic table with a caption, and
  `prefers-reduced-motion` support.
- 16px input text so iOS Safari doesn't zoom on focus.
- The eight-column table becomes a card list under `md` — a wide table is
  unreadable on a phone.
- Colours are checked against white: navy 19:1, blue 6.0:1, grey 4.7:1. The pure
  brand crimson `#FF0049` is only 3.9:1, so buttons use `#E00042` (4.9:1) and
  crimson text uses `#C40039` (6.2:1); the pure tone is decorative only.

---

## Project layout

```
src/
  lib/
    firebase.ts        app + Firestore init (deliberately no Auth import — see below)
    auth.tsx           AuthProvider, organizer check, error messages
    validation.ts      LinkedIn URL parsing/normalisation, field validation
    registrations.ts   atomic write with duplicate guard, admin list query
    export.ts          column definition, xlsx and csv writers
  pages/
    RegisterPage.tsx   public form: validation, loading, success, error states
    AdminRoute.tsx     lazy entry point that owns the AuthProvider
    AdminPage.tsx      auth gate, login, dashboard, search/filter/export
  components/          Field, Spinner, Layout
  assets/              wearedevelopers-banner.jpg (hero artwork)
scripts/check.tsx      logic + render checks (npm run check)
firestore.rules        the actual security boundary
```

**On bundle size.** Attendees are on conference wifi, so the organizer bundle is
split out: the admin page, Firebase Auth and `xlsx` are all lazy-loaded. That is
why `lib/firebase.ts` exports `app` instead of calling `getAuth` — importing
`firebase/auth` there would pull it into the bundle everyone downloads. The
public page ships ~147 kB gzipped (almost entirely the Firestore SDK); `xlsx`
(~143 kB gzipped) loads only when an organizer clicks Export.

---

## Verified / not verified

`npm run build` and `npm run check` (19 checks) pass. The checks cover LinkedIn
key normalisation and rejection, form/email/phone validation, the eight export
columns, an xlsx write/read round-trip, CSV quoting, the formula-trigger guard
described above, filenames, and that the page renders with the required copy and
five correctly labelled inputs.

**Not visually reviewed:** no browser was available in the session that built
this, so the layout has not been seen rendered at any width.

**Not exercised locally:** anything requiring the Firestore emulator — the live
write path, the rules, and the duplicate race. The emulator needs a Java
runtime, which isn't installed on this machine. To run those against the
emulator:

```bash
brew install --cask temurin      # any JDK 11+
firebase emulators:start --only firestore,auth
```
