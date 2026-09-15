// Ficha de detalle de un lead: edición de campos, contacto (parser),
// actividades, comentarios e historial de auditoría. Se abre como modal
// desde la tabla de leads o el kanban (CLAUDE.md §5, §6.2, §6.3).

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, LEAD_STATUS, LEAD_STATUS_LABELS, CUSTOM_FIELD_PARENT_TYPE, FIELD_TYPES } from '../../lib/collections.js';
import { formatDateTime, toLocalDateInputValue, toLocalDateTimeInputValue, fromLocalDateInputValue, fromLocalDateTimeInputValue } from '../../lib/format.js';
import { parseDescription, buildDescription, getFieldValue } from '../parser/parser.js';
import { updateLead, loadLeadHistory } from './lead-service.js';
import { loadActivityTypeOptions, loadActivityLog, logActivity } from '../activities/activities-data.js';
import { loadComments, addComment } from './comments-data.js';
import { getCurrentUserId } from '../auth/session.js';

const HISTORY_FIELD_LABELS = {
  step_id: 'Etapa',
  status: 'Estado',
  amount: 'Monto',
  owner_id: 'Responsable',
};

function closeModal(overlay) {
  overlay.remove();
}

function updateVisibility(root, status) {
  root.querySelectorAll('[data-visible-when]').forEach((el) => {
    el.classList.toggle('hidden', el.dataset.visibleWhen !== status);
  });
}

