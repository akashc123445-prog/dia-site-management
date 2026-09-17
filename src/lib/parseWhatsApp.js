/* ------------------------------------------------------------------------
   Turns a pasted WhatsApp message into work tracker tasks.

   People send task lists as chat: numbered, bulleted, sometimes with a
   project name as a heading and sometimes on each line. Copied out of
   WhatsApp the text also carries timestamps and sender names. The parser
   strips the noise, works out which project each line belongs to, and keeps
   the wording as typed — the person reviews the rows before anything is
   saved, so a wrong guess costs a click, not a task.
   ------------------------------------------------------------------------ */

/* "[16/09, 10:32 am] Akash: " or "16/09/26, 10:32 am - Akash: " */
const WA_PREFIX = /^\s*\[?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,?\s+\d{1,2}:\d{2}(?:\s*[ap]m)?\]?\s*[-–]?\s*[^:]{1,40}:\s*/i;

/* "1." "1)" "(1)" "1 -" "•" "-" "*" "→" and any run of them */
const LIST_PREFIX = /^\s*(?:\(?\d{1,3}[.)\]:]?\s*[-–—]?\s*|[•▪●◦\-–—*→>]\s*)+/;

/* "Surya - brass vendor", "Erode: BOQ", "Riyora — first floor" */
const PROJECT_SPLIT = /^([^:\-–—]{2,40}?)\s*[:\-–—]\s+(.{2,})$/;

const NOISE = /^(<media omitted>|<attached:|this message was deleted|image omitted|video omitted|missed voice call)/i;
const URGENT = /\b(urgent|asap|immediately|today itself|priority)\b|!{2,}/i;

const clean = (s) => s.replace(/\s+/g, " ").trim();

/* Only two things read as a heading for the lines beneath: a line ending in
   a colon, or a bare project name we already know. Guessing from shape alone
   turned "Shimoga site visit" into a heading and lost the task. */
function looksLikeHeading(line, known) {
  if (/:\s*$/.test(line)) return true;
  return known.includes(line.toLowerCase());
}

/* "Today's list", "Pending tasks" — a preamble, not work. */
const PREAMBLE = /^(today'?s?|tomorrow'?s?|pending|my|the)?\s*(list|tasks?|to[- ]?do|work|update)s?\s*[:\-]?$/i;

export function parseWhatsAppTasks(text, knownProjects = []) {
  const rows = [];
  let heading = "";
  const known = knownProjects.map((p) => p.toLowerCase());

  String(text || "").split(/\r?\n/).forEach((raw) => {
    let line = raw.replace(WA_PREFIX, "");
    /* A blank line ends a heading's reach, the way it does in the chat. */
    if (!clean(line)) { heading = ""; return; }
    if (NOISE.test(clean(line))) return;

    const hadNumber = LIST_PREFIX.test(line);
    line = clean(line.replace(LIST_PREFIX, "").replace(/^\**|\**$/g, ""));
    if (!line) return;

    if (!hadNumber && PREAMBLE.test(line)) return;

    if (!hadNumber && looksLikeHeading(line, known)) {
      heading = line.replace(/:\s*$/, "").trim();
      return;
    }

    let project = heading;
    let title = line;

    const m = line.match(PROJECT_SPLIT);
    if (m) {
      const left = clean(m[1]);
      /* Only split when the left side is plausibly a project: short, or one
         we've seen before. "Call vendor - he said Tuesday" must stay whole. */
      const plausible = known.includes(left.toLowerCase()) || left.split(/\s+/).length <= 3;
      if (plausible) { project = left; title = clean(m[2]); }
    }

    const urgent = URGENT.test(title);
    title = clean(title.replace(/\b(urgent|asap|immediately|priority)\b[:!.\s-]*/i, "").replace(/!{2,}/g, ""));
    if (!title) return;

    rows.push({ project: project || "General", title, urgent });
  });

  return rows;
}
