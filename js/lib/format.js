// Formato de fechas y montos (CLAUDE.md §7: fechas en UTC, mostradas en
// America/Argentina/Buenos_Aires; montos en decimal).

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function formatCurrency(amount, currency = 'ARS') {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(isoString));
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

// Días restantes hasta una fecha (redondeado hacia arriba). Negativo = vencido.
export function daysUntil(isoString) {
  if (!isoString) return null;
  const diffMs = new Date(isoString).getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function initials(firstName, lastName) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

export function isOverdue(isoString) {
  if (!isoString) return false;
  return new Date(isoString).getTime() < Date.now();
}

// Argentina no observa horario de verano desde 2009: el offset de Buenos
// Aires es siempre -03:00. Se hardcodea para evitar depender de una
// librería de zonas horarias en un stack sin build tool (CLAUDE.md §7).
const BUENOS_AIRES_OFFSET = '-03:00';

// ISO (UTC) -> valor para <input type="date"> en hora de Buenos Aires.
export function toLocalDateInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(new Date(isoString).getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ISO (UTC) -> valor para <input type="datetime-local"> en hora de Buenos Aires.
export function toLocalDateTimeInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(new Date(isoString).getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

// Valor de <input type="date"> (hora de Buenos Aires) -> ISO (UTC).
export function fromLocalDateInputValue(value) {
  if (!value) return null;
  return new Date(`${value}T00:00:00${BUENOS_AIRES_OFFSET}`).toISOString();
}

// Valor de <input type="datetime-local"> (hora de Buenos Aires) -> ISO (UTC).
export function fromLocalDateTimeInputValue(value) {
  if (!value) return null;
  return new Date(`${value}:00${BUENOS_AIRES_OFFSET}`).toISOString();
}
