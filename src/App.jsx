import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from "recharts";
import {
  LayoutDashboard, Building2, Receipt, Users, Bell, LogOut, Plus, Check, X,
  Camera, ClipboardList, AlertTriangle, Calendar, MapPin, ChevronRight,
  ChevronLeft, Download, Search, ArrowLeft, Image as ImageIcon, IndianRupee,
  TrendingUp, Clock, CheckCircle2, XCircle, Filter, FileSpreadsheet, Eye, EyeOff, Pencil,
  PenTool, ListChecks, Paperclip, FileText, AlertCircle, Trash2, Store, Landmark, Upload,
  ChevronDown, Copy, Calculator
} from "lucide-react";

import { supabase } from "./lib/supabaseClient";
import {
  PHASE_TEMPLATE, EXPENSE_CATEGORIES, PAYMENT_METHODS, PROJECT_STATUSES, PROJECT_TYPES,
  ARCHITECT_RANKS, DESIGN_PHASES, CONTRACT_TYPES, DRAWING_STATUSES,
  TODAY, DIA, FONT_STYLE, LOGO_MARK, LOGO_FULL,
} from "./lib/constants";
import {
  fmtINR, fmtDate, fmtTime, daysBetween, clamp,
  isTaskDelayed, computeProjectSpend, computeProjectProgress, computeDesignProgress,
  hasProof, effectivePhase, effectiveDrawing,
  computeHealth, HEALTH_META, exportToExcel, computeMissedReportSlots,
} from "./lib/helpers";
import {
  fetchAllData, dbUpdateProfile, dbRemoveUser, dbAdminCreateUser, dbAdminResetPassword, dbAddProject, dbUpdateProject, dbDeleteProject, dbUpdateTask,
  dbUpdateDesignPhase, dbUpdateDrawing, dbAddDrawing, dbRemoveDrawing,
  dbAddSiteReport, dbAddPhoto, dbAddExpense, dbApproveExpense, dbRejectExpense, dbDeleteExpense, dbMarkExpensePaid, dbGeneratePO, dbAddIssue,
  dbAddVendor, dbUpdateVendor, dbDeleteVendor,
  dbAddQuotation, dbUpdateQuotation, dbUpdateQuotationStatus, dbDeleteQuotation, dbDuplicateQuotation,
  dbAddBoqLibraryItem, dbUpdateBoqLibraryItem, dbDeleteBoqLibraryItem, dbTouchBoqLibraryItem,
  dbAddMaterialRequest, dbApproveMaterialRequest, dbRejectMaterialRequest, dbDeleteMaterialRequest,
  dbMarkMaterialReceived, dbFulfillMaterialRequest,
  dbStartSiteVisit, dbEndSiteVisit,
  uploadProofFile, uploadSitePhoto, uploadSignature,
} from "./lib/dataStore";
import { generatePOPdf } from "./lib/generatePO";
import { generateQuotationPdf } from "./lib/generateQuotation";
import { generateWorkQuotePdf, workQuoteTotals, lineTotal } from "./lib/generateWorkQuote";
import { generateBOQPdf } from "./lib/generateBOQ";
import { exportBOQExcel } from "./lib/exportBOQExcel";
import { parseBOQFile } from "./lib/importBOQ";
import {
  QUOTATION_STATUSES, QUOTATION_SERVICE_LINES, QUOTATION_SCOPE_TEMPLATE, QUOTATION_PAYMENT_TEMPLATE,
  QUOTATION_SIGNATORY, WORK_QUOTE_TERMS, WORK_QUOTE_UNITS,
  BOQ_MATERIAL_SPECS, BOQ_EXCLUSIONS, BOQ_PAYMENT_TEMPLATE, BOQ_UNITS, BOQ_GST_NOTES,
  blankQuotation, blankWorkQuote, blankBOQ, computeStageAmounts, amountInWords,
  boqItemQty, boqItemAmount, boqItemIsOverridden, boqSectionTotal, boqTotals, sectionCode,
} from "./lib/quotationDefaults";

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
    <Card className="p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-stone-500 font-semibold font-body truncate">{label}</div>
          <div className="text-base sm:text-2xl font-display font-semibold text-stone-900 mt-1 break-words">{value}</div>
          {sub && <div className="text-[11px] sm:text-xs text-stone-500 mt-1 font-body truncate">{sub}</div>}
        </div>
        {Icon && <div className="p-1.5 sm:p-2 rounded-lg dia-bg-cream-soft shrink-0"><Icon size={16} className="dia-text-bronze sm:hidden" /><Icon size={18} className="dia-text-bronze hidden sm:block" /></div>}
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

/* Full-screen photo viewer. Pinch-to-zoom works natively on mobile since we
   don't block it (no user-scalable=no, and the image container allows the
   browser's own pinch gesture). For mouse users, clicking the image toggles
   a 2.5x zoom centered on the click point. */
function Lightbox({ url, caption, meta, onClose }) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("center center");

  const handleImageClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
    setZoomed(z => !z);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col" style={{ touchAction: "pinch-zoom pan-x pan-y" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="min-w-0 text-white/80 text-xs">{meta}</div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white shrink-0"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center px-2 pb-2">
        <img
          src={url}
          alt={caption || ""}
          onClick={handleImageClick}
          className="max-w-full max-h-full object-contain cursor-zoom-in transition-transform duration-200 select-none"
          style={{ transform: zoomed ? "scale(2.5)" : "scale(1)", transformOrigin: origin, cursor: zoomed ? "zoom-out" : "zoom-in" }}
          draggable={false}
        />
      </div>
      {caption && <div className="px-4 py-3 text-center text-white text-sm shrink-0">{caption}</div>}
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
        <p className="text-center text-white/30 text-[11px] mt-3">© Designed and developed by Kash.d Studios</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* App Shell (Sidebar + Header)                                             */
/* ---------------------------------------------------------------------- */

