// The next scheduled event's details window, a native <dialog> outside the card.
import { html } from '../html.js';
import { icon } from '../icons.js';

const row = (label, value) => html`<div class="row"><dt>${label}</dt><dd>${value}</dd></div>`;

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
        ${showSource && [row('Heat source', schedule.source), row('Switch-over', schedule.switchOver)]}
        ${row('Repeats', schedule.repeats)}
      </dl>
      <footer>
        <button class="text-button" data-entity="next_event">History</button>
        <button class="filled-button" data-close>Close</button>
      </footer>
    </div>`;
}
