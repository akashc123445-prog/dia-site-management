import { jsPDF } from "jspdf";
import { COMPANY_INFO, DIA, LOGO_LETTERHEAD } from "./constants";
import { fmtDate } from "./helpers";
import { TRAJAN, registerBrandFonts } from "./brandFonts";
import {
  boqItemQty, boqItemAmount, boqSectionTotal, boqTotals,
  sectionCode, computeStageAmounts,
} from "./quotationDefaults";

/* ------------------------------------------------------------------------
   Bill of Quantities — A3 portrait, the sheet these are printed on.

   A3 portrait is exactly as wide as A4 landscape (841.89pt) but twice as
   tall, so the ten-column table keeps its proportions while fitting roughly
   three times as many rows per sheet. The BOQ gets its own page furniture
   rather than sharing the portrait letterhead used by the proposal and work
   quotation; the brand face, palette and footer line stay the same so the
   three documents still read as a set.
   ------------------------------------------------------------------------ */

const PAGE = { w: 841.89, h: 1190.55 };
const M = { left: 34, right: 34, top: 104, bottom: 52 };
const CONTENT_W = PAGE.w - M.left - M.right;

const INK = [40, 35, 32];
const GREY = [122, 116, 110];
const RULE = [206, 199, 190];

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const MAROON = hexToRgb(DIA.maroon);
const MAROON_DEEP = hexToRgb(DIA.maroonDeep);
const CREAM = hexToRgb(DIA.cream);
const CREAM_SOFT = hexToRgb(DIA.creamSoft);

const rs = (n) => (Number(n) < 0 ? "- Rs. " : "Rs. ") + Math.abs(Math.round(Number(n) || 0)).toLocaleString("en-IN");
const num = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/* Column widths as fractions of the content width. */
const COLS = [
  { key: "sno", label: "S.No.", w: 0.035, align: "center" },
  { key: "particulars", label: "Particulars", w: 0.115, align: "left" },
  { key: "description", label: "Description", w: 0.335, align: "left" },
  { key: "length", label: "Length", w: 0.05, align: "center" },
  { key: "height", label: "Height", w: 0.05, align: "center" },
  { key: "qty", label: "Qty", w: 0.055, align: "center" },
  { key: "unit", label: "Unit", w: 0.05, align: "center" },
  { key: "rate", label: "Rate", w: 0.075, align: "right" },
  { key: "amount", label: "Amount", w: 0.095, align: "right" },
  { key: "remarks", label: "Remarks", w: 0.14, align: "left" },
].map((c) => ({ ...c, width: c.w * CONTENT_W }));

const colX = (i) => M.left + COLS.slice(0, i).reduce((s, c) => s + c.width, 0);

function drawChrome(doc, pageNo, title) {
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");

  try {
    const logoH = 58, logoW = logoH * (426 / 560);
    doc.addImage(LOGO_LETTERHEAD, "PNG", M.left, 16, logoW, logoH);
  } catch { /* logo is optional */ }

  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...MAROON);
  doc.text(title, PAGE.w / 2, 44, { align: "center", charSpace: 1.4 });

  doc.setDrawColor(...MAROON);
  doc.setLineWidth(0.8);
  doc.line(M.left, 84, PAGE.w - M.right, 84);

  /* footer: page number left, company line right */
  const footY = PAGE.h - 22;
  doc.setFont(TRAJAN, "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(...GREY);
  doc.text(`Page ${pageNo}`, M.left, footY);
  doc.text(
    `${COMPANY_INFO.name}   |   GSTIN ${COMPANY_INFO.gstin}   |   ${COMPANY_INFO.phone}   |   ${COMPANY_INFO.email}`,
    PAGE.w - M.right, footY, { align: "right", charSpace: 0.15 }
  );
}

function makeCtx(doc, title) {
  const ctx = {
    doc, y: M.top, page: 1, title,
    /* top and bottom are read by the page-break logic, so they live on the
       context rather than being recomputed inline. */
    top: M.top,
    bottom: PAGE.h - M.bottom,
    need(h) { if (this.y + h > this.bottom) this.newPage(); },
    newPage() {
      this.doc.addPage("a3", "portrait");
      this.page += 1;
      drawChrome(this.doc, this.page, this.title);
      this.y = this.top;
    },
  };
  registerBrandFonts(doc);
  drawChrome(doc, 1, title);
  return ctx;
}

