// Carga, cómputo de progreso y conversión a lead (CLAUDE.md §4, §6.1).

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, PROSPECT_STATUS, LEAD_STATUS, CUSTOM_FIELD_PARENT_TYPE, FIELD_TYPES } from '../../lib/collections.js';
import { buildDescription } from '../parser/parser.js';

export async function loadProspectingLists() {
  const [lists, prospects, users] = await Promise.all([
    gateway.list(COLLECTIONS.PROSPECTING_LISTS),
    gateway.list(COLLECTIONS.PROSPECTS),
    gateway.list(COLLECTIONS.USERS),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));

  return lists.map((list) => {
    const items = prospects.filter((p) => p.prospecting_list_id === list.id);
    const completed = items.filter((p) => p.status !== PROSPECT_STATUS.PENDING).length;
    const owner = usersById.get(list.owner_id);
    return {
      list,
      total: items.length,
      completed,
      progressPct: items.length ? Math.round((completed / items.length) * 100) : 0,
      ownerName: owner ? `${owner.first_name} ${owner.last_name}` : '—',
    };
  });
}

export async function createProspectingList(title, ownerId) {
  return gateway.create(COLLECTIONS.PROSPECTING_LISTS, { title, owner_id: ownerId, is_archived: false });
}

export async function setListArchived(listId, isArchived) {
  return gateway.update(COLLECTIONS.PROSPECTING_LISTS, listId, { is_archived: isArchived });
}

export async function loadListDetail(listId) {
  const [list, prospects] = await Promise.all([
    gateway.get(COLLECTIONS.PROSPECTING_LISTS, listId),
    gateway.list(COLLECTIONS.PROSPECTS, { filter: { prospecting_list_id: listId } }),
  ]);
  return { list, prospects };
}

export async function addProspect(listId, { companyName, contactName, email, phone }) {
  return gateway.create(COLLECTIONS.PROSPECTS, {
    prospecting_list_id: listId,
    company_name: companyName,
    contact_name: contactName,
    email,
    phone,
    custom_values: {},
    status: PROSPECT_STATUS.PENDING,
    converted_lead_id: null,
  });
}

export async function setProspectStatus(prospectId, status) {
  return gateway.update(COLLECTIONS.PROSPECTS, prospectId, { status });
}

// Convierte un prospect en lead: crea el lead volcando los datos al bloque
// de campos de la descripción, y marca el prospect con converted_lead_id
// (CLAUDE.md §6.1, paso 4).
export async function convertProspectToLead(prospect) {
  const [pipelines, customFields] = await Promise.all([
    gateway.list(COLLECTIONS.PIPELINES, { filter: { is_default: true } }),
    gateway.list(COLLECTIONS.CUSTOM_FIELDS),
  ]);
  const defaultPipeline = pipelines[0];
  const steps = await gateway.list(COLLECTIONS.STEPS, {
    filter: { pipeline_id: defaultPipeline.id },
    sort: { field: 'position' },
  });
  const firstStep = steps[0];

  const [firstName, ...rest] = (prospect.contact_name ?? '').trim().split(/\s+/);
  const lastName = rest.join(' ');

  const description = buildDescription(
    {
      [FIELD_TYPES.FIRST_NAME]: firstName ?? '',
      [FIELD_TYPES.LAST_NAME]: lastName,
      [FIELD_TYPES.EMAIL]: prospect.email ?? '',
      [FIELD_TYPES.PHONE]: prospect.phone ?? '',
      [FIELD_TYPES.ADDRESS]: '',
    },
    '',
    customFields,
    CUSTOM_FIELD_PARENT_TYPE.LEAD
  );

  const list = await gateway.get(COLLECTIONS.PROSPECTING_LISTS, prospect.prospecting_list_id);

  const lead = await gateway.create(COLLECTIONS.LEADS, {
    title: `${prospect.company_name} - ${prospect.contact_name}`,
    step_id: firstStep.id,
    status: LEAD_STATUS.TODO,
    amount: null,
    currency: 'ARS',
    probability: 0,
    starred: false,
    next_action_at: null,
    remind_date: null,
    remind_time: null,
    reminder_duration: null,
    reminder_note: null,
    reminder_activity_id: null,
    estimated_closing_date: null,
    closed_at: null,
    description,
    owner_id: list.owner_id,
    created_by_id: list.owner_id,
    team_id: null,
    client_folder_id: null,
  });

  await gateway.update(COLLECTIONS.PROSPECTS, prospect.id, {
    status: PROSPECT_STATUS.QUALIFIED,
    converted_lead_id: lead.id,
  });

  return lead;
}
