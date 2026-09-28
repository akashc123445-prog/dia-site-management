import * as XLSX from "xlsx";

/* ------------------------------------------------------------------------
   Reads a team-made quotation spreadsheet into work quotation line items.

   These sheets are written by whoever priced the job, so the shape varies:
   one sheet may carry quantities, rates and amounts, the next a list of
   lump-sum activities with a single price. Columns are matched by their
   headings, and a sheet with no quantity column is read as lump sums rather
   than being rejected.
   ------------------------------------------------------------------------ */

const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());
const isBlank = (row) => !row || row.every((c) => txt(c) === "");

function toNumber(v) {
  if (typeof v === "number") return v;
  const cleaned = txt(v).replace(/[₹,\s]/g, "");
  if (!cleaned || /^-+$/.test(cleaned)) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const HEADERS = {
  sno: /^s\.?\s*[il]?\.?\s*no/i,
  description: /partic|descrip|item|work/i,
  qty: /qty|quantity|nos?\b/i,
  unit: /unit/i,
  rate: /^rate|rate\s*rs|price/i,
  amount: /amount|total/i,
};

function findHeader(row) {
  if (!row) return null;
  const map = {};
  row.forEach((cell, i) => {
    const t = txt(cell);
    if (!t) return;
    for (const [key, re] of Object.entries(HEADERS)) {
      if (map[key] === undefined && re.test(t)) { map[key] = i; return; }
    }
  });
  const hasMoney = map.rate !== undefined || map.amount !== undefined;
  if (!hasMoney) return null;
  if (map.description !== undefined) return map;

  /* Headings get typed by hand and are frequently misspelt — this file says
     "PARITUCALRS". Where the money columns are clear, the description is
     taken positionally: the first labelled column that isn't one we've
     already matched. */
  const taken = new Set(Object.values(map));
  for (let i = 0; i < row.length; i++) {
    if (taken.has(i)) continue;
    const t = txt(row[i]);
    if (t.length >= 3 && !/^\d+$/.test(t)) { map.description = i; break; }
  }
  return map.description !== undefined ? map : null;
}

const TOTAL_ROW = /^(total|grand\s*total|sub\s*total)/i;

function parseSheet(rows, name) {
  const result = { name, title: "", items: [], warnings: [] };
  let cols = null;
  let skipped = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    if (isBlank(row)) continue;
    const cells = row.map(txt);
    const joined = cells.filter(Boolean).join(" ");

    if (!cols) {
      const header = findHeader(row);
      if (header) { cols = header; continue; }
      /* Anything before the header that reads like a title becomes one. */
      if (!result.title && joined.length > 8) result.title = joined;
      continue;
    }

    if (findHeader(row)) continue;                 // a repeated header
    if (TOTAL_ROW.test(joined)) continue;          // totals are recalculated

    const description = txt(row[cols.description]);
    if (!description) { skipped += 1; continue; }

    const qty = toNumber(row[cols.qty]);
    const rate = toNumber(row[cols.rate]);
    const amount = toNumber(row[cols.amount]);

    /* Three shapes, in order of what the sheet actually gives us. */
    let item;
    if (qty > 0 && rate > 0) {
      item = { description, qty, unit: txt(row[cols.unit]) || "", rate };
    } else if (qty > 0 && amount > 0) {
      item = { description, qty, unit: txt(row[cols.unit]) || "", rate: Math.round((amount / qty) * 100) / 100 };
    } else {
      /* A lump sum: priced once, with no quantity to speak of. */
      const value = amount > 0 ? amount : rate;
      if (!value) { skipped += 1; continue; }
      item = { description, qty: 1, unit: "LS", rate: value };
    }

    /* Where the sheet states an amount and it disagrees with quantity times
       rate, the sheet's own arithmetic is wrong — worth saying so rather
       than silently using one or the other. */
    if (amount > 0 && item.qty * item.rate > 0 && Math.abs(item.qty * item.rate - amount) > 1) {
      result.warnings.push(`"${description}" is priced at ${Math.round(item.qty * item.rate).toLocaleString("en-IN")} by quantity x rate, but the sheet says ${Math.round(amount).toLocaleString("en-IN")}.`);
    }

    result.items.push(item);
  }

  if (!result.items.length) {
    result.warnings.push("No priced lines found — the sheet needs a header row naming the particulars and a rate or amount column.");
  }
  if (skipped) result.warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} were skipped.`);
  result.total = result.items.reduce((s, it) => s + it.qty * it.rate, 0);
  return result;
}

export function parseWorkQuoteWorkbook(data) {
  const wb = XLSX.read(data, { type: "array" });
  return {
    sheets: wb.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
      return parseSheet(rows, name);
    }),
  };
}

export async function parseWorkQuoteFile(file) {
  const buf = await file.arrayBuffer();
  return parseWorkQuoteWorkbook(buf);
}
