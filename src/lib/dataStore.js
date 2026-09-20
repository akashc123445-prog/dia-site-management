/* ----------------------------------------------------------------------
   Data access layer. Every function here talks to Supabase and returns/
   accepts the same camelCase shapes the UI already uses (the original
   in-browser prototype's `data` object and `actions`). Column names in
   Postgres are snake_case (see supabase/schema.sql); the map* functions
   below are the only place that translation happens.
   ---------------------------------------------------------------------- */

import { supabase, PROOF_BUCKET, SITE_PHOTOS_BUCKET } from "./supabaseClient";
import { generatePhaseTasks, generateDesignPhases, daysBetween } from "./helpers";
import { DESIGN_PHASES_DESIGNING } from "./constants";

/* ---- DB row -> UI object ------------------------------------------- */

const mapUser = (r) => ({
  id: r.id, name: r.name, email: r.email, role: r.role, rank: r.rank, active: r.active, removed: r.removed,
});

const mapProject = (r) => ({
  id: r.id, name: r.name, client: r.client, location: r.location, type: r.type,
  contractType: r.contract_type || "Turnkey",
  area: Number(r.area) || 0, startDate: r.start_date, plannedEnd: r.planned_end, actualEnd: r.actual_end,
  pm: r.pm, supervisors: r.supervisors || [], architects: r.architects || [],
  contractValue: Number(r.contract_value) || 0, estimatedCost: Number(r.estimated_cost) || 0, status: r.status,
});

const mapTask = (r) => ({
  id: r.id, projectId: r.project_id, phase: r.phase, name: r.name,
  start: r.start, target: r.target, actual: r.actual, status: r.status,
  pct: r.pct, assignedTo: r.assigned_to, dependsOn: r.depends_on,
});

const mapDrawing = (r) => ({
  id: r.id, name: r.name, status: r.status, proof: r.proof || null,
  updatedAt: r.updated_at, updatedBy: r.updated_by,
});

const mapDesignPhase = (r, allDrawings) => ({
  id: r.id, projectId: r.project_id, phase: r.phase,
  start: r.start, target: r.target, actual: r.actual,
  status: r.status, pct: r.pct, assignedTo: r.assigned_to, notes: r.notes, proof: r.proof || null,
  drawings: r.phase === "Working Drawings"
    ? allDrawings.filter((d) => d.design_phase_id === r.id).map(mapDrawing)
    : undefined,
});

const mapPhoto = (r) => ({
  id: r.id, url: r.url, dataUrl: r.url, caption: r.caption, category: r.category,
  date: r.date, uploadedAt: r.uploaded_at, projectId: r.project_id, uploadedBy: r.uploaded_by,
});

const mapSiteReport = (r, allPhotos) => ({
  id: r.id, projectId: r.project_id, supervisorId: r.supervisor_id, date: r.date, reportType: r.report_type, workers: r.workers,
  workDone: r.work_done, workInProgress: r.work_in_progress, workPlanned: r.work_planned,
  materialsReceived: r.materials_received, materialsNeeded: r.materials_needed,
  issues: r.issues, delays: r.delays, pctComplete: r.pct_complete, remarks: r.remarks,
  submittedAt: r.submitted_at,
  photos: allPhotos.filter((p) => p.site_report_id === r.id).map(mapPhoto),
});

const mapSiteVisit = (r) => ({
  id: r.id, projectId: r.project_id, architectId: r.architect_id,
  entryTime: r.entry_time, entryPhotoUrl: r.entry_photo_url,
  exitTime: r.exit_time, exitPhotoUrl: r.exit_photo_url,
  momNotes: r.mom_notes, momAttachmentUrl: r.mom_attachment_url,
  status: r.status, createdAt: r.created_at,
});

const mapExpense = (r) => ({
  id: r.id, projectId: r.project_id, submittedBy: r.submitted_by, date: r.date, category: r.category,
  description: r.description, amount: Number(r.amount) || 0, paymentMethod: r.payment_method,
  vendor: r.vendor, vendorId: r.vendor_id,
  totalInvoiceValue: r.total_invoice_value === null ? null : Number(r.total_invoice_value),
  advancePaid: Number(r.advance_paid) || 0,
  proofUrl: r.proof_url,
  paid: r.paid, paidAt: r.paid_at, paidBy: r.paid_by,
  invoiceNo: r.invoice_no, status: r.status, approvedBy: r.approved_by,
  rejectionReason: r.rejection_reason, submittedAt: r.submitted_at,
  poNumber: r.po_number, poGeneratedAt: r.po_generated_at, poGeneratedBy: r.po_generated_by,
  notes: r.notes,
});

const mapVendor = (r) => ({
  id: r.id, name: r.name, material: r.material, gstNumber: r.gst_number, address: r.address,
  phone: r.phone, email: r.email,
  bankAccountName: r.bank_account_name, bankAccountNumber: r.bank_account_number,
  bankIfsc: r.bank_ifsc, bankName: r.bank_name, createdAt: r.created_at,
});

const mapLeaveRequest = (r) => ({
  id: r.id, userId: r.user_id, kind: r.kind,
  fromDate: r.from_date, toDate: r.to_date, timeNote: r.time_note || "",
  reason: r.reason, days: Number(r.days) || 0, status: r.status,
  decidedBy: r.decided_by, decidedAt: r.decided_at, decisionNote: r.decision_note || "",
  createdAt: r.created_at,
});

const mapClientScopeItem = (r) => ({
  id: r.id, projectId: r.project_id, title: r.title, details: r.details || "",
  category: r.category, dueDate: r.due_date, status: r.status, doneOn: r.done_on,
  lastRemindedAt: r.last_reminded_at, notes: r.notes || "", sortOrder: r.sort_order,
});

const mapAttendance = (r) => ({
  id: r.id, userId: r.user_id, date: r.date,
  checkInAt: r.check_in_at, checkInPhotoUrl: r.check_in_photo_url, checkInNote: r.check_in_note,
  location: r.location, lat: r.lat, lng: r.lng,
  checkOutAt: r.check_out_at, checkOutNote: r.check_out_note,
});

const mapOfficeExpense = (r) => ({
  id: r.id, office: r.office, category: r.category, purpose: r.purpose,
  amount: Number(r.amount) || 0, paymentMethod: r.payment_method, date: r.date,
  proofUrl: r.proof_url, notes: r.notes, status: r.status,
  rejectionReason: r.rejection_reason,
  submittedBy: r.submitted_by, approvedBy: r.approved_by, approvedAt: r.approved_at,
  paid: !!r.paid, paidAt: r.paid_at, paidBy: r.paid_by, createdAt: r.created_at,
});

