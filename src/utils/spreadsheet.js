export async function readWorkbook(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  return { XLSX, workbook: XLSX.read(buffer, { type: 'array', cellDates: true }) };
}

export function firstSheetRows(XLSX, workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : [];
}

export function parseDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function num(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return Number(normalized) || 0;
}

export function splitTags(value) {
  return String(value || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

export async function ensureTagIds(names, tags, api) {
  const ids = [];
  const known = [...tags];
  for (const name of names) {
    let tag = known.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      tag = await api.post('/tags', { name, color: '#6d71f0' });
      known.push(tag);
    }
    ids.push(tag.id);
  }
  return ids;
}

export async function writeTemplate(filename, sheetName, rows) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
