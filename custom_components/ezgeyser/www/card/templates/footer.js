// Row 3: the heat status chip and the mode pill, then the connectivity icons at the end.
import { html } from '../html.js';
import { HEAT_GLYPHS, PATHS, icon, wifiIcon } from '../icons.js';
import { WIFI, linkLabel } from '../status.js';

function heatLabel(kind, first, second, count, known) {
  if (!known) return `${kind === 'gas' ? 'Burner' : 'Elements'} status unknown`;
  if (kind === 'gas') {
    if (first && second) return 'Burner both sides on';
    if (first) return 'Burner left side on';
    if (second) return 'Burner right side on';
    return 'Burner off';
  }
  if (count === 1) return `Element ${first || second ? 'on' : 'off'}`;
  return `Element 1 ${first ? 'on' : 'off'}, element 2 ${second ? 'on' : 'off'}`;
}

// A flame or bolt over one bar per burner side or element (a single bar for a single element).
export function heatIcon(kind, first, second, count, known = true) {
  const on = known && (first || second);
  const label = heatLabel(kind, first, second, count, known);
  const bar = (x1, x2, active) => html`<path d="M${x1} 21H${x2}" class="segment ${known && active ? 'lit' : ''}"/>`;
  const bars = count === 1 ? bar(3.5, 20.5, on) : [bar(3.5, 10.8, first), bar(13.2, 20.5, second)];
  return html`
    <svg class="heat ${kind} ${on ? 'on' : ''}" viewBox="0 0 24 24" role="img" aria-label="${label}">
      <title>${label}</title>
      <g transform="translate(3.6 .5) scale(.7)"><path class="glyph" d="${HEAT_GLYPHS[kind]}"/></g>
      ${bars}
    </svg>`;
}

// Each heat icon, with its bars, is one button that opens the History page for its sensors.
function heatControl(kind, [first, second], count, known) {
  const action = kind === 'gas' ? 'flame-history' : 'electric-history';
  const label =
    kind === 'gas'
      ? 'left and right flame sensor history'
      : count === 1
        ? 'electric element history'
        : 'both electric elements history';
  return html`
    <button class="entity-button heat-control" data-action="${action}" aria-label="Open ${label}" title="Open ${label}">
      ${heatIcon(kind, first, second, count, known)}
    </button>`;
}

const timerButton = (timer) => html`
  <button class="timer entity-button" data-entity="timer" aria-label="${timer.label}. Open timer details"
          title="${timer.label}">
    ${icon('clock')}<span>${timer.remaining} left</span>
  </button>`;

// One chip for the heat icons, the state and the timer: outlined while idle, lone flame or unknown (icons only), tinted
// in the colour of what heats. The border stays, transparent, so tinting never changes the chip's size. The state text
// is the live state only; the configured source is the mode pill. An unknown status keeps a running timer, after the
// chip.
function heatStatus(heat, timer) {
  const timerItem = timer && timerButton(timer);
  const activity = html`<span class="activity ${heat.heating ? 'heating' : ''}">${heat.activity}</span>`;
  return html`
    <div class="heat-status${heat.tint ? ` tint-${heat.tint}` : ''}">
      <div class="sources">
        ${heatControl('gas', heat.burners, 2, heat.known)}
        ${heatControl('electric', heat.elements, heat.elementCount, heat.known)}
      </div>
      ${heat.known && html`<span class="state-text">${activity}${timerItem}</span>`}
    </div>
    ${!heat.known && timerItem}`;
}

const modeGlyph = (kind, allowed) => html`
  <svg class="mode-icon ${allowed ? 'allowed' : ''}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="${HEAT_GLYPHS[kind]}"/>
  </svg>`;

const modeArrow = html`<svg class="mode-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS.arrow}"/></svg>`;

// The configured heat source: flame and bolt, allowed or not, with an arrow for electric fallback. An unknown source
// says so in words, rather than as two not-allowed icons that read like a mode.
function modePill(mode) {
  if (!mode) return '';
  const value = mode.known
    ? html`
        <span class="mode-icons">
          ${modeGlyph('gas', mode.gas)}${mode.gas && mode.electric && modeArrow}${modeGlyph('electric', mode.electric)}
        </span>`
    : html`<span class="quiet">Unknown</span>`;
  return html`
    <button class="mode entity-button" data-entity="source" aria-label="${mode.label}. Open heating source details"
            title="${mode.label}">
      <span class="mode-word">Mode</span>${value}
    </button>`;
}

const connectivityItem = (key, label, title, content, warn) => html`
  <button class="${key} entity-button ${warn ? 'warn' : ''}" data-entity="${key}"
          aria-label="${label}. Open ${title} details" title="${label}">${content}</button>`;

function connectivityItems(link) {
  const items = [];
  if (link.level) {
    const label = `Wi-Fi ${WIFI[link.level].label}`;
    items.push(connectivityItem('wifi', label, 'Wi-Fi signal', wifiIcon(link.level), link.level === 'weak'));
  }
  if (link.cloud !== null) {
    const label = `Cloud ${link.cloud ? 'online' : 'offline'}`;
    items.push(
      connectivityItem('cloud', label, 'cloud connection', icon(link.cloud ? 'cloud' : 'cloudOff'), !link.cloud),
    );
  }
  if (link.clockOff) items.push(connectivityItem('clock', 'Clock off', 'device clock', icon('clockAlert'), true));
  if (!items.length) return '';
  return html`<div class="status" role="group" aria-label="${linkLabel(link)}">${items}</div>`;
}

export function footer(view) {
  if (view.stale) {
    return html`
      <div class="footer">
        <div class="start">
          <span class="activity">
            ${view.lastUpdated ? `Last available ${view.lastUpdated}` : 'No previous values available'}
          </span>
        </div>
      </div>`;
  }
  return html`
    <div class="footer">
      <div class="start">${heatStatus(view.heat, view.timer)}${modePill(view.mode)}</div>
      ${connectivityItems(view.link)}
    </div>`;
}
