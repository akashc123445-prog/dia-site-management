import { jsPDF } from "jspdf";
import { DIA, COMPANY_INFO, LOGO_LETTERHEAD, BODY_IN_TRAJAN } from "./constants";
import { TRAJAN, registerBrandFonts } from "./brandFonts";
import { fmtDate } from "./helpers";
import { amountInWords, computeStageAmounts, fillTokens } from "./quotationDefaults";

/* ------------------------------------------------------------------------
   Design proposal / quotation PDF.

   Rebuilds the firm's letterhead in code — maroon corner block, logo,
   faded watermark, and the footer band with page number and contact line —
   then flows the quotation content across as many A4 pages as it needs.
   Every page is drawn by drawChrome(), so content never has to know which
   page it lands on.
   ------------------------------------------------------------------------ */

/* jsPDF's built-in Helvetica has no rupee glyph, so PDFs use "Rs." — the
   same substitution generatePO.js makes. */
export const rs = (n) => "Rs. " + Math.round(Number(n) || 0).toLocaleString("en-IN");

/* Typographic roles. DISPLAY is the brand face, used for anything set in
   caps or small caps: titles, headings, table headers, names, labels. BODY is
   the reading face for paragraphs — see BODY_IN_TRAJAN in constants.js. */
export const DISPLAY = TRAJAN;
export const BODY = BODY_IN_TRAJAN ? TRAJAN : "helvetica";

/* Trajan's small capitals sit optically larger and wider than a text face at
   the same point size, so body copy set in it needs to come down a touch. */
export const BODY_SCALE = BODY_IN_TRAJAN ? 0.92 : 1;

export const PAGE = { w: 595.28, h: 841.89 };
export const M = { left: 56, right: 56, top: 168, bottom: 96 };
export const CONTENT_W = PAGE.w - M.left - M.right;

export const INK = [40, 35, 32];
export const GREY = [122, 116, 110];
export const RULE = [214, 208, 200];

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const MAROON = hexToRgb(DIA.maroon);
export const MAROON_DEEP = hexToRgb(DIA.maroonDeep);
export const CREAM = hexToRgb(DIA.cream);

/* ---- page furniture --------------------------------------------------- */

export function drawChrome(doc, pageNo, opts = {}) {
  /* cream page field */
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");

  /* Watermark: the whole logo, faint, sitting dead centre on the page. Sized
     to stay inside the page on both axes so nothing is clipped at an edge. */
  try {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.03 }));
    const ratio = 426 / 560;
    const wmH = Math.min(560, (PAGE.w - 120) / ratio);
    const wmW = wmH * ratio;
    doc.addImage(LOGO_LETTERHEAD, "PNG", (PAGE.w - wmW) / 2, (PAGE.h - wmH) / 2, wmW, wmH);
    doc.restoreGraphicsState();
  } catch { /* watermark is decorative — never block the document over it */ }

  /* maroon block at the top-left shoulder */
  doc.setFillColor(...MAROON_DEEP);
  doc.rect(M.left, 0, opts.compact ? 104 : 124, opts.compact ? 17 : 22, "F");

  /* letterhead logo, with the branch line set beneath it as on the printed
     stationery (the logo artwork itself doesn't carry the city names) */
  try {
    /* the single-page itemised quote uses a slimmer letterhead so the whole
       document — table, terms and signature — still lands on one sheet */
    const logoH = opts.compact ? 62 : 96, logoW = logoH * (426 / 560);
    const logoY = opts.compact ? 24 : 30;
    doc.addImage(LOGO_LETTERHEAD, "PNG", M.left + 30, logoY, logoW, logoH);
    doc.setFont(DISPLAY, "normal");
    doc.setFontSize(opts.compact ? 5.2 : 6.2);
    doc.setTextColor(...MAROON_DEEP);
    doc.text("B A N G L O R E   |   C H E N N A I", M.left + 30 + logoW / 2, logoY + logoH + (opts.compact ? 7 : 9), { align: "center" });
  } catch { /* logo optional if it fails to decode */ }

  /* footer: maroon page tab on the left, contact line on the right */
  const footY = PAGE.h - 46;
  doc.setFillColor(...MAROON_DEEP);
  doc.rect(M.left, footY, 124, 34, "F");
  doc.setTextColor(...CREAM);
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.4);
  doc.text(`PAGE ${String(pageNo).padStart(2, "0")}`, M.left + 14, footY + 22);

  /* The footer sits in the brand face too. Trajan has no lowercase, so the
     email and website print as small capitals — intentional here, since this
     is letterhead furniture rather than reading matter. */
  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(...GREY);
  const footLines = [
    COMPANY_INFO.addressOneLine,
    `GSTIN ${COMPANY_INFO.gstin}     |     State: ${COMPANY_INFO.stateName} (${COMPANY_INFO.stateCode})`,
    [COMPANY_INFO.phone, COMPANY_INFO.email, COMPANY_INFO.website].filter(Boolean).join("     |     "),
  ];
  footLines.forEach((ln, i) => {
    doc.text(ln, PAGE.w - M.right, footY + 12 + i * 8.5, { align: "right", charSpace: 0.15 });
  });
}