export async function openLeadDetail(leadId, onClose) {
  const [lead, pipelines, allSteps, users, customFields] = await Promise.all([
    gateway.get(COLLECTIONS.LEADS, leadId),
    gateway.list(COLLECTIONS.PIPELINES),
    gateway.list(COLLECTIONS.STEPS, { sort: { field: 'position' } }),
    gateway.list(COLLECTIONS.USERS),
    gateway.list(COLLECTIONS.CUSTOM_FIELDS),
  ]);

  const currentStep = allSteps.find((s) => s.id === lead.step_id);
  const steps = allSteps.filter((s) => s.pipeline_id === currentStep?.pipeline_id);
  const parsed = parseDescription(lead.description, customFields, CUSTOM_FIELD_PARENT_TYPE.LEAD);

  const [activityOptions, activityLog, comments, history, tagCategories, allTags, leadTagRows] = await Promise.all([
    loadActivityTypeOptions(),
    loadActivityLog(leadId),
    loadComments(leadId),
    loadLeadHistory(leadId),
    gateway.list(COLLECTIONS.TAG_CATEGORIES),
    gateway.list(COLLECTIONS.TAGS, { sort: { field: 'position' } }),
    gateway.list(COLLECTIONS.LEAD_TAGS, { filter: { lead_id: leadId } }),
  ]);
  const selectedTagIds = new Set(leadTagRows.map((lt) => lt.tag_id));

  const stepsById = new Map(allSteps.map((s) => [s.id, s]));
  const usersById = new Map(users.map((u) => [u.id, u]));
  const userLabel = (id) => (usersById.get(id) ? `${usersById.get(id).first_name} ${usersById.get(id).last_name}` : '—');
  const historyValueLabel = (field, value) => {
    if (!value) return '—';
    if (field === 'step_id') return stepsById.get(value)?.name ?? value;
    if (field === 'owner_id') return userLabel(value);
    if (field === 'status') return LEAD_STATUS_LABELS[value] ?? value;
    return value;
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <input id="f-title" class="title-input" value="${lead.title}" />
        <button id="f-star" class="btn btn-ghost" title="Destacar">${lead.starred ? '★' : '☆'}</button>
        <button id="modal-close" class="btn btn-ghost nav-btn">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <label>Etapa
            <select id="f-step">
              ${steps.map((s) => `<option value="${s.id}" ${s.id === lead.step_id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </label>
          <label>Estado
            <select id="f-status">
              ${Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => `<option value="${v}" ${v === lead.status ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </label>
          <label>Responsable
            <select id="f-owner">
              ${users.map((u) => `<option value="${u.id}" ${u.id === lead.owner_id ? 'selected' : ''}>${u.first_name} ${u.last_name}</option>`).join('')}
            </select>
          </label>
          <label>Monto (${lead.currency})
            <input id="f-amount" type="number" step="1" value="${lead.amount ?? ''}" />
          </label>
          <label>Probabilidad (%)
            <input id="f-probability" type="number" min="0" max="100" value="${lead.probability ?? 0}" />
          </label>
          <label>Cierre estimado
            <input id="f-closing" type="date" value="${toLocalDateInputValue(lead.estimated_closing_date)}" />
          </label>
        </div>

        <div class="form-grid" data-visible-when="todo">
          <label>Próxima acción
            <input id="f-next-action" type="datetime-local" value="${toLocalDateTimeInputValue(lead.next_action_at)}" />
          </label>
        </div>

        <div class="form-grid" data-visible-when="standby">
          <label>Fecha de recordatorio
            <input id="f-remind-date" type="date" value="${toLocalDateInputValue(lead.remind_date)}" />
          </label>
          <label>Nota del recordatorio
            <input id="f-remind-note" type="text" value="${lead.reminder_note ?? ''}" />
          </label>
        </div>

        <div class="form-grid" data-visible-when="won">
          <p class="muted small">Cerrado (ganado) el ${formatDateTime(lead.closed_at)}.</p>
        </div>
        <div class="form-grid" data-visible-when="lost">
          <p class="muted small">Cerrado (perdido) el ${formatDateTime(lead.closed_at)}.</p>
        </div>
        <div class="form-grid" data-visible-when="cancelled">
          <p class="muted small">Anulado el ${formatDateTime(lead.closed_at)}.</p>
        </div>

        <h3>Contacto</h3>
        <div class="form-grid">
          <label>Nombre <input id="f-first-name" value="${getFieldValue(parsed, FIELD_TYPES.FIRST_NAME)}" /></label>
          <label>Apellido <input id="f-last-name" value="${getFieldValue(parsed, FIELD_TYPES.LAST_NAME)}" /></label>
          <label>Email <input id="f-email" value="${getFieldValue(parsed, FIELD_TYPES.EMAIL)}" /></label>
          <label>Teléfono <input id="f-phone" value="${getFieldValue(parsed, FIELD_TYPES.PHONE)}" /></label>
          <label class="span-2">Dirección <input id="f-address" value="${getFieldValue(parsed, FIELD_TYPES.ADDRESS)}" /></label>
        </div>
        <label>Notas libres
          <textarea id="f-free-text" rows="3">${parsed.freeText}</textarea>
        </label>

        <h3>Etiquetas</h3>
        <div class="tag-category-groups">
          ${tagCategories
            .map(
              (cat) => `
            <div class="tag-category-group">
              <span class="muted small">${cat.name}${cat.is_required ? ' *' : ''}</span>
              <div class="tag-checkboxes">
                ${allTags
                  .filter((t) => t.tag_category_id === cat.id)
                  .map(
                    (t) => `
                  <label class="tag-checkbox">
                    <input type="checkbox" class="tag-toggle" value="${t.id}" ${selectedTagIds.has(t.id) ? 'checked' : ''} />
                    ${t.name}
                  </label>`
                  )
                  .join('') || '<span class="muted small">Sin etiquetas en esta categoría.</span>'}
              </div>
            </div>`
            )
            .join('') || '<p class="muted small">No hay categorías de etiquetas configuradas.</p>'}
        </div>

        <button id="f-save" class="btn btn-primary">Guardar</button>

        <h3>Actividades</h3>
        <div class="inline-form">
          <select id="activity-type">
            ${activityOptions.map((o) => `<option value="${o.id}">${'—'.repeat(o.depth)} ${o.label}</option>`).join('')}
          </select>
          <input id="activity-note" placeholder="Nota (opcional)" />
          <button id="activity-log-btn" class="btn">Registrar</button>
        </div>
        <ul class="activity-list">
          ${activityLog
            .map(
              (log) => `
            <li><span class="dot" style="background:${log.activityColor}"></span>
              <strong>${log.activityName}</strong> · ${log.userName} · <span class="muted small">${formatDateTime(log.logged_at)}</span>
              ${log.note ? `<div class="muted small">${log.note}</div>` : ''}
            </li>`
            )
            .join('') || '<li class="muted">Sin actividades registradas.</li>'}
        </ul>

        <h3>Comentarios</h3>
        <div class="inline-form">
          <input id="comment-body" placeholder="Escribir un comentario…" class="span-2" />
          <button id="comment-btn" class="btn">Comentar</button>
        </div>
        <ul class="comment-list">
          ${comments
            .map(
              (c) => `<li><strong>${c.userName}</strong> · <span class="muted small">${formatDateTime(c.created_at)}</span><div>${c.body}</div></li>`
            )
            .join('') || '<li class="muted">Sin comentarios.</li>'}
        </ul>

        <h3>Historial</h3>
        <ul class="history-list">
          ${history
            .map(
              (h) => `<li><span class="muted small">${formatDateTime(h.changed_at)}</span> · ${h.userName} cambió <strong>${HISTORY_FIELD_LABELS[h.field_changed] ?? h.field_changed}</strong>: ${historyValueLabel(h.field_changed, h.old_value)} → ${historyValueLabel(h.field_changed, h.new_value)}</li>`
            )
            .join('') || '<li class="muted">Sin cambios registrados.</li>'}
        </ul>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  updateVisibility(overlay, lead.status);

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

  let starred = lead.starred;
  overlay.querySelector('#f-star').addEventListener('click', (e) => {
    starred = !starred;
    e.target.textContent = starred ? '★' : '☆';
  });

  overlay.querySelector('#f-status').addEventListener('change', (e) => updateVisibility(overlay, e.target.value));

  overlay.querySelectorAll('.tag-toggle').forEach((checkbox) => {
    checkbox.addEventListener('change', async (e) => {
      const tagId = e.target.value;
      if (e.target.checked) {
        await gateway.create(COLLECTIONS.LEAD_TAGS, { lead_id: leadId, tag_id: tagId });
      } else {
        const [existing] = await gateway.list(COLLECTIONS.LEAD_TAGS, { filter: { lead_id: leadId, tag_id: tagId } });
        if (existing) await gateway.remove(COLLECTIONS.LEAD_TAGS, existing.id);
      }
    });
  });

  overlay.querySelector('#f-save').addEventListener('click', async () => {
    const description = buildDescription(
      {
        [FIELD_TYPES.FIRST_NAME]: overlay.querySelector('#f-first-name').value,
        [FIELD_TYPES.LAST_NAME]: overlay.querySelector('#f-last-name').value,
        [FIELD_TYPES.EMAIL]: overlay.querySelector('#f-email').value,
        [FIELD_TYPES.PHONE]: overlay.querySelector('#f-phone').value,
        [FIELD_TYPES.ADDRESS]: overlay.querySelector('#f-address').value,
      },
      overlay.querySelector('#f-free-text').value,
      customFields,
      CUSTOM_FIELD_PARENT_TYPE.LEAD
    );

    const status = overlay.querySelector('#f-status').value;
    const patch = {
      title: overlay.querySelector('#f-title').value,
      step_id: overlay.querySelector('#f-step').value,
      status,
      owner_id: overlay.querySelector('#f-owner').value,
      amount: overlay.querySelector('#f-amount').value ? Number(overlay.querySelector('#f-amount').value) : null,
      probability: Number(overlay.querySelector('#f-probability').value) || 0,
      estimated_closing_date: fromLocalDateInputValue(overlay.querySelector('#f-closing').value),
      starred,
      description,
    };

    if (status === LEAD_STATUS.TODO) {
      patch.next_action_at = fromLocalDateTimeInputValue(overlay.querySelector('#f-next-action').value);
    }
    if (status === LEAD_STATUS.STANDBY) {
      patch.remind_date = fromLocalDateInputValue(overlay.querySelector('#f-remind-date').value);
      patch.reminder_note = overlay.querySelector('#f-remind-note').value;
    }

    await updateLead(leadId, patch, getCurrentUserId());
    closeModal(overlay);
    onClose?.();
  });

  overlay.querySelector('#activity-log-btn').addEventListener('click', async () => {
    const activityId = overlay.querySelector('#activity-type').value;
    const note = overlay.querySelector('#activity-note').value;
    await logActivity(leadId, activityId, getCurrentUserId(), note);
    closeModal(overlay);
    openLeadDetail(leadId, onClose);
  });

  overlay.querySelector('#comment-btn').addEventListener('click', async () => {
    const body = overlay.querySelector('#comment-body').value.trim();
    if (!body) return;
    await addComment(leadId, getCurrentUserId(), body);
    closeModal(overlay);
    openLeadDetail(leadId, onClose);
  });
}
