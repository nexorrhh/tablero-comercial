// Módulo `home` (adelanto de Fase 3, CLAUDE.md §10): tablero de proyectos
// por estado de seguimiento (Pendiente / Gestión / Resuelto) + calendario.

import { FOLLOWUP_STATUS, FOLLOWUP_STATUS_LABELS } from '../../lib/collections.js';
import { formatCurrency } from '../../lib/format.js';
import { loadFollowupBoard, buyerKeyOf } from './home-data.js';
import { openBuyerPanel } from './buyer-panel.js';
import { renderCalendar } from './calendar.js';

const COLUMNS = [FOLLOWUP_STATUS.PENDING, FOLLOWUP_STATUS.IN_PROGRESS, FOLLOWUP_STATUS.RESOLVED];

let activeSubTab = 'board';

function projectCardHtml(row) {
  const { lead } = row;
  return `
    <div class="kanban-card" data-buyer-key="${buyerKeyOf(lead)}">
      <div class="kanban-card-title">${lead.title}</div>
      <div class="kanban-card-meta">
        <span class="muted small">${buyerKeyOf(lead)}</span>
        <span class="muted small">${row.ownerName}</span>
      </div>
      <div class="kanban-card-amount">${formatCurrency(lead.amount, lead.currency)}</div>
    </div>
  `;
}

async function renderBoard(container) {
  const board = await loadFollowupBoard();

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <p class="muted small" style="margin-top:0">
      Cada proyecto es un presupuesto que entró a tratar. Tocá cualquiera para ver el panel completo del comprador — ahí aparecen automáticamente todos sus proyectos, no solo este.
    </p>
    <div class="kanban-board">
      ${COLUMNS.map(
        (status) => `
        <div class="kanban-column" data-status="${status}">
          <div class="kanban-column-header">
            <span>${FOLLOWUP_STATUS_LABELS[status]}</span>
            <span class="muted small">${board[status].length}</span>
          </div>
          <div class="kanban-column-body">
            ${board[status].map(projectCardHtml).join('') || '<p class="muted small" style="padding:8px">Vacío.</p>'}
          </div>
        </div>`
      ).join('')}
    </div>
  `;

  wrapper.querySelectorAll('[data-buyer-key]').forEach((card) => {
    card.addEventListener('click', () => openBuyerPanel(card.dataset.buyerKey, () => renderBoard(container)));
  });

  container.innerHTML = '';
  container.appendChild(wrapper);
}

async function renderActiveSection(container) {
  const host = container.querySelector('#home-section-host');
  host.innerHTML = '<p class="muted">Cargando…</p>';
  if (activeSubTab === 'board') await renderBoard(host);
  else await renderCalendar(host);
}

export async function renderHome(container) {
  container.innerHTML = `
    <div class="tabs" id="home-subtabs">
      <button class="tab${activeSubTab === 'board' ? ' tab-active' : ''}" data-subtab="board">Pendientes / Gestión / Resueltos</button>
      <button class="tab${activeSubTab === 'calendar' ? ' tab-active' : ''}" data-subtab="calendar">Calendario</button>
    </div>
    <div id="home-section-host"></div>
  `;

  container.querySelectorAll('#home-subtabs .tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      activeSubTab = btn.dataset.subtab;
      container.querySelectorAll('#home-subtabs .tab').forEach((b) => b.classList.toggle('tab-active', b === btn));
      await renderActiveSection(container);
    });
  });

  await renderActiveSection(container);
}
