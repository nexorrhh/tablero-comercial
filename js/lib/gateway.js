// Gateway de datos único (CLAUDE.md §7).
//
// Regla dura: ningún módulo accede a localStorage directamente. Todo pasa por
// esta capa. Cuando en Fase 2 se elija la persistencia definitiva, se escribe
// un adaptador nuevo detrás de esta misma interfaz y no se toca ni un módulo.
//
// Es async (devuelve promesas) aunque localStorage sea síncrono, para que
// conectar un backend real el día de mañana no obligue a reescribir llamadas.

import { generateId } from './uuid.js';

const STORAGE_PREFIX = 'cimomet:';
const SEED_FLAG_KEY = `${STORAGE_PREFIX}__seeded`;

let seedLoader = null; // se inyecta con setSeedLoader para evitar dependencia circular

function storageKey(collection) {
  return `${STORAGE_PREFIX}${collection}`;
}

function readCollection(collection) {
  const raw = localStorage.getItem(storageKey(collection));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeCollection(collection, items) {
  localStorage.setItem(storageKey(collection), JSON.stringify(items));
}

function nowIso() {
  return new Date().toISOString();
}

function matchesFilter(item, filter) {
  if (!filter) return true;
  return Object.entries(filter).every(([key, value]) => {
    if (typeof value === 'function') return value(item[key], item);
    return item[key] === value;
  });
}

function applySort(items, sort) {
  if (!sort) return items;
  const { field, direction = 'asc' } = sort;
  const factor = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1 * factor;
    if (bv === undefined || bv === null) return -1 * factor;
    return av > bv ? factor : -factor;
  });
}

// Envuelve el resultado en una promesa resuelta en el próximo microtask,
// para simular latencia async sin depender de un backend real.
function asPromise(fn) {
  return Promise.resolve().then(fn);
}

export const gateway = {
  setSeedLoader(fn) {
    seedLoader = fn;
  },

  list(collection, { filter, sort } = {}) {
    return asPromise(() => {
      let items = readCollection(collection);
      items = items.filter((item) => matchesFilter(item, filter));
      items = applySort(items, sort);
      return items;
    });
  },

  get(collection, id) {
    return asPromise(() => {
      const items = readCollection(collection);
      return items.find((item) => item.id === id) ?? null;
    });
  },

  create(collection, data) {
    return asPromise(() => {
      const items = readCollection(collection);
      const timestamp = nowIso();
      const item = {
        id: generateId(),
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
      };
      items.push(item);
      writeCollection(collection, items);
      return item;
    });
  },

  update(collection, id, patch) {
    return asPromise(() => {
      const items = readCollection(collection);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error(`No existe "${id}" en la colección "${collection}"`);
      }
      const updated = {
        ...items[index],
        ...patch,
        id: items[index].id,
        created_at: items[index].created_at,
        updated_at: nowIso(),
      };
      items[index] = updated;
      writeCollection(collection, items);
      return updated;
    });
  },

  remove(collection, id) {
    return asPromise(() => {
      const items = readCollection(collection);
      const next = items.filter((item) => item.id !== id);
      writeCollection(collection, next);
      return true;
    });
  },

  // Borra todo y vuelve a cargar la semilla (CLAUDE.md §7, "Datos de arranque").
  resetToSeed() {
    return asPromise(() => {
      if (!seedLoader) {
        throw new Error('No hay seed loader registrado (llamar a gateway.setSeedLoader)');
      }
      const seed = seedLoader();
      Object.entries(seed).forEach(([collection, items]) => {
        writeCollection(collection, items);
      });
      localStorage.setItem(SEED_FLAG_KEY, '1');
      return true;
    });
  },

  // Carga la semilla solo si todavía no hay datos (arranque inicial).
  ensureSeeded() {
    return asPromise(() => {
      const alreadySeeded = localStorage.getItem(SEED_FLAG_KEY) === '1';
      if (alreadySeeded) return false;
      if (!seedLoader) {
        throw new Error('No hay seed loader registrado (llamar a gateway.setSeedLoader)');
      }
      const seed = seedLoader();
      Object.entries(seed).forEach(([collection, items]) => {
        writeCollection(collection, items);
      });
      localStorage.setItem(SEED_FLAG_KEY, '1');
      return true;
    });
  },
};
