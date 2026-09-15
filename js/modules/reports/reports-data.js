// Módulo `reports` (CLAUDE.md §5): totales por etapa, por vendedor, por
// período, y exportación a CSV.

import { LEAD_STATUS } from '../../lib/collections.js';
import { loadLeadsContext, enrichLead } from '../leads/lead-data.js';
import { getVisibleOwnerIdsForCurrentUser } from '../auth/scope.js';

export async function loadReportRows() {
  const visibleOwnerIds = await getVisibleOwnerIdsForCurrentUser();
  const ctx = await loadLeadsContext({ visibleOwnerIds });
  return ctx.leads.map((lead) => enrichLead(lead, ctx));
}

export function totalsByStep(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.stepName;
    if (!map.has(key)) map.set(key, { name: key, count: 0, amount: 0 });
    const entry = map.get(key);
    entry.count += 1;
    entry.amount += row.lead.amount ?? 0;
  });
  return [...map.values()];
}

export function totalsByOwner(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.ownerName;
    if (!map.has(key)) map.set(key, { name: key, count: 0, amount: 0, won: 0, lost: 0 });
    const entry = map.get(key);
    entry.count += 1;
    entry.amount += row.lead.amount ?? 0;
    if (row.lead.status === LEAD_STATUS.WON) entry.won += 1;
    if (row.lead.status === LEAD_STATUS.LOST) entry.lost += 1;
  });
  return [...map.values()];
}

// Agrupa por año-mes de cierre los leads ganados/perdidos.
export function totalsByPeriod(rows) {
  const map = new Map();
  rows
    .filter((row) => row.lead.closed_at && (row.lead.status === LEAD_STATUS.WON || row.lead.status === LEAD_STATUS.LOST))
    .forEach((row) => {
      const period = row.lead.closed_at.slice(0, 7); // YYYY-MM
      if (!map.has(period)) map.set(period, { period, wonCount: 0, wonAmount: 0, lostCount: 0, lostAmount: 0 });
      const entry = map.get(period);
      if (row.lead.status === LEAD_STATUS.WON) {
        entry.wonCount += 1;
        entry.wonAmount += row.lead.amount ?? 0;
      } else {
        entry.lostCount += 1;
        entry.lostAmount += row.lead.amount ?? 0;
      }
    });
  return [...map.values()].sort((a, b) => (a.period < b.period ? 1 : -1));
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function buildLeadsCsv(rows) {
  const header = ['Título', 'Etapa', 'Estado', 'Monto', 'Moneda', 'Probabilidad', 'Responsable', 'Contacto', 'Email', 'Teléfono', 'Etiquetas'];
  const lines = rows.map((row) =>
    [
      row.lead.title,
      row.stepName,
      row.lead.status,
      row.lead.amount ?? '',
      row.lead.currency,
      row.lead.probability ?? '',
      row.ownerName,
      row.contactName,
      row.email,
      row.phone,
      row.tagNames.join('; '),
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([`﻿${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
