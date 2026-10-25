import * as XLSX from "xlsx";
import { COMPANY_INFO } from "./constants";

/* ------------------------------------------------------------------------
   The monthly attendance register: one row per person, one column per day.

   The day view answers "who is in right now". This answers the different
   question an office actually files — what did this month look like, for
   everyone, on one sheet. The codes below are the whole vocabulary; every
   cell is one of them, worked out from the attendance records and the
   approved leave rather than typed in by hand.
   ------------------------------------------------------------------------ */

export const CODES = {
  P:  { label: "Present",            cell: "bg-emerald-50 text-emerald-800", strong: true },
  HD: { label: "Half day",           cell: "bg-amber-50 text-amber-800" },
  WH: { label: "Work from home",     cell: "bg-sky-50 text-sky-800" },
  L:  { label: "Leave",              cell: "bg-rose-50 text-rose-700" },
  A:  { label: "Absent",             cell: "bg-rose-100 text-rose-800", strong: true },
  W:  { label: "Weekly off",         cell: "bg-stone-100 text-stone-400" },
  H:  { label: "Holiday",            cell: "bg-violet-50 text-violet-700" },
  "·": { label: "Not applicable",    cell: "text-stone-300" },
};

/* Codes that mean the person worked, for the summary columns. */
const WORKED = ["P", "HD", "WH"];

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export const monthName = (m) => MONTHS[m];

/* Every day in the month, with what kind of day it is. Sunday is the weekly
   off; anything in the holidays list overrides it. */
export function monthDays(year, month, holidays = []) {
  const byDate = new Map(holidays.map((h) => [h.date, h]));
  const out = [];
  const last = new Date(year, month + 1, 0).getDate();
  for (let n = 1; n <= last; n++) {
    const d = new Date(year, month, n);
    const date = iso(d);
    const holiday = byDate.get(date);
    out.push({
      n, date, dow: DOW[d.getDay()],
      sunday: d.getDay() === 0,
      holiday: holiday || null,
      /* "Type of Day" in the register header: a working day or not. */
      type: holiday || d.getDay() === 0 ? "H" : "W",
    });
  }
  return out;
}

/* ---- what one person's day amounts to ------------------------------------
   Attendance first: if they marked in, they were here, whatever else was
   requested. Then approved leave. Then the shape of the day itself. An
   absence is only an absence on a working day that has already passed. */
function codeFor({ day, record, leaves, today, joinedOn }) {
  if (joinedOn && day.date < joinedOn) return { code: "·", note: "Before joining" };

  const approved = leaves.filter((l) =>
    l.status === "Approved" && day.date >= l.fromDate && day.date <= (l.toDate || l.fromDate));

  if (record) {
    const halfDay = approved.find((l) => l.kind === "Half day");
    const permission = approved.find((l) => l.kind === "Late check-in" || l.kind === "Early leaving");
    if (halfDay) return { code: "HD", note: "Half day", leave: halfDay };
    return {
      code: "P",
      note: permission ? `${permission.kind} approved` : "Present",
      record, leave: permission || null,
    };
  }

  const wfh = approved.find((l) => l.kind === "Work from home");
  if (wfh) return { code: "WH", note: "Work from home", leave: wfh };
  const leave = approved.find((l) => l.kind === "Leave");
  if (leave) return { code: "L", note: leave.reason || "On leave", leave };
  const half = approved.find((l) => l.kind === "Half day");
  if (half) return { code: "HD", note: "Half day", leave: half };

  if (day.holiday) return { code: "H", note: day.holiday.name };
  if (day.sunday) return { code: "W", note: "Weekly off" };
  if (day.date > today) return { code: "·", note: "" };
  return { code: "A", note: "No attendance marked" };
}

/* ---- the whole grid ------------------------------------------------------ */
export function buildRegister({ users, records, leaves, year, month, holidays, today }) {
  const days = monthDays(year, month, holidays);
  const now = today || iso(new Date());

  const rows = users.map((u) => {
    const theirs = records.filter((r) => r.userId === u.id);
    const theirLeave = (leaves || []).filter((l) => l.userId === u.id);
    const cells = days.map((day) => ({
      day,
      ...codeFor({
        day,
        record: theirs.find((r) => r.date === day.date),
        leaves: theirLeave,
        today: now,
        joinedOn: u.joinedOn,
      }),
    }));

    const count = (c) => cells.filter((x) => x.code === c).length;
    return {
      user: u,
      cells,
      summary: {
        P: count("P"), HD: count("HD"), WH: count("WH"),
        L: count("L"), A: count("A"),
        /* A half day is half a day worked — the figure payroll wants. */
        worked: cells.filter((x) => WORKED.includes(x.code))
          .reduce((s, x) => s + (x.code === "HD" ? 0.5 : 1), 0),
      },
    };
  });

  return { days, rows, year, month };
}

/* ---- the sheet -----------------------------------------------------------
   Kept separate from the saving so the layout can be read back and checked
   without a browser. */
export function registerSheetRows({ users, records, leaves, year, month, holidays, today, personName }) {
  const { days, rows } = buildRegister({ users, records, leaves, year, month, holidays, today });

  const pad = (arr) => {
    /* The sheet always runs to 31 columns so that a 30-day month still lines
       up with a 31-day one when they are filed side by side. */
    const out = [...arr];
    while (out.length < 31) out.push("");
    return out;
  };

  const sheet = [
    [COMPANY_INFO.name],
    [`Employee Attendance Sheet — ${MONTHS[month]} ${year}${personName ? ` — ${personName}` : ""}`],
    [],
    ["Year", year, "Date", ...pad(days.map((d) => d.n))],
    ["Month", MONTHS[month], "Type of Day", ...pad(days.map((d) => d.type))],
    ["Emp. ID", "Employee Name", "Role", ...pad(days.map((d) => d.dow)),
      "P", "HD", "WFH", "L", "A", "Days worked"],
  ];

  rows.forEach((r) => {
    sheet.push([
      r.user.empId || r.user.id.slice(0, 6).toUpperCase(),
      r.user.name,
      r.user.role || "",
      ...pad(r.cells.map((c) => c.code)),
      r.summary.P, r.summary.HD, r.summary.WH, r.summary.L, r.summary.A, r.summary.worked,
    ]);
  });

  sheet.push([]);
  sheet.push(["Legend"]);
  Object.entries(CODES)
    .filter(([c]) => c !== "·")
    .forEach(([code, spec]) => sheet.push(["", code, spec.label]));
  sheet.push(["", "·", "Not applicable — a future day, or before they joined"]);

  const holidayList = days.filter((d) => d.holiday);
  if (holidayList.length) {
    sheet.push([]);
    sheet.push(["Holidays this month"]);
    holidayList.forEach((d) => sheet.push(["", d.n, d.holiday.name]));
  }

  return sheet;
}

export function exportRegisterExcel(opts) {
  const { year, month, personName } = opts;
  const sheet = registerSheetRows(opts);

  const ws = XLSX.utils.aoa_to_sheet(sheet);
  ws["!cols"] = [{ wch: 10 }, { wch: 24 }, { wch: 16 },
    ...Array.from({ length: 31 }, () => ({ wch: 4.2 })),
    ...Array.from({ length: 6 }, () => ({ wch: 7 }))];
  /* Names stay put while the month scrolls sideways. */
  ws["!freeze"] = { xSplit: 3, ySplit: 6 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[month].slice(0, 3)} ${year}`);
  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|[\]]+/g, "-").trim();
  XLSX.writeFile(wb, `Attendance register - ${MONTHS[month]} ${year}${personName ? ` - ${safe(personName)}` : ""}.xlsx`);
}
