// Panel de comprador (CLAUDE.md §10, adelanto de Fase 3): todos los
// proyectos de un mismo comprador, definición/seguimiento por proyecto,
// próximos contactos e historial de paneos — todo a nivel comprador.

import { LEAD_STATUS_LABELS, FOLLOWUP_STATUS, FOLLOWUP_STATUS_LABELS } from '../../lib/collections.js';
import { formatCurrency, formatDateTime, fromLocalDateInputValue } from '../../lib/format.js';
import { openLeadDetail } from '../leads/lead-detail.js';
import { getCurrentUserId } from '../auth/session.js';
import { loadBuyerContext, defineFollowup, logBuyerFollowup, resolveLead } from './home-data.js';

function closeModal(overlay) {
  overlay.remove();
}

export async function openBuyerPanel(buyerKey, onClose) {
  const ctx = await loadBuyerContext(buyerKey);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-wide">
      <div class="modal-header">
        <div>
          <div class="muted small">Comprador</div>
          <strong style="font-size:16px">${buyerKey}</strong>
        </div>
        <button id="modal-close" class="btn btn-ghost nav-btn" style="margin-left:auto">✕</button>
      </div>
      <div class="modal-body">
        <h3>Proyectos de este comprador (${ctx.leads.length})</h3>
        <table class="data-table">
          <thead><tr><th>Proyecto</th><th>Etapa</th><th>Estado</th><th>Monto</th><th>Seguimiento</th><th></th></tr></thead>
          <tbody>
            ${ctx.leads
              .map(
                (row) => `
              <tr data-project-row="${row.lead.id}">
                <td><span class="lead-open-link" data-lead-id="${row.lead.id}">${row.lead.title}</span></td>
                <td>${row.stepName}</td>
                <td><span class="badge badge-status-${row.lead.status}">${LEAD_STATUS_LABELS[row.lead.status] ?? row.lead.status}</span></td>
                <td>${formatCurrency(row.lead.amount, row.lead.currency)}</td>
                <td><span class="badge badge-followup-${row.lead.followup_status ?? 'pending'}">${FOLLOWUP_STATUS_LABELS[row.lead.followup_status ?? FOLLOWUP_STATUS.PENDING]}</span></td>
                <td>
                  ${
                    (row.lead.followup_status ?? FOLLOWUP_STATUS.PENDING) === FOLLOWUP_STATUS.PENDING
                      ? `<button class="btn define-btn" data-lead-id="${row.lead.id}">Definición</button>`
                      : (row.lead.followup_status === FOLLOWUP_STATUS.IN_PROGRESS
                          ? `<button class="btn btn-ghost resolve-btn" data-lead-id="${row.lead.id}">Marcar resuelto</button>`
                          : '')
                  }
                </td>
              </tr>
              <tr class="inline-form-row hidden" data-define-form="${row.lead.id}">
                <td colspan="6">
                  <div class="inline-panel">
                    <label class="stacked">Nota de la definición (qué se acordó)
                      <textarea rows="2" class="f-define-note" placeholder="Ej: lo llamé, lo tanteé, coordinamos nueva llamada."></textarea>
                    </label>
                    <label class="stacked" style="max-width:220px">Próximo contacto
                      <input type="date" class="f-define-date" />
                    </label>
                    <button class="btn btn-primary save-define-btn" data-lead-id="${row.lead.id}">Guardar y pasar a Gestión</button>
                  </div>
                </td>
              </tr>
              <tr class="inline-form-row hidden" data-resolve-form="${row.lead.id}">
                <td colspan="6">
                  <div class="inline-panel">
                    <label class="stacked">Nota de cierre
                      <textarea rows="2" class="f-resolve-note" placeholder="Ej: definió compra, quedó cerrado."></textarea>
                    </label>
                    <button class="btn btn-primary save-resolve-btn" data-lead-id="${row.lead.id}">Confirmar resuelto</button>
                  </div>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>

        <h3>Próximos contactos</h3>
        <ul class="history-list" id="events-list">
          ${
            ctx.events
              .filter((e) => !e.is_done)
              .map(
                (e) => `
            <li>
              <strong>${formatDateTime(e.scheduled_at)}</strong> · ${e.userName}
              <div>${e.note ?? ''}</div>
              <button class="btn btn-ghost log-event-btn" data-event-id="${e.id}">Registrar seguimiento</button>
              <div class="inline-form-row hidden" data-log-form="${e.id}">
                <div class="inline-panel">
                  <label class="stacked">Qué se habló
                    <textarea rows="2" class="f-log-note"></textarea>
                  </label>
                  <label class="stacked" style="max-width:220px">Reagendar para
                    <input type="date" class="f-log-date" />
                  </label>
                  <button class="btn btn-primary save-log-btn" data-event-id="${e.id}">Guardar</button>
                </div>
              </div>
            </li>`
              )
              .join('') || '<li class="muted">Sin contactos agendados.</li>'
          }
        </ul>

        <h3>Historial de paneos</h3>
        <ul class="history-list">
          ${
            ctx.notes
              .map(
                (n) => `<li><span class="muted small">${formatDateTime(n.created_at)}</span> · ${n.userName}<div>${n.note}</div></li>`
              )
              .join('') || '<li class="muted">Sin paneos registrados todavía.</li>'
          }
        </ul>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const refresh = async () => {
    closeModal(overlay);
    await openBuyerPanel(buyerKey, onClose);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(overlay);
      onClose?.();
    }
  });
  overlay.querySelector('#modal-close').addEventListener('click', () => {
    closeModal(overlay);
    onClose?.();
  });

  overlay.querySelectorAll('.lead-open-link').forEach((el) => {
    el.addEventListener('click', () => openLeadDetail(el.dataset.leadId, refresh));
  });

  overlay.querySelectorAll('.define-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      overlay.querySelector(`[data-define-form="${btn.dataset.leadId}"]`).classList.toggle('hidden');
    });
  });
  overlay.querySelectorAll('.save-define-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const leadId = btn.dataset.leadId;
      const formRow = overlay.querySelector(`[data-define-form="${leadId}"]`);
      const note = formRow.querySelector('.f-define-note').value.trim();
      const nextDate = fromLocalDateInputValue(formRow.querySelector('.f-define-date').value);
      if (!note) return;
      await defineFollowup(leadId, { note, nextDate, userId: getCurrentUserId() });
      await refresh();
    });
  });

  overlay.querySelectorAll('.resolve-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      overlay.querySelector(`[data-resolve-form="${btn.dataset.leadId}"]`).classList.toggle('hidden');
    });
  });
  overlay.querySelectorAll('.save-resolve-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const leadId = btn.dataset.leadId;
      const formRow = overlay.querySelector(`[data-resolve-form="${leadId}"]`);
      const note = formRow.querySelector('.f-resolve-note').value.trim();
      await resolveLead(leadId, { note, userId: getCurrentUserId() });
      await refresh();
    });
  });

  overlay.querySelectorAll('.log-event-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      overlay.querySelector(`[data-log-form="${btn.dataset.eventId}"]`).classList.toggle('hidden');
    });
  });
  overlay.querySelectorAll('.save-log-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const eventId = btn.dataset.eventId;
      const formRow = overlay.querySelector(`[data-log-form="${eventId}"]`);
      const note = formRow.querySelector('.f-log-note').value.trim();
      const nextDate = fromLocalDateInputValue(formRow.querySelector('.f-log-date').value);
      if (!note) return;
      await logBuyerFollowup(buyerKey, { note, nextDate, userId: getCurrentUserId(), eventIdToComplete: eventId });
      await refresh();
    });
  });
}
