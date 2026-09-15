// Módulo `leads` (CLAUDE.md §5): listado con filtros, ordenamiento, y dos
// de las tres vistas (tabla / lista — el kanban vive en su propio módulo).

import { LEAD_STATUS, LEAD_STATUS_LABELS } from '../../lib/collections.js';
import { formatCurrency, formatDate, daysUntil, isOverdue } from '../../lib/format.js';
import { loadLeadsContext, enrichLead } from './lead-data.js';
import { openLeadDetail } from './lead-detail.js';
import { getVisibleOwnerIdsForCurrentUser } from '../auth/scope.js';

const SORT_FIELDS = {
  title: (row) => row.lead.title?.toLowerCase() ?? '',
  stepName: (row) => row.stepName?.toLowerCase() ?? '',
  status: (row) => row.lead.status ?? '',
  amount: (row) => row.lead.amount ?? -Infinity,
  ownerName: (row) => row.ownerName?.toLowerCase() ?? '',
};

let viewMode = 'tabla'; // 'tabla' | 'lista'
let filters = { stepId: '', ownerId: '', status: '', tagId: '', search: '' };
let sort = { field: 'title', direction: 'asc' };

function reminderBadge(lead) {
  if (lead.status === LEAD_STATUS.STANDBY && lead.remind_date) {
    const days = daysUntil(lead.remind_date);
    return `<span class="badge badge-standby">${days}d</span>`;
  }
  if (lead.status === LEAD_STATUS.TODO) {
    if (!lead.next_action_at) {
      return '<span class="badge badge-warning" title="Sin próxima acción definida">Sin acción</span>';
    }
    if (isOverdue(lead.next_action_at)) {
      return '<span class="badge badge-danger">Vencido</span>';
    }
    return `<span class="badge">${formatDate(lead.next_action_at)}</span>`;
  }
  return '';
}

function statusBadge(status) {
  return `<span class="badge badge-status-${status}">${LEAD_STATUS_LABELS[status] ?? status}</span>`;
}

function applyFiltersAndSort(rows) {
  const search = filters.search.trim().toLowerCase();
  let filtered = rows.filter(
    (row) =>
      (!filters.stepId || row.lead.step_id === filters.stepId) &&
      (!filters.ownerId || row.lead.owner_id === filters.ownerId) &&
      (!filters.status || row.lead.status === filters.status) &&
      (!filters.tagId || row.tagIds.includes(filters.tagId)) &&
      (!search || row.lead.title.toLowerCase().includes(search) || row.contactName.toLowerCase().includes(search))
  );

  const getValue = SORT_FIELDS[sort.field];
  const factor = sort.direction === 'desc' ? -1 : 1;
  filtered = filtered.sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (av === bv) return 0;
    return av > bv ? factor : -factor;
  });

  return filtered;
}

function sortIndicator(field) {
  if (sort.field !== field) return '';
  return sort.direction === 'asc' ? ' ▲' : ' ▼';
}

