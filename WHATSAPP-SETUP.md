# Switching on the WhatsApp attendance reminder

Everything in the portal is built and deployed. What's left is the part only
you can do: WhatsApp will not let a business send automated messages until
Meta has approved the account and the wording. That is Meta's rule, not a
limitation of the portal.

Budget about an hour, most of it waiting for approvals. Running cost is
roughly **₹0.12 a message** — about **₹40–50 a month** for 15 staff.

---

## 1. The phone number

A number can be on **either** the WhatsApp app **or** the Cloud API — never
both. So there are two routes, and the right one depends on whether people
message that number.

### Route A — a fresh SIM (simplest)

Buy a prepaid SIM, never put it in a phone, register it on the API. Your
existing numbers are untouched. The staff still see the sender as
"DIA Retail Solutions" — the display name is set in Meta, not by the number.

### Route B — move your existing number

Only do this if nobody needs to *receive* on it. Once migrated:

- The number can't be opened in WhatsApp or WhatsApp Business on any phone.
- **The chat history on it is lost.** Back it up first if you want a copy, but
  the backup does not come across to the API side.
- Incoming messages go to the API, and the portal has no inbox — it only
  sends. Anyone who replies to a reminder is replying into silence.

To migrate ([Meta's instructions](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/migrate-existing-whatsapp-number-to-a-business-account/)):

1. If two-step verification is on for that number, turn it off first
   (Settings → Account → Two-step verification). It can otherwise block
   re-registration.
2. Back up the chat history if you want to keep a copy.
3. In WhatsApp or WhatsApp Business: **Settings → Account → Delete my account**.
   Messages sent to the number queue up meanwhile.
4. Wait about three minutes for the number to be released.
5. Register it in the Cloud API as in step 2 below.

To undo it later you deregister from the Cloud API and set the number up in
the app again — but the history from before is still gone.

### Route C — a partner, if you want to keep the number *and* the app

A BSP (AiSensy, Interakt, Wati, Gupshup are the common Indian ones) can onboard
your existing number without deleting it: the chat history survives and you can
keep using the WhatsApp Business app alongside their inbox. They charge a
monthly fee on top of Meta's per-message cost, and the portal's sender would
need pointing at their API instead of Meta's — a small change, ask for it.

## 2. Meta Business setup

1. Go to **business.facebook.com** and sign in. Create a Business Portfolio for
   DIA Retail Solutions if you don't have one.
2. Go to **developers.facebook.com** → **My Apps** → **Create App** → type
   **Business**.
3. In the new app, add the **WhatsApp** product.
4. Under WhatsApp → **API Setup**, add your phone number from step 1 and verify
   it with the code they send.
5. Complete **Business Verification** when Meta prompts you — this needs your
   GST certificate or incorporation document. It usually clears in a day or two.
   Until it clears you can only message a handful of test numbers, which is
   fine for testing.

Note down two things from the API Setup page:

- **Phone number ID** — a long number. This is *not* the phone number itself.
- **Access token** — the temporary one on that page lasts 24 hours. For the real
  thing, create a **System User** under Business Settings → Users → System
  Users, give it the **whatsapp_business_messaging** permission on your app, and
  generate a **permanent token**. Use that one.

## 3. The message template

Meta only delivers wording it has approved in advance.

Go to **WhatsApp Manager → Message Templates → Create Template**:

- **Name:** `attendance_reminder` (exactly this — the portal looks for it)
- **Category:** **Utility** (not Marketing — Utility is cheaper and approves faster)
- **Language:** English
- **Body:**

  ```
  Hi {{1}}, you have not marked your attendance on the DIA portal yet today. Please mark in: https://diaretail.in/portal
  ```

- When it asks for a sample for `{{1}}`, give a first name such as `Arul`.

Approval usually takes under an hour for Utility templates.

If you later want different wording, change it in Meta **and** in the portal's
Reminders tab, and keep the two the same.

## 4. Give the portal the credentials

In Supabase → **Edge Functions** → **Secrets** (or Project Settings →
Edge Functions → Secrets), add:

| Name | Value |
|---|---|
| `WHATSAPP_TOKEN` | the permanent token from step 2 |
| `WHATSAPP_PHONE_ID` | the phone number ID from step 2 |

These live on the server. They are never sent to anyone's browser.

## 5. Start the daily schedule

The job is already scheduled and running every ten minutes. It just needs the
key it calls with, which is yours to store and never mine to see.

Open **Supabase → SQL Editor**, and run this one line with your **service_role**
key from Project Settings → API Keys pasted in:

```sql
select vault.create_secret('PASTE_SERVICE_ROLE_KEY_HERE', 'reminder_service_key');
```

The key is encrypted at rest in Supabase's vault — it isn't sitting in the job
definition where anyone browsing the database would read it. Paste it, run it,
and don't keep a filled-in copy of that line anywhere.

To change it later:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'reminder_service_key'),
  'NEW_KEY_HERE');
```

## 6. Switch it on and test

In the portal: **Attendance → Reminders**.

1. Put your own WhatsApp number on your profile first (Team → the pencil on
   your row).
2. Press **Send a test to me**. It should arrive within seconds.
   - *"WhatsApp is not connected yet"* → the two secrets in step 4 aren't saved.
   - *"Template name does not exist"* → the template isn't approved yet, or the
     name doesn't match `attendance_reminder`.
   - *"Recipient phone number not in allowed list"* → business verification
     hasn't cleared; add your number as a test recipient in API Setup meanwhile.
3. Add everyone's numbers. The Reminders tab lists whoever is still missing one.
4. Set the time, confirm the 2nd and 4th Saturdays are marked closed, and
   turn the toggle **On**.

**Send today's round now** does a real send to everyone currently unmarked,
ignoring the clock — useful for the first live test, and on a day you want to
chase people early.

---

## What happens each day

At the set time the server checks the date and sends only to people who need
it. A person gets at most one message a day, even if something retries.

Nothing is sent on a Sunday, on the 2nd or 4th Saturday, on a day marked as a
holiday in the month register, to anyone who has already marked in, or to
anyone on approved leave or working from home.

Every attempt is recorded. **Attendance → Reminders** shows the last two weeks,
failures included, with Meta's own reason for each failure.

## If it goes quiet

Check, in this order:

1. The toggle in the Reminders tab is **On**.
2. `select * from cron.job;` — the `attendance-reminder` job exists and is active.
3. `select * from cron.job_run_details order by start_time desc limit 10;` — it's
   actually running.
4. Supabase → Edge Functions → attendance-reminder → **Logs** — what the
   function said when it ran.
5. Meta's **Account Quality** page — a business can be rate-limited or blocked
   if people mark its messages as spam. Staff reminders shouldn't attract that,
   but it's the thing to check if sends start failing for everyone at once.
