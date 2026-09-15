// Módulo `users` (CLAUDE.md §4, §5): usuarios, equipos y su relación.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS } from '../../lib/collections.js';

// --- Usuarios ----------------------------------------------------------------

export async function loadUsers() {
  return gateway.list(COLLECTIONS.USERS);
}

export async function createUser({ firstName, lastName, email, role }) {
  return gateway.create(COLLECTIONS.USERS, {
    first_name: firstName,
    last_name: lastName,
    email,
    phone: '',
    mobile_phone: '',
    role,
    is_active: true,
    default_reminder_duration: 30,
  });
}

export async function updateUser(id, patch) {
  return gateway.update(COLLECTIONS.USERS, id, patch);
}

export async function deleteUser(id) {
  const [leads, teamMembers] = await Promise.all([
    gateway.list(COLLECTIONS.LEADS, { filter: { owner_id: id } }),
    gateway.list(COLLECTIONS.TEAM_MEMBERS, { filter: { user_id: id } }),
  ]);
  if (leads.length > 0) {
    throw new Error(`No se puede borrar: tiene ${leads.length} lead(s) asignado(s). Reasigná primero o desactivalo.`);
  }
  await Promise.all(teamMembers.map((tm) => gateway.remove(COLLECTIONS.TEAM_MEMBERS, tm.id)));
  return gateway.remove(COLLECTIONS.USERS, id);
}

// --- Equipos -------------------------------------------------------------------

export async function loadTeams() {
  return gateway.list(COLLECTIONS.TEAMS);
}

export async function createTeam(name) {
  return gateway.create(COLLECTIONS.TEAMS, { name });
}

export async function updateTeam(id, patch) {
  return gateway.update(COLLECTIONS.TEAMS, id, patch);
}

export async function deleteTeam(id) {
  const [leads, members] = await Promise.all([
    gateway.list(COLLECTIONS.LEADS, { filter: { team_id: id } }),
    gateway.list(COLLECTIONS.TEAM_MEMBERS, { filter: { team_id: id } }),
  ]);
  if (leads.length > 0) {
    throw new Error(`No se puede borrar: hay ${leads.length} lead(s) asignado(s) a este equipo.`);
  }
  await Promise.all(members.map((m) => gateway.remove(COLLECTIONS.TEAM_MEMBERS, m.id)));
  return gateway.remove(COLLECTIONS.TEAMS, id);
}

export async function loadTeamMembers(teamId) {
  const [members, users] = await Promise.all([
    gateway.list(COLLECTIONS.TEAM_MEMBERS, { filter: { team_id: teamId } }),
    gateway.list(COLLECTIONS.USERS),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  return members.map((m) => ({ ...m, user: usersById.get(m.user_id) }));
}

export async function addTeamMember(teamId, userId) {
  const existing = await gateway.list(COLLECTIONS.TEAM_MEMBERS, { filter: { team_id: teamId, user_id: userId } });
  if (existing.length > 0) return existing[0];
  return gateway.create(COLLECTIONS.TEAM_MEMBERS, { team_id: teamId, user_id: userId, is_manager: false });
}

export async function updateTeamMember(id, patch) {
  return gateway.update(COLLECTIONS.TEAM_MEMBERS, id, patch);
}

export async function removeTeamMember(id) {
  return gateway.remove(COLLECTIONS.TEAM_MEMBERS, id);
}
