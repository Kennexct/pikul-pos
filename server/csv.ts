/** RFC 4180 CSV with a BOM (Excel opens UTF-8 correctly). Cells starting with = + - @ are prefixed to stop formula injection. */
export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  const cell = (v: string | number | null) => {
    if (v === null) return '';
    if (typeof v === 'number') return String(v);
    const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
