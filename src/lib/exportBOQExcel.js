import * as XLSX from "xlsx";
import { COMPANY_INFO } from "./constants";
import { fmtDate } from "./helpers";
import {
  boqItemQty, boqItemAmount, boqSectionTotal, boqTotals,
  sectionCode, computeStageAmounts,
} from "./quotationDefaults";

/* ------------------------------------------------------------------------
   Exports a BOQ as a .xlsx workbook — the format clients actually mark up
   when they want to question a rate. Rates, quantities and amounts are
   written as real numbers rather than formatted strings, so the recipient
   can total and filter them in Excel.
   ------------------------------------------------------------------------ */

export function exportBOQExcel(q) {
  const rows = [];
  const push = (...cells) => rows.push(cells);

  push(COMPANY_INFO.name);
  push(`${COMPANY_INFO.addressOneLine}  |  GSTIN ${COMPANY_INFO.gstin}`);
  push("");
  push(`BILL OF QUANTITIES — ${q.clientName || ""}${q.location ? ", " + q.location : ""}`);
  push("Quotation No.", q.quotationNo || "", "", "Date", fmtDate(q.date));
  if (q.projectTitle) push("Project", q.projectTitle);
  push("");

  const specs = (q.materialSpecs || []).filter(Boolean);
  if (specs.length) {
    push("MATERIAL SPECIFICATIONS");
    specs.forEach((s) => push("", s));
    push("");
  }

  const header = ["S.No.", "Particulars", "Description", "Length", "Height", "Qty", "Unit", "Rate", "Amount", "Remarks"];
  let lastGroup = null;

  (q.boqSections || []).forEach((section, si) => {
    const group = (section.group || "").trim();
    if (group && group !== lastGroup) {
      push("");
      push(group.toUpperCase());
      lastGroup = group;
    }
    push("");
    push(sectionCode(si), (section.title || "").toUpperCase());
    push(...header);
    (section.items || []).forEach((item, ii) => {
      push(
        ii + 1,
        item.particulars || "",
        item.description || "",
        Number(item.length) || "",
        Number(item.height) || "",
        boqItemQty(item),
        item.unit || "",
        Number(item.rate) || 0,
        boqItemAmount(item),
        item.remarks || ""
      );
    });
    push("", "", "", "", "", "", "", `Total (${sectionCode(si)})`, boqSectionTotal(section));
  });

  const totals = boqTotals(q);
  push("");
  push("", "", "", "", "", "", "", "Sub Total", totals.subtotal);
  if (Number(q.extraChargePct) > 0) {
    push("", "", "", "", "", "", "", `${q.extraChargeLabel || "Additional charges"} (${q.extraChargePct}%)`, totals.extra);
  }
  if (totals.concession > 0) {
    push("", "", "", "", "", "", "", `Less: ${q.concessionLabel || "Concession"}`, -totals.concession);
  }
  push("", "", "", "", "", "", "", totals.gstRate > 0 ? "TOTAL" : "GRAND TOTAL", totals.grand);
  if (totals.gstRate > 0) {
    push("", "", "", "", "", "", "", `GST @ ${totals.gstRate}%`, totals.gstAmount);
    push("", "", "", "", "", "", "", "GRAND TOTAL (INCLUDING GST)", totals.payable);
  } else if (String(q.gstNote || "").trim()) {
    push("", "", "", "", "", "", "", "", String(q.gstNote).trim());
  }

  const exclusions = (q.exclusions || []).filter(Boolean);
  if (exclusions.length) {
    push("");
    push("ADDITIONAL REQUIREMENTS WHICH ARE NOT INCLUDED");
    exclusions.forEach((t) => push("", t));
  }

  const stages = q.showPaymentTerms === false ? [] : (q.paymentStages || []);
  if (stages.length) {
    const amounts = computeStageAmounts(totals.payable, stages);
    push("");
    push("PAYMENT TERMS");
    push("S.No.", "Stage", "Percentage", "Amount");
    stages.forEach((st, i) => push(st.stage || i + 1, st.milestone || "", Number(st.percentage) || 0, amounts[i]));
    push("", "TOTAL", "", amounts.reduce((a, b) => a + b, 0));
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 7 }, { wch: 24 }, { wch: 62 }, { wch: 9 }, { wch: 9 },
    { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 14 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BOQ");

  const safe = (v) => String(v || "").replace(/[\\/:*?"<>|[\]]+/g, "-").replace(/\s+/g, " ").trim();
  XLSX.writeFile(wb, `BOQ ${safe(q.quotationNo)} - ${safe(q.clientName) || "Client"}.xlsx`);
}