function tableHead(ctx) {
  const { doc } = ctx;
  const h = 20;
  ctx.need(h + 24);
  doc.setFillColor(...MAROON_DEEP);
  doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(6.4);
  doc.setTextColor(...CREAM);
  COLS.forEach((c, i) => {
    const x = c.align === "left" ? colX(i) + 4 : c.align === "right" ? colX(i) + c.width - 4 : colX(i) + c.width / 2;
    doc.text(c.label, x, ctx.y + 13, { align: c.align });
  });
  ctx.y += h;
}

/* A full-width band naming the floor or area a run of sections belongs to. */
function groupBand(ctx, text) {
  const { doc } = ctx;
  const h = 17;
  ctx.need(h + 40);
  doc.setFillColor(...MAROON);
  doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...CREAM);
  doc.text(String(text).toUpperCase(), PAGE.w / 2, ctx.y + 11.5, { align: "center", charSpace: 0.8 });
  ctx.y += h;
}

function sectionBand(ctx, code, title) {
  const { doc } = ctx;
  const h = 16;
  ctx.need(h + 40);
  doc.setFillColor(...CREAM_SOFT);
  doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.rect(M.left, ctx.y, CONTENT_W, h);
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(...MAROON);
  doc.text(code, colX(0) + COLS[0].width / 2, ctx.y + 11, { align: "center" });
  doc.text(String(title).toUpperCase(), colX(1) + 4, ctx.y + 11, { charSpace: 0.5 });
  ctx.y += h;
}

