import { jsPDF } from "jspdf";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import {
  makeCtx, para,
  PAGE, M, CONTENT_W, INK, GREY, RULE, MAROON, CREAM, DISPLAY, BODY,
} from "./generateQuotation";

/* ------------------------------------------------------------------------
   Portfolio and office-files disclosure.

   What a person leaving the firm says they are taking with them: the
   projects they mean to show in their own portfolio, and the office files
   they hold. The office approves or declines each line, and the printed
   sheet — signed by both sides — is what they bring when they collect
   their experience certificate.
   ------------------------------------------------------------------------ */

export const DISCLOSURE_FILE_KINDS = [
  "Drawings (CAD / PDF)", "3D models / renders", "Site photos / videos",
  "Presentations", "BOQ / quotations", "Client documents", "Other",
];

export const DISCLOSURE_DECLARATION = [
  "The projects and files listed in this form are a complete and true account of the office work I intend to show in my portfolio and of the office material I hold in any form — on a laptop, phone, drive, cloud account or email.",
  "I will use in my portfolio only the items marked as approved, will credit them as work done at DIA Retail Solutions, and will not share them with any other firm, client or vendor.",
  "If I hold, or later find that I hold, anything of the office that is not listed here, I will disclose it at once to HR or to a Principal Architect of the company.",
  "I understand that office material found with me that I have not disclosed will be treated as taken without permission, and that I will be called upon by the company to explain it.",
];

export function disclosureCounts(d) {
  const ids = [...(d.projects || []), ...(d.files || [])].map((i) => i.id);
  const dec = d.decisions || {};
  const approved = ids.filter((id) => dec[id] === "approved").length;
  const declined = ids.filter((id) => dec[id] === "declined").length;
  return { total: ids.length, approved, declined, pending: ids.length - approved - declined };
}

const DECISION_WORD = { approved: "APPROVED", declined: "NOT APPROVED" };
const CREAM_SOFT = [243, 233, 216];
const GREEN = [22, 101, 52], RED = [153, 27, 27];

