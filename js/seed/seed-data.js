// Datos de arranque (CLAUDE.md §7, "Datos de arranque").
//
// Sin esto no se puede evaluar nada, sobre todo el kanban. La configuración
// específica de CIMOMET (etapas, campos, categorías) todavía no está relevada
// (§12, decisión abierta #1) — lo de acá es supuesto, tomado de la
// documentación pública de noCRM y de lo observado en la app real.
//
// Nombres de empresa ficticios a propósito (este repo es público): no son
// clientes ni prospectos reales de CIMOMET, solo datos de ejemplo con sabor
// a metalmecánica/Rosario para poder evaluar el sistema con las manos.
//
// Usuarios: solo los dos que están usando esta evaluación (ambos admin, a
// pedido). Con los dos como admin no se puede probar el alcance de
// "vendedor" (§8) — si hace falta esa prueba, conviene sumar un usuario más
// con ese rol más adelante.

import { generateId } from '../lib/uuid.js';
import {
  COLLECTIONS,
  LEAD_STATUS,
  PROSPECT_STATUS,
  FIELD_TYPES,
  CUSTOM_FIELD_PARENT_TYPE,
  ACTIVITY_KIND,
  FOLLOWUP_STATUS,
} from '../lib/collections.js';
import { buildDescription } from '../modules/parser/parser.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(n) {
  return new Date(Date.now() + n * DAY_MS).toISOString();
}