const mapWorkTask = (r) => ({
  id: r.id, project: r.project, title: r.title, status: r.status,
  assigneeId: r.assignee_id,
  priority: r.priority || (r.urgent ? "High" : "Medium"),
  urgent: (r.priority || (r.urgent ? "High" : "Medium")) === "High",
  note: r.note || "", doneOn: r.done_on,
  createdAt: r.created_at,
});

const mapSchedule = (r) => ({
  id: r.id, projectId: r.project_id, quotationId: r.quotation_id,
  clientName: r.client_name, projectTitle: r.project_title, location: r.location,
  title: r.title, subject: r.subject, date: r.date, projectStart: r.project_start,
  handover: r.handover,
  intro: r.intro || [], closing: r.closing || [],
  welcomeHeading: r.welcome_heading, welcomeParas: r.welcome_paras || [],
  nextSteps: r.next_steps || [],
  includeWelcome: r.include_welcome !== false, includeGantt: r.include_gantt !== false,
  tasks: r.tasks || [],
  signatoryName: r.signatory_name, signatoryTitle: r.signatory_title,
  signatureUrl: r.signature_url || "",
  status: r.status, notes: r.notes,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapFeedPost = (r) => ({
  id: r.id, projectId: r.project_id, authorId: r.author_id,
  kind: r.kind || "update", severity: r.severity || "info",
  body: r.body, status: r.status || "open",
  resolvedBy: r.resolved_by, resolvedAt: r.resolved_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapFeedComment = (r) => ({
  id: r.id, postId: r.post_id, authorId: r.author_id,
  body: r.body, createdAt: r.created_at,
});

const mapBoqLibraryItem = (r) => ({
  id: r.id, particulars: r.particulars, description: r.description,
  unit: r.unit, rate: Number(r.rate) || 0, category: r.category,
  timesUsed: r.times_used || 0, createdAt: r.created_at,
});

const mapQuotation = (r) => ({
  id: r.id, quotationNo: r.quotation_no, projectId: r.project_id,
  clientName: r.client_name, clientAddress: r.client_address, projectTitle: r.project_title,
  location: r.location, city: r.city, date: r.date, subject: r.subject,
  serviceLine: r.service_line, area: Number(r.area) || 0, floors: r.floors,
  feeMode: r.fee_mode || "rate", ratePerSqft: Number(r.rate_per_sqft) || 0,
  feeLines: r.fee_lines || [],
  totalFee: Number(r.total_fee) || 0, gstNote: r.gst_note,
  introParas: r.intro_paras || [], scopeStages: r.scope_stages || [],
  paymentStages: r.payment_stages || [], milestoneNotes: r.milestone_notes || [],
  revisionPolicy: r.revision_policy || [], closingParas: r.closing_paras || [],
  paymentTerms: r.payment_terms || [],
  signatoryName: r.signatory_name, signatoryTitle: r.signatory_title, signatureUrl: r.signature_url || "",
  bank: r.bank || {},
  docType: r.doc_type || "proposal", mobile: r.mobile, salutation: r.salutation,
  lineItems: r.line_items || [], discount: Number(r.discount) || 0, workTerms: r.work_terms || [],
  materialSpecs: r.material_specs || [], boqSections: r.boq_sections || [],
  exclusions: r.exclusions || [], extraChargeLabel: r.extra_charge_label,
  extraChargePct: Number(r.extra_charge_pct) || 0,
  showPaymentTerms: r.show_payment_terms !== false,
  concession: Number(r.discount) || 0,
  concessionLabel: r.concession_label || "Concession",
  pageOptions: r.page_options || {},
  gstRate: Number(r.gst_rate) || 0,
  status: r.status, notes: r.notes, createdBy: r.created_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapIssue = (r) => ({
  id: r.id, projectId: r.project_id, supervisorId: r.supervisor_id, date: r.date,
  description: r.description, severity: r.severity, status: r.status, submittedAt: r.submitted_at,
});

const mapMaterialRequest = (r) => ({
  id: r.id, projectId: r.project_id, requestedBy: r.requested_by, items: r.items,
  quantity: r.quantity, neededBy: r.needed_by, notes: r.notes, status: r.status,
  approvedBy: r.approved_by, approvedAt: r.approved_at, rejectionReason: r.rejection_reason,
  vendorId: r.vendor_id, amount: r.amount === null ? null : Number(r.amount),
  receiptPhotoUrl: r.receipt_photo_url, receivedBy: r.received_by, receivedAt: r.received_at,
  fulfilledBy: r.fulfilled_by, fulfilledAt: r.fulfilled_at, expenseId: r.expense_id,
  createdAt: r.created_at,
});

/* ---- fetch everything ------------------------------------------------ */

export async function fetchAllData() {
  const [profiles, projects, tasks, designPhasesRaw, drawingsRaw, siteReportsRaw, photosRaw, expensesRaw, issuesRaw, vendorsRaw, materialRequestsRaw, siteVisitsRaw, quotationsRaw, boqLibraryRaw, feedPostsRaw, feedCommentsRaw, schedulesRaw, workTasksRaw, officeExpensesRaw, leaveRaw, clientScopeRaw, attendanceRaw] =
    await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("projects").select("*").order("created_at"),
      supabase.from("tasks").select("*"),
      supabase.from("design_phases").select("*"),
      supabase.from("drawings").select("*"),
      supabase.from("site_reports").select("*").order("date", { ascending: false }),
      supabase.from("photos").select("*"),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("issues").select("*").order("date", { ascending: false }),
      supabase.from("vendors").select("*").order("name"),
      supabase.from("material_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("site_visits").select("*").order("entry_time", { ascending: false }),
      // Quotations are Admin/Accounts-only at the RLS level, so this comes back
      // empty (not an error) for architects and supervisors.
      supabase.from("quotations").select("*").order("created_at", { ascending: false }),
      supabase.from("boq_library").select("*").order("times_used", { ascending: false }),
      // The feed is readable by every role, so it loads for everyone.
      supabase.from("feed_posts").select("*").order("created_at", { ascending: false }).limit(400),
      supabase.from("feed_comments").select("*").order("created_at", { ascending: true }),
      supabase.from("schedules").select("*").order("created_at", { ascending: false }),
      // Admin-only at the RLS level, so this comes back empty for everyone else.
      supabase.from("work_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("office_expenses").select("*").order("date", { ascending: false }),
      // Last few weeks only: the board is about today, and the history view
      // never looks further back than a month.
      supabase.from("leave_requests").select("*").order("from_date", { ascending: false }),
      supabase.from("client_scope_items").select("*").order("sort_order").order("created_at"),
      supabase.from("attendance").select("*")
        .gte("date", new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10))
        .order("date", { ascending: false }),
    ]);

  const results = { profiles, projects, tasks, designPhasesRaw, drawingsRaw, siteReportsRaw, photosRaw, expensesRaw, issuesRaw, vendorsRaw, materialRequestsRaw, siteVisitsRaw };
  for (const [key, res] of Object.entries(results)) {
    if (res.error) throw new Error(`Failed to load ${key}: ${res.error.message}`);
  }

  // Quotations load fail-soft on purpose: if the quotations migration hasn't
  // been applied to this Supabase project yet, the rest of the workspace must
  // still open normally rather than dropping everyone onto the error screen.
  if (quotationsRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("Quotations unavailable:", quotationsRaw.error.message);
  }
  if (boqLibraryRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("BOQ library unavailable:", boqLibraryRaw.error.message);
  }
  if (leaveRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("Leave register unavailable:", leaveRaw.error.message);
  }
  if (clientScopeRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("Client scope unavailable:", clientScopeRaw.error.message);
  }
  if (attendanceRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("Attendance unavailable:", attendanceRaw.error.message);
  }
  if (officeExpensesRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("Office expenses unavailable:", officeExpensesRaw.error.message);
  }
  if (workTasksRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("Work tracker unavailable:", workTasksRaw.error.message);
  }
  if (schedulesRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("Schedules unavailable:", schedulesRaw.error.message);
  }
  if (feedPostsRaw.error || feedCommentsRaw.error) {
    // eslint-disable-next-line no-console
    console.warn("Feed unavailable:", (feedPostsRaw.error || feedCommentsRaw.error).message);
  }

  return {
    users: (profiles.data || []).map(mapUser),
    projects: (projects.data || []).map(mapProject),
    tasks: (tasks.data || []).map(mapTask),
    designPhases: (designPhasesRaw.data || []).map((r) => mapDesignPhase(r, drawingsRaw.data || [])),
    siteReports: (siteReportsRaw.data || []).map((r) => mapSiteReport(r, photosRaw.data || [])),
    photos: (photosRaw.data || []).map(mapPhoto),
    expenses: (expensesRaw.data || []).map(mapExpense),
    issues: (issuesRaw.data || []).map(mapIssue),
    vendors: (vendorsRaw.data || []).map(mapVendor),
    materialRequests: (materialRequestsRaw.data || []).map(mapMaterialRequest),
    siteVisits: (siteVisitsRaw.data || []).map(mapSiteVisit),
    quotations: (quotationsRaw.data || []).map(mapQuotation),
    boqLibrary: (boqLibraryRaw.data || []).map(mapBoqLibraryItem),
    schedules: (schedulesRaw.data || []).map(mapSchedule),
    workTasks: (workTasksRaw.data || []).map(mapWorkTask),
    officeExpenses: (officeExpensesRaw.data || []).map(mapOfficeExpense),
    attendance: (attendanceRaw.data || []).map(mapAttendance),
    clientScope: (clientScopeRaw.data || []).map(mapClientScopeItem),
    leaveRequests: (leaveRaw.data || []).map(mapLeaveRequest),
    feedPosts: (feedPostsRaw.data || []).map(mapFeedPost),
    feedComments: (feedCommentsRaw.data || []).map(mapFeedComment),
  };
}

/* ---- profiles ---------------------------------------------------------- */

export async function dbUpdateProfile(userId, updates) {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.role !== undefined) payload.role = updates.role;
  if (updates.rank !== undefined) payload.rank = updates.rank;
  if (updates.active !== undefined) payload.active = updates.active;
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

/* Admin-only: create a teammate directly with a chosen email/password/role,
   already active — no self-signup step needed. Runs through a secure edge
   function since creating a user with a password requires the service role
   key, which must never be present in browser code. */
export async function dbAdminCreateUser({ email, password, name, role, rank }) {
  const { data, error } = await supabase.functions.invoke("admin-manage-user", {
    body: { action: "create", email, password, name, role, rank },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to create user.");
  return data.userId;
}

/* Admin-only: set a new password for an existing teammate (the "forgot
   password" flow — Admin sets a new one and tells the person directly,
   rather than anyone being able to see anyone's actual password). */
export async function dbAdminResetPassword(userId, password) {
  const { data, error } = await supabase.functions.invoke("admin-manage-user", {
    body: { action: "reset_password", userId, password },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to reset password.");
}

/* Removes someone from the team entirely: unassigns them from every project's
   architect/supervisor lists, then marks their profile removed and inactive.
   Their historical site reports/expenses/photos are kept intact for records;
   they simply disappear from Team and can no longer sign in. */
export async function dbRemoveUser(userId, projects) {
  for (const p of projects) {
    const inArch = (p.architects || []).includes(userId);
    const inSup = (p.supervisors || []).includes(userId);
    if (inArch || inSup) {
      await dbUpdateProject(p.id, {
        architects: inArch ? p.architects.filter((x) => x !== userId) : undefined,
        supervisors: inSup ? p.supervisors.filter((x) => x !== userId) : undefined,
      });
    }
  }
  const { error } = await supabase.from("profiles").update({ removed: true, active: false }).eq("id", userId);
  if (error) throw error;
}

/* ---- projects ------------------------------------------------------- */

export async function dbAddProject(proj, users) {
  const isDesigning = proj.contractType === "Designing";
  const { data: projectRow, error } = await supabase.from("projects").insert({
    name: proj.name, client: proj.client, location: proj.location, type: proj.type, area: proj.area,
    contract_type: proj.contractType || "Turnkey",
    start_date: proj.startDate, planned_end: proj.plannedEnd, actual_end: null, pm: proj.pm,
    supervisors: proj.supervisors || [], architects: proj.architects || [],
    contract_value: proj.contractValue, estimated_cost: proj.estimatedCost, status: proj.status,
  }).select().single();
  if (error) throw error;

  const projectId = projectRow.id;
  const leadSupervisorName = users.find((u) => u.id === (proj.supervisors || [])[0])?.name || null;
  const leadArchitectName = users.find((u) => u.id === (proj.architects || [])[0])?.name || null;

  // Designing (design-only) contracts have no construction phase, so no construction
  // tasks are generated — the whole project timeline is the design workflow instead.
  if (!isDesigning) {
    const taskTemplates = generatePhaseTasks(projectId, proj.startDate, proj.plannedEnd, leadSupervisorName);
    if (taskTemplates.length) {
      const { error: taskErr } = await supabase.from("tasks").insert(taskTemplates.map((t) => ({
        project_id: projectId, phase: t.phase, name: t.name, start: t.start, target: t.target,
        actual: t.actual, status: t.status, pct: t.pct, assigned_to: t.assignedTo, depends_on: null,
      })));
      if (taskErr) throw taskErr;
    }
  }

  const phaseTemplates = isDesigning
    ? generateDesignPhases(projectId, proj.plannedEnd, leadArchitectName, Math.max(1, daysBetween(proj.startDate, proj.plannedEnd)), DESIGN_PHASES_DESIGNING)
    : generateDesignPhases(projectId, proj.startDate, leadArchitectName);
  for (const dp of phaseTemplates) {
    const { data: dpRow, error: dpErr } = await supabase.from("design_phases").insert({
      project_id: projectId, phase: dp.phase, start: dp.start, target: dp.target, actual: dp.actual,
      status: dp.status, pct: dp.pct, assigned_to: dp.assignedTo, notes: dp.notes, proof: null,
    }).select().single();
    if (dpErr) throw dpErr;
    if (dp.drawings && dp.drawings.length) {
      const { error: drErr } = await supabase.from("drawings").insert(
        dp.drawings.map((d) => ({ design_phase_id: dpRow.id, name: d.name, status: d.status, proof: null }))
      );
      if (drErr) throw drErr;
    }
  }

  return projectId;
}

export async function dbUpdateProject(projectId, updates) {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.client !== undefined) payload.client = updates.client;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.contractType !== undefined) payload.contract_type = updates.contractType;
  if (updates.area !== undefined) payload.area = updates.area;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.plannedEnd !== undefined) payload.planned_end = updates.plannedEnd;
  if (updates.pm !== undefined) payload.pm = updates.pm;
  if (updates.supervisors !== undefined) payload.supervisors = updates.supervisors;
  if (updates.architects !== undefined) payload.architects = updates.architects;
  if (updates.contractValue !== undefined) payload.contract_value = updates.contractValue;
  if (updates.estimatedCost !== undefined) payload.estimated_cost = updates.estimatedCost;
  if (updates.status !== undefined) payload.status = updates.status;
  const { error } = await supabase.from("projects").update(payload).eq("id", projectId);
  if (error) throw error;
}

/* Deletes a project and, via DB cascade, everything under it: tasks, design
   phases, drawings, site reports, photos, expenses, and issues. Uploaded
   files in Storage (proofs / site-photos) are not removed by this — only
   the database records — so old attachments may remain in the bucket. */
export async function dbDeleteProject(projectId) {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

/* ---- construction tasks --------------------------------------------- */

export async function dbUpdateTask(taskId, updates) {
  const payload = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.pct !== undefined) payload.pct = updates.pct;
  if (updates.actual !== undefined) payload.actual = updates.actual;
  const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
  if (error) throw error;
}

/* ---- design phases + drawings ---------------------------------------- */

export async function dbUpdateDesignPhase(phaseId, updates) {
  const payload = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.pct !== undefined) payload.pct = updates.pct;
  if (updates.actual !== undefined) payload.actual = updates.actual;
  if (updates.assignedTo !== undefined) payload.assigned_to = updates.assignedTo;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.proof !== undefined) payload.proof = updates.proof;
  const { error } = await supabase.from("design_phases").update(payload).eq("id", phaseId);
  if (error) throw error;
}

export async function dbUpdateDrawing(drawingId, updates, updatedBy) {
  const payload = { updated_at: new Date().toISOString(), updated_by: updatedBy || null };
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.proof !== undefined) payload.proof = updates.proof;
  const { error } = await supabase.from("drawings").update(payload).eq("id", drawingId);
  if (error) throw error;
}

export async function dbAddDrawing(designPhaseId, name) {
  const { error } = await supabase.from("drawings").insert({ design_phase_id: designPhaseId, name, status: "Pending" });
  if (error) throw error;
}

export async function dbRemoveDrawing(drawingId) {
  const { error } = await supabase.from("drawings").delete().eq("id", drawingId);
  if (error) throw error;
}

/* ---- site reports + photos -------------------------------------------- */

export async function dbAddSiteReport(projectId, supervisorId, rep) {
  const { error } = await supabase.from("site_reports").insert({
    project_id: projectId, supervisor_id: supervisorId, date: rep.date, report_type: rep.reportType || "Opening",
    workers: Number(rep.workers) || 0, work_done: rep.workDone, work_in_progress: rep.workInProgress,
    work_planned: rep.workPlanned, materials_received: rep.materialsReceived, materials_needed: rep.materialsNeeded,
    issues: rep.issues, delays: rep.delays, pct_complete: Number(rep.pctComplete) || 0, remarks: rep.remarks,
  });
  if (error) throw error;
}

export async function dbAddPhoto(projectId, photo, uploadedBy) {
  // Find (or note the absence of) a same-day site report to attach this photo to,
  // mirroring the original app's "photos build into the day's report" behaviour.
  const { data: existing, error: findErr } = await supabase
    .from("site_reports").select("id").eq("project_id", projectId).eq("date", photo.date).maybeSingle();
  if (findErr) throw findErr;

  let siteReportId = existing?.id || null;
  if (!siteReportId) {
    const { data: newReport, error: insErr } = await supabase.from("site_reports").insert({
      project_id: projectId, supervisor_id: null, date: photo.date, workers: 0,
      work_done: "", work_in_progress: "", work_planned: "", materials_received: "", materials_needed: "",
      issues: "", delays: "", pct_complete: 0, remarks: "",
    }).select().single();
    if (insErr) throw insErr;
    siteReportId = newReport.id;
  }

  const { error: photoErr } = await supabase.from("photos").insert({
    project_id: projectId, site_report_id: siteReportId, url: photo.url,
    caption: photo.caption, category: photo.category, date: photo.date, uploaded_by: uploadedBy || null,
  });
  if (photoErr) throw photoErr;
}

/* ---- expenses ------------------------------------------------------- */

export async function dbAddExpense(exp) {
  const { error } = await supabase.from("expenses").insert({
    project_id: exp.projectId, submitted_by: exp.submittedBy, date: exp.date, category: exp.category,
    description: exp.description, amount: exp.amount, payment_method: exp.paymentMethod,
    vendor: exp.vendor,
    /* Empty string would fail the uuid column; a one-off shop simply has no
       vendor record to point at. */
    vendor_id: exp.vendorId || null,
    total_invoice_value: exp.totalInvoiceValue === "" || exp.totalInvoiceValue === undefined ? null : exp.totalInvoiceValue,
    advance_paid: exp.advancePaid || 0,
    proof_url: exp.proofUrl,
    invoice_no: exp.invoiceNo, notes: exp.notes || null, status: "Pending",
  });
  if (error) throw error;
}

export async function dbApproveExpense(id, approverId) {
  const { error } = await supabase.from("expenses")
    .update({ status: "Approved", approved_by: approverId, rejection_reason: null }).eq("id", id);
  if (error) throw error;
}

export async function dbRejectExpense(id, approverId, reason) {
  const { error } = await supabase.from("expenses")
    .update({ status: "Rejected", approved_by: approverId, rejection_reason: reason }).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

/* Links an expense to a vendor record after the fact — used when a shop that
   was typed by name is added to the directory. */
export async function dbUpdateExpenseVendor(expenseId, vendorId) {
  const { error } = await supabase.from("expenses").update({ vendor_id: vendorId }).eq("id", expenseId);
  if (error) throw error;
}

export async function dbMarkExpensePaid(id, paidBy, paid) {
  const { error } = await supabase.from("expenses")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null, paid_by: paid ? paidBy : null })
    .eq("id", id);
  if (error) throw error;
}

/* Assigns a sequential PO number (e.g. PO-2026-0007) the first time it's
   called for an expense, and returns the full expense row so the PDF can be
   built immediately from it. Calling again on an expense that already has a
   PO number just returns the existing one rather than issuing a new one. */
export async function dbGeneratePO(expenseId) {
  /* Done in the database rather than as a plain update: the expenses update
     policy blocks anyone touching a row they submitted, which is right for
     approvals but wrongly stopped someone raising a PO against their own
     expense. The routine applies its own checks — staff only, approved only. */
  const { data, error } = await supabase.rpc("generate_po", { p_expense_id: expenseId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return mapExpense(row);
}

/* ---- vendors ------------------------------------------------------------ */

/* Returns the created vendor: an expense saved in the same step needs the new
   id to link against, and there's nothing to link to otherwise. */
export async function dbAddVendor(v) {
  const { data, error } = await supabase.from("vendors").insert({
    name: v.name, material: v.material, gst_number: v.gstNumber, address: v.address,
    phone: v.phone, email: v.email,
    bank_account_name: v.bankAccountName, bank_account_number: v.bankAccountNumber,
    bank_ifsc: v.bankIfsc, bank_name: v.bankName,
  }).select().single();
  if (error) throw error;
  return mapVendor(data);
}

export async function dbUpdateVendor(id, v) {
  const { error } = await supabase.from("vendors").update({
    name: v.name, material: v.material, gst_number: v.gstNumber, address: v.address,
    phone: v.phone, email: v.email,
    bank_account_name: v.bankAccountName, bank_account_number: v.bankAccountNumber,
    bank_ifsc: v.bankIfsc, bank_name: v.bankName,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteVendor(id) {
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) throw error;
}

/* ---- quotations --------------------------------------------------------- */

/* Quotation numbers run on a Postgres sequence (like PO numbers) rather than
   counting existing rows, so two people creating a quotation at the same
   moment can never land on the same number. Format: DIA/QT/2026-27/0007,
   where the year part is the Indian financial year the quotation falls in. */
function financialYearLabel(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // FY starts 1 April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export async function nextQuotationNumber(dateStr, docType) {
  const { data: seq, error } = await supabase.rpc("nextval_quotation_number");
  if (error) throw error;
  // Design proposals and itemised work quotes share one sequence but carry
  // different prefixes, so a number is never ambiguous on a client's desk.
  const prefix = docType === "itemised" ? "DIA/QTN" : docType === "boq" ? "DIA/BOQ" : "DIA/QT";
  return `${prefix}/${financialYearLabel(dateStr)}/${String(seq).padStart(4, "0")}`;
}

const quotationPayload = (q) => ({
  project_id: q.projectId || null,
  client_name: q.clientName,
  client_address: q.clientAddress,
  project_title: q.projectTitle,
  location: q.location,
  city: q.city,
  date: q.date,
  subject: q.subject,
  service_line: q.serviceLine,
  area: Number(q.area) || 0,
  floors: q.floors,
  fee_mode: q.feeMode,
  fee_lines: q.feeLines || [],
  rate_per_sqft: Number(q.ratePerSqft) || 0,
  total_fee: Number(q.totalFee) || 0,
  gst_note: q.gstNote,
  intro_paras: q.introParas || [],
  scope_stages: q.scopeStages || [],
  payment_stages: q.paymentStages || [],
  milestone_notes: q.milestoneNotes || [],
  revision_policy: q.revisionPolicy || [],
  closing_paras: q.closingParas || [],
  payment_terms: q.paymentTerms || [],
  signatory_name: q.signatoryName,
  signatory_title: q.signatoryTitle,
  signature_url: q.signatureUrl || null,
  bank: q.bank || {},
  doc_type: q.docType || "proposal",
  mobile: q.mobile,
  salutation: q.salutation,
  line_items: q.lineItems || [],
  discount: q.docType === "boq" ? Number(q.concession) || 0 : Number(q.discount) || 0,
  concession_label: q.concessionLabel || null,
  page_options: q.pageOptions || {},
  gst_rate: Number(q.gstRate) || 0,
  work_terms: q.workTerms || [],
  material_specs: q.materialSpecs || [],
  boq_sections: q.boqSections || [],
  exclusions: q.exclusions || [],
  extra_charge_label: q.extraChargeLabel,
  extra_charge_pct: Number(q.extraChargePct) || 0,
  show_payment_terms: q.showPaymentTerms !== false,
  status: q.status || "Draft",
  notes: q.notes,
});

export async function dbAddQuotation(q, createdBy) {
  const quotationNo = q.quotationNo || (await nextQuotationNumber(q.date, q.docType));
  const { data, error } = await supabase.from("quotations")
    .insert({ ...quotationPayload(q), quotation_no: quotationNo, created_by: createdBy })
    .select().single();
  if (error) throw error;
  return mapQuotation(data);
}

export async function dbUpdateQuotation(id, q) {
  const { data, error } = await supabase.from("quotations")
    .update(quotationPayload(q)).eq("id", id).select().single();
  if (error) throw error;
  return mapQuotation(data);
}

export async function dbUpdateQuotationStatus(id, status) {
  const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteQuotation(id) {
  const { error } = await supabase.from("quotations").delete().eq("id", id);
  if (error) throw error;
}

/* Creates a fresh quotation (new number, Draft status) from an existing one —
   the usual way a revised price goes out to the same client. */
export async function dbDuplicateQuotation(source, createdBy) {
  return dbAddQuotation({ ...source, quotationNo: "", status: "Draft" }, createdBy);
}

/* Admin correcting an expense entered wrongly. Status and approval are left
   alone — this fixes the facts of the bill, not the decision on it. */
export async function dbEditExpense(id, patch) {
  const payload = {};
  if (patch.date !== undefined) payload.date = patch.date;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.amount !== undefined) payload.amount = Number(patch.amount) || 0;
  if (patch.paymentMethod !== undefined) payload.payment_method = patch.paymentMethod;
  if (patch.vendor !== undefined) payload.vendor = patch.vendor;
  if (patch.vendorId !== undefined) payload.vendor_id = patch.vendorId || null;
  if (patch.invoiceNo !== undefined) payload.invoice_no = patch.invoiceNo || null;
  if (patch.notes !== undefined) payload.notes = patch.notes || null;
  if (patch.totalInvoiceValue !== undefined) {
    payload.total_invoice_value = patch.totalInvoiceValue === "" || patch.totalInvoiceValue === null
      ? null : Number(patch.totalInvoiceValue);
  }
  if (patch.advancePaid !== undefined) payload.advance_paid = Number(patch.advancePaid) || 0;
  const { error } = await supabase.from("expenses").update(payload).eq("id", id);
  if (error) throw error;
}

/* Turns a shop typed on expenses into a proper vendor, and links every
   expense that carried that name — so the history follows the vendor rather
   than being stranded on the old text. */
export async function dbRegisterVendorFromName(name, details = {}) {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("A vendor name is required.");

  const { data: existing } = await supabase.from("vendors").select("*").ilike("name", trimmed).maybeSingle();
  const vendor = existing ? mapVendor(existing) : await dbAddVendor({ name: trimmed, ...details });

  const { error } = await supabase.from("expenses")
    .update({ vendor_id: vendor.id }).is("vendor_id", null).ilike("vendor", trimmed);
  if (error) throw error;
  return vendor;
}

/* ---- leave and permissions ----------------------------------------------- */

export async function dbAddLeaveRequest(req, userId) {
  const { error } = await supabase.from("leave_requests").insert({
    user_id: userId, kind: req.kind, from_date: req.fromDate, to_date: req.toDate,
    time_note: req.timeNote || null, reason: req.reason, days: req.days,
  });
  if (error) throw error;
}

export async function dbDecideLeaveRequest(id, deciderId, status, note) {
  const { error } = await supabase.from("leave_requests").update({
    status, decided_by: deciderId, decided_at: new Date().toISOString(),
    decision_note: note || null,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteLeaveRequest(id) {
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw error;
}

/* ---- client scope --------------------------------------------------------- */

export async function dbAddClientScopeItem(item, createdBy) {
  const { error } = await supabase.from("client_scope_items").insert({
    project_id: item.projectId, title: item.title.trim(), details: item.details || null,
    category: item.category || "Vendor", due_date: item.dueDate || null,
    notes: item.notes || null, sort_order: item.sortOrder || 0, created_by: createdBy,
  });
  if (error) throw error;
}

export async function dbUpdateClientScopeItem(id, patch) {
  const payload = {};
  ["title", "details", "category", "notes"].forEach((k) => { if (patch[k] !== undefined) payload[k] = patch[k]; });
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate || null;
  if (patch.status !== undefined) {
    payload.status = patch.status;
    payload.done_on = patch.status === "Done" ? new Date().toISOString().slice(0, 10) : null;
  }
  const { error } = await supabase.from("client_scope_items").update(payload).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteClientScopeItem(id) {
  const { error } = await supabase.from("client_scope_items").delete().eq("id", id);
  if (error) throw error;
}

/* Stamps the items a reminder went out for, so "last chased on" is a fact
   rather than a memory. */
export async function dbMarkClientScopeReminded(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from("client_scope_items")
    .update({ last_reminded_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}

/* ---- attendance ---------------------------------------------------------- */

const todayISO = () => {
  /* The device's own date, not UTC — a 9pm check-in in India must not land on
     tomorrow's board. */
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export async function dbCheckIn(userId, { photoUrl, note, location, lat, lng }) {
  const { error } = await supabase.from("attendance").insert({
    user_id: userId, date: todayISO(),
    check_in_photo_url: photoUrl, check_in_note: note,
    location: location || null, lat: lat ?? null, lng: lng ?? null,
  });
  if (error) throw error;
}

export async function dbCheckOut(attendanceId, note) {
  const { error } = await supabase.from("attendance")
    .update({ check_out_at: new Date().toISOString(), check_out_note: note })
    .eq("id", attendanceId);
  if (error) throw error;
}

export const attendanceToday = todayISO;

/* ---- office petty expenses ----------------------------------------------- */

export async function dbAddOfficeExpense(exp, submittedBy) {
  const { error } = await supabase.from("office_expenses").insert({
    office: exp.office, category: exp.category, purpose: exp.purpose,
    amount: Number(exp.amount) || 0, payment_method: exp.paymentMethod,
    date: exp.date, proof_url: exp.proofUrl || null, notes: exp.notes || null,
    submitted_by: submittedBy,
  });
  if (error) throw error;
}

export async function dbApproveOfficeExpense(id, approverId) {
  const { error } = await supabase.from("office_expenses").update({
    status: "Approved", approved_by: approverId, approved_at: new Date().toISOString(),
    rejection_reason: null,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbRejectOfficeExpense(id, approverId, reason) {
  const { error } = await supabase.from("office_expenses").update({
    status: "Rejected", approved_by: approverId, approved_at: new Date().toISOString(),
    rejection_reason: reason || null,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbMarkOfficeExpensePaid(id, paidBy, paid) {
  const { error } = await supabase.from("office_expenses").update({
    paid, paid_at: paid ? new Date().toISOString() : null, paid_by: paid ? paidBy : null,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteOfficeExpense(id) {
  const { error } = await supabase.from("office_expenses").delete().eq("id", id);
  if (error) throw error;
}

/* ---- work tracker -------------------------------------------------------- */

export async function dbAddWorkTask(task, createdBy) {
  const { error } = await supabase.from("work_tasks").insert({
    project: (task.project || "General").trim() || "General",
    title: task.title.trim(),
    priority: task.priority || (task.urgent ? "High" : "Medium"),
    urgent: (task.priority || (task.urgent ? "High" : "Medium")) === "High",
    assignee_id: task.assigneeId || null,
    note: task.note || null,
    created_by: createdBy,
  });
  if (error) throw error;
}

/* Marking a task done stamps the date; reopening clears it, so a "done on"
   line can never outlive the status it describes. */
export async function dbUpdateWorkTask(id, patch) {
  const payload = {};
  if (patch.project !== undefined) payload.project = (patch.project || "General").trim() || "General";
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.priority !== undefined) { payload.priority = patch.priority; payload.urgent = patch.priority === "High"; }
  if (patch.urgent !== undefined && patch.priority === undefined) { payload.urgent = patch.urgent; payload.priority = patch.urgent ? "High" : "Medium"; }
  if (patch.note !== undefined) payload.note = patch.note;
  if (patch.assigneeId !== undefined) payload.assignee_id = patch.assigneeId || null;
  if (patch.status !== undefined) {
    payload.status = patch.status;
    payload.done_on = patch.status === "Done" ? new Date().toISOString().slice(0, 10) : null;
  }
  const { error } = await supabase.from("work_tasks").update(payload).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteWorkTask(id) {
  const { error } = await supabase.from("work_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function dbClearDoneWorkTasks() {
  const { error } = await supabase.from("work_tasks").delete().eq("status", "Done");
  if (error) throw error;
}

/* Accepts either [project, title] pairs (the starter list) or full objects
   with an urgent flag (the WhatsApp import). */
export async function dbAddWorkTasksBulk(rows, createdBy) {
  const { error } = await supabase.from("work_tasks").insert(
    rows.map((r) => Array.isArray(r)
      ? { project: r[0], title: r[1], created_by: createdBy }
      : { project: (r.project || "General").trim() || "General", title: r.title.trim(),
          priority: r.priority || (r.urgent ? "High" : "Medium"),
          urgent: (r.priority || (r.urgent ? "High" : "Medium")) === "High", created_by: createdBy })
  );
  if (error) throw error;
}

/* ---- project schedules --------------------------------------------------- */

const schedulePayload = (s) => ({
  project_id: s.projectId || null,
  quotation_id: s.quotationId || null,
  client_name: s.clientName,
  project_title: s.projectTitle,
  location: s.location,
  title: s.title || "Site Work Schedule",
  subject: s.subject,
  date: s.date,
  project_start: s.projectStart || null,
  handover: s.handover,
  intro: s.intro || [],
  closing: s.closing || [],
  welcome_heading: s.welcomeHeading,
  welcome_paras: s.welcomeParas || [],
  next_steps: s.nextSteps || [],
  include_welcome: s.includeWelcome !== false,
  include_gantt: s.includeGantt !== false,
  tasks: s.tasks || [],
  signatory_name: s.signatoryName,
  signatory_title: s.signatoryTitle,
  signature_url: s.signatureUrl || null,
  status: s.status || "Draft",
  notes: s.notes,
});

export async function dbAddSchedule(s, createdBy) {
  const { data, error } = await supabase.from("schedules")
    .insert({ ...schedulePayload(s), created_by: createdBy }).select().single();
  if (error) throw error;
  return mapSchedule(data);
}

export async function dbUpdateSchedule(id, s) {
  const { error } = await supabase.from("schedules").update(schedulePayload(s)).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteSchedule(id) {
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  if (error) throw error;
}

/* ---- project feed -------------------------------------------------------- */

export async function dbAddFeedPost(post, authorId) {
  const { data, error } = await supabase.from("feed_posts").insert({
    project_id: post.projectId || null,
    author_id: authorId,
    kind: post.kind || "update",
    severity: post.severity || "info",
    body: post.body,
  }).select().single();
  if (error) throw error;
  return mapFeedPost(data);
}

export async function dbUpdateFeedPost(id, patch) {
  const { error } = await supabase.from("feed_posts").update(patch).eq("id", id);
  if (error) throw error;
}

/* Anyone can clear a follow-up or approval — the person who closes it is
   usually not the person who raised it. */
export async function dbResolveFeedPost(id, resolverId, resolved) {
  const { error } = await supabase.from("feed_posts").update({
    status: resolved ? "resolved" : "open",
    resolved_by: resolved ? resolverId : null,
    resolved_at: resolved ? new Date().toISOString() : null,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteFeedPost(id) {
  const { error } = await supabase.from("feed_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function dbAddFeedComment(postId, body, authorId) {
  const { data, error } = await supabase.from("feed_comments")
    .insert({ post_id: postId, author_id: authorId, body }).select().single();
  if (error) throw error;
  return mapFeedComment(data);
}

export async function dbDeleteFeedComment(id) {
  const { error } = await supabase.from("feed_comments").delete().eq("id", id);
  if (error) throw error;
}

/* ---- BOQ item library --------------------------------------------------- */

/* Standard line items reused across projects. Saving from a BOQ row means the
   long specification text is typed once and picked thereafter. */
export async function dbAddBoqLibraryItem(item, createdBy) {
  const { data, error } = await supabase.from("boq_library").insert({
    particulars: item.particulars, description: item.description || "",
    unit: item.unit || "Sq.ft.", rate: Number(item.rate) || 0,
    category: item.category || null, created_by: createdBy,
  }).select().single();
  if (error) throw error;
  return mapBoqLibraryItem(data);
}

export async function dbUpdateBoqLibraryItem(id, item) {
  const { error } = await supabase.from("boq_library").update({
    particulars: item.particulars, description: item.description || "",
    unit: item.unit || "Sq.ft.", rate: Number(item.rate) || 0,
    category: item.category || null,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteBoqLibraryItem(id) {
  const { error } = await supabase.from("boq_library").delete().eq("id", id);
  if (error) throw error;
}

/* Bumps the usage counter so the most-used items float to the top of the
   picker. Deliberately fire-and-forget: a failed counter update must never
   interrupt someone building a BOQ. */
export async function dbTouchBoqLibraryItem(id, timesUsed) {
  try {
    await supabase.from("boq_library").update({ times_used: (timesUsed || 0) + 1 }).eq("id", id);
  } catch { /* counter is a nicety, not data */ }
}

/* ---- issues ------------------------------------------------------------ */

export async function dbAddIssue(projectId, supervisorId, issue) {
  const { error } = await supabase.from("issues").insert({
    project_id: projectId, supervisor_id: supervisorId, date: new Date().toISOString().slice(0, 10),
    description: issue.description, severity: issue.severity, status: "Open",
  });
  if (error) throw error;
}

/* ---- material requests -------------------------------------------------- */

/* requestedByRole/isAdmin lets an Admin-created request be auto-approved
   immediately, per the "admin can also post it directly, already approved"
   workflow. Architect-created requests always start Pending for admin review. */
export async function dbAddMaterialRequest(projectId, requestedBy, req, autoApprove) {
  const payload = {
    project_id: projectId, requested_by: requestedBy, items: req.items,
    quantity: req.quantity || null, needed_by: req.neededBy || null, notes: req.notes || null,
    status: autoApprove ? "Approved" : "Pending",
  };
  if (autoApprove) {
    payload.approved_by = requestedBy;
    payload.approved_at = new Date().toISOString();
  }
  const { error } = await supabase.from("material_requests").insert(payload);
  if (error) throw error;
}

export async function dbApproveMaterialRequest(id, approverId) {
  const { error } = await supabase.from("material_requests")
    .update({ status: "Approved", approved_by: approverId, approved_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", id);
  if (error) throw error;
}

export async function dbRejectMaterialRequest(id, approverId, reason) {
  const { error } = await supabase.from("material_requests")
    .update({ status: "Rejected", approved_by: approverId, approved_at: new Date().toISOString(), rejection_reason: reason })
    .eq("id", id);
  if (error) throw error;
}

export async function dbDeleteMaterialRequest(id) {
  const { error } = await supabase.from("material_requests").delete().eq("id", id);
  if (error) throw error;
}

/* Supervisor confirms materials arrived: records the actual vendor, amount
   paid, and a required delivery/receipt photo. Moves to "Received" — still
   needs Admin to confirm before it becomes a real expense. */
export async function dbMarkMaterialReceived(id, receivedBy, { vendorId, amount, receiptPhotoUrl }) {
  /* Through the database routine: the plain update policy is staff-only, but
     the supervisor assigned to the site is the person who actually receives
     the delivery. */
  const { error } = await supabase.rpc("mark_material_received", {
    p_request_id: id,
    p_vendor_id: vendorId || null,
    p_amount: amount ?? null,
    p_receipt_photo_url: receiptPhotoUrl || null,
  });
  if (error) throw error;
}

/* Admin confirms a received material request: creates a real expense that's
   already Approved (skipping the normal pending-review step, since Admin is
   the one confirming it right here), linked back to this request, and ready
   for "Generate PO" immediately. */
export async function dbFulfillMaterialRequest(id, fulfilledBy) {
  const { data: req, error: reqErr } = await supabase.from("material_requests").select("*").eq("id", id).single();
  if (reqErr) throw reqErr;
  if (req.status !== "Received") throw new Error("This request hasn't been marked received yet.");
  if (req.expense_id) return req.expense_id; // already fulfilled — don't double-create

  let vendorName = "";
  if (req.vendor_id) {
    const { data: v } = await supabase.from("vendors").select("name").eq("id", req.vendor_id).maybeSingle();
    vendorName = v?.name || "";
  }

  // Assign a PO number immediately, so "Generate PO" is a single click from here.
  const { data: seqRow, error: seqErr } = await supabase.rpc("nextval_po_number");
  if (seqErr) throw seqErr;
  const poNumber = `PO-${new Date().getFullYear()}-${String(seqRow).padStart(4, "0")}`;

  const { data: expenseRow, error: expErr } = await supabase.from("expenses").insert({
    project_id: req.project_id, submitted_by: req.received_by || fulfilledBy, date: new Date().toISOString().slice(0, 10),
    category: "Materials", description: req.items, amount: req.amount || 0,
    payment_method: null, vendor: vendorName, vendor_id: req.vendor_id,
    proof_url: req.receipt_photo_url, status: "Approved", approved_by: fulfilledBy,
    po_number: poNumber, po_generated_at: new Date().toISOString(), po_generated_by: fulfilledBy,
    notes: `Auto-generated from material request confirmed received on ${req.received_at ? req.received_at.slice(0, 10) : ""}.`,
  }).select().single();
  if (expErr) throw expErr;

  const { error: updateErr } = await supabase.from("material_requests").update({
    status: "Fulfilled", fulfilled_by: fulfilledBy, fulfilled_at: new Date().toISOString(), expense_id: expenseRow.id,
  }).eq("id", id);
  if (updateErr) throw updateErr;

  return expenseRow.id;
}

/* ---- site visits (architect entry/exit log) ----------------------------- */

export async function dbStartSiteVisit(projectId, architectId, entryPhotoUrl) {
  const { error } = await supabase.from("site_visits").insert({
    project_id: projectId, architect_id: architectId, entry_time: new Date().toISOString(),
    entry_photo_url: entryPhotoUrl, status: "Open",
  });
  if (error) throw error;
}

export async function dbEndSiteVisit(visitId, { exitPhotoUrl, momNotes, momAttachmentUrl }) {
  const { error } = await supabase.from("site_visits").update({
    exit_time: new Date().toISOString(), exit_photo_url: exitPhotoUrl,
    mom_notes: momNotes || null, mom_attachment_url: momAttachmentUrl || null,
    status: "Closed",
  }).eq("id", visitId);
  if (error) throw error;
}

/* ---- file uploads (proof-of-work photos/PDFs, site diary photos) ------ */

export async function uploadFile(bucket, file, pathPrefix) {
  const ext = file.name.split(".").pop();
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export const uploadProofFile = (file, pathPrefix) => uploadFile(PROOF_BUCKET, file, pathPrefix);
export const uploadSitePhoto = (file, pathPrefix) => uploadFile(SITE_PHOTOS_BUCKET, file, pathPrefix);
export const uploadSignature = (file) => uploadFile(PROOF_BUCKET, file, "signatures");
export const uploadAttendancePhoto = (file) => uploadFile(PROOF_BUCKET, file, "attendance");
