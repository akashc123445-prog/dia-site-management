# Upload set — everything from this session

No SQL to run. All the database work has already been applied to your Supabase
project and verified: `work_tasks`, `office_expenses`, `attendance`,
`feed_posts`, `feed_comments`, `schedules`, and the `fee_lines` column.

## Five files, two folders

Upload as **two separate commits** — mixing folders in one upload has put
files in the wrong place before.

**Into `src/`**
- `App.jsx`

**Into `src/lib/`**
- `dataStore.js`
- `constants.js`
- `quotationDefaults.js`
- `generateQuotation.js`
- `parseWhatsApp.js` — new

Steps for each folder: open it on GitHub → **Add file → Upload files** → drag
the files in → **Commit changes**.

## What these files carry

**Attendance** — everyone marks in with an image of what they're starting on
and a line about the day; sign-off at the end asks what got done. Board shows
who's in, with the people who haven't marked in listed below. Today's record
is editable, yesterday's is closed at the database level.

**Office expenses** — petty cash for Bengaluru and Chennai, open to all roles.
Attachment optional here, unlike site expenses. Admin and Accounts approve and
mark reimbursed; nobody approves their own.

**Work tracker** — Admin only. Tasks grouped by project, urgent flag, notes
that save as you type, move between projects, and a one-click load of your
existing list on first use. **Paste list** takes a whole WhatsApp message and
turns it into rows you check before adding.

**Edit project** — contract value, estimated cost, dates, area and status can
be changed after a project is created. Margin is shown live as you type.

**Quotations** — a fee can now be split across several categories of work, each
with its own area and rate, printed as a breakdown table. Long client addresses
wrap instead of running off the page. A bullet landing first on a new page no
longer prints in the footer's tiny type.

## After uploading

Watch Vercel for a green **Ready**, then hard-refresh with Ctrl+Shift+R.
Check: Attendance and Office Expenses appear for every role, Work Tracker for
Admin only, and Edit project sits beside Edit team on a project.
