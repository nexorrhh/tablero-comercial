// Punto de entrada. Inicializa el gateway, carga la semilla si hace falta,
// pide login local, y arma el shell con pestañas por módulo condicionadas
// por rol (CLAUDE.md §5, §7, §8).

import { gateway } from './lib/gateway.js';
import { ROLE_LABELS, canAccessConfig, canManageAssignment, applyReadOnlyMode } from './lib/permissions.js';
import { initials } from './lib/format.js';
import { buildSeed } from './seed/seed-data.js';
import { renderLeadsTable } from './modules/leads/leads.js';
import { renderPipelineKanban } from './modules/pipeline/pipeline.js';
import { renderProspecting } from './modules/prospects/prospects.js';
import { renderClients } from './modules/clients/clients.js';
import { renderConfig } from './modules/config/config.js';
import { renderReports } from './modules/reports/reports.js';
import { renderUnassignedLeads } from './modules/leads/unassigned.js';
import { renderUsersModule } from './modules/users/users.js';
import { renderLogin } from './modules/auth/login.js';
import { getCurrentUser, logout } from './modules/auth/session.js';
import { revertOverdueStandbyLeads } from './modules/leads/lead-service.js';

gateway.setSeedLoader(buildSeed);

const ALL_TABS = [
  { id: 'pipeline', label: 'Pipeline', render: renderPipelineKanban, visible: () => true },
  { id: 'leads', label: 'Leads', render: renderLeadsTable, visible: () => true },
  { id: 'unassigned', label: 'Sin asignar', render: renderUnassignedLeads, visible: (role) => canManageAssignment(role) },
  { id: 'prospects', label: 'Prospección', render: renderProspecting, visible: () => true },
  { id: 'clients', label: 'Clientes', render: renderClients, visible: () => true },
  { id: 'config', label: 'Configuración', render: renderConfig, visible: (role) => canAccessConfig(role) },
  { id: 'users', label: 'Usuarios', render: renderUsersModule, visible: (role) => canAccessConfig(role) },
  { id: 'reports', label: 'Reportes', render: renderReports, visible: () => true },
];

let activeTabId = ALL_TABS[0].id;
let readOnlyObserver = null;

function visibleTabs(role) {
  return ALL_TABS.filter((t) => t.visible(role));
}

async function renderActiveTab() {
  const container = document.getElementById('view-container');
  const tab = ALL_TABS.find((t) => t.id === activeTabId);
  await tab.render(container);
}

function renderTabs() {
  const user = getCurrentUser();
  const tabs = visibleTabs(user.role);
  const nav = document.getElementById('tabs');
  nav.innerHTML = tabs.map(
    (t) => `<button class="tab${t.id === activeTabId ? ' tab-active' : ''}" data-tab-id="${t.id}">${t.label}</button>`
  ).join('');
  nav.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      activeTabId = btn.dataset.tabId;
      renderTabs();
      await renderActiveTab();
    });
  });
}

function renderSessionPill() {
  const user = getCurrentUser();
  const pill = document.getElementById('session-pill');
  pill.innerHTML = `<span class="avatar avatar-sm">${initials(user.first_name, user.last_name)}</span> ${user.first_name} ${user.last_name} · <span class="muted small">${ROLE_LABELS[user.role] ?? user.role}</span> · <button id="logout-btn" class="btn btn-ghost nav-btn">Cerrar sesión</button>`;
  pill.querySelector('#logout-btn').addEventListener('click', () => {
    logout();
    stopReadOnlyEnforcement();
    document.getElementById('app-header').classList.add('hidden');
    showLogin();
  });
}

// El rol `lectura` no puede editar nada (CLAUDE.md §8). En vez de tocar
// cada módulo, se observa el DOM y se deshabilita todo control mutante
// cada vez que algo se re-renderiza — cubre tabs, modal de lead y las
// vistas de detalle que se re-dibujan solas (prospección, clientes).
function startReadOnlyEnforcement() {
  const enforce = () => {
    applyReadOnlyMode(document.getElementById('view-container'));
    document.querySelectorAll('.modal-overlay').forEach(applyReadOnlyMode);
  };
  readOnlyObserver = new MutationObserver(enforce);
  readOnlyObserver.observe(document.body, { childList: true, subtree: true });
  enforce();
}

function stopReadOnlyEnforcement() {
  readOnlyObserver?.disconnect();
  readOnlyObserver = null;
}

async function startAppShell() {
  const user = getCurrentUser();
  document.getElementById('app-header').classList.remove('hidden');
  activeTabId = ALL_TABS[0].id;
  renderTabs();
  renderSessionPill();
  await renderActiveTab();

  if (user.role === 'lectura') startReadOnlyEnforcement();
}

function showLogin() {
  const container = document.getElementById('view-container');
  renderLogin(container, startAppShell);
}

async function init() {
  await gateway.ensureSeeded();
  await revertOverdueStandbyLeads(null);
  showLogin();

  document.getElementById('reset-seed').addEventListener('click', async () => {
    const confirmed = confirm('Esto borra todos los datos actuales y vuelve a cargar la semilla de ejemplo. ¿Continuar?');
    if (!confirmed) return;
    await gateway.resetToSeed();
    await renderActiveTab();
  });
}

init();
