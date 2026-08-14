import { jsPDF } from "jspdf";
import { DIA, COMPANY_INFO, LOGO_MARK } from "./constants";
import { fmtINR, fmtDate } from "./helpers";

/* Builds and downloads a Purchase Order PDF for a single expense, matching
   the layout: black "PURCHASE ORDER" header block with PO number, Vendor /
   Buyer info columns, a line-item table, totals box, payment terms, and a
   signature line. Since expenses in this app are single lump-sum entries
   (not itemized), the item table shows one line built from the expense's
   description and amount. */
export function generatePOPdf({ expense, vendor, project, generatedByName }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentW = pageW - margin * 2;

  const maroon = hexToRgb(DIA.maroon);
  const gold = hexToRgb(DIA.gold);
  const ink = [40, 35, 32];
  const grey = [110, 105, 100];
  const line = [210, 205, 198];

  let y = margin;

  /* ---- header: logo + company block, black PO box ---- */
  try {
    doc.addImage(LOGO_MARK, "PNG", margin, y, 40, 32);
  } catch { /* logo optional if it fails to decode */ }

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(COMPANY_INFO.name, margin + 50, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...grey);
  doc.text(COMPANY_INFO.tagline, margin + 50, y + 26);
  doc.setFontSize(9);
  doc.text(`Phone: ${COMPANY_INFO.phone}`, margin + 50, y + 40);
  doc.text(`Email: ${COMPANY_INFO.email}`, margin + 50, y + 52);
  doc.text(`Web: ${COMPANY_INFO.website}`, margin + 50, y + 64);

  const poBoxW = 170, poBoxH = 34;
  const poBoxX = pageW - margin - poBoxW;
  doc.setFillColor(20, 18, 17);
  doc.rect(poBoxX, y, poBoxW, poBoxH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("PURCHASE ORDER", poBoxX + poBoxW / 2, y + poBoxH / 2 + 5, { align: "center" });

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`NO.  ${expense.poNumber}`, poBoxX, y + poBoxH + 20);

  y += 80;
  doc.setDrawColor(...ink);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Date of Issue:  ${fmtDate((expense.poGeneratedAt || new Date().toISOString()).slice(0, 10))}`, pageW - margin, y, { align: "right" });
  y += 22;

  /* ---- vendor / buyer columns ---- */
  const colW = contentW / 2 - 10;
  const vendorX = margin, buyerX = margin + colW + 20;
  const colTop = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Vendor Information:", vendorX, y);
  doc.text("Buyer Information:", buyerX, y);
  underline(doc, vendorX, y + 2, 130);
  underline(doc, buyerX, y + 2, 120);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let vy = y, by = y;
  vy = wrapLine(doc, `Vendor Name: ${vendor?.name || "—"}`, vendorX, vy, colW);
  vy = wrapLine(doc, `Vendor Address: ${vendor?.address || "—"}`, vendorX, vy, colW);
  vy = wrapLine(doc, `Phone/Email: ${[vendor?.phone, vendor?.email].filter(Boolean).join(" / ") || "—"}`, vendorX, vy, colW);
  if (vendor?.gstNumber) vy = wrapLine(doc, `GSTIN: ${vendor.gstNumber}`, vendorX, vy, colW);

  by = wrapLine(doc, `Buyer Name: ${COMPANY_INFO.name}`, buyerX, by, colW);
  by = wrapLine(doc, `Buyer Address: ${project?.location || "—"}`, buyerX, by, colW);
  by = wrapLine(doc, `Phone/Email: ${COMPANY_INFO.phone} / ${COMPANY_INFO.email}`, buyerX, by, colW);

  y = Math.max(vy, by) + 14;

  /* ---- item table ---- */
  const tableTop = y;
  const cols = [
    { label: "Item Description", w: contentW * 0.5 },
    { label: "Pieces", w: contentW * 0.12 },
    { label: "Price", w: contentW * 0.18 },
    { label: "Amount", w: contentW * 0.20 },
  ];
  let cx = margin;
  const headH = 22, rowH = 26;
  doc.setDrawColor(...line);
  doc.setFillColor(245, 243, 240);
  doc.rect(margin, y, contentW, headH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ink);
  cols.forEach(c => {
    doc.text(c.label, c.label === "Item Description" ? cx + 6 : cx + c.w - 6, y + 14, { align: c.label === "Item Description" ? "left" : "right" });
    cx += c.w;
  });
  y += headH;

  const itemRows = [
    [expense.description || "—", "1", fmtINR(expense.amount), fmtINR(expense.amount)],
  ];
  doc.setFont("helvetica", "normal");
  itemRows.forEach(row => {
    cx = margin;
    row.forEach((val, i) => {
      const align = i === 0 ? "left" : "right";
      const tx = i === 0 ? cx + 6 : cx + cols[i].w - 6;
      doc.text(String(val), tx, y + 17, { align, maxWidth: cols[i].w - 10 });
      cx += cols[i].w;
    });
    y += rowH;
  });
  // a couple of empty rows for the printed look, matching the sample template
  for (let i = 0; i < 2; i++) y += rowH;

  cx = margin;
  cols.forEach(c => { doc.line(cx, tableTop, cx, y); cx += c.w; });
  doc.line(cx, tableTop, cx, y);
  doc.line(margin, tableTop, pageW - margin, tableTop);
  doc.line(margin, y, pageW - margin, y);
  for (let ry = tableTop + headH; ry <= y; ry += rowH) doc.line(margin, ry, pageW - margin, ry);

  y += 20;

  /* ---- payment terms (left) + totals (right) ---- */
  const totalsW = 200, totalsX = pageW - margin - totalsW;
  const totalsRows = [
    ["Subtotal", fmtINR(expense.amount)],
    ["Taxes", "—"],
    ["Shipping", "—"],
    ["Total Amount", fmtINR(expense.totalInvoiceValue ?? expense.amount)],
  ];
  let ty = y;
  doc.setFontSize(9);
  totalsRows.forEach(([label, val], i) => {
    const rh = 20;
    if (i === totalsRows.length - 1) { doc.setFont("helvetica", "bold"); doc.setFontSize(10); } else { doc.setFont("helvetica", "normal"); doc.setFontSize(9); }
    doc.rect(totalsX, ty, totalsW * 0.55, rh);
    doc.rect(totalsX + totalsW * 0.55, ty, totalsW * 0.45, rh);
    doc.text(label, totalsX + 6, ty + 14);
    doc.text(val, totalsX + totalsW - 6, ty + 14, { align: "right" });
    ty += rh;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Payment Terms:", margin, y);
  underline(doc, margin, y + 2, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let py = y + 16;
  py = wrapLine(doc, `Payment Method: ${expense.paymentMethod || "—"}`, margin, py, totalsX - margin - 20);
  py = wrapLine(doc, `Payment Due Date: __________________`, margin, py, totalsX - margin - 20);
  py = wrapLine(doc, `Terms and Conditions: __________________`, margin, py, totalsX - margin - 20);

  y = Math.max(ty, py) + 24;

  /* ---- signature + notes ---- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Authorized Signature:", margin, y);
  doc.line(margin + 110, y, margin + 260, y);
  if (generatedByName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...grey);
    doc.text(generatedByName, margin + 110, y + 12);
  }

  const notesX = margin + 300;
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Notes:", notesX, y);
  underline(doc, notesX, y + 2, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let noteText = expense.notes || "";
  if (expense.totalInvoiceValue != null) {
    noteText += `${noteText ? "  " : ""}Vendor invoice total: ${fmtINR(expense.totalInvoiceValue)}; advance already paid: ${fmtINR(expense.advancePaid)}.`;
  }
  wrapLine(doc, noteText || "—", notesX, y + 16, pageW - margin - notesX);

  /* ---- footer ---- */
  const footY = doc.internal.pageSize.getHeight() - 30;
  doc.setDrawColor(...line);
  doc.line(margin, footY - 10, pageW - margin, footY - 10);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...grey);
  doc.text("E & OE (Errors and Omissions Excepted)", pageW / 2, footY, { align: "center" });

  doc.save(`${expense.poNumber}.pdf`);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function underline(doc, x, y, w) {
  doc.setDrawColor(200, 195, 188);
  doc.setLineWidth(0.5);
  doc.line(x, y + 6, x + w, y + 6);
}

/* Simple word-wrap helper: writes text at (x, y), wrapping to maxWidth,
   returns the y position after the last line so callers can chain fields. */
function wrapLine(doc, text, x, y, maxWidth) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y + 10);
  return y + 10 + (lines.length - 1) * 11 + 10;
}
