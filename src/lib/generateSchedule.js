import { jsPDF } from "jspdf";
import { COMPANY_INFO, DIA, LOGO_LETTERHEAD } from "./constants";
import { fmtDate } from "./helpers";
import { TRAJAN, registerBrandFonts } from "./brandFonts";
import {
  computeSchedule, scheduleSpan, taskEnd, fillScheduleTokens, TASK_STATUSES,
} from "./scheduleDefaults";

/* ------------------------------------------------------------------------
   Client onboarding pack: a welcome letter, the schedule of works, and a
   Gantt chart. Portrait A4 for the letter and table; the Gantt turns
   landscape, because a timeline needs the width.
   ------------------------------------------------------------------------ */

const P = { w: 595.28, h: 841.89 };          // A4 portrait
const L = { w: 841.89, h: 595.28 };          // A4 landscape
const M = { left: 52, right: 52, top: 158, bottom: 78 };

const INK = [40, 35, 32];
const GREY = [122, 116, 110];
const RULE = [212, 206, 198];

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const MAROON = hexToRgb(DIA.maroon);
const MAROON_DEEP = hexToRgb(DIA.maroonDeep);
const CREAM = hexToRgb(DIA.cream);
const CREAM_SOFT = hexToRgb(DIA.creamSoft);

function chrome(doc, page, landscape) {
  const W = landscape ? L.w : P.w;
  const H = landscape ? L.h : P.h;

  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(...MAROON_DEEP);
  doc.rect(M.left, 0, 110, 18, "F");

  try {
    const logoH = landscape ? 58 : 88, logoW = logoH * (426 / 560);
    doc.addImage(LOGO_LETTERHEAD, "PNG", M.left + 22, landscape ? 22 : 28, logoW, logoH);
  } catch { /* logo optional */ }

  const footY = H - 40;
  doc.setFillColor(...MAROON_DEEP);
  doc.rect(M.left, footY, 110, 28, "F");
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...CREAM);
  doc.text(`PAGE ${String(page).padStart(2, "0")}`, M.left + 12, footY + 18);

  doc.setFont(TRAJAN, "normal");
  doc.setFontSize(6);
  doc.setTextColor(...GREY);
  [
    COMPANY_INFO.addressOneLine,
    `GSTIN ${COMPANY_INFO.gstin}     |     ${COMPANY_INFO.phone}     |     ${COMPANY_INFO.email}`,
  ].forEach((line, i) => doc.text(line, W - M.right, footY + 12 + i * 8, { align: "right", charSpace: 0.15 }));
}

function makeCtx(doc) {
  const ctx = {
    doc, y: M.top, page: 1, landscape: false,
    get width() { return (this.landscape ? L.w : P.w) - M.left - M.right; },
    get bottom() { return (this.landscape ? L.h : P.h) - M.bottom; },
    need(h) { if (this.y + h > this.bottom) this.newPage(this.landscape); },
    newPage(landscape = false) {
      this.doc.addPage("a4", landscape ? "landscape" : "portrait");
      this.page += 1;
      this.landscape = landscape;
      chrome(this.doc, this.page, landscape);
      this.y = landscape ? 110 : M.top;
    },
  };
  registerBrandFonts(doc);
  chrome(doc, 1, false);
  return ctx;
}

function heading(ctx, text, size = 12) {
  ctx.need(size + 18);
  ctx.doc.setFont(TRAJAN, "bold");
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...MAROON);
  ctx.doc.text(text, M.left, ctx.y, { charSpace: 0.4 });
  ctx.y += size + 8;
}

function para(ctx, text, opts = {}) {
  const { doc } = ctx;
  const size = opts.size || 9.6, lead = opts.lead || 13.4;
  const style = () => {
    doc.setFont(opts.face || "helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color || INK));
  };
  style();
  doc.splitTextToSize(String(text || ""), ctx.width).forEach((line) => {
    const before = ctx.page;
    ctx.need(lead);
    if (ctx.page !== before) style();
    doc.text(line, M.left, ctx.y);
    ctx.y += lead;
  });
  ctx.y += opts.gap ?? 8;
}

function bullets(ctx, items) {
  const { doc } = ctx;
  items.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.4);
    doc.splitTextToSize(String(item), ctx.width - 18).forEach((line, i) => {
      ctx.need(13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.4);
      doc.setTextColor(...INK);
      if (i === 0) {
        doc.setFillColor(...MAROON);
        doc.circle(M.left + 4, ctx.y - 3, 1.5, "F");
      }
      doc.text(line, M.left + 15, ctx.y);
      ctx.y += 13;
    });
  });
  ctx.y += 8;
}

/* ---- schedule table ---- */

