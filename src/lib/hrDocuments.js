/* ------------------------------------------------------------------------
   Wording and arithmetic behind the two HR documents: the salary slip and
   the experience certificate.

   Kept apart from the PDF drawing so the screen and the paper are working
   from the same numbers and the same sentences.
   ------------------------------------------------------------------------ */

const num = (v) => Math.max(0, Math.round(Number(v) || 0));

/* ---- salary ------------------------------------------------------------ */

/* The usual split when nothing else has been agreed: half as basic, a fifth
   as HRA, a tenth as conveyance, and whatever is left as special allowance.
   It is a starting point — every figure can be typed over. */
export function autoSplit(monthly) {
  const m = num(monthly);
  return { basic: Math.round(m * 0.5), hra: Math.round(m * 0.2), conveyance: Math.round(m * 0.1) };
}

/* Everything that follows from the figures on file. Special allowance is
   never stored: it is the remainder, so the parts always add up to the
   salary no matter what is typed into them. */
export function salaryFigures(hr) {
  const monthly = num(hr?.monthlySalary);
  const basic = Math.min(num(hr?.basic), monthly);
  const hra = Math.min(num(hr?.hra), monthly - basic);
  const conveyance = Math.min(num(hr?.conveyance), monthly - basic - hra);
  const special = monthly - basic - hra - conveyance;
  const pf = num(hr?.pf), esi = num(hr?.esi), profTax = num(hr?.profTax), tds = num(hr?.tds);
  const deductions = pf + esi + profTax + tds;
  return {
    monthly, annual: monthly * 12,
    basic, hra, conveyance, special,
    pf, esi, profTax, tds, deductions,
    net: Math.max(0, monthly - deductions), netAnnual: Math.max(0, monthly - deductions) * 12,
  };
}

