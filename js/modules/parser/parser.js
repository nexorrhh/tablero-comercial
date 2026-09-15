// Parser bidireccional del bloque "Campo: valor" dentro de description (CLAUDE.md §3).
//
// noCRM no tiene entidad contacto: los datos de la persona viven como texto
// plano al principio de `lead.description`, un separador "---" marca dónde
// empieza el texto libre, y los campos configurables (custom_fields) definen
// qué etiquetas reconoce este parser. Componente señalado en §11 como el de
// mayor riesgo — se ataca temprano y con la forma más simple que funcione.

const SEPARATOR = '---';
const FIELD_LINE_RE = /^([^:]+):(.*)$/;

function normalizeLabel(label) {
  return label.trim().toLowerCase();
}

/**
 * Divide una descripción en el bloque de campos reconocidos y el texto libre.
 *
 * @param {string} text - contenido de lead.description o client_folder.description
 * @param {Array<{name:string, field_type:string, parent_type:string, position:number}>} customFields
 * @param {string} parentType - 'lead' | 'client'
 * @returns {{
 *   byType: Record<string,string>,
 *   byLabel: Record<string,string>,
 *   freeText: string,
 *   matchedFields: Array<{field:object, value:string}>
 * }}
 */
export function parseDescription(text, customFields, parentType = 'lead') {
  const result = { byType: {}, byLabel: {}, freeText: '', matchedFields: [] };
  if (!text) return result;

  const relevantFields = customFields.filter((f) => f.parent_type === parentType);
  const byNormalizedLabel = new Map(relevantFields.map((f) => [normalizeLabel(f.name), f]));

  const lines = text.split(/\r?\n/);
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line.trim() === SEPARATOR) {
      cursor += 1; // consume el separador
      break;
    }
    const match = line.match(FIELD_LINE_RE);
    if (!match) break; // primera línea que no es "Campo: valor" corta el bloque

    const label = match[1];
    const field = byNormalizedLabel.get(normalizeLabel(label));
    if (!field) break; // etiqueta no reconocida: se asume que ahí empieza el texto libre

    const value = match[2].trim();
    result.byType[field.field_type] = value;
    result.byLabel[field.name] = value;
    result.matchedFields.push({ field, value });
    cursor += 1;
  }

  result.freeText = lines.slice(cursor).join('\n').replace(/^\n+/, '');
  return result;
}

/**
 * Reconstruye una descripción a partir de valores estructurados + texto libre.
 * Siempre emite una línea por cada custom field definido (aunque esté vacía),
 * en su posición configurada, seguida del separador y el texto libre.
 *
 * @param {Record<string,string>} fieldValuesByType - valores keyeados por field_type
 * @param {string} freeText
 * @param {Array} customFields
 * @param {string} parentType
 */
export function buildDescription(fieldValuesByType, freeText, customFields, parentType = 'lead') {
  const relevantFields = [...customFields]
    .filter((f) => f.parent_type === parentType)
    .sort((a, b) => a.position - b.position);

  const lines = relevantFields.map((field) => {
    const value = fieldValuesByType[field.field_type] ?? '';
    return `${field.name}: ${value}`;
  });

  lines.push(SEPARATOR);
  lines.push(freeText ?? '');
  return lines.join('\n');
}

/** Atajo: valor de un único field_type dentro de una descripción ya parseada. */
export function getFieldValue(parsed, fieldType) {
  return parsed.byType[fieldType] ?? '';
}

/** Nombre para mostrar: full_name si existe, si no first_name + last_name. */
export function getDisplayName(parsed) {
  const full = getFieldValue(parsed, 'full_name');
  if (full) return full;
  const first = getFieldValue(parsed, 'first_name');
  const last = getFieldValue(parsed, 'last_name');
  return [first, last].filter(Boolean).join(' ');
}
