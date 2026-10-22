import { jsPDF } from "jspdf";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import {
  makeCtx, heading, para, rs,
  PAGE, M, CONTENT_W, INK, GREY, RULE, MAROON, MAROON_DEEP, CREAM, DISPLAY, BODY,
} from "./generateQuotation";
import { amountInWords } from "./quotationDefaults";

/* ------------------------------------------------------------------------
   An expense claim: one person's spending over a period, on one sheet, for
   accounts to check and pay.

   It exists because a spreadsheet is the wrong thing to hand across a desk.
   This prints the bills in date order with a total in words, a declaration
   and two signature lines, so it can be signed and filed as it stands.
   ------------------------------------------------------------------------ */

const CREAM_SOFT = [243, 233, 216];

const STATUS_WORD = {
  Approved: "Approved",
  Pending: "Awaiting approval",
  Rejected: "Rejected",
};

export function generateExpenseClaimPdf({ person, expenses, projectName, periodLabel, includeRejected = false }, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);

  /* A rejected bill is not a claim. It is listed only if asked for, and never
     counted towards what is owed. */
  const rows = [...expenses]
    .filter((e) => includeRejected || e.status !== "Rejected")
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const claimable = rows.filter((e) => e.status !== "Rejected");
  const total = claimable.reduce((s, e) => s + e.amount, 0);
  const reimbursed = claimable.filter((e) => e.paid).reduce((s, e) => s + e.amount, 0);
  const outstanding = total - reimbursed;

  /* ---- head ---- */
  doc.setFont(BODY, "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(...GREY);
  doc.text(fmtDate(new Date().toISOString().slice(0, 10)), PAGE.w - M.right, ctx.y, { align: "right" });

  heading(ctx, "EXPENSE CLAIM", 13);

  doc.setFont(BODY, "normal");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  const facts = [
    ["Claimed by", person?.name || ""],
    ["Role", person?.role || ""],
    ["Period", periodLabel || "All dates"],
    ["Bills claimed", String(claimable.length)],
  ];
  facts.forEach(([label, value], i) => {
    const x = M.left + (i % 2) * (CONTENT_W / 2);
    const y = ctx.y + Math.floor(i / 2) * 15;
    doc.setFont(BODY, "normal");
    doc.setFontSize(8.6);
    doc.setTextColor(...GREY);
    doc.text(`${label}:`, x, y);
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(9.4);
    doc.setTextColor(...INK);
    doc.text(String(value), x + 68, y);
  });
  ctx.y += 30 + 18;

  /* ---- the bills ---- */
  const cols = [
    { label: "#", w: CONTENT_W * 0.05, align: "center" },
    { label: "Date", w: CONTENT_W * 0.11 },
    { label: "Project", w: CONTENT_W * 0.17 },
    { label: "What it was for", w: CONTENT_W * 0.28 },
    { label: "Paid to", w: CONTENT_W * 0.17 },
    { label: "Status", w: CONTENT_W * 0.1, align: "center" },
    { label: "Amount", w: CONTENT_W * 0.12, align: "right" },
  ];
  const colX = (i) => M.left + cols.slice(0, i).reduce((t, c) => t + c.w, 0);

  const head = () => {
    const h = 22;
    doc.setFillColor(...MAROON_DEEP);
    doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...CREAM);
    cols.forEach((c, i) => {
      const x = c.align === "right" ? colX(i) + c.w - 6 : c.align === "center" ? colX(i) + c.w / 2 : colX(i) + 6;
      doc.text(c.label, x, ctx.y + 14.5, { align: c.align || "left" });
    });
    ctx.y += h;
  };
  ctx.need(70);
  head();

  rows.forEach((e, i) => {
    doc.setFont(BODY, "normal");
    doc.setFontSize(8.4);
    const cells = [
      String(i + 1),
      fmtDate(e.date),
      projectName ? projectName(e.projectId) : "",
      e.description + (e.invoiceNo ? ` (bill ${e.invoiceNo})` : ""),
      e.vendor || "—",
      STATUS_WORD[e.status] || e.status,
      rs(e.amount),
    ];
    const wrapped = cells.map((c, ci) => doc.splitTextToSize(String(c), cols[ci].w - 12));
    const h = Math.max(21, Math.max(...wrapped.map((w) => w.length)) * 10.5 + 10);

    if (ctx.y + h > ctx.bottom) { ctx.newPage(); head(); }
    const top = ctx.y;
    if (i % 2 === 1) { doc.setFillColor(248, 244, 237); doc.rect(M.left, top, CONTENT_W, h, "F"); }

    wrapped.forEach((lines, ci) => {
      const c = cols[ci];
      const money = c.align === "right";
      doc.setFont(money ? DISPLAY : BODY, money ? "bold" : "normal");
      doc.setFontSize(money ? 8.8 : 8.4);
      doc.setTextColor(...(e.status === "Rejected" ? GREY : INK));
      const x = c.align === "right" ? colX(ci) + c.w - 6 : c.align === "center" ? colX(ci) + c.w / 2 : colX(ci) + 6;
      let ty = top + (h - lines.length * 10.5) / 2 + 8;
      lines.forEach((l) => { doc.text(l, x, ty, { align: c.align || "left" }); ty += 10.5; });
    });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(M.left, top + h, PAGE.w - M.right, top + h);
    ctx.y += h;
  });

  /* ---- totals ---- */
  const bar = (label, value, strong) => {
    const h = strong ? 28 : 21;
    ctx.need(h);
    doc.setFillColor(...(strong ? MAROON : CREAM_SOFT));
    doc.rect(M.left + CONTENT_W * 0.45, ctx.y, CONTENT_W * 0.55, h, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(strong ? 10 : 8.8);
    doc.setTextColor(...(strong ? CREAM : MAROON));
    doc.text(label, M.left + CONTENT_W * 0.45 + 10, ctx.y + h / 2 + 3.2);
    doc.text(rs(value), PAGE.w - M.right - 8, ctx.y + h / 2 + 3.2, { align: "right" });
    ctx.y += h;
  };
  ctx.y += 2;
  bar("Total claimed", total, true);
  if (reimbursed > 0) {
    bar("Already reimbursed", reimbursed);
    bar("Outstanding", outstanding);
  }
  ctx.y += 10;

  doc.setFont(BODY, "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`${amountInWords(outstanding > 0 ? outstanding : total)}.`, M.left, ctx.y);
  ctx.y += 20;

  /* ---- declaration and signatures ---- */
  ctx.need(104);
  para(ctx,
    "I confirm that the amounts above were spent on company work, that the bills attached are genuine, and that no part of this claim has been submitted before.",
    { size: 9, lead: 13, gap: 36 });

  const colW = CONTENT_W / 2 - 20;
  const ruleY = ctx.y;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  doc.line(M.left, ruleY, M.left + colW, ruleY);
  doc.line(M.left + CONTENT_W - colW, ruleY, PAGE.w - M.right, ruleY);

  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(person?.name || "Claimed by", M.left, ruleY + 13);
  doc.text("For " + COMPANY_INFO.name, M.left + CONTENT_W - colW, ruleY + 13);

  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...GREY);
  doc.text("Signature & date", M.left, ruleY + 24);
  doc.text("Accounts — received & approved", M.left + CONTENT_W - colW, ruleY + 24);

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `Expense claim - ${safe(person?.name)} - ${safe(periodLabel || "all")}.pdf`;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}
