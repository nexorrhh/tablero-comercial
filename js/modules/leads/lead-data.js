// Carga y enriquecimiento de leads, compartido entre la vista de tabla y el
// kanban. Todo el acceso a datos pasa por el gateway (CLAUDE.md §7).

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS } from '../../lib/collections.js';
import { parseDescription, getDisplayName, getFieldValue } from '../parser/parser.js';

// `visibleOwnerIds`: Set de owner_id permitidos (null = sin restricción,
// CLAUDE.md §8). `includeUnassigned`: si además de esos owners hay que
// incluir los leads sin responsable (bandeja de §8).
export async function loadLeadsContext({ visibleOwnerIds = null, includeUnassigned = false } = {}) {
  const [allLeads, steps, users, customFields, tags, leadTags, pipelines] = await Promise.all([
    gateway.list(COLLECTIONS.LEADS),
    gateway.list(COLLECTIONS.STEPS, { sort: { field: 'position' } }),
    gateway.list(COLLECTIONS.USERS),
    gateway.list(COLLECTIONS.CUSTOM_FIELDS),
    gateway.list(COLLECTIONS.TAGS),
    gateway.list(COLLECTIONS.LEAD_TAGS),
    gateway.list(COLLECTIONS.PIPELINES),
  ]);

  const leads = visibleOwnerIds
    ? allLeads.filter((l) => (l.owner_id && visibleOwnerIds.has(l.owner_id)) || (includeUnassigned && !l.owner_id))
    : allLeads;

  const usersById = new Map(users.map((u) => [u.id, u]));
  const stepsById = new Map(steps.map((s) => [s.id, s]));
  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const tagIdsByLead = new Map();
  leadTags.forEach(({ lead_id, tag_id }) => {
    if (!tagIdsByLead.has(lead_id)) tagIdsByLead.set(lead_id, []);
    tagIdsByLead.get(lead_id).push(tag_id);
  });

  return { leads, steps, users, customFields, tags, usersById, stepsById, tagsById, tagIdsByLead, pipelines };
}

export function enrichLead(lead, ctx) {
  const parsed = parseDescription(lead.description, ctx.customFields, 'lead');
  const owner = ctx.usersById.get(lead.owner_id);
  const step = ctx.stepsById.get(lead.step_id);
  const tagIds = ctx.tagIdsByLead.get(lead.id) ?? [];
  const tagNames = tagIds.map((id) => ctx.tagsById.get(id)?.name).filter(Boolean);

  return {
    lead,
    contactName: getDisplayName(parsed),
    email: getFieldValue(parsed, 'email'),
    phone: getFieldValue(parsed, 'phone'),
    ownerName: owner ? `${owner.first_name} ${owner.last_name}` : '—',
    stepName: step ? step.name : '—',
    tagIds,
    tagNames,
  };
}
