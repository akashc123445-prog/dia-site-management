# Dia Site Management

A project, expense, design-workflow, and site-reporting workspace for Dia Retail
Solutions — built as a real, deployable website (Vite + React) backed by
Supabase (Postgres database, authentication, and file storage), with PWA
support so field staff can install it to their phone's home screen.

This app grew out of a prototype built inside Claude. That prototype stored
data in a Claude-only sandbox and used a toy login where admins set everyone's
password. This version replaces both with a real backend: your team signs in
with their own email/password, data lives in a Postgres database only you
control, and every role's access is enforced by the database itself (not just
hidden in the UI).

---

## 1. What you'll need

- A free [Supabase](https://supabase.com) account (no credit card required for the free tier)
- A free [Vercel](https://vercel.com) or [Netlify](https://netlify.com) account, for hosting
- Node.js 18+ installed locally if you want to run/test this before deploying
  (not required if you deploy straight from Vercel/Netlify's Git integration)

---

## 2. Set up Supabase (~5 minutes)

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any name/region, set a database password (save it somewhere safe — you likely won't need it again, but keep it).
2. Once the project is ready, open **SQL Editor** in the left sidebar → **New query**.
3. Open `supabase/schema.sql` from this repo, copy its entire contents, paste into the SQL Editor, and click **Run**. This creates every table, security policy, and file storage bucket the app needs.
4. Go to **Settings → API**. You'll need two values from this page in the next step:
   - **Project URL**
   - **anon public** key (NOT the `service_role` key — never expose that one in a frontend app)

---

## 3. Configure the app

1. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and paste in your Project URL and anon key from step 2.4.

---

## 4. Run it locally (optional but recommended before deploying)

```
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

**Create your first account and make yourself Admin:**
1. On the sign-in screen, click **"New here? Create an account"** and sign up with your real name, email, and a password.
2. Every new sign-up starts inactive with no role, waiting for an Admin to activate them — but there's no Admin yet, so you'll do this one time via SQL. Go back to Supabase's **SQL Editor** and run (with your own email):
   ```sql
   update public.profiles set role = 'Admin', active = true where email = 'you@yourcompany.com';
   ```
3. Refresh the app and sign in. You're now the Admin.
4. From here on, everything happens in the app: go to **Team**, and any new teammate who signs up will show up under "Pending approval" — click their card, assign their role (Admin / Accounts / Architect / Supervisor, plus rank for architects), and activate them.

---

## 5. Deploy it as a real website

**Recommended: Vercel**
1. Push this project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your repository.
3. When prompted for environment variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values from your `.env`.
4. Deploy. Vercel auto-detects Vite and handles the build.

**Netlify** works the same way — import the repo, set the same two environment variables, and Netlify will run `npm run build` and serve the `dist` folder automatically (build command and output folder are already correct for Vite's defaults).

Once deployed, share the URL with your team. Anyone can sign up; you approve them from **Team**.

---

## 6. Using it on mobile (PWA)

This app is configured as a Progressive Web App. Once it's deployed to a real
HTTPS domain (PWAs require HTTPS — localhost is exempt for testing):

- **iPhone (Safari):** open the site → Share button → "Add to Home Screen"
- **Android (Chrome):** open the site → menu (⋮) → "Add to Home Screen" / "Install app"

It'll then launch full-screen like a native app, with its own icon.

**Note on icons:** `public/icons/` currently contains simple placeholder icons
in the brand colors. Swap in your real logo at the same file names/sizes
(`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, and
`apple-touch-icon.png` at 180×180) whenever you're ready — no code changes
needed.

---

## 7. How roles and permissions work

Enforced both in the UI and at the database level (Row Level Security), so
this holds even if someone tried to query the database directly:

- **Admin** — full access to everything; only Admin can create projects, edit/activate users, and edit the construction timeline for any project.
- **Accounts** — sees all projects and financials, can approve/reject expenses, but cannot edit the construction timeline or design phases.
- **Architect** — sees only projects they're assigned to; can update that project's design phases and the Working Drawings checklist. Has a rank (Principal / Senior / Junior / Intern) shown throughout the Team page.
- **Supervisor** — sees only projects they're assigned to; submits daily site reports, expenses, photos, and issues for those projects.

A person can never approve their own submitted expense, even if they hold an
approver role — enforced at the database level.

---

## 8. Project structure

```
src/
  App.jsx              — all UI components (views, forms, tabs)
  main.jsx             — React entry point
  index.css            — Tailwind entry
  lib/
    constants.js        — brand palette, dropdown lists, workflow templates
    helpers.js           — formatting, progress/health calculations, proof-of-work rules
    supabaseClient.js    — Supabase client setup
    dataStore.js         — every database read/write, and file uploads
supabase/
  schema.sql            — full database schema + Row Level Security policies
public/
  icons/, favicon.svg    — PWA icons
```

## 9. Costs

Supabase's free tier covers a small team comfortably (500MB database, 1GB file
storage, 50,000 monthly active users). Vercel/Netlify's free tiers are more
than enough for a business tool like this. You likely won't pay anything
unless the team and photo/PDF volume grow significantly — at which point both
services have clear, predictable paid tiers.
