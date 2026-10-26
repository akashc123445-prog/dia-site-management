// Daily attendance nudge over WhatsApp.
//
// Runs on a schedule and asks only the people who actually need asking: not
// on a Sunday, not on a Saturday the office is closed, not on a company
// holiday, not anyone who has already marked in, and not anyone who is on
// approved leave. A person is messaged at most once a day — the log row is
// claimed before the message is sent, so two overlapping runs cannot both
// send.
//
// Credentials live in function secrets and never reach the browser:
//   WHATSAPP_TOKEN          permanent access token from Meta
//   WHATSAPP_PHONE_ID       the phone number ID, not the phone number
//   WHATSAPP_API_VERSION    optional, defaults to v21.0

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/* India, always — the office is in Bengaluru and Chennai and the schedule is
   written in local time. Computed from the UTC clock rather than a timezone
   database so it cannot drift if the runtime's zone data changes. */
function istNow() {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  return {
    date: now.toISOString().slice(0, 10),
    minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
    dayOfWeek: now.getUTCDay(),          // 0 = Sunday
    dayOfMonth: now.getUTCDate(),
  };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

/* Why today is or isn't a day to chase people. Returned as a sentence so the
   admin screen can show the reason rather than an unexplained silence. */
function closedBecause(ist: ReturnType<typeof istNow>, saturdaysOff: number[], holidayName?: string) {
  if (holidayName) return `Holiday — ${holidayName}`;
  if (ist.dayOfWeek === 0) return "Sunday";
  if (ist.dayOfWeek === 6) {
    const nth = Math.ceil(ist.dayOfMonth / 7);
    if (saturdaysOff.includes(nth)) return `${nth}${["st", "nd", "rd", "th"][Math.min(nth, 4) - 1]} Saturday — office closed`;
  }
  return null;
}

async function sendWhatsApp(to: string, templateName: string, lang: string, firstName: string) {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  const version = Deno.env.get("WHATSAPP_API_VERSION") || "v21.0";
  if (!token || !phoneId) {
    throw new Error("WhatsApp is not connected yet — WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are not set.");
  }

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: lang },
        components: [{ type: "body", parameters: [{ type: "text", text: firstName }] }],
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return body?.messages?.[0]?.id || "sent";
}

/* A number Meta will accept: digits only, with the country code. Indian
   mobiles are stored however they were typed and normalised here. */
function normalise(raw: string | null): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length > 12) return digits;      // already international
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "run";

    /* The scheduled run arrives with the service role key. Anything else has
       to be an active Admin pressing a button in the portal. */
    const authHeader = req.headers.get("Authorization") || "";
    const isService = authHeader === `Bearer ${serviceKey}`;
    let caller: { id: string; name: string } | null = null;

    if (!isService) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await callerClient.auth.getUser();
      if (!user) return json({ ok: false, error: "Not authenticated." }, 401);
      const { data: profile } = await callerClient
        .from("profiles").select("id, name, role, active").eq("id", user.id).single();
      if (!profile || profile.role !== "Admin" || profile.active === false) {
        return json({ ok: false, error: "Only an active Admin can do this." }, 403);
      }
      caller = { id: profile.id, name: profile.name };
    }

    const { data: settings } = await admin
      .from("attendance_reminder_settings").select("*").eq("id", true).single();
    if (!settings) return json({ ok: false, error: "Reminder settings are missing." }, 500);

    const ist = istNow();

    /* ---- a single test message to whoever asked for it ---- */
    if (action === "test") {
      if (!caller) return json({ ok: false, error: "A test has to come from a signed-in Admin." }, 403);
      const { data: me } = await admin
        .from("profiles").select("name, whatsapp").eq("id", caller.id).single();
      const to = normalise(me?.whatsapp);
      if (!to) return json({ ok: false, error: "Add your own WhatsApp number first, then test." }, 400);
      try {
        const id = await sendWhatsApp(to, settings.template_name, settings.template_lang,
          (me!.name || "").split(" ")[0]);
        return json({ ok: true, sent: 1, detail: `Sent to ${to} (${id}).` });
      } catch (err) {
        return json({ ok: false, error: err instanceof Error ? err.message : "Send failed." }, 400);
      }
    }

    /* ---- the daily run ---- */
    if (!settings.enabled && action !== "run_now") {
      return json({ ok: true, skipped: "Reminders are switched off." });
    }

    const { data: holiday } = await admin
      .from("company_holidays").select("name").eq("date", ist.date).maybeSingle();

    const closed = closedBecause(ist, settings.saturdays_off || [2, 4], holiday?.name);
    if (closed && action !== "run_now") return json({ ok: true, skipped: closed });

    /* Fire from the set time until an hour after it, so a missed tick still
       goes out — and never before, so nobody is chased at eight in the
       morning. The log keeps it to one message each. */
    if (action === "run") {
      const due = toMinutes(settings.send_at);
      if (ist.minutes < due || ist.minutes > due + 60) {
        return json({ ok: true, skipped: `Not the time yet — set for ${settings.send_at} IST.` });
      }
    }

    const [{ data: people }, { data: marked }, { data: leave }] = await Promise.all([
      admin.from("profiles").select("id, name, whatsapp, active, removed")
        .eq("active", true).or("removed.is.null,removed.eq.false"),
      admin.from("attendance").select("user_id").eq("date", ist.date),
      admin.from("leave_requests").select("user_id, kind")
        .eq("status", "Approved").lte("from_date", ist.date).gte("to_date", ist.date),
    ]);

    const markedIn = new Set((marked || []).map((r) => r.user_id));
    const onLeave = new Set((leave || [])
      .filter((l) => l.kind === "Leave" || l.kind === "Work from home")
      .map((l) => l.user_id));

    const targets = (people || []).filter((p) =>
      !markedIn.has(p.id) && !onLeave.has(p.id) && normalise(p.whatsapp));

    const results: { name: string; status: string; detail: string }[] = [];

    for (const person of targets) {
      /* Claim the day before sending. If the row is already there, another
         run has this person and we leave them alone. */
      const { error: claimErr } = await admin.from("attendance_reminder_log").insert({
        date: ist.date, user_id: person.id, channel: "whatsapp", status: "sending",
      });
      if (claimErr) continue;

      try {
        const id = await sendWhatsApp(
          normalise(person.whatsapp)!, settings.template_name, settings.template_lang,
          (person.name || "").split(" ")[0]);
        await admin.from("attendance_reminder_log")
          .update({ status: "sent", detail: id, sent_at: new Date().toISOString() })
          .eq("date", ist.date).eq("user_id", person.id).eq("channel", "whatsapp");
        results.push({ name: person.name, status: "sent", detail: id });
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Send failed.";
        await admin.from("attendance_reminder_log")
          .update({ status: "failed", detail }).eq("date", ist.date)
          .eq("user_id", person.id).eq("channel", "whatsapp");
        results.push({ name: person.name, status: "failed", detail });
      }
    }

    const noNumber = (people || []).filter((p) =>
      !markedIn.has(p.id) && !onLeave.has(p.id) && !normalise(p.whatsapp)).map((p) => p.name);

    return json({
      ok: true,
      date: ist.date,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      noNumber,
      results,
    });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : "Unexpected error." }, 500);
  }
});
