import * as XLSX from "xlsx";

/* ------------------------------------------------------------------------
   Reads an existing site work schedule out of Excel.

   The studio's schedules are a covering letter followed by a task table, and
   the columns vary between versions — some carry a revised commencement date,
   some a completion date instead of a duration. Columns are therefore matched
   by their headings rather than by position, and sub-tasks ("1. Base Carcass"
   under "CARPENTRY") are nested by their blank serial number.
   ------------------------------------------------------------------------ */

const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());
const isBlank = (row) => !row || row.every((c) => txt(c) === "");

/* Excel keeps dates as a serial count from 1899-12-30. */
function toDate(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const t = txt(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const parsed = Date.parse(t);
  if (!isNaN(parsed) && /\d{4}/.test(t)) return new Date(parsed).toISOString().slice(0, 10);
  return "";
}

/* "10 DAYS" → 10. Text like "As per vendor's agreement" has no number, and is
   kept as the duration note instead of being forced to zero. */
function toDays(v) {
  if (typeof v === "number" && v > 0 && v < 1000) return { days: Math.round(v), note: "" };
  const t = txt(v);
  const m = t.match(/(\d+(?:\.\d+)?)\s*(day|week|month)?/i);
  if (m && /^\s*\d/.test(t)) {
    const n = Number(m[1]);
    const unit = (m[2] || "day").toLowerCase();
    const mult = unit.startsWith("week") ? 7 : unit.startsWith("month") ? 30 : 1;
    return { days: Math.round(n * mult), note: "" };
  }
  return { days: 0, note: t };
}

const HEADERS = {
  sno: /^s\.?\s*no/i,
  name: /task name|work description|particular|description/i,
  days: /no\.?\s*of\s*days|duration/i,
  start: /commenc|start\s*date/i,
  revised: /revised/i,
  end: /complet|end\s*date|finish/i,
  notes: /notes|remark/i,
};

function findHeader(row) {
  if (!row) return null;
  const map = {};
  row.forEach((cell, i) => {
    const t = txt(cell);
    if (!t) return;
    /* "REVISED DAY OF COMMENCEMENT" matches both start and revised, so the
       more specific test is applied first. */
    if (HEADERS.revised.test(t)) { if (map.revised === undefined) map.revised = i; return; }
    for (const [key, re] of Object.entries(HEADERS)) {
      if (key === "revised") continue;
      if (map[key] === undefined && re.test(t)) { map[key] = i; return; }
    }
  });
  return map.name !== undefined && (map.days !== undefined || map.start !== undefined || map.end !== undefined)
    ? map : null;
}

const CHILD_PREFIX = /^\s*\d+\s*[.)]\s+/;   // "1. Base Carcass"
const BULLET_PREFIX = /^\s*[-–]\s*/;         // "- TILE SELECTION"

function parseSheet(rows, name) {
  const result = {
    name, title: "", client: "", subject: "", intro: [], tasks: [],
    handover: "", closing: [], warnings: [],
  };

  let cols = null;
  let mode = "head";
  let lastParent = null;
  let skipped = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    if (isBlank(row)) continue;
    const cells = row.map(txt);
    const joined = cells.filter(Boolean).join(" ");
    const first = cells.find(Boolean) || "";

    if (mode === "head") {
      const header = findHeader(row);
      if (header) { cols = header; mode = "table"; continue; }
      if (/^to,?$/i.test(first)) { result.client = cells.filter(Boolean)[1] || ""; continue; }
      if (/^sub\s*:/i.test(first)) { result.subject = first.replace(/^sub\s*:\s*/i, "").trim(); continue; }
      if (/^(i am writing|we are writing|greetings)/i.test(first)) { result.intro.push(first); continue; }
      if (!result.title && first.length > 3 && !toDate(row[0])) result.title = first;
      continue;
    }

    if (findHeader(row)) continue;                       // repeated header

    if (/tentative date of hand|date of handover/i.test(joined)) {
      result.handover = toDate(row[cols.start]) || toDate(cells.find(c => toDate(c))) ||
        joined.replace(/.*hand\s*over\s*[-:]?\s*/i, "").trim();
      continue;
    }
    if (/authorised signatory/i.test(joined)) continue;
    if (/^(we are pleased|thanking you|for dia|yours)/i.test(first)) { result.closing.push(first); continue; }

    const sno = txt(row[cols.sno ?? 0]);
    const taskName = txt(row[cols.name]);

    /* A full-width sentence with no task name is a note about the row above. */
    if (!taskName) {
      if (joined.length > 20 && lastParent) {
        lastParent.notes = [lastParent.notes, joined].filter(Boolean).join(" ");
      } else if (joined.length > 20) {
        result.intro.push(joined);
      } else {
        skipped += 1;
      }
      continue;
    }

    const duration = toDays(row[cols.days]);
    const task = {
      id: `t${result.tasks.length + 1}`,
      name: taskName.replace(CHILD_PREFIX, "").replace(BULLET_PREFIX, "").trim(),
      parentId: null,
      days: duration.days,
      durationNote: duration.note,
      start: toDate(row[cols.start]),
      revisedStart: cols.revised !== undefined ? toDate(row[cols.revised]) : "",
      end: cols.end !== undefined ? toDate(row[cols.end]) : "",
      notes: cols.notes !== undefined ? txt(row[cols.notes]) : "",
      dependsOn: [],
      status: "not_started",
    };

    /* A blank serial with a numbered or bulleted name is a sub-task of the
       last numbered row. */
    const isChild = !sno && (CHILD_PREFIX.test(taskName) || BULLET_PREFIX.test(taskName) || lastParent);
    if (isChild && lastParent) task.parentId = lastParent.id;
    else lastParent = task;

    if (/completed/i.test(task.notes)) task.status = "done";
    else if (/progress/i.test(task.notes)) task.status = "in_progress";

    result.tasks.push(task);
  }

  /* A date years away from the rest is nearly always a cell left behind from
     the schedule this one was copied from. Cheap to check, and it catches an
     error that reads as plausible on the page. */
  const starts = result.tasks.map(t => t.start).filter(Boolean).map(d => Date.parse(d)).sort((a, b) => a - b);
  if (starts.length > 3) {
    const median = starts[Math.floor(starts.length / 2)];
    const year = 365 * 86400 * 1000;
    result.tasks.forEach(t => {
      if (t.start && Math.abs(Date.parse(t.start) - median) > year) {
        t.dateSuspect = true;
        result.warnings.push(`"${t.name}" starts ${t.start}, which is over a year from the rest of the schedule — check whether that cell is left over from an earlier project.`);
      }
    });
  }

  if (!result.tasks.length) result.warnings.push("No tasks found — the sheet needs a header row naming the task and either a duration or a start date.");
  if (skipped) result.warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} could not be read and were skipped.`);
  return result;
}

export function parseScheduleWorkbook(data) {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheets = wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
    const parsed = parseSheet(rows, name);
    parsed.taskCount = parsed.tasks.length;
    return parsed;
  });
  return { sheets, sheetNames: wb.SheetNames };
}

export async function parseScheduleFile(file) {
  const buf = await file.arrayBuffer();
  return parseScheduleWorkbook(buf);
}