export function buildSeed() {
  // --- Usuarios y equipos -------------------------------------------------
  const userAdmin = { id: generateId(), first_name: 'Valentín', last_name: 'Angulo', email: 'valentin@cimomet.com', phone: '', mobile_phone: '341 500 1000', role: 'admin', is_active: true, default_reminder_duration: 30 };
  const userLeones = { id: generateId(), first_name: 'Juan Manuel', last_name: 'Leones', email: 'juanmanuel.leones@cimomet.com', phone: '', mobile_phone: '341 500 1001', role: 'admin', is_active: true, default_reminder_duration: 30 };
  const users = [userAdmin, userLeones];

  const team = { id: generateId(), name: 'Equipo Ventas Rosario' };
  const teams = [team];

  const teamMembers = [
    { id: generateId(), team_id: team.id, user_id: userAdmin.id, is_manager: true },
    { id: generateId(), team_id: team.id, user_id: userLeones.id, is_manager: true },
  ];

  // --- Pipeline y etapas ---------------------------------------------------
  const pipeline = { id: generateId(), name: 'Pipeline de Ventas', is_default: true, position: 0 };
  const pipelines = [pipeline];

  const stepNames = ['Por contactar', 'Contactado', 'Propuesta enviada', 'Negociación'];
  const steps = stepNames.map((name, i) => ({
    id: generateId(),
    pipeline_id: pipeline.id,
    name,
    position: i,
  }));
  const [stepPorContactar, stepContactado, stepPropuesta, stepNegociacion] = steps;

  // --- Campos configurables (definen qué reconoce el parser) ---------------
  const customFieldDefs = [
    { name: 'Firstname', field_type: FIELD_TYPES.FIRST_NAME },
    { name: 'Lastname', field_type: FIELD_TYPES.LAST_NAME },
    { name: 'Email', field_type: FIELD_TYPES.EMAIL },
    { name: 'Phone', field_type: FIELD_TYPES.PHONE },
    { name: 'Address', field_type: FIELD_TYPES.ADDRESS },
  ];
  const leadCustomFields = customFieldDefs.map((def, i) => ({
    id: generateId(),
    name: def.name,
    parent_type: CUSTOM_FIELD_PARENT_TYPE.LEAD,
    field_type: def.field_type,
    position: i,
    is_key: def.field_type === FIELD_TYPES.EMAIL,
  }));
  // Carpetas de clientes no tienen nombre/apellido de persona, solo datos de
  // contacto de la empresa — mismos tipos de campo, definición separada
  // porque custom_fields distingue parent_type (CLAUDE.md §4).
  const clientCustomFieldDefs = [
    { name: 'Email', field_type: FIELD_TYPES.EMAIL },
    { name: 'Phone', field_type: FIELD_TYPES.PHONE },
    { name: 'Address', field_type: FIELD_TYPES.ADDRESS },
  ];
  const clientCustomFields = clientCustomFieldDefs.map((def, i) => ({
    id: generateId(),
    name: def.name,
    parent_type: CUSTOM_FIELD_PARENT_TYPE.CLIENT,
    field_type: def.field_type,
    position: i,
    is_key: def.field_type === FIELD_TYPES.EMAIL,
  }));
  const customFields = [...leadCustomFields, ...clientCustomFields];

  // --- Categorías de etiquetas y etiquetas ---------------------------------
  const catOrigen = { id: generateId(), name: 'Origen', is_required: false };
  const catRubro = { id: generateId(), name: 'Rubro', is_required: false };
  const tagCategories = [catOrigen, catRubro];

  const tagReferido = { id: generateId(), tag_category_id: catOrigen.id, name: 'Referido', position: 0 };
  const tagWeb = { id: generateId(), tag_category_id: catOrigen.id, name: 'Web', position: 1 };
  const tagFeria = { id: generateId(), tag_category_id: catOrigen.id, name: 'Feria', position: 2 };
  const tagOilGas = { id: generateId(), tag_category_id: catRubro.id, name: 'Oil & Gas', position: 0 };
  const tagIndustria = { id: generateId(), tag_category_id: catRubro.id, name: 'Industria', position: 1 };
  const tagConstruccion = { id: generateId(), tag_category_id: catRubro.id, name: 'Construcción', position: 2 };
  const tags = [tagReferido, tagWeb, tagFeria, tagOilGas, tagIndustria, tagConstruccion];

  // --- Tipos de actividad (con jerarquía padre/hijo) -----------------------
  const actLlamada = { id: generateId(), name: 'Llamada', kind: ACTIVITY_KIND.CALL, icon: 'phone', color: '#64748b', parent_id: null, is_disabled: false, position: 0 };
  const actLlamadaAtendida = { id: generateId(), name: 'Atendida', kind: ACTIVITY_KIND.CALL, icon: 'phone', color: '#16a34a', parent_id: actLlamada.id, is_disabled: false, position: 0 };
  const actLlamadaNoAtendida = { id: generateId(), name: 'No atendida', kind: ACTIVITY_KIND.CALL, icon: 'phone', color: '#dc2626', parent_id: actLlamada.id, is_disabled: false, position: 1 };
  const actEmail = { id: generateId(), name: 'Email', kind: ACTIVITY_KIND.EMAIL, icon: 'mail', color: '#2563eb', parent_id: null, is_disabled: false, position: 1 };
  const actReunion = { id: generateId(), name: 'Reunión', kind: ACTIVITY_KIND.MEETING, icon: 'users', color: '#7c3aed', parent_id: null, is_disabled: false, position: 2 };
  const activities = [actLlamada, actLlamadaAtendida, actLlamadaNoAtendida, actEmail, actReunion];

  // --- Carpetas de clientes -------------------------------------------------
  const clientFolders = [
    {
      id: generateId(),
      name: 'Acerplata',
      description: buildDescription(
        { [FIELD_TYPES.EMAIL]: 'contacto@acerplata.com.ar', [FIELD_TYPES.PHONE]: '341 400 2000', [FIELD_TYPES.ADDRESS]: 'Parque Industrial, Rosario' },
        'Cliente histórico, obras de mantenimiento industrial.',
        customFields,
        CUSTOM_FIELD_PARENT_TYPE.CLIENT
      ),
      is_active: true,
      owner_id: userAdmin.id,
    },
    {
      id: generateId(),
      name: 'Norsider',
      description: buildDescription(
        { [FIELD_TYPES.EMAIL]: 'compras@norsider.com.ar', [FIELD_TYPES.PHONE]: '341 400 3000', [FIELD_TYPES.ADDRESS]: 'Zona Norte, Rosario' },
        '',
        customFields,
        CUSTOM_FIELD_PARENT_TYPE.CLIENT
      ),
      is_active: true,
      owner_id: userLeones.id,
    },
  ];

  // --- Leads ------------------------------------------------------------
  // title: "CLIENTE - Contacto - Proyecto" (convención informal, CLAUDE.md §3)
  function makeLead({
    title,
    step,
    status = LEAD_STATUS.TODO,
    amount = null,
    probability = 0,
    starred = false,
    owner,
    contact,
    freeText = '',
    nextActionInDays = null,
    remindInDays = null,
    closedInDays = null,
    clientFolderId = null,
    tagIds = [],
    followupStatus = FOLLOWUP_STATUS.PENDING,
  }) {
    const description = buildDescription(
      {
        [FIELD_TYPES.FIRST_NAME]: contact?.firstName ?? '',
        [FIELD_TYPES.LAST_NAME]: contact?.lastName ?? '',
        [FIELD_TYPES.EMAIL]: contact?.email ?? '',
        [FIELD_TYPES.PHONE]: contact?.phone ?? '',
        [FIELD_TYPES.ADDRESS]: contact?.address ?? '',
      },
      freeText,
      customFields,
      CUSTOM_FIELD_PARENT_TYPE.LEAD
    );

    const closed = status === LEAD_STATUS.WON || status === LEAD_STATUS.LOST || status === LEAD_STATUS.CANCELLED;

    return {
      id: generateId(),
      title,
      step_id: step.id,
      status,
      amount,
      currency: 'ARS',
      probability,
      starred,
      next_action_at: nextActionInDays !== null ? daysFromNow(nextActionInDays) : null,
      remind_date: remindInDays !== null ? daysFromNow(remindInDays) : null,
      remind_time: remindInDays !== null ? '09:00' : null,
      reminder_duration: remindInDays !== null ? 30 : null,
      reminder_note: remindInDays !== null ? 'Retomar contacto' : null,
      reminder_activity_id: null,
      estimated_closing_date: !closed ? daysFromNow(20) : null,
      closed_at: closedInDays !== null ? daysFromNow(closedInDays) : null,
      description,
      owner_id: owner ? owner.id : null,
      created_by_id: owner ? owner.id : userAdmin.id,
      team_id: owner ? team.id : null,
      client_folder_id: clientFolderId,
      followup_status: followupStatus, // módulo `home` — CLAUDE.md §10
      _tagIds: tagIds, // se vuelca a lead_tags más abajo
    };
  }

  const leadDefs = [
    makeLead({ title: 'Acerplata - Balduzzi - Tanque de aceite', step: stepPorContactar, status: LEAD_STATUS.TODO, owner: userAdmin, nextActionInDays: -2, starred: true, tagIds: [tagOilGas.id, tagReferido.id], contact: { firstName: 'Natalia', lastName: 'Bawer', email: 'natalia.bawer@acerplata.com.ar', phone: '801 274 6798', address: '1234 N 7864 W - Salt Lake City, UT' }, freeText: 'Conocí a Natalia en un seminario. Podría estar interesada.', clientFolderId: clientFolders[0].id, followupStatus: FOLLOWUP_STATUS.IN_PROGRESS }),
    makeLead({ title: 'Norsider - Pizzano, Fernando - Torres de comunicación', step: stepPorContactar, status: LEAD_STATUS.TODO, owner: userLeones, nextActionInDays: -1, tagIds: [tagIndustria.id], contact: { firstName: 'Fernando', lastName: 'Pizzano', email: 'fpizzano@norsider.com.ar', phone: '341 611 2233' }, clientFolderId: clientFolders[1].id, followupStatus: FOLLOWUP_STATUS.IN_PROGRESS }),
    makeLead({ title: 'Paraná Construcciones - Pablo Rascon - Pórticos y monovías', step: stepPorContactar, status: LEAD_STATUS.TODO, owner: userAdmin, nextActionInDays: 1, tagIds: [tagConstruccion.id], contact: { firstName: 'Pablo', lastName: 'Rascón', email: 'p.rascon@paranaconstrucciones.com.ar', phone: '341 622 4455' } }),
    makeLead({ title: 'Combustibles Sur - Gómez, Laura - Estructura para planta', step: stepPorContactar, status: LEAD_STATUS.STANDBY, owner: userLeones, remindInDays: 13, tagIds: [tagOilGas.id, tagFeria.id], contact: { firstName: 'Laura', lastName: 'Gómez', email: 'lgomez@combustiblessur.com', phone: '341 633 5566' }, followupStatus: FOLLOWUP_STATUS.RESOLVED }),
    makeLead({ title: 'Siderplata - Suárez, Martín - Cañería industrial', step: stepPorContactar, status: LEAD_STATUS.WON, owner: userAdmin, amount: 4200000, probability: 100, closedInDays: -3, contact: { firstName: 'Martín', lastName: 'Suárez', email: 'msuarez@siderplata.com' } }),

    makeLead({ title: 'Molino Central - Perez, Diego - Silo metálico', step: stepContactado, status: LEAD_STATUS.TODO, owner: userAdmin, nextActionInDays: -1, amount: 1800000, probability: 30, tagIds: [tagIndustria.id], contact: { firstName: 'Diego', lastName: 'Perez', email: 'dperez@molinocentral.com.ar', phone: '341 644 7788' } }),
    makeLead({ title: 'Dulces del Plata - Fontana, Sol - Cinta transportadora', step: stepContactado, status: LEAD_STATUS.TODO, owner: userLeones, nextActionInDays: 0, amount: 950000, probability: 30, starred: true, contact: { firstName: 'Sol', lastName: 'Fontana', email: 'sfontana@dulcesdelplata.com' }, followupStatus: FOLLOWUP_STATUS.IN_PROGRESS }),
    makeLead({ title: 'Agroindustrial Paraná - Ríos, Hugo - Plataforma de acceso', step: stepContactado, status: LEAD_STATUS.STANDBY, owner: userAdmin, remindInDays: 5, amount: 620000, probability: 30, contact: { firstName: 'Hugo', lastName: 'Ríos', email: 'hrios@agroparana.com.ar' } }),
    makeLead({ title: 'Cerealera Rosario - Alonso, Carla - Tanque pulmón', step: stepContactado, status: LEAD_STATUS.LOST, owner: userLeones, amount: 1100000, closedInDays: -7, contact: { firstName: 'Carla', lastName: 'Alonso', email: 'calonso@cerealerarosario.com.ar' }, followupStatus: FOLLOWUP_STATUS.RESOLVED }),
    makeLead({ title: 'Acerplata - Domínguez, Iván - Escalera industrial', step: stepContactado, status: LEAD_STATUS.TODO, owner: userAdmin, nextActionInDays: 3, amount: 340000, probability: 30, clientFolderId: clientFolders[0].id, contact: { firstName: 'Iván', lastName: 'Domínguez', email: 'idominguez@acerplata.com.ar' }, followupStatus: FOLLOWUP_STATUS.IN_PROGRESS }),

    makeLead({ title: 'Graneles del Litoral - Medina, Roxana - Estructura de acopio', step: stepPropuesta, status: LEAD_STATUS.TODO, owner: userLeones, nextActionInDays: -4, amount: 2600000, probability: 50, starred: true, tagIds: [tagOilGas.id], contact: { firstName: 'Roxana', lastName: 'Medina', email: 'rmedina@granoslitoral.com' } }),
    makeLead({ title: 'Norsider - Castro, Emiliano - Gasoducto ramal sur', step: stepPropuesta, status: LEAD_STATUS.TODO, owner: userAdmin, nextActionInDays: 2, amount: 5200000, probability: 50, clientFolderId: clientFolders[1].id, contact: { firstName: 'Emiliano', lastName: 'Castro', email: 'ecastro@norsider.com.ar' } }),
    makeLead({ title: 'Paraná Construcciones - Nuñez, Patricia - Pasarela peatonal', step: stepPropuesta, status: LEAD_STATUS.STANDBY, owner: userLeones, remindInDays: 8, amount: 780000, probability: 50, contact: { firstName: 'Patricia', lastName: 'Nuñez', email: 'pnunez@paranaconstrucciones.com.ar' } }),
    makeLead({ title: 'Siderplata - Bianchi, Rodrigo - Soporte de cañerías', step: stepPropuesta, status: LEAD_STATUS.WON, owner: userAdmin, amount: 3100000, probability: 100, closedInDays: -1, contact: { firstName: 'Rodrigo', lastName: 'Bianchi', email: 'rbianchi@siderplata.com' } }),
    makeLead({ title: 'Molino Central - Vega, Sabrina - Tolva de descarga', step: stepPropuesta, status: LEAD_STATUS.CANCELLED, owner: userLeones, amount: 450000, closedInDays: -10, contact: { firstName: 'Sabrina', lastName: 'Vega', email: 'svega@molinocentral.com.ar' } }),

    makeLead({ title: 'Combustibles Sur - Herrera, Gastón - Skid de bombeo', step: stepNegociacion, status: LEAD_STATUS.TODO, owner: userAdmin, nextActionInDays: -1, amount: 8900000, probability: 70, starred: true, tagIds: [tagOilGas.id], contact: { firstName: 'Gastón', lastName: 'Herrera', email: 'gherrera@combustiblessur.com' } }),
    makeLead({ title: 'Agroindustrial Paraná - Ojeda, Marina - Planta de silos', step: stepNegociacion, status: LEAD_STATUS.TODO, owner: userLeones, nextActionInDays: 1, amount: 6300000, probability: 70, contact: { firstName: 'Marina', lastName: 'Ojeda', email: 'mojeda@agroparana.com.ar' } }),
    makeLead({ title: 'Graneles del Litoral - Paz, Federico - Ampliación de puerto', step: stepNegociacion, status: LEAD_STATUS.STANDBY, owner: userAdmin, remindInDays: 20, amount: 12000000, probability: 70, contact: { firstName: 'Federico', lastName: 'Paz', email: 'fpaz@granoslitoral.com' } }),
    makeLead({ title: 'Cerealera Rosario - Correa, Yamila - Cinta de embarque', step: stepNegociacion, status: LEAD_STATUS.WON, owner: userLeones, amount: 4700000, probability: 100, closedInDays: -5, contact: { firstName: 'Yamila', lastName: 'Correa', email: 'ycorrea@cerealerarosario.com.ar' } }),
    makeLead({ title: 'Dulces del Plata - Leiva, Damián - Depósito metálico', step: stepNegociacion, status: LEAD_STATUS.LOST, owner: userAdmin, amount: 2100000, closedInDays: -15, contact: { firstName: 'Damián', lastName: 'Leiva', email: 'dleiva@dulcesdelplata.com' } }),

    // Sin asignar — bandeja separada de §8, todavía sin responsable.
    makeLead({ title: 'Cementera del Sur - contacto sin definir - Silo de cemento', step: stepPorContactar, status: LEAD_STATUS.TODO, owner: null, contact: { firstName: 'Ricardo', lastName: 'Funes', email: 'rfunes@cementeradelsur.com.ar' } }),
    makeLead({ title: 'Aceros Plata - contacto sin definir - Pasarela', step: stepPorContactar, status: LEAD_STATUS.TODO, owner: null, contact: { firstName: 'Marisa', lastName: 'Otero', email: 'motero@acerosplata.com' } }),
  ];

  const leadTags = [];
  const leads = leadDefs.map(({ _tagIds, ...lead }) => {
    _tagIds.forEach((tagId) => {
      leadTags.push({ id: generateId(), lead_id: lead.id, tag_id: tagId });
    });
    return lead;
  });

  // --- Prospección ----------------------------------------------------------
  const prospectingList = {
    id: generateId(),
    title: 'Prospección Objetivos de Oil & Gas',
    owner_id: userLeones.id,
    is_archived: false,
  };
  const prospectingLists = [prospectingList];

  const prospects = [
    { id: generateId(), prospecting_list_id: prospectingList.id, company_name: 'Petroquímica del Litoral', contact_name: 'Andrea Molina', email: 'amolina@petrolitoral.com', phone: '341 500 9911', custom_values: {}, status: PROSPECT_STATUS.PENDING, converted_lead_id: null },
    { id: generateId(), prospecting_list_id: prospectingList.id, company_name: 'Refinería del Norte', contact_name: 'Sergio Quiroga', email: 'squiroga@refinorte.com', phone: '341 500 9922', custom_values: {}, status: PROSPECT_STATUS.QUALIFIED, converted_lead_id: null },
    { id: generateId(), prospecting_list_id: prospectingList.id, company_name: 'Petrotec SA', contact_name: 'Bruno Aguirre', email: 'baguirre@petrotec.com', phone: '341 500 9933', custom_values: {}, status: PROSPECT_STATUS.DISCARDED, converted_lead_id: null },
  ];

  // --- Módulo Home: seguimiento por comprador (adelanto de Fase 3, CLAUDE.md §10) ---
  // buyer_key = primer segmento del título del lead ("CLIENTE - Contacto - Proyecto").
  const buyerEvents = [
    { id: generateId(), buyer_key: 'Acerplata', scheduled_at: daysFromNow(5), note: 'Retomar para cerrar alcance del tanque y confirmar fecha de escalera.', is_done: false, created_by_id: userAdmin.id, related_lead_id: null },
    { id: generateId(), buyer_key: 'Acerplata', scheduled_at: daysFromNow(-6), note: 'Primer contacto: se lo tanteó, pidió tiempo para evaluar presupuesto.', is_done: true, created_by_id: userAdmin.id, related_lead_id: null },
    { id: generateId(), buyer_key: 'Norsider', scheduled_at: daysFromNow(2), note: 'Fernando dijo que la torre depende de aprobación interna, llamar para confirmar.', is_done: false, created_by_id: userLeones.id, related_lead_id: null },
    { id: generateId(), buyer_key: 'Dulces del Plata', scheduled_at: daysFromNow(0), note: 'Coordinar con Sol el detalle técnico de la cinta antes de mandar precio final.', is_done: false, created_by_id: userLeones.id, related_lead_id: null },
    { id: generateId(), buyer_key: 'Combustibles Sur', scheduled_at: daysFromNow(-3), note: 'Llamada de cierre: Laura confirmó que no avanzan por ahora.', is_done: true, created_by_id: userLeones.id, related_lead_id: null },
    { id: generateId(), buyer_key: 'Cerealera Rosario', scheduled_at: daysFromNow(-8), note: 'Llamada de cierre con Carla: quedó perdido, prefirieron otro proveedor.', is_done: true, created_by_id: userLeones.id, related_lead_id: null },
  ];

  const buyerNotes = [
    { id: generateId(), buyer_key: 'Acerplata', user_id: userAdmin.id, note: 'Primer contacto con Natalia: la conocí en un seminario, quedó en pensarlo.', related_lead_id: null, created_at: daysFromNow(-9) },
    { id: generateId(), buyer_key: 'Acerplata', user_id: userAdmin.id, note: 'La llamé, la tanteé sobre el tanque de aceite. Coordinamos nueva llamada en 5 días. De paso surgió la escalera industrial con Iván Domínguez, mismo cliente.', related_lead_id: null, created_at: daysFromNow(-6) },
    { id: generateId(), buyer_key: 'Norsider', user_id: userLeones.id, note: 'Fernando comentó que además de las torres están mirando un gasoducto ramal sur — dos proyectos en danza con el mismo comprador.', related_lead_id: null, created_at: daysFromNow(-1) },
    { id: generateId(), buyer_key: 'Dulces del Plata', user_id: userLeones.id, note: 'Definición: Sol pidió specs técnicas antes de avanzar. Le mandamos ficha técnica y quedamos en hablar hoy.', related_lead_id: null, created_at: daysFromNow(0) },
    { id: generateId(), buyer_key: 'Combustibles Sur', user_id: userLeones.id, note: 'Cierre: Laura confirmó que por ahora no avanzan con la estructura para planta.', related_lead_id: null, created_at: daysFromNow(-3) },
    { id: generateId(), buyer_key: 'Cerealera Rosario', user_id: userLeones.id, note: 'Cierre: se lo llevó otro proveedor, quedó perdido.', related_lead_id: null, created_at: daysFromNow(-8) },
  ];

  return {
    [COLLECTIONS.USERS]: users,
    [COLLECTIONS.TEAMS]: teams,
    [COLLECTIONS.TEAM_MEMBERS]: teamMembers,
    [COLLECTIONS.PIPELINES]: pipelines,
    [COLLECTIONS.STEPS]: steps,
    [COLLECTIONS.CUSTOM_FIELDS]: customFields,
    [COLLECTIONS.TAG_CATEGORIES]: tagCategories,
    [COLLECTIONS.TAGS]: tags,
    [COLLECTIONS.LEAD_TAGS]: leadTags,
    [COLLECTIONS.ACTIVITIES]: activities,
    [COLLECTIONS.ACTIVITY_LOGS]: [],
    [COLLECTIONS.CLIENT_FOLDERS]: clientFolders,
    [COLLECTIONS.LEADS]: leads,
    [COLLECTIONS.PROSPECTING_LISTS]: prospectingLists,
    [COLLECTIONS.PROSPECTS]: prospects,
    [COLLECTIONS.COMMENTS]: [],
    [COLLECTIONS.ATTACHMENTS]: [],
    [COLLECTIONS.LEAD_HISTORY]: [],
    [COLLECTIONS.BUYER_EVENTS]: buyerEvents,
    [COLLECTIONS.BUYER_NOTES]: buyerNotes,
  };
}
