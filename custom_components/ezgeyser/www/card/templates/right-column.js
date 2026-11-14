// The right column: the target, the next scheduled event, and the Boost and Vacation chips.
import { html } from '../html.js';
import { icon } from '../icons.js';

// Always the same line, "[thermometer] Target 65°C"; "not set" or "unknown" in muted text instead of a value.
const targetLine = (target) => html`
  <button class="line entity-button" data-entity="target" aria-label="${target.label}. Open target temperature details"
          title="${target.label}">
    ${icon('temperature')}<span>Target</span>
    ${
      target.text
        ? html`<span class="quiet">${target.text}</span>`
        : html`<span class="value">${target.number}${target.unit}</span>`
    }
  </button>`;

// "6:00 AM [+1] → 60°", "→ Off" for an event that turns heating off, or "No schedule".
function scheduleLine(schedule, hasEntity, showSource) {
  if (!schedule) {
    const none = html`${icon('calendarOff')}<span>No schedule</span>`;
    return hasEntity
      ? html`
          <button class="line quiet entity-button" data-entity="next_event"
                  aria-label="No schedule. Open next scheduled event details">${none}</button>`
      : html`<span class="line quiet">${none}</span>`;
  }
  const value = schedule.off ? 'Off' : schedule.target !== null ? `${schedule.target}°` : null;
  return html`
    <button class="line entity-button" data-action="schedule" aria-haspopup="dialog" aria-label="${schedule.spoken}"
            title="${schedule.summary(showSource)}">
      ${icon('calendarClock')}
      <span aria-hidden="true">${schedule.time}</span>
      ${schedule.days > 0 && html`<span class="day-badge" aria-hidden="true">+${schedule.days}</span>`}
      ${value && html`<span class="quiet" aria-hidden="true">→</span><span class="value" aria-hidden="true">${value}</span>`}
    </button>`;
}

// The chips' words can be hidden (`chips-icons`), so each says what it is in its label and tooltip.
const modeChip = (key, iconName, text) => html`
  <button class="chip entity-button" data-entity="${key}" aria-label="${text} on. Open ${text.toLowerCase()} details"
          title="${text} on">
    ${icon(iconName)}<span>${text}</span>
  </button>`;

function modeChips(view) {
  if (!view.boost && !view.vacation) return '';
  return html`
    <div class="modes">
      ${view.boost && modeChip('boost', 'rocket', 'Boost')}
      ${view.vacation && modeChip('vacation', 'beach', 'Vacation')}
    </div>`;
}

export function rightColumn(view) {
  if (view.stale) return html`<div class="right"><span class="line">Last known values</span></div>`;
  return html`
    <div class="right">
      ${targetLine(view.target)}
      ${scheduleLine(view.schedule, view.hasScheduleEntity, view.showSource)}
      ${modeChips(view)}
    </div>`;
}
