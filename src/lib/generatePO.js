import { jsPDF } from "jspdf";
import { DIA, COMPANY_INFO, PO_CONTACT, PO_TERMS, LOGO_FULL_MAROON } from "./constants";
import { fmtDate } from "./helpers";

/* jsPDF's built-in fonts (Helvetica etc.) don't include the ₹ glyph — it
   renders as a broken character. "Rs." is the safe, universally-supported
   substitute for anything drawn onto the PDF itself. This is separate from
   fmtINR (used everywhere else in the app, which renders fine with ₹ since
   the browser uses proper system fonts there). */
const rs = (n) => "Rs. " + Math.round(n || 0).toLocaleString("en-IN");

/* Builds and downloads an A5 Purchase Order PDF for a single expense,
   matching the supplied template layout. Since expenses in this app are
   single lump-sum entries (not itemized), the item table shows one line
   built from the expense's description and amount. */
export function generatePOPdf({ expense, vendor, project, generatedByName }) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();   // ~420pt
  const pageH = doc.internal.pageSize.getHeight();  // ~595pt
  const margin = 28;
  const contentW = pageW - margin * 2;

  const ink = [40, 35, 32];
  const grey = [120, 114, 108];
  const line = [212, 207, 200];

  let y = margin;

  /* ---- header row: logo (left) beside PO box + number (right) ---- */
  const logoAspect = 1792 / 2364; // full logo card is portrait
  const logoH = 46, logoW = logoH * logoAspect;
  try {
    doc.addImage(LOGO_FULL_MAROON, "PNG", margin, y, logoW, logoH);
  } catch { /* logo optional if it fails to decode */ }

  const textX = margin + logoW + 10;
  doc.setTextColor(...grey);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(COMPANY_INFO.tagline, textX, y + 10);
  doc.setFontSize(6.8);
  doc.text(`Phone: ${COMPANY_INFO.phone}`, textX, y + 20);
  doc.text(`Email: ${COMPANY_INFO.email}`, textX, y + 29);
  if (COMPANY_INFO.website) doc.text(`Web: ${COMPANY_INFO.website}`, textX, y + 38);

  const poBoxW = 140, poBoxH = 24;
  const poBoxX = pageW - margin - poBoxW;
  const maroonRgb = hexToRgb(DIA.maroon);
  doc.setFillColor(...maroonRgb);
  doc.rect(poBoxX, y, poBoxW, poBoxH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("PURCHASE ORDER", poBoxX + poBoxW / 2, y + poBoxH / 2 + 3.5, { align: "center" });

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`NO.  ${expense.poNumber}`, poBoxX, y + poBoxH + 15);

  y = Math.max(y + logoH, y + poBoxH + 15) + 12;

  doc.setDrawColor(...ink);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 13;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...ink);
  doc.text(`Date of Issue: ${fmtDate((expense.poGeneratedAt || new Date().toISOString()).slice(0, 10))}`, pageW - margin, y, { align: "right" });
  y += 18;

  /* ---- vendor / buyer columns ---- */
  const colW = contentW / 2 - 8;
  const vendorX = margin, buyerX = margin + colW + 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Vendor Information:", vendorX, y);
  doc.text("Buyer Information:", buyerX, y);
  underline(doc, vendorX, y + 3, 96);
  underline(doc, buyerX, y + 3, 90);
  y += 13;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  let vy = y, by = y;
  vy = wrapLine(doc, `Vendor Name: ${vendor?.name || "—"}`, vendorX, vy, colW);
  vy = wrapLine(doc, `Address: ${vendor?.address || "—"}`, vendorX, vy, colW);
  vy = wrapLine(doc, `Phone/Email: ${[vendor?.phone, vendor?.email].filter(Boolean).join(" / ") || "—"}`, vendorX, vy, colW);
  if (vendor?.gstNumber) vy = wrapLine(doc, `GSTIN: ${vendor.gstNumber}`, vendorX, vy, colW);

  by = wrapLine(doc, `Buyer Name: ${COMPANY_INFO.name}`, buyerX, by, colW);
  by = wrapLine(doc, `Site Address: ${project?.location || "—"}`, buyerX, by, colW);
  by = wrapLine(doc, `Phone/Email: ${COMPANY_INFO.phone} / ${COMPANY_INFO.email}`, buyerX, by, colW);

  y = Math.max(vy, by) + 10;

  /* ---- item table ---- */
  const tableTop = y;
  const cols = [
    { label: "Item Description", w: contentW * 0.46 },
    { label: "Pieces", w: contentW * 0.13 },
    { label: "Price", w: contentW * 0.19 },
    { label: "Amount", w: contentW * 0.22 },
  ];
  const headH = 18, rowH = 20;

  doc.setDrawColor(...line);
  doc.setFillColor(245, 243, 240);
  doc.rect(margin, y, contentW, headH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...ink);
  let cx = margin;
  cols.forEach(c => {
    const isDesc = c.label === "Item Description";
    doc.text(c.label, isDesc ? cx + 5 : cx + c.w - 5, y + 12, { align: isDesc ? "left" : "right" });
    cx += c.w;
  });
  y += headH;

  const itemRows = [[expense.description || "—", "1", rs(expense.amount), rs(expense.amount)]];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  itemRows.forEach(row => {
    cx = margin;
    row.forEach((val, i) => {
      const isDesc = i === 0;
      doc.text(String(val), isDesc ? cx + 5 : cx + cols[i].w - 5, y + 13, { align: isDesc ? "left" : "right", maxWidth: cols[i].w - 8 });
      cx += cols[i].w;
    });
    y += rowH;
  });
  for (let i = 0; i < 2; i++) y += rowH; // blank rows for the printed-form look

  cx = margin;
  doc.setDrawColor(...line);
  cols.forEach(c => { doc.line(cx, tableTop, cx, y); cx += c.w; });
  doc.line(cx, tableTop, cx, y);
  doc.line(margin, tableTop, pageW - margin, tableTop);
  doc.line(margin, y, pageW - margin, y);
  for (let ry = tableTop + headH; ry <= y; ry += rowH) doc.line(margin, ry, pageW - margin, ry);

  y += 16;

  /* ---- payment terms (left) + totals (right) ---- */
  const totalsW = 168, totalsX = pageW - margin - totalsW;
  const totalsRows = [
    ["Subtotal", rs(expense.amount)],
    ["Taxes", "—"],
    ["Shipping", "—"],
    ["Total Amount", rs(expense.totalInvoiceValue ?? expense.amount)],
  ];
  let ty = y;
  totalsRows.forEach(([label, val], i) => {
    const rh = 17;
    const isLast = i === totalsRows.length - 1;
    doc.setFont("helvetica", isLast ? "bold" : "normal");
    doc.setFontSize(isLast ? 8.3 : 7.6);
    doc.setDrawColor(...line);
    doc.rect(totalsX, ty, totalsW * 0.5, rh);
    doc.rect(totalsX + totalsW * 0.5, ty, totalsW * 0.5, rh);
    doc.setTextColor(...ink);
    doc.text(label, totalsX + 5, ty + 12);
    doc.text(val, totalsX + totalsW - 5, ty + 12, { align: "right" });
    ty += rh;
  });

  const termsW = totalsX - margin - 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Payment Terms:", margin, y);
  underline(doc, margin, y + 3, 82);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  let py = y + 13;
  py = wrapLine(doc, `Payment Method: ${expense.paymentMethod || "—"}`, margin, py, termsW);
  py = wrapLine(doc, `Payment Due Date: ________________`, margin, py, termsW);
  py = wrapLine(doc, `Terms & Conditions: ________________`, margin, py, termsW);

  y = Math.max(ty, py) + 20;

  /* ---- notes (full width) ---- */
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Notes:", margin, y);
  underline(doc, margin, y + 3, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);
  let noteText = expense.notes || "";
  if (expense.totalInvoiceValue != null) {
    noteText += `${noteText ? "  " : ""}Vendor invoice total: ${rs(expense.totalInvoiceValue)}; advance already paid: ${rs(expense.advancePaid)}.`;
  }
  const noteEndY = wrapLine(doc, noteText || "—", margin, y + 12, contentW);

  y = noteEndY + 16;

  /* ---- signature ---- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Authorized Signature:", margin, y);
  doc.setDrawColor(...ink);
  doc.line(margin + 95, y, margin + 220, y);
  if (generatedByName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...grey);
    doc.text(generatedByName, margin + 95, y + 11);
  }

  /* ---- footer (page 1) ---- */
  const footY = pageH - 24;
  doc.setDrawColor(...line);
  doc.line(margin, footY - 10, pageW - margin, footY - 10);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...grey);
  doc.text("E & OE (Errors and Omissions Excepted)", pageW / 2, footY, { align: "center" });

  /* ---- page 2: Comments or Special Instructions ---- */
  doc.addPage("a5", "portrait");
  let y2 = margin;

  doc.setFillColor(230, 227, 222);
  doc.rect(margin, y2, contentW, 20, "F");
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Comments or Special Instructions", margin + 6, y2 + 14);
  y2 += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const romanNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi"];
  PO_TERMS.forEach((term, idx) => {
    const label = `${romanNumerals[idx] || idx + 1}) `;
    const labelW = doc.getTextWidth(label);
    const lines = doc.splitTextToSize(term, contentW - labelW - 4);
    doc.setTextColor(...ink);
    doc.text(label, margin, y2);
    doc.text(lines, margin + labelW, y2);
    y2 += lines.length * 8.5 + 4;
  });

  y2 += 6;
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.75);
  doc.line(margin, y2, pageW - margin, y2);
  y2 += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...ink);
  doc.text("If you have any questions about this purchase order, please contact:", pageW / 2, y2, { align: "center" });
  y2 += 13;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${PO_CONTACT.name}  |  ${PO_CONTACT.phone}  |  ${PO_CONTACT.email}`, pageW / 2, y2, { align: "center" });

  doc.save(`${expense.poNumber}.pdf`);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function underline(doc, x, y, w) {
  doc.setDrawColor(200, 195, 188);
  doc.setLineWidth(0.5);
  doc.line(x, y + 5, x + w, y + 5);
}

/* Word-wrap helper: writes text at (x, y) wrapped to maxWidth, returns the
   y position after the last line so callers can chain fields underneath. */
function wrapLine(doc, text, x, y, maxWidth) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y + 8);
  return y + 8 + (lines.length - 1) * 9.5 + 8;
}
