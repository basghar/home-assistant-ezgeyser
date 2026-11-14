// The worst case the stacking and footer rules measure (see layout-fit.js), with the card's own classes, in a hidden
// element: the widest reading and second line on the left; the target, an event a week ahead and two icon-only mode chips
// on the right; and the widest footer line once every step applies: both heat icons, an empty state text and the timer
// icon in the status chip, an Unknown mode pill, then Wi-Fi, cloud and clock.
import { html } from '../html.js';
import { icon, wifiIcon } from '../icons.js';

export const SAMPLE = html`
  <div class="left">
    <div class="tank"></div>
    <div class="readings">
      <div class="reading"><span class="number">88.8</span><span class="unit">°C</span></div>
      <div class="secondary">Bottom 88.8°C</div>
    </div>
  </div>
  <div class="right">
    <span class="line">${icon('temperature')}<span>Target</span><span class="value">72.5°C</span></span>
    <span class="line">
      ${icon('calendarClock')}<span>12:30 PM</span><span class="day-badge">+7</span>
      <span class="quiet">→</span><span class="value">72.5°</span>
    </span>
    <div class="modes"><span class="chip">${icon('rocket')}</span><span class="chip">${icon('beach')}</span></div>
  </div>
  <div class="footer">
    <div class="start">
      <div class="heat-status">
        <div class="sources"><div class="heat-control"></div><div class="heat-control"></div></div>
        <span class="state-text"><span class="activity"></span><span class="timer">${icon('clock')}</span></span>
      </div>
      <span class="mode"><span class="quiet">Unknown</span></span>
    </div>
    <div class="status">
      <span class="wifi">${wifiIcon('good')}</span>
      <span class="cloud">${icon('cloud')}</span>
      <span class="clock">${icon('clockAlert')}</span>
    </div>
  </div>`;