function scheduleTable(ctx, tasks) {
  const { doc } = ctx;
  const W = ctx.width;
  const cols = [
    { label: "S.No.", w: W * 0.07, align: "center" },
    { label: "Activity", w: W * 0.42, align: "left" },
    { label: "Duration", w: W * 0.13, align: "center" },
    { label: "Commences", w: W * 0.16, align: "center" },
    { label: "Completes", w: W * 0.16, align: "center" },
  ];
  const x0 = M.left;
  const colX = (i) => x0 + cols.slice(0, i).reduce((s, c) => s + c.w, 0);

  const head = () => {
    const h = 22;
    ctx.need(h + 26);
    doc.setFillColor(...MAROON_DEEP);
    doc.rect(x0, ctx.y, W, h, "F");
    doc.setFont(TRAJAN, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...CREAM);
    cols.forEach((c, i) => {
      const x = c.align === "left" ? colX(i) + 6 : colX(i) + c.w / 2;
      doc.text(c.label, x, ctx.y + 14, { align: c.align === "left" ? "left" : "center" });
    });
    ctx.y += h;
  };

  head();

  let serial = 0;
  tasks.forEach((task) => {
    const isParent = tasks.some((t) => t.parentId === task.id);
    if (!task.parentId) serial += 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.6);
    const indent = task.parentId ? 16 : 0;
    const nameLines = doc.splitTextToSize(task.name || "", cols[1].w - 12 - indent);
    const noteLines = task.notes ? doc.splitTextToSize(task.notes, cols[1].w - 12 - indent) : [];
    const h = Math.max(22, (nameLines.length + noteLines.length) * 10 + 12);

    if (ctx.y + h > ctx.bottom) { ctx.newPage(false); head(); }
    const top = ctx.y;

    if (isParent) {
      doc.setFillColor(...CREAM_SOFT);
      doc.rect(x0, top, W, h, "F");
    }

    doc.setTextColor(...INK);
    const mid = top + h / 2 + 3;

    if (!task.parentId) {
      doc.setFont(TRAJAN, "bold");
      doc.setFontSize(8);
      doc.text(String(serial), colX(0) + cols[0].w / 2, mid, { align: "center" });
    }

    doc.setFont(isParent || !task.parentId ? TRAJAN : "helvetica", isParent ? "bold" : "normal");
    doc.setFontSize(isParent ? 8.6 : 8.4);
    let ty = top + (h - (nameLines.length + noteLines.length) * 10) / 2 + 8;
    nameLines.forEach((line) => { doc.text(line, colX(1) + 6 + indent, ty); ty += 10; });
    if (noteLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4);
      doc.setTextColor(...GREY);
      noteLines.forEach((line) => { doc.text(line, colX(1) + 6 + indent, ty); ty += 10; });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...INK);
    const duration = task.durationNote || (task.days ? `${task.days} days` : "—");
    doc.text(duration, colX(2) + cols[2].w / 2, mid, { align: "center", maxWidth: cols[2].w - 8 });
    doc.text(task.start ? fmtDate(task.start) : "—", colX(3) + cols[3].w / 2, mid, { align: "center" });
    doc.text(taskEnd(task) ? fmtDate(taskEnd(task)) : "—", colX(4) + cols[4].w / 2, mid, { align: "center" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    cols.forEach((c, i) => doc.line(colX(i), top, colX(i), top + h));
    doc.line(x0 + W, top, x0 + W, top + h);
    doc.line(x0, top + h, x0 + W, top + h);

    ctx.y += h;
  });
  ctx.y += 12;
}

/* ---- Gantt ---- */

