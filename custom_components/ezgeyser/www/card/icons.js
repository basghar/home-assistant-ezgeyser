// The card's icons, as inline SVG. Unless noted, the paths are Tabler icons (MIT), as in the Android app.
import { html } from './html.js';
import { WIFI } from './status.js';

export const PATHS = {
  warning: 'M12 3L2 21h20L12 3Zm0 6v5m0 3v.1',
  // Temperature: the word "Target" beside it says it is the set point.
  temperature: 'M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0-4 0v8.5M10 9h4',
  offline:
    'M3 3l18 18M2 8a16 16 0 0 1 4-2m4-1a16 16 0 0 1 12 3M5 12a11 11 0 0 1 5-2m5 0a11 11 0 0 1 4 2M8 16a6 6 0 0 1 8 0M12 20h.01',
  info: 'M12 11v6m0-10v.1M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0',
  // Calendar-time, calendar-off, beach and x.
  calendarClock:
    'M11.795 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M14 18a4 4 0 1 0 8 0a4 4 0 1 0-8 0m1-15v4M7 3v4m-4 4h16M18 16.496V18l1 1',
  calendarOff:
    'M9 5h9a2 2 0 0 1 2 2v9m-.184 3.839A2 2 0 0 1 18 21H6a2 2 0 0 1-2-2V7a2 2 0 0 1 1.158-1.815M16 3v4M8 3v1m-4 7h7m4 0h5M3 3l18 18',
  beach:
    'M17.553 16.75a7.5 7.5 0 0 0-10.606 0M18 3.804A6 6 0 0 0 9.804 6l10.392 6A6 6 0 0 0 18 3.804M16.732 10C18.39 7.13 18.957 4.356 18 3.804S14.925 5.13 13.268 8M15 9l-3 5.196M3 19.25A2.4 2.4 0 0 1 4 19a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 1 .25',
  close: 'M18 6L6 18M6 6l12 12',
  // Arrow-right, for the mode pill.
  arrow: 'M5 12h14M13 18l6-6M13 6l6 6',
  // Check, rocket (Boost; the bolt means electric heating only), clock, clock-exclamation, cloud and cloud-off.
  check: 'M5 12l5 5L20 7',
  rocket:
    'M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3-5a9 9 0 0 0 6-8a3 3 0 0 0-3-3a9 9 0 0 0-8 6a6 6 0 0 0-5 3M7 14a6 6 0 0 0-3 6a6 6 0 0 0 6-3m4-8a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  clock: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0M12 7v5l3 3',
  clockAlert: 'M20.986 12.502a9 9 0 1 0-5.973 7.98M12 7v5l3 3m4 1v3m0 3v.01',
  cloud:
    'M6.657 18C4.085 18 2 15.993 2 13.517s2.085-4.482 4.657-4.482c.393-1.762 1.794-3.2 3.675-3.773c1.88-.572 3.956-.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486s-1.551 3.487-3.465 3.487H6.657',
  cloudOff:
    'M9.58 5.548q.361-.166.752-.286c1.88-.572 3.956-.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 .957-.383 1.824-1.003 2.454M18 18.004H6.657C4.085 18 2 15.993 2 13.517s2.085-4.482 4.657-4.482c.13-.582.37-1.128.7-1.62M3 3l18 18',
};

// The live heat icons and the mode pill draw these filled or outlined. Gas is the Tabler flame (it was a teardrop that
// read as water), the same path as the Android app's; it ends where it starts, so it also fills cleanly.
export const HEAT_GLYPHS = {
  gas: 'M12 10.941c2.333-3.308.167-7.823-1-8.941c0 3.395-2.235 5.299-3.667 6.706C5.903 10.114 5 12 5 14.294C5 17.998 8.134 21 12 21s7-3.002 7-6.706c0-1.712-1.232-4.403-2.333-5.588c-2.084 3.353-3.257 3.353-4.667 2.235',
  electric: 'M13.6 2 5 13.4h6.2L10.2 22 19 10.4h-6.2L13.6 2Z',
};

export const icon = (name) => html`
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="${PATHS[name]}"/>
  </svg>`;

// The device-page glyph (a window with an outward arrow, and a gear): it shares the info circle's 3..21 geometry; both
// scale just inside the badge's painted height.
const gearTeeth = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const point = (radius) =>
    `${(11 + radius * Math.cos(angle)).toFixed(4)} ${(13 + radius * Math.sin(angle)).toFixed(4)}`;
  return html`<path d="M${point(3.4)} ${point(4.85)}" stroke-width="1.8"/>`;
});

export const devicePageIcon = () => html`
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M11.5 5H5.5a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 5.5 21h11a2.5 2.5 0 0 0 2.5-2.5V12.5"/>
    <path d="M17.5 6.5 21 3M17 3h4v4"/>
    <circle cx="11" cy="13" r="3.4" stroke-width="1.7"/>
    <circle cx="11" cy="13" r="1.36" stroke-width="1.4"/>
    ${gearTeeth}
  </svg>`;

// The Wi-Fi arcs, smallest first.
const WIFI_ARCS = [
  'M8.82 13.32A4.5 4.5 0 0 1 15.18 13.32',
  'M6.34 10.84A8 8 0 0 1 17.66 10.84',
  'M3.87 8.37A11.5 11.5 0 0 1 20.13 8.37',
];

// The dot and every arc are always drawn: the lit ones in the item's colour, the rest in the inactive-arc token. Weak
// and Very weak light the dot alone (Very weak in the warning colour), so it still reads as Wi-Fi.
export function wifiIcon(level) {
  const lit = WIFI[level]?.arcs ?? 0;
  const arcs = WIFI_ARCS.map((d, i) => html`<path d="${d}" stroke="${i < lit ? 'currentColor' : 'var(--wifi-off)'}"/>`);
  return html`
    <svg class="icon wifi-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="2.2"
         stroke-linecap="round">
      <circle cx="12" cy="16.5" r="1.6" fill="currentColor"/>
      ${arcs}
    </svg>`;
}
