// Módulo `config` (CLAUDE.md §5): pantalla de administración con sub-pestañas
// para etapas, campos personalizados, etiquetas y tipos de actividad.

import { FIELD_TYPES, CUSTOM_FIELD_PARENT_TYPE, ACTIVITY_KIND } from '../../lib/collections.js';
import * as api from './config-data.js';

const FIELD_TYPE_LABELS = {
  [FIELD_TYPES.UNSET]: 'Sin tipo',
  [FIELD_TYPES.EMAIL]: 'Email',
  [FIELD_TYPES.PHONE]: 'Teléfono',
  [FIELD_TYPES.MOBILE]: 'Celular',
  [FIELD_TYPES.ADDRESS]: 'Dirección',
  [FIELD_TYPES.WEB]: 'Web',
  [FIELD_TYPES.FIRST_NAME]: 'Nombre',
  [FIELD_TYPES.LAST_NAME]: 'Apellido',
  [FIELD_TYPES.FULL_NAME]: 'Nombre completo',
  [FIELD_TYPES.JOB]: 'Puesto',
  [FIELD_TYPES.FAX]: 'Fax',
  [FIELD_TYPES.VAT]: 'CUIT/CUIL',
  [FIELD_TYPES.CITY]: 'Ciudad',
  [FIELD_TYPES.ZIPCODE]: 'Código postal',
  [FIELD_TYPES.STATE]: 'Provincia',
  [FIELD_TYPES.COUNTRY]: 'País',
  [FIELD_TYPES.COMPANY_ID]: 'ID de empresa',
};

const SUB_TABS = [
  { id: 'steps', label: 'Etapas' },
  { id: 'fields', label: 'Campos' },
  { id: 'tags', label: 'Etiquetas' },
  { id: 'activities', label: 'Actividades' },
];

let activeSubTab = 'steps';

async function renderSteps(container) {
  const { pipeline, steps } = await api.loadSteps();
  const section = document.createElement('div');
  section.innerHTML = `
    <h3>${pipeline.name}</h3>
    <table class="data-table">
      <thead><tr><th>#</th><th>Nombre</th><th></th></tr></thead>
      <tbody>
        ${steps
          .map(
            (s, i) => `
          <tr data-id="${s.id}">
            <td>${i + 1}</td>
            <td><input class="f-name" value="${s.name}" /></td>
            <td>
              <button class="btn btn-ghost move-up" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn btn-ghost move-down" ${i === steps.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="btn btn-ghost delete-btn">🗑</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="inline-form">
      <input id="new-step-name" placeholder="Nueva etapa" />
      <button id="add-step-btn" class="btn">Agregar</button>
    </div>
  `;

  section.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelector('.f-name').addEventListener('change', (e) => api.updateStep(id, { name: e.target.value }));
    tr.querySelector('.move-up').addEventListener('click', async () => { await api.moveStep(id, 'up'); rerender(container); });
    tr.querySelector('.move-down').addEventListener('click', async () => { await api.moveStep(id, 'down'); rerender(container); });
    tr.querySelector('.delete-btn').addEventListener('click', async () => {
      try {
        await api.deleteStep(id);
        rerender(container);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  section.querySelector('#add-step-btn').addEventListener('click', async () => {
    const input = section.querySelector('#new-step-name');
    if (!input.value.trim()) return;
    await api.createStep(pipeline.id, input.value.trim());
    rerender(container);
  });

  return section;
}

async function renderFields(container, parentType = CUSTOM_FIELD_PARENT_TYPE.LEAD) {
  const fields = await api.loadCustomFields(parentType);
  const section = document.createElement('div');
  section.innerHTML = `
    <div class="tabs">
      <button class="tab${parentType === 'lead' ? ' tab-active' : ''}" data-parent="lead">Campos de lead</button>
      <button class="tab${parentType === 'client' ? ' tab-active' : ''}" data-parent="client">Campos de cliente</button>
    </div>
    <table class="data-table">
      <thead><tr><th>Nombre (etiqueta que reconoce el parser)</th><th>Tipo</th><th>Clave</th><th></th></tr></thead>
      <tbody>
        ${fields
          .map(
            (f) => `
          <tr data-id="${f.id}">
            <td><input class="f-name" value="${f.name}" /></td>
            <td>
              <select class="f-type">
                ${Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => `<option value="${v}" ${v === f.field_type ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </td>
            <td><input type="checkbox" class="f-key" ${f.is_key ? 'checked' : ''} /></td>
            <td><button class="btn btn-ghost delete-btn">🗑</button></td>
          </tr>`
          )
          .join('') || '<tr><td colspan="4" class="muted">Sin campos definidos.</td></tr>'}
      </tbody>
    </table>
    <div class="inline-form">
      <input id="new-field-name" placeholder="Nombre (ej: Firstname)" />
      <select id="new-field-type">
        ${Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
      <label class="inline-toggle"><input type="checkbox" id="new-field-key" /> Clave</label>
      <button id="add-field-btn" class="btn">Agregar</button>
    </div>
  `;

  section.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newSection = await renderFields(container, btn.dataset.parent);
      section.replaceWith(newSection);
    });
  });

  section.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelector('.f-name').addEventListener('change', (e) => api.updateCustomField(id, { name: e.target.value }));
    tr.querySelector('.f-type').addEventListener('change', (e) => api.updateCustomField(id, { field_type: e.target.value }));
    tr.querySelector('.f-key').addEventListener('change', (e) => api.updateCustomField(id, { is_key: e.target.checked }));
    tr.querySelector('.delete-btn').addEventListener('click', async () => {
      await api.deleteCustomField(id);
      const newSection = await renderFields(container, parentType);
      section.replaceWith(newSection);
    });
  });

  section.querySelector('#add-field-btn').addEventListener('click', async () => {
    const name = section.querySelector('#new-field-name').value.trim();
    if (!name) return;
    await api.createCustomField(parentType, {
      name,
      fieldType: section.querySelector('#new-field-type').value,
      isKey: section.querySelector('#new-field-key').checked,
    });
    const newSection = await renderFields(container, parentType);
    section.replaceWith(newSection);
  });

  return section;
}

