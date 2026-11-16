// The next scheduled event's details window, a native <dialog> outside the card.
import { html } from '../html.js';
import { heatModeGlyph, icon } from '../icons.js';

const row = (label, value) => html`<div class="row"><dt>${label}</dt><dd>${value}</dd></div>`;

// The heating mode: its glyph, which screen readers hear as the spoken name, and its name, then a line on what it does.
// A source the integration cannot name shows as its code, with no glyph.
function modeRow(schedule) {
  const mode = schedule.mode;
  if (!mode) return row('Heating mode', schedule.source);
  return html`
    <div class="row mode-row">
      <dt>Heating mode</dt>
      <dd>${heatModeGlyph(mode.key, mode.spoken)}<span aria-hidden="true">${mode.name}</span></dd>
      <dd class="hint">${mode.hint}</dd>
    </div>`;
}

export function details(schedule, showSource) {
  const target = schedule.off
    ? 'Heating off'
    : schedule.target !== null
      ? `${schedule.target} ${schedule.unit}`
      : 'Not set';
  // The sheet takes the initial focus, so the close button isn't highlighted on open; Tab reaches the buttons.
  return html`
    <div class="sheet" tabindex="-1" autofocus>
      <header>
        <h2 id="details-title">Next scheduled event</h2>
        <button class="icon-button" data-close aria-label="Close">${icon('close')}</button>
      </header>
      <p class="when">${schedule.when}</p>
      <dl>
        ${row('Target', target)}
        ${showSource && modeRow(schedule)}
        ${row('Repeats', schedule.repeats)}
      </dl>
      <footer>
        <button class="text-button" data-entity="next_event">History</button>
        <button class="filled-button" data-close>Close</button>
      </footer>
    </div>`;
}
