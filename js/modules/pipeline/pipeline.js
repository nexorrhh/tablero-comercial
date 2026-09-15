// Módulo `pipeline` (CLAUDE.md §5): vista kanban, arrastrar entre etapas,
// totales por columna.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, LEAD_STATUS_LABELS } from '../../lib/collections.js';
import { formatCurrency, isOverdue } from '../../lib/format.js';
import { loadLeadsContext, enrichLead } from '../leads/lead-data.js';
import { openLeadDetail } from '../leads/lead-detail.js';
import { getVisibleOwnerIdsForCurrentUser } from '../auth/scope.js';

function leadCardHtml(row) {
  const { lead } = row;
  const overdue = lead.status === 'todo' && isOverdue(lead.next_action_at);
  return `
    <div class="kanban-card${overdue ? ' kanban-card-overdue' : ''}" draggable="true" data-lead-id="${lead.id}">
      <div class="kanban-card-title">${lead.starred ? '★ ' : ''}${lead.title}</div>
      <div class="kanban-card-meta">
        <span class="badge badge-status-${lead.status}">${LEAD_STATUS_LABELS[lead.status] ?? lead.status}</span>
        <span class="muted small">${row.ownerName}</span>
      </div>
      <div class="kanban-card-amount">${formatCurrency(lead.amount, lead.currency)}</div>
    </div>
  `;
}

async function refresh(container) {
  const visibleOwnerIds = await getVisibleOwnerIdsForCurrentUser();
  const ctx = await loadLeadsContext({ visibleOwnerIds });
  const rows = ctx.leads.map((lead) => enrichLead(lead, ctx));
  const rowsByStep = new Map(ctx.steps.map((s) => [s.id, []]));
  rows.forEach((row) => {
    if (rowsByStep.has(row.lead.step_id)) rowsByStep.get(row.lead.step_id).push(row);
  });

  container.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'kanban-board';

  ctx.steps.forEach((step) => {
    const stepRows = rowsByStep.get(step.id) ?? [];
    const total = stepRows.reduce((sum, r) => sum + (r.lead.amount ?? 0), 0);

    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.dataset.stepId = step.id;
    column.innerHTML = `
      <div class="kanban-column-header">
        <span>${step.name}</span>
        <span class="muted small">${stepRows.length} · ${formatCurrency(total, 'ARS')}</span>
      </div>
      <div class="kanban-column-body">
        ${stepRows.map(leadCardHtml).join('')}
      </div>
    `;
    board.appendChild(column);
  });

  container.appendChild(board);
  wireDragAndDrop(container);
}

function wireDragAndDrop(container) {
  let draggedLeadId = null;

  container.querySelectorAll('.kanban-card').forEach((card) => {
    card.addEventListener('dragstart', () => {
      draggedLeadId = card.dataset.leadId;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('click', () => openLeadDetail(card.dataset.leadId, () => refresh(container)));
  });

  container.querySelectorAll('.kanban-column').forEach((column) => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      column.classList.add('kanban-column-over');
    });
    column.addEventListener('dragleave', () => column.classList.remove('kanban-column-over'));
    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      column.classList.remove('kanban-column-over');
      if (!draggedLeadId) return;
      await gateway.update(COLLECTIONS.LEADS, draggedLeadId, { step_id: column.dataset.stepId });
      await refresh(container);
    });
  });
}

export async function renderPipelineKanban(container) {
  container.innerHTML = '<p class="muted">Cargando pipeline…</p>';
  const wrapper = document.createElement('div');
  wrapper.className = 'kanban-container';
  container.innerHTML = '';
  container.appendChild(wrapper);
  await refresh(wrapper);
}