export function daysInMonth(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthLabel(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/* One month's slip. Unpaid leave scales the earnings down by the days
   actually paid; the fixed deductions stay as they are. */
export function slipFigures(hr, { month, lopDays = 0, bonus = 0, bonusLabel = "", otherDeduction = 0, otherDeductionLabel = "" }) {
  const f = salaryFigures(hr);
  const days = daysInMonth(month);
  const lop = Math.min(Math.max(Number(lopDays) || 0, 0), days);
  const paidDays = days - lop;
  const factor = days ? paidDays / days : 1;
  const part = (v) => Math.round(v * factor);

  const earnings = [
    { label: "Basic salary", amount: part(f.basic) },
    { label: "House rent allowance", amount: part(f.hra) },
    { label: "Conveyance allowance", amount: part(f.conveyance) },
    { label: "Special allowance", amount: part(f.special) },
  ].filter((r) => r.amount > 0);
  if (num(bonus) > 0) earnings.push({ label: bonusLabel.trim() || "Bonus / incentive", amount: num(bonus) });

  const deductions = [
    { label: "Provident fund", amount: f.pf },
    { label: "ESI", amount: f.esi },
    { label: "Professional tax", amount: f.profTax },
    { label: "Income tax (TDS)", amount: f.tds },
  ].filter((r) => r.amount > 0);
  if (num(otherDeduction) > 0) deductions.push({ label: otherDeductionLabel.trim() || "Other deduction", amount: num(otherDeduction) });

  const gross = earnings.reduce((s, r) => s + r.amount, 0);
  const totalDeductions = deductions.reduce((s, r) => s + r.amount, 0);
  return {
    days, lop, paidDays, earnings, deductions, gross, totalDeductions,
    net: Math.max(0, gross - totalDeductions),
    monthly: f.monthly, annual: f.annual,
  };
}

/* ---- designation and duties, by role ----------------------------------- */

export function defaultDesignation(user) {
  if (!user) return "";
  if (user.role === "Architect") return user.rank || "Architect";
  if (user.role === "Supervisor") return "Site Supervisor";
  if (user.role === "Accounts") return "Accounts Executive";
  if (user.role === "Admin") return "Administrator";
  return user.role || "";
}

/* What the person actually did here, in the certificate's words. Tokens in
   braces are filled in from the employee's title: {He}, {he}, {his}, {him}. */
const DUTIES = {
  "Principal Architect":
    "In this role, {he} led the design of jewellery showroom and retail interior projects from concept through to handover. {He} presented design proposals to clients, set the design direction for the studio, reviewed and approved drawings before issue, and guided the architects working under {him}.",
  "Senior Architect":
    "In this role, {he} developed concept designs, layouts and working drawings for jewellery showroom and retail interior projects. {He} co-ordinated with clients, site teams and vendors throughout execution, checked drawings for accuracy before issue, and supported the junior architects on the team.",
  "Junior Architect":
    "In this role, {he} prepared layouts, working drawings and 3D views for jewellery showroom and retail interior projects under the guidance of the senior architects. {He} took site measurements, assisted with material selections and bills of quantities, and kept the drawings up to date throughout execution.",
  "Intern Architect":
    "During the internship, {he} assisted the design team with drafting, 3D views, presentation sheets and site measurements for jewellery showroom and retail interior projects, and gained working exposure to the full course of a fit-out project.",
  Architect:
    "In this role, {he} worked on the design and drawings of jewellery showroom and retail interior projects, and co-ordinated with clients, site teams and vendors throughout execution.",
  Supervisor:
    "In this role, {he} supervised the on-site execution of jewellery showroom and retail fit-out projects. {He} managed contractors and labour on site, tracked materials and deliveries, checked workmanship against the drawings, reported daily progress to the office, and worked to hand sites over on schedule.",
  Accounts:
    "In this role, {he} handled the firm's day-to-day accounts — vendor bills and payments, purchase orders, staff expense claims, client statements and GST records — and kept the project and office accounts up to date.",
  Admin:
    "In this role, {he} handled the administration and day-to-day running of the office, co-ordinating between the design, site and accounts teams and with clients and vendors.",
};

export function defaultDuties(user) {
  if (!user) return "";
  if (user.role === "Architect") return DUTIES[user.rank] || DUTIES.Architect;
  return DUTIES[user.role] || "";
}

/* ---- code of conduct ---------------------------------------------------- */

export const CONDUCT_OPTIONS = ["Good", "Fair", "Bad"];

export const CONDUCT_TEXT = {
  Good:
    "Throughout {his} time with us, {name}'s conduct was good. {He} followed the company's code of conduct in full, showed sincerity, punctuality and dependability in {his} work, and maintained cordial and professional relations with colleagues, clients and vendors. We found {him} to be a valued member of the team and wish {him} every success in {his} future endeavours.",
  Fair:
    "Throughout {his} time with us, {name}'s conduct was fair. {He} carried out the duties assigned to {him} and generally followed the company's code of conduct, with room for improvement in consistency and timeliness. We wish {him} well in {his} future endeavours.",
  Bad:
    "During {his} time with us, {name}'s conduct was not satisfactory. There were instances in which the company's code of conduct was not followed, and these continued after they had been brought to {his} notice. This certificate is issued at {his} request solely as a record of {his} employment with the company and is not to be read as a recommendation.",
};

/* ---- filling in the words ----------------------------------------------- */

export const TITLES = ["", "Mr.", "Ms."];

function pronouns(title) {
  if (title === "Mr.") return { he: "he", his: "his", him: "him" };
  if (title === "Ms.") return { he: "she", his: "her", him: "her" };
  /* No title given: "they" reads correctly for anyone, and every sentence in
     the templates is written so that it stays grammatical with it. */
  return { he: "they", his: "their", him: "them" };
}

/* Fills {name}, {He}, {he}, {his}, {him}. */
export function fillWording(text, { name, title }) {
  const first = String(name || "").trim();
  const full = [title, first].filter(Boolean).join(" ");
  const p = pronouns(title);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return String(text || "")
    .replace(/\{name\}/g, full)
    .replace(/\{He\}/g, p ? cap(p.he) : full)
    .replace(/\{he\}/g, p ? p.he : full)
    .replace(/\{his\}/g, p ? p.his : `${full}'s`)
    .replace(/\{him\}/g, p ? p.him : full);
}

/* "a Senior Architect", "an Intern Architect", "an Accounts Executive". */
export function withArticle(designation) {
  const d = String(designation || "").trim();
  if (!d) return "a member of our team";
  return `${/^[aeiou]/i.test(d) ? "an" : "a"} ${d}`;
}

/* Dates in full, as a formal letter writes them: 3 November 2025. */
export function longDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/* A reference number that is unique enough to file by and needs no counter
   kept anywhere: document, employee code, date. */
export function referenceNo(kind, user, dateIso) {
  const code = (user?.empId || (user?.name || "").split(/\s+/).map((w) => w[0]).join("") || "EMP").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `DIA/HR/${kind}/${code}/${String(dateIso || "").replace(/-/g, "")}`;
}
