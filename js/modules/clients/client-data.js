// Módulo `clients` (CLAUDE.md §4, §5): carpetas de clientes.

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, CUSTOM_FIELD_PARENT_TYPE } from '../../lib/collections.js';
import { parseDescription, buildDescription, getFieldValue } from '../parser/parser.js';

export async function loadClientFolders() {
  const [folders, users, leads] = await Promise.all([
    gateway.list(COLLECTIONS.CLIENT_FOLDERS),
    gateway.list(COLLECTIONS.USERS),
    gateway.list(COLLECTIONS.LEADS),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));

  return folders.map((folder) => {
    const folderLeads = leads.filter((l) => l.client_folder_id === folder.id);
    const owner = usersById.get(folder.owner_id);
    return {
      folder,
      ownerName: owner ? `${owner.first_name} ${owner.last_name}` : '—',
      leadCount: folderLeads.length,
      totalAmount: folderLeads.reduce((sum, l) => sum + (l.amount ?? 0), 0),
    };
  });
}

export async function loadClientFolderDetail(folderId) {
  const [folder, customFields, leads, users] = await Promise.all([
    gateway.get(COLLECTIONS.CLIENT_FOLDERS, folderId),
    gateway.list(COLLECTIONS.CUSTOM_FIELDS),
    gateway.list(COLLECTIONS.LEADS, { filter: { client_folder_id: folderId } }),
    gateway.list(COLLECTIONS.USERS),
  ]);
  const parsed = parseDescription(folder.description, customFields, CUSTOM_FIELD_PARENT_TYPE.CLIENT);
  const usersById = new Map(users.map((u) => [u.id, u]));

  return {
    folder,
    customFields,
    parsed,
    email: getFieldValue(parsed, 'email'),
    phone: getFieldValue(parsed, 'phone'),
    address: getFieldValue(parsed, 'address'),
    leads: leads.map((l) => ({ ...l, ownerName: usersById.get(l.owner_id) ? `${usersById.get(l.owner_id).first_name} ${usersById.get(l.owner_id).last_name}` : '—' })),
  };
}

export async function createClientFolder({ name, ownerId }) {
  return gateway.create(COLLECTIONS.CLIENT_FOLDERS, {
    name,
    description: '---\n',
    is_active: true,
    owner_id: ownerId,
  });
}

export async function updateClientFolder(folderId, patch) {
  return gateway.update(COLLECTIONS.CLIENT_FOLDERS, folderId, patch);
}

export function buildClientDescription(fieldValuesByType, freeText, customFields) {
  return buildDescription(fieldValuesByType, freeText, customFields, CUSTOM_FIELD_PARENT_TYPE.CLIENT);
}
