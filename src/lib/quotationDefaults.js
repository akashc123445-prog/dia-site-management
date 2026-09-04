/* ------------------------------------------------------------------------
   Quotation / design proposal templates and defaults.

   Everything a proposal PDF prints is stored on the quotation row itself,
   so an old quotation always regenerates exactly as it was sent even after
   these templates are edited. The values here are only the *starting point*
   for a new quotation — the person can edit any of it in the editor before
   saving.

   Framework-agnostic (no React, no Supabase) — used by the editor UI and by
   the PDF generator.
   ------------------------------------------------------------------------ */

/* Default scope of professional services — the six-stage design workflow.
   Mirrors the stages in the signed proposal template. */
export const QUOTATION_SCOPE_TEMPLATE = [
  {
    title: "Stage 01 — Project Initiation & Client Brief",
    intro: "",
    items: [
      "Introductory meetings with the Client",
      "Site visit and project assessment",
      "Requirement gathering and detailed discussions",
      "Client questionnaire to understand brand philosophy, operational requirements and business objectives",
      "Finalization of project scope",
      "Signing of Professional Service Agreement",
      "Payment of Project Retainer / Advance",
    ],
  },
  {
    title: "Stage 02 — Concept Development & Mood Board",
    intro: "Development of the overall design language including:",
    items: [
      "Concept Design", "Design Theme", "Mood Board", "Material Direction",
      "Colour Palette", "Lighting Concept", "Flooring Concepts", "Ceiling Concepts",
      "Display Concepts", "Furniture References", "Overall Look & Feel Presentation",
    ],
  },
  {
    title: "Stage 03 — Space Planning & Schematic Design",
    intro: "Preparation of planning layouts including:",
    items: [
      "Schematic Floor Plans", "Space Planning", "Furniture Layout", "Display Planning",
      "Customer Circulation Planning", "Functional Zoning", "Preliminary Design Discussions",
      "Design Approval",
    ],
  },
  {
    title: "Stage 04 — 3D Visualization & Design Development",
    intro: "Preparation of presentation drawings including:",
    items: [
      "High Quality 3D Views", "Real-Time Rendered Visualizations", "Interior Perspectives",
      "Material Representation", "Feature Wall Elevations", "Ceiling Concepts",
      "Lighting Visualization", "Design Refinements based on approved layouts",
    ],
  },
  {
    title: "Stage 05 — Detailed Design Documentation",
    intro: "Preparation of execution drawings including:",
    items: [
      "Detailed Interior Working Drawings", "Joinery Details", "Furniture Details",
      "Ceiling Layouts", "Flooring Layouts", "Electrical Layouts", "Lighting Layouts",
      "Material Specifications", "Interior Elevations",
      "Coordination Drawings required for execution",
    ],
  },
  {
    title: "Stage 06 — Project Co-ordination & Site Execution",
    intro: "",
    items: [
      "Project Kick-off", "Periodic Site Visits", "Coordination with Contractors and Vendors",
      "Review of Execution Quality", "Clarification of Design Intent",
      "Site Meetings whenever required", "Monitoring Design Compliance",
      "Final Inspection", "Project Completion", "Final Handover",
    ],
  },
];

/* Default milestone-linked payment schedule. Percentages must total 100 —
   the editor enforces this before a quotation can be saved. */
export const QUOTATION_PAYMENT_TEMPLATE = [
  { stage: "STAGE 01", milestone: "Project Initiation, Site Visit, Client Brief, Scope Finalization & Signing of Agreement", percentage: 30 },
  { stage: "STAGE 02", milestone: "Concept Design, Mood Board & Design Direction Approval", percentage: 15 },
  { stage: "STAGE 03", milestone: "Schematic Space Planning & Layout Approval", percentage: 15 },
  { stage: "STAGE 04", milestone: "3D Visualization, Design Development & Client Approval", percentage: 20 },
  { stage: "STAGE 05", milestone: "Detailed Working Drawings, Execution Documentation & Project Commencement", percentage: 15 },
  { stage: "STAGE 06", milestone: "Project Co-ordination, Site Visits, Final Inspection & Project Handover", percentage: 5 },
];

