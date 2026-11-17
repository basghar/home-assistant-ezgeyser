// Row 1: the geyser's name, the status badge and the device's own web page. The readings open their own details.
import { html } from '../html.js';
import { devicePageIcon, icon } from '../icons.js';

function devicePageLink({ page, enabled }) {
  const title = page ? `Open ${page.host}` : 'Device address unavailable';
  // A native link keeps the browser's keyboard, context-menu and long-press behaviour.
  const target = enabled
    ? html` href="${page.url}" target="_blank" rel="noopener noreferrer"`
    : html` role="link" aria-disabled="true" tabindex="-1"`;
  return html`
    <a class="details-button device-page-button" data-action="device-page" aria-label="Open device page in browser"
       title="${title}"${target}>
      ${devicePageIcon()}
    </a>`;
}

export const header = (view) => html`
  <div class="header">
    <h2 class="name" title="${view.name}">${view.name}</h2>
    <div class="badge ${view.badge.warning ? 'warning' : ''}" role="img" aria-label="${view.badge.label}"
         title="${view.badge.label}">
      ${icon(view.badge.icon)}<span>${view.badge.text}</span>
    </div>
    ${devicePageLink(view.devicePage)}
  </div>`;
