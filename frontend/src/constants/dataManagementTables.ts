export type DataFieldType = 'text' | 'number' | 'currency' | 'date' | 'email' | 'boolean';

export type DataFieldDefinition = {
  name: string;
  displayName: string;
  type: DataFieldType;
  required: boolean;
  unique?: boolean;
};

export type DataTableDefinition = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  primaryKey: string;
  requiresValidation: boolean;
  isDynamic?: boolean;
  parentTables?: string[];
  fields: DataFieldDefinition[];
  sampleCsv: string;
};

export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  values.push(current);
  return values;
}

export function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line, idx) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = { _rowNumber: String(idx + 2) };
    headers.forEach((header, i) => {
      row[header] = (values[i] || '').trim();
    });
    return row;
  });
  return { headers, rows };
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerRow = headers.join(',');
  const body = rows
    .map((row) =>
      headers
        .map((h) => {
          const value = row[h] ?? '';
          const text = String(value);
          if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        })
        .join(',')
    )
    .join('\n');
  return `${headerRow}\n${body}`;
}