function itemRow(ctx, item, index) {
  const { doc } = ctx;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  const descLines = doc.splitTextToSize(String(item.description || ""), COLS[2].width - 8);
  const partLines = doc.splitTextToSize(String(item.particulars || ""), COLS[1].width - 8);
  const remLines = doc.splitTextToSize(String(item.remarks || ""), COLS[9].width - 8);
  const lines = Math.max(descLines.length, partLines.length, remLines.length, 1);
  const h = Math.max(18, lines * 8 + 8);

  if (ctx.y + h > PAGE.h - M.bottom) { ctx.newPage(); tableHead(ctx); }
  const top = ctx.y;

  if (index % 2 === 1) {
    doc.setFillColor(250, 247, 241);
    doc.rect(M.left, top, CONTENT_W, h, "F");
  }

  const qty = boqItemQty(item);
  const cells = {
    sno: String(index + 1),
    length: Number(item.length) ? num(item.length) : "-",
    height: Number(item.height) ? num(item.height) : "-",
    qty: num(qty),
    unit: item.unit || "",
    rate: num(item.rate),
    amount: num(boqItemAmount(item)),
  };

  doc.setTextColor(...INK);
  const midY = top + h / 2 + 2.4;

  COLS.forEach((c, i) => {
    if (c.key === "description" || c.key === "particulars" || c.key === "remarks") return;
    const isAmount = c.key === "amount";
    doc.setFont(isAmount ? TRAJAN : "helvetica", isAmount ? "bold" : "normal");
    doc.setFontSize(isAmount ? 7 : 6.6);
    const x = c.align === "right" ? colX(i) + c.width - 4 : colX(i) + c.width / 2;
    doc.text(cells[c.key] ?? "", x, midY, { align: c.align });
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  const startY = top + (h - lines * 8) / 2 + 6;
  partLines.forEach((ln, i) => doc.text(ln, colX(1) + 4, startY + i * 8));
  descLines.forEach((ln, i) => doc.text(ln, colX(2) + 4, startY + i * 8));
  doc.setTextColor(...GREY);
  doc.setFontSize(6);
  remLines.forEach((ln, i) => doc.text(ln, colX(9) + 4, startY + i * 8));

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  COLS.forEach((c, i) => doc.line(colX(i), top, colX(i), top + h));
  doc.line(PAGE.w - M.right, top, PAGE.w - M.right, top + h);
  doc.line(M.left, top + h, PAGE.w - M.right, top + h);

  ctx.y += h;
}

function sectionTotalRow(ctx, code, total) {
  const { doc } = ctx;
  const h = 17;
  if (ctx.y + h > PAGE.h - M.bottom) { ctx.newPage(); tableHead(ctx); }
  doc.setFillColor(...CREAM_SOFT);
  doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.rect(M.left, ctx.y, CONTENT_W, h);
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(...MAROON);
  doc.text(`Total (${code})`, colX(7) + COLS[7].width - 4, ctx.y + 11.5, { align: "right" });
  doc.text(rs(total), colX(8) + COLS[8].width - 4, ctx.y + 11.5, { align: "right" });
  ctx.y += h + 6;
}

function summaryRow(ctx, label, value, emphasis) {
  const { doc } = ctx;

  /* Every summary row keeps the same box, starting at the Unit column, so the
     block reads as one aligned stack. A long label (the transportation and
     handling line) wraps onto a second line and the row grows to suit,
     rather than the box stretching out to the left. */
  const x = colX(5);
  const w = PAGE.w - M.right - x;
  /* Reserve a fixed strip on the right for the amount; the label gets the rest
     of the box, which keeps the long transportation line to two lines. */
  const valueStrip = 96;
  const labelRight = PAGE.w - M.right - valueStrip;
  const labelW = labelRight - x - 10;
  const size = emphasis ? 9 : 7.6;
  const lead = size + 2.6;

  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(String(label), labelW);
  const h = Math.max(emphasis ? 24 : 19, lines.length * lead + 8);
  ctx.need(h);

  if (emphasis) {
    doc.setFillColor(...MAROON);
    doc.rect(x, ctx.y, w, h, "F");
    doc.setTextColor(...CREAM);
  } else {
    doc.setFillColor(...CREAM_SOFT);
    doc.rect(x, ctx.y, w, h, "F");
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.rect(x, ctx.y, w, h);
    doc.setTextColor(...INK);
  }

  /* label block and value both sit optically centred in the row */
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(size);
  const firstLineY = ctx.y + (h - lines.length * lead) / 2 + lead - 3;
  lines.forEach((ln, i) => doc.text(ln, labelRight, firstLineY + i * lead, { align: "right" }));
  doc.text(rs(value), PAGE.w - M.right - 4, ctx.y + h / 2 + 2.8, { align: "right" });

  ctx.y += h;
}

/* Height the exclusions block will take, so the tail can be reserved whole. */
function bulletBlockHeight(doc, items, columns = 2) {
  const gutter = 26;
  const colW = (CONTENT_W - gutter * (columns - 1)) / columns;
  const perCol = Math.ceil(items.length / columns);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  let deepest = 0;
  for (let c = 0; c < columns; c++) {
    const slice = items.slice(c * perCol, (c + 1) * perCol);
    let h = 0;
    slice.forEach((t) => { h += doc.splitTextToSize(String(t), colW - 14).length * 9; });
    deepest = Math.max(deepest, h);
  }
  return 11 + deepest + 8;
}

function bulletBlock(ctx, heading, items, opts = {}) {
  const { doc } = ctx;
  const columns = opts.columns || 1;
  ctx.need(34);
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...MAROON);
  doc.text(String(heading).toUpperCase(), M.left, ctx.y, { charSpace: 0.6 });
  ctx.y += 11;

  const gutter = 26;
  const colW = (CONTENT_W - gutter * (columns - 1)) / columns;
  const perCol = Math.ceil(items.length / columns);
  const lead = 9;

  /* Laid out column by column at a fixed top, so a long exclusions list stays
     shallow instead of pushing the payment table onto a page of its own. */
  const top = ctx.y;
  let deepest = top;
  for (let c = 0; c < columns; c++) {
    const slice = items.slice(c * perCol, (c + 1) * perCol);
    const x = M.left + c * (colW + gutter);
    let y = top;
    slice.forEach((t) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      const lines = doc.splitTextToSize(String(t), colW - 14);
      lines.forEach((ln, i) => {
        if (i === 0) {
          doc.setFillColor(...MAROON);
          doc.circle(x + 3, y - 2.2, 1.1, "F");
        }
        doc.setTextColor(...INK);
        doc.text(ln, x + 11, y);
        y += lead;
      });
    });
    deepest = Math.max(deepest, y);
  }
  ctx.y = deepest + 8;
}

