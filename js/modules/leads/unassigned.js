// Bandeja de leads sin asignar (CLAUDE.md §8): visible solo para roles que
// pueden gestionar asignación (admin, gerente comercial).

import { formatCurrency } from '../../lib/format.js';
import { loadLeadsContext, enrichLead } from './lead-data.js';
import { openLeadDetail } from './lead-detail.js';
import { updateLead } from './lead-service.js';
import { getCurrentUserId } from '../auth/session.js';

export async function renderUnassignedLeads(container) {
  container.innerHTML = '<p class="muted">Cargando…</p>';
  const ctx = await loadLeadsContext({ visibleOwnerIds: new Set(), includeUnassigned: true });
  const rows = ctx.leads.map((lead) => enrichLead(lead, ctx));

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr><th>Título</th><th>Contacto</th><th>Etapa</th><th>Monto</th><th>Asignar a</th></tr>
    </thead>
    <tbody>
      ${
        rows
          .map(
            (row) => `
        <tr data-lead-id="${row.lead.id}">
          <td class="lead-title-cell">${row.lead.title}</td>
          <td>${row.contactName || '<span class="muted">sin datos</span>'}</td>
          <td>${row.stepName}</td>
          <td>${formatCurrency(row.lead.amount, row.lead.currency)}</td>
          <td>
            <select class="assign-select">
              <option value="">Elegir…</option>
              ${ctx.users.map((u) => `<option value="${u.id}">${u.first_name} ${u.last_name}</option>`).join('')}
            </select>
            <button class="btn assign-btn">Asignar</button>
          </td>
        </tr>`
          )
          .join('') || `<tr><td colspan="5" class="muted">No hay leads sin asignar.</td></tr>`
      }
    </tbody>
  `;

  container.innerHTML = '';
  container.appendChild(table);

  table.querySelectorAll('.lead-title-cell').forEach((cell) => {
    cell.classList.add('row-clickable');
    cell.addEventListener('click', () => openLeadDetail(cell.closest('tr').dataset.leadId, () => renderUnassignedLeads(container)));
  });

  table.querySelectorAll('.assign-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      const select = tr.querySelector('.assign-select');
      if (!select.value) return;
      await updateLead(tr.dataset.leadId, { owner_id: select.value }, getCurrentUserId());
      renderUnassignedLeads(container);
    });
  });
}
