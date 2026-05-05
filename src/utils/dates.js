// Datas em ISO YYYY-MM-DD, sem timezone

export function today() {
  const d = new Date();
  return iso(d);
}

export function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function fmtBR(date) {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtBRShort(date) {
  if (!date) return '';
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

export const ranges = {
  'all': () => ({ from: '', to: '', label: 'Todos' }),
  '7d': () => ({ from: addDays(today(), -6), to: today(), label: 'Últimos 7 dias' }),
  '14d': () => ({ from: addDays(today(), -13), to: today(), label: 'Últimos 14 dias' }),
  '30d': () => ({ from: addDays(today(), -29), to: today(), label: 'Últimos 30 dias' }),
  '90d': () => ({ from: addDays(today(), -89), to: today(), label: 'Últimos 90 dias' }),
  'today': () => ({ from: today(), to: today(), label: 'Hoje' }),
  'yesterday': () => { const y = addDays(today(), -1); return { from: y, to: y, label: 'Ontem' }; },
  'this_week': () => {
    const t = new Date();
    const dow = t.getDay() || 7;
    const start = addDays(today(), -(dow - 1));
    return { from: start, to: today(), label: 'Esta semana' };
  },
  'last_week': () => {
    const t = new Date();
    const dow = t.getDay() || 7;
    const startThis = addDays(today(), -(dow - 1));
    const endLast = addDays(startThis, -1);
    const startLast = addDays(endLast, -6);
    return { from: startLast, to: endLast, label: 'Semana passada' };
  },
  'this_month': () => {
    const t = new Date();
    const start = iso(new Date(t.getFullYear(), t.getMonth(), 1));
    return { from: start, to: today(), label: 'Este mês' };
  },
  'last_month': () => {
    const t = new Date();
    const start = iso(new Date(t.getFullYear(), t.getMonth() - 1, 1));
    const end = iso(new Date(t.getFullYear(), t.getMonth(), 0));
    return { from: start, to: end, label: 'Mês passado' };
  },
  'quarter': () => {
    const t = new Date();
    const q = Math.floor(t.getMonth() / 3);
    const start = iso(new Date(t.getFullYear(), q * 3, 1));
    return { from: start, to: today(), label: 'Trimestre atual' };
  },
  'year': () => {
    const t = new Date();
    return { from: iso(new Date(t.getFullYear(), 0, 1)), to: today(), label: 'Este ano' };
  }
};

export function weeksOfMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const weeks = [];
  let cur = new Date(first);
  while (cur <= last) {
    const start = new Date(cur);
    const end = new Date(cur);
    end.setDate(end.getDate() + (7 - (end.getDay() || 7)));
    if (end > last) end.setTime(last.getTime());
    weeks.push({
      label: `Semana ${weeks.length + 1}`,
      from: iso(start),
      to: iso(end)
    });
    cur = new Date(end);
    cur.setDate(cur.getDate() + 1);
  }
  return weeks;
}
