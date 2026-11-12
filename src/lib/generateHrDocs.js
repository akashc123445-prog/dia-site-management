import { jsPDF } from "jspdf";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import {
  makeCtx, para, rs,
  PAGE, M, CONTENT_W, INK, GREY, RULE, MAROON, CREAM, DISPLAY, BODY,
} from "./generateQuotation";
import { amountInWords } from "./quotationDefaults";
import { slipFigures, salaryFigures, monthLabel, fillWording, referenceNo, withArticle, longDate } from "./hrDocuments";

/* ------------------------------------------------------------------------
   The two documents an employee asks the office for: a salary slip for a
   month, and an experience certificate.

   Both go out on the firm's letterhead, one sheet each, ready to sign.
   ------------------------------------------------------------------------ */

const CREAM_SOFT = [243, 233, 216];
const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
const todayIso = () => new Date().toISOString().slice(0, 10);

function finish(doc, filename, mode) {
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}

/* Reference on the left, date on the right, then the title centred. */
function docHead(ctx, { ref, date, title, sub }) {
  const { doc } = ctx;
  doc.setFont(BODY, "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(...GREY);
  doc.text(`Ref: ${ref}`, M.left, ctx.y);
  doc.text(`Date: ${longDate(date)}`, PAGE.w - M.right, ctx.y, { align: "right" });
  ctx.y += 34;

  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...MAROON);
  doc.text(title, PAGE.w / 2, ctx.y, { align: "center", charSpace: 1.2 });
  ctx.y += 9;
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(0.8);
  doc.line(PAGE.w / 2 - 46, ctx.y, PAGE.w / 2 + 46, ctx.y);
  ctx.y += 16;

  if (sub) {
    doc.setFont(DISPLAY, "normal");
    doc.setFontSize(9.4);
    doc.setTextColor(...INK);
    doc.text(sub, PAGE.w / 2, ctx.y, { align: "center", charSpace: 0.6 });
    ctx.y += 14;
  }
  ctx.y += 14;
}

function signatureBlock(ctx, { name, title, note }) {
  const { doc } = ctx;
  ctx.need(96);
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.4);
  doc.setTextColor(...INK);
  doc.text(`For ${COMPANY_INFO.name}`, M.left, ctx.y);
  ctx.y += 54;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  doc.line(M.left, ctx.y, M.left + 190, ctx.y);
  ctx.y += 13;
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.2);
  doc.text(String(name || "Authorised Signatory").toUpperCase(), M.left, ctx.y);
  ctx.y += 11;
  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...GREY);
  doc.text(String(title || "Authorised Signatory").toUpperCase(), M.left, ctx.y);
  if (note) {
    ctx.y += 22;
    doc.setFont(BODY, "italic");
    doc.setFontSize(8);
    doc.text(note, M.left, ctx.y);
  }
}

/* ---- salary slip -------------------------------------------------------- */

