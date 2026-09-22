import { jsPDF } from "jspdf";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import {
  makeCtx, heading, para, rs,
  PAGE, M, CONTENT_W, INK, GREY, RULE, MAROON, MAROON_DEEP, CREAM, DISPLAY, BODY,
} from "./generateQuotation";
import { amountInWords } from "./quotationDefaults";

/* The quotation module doesn't export its soft cream, so it's restated here. */
const CREAM_SOFT = [243, 233, 216];

/* ------------------------------------------------------------------------
   Statement of account for the final bill.

   Two lists that the client has to be able to check line by line: what we
   paid out on their behalf at their request, and what they paid us in
   advance. The difference is the figure on the invoice, and every rupee of it
   traces back to a dated line above.
   ------------------------------------------------------------------------ */

/* Only money that has actually been approved counts against the client.
   A pending or rejected bill is not yet something to recover. */
export function recoverableTotals(expenses, advances) {
  const recoverable = expenses.filter((e) => e.billableToClient && e.status === "Approved");
  const pending = expenses.filter((e) => e.billableToClient && e.status === "Pending");
  const spent = recoverable.reduce((s, e) => s + e.amount, 0);
  const received = advances.reduce((s, a) => s + a.amount, 0);
  return {
    recoverable, pending, spent, received,
    pendingAmount: pending.reduce((s, e) => s + e.amount, 0),
    balance: spent - received,    // positive: client owes us; negative: advance unused
  };
}

function table(ctx, { title, cols, rows, total, totalLabel }) {
  const { doc } = ctx;
  const colX = (i) => M.left + cols.slice(0, i).reduce((t, c) => t + c.w, 0);

  ctx.need(60);
  heading(ctx, title, 10.5);

  const head = () => {
    const h = 22;
    doc.setFillColor(...MAROON_DEEP);
    doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(...CREAM);
    cols.forEach((c, i) => {
      const x = c.align === "right" ? colX(i) + c.w - 7 : c.align === "center" ? colX(i) + c.w / 2 : colX(i) + 7;
      doc.text(c.label, x, ctx.y + 14.5, { align: c.align || "left" });
    });
    ctx.y += h;
  };
  head();

  if (!rows.length) {
    doc.setFont(BODY, "normal");
    doc.setFontSize(8.6);
    doc.setTextColor(...GREY);
    doc.text("None recorded.", M.left + 7, ctx.y + 15);
    ctx.y += 24;
  }

  rows.forEach((cells, r) => {
    doc.setFont(BODY, "normal");
    doc.setFontSize(8.6);
    const wrapped = cells.map((c, i) => doc.splitTextToSize(String(c ?? ""), cols[i].w - 14));
    const h = Math.max(22, Math.max(...wrapped.map((w) => w.length)) * 11 + 11);
    if (ctx.y + h > ctx.bottom) { ctx.newPage(); head(); }
    const top = ctx.y;
    if (r % 2 === 1) { doc.setFillColor(247, 243, 236); doc.rect(M.left, top, CONTENT_W, h, "F"); }

    wrapped.forEach((lines, i) => {
      const c = cols[i];
      const isMoney = c.align === "right";
      doc.setFont(isMoney ? DISPLAY : BODY, isMoney ? "bold" : "normal");
      doc.setFontSize(isMoney ? 8.8 : 8.6);
      doc.setTextColor(...INK);
      const x = c.align === "right" ? colX(i) + c.w - 7 : c.align === "center" ? colX(i) + c.w / 2 : colX(i) + 7;
      let ty = top + (h - lines.length * 11) / 2 + 8.5;
      lines.forEach((l) => { doc.text(l, x, ty, { align: c.align || "left" }); ty += 11; });
    });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(M.left, top + h, PAGE.w - M.right, top + h);
    ctx.y += h;
  });

  const h = 24;
  ctx.need(h);
  doc.setFillColor(...CREAM_SOFT);
  doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MAROON);
  doc.text(totalLabel, PAGE.w - M.right - 110, ctx.y + 15.5, { align: "right" });
  doc.text(rs(total), PAGE.w - M.right - 7, ctx.y + 15.5, { align: "right" });
  ctx.y += h + 18;
}