export const QUOTATION_MILESTONE_NOTES = [
  "Completion and formal approval of the previous stage.",
  "Clearance of the corresponding stage payment as per the agreed payment schedule.",
  "Written confirmation to proceed to the subsequent stage.",
];

export const QUOTATION_REVISION_POLICY = [
  "Stages 02 (Concept Development) and 04 (3D Visualization & Design Development) include up to three (3) rounds of revisions.",
  "Any revisions beyond the included rounds shall be undertaken upon client approval and billed separately based on the professional time and resources involved.",
];

export const QUOTATION_PAYMENT_TERMS = [
  "Each stage represents a project milestone and shall commence only upon approval of the deliverables of the preceding stage by the Client, and receipt of the corresponding stage payment as outlined above.",
  "Payments shall be released within 7 days of submission of the invoice for the respective milestone.",
  "Delays in stage payments may result in a corresponding extension of the project timeline.",
  "The final stage payment shall become due upon completion of the project and handover of all agreed deliverables.",
  "Additional services or revisions beyond the agreed project scope shall be treated as Variation Orders and will be billed separately upon mutual approval.",
  "Stages 02 (Concept Design) and 04 (3D Visualization & Design Development) include up to three (3) rounds of revisions. Any revisions thereafter shall be chargeable based on the professional time and resources involved.",
];

/* Bank details printed at the foot of the last page. */
export const QUOTATION_BANK = {
  accountName: "Dia Retail Solutions",
  bankName: "South Indian Bank",
  branch: "Jayanagar Branch",
  accountNumber: "0151083000001182",
  ifsc: "SIBL0000151",
};

export const QUOTATION_SIGNATORY = {
  name: "MAYUK A",
  title: "PRINCIPAL ARCHITECT",
};

export const QUOTATION_STATUSES = ["Draft", "Sent", "Accepted", "Declined", "Revised"];

export const QUOTATION_SERVICE_LINES = [
  "Architectural Design, Interior Design & Project Co-ordination",
  "Architectural Design & Interior Design",
  "Interior Design & Project Co-ordination",
  "Visual Merchandising & Display Design",
  "Project Co-ordination & Site Execution",
];

/* Body copy that opens the proposal. {{client}} / {{location}} / {{service}}
   are substituted at PDF time so the intro stays correct if the header
   fields are edited later. */
export const QUOTATION_INTRO_TEMPLATE = [
  "Greetings from DIA Retail Solutions.",
  "We sincerely appreciate the opportunity to present our proposal for the {{service}} services for your proposed jewellery showroom at {{location}}.",
  "At DIA Retail Solutions, we specialize exclusively in luxury jewellery retail environments, where every design decision is driven by customer experience, operational efficiency, visual merchandising, and brand identity. Our objective is to create a timeless retail destination that not only reflects the values of {{client}} but also elevates the overall shopping experience while maximizing product presentation and sales potential.",
  "Based on our preliminary discussions and understanding of your requirements, we are pleased to submit our proposal outlining the scope of professional services, project methodology, fee structure, deliverables, and payment schedule.",
];

export const QUOTATION_CLOSING_TEMPLATE = [
  "At DIA Retail Solutions, we believe that exceptional retail spaces are created through a seamless integration of architecture, interior design, branding, visual merchandising, and meticulous execution. We remain committed to delivering a showroom that embodies elegance, functionality, and an unforgettable customer experience.",
  "We sincerely thank you for considering our proposal and look forward to partnering with {{client}} in creating a landmark jewellery destination.",
  "We assure you of our highest standards of professionalism and dedicated service throughout the course of this project.",
];

