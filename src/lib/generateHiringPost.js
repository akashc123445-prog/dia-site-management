import { jsPDF } from "jspdf";
import { COMPANY_INFO, DIA, LOGO_LETTERHEAD } from "./constants";
import { TRAJAN, registerBrandFonts } from "./brandFonts";
import { HIRING_ROLES, HIRING_CLOSING } from "./hiringTemplates";

/* ------------------------------------------------------------------------
   The hiring post, as a sheet to send.

   Built as its own page rather than on the quotation letterhead: this is
   shared on WhatsApp and Instagram, where it is read at thumbnail size on a
   phone, so it needs a large mark, a short headline and air around them.
   ------------------------------------------------------------------------ */

const PAGE = { w: 595.28, h: 841.89 };
const M = { left: 54, right: 54 };
const CONTENT_W = PAGE.w - M.left - M.right;

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const MAROON = hexToRgb(DIA.maroon);
const MAROON_DEEP = hexToRgb(DIA.maroonDeep);
const CREAM = hexToRgb(DIA.cream);
const CREAM_SOFT = hexToRgb(DIA.creamSoft);
const GOLD = hexToRgb(DIA.gold);
const INK = [40, 35, 32];
const GREY = [122, 116, 110];

/* ---- the role marks ----
   Drawn rather than placed as images: a vector mark stays crisp when the
   post is zoomed on a phone, and the file stays small enough to send on
   WhatsApp without being recompressed into mush. Each is drawn inside a
   56pt box whose centre is (cx, cy). */
function drawMark(doc, key, cx, cy, colour) {
  doc.setDrawColor(...colour);
  doc.setFillColor(...colour);
  doc.setLineWidth(2.1);
  doc.setLineCap("round");
  doc.setLineJoin("round");

  switch (key) {
    case "compass": {
      /* A set square. The dividers drawn as two legs and a hinge kept reading
         as the letter A at thumbnail size; a hollow right-angled triangle
         does not resemble any letter. */
      const tri = (inset) => {
        const l = cx - 17 + inset, r = cx + 17 - inset * 1.9, b = cy + 14 - inset, t = cy - 15 + inset * 2.2;
        doc.line(l, b, r, b);
        doc.line(l, b, l, t);
        doc.line(l, t, r, b);
      };
      doc.setLineWidth(2.1);
      tri(0);
      doc.setLineWidth(1.5);
      tri(5.5);
      break;
    }

    case "palette": {                      /* interior designer */
      doc.circle(cx, cy, 16, "S");
      doc.setLineWidth(1.4);
      [[-7, -5], [0, -8], [7, -4]].forEach(([dx, dy]) => doc.circle(cx + dx, cy + dy, 2.4, "F"));
      doc.circle(cx - 3, cy + 6, 2.4, "F");
      break;
    }
    case "cube": {                         /* 3D visualiser */
      const s = 13;
      doc.lines([[s, -s * 0.55], [s, s * 0.55], [-s, s * 0.55], [-s, -s * 0.55]], cx - s, cy - 6, [1, 1], "S", true);
      doc.line(cx - s, cy - 6, cx - s, cy + 9);
      doc.line(cx + s, cy - 6, cx + s, cy + 9);
      doc.line(cx, cy + 5, cx, cy + 20);
      doc.line(cx - s, cy + 9, cx, cy + 20);
      doc.line(cx + s, cy + 9, cx, cy + 20);
      break;
    }
    case "helmet": {                       /* site supervisor — a hard hat */
      doc.lines([[0, 0]], 0, 0);           /* no-op to keep state predictable */
      doc.setLineWidth(2.1);
      /* dome */
      for (let a = 180; a <= 360; a += 6) {
        const r = 15, t1 = (a * Math.PI) / 180, t2 = ((a + 6) * Math.PI) / 180;
        doc.line(cx + r * Math.cos(t1), cy + 4 + r * Math.sin(t1),
                 cx + r * Math.cos(t2), cy + 4 + r * Math.sin(t2));
      }
      doc.line(cx - 21, cy + 4, cx + 21, cy + 4);       /* brim */
      doc.setLineWidth(1.5);
      doc.line(cx, cy - 11, cx, cy + 3);                 /* centre rib */
      break;
    }
    case "clipboard": {                    /* project manager */
      doc.roundedRect(cx - 12, cy - 15, 24, 31, 2.5, 2.5, "S");
      doc.setLineWidth(1.5);
      doc.roundedRect(cx - 5, cy - 19, 10, 7, 1.5, 1.5, "S");
      [-5, 1, 7].forEach((dy) => doc.line(cx - 6, cy + dy, cx + 6, cy + dy));
      break;
    }
    case "calculator": {                   /* accounts */
      doc.roundedRect(cx - 12, cy - 16, 24, 32, 2.5, 2.5, "S");
      doc.setLineWidth(1.3);
      doc.rect(cx - 7, cy - 12, 14, 7);
      [[-7, 2], [0, 2], [7, 2], [-7, 9], [0, 9], [7, 9]].forEach(([dx, dy]) =>
        doc.circle(cx + dx, cy + dy, 1.6, "F"));
      break;
    }
    case "handshake": {                    /* sales */
      doc.setLineWidth(2.1);
      doc.line(cx - 18, cy - 2, cx - 6, cy - 9);
      doc.line(cx - 6, cy - 9, cx + 3, cy - 2);
      doc.line(cx + 3, cy - 2, cx + 18, cy - 2);
      doc.setLineWidth(1.7);
      doc.line(cx - 10, cy + 3, cx - 2, cy + 8);
      doc.line(cx - 2, cy + 8, cx + 8, cy + 4);
      break;
    }
    case "hands":                          /* office assistant — support */
    default: {
      doc.circle(cx, cy - 8, 6.5, "S");
      doc.setLineWidth(2.1);
      for (let a = 200; a <= 340; a += 7) {
        const r = 16, t1 = (a * Math.PI) / 180, t2 = ((a + 7) * Math.PI) / 180;
        doc.line(cx + r * Math.cos(t1), cy + 14 + r * Math.sin(t1),
                 cx + r * Math.cos(t2), cy + 14 + r * Math.sin(t2));
      }
      break;
    }
  }
}