function tableHtml(rows) {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th></th>
          <th class="sortable" data-sort="title">Título${sortIndicator('title')}</th>
          <th>Contacto</th>
          <th class="sortable" data-sort="stepName">Etapa${sortIndicator('stepName')}</th>
          <th class="sortable" data-sort="status">Estado${sortIndicator('status')}</th>
          <th class="sortable" data-sort="amount">Monto${sortIndicator('amount')}</th>
          <th class="sortable" data-sort="ownerName">Responsable${sortIndicator('ownerName')}</th>
          <th>Etiquetas</th>
          <th>Próxima acción</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows
            .map(
              (row) => `
          <tr data-lead-id="${row.lead.id}" class="row-clickable">
            <td>${row.lead.starred ? '★' : ''}</td>
            <td>${row.lead.title}</td>
            <td>${row.contactName || '<span class="muted">sin datos</span>'}${row.email ? `<div class="muted small">${row.email}</div>` : ''}</td>
            <td>${row.stepName}</td>
            <td>${statusBadge(row.lead.status)}</td>
            <td>${formatCurrency(row.lead.amount, row.lead.currency)}</td>
            <td>${row.ownerName}</td>
            <td>${row.tagNames.map((t) => `<span class="tag-pill">${t}</span>`).join(' ')}</td>
            <td>${reminderBadge(row.lead)}</td>
          </tr>`
            )
            .join('') || '<tr><td colspan="9" class="muted">Sin resultados para estos filtros.</td></tr>'
        }
      </tbody>
    </table>
  `;
}

function listHtml(rows) {
  return `
    <div class="lead-list">
      ${
        rows
          .map(
            (row) => `
        <div class="lead-list-item row-clickable" data-lead-id="${row.lead.id}">
          <div class="lead-list-main">
            <div class="lead-list-title">${row.lead.starred ? '★ ' : ''}${row.lead.title}</div>
            <div class="muted small">${row.contactName || 'sin datos'}${row.email ? ` · ${row.email}` : ''} · ${row.stepName} · ${row.ownerName}</div>
            <div class="tag-checkboxes">${row.tagNames.map((t) => `<span class="tag-pill">${t}</span>`).join('')}</div>
          </div>
          <div class="lead-list-side">
            ${statusBadge(row.lead.status)}
            <div class="lead-list-amount">${formatCurrency(row.lead.amount, row.lead.currency)}</div>
            ${reminderBadge(row.lead)}
          </div>
        </div>`
          )
          .join('') || '<p class="muted">Sin resultados para estos filtros.</p>'
      }
    </div>
  `;
}

function renderRows(container, ctx, allRows) {
  const rows = applyFiltersAndSort(allRows);
  const host = container.querySelector('#leads-rows-host');
  host.innerHTML = viewMode === 'tabla' ? tableHtml(rows) : listHtml(rows);

  host.querySelectorAll('[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sort.field === field) sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
      else sort = { field, direction: 'asc' };
      renderRows(container, ctx, allRows);
    });
  });

  host.querySelectorAll('[data-lead-id]').forEach((el) => {
    el.addEventListener('click', () => openLeadDetail(el.dataset.leadId, () => renderLeadsTable(container)));
  });
}

export async function renderLeadsTable(container) {
  container.innerHTML = '<p class="muted">Cargando leads…</p>';
  const visibleOwnerIds = await getVisibleOwnerIdsForCurrentUser();
  const ctx = await loadLeadsContext({ visibleOwnerIds });
  const allRows = ctx.leads.map((lead) => enrichLead(lead, ctx));

  const uniqueOwners = [...new Map(ctx.leads.map((l) => [l.owner_id, ctx.usersById.get(l.owner_id)])).values()].filter(Boolean);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="filter-bar">
      <input id="f-search" placeholder="Buscar por título o contacto…" value="${filters.search}" />
      <select id="f-step"><option value="">Todas las etapas</option>${ctx.steps.map((s) => `<option value="${s.id}" ${filters.stepId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
      <select id="f-status"><option value="">Todos los estados</option>${Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => `<option value="${v}" ${filters.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select id="f-owner"><option value="">Todos los responsables</option>${uniqueOwners.map((u) => `<option value="${u.id}" ${filters.ownerId === u.id ? 'selected' : ''}>${u.first_name} ${u.last_name}</option>`).join('')}</select>
      <select id="f-tag"><option value="">Todas las etiquetas</option>${ctx.tags.map((t) => `<option value="${t.id}" ${filters.tagId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
      <button id="f-clear" class="btn btn-ghost">Limpiar</button>
      <div class="view-toggle">
        <button class="btn ${viewMode === 'tabla' ? 'btn-primary' : 'btn-ghost'}" id="view-tabla">Tabla</button>
        <button class="btn ${viewMode === 'lista' ? 'btn-primary' : 'btn-ghost'}" id="view-lista">Lista</button>
      </div>
    </div>
    <div id="leads-rows-host"></div>
  `;

  container.innerHTML = '';
  container.appendChild(wrapper);

  wrapper.querySelector('#f-search').addEventListener('input', (e) => {
    filters.search = e.target.value;
    renderRows(wrapper, ctx, allRows);
  });
  wrapper.querySelector('#f-step').addEventListener('change', (e) => {
    filters.stepId = e.target.value;
    renderRows(wrapper, ctx, allRows);
  });
  wrapper.querySelector('#f-status').addEventListener('change', (e) => {
    filters.status = e.target.value;
    renderRows(wrapper, ctx, allRows);
  });
  wrapper.querySelector('#f-owner').addEventListener('change', (e) => {
    filters.ownerId = e.target.value;
    renderRows(wrapper, ctx, allRows);
  });
  wrapper.querySelector('#f-tag').addEventListener('change', (e) => {
    filters.tagId = e.target.value;
    renderRows(wrapper, ctx, allRows);
  });
  wrapper.querySelector('#f-clear').addEventListener('click', () => {
    filters = { stepId: '', ownerId: '', status: '', tagId: '', search: '' };
    renderLeadsTable(container);
  });
  wrapper.querySelector('#view-tabla').addEventListener('click', () => {
    viewMode = 'tabla';
    renderLeadsTable(container);
  });
  wrapper.querySelector('#view-lista').addEventListener('click', () => {
    viewMode = 'lista';
    renderLeadsTable(container);
  });

  renderRows(wrapper, ctx, allRows);
}
