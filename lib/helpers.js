/* ------------------------------------------------------------------------
   Shared pure helper functions: formatting, progress/health computation,
   proof-of-work rules, and template generators for new projects. No React
   or Supabase imports here — used by both the UI and the data layer.
   ------------------------------------------------------------------------ */

import * as XLSX from "xlsx";
import { PHASE_TEMPLATE, DESIGN_PHASES, DRAWING_CHECKLIST_TEMPLATE, TODAY } from "./constants";

const uid = () => Math.random().toString(36).slice(2, 10);
const fmtINR = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function isTaskDelayed(task) {
  if (task.status === "Completed") return false;
  return new Date(task.target) < TODAY;
}

/* For a given person on a given project, finds daily report slots (Opening/
   Midday/Closing) they missed over the last `lookbackDays` days (not
   counting today, since today isn't "missed" yet). Used both to nudge the
   person on next login and to let Admin see who's falling behind. */
function computeMissedReportSlots(project, siteReports, userId, lookbackDays = 7) {
  const REPORT_SLOTS = ["Opening", "Midday", "Closing"];
  const missed = [];
  const start = new Date(project.startDate);
  for (let i = 1; i <= lookbackDays; i++) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - i);
    if (d < start) break;
    const dateStr = d.toISOString().slice(0, 10);
    const dayReports = siteReports.filter(r => r.projectId === project.id && r.date === dateStr && r.supervisorId === userId);
    for (const slot of REPORT_SLOTS) {
      if (!dayReports.some(r => r.reportType === slot)) missed.push({ date: dateStr, slot });
    }
  }
  return missed;
}

function computeProjectSpend(expenses, projectId) {
  const list = expenses.filter(e => e.projectId === projectId);
  const approved = list.filter(e => e.status === "Approved").reduce((s, e) => s + e.amount, 0);
  const pending = list.filter(e => e.status === "Pending").reduce((s, e) => s + e.amount, 0);
  const rejected = list.filter(e => e.status === "Rejected").reduce((s, e) => s + e.amount, 0);
  return { approved, pending, rejected, total: approved + pending };
}

function computeProjectProgress(tasks, projectId, siteReports) {
  const reports = siteReports.filter(r => r.projectId === projectId).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (reports.length) return reports[0].pctComplete;
  const list = tasks.filter(t => t.projectId === projectId);
  if (!list.length) return 0;
  return Math.round(list.reduce((s, t) => s + t.pct, 0) / list.length);
}

function computeDesignProgress(designPhases, projectId) {
  const list = designPhases.filter(d => d.projectId === projectId).map(effectivePhase);
  if (!list.length) return 0;
  return Math.round(list.reduce((s, d) => s + d.pct, 0) / list.length);
}

/* --- Photo/PDF proof-of-work -------------------------------------------
   Design phases and drawing checklist items may only be marked "In Progress"
   or "Completed" once a photo or PDF has been attached as evidence. Any
   record with a non-baseline status but no attached proof is treated, for
   every display and calculation, as if the work were not actually done. */
function hasProof(item) {
  return !!(item && item.proof && item.proof.dataUrl);
}
function effectivePhase(phase) {
  if (!phase || phase.status === "Not Started") return phase;
  if (hasProof(phase)) return phase;
  return { ...phase, status: "Not Started", pct: 0 };
}
function effectiveDrawing(drawing) {
  if (!drawing || drawing.status === "Pending") return drawing;
  if (hasProof(drawing)) return drawing;
  return { ...drawing, status: "Pending" };
}
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
const DEMO_PROOF_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='#E2C8AF'/><text x='40' y='44' font-size='11' text-anchor='middle' fill='#622022' font-family='sans-serif'>Photo</text></svg>`;
const DEMO_PROOF_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DEMO_PROOF_SVG)}`;
const demoProof = (name, when) => ({ name, type: "image", dataUrl: DEMO_PROOF_DATA_URL, uploadedAt: when });

function computeHealth(project, tasks, expenses) {
  if (project.status === "Completed" || project.status === "Closed") return "done";
  const projTasks = tasks.filter(t => t.projectId === project.id);
  const delayedTasks = projTasks.filter(isTaskDelayed);
  const spend = computeProjectSpend(expenses, project.id);
  const budgetRatio = project.estimatedCost ? spend.approved / project.estimatedCost : 0;
  const daysToDeadline = daysBetween(TODAY, project.plannedEnd);
  if (project.status === "Delayed" || delayedTasks.length >= 3 || budgetRatio > 1) return "red";
  if (delayedTasks.length > 0 || budgetRatio > 0.85 || (daysToDeadline <= 14 && daysToDeadline >= 0)) return "yellow";
  return "green";
}

const HEALTH_META = {
  green: { label: "On Track", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  yellow: { label: "At Risk", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  red: { label: "Delayed", dot: "bg-rose-600", text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
  done: { label: "Completed", dot: "bg-stone-400", text: "text-stone-600", bg: "bg-stone-100", border: "border-stone-200" },
};

function generatePhaseTasks(projectId, startDate, plannedEnd, assignedTo) {
  const start = new Date(startDate);
  const end = new Date(plannedEnd);
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  const n = PHASE_TEMPLATE.length;
  return PHASE_TEMPLATE.map((phase, i) => {
    const segStart = new Date(start.getTime() + Math.round((totalDays * i) / n) * 86400000);
    const segEnd = new Date(start.getTime() + Math.round((totalDays * (i + 1)) / n) * 86400000);
    return {
      id: uid(), projectId, phase, name: phase,
      start: segStart.toISOString().slice(0, 10), target: segEnd.toISOString().slice(0, 10),
      actual: null, status: "Not Started", pct: 0, assignedTo: assignedTo || null, dependsOn: null,
    };
  });
}

/* Design phases run ahead of construction, ending at the project's construction
   start date. The Working Drawings phase also carries a drawing checklist.
   Pass a custom phaseList (e.g. DESIGN_PHASES_DESIGNING) for design-only contracts. */
function generateDesignPhases(projectId, constructionStart, assignedTo, designWindowDays = 60, phaseList = DESIGN_PHASES) {
  const end = new Date(constructionStart);
  const start = new Date(end.getTime() - designWindowDays * 86400000);
  const totalDays = designWindowDays;
  const n = phaseList.length;
  return phaseList.map((phase, i) => {
    const segStart = new Date(start.getTime() + Math.round((totalDays * i) / n) * 86400000);
    const segEnd = new Date(start.getTime() + Math.round((totalDays * (i + 1)) / n) * 86400000);
    const entry = {
      id: uid(), projectId, phase,
      start: segStart.toISOString().slice(0, 10), target: segEnd.toISOString().slice(0, 10),
      actual: null, status: "Not Started", pct: 0, assignedTo: assignedTo || null, notes: "",
    };
    if (phase === "Working Drawings") {
      entry.drawings = DRAWING_CHECKLIST_TEMPLATE.map(name => ({ id: uid(), name, status: "Pending", updatedAt: null, updatedBy: null }));
    }
    return entry;
  });
}

function exportToExcel(rows, filename, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export {
  uid, fmtINR, fmtDate, fmtTime, daysBetween, clamp,
  isTaskDelayed, computeProjectSpend, computeProjectProgress, computeDesignProgress,
  hasProof, effectivePhase, effectiveDrawing, fileToDataURL, demoProof, DEMO_PROOF_DATA_URL,
  computeHealth, HEALTH_META, generatePhaseTasks, generateDesignPhases, exportToExcel,
  computeMissedReportSlots,
};