export function generateHiringPostPdf(post, mode = "save") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  registerBrandFonts(doc);

  doc.setFillColor(...CREAM);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");

  /* ---- head ---- */
  doc.setFillColor(...MAROON_DEEP);
  doc.rect(0, 0, PAGE.w, 150, "F");

  try {
    doc.addImage(LOGO_LETTERHEAD, "PNG", M.left, 34, 46, 60);
  } catch { /* the post still works without the mark */ }

  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text("WE ARE HIRING", PAGE.w - M.right, 56, { align: "right", charSpace: 3 });

  doc.setFont(TRAJAN, "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...CREAM);
  doc.text(COMPANY_INFO.name.toUpperCase(), PAGE.w - M.right, 74, { align: "right", charSpace: 1.2 });
  doc.setFontSize(7.4);
  doc.setTextColor(201, 183, 155);
  doc.text("ARCHITECTURE · INTERIOR DESIGN · RETAIL SOLUTIONS", PAGE.w - M.right, 88, { align: "right", charSpace: 0.6 });

  /* ---- role, with its mark ---- */
  const template = HIRING_ROLES[post.roleKey] || {};
  let y = 150;

  doc.setFillColor(...CREAM_SOFT);
  doc.rect(0, y, PAGE.w, 108, "F");

  drawMark(doc, template.icon || "compass", M.left + 30, y + 54, MAROON);

  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(21);
  doc.setTextColor(...MAROON_DEEP);
  const titleLines = doc.splitTextToSize(String(post.title || template.label || "").toUpperCase(), CONTENT_W - 80);
  let ty = y + (titleLines.length > 1 ? 40 : 50);
  titleLines.forEach((line) => { doc.text(line, M.left + 76, ty, { charSpace: 0.8 }); ty += 23; });

  doc.setFont(TRAJAN, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MAROON);
  const meta = [post.location, post.experience].filter(Boolean).join("     ·     ");
  doc.text(meta, M.left + 76, titleLines.length > 1 ? ty + 2 : y + 70, { charSpace: 0.4 });

  y += 108 + 26;

  /* ---- the pitch ---- */
  const para = (text, { size = 10, lead = 15, colour = INK, face = "helvetica", style = "normal", gap = 14 } = {}) => {
    doc.setFont(face, style);
    doc.setFontSize(size);
    doc.setTextColor(...colour);
    doc.splitTextToSize(String(text || ""), CONTENT_W).forEach((line) => {
      doc.text(line, M.left, y);
      y += lead;
    });
    y += gap;
  };

  para(post.intro || template.intro, { size: 10.6, lead: 16 });

  const list = (heading, items) => {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) return;
    doc.setFont(TRAJAN, "bold");
    doc.setFontSize(9.6);
    doc.setTextColor(...MAROON);
    doc.text(heading.toUpperCase(), M.left, y, { charSpace: 0.8 });
    y += 6;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M.left, y, M.left + 34, y);
    y += 15;

    rows.forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.6);
      doc.setTextColor(...INK);
      doc.splitTextToSize(String(item), CONTENT_W - 18).forEach((line, i) => {
        if (i === 0) {
          doc.setFillColor(...GOLD);
          doc.circle(M.left + 3, y - 3, 1.8, "F");
        }
        doc.text(line, M.left + 16, y);
        y += 14;
      });
      y += 2;
    });
    y += 14;
  };

  list("What you'll do", post.responsibilities);
  list("What we're looking for", post.requirements);

  /* ---- contact, pinned to the foot ---- */
  const boxH = 104;
  const boxY = PAGE.h - boxH - 40;

  /* The closing line sits just above the contact band rather than directly
     under the lists, so a short post doesn't leave a hole down the middle. */
  const closingLines = doc.splitTextToSize(HIRING_CLOSING, CONTENT_W);
  y = Math.max(y, boxY - 26 - closingLines.length * 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(...GREY);
  closingLines.forEach((line) => { doc.text(line, M.left, y); y += 14; });
  doc.setFillColor(...MAROON_DEEP);
  doc.rect(0, boxY, PAGE.w, boxH, "F");

  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(9.4);
  doc.setTextColor(...GOLD);
  doc.text("TO APPLY", M.left, boxY + 28, { charSpace: 1.6 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.6);
  doc.setTextColor(...CREAM);
  doc.text("Send your portfolio and CV to:", M.left, boxY + 46);

  const contactName = post.contactName || "";
  const contactPhone = post.contactPhone || COMPANY_INFO.phone;
  const contactEmail = post.contactEmail || COMPANY_INFO.email;

  doc.setFont(TRAJAN, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...CREAM);
  let cy = boxY + 66;
  if (contactName) { doc.text(contactName, M.left, cy); cy += 15; }
  doc.setFontSize(10.5);
  doc.text([contactPhone, contactEmail].filter(Boolean).join("     ·     "), M.left, cy);

  /* On its own line beneath, not alongside — the address is long enough to
     run straight through the email when both are on one row. */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(201, 183, 155);
  doc.text(COMPANY_INFO.addressOneLine, M.left, boxY + boxH - 13);

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  const filename = `Hiring - ${safe(post.title)} - ${safe(post.location)}.pdf`;
  if (mode === "preview") return doc.output("bloburl");
  doc.save(filename);
  return null;
}

/* The same post as a message. Shorter, because it is read in a chat window —
   the responsibilities go, the requirements stay, since those are what stop
   the wrong people writing in. */
export function hiringPostMessage(post) {
  const template = HIRING_ROLES[post.roleKey] || {};
  const lines = [
    `*We're hiring — ${post.title || template.label}*`,
    `${post.location}${post.experience ? ` · ${post.experience}` : ""}`,
    "",
    post.intro || template.intro,
    "",
  ];

  const reqs = (post.requirements || []).filter(Boolean);
  if (reqs.length) {
    lines.push("*What we're looking for*");
    reqs.forEach((r) => lines.push(`• ${r}`));
    lines.push("");
  }

  lines.push("*To apply*");
  lines.push("Send your portfolio and CV to:");
  if (post.contactName) lines.push(post.contactName);
  lines.push([post.contactPhone || COMPANY_INFO.phone, post.contactEmail || COMPANY_INFO.email].filter(Boolean).join(" · "));
  lines.push("");
  lines.push(COMPANY_INFO.name);
  return lines.join("\n");
}
