// Módulo `reports` (CLAUDE.md §5): pantalla de totales + exportación CSV.

import { formatCurrency } from '../../lib/format.js';
import { loadReportRows, totalsByStep, totalsByOwner, totalsByPeriod, buildLeadsCsv, downloadCsv } from './reports-data.js';

function periodLabel(period) {
  const [year, month] = period.split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${months[Number(month) - 1]} ${year}`;
}

export async function renderReports(container) {
  container.innerHTML = '<p class="muted">Cargando reportes…</p>';
  const rows = await loadReportRows();
  const byStep = totalsByStep(rows);
  const byOwner = totalsByOwner(rows);
  const byPeriod = totalsByPeriod(rows);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="detail-header">
      <h2>Reportes</h2>
      <button id="export-csv-btn" class="btn btn-primary">Exportar CSV</button>
    </div>

    <h3>Por etapa</h3>
    <table class="data-table">
      <thead><tr><th>Etapa</th><th>Cantidad</th><th>Monto total</th></tr></thead>
      <tbody>
        ${byStep.map((r) => `<tr><td>${r.name}</td><td>${r.count}</td><td>${formatCurrency(r.amount, 'ARS')}</td></tr>`).join('')}
      </tbody>
    </table>

    <h3>Por responsable</h3>
    <table class="data-table">
      <thead><tr><th>Responsable</th><th>Cantidad</th><th>Monto total</th><th>Ganados</th><th>Perdidos</th></tr></thead>
      <tbody>
        ${byOwner.map((r) => `<tr><td>${r.name}</td><td>${r.count}</td><td>${formatCurrency(r.amount, 'ARS')}</td><td>${r.won}</td><td>${r.lost}</td></tr>`).join('')}
      </tbody>
    </table>

    <h3>Por período de cierre</h3>
    <table class="data-table">
      <thead><tr><th>Período</th><th>Ganados</th><th>Monto ganado</th><th>Perdidos</th><th>Monto perdido</th></tr></thead>
      <tbody>
        ${
          byPeriod
            .map(
              (r) => `<tr><td>${periodLabel(r.period)}</td><td>${r.wonCount}</td><td>${formatCurrency(r.wonAmount, 'ARS')}</td><td>${r.lostCount}</td><td>${formatCurrency(r.lostAmount, 'ARS')}</td></tr>`
            )
            .join('') || '<tr><td colspan="5" class="muted">Todavía no hay leads cerrados.</td></tr>'
        }
      </tbody>
    </table>
  `;

  container.innerHTML = '';
  container.appendChild(wrapper);

  wrapper.querySelector('#export-csv-btn').addEventListener('click', () => {
    const csv = buildLeadsCsv(rows);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`leads-cimomet-${today}.csv`, csv);
  });
}
