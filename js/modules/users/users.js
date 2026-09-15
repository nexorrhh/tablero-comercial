// Módulo `users` (CLAUDE.md §5): administración de usuarios y equipos.

import { ROLES, ROLE_LABELS } from '../../lib/permissions.js';
import * as api from './users-data.js';

const SUB_TABS = [
  { id: 'users', label: 'Usuarios' },
  { id: 'teams', label: 'Equipos' },
];

let activeSubTab = 'users';

async function renderUsersSection(container) {
  const users = await api.loadUsers();
  const section = document.createElement('div');
  section.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Nombre</th><th>Apellido</th><th>Email</th><th>Rol</th><th>Activo</th><th></th></tr></thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr data-id="${u.id}">
            <td><input class="f-first" value="${u.first_name}" /></td>
            <td><input class="f-last" value="${u.last_name}" /></td>
            <td><input class="f-email" type="email" value="${u.email}" /></td>
            <td>
              <select class="f-role">
                ${Object.values(ROLES).map((r) => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('')}
              </select>
            </td>
            <td><input type="checkbox" class="f-active" ${u.is_active ? 'checked' : ''} /></td>
            <td><button class="btn btn-ghost delete-btn">🗑</button></td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="inline-form">
      <input id="new-user-first" placeholder="Nombre" />
      <input id="new-user-last" placeholder="Apellido" />
      <input id="new-user-email" type="email" placeholder="Email" />
      <select id="new-user-role">
        ${Object.values(ROLES).map((r) => `<option value="${r}">${ROLE_LABELS[r]}</option>`).join('')}
      </select>
      <button id="add-user-btn" class="btn">Agregar</button>
    </div>
  `;

  section.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelector('.f-first').addEventListener('change', (e) => api.updateUser(id, { first_name: e.target.value }));
    tr.querySelector('.f-last').addEventListener('change', (e) => api.updateUser(id, { last_name: e.target.value }));
    tr.querySelector('.f-email').addEventListener('change', (e) => api.updateUser(id, { email: e.target.value }));
    tr.querySelector('.f-role').addEventListener('change', (e) => api.updateUser(id, { role: e.target.value }));
    tr.querySelector('.f-active').addEventListener('change', (e) => api.updateUser(id, { is_active: e.target.checked }));
    tr.querySelector('.delete-btn').addEventListener('click', async () => {
      try {
        await api.deleteUser(id);
        const newSection = await renderUsersSection(container);
        section.replaceWith(newSection);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  section.querySelector('#add-user-btn').addEventListener('click', async () => {
    const firstName = section.querySelector('#new-user-first').value.trim();
    const lastName = section.querySelector('#new-user-last').value.trim();
    const email = section.querySelector('#new-user-email').value.trim();
    if (!firstName || !lastName) return;
    await api.createUser({ firstName, lastName, email, role: section.querySelector('#new-user-role').value });
    const newSection = await renderUsersSection(container);
    section.replaceWith(newSection);
  });

  return section;
}

async function renderTeamsSection(container, selectedTeamId = null) {
  const teams = await api.loadTeams();
  const activeTeamId = selectedTeamId ?? teams[0]?.id ?? null;
  const members = activeTeamId ? await api.loadTeamMembers(activeTeamId) : [];
  const allUsers = await api.loadUsers();
  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  const section = document.createElement('div');
  section.innerHTML = `
    <div class="config-columns">
      <div>
        <h3>Equipos</h3>
        <table class="data-table">
          <thead><tr><th>Nombre</th><th></th></tr></thead>
          <tbody>
            ${teams
              .map(
                (t) => `
              <tr data-id="${t.id}" class="${t.id === activeTeamId ? 'row-active' : ''} row-clickable">
                <td><input class="f-team-name" value="${t.name}" /></td>
                <td><button class="btn btn-ghost delete-team-btn">🗑</button></td>
              </tr>`
              )
              .join('') || '<tr><td colspan="2" class="muted">Sin equipos.</td></tr>'}
          </tbody>
        </table>
        <div class="inline-form">
          <input id="new-team-name" placeholder="Nuevo equipo" />
          <button id="add-team-btn" class="btn">Agregar</button>
        </div>
      </div>

      <div>
        <h3>Integrantes${activeTeamId ? ` — ${teams.find((t) => t.id === activeTeamId)?.name ?? ''}` : ''}</h3>
        <table class="data-table">
          <thead><tr><th>Usuario</th><th>Manager</th><th></th></tr></thead>
          <tbody>
            ${
              members
                .map(
                  (m) => `
              <tr data-id="${m.id}">
                <td>${m.user ? `${m.user.first_name} ${m.user.last_name}` : '—'}</td>
                <td><input type="checkbox" class="f-manager" ${m.is_manager ? 'checked' : ''} /></td>
                <td><button class="btn btn-ghost remove-member-btn">🗑</button></td>
              </tr>`
                )
                .join('') || '<tr><td colspan="3" class="muted">Sin integrantes.</td></tr>'
            }
          </tbody>
        </table>
        <div class="inline-form">
          <select id="new-member-user" ${activeTeamId ? '' : 'disabled'}>
            ${availableUsers.map((u) => `<option value="${u.id}">${u.first_name} ${u.last_name}</option>`).join('')}
          </select>
          <button id="add-member-btn" class="btn" ${activeTeamId ? '' : 'disabled'}>Agregar</button>
        </div>
      </div>
    </div>
  `;

  section.querySelectorAll('tr[data-id]').forEach((tr) => {
    if (!tr.querySelector('.f-team-name')) return;
    tr.addEventListener('click', async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      const newSection = await renderTeamsSection(container, tr.dataset.id);
      section.replaceWith(newSection);
    });
  });

  section.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    const teamNameInput = tr.querySelector('.f-team-name');
    if (teamNameInput) {
      teamNameInput.addEventListener('click', (e) => e.stopPropagation());
      teamNameInput.addEventListener('change', (e) => api.updateTeam(id, { name: e.target.value }));
      tr.querySelector('.delete-team-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api.deleteTeam(id);
          const newSection = await renderTeamsSection(container, null);
          section.replaceWith(newSection);
        } catch (err) {
          alert(err.message);
        }
      });
    }
    const managerCheckbox = tr.querySelector('.f-manager');
    if (managerCheckbox) {
      managerCheckbox.addEventListener('change', (e) => api.updateTeamMember(id, { is_manager: e.target.checked }));
      tr.querySelector('.remove-member-btn').addEventListener('click', async () => {
        await api.removeTeamMember(id);
        const newSection = await renderTeamsSection(container, activeTeamId);
        section.replaceWith(newSection);
      });
    }
  });

  section.querySelector('#add-team-btn').addEventListener('click', async () => {
    const input = section.querySelector('#new-team-name');
    if (!input.value.trim()) return;
    const created = await api.createTeam(input.value.trim());
    const newSection = await renderTeamsSection(container, created.id);
    section.replaceWith(newSection);
  });

  const addMemberBtn = section.querySelector('#add-member-btn');
  if (activeTeamId) {
    addMemberBtn.addEventListener('click', async () => {
      const select = section.querySelector('#new-member-user');
      if (!select.value) return;
      await api.addTeamMember(activeTeamId, select.value);
      const newSection = await renderTeamsSection(container, activeTeamId);
      section.replaceWith(newSection);
    });
  }

  return section;
}

async function renderActiveSection(container) {
  const host = container.querySelector('#users-section-host');
  host.innerHTML = '<p class="muted">Cargando…</p>';
  const sectionEl = activeSubTab === 'users' ? await renderUsersSection(container) : await renderTeamsSection(container);
  host.innerHTML = '';
  host.appendChild(sectionEl);
}

export async function renderUsersModule(container) {
  container.innerHTML = `
    <div class="tabs" id="users-subtabs">
      ${SUB_TABS.map((t) => `<button class="tab${t.id === activeSubTab ? ' tab-active' : ''}" data-subtab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="users-section-host"></div>
  `;

  container.querySelectorAll('#users-subtabs .tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      activeSubTab = btn.dataset.subtab;
      container.querySelectorAll('#users-subtabs .tab').forEach((b) => b.classList.toggle('tab-active', b === btn));
      await renderActiveSection(container);
    });
  });

  await renderActiveSection(container);
}