export function generateClientStatementPdf({ project, expenses, advances, preparedBy }, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);
  const today = new Date().toISOString().slice(0, 10);
  const t = recoverableTotals(expenses, advances);

  doc.setFont(BODY, "normal");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  doc.text(fmtDate(today), PAGE.w - M.right, ctx.y, { align: "right" });
  doc.text("To", M.left, ctx.y);
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(10);
  doc.text(`${project.client || ""},`, M.left, ctx.y + 13);
  doc.setFont(BODY, "normal");
  doc.setFontSize(9.6);
  if (project.location) doc.text(project.location + ",", M.left, ctx.y + 26);
  ctx.y += 46;

  heading(ctx, "Subject:", 10);
  para(ctx, `Statement of account — works arranged on your behalf, ${project.name}${project.location ? `, ${project.location}` : ""}.`,
    { bold: true, size: 10, lead: 14, gap: 12 });
  para(ctx, "Dear Sir,", { gap: 8 });
  para(ctx,
    "At your request we arranged the following items, which fall outside our scope of work, and paid for them on your behalf. Set against them are the advances you have paid us. The balance is carried to the final bill.",
    { gap: 16 });

  table(ctx, {
    title: "WORKS ARRANGED ON YOUR BEHALF",
    cols: [
      { label: "#", w: CONTENT_W * 0.06, align: "center" },
      { label: "Date", w: CONTENT_W * 0.14 },
      { label: "Item", w: CONTENT_W * 0.38 },
      { label: "Paid to", w: CONTENT_W * 0.22 },
      { label: "Amount", w: CONTENT_W * 0.20, align: "right" },
    ],
    rows: t.recoverable
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((e, i) => [i + 1, fmtDate(e.date), e.description + (e.invoiceNo ? ` (bill ${e.invoiceNo})` : ""), e.vendor || "—", rs(e.amount)]),
    total: t.spent,
    totalLabel: "TOTAL PAID ON YOUR BEHALF",
  });

  table(ctx, {
    title: "ADVANCES RECEIVED FROM YOU",
    cols: [
      { label: "#", w: CONTENT_W * 0.06, align: "center" },
      { label: "Date", w: CONTENT_W * 0.14 },
      { label: "Paid towards", w: CONTENT_W * 0.38 },
      { label: "Mode / reference", w: CONTENT_W * 0.22 },
      { label: "Amount", w: CONTENT_W * 0.20, align: "right" },
    ],
    rows: advances.map((a, i) => [
      i + 1, fmtDate(a.date), a.purpose || "Advance",
      [a.mode, a.reference].filter(Boolean).join(" · "), rs(a.amount),
    ]),
    total: t.received,
    totalLabel: "TOTAL ADVANCES",
  });

  /* ---- the reconciliation, with the sign-off beside it ----
     The totals box takes the right of the page; the sign-off sits in the
     space to its left, so a short statement stays on one sheet instead of
     leaving "With warm regards" alone on page two. */
  ctx.need(120);
  const sigTop = ctx.y;
  const box = (label, value, strong) => {
    const h = strong ? 30 : 22;
    doc.setFillColor(...(strong ? MAROON : [255, 255, 255]));
    doc.rect(M.left + CONTENT_W * 0.4, ctx.y, CONTENT_W * 0.6, h, "F");
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    if (!strong) doc.rect(M.left + CONTENT_W * 0.4, ctx.y, CONTENT_W * 0.6, h);
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(strong ? 10 : 8.8);
    doc.setTextColor(...(strong ? CREAM : INK));
    doc.text(label, M.left + CONTENT_W * 0.4 + 10, ctx.y + h / 2 + 3.2);
    doc.text(rs(Math.abs(value)), PAGE.w - M.right - 10, ctx.y + h / 2 + 3.2, { align: "right" });
    ctx.y += h;
  };
  box("Paid on your behalf", t.spent);
  box("Less: advances received", -t.received);
  box(t.balance >= 0 ? "BALANCE DUE FROM YOU" : "ADVANCE HELD IN YOUR FAVOUR", t.balance, true);
  const boxBottom = ctx.y;

  let sy = sigTop + 10;
  doc.setFont(BODY, "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(...INK);
  doc.text("With warm regards,", M.left, sy);
  sy += 30;
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.6);
  if (preparedBy) { doc.text(preparedBy, M.left, sy); sy += 12; }
  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...GREY);
  doc.text(COMPANY_INFO.name, M.left, sy);

  ctx.y = Math.max(boxBottom, sy) + 12;
  para(ctx, `${amountInWords(Math.abs(t.balance))}.`, { size: 9, color: GREY, gap: 10 });

  if (t.balance < 0) {
    para(ctx, "The advances received exceed the works arranged so far. The balance will be adjusted against the final bill or refunded, as agreed.",
      { size: 9, gap: 10 });
  }
  if (t.pending.length) {
    para(ctx, `A further ${rs(t.pendingAmount)} across ${t.pending.length} item${t.pending.length === 1 ? " is" : "s are"} awaiting verification and ${t.pending.length === 1 ? "is" : "are"} not included above.`,
      { size: 9, color: GREY, gap: 10 });
  }

  para(ctx, "Bills for each item are available on request.", { size: 9, color: GREY, gap: 4 });

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  if (mode === "preview") return doc.output("bloburl");
  doc.save(`Statement of account - ${safe(project.name)}.pdf`);
  return null;
}
