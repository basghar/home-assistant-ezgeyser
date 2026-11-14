// Row 2: the tank bar and the readings on the left, the right column beside or under them.
import { html } from '../html.js';
import { rightColumn } from './right-column.js';

// One half of the tank bar, in its sensor's colour; hatched when the sensor is not reporting.
const tankHalf = (key, color) => html`
  <button class="half entity-button${color ? '' : ' fault'}" data-entity="${key}"
          aria-label="Open ${key} temperature details"${color && html` style="background:${color}"`}></button>`;

const readings = ({ main, other }) => html`
  <div class="readings">
    <button class="reading entity-button" data-entity="${main.key}" aria-label="Open ${main.key} temperature details">
      <span class="number ${main.missing ? 'fault-text' : ''}">${main.text}</span><span class="unit">${main.unit}</span>
    </button>
    <button data-entity="${other.key}" aria-label="Open ${other.key} temperature details"
            class="secondary entity-button ${other.missing ? 'fault-text' : ''}">${other.name} ${other.text}${other.unit}</button>
  </div>`;

export const temperatures = (view) => html`
  <div class="temperatures">
    <div class="left">
      <div class="tank" role="group" aria-label="${view.tank.label}" title="${view.tank.label}">
        ${tankHalf('top', view.tank.colors[0])}
        ${tankHalf('bottom', view.tank.colors[1])}
      </div>
      ${readings(view.readings)}
    </div>
    ${rightColumn(view)}
  </div>`;
