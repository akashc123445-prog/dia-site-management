/* ------------------------------------------------------------------------
   Project schedule: templates and the date engine.

   Tasks can be scheduled two ways. A pinned task keeps the date someone typed.
   An unpinned task with predecessors takes its start from the latest of them,
   plus a lag — so pushing one trade back moves everything that waits on it
   without anybody retyping a column of dates.
   ------------------------------------------------------------------------ */

export const SCHEDULE_STATUSES = ["Draft", "Issued", "Revised", "Completed"];

export const TASK_STATUSES = {
  not_started: { label: "Not started", pill: "bg-stone-100 text-stone-600", bar: "#B9AFA3" },
  in_progress: { label: "In progress", pill: "bg-amber-50 text-amber-700", bar: "#C9A227" },
  done: { label: "Completed", pill: "bg-emerald-50 text-emerald-700", bar: "#4F7A5B" },
  blocked: { label: "Blocked", pill: "bg-rose-50 text-rose-700", bar: "#A63D40" },
};

/* The covering letter that goes to the client with the schedule. */
export const SCHEDULE_INTRO = [
  "I am writing with respect to the site work at {{client}}. Please find below the schedule of works, setting out each activity, its duration and the date on which it is expected to commence.",
  "The dates are indicative and assume uninterrupted site access, timely material approvals and clearance of the agreed stage payments. Any delay in these will move the dates that follow.",
];

export const SCHEDULE_CLOSING = [
  "We request your kind co-operation in ensuring that approvals and selections are confirmed within the dates indicated, so that the programme holds.",
  "We look forward to handing over a showroom that reflects the standards {{client}} is known for.",
];

/* The onboarding note that goes out once a BOQ is accepted. */
export const WELCOME_TEMPLATE = {
  heading: "Welcome aboard",
  paragraphs: [
    "Thank you for entrusting {{client}} to DIA Retail Solutions. We're delighted to be building your showroom at {{location}}, and this note sets out how the project will run from here.",
    "A single point of contact from our studio will co-ordinate the site throughout. You'll receive a written update as work progresses, and every material selection will be brought to you for approval before it is ordered.",
    "The schedule that follows lists each activity with its duration and expected start. Two things keep it on track: approvals confirmed by the dates shown, and stage payments cleared as they fall due. Where either slips, we will tell you promptly what it means for the handover date.",
  ],
  nextSteps: [
    "Confirm your point of contact and the site working hours.",
    "Clear the site for our team to begin mobilisation.",
    "Confirm the stage 1 payment so procurement can commence.",
    "Block time for the first material selection review.",
  ],
};

export const SCHEDULE_TASK_TEMPLATE = [
  { name: "Site pooja and mobilisation", days: 2 },
  { name: "Demolition and site clearance", days: 6 },
  { name: "Civil works", days: 10 },
  { name: "Carpentry — base carcass", days: 25 },
  { name: "Carpentry — MDF finish work", days: 20 },
  { name: "Carpentry — finishing and touch-ups", days: 15 },
  { name: "Electrical base wiring", days: 15 },
  { name: "False ceiling", days: 15 },
  { name: "Painting", days: 25 },
  { name: "Flooring", days: 12 },
  { name: "Corian work", days: 14 },
  { name: "Glass and mirror", days: 6 },
  { name: "Light fittings and switchboards", days: 10 },
  { name: "Cleaning and finalisation", days: 7 },
];

export function fillScheduleTokens(text, s) {
  if (!text) return "";
  return String(text)
    .replace(/\{\{client\}\}/g, s.clientName || "the Client")
    .replace(/\{\{location\}\}/g, s.location || "site")
    .replace(/\{\{project\}\}/g, s.projectTitle || "the project");
}

const DAY = 86400000;
const toTime = (d) => (d ? Date.parse(d) : NaN);
const toISO = (t) => new Date(t).toISOString().slice(0, 10);

export const addDays = (iso, n) => (iso ? toISO(toTime(iso) + n * DAY) : "");

/* Inclusive working span: a 10-day task starting on the 1st ends on the 10th. */
export const taskEnd = (task) => {
  if (!task.start) return "";
  const days = Math.max(1, Number(task.days) || 1);
  return addDays(task.start, days - 1);
};

export function newTask(index) {
  return {
    id: `t${Date.now().toString(36)}${index}`,
    name: "", parentId: null, days: 7, durationNote: "",
    start: "", revisedStart: "", end: "", notes: "",
    dependsOn: [], lag: 0, pinned: false, status: "not_started",
  };
}

/* Resolves start dates from dependencies. Runs a few passes so a chain of
   predecessors settles regardless of the order tasks were entered; a cycle
   simply stops moving rather than looping forever. */
export function computeSchedule(tasks, projectStart) {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]));
  const order = tasks.map((t) => t.id);

  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    order.forEach((id) => {
      const task = byId.get(id);
      const deps = (task.dependsOn || []).map((d) => byId.get(d)).filter(Boolean);

      let start = task.start;
      if (!task.pinned && deps.length) {
        const ends = deps.map((d) => toTime(taskEnd(d))).filter((n) => !isNaN(n));
        if (ends.length) start = addDays(toISO(Math.max(...ends)), 1 + (Number(task.lag) || 0));
      } else if (!task.pinned && !task.start && !deps.length && projectStart) {
        start = projectStart;
      }

      if (start && start !== task.start) { task.start = start; changed = true; }
    });
    if (!changed) break;
  }

  /* A parent spans its children. */
  order.forEach((id) => {
    const task = byId.get(id);
    const kids = tasks.filter((t) => t.parentId === id).map((t) => byId.get(t.id));
    if (!kids.length) return;
    const starts = kids.map((k) => toTime(k.start)).filter((n) => !isNaN(n));
    const ends = kids.map((k) => toTime(taskEnd(k))).filter((n) => !isNaN(n));
    if (starts.length && ends.length) {
      task.start = toISO(Math.min(...starts));
      task.days = Math.round((Math.max(...ends) - Math.min(...starts)) / DAY) + 1;
      task.isParent = true;
    }
  });

  return order.map((id) => byId.get(id));
}

/* Earliest start and latest finish across the schedule, for the Gantt axis
   and the handover estimate. */
export function scheduleSpan(tasks) {
  const starts = tasks.map((t) => toTime(t.start)).filter((n) => !isNaN(n));
  const ends = tasks.map((t) => toTime(taskEnd(t))).filter((n) => !isNaN(n));
  if (!starts.length || !ends.length) return null;
  const from = Math.min(...starts), to = Math.max(...ends);
  return { from: toISO(from), to: toISO(to), days: Math.round((to - from) / DAY) + 1 };
}

export function blankSchedule(project) {
  return {
    projectId: project?.id || null,
    clientName: project?.client || "",
    projectTitle: project?.name || "",
    location: project?.location || "",
    title: "Site Work Schedule",
    subject: "Site Work Schedule",
    date: new Date().toISOString().slice(0, 10),
    projectStart: new Date().toISOString().slice(0, 10),
    intro: SCHEDULE_INTRO,
    closing: SCHEDULE_CLOSING,
    welcomeHeading: WELCOME_TEMPLATE.heading,
    welcomeParas: WELCOME_TEMPLATE.paragraphs,
    nextSteps: WELCOME_TEMPLATE.nextSteps,
    includeWelcome: true,
    includeGantt: true,
    tasks: [],
    handover: "",
    signatoryName: "",
    signatoryTitle: "",
    signatureUrl: "",
    status: "Draft",
    notes: "",
  };
}