export function generateDisclosurePdf({ user, designation, disclosure, reviewerName }, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);
  const d = disclosure;
  const counts = disclosureCounts(d);
  const reviewed = d.status !== "Submitted";

  /* ---- head ---- */
  doc.setFont(BODY, "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(...GREY);
  doc.text(`Submitted: ${fmtDate(d.submittedAt)}`, M.left, ctx.y);
  doc.text(`Printed: ${fmtDate(new Date().toISOString().slice(0, 10))}`, PAGE.w - M.right, ctx.y, { align: "right" });
  ctx.y += 30;

  doc.setFont(DISPLAY, "bold");
  doc.setFontSize(14);
  doc.setTextColor(...MAROON);
  doc.text("PORTFOLIO & OFFICE FILES DISCLOSURE", PAGE.w / 2, ctx.y, { align: "center", charSpace: 0.8 });
  ctx.y += 22;

  /* ---- who, and where it stands ---- */
  const boxH = 50;
  doc.setFillColor(...CREAM_SOFT);
  doc.rect(M.left, ctx.y, CONTENT_W, boxH, "F");
  const cell = (label, value, x, y) => {
    doc.setFont(DISPLAY, "normal"); doc.setFontSize(7.2); doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont(BODY, "bold"); doc.setFontSize(9.4); doc.setTextColor(...INK);
    doc.text(String(value || "—"), x, y + 12);
  };
  const third = CONTENT_W / 3;
  cell("Name", user.name, M.left + 12, ctx.y + 17);
  cell("Designation", designation, M.left + 12 + third, ctx.y + 17);
  cell("Employee ID", user.empId || "—", M.left + 12 + third * 2, ctx.y + 17);
  ctx.y += boxH + 8;

  const statusText = !reviewed
    ? "AWAITING APPROVAL — not valid for collecting documents until reviewed"
    : `${d.status.toUpperCase()}${reviewerName ? ` — reviewed by ${reviewerName}` : ""}${d.reviewedAt ? ` on ${fmtDate(d.reviewedAt)}` : ""}`;
  doc.setFillColor(...(!reviewed ? GREY : d.status === "Approved" ? GREEN : MAROON));
  doc.rect(M.left, ctx.y, CONTENT_W, 20, "F");
  doc.setFont(DISPLAY, "bold"); doc.setFontSize(8.2); doc.setTextColor(...CREAM);
  doc.text(statusText, M.left + 12, ctx.y + 13.4);
  ctx.y += 20 + 20;

  /* ---- a table of declared items with the office's decision ---- */
  const table = (title, head, rows) => {
    ctx.need(60);
    doc.setFont(DISPLAY, "bold"); doc.setFontSize(9.6); doc.setTextColor(...MAROON);
    doc.text(title, M.left, ctx.y);
    ctx.y += 8;
    const w = [22, 170, CONTENT_W - 22 - 170 - 88, 88];
    const x = [M.left, M.left + w[0], M.left + w[0] + w[1], M.left + w[0] + w[1] + w[2]];
    doc.setFillColor(...MAROON);
    doc.rect(M.left, ctx.y, CONTENT_W, 19, "F");
    doc.setFont(DISPLAY, "bold"); doc.setFontSize(7.6); doc.setTextColor(...CREAM);
    ["#", ...head, "DECISION"].forEach((h, i) => doc.text(h, x[i] + 6, ctx.y + 12.6));
    ctx.y += 19;

    if (!rows.length) {
      doc.setFont(BODY, "italic"); doc.setFontSize(9); doc.setTextColor(...GREY);
      doc.text("None declared.", M.left + 6, ctx.y + 14);
      ctx.y += 22;
    }
    rows.forEach((r, i) => {
      doc.setFont(BODY, "normal"); doc.setFontSize(8.8);
      const a = doc.splitTextToSize(String(r.a || "—"), w[1] - 12);
      const b = doc.splitTextToSize(String(r.b || "—"), w[2] - 12);
      const h = Math.max(a.length, b.length) * 11 + 10;
      const before = ctx.page;
      ctx.need(h);
      if (ctx.page !== before) ctx.y += 2;
      doc.setFont(BODY, "normal"); doc.setFontSize(8.8); doc.setTextColor(...INK);
      doc.text(String(i + 1), x[0] + 6, ctx.y + 14);
      a.forEach((l, k) => doc.text(l, x[1] + 6, ctx.y + 14 + k * 11));
      b.forEach((l, k) => doc.text(l, x[2] + 6, ctx.y + 14 + k * 11));
      const dec = (d.decisions || {})[r.id];
      doc.setFont(DISPLAY, "bold"); doc.setFontSize(7.4);
      doc.setTextColor(...(dec === "approved" ? GREEN : dec === "declined" ? RED : GREY));
      doc.text(DECISION_WORD[dec] || "PENDING", x[3] + 6, ctx.y + 14);
      doc.setDrawColor(...RULE); doc.setLineWidth(0.5);
      doc.line(M.left, ctx.y + h, PAGE.w - M.right, ctx.y + h);
      ctx.y += h;
    });
    ctx.y += 18;
  };

  table("1.  PROJECTS I WILL SHOW IN MY PORTFOLIO", ["PROJECT", "WHAT I WILL SHOW"],
    (d.projects || []).map((p) => ({ id: p.id, a: p.name, b: p.use })));
  table("2.  OFFICE FILES IN MY POSSESSION", ["FILES", "TYPE  ·  WHERE THEY ARE HELD"],
    (d.files || []).map((f) => ({ id: f.id, a: f.what, b: [f.kind, f.where].filter(Boolean).join("  ·  ") })));

  ctx.need(40);
  doc.setFont(DISPLAY, "bold"); doc.setFontSize(9.6); doc.setTextColor(...MAROON);
  doc.text("3.  ANYTHING ELSE OF THE OFFICE THAT I HOLD", M.left, ctx.y);
  ctx.y += 15;
  para(ctx, String(d.otherItems || "").trim() || "Nothing other than the items listed above.", { size: 9.2, lead: 13, gap: 14 });

  if (reviewed && String(d.reviewNote || "").trim()) {
    ctx.need(40);
    doc.setFont(DISPLAY, "bold"); doc.setFontSize(9.6); doc.setTextColor(...MAROON);
    doc.text("OFFICE REMARKS", M.left, ctx.y);
    ctx.y += 15;
    para(ctx, d.reviewNote, { size: 9.2, lead: 13, gap: 14 });
  }

  /* ---- declaration ----
     Kept on one page with the signatures beneath it: a signature on a sheet
     of its own, away from what is being signed, is worth very little. */
  ctx.need(250);
  doc.setFont(DISPLAY, "bold"); doc.setFontSize(9.6); doc.setTextColor(...MAROON);
  doc.text("DECLARATION", M.left, ctx.y);
  ctx.y += 15;
  DISCLOSURE_DECLARATION.forEach((t, i) => {
    para(ctx, `${i + 1}.  ${t}`, { size: 8.9, lead: 12.4, gap: 5 });
  });
  ctx.y += 6;
  doc.setFont(BODY, "italic"); doc.setFontSize(8.4); doc.setTextColor(...GREY);
  ctx.need(14);
  doc.text(`Items: ${counts.total}   ·   Approved: ${counts.approved}   ·   Not approved: ${counts.declined}   ·   Pending: ${counts.pending}`, M.left, ctx.y);
  ctx.y += 14;

  /* ---- signatures ---- */
  ctx.y += 44;
  const colW = CONTENT_W / 2 - 20;
  doc.setDrawColor(...INK); doc.setLineWidth(0.7);
  doc.line(M.left, ctx.y, M.left + colW, ctx.y);
  doc.line(M.left + CONTENT_W - colW, ctx.y, PAGE.w - M.right, ctx.y);
  doc.setFont(DISPLAY, "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
  doc.text(user.name.toUpperCase(), M.left, ctx.y + 13);
  doc.text(`FOR ${COMPANY_INFO.name}`, M.left + CONTENT_W - colW, ctx.y + 13);
  doc.setFont(DISPLAY, "normal"); doc.setFontSize(7.6); doc.setTextColor(...GREY);
  doc.text("Signature & date", M.left, ctx.y + 24);
  doc.text("HR / Principal Architect — signature, date & seal", M.left + CONTENT_W - colW, ctx.y + 24);

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  if (mode === "preview") return doc.output("bloburl");
  doc.save(`Disclosure form - ${safe(user.name)}.pdf`);
  return null;
}
