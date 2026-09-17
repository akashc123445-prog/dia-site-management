import { jsPDF, AcroFormCheckBox } from "jspdf";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import {
  makeCtx, heading, para, rs,
  PAGE, M, CONTENT_W, INK, GREY, RULE, MAROON, MAROON_DEEP, CREAM, DISPLAY, BODY,
} from "./generateQuotation";

/* ------------------------------------------------------------------------
   Client scope of works — the list of things the client has undertaken to
   do themselves, each with a date by which it is needed.

   The checkbox against each item is a real form field, so the client can
   tick it in any PDF reader and send the file back. It also prints, for the
   client who prefers a pen.
   ------------------------------------------------------------------------ */

const CATEGORY_LABEL = {
  Vendor: "Vendor to be appointed",
  Material: "Material to be supplied",
  Approval: "Approval or selection",
  Payment: "Payment",
  "Site readiness": "Site readiness",
  Other: "Other",
};

export function generateClientScopePdf({ project, items, preparedBy }, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);
  const today = new Date().toISOString().slice(0, 10);

  /* ---- addressee ---- */
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
  para(ctx, `Client's scope of works for ${project.name}${project.location ? ` at ${project.location}` : ""} — items to be arranged from your end.`,
    { bold: true, size: 10, lead: 14, gap: 12 });

  para(ctx, "Dear Sir,", { gap: 8 });
  para(ctx,
    "For the works to proceed on programme, the following items fall within your scope and need to be arranged from your end by the dates shown. Each date is the point at which the site will need the item in hand; a delay against it moves the activities that depend on it.",
    { gap: 8 });
  para(ctx,
    "You may tick the box against each item as it is completed and return this document to us, or simply let us know. We will follow up on anything approaching its date.",
    { gap: 14 });

  /* ---- the table ---- */
  const sorted = [...items].sort((a, b) => {
    const ad = a.dueDate || "9999", bd = b.dueDate || "9999";
    return ad < bd ? -1 : ad > bd ? 1 : (a.sortOrder || 0) - (b.sortOrder || 0);
  });

  const cols = [
    { label: "", w: CONTENT_W * 0.06, align: "center" },          // checkbox
    { label: "S.No.", w: CONTENT_W * 0.07, align: "center" },
    { label: "Item to be arranged", w: CONTENT_W * 0.49, align: "left" },
    { label: "Category", w: CONTENT_W * 0.20, align: "left" },
    { label: "Needed by", w: CONTENT_W * 0.18, align: "center" },
  ];
  const colX = (i) => M.left + cols.slice(0, i).reduce((t, c) => t + c.w, 0);

  const head = () => {
    const h = 24;
    ctx.need(h + 30);
    doc.setFillColor(...MAROON_DEEP);
    doc.rect(M.left, ctx.y, CONTENT_W, h, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...CREAM);
    cols.forEach((c, i) => {
      if (!c.label) return;
      const x = c.align === "left" ? colX(i) + 7 : colX(i) + c.w / 2;
      doc.text(c.label, x, ctx.y + 15.5, { align: c.align === "left" ? "left" : "center" });
    });
    ctx.y += h;
  };
  head();

  sorted.forEach((item, i) => {
    doc.setFont(BODY, "normal");
    doc.setFontSize(9);
    const titleLines = doc.splitTextToSize(item.title || "", cols[2].w - 14);
    doc.setFontSize(7.8);
    const detailLines = item.details ? doc.splitTextToSize(item.details, cols[2].w - 14) : [];
    const h = Math.max(30, titleLines.length * 11.5 + detailLines.length * 10 + 14);
    if (ctx.y + h > ctx.bottom) { ctx.newPage(); head(); }
    const top = ctx.y;

    if (i % 2 === 1) {
      doc.setFillColor(247, 243, 236);
      doc.rect(M.left, top, CONTENT_W, h, "F");
    }

    /* A drawn square sits under the form field: some readers show an empty
       field with no outline at all, and on paper there is no field. */
    doc.setDrawColor(...MAROON);
    doc.setLineWidth(0.9);
    doc.setFillColor(255, 255, 255);
    doc.rect(colX(0) + cols[0].w / 2 - 7, top + h / 2 - 7, 14, 14, "FD");
    if (item.status === "Done") {
      /* Drawn tick for finished items: readers differ in how they show a
         checked field, and a drawn mark survives printing. */
      const bx = colX(0) + cols[0].w / 2 - 7, by = top + h / 2 - 7;
      doc.setLineWidth(1.6);
      doc.line(bx + 3, by + 7.5, bx + 6, by + 10.5);
      doc.line(bx + 6, by + 10.5, bx + 11.5, by + 3.5);
    }

    /* A real, tickable field for anything still open. A finished item has
       nothing left to tick, and readers draw a checked field inconsistently
       over the mark above, so it gets the drawn tick alone. */
    if (item.status !== "Done") {
      const cb = new AcroFormCheckBox();
      cb.fieldName = `item_${i + 1}`;
      cb.x = colX(0) + cols[0].w / 2 - 7;
      cb.y = top + h / 2 - 7;
      cb.width = 14;
      cb.height = 14;
      cb.appearanceState = "Off";
      doc.addField(cb);
    }

    doc.setTextColor(...INK);
    const mid = top + h / 2 + 3;

    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(8.2);
    doc.text(String(i + 1), colX(1) + cols[1].w / 2, mid, { align: "center" });

    let ty = top + (h - (titleLines.length * 11.5 + detailLines.length * 10)) / 2 + 9;
    doc.setFont(BODY, item.status === "Done" ? "normal" : "bold");
    doc.setFontSize(9);
    doc.setTextColor(...(item.status === "Done" ? GREY : INK));
    titleLines.forEach((l) => { doc.text(l, colX(2) + 7, ty); ty += 11.5; });
    if (detailLines.length) {
      doc.setFont(BODY, "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...GREY);
      detailLines.forEach((l) => { doc.text(l, colX(2) + 7, ty); ty += 10; });
    }

    doc.setFont(BODY, "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...INK);
    doc.text(CATEGORY_LABEL[item.category] || item.category || "", colX(3) + 7, mid, { maxWidth: cols[3].w - 12 });

    const overdue = item.dueDate && item.dueDate < today && item.status !== "Done";
    doc.setFont(DISPLAY, "bold");
    doc.setTextColor(...(overdue ? MAROON : INK));
    doc.text(item.dueDate ? fmtDate(item.dueDate) : "—", colX(4) + cols[4].w / 2, mid, { align: "center" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    cols.forEach((c, ci) => doc.line(colX(ci), top, colX(ci), top + h));
    doc.line(PAGE.w - M.right, top, PAGE.w - M.right, top + h);
    doc.line(M.left, top + h, PAGE.w - M.right, top + h);
    ctx.y += h;
  });

  ctx.y += 14;
  para(ctx, "Items shown in maroon under \"Needed by\" are already past their date. Where a date cannot be met, please tell us as early as possible so the programme can be re-sequenced around it.",
    { size: 9, color: GREY, gap: 16 });

  /* ---- sign-off ---- */
  ctx.need(90);
  para(ctx, "With warm regards,", { gap: 22 });
  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  if (preparedBy) { doc.text(preparedBy, M.left, ctx.y); ctx.y += 12; }
  doc.setFont(DISPLAY, "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...GREY);
  doc.text(COMPANY_INFO.name, M.left, ctx.y);

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `Client scope - ${safe(project.name) || "Project"}.pdf`;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}

/* A short chase message for WhatsApp, listing what is open and when it was
   due. Copied to the clipboard rather than sent — the person adds the human
   line at the top themselves. */
export function clientScopeReminderText(project, items) {
  const today = new Date().toISOString().slice(0, 10);
  const open = items.filter((i) => i.status !== "Done")
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  if (!open.length) return "";
  const overdue = open.filter((i) => i.dueDate && i.dueDate < today);
  const lines = [
    `Hello, for ${project.name} to stay on programme the following need to come from your end:`,
    "",
    ...open.map((i, n) => {
      const due = i.dueDate ? ` — needed by ${fmtDate(i.dueDate)}` : "";
      const late = i.dueDate && i.dueDate < today ? " (past due)" : "";
      return `${n + 1}. ${i.title}${due}${late}`;
    }),
    "",
  ];
  if (overdue.length) lines.push(`${overdue.length} of these ${overdue.length === 1 ? "is" : "are"} already past ${overdue.length === 1 ? "its" : "their"} date. Please let us know where things stand so we can re-sequence if needed.`);
  else lines.push("Please confirm once each is in hand, or let us know if any date needs to move.");
  lines.push("", `— ${COMPANY_INFO.name}`);
  return lines.join("\n");
}

export { rs };
