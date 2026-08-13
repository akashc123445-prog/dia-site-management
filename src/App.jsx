import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from "recharts";
import {
  LayoutDashboard, Building2, Receipt, Users, Bell, LogOut, Plus, Check, X,
  Camera, ClipboardList, AlertTriangle, Calendar, MapPin, ChevronRight,
  ChevronLeft, Download, Search, ArrowLeft, Image as ImageIcon, IndianRupee,
  TrendingUp, Clock, CheckCircle2, XCircle, Filter, FileSpreadsheet, Eye, EyeOff, Pencil,
  PenTool, ListChecks, Paperclip, FileText, AlertCircle, Trash2
} from "lucide-react";

import { supabase } from "./lib/supabaseClient";
import {
  PHASE_TEMPLATE, EXPENSE_CATEGORIES, PAYMENT_METHODS, PROJECT_STATUSES, PROJECT_TYPES,
  ARCHITECT_RANKS, DESIGN_PHASES, DRAWING_STATUSES,
  TODAY, DIA, FONT_STYLE, LOGO_MARK, LOGO_FULL,
} from "./lib/constants";
import {
  fmtINR, fmtDate, fmtTime, daysBetween, clamp,
  isTaskDelayed, computeProjectSpend, computeProjectProgress, computeDesignProgress,
  hasProof, effectivePhase, effectiveDrawing,
  computeHealth, HEALTH_META, exportToExcel,
} from "./lib/helpers";
import {
  fetchAllData, dbUpdateProfile, dbRemoveUser, dbAddProject, dbUpdateProject, dbUpdateTask,
  dbUpdateDesignPhase, dbUpdateDrawing, dbAddDrawing, dbRemoveDrawing,
  dbAddSiteReport, dbAddPhoto, dbAddExpense, dbApproveExpense, dbRejectExpense, dbDeleteExpense, dbAddIssue,
  uploadProofFile, uploadSitePhoto,
} from "./lib/dataStore";

/* ---------------------------------------------------------------------- */
/* Small UI primitives                                                      */
/* ---------------------------------------------------------------------- */

function ProgressBar({ pct, colorClass = "dia-bg-gold" }) {
  return (
    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
      <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
    </div>
  );
}

function HealthBadge({ health }) {
  const m = HEALTH_META[health];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.bg} ${m.text} border ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Rejected: "bg-rose-50 text-rose-700 border-rose-200",
    "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
    "Not Started": "bg-stone-100 text-stone-600 border-stone-200",
    Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Delayed: "bg-rose-50 text-rose-700 border-rose-200",
    "On Hold": "bg-stone-100 text-stone-600 border-stone-200",
    Closed: "bg-stone-100 text-stone-600 border-stone-200",
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Deactivated: "bg-rose-50 text-rose-700 border-rose-200",
    "Pending approval": "bg-amber-50 text-amber-700 border-amber-200",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[status] || "bg-stone-100 text-stone-600 border-stone-200"}`}>{status}</span>;
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-xl border border-stone-200 shadow-sm ${className}`}>{children}</div>;
}

