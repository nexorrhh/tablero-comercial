// Roles y permisos (CLAUDE.md §8). Simulación sobre datos locales — sirve
// para validar las reglas, no para confiar en ellas como seguridad real.

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  GERENTE: 'gerente_comercial',
  VENDEDOR: 'vendedor',
  LECTURA: 'lectura',
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Admin',
  [ROLES.GERENTE]: 'Gerente comercial',
  [ROLES.VENDEDOR]: 'Vendedor',
  [ROLES.LECTURA]: 'Lectura',
});

export function canAccessConfig(role) {
  return role === ROLES.ADMIN;
}

// Admin y gerente ven todos los leads; vendedor solo los suyos y los de su
// equipo; lectura ve todo pero sin poder editar (CLAUDE.md §8).
export function seesAllLeads(role) {
  return role === ROLES.ADMIN || role === ROLES.GERENTE || role === ROLES.LECTURA;
}

export function canManageAssignment(role) {
  return role === ROLES.ADMIN || role === ROLES.GERENTE;
}

export function canEdit(role) {
  return role !== ROLES.LECTURA;
}

// ids de usuario visibles para un vendedor: él mismo + compañeros de sus
// mismos equipos. Devuelve null si el rol ve todo (sin filtrar).
export function computeVisibleOwnerIds(user, teamMembers) {
  if (seesAllLeads(user.role)) return null;
  const myTeamIds = teamMembers.filter((tm) => tm.user_id === user.id).map((tm) => tm.team_id);
  const ids = new Set([user.id]);
  teamMembers.forEach((tm) => {
    if (myTeamIds.includes(tm.team_id)) ids.add(tm.user_id);
  });
  return ids;
}

// Deshabilita todo control interactivo dentro de root, salvo los marcados
// con la clase `nav-btn` (navegación: volver, cerrar modal, etc.). Se usa
// para el rol `lectura` — CLAUDE.md §8: "consulta y reportes, sin edición".
export function applyReadOnlyMode(root) {
  if (!root) return;
  root.querySelectorAll('input, select, textarea').forEach((el) => {
    el.disabled = true;
  });
  root.querySelectorAll('button').forEach((btn) => {
    if (!btn.classList.contains('nav-btn')) btn.disabled = true;
  });
  root.querySelectorAll('[draggable="true"]').forEach((el) => {
    el.draggable = false;
  });
}