function paymentTable(ctx, stages, grand) {
  const { doc } = ctx;
  const amounts = computeStageAmounts(grand, stages);

  /* Deliberately narrow: four short stages don't need the full sheet width,
     and a compact block sits better beside the exclusions above it. */
  const tableW = CONTENT_W * 0.5;
  const cols = [
    { label: "S.No.", w: tableW * 0.1, align: "center" },
    { label: "Stage", w: tableW * 0.52, align: "left" },
    { label: "%", w: tableW * 0.12, align: "center" },
    { label: "Amount", w: tableW * 0.26, align: "right" },
  ];
  const headH = 15, rowH = 14, totalH = 17;

  ctx.need(24 + headH + stages.length * rowH + totalH);
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...MAROON);
  doc.text("PAYMENT TERMS", M.left, ctx.y, { charSpace: 0.6 });
  ctx.y += 10;

  doc.setFillColor(...MAROON_DEEP);
  doc.rect(M.left, ctx.y, tableW, headH, "F");
  doc.setFontSize(6);
  doc.setTextColor(...CREAM);
  let cx = M.left;
  cols.forEach((c) => {
    const x = c.align === "left" ? cx + 4 : c.align === "right" ? cx + c.w - 4 : cx + c.w / 2;
    doc.text(c.label, x, ctx.y + 10, { align: c.align });
    cx += c.w;
  });
  ctx.y += headH;

  stages.forEach((st, i) => {
    ctx.need(rowH);
    if (i % 2 === 1) { doc.setFillColor(250, 247, 241); doc.rect(M.left, ctx.y, tableW, rowH, "F"); }
    doc.setTextColor(...INK);
    let x = M.left;
    const midY = ctx.y + 9.5;

    doc.setFont(TRAJAN, "bold");
    doc.setFontSize(6.2);
    doc.text(String(st.stage || i + 1), x + cols[0].w / 2, midY, { align: "center" });
    x += cols[0].w;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    doc.text(String(st.milestone || ""), x + 4, midY, { maxWidth: cols[1].w - 8 });
    x += cols[1].w;

    doc.text(`${st.percentage}%`, x + cols[2].w / 2, midY, { align: "center" });
    x += cols[2].w;

    doc.setFont(TRAJAN, "bold");
    doc.setFontSize(6.6);
    doc.text(rs(amounts[i]), x + cols[3].w - 4, midY, { align: "right" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.35);
    let bx = M.left;
    cols.forEach((c) => { doc.line(bx, ctx.y, bx, ctx.y + rowH); bx += c.w; });
    doc.line(bx, ctx.y, bx, ctx.y + rowH);
    doc.line(M.left, ctx.y + rowH, M.left + tableW, ctx.y + rowH);
    ctx.y += rowH;
  });

  ctx.need(totalH);
  doc.setFillColor(...MAROON);
  doc.rect(M.left, ctx.y, tableW, totalH, "F");
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...CREAM);
  doc.text("TOTAL", M.left + cols[0].w + cols[1].w + cols[2].w - 4, ctx.y + 11.5, { align: "right" });
  doc.text(rs(amounts.reduce((a, b) => a + b, 0)), M.left + tableW - 4, ctx.y + 11.5, { align: "right" });
  ctx.y += totalH + 8;
}

/* mode: "save" downloads, "preview" returns a blob URL, "measure" lays the
   document out and returns which page every section starts on without
   producing a file. */
