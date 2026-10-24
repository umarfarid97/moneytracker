/**
 * One CSV cell. Text that starts with `=`, `+`, `-`, `@`, tab or carriage return gets a leading `'` so a
 * spreadsheet shows it as text instead of running it as a formula. Numbers are written as they are.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to CSV text (comma separated, CRLF between rows). */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
