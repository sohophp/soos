export function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

export function serializeCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCsvFile(filename, rows) {
  downloadTextFile(filename, serializeCsv(rows), "text/csv;charset=utf-8;");
}

export function downloadTextFile(filename, content, type = "text/plain;charset=utf-8;") {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}
