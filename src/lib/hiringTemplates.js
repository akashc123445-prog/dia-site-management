/* ------------------------------------------------------------------------
   Hiring post templates.

   Each role carries its own icon and its own words. The copy is written to
   describe the work honestly rather than to flatter it — jewellery retail
   means exacting detail, real site time and travel across the south, and a
   post that says so attracts people who want that and saves everyone the
   wasted interview.
   ------------------------------------------------------------------------ */

export const HIRING_LOCATIONS = [
  "Bengaluru",
  "Chennai",
  "Bengaluru or Chennai",
  "Bengaluru — with travel across South India",
  "Chennai — with travel across South India",
  "Site based — South India",
];

export const HIRING_ROLES = {
  junior_architect: {
    label: "Junior Architect",
    icon: "compass",
    experience: "0–2 years",
    intro: "You will work on jewellery showrooms from first sketch to the drawings that go to site, alongside architects who will teach you the detail this work demands.",
    responsibilities: [
      "Draw up layouts, elevations and working drawings under a senior architect",
      "Develop 3D views and material options for client presentations",
      "Visit site to see how your drawings are being built, and learn from what you find",
      "Keep drawing sets current as the design moves",
    ],
    requirements: [
      "B.Arch or a diploma in architecture or interior design",
      "AutoCAD, SketchUp and a rendering engine; Photoshop a plus",
      "An eye for proportion and a habit of checking dimensions twice",
      "Willing to travel to site within South India",
    ],
  },
  architect: {
    label: "Architect",
    icon: "compass",
    experience: "2–5 years",
    intro: "You will carry a showroom from concept to handover — your drawings, your details, your calls on site — with the studio behind you.",
    responsibilities: [
      "Own the design of a project from brief through to working drawings",
      "Present to clients and carry their feedback into the design",
      "Resolve joinery, lighting and display details with the people building them",
      "Co-ordinate with vendors and the site team through execution",
    ],
    requirements: [
      "B.Arch with two or more years in retail or interior fit-out",
      "Confident in AutoCAD and SketchUp; comfortable detailing joinery",
      "Able to run a client conversation on your own",
      "Willing to travel to site within South India",
    ],
  },
  senior_architect: {
    label: "Senior Architect",
    icon: "compass",
    experience: "5–8 years",
    intro: "You will lead projects and the people on them, setting the standard for how a DIA showroom is drawn, detailed and delivered.",
    responsibilities: [
      "Lead the design of multiple showrooms at once",
      "Review the team's drawings and raise the standard of what leaves the studio",
      "Hold the client relationship through design and execution",
      "Guide juniors — a good part of this role is making other people better",
    ],
    requirements: [
      "B.Arch with five or more years, a good part of it in retail interiors",
      "A portfolio showing work you took from concept to completion",
      "Comfortable running a site meeting and a client review in the same day",
      "Willing to travel across South India",
    ],
  },
  associate_architect: {
    label: "Associate Architect",
    icon: "compass",
    experience: "8+ years",
    intro: "You will share the running of the studio's design work — standards, people and the projects that matter most — with a direct line to the partners.",
    responsibilities: [
      "Set design direction across projects and hold the studio to it",
      "Build and mentor the architectural team",
      "Lead the key client relationships from pitch to handover",
      "Work with the partners on how the practice grows",
    ],
    requirements: [
      "B.Arch or M.Arch with eight or more years, including retail interiors",
      "A record of leading teams and delivering built work",
      "Judgement on both design and commercial questions",
      "Based in or willing to move to Bengaluru or Chennai",
    ],
  },
  interior_designer: {
    label: "Interior Designer",
    icon: "palette",
    experience: "1–4 years",
    intro: "You will shape how a showroom feels — materials, light, display and the finish that makes jewellery look its best.",
    responsibilities: [
      "Develop material palettes, finishes and lighting schemes",
      "Prepare mood boards and presentations clients can decide from",
      "Detail display units, counters and feature walls",
      "See selections through to what actually arrives on site",
    ],
    requirements: [
      "Degree or diploma in interior design",
      "SketchUp and a rendering engine; AutoCAD for detailing",
      "A real feel for materials, and the patience to source them",
      "Willing to travel to site",
    ],
  },
  visualiser: {
    label: "3D Visualiser",
    icon: "cube",
    experience: "1–4 years",
    intro: "You will make the showroom real before a single wall goes up — the views that win the work and settle the design.",
    responsibilities: [
      "Build 3D models from architectural drawings",
      "Light and render interiors to a standard clients decide from",
      "Produce walkthroughs for presentations",
      "Turn revisions around quickly during a live design conversation",
    ],
    requirements: [
      "3ds Max with V-Ray or Corona, or SketchUp with Enscape or Lumion",
      "A portfolio showing interiors, not just exteriors",
      "Photoshop for post-production",
      "An eye for how light falls on metal, stone and glass",
    ],
  },
  site_supervisor: {
    label: "Site Supervisor",
    icon: "helmet",
    experience: "3–8 years",
    intro: "You will be the studio on site — the person who sees that what was drawn is what gets built, and says so early when it is not.",
    responsibilities: [
      "Run the day on site: labour, sequence and quality",
      "Check work against drawings and pull up anything that drifts",
      "Record what happened each day and what is holding the job up",
      "Receive material, check it, and keep the records straight",
    ],
    requirements: [
      "Diploma in civil or three or more years supervising interior fit-out",
      "Able to read working drawings and spot a mistake in them",
      "Firm with contractors and straight with the office",
      "Willing to stay at site locations across South India",
    ],
  },
  project_manager: {
    label: "Project Manager",
    icon: "clipboard",
    experience: "5–10 years",
    intro: "You will hold the programme, the budget and the vendors together, so a showroom opens on the date the client was promised.",
    responsibilities: [
      "Plan and hold the programme across live projects",
      "Keep cost against estimate and flag drift before it becomes a loss",
      "Appoint and manage vendors and contractors",
      "Keep the client informed, especially when the news is awkward",
    ],
    requirements: [
      "Five or more years running interior fit-out projects",
      "Confident with BOQs, rates and vendor negotiation",
      "Able to run several sites at once without losing the detail",
      "Willing to travel across South India",
    ],
  },
  accounts: {
    label: "Accounts Executive",
    icon: "calculator",
    experience: "2–5 years",
    intro: "You will keep the money side of the studio in order — bills, vendors, GST and the figures the partners rely on.",
    responsibilities: [
      "Record and verify site and office expenses",
      "Raise purchase orders and manage vendor payments",
      "Handle GST filings, TDS and statutory returns with the auditor",
      "Track receivables and tell the partners where they stand",
    ],
    requirements: [
      "B.Com or equivalent, with two or more years in accounts",
      "Tally and Excel; working knowledge of GST",
      "Accurate with figures and comfortable chasing people for paperwork",
      "Based in Bengaluru or Chennai",
    ],
  },
  sales: {
    label: "Sales Executive",
    icon: "handshake",
    experience: "2–6 years",
    intro: "You will open doors with jewellers across the south and bring the right work to a studio that can deliver it.",
    responsibilities: [
      "Find and approach jewellery retailers planning new showrooms",
      "Understand what a client needs and brief the design team properly",
      "Carry a proposal through to a signed agreement",
      "Keep in touch with past clients — most of our work comes back to us",
    ],
    requirements: [
      "Two or more years in B2B sales, ideally interiors, retail or furniture",
      "Comfortable in Tamil, Kannada or Telugu alongside English",
      "Willing to travel through South India most weeks",
      "Straight with clients about what we can and cannot do",
    ],
  },
  office_assistant: {
    label: "Office Assistant",
    icon: "hands",
    experience: "Experience not essential",
    intro: "You will keep the studio running day to day — the work everyone depends on and nobody sees until it stops.",
    responsibilities: [
      "Keep the studio and sample library clean and in order",
      "Collect and deliver documents, samples and prints",
      "Help with pantry, stationery and office supplies",
      "Support the team with whatever the day needs",
    ],
    requirements: [
      "Honest, punctual and willing to learn",
      "A two-wheeler and a licence is an advantage",
      "Basic reading and phone use",
      "Based in Bengaluru or Chennai",
    ],
  },
  intern: {
    label: "Architectural Intern",
    icon: "compass",
    experience: "Student or fresh graduate",
    intro: "You will spend your internship on real projects, not filing — drawing, detailing and visiting site with the people doing the work.",
    responsibilities: [
      "Assist with drawings, 3D models and presentations",
      "Help prepare material boards and sample sets",
      "Visit site and record what you see",
      "Take notes that the team can actually use",
    ],
    requirements: [
      "Enrolled in or recently finished B.Arch or interior design",
      "AutoCAD and SketchUp basics",
      "Curious, and not precious about the small jobs",
      "Available for three to six months, full time",
    ],
  },
};

/* The closing line beneath the role, shared by every post. */
export const HIRING_CLOSING =
  "We design and build jewellery showrooms across South India. The work is detailed, the sites are demanding, and the standard is high — if that sounds like the place you want to be, write to us.";

export function blankHiringPost(roleKey = "architect") {
  const t = HIRING_ROLES[roleKey];
  return {
    roleKey,
    title: t.label,
    location: HIRING_LOCATIONS[0],
    experience: t.experience,
    intro: t.intro,
    responsibilities: [...t.responsibilities],
    requirements: [...t.requirements],
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    status: "Open",
    notes: "",
  };
}
