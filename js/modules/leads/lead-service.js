// Reglas de negocio sobre leads que no son CRUD puro: historial de auditoría,
// sellado de closed_at, y reversión automática de standby vencido
// (CLAUDE.md §3, §4 lead_history, §6.3).
//
// El gateway se mantiene genérico (§7); estas reglas viven acá, no ahí.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, CLOSED_STATUSES, LEAD_STATUS } from '../../lib/collections.js';

// Campos auditados por defecto mientras la decisión abierta #7 (§12) no se
// resuelve: etapa, estado, monto y responsable — el mínimo que el propio
// documento da por sentado.
const TRACKED_FIELDS = ['step_id', 'status', 'amount', 'owner_id'];

export async function updateLead(leadId, patch, userId) {
  const current = await gateway.get(COLLECTIONS.LEADS, leadId);
  const nextPatch = { ...patch };

  if (patch.status && CLOSED_STATUSES.includes(patch.status) && !current.closed_at) {
    nextPatch.closed_at = new Date().toISOString();
  }
  if (patch.status && patch.status !== LEAD_STATUS.STANDBY && current.status === LEAD_STATUS.STANDBY) {
    nextPatch.remind_date = null;
    nextPatch.remind_time = null;
    nextPatch.reminder_duration = null;
    nextPatch.reminder_note = null;
  }

  const historyEntries = TRACKED_FIELDS.filter((field) => field in patch && patch[field] !== current[field]).map(
    (field) => ({
      lead_id: leadId,
      user_id: userId,
      field_changed: field,
      old_value: current[field] ?? null,
      new_value: patch[field] ?? null,
      changed_at: new Date().toISOString(),
    })
  );

  const updated = await gateway.update(COLLECTIONS.LEADS, leadId, nextPatch);
  await Promise.all(historyEntries.map((entry) => gateway.create(COLLECTIONS.LEAD_HISTORY, entry)));
  return updated;
}

export async function loadLeadHistory(leadId) {
  const [entries, users] = await Promise.all([
    gateway.list(COLLECTIONS.LEAD_HISTORY, { filter: { lead_id: leadId }, sort: { field: 'changed_at', direction: 'desc' } }),
    gateway.list(COLLECTIONS.USERS),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  return entries.map((entry) => ({
    ...entry,
    userName: usersById.get(entry.user_id) ? `${usersById.get(entry.user_id).first_name} ${usersById.get(entry.user_id).last_name}` : '—',
  }));
}

// Un lead en standby con recordatorio vencido vuelve a `todo` (CLAUDE.md §6.3).
// Se corre al arrancar la app; no hay notificaciones reales con la pestaña
// cerrada (limitación aceptada, §7).
export async function revertOverdueStandbyLeads(userId) {
  const standbyLeads = await gateway.list(COLLECTIONS.LEADS, { filter: { status: LEAD_STATUS.STANDBY } });
  const now = Date.now();
  const overdue = standbyLeads.filter((lead) => lead.remind_date && new Date(lead.remind_date).getTime() < now);
  await Promise.all(
    overdue.map((lead) =>
      updateLead(lead.id, { status: LEAD_STATUS.TODO, next_action_at: new Date().toISOString() }, userId)
    )
  );
  return overdue.length;
}
