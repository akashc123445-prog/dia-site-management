import * as XLSX from "xlsx";

/* ------------------------------------------------------------------------
   Imports an existing BOQ spreadsheet into the app's own structure.

   These files are hand-built in Excel and vary: merged title bands, repeated
   header rows, section letters in the first column, total rows scattered
   through, and a tail of exclusions and payment terms. The parser therefore
   classifies each row by shape rather than assuming fixed positions, and
   reports what it couldn't place instead of quietly dropping it.
   ------------------------------------------------------------------------ */

const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());
const isBlank = (row) => !row || row.every((c) => txt(c) === "");

/* Excel stores numbers as numbers, but hand-typed cells often carry commas,
   currency symbols or stray spaces. */
function toNumber(v) {
  if (typeof v === "number") return v;
  const cleaned = txt(v).replace(/[₹,\s]/g, "").replace(/^-+$/, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const HEADER_PATTERNS = {
  sno: /^s\.?\s*no/i,
  particulars: /particular/i,
  description: /descript/i,
  length: /length/i,
  height: /height/i,
  qty: /^(qty|quantity)/i,
  unit: /^unit/i,
  rate: /rate|ps\s*\(|per\s*sq/i,
  amount: /amount|^ps$/i,
  remarks: /remark/i,
};

/* A header row is one that names at least the description and a money column. */
function findHeader(row) {
  if (!row) return null;
  const map = {};
  row.forEach((cell, i) => {
    const t = txt(cell);
    if (!t) return;
    for (const [key, re] of Object.entries(HEADER_PATTERNS)) {
      if (map[key] === undefined && re.test(t)) { map[key] = i; return; }
    }
  });
  const hasDesc = map.description !== undefined || map.particulars !== undefined;
  const hasMoney = map.rate !== undefined || map.amount !== undefined;
  return hasDesc && hasMoney ? map : null;
}

const SECTION_LETTER = /^[A-Z]{1,2}$/;
const TOTAL_ROW = /^total\b/i;
const GROUP_HINT = /(floor|basement|mezzanine|terrace|area|specification|services|block|level)/i;

/* Rows that carry a single piece of text and no numbers are either a floor
   band, a section title, or one of the tail headings. */
function loneText(row) {
  const filled = row.map(txt).filter(Boolean);
  return filled.length === 1 ? filled[0] : null;
}

export function parseBOQWorkbook(data) {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });

  const result = {
    materialSpecs: [], sections: [], exclusions: [], paymentStages: [],
    extraChargeLabel: "", extraChargePct: 0,
    warnings: [], sheetName: wb.SheetNames[0],
  };

  let cols = null;
  let group = "";
  let section = null;
  let mode = "head";          // head → table → tail
  let tail = null;            // 'exclusions' | 'payment'
  let skipped = 0;
  let payCols = {};

  const closeSection = () => {
    if (section && section.items.length) result.sections.push(section);
    section = null;
  };

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    if (isBlank(row)) continue;
    const joined = row.map(txt).filter(Boolean).join(" ");
    const single = loneText(row);

    /* ---- tail sections ---- */
    if (/additional requirements/i.test(joined)) { closeSection(); mode = "tail"; tail = "exclusions"; continue; }
    if (/^payment terms/i.test(joined)) { closeSection(); mode = "tail"; tail = "payment"; continue; }

    if (mode === "tail") {
      if (tail === "exclusions") {
        const t = single || joined;
        if (/^s\.?\s*no|^stage\b/i.test(t)) continue;
        const cleaned = t.replace(/^[*•\-\s]+/, "").trim();
        if (cleaned) result.exclusions.push(cleaned);
        continue;
      }
      if (tail === "payment") {
        if (TOTAL_ROW.test(joined)) continue;

        /* The stage table has its own header. Reading it is what tells the
           percentage column apart from the serial number column — both hold
           small integers, so guessing by value picks the wrong one. */
        if (/percentage|%/i.test(joined) && !/\d\s*%/.test(joined)) {
          payCols = {};
          row.forEach((cell, i) => {
            const t = txt(cell);
            if (/percent|%/i.test(t)) payCols.pct = i;
            else if (/stage|milestone|particular/i.test(t)) payCols.stage = i;
            else if (/amount/i.test(t)) payCols.amount = i;
          });
          continue;
        }

        const filled = row.map(txt);
        const label = payCols.stage !== undefined
          ? filled[payCols.stage]
          : filled.find((c) => c && !/^[\d.,%₹\s]+$/.test(c));

        let pct = 0;
        if (payCols.pct !== undefined) {
          pct = toNumber(row[payCols.pct]);
        } else {
          /* Without a header: the amount is the largest number and the serial
             is the leading one, so drop both and take what remains. */
          const nums = row.map((c, i) => ({ i, n: toNumber(c) })).filter((x) => x.n > 0);
          const maxN = Math.max(...nums.map((x) => x.n), 0);
          const candidates = nums.filter((x) => x.n !== maxN && x.n <= 100 && x.i !== 0);
          pct = candidates.length ? candidates[candidates.length - 1].n : 0;
        }

        if (label && pct > 0) {
          result.paymentStages.push({
            stage: String(result.paymentStages.length + 1),
            milestone: label, percentage: pct,
          });
        }
        continue;
      }
    }

    /* ---- material specifications, before the table starts ---- */
    if (mode === "head") {
      const header = findHeader(row);
      if (header) { cols = header; mode = "table"; continue; }
      const t = single || joined;
      if (/^material specification/i.test(t)) continue;
      if (/^boq\b|^bill of quantit/i.test(t)) continue;
      if (/^[*•]/.test(t)) { result.materialSpecs.push(t.replace(/^[*•\s]+/, "").trim()); continue; }
      /* an unmarked line in the header block is still likely a specification */
      if (t && /-|:/.test(t) && t.length < 160) result.materialSpecs.push(t);
      continue;
    }

    /* ---- inside the table ---- */
    if (findHeader(row)) continue;                       // repeated header on later pages

    /* transportation / handling percentage line */
    if (/transport|handling|deep clean|misc/i.test(joined)) {
      const m = joined.match(/(\d+(?:\.\d+)?)\s*%/);
      if (m) {
        result.extraChargePct = Number(m[1]);
        result.extraChargeLabel = joined.replace(/\(?\s*\d+(?:\.\d+)?\s*%\s*\)?/, "").replace(/[₹\d,]+\s*$/, "").trim();
      }
      continue;
    }

    if (TOTAL_ROW.test(joined) || /^grand total/i.test(joined)) continue;

    const snoCell = txt(row[cols.sno ?? 0]);
    const particulars = txt(row[cols.particulars]);
    const description = txt(row[cols.description]);
    const rate = toNumber(row[cols.rate]);
    const amount = toNumber(row[cols.amount]);
    const qtyRaw = toNumber(row[cols.qty]);

    /* A lettered row with a title and no money is a section heading. */
    if (SECTION_LETTER.test(snoCell) && rate === 0 && amount === 0) {
      closeSection();
      const title = row.map(txt).filter(Boolean).slice(1).join(" ") || "Untitled section";
      section = { group, title, items: [] };
      continue;
    }

    /* A lone line of text is either a floor band or an unlettered section. */
    if (single && rate === 0 && amount === 0 && qtyRaw === 0) {
      if (GROUP_HINT.test(single)) {
        /* "BOQ Specification - Ground Floor" → keep only the meaningful part */
        group = single.replace(/^boq\s*specification\s*[-–]?\s*/i, "").trim();
        closeSection();
      } else {
        closeSection();
        section = { group, title: single, items: [] };
      }
      continue;
    }

    /* Otherwise it should be a priced line. */
    if (particulars || description) {
      if (!section) section = { group, title: "Imported items", items: [] };
      const length = toNumber(row[cols.length]);
      const height = toNumber(row[cols.height]);
      /* The sheet's own qty is kept only when it isn't simply length x height,
         so the app recalculates dimensioned lines and preserves typed ones. */
      const derived = length > 0 && height > 0;
      section.items.push({
        particulars: particulars || (description.length > 40 ? description.slice(0, 40) + "…" : description),
        description: description || particulars,
        length, height,
        qty: derived ? 0 : qtyRaw,
        unit: txt(row[cols.unit]) || "Sq.ft.",
        rate: rate || (qtyRaw ? Math.round(amount / qtyRaw) : amount),
        remarks: txt(row[cols.remarks]),
      });
      continue;
    }

    skipped += 1;
  }

  closeSection();

  if (!result.sections.length) {
    result.warnings.push("No priced line items were found — check that the sheet has a header row naming Particulars, Description and a rate column.");
  }
  if (skipped) result.warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} could not be classified and were skipped.`);
  const pct = result.paymentStages.reduce((s, p) => s + p.percentage, 0);
  if (result.paymentStages.length && Math.abs(pct - 100) > 0.01) {
    result.warnings.push(`Imported payment stages total ${pct}% — adjust them to 100% before saving.`);
  }

  return result;
}

/* Convenience for the file input: reads the File and parses it. */
export async function parseBOQFile(file) {
  const buf = await file.arrayBuffer();
  return parseBOQWorkbook(buf);
}
