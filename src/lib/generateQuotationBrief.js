import { jsPDF } from "jspdf";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import {
  makeCtx, rs,
  PAGE, M, CONTENT_W, INK, GREY, RULE, MAROON, MAROON_DEEP, CREAM, DISPLAY, BODY,
} from "./generateQuotation";
import { quotationFee, feeLineAmount, computeStageAmounts, QUOTATION_BANK } from "./quotationDefaults";

/* ------------------------------------------------------------------------
   The one-page design quotation.

   Same document as the detailed proposal underneath — same client, area,
   rate and payment stages — printed short. It goes out when a client wants
   the number rather than the method, and the long version follows if they
   ask for scope in writing.
   ------------------------------------------------------------------------ */

const CREAM_SOFT = [243, 233, 216];
const CREAM_PALE = [250, 245, 236];

export function generateQuotationBriefPdf(q, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);
  const total = quotationFee(q);

  /* ---- who it's for ---- */
  doc.setFont(BODY, "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(...GREY);
  doc.text(fmtDate(q.date), PAGE.w - M.right, ctx.y, { align: "right" });

  doc.setFont(BODY, "normal");
  doc.setFontSize(9.6);
  doc.setTextColor(...MAROON);
  doc.text(`${q.serviceLine || "Interior Design"} for :`.toUpperCase(), M.left, ctx.y, { charSpace: 0.6 });
  ctx.y += 22;

  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...MAROON_DEEP);
  doc.splitTextToSize(String(q.clientName || "").toUpperCase(), CONTENT_W * 0.66).forEach((line) => {
    doc.text(line, M.left, ctx.y);
    ctx.y += 22;
  });

  if (q.location) {
    doc.setFont(BODY, "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...MAROON);
    doc.text(String(q.location).toUpperCase(), M.left, ctx.y);
    ctx.y += 14;
  }
  ctx.y += 18;

  /* ---- the brief ---- */
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...MAROON);
  doc.text("BRIEF :", M.left, ctx.y, { charSpace: 0.5 });
  ctx.y += 15;

  const brief = (q.pageOptions && q.pageOptions.briefText) ||
    `${q.serviceLine || "Interior design"} and execution co-ordination work to be carried out for ${q.clientName || ""}${q.location ? ` at ${q.location}` : ""}.`;
  doc.setFont(BODY, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.splitTextToSize(brief, CONTENT_W).forEach((line) => {
    doc.text(line, M.left, ctx.y);
    ctx.y += 14;
  });
  ctx.y += 20;

  /* ---- the figure ---- */
  const rateLabel = q.feeMode === "rate" && Number(q.ratePerSqft) > 0
    ? `( ${rs(q.ratePerSqft)} per sq.ft. )` : "";
  const cols = [
    { label: "WORK DESCRIPTION", w: CONTENT_W * 0.44, align: "center" },
    { label: "AREA", w: CONTENT_W * 0.22, align: "center" },
    { label: "TOTAL COST", w: CONTENT_W * 0.34, align: "center" },
  ];
  const colX = (i) => M.left + cols.slice(0, i).reduce((t, c) => t + c.w, 0);

  const headH = rateLabel ? 34 : 26;
  doc.setFillColor(...CREAM_SOFT);
  doc.rect(M.left, ctx.y, CONTENT_W, headH, "F");
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(8.6);
  doc.setTextColor(...MAROON);
  cols.forEach((c, i) => {
    const x = colX(i) + c.w / 2;
    doc.text(c.label, x, rateLabel ? ctx.y + 15 : ctx.y + 17, { align: "center", charSpace: 0.3 });
  });
  if (rateLabel) {
    doc.setFont(BODY, "normal");
    doc.setFontSize(8);
    doc.text(rateLabel, colX(2) + cols[2].w / 2, ctx.y + 27, { align: "center" });
  }
  ctx.y += headH;

  /* One row per category of work; a single-rate proposal has just the one. */
  const rows = q.feeMode === "lines" && (q.feeLines || []).length
    ? q.feeLines.map((l) => ({
        label: l.label || "Design",
        area: Number(l.area) > 0 ? `${Number(l.area).toLocaleString("en-IN")} sq.ft.` : "—",
        amount: feeLineAmount(l),
      }))
    : [{
        label: q.projectTitle || "Showroom design",
        area: Number(q.area) > 0 ? `${Number(q.area).toLocaleString("en-IN")} sq.ft.` : "—",
        amount: total,
      }];

  rows.forEach((row, i) => {
    doc.setFont(BODY, "normal");
    doc.setFontSize(9.4);
    const labelLines = doc.splitTextToSize(row.label, cols[0].w - 16);
    const h = Math.max(34, labelLines.length * 12 + 20);
    if (i % 2 === 1) { doc.setFillColor(...CREAM_PALE); doc.rect(M.left, ctx.y, CONTENT_W, h, "F"); }

    doc.setTextColor(...INK);
    let ly = ctx.y + (h - labelLines.length * 12) / 2 + 9;
    labelLines.forEach((l) => { doc.text(l, colX(0) + cols[0].w / 2, ly, { align: "center" }); ly += 12; });

    const mid = ctx.y + h / 2 + 3.5;
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(9.6);
    doc.text(row.area, colX(1) + cols[1].w / 2, mid - 5, { align: "center" });
    if (row.area !== "—") {
      doc.setFont(BODY, "normal");
      doc.setFontSize(7.6);
      doc.setTextColor(...GREY);
      doc.text("(approx)", colX(1) + cols[1].w / 2, mid + 6, { align: "center" });
    }

    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(rs(row.amount), colX(2) + cols[2].w / 2, mid, { align: "center" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    cols.forEach((c, ci) => doc.line(colX(ci), ctx.y, colX(ci), ctx.y + h));
    doc.line(PAGE.w - M.right, ctx.y, PAGE.w - M.right, ctx.y + h);
    doc.line(M.left, ctx.y + h, PAGE.w - M.right, ctx.y + h);
    ctx.y += h;
  });

  /* total */
  const th = 30;
  doc.setFillColor(...CREAM_SOFT);
  doc.rect(M.left, ctx.y, CONTENT_W, th, "F");
  doc.setDrawColor(...RULE);
  doc.rect(M.left, ctx.y, CONTENT_W, th);
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...MAROON);
  doc.text("TOTAL", colX(0) + cols[0].w / 2, ctx.y + 19.5, { align: "center", charSpace: 0.5 });
  doc.setFontSize(12);
  doc.setTextColor(...MAROON_DEEP);
  doc.text(rs(total), colX(2) + cols[2].w / 2, ctx.y + 19.5, { align: "center" });
  ctx.y += th + 4;

  const gstLine = Number(q.gstRate) > 0 ? `(+ ${q.gstRate}% GST)` : (q.gstNote || "GST extra as applicable.");
  doc.setFont(BODY, "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...GREY);
  doc.text(gstLine, PAGE.w - M.right, ctx.y + 8, { align: "right" });
  ctx.y += 28;

  /* ---- what it covers ---- */
  const inclusions = (q.inclusions || []).filter(Boolean);
  if (inclusions.length) {
    doc.setFont(BODY, "normal");
    doc.setFontSize(9.4);
    doc.setTextColor(...INK);
    doc.text("For the above mentioned quote :-", M.left, ctx.y);
    ctx.y += 18;

    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(...MAROON);
    doc.text("THINGS INCLUSIVE :", M.left, ctx.y, { charSpace: 0.4 });
    ctx.y += 14;

    inclusions.forEach((item, i) => {
      doc.setFont(BODY, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(String(item), CONTENT_W - 26);
      lines.forEach((line, li) => {
        if (li === 0) {
          doc.setFont(DISPLAY, "bold");
          doc.text(`${i + 1}.`, M.left + 8, ctx.y);
          doc.setFont(BODY, "normal");
        }
        doc.text(line, M.left + 26, ctx.y);
        ctx.y += 12.5;
      });
    });
    ctx.y += 16;
  }

  /* ---- payment and bank, side by side ---- */
  const stages = q.paymentStages || [];
  const amounts = computeStageAmounts(total, stages);
  const colW = CONTENT_W / 2 - 14;
  const blockTop = ctx.y;

  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.6);
  doc.setTextColor(...MAROON);
  doc.text("PAYMENT SCHEDULE :", M.left, ctx.y, { charSpace: 0.4 });

  let py = ctx.y + 18;
  stages.forEach((st, i) => {
    doc.setFont(BODY, "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    doc.text(`- ${st.milestone}`, M.left + 4, py, { maxWidth: colW - 110 });
    doc.setFont(DISPLAY, "bold");
    doc.text(`: ${st.percentage}%`, M.left + colW - 96, py);
    doc.setFont(BODY, "normal");
    doc.setTextColor(...GREY);
    doc.setFontSize(8.4);
    doc.text(rs(amounts[i]), M.left + colW - 4, py, { align: "right" });
    py += 15;
  });

  const bx = M.left + colW + 28;
  let by = blockTop;
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.6);
  doc.setTextColor(...MAROON);
  doc.text("ACCOUNT DETAILS :", bx, by, { charSpace: 0.4 });
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(0.7);
  doc.line(bx, by + 3.5, bx + 108, by + 3.5);
  by += 18;

  const bank = q.bank || QUOTATION_BANK;
  [
    ["Account name", bank.accountName],
    ["Bank", bank.bankName],
    ["Branch", bank.branch],
    ["Current A/C no.", bank.accountNumber],
    ["IFSC", bank.ifsc],
  ].forEach(([label, value]) => {
    if (!value) return;
    doc.setFont(BODY, "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...GREY);
    doc.text(`${label} :`, bx, by);
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(String(value), bx + 84, by);
    by += 14;
  });

  ctx.y = Math.max(py, by) + 18;

  /* ---- sign-off ---- */
  if (q.signatoryName) {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    doc.line(M.left, ctx.y, M.left + 150, ctx.y);
    ctx.y += 12;
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(9.4);
    doc.setTextColor(...INK);
    doc.text(q.signatoryName, M.left, ctx.y);
    ctx.y += 11;
    if (q.signatoryTitle) {
      doc.setFont(DISPLAY, "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(...GREY);
      doc.text(q.signatoryTitle, M.left, ctx.y);
      ctx.y += 10;
    }
    doc.setFont(DISPLAY, "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(...GREY);
    doc.text(COMPANY_INFO.name, M.left, ctx.y);
  }

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `${safe(q.quotationNo)} - ${safe(q.clientName) || "Client"}.pdf`;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}