/* Fills {{client}}, {{location}}, {{service}} and {{project}} placeholders. */
export function fillTokens(text, q) {
  if (!text) return "";
  return String(text)
    .replace(/\{\{client\}\}/g, q.clientName || "the Client")
    .replace(/\{\{location\}\}/g, q.location || "the proposed site")
    .replace(/\{\{project\}\}/g, q.projectTitle || "the project")
    .replace(/\{\{service\}\}/g, q.serviceLine || "Architectural Design, Interior Design & Project Co-ordination");
}

/* ---- money ------------------------------------------------------------ */

/* Splits a rupee amount across the stage percentages, giving any rounding
   remainder to the final stage so the column always sums to the total
   exactly (a mismatch of even ₹1 on a client-facing document looks sloppy). */
export function computeStageAmounts(total, stages) {
  const t = Math.round(Number(total) || 0);
  const raw = stages.map((s) => Math.floor((t * (Number(s.percentage) || 0)) / 100));
  const allocated = raw.reduce((a, b) => a + b, 0);
  if (raw.length) raw[raw.length - 1] += t - allocated;
  return raw;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigits(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? ONES[h] + " Hundred" : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/* Rupees in words, Indian numbering (crore / lakh / thousand). */
export function amountInWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return "Rupees Zero Only";
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(threeDigits(lakh) + " Lakh");
  if (thousand) parts.push(threeDigits(thousand) + " Thousand");
  if (n) parts.push(threeDigits(n));
  return "Rupees " + parts.join(" ") + " Only";
}

/* Builds a blank quotation pre-loaded with every template above, optionally
   seeded from an existing project so the client/site fields are already
   filled in. */
export function blankQuotation(project) {
  return {
    docType: "proposal",
    quotationNo: "",
    projectId: project?.id || null,
    clientName: project?.client || "",
    clientAddress: project?.location || "",
    projectTitle: project?.name || "",
    location: project?.location || "",
    city: "Bengaluru",
    date: new Date().toISOString().slice(0, 10),
    serviceLine: QUOTATION_SERVICE_LINES[0],
    area: project?.area || 0,
    floors: "",
    feeMode: "rate",
    ratePerSqft: 0,
    totalFee: 0,
    gstNote: "GST shall be applicable extra as per prevailing Government norms.",
    introParas: QUOTATION_INTRO_TEMPLATE,
    scopeStages: QUOTATION_SCOPE_TEMPLATE,
    paymentStages: QUOTATION_PAYMENT_TEMPLATE,
    milestoneNotes: QUOTATION_MILESTONE_NOTES,
    revisionPolicy: QUOTATION_REVISION_POLICY,
    closingParas: QUOTATION_CLOSING_TEMPLATE,
    paymentTerms: QUOTATION_PAYMENT_TERMS,
    signatoryName: QUOTATION_SIGNATORY.name,
    signatoryTitle: QUOTATION_SIGNATORY.title,
    signatureUrl: "",
    mobile: "",
    lineItems: [],
    discount: 0,
    workTerms: [],
    salutation: "",
    bank: QUOTATION_BANK,
    status: "Draft",
    notes: "",
  };
}

/* ---- itemised work quotation ------------------------------------------ */

/* Standard terms for the line-item quotation used on execution work. */
export const WORK_QUOTE_TERMS = [
  "Quantities shown are provisional; final billing will be as per actual site measurement.",
  "Marble, granite and all base materials to be supplied by the client at site.",
  "Water, electricity and safe storage space for material to be provided at site free of cost.",
  "GST extra as applicable.",
  "Payment: 50% advance along with work order, balance on completion of work.",
  "This quotation is valid for 15 days from the date mentioned above.",
];

export const WORK_QUOTE_UNITS = ["Sq.ft", "Sq.m", "Rft", "Nos", "Lot", "Kg", "Set", "Job"];

export function blankWorkQuote(project) {
  return {
    docType: "itemised",
    quotationNo: "",
    projectId: project?.id || null,
    clientName: project?.client || "",
    clientAddress: project?.location || "",
    mobile: "",
    projectTitle: project?.name || "",
    location: project?.location || "",
    city: "Bengaluru",
    date: new Date().toISOString().slice(0, 10),
    salutation: "With reference to your requirement, we are pleased to quote our best rates as under:",
    lineItems: [{ description: "", qty: 0, unit: "Sq.ft", rate: 0 }],
    discount: 0,
    workTerms: WORK_QUOTE_TERMS,
    signatoryName: "",
    signatoryTitle: "",
    signatureUrl: "",
    status: "Draft",
    notes: "",
    /* unused by this document type, but kept so one row shape covers both */
    serviceLine: QUOTATION_SERVICE_LINES[0],
    area: 0, floors: "", feeMode: "lumpsum", ratePerSqft: 0, totalFee: 0,
    gstNote: "", introParas: [], scopeStages: [], paymentStages: [],
    milestoneNotes: [], revisionPolicy: [], closingParas: [], paymentTerms: [],
    bank: QUOTATION_BANK,
  };
}

/* ---- Bill of Quantities ------------------------------------------------ */

/* Material specifications printed at the head of every BOQ. Edited per
   document, but these are the standard brands and grades. */
export const BOQ_MATERIAL_SPECS = [
  "PLYWOOD - Rs.125 range will be used (Preferably - Green Ecotech BWP)",
  "LAMINATES - Rs.2750 range will be used.",
  "ACRYLIC LAMINATES - Rs.3750 range will be used.",
  "INNER LAMINATES - Rs.575 range will be used.",
  "VENEER - Rs.110 range will be used.",
  "HARDWARE - Hettich or Equivalent will be used.",
  "MDF - GREEN PANEL HDHMR",
  "WIRES - Finolex or Equivalent will be used.",
  "CORIAN - Tristone, Himacs or Equivalent will be used.",
  "PU FINISH - ICA",
  "POLYCOAT FINISH - ICA",
  "WATER BASE FINISH - ASIAN ROYALE PAINT",
];

/* Work that sits outside the quoted scope. Printed after the grand total. */
export const BOQ_EXCLUSIONS = [
  "Generator and its structure.",
  "Site demolishment if any.",
  "Plumbing & toilet renovation if any.",
  "IT requirements.",
  "Exterior branding & its framework.",
  "Display mannequins and stock trays are not included.",
  "Any left out quotation will be added once the work has been completed.",
  "The quantity may vary according to the site conditions, so the given quotation is tentative (contingency 10%).",
  "Any changes in the drawing/design might incur changes in the quotation.",
];

export const BOQ_PAYMENT_TEMPLATE = [
  { stage: "1", milestone: "Design finalization and advance", percentage: 50 },
  { stage: "2", milestone: "Completion of base carcass", percentage: 30 },
  { stage: "3", milestone: "False ceiling completion", percentage: 15 },
  { stage: "4", milestone: "Project completion", percentage: 5 },
];

/* Whether the quoted rates carry GST. Printed under the grand total, because
   "is this with or without GST" is the first thing a client asks. */
export const BOQ_GST_NOTES = {
  exclusive: "GST extra as applicable.",
  inclusive: "Rates are inclusive of GST.",
};

export const BOQ_UNITS = ["Sq.ft.", "Rft", "Nos.", "LS", "S.ft.", "Kg", "Set", "Job"];

export const BOQ_EXTRA_CHARGE_LABEL =
  "Transportation, handling charges, deep cleaning, misc. charges";
export const BOQ_EXTRA_CHARGE_PCT = 2.5;

/* Section letters run A, B, C … and are assigned automatically as sections
   are added or removed, so they always read in order on the printed BOQ. */
export const sectionCode = (index) => {
  let n = index, code = "";
  do { code = String.fromCharCode(65 + (n % 26)) + code; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return code;
};

/* A BOQ line's quantity is usually length x height; where a dimension isn't
   meaningful (a logo, a light fitting) the quantity is typed directly. */
export function boqItemQty(item) {
  const l = Number(item.length) || 0;
  const h = Number(item.height) || 0;
  if (l > 0 && h > 0) return Math.round(l * h * 100) / 100;
  return Number(item.qty) || 0;
}

/* Amount is normally quantity x rate, but a BOQ line sometimes carries a
   manually set figure — a partition priced at 1.5 times for a design feature,
   say — where the printed amount deliberately differs from the arithmetic.
   An explicit amount on the item wins; clear it to go back to calculating. */
export function boqItemAmount(item) {
  const override = Number(item.amount);
  if (item.amount !== "" && item.amount !== null && item.amount !== undefined && Number.isFinite(override) && override > 0) {
    return Math.round(override);
  }
  return Math.round(boqItemQty(item) * (Number(item.rate) || 0));
}

/* True when the printed amount doesn't match quantity x rate, so the editor
   can flag the line rather than let a silent override go unnoticed. */
export function boqItemIsOverridden(item) {
  const override = Number(item.amount);
  if (!(item.amount !== "" && item.amount !== null && item.amount !== undefined && Number.isFinite(override) && override > 0)) return false;
  return Math.abs(override - boqItemQty(item) * (Number(item.rate) || 0)) > 1;
}

export function boqSectionTotal(section) {
  return (section.items || []).reduce((s, it) => s + boqItemAmount(it), 0);
}

export function boqTotals(q) {
  const sections = q.boqSections || [];
  const subtotal = sections.reduce((s, sec) => s + boqSectionTotal(sec), 0);
  const pct = Number(q.extraChargePct) || 0;
  const extra = Math.round((subtotal * pct) / 100);
  /* A concession — a discount carried over from an earlier BOQ, say — comes
     off after the handling charge, as it does on the firm's own sheets. */
  const concession = Math.max(0, Math.round(Number(q.concession) || 0));
  const grand = subtotal + extra - concession;

  /* GST is calculated on the grand total when a rate is set. A rate of zero
     leaves the BOQ exactly as it was — quoted before tax, with a footnote. */
  const gstRate = Number(q.gstRate) || 0;
  const gstAmount = gstRate > 0 ? Math.round((grand * gstRate) / 100) : 0;

  return {
    subtotal, extra, concession, grand,
    gstRate, gstAmount,
    /* what the client actually pays, and what the payment stages divide */
    payable: grand + gstAmount,
  };
}

export function blankBOQ(project) {
  return {
    docType: "boq",
    quotationNo: "",
    projectId: project?.id || null,
    clientName: project?.client || "",
    clientAddress: project?.location || "",
    mobile: "",
    projectTitle: project?.name || "",
    location: project?.location || "",
    city: "Bengaluru",
    date: new Date().toISOString().slice(0, 10),
    materialSpecs: BOQ_MATERIAL_SPECS,
    boqSections: [
      { group: "Ground Floor", title: "Showroom Area", note: "", items: [{ particulars: "", description: "", length: 0, height: 0, qty: 0, unit: "Sq.ft.", rate: 0, remarks: "" }] },
    ],
    extraChargeLabel: BOQ_EXTRA_CHARGE_LABEL,
    extraChargePct: BOQ_EXTRA_CHARGE_PCT,
    concession: 0,
    concessionLabel: "Concession",
    gstRate: 0,
    pageOptions: { summaryBreak: "auto" },
    gstNote: BOQ_GST_NOTES.exclusive,
    exclusions: BOQ_EXCLUSIONS,
    paymentStages: BOQ_PAYMENT_TEMPLATE,
    showPaymentTerms: true,
    signatoryName: "",
    signatoryTitle: "",
    signatureUrl: "",
    status: "Draft",
    notes: "",
    totalFee: 0,
    /* unused by this document type, kept so one row shape covers all three */
    serviceLine: QUOTATION_SERVICE_LINES[0],
    area: 0, floors: "", feeMode: "lumpsum", ratePerSqft: 0, gstNote: "",
    introParas: [], scopeStages: [], milestoneNotes: [], revisionPolicy: [],
    closingParas: [], paymentTerms: [], lineItems: [], discount: 0, workTerms: [],
    salutation: "",
    bank: QUOTATION_BANK,
  };
}
