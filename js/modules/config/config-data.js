// Módulo `config` (CLAUDE.md §5): etapas, campos, categorías/etiquetas,
// tipos de actividad. Acceso a datos + reglas de guarda mínimas (no borrar
// una etapa en uso, limpiar relaciones huérfanas al borrar una etiqueta).

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS } from '../../lib/collections.js';

// --- Etapas ----------------------------------------------------------------

export async function loadSteps() {
  const [pipeline] = await gateway.list(COLLECTIONS.PIPELINES, { filter: { is_default: true } });
  const steps = await gateway.list(COLLECTIONS.STEPS, {
    filter: { pipeline_id: pipeline.id },
    sort: { field: 'position' },
  });
  return { pipeline, steps };
}

export async function createStep(pipelineId, name) {
  const steps = await gateway.list(COLLECTIONS.STEPS, { filter: { pipeline_id: pipelineId } });
  const position = steps.length ? Math.max(...steps.map((s) => s.position)) + 1 : 0;
  return gateway.create(COLLECTIONS.STEPS, { pipeline_id: pipelineId, name, position });
}

export async function updateStep(id, patch) {
  return gateway.update(COLLECTIONS.STEPS, id, patch);
}

export async function deleteStep(id) {
  const leadsInStep = await gateway.list(COLLECTIONS.LEADS, { filter: { step_id: id } });
  if (leadsInStep.length > 0) {
    throw new Error(`No se puede borrar: hay ${leadsInStep.length} lead(s) en esta etapa.`);
  }
  return gateway.remove(COLLECTIONS.STEPS, id);
}

export async function moveStep(id, direction) {
  const steps = await gateway.list(COLLECTIONS.STEPS, { sort: { field: 'position' } });
  const index = steps.findIndex((s) => s.id === id);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= steps.length) return;
  const a = steps[index];
  const b = steps[swapIndex];
  await gateway.update(COLLECTIONS.STEPS, a.id, { position: b.position });
  await gateway.update(COLLECTIONS.STEPS, b.id, { position: a.position });
}

// --- Campos personalizados ---------------------------------------------------

export async function loadCustomFields(parentType) {
  return gateway.list(COLLECTIONS.CUSTOM_FIELDS, {
    filter: { parent_type: parentType },
    sort: { field: 'position' },
  });
}

export async function createCustomField(parentType, { name, fieldType, isKey }) {
  const fields = await gateway.list(COLLECTIONS.CUSTOM_FIELDS, { filter: { parent_type: parentType } });
  const position = fields.length ? Math.max(...fields.map((f) => f.position)) + 1 : 0;
  return gateway.create(COLLECTIONS.CUSTOM_FIELDS, { name, parent_type: parentType, field_type: fieldType, position, is_key: !!isKey });
}

export async function updateCustomField(id, patch) {
  return gateway.update(COLLECTIONS.CUSTOM_FIELDS, id, patch);
}

export async function deleteCustomField(id) {
  return gateway.remove(COLLECTIONS.CUSTOM_FIELDS, id);
}

// --- Categorías y etiquetas --------------------------------------------------

export async function loadTagCategories() {
  return gateway.list(COLLECTIONS.TAG_CATEGORIES);
}

export async function createTagCategory(name) {
  return gateway.create(COLLECTIONS.TAG_CATEGORIES, { name, is_required: false });
}

export async function updateTagCategory(id, patch) {
  return gateway.update(COLLECTIONS.TAG_CATEGORIES, id, patch);
}

export async function deleteTagCategory(id) {
  const tags = await gateway.list(COLLECTIONS.TAGS, { filter: { tag_category_id: id } });
  await Promise.all(tags.map((t) => deleteTag(t.id)));
  return gateway.remove(COLLECTIONS.TAG_CATEGORIES, id);
}

export async function loadTags(categoryId) {
  return gateway.list(COLLECTIONS.TAGS, { filter: { tag_category_id: categoryId }, sort: { field: 'position' } });
}

export async function createTag(categoryId, name) {
  const tags = await gateway.list(COLLECTIONS.TAGS, { filter: { tag_category_id: categoryId } });
  const position = tags.length ? Math.max(...tags.map((t) => t.position)) + 1 : 0;
  return gateway.create(COLLECTIONS.TAGS, { tag_category_id: categoryId, name, position });
}

export async function updateTag(id, patch) {
  return gateway.update(COLLECTIONS.TAGS, id, patch);
}

export async function deleteTag(id) {
  const leadTags = await gateway.list(COLLECTIONS.LEAD_TAGS, { filter: { tag_id: id } });
  await Promise.all(leadTags.map((lt) => gateway.remove(COLLECTIONS.LEAD_TAGS, lt.id)));
  return gateway.remove(COLLECTIONS.TAGS, id);
}

// --- Tipos de actividad -------------------------------------------------------

export async function loadActivities() {
  return gateway.list(COLLECTIONS.ACTIVITIES, { sort: { field: 'position' } });
}

export async function createActivity({ name, kind, color, parentId }) {
  const activities = await gateway.list(COLLECTIONS.ACTIVITIES);
  const position = activities.length ? Math.max(...activities.map((a) => a.position)) + 1 : 0;
  return gateway.create(COLLECTIONS.ACTIVITIES, {
    name,
    kind,
    color,
    icon: 'circle',
    parent_id: parentId || null,
    is_disabled: false,
    position,
  });
}

export async function updateActivity(id, patch) {
  return gateway.update(COLLECTIONS.ACTIVITIES, id, patch);
}

export async function deleteActivity(id) {
  const children = await gateway.list(COLLECTIONS.ACTIVITIES, { filter: { parent_id: id } });
  if (children.length > 0) {
    throw new Error('No se puede borrar: tiene actividades hijas. Borralas primero.');
  }
  return gateway.remove(COLLECTIONS.ACTIVITIES, id);
}