async function renderTagsSection(container, selectedCategoryId = null) {
  const categories = await api.loadTagCategories();
  const activeCategoryId = selectedCategoryId ?? categories[0]?.id ?? null;
  const tags = activeCategoryId ? await api.loadTags(activeCategoryId) : [];

  const section = document.createElement('div');
  section.innerHTML = `
    <div class="config-columns">
      <div>
        <h3>Categorías</h3>
        <table class="data-table">
          <thead><tr><th>Nombre</th><th>Obligatoria</th><th></th></tr></thead>
          <tbody>
            ${categories
              .map(
                (c) => `
              <tr data-id="${c.id}" class="${c.id === activeCategoryId ? 'row-active' : ''} row-clickable">
                <td><input class="f-cat-name" value="${c.name}" /></td>
                <td><input type="checkbox" class="f-cat-required" ${c.is_required ? 'checked' : ''} /></td>
                <td><button class="btn btn-ghost delete-cat-btn">🗑</button></td>
              </tr>`
              )
              .join('') || '<tr><td colspan="3" class="muted">Sin categorías.</td></tr>'}
          </tbody>
        </table>
        <div class="inline-form">
          <input id="new-cat-name" placeholder="Nueva categoría" />
          <button id="add-cat-btn" class="btn">Agregar</button>
        </div>
      </div>

      <div>
        <h3>Etiquetas${activeCategoryId ? ` — ${categories.find((c) => c.id === activeCategoryId)?.name ?? ''}` : ''}</h3>
        <table class="data-table">
          <thead><tr><th>Nombre</th><th></th></tr></thead>
          <tbody>
            ${tags
              .map(
                (t) => `
              <tr data-id="${t.id}">
                <td><input class="f-tag-name" value="${t.name}" /></td>
                <td><button class="btn btn-ghost delete-tag-btn">🗑</button></td>
              </tr>`
              )
              .join('') || '<tr><td colspan="2" class="muted">Sin etiquetas.</td></tr>'}
          </tbody>
        </table>
        <div class="inline-form">
          <input id="new-tag-name" placeholder="Nueva etiqueta" ${activeCategoryId ? '' : 'disabled'} />
          <button id="add-tag-btn" class="btn" ${activeCategoryId ? '' : 'disabled'}>Agregar</button>
        </div>
      </div>
    </div>
  `;

  section.querySelectorAll('tr[data-id]').forEach((tr) => {
    const isCategoryRow = tr.querySelector('.f-cat-name') !== null;
    if (!isCategoryRow) return;
    tr.addEventListener('click', async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      const newSection = await renderTagsSection(container, tr.dataset.id);
      section.replaceWith(newSection);
    });
  });

  section.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    const catNameInput = tr.querySelector('.f-cat-name');
    if (catNameInput) {
      catNameInput.addEventListener('click', (e) => e.stopPropagation());
      catNameInput.addEventListener('change', (e) => api.updateTagCategory(id, { name: e.target.value }));
      tr.querySelector('.f-cat-required').addEventListener('click', (e) => e.stopPropagation());
      tr.querySelector('.f-cat-required').addEventListener('change', (e) => api.updateTagCategory(id, { is_required: e.target.checked }));
      tr.querySelector('.delete-cat-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await api.deleteTagCategory(id);
        const newSection = await renderTagsSection(container, null);
        section.replaceWith(newSection);
      });
    }
    const tagNameInput = tr.querySelector('.f-tag-name');
    if (tagNameInput) {
      tagNameInput.addEventListener('change', (e) => api.updateTag(id, { name: e.target.value }));
      tr.querySelector('.delete-tag-btn').addEventListener('click', async () => {
        await api.deleteTag(id);
        const newSection = await renderTagsSection(container, activeCategoryId);
        section.replaceWith(newSection);
      });
    }
  });

  section.querySelector('#add-cat-btn').addEventListener('click', async () => {
    const input = section.querySelector('#new-cat-name');
    if (!input.value.trim()) return;
    const created = await api.createTagCategory(input.value.trim());
    const newSection = await renderTagsSection(container, created.id);
    section.replaceWith(newSection);
  });

  const addTagBtn = section.querySelector('#add-tag-btn');
  if (activeCategoryId) {
    addTagBtn.addEventListener('click', async () => {
      const input = section.querySelector('#new-tag-name');
      if (!input.value.trim()) return;
      await api.createTag(activeCategoryId, input.value.trim());
      const newSection = await renderTagsSection(container, activeCategoryId);
      section.replaceWith(newSection);
    });
  }

  return section;
}