export function generateBOQPdf(q, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a3", orientation: "portrait" });
  const title = `BOQ for ${q.clientName || ""}${q.location ? ", " + q.location : ""}`;
  const ctx = makeCtx(doc, title);
  const totals = boqTotals(q);

  /* ---- reference line + material specifications ---- */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text(
    [q.quotationNo, fmtDate(q.date), q.projectTitle].filter(Boolean).join("     |     "),
    PAGE.w - M.right, ctx.y - 8, { align: "right" }
  );

  const specs = (q.materialSpecs || []).filter(Boolean);
  if (specs.length) {
    doc.setFont(TRAJAN, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MAROON);
    doc.text("MATERIAL SPECIFICATIONS", M.left, ctx.y, { charSpace: 0.6 });
    ctx.y += 12;
    /* two columns so the specification block doesn't eat a whole page */
    const colW = CONTENT_W / 2 - 12;
    const half = Math.ceil(specs.length / 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...INK);
    let maxY = ctx.y;
    [specs.slice(0, half), specs.slice(half)].forEach((column, ci) => {
      let cy = ctx.y;
      const x = M.left + ci * (colW + 24);
      column.forEach((t) => {
        doc.splitTextToSize("• " + t, colW).forEach((ln) => { doc.text(ln, x, cy); cy += 8.6; });
      });
      maxY = Math.max(maxY, cy);
    });
    ctx.y = maxY + 8;
  }

  /* ---- sections ---- */
  /* Which page each section starts on. Collected during the real layout pass
     rather than estimated, so the editor's page map can't drift from the PDF. */
  const layout = { sections: [], tailPage: 1, pages: 1 };

  let lastGroup = null;
  let headed = false;
  (q.boqSections || []).forEach((section, si) => {
    /* A section marked to start on a new page does so, unless it already
       happens to be sitting at the top of a fresh page. */
    if (section.pageBreak && ctx.y > ctx.top) { ctx.newPage(); lastGroup = null; headed = false; }
    const group = (section.group || "").trim();
    if (group && group !== lastGroup) {
      groupBand(ctx, group);
      lastGroup = group;
      headed = false;
    }
    if (!headed) { tableHead(ctx); headed = true; }

    layout.sections.push({ index: si, title: section.title || "", page: ctx.page, pageBreak: !!section.pageBreak });
    sectionBand(ctx, sectionCode(si), section.title || "");
    (section.items || []).forEach((item, ii) => itemRow(ctx, item, ii));
    sectionTotalRow(ctx, sectionCode(si), boqSectionTotal(section));
  });

  /* ---- totals ---- */
  /* Measured and reserved as one block: three rows that break across a page
     boundary read as an error, and a stray "Grand Total" on its own sheet is
     worse still. */
  const summaryRows = 1 + (Number(q.extraChargePct) > 0 ? 1 : 0) + (totals.concession > 0 ? 1 : 0);
  const summaryH = summaryRows * 21 + 24 + 12;
  const summaryBreak = (q.pageOptions && q.pageOptions.summaryBreak) || "auto";

  /* The closing matter — totals, exclusions, payment terms and the sign-off —
     is measured as one unit. Either it all follows the last section or it all
     moves to a fresh page; splitting it leaves a page holding nothing but a
     payment table, which is what this avoids. */
  const exclusionsPreview = (q.exclusions || []).filter(Boolean);
  const stagesPreview = q.showPaymentTerms === false ? [] : (q.paymentStages || []);
  const tailH = summaryH + 18
    + (exclusionsPreview.length ? bulletBlockHeight(doc, exclusionsPreview) : 0)
    + Math.max(stagesPreview.length ? 10 + 15 + stagesPreview.length * 14 + 17 + 8 : 0, 90)
    + 20;

  if (summaryBreak === "new-page" && ctx.y > ctx.top) ctx.newPage();
  else if (ctx.y + tailH > ctx.bottom && tailH < ctx.bottom - ctx.top) ctx.newPage();
  else ctx.need(summaryH);

  layout.tailPage = ctx.page;
  ctx.y += 4;
  summaryRow(ctx, "Sub Total", totals.subtotal);
  if (Number(q.extraChargePct) > 0) {
    summaryRow(ctx, `${q.extraChargeLabel || "Additional charges"} (${q.extraChargePct}%)`, totals.extra);
  }
  if (totals.concession > 0) {
    summaryRow(ctx, `Less: ${q.concessionLabel || "Concession"}`, -totals.concession);
  }
  summaryRow(ctx, "Grand Total", totals.grand, true);
  ctx.y += 18;

  /* ---- exclusions and payment terms ---- */
  const exclusions = (q.exclusions || []).filter(Boolean);
  if (exclusions.length) bulletBlock(ctx, "Additional requirements which are not included", exclusions, { columns: 2 });

  /* Reserve room for the payment table and the sign-off beside it in one go.
     Measuring first means the block never splits across a page and the
     signature can't anchor to a y position left behind on the previous one. */
  const stages = q.showPaymentTerms === false ? [] : (q.paymentStages || []);
  const payBlockH = stages.length ? 10 + 15 + stages.length * 14 + 17 + 8 : 0;
  ctx.need(Math.max(payBlockH, 90));
  const payTop = ctx.y;
  if (stages.length) paymentTable(ctx, stages, totals.grand);

  /* ---- signature ----
     The payment table only takes half the sheet, so the sign-off sits beside
     it rather than underneath — otherwise a compact block strands itself on a
     page of its own. */
  let sigY = payTop;
  const sx = PAGE.w - M.right - 200;
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...MAROON);
  doc.text(`For ${COMPANY_INFO.name}`, sx, sigY);
  sigY += 8;
  if (q.signatureUrl) {
    try { doc.addImage(q.signatureUrl, "PNG", sx, sigY, 110, 30, undefined, "FAST"); } catch { /* optional */ }
    sigY += 32;
  } else {
    sigY += 26;
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(sx, sigY, sx + 180, sigY);
  sigY += 11;
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  if (q.signatoryName) { doc.text(q.signatoryName, sx, sigY); sigY += 10; }
  doc.setFont(TRAJAN, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  if (q.signatoryTitle) { doc.text(q.signatoryTitle, sx, sigY); sigY += 10; }
  ctx.y = Math.max(ctx.y, sigY);

  layout.pages = ctx.page;

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `BOQ ${safe(q.quotationNo)} - ${safe(q.clientName) || "Client"}.pdf`;
  if (mode === "measure") return layout;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}
