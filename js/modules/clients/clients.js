// Módulo `clients` (CLAUDE.md §5): listado y ficha de carpetas de clientes.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, FIELD_TYPES } from '../../lib/collections.js';
import { formatCurrency } from '../../lib/format.js';
import { loadClientFolders, loadClientFolderDetail, createClientFolder, updateClientFolder, buildClientDescription } from './client-data.js';
import { openLeadDetail } from '../leads/lead-detail.js';

async function renderOverview(container) {
  container.innerHTML = '<p class="muted">Cargando carpetas…</p>';
  const rows = await loadClientFolders();
  const users = await gateway.list(COLLECTIONS.USERS);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Cliente</th><th>Responsable</th><th>Leads</th><th>Monto total</th><th>Estado</th></tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
          <tr data-folder-id="${row.folder.id}" class="row-clickable">
            <td>${row.folder.name}</td>
            <td>${row.ownerName}</td>
            <td>${row.leadCount}</td>
            <td>${formatCurrency(row.totalAmount, 'ARS')}</td>
            <td>${row.folder.is_active ? '<span class="badge badge-status-won">Activo</span>' : '<span class="badge badge-status-cancelled">Inactivo</span>'}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="panel">
      <h3>Nueva carpeta de cliente</h3>
      <form id="new-folder-form" class="inline-form">
        <input name="name" placeholder="Nombre del cliente" required />
        <select name="ownerId">
          ${users.map((u) => `<option value="${u.id}">${u.first_name} ${u.last_name}</option>`).join('')}
        </select>
        <button type="submit" class="btn">Crear</button>
      </form>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(wrapper);

  wrapper.querySelectorAll('tr[data-folder-id]').forEach((tr) => {
    tr.addEventListener('click', () => renderDetail(container, tr.dataset.folderId));
  });

  wrapper.querySelector('#new-folder-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await createClientFolder({ name: formData.get('name'), ownerId: formData.get('ownerId') });
    renderOverview(container);
  });
}

async function renderDetail(container, folderId) {
  container.innerHTML = '<p class="muted">Cargando carpeta…</p>';
  const { folder, customFields, parsed, email, phone, address, leads } = await loadClientFolderDetail(folderId);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="detail-header">
      <button class="btn btn-ghost nav-btn" id="back-to-folders">← Clientes</button>
      <h2>${folder.name}</h2>
      <label class="inline-toggle">
        <input type="checkbox" id="f-active" ${folder.is_active ? 'checked' : ''} /> Activo
      </label>
    </div>

    <div class="form-grid">
      <label>Email <input id="f-email" value="${email}" /></label>
      <label>Teléfono <input id="f-phone" value="${phone}" /></label>
      <label class="span-2">Dirección <input id="f-address" value="${address}" /></label>
    </div>
    <label class="stacked">Notas
      <textarea id="f-free-text" rows="3">${parsed.freeText}</textarea>
    </label>
    <button id="f-save" class="btn btn-primary">Guardar</button>

    <h3>Leads de este cliente</h3>
    <table class="data-table">
      <thead><tr><th>Título</th><th>Estado</th><th>Monto</th><th>Responsable</th></tr></thead>
      <tbody>
        ${
          leads
            .map(
              (l) => `
          <tr data-lead-id="${l.id}" class="row-clickable">
            <td>${l.title}</td>
            <td>${l.status}</td>
            <td>${formatCurrency(l.amount, l.currency)}</td>
            <td>${l.ownerName}</td>
          </tr>`
            )
            .join('') || '<tr><td colspan="4" class="muted">Sin leads asociados todavía.</td></tr>'
        }
      </tbody>
    </table>
  `;

  container.innerHTML = '';
  container.appendChild(wrapper);

  wrapper.querySelector('#back-to-folders').addEventListener('click', () => renderOverview(container));

  wrapper.querySelector('#f-active').addEventListener('change', async (e) => {
    await updateClientFolder(folderId, { is_active: e.target.checked });
  });

  wrapper.querySelector('#f-save').addEventListener('click', async () => {
    const description = buildClientDescription(
      {
        [FIELD_TYPES.EMAIL]: wrapper.querySelector('#f-email').value,
        [FIELD_TYPES.PHONE]: wrapper.querySelector('#f-phone').value,
        [FIELD_TYPES.ADDRESS]: wrapper.querySelector('#f-address').value,
      },
      wrapper.querySelector('#f-free-text').value,
      customFields
    );
    await updateClientFolder(folderId, { description });
    renderDetail(container, folderId);
  });

  wrapper.querySelectorAll('tr[data-lead-id]').forEach((tr) => {
    tr.addEventListener('click', () => openLeadDetail(tr.dataset.leadId, () => renderDetail(container, folderId)));
  });
}

export async function renderClients(container) {
  await renderOverview(container);
}
