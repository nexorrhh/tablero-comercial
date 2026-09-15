// Pantalla de login local (CLAUDE.md §5 `auth`). Sin contraseña real: elegir
// un usuario activo y entrar — la simulación de permisos empieza acá.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS } from '../../lib/collections.js';
import { ROLE_LABELS } from '../../lib/permissions.js';
import { initials } from '../../lib/format.js';
import { login } from './session.js';

export async function renderLogin(container, onLoggedIn) {
  const users = await gateway.list(COLLECTIONS.USERS, { filter: { is_active: true } });

  container.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <span class="logo-mark">C</span>
          <h1>CIMOMET · Gestión Comercial</h1>
        </div>
        <p class="muted">Elegí con qué usuario entrar. No hay contraseña real — es una simulación local para probar roles y permisos (CLAUDE.md §8).</p>
        <div class="login-user-list">
          ${users
            .map(
              (u) => `
            <button class="login-user-btn" data-user-id="${u.id}">
              <span class="login-user-identity">
                <span class="avatar">${initials(u.first_name, u.last_name)}</span>
                <span class="login-user-name">${u.first_name} ${u.last_name}</span>
              </span>
              <span class="badge badge-role-${u.role}">${ROLE_LABELS[u.role] ?? u.role}</span>
            </button>`
            )
            .join('')}
        </div>
        <button id="login-reset-seed" class="btn btn-ghost login-reset-btn">Reiniciar datos de ejemplo</button>
      </div>
    </div>
  `;

  container.querySelectorAll('.login-user-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const user = users.find((u) => u.id === btn.dataset.userId);
      login(user);
      onLoggedIn();
    });
  });

  container.querySelector('#login-reset-seed').addEventListener('click', async () => {
    const confirmed = confirm('Esto borra todos los datos actuales y vuelve a cargar la semilla de ejemplo. ¿Continuar?');
    if (!confirmed) return;
    await gateway.resetToSeed();
    renderLogin(container, onLoggedIn);
  });
}
