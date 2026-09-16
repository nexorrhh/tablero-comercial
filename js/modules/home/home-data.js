// Módulo `home`: seguimiento de proyectos/presupuestos agrupados por
// comprador, con calendario de próximos contactos e historial de paneos.
//
// No es parte del modelo de noCRM — es un adelanto puntual de la Fase 3
// (CLAUDE.md §10, "Cotizaciones como módulo propio") pedido antes de tiempo.
// Reutiliza `leads` como "proyectos" en vez de crear una entidad `quotes`
// nueva, para no anticipar un modelo que todavía no está definido.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, FOLLOWUP_STATUS } from '../../lib/collections.js';
import { loadLeadsContext, enrichLead } from '../leads/lead-data.js';

// El "comprador" es la empresa cliente, tomada del primer segmento del
// título del lead (convención "CLIENTE - Contacto - Proyecto", CLAUDE.md §3).
// Agrupar así, en vez de por client_folder_id, funciona incluso para leads
// que todavía no tienen carpeta de cliente asociada.
export function buyerKeyOf(lead) {
  return lead.title.split(' - ')[0].trim();
}

export async function loadFollowupBoard() {
  const ctx = await loadLeadsContext();
  const rows = ctx.leads.map((lead) => enrichLead(lead, ctx));
  const board = { [FOLLOWUP_STATUS.PENDING]: [], [FOLLOWUP_STATUS.IN_PROGRESS]: [], [FOLLOWUP_STATUS.RESOLVED]: [] };
  rows.forEach((row) => {
    const status = row.lead.followup_status ?? FOLLOWUP_STATUS.PENDING;
    (board[status] ?? board[FOLLOWUP_STATUS.PENDING]).push(row);
  });
  return board;
}

function withUserNames(items, usersById) {
  return items.map((item) => ({
    ...item,
    userName: usersById.get(item.user_id ?? item.created_by_id)
      ? `${usersById.get(item.user_id ?? item.created_by_id).first_name} ${usersById.get(item.user_id ?? item.created_by_id).last_name}`
      : '—',
  }));
}

export async function loadBuyerContext(buyerKey) {
  const ctx = await loadLeadsContext();
  const leads = ctx.leads.map((lead) => enrichLead(lead, ctx)).filter((row) => buyerKeyOf(row.lead) === buyerKey);

  const [notes, events, users] = await Promise.all([
    gateway.list(COLLECTIONS.BUYER_NOTES, { filter: { buyer_key: buyerKey }, sort: { field: 'created_at', direction: 'desc' } }),
    gateway.list(COLLECTIONS.BUYER_EVENTS, { filter: { buyer_key: buyerKey }, sort: { field: 'scheduled_at', direction: 'asc' } }),
    gateway.list(COLLECTIONS.USERS),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));

  return {
    buyerKey,
    leads,
    notes: withUserNames(notes, usersById),
    events: withUserNames(events, usersById),
  };
}

// Primera definición de un proyecto: sale de Pendiente, entra en Gestión.
// Deja una nota y, si hay fecha, un evento de calendario — ambos a nivel
// comprador, no solo del proyecto (CLAUDE.md §10: "traer todos los proyectos").
export async function defineFollowup(leadId, { note, nextDate, userId }) {
  const lead = await gateway.get(COLLECTIONS.LEADS, leadId);
  const buyerKey = buyerKeyOf(lead);
  await gateway.update(COLLECTIONS.LEADS, leadId, { followup_status: FOLLOWUP_STATUS.IN_PROGRESS });
  await gateway.create(COLLECTIONS.BUYER_NOTES, { buyer_key: buyerKey, user_id: userId, note, related_lead_id: leadId });
  if (nextDate) {
    await gateway.create(COLLECTIONS.BUYER_EVENTS, { buyer_key: buyerKey, scheduled_at: nextDate, note, is_done: false, created_by_id: userId, related_lead_id: leadId });
  }
}

// Nuevo paneo sobre un comprador ya en gestión (no necesariamente ligado a
// un solo proyecto): registra la charla y, opcionalmente, agenda la próxima.
export async function logBuyerFollowup(buyerKey, { note, nextDate, userId, eventIdToComplete }) {
  await gateway.create(COLLECTIONS.BUYER_NOTES, { buyer_key: buyerKey, user_id: userId, note, related_lead_id: null });
  if (eventIdToComplete) {
    await gateway.update(COLLECTIONS.BUYER_EVENTS, eventIdToComplete, { is_done: true });
  }
  if (nextDate) {
    await gateway.create(COLLECTIONS.BUYER_EVENTS, { buyer_key: buyerKey, scheduled_at: nextDate, note, is_done: false, created_by_id: userId, related_lead_id: null });
  }
}

export async function resolveLead(leadId, { note, userId }) {
  const lead = await gateway.get(COLLECTIONS.LEADS, leadId);
  const buyerKey = buyerKeyOf(lead);
  await gateway.update(COLLECTIONS.LEADS, leadId, { followup_status: FOLLOWUP_STATUS.RESOLVED });
  if (note) {
    await gateway.create(COLLECTIONS.BUYER_NOTES, { buyer_key: buyerKey, user_id: userId, note, related_lead_id: leadId });
  }
}

export async function loadCalendarEvents() {
  const [events, users] = await Promise.all([
    gateway.list(COLLECTIONS.BUYER_EVENTS),
    gateway.list(COLLECTIONS.USERS),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  return withUserNames(events, usersById);
}
