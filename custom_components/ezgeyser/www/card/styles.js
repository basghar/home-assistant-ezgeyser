// The card's styles. Text is never shrunk or wrapped; `fitLayout` (layout-fit.js) picks the adaptive classes
// (.chips-icons, .stacked, .wrap-status, .wrap-mode, .no-state-word, .no-mode-word).
export const STYLE = `
/* Colours and sizes, light theme. The middle row is always as tall as a full right column (target, event and a
   mode line), with or without modes, so every card in a list is the same height. */
:host {
  display: block;
  --surface: #EFEDF4;
  --text: #1B1B1F;
  --secondary: #46464F;
  --tertiary: #77767F;
  --line: #DAD8E2;
  --off: #8E8C96;
  --ok: #1E6B3A;
  --ok-bg: #D4EEDB;
  --warn: #8A5100;
  --warn-bg: #FFDDB8;
  --primary: #3B57A6;
  --on-primary: #FFFFFF;
  --primary-bg: #DCE2FA;
  --dialog: #FBF8FF;
  --gas: #D9480F;
  --electric: #B86E00;
  --heating-chip: #D32F2F;
  --wifi-off: #9896A0;
  --mode-off: #C4C2CC;
  --line-strong: #B5B3BE;
  --line-h: 18px;
  --chip-h: 22px;
  --pill-h: 30px;
  --row-h: calc(2 * var(--line-h) + var(--chip-h) + 2 * 6px);
}

/* Dark theme */
:host([dark]) {
  --surface: #202024;
  --text: #E5E1E6;
  --secondary: #C6C5CF;
  --tertiary: #908F99;
  --line: #34343A;
  --off: #77767F;
  --ok: #9AD6A9;
  --ok-bg: #1E3826;
  --warn: #FFB95E;
  --warn-bg: #4A2B00;
  --primary: #B4C5FF;
  --on-primary: #13285E;
  --primary-bg: #2B3A66;
  --dialog: #2A2A2F;
  --gas: #FF8F57;
  --electric: #F2B33D;
  --heating-chip: #FF6B6B;
  --wifi-off: #66656E;
  --mode-off: #4A4950;
  --line-strong: #57565E;
}

/* The card surface and its font */
* {
  box-sizing: border-box;
}
ha-card {
  display: block;
  background: var(--ha-card-background, var(--surface));
  color: var(--text);
  border: 1px solid var(--ha-card-border-color, var(--line));
  border-radius: var(--ha-card-border-radius, 16px);
  box-shadow: var(--ha-card-box-shadow, none);
  overflow: hidden;
}
ha-card, .sample {
  font-family: var(--paper-font-body1_-_font-family, Roboto, Arial, sans-serif);
}

/* The card, its buttons, and the header: name, status badge and the two round actions */
.card {
  padding: 12px 14px 0;
  outline: none;
}

/* Every reading, icon and line that opens details is a plain button */
.entity-button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  text-align: inherit;
  cursor: pointer;
}
.entity-button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 3px;
}
.card:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: -3px;
  border-radius: 16px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 24px;
}
.name {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 20px;
  max-width: 60%;
  font-size: 12px;
  font-weight: 500;
  color: var(--ok);
  background: var(--ok-bg);
}
.badge span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge.warning {
  color: var(--warn);
  background: var(--warn-bg);
}
.icon {
  width: 16px;
  height: 16px;
  flex: none;
}
.header .icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}
.details-button {
  position: relative;
  flex: none;
  width: var(--header-action-size, 21.12px);
  height: var(--header-action-size, 21.12px);
  border: 0;
  background: none;
  color: var(--secondary);
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  cursor: pointer;
}
.details-button::before {
  content: "";
  position: absolute;
  z-index: 0;
  width: 48px;
  height: 48px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.header .name, .header .badge {
  position: relative;
  z-index: 1;
}
.details-button .icon {
  position: absolute;
  z-index: 1;
  left: 50%;
  top: 50%;
  width: 120%;
  height: 120%;
  transform: translate(-50%, -50%);
}
.details-button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}
.details-button[aria-disabled="true"] {
  opacity: .38;
  cursor: default;
}
.details-button[aria-disabled="true"]::before {
  pointer-events: none;
}

/* Temperatures row, left: the tank bar and the readings. The number's and the second line's line heights are
   trimmed to the glyphs, so the text block centres on its digits. */
.temperatures {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 10px;
  row-gap: 8px;
  align-items: center;
  min-height: var(--row-h);
  margin: 12px 0 8px;
}
.left {
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: 12px;
  min-width: 0;
}
.tank {
  width: 11px;
  flex: none;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tank .half {
  flex: 1 1 0;
  min-height: 0;
  border-radius: 5.5px 5.5px 2px 2px;
  box-shadow: inset 0 0 0 1px rgba(28, 27, 34, .08);
}
.tank .half + .half {
  border-radius: 2px 2px 5.5px 5.5px;
}
.half.fault {
  background: repeating-linear-gradient(135deg, #C6C3D1 0 4px, #E4E2EA 4px 8px);
}
.readings {
  min-width: 0;
}
.reading {
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
  line-height: .75;
}
.number {
  font-size: 36px;
  font-weight: 500;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
}
.unit {
  font-size: 15px;
  color: var(--secondary);
}
.secondary {
  display: block;
  font-size: 14px;
  line-height: .95;
  white-space: nowrap;
  color: var(--secondary);
  margin-top: 11px;
}
.fault-text {
  color: var(--warn);
}

/* Temperatures row, right column: target, next event and the mode chips */
.right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--secondary);
  text-align: right;
}
.line {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  max-width: 100%;
  min-height: var(--line-h);
  white-space: nowrap;
  overflow: hidden;
}
.line .icon {
  width: 14px;
  height: 14px;
}
.value {
  font-weight: 500;
  color: var(--text);
}
.quiet {
  color: var(--tertiary);
}
.day-badge {
  display: inline-grid;
  place-items: center;
  flex: none;
  height: 18px;
  min-width: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}
.modes {
  display: flex;
  gap: 6px;
  flex: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: var(--chip-h);
  min-width: var(--chip-h);
  border-radius: 11px;
  padding: 0 9px 0 7px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--primary-bg);
  color: var(--primary);
}
.chip .icon {
  width: 13px;
  height: 13px;
}
.chips-icons .chip {
  width: var(--chip-h);
  padding: 0;
}
.chips-icons .chip span {
  display: none;
}

/* Footer: the heat status chip, the mode pill and the connectivity icons, reaching the card's bottom edge. Its lines are
   one block, centred between the divider and the edge: one 30 px line in 48 px, or wrapped lines with the same 9 px
   inset above and below. */
.footer {
  border-top: 1px solid var(--line);
  padding: 9px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 49px;
  font-size: 12px;
  color: var(--secondary);
  white-space: nowrap;
}
.start {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

/* Heat icons: a flame or bolt over one bar per burner side or element */
.sources {
  display: flex;
  gap: 6px;
  flex: none;
}
.heat-control {
  position: relative;
  width: 24px;
  height: 24px;
  flex: none;
}
.heat {
  width: 24px;
  height: 24px;
  color: var(--off);
  overflow: visible;
}
.glyph {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.3;
  stroke-linejoin: round;
}
.on .glyph {
  fill: currentColor;
}
.gas.on {
  color: var(--gas);
}
.electric.on {
  color: var(--electric);
}
.segment {
  fill: none;
  stroke: var(--off);
  opacity: .55;
  stroke-width: 2.6;
  stroke-linecap: round;
}
.gas .lit {
  stroke: var(--gas);
  opacity: 1;
}
.electric .lit {
  stroke: var(--electric);
  opacity: 1;
}
.activity {
  flex: none;
}
.activity.heating {
  color: var(--text);
}
.wifi, .cloud, .clock {
  display: inline-flex;
  align-items: center;
  flex: none;
}
.status .icon {
  width: 20px;
  height: 20px;
}

/* Mode pill: the configured heat source, in neutral colours */
.mode {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: var(--pill-h);
  padding: 0 9px;
  border: 1px solid var(--line-strong);
  border-radius: 15px;
  font-size: 11px;
  line-height: 1;
  color: var(--secondary);
}
.mode-word {
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  padding-right: 6px;
  margin-right: 6px;
  border-right: 1px solid var(--line-strong);
}
.mode-icons {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.mode-icon {
  width: 14px;
  height: 14px;
  flex: none;
  fill: none;
  stroke: var(--mode-off);
  stroke-width: 2.3;
  stroke-linejoin: round;
}
.mode-icon.allowed {
  stroke: var(--text);
}

/* Heat status chip: outlined while idle, a slight red while heating, gas or electric (the lit icons tell them apart).
   The heat icons have room above and below in the taller pill. */
.heat-status {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: var(--pill-h);
  padding: 0 9px;
  border: 1px solid var(--line-strong);
  border-radius: 15px;
  font-size: 11px;
  line-height: 1;
}
.heat-status .sources {
  gap: 3px;
}
.heat-status .heat-control, .heat-status .heat {
  width: 22px;
  height: 22px;
}
.state-text {
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  padding-left: 6px;
  margin-left: 6px;
  border-left: 1px solid var(--line-strong);
}
.tint-heating {
  background: color-mix(in srgb, var(--heating-chip) 16%, transparent);
  border-color: transparent;
}
.tint-heating .state-text {
  border-left-color: color-mix(in srgb, var(--heating-chip) 50%, transparent);
}
@media (min-resolution: 2dppx) {
  .mode, .mode-word, .heat-status, .state-text {
    border-width: .5px;
  }
}

/* Connectivity icons at the end; a pill tall, also on a line of their own */
.status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  min-height: var(--pill-h);
  margin-left: auto;
}
.warn {
  color: var(--warn);
}

/* Last known values of an unreachable geyser */
.stale .number, .stale .unit, .stale .secondary {
  color: var(--tertiary);
}
.stale .tank {
  opacity: .45;
}
.stale .right {
  color: var(--tertiary);
}

/* Footer steps for a narrow card, chosen by fitLayout: words go whole, never shortened */
.no-state-word .state-text, .no-mode-word .mode-word {
  display: none;
}

/* Footer on two or three 30 px lines, 4 px apart. A wrapped footer reserves its lines' height, for a footer with nothing
   to wrap. */
.wrap-status .footer {
  flex-wrap: wrap;
  row-gap: 4px;
  min-height: 83px;
}
.wrap-status .start {
  flex-basis: 100%;
}
.wrap-mode .footer {
  min-height: 117px;
}
.wrap-mode .start {
  flex-wrap: wrap;
  row-gap: 0;
}
.wrap-mode .start::after {
  content: "";
  flex-basis: 100%;
  order: 1;
}
.wrap-mode .mode {
  order: 2;
  margin-top: 4px;
}

/* Temperatures row stacked: the right column under the left */
.stacked .temperatures {
  grid-template-columns: minmax(0, 1fr);
}
.stacked .left {
  align-self: auto;
}
.stacked .right {
  align-items: flex-start;
  justify-content: flex-start;
  min-height: var(--row-h);
  text-align: left;
  padding-left: 23px;
}
.stacked .line {
  justify-content: flex-start;
}

/* While measuring: every text at its natural full width */
.measure .temperatures {
  grid-template-columns: max-content max-content;
  width: max-content;
}
.measure .footer {
  width: max-content;
}
.measure .start, .measure .activity {
  flex: none;
}

/* The hidden worst-case sample that the stacking and wrapping rules measure */
.sample {
  position: absolute;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  display: flex;
  flex-direction: column;
}
.sample, .sample > * {
  width: max-content;
}

/* Next scheduled event details window */
dialog.details {
  border: 0;
  padding: 0;
  margin: auto;
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  border-radius: 24px;
  background: var(--dialog);
  color: var(--text);
  font-family: var(--paper-font-body1_-_font-family, Roboto, Arial, sans-serif);
  font-size: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, .3);
}
dialog.details::backdrop {
  background: rgba(0, 0, 0, .45);
}
.sheet {
  padding: 20px 20px 16px;
  outline: none;
}
.sheet header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sheet h2 {
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}
.icon-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin: -8px -8px -8px 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--secondary);
  cursor: pointer;
}
.icon-button .icon {
  width: 20px;
  height: 20px;
}
.when {
  margin: 4px 0 12px;
  color: var(--secondary);
}
.sheet dl {
  margin: 0;
  border-top: 1px solid var(--line);
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.row dt {
  color: var(--secondary);
}
.row dd {
  margin: 0;
  font-weight: 500;
  text-align: right;
}

/* The heating mode row: the glyph and name, then a line on what the mode does under the whole row */
.mode-row {
  flex-wrap: wrap;
  row-gap: 2px;
}
.mode-row dd {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mode-row .hint {
  flex-basis: 100%;
  font-size: 12px;
  font-weight: 400;
  text-align: left;
  color: var(--secondary);
}
.heat-mode {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.heat-mode svg {
  width: 16px;
  height: 16px;
  flex: none;
  fill: none;
  stroke-width: 2.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.heat-mode .gas {
  stroke: var(--gas);
}
.heat-mode .electric {
  stroke: var(--electric);
}
.heat-mode .backup {
  opacity: .5;
}
.heat-mode .unused {
  stroke: var(--mode-off);
}
.heat-mode .join {
  width: 14px;
  height: 14px;
  stroke: var(--secondary);
  stroke-width: 2;
}
.sheet footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 16px;
}
.text-button, .filled-button {
  font: inherit;
  font-weight: 500;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  border: 0;
  cursor: pointer;
}
.text-button {
  background: none;
  color: var(--primary);
}
.filled-button {
  background: var(--primary);
  color: var(--on-primary);
}
.sheet button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* On a phone the details window is a bottom sheet */
@media (max-width: 600px) {
  dialog.details {
    margin: auto 0 0;
    width: 100vw;
    max-width: 100vw;
    border-radius: 24px 24px 0 0;
  }
  .sheet {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}
`;
