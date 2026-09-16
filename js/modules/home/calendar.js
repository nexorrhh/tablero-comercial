// Calendario del módulo `home`: grilla mensual con los próximos contactos
// agendados por comprador (CLAUDE.md §10, adelanto de Fase 3).

import { loadCalendarEvents } from './home-data.js';
import { openBuyerPanel } from './buyer-panel.js';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth(); // 0-11
let selectedDateKey = null;

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Días del mes en hora de Buenos Aires (UTC-3 fijo, CLAUDE.md §7).
function eventDateKey(isoString) {
  const d = new Date(new Date(isoString).getTime() - 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function buildMonthCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  return cells;
}

export async function renderCalendar(container) {
  const events = await loadCalendarEvents();
  const eventsByDate = new Map();
  events.forEach((e) => {
    const key = eventDateKey(e.scheduled_at);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key).push(e);
  });

  const todayKey = dateKey(new Date());
  if (!selectedDateKey) selectedDateKey = todayKey;

  const cells = buildMonthCells(viewYear, viewMonth);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="calendar-header">
      <button class="btn btn-ghost" id="cal-prev">←</button>
      <strong>${MONTH_LABELS[viewMonth]} ${viewYear}</strong>
      <button class="btn btn-ghost" id="cal-next">→</button>
    </div>
    <div class="calendar-grid calendar-weekdays">
      ${WEEKDAY_LABELS.map((l) => `<div class="calendar-weekday">${l}</div>`).join('')}
    </div>
    <div class="calendar-grid">
      ${cells
        .map((d) => {
          if (!d) return '<div class="calendar-cell calendar-cell-empty"></div>';
          const key = dateKey(d);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDateKey;
          return `
            <div class="calendar-cell${isToday ? ' calendar-cell-today' : ''}${isSelected ? ' calendar-cell-selected' : ''}" data-date-key="${key}">
              <span class="calendar-cell-day">${d.getDate()}</span>
              ${dayEvents.length ? `<span class="calendar-cell-dot" title="${dayEvents.length} evento(s)"></span>` : ''}
            </div>`;
        })
        .join('')}
    </div>

    <h3>Contactos del ${selectedDateKey.split('-').reverse().join('/')}</h3>
    <ul class="history-list" id="cal-day-events">
      ${
        (eventsByDate.get(selectedDateKey) ?? [])
          .map(
            (e) => `
        <li class="row-clickable" data-buyer-key="${e.buyer_key}">
          <strong>${e.buyer_key}</strong> ${e.is_done ? '<span class="badge">Realizado</span>' : ''} · ${e.userName}
          <div>${e.note ?? ''}</div>
        </li>`
          )
          .join('') || '<li class="muted">Sin contactos agendados este día.</li>'
      }
    </ul>
  `;

  container.innerHTML = '';
  container.appendChild(wrapper);

  wrapper.querySelector('#cal-prev').addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderCalendar(container);
  });
  wrapper.querySelector('#cal-next').addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderCalendar(container);
  });

  wrapper.querySelectorAll('.calendar-cell[data-date-key]').forEach((cell) => {
    cell.addEventListener('click', () => {
      selectedDateKey = cell.dataset.dateKey;
      renderCalendar(container);
    });
  });

  wrapper.querySelectorAll('#cal-day-events [data-buyer-key]').forEach((el) => {
    el.addEventListener('click', () => openBuyerPanel(el.dataset.buyerKey, () => renderCalendar(container)));
  });
}
