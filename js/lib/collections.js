// Nombres de colecciones y enums del dominio (CLAUDE.md §4).
// Única fuente de verdad para estos valores — los módulos no los redefinen.

export const COLLECTIONS = Object.freeze({
  PIPELINES: 'pipelines',
  STEPS: 'steps',
  LEADS: 'leads',
  CLIENT_FOLDERS: 'client_folders',
  PROSPECTING_LISTS: 'prospecting_lists',
  PROSPECTS: 'prospects',
  CUSTOM_FIELDS: 'custom_fields',
  TAG_CATEGORIES: 'tag_categories',
  TAGS: 'tags',
  LEAD_TAGS: 'lead_tags',
  ACTIVITIES: 'activities',
  ACTIVITY_LOGS: 'activity_logs',
  COMMENTS: 'comments',
  ATTACHMENTS: 'attachments',
  LEAD_HISTORY: 'lead_history',
  USERS: 'users',
  TEAMS: 'teams',
  TEAM_MEMBERS: 'team_members',
  // Módulo `home` — seguimiento de proyectos/presupuestos por comprador.
  // Adelanto puntual de Fase 3 (CLAUDE.md §10), fuera del modelo de noCRM.
  BUYER_EVENTS: 'buyer_events',
  BUYER_NOTES: 'buyer_notes',
});

// Estado operativo del lead — eje independiente de la etapa (CLAUDE.md §3).
export const LEAD_STATUS = Object.freeze({
  TODO: 'todo',
  STANDBY: 'standby',
  WON: 'won',
  LOST: 'lost',
  CANCELLED: 'cancelled',
});

export const LEAD_STATUS_LABELS = Object.freeze({
  [LEAD_STATUS.TODO]: 'Por hacer',
  [LEAD_STATUS.STANDBY]: 'En espera',
  [LEAD_STATUS.WON]: 'Ganado',
  [LEAD_STATUS.LOST]: 'Perdido',
  [LEAD_STATUS.CANCELLED]: 'Anulado',
});

// Estados que cierran el lead (sellan closed_at).
export const CLOSED_STATUSES = Object.freeze([
  LEAD_STATUS.WON,
  LEAD_STATUS.LOST,
  LEAD_STATUS.CANCELLED,
]);

export const PROSPECT_STATUS = Object.freeze({
  PENDING: 'pending',
  QUALIFIED: 'qualified',
  DISCARDED: 'discarded',
});

// Tipos de campo que reconoce el parser de descripciones (CLAUDE.md §3, §4).
export const FIELD_TYPES = Object.freeze({
  UNSET: 'unset',
  EMAIL: 'email',
  PHONE: 'phone',
  MOBILE: 'mobile',
  ADDRESS: 'address',
  WEB: 'web',
  FIRST_NAME: 'first_name',
  LAST_NAME: 'last_name',
  FULL_NAME: 'full_name',
  JOB: 'job',
  FAX: 'fax',
  VAT: 'vat',
  CITY: 'city',
  ZIPCODE: 'zipcode',
  STATE: 'state',
  COUNTRY: 'country',
  COMPANY_ID: 'company_id',
});

export const CUSTOM_FIELD_PARENT_TYPE = Object.freeze({
  LEAD: 'lead',
  CLIENT: 'client',
});

export const ACTIVITY_KIND = Object.freeze({
  CALL: 'call',
  EMAIL: 'email',
  MEETING: 'meeting',
});

export const COMMENT_PARENT_TYPE = Object.freeze({
  LEAD: 'lead',
  PROSPECT: 'prospect',
  PROSPECTING_LIST: 'prospecting_list',
});

// Seguimiento comercial post-presupuesto, eje independiente de step/status
// del lead — vive solo en el módulo `home` (adelanto de Fase 3, CLAUDE.md §10).
export const FOLLOWUP_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
});

export const FOLLOWUP_STATUS_LABELS = Object.freeze({
  [FOLLOWUP_STATUS.PENDING]: 'Pendiente',
  [FOLLOWUP_STATUS.IN_PROGRESS]: 'Gestión',
  [FOLLOWUP_STATUS.RESOLVED]: 'Resuelto',
});