async function renderActivitiesSection(container) {
  const activities = await api.loadActivities();
  const activitiesById = new Map(activities.map((a) => [a.id, a]));
  const depthOf = (a) => (a.parent_id ? 1 : 0);

  const section = document.createElement('div');
  section.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Nombre</th><th>Tipo</th><th>Color</th><th>Padre</th><th>Deshabilitada</th><th></th></tr></thead>
      <tbody>
        ${activities
          .map(
            (a) => `
          <tr data-id="${a.id}">
            <td style="padding-left:${depthOf(a) * 20 + 12}px"><input class="f-name" value="${a.name}" /></td>
            <td>
              <select class="f-kind">
                ${Object.values(ACTIVITY_KIND).map((k) => `<option value="${k}" ${k === a.kind ? 'selected' : ''}>${k}</option>`).join('')}
              </select>
            </td>
            <td><input type="color" class="f-color" value="${a.color}" /></td>
            <td>
              <select class="f-parent">
                <option value="">— (raíz)</option>
                ${activities.filter((p) => p.id !== a.id && !p.parent_id).map((p) => `<option value="${p.id}" ${p.id === a.parent_id ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
            </td>
            <td><input type="checkbox" class="f-disabled" ${a.is_disabled ? 'checked' : ''} /></td>
            <td><button class="btn btn-ghost delete-btn">🗑</button></td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="inline-form">
      <input id="new-act-name" placeholder="Nombre" />
      <select id="new-act-kind">
        ${Object.values(ACTIVITY_KIND).map((k) => `<option value="${k}">${k}</option>`).join('')}
      </select>
      <input id="new-act-color" type="color" value="#64748b" />
      <select id="new-act-parent">
        <option value="">— (raíz)</option>
        ${activities.filter((p) => !p.parent_id).map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
      <button id="add-act-btn" class="btn">Agregar</button>
    </div>
  `;

  section.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelector('.f-name').addEventListener('change', (e) => api.updateActivity(id, { name: e.target.value }));
    tr.querySelector('.f-kind').addEventListener('change', (e) => api.updateActivity(id, { kind: e.target.value }));
    tr.querySelector('.f-color').addEventListener('change', (e) => api.updateActivity(id, { color: e.target.value }));
    tr.querySelector('.f-parent').addEventListener('change', (e) => api.updateActivity(id, { parent_id: e.target.value || null }));
    tr.querySelector('.f-disabled').addEventListener('change', (e) => api.updateActivity(id, { is_disabled: e.target.checked }));
    tr.querySelector('.delete-btn').addEventListener('click', async () => {
      try {
        await api.deleteActivity(id);
        const newSection = await renderActivitiesSection(container);
        section.replaceWith(newSection);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  section.querySelector('#add-act-btn').addEventListener('click', async () => {
    const name = section.querySelector('#new-act-name').value.trim();
    if (!name) return;
    await api.createActivity({
      name,
      kind: section.querySelector('#new-act-kind').value,
      color: section.querySelector('#new-act-color').value,
      parentId: section.querySelector('#new-act-parent').value,
    });
    const newSection = await renderActivitiesSection(container);
    section.replaceWith(newSection);
  });

  return section;
}

async function renderActiveSection(container) {
  const host = container.querySelector('#config-section-host');
  host.innerHTML = '<p class="muted">Cargando…</p>';
  let sectionEl;
  if (activeSubTab === 'steps') sectionEl = await renderSteps(container);
  else if (activeSubTab === 'fields') sectionEl = await renderFields(container);
  else if (activeSubTab === 'tags') sectionEl = await renderTagsSection(container);
  else sectionEl = await renderActivitiesSection(container);
  host.innerHTML = '';
  host.appendChild(sectionEl);
}

async function rerender(container) {
  await renderActiveSection(container);
}

export async function renderConfig(container) {
  container.innerHTML = `
    <div class="tabs" id="config-subtabs">
      ${SUB_TABS.map((t) => `<button class="tab${t.id === activeSubTab ? ' tab-active' : ''}" data-subtab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="config-section-host"></div>
  `;

  container.querySelectorAll('#config-subtabs .tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      activeSubTab = btn.dataset.subtab;
      container.querySelectorAll('#config-subtabs .tab').forEach((b) => b.classList.toggle('tab-active', b === btn));
      await renderActiveSection(container);
    });
  });

  await renderActiveSection(container);
}
