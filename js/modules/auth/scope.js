// Alcance de datos del usuario logueado — puente entre la sesión y el
// filtro de visibilidad de leads (CLAUDE.md §8).

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS } from '../../lib/collections.js';
import { computeVisibleOwnerIds } from '../../lib/permissions.js';
import { getCurrentUser } from './session.js';

export async function getVisibleOwnerIdsForCurrentUser() {
  const user = getCurrentUser();
  if (!user) return null;
  const teamMembers = await gateway.list(COLLECTIONS.TEAM_MEMBERS);
  return computeVisibleOwnerIds(user, teamMembers);
}
