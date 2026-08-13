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
});

const mapVendor = (r) => ({
  id: r.id, name: r.name, material: r.material, gstNumber: r.gst_number, address: r.address,
  bankAccountName: r.bank_account_name, bankAccountNumber: r.bank_account_number,
  bankIfsc: r.bank_ifsc, bankName: r.bank_name, createdAt: r.created_at,
});

const mapIssue = (r) => ({
  id: r.id, projectId: r.project_id, supervisorId: r.supervisor_id, date: r.date,
  description: r.description, severity: r.severity, status: r.status, submittedAt: r.submitted_at,
});

const mapMaterialRequest = (r) => ({
  id: r.id, projectId: r.project_id, requestedBy: r.requested_by, items: r.items,
  quantity: r.quantity, neededBy: r.needed_by, notes: r.notes, status: r.status,
  approvedBy: r.approved_by, approvedAt: r.approved_at, rejectionReason: r.rejection_reason,
  createdAt: r.created_at,
});

/* ---- fetch everything ------------------------------------------------ */

export async function fetchAllData() {
  const [profiles, projects, tasks, designPhasesRaw, drawingsRaw, siteReportsRaw, photosRaw, expensesRaw, issuesRaw, vendorsRaw, materialRequestsRaw, siteVisitsRaw] =
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
    ]);

  const results = { profiles, projects, tasks, designPhasesRaw, drawingsRaw, siteReportsRaw, photosRaw, expensesRaw, issuesRaw, vendorsRaw, materialRequestsRaw, siteVisitsRaw };
  for (const [key, res] of Object.entries(results)) {
    if (res.error) throw new Error(`Failed to load ${key}: ${res.error.message}`);
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
    vendor: exp.vendor, vendor_id: exp.vendorId,
    total_invoice_value: exp.totalInvoiceValue === "" || exp.totalInvoiceValue === undefined ? null : exp.totalInvoiceValue,
    advance_paid: exp.advancePaid || 0,
    proof_url: exp.proofUrl,
    invoice_no: exp.invoiceNo, status: "Pending",
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

export async function dbMarkExpensePaid(id, paidBy, paid) {
  const { error } = await supabase.from("expenses")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null, paid_by: paid ? paidBy : null })
    .eq("id", id);
  if (error) throw error;
}

/* ---- vendors ------------------------------------------------------------ */

export async function dbAddVendor(v) {
  const { error } = await supabase.from("vendors").insert({
    name: v.name, material: v.material, gst_number: v.gstNumber, address: v.address,
    bank_account_name: v.bankAccountName, bank_account_number: v.bankAccountNumber,
    bank_ifsc: v.bankIfsc, bank_name: v.bankName,
  });
  if (error) throw error;
}

export async function dbUpdateVendor(id, v) {
  const { error } = await supabase.from("vendors").update({
    name: v.name, material: v.material, gst_number: v.gstNumber, address: v.address,
    bank_account_name: v.bankAccountName, bank_account_number: v.bankAccountNumber,
    bank_ifsc: v.bankIfsc, bank_name: v.bankName,
  }).eq("id", id);
  if (error) throw error;
}

export async function dbDeleteVendor(id) {
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) throw error;
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
