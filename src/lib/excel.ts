export type SheetDef = {
  name: string;
  rows: Record<string, any>[];
  /** Column widths in characters, by column order (optional). */
  colWidths?: number[];
};

/**
 * Export one or more sheets of JSON rows to an .xlsx file using exceljs.
 * Headers are the union of row keys (in first-seen order). Cell values are written as
 * plain values (strings are never interpreted as formulas).
 */
export async function exportToExcel(filename: string, sheets: SheetDef[]) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31));
    const headers: string[] = [];
    sheet.rows.forEach(r => Object.keys(r).forEach(k => { if (!headers.includes(k)) headers.push(k); }));

    ws.columns = headers.map((h, i) => ({
      header: h,
      key: h,
      width: sheet.colWidths?.[i] ?? Math.max(10, h.length * 2 + 2),
    }));
    sheet.rows.forEach(r => ws.addRow(headers.map(h => r[h] ?? null)));

    ws.getRow(1).font = { bold: true };
    ws.eachRow(row => row.eachCell(cell => {
      cell.alignment = { wrapText: true, vertical: 'top' };
    }));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
