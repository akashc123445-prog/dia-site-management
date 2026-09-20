import { jsPDF } from "jspdf";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import {
  makeCtx, heading, para,
  PAGE, M, CONTENT_W, INK, GREY, RULE, MAROON, MAROON_DEEP, CREAM, DISPLAY, BODY,
} from "./generateQuotation";

/* ------------------------------------------------------------------------
   The day's work tracker, as a sheet to hand round and as a message to send.

   Both are built from whatever the screen is currently showing, so a list
   filtered to one person or one priority exports as that list rather than
   everything.
   ------------------------------------------------------------------------ */

const PRIORITY_MARK = { High: "!!", Medium: "!", Low: "" };

const byProject = (tasks) => {
  const groups = [];
  tasks.forEach((t) => {
    const g = groups.find((x) => x.project === t.project);
    if (g) g.tasks.push(t);
    else groups.push({ project: t.project, tasks: [t] });
  });
  const rank = { High: 0, Medium: 1, Low: 2 };
  groups.forEach((g) => g.tasks.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1)));
  return groups.sort((a, b) => a.project.localeCompare(b.project));
};

export function generateWorkTrackerPdf({ tasks, people, title, subtitle }, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx = makeCtx(doc);
  const name = (id) => people.find((p) => p.id === id)?.name || "";
  const today = new Date().toISOString().slice(0, 10);

  doc.setFont(BODY, "normal");
  doc.setFontSize(9.6);
  doc.setTextColor(...INK);
  doc.text(fmtDate(today), PAGE.w - M.right, ctx.y, { align: "right" });
  ctx.y += 8;

  heading(ctx, (title || "Work in hand").toUpperCase(), 13);
  if (subtitle) para(ctx, subtitle, { size: 9.4, color: GREY, gap: 14 });

  const groups = byProject(tasks);

  groups.forEach((group) => {
    ctx.need(46);

    /* project band */
    doc.setFillColor(...MAROON_DEEP);
    doc.rect(M.left, ctx.y, CONTENT_W, 20, "F");
    doc.setFont(DISPLAY, "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(...CREAM);
    doc.text(group.project.toUpperCase(), M.left + 8, ctx.y + 13.5, { charSpace: 0.5 });
    doc.setFont(BODY, "normal");
    doc.setFontSize(7.4);
    doc.text(`${group.tasks.filter((t) => t.status !== "Done").length} open`,
      PAGE.w - M.right - 8, ctx.y + 13.5, { align: "right" });
    ctx.y += 20;

    group.tasks.forEach((task, i) => {
      doc.setFont(BODY, "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(task.title || "", CONTENT_W - 200);
      doc.setFontSize(7.6);
      const noteLines = task.note ? doc.splitTextToSize(task.note, CONTENT_W - 210) : [];
      const h = Math.max(26, lines.length * 11.5 + noteLines.length * 9.5 + 13);

      if (ctx.y + h > ctx.bottom) ctx.newPage();
      const top = ctx.y;

      if (i % 2 === 1) {
        doc.setFillColor(247, 243, 236);
        doc.rect(M.left, top, CONTENT_W, h, "F");
      }

      /* An empty square to tick off on paper — the sheet is meant to be
         carried around and marked up. */
      doc.setDrawColor(...(task.status === "Done" ? GREY : MAROON));
      doc.setLineWidth(0.9);
      doc.rect(M.left + 9, top + h / 2 - 6, 12, 12);
      if (task.status === "Done") {
        doc.setLineWidth(1.5);
        doc.line(M.left + 11.5, top + h / 2 - 0.5, M.left + 14, top + h / 2 + 2.5);
        doc.line(M.left + 14, top + h / 2 + 2.5, M.left + 18.5, top + h / 2 - 3.5);
      }

      let ty = top + (h - (lines.length * 11.5 + noteLines.length * 9.5)) / 2 + 9;
      doc.setFont(BODY, task.priority === "High" ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(...(task.status === "Done" ? GREY : INK));
      lines.forEach((l) => { doc.text(l, M.left + 30, ty); ty += 11.5; });

      if (noteLines.length) {
        doc.setFont(BODY, "normal");
        doc.setFontSize(7.6);
        doc.setTextColor(...GREY);
        noteLines.forEach((l) => { doc.text(l, M.left + 30, ty); ty += 9.5; });
      }

      /* right-hand column: who has it, how urgent, where it stands */
      const mid = top + h / 2 + 3;
      doc.setFont(BODY, "normal");
      doc.setFontSize(7.6);
      doc.setTextColor(...GREY);
      /* Three right-aligned columns with room between them: at the previous
         spacing "HIGH" ran into the status beside it. */
      const statusX = PAGE.w - M.right - 8;
      const priorityX = statusX - 62;
      const whoX = priorityX - 36;

      if (task.assigneeId) doc.text(name(task.assigneeId), whoX, mid, { align: "right" });

      if (task.priority === "High" && task.status !== "Done") {
        doc.setFont(DISPLAY, "bold");
        doc.setTextColor(...MAROON);
        doc.text("HIGH", priorityX, mid, { align: "right" });
      }

      doc.setFont(BODY, "normal");
      doc.setTextColor(...GREY);
      doc.text(task.status || "", statusX, mid, { align: "right" });

      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.5);
      doc.line(M.left, top + h, PAGE.w - M.right, top + h);
      ctx.y += h;
    });

    ctx.y += 12;
  });

  ctx.need(40);
  ctx.y += 6;
  doc.setFont(BODY, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  const open = tasks.filter((t) => t.status !== "Done").length;
  doc.text(`${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${open} open · ${COMPANY_INFO.name}`,
    M.left, ctx.y);

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `Work in hand ${safe(today)}.pdf`;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}

/* Plain text for WhatsApp. Kept short deliberately: a message longer than a
   screen doesn't get read, so notes are left out and only the high-priority
   items are marked. */
export function workTrackerMessage({ tasks, people, heading: label }) {
  const name = (id) => people.find((p) => p.id === id)?.name || "";
  const open = tasks.filter((t) => t.status !== "Done");
  if (!open.length) return `${label || "Work in hand"} — nothing open. Everything on the list is done.`;

  const lines = [`*${label || "Work in hand"}* — ${fmtDate(new Date().toISOString().slice(0, 10))}`, ""];

  byProject(open).forEach((group) => {
    lines.push(`*${group.project}*`);
    group.tasks.forEach((t, i) => {
      const who = t.assigneeId ? ` — ${name(t.assigneeId)}` : "";
      const mark = PRIORITY_MARK[t.priority] ? ` ${PRIORITY_MARK[t.priority]}` : "";
      const prog = t.status === "In progress" ? " (in progress)" : "";
      lines.push(`${i + 1}. ${t.title}${who}${prog}${mark}`);
    });
    lines.push("");
  });

  const high = open.filter((t) => t.priority === "High").length;
  lines.push(high ? `${open.length} open, ${high} high priority (!!)` : `${open.length} open`);
  return lines.join("\n");
}
