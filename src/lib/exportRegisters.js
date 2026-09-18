import * as XLSX from "xlsx";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";

/* ------------------------------------------------------------------------
   The registers an office actually has to produce: who was in and what they
   did, what was spent, and who was off. Each is a plain sheet with real
   dates and numbers, so it can be filtered and totalled by whoever receives
   it rather than retyped.
   ------------------------------------------------------------------------ */

const clock = (iso) => iso
  ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  : "";

function save(rows, cols, sheetName, filename) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = cols.map((wch) => ({ wch }));
  /* Freezes the header so a long register stays readable while scrolling. */
  ws["!freeze"] = { xSplit: 0, ySplit: rows.findIndex((r) => r[0] === "#") + 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

const safe = (v) => String(v || "").replace(/[\\/:*?"<>|[\]]+/g, "-").replace(/\s+/g, " ").trim();

/* ---- attendance with the day's work ------------------------------------- */

export function exportAttendanceExcel({ records, users, from, to }) {
  const name = (id) => users.find((u) => u.id === id)?.name || "—";
  const role = (id) => users.find((u) => u.id === id)?.role || "";

  const rows = [
    [COMPANY_INFO.name],
    [`Attendance and work report — ${fmtDate(from)} to ${fmtDate(to)}`],
    [],
    ["#", "Date", "Name", "Role", "In", "Out", "Hours", "Working from",
      "What they set out to do", "What they got done"],
  ];

  const sorted = [...records].sort((a, b) =>
    a.date === b.date ? name(a.userId).localeCompare(name(b.userId)) : (a.date < b.date ? 1 : -1));

  sorted.forEach((r, i) => {
    /* Hours only where the day was closed off — an open record would give a
       figure that grows while nobody is working. */
    const hours = r.checkInAt && r.checkOutAt
      ? Math.round(((Date.parse(r.checkOutAt) - Date.parse(r.checkInAt)) / 3600000) * 100) / 100
      : "";
    rows.push([
      i + 1, r.date, name(r.userId), role(r.userId),
      clock(r.checkInAt), clock(r.checkOutAt), hours,
      r.location || "", r.checkInNote || "", r.checkOutNote || "",
    ]);
  });

  rows.push([]);
  rows.push(["", "", `${sorted.length} record${sorted.length === 1 ? "" : "s"}`]);

  save(rows, [5, 12, 22, 14, 10, 10, 8, 20, 52, 52], "Attendance",
    `Attendance ${safe(from)} to ${safe(to)}.xlsx`);
}

/* ---- office petty cash --------------------------------------------------- */

export function exportOfficeExpensesExcel({ expenses, users, label }) {
  const name = (id) => users.find((u) => u.id === id)?.name || "—";

  const rows = [
    [COMPANY_INFO.name],
    [`Office petty cash — ${label}`],
    [],
    ["#", "Date", "Office", "Category", "Purpose", "Amount", "Paid by",
      "Recorded by", "Status", "Reimbursed", "Notes"],
  ];

  const sorted = [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1));
  sorted.forEach((e, i) => {
    rows.push([
      i + 1, e.date, e.office, e.category, e.purpose,
      e.amount, e.paymentMethod, name(e.submittedBy), e.status,
      e.paid ? "Yes" : "No", e.notes || "",
    ]);
  });

  /* Rejected entries are listed but never counted. */
  const counted = sorted.filter((e) => e.status !== "Rejected");
  rows.push([]);
  rows.push(["", "", "", "", "Total (excluding rejected)", counted.reduce((s, e) => s + e.amount, 0)]);

  ["Bengaluru", "Chennai"].forEach((office) => {
    const total = counted.filter((e) => e.office === office).reduce((s, e) => s + e.amount, 0);
    if (total) rows.push(["", "", "", "", `${office}`, total]);
  });

  save(rows, [5, 12, 14, 24, 46, 12, 14, 20, 12, 12, 34], "Office expenses",
    `Office expenses ${safe(label)}.xlsx`);
}

/* ---- leave and permissions ----------------------------------------------- */

export function exportLeaveExcel({ requests, users, label }) {
  const name = (id) => users.find((u) => u.id === id)?.name || "—";
  const role = (id) => users.find((u) => u.id === id)?.role || "";

  const rows = [
    [COMPANY_INFO.name],
    [`Leave and permissions — ${label}`],
    [],
    ["#", "Name", "Role", "Type", "From", "To", "Days", "Time",
      "Reason", "Status", "Decided by", "Decided on", "Note"],
  ];

  const sorted = [...requests].sort((a, b) => (a.fromDate < b.fromDate ? 1 : -1));
  sorted.forEach((r, i) => {
    rows.push([
      i + 1, name(r.userId), role(r.userId), r.kind,
      r.fromDate, r.toDate, r.days, r.timeNote || "",
      r.reason, r.status, r.decidedBy ? name(r.decidedBy) : "",
      r.decidedAt ? r.decidedAt.slice(0, 10) : "", r.decisionNote || "",
    ]);
  });

  /* A summary per person: the figure anyone actually opens this file for. */
  rows.push([]);
  rows.push(["Days taken per person — approved only"]);
  rows.push(["Name", "Role", "Leave days", "Half days", "Permissions"]);

  const people = [...new Set(sorted.map((r) => r.userId))];
  people.forEach((id) => {
    const theirs = sorted.filter((r) => r.userId === id && r.status === "Approved");
    const leaveDays = theirs.filter((r) => r.kind === "Leave").reduce((s, r) => s + r.days, 0);
    const halfDays = theirs.filter((r) => r.kind === "Half day").length;
    const permissions = theirs.filter((r) => r.kind !== "Leave" && r.kind !== "Half day").length;
    rows.push([name(id), role(id), leaveDays, halfDays, permissions]);
  });

  save(rows, [5, 22, 14, 16, 12, 12, 8, 16, 40, 12, 20, 14, 30], "Leave",
    `Leave register ${safe(label)}.xlsx`);
}
