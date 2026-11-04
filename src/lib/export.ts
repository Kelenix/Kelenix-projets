import { BRAND_FULL_NAME } from "@/lib/brand"
import type { Column, Report, Row } from "@/lib/reports"
import { toHours } from "@/lib/reports"
import { formatMoney } from "@/lib/finance"
import { formatDuration } from "@/lib/time"

export type ExportFormat = "xlsx" | "csv" | "pdf"

/** Libellé d'en-tête : les durées sont exportées en heures décimales. */
const header = (c: Column) =>
  c.kind === "duration" ? `${c.label} (h)` : c.kind === "percent" ? `${c.label} (%)` : c.kind === "money" ? `${c.label} (€)` : c.label

/** Valeur brute (tableur) : durées en heures décimales, nombres tels quels. */
function raw(c: Column, value: Row[string]) {
  if (value === null || value === undefined || value === "") return null
  if (c.kind === "money") return Number(value) / 100
  return c.kind === "duration" ? toHours(Number(value)) : value
}

/** Valeur lisible (affichage et PDF). */
export function display(c: Column, value: Row[string]) {
  if (value === null || value === undefined || value === "") return "—"
  if (c.kind === "duration") {
    const ms = Number(value)
    if (Math.abs(ms) < 60_000) return c.signed ? "0" : ms === 0 ? "—" : formatDuration(ms)
    // Signes ASCII : le « − » typographique n'existe pas dans la police standard des PDF.
    return (ms < 0 ? "-" : c.signed ? "+" : "") + formatDuration(Math.abs(ms))
  }
  if (c.kind === "percent") return `${value} %`
  if (c.kind === "money") return formatMoney(Number(value)).replace(/[\u202f\u00a0]/g, " ") // espaces insécables absents de la police PDF
  return String(value)
}

const lines = (report: Report) => [...report.rows, ...(report.total ? [report.total] : [])]

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** CSV lisible par Excel en français : séparateur « ; », virgule décimale, encodage UTF-8 avec BOM. */
export function toCsv(report: Report) {
  const cell = (v: string | number | null) => {
    if (v === null) return ""
    const text = typeof v === "number" ? String(v).replace(".", ",") : v
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [
    report.columns.map((c) => cell(header(c))).join(";"),
    ...lines(report).map((row) => report.columns.map((c) => cell(raw(c, row[c.key]))).join(";")),
  ].join("\r\n")
}

async function exportXlsx(report: Report, subtitle: string, fileName: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser")
  const bold = { fontWeight: "bold" as const }
  const data = [
    [{ value: report.title, ...bold }],
    [{ value: subtitle }],
    [],
    report.columns.map((c) => ({ value: header(c), ...bold })),
    ...lines(report).map((row, i, all) =>
      report.columns.map((c) => {
        const value = raw(c, row[c.key])
        const total = report.total && i === all.length - 1
        if (value === null) return null
        return typeof value === "number"
          ? { value, type: Number, format: c.kind === "duration" || c.kind === "money" ? "0.00" : "0", ...(total ? bold : {}) }
          : { value: String(value), ...(total ? bold : {}) }
      })
    ),
  ]
  await writeXlsxFile(data, {
    sheet: "Rapport",
    columns: report.columns.map((c) => ({ width: c.kind === "text" ? 32 : 16 })),
  }).toFile(fileName)
}

async function exportPdf(report: Report, subtitle: string, fileName: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const doc = new jsPDF({ orientation: report.columns.length > 6 ? "landscape" : "portrait", unit: "pt", format: "a4" })
  doc.setFontSize(14)
  doc.text(report.title, 40, 40)
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`${BRAND_FULL_NAME} · ${subtitle}`, 40, 56)
  if (report.note) doc.text(doc.splitTextToSize(report.note, doc.internal.pageSize.getWidth() - 80), 40, 70)
  autoTable(doc, {
    startY: report.note ? 90 : 70,
    head: [report.columns.map((c) => c.label)],
    body: report.rows.map((row) => report.columns.map((c) => display(c, row[c.key]))),
    foot: report.total ? [report.columns.map((c) => (c.key in report.total! ? display(c, report.total![c.key]) : ""))] : undefined,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
    // Chiffres alignés à droite dans l'en-tête, le corps et le total.
    didParseCell: ({ cell, column }) => {
      cell.styles.halign = report.columns[column.index]?.kind === "text" ? "left" : "right"
    },
  })
  doc.save(fileName)
}

/** Exporte le rapport affiché ; `subtitle` décrit la période et les filtres appliqués. */
export async function exportReport(report: Report, format: ExportFormat, subtitle: string, baseName: string) {
  const fileName = `${baseName}.${format}`
  if (format === "csv") return download(new Blob(["﻿" + toCsv(report)], { type: "text/csv;charset=utf-8" }), fileName)
  if (format === "xlsx") return exportXlsx(report, subtitle, fileName)
  return exportPdf(report, subtitle, fileName)
}
