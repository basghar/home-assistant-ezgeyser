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

// A flame or bolt over one bar per burner side or element (a single bar for a single element). The two bars leave a clear
// 3-unit gap between their round caps.
export function heatIcon(kind, first, second, count, known = true) {
  const on = known && (first || second);
  const label = heatLabel(kind, first, second, count, known);
  const bar = (x1, x2, active) => html`<path d="M${x1} 21H${x2}" class="segment ${known && active ? 'lit' : ''}"/>`;
  const bars = count === 1 ? bar(4.3, 19.7, on) : [bar(4.3, 9.2, first), bar(14.8, 19.7, second)];
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

// One chip for the heat icons and the state word: outlined while idle, lone flame or unknown (icons only), a slight red
// while heating. The border stays, transparent, so tinting never changes the chip's size. The word, after a divider, is
// Heating or Idle; a lone flame has none, its half-lit icon says it, and the footer drops the word whole when it does not
// fit (see layout-fit.js). The chip's label carries the full state for screen readers, so the word itself is hidden from
// them. The configured source is the mode pill.
function heatStatus(heat) {
  const label = heat.known ? html` role="group" aria-label="${heat.activity}"` : '';
  const word =
    heat.known &&
    heat.word &&
    html`<span class="state-text" aria-hidden="true"><span class="activity ${heat.heating ? 'heating' : ''}">${heat.word}</span></span>`;
  return html`
    <div class="heat-status${heat.tinted ? ' tint-heating' : ''}"${label}>
      <div class="sources">
        ${heatControl('gas', heat.burners, 2, heat.known)}
        ${heatControl('electric', heat.elements, heat.elementCount, heat.known)}
      </div>
      ${word}
    </div>`;
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
    items.push(connectivityItem('wifi', label, 'Wi-Fi signal', wifiIcon(link.level), link.level === 'very_weak'));
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
      <div class="start">${heatStatus(view.heat)}${modePill(view.mode)}</div>
      ${connectivityItems(view.link)}
    </div>`;
}