function AccessDenied({ message = "You don't have access to this page." }) {
  return (
    <div className="p-10 text-center">
      <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
        <AlertTriangle size={20} />
      </div>
      <p className="text-sm text-stone-500">{message}</p>
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-stone-500 font-semibold font-body">{label}</div>
          <div className="text-2xl font-display font-semibold text-stone-900 mt-1">{value}</div>
          {sub && <div className="text-xs text-stone-500 mt-1 font-body">{sub}</div>}
        </div>
        {Icon && <div className="p-2 rounded-lg dia-bg-cream-soft"><Icon size={18} className="dia-text-bronze" /></div>}
      </div>
    </Card>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className={`bg-white w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl`}>
        <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-display text-lg font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-xs font-semibold text-stone-600 mb-1.5 font-body">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "dia-input w-full rounded-lg px-3 py-2 text-sm font-body bg-white";

/* ---------------------------------------------------------------------- */
/* Login                                                                    */
/* ---------------------------------------------------------------------- */

function LoginScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setError(""); setInfo(""); setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message === "Invalid login credentials"
        ? "Incorrect email or password." : signInError.message);
    }
    // On success, the onAuthStateChange listener in App() takes over.
  };

  const handleSignUp = async () => {
    setError(""); setInfo(""); setBusy(true);
    if (!name.trim()) { setBusy(false); setError("Enter your full name."); return; }
    if (password.length < 6) { setBusy(false); setError("Password must be at least 6 characters."); return; }
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { name: name.trim() } },
    });
    setBusy(false);
    if (signUpError) { setError(signUpError.message); return; }
    setInfo("Account created. An administrator needs to activate your account and assign your role before you can sign in.");
    setMode("signin");
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    mode === "signin" ? handleSignIn() : handleSignUp();
  };

  return (
    <div className="min-h-screen dia-bg-maroon-deep flex items-center justify-center p-4 font-body relative overflow-hidden">
      <div className="absolute inset-0" style={{
        background: `radial-gradient(circle at 50% 15%, ${DIA.maroonLine} 0%, transparent 55%)`
      }} />
      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center mb-8">
          <img src={LOGO_FULL} alt="Dia Retail Solutions" className="h-40 object-contain" />
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h1 className="font-display text-2xl font-semibold text-stone-900 mb-1">
            {mode === "signin" ? "Sign in to your workspace" : "Create your account"}
          </h1>
          <p className="text-sm text-stone-500 mb-3 font-label uppercase tracking-wide">Architecture · Interior Design · Retail Solutions</p>
          <div className="dia-divider mb-5"><span className="dia-diamond" /></div>

          <div>
            {mode === "signup" && (
              <Field label="Full name">
                <input autoFocus className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Neha Kapoor" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" autoFocus={mode === "signin"} className={inputCls} value={email}
                onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="you@diaretailsolutions.com" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={showPassword ? "text" : "password"} className={inputCls + " pr-10"} value={password}
                  onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            {error && <p className="text-xs text-rose-600 mb-3 -mt-2">{error}</p>}
            {info && <p className="text-xs text-emerald-700 mb-3 -mt-2">{info}</p>}
            <button type="button" disabled={busy || !email || !password} onClick={mode === "signin" ? handleSignIn : handleSignUp}
              className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </div>

          <button onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}
            className="w-full text-center text-xs dia-text-bronze font-semibold mt-4 hover:underline">
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
        <p className="text-center text-stone-500 text-xs mt-5">New accounts are reviewed and activated by an admin before first sign-in.</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* App Shell (Sidebar + Header)                                             */
/* ---------------------------------------------------------------------- */

function Sidebar({ user, view, setView, onLogout, pendingCount }) {
  const adminNav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "projects", label: "Projects", icon: Building2 },
    { key: "expenses", label: "Expenses", icon: Receipt, badge: pendingCount },
    { key: "users", label: "Team", icon: Users },
  ];
  const accountsNav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "projects", label: "Projects", icon: Building2 },
    { key: "expenses", label: "Expenses", icon: Receipt, badge: pendingCount },
  ];
  const supNav = [
    { key: "sup-home", label: "My Sites", icon: LayoutDashboard },
  ];
  const archNav = [
    { key: "arch-home", label: "My Design Work", icon: PenTool },
  ];
  const nav = user.role === "Admin" ? adminNav : user.role === "Accounts" ? accountsNav : user.role === "Architect" ? archNav : supNav;

  return (
    <div className="w-60 dia-bg-maroon-deep h-screen flex flex-col shrink-0 sticky top-0">
      <div className="px-5 py-5 flex items-center border-b dia-border-maroon-line">
        <img src={LOGO_MARK} alt="Dia Retail Solutions" className="h-11 object-contain" />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(item => {
          const Icon = item.icon;
          const active = view.tab === item.key;
          return (
            <button key={item.key} onClick={() => setView({ tab: item.key })}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors font-body ${active ? "dia-btn-gold" : "dia-text-cream-70 dia-hover-maroon hover:text-white"}`}>
              <span className="flex items-center gap-2.5"><Icon size={16} /> {item.label}</span>
              {!!item.badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${active ? "bg-white dia-text-bronze" : "dia-btn-gold"}`}>{item.badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t dia-border-maroon-line">
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-stone-700 text-white flex items-center justify-center text-xs font-semibold font-display shrink-0">
            {user.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-white font-medium truncate">{user.name}</div>
            <div className="text-xs text-stone-400 truncate">{user.role === "Supervisor" ? "Site Supervisor" : user.role === "Architect" ? user.rank : user.role}</div>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm dia-text-cream-50 dia-hover-maroon hover:text-white transition-colors font-body">
          <LogOut size={15} /> Switch user
        </button>
      </div>
    </div>
  );
}

function Header({ title, subtitle, notifications }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-stone-200 bg-white/70 backdrop-blur sticky top-0 z-20">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-semibold text-stone-900">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500 mt-0.5 flex items-center gap-2"><span className="dia-diamond" style={{ width: 4, height: 4 }} />{subtitle}</p>}
      </div>
      <div className="relative">
        <button onClick={() => setOpen(o => !o)} className="p-2 rounded-lg hover:bg-stone-100 relative">
          <Bell size={19} className="text-stone-600" />
          {notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-600 rounded-full" />}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-xl shadow-xl z-30 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-stone-100 font-semibold text-sm text-stone-800">Notifications</div>
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-stone-400">You're all caught up.</div>
            ) : notifications.map((n, i) => (
              <div key={i} className="px-4 py-3 border-b border-stone-50 last:border-0">
                <div className="text-sm text-stone-800">{n.text}</div>
                <div className="text-xs text-stone-400 mt-0.5">{n.meta}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Admin / Accounts Dashboard                                               */
/* ---------------------------------------------------------------------- */

function AdminDashboard({ data, setView }) {
  const { projects, tasks, expenses, siteReports, issues, users } = data;

  const kpis = useMemo(() => {
    const active = projects.filter(p => !["Completed", "Closed"].includes(p.status));
    const completed = projects.filter(p => ["Completed", "Closed"].includes(p.status));
    const delayed = projects.filter(p => computeHealth(p, tasks, expenses) === "red");
    const nearing = projects.filter(p => {
      const d = daysBetween(TODAY, p.plannedEnd);
      return d >= 0 && d <= 14 && !["Completed", "Closed"].includes(p.status);
    });
    const totalContract = projects.reduce((s, p) => s + p.contractValue, 0);
    const totalEstimated = projects.reduce((s, p) => s + p.estimatedCost, 0);
    const totalActual = projects.reduce((s, p) => s + computeProjectSpend(expenses, p.id).approved, 0);
    const totalOutstanding = projects.reduce((s, p) => s + computeProjectSpend(expenses, p.id).pending, 0);
    const projectedProfit = totalContract - totalEstimated;
    const currentProfit = totalContract - totalActual;
    return { active, completed, delayed, nearing, totalContract, totalEstimated, totalActual, totalOutstanding, projectedProfit, currentProfit };
  }, [projects, tasks, expenses]);

  const pendingExpenses = expenses.filter(e => e.status === "Pending").sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentReports = [...siteReports].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const recentExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const openIssues = issues.filter(i => i.status === "Open");

  const userName = (id) => users.find(u => u.id === id)?.name || id;
  const projectName = (id) => projects.find(p => p.id === id)?.name || id;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Active Projects" value={kpis.active.length} sub={`${kpis.completed.length} completed`} icon={Building2} />
        <KPI label="Total Contract Value" value={fmtINR(kpis.totalContract)} icon={IndianRupee} />
        <KPI label="Projected Profit" value={fmtINR(kpis.projectedProfit)} sub="Contract − Estimated" icon={TrendingUp} />
        <KPI label="Current Profit" value={fmtINR(kpis.currentProfit)} sub="Contract − Actual spend" icon={TrendingUp} />
        <KPI label="Total Estimated Cost" value={fmtINR(kpis.totalEstimated)} icon={ClipboardList} />
        <KPI label="Actual Expenditure" value={fmtINR(kpis.totalActual)} sub="Approved expenses" icon={Receipt} />
        <KPI label="Pending Approvals" value={fmtINR(kpis.totalOutstanding)} sub={`${pendingExpenses.length} expense(s)`} icon={Clock} />
        <KPI label="Sites Needing Attention" value={kpis.delayed.length} sub={`${openIssues.length} open issue(s)`} icon={AlertTriangle} />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-stone-900">Project Health Overview</h2>
          <button onClick={() => setView({ tab: "projects" })} className="text-xs font-semibold dia-text-bronze dia-hover-bronze-dark">View all →</button>
        </div>
        <div className="space-y-3">
          {projects.map(p => {
            const health = computeHealth(p, tasks, expenses);
            const progress = computeProjectProgress(tasks, p.id, siteReports);
            const spend = computeProjectSpend(expenses, p.id);
            return (
              <button key={p.id} onClick={() => setView({ tab: "project", projectId: p.id, sub: "overview" })}
                className="w-full text-left flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6 p-3.5 rounded-xl border border-stone-100 hover:dia-border-gold-soft hover:dia-bg-cream-soft transition-colors">
                <div className="min-w-0 lg:flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-stone-900 text-sm break-words">{p.name}</span>
                    <HealthBadge health={health} />
                  </div>
                  <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5"><MapPin size={11} /> {p.location}</div>
                </div>
                <div className="w-full lg:w-40 shrink-0">
                  <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Progress</span><span className="font-semibold text-stone-700">{progress}%</span></div>
                  <ProgressBar pct={progress} />
                </div>
                <div className="lg:text-right shrink-0">
                  <div className="text-xs text-stone-500">Spend vs Est.</div>
                  <div className="text-sm font-semibold font-mono text-stone-800">{fmtINR(spend.approved)} <span className="text-stone-400 font-normal">/ {fmtINR(p.estimatedCost)}</span></div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-stone-900">Recent Site Updates</h2>
          </div>
          <div className="space-y-3">
            {recentReports.map(r => (
              <div key={r.id} className="flex items-start gap-3 pb-3 border-b border-stone-50 last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 mt-0.5"><ClipboardList size={14} className="text-stone-500" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-stone-800"><span className="font-semibold">{userName(r.supervisorId)}</span> updated <span className="font-semibold">{projectName(r.projectId)}</span></div>
                  <div className="text-xs text-stone-500 mt-0.5 truncate">{r.workDone}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{fmtDate(r.date)}{r.submittedAt ? ` · ${fmtTime(r.submittedAt)}` : ""} · {r.pctComplete}% complete</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-stone-900">Pending Expense Approvals</h2>
            <button onClick={() => setView({ tab: "expenses" })} className="text-xs font-semibold dia-text-bronze dia-hover-bronze-dark">Review →</button>
          </div>
          <div className="space-y-3">
            {pendingExpenses.length === 0 && <p className="text-sm text-stone-400">No pending approvals.</p>}
            {pendingExpenses.slice(0, 5).map(e => (
              <div key={e.id} className="flex items-start gap-3 pb-3 border-b border-stone-50 last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full dia-bg-cream-soft flex items-center justify-center shrink-0 mt-0.5"><Receipt size={14} className="dia-text-bronze" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-stone-800 font-semibold">{e.description}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{projectName(e.projectId)} · {e.category} · {userName(e.submittedBy)}</div>
                  {e.submittedAt && <div className="text-xs text-stone-400 mt-0.5">{fmtDate(e.submittedAt)} · {fmtTime(e.submittedAt)}</div>}
                </div>
                <div className="text-sm font-mono font-semibold text-stone-800 shrink-0">{fmtINR(e.amount)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {openIssues.length > 0 && (
        <Card className="p-5 border-rose-200">
          <h2 className="font-display text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-rose-600" /> Sites Requiring Attention</h2>
          <div className="space-y-2.5">
            {openIssues.map(i => (
              <div key={i.id} className="flex items-start gap-3 p-3 rounded-lg bg-rose-50/60 border border-rose-100">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${i.severity === "High" ? "bg-rose-600 text-white" : "bg-amber-500 text-white"}`}>{i.severity.toUpperCase()}</span>
                <div className="min-w-0">
                  <div className="text-sm text-stone-800">{i.description}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{projectName(i.projectId)} · {fmtDate(i.date)}{i.submittedAt ? ` ${fmtTime(i.submittedAt)}` : ""} · reported by {userName(i.supervisorId)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Projects List                                                            */
/* ---------------------------------------------------------------------- */

function ProjectsList({ data, setView, actions, currentUser }) {
  const { projects, tasks, expenses, siteReports, users } = data;
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const canAdd = currentUser?.role === "Admin";

  const filtered = projects.filter(p => {
    if (statusFilter !== "All" && p.status !== statusFilter) return false;
    if (search && !`${p.name} ${p.client} ${p.location}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects, clients, locations…"
            className={inputCls + " pl-9"} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-stone-400" />
          {["All", ...PROJECT_STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${statusFilter === s ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}`}>
              {s}
            </button>
          ))}
        </div>
        {canAdd && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg shrink-0">
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(p => {
          const health = computeHealth(p, tasks, expenses);
          const progress = computeProjectProgress(tasks, p.id, siteReports);
          const spend = computeProjectSpend(expenses, p.id);
          return (
            <button key={p.id} onClick={() => setView({ tab: "project", projectId: p.id, sub: "overview" })}
              className="text-left">
              <Card className="p-5 h-full hover:dia-border-gold-soft hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">{p.type}</div>
                    <h3 className="font-display text-base font-semibold text-stone-900 mt-0.5">{p.name}</h3>
                  </div>
                  <HealthBadge health={health} />
                </div>
                <div className="text-xs text-stone-500 space-y-1 mb-3">
                  <div className="flex items-center gap-1.5"><MapPin size={11} /> {p.location}</div>
                  <div className="flex items-center gap-1.5"><Calendar size={11} /> {fmtDate(p.startDate)} → {fmtDate(p.plannedEnd)}</div>
                </div>
                <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Progress</span><span className="font-semibold text-stone-700">{progress}%</span></div>
                <ProgressBar pct={progress} />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
                  <StatusPill status={p.status} />
                  <div className="text-xs font-mono text-stone-600">{fmtINR(spend.approved)} <span className="text-stone-400">/ {fmtINR(p.estimatedCost)}</span></div>
                </div>
              </Card>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-stone-400 col-span-2 text-center py-12">No projects match your filters.</p>}
      </div>

      {showModal && (
        <Modal title="New Project" onClose={() => setShowModal(false)} wide>
          <ProjectForm users={users} currentUser={currentUser}
            onSave={(proj) => { actions.addProject(proj); setShowModal(false); }} />
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Project Detail                                                           */
/* ---------------------------------------------------------------------- */

function CostDashboard({ project, expenses }) {
  const spend = computeProjectSpend(expenses, project.id);
  const remainingBudget = project.estimatedCost - spend.approved;
  const projectedProfit = project.contractValue - project.estimatedCost;
  const actualProfit = project.contractValue - spend.approved;
  const estMargin = project.contractValue ? (projectedProfit / project.contractValue) * 100 : 0;
  const actMargin = project.contractValue ? (actualProfit / project.contractValue) * 100 : 0;

  const items = [
    ["Contract Value", fmtINR(project.contractValue)],
    ["Estimated Cost", fmtINR(project.estimatedCost)],
    ["Actual Cost (Approved)", fmtINR(spend.approved)],
    ["Pending Expenses", fmtINR(spend.pending)],
    ["Remaining Est. Budget", fmtINR(remainingBudget)],
    ["Projected Profit", fmtINR(projectedProfit)],
    ["Actual Profit (to date)", fmtINR(actualProfit)],
    ["Estimated Margin", estMargin.toFixed(1) + "%"],
    ["Actual Margin (to date)", actMargin.toFixed(1) + "%"],
  ];

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold text-stone-900 mb-4">Project Cost Dashboard</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items.map(([label, val]) => (
          <div key={label}>
            <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wide">{label}</div>
            <div className="text-lg font-mono font-semibold text-stone-900 mt-0.5">{val}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Budget utilised</span><span className="font-semibold text-stone-700">{project.estimatedCost ? Math.round((spend.approved / project.estimatedCost) * 100) : 0}%</span></div>
        <ProgressBar pct={project.estimatedCost ? (spend.approved / project.estimatedCost) * 100 : 0} colorClass={spend.approved > project.estimatedCost ? "bg-rose-600" : "dia-bg-gold"} />
      </div>
    </Card>
  );
}

const PIE_COLORS = ["#622022", "#B08D57", "#8B6A46", "#C6A15B", "#7A3134", "#A67C52", "#9C7652", "#D9C08F", "#5C4632", "#4E1A1D"];

function ExpenseBreakdownChart({ expenses, projectId }) {
  const approved = expenses.filter(e => e.projectId === projectId && e.status === "Approved");
  const byCategory = {};
  approved.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const chartData = Object.entries(byCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

  if (!chartData.length) return <Card className="p-5"><p className="text-sm text-stone-400">No approved expenses yet to chart.</p></Card>;

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold text-stone-900 mb-4">Expense Breakdown by Category</h3>
      <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 34)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
          <XAxis type="number" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: "#78716c" }} />
          <YAxis type="category" dataKey="category" width={110} tick={{ fontSize: 11, fill: "#44403c" }} />
          <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e7e5e4" }} />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function TimelineTab({ project, tasks, onUpdateTask, canEdit }) {
  const grouped = PHASE_TEMPLATE.map(phase => ({
    phase, list: tasks.filter(t => t.projectId === project.id && t.phase === phase)
  })).filter(g => g.list.length > 0);

  const [editingTask, setEditingTask] = useState(null);

  return (
    <div className="space-y-4">
      {grouped.map(g => (
        <Card key={g.phase} className="p-4">
          <h4 className="font-semibold text-sm text-stone-800 mb-3">{g.phase}</h4>
          <div className="space-y-2.5">
            {g.list.map(t => {
              const delayed = isTaskDelayed(t);
              return (
                <div key={t.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${delayed ? "border-rose-200 bg-rose-50/40" : "border-stone-100"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-800 truncate">{t.name}</span>
                      {delayed && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-full shrink-0">DELAYED</span>}
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">{t.assignedTo} · Target {fmtDate(t.target)}{t.actual ? ` · Done ${fmtDate(t.actual)}` : ""}</div>
                  </div>
                  <div className="w-24 hidden sm:block">
                    <ProgressBar pct={t.pct} colorClass={delayed ? "bg-rose-500" : t.status === "Completed" ? "bg-emerald-500" : "dia-bg-gold"} />
                  </div>
                  <span className="text-xs font-semibold text-stone-600 w-9 text-right">{t.pct}%</span>
                  <StatusPill status={t.status} />
                  {canEdit && <button onClick={() => setEditingTask(t)} className="text-xs font-semibold dia-text-bronze dia-hover-bronze-dark ml-1">Update</button>}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {editingTask && (
        <Modal title={`Update: ${editingTask.name}`} onClose={() => setEditingTask(null)}>
          <UpdateTaskForm task={editingTask} onSave={(updates) => { onUpdateTask(editingTask.id, updates); setEditingTask(null); }} />
        </Modal>
      )}
    </div>
  );
}

function UpdateTaskForm({ task, onSave }) {
  const [pct, setPct] = useState(task.pct);
  const [status, setStatus] = useState(task.status);
  const [actual, setActual] = useState(task.actual || "");
  return (
    <div>
      <Field label="Status">
        <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
          {["Not Started", "In Progress", "Completed"].map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label={`Percentage complete: ${pct}%`}>
        <input type="range" min="0" max="100" value={pct} onChange={e => setPct(Number(e.target.value))} className="w-full" style={{ accentColor: DIA.gold }} />
      </Field>
      {status === "Completed" && (
        <Field label="Actual completion date">
          <input type="date" className={inputCls} value={actual} onChange={e => setActual(e.target.value)} />
        </Field>
      )}
      <button onClick={() => onSave({ pct: status === "Completed" ? 100 : pct, status, actual: status === "Completed" ? (actual || TODAY.toISOString().slice(0, 10)) : null })}
        className="w-full dia-btn-gold font-semibold text-sm py-2.5 rounded-lg mt-1">Save update</button>
    </div>
  );
}

function ProofAttachment({ proof, onChange, required, pathPrefix }) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type) && file.type !== "application/pdf") {
      setError("Please attach an image or PDF file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("File is too large — please attach something under 8MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadProofFile(file, pathPrefix || "misc");
      onChange({ name: file.name, type: file.type.startsWith("image/") ? "image" : "pdf", dataUrl: url, uploadedAt: new Date().toISOString() });
      setError("");
    } catch (err) {
      setError(err.message || "Upload failed — please try again.");
    }
    setUploading(false);
  };

  return (
    <Field label={`Photo or PDF proof of work${required ? " (required)" : ""}`}>
      {proof ? (
        <div className="flex items-center gap-2 text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2">
          {proof.type === "image"
            ? <img src={proof.dataUrl} alt="" className="w-9 h-9 object-cover rounded shrink-0" />
            : <FileText size={18} className="text-stone-400 shrink-0" />}
          <span className="truncate flex-1">{proof.name}</span>
          <button type="button" onClick={() => onChange(null)} className="text-stone-400 hover:text-rose-500 shrink-0"><X size={14} /></button>
        </div>
      ) : (
        <label className="flex items-center gap-2 justify-center border-2 border-dashed border-stone-300 rounded-lg py-3 text-xs text-stone-500 hover:dia-border-gold-soft cursor-pointer transition-colors">
          <Paperclip size={14} /> {uploading ? "Uploading…" : "Attach a photo or PDF"}
          <input type="file" accept="image/*,.pdf" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
      )}
      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
    </Field>
  );
}

function DesignTab({ project, phases, users, canEdit, currentUser, onUpdatePhase, onUpdateDrawing, onAddDrawing, onRemoveDrawing }) {
  const ordered = DESIGN_PHASES.map(phase => phases.find(p => p.phase === phase)).filter(Boolean).map(effectivePhase);
  const [editingPhase, setEditingPhase] = useState(null);
  const [editingDrawing, setEditingDrawing] = useState(null);
  const [newDrawingName, setNewDrawingName] = useState("");
  const completedCount = ordered.filter(p => p.status === "Completed").length;

  if (ordered.length === 0) {
    return <Card className="p-8 text-center"><p className="text-sm text-stone-400">No design phases set up for this project yet.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-800">Design workflow</span>
        <span className="text-xs text-stone-500">{completedCount} of {ordered.length} phases complete</span>
      </Card>
      <Card className="p-3 flex items-start gap-2 bg-sky-50 border-sky-200">
        <AlertCircle size={15} className="text-sky-600 shrink-0 mt-0.5" />
        <p className="text-xs text-sky-800">A phase or drawing can only be marked In Progress or Completed once a photo or PDF is attached as proof. Without it, the work is treated as not started.</p>
      </Card>

      {ordered.map(p => {
        const isDrawingsPhase = p.phase === "Working Drawings";
        const drawings = (p.drawings || []).map(effectiveDrawing);
        const drawingsDone = drawings.filter(d => d.status === "Completed").length;
        return (
          <Card key={p.id} className="p-4">
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-stone-800">{p.phase}</span>
                  {isDrawingsPhase && drawings.length > 0 && (
                    <span className="text-[11px] text-stone-400 font-mono flex items-center gap-1"><ListChecks size={12} /> {drawingsDone}/{drawings.length} drawings</span>
                  )}
                  {p.status !== "Not Started" && hasProof(p) && <Paperclip size={11} className="text-stone-400" />}
                </div>
                <div className="text-xs text-stone-400 mt-0.5">{p.assignedTo || "Unassigned"} · Target {fmtDate(p.target)}{p.actual ? ` · Done ${fmtDate(p.actual)}` : ""}</div>
              </div>
              <div className="w-24 hidden sm:block">
                <ProgressBar pct={p.pct} colorClass={p.status === "Completed" ? "bg-emerald-500" : "bg-sky-500"} />
              </div>
              <span className="text-xs font-semibold text-stone-600 w-9 text-right">{p.pct}%</span>
              <StatusPill status={p.status} />
              {canEdit && <button onClick={() => setEditingPhase(p)} className="text-xs font-semibold dia-text-bronze dia-hover-bronze-dark ml-1 shrink-0">Update</button>}
            </div>

            {isDrawingsPhase && (
              <div className="mt-3 pt-3 border-t border-stone-100 space-y-1">
                {drawings.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-2 py-1">
                    <button type="button" disabled={!canEdit} onClick={() => setEditingDrawing(d)}
                      className={`flex items-center gap-2 text-sm text-left flex-1 min-w-0 ${canEdit ? "cursor-pointer" : "cursor-default"}`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${d.status === "Completed" ? "bg-emerald-500 border-emerald-500" : d.status === "In Progress" ? "border-amber-400" : "border-stone-300"}`}>
                        {d.status === "Completed" && <Check size={11} className="text-white" />}
                      </span>
                      <span className={`truncate ${d.status === "Completed" ? "text-stone-400 line-through" : "text-stone-700"}`}>{d.name}</span>
                      {d.status !== "Pending" && hasProof(d) && <Paperclip size={11} className="text-stone-400 shrink-0" />}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill status={d.status} />
                      {canEdit && <button onClick={() => onRemoveDrawing(p.id, d.id)} className="text-stone-300 hover:text-rose-500"><X size={13} /></button>}
                    </div>
                  </div>
                ))}
                {drawings.length === 0 && <p className="text-xs text-stone-400">No drawings listed yet.</p>}
                {canEdit && (
                  <div className="flex gap-2 pt-2">
                    <input value={newDrawingName} onChange={e => setNewDrawingName(e.target.value)} placeholder="Add a drawing sheet…"
                      className="flex-1 text-xs border border-stone-300 rounded-md px-2.5 py-1.5" />
                    <button onClick={() => { if (newDrawingName.trim()) { onAddDrawing(p.id, newDrawingName.trim()); setNewDrawingName(""); } }}
                      className="text-xs font-semibold dia-text-bronze dia-hover-bronze-dark shrink-0">Add</button>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {editingPhase && (
        <Modal title={`Update: ${editingPhase.phase}`} onClose={() => setEditingPhase(null)}>
          <UpdateDesignPhaseForm phase={editingPhase} users={users} onSave={(updates) => { onUpdatePhase(editingPhase.id, updates); setEditingPhase(null); }} />
        </Modal>
      )}
      {editingDrawing && (
        <Modal title={`Update: ${editingDrawing.name}`} onClose={() => setEditingDrawing(null)}>
          <UpdateDrawingForm drawing={editingDrawing} onSave={(updates) => {
            const phase = ordered.find(p => (p.drawings || []).some(d => d.id === editingDrawing.id));
            if (phase) onUpdateDrawing(phase.id, editingDrawing.id, updates);
            setEditingDrawing(null);
          }} />
        </Modal>
      )}
    </div>
  );
}

function UpdateDesignPhaseForm({ phase, users, onSave }) {
  const [pct, setPct] = useState(phase.pct);
  const [status, setStatus] = useState(phase.status);
  const [actual, setActual] = useState(phase.actual || "");
  const [assignedTo, setAssignedTo] = useState(phase.assignedTo || "");
  const [notes, setNotes] = useState(phase.notes || "");
  const [proof, setProof] = useState(phase.proof || null);
  const architectNames = users.filter(u => u.role === "Architect").map(u => u.name);

  const needsProof = status !== "Not Started";
  const canSave = !needsProof || !!proof;

  return (
    <div>
      <Field label="Status">
        <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
          {["Not Started", "In Progress", "Completed"].map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label={`Percentage complete: ${pct}%`}>
        <input type="range" min="0" max="100" value={pct} onChange={e => setPct(Number(e.target.value))} className="w-full" style={{ accentColor: DIA.gold }} />
      </Field>
      <Field label="Assigned architect">
        <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
          <option value="">Unassigned</option>
          {architectNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      {status === "Completed" && (
        <Field label="Actual completion date">
          <input type="date" className={inputCls} value={actual} onChange={e => setActual(e.target.value)} />
        </Field>
      )}
      {needsProof && <ProofAttachment proof={proof} onChange={setProof} required pathPrefix="design-phases" />}
      <Field label="Notes (optional)"><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      {!canSave && <p className="text-xs text-amber-600 -mt-2 mb-3">Attach a photo or PDF before this phase can be marked {status.toLowerCase()} — otherwise it's treated as not started.</p>}
      <button onClick={() => onSave({
        pct: status === "Completed" ? 100 : pct, status,
        actual: status === "Completed" ? (actual || TODAY.toISOString().slice(0, 10)) : null,
        assignedTo: assignedTo || null, notes, proof: needsProof ? proof : null,
      })} disabled={!canSave} className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">Save update</button>
    </div>
  );
}

function UpdateDrawingForm({ drawing, onSave }) {
  const [status, setStatus] = useState(drawing.status);
  const [proof, setProof] = useState(drawing.proof || null);
  const needsProof = status !== "Pending";
  const canSave = !needsProof || !!proof;

  return (
    <div>
      <Field label="Status">
        <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
          {DRAWING_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      {needsProof && <ProofAttachment proof={proof} onChange={setProof} required pathPrefix="drawings" />}
      {!canSave && <p className="text-xs text-amber-600 -mt-2 mb-3">Attach a photo or PDF before this drawing can be marked {status.toLowerCase()} — otherwise it's treated as pending.</p>}
      <button onClick={() => onSave({ status, proof: needsProof ? proof : null })} disabled={!canSave}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">Save update</button>
    </div>
  );
}

function ReportsTab({ project, reports, users, canAdd, onAdd }) {
  const [showModal, setShowModal] = useState(false);
  const sorted = [...reports].sort((a, b) => new Date(b.date) - new Date(a.date));
  const userName = (id) => users.find(u => u.id === id)?.name || id;

  return (
    <div className="space-y-4">
      {canAdd && (
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg">
          <Plus size={16} /> Add Daily Site Report
        </button>
      )}
      {sorted.length === 0 && <p className="text-sm text-stone-400">No site reports submitted yet.</p>}
      {sorted.map(r => (
        <Card key={r.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-semibold text-stone-900 text-sm">{fmtDate(r.date)}</span>
              {r.submittedAt && <span className="text-xs text-stone-400 font-mono ml-1.5">{fmtTime(r.submittedAt)}</span>}
              <span className="text-xs text-stone-500 ml-2">by {userName(r.supervisorId)} · {r.workers} workers on site</span>
            </div>
            <span className="text-sm font-mono font-semibold dia-text-bronze">{r.pctComplete}% complete</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs font-semibold text-stone-500 uppercase">Work completed today</span><p className="text-stone-700 mt-0.5">{r.workDone}</p></div>
            <div><span className="text-xs font-semibold text-stone-500 uppercase">Planned for tomorrow</span><p className="text-stone-700 mt-0.5">{r.workPlanned}</p></div>
            <div><span className="text-xs font-semibold text-stone-500 uppercase">Materials received</span><p className="text-stone-700 mt-0.5">{r.materialsReceived || "—"}</p></div>
            <div><span className="text-xs font-semibold text-stone-500 uppercase">Materials required</span><p className="text-stone-700 mt-0.5">{r.materialsNeeded || "—"}</p></div>
            {r.issues && <div className="sm:col-span-2"><span className="text-xs font-semibold text-rose-600 uppercase">Issues encountered</span><p className="text-stone-700 mt-0.5">{r.issues}</p></div>}
            {r.remarks && <div className="sm:col-span-2"><span className="text-xs font-semibold text-stone-500 uppercase">Remarks</span><p className="text-stone-700 mt-0.5">{r.remarks}</p></div>}
          </div>
        </Card>
      ))}
      {showModal && <Modal title="Daily Site Report" onClose={() => setShowModal(false)} wide>
        <SiteReportForm onSave={(rep) => { onAdd(rep); setShowModal(false); }} />
      </Modal>}
    </div>
  );
}

function SiteReportForm({ onSave }) {
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10), workers: "", workDone: "", workInProgress: "", workPlanned: "",
    materialsReceived: "", materialsNeeded: "", issues: "", delays: "", pctComplete: 0, remarks: ""
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={set("date")} /></Field>
        <Field label="Number of workers on site"><input type="number" className={inputCls} value={form.workers} onChange={set("workers")} /></Field>
      </div>
      <Field label="Work completed today"><textarea className={inputCls} rows={2} value={form.workDone} onChange={set("workDone")} /></Field>
      <Field label="Work in progress"><textarea className={inputCls} rows={2} value={form.workInProgress} onChange={set("workInProgress")} /></Field>
      <Field label="Work planned for tomorrow"><textarea className={inputCls} rows={2} value={form.workPlanned} onChange={set("workPlanned")} /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Materials received"><input className={inputCls} value={form.materialsReceived} onChange={set("materialsReceived")} /></Field>
        <Field label="Materials required"><input className={inputCls} value={form.materialsNeeded} onChange={set("materialsNeeded")} /></Field>
      </div>
      <Field label="Issues encountered / delays"><textarea className={inputCls} rows={2} value={form.issues} onChange={set("issues")} /></Field>
      <Field label={`Overall project completion: ${form.pctComplete}%`}>
        <input type="range" min="0" max="100" value={form.pctComplete} onChange={e => setForm(f => ({ ...f, pctComplete: Number(e.target.value) }))} className="w-full" style={{ accentColor: DIA.gold }} />
      </Field>
      <Field label="Additional remarks"><textarea className={inputCls} rows={2} value={form.remarks} onChange={set("remarks")} /></Field>
      <button onClick={() => onSave(form)} disabled={!form.workDone} className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">Submit report</button>
    </div>
  );
}

function ExpensesTab({ project, expenses, users, currentUser, canApprove, canAdd, onAdd, onApprove, onReject, onDelete }) {
  const [showModal, setShowModal] = useState(false);
  const list = expenses.filter(e => e.projectId === project.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const userName = (id) => users.find(u => u.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {canAdd && <button onClick={() => setShowModal(true)} className="flex items-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg">
          <Plus size={16} /> Add Expense
        </button>}
        <button onClick={() => exportToExcel(list.map(e => ({ Date: e.date, TimeFiled: fmtTime(e.submittedAt), Category: e.category, Description: e.description, Amount: e.amount, Vendor: e.vendor, Invoice: e.invoiceNo, Status: e.status, SubmittedBy: userName(e.submittedBy) })), `${project.name.replace(/\W+/g, "_")}_expenses.xlsx`, "Expenses")}
          className="flex items-center gap-2 border border-stone-300 hover:border-stone-400 text-stone-700 font-semibold text-sm px-4 py-2.5 rounded-lg ml-auto">
          <FileSpreadsheet size={15} /> Export Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200">
              <th className="py-2 pr-3 font-semibold">Date</th>
              <th className="py-2 pr-3 font-semibold">Category</th>
              <th className="py-2 pr-3 font-semibold">Description</th>
              <th className="py-2 pr-3 font-semibold">Vendor</th>
              <th className="py-2 pr-3 font-semibold">Submitted by</th>
              <th className="py-2 pr-3 font-semibold text-right">Amount</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              {canApprove && <th className="py-2 pr-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {list.map(e => (
              <ExpenseRow key={e.id} e={e} userName={userName} canApprove={canApprove} currentUserId={currentUser.id} onApprove={onApprove} onReject={onReject} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">No expenses recorded for this project yet.</p>}
      </div>
      {showModal && <Modal title="Add Expense" onClose={() => setShowModal(false)}>
        <ExpenseForm onSave={(exp) => { onAdd(exp); setShowModal(false); }} />
      </Modal>}
    </div>
  );
}

function ExpenseRow({ e, userName, canApprove, currentUserId, onApprove, onReject, onDelete }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isOwn = e.submittedBy === currentUserId;
  return (
    <tr className="border-b border-stone-50 hover:bg-stone-50/60 align-top">
      <td className="py-2.5 pr-3 whitespace-nowrap text-stone-600">
        {fmtDate(e.date)}
        {e.submittedAt && <div className="text-[10px] text-stone-400 font-mono">Filed {fmtTime(e.submittedAt)}</div>}
      </td>
      <td className="py-2.5 pr-3"><span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-medium">{e.category}</span></td>
      <td className="py-2.5 pr-3 text-stone-800 max-w-[220px]">
        {e.description}
        {e.status === "Rejected" && e.rejectionReason && <div className="text-xs text-rose-600 mt-0.5">Reason: {e.rejectionReason}</div>}
      </td>
      <td className="py-2.5 pr-3 text-stone-500">{e.vendor}</td>
      <td className="py-2.5 pr-3 text-stone-500">{userName(e.submittedBy)}</td>
      <td className="py-2.5 pr-3 text-right font-mono font-semibold text-stone-800 whitespace-nowrap">{fmtINR(e.amount)}</td>
      <td className="py-2.5 pr-3"><StatusPill status={e.status} /></td>
      {canApprove && (
        <td className="py-2.5 pr-3">
          {confirmingDelete ? (
            <div className="flex gap-1.5 items-center min-w-[170px]">
              <span className="text-[11px] text-stone-500">Delete this expense?</span>
              <button onClick={() => onDelete(e.id)} className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded-md shrink-0">Delete</button>
              <button onClick={() => setConfirmingDelete(false)} className="text-xs font-semibold text-stone-500 shrink-0">Cancel</button>
            </div>
          ) : (
            <div className="flex gap-1.5 items-center">
              {e.status === "Pending" && isOwn && (
                <span className="text-[11px] text-stone-400 italic mr-1">Submitted by you — needs another approver</span>
              )}
              {e.status === "Pending" && !isOwn && !rejecting && (
                <>
                  <button onClick={() => onApprove(e.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><Check size={14} /></button>
                  <button onClick={() => setRejecting(true)} className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"><XCircle size={14} /></button>
                </>
              )}
              {e.status === "Pending" && !isOwn && rejecting && (
                <div className="flex gap-1.5 items-center min-w-[180px]">
                  <input value={reason} onChange={e2 => setReason(e2.target.value)} placeholder="Reason…" className="text-xs border border-stone-300 rounded-md px-2 py-1 w-full" />
                  <button onClick={() => { onReject(e.id, reason || "Not specified"); setRejecting(false); }} className="text-xs font-semibold text-rose-700 shrink-0">Confirm</button>
                </div>
              )}
              {onDelete && (
                <button onClick={() => setConfirmingDelete(true)} title="Delete expense" className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
              )}
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

function ExpenseForm({ onSave, defaultProjectId, projects }) {
  const [form, setForm] = useState({
    projectId: defaultProjectId || (projects && projects[0]?.id) || "",
    date: TODAY.toISOString().slice(0, 10), category: EXPENSE_CATEGORIES[0], description: "",
    amount: "", paymentMethod: PAYMENT_METHODS[0], vendor: "", invoiceNo: "", notes: ""
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div>
      {projects && (
        <Field label="Project">
          <select className={inputCls} value={form.projectId} onChange={set("projectId")}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={set("date")} /></Field>
        <Field label="Category">
          <select className={inputCls} value={form.category} onChange={set("category")}>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description"><input className={inputCls} value={form.description} onChange={set("description")} placeholder="e.g. Marble slabs — flooring" /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Amount (₹)"><input type="number" className={inputCls} value={form.amount} onChange={set("amount")} /></Field>
        <Field label="Payment method">
          <select className={inputCls} value={form.paymentMethod} onChange={set("paymentMethod")}>
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Vendor / paid to"><input className={inputCls} value={form.vendor} onChange={set("vendor")} /></Field>
        <Field label="Bill / invoice number"><input className={inputCls} value={form.invoiceNo} onChange={set("invoiceNo")} /></Field>
      </div>
      <Field label="Notes (optional)"><textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} /></Field>
      <Field label="Receipt upload">
        <div className="border-2 border-dashed border-stone-300 rounded-lg py-4 text-center text-xs text-stone-400">
          File upload requires backend storage — available in the production build.
        </div>
      </Field>
      <button onClick={() => onSave({ ...form, amount: Number(form.amount) })} disabled={!form.description || !form.amount || !form.projectId}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">Submit expense</button>
    </div>
  );
}

function EditProjectTeamForm({ project, users, onSave }) {
  const architectOptions = users.filter(u => u.role === "Architect" && u.active !== false && !u.removed)
    .sort((a, b) => ARCHITECT_RANKS.indexOf(a.rank) - ARCHITECT_RANKS.indexOf(b.rank));
  const supervisorOptions = users.filter(u => u.role === "Supervisor" && u.active !== false && !u.removed);
  const [architects, setArchitects] = useState(project.architects || []);
  const [supervisors, setSupervisors] = useState(project.supervisors || []);

  const toggleArchitect = (id) => setArchitects(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  const toggleSupervisor = (id) => setSupervisors(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div>
      <Field label="Assigned architects">
        <div className="flex flex-wrap gap-2">
          {architectOptions.map(u => (
            <button key={u.id} type="button" onClick={() => toggleArchitect(u.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${architects.includes(u.id) ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}`}>
              {u.name} <span className="opacity-60">· {u.rank?.replace(" Architect", "")}</span>
            </button>
          ))}
          {architectOptions.length === 0 && <p className="text-xs text-stone-400">No architects available yet.</p>}
        </div>
      </Field>
      <Field label="Assigned supervisors">
        <div className="flex flex-wrap gap-2">
          {supervisorOptions.map(u => (
            <button key={u.id} type="button" onClick={() => toggleSupervisor(u.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${supervisors.includes(u.id) ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}`}>
              {u.name}
            </button>
          ))}
          {supervisorOptions.length === 0 && <p className="text-xs text-stone-400">No supervisors available yet.</p>}
        </div>
      </Field>
      <p className="text-[11px] text-stone-400 mb-3">Removing someone here removes their access to this project; it does not delete anything they already submitted.</p>
      <button onClick={() => onSave({ architects, supervisors })}
        className="w-full dia-btn-gold font-semibold text-sm py-2.5 rounded-lg mt-1">Save team</button>
    </div>
  );
}

function ProjectForm({ onSave, users, currentUser }) {
  const supervisorOptions = users.filter(u => u.role === "Supervisor" && u.active !== false && !u.removed);
  const architectOptions = users.filter(u => u.role === "Architect" && u.active !== false && !u.removed)
    .sort((a, b) => ARCHITECT_RANKS.indexOf(a.rank) - ARCHITECT_RANKS.indexOf(b.rank));
  const [form, setForm] = useState({
    name: "", client: "", location: "", type: PROJECT_TYPES[0], area: "",
    startDate: TODAY.toISOString().slice(0, 10), plannedEnd: "",
    pm: currentUser?.name || "", supervisors: [], architects: [],
    contractValue: "", estimatedCost: "", status: "Not Started",
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggleSupervisor = (id) => setForm(f => ({
    ...f, supervisors: f.supervisors.includes(id) ? f.supervisors.filter(s => s !== id) : [...f.supervisors, id]
  }));
  const toggleArchitect = (id) => setForm(f => ({
    ...f, architects: f.architects.includes(id) ? f.architects.filter(s => s !== id) : [...f.architects, id]
  }));

  const canSubmit = form.name && form.client && form.location && form.startDate && form.plannedEnd
    && form.contractValue && form.estimatedCost;

  return (
    <div>
      <Field label="Project name"><input className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. Oprea Diamonds — Hyderabad Flagship" /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Client"><input className={inputCls} value={form.client} onChange={set("client")} /></Field>
        <Field label="Project type">
          <select className={inputCls} value={form.type} onChange={set("type")}>
            {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Location"><input className={inputCls} value={form.location} onChange={set("location")} placeholder="e.g. Banjara Hills, Hyderabad, Telangana" /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Start date"><input type="date" className={inputCls} value={form.startDate} onChange={set("startDate")} /></Field>
        <Field label="Planned end date"><input type="date" className={inputCls} value={form.plannedEnd} onChange={set("plannedEnd")} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Area (sq.ft.)"><input type="number" className={inputCls} value={form.area} onChange={set("area")} /></Field>
        <Field label="Project manager"><input className={inputCls} value={form.pm} onChange={set("pm")} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Contract value (₹)"><input type="number" className={inputCls} value={form.contractValue} onChange={set("contractValue")} /></Field>
        <Field label="Estimated cost (₹)"><input type="number" className={inputCls} value={form.estimatedCost} onChange={set("estimatedCost")} /></Field>
      </div>
      <Field label="Status">
        <select className={inputCls} value={form.status} onChange={set("status")}>
          {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Assign architects">
        <div className="flex flex-wrap gap-2">
          {architectOptions.map(u => (
            <button key={u.id} type="button" onClick={() => toggleArchitect(u.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${form.architects.includes(u.id) ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}`}>
              {u.name} <span className="opacity-60">· {u.rank?.replace(" Architect", "")}</span>
            </button>
          ))}
          {architectOptions.length === 0 && <p className="text-xs text-stone-400">No architects available yet.</p>}
        </div>
      </Field>
      <Field label="Assign supervisors">
        <div className="flex flex-wrap gap-2">
          {supervisorOptions.map(u => (
            <button key={u.id} type="button" onClick={() => toggleSupervisor(u.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${form.supervisors.includes(u.id) ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}`}>
              {u.name}
            </button>
          ))}
          {supervisorOptions.length === 0 && <p className="text-xs text-stone-400">No supervisors available yet.</p>}
        </div>
      </Field>
      <button
        onClick={() => onSave({
          ...form,
          area: Number(form.area) || 0,
          contractValue: Number(form.contractValue) || 0,
          estimatedCost: Number(form.estimatedCost) || 0,
        })}
        disabled={!canSubmit}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">
        Create project
      </button>
    </div>
  );
}

function PhotosTab({ project, reports, onAddPhoto, canAdd }) {
  const [showModal, setShowModal] = useState(false);
  const allPhotos = reports.flatMap(r => (r.photos || []).map(p => ({ ...p, date: r.date })));
  const byDate = {};
  allPhotos.forEach(p => { byDate[p.date] = byDate[p.date] || []; byDate[p.date].push(p); });
  const dates = Object.keys(byDate).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="space-y-4">
      {canAdd && <button onClick={() => setShowModal(true)} className="flex items-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg">
        <Camera size={16} /> Upload Site Photo
      </button>}
      {dates.length === 0 && (
        <Card className="p-8 text-center">
          <ImageIcon size={28} className="mx-auto text-stone-300 mb-2" />
          <p className="text-sm text-stone-400">No photos uploaded yet. Photos added by supervisors will build a chronological site diary here.</p>
        </Card>
      )}
      {dates.map(d => (
        <div key={d}>
          <div className="text-xs font-semibold text-stone-500 uppercase mb-2">{fmtDate(d)}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {byDate[d].map((p, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-stone-200 bg-stone-100 aspect-square flex items-center justify-center relative">
                {p.url ? <img src={p.url} alt={p.caption} className="w-full h-full object-cover" /> : <ImageIcon size={22} className="text-stone-300" />}
                <div className="absolute bottom-0 inset-x-0 bg-stone-900/70 text-white text-[10px] px-2 py-1 truncate">
                  {p.caption || p.category}{p.uploadedAt ? ` · ${fmtTime(p.uploadedAt)}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {showModal && <Modal title="Upload Site Photo" onClose={() => setShowModal(false)}>
        <PhotoForm onSave={(p) => { onAddPhoto(p); setShowModal(false); }} />
      </Modal>}
    </div>
  );
}

function PhotoForm({ onSave }) {
  const [form, setForm] = useState({ caption: "", category: PHASE_TEMPLATE[0], date: TODAY.toISOString().slice(0, 10) });
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError("Please choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Image is too large — please choose one under 8MB."); return; }
    setUploading(true);
    try {
      const publicUrl = await uploadSitePhoto(file, "site-diary");
      setUrl(publicUrl);
      setError("");
    } catch (err) {
      setError(err.message || "Upload failed — please try again.");
    }
    setUploading(false);
  };

  return (
    <div>
      <Field label="Photo">
        {url ? (
          <div className="flex items-center gap-2 text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2">
            <img src={url} alt="" className="w-9 h-9 object-cover rounded shrink-0" />
            <span className="truncate flex-1">Photo attached</span>
            <button type="button" onClick={() => setUrl("")} className="text-stone-400 hover:text-rose-500 shrink-0"><X size={14} /></button>
          </div>
        ) : (
          <label className="flex items-center gap-2 justify-center border-2 border-dashed border-stone-300 rounded-lg py-4 text-xs text-stone-500 hover:dia-border-gold-soft cursor-pointer transition-colors">
            <Camera size={14} /> {uploading ? "Uploading…" : "Take or choose a photo"}
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={uploading} className="hidden" />
          </label>
        )}
        {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
      </Field>
      <Field label="Work category">
        <select className={inputCls} value={form.category} onChange={set("category")}>
          {PHASE_TEMPLATE.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Caption"><input className={inputCls} value={form.caption} onChange={set("caption")} /></Field>
      <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={set("date")} /></Field>
      <button onClick={() => onSave({ ...form, url })} disabled={!url || uploading}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">Add to site diary</button>
    </div>
  );
}

function ProjectDetail({ data, projectId, sub, setView, currentUser, actions }) {
  const project = data.projects.find(p => p.id === projectId);
  const [tab, setTab] = useState(sub || "overview");
  const [showEditTeam, setShowEditTeam] = useState(false);
  if (!project) return <div className="p-8">Project not found.</div>;

  const isAdmin = currentUser.role === "Admin";
  const isFinance = currentUser.role === "Admin" || currentUser.role === "Accounts";
  const isAssignedSupervisor = currentUser.role === "Supervisor" && project.supervisors.includes(currentUser.id);
  const isAssignedArchitect = currentUser.role === "Architect" && (project.architects || []).includes(currentUser.id);
  const canEditTimeline = isAdmin || isAssignedSupervisor;
  const canEditDesign = isAdmin || isAssignedArchitect;

  if (!isFinance && !isAssignedSupervisor && !isAssignedArchitect) {
    return (
      <div className="p-6 sm:p-8">
        <button onClick={() => setView({ tab: "projects" })} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 font-semibold mb-4">
          <ArrowLeft size={15} /> All projects
        </button>
        <Card><AccessDenied message="You're not assigned to this project." /></Card>
      </div>
    );
  }

  const userName = (id) => data.users.find(u => u.id === id)?.name || id;
  const projectTasks = data.tasks.filter(t => t.projectId === project.id);
  const projectReports = data.siteReports.filter(r => r.projectId === project.id);
  const projectDesignPhases = data.designPhases.filter(d => d.projectId === project.id);
  const health = computeHealth(project, data.tasks, data.expenses);
  const progress = computeProjectProgress(data.tasks, project.id, data.siteReports);
  const designProgress = computeDesignProgress(data.designPhases, project.id);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "design", label: "Design" },
    { key: "timeline", label: "Timeline" },
    { key: "reports", label: "Site Reports" },
    { key: "expenses", label: "Expenses" },
    { key: "photos", label: "Photos" },
  ];

  return (
    <div className="p-6 sm:p-8">
      <button onClick={() => setView({ tab: "projects" })} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 font-semibold mb-4">
        <ArrowLeft size={15} /> All projects
      </button>

      <Card className="p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">{project.type}</div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mt-0.5">{project.name}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500 mt-2">
              <span className="flex items-center gap-1.5"><MapPin size={13} /> {project.location}</span>
              <span className="flex items-center gap-1.5"><Calendar size={13} /> {fmtDate(project.startDate)} → {fmtDate(project.plannedEnd)}</span>
              <span>Client: <b className="text-stone-700">{project.client}</b></span>
              <span>{project.area.toLocaleString("en-IN")} sq.ft.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={project.status} />
            <HealthBadge health={health} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Design progress</span><span className="font-semibold text-stone-700">{designProgress}%</span></div>
            <ProgressBar pct={designProgress} colorClass="bg-sky-500" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Construction progress</span><span className="font-semibold text-stone-700">{progress}%</span></div>
            <ProgressBar pct={progress} />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="text-xs text-stone-500 space-y-1">
            <div><span className="font-semibold text-stone-600">Architects:</span> {(project.architects || []).length ? project.architects.map(userName).join(", ") : "None assigned"}</div>
            <div><span className="font-semibold text-stone-600">Supervisors:</span> {(project.supervisors || []).length ? project.supervisors.map(userName).join(", ") : "None assigned"}</div>
          </div>
          {isAdmin && (
            <button onClick={() => setShowEditTeam(true)}
              className="flex items-center gap-1.5 text-xs font-semibold dia-text-bronze dia-hover-bronze-dark border dia-border-gold-soft rounded-lg px-3 py-1.5 shrink-0 self-start sm:self-auto">
              <Pencil size={12} /> Edit team
            </button>
          )}
        </div>
      </Card>

      {showEditTeam && (
        <Modal title="Edit Assigned Team" onClose={() => setShowEditTeam(false)}>
          <EditProjectTeamForm project={project} users={data.users}
            onSave={(updates) => { actions.updateProjectTeam(project.id, updates); setShowEditTeam(false); }} />
        </Modal>
      )}

      <div className="flex gap-1 border-b border-stone-200 mb-5 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.key ? "dia-border-gold dia-text-bronze" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && isFinance && (
        <div className="space-y-5">
          <CostDashboard project={project} expenses={data.expenses} />
          <ExpenseBreakdownChart expenses={data.expenses} projectId={project.id} />
        </div>
      )}
      {tab === "overview" && !isFinance && (
        <Card className="p-5">
          <p className="text-sm text-stone-500">Financial dashboards are visible to Admin and Accounts. Use the Design, Timeline, Site Reports and Expenses tabs to update this project.</p>
        </Card>
      )}
      {tab === "design" && <DesignTab project={project} phases={projectDesignPhases} users={data.users} canEdit={canEditDesign} currentUser={currentUser}
        onUpdatePhase={(id, updates) => actions.updateDesignPhase(id, updates)}
        onUpdateDrawing={(phaseId, drawingId, updates) => actions.updateDrawingItem(phaseId, drawingId, updates, currentUser.id)}
        onAddDrawing={(phaseId, name) => actions.addDrawingItem(phaseId, name)}
        onRemoveDrawing={(phaseId, drawingId) => actions.removeDrawingItem(phaseId, drawingId)} />}
      {tab === "timeline" && <TimelineTab project={project} tasks={data.tasks} onUpdateTask={actions.updateTask} canEdit={canEditTimeline} />}
      {tab === "reports" && <ReportsTab project={project} reports={projectReports} users={data.users} canAdd={isAssignedSupervisor} onAdd={(rep) => actions.addSiteReport(project.id, currentUser.id, rep)} />}
      {tab === "expenses" && <ExpensesTab project={project} expenses={data.expenses} users={data.users} currentUser={currentUser}
        canApprove={isFinance} canAdd={isFinance || isAssignedSupervisor}
        onAdd={(exp) => actions.addExpense({ ...exp, projectId: project.id, submittedBy: currentUser.id })}
        onApprove={(id) => actions.approveExpense(id, currentUser.id)} onReject={(id, reason) => actions.rejectExpense(id, currentUser.id, reason)}
        onDelete={(id) => actions.deleteExpense(id)} />}
      {tab === "photos" && <PhotosTab project={project} reports={projectReports} canAdd={isAssignedSupervisor} onAddPhoto={(photo) => actions.addPhoto(project.id, photo)} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Expenses Global (Accounts / Admin)                                       */
/* ---------------------------------------------------------------------- */

function ExpensesGlobal({ data, currentUser, actions }) {
  const { expenses, projects, users } = data;
  const [projectFilter, setProjectFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const projectName = (id) => projects.find(p => p.id === id)?.name || id;
  const userName = (id) => users.find(u => u.id === id)?.name || id;

  const filtered = expenses.filter(e => {
    if (projectFilter !== "All" && e.projectId !== projectFilter) return false;
    if (statusFilter !== "All" && e.status !== statusFilter) return false;
    if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <select className={inputCls + " w-auto"} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
          <option value="All">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {["All", "Pending", "Approved", "Rejected"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="All">All categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => exportToExcel(filtered.map(e => ({ Date: e.date, TimeFiled: fmtTime(e.submittedAt), Project: projectName(e.projectId), Category: e.category, Description: e.description, Amount: e.amount, Vendor: e.vendor, Invoice: e.invoiceNo, Status: e.status, SubmittedBy: userName(e.submittedBy) })), "expense_report.xlsx", "Expenses")}
          className="flex items-center gap-2 border border-stone-300 hover:border-stone-400 text-stone-700 font-semibold text-sm px-4 py-2 rounded-lg ml-auto">
          <FileSpreadsheet size={15} /> Export Excel
        </button>
      </div>

      <Card className="p-4 flex items-center justify-between">
        <span className="text-sm text-stone-500">{filtered.length} expense(s) matching filters</span>
        <span className="font-mono font-semibold text-stone-800">{fmtINR(total)}</span>
      </Card>

      <div className="overflow-x-auto bg-white rounded-xl border border-stone-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500 uppercase border-b border-stone-200 bg-stone-50">
              <th className="py-2.5 px-4 font-semibold">Date</th>
              <th className="py-2.5 px-4 font-semibold">Project</th>
              <th className="py-2.5 px-4 font-semibold">Category</th>
              <th className="py-2.5 px-4 font-semibold">Description</th>
              <th className="py-2.5 px-4 font-semibold">Submitted by</th>
              <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <GlobalExpenseRow key={e.id} e={e} projectName={projectName} userName={userName} currentUserId={currentUser.id}
                onApprove={() => actions.approveExpense(e.id, currentUser.id)}
                onReject={(reason) => actions.rejectExpense(e.id, currentUser.id, reason)} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-stone-400 py-8 text-center">No expenses match your filters.</p>}
      </div>
    </div>
  );
}

function GlobalExpenseRow({ e, projectName, userName, currentUserId, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const isOwn = e.submittedBy === currentUserId;
  return (
    <tr className="border-b border-stone-50 hover:bg-stone-50/60 align-top">
      <td className="py-2.5 px-4 whitespace-nowrap text-stone-600">
        {fmtDate(e.date)}
        {e.submittedAt && <div className="text-[10px] text-stone-400 font-mono">Filed {fmtTime(e.submittedAt)}</div>}
      </td>
      <td className="py-2.5 px-4 text-stone-700 max-w-[180px] truncate">{projectName(e.projectId)}</td>
      <td className="py-2.5 px-4"><span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-medium">{e.category}</span></td>
      <td className="py-2.5 px-4 text-stone-800 max-w-[220px]">
        {e.description}
        {e.status === "Rejected" && e.rejectionReason && <div className="text-xs text-rose-600 mt-0.5">Reason: {e.rejectionReason}</div>}
      </td>
      <td className="py-2.5 px-4 text-stone-500">{userName(e.submittedBy)}</td>
      <td className="py-2.5 px-4 text-right font-mono font-semibold text-stone-800 whitespace-nowrap">{fmtINR(e.amount)}</td>
      <td className="py-2.5 px-4"><StatusPill status={e.status} /></td>
      <td className="py-2.5 px-4">
        {e.status === "Pending" && isOwn && (
          <span className="text-[11px] text-stone-400 italic">Submitted by you — needs another approver</span>
        )}
        {e.status === "Pending" && !isOwn && !rejecting && (
          <div className="flex gap-1.5">
            <button onClick={onApprove} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><Check size={14} /></button>
            <button onClick={() => setRejecting(true)} className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"><XCircle size={14} /></button>
          </div>
        )}
        {e.status === "Pending" && !isOwn && rejecting && (
          <div className="flex gap-1.5 items-center min-w-[200px]">
            <input value={reason} onChange={ev => setReason(ev.target.value)} placeholder="Reason…" autoFocus
              onKeyDown={ev => { if (ev.key === "Enter") { onReject(reason || "Not specified"); setRejecting(false); } }}
              className="text-xs border border-stone-300 rounded-md px-2 py-1 w-full" />
            <button onClick={() => { onReject(reason || "Not specified"); setRejecting(false); }} className="text-xs font-semibold text-rose-700 shrink-0">Confirm</button>
            <button onClick={() => { setRejecting(false); setReason(""); }} className="text-xs font-semibold text-stone-400 shrink-0">Cancel</button>
          </div>
        )}
        {e.status !== "Pending" && <span className="text-xs text-stone-300">—</span>}
      </td>
    </tr>
  );
}

/* ---------------------------------------------------------------------- */
/* Team (Admin only)                                                        */
/* ---------------------------------------------------------------------- */

function TeamView({ data, currentUser, actions }) {
  const { users, projects } = data;
  const [editingUser, setEditingUser] = useState(null);

  const ROLE_ORDER = ["Admin", "Accounts", "Architect", "Supervisor"];
  const pending = users.filter(u => u.active === false && !u.removed);
  const active = users.filter(u => u.active !== false && !u.removed).sort((a, b) => {
    const roleDiff = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
    if (roleDiff !== 0) return roleDiff;
    if (a.role === "Architect") return ARCHITECT_RANKS.indexOf(a.rank) - ARCHITECT_RANKS.indexOf(b.rank);
    return a.name.localeCompare(b.name);
  });

  const renderCard = (u) => {
    const assigned = u.role === "Architect"
      ? projects.filter(p => (p.architects || []).includes(u.id))
      : projects.filter(p => p.supervisors.includes(u.id));
    const isActive = u.active !== false;
    const roleLabel = u.role === "Supervisor" ? "Site Supervisor" : u.role === "Architect" ? (u.rank || "Architect") : u.role;
    return (
      <Card key={u.id} className={`p-4 ${!isActive ? "border-amber-300 bg-amber-50/40" : ""}`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full dia-bg-maroon text-white flex items-center justify-center text-sm font-semibold font-display">{u.name.split(" ").map(n => n[0]).join("")}</div>
            <div>
              <div className="font-semibold text-stone-900 text-sm">{u.name}</div>
              <div className="text-xs text-stone-500">{u.email}</div>
            </div>
          </div>
          <button onClick={() => setEditingUser(u)} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 shrink-0">
            <Pencil size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusPill status={isActive ? "Active" : "Pending approval"} />
          <span className="text-xs font-semibold text-stone-600">{roleLabel}</span>
        </div>
        {isActive && (u.role === "Supervisor" || u.role === "Architect") && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <div className="text-xs font-semibold text-stone-500 uppercase mb-1.5">Assigned Projects</div>
            {assigned.length === 0 ? <p className="text-xs text-stone-400">None assigned</p> : assigned.map(p => (
              <div key={p.id} className="text-xs text-stone-700 py-0.5">{p.name}</div>
            ))}
          </div>
        )}
        {!isActive && (
          <button onClick={() => setEditingUser(u)} className="mt-3 w-full text-xs font-semibold dia-btn-gold py-2 rounded-lg">
            Review &amp; activate
          </button>
        )}
      </Card>
    );
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-700 mb-2.5 flex items-center gap-1.5"><AlertTriangle size={14} /> Pending approval ({pending.length})</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map(renderCard)}
          </div>
        </div>
      )}
      <div>
        {pending.length > 0 && <h3 className="text-sm font-semibold text-stone-700 mb-2.5">Team</h3>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map(renderCard)}
        </div>
      </div>
      <p className="text-xs text-stone-400">New teammates create their own account from the sign-in screen — assign their role here once you're ready to activate them.</p>

      {editingUser && (
        <EditUserModal user={editingUser} isSelf={editingUser.id === currentUser.id} onClose={() => setEditingUser(null)}
          onSave={(updates) => { actions.updateUser(editingUser.id, updates); setEditingUser(null); }}
          onRemove={() => { actions.removeUser(editingUser.id); setEditingUser(null); }} />
      )}
    </div>
  );
}

function EditUserModal({ user, isSelf, onClose, onSave, onRemove }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role, rank: user.rank || ARCHITECT_RANKS[2], active: user.active !== false });
  const [error, setError] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    onSave({ name: form.name.trim(), email: form.email.trim(), role: form.role, active: form.active, rank: form.role === "Architect" ? form.rank : null });
  };

  return (
    <Modal title={user.active === false ? "Activate User" : "Edit User"} onClose={onClose}>
      <Field label="Full name"><input className={inputCls} value={form.name} onChange={set("name")} /></Field>
      <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={set("email")} /></Field>
      <Field label="Role">
        <select className={inputCls} value={form.role} onChange={set("role")}>
          {["Admin", "Accounts", "Architect", "Supervisor"].map(r => <option key={r} value={r}>{r === "Supervisor" ? "Site Supervisor" : r}</option>)}
        </select>
      </Field>
      {form.role === "Architect" && (
        <Field label="Architect rank">
          <select className={inputCls} value={form.rank} onChange={set("rank")}>
            {ARCHITECT_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      )}
      <Field label="Account status">
        <button type="button" disabled={isSelf}
          onClick={() => setForm(f => ({ ...f, active: !f.active }))}
          className={`px-3 py-2.5 rounded-lg text-sm font-semibold border w-full text-left transition-colors ${form.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"} ${isSelf ? "opacity-50 cursor-not-allowed" : ""}`}>
          {form.active ? "Active — click to deactivate" : "Pending — click to activate"}
        </button>
        {isSelf && <p className="text-[11px] text-stone-400 mt-1">You can't deactivate your own account.</p>}
        {!isSelf && !form.active && <p className="text-[11px] text-stone-400 mt-1">Inactive users can't sign in.</p>}
      </Field>
      {error && <p className="text-xs text-rose-600 mb-3 -mt-2">{error}</p>}
      <button onClick={handleSave} className="w-full dia-btn-gold font-semibold text-sm py-2.5 rounded-lg mt-1">Save changes</button>

      {!isSelf && onRemove && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          {!confirmingRemove ? (
            <button onClick={() => setConfirmingRemove(true)}
              className="w-full text-xs font-semibold text-rose-600 hover:text-rose-700 py-2 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors">
              Remove from team
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-stone-600">
                This removes <b>{user.name}</b> from Team, unassigns them from every project, and blocks them from signing in.
                Their past site reports, expenses, and photos stay on record. This can't be undone from the app.
              </p>
              <div className="flex gap-2">
                <button onClick={onRemove} className="flex-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 py-2 rounded-lg">
                  Yes, remove {user.name.split(" ")[0]}
                </button>
                <button onClick={() => setConfirmingRemove(false)} className="flex-1 text-xs font-semibold text-stone-600 border border-stone-200 py-2 rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Supervisor Home (mobile-first)                                           */
/* ---------------------------------------------------------------------- */

function SupervisorHome({ data, currentUser, actions }) {
  const myProjects = data.projects.filter(p => p.supervisors.includes(currentUser.id));
  const [activeProjectId, setActiveProjectId] = useState(myProjects[0]?.id || null);
  const [modal, setModal] = useState(null);
  const project = myProjects.find(p => p.id === activeProjectId);

  const myExpenses = data.expenses.filter(e => e.submittedBy === currentUser.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const myReports = project ? data.siteReports.filter(r => r.projectId === project.id).sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
  const progress = project ? computeProjectProgress(data.tasks, project.id, data.siteReports) : 0;
  const openTasks = project ? data.tasks.filter(t => t.projectId === project.id && t.status !== "Completed") : [];

  if (!project) {
    return <div className="p-6 text-center text-stone-500 text-sm">You have no assigned projects yet. Contact your admin.</div>;
  }

  const actionBtn = (icon, label, onClick, colorClass = "bg-white border border-stone-200 text-stone-800") => {
    const Icon = icon;
    return (
      <button onClick={onClick} className={`flex flex-col items-center justify-center gap-2 rounded-2xl py-5 ${colorClass} shadow-sm active:scale-[0.98] transition-transform`}>
        <Icon size={22} />
        <span className="text-xs font-semibold">{label}</span>
      </button>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      {myProjects.length > 1 && (
        <select className={inputCls} value={activeProjectId} onChange={e => setActiveProjectId(e.target.value)}>
          {myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}

      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">{project.type}</div>
        <h2 className="font-display text-lg font-semibold text-stone-900 mt-0.5">{project.name}</h2>
        <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5"><MapPin size={12} /> {project.location}</div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Progress</span><span className="font-semibold text-stone-700">{progress}%</span></div>
          <ProgressBar pct={progress} />
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-stone-700 mb-2.5">Today's Site Report</h3>
        <div className="grid grid-cols-2 gap-3">
          {actionBtn(ClipboardList, "Add Update", () => setModal("report"), "dia-btn-gold")}
          {actionBtn(Receipt, "Add Expense", () => setModal("expense"))}
          {actionBtn(Camera, "Upload Photos", () => setModal("photo"))}
          {actionBtn(AlertTriangle, "Report Issue", () => setModal("issue"), "bg-white border border-rose-200 text-rose-700")}
        </div>
      </div>

      {openTasks.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-2.5">Open Tasks</h3>
          <div className="space-y-2">
            {openTasks.slice(0, 6).map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-stone-50 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm text-stone-800 truncate">{t.name}</div>
                  <div className="text-xs text-stone-400">{t.phase}{isTaskDelayed(t) ? " · delayed" : ""}</div>
                </div>
                <span className="text-xs font-semibold text-stone-600 shrink-0">{t.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold text-stone-700 mb-2.5">My Recent Reports</h3>
        <div className="space-y-2">
          {myReports.slice(0, 3).map(r => (
            <Card key={r.id} className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-stone-800">{fmtDate(r.date)}</span>
                <span className="text-xs font-mono dia-text-bronze font-semibold">{r.pctComplete}%</span>
              </div>
              {r.submittedAt && <div className="text-[11px] text-stone-400 font-mono">Submitted {fmtTime(r.submittedAt)}</div>}
              <p className="text-xs text-stone-500 mt-1 line-clamp-2">{r.workDone}</p>
            </Card>
          ))}
          {myReports.length === 0 && <p className="text-xs text-stone-400">No reports submitted yet.</p>}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-stone-700 mb-2.5">My Submitted Expenses</h3>
        <div className="space-y-2">
          {myExpenses.slice(0, 5).map(e => (
            <Card key={e.id} className="p-3.5 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-800 truncate">{e.description}</div>
                <div className="text-xs text-stone-400">{fmtDate(e.date)} · {e.category}</div>
                {e.submittedAt && <div className="text-[11px] text-stone-400 font-mono">Filed {fmtTime(e.submittedAt)}</div>}
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-sm font-mono font-semibold text-stone-800">{fmtINR(e.amount)}</div>
                <StatusPill status={e.status} />
              </div>
            </Card>
          ))}
          {myExpenses.length === 0 && <p className="text-xs text-stone-400">No expenses submitted yet.</p>}
        </div>
      </div>

      {modal === "report" && <Modal title="Daily Site Report" onClose={() => setModal(null)} wide>
        <SiteReportForm onSave={(rep) => { actions.addSiteReport(project.id, currentUser.id, rep); setModal(null); }} />
      </Modal>}
      {modal === "expense" && <Modal title="Add Expense" onClose={() => setModal(null)}>
        <ExpenseForm defaultProjectId={project.id} onSave={(exp) => { actions.addExpense({ ...exp, projectId: project.id, submittedBy: currentUser.id }); setModal(null); }} />
      </Modal>}
      {modal === "photo" && <Modal title="Upload Site Photo" onClose={() => setModal(null)}>
        <PhotoForm onSave={(p) => { actions.addPhoto(project.id, p); setModal(null); }} />
      </Modal>}
      {modal === "issue" && <Modal title="Report Issue" onClose={() => setModal(null)}>
        <IssueForm onSave={(iss) => { actions.addIssue(project.id, currentUser.id, iss); setModal(null); }} />
      </Modal>}
    </div>
  );
}

function IssueForm({ onSave }) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("Medium");
  return (
    <div>
      <Field label="Describe the issue">
        <textarea className={inputCls} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What happened, and what decision or action is needed?" />
      </Field>
      <Field label="Severity">
        <div className="flex gap-2">
          {["Low", "Medium", "High"].map(s => (
            <button key={s} onClick={() => setSeverity(s)} className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${severity === s ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200"}`}>{s}</button>
          ))}
        </div>
      </Field>
      <button onClick={() => onSave({ description, severity })} disabled={!description}
        className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold text-sm py-2.5 rounded-lg mt-1">Report to management</button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Architect Home (mobile-first)                                            */
/* ---------------------------------------------------------------------- */

function ArchitectHome({ data, currentUser, setView }) {
  const myProjects = data.projects.filter(p => (p.architects || []).includes(currentUser.id));

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">{currentUser.rank}</div>
        <p className="text-sm text-stone-500 mt-1">Tap a project to update its design phases and working-drawings checklist.</p>
      </Card>

      {myProjects.length === 0 && (
        <Card className="p-8 text-center">
          <PenTool size={26} className="mx-auto text-stone-300 mb-2" />
          <p className="text-sm text-stone-400">You're not assigned to any projects yet. Contact your admin.</p>
        </Card>
      )}

      {myProjects.map(p => {
        const phases = data.designPhases.filter(d => d.projectId === p.id).map(effectivePhase);
        const designProgress = computeDesignProgress(data.designPhases, p.id);
        const currentPhase = DESIGN_PHASES.map(phase => phases.find(d => d.phase === phase)).find(d => d && d.status !== "Completed");
        const drawingsPhase = phases.find(d => d.phase === "Working Drawings");
        const drawings = drawingsPhase ? (drawingsPhase.drawings || []).map(effectiveDrawing) : [];
        const drawingsDone = drawings.filter(d => d.status === "Completed").length;
        const drawingsTotal = drawings.length;

        return (
          <button key={p.id} onClick={() => setView({ tab: "project", projectId: p.id, sub: "design" })}
            className="w-full text-left">
            <Card className="p-4 hover:dia-border-gold-soft hover:shadow-md transition-all">
              <div className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">{p.type}</div>
              <h3 className="font-display text-base font-semibold text-stone-900 mt-0.5">{p.name}</h3>
              <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5"><MapPin size={11} /> {p.location}</div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Design progress</span><span className="font-semibold text-stone-700">{designProgress}%</span></div>
                <ProgressBar pct={designProgress} colorClass="bg-sky-500" />
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100 text-xs">
                <span className="text-stone-500">{currentPhase ? `Current: ${currentPhase.phase}` : "All phases complete"}</span>
                {drawingsTotal > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-stone-600"><ListChecks size={12} /> {drawingsDone}/{drawingsTotal} drawings</span>
                )}
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Main App                                                                 */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* App shell states (loading / auth / pending approval / error)             */
/* ---------------------------------------------------------------------- */

function LoadingScreen({ label = "Loading workspace…" }) {
  return (
    <div className="min-h-screen dia-bg-maroon-deep flex items-center justify-center">
      <style>{FONT_STYLE}</style>
      <div className="text-stone-400 text-sm font-body flex items-center gap-2">
        <div className="w-4 h-4 rounded-full animate-spin" style={{ border: "2px solid #57484a", borderTopColor: DIA.goldPale }} />
        {label}
      </div>
    </div>
  );
}

function PendingApprovalScreen({ profile, onLogout }) {
  return (
    <div className="min-h-screen dia-bg-maroon-deep flex items-center justify-center p-4 font-body">
      <style>{FONT_STYLE}</style>
      <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} />
        </div>
        <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">Waiting for approval</h2>
        <p className="text-sm text-stone-500 mb-5">
          Hi {profile?.name?.split(" ")[0] || "there"} — your account is created but needs an administrator to activate it and assign your role before you can sign in.
        </p>
        <button onClick={onLogout} className="w-full dia-btn-gold font-semibold text-sm py-2.5 rounded-lg">Sign out</button>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry, onLogout }) {
  return (
    <div className="min-h-screen dia-bg-maroon-deep flex items-center justify-center p-4 font-body">
      <style>{FONT_STYLE}</style>
      <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} />
        </div>
        <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">Couldn't load your workspace</h2>
        <p className="text-sm text-stone-500 mb-5">{message}</p>
        <div className="flex gap-2">
          <button onClick={onRetry} className="flex-1 dia-btn-gold font-semibold text-sm py-2.5 rounded-lg">Try again</button>
          <button onClick={onLogout} className="flex-1 border border-stone-300 text-stone-700 font-semibold text-sm py-2.5 rounded-lg">Sign out</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Main App                                                                 */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState({ tab: "dashboard" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadProfileAndData = useCallback(async (userId) => {
    setLoading(true);
    setLoadError("");
    try {
      const { data: profileRow, error: profileErr } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (profileErr) throw profileErr;
      setProfile(profileRow);
      if (profileRow.active) {
        const all = await fetchAllData();
        setData(all);
        setView({ tab: profileRow.role === "Supervisor" ? "sup-home" : profileRow.role === "Architect" ? "arch-home" : "dashboard" });
      }
    } catch (err) {
      setLoadError(err.message || "Something went wrong loading your workspace.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadProfileAndData(s.user.id); else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        loadProfileAndData(s.user.id);
      } else {
        setProfile(null); setData(null); setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadProfileAndData]);

  const reload = useCallback(async () => {
    const all = await fetchAllData();
    setData(all);
  }, []);

  const handleLogout = () => { supabase.auth.signOut(); };

  const actions = useMemo(() => ({
    updateUser: (userId, updates) => dbUpdateProfile(userId, updates).then(reload),
    removeUser: (userId) => dbRemoveUser(userId, data?.projects || []).then(reload),
    addProject: (proj) => dbAddProject(proj, data?.users || []).then(reload),
    updateProjectTeam: (projectId, updates) => dbUpdateProject(projectId, updates).then(reload),
    updateTask: (taskId, updates) => dbUpdateTask(taskId, updates).then(reload),
    updateDesignPhase: (phaseId, updates) => dbUpdateDesignPhase(phaseId, updates).then(reload),
    updateDrawingItem: (phaseId, drawingId, updates, updatedBy) => dbUpdateDrawing(drawingId, updates, updatedBy || profile?.id).then(reload),
    addDrawingItem: (phaseId, name) => dbAddDrawing(phaseId, name).then(reload),
    removeDrawingItem: (phaseId, drawingId) => dbRemoveDrawing(drawingId).then(reload),
    addSiteReport: (projectId, supervisorId, rep) => dbAddSiteReport(projectId, supervisorId, rep).then(reload),
    addExpense: (exp) => dbAddExpense(exp).then(reload),
    approveExpense: (id, approverId) => dbApproveExpense(id, approverId).then(reload),
    rejectExpense: (id, approverId, reason) => dbRejectExpense(id, approverId, reason).then(reload),
    deleteExpense: (id) => dbDeleteExpense(id).then(reload),
    addPhoto: (projectId, photo) => dbAddPhoto(projectId, photo).then(reload),
    addIssue: (projectId, supervisorId, issue) => dbAddIssue(projectId, supervisorId, issue).then(reload),
  }), [reload, data, profile]);

  if (loading) return <LoadingScreen />;

  if (!session) {
    return (
      <div className="font-body">
        <style>{FONT_STYLE}</style>
        <LoginScreen />
      </div>
    );
  }

  if (loadError) {
    return <ErrorScreen message={loadError} onRetry={() => loadProfileAndData(session.user.id)} onLogout={handleLogout} />;
  }

  if (!profile || profile.active === false) {
    return <PendingApprovalScreen profile={profile} onLogout={handleLogout} />;
  }

  if (!data) return <LoadingScreen />;

  const currentUser = profile;
  const pendingCount = data.expenses.filter(e => e.status === "Pending").length;
  const notifications = (currentUser.role === "Supervisor" || currentUser.role === "Architect")
    ? (() => {
        const myProjectIds = currentUser.role === "Supervisor"
          ? data.projects.filter(p => p.supervisors.includes(currentUser.id)).map(p => p.id)
          : data.projects.filter(p => (p.architects || []).includes(currentUser.id)).map(p => p.id);
        return data.issues.filter(i => i.status === "Open" && myProjectIds.includes(i.projectId)).slice(0, 5)
          .map(i => ({ text: "Open issue reported", meta: data.projects.find(p => p.id === i.projectId)?.name }));
      })()
    : [
        ...data.expenses.filter(e => e.status === "Pending").slice(0, 3).map(e => ({ text: `Expense awaiting approval: ${e.description}`, meta: fmtINR(e.amount) })),
        ...data.issues.filter(i => i.status === "Open").slice(0, 3).map(i => ({ text: `Open issue reported`, meta: data.projects.find(p => p.id === i.projectId)?.name })),
      ];

  const titles = {
    dashboard: ["Company Dashboard", "Real-time visibility across every project"],
    projects: ["Projects", "All active and completed projects"],
    expenses: ["Expenses", "Review, filter and approve project expenses"],
    users: ["Team", "Admins, accounts, architects and site supervisors"],
    "sup-home": [data.projects.find(p => p.id === view.projectId)?.name || "My Sites", "Site reporting"],
    "arch-home": [data.projects.find(p => p.id === view.projectId)?.name || "My Design Work", "Design phase reporting"],
    project: [data.projects.find(p => p.id === view.projectId)?.name || "Project", null],
  };

  const isStaffOnly = currentUser.role === "Admin" || currentUser.role === "Accounts";
  const isAdmin = currentUser.role === "Admin";

  return (
    <div className="font-body min-h-screen bg-stone-50 flex">
      <style>{FONT_STYLE}</style>
      <Sidebar user={currentUser} view={view} setView={setView} onLogout={handleLogout} pendingCount={pendingCount} />
      <div className="flex-1 min-w-0">
        {view.tab !== "project" && view.tab !== "sup-home" && view.tab !== "arch-home" && (
          <Header title={titles[view.tab]?.[0] || ""} subtitle={titles[view.tab]?.[1]} notifications={notifications} />
        )}
        {view.tab === "sup-home" && <Header title="My Sites" subtitle={`Welcome back, ${currentUser.name.split(" ")[0]}`} notifications={notifications} />}
        {view.tab === "arch-home" && <Header title="My Design Work" subtitle={`Welcome back, ${currentUser.name.split(" ")[0]}`} notifications={notifications} />}

        {view.tab === "dashboard" && (isStaffOnly ? <AdminDashboard data={data} setView={setView} /> : <AccessDenied />)}
        {view.tab === "projects" && (isStaffOnly ? <ProjectsList data={data} setView={setView} actions={actions} currentUser={currentUser} /> : <AccessDenied />)}
        {view.tab === "project" && <ProjectDetail data={data} projectId={view.projectId} sub={view.sub} setView={setView} currentUser={currentUser} actions={actions} />}
        {view.tab === "expenses" && (isStaffOnly ? <ExpensesGlobal data={data} currentUser={currentUser} actions={actions} /> : <AccessDenied />)}
        {view.tab === "users" && (isAdmin ? <TeamView data={data} currentUser={currentUser} actions={actions} /> : <AccessDenied />)}
        {view.tab === "sup-home" && <SupervisorHome data={data} currentUser={currentUser} actions={actions} />}
        {view.tab === "arch-home" && <ArchitectHome data={data} currentUser={currentUser} setView={setView} />}
      </div>
    </div>
  );
}