function Sidebar({ user, view, setView, onLogout, pendingCount, mobileOpen, onCloseMobile }) {
  const adminNav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "updates", label: "Updates", icon: ImageIcon },
    { key: "projects", label: "Projects", icon: Building2 },
    { key: "expenses", label: "Expenses", icon: Receipt, badge: pendingCount },
    { key: "quotations", label: "Quotations", icon: FileText },
    { key: "vendors", label: "Vendors", icon: Store },
    { key: "users", label: "Team", icon: Users },
  ];
  const accountsNav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "projects", label: "Projects", icon: Building2 },
    { key: "expenses", label: "Expenses", icon: Receipt, badge: pendingCount },
    { key: "quotations", label: "Quotations", icon: FileText },
    { key: "vendors", label: "Vendors", icon: Store },
  ];
  const supNav = [
    { key: "sup-home", label: "My Sites", icon: LayoutDashboard },
  ];
  const archNav = [
    { key: "arch-home", label: "My Design Work", icon: PenTool },
  ];
  const nav = user.role === "Admin" ? adminNav : user.role === "Accounts" ? accountsNav : user.role === "Architect" ? archNav : supNav;

  return (
    <>
      {mobileOpen && (
        <div onClick={onCloseMobile} className="fixed inset-0 bg-black/40 z-40 sm:hidden" aria-hidden="true" />
      )}
      <div className={`w-64 sm:w-60 dia-bg-maroon-deep h-[100dvh] sm:h-screen flex flex-col shrink-0 fixed sm:sticky top-0 left-0 z-50 sm:z-auto transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} sm:translate-x-0`}>
        <div className="px-5 py-6 flex items-center justify-center border-b dia-border-maroon-line relative shrink-0">
          <img src={LOGO_FULL} alt="Dia Retail Solutions" className="h-28 object-contain" />
          <button onClick={onCloseMobile} className="sm:hidden absolute right-3 top-3 p-1.5 rounded-lg dia-text-cream-70 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pt-3 pb-1 text-center shrink-0">
          <p className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">
            Greetings, {user.name.toUpperCase()}
          </p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const Icon = item.icon;
            const active = view.tab === item.key;
            return (
              <button key={item.key} onClick={() => { setView({ tab: item.key }); onCloseMobile(); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors font-body ${active ? "dia-btn-gold" : "dia-text-cream-70 dia-hover-maroon hover:text-white"}`}>
                <span className="flex items-center gap-2.5"><Icon size={16} /> {item.label}</span>
                {!!item.badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${active ? "bg-white dia-text-bronze" : "dia-btn-gold"}`}>{item.badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t dia-border-maroon-line shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
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
    </>
  );
}

function Header({ title, subtitle, notifications, onMenuClick, onNotificationClick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-stone-200 bg-white/70 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        {onMenuClick && (
          <button onClick={onMenuClick} className="sm:hidden p-2 -ml-2 rounded-lg hover:bg-stone-100 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-700"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-lg sm:text-2xl font-semibold text-stone-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-stone-500 mt-0.5 flex items-center gap-2 truncate"><span className="dia-diamond shrink-0" style={{ width: 4, height: 4 }} /><span className="truncate">{subtitle}</span></p>}
        </div>
      </div>
      <div className="relative shrink-0">
        <button onClick={() => setOpen(o => !o)} className="p-2 rounded-lg hover:bg-stone-100 relative">
          <Bell size={19} className="text-stone-600" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-rose-600 text-white text-[10px] font-bold rounded-full">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-80 bg-white border border-stone-200 rounded-xl shadow-xl z-30 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-stone-100 font-semibold text-sm text-stone-800 flex items-center justify-between">
              <span>Needs your attention</span>
              {notifications.length > 0 && <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">{notifications.length}</span>}
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-stone-400">You're all caught up.</div>
            ) : notifications.map((n, i) => (
              <button key={i} onClick={() => { if (n.view && onNotificationClick) { onNotificationClick(n.view); setOpen(false); } }}
                className="w-full text-left px-4 py-3 border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
                <div className="text-sm text-stone-800">{n.text}</div>
                <div className="text-xs text-stone-400 mt-0.5 flex items-center justify-between">
                  <span>{n.meta}</span>
                  {n.view && <span className="dia-text-bronze font-semibold shrink-0 ml-2">Review →</span>}
                </div>
              </button>
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
    <div className="p-4 sm:p-8 space-y-6">
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
    <div className="p-4 sm:p-8 space-y-5">
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
          const isDesigningCard = p.contractType === "Designing";
          const progress = isDesigningCard ? computeDesignProgress(data.designPhases, p.id) : computeProjectProgress(tasks, p.id, siteReports);
          const spend = computeProjectSpend(expenses, p.id);
          return (
            <button key={p.id} onClick={() => setView({ tab: "project", projectId: p.id, sub: "overview" })}
              className="text-left">
              <Card className="p-5 h-full hover:dia-border-gold-soft hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">{p.type}</span>
                      <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${isDesigningCard ? "bg-sky-50 text-sky-700" : "bg-stone-100 text-stone-600"}`}>{p.contractType}</span>
                      {p.estimatedCost > 0 && spend.approved > p.estimatedCost && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 flex items-center gap-1">
                          <AlertTriangle size={9} /> Over budget
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-base font-semibold text-stone-900 mt-0.5">{p.name}</h3>
                  </div>
                  <HealthBadge health={health} />
                </div>
                <div className="text-xs text-stone-500 space-y-1 mb-3">
                  <div className="flex items-center gap-1.5"><MapPin size={11} /> {p.location}</div>
                  <div className="flex items-center gap-1.5"><Calendar size={11} /> {fmtDate(p.startDate)} → {fmtDate(p.plannedEnd)}</div>
                </div>
                <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">{isDesigningCard ? "Design progress" : "Progress"}</span><span className="font-semibold text-stone-700">{progress}%</span></div>
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
  const overBudget = project.estimatedCost > 0 && spend.approved > project.estimatedCost;
  const overAmount = spend.approved - project.estimatedCost;

  const items = [
    ["Contract Value", fmtINR(project.contractValue), false],
    ["Estimated Cost", fmtINR(project.estimatedCost), false],
    ["Actual Cost (Approved)", fmtINR(spend.approved), overBudget],
    ["Pending Expenses", fmtINR(spend.pending), false],
    ["Remaining Est. Budget", fmtINR(remainingBudget), remainingBudget < 0],
    ["Projected Profit", fmtINR(projectedProfit), false],
    ["Actual Profit (to date)", fmtINR(actualProfit), actualProfit < 0],
    ["Estimated Margin", estMargin.toFixed(1) + "%", false],
    ["Actual Margin (to date)", actMargin.toFixed(1) + "%", actMargin < 0],
  ];

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold text-stone-900 mb-4">Project Cost Dashboard</h3>
      {overBudget && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-lg px-3 py-2.5 mb-4">
          <AlertTriangle size={15} className="shrink-0" />
          Approved expenses have gone {fmtINR(overAmount)} over the estimated cost.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items.map(([label, val, warn]) => (
          <div key={label}>
            <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wide">{label}</div>
            <div className={`text-lg font-mono font-semibold mt-0.5 ${warn ? "text-rose-600" : "text-stone-900"}`}>{val}</div>
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

const REPORT_SLOTS = ["Opening", "Midday", "Closing"];

function inferReportType() {
  const h = new Date().getHours();
  if (h < 12) return "Opening";
  if (h < 16) return "Midday";
  return "Closing";
}

function ReportsTab({ project, reports, users, currentUser, canAdd, onAdd }) {
  const [showModal, setShowModal] = useState(null); // report_type being filled, or null
  const userName = (id) => users.find(u => u.id === id)?.name || id;

  const byDate = {};
  reports.forEach(r => { byDate[r.date] = byDate[r.date] || []; byDate[r.date].push(r); });
  const dates = Object.keys(byDate).sort((a, b) => new Date(b) - new Date(a));
  const todayStr = TODAY.toISOString().slice(0, 10);
  if (!dates.includes(todayStr)) dates.unshift(todayStr);

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-400">Three reports are expected each day from the site supervisor — Opening, Midday, and Closing.</p>
      {dates.map(d => {
        const dayReports = byDate[d] || [];
        const isToday = d === todayStr;
        const isFuture = new Date(d) > new Date(todayStr);
        return (
          <Card key={d} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-stone-900 text-sm">{fmtDate(d)}{isToday ? " · Today" : ""}</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {REPORT_SLOTS.map(slot => {
                const slotReports = dayReports.filter(r => r.reportType === slot);
                const missing = slotReports.length === 0 && !isFuture;
                return (
                  <div key={slot} className={`rounded-lg border p-3 ${slotReports.length ? "border-emerald-200 bg-emerald-50/40" : missing ? "border-amber-200 bg-amber-50/40" : "border-stone-200 bg-stone-50"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-stone-700">{slot}</span>
                      {canAdd && isToday && (
                        <button onClick={() => setShowModal(slot)} className="text-[10px] font-semibold dia-text-bronze hover:underline">
                          {slotReports.some(r => r.supervisorId === currentUser.id) ? "Add another" : "Submit"}
                        </button>
                      )}
                    </div>
                    {slotReports.length === 0 ? (
                      <p className={`text-xs ${missing ? "text-amber-600 font-semibold" : "text-stone-400"}`}>{missing ? "Missing" : "—"}</p>
                    ) : (
                      <div className="space-y-1">
                        {slotReports.map(r => (
                          <div key={r.id} className="text-[11px] text-stone-600">
                            <span className="font-semibold">{userName(r.supervisorId)}</span> · {fmtTime(r.submittedAt)}
                            {r.pctComplete != null && <span className="text-stone-400"> · {r.pctComplete}%</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {dayReports.length > 0 && (
              <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
                {dayReports.map(r => (
                  <details key={r.id} className="text-xs">
                    <summary className="cursor-pointer font-semibold text-stone-600">{r.reportType} report by {userName(r.supervisorId)} — details</summary>
                    <div className="grid sm:grid-cols-2 gap-2 mt-2 text-stone-700">
                      <div><span className="font-semibold text-stone-500 uppercase text-[10px]">Work done</span><p>{r.workDone || "—"}</p></div>
                      <div><span className="font-semibold text-stone-500 uppercase text-[10px]">Planned next</span><p>{r.workPlanned || "—"}</p></div>
                      <div><span className="font-semibold text-stone-500 uppercase text-[10px]">Materials received</span><p>{r.materialsReceived || "—"}</p></div>
                      <div><span className="font-semibold text-stone-500 uppercase text-[10px]">Materials needed</span><p>{r.materialsNeeded || "—"}</p></div>
                      {r.issues && <div className="sm:col-span-2"><span className="font-semibold text-rose-600 uppercase text-[10px]">Issues</span><p>{r.issues}</p></div>}
                      {r.remarks && <div className="sm:col-span-2"><span className="font-semibold text-stone-500 uppercase text-[10px]">Remarks</span><p>{r.remarks}</p></div>}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {showModal && <Modal title={`${showModal} Report — Today`} onClose={() => setShowModal(null)} wide>
        <SiteReportForm reportType={showModal} onSave={(rep) => { onAdd(rep); setShowModal(null); }} />
      </Modal>}
    </div>
  );
}

function SiteReportForm({ onSave, reportType }) {
  const [form, setForm] = useState({
    date: TODAY.toISOString().slice(0, 10), reportType: reportType || inferReportType(),
    workers: "", workDone: "", workInProgress: "", workPlanned: "",
    materialsReceived: "", materialsNeeded: "", issues: "", delays: "", pctComplete: 0, remarks: ""
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Report">
          <select className={inputCls} value={form.reportType} onChange={set("reportType")} disabled={!!reportType}>
            {REPORT_SLOTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
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

function ExpensesTab({ project, expenses, users, vendors, currentUser, canApprove, canAdd, onAdd, onApprove, onReject, onDelete, onMarkPaid, onGeneratePO }) {
  const [showModal, setShowModal] = useState(false);
  const list = expenses
    .filter(e => e.projectId === project.id)
    .filter(e => canApprove || e.submittedBy === currentUser.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const userName = (id) => users.find(u => u.id === id)?.name || id;

  return (
    <div className="space-y-4">
      {!canApprove && (
        <p className="text-xs text-stone-400">You're seeing only the expenses you've submitted. Admin and Accounts can see every expense on this project.</p>
      )}
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
              <ExpenseRow key={e.id} e={e} userName={userName} canApprove={canApprove} currentUserId={currentUser.id} onApprove={onApprove} onReject={onReject} onDelete={onDelete} onMarkPaid={onMarkPaid} onGeneratePO={onGeneratePO}
                onDownloadPO={() => generatePOPdf({ expense: e, vendor: vendors.find(v => v.id === e.vendorId), project, generatedByName: userName(e.poGeneratedBy) })} />
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">No expenses recorded for this project yet.</p>}
      </div>
      {showModal && <Modal title="Add Expense" onClose={() => setShowModal(false)}>
        <ExpenseForm defaultProjectId={project.id} vendors={vendors} onSave={(exp) => { onAdd(exp); setShowModal(false); }} />
      </Modal>}
    </div>
  );
}

function ExpenseRow({ e, userName, canApprove, currentUserId, onApprove, onReject, onDelete, onMarkPaid, onGeneratePO, onDownloadPO }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isOwn = e.submittedBy === currentUserId;
  const pending = e.totalInvoiceValue != null ? e.totalInvoiceValue - e.advancePaid : null;
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
      <td className="py-2.5 pr-3 text-stone-500">
        {e.vendor}
        {(e.totalInvoiceValue != null || e.proofUrl || e.poNumber) && (
          <div className="text-[10px] text-stone-400 mt-0.5 space-y-0.5">
            {e.totalInvoiceValue != null && <div>Invoice {fmtINR(e.totalInvoiceValue)} · Paid {fmtINR(e.advancePaid)} · Due <b className="text-stone-600">{fmtINR(pending)}</b></div>}
            {e.proofUrl && <a href={e.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 dia-text-bronze hover:underline"><Paperclip size={10} /> Attachment</a>}
            {e.poNumber && <div className="font-mono font-semibold dia-text-bronze flex items-center gap-2">{e.poNumber}{onDownloadPO && <button onClick={onDownloadPO} className="text-stone-400 hover:dia-text-bronze" title="Download PO PDF"><Download size={11} /></button>}</div>}
          </div>
        )}
      </td>
      <td className="py-2.5 pr-3 text-stone-500">{userName(e.submittedBy)}</td>
      <td className="py-2.5 pr-3 text-right font-mono font-semibold text-stone-800 whitespace-nowrap">{fmtINR(e.amount)}</td>
      <td className="py-2.5 pr-3">
        <StatusPill status={e.status} />
        {e.status === "Approved" && (
          e.paid
            ? <div className="text-[10px] text-emerald-600 font-semibold mt-1">Paid{e.paidAt ? ` ${fmtDate(e.paidAt)}` : ""}</div>
            : <div className="text-[10px] text-amber-600 font-semibold mt-1">Payment due</div>
        )}
      </td>
      {canApprove && (
        <td className="py-2.5 pr-3">
          {confirmingDelete ? (
            <div className="flex gap-1.5 items-center min-w-[170px]">
              <span className="text-[11px] text-stone-500">Delete this expense?</span>
              <button onClick={() => onDelete(e.id)} className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded-md shrink-0">Delete</button>
              <button onClick={() => setConfirmingDelete(false)} className="text-xs font-semibold text-stone-500 shrink-0">Cancel</button>
            </div>
          ) : (
            <div className="flex gap-1.5 items-center flex-wrap">
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
              {e.status === "Approved" && onMarkPaid && (
                <button onClick={() => onMarkPaid(e.id, !e.paid)}
                  className={`text-[11px] font-semibold px-2 py-1 rounded-md ${e.paid ? "text-stone-500 border border-stone-200 hover:bg-stone-50" : "text-white bg-amber-600 hover:bg-amber-700"}`}>
                  {e.paid ? "Mark unpaid" : "Mark paid"}
                </button>
              )}
              {onGeneratePO && !e.poNumber && (
                <button onClick={() => onGeneratePO(e.id)} disabled={!e.vendorId} title={!e.vendorId ? "Link a vendor to this expense first" : "Generate PO"}
                  className="text-[11px] font-semibold text-white bg-stone-800 hover:bg-stone-900 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded-md">
                  Generate PO
                </button>
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

function ExpenseForm({ onSave, defaultProjectId, projects, vendors }) {
  const [form, setForm] = useState({
    projectId: defaultProjectId || (projects && projects[0]?.id) || "",
    date: TODAY.toISOString().slice(0, 10), category: EXPENSE_CATEGORIES[0], description: "",
    amount: "", paymentMethod: PAYMENT_METHODS[0], vendorId: "", invoiceNo: "", notes: "",
    totalInvoiceValue: "", advancePaid: "", proof: null,
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const pending = (Number(form.totalInvoiceValue) || 0) - (Number(form.advancePaid) || 0);
  const selectedVendor = (vendors || []).find(v => v.id === form.vendorId);
  const canSubmit = form.description && form.amount && form.projectId && form.vendorId && form.proof;

  const handleSave = () => {
    const vendor = vendors.find(v => v.id === form.vendorId);
    onSave({
      ...form,
      amount: Number(form.amount),
      vendor: vendor?.name || "",
      totalInvoiceValue: form.totalInvoiceValue === "" ? null : Number(form.totalInvoiceValue),
      advancePaid: form.advancePaid === "" ? 0 : Number(form.advancePaid),
      proofUrl: form.proof?.dataUrl || null,
    });
  };

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
      <Field label="Reason for expense"><input className={inputCls} value={form.description} onChange={set("description")} placeholder="e.g. Marble slabs — flooring" /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Amount (₹)"><input type="number" className={inputCls} value={form.amount} onChange={set("amount")} /></Field>
        <Field label="Payment method">
          <select className={inputCls} value={form.paymentMethod} onChange={set("paymentMethod")}>
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Vendor">
        {(vendors || []).length > 0 ? (
          <select className={inputCls} value={form.vendorId} onChange={set("vendorId")}>
            <option value="">Select a vendor…</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.material ? ` — ${v.material}` : ""}</option>)}
          </select>
        ) : (
          <p className="text-xs text-stone-400 border border-dashed border-stone-300 rounded-lg py-2.5 px-3">No vendors added yet — ask an Admin or Accounts to add one under Vendors first.</p>
        )}
        {selectedVendor && !selectedVendor.bankAccountNumber && (
          <p className="text-[11px] text-amber-600 mt-1">This vendor has no bank details on file yet — Accounts won't be able to pay them until that's added.</p>
        )}
      </Field>
      <Field label="Bill / invoice number"><input className={inputCls} value={form.invoiceNo} onChange={set("invoiceNo")} /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Total invoice value (₹)"><input type="number" className={inputCls} value={form.totalInvoiceValue} onChange={set("totalInvoiceValue")} placeholder="Full vendor bill amount" /></Field>
        <Field label="Advance already paid (₹)"><input type="number" className={inputCls} value={form.advancePaid} onChange={set("advancePaid")} /></Field>
      </div>
      {form.totalInvoiceValue !== "" && (
        <p className="text-xs text-stone-500 -mt-2 mb-3">Pending balance to vendor: <b className="text-stone-700 font-mono">{fmtINR(pending)}</b></p>
      )}
      <Field label="Notes (optional)"><textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} /></Field>
      <ProofAttachment proof={form.proof} onChange={(p) => setForm(f => ({ ...f, proof: p }))} required pathPrefix="expenses" />
      <button onClick={handleSave} disabled={!canSubmit}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">Submit expense</button>
      {!canSubmit && <p className="text-[11px] text-stone-400 mt-2 text-center">Vendor and a receipt/invoice attachment are required to submit.</p>}
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
    name: "", client: "", location: "", type: PROJECT_TYPES[0], contractType: CONTRACT_TYPES[0], area: "",
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
        <Field label="Category">
          <select className={inputCls} value={form.type} onChange={set("type")}>
            {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Contract type">
        <div className="flex gap-2">
          {CONTRACT_TYPES.map(ct => (
            <button key={ct} type="button" onClick={() => setForm(f => ({ ...f, contractType: ct }))}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${form.contractType === ct ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}`}>
              {ct}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-stone-400 mt-1">
          {form.contractType === "Designing" ? "Design-only: no construction site work — the timeline runs through site discussion → schematic → renders → walkthrough → presentation → handover." : "Turnkey: full design + construction, including site reporting and a construction timeline."}
        </p>
      </Field>
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
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
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
              <button key={i} onClick={() => p.url && setLightboxPhoto(p)}
                className="rounded-lg overflow-hidden border border-stone-200 bg-stone-100 aspect-square flex items-center justify-center relative">
                {p.url ? <img src={p.url} alt={p.caption} className="w-full h-full object-cover" /> : <ImageIcon size={22} className="text-stone-300" />}
                <div className="absolute bottom-0 inset-x-0 bg-stone-900/70 text-white text-[10px] px-2 py-1 truncate text-left">
                  {p.caption || p.category}{p.uploadedAt ? ` · ${fmtTime(p.uploadedAt)}` : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {showModal && <Modal title="Upload Site Photo" onClose={() => setShowModal(false)}>
        <PhotoForm onSave={(p) => { onAddPhoto(p); setShowModal(false); }} />
      </Modal>}
      {lightboxPhoto && (
        <Lightbox url={lightboxPhoto.url} caption={lightboxPhoto.caption}
          meta={`${fmtDate(lightboxPhoto.date)}${lightboxPhoto.uploadedAt ? " · " + fmtTime(lightboxPhoto.uploadedAt) : ""}`}
          onClose={() => setLightboxPhoto(null)} />
      )}
    </div>
  );
}

function MaterialsTab({ project, requests, users, vendors, currentUser, isAdmin, canRequest, isAssignedSupervisor, onAdd, onApprove, onReject, onDelete, onMarkReceived, onFulfill, onGeneratePO }) {
  const [showModal, setShowModal] = useState(false);
  const userName = (id) => users.find(u => u.id === id)?.name || id;
  const sorted = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const active = sorted.filter(r => r.status === "Pending" || r.status === "Approved" || r.status === "Received");
  const done = sorted.filter(r => r.status === "Fulfilled" || r.status === "Rejected");

  return (
    <div className="space-y-4">
      {canRequest && <button onClick={() => setShowModal(true)} className="flex items-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg">
        <Plus size={16} /> Request Materials
      </button>}

      {sorted.length === 0 && (
        <Card className="p-8 text-center">
          <Store size={26} className="mx-auto text-stone-300 mb-2" />
          <p className="text-sm text-stone-400">No material requests yet. Architects can raise what's needed on site here, for Admin to approve.</p>
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(r => <MaterialRequestRow key={r.id} r={r} userName={userName} vendors={vendors} isAdmin={isAdmin} isAssignedSupervisor={isAssignedSupervisor}
            onApprove={onApprove} onReject={onReject} onDelete={onDelete} onMarkReceived={onMarkReceived} onFulfill={onFulfill} onGeneratePO={onGeneratePO} />)}
        </div>
      )}

      {done.length > 0 && (
        <div>
          {active.length > 0 && <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 mt-4">Earlier requests</div>}
          <div className="space-y-2">
            {done.map(r => <MaterialRequestRow key={r.id} r={r} userName={userName} vendors={vendors} isAdmin={isAdmin} isAssignedSupervisor={isAssignedSupervisor}
              onApprove={onApprove} onReject={onReject} onDelete={onDelete} onMarkReceived={onMarkReceived} onFulfill={onFulfill} onGeneratePO={onGeneratePO} />)}
          </div>
        </div>
      )}

      {showModal && <Modal title="Request Materials" onClose={() => setShowModal(false)}>
        <MaterialRequestForm isAdmin={isAdmin} onSave={(req, autoApprove) => { onAdd(req, autoApprove); setShowModal(false); }} />
      </Modal>}
    </div>
  );
}

function MaterialRequestRow({ r, userName, vendors, isAdmin, isAssignedSupervisor, onApprove, onReject, onDelete, onMarkReceived, onFulfill, onGeneratePO }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const statusColor = r.status === "Approved" ? "border-emerald-200 bg-emerald-50/40"
    : r.status === "Rejected" ? "border-rose-200 bg-rose-50/30"
    : r.status === "Received" ? "border-sky-200 bg-sky-50/40"
    : r.status === "Fulfilled" ? "border-stone-200 bg-stone-50"
    : "border-amber-200 bg-amber-50/30";
  const vendor = vendors?.find(v => v.id === r.vendorId);

  return (
    <Card className={`p-4 ${statusColor}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={r.status} />
            <span className="text-[11px] text-stone-400">Requested by {userName(r.requestedBy)} · {fmtDate(r.createdAt)}</span>
          </div>
          <p className="text-sm font-semibold text-stone-800 mt-1.5 whitespace-pre-wrap">{r.items}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-stone-500 mt-1">
            {r.quantity && <span>Qty: {r.quantity}</span>}
            {r.neededBy && <span>Needed by: {fmtDate(r.neededBy)}</span>}
          </div>
          {r.notes && <p className="text-xs text-stone-500 mt-1">{r.notes}</p>}
          {r.status === "Rejected" && r.rejectionReason && <p className="text-xs text-rose-600 mt-1">Reason: {r.rejectionReason}</p>}
          {r.status === "Approved" && <p className="text-xs text-emerald-700 font-semibold mt-1">Approved — site supervisor can confirm once received.</p>}
          {(r.status === "Received" || r.status === "Fulfilled") && (
            <div className="text-xs text-stone-600 mt-1.5 bg-white/70 rounded-lg px-2.5 py-1.5 space-y-0.5">
              <div>Received by {userName(r.receivedBy)} · {r.receivedAt && fmtDate(r.receivedAt.slice(0, 10))}</div>
              <div>Vendor: {vendor?.name || "—"} · Amount: {fmtINR(r.amount)}</div>
              {r.receiptPhotoUrl && <a href={r.receiptPhotoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 dia-text-bronze hover:underline"><Paperclip size={10} /> Delivery photo</a>}
              {r.status === "Fulfilled" && <div className="text-emerald-700 font-semibold">Expense logged (pre-approved) — PO can be generated.</div>}
            </div>
          )}
        </div>
        <div className="flex gap-1.5 items-center shrink-0 flex-wrap">
          {r.status === "Approved" && isAssignedSupervisor && !showReceiveForm && (
            <button onClick={() => setShowReceiveForm(true)} className="text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-lg">
              Confirm Received
            </button>
          )}
          {r.status === "Received" && isAdmin && (
            <button onClick={() => onFulfill(r.id)} className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg">
              Confirm &amp; Log Expense
            </button>
          )}
          {r.status === "Fulfilled" && isAdmin && onGeneratePO && (
            <button onClick={() => onGeneratePO(r.expenseId)} className="text-xs font-semibold text-white bg-stone-800 hover:bg-stone-900 px-3 py-1.5 rounded-lg">
              Generate PO
            </button>
          )}
          {isAdmin && (
            confirmingDelete ? (
              <>
                <span className="text-[11px] text-stone-500">Delete?</span>
                <button onClick={() => onDelete(r.id)} className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded-md">Delete</button>
                <button onClick={() => setConfirmingDelete(false)} className="text-xs font-semibold text-stone-500">Cancel</button>
              </>
            ) : (
              <>
                {r.status === "Pending" && !rejecting && (
                  <>
                    <button onClick={() => onApprove(r.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><Check size={14} /></button>
                    <button onClick={() => setRejecting(true)} className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"><XCircle size={14} /></button>
                  </>
                )}
                {r.status === "Pending" && rejecting && (
                  <div className="flex gap-1.5 items-center min-w-[180px]">
                    <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason…" className="text-xs border border-stone-300 rounded-md px-2 py-1 w-full" />
                    <button onClick={() => { onReject(r.id, reason || "Not specified"); setRejecting(false); }} className="text-xs font-semibold text-rose-700 shrink-0">Confirm</button>
                  </div>
                )}
                <button onClick={() => setConfirmingDelete(true)} title="Delete request" className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
              </>
            )
          )}
        </div>
      </div>
      {showReceiveForm && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <ReceiveMaterialForm vendors={vendors}
            onSave={async (fields) => { await onMarkReceived(r.id, fields); setShowReceiveForm(false); }}
            onCancel={() => setShowReceiveForm(false)} />
        </div>
      )}
    </Card>
  );
}

function ReceiveMaterialForm({ vendors, onSave, onCancel }) {
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canSubmit = vendorId && amount && proof;

  const handleSave = async () => {
    setError("");
    setBusy(true);
    try {
      await onSave({ vendorId, amount: Number(amount), receiptPhotoUrl: proof?.dataUrl });
    } catch (err) {
      setError(err.message || "Something went wrong — please try again.");
      setBusy(false);
    }
  };

  return (
    <div>
      <Field label="Vendor">
        <select className={inputCls} value={vendorId} onChange={e => setVendorId(e.target.value)}>
          <option value="">Select a vendor…</option>
          {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </Field>
      <Field label="Amount paid (₹)"><input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} /></Field>
      <ProofAttachment proof={proof} onChange={setProof} required pathPrefix="materials" />
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      <div className="flex gap-2 mt-1">
        <button onClick={handleSave} disabled={!canSubmit || busy}
          className="flex-1 dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2 rounded-lg">{busy ? "Saving…" : "Confirm received"}</button>
        <button onClick={onCancel} className="flex-1 text-sm font-semibold text-stone-600 border border-stone-200 rounded-lg">Cancel</button>
      </div>
      {!canSubmit && <p className="text-[11px] text-stone-400 mt-2 text-center">Vendor, amount, and a delivery photo are all required.</p>}
    </div>
  );
}

function MaterialRequestForm({ isAdmin, onSave }) {
  const [form, setForm] = useState({ items: "", quantity: "", neededBy: "", notes: "" });
  const [autoApprove, setAutoApprove] = useState(isAdmin);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <Field label="Materials needed"><textarea className={inputCls} rows={3} value={form.items} onChange={set("items")} placeholder="e.g. 40 bags white cement, 200 sq.ft. marble tiles" /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Quantity (optional)"><input className={inputCls} value={form.quantity} onChange={set("quantity")} /></Field>
        <Field label="Needed by (optional)"><input type="date" className={inputCls} value={form.neededBy} onChange={set("neededBy")} /></Field>
      </div>
      <Field label="Notes (optional)"><textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} /></Field>
      {isAdmin && (
        <Field label="Approval">
          <button type="button" onClick={() => setAutoApprove(a => !a)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${autoApprove ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-stone-600 border-stone-200"}`}>
            {autoApprove ? "Post as already approved" : "Post as pending (approve later)"}
          </button>
        </Field>
      )}
      {!isAdmin && <p className="text-[11px] text-stone-400 mb-3">This will be sent to Admin for approval before the site supervisor is notified.</p>}
      <button onClick={() => onSave(form, autoApprove)} disabled={!form.items.trim()}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">
        {isAdmin && autoApprove ? "Post approved request" : "Submit for approval"}
      </button>
    </div>
  );
}

function SiteVisitsTab({ project, visits, users, currentUser, canLog, onStart, onEnd }) {
  const userName = (id) => users.find(u => u.id === id)?.name || id;
  const sorted = [...visits].sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime));
  const myOpenVisit = visits.find(v => v.status === "Open" && v.architectId === currentUser.id);
  const [showEnd, setShowEnd] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-400">Every architect site visit is logged with an entry photo, and closed out with an exit photo and minutes of meeting.</p>

      {canLog && (
        myOpenVisit ? (
          <Card className="p-4 border-amber-200 bg-amber-50/40">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm font-semibold text-amber-800">You're checked in — visit started {fmtTime(myOpenVisit.entryTime)} on {fmtDate(myOpenVisit.entryTime.slice(0, 10))}</div>
                <p className="text-xs text-amber-700 mt-0.5">End the visit before you leave — exit photo and minutes of meeting are required.</p>
              </div>
              <button onClick={() => setShowEnd(true)} className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg shrink-0">End Visit</button>
            </div>
          </Card>
        ) : (
          <StartVisitButton onStart={onStart} />
        )
      )}

      {sorted.length === 0 && (
        <Card className="p-8 text-center">
          <MapPin size={26} className="mx-auto text-stone-300 mb-2" />
          <p className="text-sm text-stone-400">No site visits logged yet.</p>
        </Card>
      )}

      {sorted.map(v => (
        <Card key={v.id} className="p-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {v.entryPhotoUrl && <img src={v.entryPhotoUrl} alt="Entry" className="w-14 h-14 rounded-lg object-cover border border-stone-200" />}
              <div>
                <div className="text-sm font-semibold text-stone-900">{userName(v.architectId)}</div>
                <div className="text-xs text-stone-500">In: {fmtDate(v.entryTime.slice(0, 10))} {fmtTime(v.entryTime)}</div>
                {v.exitTime ? (
                  <div className="text-xs text-stone-500">Out: {fmtTime(v.exitTime)}</div>
                ) : (
                  <div className="text-xs text-amber-600 font-semibold">Still on site — not checked out</div>
                )}
              </div>
            </div>
            {v.exitPhotoUrl && <img src={v.exitPhotoUrl} alt="Exit" className="w-14 h-14 rounded-lg object-cover border border-stone-200" />}
          </div>
          {(v.momNotes || v.momAttachmentUrl) && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <div className="text-xs font-semibold text-stone-500 uppercase mb-1">Minutes of meeting</div>
              {v.momNotes && <p className="text-sm text-stone-700 whitespace-pre-wrap">{v.momNotes}</p>}
              {v.momAttachmentUrl && <a href={v.momAttachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs dia-text-bronze hover:underline mt-1"><Paperclip size={11} /> View sketch/attachment</a>}
            </div>
          )}
        </Card>
      ))}

      {showEnd && myOpenVisit && (
        <Modal title="End Site Visit" onClose={() => setShowEnd(false)}>
          <EndVisitForm onSave={(fields) => { onEnd(myOpenVisit.id, fields); setShowEnd(false); }} />
        </Modal>
      )}
    </div>
  );
}

function StartVisitButton({ onStart }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError("Please attach a photo."); return; }
    setUploading(true);
    setError("");
    try {
      const url = await uploadProofFile(file, "site-visits");
      onStart(url);
    } catch (err) {
      setError(err.message || "Upload failed — please try again.");
    }
    setUploading(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm font-semibold text-stone-800">Arriving on site?</div>
          <p className="text-xs text-stone-500 mt-0.5">Take an entry photo to check in and start your visit log.</p>
        </div>
        <label className="flex items-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg cursor-pointer shrink-0">
          <Camera size={16} /> {uploading ? "Uploading…" : "Start Site Visit"}
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
      </div>
      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
    </Card>
  );
}

function EndVisitForm({ onSave }) {
  const [exitPhoto, setExitPhoto] = useState(null);
  const [momNotes, setMomNotes] = useState("");
  const [momAttachment, setMomAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleExitPhoto = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError("Please attach a photo."); return; }
    setUploading(true);
    setError("");
    try {
      const url = await uploadProofFile(file, "site-visits");
      setExitPhoto(url);
    } catch (err) {
      setError(err.message || "Upload failed — please try again.");
    }
    setUploading(false);
  };

  const canSubmit = exitPhoto && momNotes.trim();

  return (
    <div>
      <Field label="Exit photo (required)">
        {exitPhoto ? (
          <div className="flex items-center gap-2 text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2">
            <img src={exitPhoto} alt="" className="w-9 h-9 object-cover rounded shrink-0" />
            <span className="truncate flex-1">Exit photo attached</span>
            <button type="button" onClick={() => setExitPhoto(null)} className="text-stone-400 hover:text-rose-500 shrink-0"><X size={14} /></button>
          </div>
        ) : (
          <label className="flex items-center gap-2 justify-center border-2 border-dashed border-stone-300 rounded-lg py-3 text-xs text-stone-500 hover:dia-border-gold-soft cursor-pointer transition-colors">
            <Camera size={14} /> {uploading ? "Uploading…" : "Take exit photo"}
            <input type="file" accept="image/*" capture="environment" onChange={handleExitPhoto} disabled={uploading} className="hidden" />
          </label>
        )}
      </Field>
      <Field label="Minutes of meeting (required)"><textarea className={inputCls} rows={4} value={momNotes} onChange={e => setMomNotes(e.target.value)} placeholder="What was discussed, decided, and any action items…" /></Field>
      <ProofAttachment proof={momAttachment} onChange={setMomAttachment} pathPrefix="site-visits" />
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      <button onClick={() => onSave({ exitPhotoUrl: exitPhoto, momNotes: momNotes.trim(), momAttachmentUrl: momAttachment?.dataUrl || null })}
        disabled={!canSubmit}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">
        End visit
      </button>
      {!canSubmit && <p className="text-[11px] text-stone-400 mt-2 text-center">Exit photo and minutes of meeting are both required to close this visit.</p>}
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

function DeleteProjectZone({ project, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const canDelete = typed.trim() === project.name;

  return (
    <Card className="p-5 border-rose-200 bg-rose-50/30 mt-5">
      <div className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">Danger zone</div>
      {!confirming ? (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-stone-600">Permanently delete this project and everything in it — tasks, design phases, drawings, site reports, photos, and expenses.</p>
          <button onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg shrink-0">
            <Trash2 size={13} /> Delete project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            This can't be undone. It will permanently delete <b>{project.name}</b> and all its tasks, design phases, drawings, site reports, photos, and expenses.
            Type the project name below to confirm.
          </p>
          <input className={inputCls} value={typed} onChange={e => setTyped(e.target.value)} placeholder={project.name} />
          <div className="flex gap-2">
            <button onClick={onDelete} disabled={!canDelete}
              className="flex-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 rounded-lg">
              Permanently delete
            </button>
            <button onClick={() => { setConfirming(false); setTyped(""); }} className="flex-1 text-xs font-semibold text-stone-600 border border-stone-200 py-2.5 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ProjectDetail({ data, projectId, sub, setView, currentUser, actions, onMenuClick }) {
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
      <div className="p-4 sm:p-8">
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

  const isDesigning = project.contractType === "Designing";

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "design", label: "Design" },
    ...(isDesigning ? [] : [{ key: "timeline", label: "Timeline" }]),
    ...(isDesigning ? [] : [{ key: "reports", label: "Site Reports" }]),
    { key: "visits", label: "Site Visits" },
    { key: "expenses", label: "Expenses" },
    ...(isDesigning ? [] : [{ key: "photos", label: "Photos" }]),
    ...(isDesigning ? [] : [{ key: "materials", label: "Materials" }]),
  ];

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView({ tab: "projects" })} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 font-semibold">
          <ArrowLeft size={15} /> All projects
        </button>
        {onMenuClick && (
          <button onClick={onMenuClick} className="sm:hidden p-2 rounded-lg hover:bg-stone-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-700"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
        )}
      </div>

      <Card className="p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">{project.type}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${isDesigning ? "bg-sky-50 text-sky-700" : "bg-stone-100 text-stone-600"}`}>{project.contractType}</span>
            </div>
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
        <div className={`grid ${isDesigning ? "" : "sm:grid-cols-2"} gap-x-6 gap-y-3 mt-4`}>
          <div>
            <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Design progress</span><span className="font-semibold text-stone-700">{designProgress}%</span></div>
            <ProgressBar pct={designProgress} colorClass="bg-sky-500" />
          </div>
          {!isDesigning && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1"><span className="text-stone-500">Construction progress</span><span className="font-semibold text-stone-700">{progress}%</span></div>
              <ProgressBar pct={progress} />
            </div>
          )}
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
      {tab === "overview" && isAdmin && (
        <DeleteProjectZone project={project} onDelete={() => { actions.deleteProject(project.id); setView({ tab: "projects" }); }} />
      )}
      {tab === "design" && <DesignTab project={project} phases={projectDesignPhases} users={data.users} canEdit={canEditDesign} currentUser={currentUser}
        onUpdatePhase={(id, updates) => actions.updateDesignPhase(id, updates)}
        onUpdateDrawing={(phaseId, drawingId, updates) => actions.updateDrawingItem(phaseId, drawingId, updates, currentUser.id)}
        onAddDrawing={(phaseId, name) => actions.addDrawingItem(phaseId, name)}
        onRemoveDrawing={(phaseId, drawingId) => actions.removeDrawingItem(phaseId, drawingId)} />}
      {tab === "timeline" && <TimelineTab project={project} tasks={data.tasks} onUpdateTask={actions.updateTask} canEdit={canEditTimeline} />}
      {tab === "reports" && <ReportsTab project={project} reports={projectReports} users={data.users} currentUser={currentUser} canAdd={isAssignedSupervisor} onAdd={(rep) => actions.addSiteReport(project.id, currentUser.id, rep)} />}
      {tab === "visits" && <SiteVisitsTab project={project} visits={data.siteVisits.filter(v => v.projectId === project.id)} users={data.users} currentUser={currentUser}
        canLog={isAssignedArchitect}
        onStart={(entryPhotoUrl) => actions.startSiteVisit(project.id, currentUser.id, entryPhotoUrl)}
        onEnd={(visitId, fields) => actions.endSiteVisit(visitId, fields)} />}
      {tab === "expenses" && <ExpensesTab project={project} expenses={data.expenses} users={data.users} vendors={data.vendors} currentUser={currentUser}
        canApprove={isFinance} canAdd={isFinance || isAssignedSupervisor || isAssignedArchitect}
        onAdd={(exp) => actions.addExpense({ ...exp, projectId: project.id, submittedBy: currentUser.id })}
        onApprove={(id) => actions.approveExpense(id, currentUser.id)} onReject={(id, reason) => actions.rejectExpense(id, currentUser.id, reason)}
        onDelete={(id) => actions.deleteExpense(id)}
        onMarkPaid={(id, paid) => actions.markExpensePaid(id, currentUser.id, paid)}
        onGeneratePO={(id) => actions.generatePO(id, currentUser.id)} />}
      {tab === "photos" && <PhotosTab project={project} reports={projectReports} canAdd={isAssignedSupervisor || isAssignedArchitect} onAddPhoto={(photo) => actions.addPhoto(project.id, photo, currentUser.id)} />}
      {tab === "materials" && <MaterialsTab project={project} requests={data.materialRequests.filter(m => m.projectId === project.id)} users={data.users} vendors={data.vendors} currentUser={currentUser}
        isAdmin={isFinance} canRequest={isAssignedArchitect || isAdmin} isAssignedSupervisor={isAssignedSupervisor}
        onAdd={(req, autoApprove) => actions.addMaterialRequest(project.id, currentUser.id, req, autoApprove)}
        onApprove={(id) => actions.approveMaterialRequest(id, currentUser.id)}
        onReject={(id, reason) => actions.rejectMaterialRequest(id, currentUser.id, reason)}
        onDelete={(id) => actions.deleteMaterialRequest(id)}
        onMarkReceived={(id, fields) => actions.markMaterialReceived(id, currentUser.id, fields)}
        onFulfill={(id) => actions.fulfillMaterialRequest(id, currentUser.id)}
        onGeneratePO={(expenseId) => {
          const exp = data.expenses.find(e => e.id === expenseId);
          if (!exp) return;
          generatePOPdf({ expense: exp, vendor: data.vendors.find(v => v.id === exp.vendorId), project, generatedByName: currentUser.name });
        }} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Expenses Global (Accounts / Admin)                                       */
/* ---------------------------------------------------------------------- */

function ExpensesGlobal({ data, currentUser, actions }) {
  const { expenses, projects, users, vendors } = data;
  const [projectFilter, setProjectFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showPaymentsDue, setShowPaymentsDue] = useState(true);

  const projectName = (id) => projects.find(p => p.id === id)?.name || id;
  const userName = (id) => users.find(u => u.id === id)?.name || id;
  const vendorById = (id) => vendors.find(v => v.id === id);

  const filtered = expenses.filter(e => {
    if (projectFilter !== "All" && e.projectId !== projectFilter) return false;
    if (statusFilter !== "All" && e.status !== statusFilter) return false;
    if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const paymentsDue = expenses.filter(e => e.status === "Approved" && !e.paid)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalDue = paymentsDue.reduce((s, e) => s + (e.totalInvoiceValue != null ? e.totalInvoiceValue - e.advancePaid : e.amount), 0);

  return (
    <div className="p-4 sm:p-8 space-y-5">
      {paymentsDue.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 overflow-hidden">
          <button onClick={() => setShowPaymentsDue(s => !s)} className="w-full flex items-center justify-between p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><Landmark size={16} /></div>
              <div className="text-left">
                <div className="text-sm font-semibold text-stone-800">{paymentsDue.length} vendor payment{paymentsDue.length !== 1 ? "s" : ""} due</div>
                <div className="text-xs text-stone-500">Approved expenses waiting to be paid out</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono font-semibold text-amber-700">{fmtINR(totalDue)}</span>
              <ChevronRight size={16} className={`text-stone-400 transition-transform ${showPaymentsDue ? "rotate-90" : ""}`} />
            </div>
          </button>
          {showPaymentsDue && (
            <div className="border-t border-amber-200 divide-y divide-amber-100">
              {paymentsDue.map(e => {
                const v = vendorById(e.vendorId);
                const due = e.totalInvoiceValue != null ? e.totalInvoiceValue - e.advancePaid : e.amount;
                return (
                  <div key={e.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-800">{e.vendor || "No vendor on record"} <span className="text-xs font-normal text-stone-400">· {projectName(e.projectId)}</span></div>
                      <div className="text-xs text-stone-500 mt-0.5">{e.description}</div>
                      {v ? (
                        <div className="text-[11px] text-stone-500 mt-1 font-mono">
                          {v.bankAccountNumber ? <>A/C {v.bankAccountNumber} · IFSC {v.bankIfsc || "—"} · {v.bankName || ""}</> : <span className="text-rose-500">No bank details on file — add under Vendors</span>}
                        </div>
                      ) : (
                        <div className="text-[11px] text-rose-500 mt-1">No vendor linked to this expense</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-stone-800">{fmtINR(due)}</span>
                      <button onClick={() => actions.markExpensePaid(e.id, currentUser.id, true)}
                        className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg shrink-0">Mark paid</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

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
        <button onClick={() => exportToExcel(filtered.map(e => ({ Date: e.date, TimeFiled: fmtTime(e.submittedAt), Project: projectName(e.projectId), Category: e.category, Description: e.description, Amount: e.amount, Vendor: e.vendor, Invoice: e.invoiceNo, TotalInvoiceValue: e.totalInvoiceValue, AdvancePaid: e.advancePaid, Status: e.status, Paid: e.paid ? "Yes" : "No", SubmittedBy: userName(e.submittedBy) })), "expense_report.xlsx", "Expenses")}
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
              <th className="py-2.5 px-4 font-semibold">Vendor</th>
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
                onReject={(reason) => actions.rejectExpense(e.id, currentUser.id, reason)}
                onDelete={() => actions.deleteExpense(e.id)}
                onMarkPaid={(paid) => actions.markExpensePaid(e.id, currentUser.id, paid)}
                onGeneratePO={() => actions.generatePO(e.id, currentUser.id)}
                onDownloadPO={() => generatePOPdf({ expense: e, vendor: vendors.find(v => v.id === e.vendorId), project: projects.find(p => p.id === e.projectId), generatedByName: userName(e.poGeneratedBy) })} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-stone-400 py-8 text-center">No expenses match your filters.</p>}
      </div>
    </div>
  );
}

function GlobalExpenseRow({ e, projectName, userName, currentUserId, onApprove, onReject, onDelete, onMarkPaid, onGeneratePO, onDownloadPO }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
      <td className="py-2.5 px-4 text-stone-500 max-w-[180px]">
        {e.vendor}
        {(e.totalInvoiceValue != null || e.proofUrl || e.poNumber) && (
          <div className="text-[10px] text-stone-400 mt-0.5 space-y-0.5">
            {e.totalInvoiceValue != null && <div>Invoice {fmtINR(e.totalInvoiceValue)} · Due <b className="text-stone-600">{fmtINR(e.totalInvoiceValue - e.advancePaid)}</b></div>}
            {e.proofUrl && <a href={e.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 dia-text-bronze hover:underline"><Paperclip size={10} /> Attachment</a>}
            {e.poNumber && <div className="font-mono font-semibold dia-text-bronze flex items-center gap-2">{e.poNumber}{onDownloadPO && <button onClick={onDownloadPO} className="text-stone-400 hover:dia-text-bronze" title="Download PO PDF"><Download size={11} /></button>}</div>}
          </div>
        )}
      </td>
      <td className="py-2.5 px-4 text-stone-500">{userName(e.submittedBy)}</td>
      <td className="py-2.5 px-4 text-right font-mono font-semibold text-stone-800 whitespace-nowrap">{fmtINR(e.amount)}</td>
      <td className="py-2.5 px-4">
        <StatusPill status={e.status} />
        {e.status === "Approved" && (
          e.paid
            ? <div className="text-[10px] text-emerald-600 font-semibold mt-1">Paid{e.paidAt ? ` ${fmtDate(e.paidAt)}` : ""}</div>
            : <div className="text-[10px] text-amber-600 font-semibold mt-1">Payment due</div>
        )}
      </td>
      <td className="py-2.5 px-4">
        {confirmingDelete ? (
          <div className="flex gap-1.5 items-center min-w-[170px]">
            <span className="text-[11px] text-stone-500">Delete this expense?</span>
            <button onClick={onDelete} className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded-md shrink-0">Delete</button>
            <button onClick={() => setConfirmingDelete(false)} className="text-xs font-semibold text-stone-500 shrink-0">Cancel</button>
          </div>
        ) : (
          <div className="flex gap-1.5 items-center flex-wrap">
            {e.status === "Pending" && isOwn && (
              <span className="text-[11px] text-stone-400 italic mr-1">Submitted by you — needs another approver</span>
            )}
            {e.status === "Pending" && !isOwn && !rejecting && (
              <>
                <button onClick={onApprove} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><Check size={14} /></button>
                <button onClick={() => setRejecting(true)} className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"><XCircle size={14} /></button>
              </>
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
            {e.status === "Approved" && onMarkPaid && (
              <button onClick={() => onMarkPaid(!e.paid)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-md ${e.paid ? "text-stone-500 border border-stone-200 hover:bg-stone-50" : "text-white bg-amber-600 hover:bg-amber-700"}`}>
                {e.paid ? "Mark unpaid" : "Mark paid"}
              </button>
            )}
            {onGeneratePO && !e.poNumber && (
              <button onClick={onGeneratePO} disabled={!e.vendorId} title={!e.vendorId ? "Link a vendor to this expense first" : "Generate PO"}
                className="text-[11px] font-semibold text-white bg-stone-800 hover:bg-stone-900 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded-md">
                Generate PO
              </button>
            )}
            {onDelete && (
              <button onClick={() => setConfirmingDelete(true)} title="Delete expense" className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/* ---------------------------------------------------------------------- */
/* Team (Admin only)                                                        */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Vendors (Admin/Accounts only)                                           */
/* ---------------------------------------------------------------------- */

function UpdatesFeed({ data, setView }) {
  const [projectFilter, setProjectFilter] = useState("All");
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const projectName = (id) => data.projects.find(p => p.id === id)?.name || "Unknown project";
  const userName = (id) => data.users.find(u => u.id === id)?.name || null;

  const feed = [...data.photos]
    .filter(p => projectFilter === "All" || p.projectId === projectFilter)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-lg mx-auto">
        <select className={inputCls + " mb-5"} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
          <option value="All">All projects</option>
          {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {feed.length === 0 && (
          <Card className="p-10 text-center">
            <ImageIcon size={28} className="mx-auto text-stone-300 mb-2" />
            <p className="text-sm text-stone-400">No site photos shared yet.</p>
          </Card>
        )}

        <div className="space-y-5">
          {feed.map(p => (
            <Card key={p.id} className="overflow-hidden">
              <button onClick={() => setView({ tab: "project", projectId: p.projectId, sub: "photos" })}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-stone-100 text-left hover:bg-stone-50 transition-colors">
                <span className="font-display text-sm font-semibold text-stone-900 truncate">{projectName(p.projectId)}</span>
                <ChevronRight size={14} className="text-stone-400 shrink-0" />
              </button>
              <button onClick={() => p.url && setLightboxPhoto(p)} className="w-full bg-stone-100 aspect-square flex items-center justify-center">
                {p.url ? <img src={p.url} alt={p.caption || ""} className="w-full h-full object-cover" /> : <ImageIcon size={32} className="text-stone-300" />}
              </button>
              <div className="px-4 py-3">
                {p.caption && <p className="text-sm text-stone-800">{p.caption}</p>}
                {p.category && <span className="inline-block mt-1.5 text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium">{p.category}</span>}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-50">
                  <span className="text-xs text-stone-400">{userName(p.uploadedBy) ? `${userName(p.uploadedBy)} · ` : ""}{fmtDate(p.date)}</span>
                  <span className="text-xs text-stone-400 font-mono">{fmtTime(p.uploadedAt)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      {lightboxPhoto && (
        <Lightbox url={lightboxPhoto.url} caption={lightboxPhoto.caption}
          meta={`${projectName(lightboxPhoto.projectId)} · ${fmtDate(lightboxPhoto.date)} · ${fmtTime(lightboxPhoto.uploadedAt)}`}
          onClose={() => setLightboxPhoto(null)} />
      )}
    </div>
  );
}

function VendorsView({ data, actions }) {
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const vendors = [...data.vendors].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-4 sm:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""} on file</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg">
          <Plus size={16} /> Add Vendor
        </button>
      </div>

      {vendors.length === 0 && (
        <Card className="p-10 text-center">
          <Store size={26} className="mx-auto text-stone-300 mb-2" />
          <p className="text-sm text-stone-400">No vendors added yet. Add one so expenses can be linked to their bank details for payment.</p>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map(v => (
          <Card key={v.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold text-stone-900 truncate">{v.name}</h3>
                {v.material && <p className="text-xs dia-text-bronze font-medium mt-0.5">{v.material}</p>}
              </div>
              <button onClick={() => setEditingVendor(v)} className="text-stone-400 hover:dia-text-bronze shrink-0"><Pencil size={14} /></button>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 text-xs text-stone-500">
              {v.gstNumber && <div><span className="text-stone-400">GST:</span> {v.gstNumber}</div>}
              {v.address && <div className="flex items-start gap-1"><MapPin size={11} className="mt-0.5 shrink-0" /> {v.address}</div>}
              {v.phone && <div>{v.phone}</div>}
              {v.email && <div>{v.email}</div>}
              {v.bankAccountNumber ? (
                <div className="font-mono text-[11px] text-stone-500 pt-1">
                  {v.bankAccountName && <div>{v.bankAccountName}</div>}
                  <div>A/C {v.bankAccountNumber}</div>
                  <div>{v.bankIfsc || "—"} · {v.bankName || ""}</div>
                </div>
              ) : (
                <div className="text-amber-600 pt-1">No bank details on file</div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {showForm && (
        <Modal title="Add Vendor" onClose={() => setShowForm(false)}>
          <VendorForm onSave={(v) => { actions.addVendor(v); setShowForm(false); }} />
        </Modal>
      )}
      {editingVendor && (
        <Modal title="Edit Vendor" onClose={() => setEditingVendor(null)}>
          <VendorForm vendor={editingVendor}
            onSave={(v) => { actions.updateVendor(editingVendor.id, v); setEditingVendor(null); }}
            onDelete={() => { actions.deleteVendor(editingVendor.id); setEditingVendor(null); }} />
        </Modal>
      )}
    </div>
  );
}

function VendorForm({ vendor, onSave, onDelete }) {
  const [form, setForm] = useState({
    name: vendor?.name || "", material: vendor?.material || "", gstNumber: vendor?.gstNumber || "",
    address: vendor?.address || "", phone: vendor?.phone || "", email: vendor?.email || "",
    bankAccountName: vendor?.bankAccountName || "",
    bankAccountNumber: vendor?.bankAccountNumber || "", bankIfsc: vendor?.bankIfsc || "", bankName: vendor?.bankName || "",
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <Field label="Vendor / supplier name"><input className={inputCls} value={form.name} onChange={set("name")} /></Field>
      <Field label="Material / service supplied"><input className={inputCls} value={form.material} onChange={set("material")} placeholder="e.g. Marble & stone" /></Field>
      <Field label="GST number"><input className={inputCls} value={form.gstNumber} onChange={set("gstNumber")} /></Field>
      <Field label="Address"><textarea className={inputCls} rows={2} value={form.address} onChange={set("address")} /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={set("email")} /></Field>
      </div>
      <div className="pt-1 pb-2 text-xs font-semibold text-stone-500 uppercase tracking-wide">Bank details</div>
      <Field label="Account holder name"><input className={inputCls} value={form.bankAccountName} onChange={set("bankAccountName")} /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Account number"><input className={inputCls} value={form.bankAccountNumber} onChange={set("bankAccountNumber")} /></Field>
        <Field label="IFSC code"><input className={inputCls} value={form.bankIfsc} onChange={set("bankIfsc")} /></Field>
      </div>
      <Field label="Bank name"><input className={inputCls} value={form.bankName} onChange={set("bankName")} /></Field>
      <button onClick={() => onSave(form)} disabled={!form.name.trim()}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">Save vendor</button>

      {onDelete && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          {!confirmingDelete ? (
            <button onClick={() => setConfirmingDelete(true)}
              className="w-full text-xs font-semibold text-rose-600 hover:text-rose-700 py-2 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors">
              Delete vendor
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-stone-600">This removes <b>{form.name}</b> from the vendor list. Expenses already linked to them keep their record but won't show live bank details anymore.</p>
              <div className="flex gap-2">
                <button onClick={onDelete} className="flex-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 py-2 rounded-lg">Yes, delete</button>
                <button onClick={() => setConfirmingDelete(false)} className="flex-1 text-xs font-semibold text-stone-600 border border-stone-200 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Quotations — design proposals for Admin & Accounts                       */
/* ---------------------------------------------------------------------- */

/* Collapsible section wrapper used throughout the quotation editor. The
   editor is long by nature (a proposal is a six-page document), so each
   block collapses to keep the fields someone actually changes on a normal
   quotation — client, area, rate — visible without scrolling. */
function QSection({ title, subtitle, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-stone-50/70 transition-colors">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-stone-900 flex items-center gap-2">
            {title}
            {badge}
          </h3>
          {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown size={17} className={`text-stone-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-stone-100">{children}</div>}
    </Card>
  );
}

/* Edits a string[] as one-item-per-line text. Far faster to work through
   than a stack of individual inputs, and it pastes cleanly out of Word. */
function ListEditor({ value, onChange, rows = 4, placeholder }) {
  return (
    <textarea rows={rows} placeholder={placeholder} className={`${inputCls} leading-relaxed`}
      value={(value || []).join("\n")}
      onChange={e => onChange(e.target.value.split("\n"))} />
  );
}

const cleanList = (arr) => (arr || []).map(s => String(s).trim()).filter(Boolean);

function QuotationsView({ data, currentUser, actions, setView }) {
  const [editing, setEditing] = useState(null);   // quotation object, or "new"
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [newMenu, setNewMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const quotations = data.quotations || [];
  const isAdmin = currentUser.role === "Admin";

  const filtered = quotations.filter(q => {
    if (statusFilter !== "All" && q.status !== statusFilter) return false;
    if (typeFilter !== "All" && (q.docType || "proposal") !== typeFilter) return false;
    if (!query.trim()) return true;
    const hay = `${q.quotationNo} ${q.clientName} ${q.projectTitle} ${q.location}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  const sumBy = (status) => quotations.filter(q => q.status === status).reduce((s, q) => s + (q.totalFee || 0), 0);

  /* The signature someone used most recently, offered as a one-click reuse so
     it doesn't have to be uploaded again on every quotation. */
  const lastSignature = quotations.find(q => q.signatureUrl)?.signatureUrl || "";

  if (editing) {
    const isNew = typeof editing === "string" && editing.startsWith("new-");
    const docType = isNew ? editing.replace("new-", "") : (editing.docType || "proposal");

    const handleSave = async (payload) => {
      setBusy(true);
      try {
        if (isNew) await actions.addQuotation(payload);
        else await actions.updateQuotation(editing.id, payload);
        setEditing(null);
      } catch (err) {
        alert(err.message || "Could not save the quotation.");
      }
      setBusy(false);
    };

    const shared = {
      key: isNew ? editing : editing.id,
      quotation: isNew ? null : editing,
      data, currentUser, lastSignature, saving: busy, actions,
      onCancel: () => setEditing(null),
      onSave: handleSave,
    };
    if (docType === "boq") return <BOQEditor {...shared} />;
    if (docType === "itemised") return <WorkQuoteEditor {...shared} />;
    return <QuotationEditor {...shared} />;
  }

  return (
    <div className="p-4 sm:p-8 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPI label="Quotations" value={quotations.length} sub="all time" icon={FileText} />
        <KPI label="Drafts" value={quotations.filter(q => q.status === "Draft").length} sub="not yet sent" icon={Pencil} />
        <KPI label="Sent — value" value={fmtINR(sumBy("Sent"))} sub="awaiting client decision" icon={Clock} />
        <KPI label="Accepted — value" value={fmtINR(sumBy("Accepted"))} sub="confirmed fee" icon={CheckCircle2} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client, project or quotation number"
            className={`${inputCls} pl-9`} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputCls} sm:w-36`}>
          {["All", ...QUOTATION_STATUSES].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="All">Both document types</option>
          <option value="proposal">Design proposals</option>
          <option value="itemised">Work quotations</option>
          <option value="boq">Bills of quantities</option>
        </select>
        <div className="relative shrink-0">
          <button onClick={() => setNewMenu(o => !o)}
            className="w-full flex items-center justify-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg">
            <Plus size={16} /> New Quotation
          </button>
          {newMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNewMenu(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-white border border-stone-200 rounded-xl shadow-xl z-20 py-1">
                <button onClick={() => { setEditing("new-proposal"); setNewMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-stone-50">
                  <div className="text-sm font-semibold text-stone-800">Design proposal</div>
                  <div className="text-xs text-stone-500 mt-0.5">Multi-page proposal with scope, stages and a milestone payment schedule</div>
                </button>
                <button onClick={() => { setEditing("new-itemised"); setNewMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-stone-50 border-t border-stone-100">
                  <div className="text-sm font-semibold text-stone-800">Work quotation</div>
                  <div className="text-xs text-stone-500 mt-0.5">Single-page itemised rates for execution and fabrication work</div>
                </button>
                <button onClick={() => { setEditing("new-boq"); setNewMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-stone-50 border-t border-stone-100">
                  <div className="text-sm font-semibold text-stone-800">Bill of quantities</div>
                  <div className="text-xs text-stone-500 mt-0.5">Full priced schedule of works for turnkey execution, with Excel export</div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <Card className="p-10 text-center">
          <FileText size={26} className="mx-auto text-stone-300 mb-2" />
          <p className="text-sm text-stone-400">
            {quotations.length === 0
              ? "No quotations yet. Create a design proposal or an itemised work quotation and the client-ready PDF is generated for you."
              : "No quotations match this filter."}
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map(q => (
          <QuotationRow key={q.id} q={q} isAdmin={isAdmin}
            projectName={data.projects.find(p => p.id === q.projectId)?.name}
            onEdit={() => setEditing(q)}
            onStatus={(s) => actions.updateQuotationStatus(q.id, s)}
            onDuplicate={() => actions.duplicateQuotation(q)}
            onDelete={() => setConfirmDelete(q)} />
        ))}
      </div>

      {confirmDelete && (
        <Modal title="Delete quotation" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-stone-600">
            Delete <span className="font-semibold">{confirmDelete.quotationNo}</span> for {confirmDelete.clientName}? The
            commercial record is removed permanently and the number is not reissued.
          </p>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-stone-300 text-stone-700 py-2.5 rounded-lg text-sm font-semibold">Keep it</button>
            <button onClick={() => { actions.deleteQuotation(confirmDelete.id); setConfirmDelete(null); }}
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg text-sm font-semibold">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const QUOTE_STATUS_STYLES = {
  Draft: "bg-stone-100 text-stone-600",
  Sent: "bg-amber-50 text-amber-700",
  Accepted: "bg-emerald-50 text-emerald-700",
  Declined: "bg-rose-50 text-rose-700",
  Revised: "bg-sky-50 text-sky-700",
};

/* One row renders either document type — the only difference is which
   generator produces the PDF and what the summary line says. */
function quotationPdf(q, mode) {
  const t = q.docType || "proposal";
  if (t === "boq") return generateBOQPdf(q, mode);
  if (t === "itemised") return generateWorkQuotePdf(q, mode);
  return generateQuotationPdf(q, mode);
}

const DOC_TYPE_LABEL = { proposal: "Design proposal", itemised: "Work quotation", boq: "Bill of quantities" };

function QuotationRow({ q, projectName, isAdmin, onEdit, onStatus, onDuplicate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const docType = q.docType || "proposal";
  const isItemised = docType === "itemised";
  const isBoq = docType === "boq";
  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-stone-500">{q.quotationNo}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${docType === "proposal" ? "bg-stone-100 text-stone-600" : "dia-bg-cream-soft dia-text-bronze"}`}>
              {DOC_TYPE_LABEL[docType]}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${QUOTE_STATUS_STYLES[q.status] || "bg-stone-100 text-stone-600"}`}>{q.status}</span>
            {projectName && <span className="text-[10px] dia-text-bronze font-medium">· linked to {projectName}</span>}
          </div>
          <h3 className="font-display text-lg font-semibold text-stone-900 mt-1 truncate">{q.clientName}</h3>
          <p className="text-xs text-stone-500 mt-0.5 truncate">
            {[q.projectTitle, q.location].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-stone-500">
            <span>{fmtDate(q.date)}</span>
            {isBoq
              ? <span>{(q.boqSections || []).length} section{(q.boqSections || []).length !== 1 ? "s" : ""}</span>
              : isItemised
              ? <span>{(q.lineItems || []).length} line{(q.lineItems || []).length !== 1 ? "s" : ""} of work</span>
              : <>
                  {q.area > 0 && <span>{Number(q.area).toLocaleString("en-IN")} sq.ft.</span>}
                  {q.feeMode === "rate" && q.ratePerSqft > 0 && <span>{fmtINR(q.ratePerSqft)}/sq.ft.</span>}
                </>}
            {q.signatoryName && <span>Signed by {q.signatoryName}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right mr-1">
            <div className="font-display text-xl font-semibold text-stone-900">{fmtINR(q.totalFee)}</div>
            <div className="text-[10px] text-stone-400">excl. GST</div>
          </div>
          <button onClick={() => quotationPdf(q, "save")} title="Download PDF"
            className="p-2 rounded-lg border border-stone-200 text-stone-600 hover:dia-text-bronze hover:dia-border-gold">
            <Download size={15} />
          </button>
          <button onClick={onEdit} title="Edit"
            className="p-2 rounded-lg border border-stone-200 text-stone-600 hover:dia-text-bronze hover:dia-border-gold">
            <Pencil size={15} />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)}
              className="p-2 rounded-lg border border-stone-200 text-stone-600 hover:dia-text-bronze hover:dia-border-gold">
              <ChevronDown size={15} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white border border-stone-200 rounded-xl shadow-xl z-20 py-1">
                  <button onClick={() => { const url = quotationPdf(q, "preview"); if (url) window.open(url, "_blank"); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                    <Eye size={14} /> Preview PDF
                  </button>
                  {isBoq && (
                    <button onClick={() => { exportBOQExcel(q); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                      <FileSpreadsheet size={14} /> Download as Excel
                    </button>
                  )}
                  <button onClick={() => { onDuplicate(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                    <Copy size={14} /> Duplicate as revision
                  </button>
                  <div className="border-t border-stone-100 my-1" />
                  <div className="px-4 py-1 text-[10px] uppercase tracking-wide text-stone-400 font-semibold">Mark as</div>
                  {QUOTATION_STATUSES.filter(s => s !== q.status).map(s => (
                    <button key={s} onClick={() => { onStatus(s); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">{s}</button>
                  ))}
                  {isAdmin && (
                    <>
                      <div className="border-t border-stone-100 my-1" />
                      <button onClick={() => { onDelete(); setMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                        <Trash2 size={14} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function QuotationEditor({ quotation, data, currentUser, onSave, onCancel, saving, lastSignature }) {
  const [form, setForm] = useState(() => quotation ? { ...quotation } : blankQuotation(null));
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  /* Fee is derived from area x rate unless the person switches to a lump sum,
     in which case they type the figure directly. */
  const computedTotal = form.feeMode === "rate"
    ? Math.round((Number(form.area) || 0) * (Number(form.ratePerSqft) || 0))
    : Math.round(Number(form.totalFee) || 0);

  const stageAmounts = computeStageAmounts(computedTotal, form.paymentStages || []);
  const pctTotal = (form.paymentStages || []).reduce((s, st) => s + (Number(st.percentage) || 0), 0);
  const pctValid = Math.abs(pctTotal - 100) < 0.01;

  const errors = [];
  if (!String(form.clientName || "").trim()) errors.push("Client name is required.");
  if (computedTotal <= 0) errors.push("The professional fee must be greater than zero.");
  if (!pctValid) errors.push(`Payment stages add up to ${pctTotal}% — they must total 100%.`);

  const payload = () => ({
    ...form,
    totalFee: computedTotal,
    introParas: cleanList(form.introParas),
    milestoneNotes: cleanList(form.milestoneNotes),
    revisionPolicy: cleanList(form.revisionPolicy),
    closingParas: cleanList(form.closingParas),
    paymentTerms: cleanList(form.paymentTerms),
    scopeStages: (form.scopeStages || [])
      .filter(s => String(s.title || "").trim())
      .map(s => ({ ...s, items: cleanList(s.items) })),
    paymentStages: (form.paymentStages || []).filter(s => String(s.stage || "").trim()),
  });

  const applyProject = (projectId) => {
    const p = data.projects.find(x => x.id === projectId);
    if (!p) { set({ projectId: null }); return; }
    set({
      projectId: p.id,
      clientName: form.clientName || p.client,
      projectTitle: form.projectTitle || p.name,
      location: form.location || p.location,
      clientAddress: form.clientAddress || p.location,
      area: Number(form.area) > 0 ? form.area : p.area,
    });
  };

  const preview = () => {
    const url = generateQuotationPdf({ ...payload(), quotationNo: form.quotationNo || "DRAFT" }, "preview");
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="p-4 sm:p-8 pb-32 space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm dia-text-bronze font-medium">
        <ArrowLeft size={15} /> Back to quotations
      </button>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900">
            {quotation ? "Edit quotation" : "New quotation"}
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            {quotation
              ? <>Quotation <span className="font-mono text-xs">{quotation.quotationNo}</span> · last updated {fmtDate(quotation.updatedAt)}</>
              : "The number is assigned automatically when you save."}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start ${QUOTE_STATUS_STYLES[form.status]}`}>{form.status}</span>
      </div>

      <QSection title="Client & project" subtitle="Everything printed at the top of the covering letter">
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Link to an existing project (optional)">
            <select className={inputCls} value={form.projectId || ""} onChange={e => applyProject(e.target.value)}>
              <option value="">Not linked — standalone quotation</option>
              {data.projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.client}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={e => set({ status: e.target.value })}>
              {QUOTATION_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Client name *">
            <input className={inputCls} value={form.clientName} onChange={e => set({ clientName: e.target.value })}
              placeholder="BMR Aabharan Jewellery" />
          </Field>
          <Field label="Project / store name">
            <input className={inputCls} value={form.projectTitle} onChange={e => set({ projectTitle: e.target.value })}
              placeholder="Jewellery Store" />
          </Field>
          <Field label="Client address (one line per row)">
            <textarea rows={3} className={inputCls} value={form.clientAddress || ""}
              onChange={e => set({ clientAddress: e.target.value })} placeholder={"Ongole\nAndhra Pradesh"} />
          </Field>
          <div>
            <Field label="Site location">
              <input className={inputCls} value={form.location} onChange={e => set({ location: e.target.value })}
                placeholder="Ongole, Andhra Pradesh" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issued from">
                <input className={inputCls} value={form.city} onChange={e => set({ city: e.target.value })} />
              </Field>
              <Field label="Date">
                <input type="date" className={inputCls} value={form.date} onChange={e => set({ date: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Field label="Services offered">
              <select className={inputCls} value={form.serviceLine} onChange={e => set({ serviceLine: e.target.value })}>
                {QUOTATION_SERVICE_LINES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Subject line (leave blank to build it automatically)">
              <input className={inputCls} value={form.subject || ""} onChange={e => set({ subject: e.target.value })}
                placeholder={`Proposal for ${form.serviceLine} Services for the Proposed ${form.projectTitle || "Jewellery Store"} at ${form.location || "…"}.`} />
            </Field>
          </div>
        </div>
      </QSection>

      <QSection title="Area & professional fee"
        subtitle="Rate per sq.ft. or a flat lump sum — the schedule below follows automatically">
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Total built-up area (sq.ft.)">
            <input type="number" className={inputCls} value={form.area}
              onChange={e => set({ area: e.target.value })} placeholder="5577" />
          </Field>
          <Field label="Floors covered">
            <input className={inputCls} value={form.floors || ""} onChange={e => set({ floors: e.target.value })}
              placeholder="Ground Floor + First Floor + Second Floor" />
          </Field>
          <Field label="How is the fee calculated?">
            <div className="flex gap-2">
              {[["rate", "Rate per sq.ft."], ["lumpsum", "Lump sum"]].map(([val, label]) => (
                <button key={val} type="button" onClick={() => set({ feeMode: val, totalFee: computedTotal })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    form.feeMode === val ? "dia-btn-gold dia-border-gold" : "border-stone-300 text-stone-600 hover:bg-stone-50"}`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          {form.feeMode === "rate" ? (
            <Field label="Design cost per sq.ft. (₹)">
              <input type="number" className={inputCls} value={form.ratePerSqft}
                onChange={e => set({ ratePerSqft: e.target.value })} placeholder="250" />
            </Field>
          ) : (
            <Field label="Total professional fee (₹)">
              <input type="number" className={inputCls} value={form.totalFee}
                onChange={e => set({ totalFee: e.target.value })} placeholder="1394250" />
            </Field>
          )}
        </div>

        <div className="dia-bg-cream-soft rounded-xl p-4 mt-1">
          <div className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">Total professional fee</div>
          <div className="font-display text-3xl font-semibold text-stone-900 mt-1">{fmtINR(computedTotal)}</div>
          <div className="text-xs text-stone-600 mt-1 italic">{amountInWords(computedTotal)}</div>
          {form.feeMode === "rate" && Number(form.area) > 0 && Number(form.ratePerSqft) > 0 && (
            <div className="text-[11px] text-stone-500 mt-2">
              {Number(form.area).toLocaleString("en-IN")} sq.ft. × {fmtINR(form.ratePerSqft)} per sq.ft.
            </div>
          )}
        </div>

        <div className="mt-4">
          <Field label="GST note printed under the fee">
            <input className={inputCls} value={form.gstNote || ""} onChange={e => set({ gstNote: e.target.value })} />
          </Field>
        </div>
      </QSection>

      <QSection title="Payment schedule"
        badge={<span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pctValid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{pctTotal}%</span>}
        subtitle="Percentages must total 100 — amounts are calculated as you type">
        <div className="space-y-2">
          {(form.paymentStages || []).map((st, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <input className={`${inputCls} col-span-4 sm:col-span-2`} value={st.stage}
                onChange={e => { const next = [...form.paymentStages]; next[i] = { ...st, stage: e.target.value }; set({ paymentStages: next }); }} />
              <textarea rows={2} className={`${inputCls} col-span-8 sm:col-span-5`} value={st.milestone}
                onChange={e => { const next = [...form.paymentStages]; next[i] = { ...st, milestone: e.target.value }; set({ paymentStages: next }); }} />
              <div className="col-span-4 sm:col-span-2 relative">
                <input type="number" className={`${inputCls} pr-6`} value={st.percentage}
                  onChange={e => { const next = [...form.paymentStages]; next[i] = { ...st, percentage: Number(e.target.value) }; set({ paymentStages: next }); }} />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">%</span>
              </div>
              <div className="col-span-6 sm:col-span-2 text-sm font-semibold text-stone-800 py-2 text-right tabular-nums">
                {fmtINR(stageAmounts[i])}
              </div>
              <button type="button" onClick={() => set({ paymentStages: form.paymentStages.filter((_, x) => x !== i) })}
                className="col-span-2 sm:col-span-1 text-stone-300 hover:text-rose-600 py-2.5 flex justify-center">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button"
            onClick={() => set({ paymentStages: [...(form.paymentStages || []), { stage: `STAGE ${String((form.paymentStages?.length || 0) + 1).padStart(2, "0")}`, milestone: "", percentage: 0 }] })}
            className="flex items-center gap-1.5 text-sm dia-text-bronze font-semibold">
            <Plus size={14} /> Add stage
          </button>
          <button type="button" onClick={() => set({ paymentStages: QUOTATION_PAYMENT_TEMPLATE })}
            className="text-sm text-stone-500 hover:text-stone-800">Reset to standard schedule</button>
        </div>
        {!pctValid && (
          <p className="text-xs text-rose-600 mt-3 flex items-center gap-1.5">
            <AlertCircle size={13} /> Adjust the percentages so they total exactly 100%.
          </p>
        )}
      </QSection>

      <QSection title="Scope of professional services" subtitle="Stages and deliverables printed on pages 2–3" defaultOpen={false}>
        <div className="space-y-4">
          {(form.scopeStages || []).map((stage, i) => (
            <div key={i} className="border border-stone-200 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <input className={`${inputCls} font-semibold`} value={stage.title}
                  onChange={e => { const next = [...form.scopeStages]; next[i] = { ...stage, title: e.target.value }; set({ scopeStages: next }); }} />
                <button type="button" onClick={() => set({ scopeStages: form.scopeStages.filter((_, x) => x !== i) })}
                  className="text-stone-300 hover:text-rose-600 shrink-0"><Trash2 size={15} /></button>
              </div>
              <input className={`${inputCls} mb-2`} placeholder="Optional lead-in line, e.g. Preparation of planning layouts including:"
                value={stage.intro || ""}
                onChange={e => { const next = [...form.scopeStages]; next[i] = { ...stage, intro: e.target.value }; set({ scopeStages: next }); }} />
              <ListEditor rows={Math.min(12, Math.max(4, (stage.items || []).length))} value={stage.items}
                placeholder="One deliverable per line"
                onChange={items => { const next = [...form.scopeStages]; next[i] = { ...stage, items }; set({ scopeStages: next }); }} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <button type="button"
            onClick={() => set({ scopeStages: [...(form.scopeStages || []), { title: `Stage ${String((form.scopeStages?.length || 0) + 1).padStart(2, "0")} — `, intro: "", items: [] }] })}
            className="flex items-center gap-1.5 text-sm dia-text-bronze font-semibold">
            <Plus size={14} /> Add stage
          </button>
          <button type="button" onClick={() => set({ scopeStages: QUOTATION_SCOPE_TEMPLATE })}
            className="text-sm text-stone-500 hover:text-stone-800">Reset to standard scope</button>
        </div>
      </QSection>

      <QSection title="Covering letter & terms" subtitle="Use {{client}}, {{location}} and {{service}} to fill details in automatically" defaultOpen={false}>
        <Field label="Opening paragraphs (one paragraph per line)">
          <ListEditor rows={6} value={form.introParas} onChange={v => set({ introParas: v })} />
        </Field>
        <Field label="Project milestones — each stage begins only after…">
          <ListEditor rows={3} value={form.milestoneNotes} onChange={v => set({ milestoneNotes: v })} />
        </Field>
        <Field label="Revision policy">
          <ListEditor rows={3} value={form.revisionPolicy} onChange={v => set({ revisionPolicy: v })} />
        </Field>
        <Field label="Terms of payment">
          <ListEditor rows={7} value={form.paymentTerms} onChange={v => set({ paymentTerms: v })} />
        </Field>
        <Field label="Closing paragraphs">
          <ListEditor rows={5} value={form.closingParas} onChange={v => set({ closingParas: v })} />
        </Field>
        <Field label="Internal notes (never printed)">
          <textarea rows={2} className={inputCls} value={form.notes || ""} onChange={e => set({ notes: e.target.value })}
            placeholder="e.g. quoted at a reduced rate, client to confirm the second floor" />
        </Field>
      </QSection>

      <QSection title="Sign-off & bank details" defaultOpen={false}>
        <SignatoryFields form={form} set={set} currentUser={currentUser} lastSignature={lastSignature} />
        <div className="grid sm:grid-cols-2 gap-x-4 pt-2 mt-2 border-t border-stone-100">
          {[["accountName", "Account name"], ["bankName", "Bank"], ["branch", "Branch"], ["accountNumber", "Current account no."], ["ifsc", "IFSC"]].map(([key, label]) => (
            <Field key={key} label={label}>
              <input className={inputCls} value={form.bank?.[key] || ""}
                onChange={e => set({ bank: { ...form.bank, [key]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </QSection>

      {/* sticky action bar so Save/Preview are always in reach on a long form */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-60 bg-white/95 backdrop-blur border-t border-stone-200 px-4 sm:px-8 py-3 z-30"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {errors.length > 0 ? (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 truncate"><AlertCircle size={13} className="shrink-0" /> {errors[0]}</p>
            ) : (
              <p className="text-xs text-stone-500 truncate">
                <span className="font-semibold text-stone-800">{fmtINR(computedTotal)}</span> across {(form.paymentStages || []).length} stages · ready to send
              </p>
            )}
          </div>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
          <button onClick={preview} disabled={errors.length > 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40">
            <Eye size={15} /> <span className="hidden sm:inline">Preview</span>
          </button>
          <button onClick={() => onSave(payload())} disabled={errors.length > 0 || saving}
            className="flex items-center gap-1.5 dia-btn-gold px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40">
            <Check size={15} /> {saving ? "Saving…" : quotation ? "Save changes" : "Create quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Shared sign-off block: an optional signature image, plus the name and
   designation of whoever is signing. Used by both quotation types — the
   person signing is not always the same architect, so it is typed per
   document rather than fixed in the template. */
function SignatoryFields({ form, set, currentUser, lastSignature }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Pick an image file — a transparent PNG works best."); return; }
    setUploading(true); setError("");
    try {
      const url = await uploadSignature(file);
      set({ signatureUrl: url });
    } catch (err) {
      setError(err.message || "That image wouldn't upload.");
    }
    setUploading(false);
  };

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Signed by (name)">
          <input className={inputCls} value={form.signatoryName || ""}
            onChange={e => set({ signatoryName: e.target.value })} placeholder="Mayuk A" />
        </Field>
        <Field label="Designation">
          <input className={inputCls} value={form.signatoryTitle || ""}
            onChange={e => set({ signatoryTitle: e.target.value })} placeholder="Principal Architect" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2 -mt-1 mb-3">
        <button type="button" onClick={() => set({ signatoryName: currentUser.name, signatoryTitle: currentUser.rank || currentUser.role })}
          className="text-xs dia-text-bronze font-semibold">Use my name</button>
        {QUOTATION_SIGNATORY.name !== form.signatoryName && (
          <button type="button" onClick={() => set({ signatoryName: QUOTATION_SIGNATORY.name, signatoryTitle: QUOTATION_SIGNATORY.title })}
            className="text-xs text-stone-500 hover:text-stone-800">Use {QUOTATION_SIGNATORY.name}</button>
        )}
      </div>

      <Field label="Signature image (optional)">
        {form.signatureUrl ? (
          <div className="flex items-center gap-3">
            <img src={form.signatureUrl} alt="Signature" className="h-12 object-contain bg-white border border-stone-200 rounded-lg px-2" />
            <button type="button" onClick={() => set({ signatureUrl: "" })}
              className="text-xs text-rose-600 font-semibold">Remove</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 border border-dashed border-stone-300 rounded-lg px-4 py-2.5 text-sm text-stone-600 cursor-pointer hover:dia-border-gold hover:dia-text-bronze">
              <Upload size={15} /> {uploading ? "Uploading…" : "Upload signature"}
              <input type="file" accept="image/*" hidden onChange={pickFile} disabled={uploading} />
            </label>
            {lastSignature && (
              <button type="button" onClick={() => set({ signatureUrl: lastSignature })}
                className="text-xs dia-text-bronze font-semibold">Reuse last signature</button>
            )}
          </div>
        )}
        {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
      </Field>
    </>
  );
}

/* Itemised work quotation: the line-item document for execution work, as
   opposed to the multi-page design proposal. */
function WorkQuoteEditor({ quotation, data, currentUser, onSave, onCancel, saving, lastSignature }) {
  const [form, setForm] = useState(() => quotation ? { ...quotation } : blankWorkQuote(null));
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const items = form.lineItems || [];
  const setItem = (i, patch) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    set({ lineItems: next });
  };
  const totals = workQuoteTotals(form);

  const errors = [];
  if (!String(form.clientName || "").trim()) errors.push("Client name is required.");
  if (!items.some(it => String(it.description || "").trim())) errors.push("Add at least one line of work.");
  if (totals.grand <= 0) errors.push("The quotation total must be greater than zero.");

  const payload = () => ({
    ...form,
    docType: "itemised",
    lineItems: items.filter(it => String(it.description || "").trim())
      .map(it => ({ description: it.description, qty: Number(it.qty) || 0, unit: it.unit || "", rate: Number(it.rate) || 0 })),
    workTerms: cleanList(form.workTerms),
    discount: Number(form.discount) || 0,
    totalFee: totals.grand,
  });

  const applyProject = (projectId) => {
    const p = data.projects.find(x => x.id === projectId);
    if (!p) { set({ projectId: null }); return; }
    set({
      projectId: p.id,
      clientName: form.clientName || p.client,
      projectTitle: form.projectTitle || p.name,
      location: form.location || p.location,
      clientAddress: form.clientAddress || p.location,
    });
  };

  const preview = () => {
    const url = generateWorkQuotePdf({ ...payload(), quotationNo: form.quotationNo || "DRAFT" }, "preview");
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="p-4 sm:p-8 pb-32 space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm dia-text-bronze font-medium">
        <ArrowLeft size={15} /> Back to quotations
      </button>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900">
            {quotation ? "Edit work quotation" : "New work quotation"}
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            {quotation
              ? <>Quotation <span className="font-mono text-xs">{quotation.quotationNo}</span> · last updated {fmtDate(quotation.updatedAt)}</>
              : "Itemised rates for execution work. The number is assigned when you save."}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start ${QUOTE_STATUS_STYLES[form.status]}`}>{form.status}</span>
      </div>

      <QSection title="Client & work">
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Link to an existing project (optional)">
            <select className={inputCls} value={form.projectId || ""} onChange={e => applyProject(e.target.value)}>
              <option value="">Not linked — standalone quotation</option>
              {data.projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.client}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={e => set({ status: e.target.value })}>
              {QUOTATION_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Client name *">
            <input className={inputCls} value={form.clientName} onChange={e => set({ clientName: e.target.value })} />
          </Field>
          <Field label="Project / work type">
            <input className={inputCls} value={form.projectTitle} onChange={e => set({ projectTitle: e.target.value })}
              placeholder="Interior fit-out works" />
          </Field>
          <Field label="Client address">
            <textarea rows={2} className={inputCls} value={form.clientAddress || ""}
              onChange={e => set({ clientAddress: e.target.value })} />
          </Field>
          <div>
            <Field label="Mobile">
              <input className={inputCls} value={form.mobile || ""} onChange={e => set({ mobile: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Site location">
                <input className={inputCls} value={form.location || ""} onChange={e => set({ location: e.target.value })} />
              </Field>
              <Field label="Date">
                <input type="date" className={inputCls} value={form.date} onChange={e => set({ date: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>
      </QSection>

      <QSection title="Schedule of work"
        badge={<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full dia-bg-cream-soft dia-text-bronze">{fmtINR(totals.grand)}</span>}
        subtitle="Amounts calculate as you type">
        <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-1.5 text-[10px] uppercase tracking-wide text-stone-400 font-semibold">
          <div className="col-span-5">Description of work</div>
          <div className="col-span-2">Quantity</div>
          <div className="col-span-1">Unit</div>
          <div className="col-span-2">Rate (₹)</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <textarea rows={2} className={`${inputCls} col-span-12 sm:col-span-5`} placeholder="Description of work"
                value={it.description || ""} onChange={e => setItem(i, { description: e.target.value })} />
              <input type="number" className={`${inputCls} col-span-3 sm:col-span-2`} placeholder="Qty"
                value={it.qty ?? ""} onChange={e => setItem(i, { qty: e.target.value })} />
              <input list="wq-units" className={`${inputCls} col-span-3 sm:col-span-1`} placeholder="Unit"
                value={it.unit || ""} onChange={e => setItem(i, { unit: e.target.value })} />
              <input type="number" className={`${inputCls} col-span-4 sm:col-span-2`} placeholder="Rate"
                value={it.rate ?? ""} onChange={e => setItem(i, { rate: e.target.value })} />
              <div className="col-span-2 sm:col-span-1 text-sm font-semibold text-stone-800 py-2 text-right tabular-nums">
                {fmtINR(lineTotal(it))}
              </div>
              <button type="button" onClick={() => set({ lineItems: items.filter((_, x) => x !== i) })}
                className="col-span-12 sm:col-span-1 text-stone-300 hover:text-rose-600 py-1 sm:py-2.5 flex sm:justify-center">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <datalist id="wq-units">{WORK_QUOTE_UNITS.map(u => <option key={u} value={u} />)}</datalist>
        <button type="button" onClick={() => set({ lineItems: [...items, { description: "", qty: 0, unit: "Sq.ft", rate: 0 }] })}
          className="flex items-center gap-1.5 text-sm dia-text-bronze font-semibold mt-3">
          <Plus size={14} /> Add a line
        </button>

        <div className="dia-bg-cream-soft rounded-xl p-4 mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Total amount</span>
            <span className="font-semibold text-stone-900">{fmtINR(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-stone-600 shrink-0">Less: discount</span>
            <input type="number" className={`${inputCls} max-w-[160px] text-right`} value={form.discount ?? ""}
              onChange={e => set({ discount: e.target.value })} placeholder="0" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t dia-border-gold-soft">
            <span className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">
              {totals.discount > 0 ? "Grand total" : "Total payable"}
            </span>
            <span className="font-display text-2xl font-semibold text-stone-900">{fmtINR(totals.grand)}</span>
          </div>
          <p className="text-xs text-stone-600 italic">{amountInWords(totals.grand)}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className="text-xs text-stone-600">Where the totals block sits on the PDF</span>
          <div className="w-[220px]">
            <select className={inputCls}
              value={(form.pageOptions && form.pageOptions.summaryBreak) || "auto"}
              onChange={e => set({ pageOptions: { ...(form.pageOptions || {}), summaryBreak: e.target.value } })}>
              <option value="auto">Follow the last section</option>
              <option value="new-page">Always start a new page</option>
            </select>
          </div>
        </div>
      </QSection>

      <QSection title="Terms & conditions" defaultOpen={false}>
        <Field label="Opening line">
          <input className={inputCls} value={form.salutation || ""} onChange={e => set({ salutation: e.target.value })} />
        </Field>
        <Field label="Terms (one per line)">
          <ListEditor rows={7} value={form.workTerms} onChange={v => set({ workTerms: v })} />
        </Field>
        <button type="button" onClick={() => set({ workTerms: WORK_QUOTE_TERMS })}
          className="text-sm text-stone-500 hover:text-stone-800">Reset to standard terms</button>
        <div className="mt-4">
          <Field label="Internal notes (never printed)">
            <textarea rows={2} className={inputCls} value={form.notes || ""} onChange={e => set({ notes: e.target.value })} />
          </Field>
        </div>
      </QSection>

      <QSection title="Signature" subtitle="Who is signing this quotation">
        <SignatoryFields form={form} set={set} currentUser={currentUser} lastSignature={lastSignature} />
      </QSection>

      <div className="fixed bottom-0 left-0 right-0 sm:left-60 bg-white/95 backdrop-blur border-t border-stone-200 px-4 sm:px-8 py-3 z-30"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {errors.length > 0 ? (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 truncate"><AlertCircle size={13} className="shrink-0" /> {errors[0]}</p>
            ) : (
              <p className="text-xs text-stone-500 truncate">
                <span className="font-semibold text-stone-800">{fmtINR(totals.grand)}</span> across {items.filter(i => i.description).length} lines · ready to send
              </p>
            )}
          </div>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
          <button onClick={preview} disabled={errors.length > 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40">
            <Eye size={15} /> <span className="hidden sm:inline">Preview</span>
          </button>
          <button onClick={() => onSave(payload())} disabled={errors.length > 0 || saving}
            className="flex items-center gap-1.5 dia-btn-gold px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40">
            <Check size={15} /> {saving ? "Saving…" : quotation ? "Save changes" : "Create quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Picker for the reusable BOQ item library. Items float to the top by how
   often they've been used, so the partitions and wall units you quote on
   every job are always the first thing you see. */
function BoqLibraryPicker({ library, onPick, onClose, onSaveItem, actions }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(library.map(i => i.category).filter(Boolean))).sort()];
  const filtered = library.filter(i => {
    if (category !== "All" && i.category !== category) return false;
    if (!query.trim()) return true;
    return `${i.particulars} ${i.description} ${i.category || ""}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <Modal title="Add from item library" onClose={onClose} wide>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search particulars or description" className={`${inputCls} pl-9`} />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className={`${inputCls} sm:w-44`}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {library.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">
          The library is empty. Build a line in the BOQ, then use "Save to library" on that row.
        </p>
      )}

      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {filtered.map(item => (
          <button key={item.id} type="button"
            onClick={() => { onPick(item); actions.touchBoqLibraryItem(item.id, item.timesUsed); }}
            className="w-full text-left border border-stone-200 rounded-xl p-3 hover:dia-border-gold hover:bg-stone-50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-800">{item.particulars}</div>
                <div className="text-xs text-stone-500 mt-0.5 line-clamp-2">{item.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-stone-900">{fmtINR(item.rate)}</div>
                <div className="text-[10px] text-stone-400">per {item.unit}</div>
              </div>
            </div>
            {item.category && <span className="inline-block mt-2 text-[10px] dia-bg-cream-soft dia-text-bronze font-semibold px-2 py-0.5 rounded-full">{item.category}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* Keeps an in-progress quotation in the browser so a reload — a deploy, a
   crash, a closed tab — doesn't cost someone an afternoon of BOQ entry. The
   draft is cleared the moment the document is saved or abandoned. */
const draftKey = (docType, id) => `dia:draft:${docType}:${id || "new"}`;

function loadDraft(docType, id) {
  try {
    const raw = window.localStorage.getItem(draftKey(docType, id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft(docType, id, form) {
  try {
    window.localStorage.setItem(draftKey(docType, id), JSON.stringify({ savedAt: Date.now(), form }));
  } catch { /* private mode or a full quota — the editor still works */ }
}

function clearDraft(docType, id) {
  try { window.localStorage.removeItem(draftKey(docType, id)); } catch { /* nothing to do */ }
}

/* Autosaves the form and warns before the tab is closed with unsaved work. */
function useDraft(docType, id, form, dirty) {
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveDraft(docType, id, form), 800);
    return () => clearTimeout(t);
  }, [docType, id, form, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);
}

/* Offered when a draft is found that's newer than what's on the server. */
function DraftBanner({ savedAt, onRestore, onDiscard }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border dia-border-gold-soft dia-bg-cream-soft rounded-xl px-4 py-3">
      <AlertCircle size={16} className="dia-text-bronze shrink-0" />
      <span className="text-sm text-stone-700 flex-1 min-w-[200px]">
        Unsaved changes from {fmtDate(new Date(savedAt).toISOString())} are still here.
      </span>
      <button type="button" onClick={onRestore} className="dia-btn-gold text-xs font-semibold px-3 py-1.5 rounded-lg">Restore them</button>
      <button type="button" onClick={onDiscard} className="text-xs text-stone-500 hover:text-stone-800">Discard</button>
    </div>
  );
}

/* Reads an existing BOQ spreadsheet and shows what was found before anything
   is applied — an import that silently rewrites a priced document would be
   hard to trust, so nothing changes until the summary is accepted. */
function BOQImportPanel({ onApply }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null);      // { sheets, fileName }
  const [chosen, setChosen] = useState({});        // sheet name → included
  const [mode, setMode] = useState("replace");     // replace | append

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError(""); setParsed(null);
    try {
      const result = await parseBOQFile(file);
      setParsed({ ...result, fileName: file.name });
      /* Every sheet is on by default: a workbook split by floor needs all of
         them, and a summary sheet with no items still carries the payment
         terms and any concession. */
      setChosen(Object.fromEntries(result.sheets.map(sh => [sh.name, true])));
    } catch (err) {
      setError(err.message || "That file couldn't be read. Save it as .xlsx or .csv and try again.");
    }
    setBusy(false);
  };

  const sheets = parsed?.sheets || [];
  const selected = sheets.filter(sh => chosen[sh.name]);

  /* Merge the chosen sheets: sections stack in sheet order, and the header and
     tail details are taken from the first sheet that actually supplies them. */
  const merged = () => {
    const multi = selected.filter(sh => sh.sections.length).length > 1;
    const sections = [];
    selected.forEach(sh => sh.sections.forEach(sec => sections.push({
      ...sec,
      group: sec.group || (multi ? sh.name : ""),
    })));
    const firstWith = (key) => selected.find(sh => (sh[key] || []).length)?.[key] || [];
    const withPct = selected.find(sh => sh.extraChargePct > 0);
    const withConcession = selected.find(sh => sh.concession > 0);
    return {
      sections,
      materialSpecs: firstWith("materialSpecs"),
      exclusions: firstWith("exclusions"),
      paymentStages: firstWith("paymentStages"),
      extraChargePct: withPct?.extraChargePct || 0,
      extraChargeLabel: withPct?.extraChargeLabel || "",
      concession: withConcession?.concession || 0,
      concessionLabel: withConcession?.concessionLabel || "",
      warnings: selected.flatMap(sh => sh.warnings.map(w => sh.name + ": " + w)),
    };
  };

  const view = parsed ? merged() : null;
  const itemCount = view ? view.sections.reduce((n, sec) => n + sec.items.length, 0) : 0;
  const totals = view ? boqTotals({ boqSections: view.sections, extraChargePct: view.extraChargePct, concession: view.concession }) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 border border-dashed border-stone-300 rounded-lg px-4 py-2.5 text-sm text-stone-600 cursor-pointer hover:dia-border-gold hover:dia-text-bronze">
          <Upload size={15} /> {busy ? "Reading…" : "Choose a BOQ spreadsheet"}
          <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={pick} disabled={busy} />
        </label>
        <p className="text-xs text-stone-500">Excel or CSV. Every sheet is read — pick which ones to bring in.</p>
      </div>
      {error && <p className="text-xs text-rose-600 mt-2 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</p>}

      {parsed && (
        <div className="mt-4 border dia-border-gold-soft rounded-xl overflow-hidden">
          <div className="dia-bg-cream-soft px-4 py-3">
            <div className="text-sm font-semibold text-stone-800">{parsed.fileName}</div>
            <div className="text-xs text-stone-600 mt-0.5">
              {view.sections.length} section{view.sections.length !== 1 ? "s" : ""} · {itemCount} line item{itemCount !== 1 ? "s" : ""} · {fmtINR(totals.grand)} grand total
            </div>
          </div>

          {sheets.length > 1 && (
            <div className="px-4 py-3 border-b border-stone-100 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold mb-1">Sheets in this workbook</div>
              {sheets.map(sh => (
                <label key={sh.name} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" className="accent-current dia-text-bronze" checked={!!chosen[sh.name]}
                    onChange={e => setChosen(c => ({ ...c, [sh.name]: e.target.checked }))} />
                  <span className="text-xs text-stone-700 flex-1 truncate">{sh.name}</span>
                  <span className="text-[11px] text-stone-500 shrink-0">
                    {sh.itemCount > 0
                      ? `${sh.sections.length} sections · ${sh.itemCount} items`
                      : sh.paymentStages.length || sh.concession
                        ? "summary only — terms & concession"
                        : "nothing found"}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="px-4 py-3 max-h-56 overflow-y-auto space-y-1.5">
            {view.sections.map((sec, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-stone-700 truncate">
                  <span className="font-mono text-stone-400 mr-1.5">{sectionCode(i)}</span>
                  {sec.title}
                  {sec.group && <span className="text-stone-400"> · {sec.group}</span>}
                </span>
                <span className="text-stone-500 shrink-0">{sec.items.length} items · {fmtINR(boqSectionTotal(sec))}</span>
              </div>
            ))}
          </div>

          {view.warnings.length > 0 && (
            <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 space-y-1">
              {view.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-800 flex items-start gap-1.5"><AlertCircle size={12} className="mt-0.5 shrink-0" /> {w}</p>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5 flex-1">
              {[["replace", "Replace everything"], ["append", "Add to what's here"]].map(([v, label]) => (
                <button key={v} type="button" onClick={() => setMode(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    mode === v ? "dia-btn-gold dia-border-gold" : "border-stone-300 text-stone-600 hover:bg-stone-50"}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setParsed(null)}
              className="px-3 py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800">Discard</button>
            <button type="button" disabled={!view.sections.length}
              onClick={() => { onApply(view, mode); setParsed(null); }}
              className="dia-btn-gold px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
              <Check size={13} /> Import
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* Shows how the BOQ actually paginates and lets a break be set against it.
   The page numbers come from laying the document out with the real generator,
   so what's shown here is what prints — no second estimate to drift. */
function BOQPageMap({ form, payload, onToggleBreak }) {
  const [layout, setLayout] = useState(null);
  const [error, setError] = useState("");

  /* Re-measuring runs the whole layout, so it's debounced rather than run on
     every keystroke. */
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setLayout(generateBOQPdf(payload(), "measure"));
        setError("");
      } catch (err) {
        setError(err.message || "Couldn't work out the page layout.");
      }
    }, 400);
    return () => clearTimeout(id);
  }, [form.boqSections, form.materialSpecs, form.exclusions, form.paymentStages,
      form.showPaymentTerms, form.pageOptions, form.extraChargePct, form.concession]);

  if (error) return <p className="text-xs text-rose-600 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</p>;
  if (!layout) return <p className="text-xs text-stone-400">Working out the page layout…</p>;

  const pages = [];
  for (let p = 1; p <= layout.pages; p++) {
    pages.push({
      number: p,
      sections: layout.sections.filter(s => s.page === p),
      hasTail: layout.tailPage === p,
    });
  }

  return (
    <>
      <p className="text-xs text-stone-500 mb-3">
        {layout.pages} A3 page{layout.pages !== 1 ? "s" : ""}. Click a section to start it on a new page, or click again to let it flow.
      </p>
      <div className="space-y-2">
        {pages.map(page => (
          <div key={page.number} className="border border-stone-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 border-b border-stone-100">
              <span className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">Page {page.number}</span>
              {page.hasTail && <span className="text-[10px] dia-text-bronze font-semibold">· totals & terms</span>}
              {page.sections.length === 0 && !page.hasTail && <span className="text-[10px] text-stone-400">continued</span>}
            </div>
            <div className="p-2 flex flex-wrap gap-1.5">
              {page.sections.length === 0 && (
                <span className="text-xs text-stone-400 px-1.5 py-1">Continuation of the previous page</span>
              )}
              {page.sections.map(sec => (
                <button key={sec.index} type="button" onClick={() => onToggleBreak(sec.index)}
                  title={sec.pageBreak ? "Starts a new page — click to let it flow" : "Click to start this section on a new page"}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    sec.pageBreak
                      ? "dia-btn-gold dia-border-gold font-semibold"
                      : "border-stone-200 text-stone-600 hover:dia-border-gold hover:dia-text-bronze"}`}>
                  <span className="font-mono text-[10px] opacity-60">{sectionCode(sec.index)}</span>
                  <span className="truncate max-w-[220px]">{sec.title || "Untitled"}</span>
                  {sec.pageBreak && <span className="text-[10px]">↵ break</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* Bill of Quantities: sections of priced line items, used when a client moves
   past design into turnkey execution. */
function BOQEditor({ quotation, data, currentUser, onSave, onCancel, saving, lastSignature, actions }) {
  const [form, setForm] = useState(() => quotation ? { ...quotation } : blankBOQ(null));
  const [picker, setPicker] = useState(null);        // { sectionIndex }
  const [savedToLibrary, setSavedToLibrary] = useState({});
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(() => loadDraft("boq", quotation?.id));
  const set = (patch) => { setDirty(true); setForm(f => ({ ...f, ...patch })); };

  useDraft("boq", quotation?.id, form, dirty);

  const sections = form.boqSections || [];
  const library = data.boqLibrary || [];
  const totals = boqTotals(form);

  const setSection = (si, patch) => {
    const next = [...sections];
    next[si] = { ...next[si], ...patch };
    set({ boqSections: next });
  };
  const setItem = (si, ii, patch) => {
    const next = [...sections];
    const items = [...(next[si].items || [])];
    items[ii] = { ...items[ii], ...patch };
    next[si] = { ...next[si], items };
    set({ boqSections: next });
  };
  const addItem = (si, seed) => {
    const next = [...sections];
    next[si] = {
      ...next[si],
      items: [...(next[si].items || []), seed || { particulars: "", description: "", length: 0, height: 0, qty: 0, unit: "Sq.ft.", rate: 0, remarks: "" }],
    };
    set({ boqSections: next });
  };
  const removeItem = (si, ii) => {
    const next = [...sections];
    next[si] = { ...next[si], items: next[si].items.filter((_, x) => x !== ii) };
    set({ boqSections: next });
  };

  const errors = [];
  if (!String(form.clientName || "").trim()) errors.push("Client name is required.");
  if (!sections.some(s => (s.items || []).some(i => String(i.particulars || "").trim()))) errors.push("Add at least one line item.");
  if (totals.grand <= 0) errors.push("The BOQ total must be greater than zero.");
  const showPayment = form.showPaymentTerms !== false;
  const gstNoteText = String(form.gstNote || "").trim();
  const gstMode = !gstNoteText ? "none"
    : gstNoteText === BOQ_GST_NOTES.exclusive ? "exclusive"
    : gstNoteText === BOQ_GST_NOTES.inclusive ? "inclusive"
    : "custom";
  const pctTotal = (form.paymentStages || []).reduce((s, st) => s + (Number(st.percentage) || 0), 0);
  if (showPayment && Math.abs(pctTotal - 100) > 0.01) {
    errors.push(`Payment stages add up to ${pctTotal}% — they must total 100%.`);
  }

  const payload = () => ({
    ...form,
    docType: "boq",
    materialSpecs: cleanList(form.materialSpecs),
    exclusions: cleanList(form.exclusions),
    boqSections: sections
      .filter(s => String(s.title || "").trim() || (s.items || []).length)
      .map(s => ({
        group: s.group || "", title: s.title || "", note: s.note || "", pageBreak: !!s.pageBreak,
        items: (s.items || [])
          .filter(i => String(i.particulars || "").trim() || String(i.description || "").trim())
          .map(i => ({
            particulars: i.particulars || "", description: i.description || "",
            length: Number(i.length) || 0, height: Number(i.height) || 0,
            qty: Number(i.qty) || 0, unit: i.unit || "", rate: Number(i.rate) || 0,
            amount: i.amount === "" || i.amount === null || i.amount === undefined ? "" : Number(i.amount),
            remarks: i.remarks || "",
          })),
      })),
    totalFee: totals.grand,
  });

  const applyProject = (projectId) => {
    const p = data.projects.find(x => x.id === projectId);
    if (!p) { set({ projectId: null }); return; }
    set({
      projectId: p.id,
      clientName: form.clientName || p.client,
      projectTitle: form.projectTitle || p.name,
      location: form.location || p.location,
      clientAddress: form.clientAddress || p.location,
    });
  };

  /* Applies a parsed spreadsheet. Only the parts the file actually contained
     are overwritten, so importing a sheet with no exclusions doesn't wipe the
     standard ones already in the document. */
  const applyImport = (parsed, mode) => {
    const incoming = parsed.sections.map(s => ({ group: s.group || "", title: s.title || "", note: "", items: s.items }));
    const patch = {
      boqSections: mode === "append" ? [...sections, ...incoming] : incoming,
    };
    if (parsed.materialSpecs.length) patch.materialSpecs = parsed.materialSpecs;
    if (parsed.exclusions.length) patch.exclusions = parsed.exclusions;
    if (parsed.paymentStages.length) patch.paymentStages = parsed.paymentStages;
    if (parsed.extraChargePct) {
      patch.extraChargePct = parsed.extraChargePct;
      if (parsed.extraChargeLabel) patch.extraChargeLabel = parsed.extraChargeLabel;
    }
    if (parsed.concession) {
      patch.concession = parsed.concession;
      if (parsed.concessionLabel) patch.concessionLabel = parsed.concessionLabel;
    }
    set(patch);
  };

  const saveRowToLibrary = async (si, ii) => {
    const item = sections[si].items[ii];
    if (!String(item.particulars || "").trim()) return;
    try {
      await actions.addBoqLibraryItem({
        particulars: item.particulars, description: item.description,
        unit: item.unit, rate: item.rate, category: sections[si].title || null,
      });
      setSavedToLibrary(m => ({ ...m, [`${si}-${ii}`]: true }));
    } catch (err) {
      alert(err.message || "Could not save that item to the library.");
    }
  };

  const preview = () => {
    /* Opening the PDF in another tab used to come back to a reloaded app, so
       the current state is written out before leaving. */
    saveDraft("boq", quotation?.id, form);
    const url = generateBOQPdf({ ...payload(), quotationNo: form.quotationNo || "DRAFT" }, "preview");
    if (url) window.open(url, "_blank");
  };

  const finish = (fn) => (...args) => { clearDraft("boq", quotation?.id); setDirty(false); return fn(...args); };

  return (
    <div className="p-4 sm:p-8 pb-32 space-y-4">
      <button onClick={() => {
        if (dirty && !window.confirm("Leave without saving? Your changes are kept as a draft.")) return;
        onCancel();
      }} className="flex items-center gap-1.5 text-sm dia-text-bronze font-medium">
        <ArrowLeft size={15} /> Back to quotations
      </button>

      {draft && (
        <DraftBanner savedAt={draft.savedAt}
          onRestore={() => { setForm(draft.form); setDraft(null); setDirty(true); }}
          onDiscard={() => { clearDraft("boq", quotation?.id); setDraft(null); }} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900">
            {quotation ? "Edit bill of quantities" : "New bill of quantities"}
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            {quotation
              ? <>BOQ <span className="font-mono text-xs">{quotation.quotationNo}</span> · last updated {fmtDate(quotation.updatedAt)}</>
              : "Priced schedule of works for turnkey execution."}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start ${QUOTE_STATUS_STYLES[form.status]}`}>{form.status}</span>
      </div>

      <QSection title="Client & project">
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Link to an existing project (optional)">
            <select className={inputCls} value={form.projectId || ""} onChange={e => applyProject(e.target.value)}>
              <option value="">Not linked — standalone BOQ</option>
              {data.projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.client}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={e => set({ status: e.target.value })}>
              {QUOTATION_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Client name *">
            <input className={inputCls} value={form.clientName} onChange={e => set({ clientName: e.target.value })}
              placeholder="Diahart" />
          </Field>
          <Field label="Project / showroom">
            <input className={inputCls} value={form.projectTitle} onChange={e => set({ projectTitle: e.target.value })}
              placeholder="Showroom interiors" />
          </Field>
          <Field label="Location">
            <input className={inputCls} value={form.location || ""} onChange={e => set({ location: e.target.value })}
              placeholder="Anna Nagar" />
          </Field>
          <Field label="Date">
            <input type="date" className={inputCls} value={form.date} onChange={e => set({ date: e.target.value })} />
          </Field>
        </div>
      </QSection>

      <QSection title="Import an existing BOQ"
        subtitle="Bring an old Excel BOQ into this format instead of retyping it"
        defaultOpen={!quotation && sections.length <= 1 && !(sections[0]?.items || []).some(i => i.particulars)}>
        <BOQImportPanel onApply={applyImport} />
      </QSection>

      <QSection title="Material specifications" subtitle="Printed at the head of the BOQ — one per line" defaultOpen={false}>
        <ListEditor rows={12} value={form.materialSpecs} onChange={v => set({ materialSpecs: v })} />
        <button type="button" onClick={() => set({ materialSpecs: BOQ_MATERIAL_SPECS })}
          className="text-sm text-stone-500 hover:text-stone-800 mt-2">Reset to standard specifications</button>
      </QSection>

      {sections.map((section, si) => {
        const sectionSum = boqSectionTotal(section);
        return (
          <QSection key={si}
            title={`${sectionCode(si)}. ${section.title || "Untitled section"}`}
            subtitle={section.group || undefined}
            badge={<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full dia-bg-cream-soft dia-text-bronze">{fmtINR(sectionSum)}</span>}>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Section name">
                <input className={inputCls} value={section.title || ""}
                  onChange={e => setSection(si, { title: e.target.value })} placeholder="Entrance Lobby" />
              </Field>
              <Field label="Area / floor heading (repeat to group sections)">
                <input className={inputCls} value={section.group || ""}
                  onChange={e => setSection(si, { group: e.target.value })} placeholder="Ground Floor" />
              </Field>
            </div>
            <label className="flex items-center gap-2 -mt-1 mb-3 cursor-pointer">
              <input type="checkbox" className="accent-current dia-text-bronze" checked={!!section.pageBreak}
                onChange={e => setSection(si, { pageBreak: e.target.checked })} />
              <span className="text-xs text-stone-600">Start this section on a new page</span>
            </label>

            <div className="space-y-3">
              {(section.items || []).map((item, ii) => {
                const qty = boqItemQty(item);
                const key = `${si}-${ii}`;
                return (
                  <div key={ii} className="border border-stone-200 rounded-xl p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xs text-stone-400 font-mono pt-2.5 w-5 shrink-0">{ii + 1}.</span>
                      <input className={`${inputCls} font-semibold`} value={item.particulars || ""}
                        onChange={e => setItem(si, ii, { particulars: e.target.value })} placeholder="Particulars, e.g. Plywood partition" />
                      <button type="button" onClick={() => removeItem(si, ii)}
                        className="text-stone-300 hover:text-rose-600 pt-2.5 shrink-0"><Trash2 size={15} /></button>
                    </div>
                    <textarea rows={2} className={`${inputCls} mb-2`} value={item.description || ""}
                      onChange={e => setItem(si, ii, { description: e.target.value })}
                      placeholder="Full specification as it should read on the BOQ" />
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <label className="block">
                        <span className="block text-[10px] text-stone-500 mb-1">Length (ft)</span>
                        <input type="number" className={inputCls} value={item.length || ""}
                          onChange={e => setItem(si, ii, { length: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="block text-[10px] text-stone-500 mb-1">Height (ft)</span>
                        <input type="number" className={inputCls} value={item.height || ""}
                          onChange={e => setItem(si, ii, { height: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="block text-[10px] text-stone-500 mb-1">
                          Qty {Number(item.length) > 0 && Number(item.height) > 0 && <span className="dia-text-bronze">(auto)</span>}
                        </span>
                        <input type="number" className={inputCls} value={Number(item.length) > 0 && Number(item.height) > 0 ? qty : (item.qty || "")}
                          disabled={Number(item.length) > 0 && Number(item.height) > 0}
                          onChange={e => setItem(si, ii, { qty: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="block text-[10px] text-stone-500 mb-1">Unit</span>
                        <input list="boq-units" className={inputCls} value={item.unit || ""}
                          onChange={e => setItem(si, ii, { unit: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="block text-[10px] text-stone-500 mb-1">Rate (₹)</span>
                        <input type="number" className={inputCls} value={item.rate || ""}
                          onChange={e => setItem(si, ii, { rate: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="block text-[10px] text-stone-500 mb-1">
                          Amount {boqItemIsOverridden(item)
                            ? <span className="dia-text-bronze" title="Set by hand — clear to calculate">(set)</span>
                            : <span className="text-stone-400">(auto)</span>}
                        </span>
                        <input type="number" className={`${inputCls} ${boqItemIsOverridden(item) ? "dia-border-gold font-semibold" : ""}`}
                          placeholder={String(boqItemQty(item) * (Number(item.rate) || 0) || "")}
                          value={item.amount ?? ""}
                          onChange={e => setItem(si, ii, { amount: e.target.value })} />
                      </label>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input className={`${inputCls} text-xs`} value={item.remarks || ""}
                        onChange={e => setItem(si, ii, { remarks: e.target.value })} placeholder="Remarks (optional)" />
                      <button type="button" onClick={() => saveRowToLibrary(si, ii)}
                        className="text-xs dia-text-bronze font-semibold shrink-0 whitespace-nowrap">
                        {savedToLibrary[key] ? "Saved ✓" : "Save to library"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button type="button" onClick={() => setPicker({ sectionIndex: si })}
                className="flex items-center gap-1.5 text-sm dia-btn-gold font-semibold px-3 py-2 rounded-lg">
                <ListChecks size={14} /> Add from library
              </button>
              <button type="button" onClick={() => addItem(si)}
                className="flex items-center gap-1.5 text-sm dia-text-bronze font-semibold">
                <Plus size={14} /> Blank line
              </button>
              <span className="flex-1" />
              <button type="button" onClick={() => set({ boqSections: sections.filter((_, x) => x !== si) })}
                className="text-xs text-stone-400 hover:text-rose-600">Remove section</button>
            </div>
          </QSection>
        );
      })}

      <datalist id="boq-units">{BOQ_UNITS.map(u => <option key={u} value={u} />)}</datalist>

      <button type="button"
        onClick={() => set({ boqSections: [...sections, { group: sections[sections.length - 1]?.group || "", title: "", note: "", items: [] }] })}
        className="flex items-center gap-1.5 text-sm dia-text-bronze font-semibold">
        <Plus size={15} /> Add section
      </button>

      <QSection title="Totals & payment terms"
        badge={<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full dia-bg-cream-soft dia-text-bronze">{fmtINR(totals.grand)}</span>}>
        <div className="dia-bg-cream-soft rounded-xl p-4 space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Sub total ({sections.length} section{sections.length !== 1 ? "s" : ""})</span>
            <span className="font-semibold text-stone-900">{fmtINR(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <input className={`${inputCls} flex-1 min-w-0 text-xs`} value={form.extraChargeLabel || ""}
              onChange={e => set({ extraChargeLabel: e.target.value })} />
            <div className="relative w-24 shrink-0">
              <input type="number" step="0.1" className={`${inputCls} pr-6 text-right`} value={form.extraChargePct ?? ""}
                onChange={e => set({ extraChargePct: e.target.value })} />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">%</span>
            </div>
            <span className="font-semibold text-stone-900 w-28 text-right shrink-0">{fmtINR(totals.extra)}</span>
          </div>
          {/* Width classes have to sit on a wrapper: inputCls carries w-full,
              which wins over a w-28 on the input itself and stretches the row. */}
          <div className="flex items-center justify-between gap-3 text-sm">
            <input className={`${inputCls} flex-1 min-w-0 text-xs`} value={form.concessionLabel || ""}
              onChange={e => set({ concessionLabel: e.target.value })} placeholder="Less: concession (optional)" />
            <div className="w-24 shrink-0" />
            <div className="w-28 shrink-0">
              <input type="number" className={`${inputCls} text-right`} value={form.concession || ""}
                onChange={e => set({ concession: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t dia-border-gold-soft">
            <span className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">Grand total</span>
            <span className="font-display text-2xl font-semibold text-stone-900">{fmtINR(totals.grand)}</span>
          </div>
          <p className="text-xs text-stone-600 italic">{amountInWords(totals.grand)}</p>

          {/* Whether the quoted figure carries GST — printed under the grand
              total on both the PDF and the spreadsheet. */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <div className="w-[230px]">
              <select className={inputCls} value={gstMode}
                onChange={e => {
                  const v = e.target.value;
                  if (v === "exclusive") set({ gstNote: BOQ_GST_NOTES.exclusive });
                  else if (v === "inclusive") set({ gstNote: BOQ_GST_NOTES.inclusive });
                  else if (v === "none") set({ gstNote: "" });
                  else set({ gstNote: form.gstNote || "GST " });
                }}>
                <option value="exclusive">Rates exclude GST</option>
                <option value="inclusive">Rates include GST</option>
                <option value="custom">Custom wording…</option>
                <option value="none">Print no GST note</option>
              </select>
            </div>
          </div>
          {gstMode === "custom" && (
            <input className={`${inputCls} text-xs`} value={form.gstNote || ""}
              onChange={e => set({ gstNote: e.target.value })}
              placeholder="e.g. GST at 18% extra as applicable." />
          )}
        </div>

        <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-current dia-text-bronze" checked={showPayment}
            onChange={e => set({ showPaymentTerms: e.target.checked })} />
          <span>
            <span className="text-sm font-semibold text-stone-800">Print payment terms on this BOQ</span>
            <span className="block text-xs text-stone-500">
              Turn off to send a pure schedule of rates. The stages below stay saved, they just don't appear in the PDF or the Excel.
            </span>
          </span>
        </label>

        {showPayment && (
        <div className="text-xs font-semibold text-stone-600 mb-2 flex items-center gap-2">
          Payment stages
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${Math.abs(pctTotal - 100) < 0.01 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{pctTotal}%</span>
        </div>)}
        {showPayment && (<>
        <div className="space-y-2">
          {(form.paymentStages || []).map((st, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className={`${inputCls} col-span-2 sm:col-span-1`} value={st.stage}
                onChange={e => { const n = [...form.paymentStages]; n[i] = { ...st, stage: e.target.value }; set({ paymentStages: n }); }} />
              <input className={`${inputCls} col-span-6`} value={st.milestone}
                onChange={e => { const n = [...form.paymentStages]; n[i] = { ...st, milestone: e.target.value }; set({ paymentStages: n }); }} />
              <div className="col-span-2 relative">
                <input type="number" className={`${inputCls} pr-5`} value={st.percentage}
                  onChange={e => { const n = [...form.paymentStages]; n[i] = { ...st, percentage: Number(e.target.value) }; set({ paymentStages: n }); }} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">%</span>
              </div>
              <div className="col-span-2 sm:col-span-2 text-sm font-semibold text-right tabular-nums">
                {fmtINR(computeStageAmounts(totals.grand, form.paymentStages)[i])}
              </div>
              <button type="button" onClick={() => set({ paymentStages: form.paymentStages.filter((_, x) => x !== i) })}
                className="col-span-1 text-stone-300 hover:text-rose-600 flex justify-center"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <button type="button"
            onClick={() => set({ paymentStages: [...(form.paymentStages || []), { stage: String((form.paymentStages?.length || 0) + 1), milestone: "", percentage: 0 }] })}
            className="flex items-center gap-1.5 text-sm dia-text-bronze font-semibold"><Plus size={14} /> Add stage</button>
          <button type="button" onClick={() => set({ paymentStages: BOQ_PAYMENT_TEMPLATE })}
            className="text-sm text-stone-500 hover:text-stone-800">Reset to standard stages</button>
        </div>
        </>)}
      </QSection>

      <QSection title="Page layout" subtitle="Where each section falls on the printed A3 sheets" defaultOpen={false}>
        <BOQPageMap form={form} payload={payload}
          onToggleBreak={(i) => {
            const next = [...sections];
            next[i] = { ...next[i], pageBreak: !next[i].pageBreak };
            set({ boqSections: next });
          }} />
      </QSection>

      <QSection title="Exclusions" subtitle="Work not covered by this BOQ — one per line" defaultOpen={false}>
        <ListEditor rows={9} value={form.exclusions} onChange={v => set({ exclusions: v })} />
        <button type="button" onClick={() => set({ exclusions: BOQ_EXCLUSIONS })}
          className="text-sm text-stone-500 hover:text-stone-800 mt-2">Reset to standard exclusions</button>
        <div className="mt-4">
          <Field label="Internal notes (never printed)">
            <textarea rows={2} className={inputCls} value={form.notes || ""} onChange={e => set({ notes: e.target.value })} />
          </Field>
        </div>
      </QSection>

      <QSection title="Signature" defaultOpen={false}>
        <SignatoryFields form={form} set={set} currentUser={currentUser} lastSignature={lastSignature} />
      </QSection>

      {picker && (
        <BoqLibraryPicker
          library={library}
          actions={actions}
          onClose={() => setPicker(null)}
          onPick={(item) => {
            addItem(picker.sectionIndex, {
              particulars: item.particulars, description: item.description,
              length: 0, height: 0, qty: 0, unit: item.unit, rate: item.rate, amount: "", remarks: "",
            });
            setPicker(null);
          }} />
      )}

      <div className="fixed bottom-0 left-0 right-0 sm:left-60 bg-white/95 backdrop-blur border-t border-stone-200 px-4 sm:px-8 py-3 z-30"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            {errors.length > 0 ? (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 truncate"><AlertCircle size={13} className="shrink-0" /> {errors[0]}</p>
            ) : (
              <p className="text-xs text-stone-500 truncate">
                <span className="font-semibold text-stone-800">{fmtINR(totals.grand)}</span> across {sections.length} sections · ready to send
              </p>
            )}
          </div>
          <button onClick={onCancel} className="px-3 py-2.5 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
          <button onClick={() => exportBOQExcel({ ...payload(), quotationNo: form.quotationNo || "DRAFT" })} disabled={errors.length > 0}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40">
            <FileSpreadsheet size={15} /> <span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={preview} disabled={errors.length > 0}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40">
            <Eye size={15} /> <span className="hidden sm:inline">Preview</span>
          </button>
          <button onClick={() => finish(onSave)(payload())} disabled={errors.length > 0 || saving}
            className="flex items-center gap-1.5 dia-btn-gold px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40">
            <Check size={15} /> {saving ? "Saving…" : quotation ? "Save" : "Create BOQ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamView({ data, currentUser, actions }) {
  const { users, projects, siteReports } = data;
  const [editingUser, setEditingUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);

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
    const missedCount = u.role === "Supervisor"
      ? assigned.reduce((sum, p) => sum + computeMissedReportSlots(p, siteReports, u.id).length, 0)
      : 0;
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
          {missedCount > 0 && (
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle size={10} /> {missedCount} missed (7d)
            </span>
          )}
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
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-stone-400 max-w-md">Add teammates directly with a role and password, or let them sign up themselves and activate them below.</p>
        <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 dia-btn-gold font-semibold text-sm px-4 py-2.5 rounded-lg shrink-0">
          <Plus size={16} /> Add Teammate
        </button>
      </div>
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

      {showAddUser && (
        <Modal title="Add Teammate" onClose={() => setShowAddUser(false)}>
          <AddUserForm onSave={async (fields) => { await actions.adminCreateUser(fields); setShowAddUser(false); }} />
        </Modal>
      )}
      {editingUser && (
        <EditUserModal user={editingUser} isSelf={editingUser.id === currentUser.id} onClose={() => setEditingUser(null)}
          onSave={(updates) => { actions.updateUser(editingUser.id, updates); setEditingUser(null); }}
          onRemove={() => { actions.removeUser(editingUser.id); setEditingUser(null); }}
          onResetPassword={(password) => actions.adminResetPassword(editingUser.id, password)} />
      )}
    </div>
  );
}

function AddUserForm({ onSave }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Supervisor", rank: ARCHITECT_RANKS[2] });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const genPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, password: pw }));
    setShowPassword(true);
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        role: form.role, rank: form.role === "Architect" ? form.rank : null,
      });
    } catch (err) {
      setError(err.message || "Failed to create account.");
      setBusy(false);
    }
  };

  return (
    <div>
      <Field label="Full name"><input autoFocus className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. Neha Kapoor" /></Field>
      <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={set("email")} placeholder="name@diaretailsolutions.com" /></Field>
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
      <Field label="Password">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input type={showPassword ? "text" : "password"} className={inputCls} value={form.password} onChange={set("password")} placeholder="At least 6 characters" />
            <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button type="button" onClick={genPassword} className="text-xs font-semibold text-stone-600 border border-stone-200 rounded-lg px-3 hover:border-stone-400 shrink-0">Generate</button>
        </div>
        <p className="text-[11px] text-stone-400 mt-1">Share this password with them directly — it won't be shown here again.</p>
      </Field>
      {error && <p className="text-xs text-rose-600 mb-3 -mt-2">{error}</p>}
      <button onClick={handleSave} disabled={busy}
        className="w-full dia-btn-gold disabled:opacity-40 font-semibold text-sm py-2.5 rounded-lg mt-1">
        {busy ? "Creating…" : "Create account"}
      </button>
      <p className="text-[11px] text-stone-400 mt-2 text-center">This account is active immediately — no separate approval step needed.</p>
    </div>
  );
}

function ResetPasswordBlock({ userName, onReset }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const genPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setPassword(pw);
    setShowPassword(true);
  };

  const handleReset = async () => {
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      await onReset(password);
      setDone(true);
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-xs font-semibold dia-text-bronze hover:underline text-left">
        Forgot password? Set a new one for {userName.split(" ")[0]}
      </button>
    );
  }

  if (done) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-emerald-700">Password updated. Share it with {userName.split(" ")[0]} directly — it won't be shown again here.</p>
        <div className="font-mono text-sm bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 select-all">{password}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">Set a new password for {userName}. This signs them out anywhere they're currently logged in.</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type={showPassword ? "text" : "password"} className={inputCls} value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" />
          <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <button type="button" onClick={genPassword} className="text-xs font-semibold text-stone-600 border border-stone-200 rounded-lg px-3 hover:border-stone-400 shrink-0">Generate</button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleReset} disabled={busy} className="flex-1 text-xs font-semibold text-white bg-stone-800 hover:bg-stone-900 disabled:opacity-40 py-2 rounded-lg">
          {busy ? "Setting…" : "Set new password"}
        </button>
        <button onClick={() => { setOpen(false); setPassword(""); setError(""); }} className="flex-1 text-xs font-semibold text-stone-600 border border-stone-200 py-2 rounded-lg">Cancel</button>
      </div>
    </div>
  );
}

function EditUserModal({ user, isSelf, onClose, onSave, onRemove, onResetPassword }) {
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

      {onResetPassword && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <ResetPasswordBlock userName={user.name} onReset={onResetPassword} />
        </div>
      )}

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

function MissedReportsBanner({ project, missed, setView }) {
  if (missed.length === 0) return null;
  const shown = missed.slice(0, 5);
  return (
    <Card className="p-4 border-rose-200 bg-rose-50/50">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={16} className="text-rose-600" />
        <h3 className="text-sm font-semibold text-rose-800">{missed.length} report{missed.length !== 1 ? "s" : ""} missing</h3>
      </div>
      <p className="text-xs text-rose-700 mb-2">You didn't submit these on time. Please update them as soon as possible.</p>
      <div className="space-y-1 mb-2">
        {shown.map((m, i) => (
          <div key={i} className="text-xs text-stone-700 bg-white/70 rounded-lg px-3 py-1.5">{m.slot} report — {fmtDate(m.date)}</div>
        ))}
        {missed.length > shown.length && <p className="text-[11px] text-rose-600">+{missed.length - shown.length} more</p>}
      </div>
      <button onClick={() => setView({ tab: "project", projectId: project.id, sub: "reports" })}
        className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg">
        Update now
      </button>
    </Card>
  );
}

function OpenVisitBanner({ project, visit, setView }) {
  if (!visit) return null;
  const isYesterdayOrOlder = new Date(visit.entryTime).toDateString() !== TODAY.toDateString();
  if (!isYesterdayOrOlder) return null;
  return (
    <Card className="p-4 border-rose-200 bg-rose-50/50">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={16} className="text-rose-600" />
        <h3 className="text-sm font-semibold text-rose-800">Site visit from {fmtDate(visit.entryTime.slice(0, 10))} isn't closed out</h3>
      </div>
      <p className="text-xs text-rose-700 mb-2">You checked in but never logged your exit photo and minutes of meeting. Please close it out.</p>
      <button onClick={() => setView({ tab: "project", projectId: project.id, sub: "visits" })}
        className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg">
        Close it now
      </button>
    </Card>
  );
}

function SupervisorHome({ data, currentUser, actions, setView }) {
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

      <MissedReportsBanner project={project} missed={computeMissedReportSlots(project, data.siteReports, currentUser.id)} setView={setView} />

      {(() => {
        const approvedMaterials = data.materialRequests.filter(m => m.projectId === project.id && m.status === "Approved");
        if (approvedMaterials.length === 0) return null;
        return (
          <Card className="p-4 border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center gap-2 mb-2">
              <Store size={16} className="text-emerald-700" />
              <h3 className="text-sm font-semibold text-emerald-800">{approvedMaterials.length} material request{approvedMaterials.length !== 1 ? "s" : ""} approved</h3>
            </div>
            <div className="space-y-2">
              {approvedMaterials.slice(0, 4).map(m => (
                <div key={m.id} className="text-xs text-stone-700 bg-white/70 rounded-lg px-3 py-2">
                  <div className="font-medium whitespace-pre-wrap">{m.items}</div>
                  {m.neededBy && <div className="text-stone-500 mt-0.5">Needed by {fmtDate(m.neededBy)}</div>}
                </div>
              ))}
            </div>
            {approvedMaterials.length > 4 && <p className="text-[11px] text-emerald-700 mt-1.5 mb-2">+{approvedMaterials.length - 4} more</p>}
            <button onClick={() => setView({ tab: "project", projectId: project.id, sub: "materials" })}
              className="mt-3 w-full text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-lg">
              Confirm materials received →
            </button>
          </Card>
        );
      })()}

      <div>
        <h3 className="text-sm font-semibold text-stone-700 mb-2.5">Today's Site Report</h3>
        <div className="grid grid-cols-2 gap-3">
          {actionBtn(ClipboardList, "Add Update", () => setModal("report"), "dia-btn-gold")}
          {actionBtn(Receipt, "Add Expense", () => setModal("expense"))}
          {actionBtn(Camera, "Upload Photos", () => setModal("photo"))}
          {actionBtn(AlertTriangle, "Report Issue", () => setModal("issue"), "bg-white border border-rose-200 text-rose-700")}
          {actionBtn(Store, "Materials", () => setView({ tab: "project", projectId: project.id, sub: "materials" }))}
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
        <ExpenseForm defaultProjectId={project.id} vendors={data.vendors} onSave={(exp) => { actions.addExpense({ ...exp, projectId: project.id, submittedBy: currentUser.id }); setModal(null); }} />
      </Modal>}
      {modal === "photo" && <Modal title="Upload Site Photo" onClose={() => setModal(null)}>
        <PhotoForm onSave={(p) => { actions.addPhoto(project.id, p, currentUser.id); setModal(null); }} />
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
  const myOpenVisit = data.siteVisits.find(v => v.status === "Open" && v.architectId === currentUser.id);
  const openVisitProject = myOpenVisit ? myProjects.find(p => p.id === myOpenVisit.projectId) : null;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-wide dia-text-bronze font-label font-semibold">{currentUser.rank}</div>
        <p className="text-sm text-stone-500 mt-1">Tap a project to update its design phases and working-drawings checklist.</p>
      </Card>

      {openVisitProject && <OpenVisitBanner project={openVisitProject} visit={myOpenVisit} setView={setView} />}

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

/* Offers a new deploy without taking the decision away. Sits at the foot of
   the screen until it's accepted or dismissed. */
function UpdateBanner() {
  const [apply, setApply] = useState(null);
  useEffect(() => {
    const onUpdate = (e) => setApply(() => e.detail.apply);
    window.addEventListener("dia:update-available", onUpdate);
    return () => window.removeEventListener("dia:update-available", onUpdate);
  }, []);
  if (!apply) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-xl">
      <span className="text-sm">A new version is ready.</span>
      <button onClick={() => apply()} className="dia-btn-gold text-xs font-semibold px-3 py-1.5 rounded-lg">Reload</button>
      <button onClick={() => setApply(null)} className="text-xs text-stone-400 hover:text-white">Later</button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Floating calculator                                                      */
/* ---------------------------------------------------------------------- */

/* Conversions the studio actually needs: drawings come in feet and inches,
   client sheets in metres, and rates get quoted per sq.ft here but per sq.m
   by some vendors. Every factor converts to the group's base unit. */
const CONVERSIONS = {
  Length: {
    base: "m",
    units: { "mm": 0.001, "cm": 0.01, "m": 1, "inch": 0.0254, "feet": 0.3048, "yard": 0.9144 },
  },
  Area: {
    base: "sq.m",
    units: { "sq.ft": 0.09290304, "sq.m": 1, "sq.yd": 0.83612736, "sq.inch": 0.00064516, "cent": 40.4686, "acre": 4046.86 },
  },
  "Rate per area": {
    base: "Rs/sq.m",
    units: { "Rs/sq.ft": 10.7639104, "Rs/sq.m": 1, "Rs/sq.yd": 1.19599 },
  },
  Weight: {
    base: "kg",
    units: { "g": 0.001, "kg": 1, "quintal": 100, "tonne": 1000, "lb": 0.45359237 },
  },
};

const GST_RATES = [5, 12, 18, 28];

const fmtNum = (n) => {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 10000) / 10000;
  return r.toLocaleString("en-IN", { maximumFractionDigits: 4 });
};

function CalcKeys({ onKey }) {
  const keys = [
    ["C", "⌫", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "−"],
    ["1", "2", "3", "+"],
    ["0", ".", "="],
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {keys.flat().map((k) => {
        const isOp = ["÷", "×", "−", "+", "%"].includes(k);
        const isEq = k === "=";
        const isClear = k === "C" || k === "⌫";
        return (
          <button key={k} type="button" onClick={() => onKey(k)}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              isEq ? "col-span-2 dia-btn-gold"
                : isOp ? "dia-bg-cream-soft dia-text-bronze hover:brightness-95"
                : isClear ? "bg-stone-100 text-stone-600 hover:bg-stone-200"
                : "bg-white border border-stone-200 text-stone-800 hover:dia-border-gold"}`}>
            {k}
          </button>
        );
      })}
    </div>
  );
}

function FloatingCalculator() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("calc");

  /* --- basic calculator --- */
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);   // next digit starts a new number

  const apply = (a, b, o) => {
    switch (o) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const press = (k) => {
    const current = parseFloat(display.replace(/,/g, "")) || 0;
    if (/^[0-9]$/.test(k)) {
      setDisplay(fresh || display === "0" ? k : display + k);
      setFresh(false);
      return;
    }
    if (k === ".") {
      if (fresh) { setDisplay("0."); setFresh(false); }
      else if (!display.includes(".")) setDisplay(display + ".");
      return;
    }
    if (k === "C") { setDisplay("0"); setStored(null); setOp(null); setFresh(true); return; }
    if (k === "⌫") {
      const next = display.length > 1 ? display.slice(0, -1) : "0";
      setDisplay(next === "-" ? "0" : next);
      return;
    }
    if (k === "%") {
      /* Reads the way people expect: 200 + 10% is 220, not 200.1 */
      const pct = op === "+" || op === "−" ? (stored || 0) * current / 100 : current / 100;
      setDisplay(String(pct));
      setFresh(true);
      return;
    }
    if (["+", "−", "×", "÷"].includes(k)) {
      if (op !== null && !fresh) {
        const result = apply(stored, current, op);
        setStored(result);
        setDisplay(String(result));
      } else {
        setStored(current);
      }
      setOp(k);
      setFresh(true);
      return;
    }
    if (k === "=") {
      if (op === null) return;
      const result = apply(stored, current, op);
      setDisplay(String(result));
      setStored(null); setOp(null); setFresh(true);
    }
  };

  /* keyboard, while the panel is open */
  useEffect(() => {
    if (!open || tab !== "calc") return;
    const onKey = (e) => {
      const map = { "*": "×", "x": "×", "/": "÷", "-": "−", "Enter": "=", "Backspace": "⌫", "Escape": "C" };
      const k = map[e.key] || e.key;
      if (/^[0-9.]$/.test(k) || ["+", "−", "×", "÷", "=", "⌫", "C", "%"].includes(k)) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* --- GST --- */
  const [gstAmount, setGstAmount] = useState("");
  const [gstRate, setGstRate] = useState(18);
  const [gstMode, setGstMode] = useState("add");
  const gstBase = Number(gstAmount) || 0;
  const gstValue = gstMode === "add"
    ? gstBase * gstRate / 100
    : gstBase - gstBase * 100 / (100 + gstRate);
  const gstNet = gstMode === "add" ? gstBase : gstBase - gstValue;
  const gstGross = gstMode === "add" ? gstBase + gstValue : gstBase;

  /* --- percentages --- */
  const [pctA, setPctA] = useState("");
  const [pctB, setPctB] = useState("");

  /* --- units --- */
  const [group, setGroup] = useState("Area");
  const [fromUnit, setFromUnit] = useState("sq.ft");
  const [toUnit, setToUnit] = useState("sq.m");
  const [amount, setAmount] = useState("");
  const units = CONVERSIONS[group].units;
  const converted = (Number(amount) || 0) * units[fromUnit] / units[toUnit];

  const switchGroup = (g) => {
    const keys = Object.keys(CONVERSIONS[g].units);
    setGroup(g); setFromUnit(keys[0]); setToUnit(keys[1] || keys[0]);
  };

  const copy = (value) => {
    try { navigator.clipboard.writeText(String(value)); } catch { /* clipboard blocked */ }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} title="Calculator"
        className="fixed bottom-20 right-5 z-40 w-12 h-12 rounded-full dia-btn-gold shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
        <Calculator size={20} />
      </button>
    );
  }

  const Row = ({ label, value, strong }) => (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-stone-500">{label}</span>
      <button type="button" onClick={() => copy(value)} title="Copy"
        className={`tabular-nums text-right hover:dia-text-bronze ${strong ? "font-display text-lg font-semibold text-stone-900" : "text-sm text-stone-800"}`}>
        {fmtNum(value)}
      </button>
    </div>
  );

  return (
    <div className="fixed bottom-20 right-5 z-40 w-[330px] max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl border dia-border-gold-soft overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 dia-bg-cream-soft border-b dia-border-gold-soft">
        <span className="font-display text-sm font-semibold dia-text-bronze">Calculator</span>
        <button type="button" onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-700">
          <X size={16} />
        </button>
      </div>

      <div className="flex border-b border-stone-100">
        {[["calc", "Basic"], ["gst", "GST & %"], ["units", "Units"]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              tab === k ? "dia-text-bronze border-b-2 dia-border-gold" : "text-stone-400 hover:text-stone-600"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-3.5">
        {tab === "calc" && (
          <>
            <div className="dia-bg-cream-soft rounded-xl px-3 py-3 mb-3 text-right">
              <div className="text-[10px] text-stone-500 h-3">{stored !== null && op ? `${fmtNum(stored)} ${op}` : ""}</div>
              <button type="button" onClick={() => copy(display)} title="Copy"
                className="font-display text-2xl font-semibold text-stone-900 tabular-nums truncate w-full text-right">
                {fmtNum(parseFloat(display))}
              </button>
            </div>
            <CalcKeys onKey={press} />
          </>
        )}

        {tab === "gst" && (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              {[["add", "Add GST"], ["extract", "Remove GST"]].map(([v, label]) => (
                <button key={v} type="button" onClick={() => setGstMode(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    gstMode === v ? "dia-btn-gold dia-border-gold" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
                  {label}
                </button>
              ))}
            </div>
            <input type="number" className={inputCls} value={gstAmount} onChange={e => setGstAmount(e.target.value)}
              placeholder={gstMode === "add" ? "Amount before GST" : "Amount including GST"} />
            <div className="flex gap-1.5">
              {GST_RATES.map(r => (
                <button key={r} type="button" onClick={() => setGstRate(r)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    gstRate === r ? "dia-btn-gold dia-border-gold" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
                  {r}%
                </button>
              ))}
            </div>
            <div className="dia-bg-cream-soft rounded-xl px-3 py-2">
              <Row label="Taxable value" value={gstNet} />
              <Row label={`GST at ${gstRate}%`} value={gstValue} />
              <Row label="Total" value={gstGross} strong />
            </div>

            <div className="pt-1 border-t border-stone-100">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="number" className={inputCls} value={pctA} onChange={e => setPctA(e.target.value)} placeholder="A" />
                <input type="number" className={inputCls} value={pctB} onChange={e => setPctB(e.target.value)} placeholder="B" />
              </div>
              <div className="dia-bg-cream-soft rounded-xl px-3 py-2">
                <Row label="A% of B" value={(Number(pctA) || 0) * (Number(pctB) || 0) / 100} />
                <Row label="A is what % of B" value={(Number(pctA) || 0) / (Number(pctB) || 1) * 100} />
                <Row label="Change A → B" value={((Number(pctB) || 0) - (Number(pctA) || 0)) / (Number(pctA) || 1) * 100} />
              </div>
            </div>
          </div>
        )}

        {tab === "units" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {Object.keys(CONVERSIONS).map(g => (
                <button key={g} type="button" onClick={() => switchGroup(g)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    group === g ? "dia-btn-gold dia-border-gold" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
                  {g}
                </button>
              ))}
            </div>
            <input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Value" />
            <div className="flex items-center gap-2">
              <select className={inputCls} value={fromUnit} onChange={e => setFromUnit(e.target.value)}>
                {Object.keys(units).map(u => <option key={u}>{u}</option>)}
              </select>
              <button type="button" title="Swap"
                onClick={() => { const f = fromUnit; setFromUnit(toUnit); setToUnit(f); }}
                className="shrink-0 p-2 rounded-lg border border-stone-200 text-stone-500 hover:dia-text-bronze hover:dia-border-gold">
                <ArrowLeft size={14} className="rotate-180" />
              </button>
              <select className={inputCls} value={toUnit} onChange={e => setToUnit(e.target.value)}>
                {Object.keys(units).map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="dia-bg-cream-soft rounded-xl px-3 py-2.5">
              <Row label={`${fmtNum(Number(amount) || 0)} ${fromUnit} =`} value={converted} strong />
              <p className="text-[10px] text-stone-500 mt-1">Tap any figure to copy it.</p>
            </div>
          </div>
        )}
      </div>
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
  /* Which user we've already loaded data for, so a repeat SIGNED_IN on tab
     focus doesn't tear the workspace down and rebuild it. */
  const signedInUserRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState({ tab: "dashboard" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
      if (s) {
        signedInUserRef.current = s.user.id;
        loadProfileAndData(s.user.id);
      } else {
        setLoading(false);
      }
    });
    // Supabase fires this on more than just sign-in/out — it also fires
    // silently on token refresh (roughly hourly, and sometimes when the
    // browser tab regains focus). Only a real sign-in should reload all data
    // and reset the current screen; a background token refresh must not
    // interrupt whatever the person is doing (e.g. mid-upload on a form).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT" || !s) {
        signedInUserRef.current = null;
        setProfile(null); setData(null); setLoading(false);
        return;
      }
      if (event === "SIGNED_IN") {
        /* Supabase re-fires SIGNED_IN when a tab regains focus and the session
           is re-validated — coming back from a PDF preview, for instance.
           Reloading on those would wipe `data` and reset whatever screen the
           person was on, so only a genuinely different user reloads. */
        if (signedInUserRef.current !== s.user.id) {
          signedInUserRef.current = s.user.id;
          loadProfileAndData(s.user.id);
        }
      }
      // TOKEN_REFRESHED / USER_UPDATED / etc: session is kept current above,
      // but we deliberately don't touch `data` or `view` here.
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
    adminCreateUser: (fields) => dbAdminCreateUser(fields).then(reload),
    adminResetPassword: (userId, password) => dbAdminResetPassword(userId, password),
    addProject: (proj) => dbAddProject(proj, data?.users || []).then(reload),
    updateProjectTeam: (projectId, updates) => dbUpdateProject(projectId, updates).then(reload),
    deleteProject: (projectId) => dbDeleteProject(projectId).then(reload),
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
    markExpensePaid: (id, userId, paid) => dbMarkExpensePaid(id, userId, paid).then(reload),
    generatePO: (id, userId) => dbGeneratePO(id, userId).then(reload),
    addQuotation: (q) => dbAddQuotation(q, profile?.id).then(reload),
    updateQuotation: (id, q) => dbUpdateQuotation(id, q).then(reload),
    updateQuotationStatus: (id, status) => dbUpdateQuotationStatus(id, status).then(reload),
    duplicateQuotation: (q) => dbDuplicateQuotation(q, profile?.id).then(reload),
    deleteQuotation: (id) => dbDeleteQuotation(id).then(reload),
    addBoqLibraryItem: (item) => dbAddBoqLibraryItem(item, profile?.id).then(reload),
    updateBoqLibraryItem: (id, item) => dbUpdateBoqLibraryItem(id, item).then(reload),
    deleteBoqLibraryItem: (id) => dbDeleteBoqLibraryItem(id).then(reload),
    touchBoqLibraryItem: (id, timesUsed) => dbTouchBoqLibraryItem(id, timesUsed),
    addVendor: (v) => dbAddVendor(v).then(reload),
    updateVendor: (id, v) => dbUpdateVendor(id, v).then(reload),
    deleteVendor: (id) => dbDeleteVendor(id).then(reload),
    addMaterialRequest: (projectId, requestedBy, req, autoApprove) => dbAddMaterialRequest(projectId, requestedBy, req, autoApprove).then(reload),
    approveMaterialRequest: (id, approverId) => dbApproveMaterialRequest(id, approverId).then(reload),
    rejectMaterialRequest: (id, approverId, reason) => dbRejectMaterialRequest(id, approverId, reason).then(reload),
    deleteMaterialRequest: (id) => dbDeleteMaterialRequest(id).then(reload),
    markMaterialReceived: (id, receivedBy, fields) => dbMarkMaterialReceived(id, receivedBy, fields).then(reload),
    fulfillMaterialRequest: (id, fulfilledBy) => dbFulfillMaterialRequest(id, fulfilledBy).then(reload),
    startSiteVisit: (projectId, architectId, entryPhotoUrl) => dbStartSiteVisit(projectId, architectId, entryPhotoUrl).then(reload),
    endSiteVisit: (visitId, fields) => dbEndSiteVisit(visitId, fields).then(reload),
    addPhoto: (projectId, photo, uploadedBy) => dbAddPhoto(projectId, photo, uploadedBy).then(reload),
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
        const issueNotifs = data.issues.filter(i => i.status === "Open" && myProjectIds.includes(i.projectId)).slice(0, 5)
          .map(i => ({ text: "Open issue reported", meta: data.projects.find(p => p.id === i.projectId)?.name, view: { tab: "project", projectId: i.projectId, sub: "overview" } }));
        const materialNotifs = data.materialRequests.filter(m => m.status === "Approved" && myProjectIds.includes(m.projectId)).slice(0, 5)
          .map(m => ({ text: `Material approved: ${m.items.split("\n")[0]}`, meta: data.projects.find(p => p.id === m.projectId)?.name, view: { tab: "project", projectId: m.projectId, sub: "materials" } }));
        return [...materialNotifs, ...issueNotifs];
      })()
    : [
        ...data.projects.filter(p => p.estimatedCost > 0 && computeProjectSpend(data.expenses, p.id).approved > p.estimatedCost)
          .map(p => ({ text: `${p.name} is over its estimated cost`, meta: fmtINR(computeProjectSpend(data.expenses, p.id).approved - p.estimatedCost) + " over", view: { tab: "project", projectId: p.id, sub: "overview" } })),
        ...data.materialRequests.filter(m => m.status === "Pending").slice(0, 5)
          .map(m => ({ text: `Material request awaiting approval: ${m.items.split("\n")[0]}`, meta: data.projects.find(p => p.id === m.projectId)?.name, view: { tab: "project", projectId: m.projectId, sub: "materials" } })),
        ...data.materialRequests.filter(m => m.status === "Received").slice(0, 5)
          .map(m => ({ text: `Materials received, ready to log as expense: ${m.items.split("\n")[0]}`, meta: data.projects.find(p => p.id === m.projectId)?.name, view: { tab: "project", projectId: m.projectId, sub: "materials" } })),
        ...data.expenses.filter(e => e.status === "Pending").slice(0, 3)
          .map(e => ({ text: `Expense awaiting approval: ${e.description}`, meta: fmtINR(e.amount), view: { tab: "project", projectId: e.projectId, sub: "expenses" } })),
        ...data.issues.filter(i => i.status === "Open").slice(0, 3)
          .map(i => ({ text: `Open issue reported`, meta: data.projects.find(p => p.id === i.projectId)?.name, view: { tab: "project", projectId: i.projectId, sub: "overview" } })),
      ];

  const titles = {
    dashboard: ["Company Dashboard", "Real-time visibility across every project"],
    projects: ["Projects", "All active and completed projects"],
    expenses: ["Expenses", "Review, filter and approve project expenses"],
    quotations: ["Quotations", "Design proposals, fee schedules and client-ready PDFs"],
    vendors: ["Vendors", "Vendor directory, materials and bank details for payment"],
    updates: ["Updates", "Site progress photos shared by your team, as they happen"],
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
      <UpdateBanner />
      <FloatingCalculator />
      <Sidebar user={currentUser} view={view} setView={setView} onLogout={handleLogout} pendingCount={pendingCount}
        mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0">
        {view.tab !== "project" && view.tab !== "sup-home" && view.tab !== "arch-home" && (
          <Header title={titles[view.tab]?.[0] || ""} subtitle={titles[view.tab]?.[1]} notifications={notifications} onMenuClick={() => setMobileNavOpen(true)} onNotificationClick={setView} />
        )}
        {view.tab === "sup-home" && <Header title="My Sites" subtitle={`Welcome back, ${currentUser.name.split(" ")[0]}`} notifications={notifications} onMenuClick={() => setMobileNavOpen(true)} onNotificationClick={setView} />}
        {view.tab === "arch-home" && <Header title="My Design Work" subtitle={`Welcome back, ${currentUser.name.split(" ")[0]}`} notifications={notifications} onMenuClick={() => setMobileNavOpen(true)} onNotificationClick={setView} />}

        {view.tab === "dashboard" && (isStaffOnly ? <AdminDashboard data={data} setView={setView} /> : <AccessDenied />)}
        {view.tab === "projects" && (isStaffOnly ? <ProjectsList data={data} setView={setView} actions={actions} currentUser={currentUser} /> : <AccessDenied />)}
        {view.tab === "project" && <ProjectDetail data={data} projectId={view.projectId} sub={view.sub} setView={setView} currentUser={currentUser} actions={actions} onMenuClick={() => setMobileNavOpen(true)} />}
        {view.tab === "expenses" && (isStaffOnly ? <ExpensesGlobal data={data} currentUser={currentUser} actions={actions} /> : <AccessDenied />)}
        {view.tab === "quotations" && (isStaffOnly ? <QuotationsView data={data} currentUser={currentUser} actions={actions} setView={setView} /> : <AccessDenied />)}
        {view.tab === "vendors" && (isStaffOnly ? <VendorsView data={data} actions={actions} /> : <AccessDenied />)}
        {view.tab === "updates" && (isAdmin ? <UpdatesFeed data={data} setView={setView} /> : <AccessDenied />)}
        {view.tab === "users" && (isAdmin ? <TeamView data={data} currentUser={currentUser} actions={actions} /> : <AccessDenied />)}
        {view.tab === "sup-home" && <SupervisorHome data={data} currentUser={currentUser} actions={actions} setView={setView} />}
        {view.tab === "arch-home" && <ArchitectHome data={data} currentUser={currentUser} setView={setView} />}
        <p className="text-center text-[11px] text-stone-300 py-4">© Designed and developed by Kash.d Studios</p>
      </div>
    </div>
  );
}