/* A tiny layout cursor. Every writer below takes it, draws at ctx.y, and
   advances ctx.y — calling ctx.need(h) first so a block that won't fit
   starts cleanly on the next page instead of running into the footer. */
export function makeCtx(doc, opts = {}) {
  registerBrandFonts(doc);
  const top = opts.compact ? 112 : M.top;
  const ctx = {
    doc,
    y: top,
    top,
    bottom: PAGE.h - (opts.compact ? 70 : M.bottom),
    page: 1,
    need(h) {
      if (this.y + h > this.bottom) this.newPage();
    },
    newPage() {
      this.doc.addPage("a4", "portrait");
      this.page += 1;
      drawChrome(this.doc, this.page, opts);
      this.y = this.top;
    },
  };
  drawChrome(doc, 1, opts);
  return ctx;
}

export function heading(ctx, text, size = 11, opts = {}) {
  const { doc } = ctx;
  ctx.need(size + 18);
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(size);
  doc.setTextColor(...(opts.color || MAROON));
  doc.text(text, M.left, ctx.y);
  ctx.y += size + 8;
}

/* Writes a wrapped paragraph, breaking across pages line by line so a long
   block never overflows the footer. */
export function para(ctx, text, opts = {}) {
  const { doc } = ctx;
  const face = opts.face || BODY;
  const size = (opts.size || 9.6) * (face === TRAJAN ? BODY_SCALE : 1);
  const lead = opts.lead || 13.2;
  const bold = opts.bold || false;
  const color = opts.color || INK;
  const applyStyle = () => {
    doc.setFont(face, bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  applyStyle();
  const x = opts.x ?? M.left;
  const width = opts.width ?? CONTENT_W;
  const lines = doc.splitTextToSize(String(text || ""), width);
  lines.forEach((ln) => {
    const before = ctx.page;
    ctx.need(lead);
    /* drawChrome() leaves the graphics state set up for the footer, so a
       paragraph that spills onto a new page must restate its own style or
       the remaining lines come out in the footer's small grey type. */
    if (ctx.page !== before) applyStyle();
    doc.text(ln, x, ctx.y);
    ctx.y += lead;
  });
  ctx.y += opts.gap ?? 6;
}

export function bullets(ctx, items, opts = {}) {
  const { doc } = ctx;
  const size = (opts.size || 9.6) * (BODY === TRAJAN ? BODY_SCALE : 1);
  const lead = 13;
  const indent = opts.indent ?? 14;
  items.forEach((item) => {
    /* select the drawing face before measuring, or the wrap is computed from
       the wrong metrics and lines break short */
    doc.setFont(BODY, "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(item), CONTENT_W - indent - 8);
    lines.forEach((ln, i) => {
      ctx.need(lead);
      doc.setFont(BODY, "normal");
      doc.setTextColor(...INK);
      if (i === 0) {
        doc.setFillColor(...MAROON);
        doc.circle(M.left + 5, ctx.y - 3, 1.6, "F");
      }
      doc.text(ln, M.left + indent, ctx.y);
      ctx.y += lead;
    });
  });
  ctx.y += opts.gap ?? 6;
}

function rule(ctx, gapBefore = 4, gapAfter = 10) {
  ctx.y += gapBefore;
  ctx.need(6);
  ctx.doc.setDrawColor(...RULE);
  ctx.doc.setLineWidth(0.7);
  ctx.doc.line(M.left, ctx.y, PAGE.w - M.right, ctx.y);
  ctx.y += gapAfter;
}

/* ---- payment schedule table ------------------------------------------- */

function paymentTable(ctx, stages, amounts) {
  const { doc } = ctx;
  const cols = [
    { key: "stage", label: "STAGES", w: CONTENT_W * 0.15, align: "center" },
    { key: "milestone", label: "PROJECT MILESTONE", w: CONTENT_W * 0.48, align: "left" },
    { key: "pct", label: "PERCENTAGE", w: CONTENT_W * 0.16, align: "center" },
    { key: "amt", label: "AMOUNT", w: CONTENT_W * 0.21, align: "right" },
  ];

  const drawHead = () => {
    const headH = 26;
    ctx.need(headH + 30);
    doc.setFillColor(...MAROON_DEEP);
    doc.rect(M.left, ctx.y, CONTENT_W, headH, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...CREAM);
    let cx = M.left;
    cols.forEach((c) => {
      const tx = c.align === "left" ? cx + 7 : c.align === "right" ? cx + c.w - 7 : cx + c.w / 2;
      doc.text(c.label, tx, ctx.y + 17, { align: c.align });
      cx += c.w;
    });
    ctx.y += headH;
  };

  drawHead();

  stages.forEach((s, i) => {
    /* measure in the face the milestone text is drawn in, not the header's */
    doc.setFont(BODY, "normal");
    doc.setFontSize(8.6);
    const milestoneLines = doc.splitTextToSize(String(s.milestone || ""), cols[1].w - 14);
    const rowH = Math.max(30, milestoneLines.length * 11 + 16);
    if (ctx.y + rowH > ctx.bottom) { ctx.newPage(); drawHead(); }

    const top = ctx.y;
    if (i % 2 === 1) {
      doc.setFillColor(247, 243, 236);
      doc.rect(M.left, top, CONTENT_W, rowH, "F");
    }

    doc.setTextColor(...INK);
    let cx = M.left;
    const midY = top + rowH / 2 + 3;

    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(8.2);
    doc.text(String(s.stage || ""), cx + cols[0].w / 2, midY, { align: "center" });
    cx += cols[0].w;

    doc.setFont(BODY, "normal");
    doc.setFontSize(8.6);
    const startY = top + (rowH - milestoneLines.length * 11) / 2 + 8;
    milestoneLines.forEach((ln, li) => doc.text(ln, cx + 7, startY + li * 11));
    cx += cols[1].w;

    doc.text(String(s.percentage ?? ""), cx + cols[2].w / 2, midY, { align: "center" });
    cx += cols[2].w;

    doc.setFont(DISPLAY, "bold");
    doc.text(rs(amounts[i]), cx + cols[3].w - 7, midY, { align: "right" });

    /* cell borders */
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    let bx = M.left;
    cols.forEach((c) => { doc.line(bx, top, bx, top + rowH); bx += c.w; });
    doc.line(bx, top, bx, top + rowH);
    doc.line(M.left, top, PAGE.w - M.right, top);
    doc.line(M.left, top + rowH, PAGE.w - M.right, top + rowH);

    ctx.y += rowH;
  });

  /* total row */
  const totalH = 30;
  if (ctx.y + totalH > ctx.bottom) ctx.newPage();
  const total = amounts.reduce((a, b) => a + b, 0);
  doc.setFillColor(...MAROON);
  doc.rect(M.left, ctx.y, CONTENT_W, totalH, "F");
  doc.setTextColor(...CREAM);
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.6);
  doc.text("TOTAL", M.left + CONTENT_W * 0.32, ctx.y + 19, { align: "center" });
  doc.text(rs(total), PAGE.w - M.right - 7, ctx.y + 19, { align: "right" });
  ctx.y += totalH + 10;
}

/* Signature block shared by both document types: the uploaded signature image
   (if there is one) sitting on the rule, then the signatory's name and
   designation typed underneath. Both are optional — an empty name simply
   leaves the rule blank for a wet signature. */
export function drawSignature(ctx, q, x, width = 170, opts = {}) {
  const { doc } = ctx;
  /* Reserve space for the signature image only when there is one — an empty
     34pt gap is what pushes an otherwise single-page quote onto a second
     sheet with nothing but a signature on it. */
  const imgH = q.signatureUrl ? (opts.imageHeight || 32) : 0;
  ctx.need(imgH + (opts.showCompany === false ? 44 : 56));
  if (q.signatureUrl) {
    try {
      doc.addImage(q.signatureUrl, "PNG", x, ctx.y, width * 0.62, imgH, undefined, "FAST");
    } catch { /* a broken signature image must never stop the PDF */ }
  }
  ctx.y += imgH + 4;

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  doc.line(x, ctx.y, x + width, ctx.y);
  ctx.y += 13;

  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  if (q.signatoryName) { doc.text(String(q.signatoryName), x, ctx.y); ctx.y += 13; }

  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...GREY);
  if (q.signatoryTitle) { doc.text(String(q.signatoryTitle), x, ctx.y); ctx.y += 12; }
  /* The itemised quote already prints "For DIA Retail Solutions" above the
     rule, so it suppresses the repeat underneath. */
  if (opts.showCompany !== false) { doc.text(COMPANY_INFO.name, x, ctx.y); ctx.y += 12; }
}

/* ---- main ------------------------------------------------------------- */

/* mode "save" downloads the file; "preview" returns a blob URL the UI can
   open in a new tab without writing anything to disk. */
export function generateQuotationPdf(q, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);

  const total = Number(q.totalFee) || 0;
  const stages = q.paymentStages || [];
  const amounts = computeStageAmounts(total, stages);
  const T = (s) => fillTokens(s, q);

  /* ---- page 1: covering letter ---- */
  doc.setFont(BODY, "normal");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  doc.text(fmtDate(q.date), PAGE.w - M.right, ctx.y, { align: "right" });
  doc.text(q.city || "Bengaluru", PAGE.w - M.right, ctx.y + 13, { align: "right" });

  const addressLines = ["To", `${q.clientName || ""},`, ...String(q.clientAddress || "").split("\n").filter(Boolean).map((l) => l.trim() + ",")];
  addressLines.forEach((ln, i) => {
    doc.setFont(i === 1 ? DISPLAY : BODY, i === 1 ? "bold" : "normal");
    doc.text(ln, M.left, ctx.y + i * 13);
  });
  ctx.y += Math.max(addressLines.length * 13, 26) + 16;

  heading(ctx, "Subject:", 10);
  para(ctx, T(q.subject || `Proposal for ${q.serviceLine} Services for the Proposed ${q.projectTitle || "Jewellery Store"} at ${q.location || ""}.`), { bold: true, size: 10, lead: 14, gap: 12 });

  para(ctx, "Dear Sir,", { gap: 10 });
  (q.introParas || []).forEach((p) => para(ctx, T(p), { gap: 10 }));

  para(ctx, `Professional ${q.serviceLine.includes("Co-ordination") ? "Design & Co-ordination" : "Design"} Fee`, { gap: 2 });
  para(ctx, `The total professional fee for ${q.serviceLine} is:`, { gap: 4 });
  para(ctx, `${rs(total)}/- (${amountInWords(total)})`, { bold: true, size: 10.5, gap: 2 });
  if (q.gstNote) para(ctx, q.gstNote, { bold: true, size: 10, gap: 10 });

  para(ctx, "The above professional fee covers the complete design process from conceptual planning through project execution support and periodic site co-ordination, ensuring that the design intent is successfully translated into reality.", { gap: 4 });

  /* ---- scope of services ---- */
  ctx.newPage();
  heading(ctx, "Scope of Professional Services", 12);
  ctx.y += 4;
  (q.scopeStages || []).forEach((stage) => {
    ctx.need(60);
    heading(ctx, stage.title, 10.5);
    if (stage.intro) para(ctx, stage.intro, { gap: 3 });
    bullets(ctx, stage.items || [], { gap: 12 });
  });

  /* ---- milestones + revision policy + closing ---- */
  ctx.need(180);
  heading(ctx, "Project Milestones", 11);
  para(ctx, "Each stage shall commence only after:", { gap: 3 });
  bullets(ctx, q.milestoneNotes || [], { gap: 6 });
  para(ctx, "This structured approach ensures smooth project progression while maintaining quality, clarity, and timely decision-making throughout the design process.", { gap: 14 });

  heading(ctx, "Revision Policy", 11);
  bullets(ctx, q.revisionPolicy || [], { gap: 14 });

  (q.closingParas || []).forEach((p) => para(ctx, T(p), { gap: 9 }));
  ctx.y += 8;
  para(ctx, "With Warm Regards,", { gap: 2 });
  para(ctx, COMPANY_INFO.name, { bold: true, size: 10.5 });

  /* ---- fee structure & payment schedule ---- */
  ctx.newPage();
  heading(ctx, "FEE STRUCTURE & PAYMENT SCHEDULE", 11.5);
  const areaTxt = q.area ? `, having an approximate built-up area of ${Number(q.area).toLocaleString("en-IN")} sq.ft.${q.floors ? ` (${q.floors})` : ""}` : "";
  para(ctx, `The professional fee for providing the complete ${q.serviceLine} Services for the proposed ${q.projectTitle || q.clientName} at ${q.location || ""}${areaTxt}, shall be:`, { gap: 6 });
  para(ctx, `${rs(total)}/- (${amountInWords(total)})`, { bold: true, size: 10.5, gap: 2 });
  if (q.feeMode === "rate" && Number(q.ratePerSqft) > 0) {
    para(ctx, `Calculated at ${rs(q.ratePerSqft)} per sq.ft. on ${Number(q.area).toLocaleString("en-IN")} sq.ft. of built-up area.`, { size: 9, color: GREY, gap: 4 });
  }
  para(ctx, "The above fee is on a Lump Sum basis and is exclusive of applicable GST.", { bold: true, size: 9.8, gap: 6 });
  para(ctx, "The built-up area is approximate and subject to final site measurements. Any substantial variation in the project area or scope of work beyond the agreed parameters may necessitate a proportionate revision of the professional fee, subject to mutual discussion and written approval.", { gap: 16 });

  heading(ctx, "PAYMENT SCHEDULE", 11.5);
  paymentTable(ctx, stages, amounts);

  /* ---- terms of payment, signature, bank ---- */
  ctx.need(240);
  ctx.y += 8;
  heading(ctx, "TERMS OF PAYMENT", 11.5);
  bullets(ctx, q.paymentTerms || [], { gap: 10 });
  para(ctx, "This milestone-based payment structure has been formulated to ensure systematic project progression, timely approvals, uninterrupted execution, and successful completion while maintaining the highest standards of design quality and professional service.", { gap: 18 });

  ctx.need(200);
  para(ctx, "Sincerely,", { gap: 10 });
  drawSignature(ctx, q, M.left);
  ctx.y += 18;

  ctx.need(110);
  rule(ctx, 0, 12);
  heading(ctx, "ACCOUNT DETAILS", 10.5);
  const bank = q.bank || {};
  [
    ["Account Name", bank.accountName],
    ["Bank Name", bank.bankName],
    ["Branch", bank.branch],
    ["Current Account No.", bank.accountNumber],
    ["IFSC", bank.ifsc],
  ].filter(([, v]) => v).forEach(([label, value]) => {
    ctx.need(13);
    doc.setFont(BODY, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(`${label}:`, M.left, ctx.y);
    doc.setFont(DISPLAY, "bold");
    doc.setTextColor(...INK);
    doc.text(String(value), M.left + 120, ctx.y);
    ctx.y += 13.5;
  });

  /* Quotation numbers contain slashes (DIA/QT/2026-27/0007), which are not
     legal in a filename — swap them for hyphens before saving. */
  const safe = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `${safe(q.quotationNo) || "Quotation"} - ${safe(q.clientName) || "Client"}.pdf`;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}