export function generateSalarySlipPdf({ user, hr, slip, signatory }, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);
  const f = slipFigures(hr, slip);
  const issued = slip.issuedOn || todayIso();

  docHead(ctx, {
    ref: referenceNo("SLIP", user, `${slip.month}-01`).slice(0, -2),
    date: issued,
    title: "SALARY SLIP",
    sub: `FOR THE MONTH OF ${monthLabel(slip.month).toUpperCase()}`,
  });

  /* ---- who it is for ---- */
  const info = [
    ["Employee name", [hr.title, user.name].filter(Boolean).join(" ")],
    ["Employee ID", user.empId || "—"],
    ["Designation", hr.designation || "—"],
    ["Date of joining", user.joinedOn ? fmtDate(user.joinedOn) : "—"],
    ["Days in month", String(f.days)],
    ["Days paid", f.lop ? `${f.paidDays}  (unpaid leave: ${f.lop})` : String(f.paidDays)],
  ];
  const half = CONTENT_W / 2;
  const rowH = 20;
  doc.setFillColor(...CREAM_SOFT);
  doc.rect(M.left, ctx.y, CONTENT_W, rowH * 3 + 8, "F");
  info.forEach(([k, v], i) => {
    const x = M.left + (i % 2) * half + 12;
    const y = ctx.y + 18 + Math.floor(i / 2) * rowH;
    doc.setFont(DISPLAY, "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...GREY);
    doc.text(k.toUpperCase(), x, y);
    doc.setFont(BODY, "bold");
    doc.setFontSize(9.4);
    doc.setTextColor(...INK);
    doc.text(String(v), x + 92, y);
  });
  ctx.y += rowH * 3 + 8 + 18;

  /* ---- earnings beside deductions ---- */
  const colW = half - 6;
  const xL = M.left, xR = M.left + half + 6;
  const headH = 22;
  [["EARNINGS", xL], ["DEDUCTIONS", xR]].forEach(([label, x]) => {
    doc.setFillColor(...MAROON);
    doc.rect(x, ctx.y, colW, headH, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...CREAM);
    doc.text(label, x + 10, ctx.y + 14.5);
    doc.text("AMOUNT", x + colW - 10, ctx.y + 14.5, { align: "right" });
  });
  ctx.y += headH;

  const lineH = 21;
  const rows = Math.max(f.earnings.length, f.deductions.length, 1);
  const drawRow = (r, x, y) => {
    if (!r) return;
    doc.setFont(BODY, "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    doc.text(r.label, x + 10, y + 14);
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(8.8);
    doc.text(rs(r.amount), x + colW - 10, y + 14, { align: "right" });
  };
  for (let i = 0; i < rows; i++) {
    drawRow(f.earnings[i], xL, ctx.y);
    drawRow(f.deductions[i] || (i === 0 && !f.deductions.length ? { label: "None", amount: 0 } : null), xR, ctx.y);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(xL, ctx.y + lineH, xL + colW, ctx.y + lineH);
    doc.line(xR, ctx.y + lineH, xR + colW, ctx.y + lineH);
    ctx.y += lineH;
  }

  [["Gross earnings", f.gross, xL], ["Total deductions", f.totalDeductions, xR]].forEach(([label, value, x]) => {
    doc.setFillColor(...CREAM_SOFT);
    doc.rect(x, ctx.y, colW, 22, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(...MAROON);
    doc.text(label, x + 10, ctx.y + 14.5);
    doc.text(rs(value), x + colW - 10, ctx.y + 14.5, { align: "right" });
  });
  ctx.y += 22 + 16;

  /* ---- what is paid ---- */
  doc.setFillColor(...MAROON);
  doc.rect(M.left, ctx.y, CONTENT_W, 30, "F");
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(10.4);
  doc.setTextColor(...CREAM);
  doc.text("NET PAY FOR THE MONTH", M.left + 12, ctx.y + 19.5);
  doc.text(rs(f.net), PAGE.w - M.right - 12, ctx.y + 19.5, { align: "right" });
  ctx.y += 30 + 15;

  doc.setFont(BODY, "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`${amountInWords(f.net)}.`, M.left, ctx.y);
  ctx.y += 24;

  /* ---- the standing salary, so the slip also answers "what do you earn" ---- */
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(M.left, ctx.y, PAGE.w - M.right, ctx.y);
  ctx.y += 16;
  [["Monthly salary (gross)", f.monthly], ["Annual salary (per annum)", f.annual]].forEach(([label, value], i) => {
    const x = M.left + i * half;
    doc.setFont(DISPLAY, "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x, ctx.y);
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(10.4);
    doc.setTextColor(...INK);
    doc.text(rs(value), x, ctx.y + 15);
  });
  ctx.y += 46;

  signatureBlock(ctx, { name: signatory?.name, title: signatory?.title });

  return finish(doc, `Salary slip - ${safe(user.name)} - ${monthLabel(slip.month)}.pdf`, mode);
}

/* ---- experience certificate ---------------------------------------------- */

export function generateExperienceCertificatePdf({ user, hr, cert, signatory }, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);
  const issued = cert.issuedOn || todayIso();
  const who = { name: user.name, title: hr.title };
  const fill = (t) => fillWording(t, who);
  const body = { size: 10.6, lead: 17, gap: 12 };

  docHead(ctx, {
    ref: referenceNo("EXP", user, issued),
    date: issued,
    title: "EXPERIENCE CERTIFICATE",
    sub: "TO WHOMSOEVER IT MAY CONCERN",
  });

  const idPart = user.empId ? ` (Employee ID ${user.empId})` : "";
  const from = longDate(user.joinedOn);
  const role = withArticle(hr.designation);
  const firm = titleCase(COMPANY_INFO.name);
  const opening = cert.lastWorkingDay
    ? `This is to certify that {name}${idPart} was employed with ${firm} as ${role} ${from ? `from ${from} to` : "until"} ${longDate(cert.lastWorkingDay)}.`
    : `This is to certify that {name}${idPart} has been employed with ${firm} as ${role}${from ? ` since ${from}` : ""} and continues to be in our employment as on the date of this certificate.`;
  para(ctx, fill(opening), body);

  if (String(cert.duties || "").trim()) para(ctx, fill(cert.duties), body);

  if (cert.includeSalary) {
    const f = salaryFigures(hr);
    if (f.monthly > 0) {
      para(ctx, fill(
        `${cert.lastWorkingDay ? "At the time of leaving, {his} salary was" : "{his} present salary is"} ${rs(f.monthly)} per month (${amountInWords(f.monthly)}), which comes to ${rs(f.annual)} per annum.`
      ).replace(/^./, (c) => c.toUpperCase()), body);
    }
  }

  if (String(cert.conductText || "").trim()) para(ctx, fill(cert.conductText), body);

  ctx.y += 26;
  signatureBlock(ctx, { name: signatory?.name, title: signatory?.title });

  return finish(doc, `Experience certificate - ${safe(user.name)}.pdf`, mode);
}

function titleCase(s) {
  return String(s || "").toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bDia\b/, "DIA");
}
