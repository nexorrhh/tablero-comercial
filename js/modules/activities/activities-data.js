// Módulo `activities` (CLAUDE.md §5): tipos de actividad configurables con
// jerarquía padre/hijo, registro sobre un lead, historial.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS } from '../../lib/collections.js';

// Aplana la jerarquía padre/hijo para un <select>, indentando los hijos.
export async function loadActivityTypeOptions() {
  const activities = await gateway.list(COLLECTIONS.ACTIVITIES, {
    filter: { is_disabled: false },
    sort: { field: 'position' },
  });
  const byParent = new Map();
  activities.forEach((a) => {
    const key = a.parent_id ?? 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(a);
  });

  const options = [];
  (byParent.get('root') ?? []).forEach((parent) => {
    options.push({ id: parent.id, label: parent.name, depth: 0 });
    (byParent.get(parent.id) ?? []).forEach((child) => {
      options.push({ id: child.id, label: child.name, depth: 1 });
    });
  });
  return options;
}

export async function loadActivityLog(leadId) {
  const [logs, activities, users] = await Promise.all([
    gateway.list(COLLECTIONS.ACTIVITY_LOGS, { filter: { lead_id: leadId }, sort: { field: 'logged_at', direction: 'desc' } }),
    gateway.list(COLLECTIONS.ACTIVITIES),
    gateway.list(COLLECTIONS.USERS),
  ]);
  const activitiesById = new Map(activities.map((a) => [a.id, a]));
  const usersById = new Map(users.map((u) => [u.id, u]));

  return logs.map((log) => {
    const activity = activitiesById.get(log.activity_id);
    const user = usersById.get(log.user_id);
    return {
      ...log,
      activityName: activity?.name ?? '—',
      activityColor: activity?.color ?? '#94a3b8',
      userName: user ? `${user.first_name} ${user.last_name}` : '—',
    };
  });
}

export async function logActivity(leadId, activityId, userId, note) {
  return gateway.create(COLLECTIONS.ACTIVITY_LOGS, {
    lead_id: leadId,
    activity_id: activityId,
    user_id: userId,
    logged_at: new Date().toISOString(),
    note: note ?? '',
  });
}