function ganttChart(ctx, tasks) {
  const { doc } = ctx;
  const span = scheduleSpan(tasks);
  if (!span) return;

  ctx.newPage(true);
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(12);
  doc.setTextColor(...MAROON);
  doc.text("PROGRAMME OF WORKS", L.w / 2, 78, { align: "center", charSpace: 1 });

  const labelW = 210;
  const chartX = M.left + labelW;
  const chartW = L.w - M.right - chartX;
  const rowH = 15;
  const from = Date.parse(span.from);
  const totalDays = Math.max(1, span.days);
  const xFor = (iso) => chartX + ((Date.parse(iso) - from) / 86400000 / totalDays) * chartW;

  /* month grid */
  ctx.y = 108;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  const cursor = new Date(from);
  cursor.setDate(1);
  while (cursor.getTime() <= Date.parse(span.to)) {
    const iso = cursor.toISOString().slice(0, 10);
    if (Date.parse(iso) >= from) {
      const x = xFor(iso);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.4);
      doc.line(x, ctx.y, x, ctx.y + 12 + tasks.length * rowH);
      doc.setTextColor(...GREY);
      doc.text(cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), x + 2, ctx.y - 2);
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  ctx.y += 12;
  tasks.forEach((task, i) => {
    const y = ctx.y + i * rowH;
    if (i % 2 === 1) {
      doc.setFillColor(250, 247, 241);
      doc.rect(M.left, y - 9, L.w - M.left - M.right, rowH, "F");
    }

    doc.setFont(task.parentId ? "helvetica" : TRAJAN, task.parentId ? "normal" : "bold");
    doc.setFontSize(task.parentId ? 6.8 : 7.2);
    doc.setTextColor(...INK);
    doc.text((task.parentId ? "   " : "") + (task.name || ""), M.left, y, { maxWidth: labelW - 10 });

    if (!task.start) return;
    const x1 = xFor(task.start);
    const x2 = Math.max(x1 + 3, xFor(taskEnd(task)));
    const colour = hexToRgb((TASK_STATUSES[task.status] || TASK_STATUSES.not_started).bar);
    doc.setFillColor(...colour);
    doc.roundedRect(x1, y - 7, x2 - x1, 9, 2, 2, "F");

    doc.setFontSize(5.8);
    doc.setTextColor(...GREY);
    doc.text(`${task.days || 1}d`, x2 + 3, y);
  });

  ctx.y += tasks.length * rowH + 16;

  /* key */
  let kx = M.left;
  doc.setFontSize(6.4);
  Object.values(TASK_STATUSES).forEach((s) => {
    doc.setFillColor(...hexToRgb(s.bar));
    doc.roundedRect(kx, ctx.y - 5, 14, 7, 1.5, 1.5, "F");
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "normal");
    doc.text(s.label, kx + 18, ctx.y);
    kx += 18 + doc.getTextWidth(s.label) + 16;
  });
}

export function generateSchedulePdf(s, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);
  const tasks = computeSchedule(s.tasks || [], s.projectStart);
  const span = scheduleSpan(tasks);
  const T = (t) => fillScheduleTokens(t, s);

  /* ---- welcome letter ---- */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(...INK);
  doc.text(fmtDate(s.date), P.w - M.right, ctx.y, { align: "right" });

  doc.text("To", M.left, ctx.y);
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(10.5);
  doc.text(s.clientName || "", M.left, ctx.y + 14);
  if (s.location) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.text(s.location, M.left, ctx.y + 28);
  }
  ctx.y += s.location ? 48 : 34;

  if (s.includeWelcome !== false) {
    heading(ctx, (s.welcomeHeading || "Welcome aboard").toUpperCase(), 13);
    (s.welcomeParas || []).forEach((p) => para(ctx, T(p), { gap: 9 }));

    if ((s.nextSteps || []).length) {
      ctx.y += 4;
      heading(ctx, "What we need from you", 10.5);
      bullets(ctx, (s.nextSteps || []).map(T));
    }
    ctx.newPage(false);
  }

  /* ---- schedule ---- */
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  doc.text(`Sub: ${(s.subject || "Site Work Schedule").toUpperCase()}`, M.left, ctx.y);
  ctx.y += 20;

  (s.intro || []).forEach((p) => para(ctx, T(p), { gap: 9 }));
  ctx.y += 4;

  heading(ctx, "SCHEDULE OF WORKS", 11.5);
  scheduleTable(ctx, tasks);

  const handover = s.handover || (span ? span.to : "");
  if (handover) {
    ctx.need(34);
    doc.setFillColor(...MAROON);
    doc.rect(M.left, ctx.y, ctx.width, 26, "F");
    doc.setFont(TRAJAN, "bold");
    doc.setFontSize(9.6);
    doc.setTextColor(...CREAM);
    doc.text("TENTATIVE DATE OF HANDOVER", M.left + 12, ctx.y + 17);
    doc.text(/^\d{4}-\d{2}-\d{2}$/.test(handover) ? fmtDate(handover) : handover,
      P.w - M.right - 12, ctx.y + 17, { align: "right" });
    ctx.y += 40;
  }

  (s.closing || []).forEach((p) => para(ctx, T(p), { gap: 9 }));

  /* ---- sign-off ---- */
  ctx.need(120);
  ctx.y += 10;
  para(ctx, "With warm regards,", { gap: 8 });
  if (s.signatureUrl) {
    try { doc.addImage(s.signatureUrl, "PNG", M.left, ctx.y, 110, 30, undefined, "FAST"); } catch { /* optional */ }
    ctx.y += 34;
  } else {
    ctx.y += 26;
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  doc.line(M.left, ctx.y, M.left + 170, ctx.y);
  ctx.y += 13;
  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  if (s.signatoryName) { doc.text(s.signatoryName, M.left, ctx.y); ctx.y += 12; }
  doc.setFont(TRAJAN, "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...GREY);
  if (s.signatoryTitle) { doc.text(s.signatoryTitle, M.left, ctx.y); ctx.y += 11; }
  doc.text(COMPANY_INFO.name, M.left, ctx.y);

  if (s.includeGantt !== false && tasks.length) ganttChart(ctx, tasks);

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `Schedule - ${safe(s.clientName) || "Client"}.pdf`;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}
