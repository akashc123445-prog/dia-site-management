import { jsPDF } from "jspdf";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import { amountInWords } from "./quotationDefaults";
import {
  makeCtx, heading, para, drawSignature, rs,
  PAGE, M, CONTENT_W, INK, GREY, RULE, MAROON, CREAM, DISPLAY, BODY,
} from "./generateQuotation";

/* ------------------------------------------------------------------------
   Itemised work quotation — the line-item document used for execution and
   fabrication work, as distinct from the multi-page design proposal.
   Shares the letterhead, page chrome and signature block with
   generateQuotation.js so both documents look like they came from the same
   firm on the same day.
   ------------------------------------------------------------------------ */

const qtyFmt = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

export function lineTotal(item) {
  return (Number(item.qty) || 0) * (Number(item.rate) || 0);
}

export function workQuoteTotals(q) {
  const subtotal = (q.lineItems || []).reduce((s, it) => s + lineTotal(it), 0);
  const discount = Math.min(Math.max(Number(q.discount) || 0, 0), subtotal);
  return { subtotal, discount, grand: subtotal - discount };
}

function itemsTable(ctx, items) {
  const { doc } = ctx;
  const cols = [
    { label: "S. No.", w: CONTENT_W * 0.09, align: "center" },
    { label: "Description of Work", w: CONTENT_W * 0.43, align: "left" },
    { label: "Quantity", w: CONTENT_W * 0.16, align: "center" },
    { label: "Rate", w: CONTENT_W * 0.14, align: "right" },
    { label: "Amount", w: CONTENT_W * 0.18, align: "right" },
  ];

  const drawHead = () => {
    const headH = 24;
    ctx.need(headH + 34);
    doc.setFillColor(...MAROON);
    doc.rect(M.left, ctx.y, CONTENT_W, headH, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...CREAM);
    let cx = M.left;
    cols.forEach((c) => {
      const tx = c.align === "left" ? cx + 6 : c.align === "right" ? cx + c.w - 6 : cx + c.w / 2;
      doc.text(c.label, tx, ctx.y + 15.5, { align: c.align });
      cx += c.w;
    });
    ctx.y += headH;
  };

  drawHead();

  (items || []).forEach((it, i) => {
    /* measure with the face the description is actually drawn in — the table
       header leaves the display face selected, and Trajan is much wider */
    doc.setFont(BODY, "normal");
    doc.setFontSize(8.8);
    const descLines = doc.splitTextToSize(String(it.description || ""), cols[1].w - 12);
    const rowH = Math.max(22, descLines.length * 11 + 12);
    if (ctx.y + rowH > ctx.bottom) { ctx.newPage(); drawHead(); }

    const top = ctx.y;
    if (i % 2 === 1) {
      doc.setFillColor(248, 244, 237);
      doc.rect(M.left, top, CONTENT_W, rowH, "F");
    }

    doc.setTextColor(...INK);
    doc.setFont(BODY, "normal");
    doc.setFontSize(8.8);
    const midY = top + rowH / 2 + 3;
    let cx = M.left;

    doc.setFont(DISPLAY, "bold");
    doc.text(`${i + 1}.`, cx + cols[0].w / 2, midY, { align: "center" });
    doc.setFont(BODY, "normal");
    cx += cols[0].w;

    const startY = top + (rowH - descLines.length * 11) / 2 + 8;
    descLines.forEach((ln, li) => doc.text(ln, cx + 6, startY + li * 11));
    cx += cols[1].w;

    const qty = [qtyFmt(it.qty), it.unit].filter(Boolean).join(" ");
    doc.text(qty, cx + cols[2].w / 2, midY, { align: "center" });
    cx += cols[2].w;

    doc.text(rs(it.rate), cx + cols[3].w - 6, midY, { align: "right" });
    cx += cols[3].w;

    doc.setFont(DISPLAY, "bold");
    doc.text(rs(lineTotal(it)), cx + cols[4].w - 6, midY, { align: "right" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    let bx = M.left;
    cols.forEach((c) => { doc.line(bx, top, bx, top + rowH); bx += c.w; });
    doc.line(bx, top, bx, top + rowH);
    doc.line(M.left, top, PAGE.w - M.right, top);
    doc.line(M.left, top + rowH, PAGE.w - M.right, top + rowH);

    ctx.y += rowH;
  });
}

function totalsBlock(ctx, { subtotal, discount, grand }) {
  const { doc } = ctx;
  const labelW = CONTENT_W * 0.82, valW = CONTENT_W * 0.18;
  const rows = [["Total Amount", rs(subtotal), false]];
  if (discount > 0) rows.push(["Less: Discount", "- " + rs(discount), false]);
  rows.push([discount > 0 ? "Grand Total" : "Total Payable", rs(grand), true]);

  rows.forEach(([label, value, isGrand]) => {
    const h = isGrand ? 28 : 22;
    if (ctx.y + h > ctx.bottom) ctx.newPage();
    if (isGrand) {
      doc.setFillColor(...MAROON);
      doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
      doc.setTextColor(...CREAM);
      doc.setFont(DISPLAY, "bold");
      doc.setFontSize(9.8);
    } else {
      doc.setFillColor(248, 244, 237);
      doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.6);
      doc.rect(M.left, ctx.y, CONTENT_W, h);
      doc.setTextColor(...INK);
      doc.setFont(DISPLAY, "normal");
      doc.setFontSize(8.8);
    }
    doc.text(label, M.left + labelW - 6, ctx.y + h / 2 + 3, { align: "right" });
    doc.text(value, M.left + labelW + valW - 6, ctx.y + h / 2 + 3, { align: "right" });
    ctx.y += h;
  });
  ctx.y += 8;
}

export function generateWorkQuotePdf(q, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc, { compact: true });
  const totals = workQuoteTotals(q);

  /* ---- title ---- */
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...MAROON);
  doc.text("QUOTATION", PAGE.w / 2, ctx.y, { align: "center", charSpace: 2.2 });
  ctx.y += 8;
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(0.8);
  doc.line(PAGE.w / 2 - 30, ctx.y, PAGE.w / 2 + 30, ctx.y);
  ctx.y += 20;

  /* ---- addressee (left) and reference (right) ---- */
  const colW = CONTENT_W / 2 - 12;
  const rightX = PAGE.w - M.right;
  const label = (text, x, y, align) => {
    doc.setFont(DISPLAY, "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...GREY);
    doc.text(text.toUpperCase(), x, y, { align, charSpace: 0.7 });
  };
  const value = (text, x, y, align) => {
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...MAROON);
    doc.text(text || "-", x, y, { align });
  };

  label("To", M.left, ctx.y);
  label("Project / Work", rightX, ctx.y, "right");
  value(q.clientName, M.left, ctx.y + 15);
  value(q.projectTitle, rightX, ctx.y + 15, "right");

  doc.setFont(BODY, "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...INK);
  let ly = ctx.y + 29;
  String(q.clientAddress || "").split("\n").filter(Boolean).forEach((ln) => {
    doc.splitTextToSize(ln.trim(), colW).forEach((w) => { doc.text(w, M.left, ly); ly += 11; });
  });
  if (q.mobile) { doc.text(`Mobile: ${q.mobile}`, M.left, ly); ly += 11; }

  let ry = ctx.y + 29;
  doc.text(`Quotation No. ${q.quotationNo || "-"}`, rightX, ry, { align: "right" });
  ry += 11;
  doc.text(`Date  ${fmtDate(q.date)}`, rightX, ry, { align: "right" });
  ry += 11;
  if (q.location) {
    doc.splitTextToSize(q.location, colW).forEach((w) => { doc.text(w, rightX, ry, { align: "right" }); ry += 11; });
  }

  ctx.y = Math.max(ly, ry) + 6;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.7);
  doc.line(M.left, ctx.y, PAGE.w - M.right, ctx.y);
  ctx.y += 16;

  para(ctx, "Dear Sir / Madam,", { gap: 3 });
  para(ctx, q.salutation || "With reference to your requirement, we are pleased to quote our best rates as under:", { gap: 12 });

  itemsTable(ctx, q.lineItems);
  ctx.y += 6;
  totalsBlock(ctx, totals);

  /* ---- amount in words ---- */
  ctx.need(46);
  const wordsH = 38;
  doc.setFillColor(243, 233, 216);
  doc.rect(M.left, ctx.y, CONTENT_W, wordsH, "F");
  doc.setFillColor(...MAROON);
  doc.rect(M.left, ctx.y, 3, wordsH, "F");
  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...GREY);
  doc.text("AMOUNT IN WORDS", M.left + 12, ctx.y + 13, { charSpace: 0.7 });
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...MAROON);
  doc.text(amountInWords(totals.grand), M.left + 12, ctx.y + 27, { maxWidth: CONTENT_W - 24 });
  ctx.y += wordsH + 14;

  /* ---- terms ---- */
  const terms = (q.workTerms || []).filter(Boolean);
  if (terms.length) {
    heading(ctx, "Terms & Conditions", 10);
    doc.setFontSize(8.8);
    terms.forEach((t, i) => {
      const num = `${i + 1}.`;
      const lines = doc.splitTextToSize(String(t), CONTENT_W - 20);
      lines.forEach((ln, li) => {
        ctx.need(12);
        doc.setFont(BODY, "normal");
        doc.setFontSize(8.8);
        doc.setTextColor(...INK);
        if (li === 0) doc.text(num, M.left, ctx.y);
        doc.text(ln, M.left + 18, ctx.y);
        ctx.y += 12;
      });
      ctx.y += 1.5;
    });
    ctx.y += 8;
  }

  /* ---- signatures: client on the left, the firm on the right ---- */
  ctx.need(q.signatureUrl ? 108 : 76);
  const signTop = ctx.y;
  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...GREY);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  const clientRuleY = signTop + (q.signatureUrl ? 50 : 34);
  doc.line(M.left, clientRuleY, M.left + 170, clientRuleY);
  doc.text("Client's Signature & Date", M.left, clientRuleY + 12);

  const rx = PAGE.w - M.right - 170;
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...MAROON);
  doc.text(`For ${COMPANY_INFO.name}`, rx, signTop + 8);
  ctx.y = signTop + 14;
  drawSignature(ctx, q, rx, 170, { showCompany: false });
  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...GREY);
  doc.text("Authorised Signatory", rx, ctx.y);

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `${safe(q.quotationNo) || "Quotation"} - ${safe(q.clientName) || "Client"}.pdf`;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}
