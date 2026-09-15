// Módulo `prospects` (CLAUDE.md §5, §6.1): listados de prospección, alta
// manual y por pegado de CSV, conversión a lead.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, PROSPECT_STATUS } from '../../lib/collections.js';
import {
  loadProspectingLists,
  loadListDetail,
  addProspect,
  setProspectStatus,
  convertProspectToLead,
  createProspectingList,
  setListArchived,
} from './prospect-data.js';

const STATUS_LABELS = {
  [PROSPECT_STATUS.PENDING]: 'Pendiente',
  [PROSPECT_STATUS.QUALIFIED]: 'Calificado',
  [PROSPECT_STATUS.DISCARDED]: 'Descartado',
};

let showArchived = false;

function parseCsvPaste(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [companyName = '', contactName = '', email = '', phone = ''] = line.split(',').map((c) => c.trim());
      return { companyName, contactName, email, phone };
    });
}

async function renderListOverview(container) {
  container.innerHTML = '<p class="muted">Cargando listados…</p>';
  const allRows = await loadProspectingLists();
  const rows = showArchived ? allRows : allRows.filter((r) => !r.list.is_archived);
  const users = await gateway.list(COLLECTIONS.USERS);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="filter-bar">
      <label class="inline-toggle" style="margin-left:0">
        <input type="checkbox" id="show-archived" ${showArchived ? 'checked' : ''} /> Mostrar archivados
      </label>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Listado</th>
          <th>Responsable</th>
          <th>Prospects</th>
          <th>Completado</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows
            .map(
              (row) => `
          <tr data-list-id="${row.list.id}" class="row-clickable">
            <td>${row.list.title}${row.list.is_archived ? ' <span class="badge">Archivado</span>' : ''}</td>
            <td>${row.ownerName}</td>
            <td>${row.total}</td>
            <td>
              <div class="progress-track"><div class="progress-fill" style="width:${row.progressPct}%"></div></div>
              <span class="muted small">${row.progressPct}% (${row.completed}/${row.total})</span>
            </td>
          </tr>`
            )
            .join('') || '<tr><td colspan="4" class="muted">Sin listados.</td></tr>'
        }
      </tbody>
    </table>

    <div class="panel">
      <h3>Nuevo listado de prospección</h3>
      <form id="new-list-form" class="inline-form">
        <input name="title" placeholder="Título del listado" required />
        <select name="ownerId">
          ${users.map((u) => `<option value="${u.id}">${u.first_name} ${u.last_name}</option>`).join('')}
        </select>
        <button type="submit" class="btn">Crear</button>
      </form>
    </div>
  `;

  wrapper.querySelectorAll('tr[data-list-id]').forEach((tr) => {
    tr.addEventListener('click', () => renderListDetail(container, tr.dataset.listId));
  });

  wrapper.querySelector('#show-archived').addEventListener('change', (e) => {
    showArchived = e.target.checked;
    renderListOverview(container);
  });

  wrapper.querySelector('#new-list-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await createProspectingList(formData.get('title'), formData.get('ownerId'));
    renderListOverview(container);
  });

  container.innerHTML = '';
  container.appendChild(wrapper);
}

async function renderListDetail(container, listId) {
  container.innerHTML = '<p class="muted">Cargando listado…</p>';
  const { list, prospects } = await loadListDetail(listId);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="detail-header">
      <button class="btn btn-ghost nav-btn" id="back-to-lists">← Listados</button>
      <h2>${list.title}</h2>
      <button class="btn btn-ghost" id="toggle-archive-btn">${list.is_archived ? 'Desarchivar' : 'Archivar'}</button>
    </div>
    <table class="data-table" id="prospects-table">
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Contacto</th>
          <th>Email</th>
          <th>Teléfono</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${prospects
          .map(
            (p) => `
          <tr data-prospect-id="${p.id}">
            <td>${p.company_name}</td>
            <td>${p.contact_name}</td>
            <td>${p.email ?? ''}</td>
            <td>${p.phone ?? ''}</td>
            <td>
              ${
                p.converted_lead_id
                  ? '<span class="badge badge-status-won">Convertido</span>'
                  : `<select class="status-select">
                      ${Object.entries(STATUS_LABELS)
                        .map(([value, label]) => `<option value="${value}" ${p.status === value ? 'selected' : ''}>${label}</option>`)
                        .join('')}
                    </select>`
              }
            </td>
            <td>${p.converted_lead_id ? '' : '<button class="btn convert-btn">Convertir a lead</button>'}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="panel">
      <h3>Agregar prospect</h3>
      <form id="add-prospect-form" class="inline-form">
        <input name="companyName" placeholder="Empresa" required />
        <input name="contactName" placeholder="Contacto" required />
        <input name="email" placeholder="Email" type="email" />
        <input name="phone" placeholder="Teléfono" />
        <button type="submit" class="btn">Agregar</button>
      </form>
    </div>

    <div class="panel">
      <h3>Importar (pegar CSV)</h3>
      <p class="muted small">Una fila por línea: Empresa, Contacto, Email, Teléfono</p>
      <textarea id="csv-paste" rows="4" placeholder="Petroquímica del Litoral, Andrea Molina, amolina@petrolitoral.com, 341 500 9911"></textarea>
      <button id="import-csv-btn" class="btn">Importar</button>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(wrapper);

  wrapper.querySelector('#back-to-lists').addEventListener('click', () => renderListOverview(container));

  wrapper.querySelector('#toggle-archive-btn').addEventListener('click', async () => {
    await setListArchived(listId, !list.is_archived);
    renderListDetail(container, listId);
  });

  wrapper.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const prospectId = e.target.closest('tr').dataset.prospectId;
      await setProspectStatus(prospectId, e.target.value);
    });
  });

  wrapper.querySelectorAll('.convert-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('tr');
      const prospectId = row.dataset.prospectId;
      const prospect = prospects.find((p) => p.id === prospectId);
      const lead = await convertProspectToLead(prospect);
      alert(`Lead creado: "${lead.title}"`);
      renderListDetail(container, listId);
    });
  });

  wrapper.querySelector('#add-prospect-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await addProspect(listId, {
      companyName: formData.get('companyName'),
      contactName: formData.get('contactName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
    });
    renderListDetail(container, listId);
  });

  wrapper.querySelector('#import-csv-btn').addEventListener('click', async () => {
    const raw = wrapper.querySelector('#csv-paste').value;
    const rows = parseCsvPaste(raw);
    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      await addProspect(listId, row);
    }
    renderListDetail(container, listId);
  });
}

export async function renderProspecting(container) {
  await renderListOverview(container);
}
