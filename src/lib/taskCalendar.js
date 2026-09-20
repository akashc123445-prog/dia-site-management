import { COMPANY_INFO } from "./constants";

/* ------------------------------------------------------------------------
   Puts tasks onto a phone as calendar reminders.

   A .ics file is the one route every phone understands: opening it on iOS
   offers to add the entries to Calendar, and Android hands it to Google
   Calendar. Each entry carries an alarm, so it announces itself rather than
   sitting silently in a list nobody opens.
   ------------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, "0");

/* iCalendar wants times as UTC stamps, and dates as plain YYYYMMDD. */
const stamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
  `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

const dateOnly = (iso) => String(iso).slice(0, 10).replace(/-/g, "");

const nextDay = (iso) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

/* Commas, semicolons and newlines carry meaning in iCalendar, so a task
   titled "Tiles, marble; first floor" would otherwise split into fields. */
const esc = (t) => String(t || "")
  .replace(/\\/g, "\\\\")
  .replace(/;/g, "\\;")
  .replace(/,/g, "\\,")
  .replace(/\r?\n/g, "\\n");

/* Lines over 75 octets must be folded, or strict readers reject the file. */
const fold = (line) => {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) { parts.push(" " + rest.slice(0, 72)); rest = rest.slice(72); }
  parts.push(" " + rest);
  return parts.join("\r\n");
};

export function tasksToCalendar(tasks, { assigneeName } = {}) {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${COMPANY_INFO.name}//Site Management Portal//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  tasks.forEach((task, i) => {
    /* A task with no date still deserves a reminder — it lands today rather
       than being silently dropped. */
    const day = task.dueDate || today;
    const priority = task.priority === "High" ? 1 : task.priority === "Low" ? 9 : 5;

    const description = [
      task.note,
      task.project ? `Project: ${task.project}` : "",
      assigneeName ? `Assigned to: ${assigneeName}` : "",
      `From the ${COMPANY_INFO.name} portal`,
    ].filter(Boolean).join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id || `task-${i}`}@diaretail.in`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${dateOnly(day)}`,
      `DTEND;VALUE=DATE:${nextDay(day)}`,
      fold(`SUMMARY:${esc((task.priority === "High" ? "! " : "") + task.title)}`),
      fold(`DESCRIPTION:${esc(description)}`),
      `PRIORITY:${priority}`,
      `STATUS:${task.status === "Done" ? "CONFIRMED" : "TENTATIVE"}`,
      "BEGIN:VALARM",
      /* Nine in the morning on the day, not midnight when it was created. */
      "TRIGGER:PT9H",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(task.title)}`),
      "END:VALARM",
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/* Downloading the file is what triggers the phone's "add to calendar" prompt;
   there is no way to write into a reminders app directly from a web page. */
export function downloadTaskCalendar(tasks, { assigneeName, filename } = {}) {
  const blob = new Blob([tasksToCalendar(tasks, { assigneeName })], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "DIA tasks.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
