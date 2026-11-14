// ezGeyser overview card. No dependencies or direct device requests/writes.
//
// This file is the custom element: Home Assistant's card API, finding the geyser's entities, rendering and actions. The rest is
// plain ES modules in card/, which Home Assistant serves next to this file:
//
//   view.js           what the card shows, worked out from the entity states as plain data
//   templates/        the markup, one file per row (header, temperatures and right column, footer), the details
//                     window, and the hidden worst-case sample the layout rules measure
//   html.js           the html`` tag the templates use: it escapes every value
//   styles.js         the CSS, one section per row
//   layout-fit.js     the adaptive steps for narrow cards, from measured widths
//   entities.js, config.js, schedule.js, status.js, states.js, tank-colors.js, device-page.js, icons.js
import { configForm, stubConfig, validateConfig } from './card/config.js';
import { FIELDS, deviceEntities } from './card/entities.js';
import { html, raw } from './card/html.js';
import { FIT_NONE, fitClasses, fitLayout, measureCard, measureSample } from './card/layout-fit.js';
import { scheduleView } from './card/schedule.js';
import { STYLE } from './card/styles.js';
import { cardBody } from './card/templates/card.js';
import { details } from './card/templates/details.js';
import { SAMPLE } from './card/templates/sample.js';
import { availability, buildView } from './card/view.js';

export class EzGeyserCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._last = null;
    this._fit = { ...FIT_NONE };
    // The details window is a native <dialog>, outside ha-card so the per-second re-render leaves it alone. HA's own
    // dialog elements are not a public API for cards.
    this.shadowRoot.innerHTML = String(html`
      <style>${raw(STYLE)}</style>
      <ha-card></ha-card>
      <div class="sample chips-icons" aria-hidden="true">${SAMPLE}</div>
      <dialog class="details" aria-labelledby="details-title"></dialog>`);
    this._card = this.shadowRoot.querySelector('ha-card');
    this._sample = this.shadowRoot.querySelector('.sample');
    this._dialog = this.shadowRoot.querySelector('dialog');
    // Fonts that load later, such as a theme's, change every width.
    this._remeasure = () => {
      this._sampleSize = null;
      this._fitKey = null;
      this._fitLayout();
    };

    this._card.addEventListener('click', (e) => this._onCardClick(e));
    this._dialog.addEventListener('click', (e) => this._onDialogClick(e));
    this._dialog.addEventListener('close', () =>
      this._card.querySelector('[data-action="schedule"]')?.focus({ preventScroll: true }),
    );

    // A new width is measured on the next frame, so the class changes never feed back into this observer's own loop.
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(([entry]) => {
        this._width = entry.contentRect.width;
        requestAnimationFrame(() => this._fitLayout());
      }).observe(this._card);
      // Observe the pill itself too: a smaller font can shrink it while the previous action size holds the row open.
      this._badgeResizeObserver = new ResizeObserver(() => requestAnimationFrame(() => this._fitLayout()));
    }
  }

  // Home Assistant's card API

  setConfig(config) {
    validateConfig(config);
    this._config = { ...config };
    this._ids = Object.fromEntries(
      Object.keys(FIELDS).map((key) => [key, config.device_id !== undefined ? null : config.entities?.[key] || null]),
    );
    this._last = null;
    this._signature = null;
    this._fitKey = null;
    this._resolveDevice();
    this._render();
  }

  set hass(value) {
    const entitiesChanged = value.entities !== this._hass?.entities;
    this._hass = value;
    if (entitiesChanged) this._resolveDevice();
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  static getConfigForm() {
    return configForm();
  }

  static getStubConfig(hass) {
    return stubConfig(hass);
  }

  connectedCallback() {
    this._fitLayout();
    // Widths measured with a fallback font are wrong once the web font arrives.
    if (typeof document !== 'undefined') {
      document.fonts?.ready.then(this._remeasure);
      document.fonts?.addEventListener('loadingdone', this._remeasure);
    }
  }

  disconnectedCallback() {
    this._badgeResizeObserver?.disconnect();
    this._headerBadge = null;
    if (typeof document !== 'undefined') document.fonts?.removeEventListener('loadingdone', this._remeasure);
  }

  // Which entities belong to the selected geyser. hass.entities is Home Assistant's entity registry, without disabled
  // entities; the frontend keeps it up to date, so renamed entities follow without a reload.
  _resolveDevice() {
    const entities = this._hass?.entities;
    if (!this._config || !entities) return;
    const config = this._config;
    // Legacy entity configurations use the registry relationship too. Explicit
    // mappings remain available for older dashboards, without guessing a prefix.
    const legacyTop = entities[config.entities?.top || config.entity];
    const deviceId = config.device_id || (legacyTop?.platform === 'ezgeyser' ? legacyTop.device_id : undefined);
    this._deviceId = deviceId;
    const resolved = deviceEntities(entities, deviceId);
    const ids = Object.fromEntries(
      Object.keys(FIELDS).map((key) => [
        key,
        config.device_id !== undefined ? resolved[key] : config.entities?.[key] || resolved[key] || null,
      ]),
    );
    if (JSON.stringify(ids) !== JSON.stringify(this._ids)) {
      this._ids = ids;
      this._signature = null;
      // Never display another selected device's cached readings.
      this._last = null;
    }
  }

  // Rendering

  _render() {
    if (!this._config || !this._hass) return;
    const hass = this._hass;
    const config = this._config;
    const dark = config.theme === 'dark' || (config.theme !== 'light' && Boolean(hass.themes?.darkMode));
    this.toggleAttribute('dark', dark);
    // A theme can bring its own font; it applies its styles on its own schedule, so measure again on the next frame.
    const theme = JSON.stringify([hass.themes?.theme, hass.selectedTheme]);
    if (this._theme !== undefined && theme !== this._theme && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(this._remeasure);
    }
    this._theme = theme;

    // Only render again when something the card shows has changed.
    const states = Object.fromEntries(Object.entries(this._ids).map(([key, id]) => [key, hass.states[id]]));
    const signature = JSON.stringify([
      dark,
      config.name,
      hass.locale,
      hass.config?.time_zone,
      hass.config?.unit_system,
      this._deviceId,
      hass.devices?.[this._deviceId],
      Object.values(states),
    ]);
    if (signature === this._signature) return;
    this._signature = signature;

    // While the geyser is unreachable, show the last complete readings.
    const status = availability(states, config);
    if (status.complete) this._last = states;
    const shown = status.unreachable && this._last ? this._last : states;

    this._schedule = status.unreachable ? null : scheduleView(states.next_event, hass);
    if (this._dialog.open) {
      if (this._schedule) this._showDetails();
      else this._dialog.close();
    }

    const view = buildView({
      config,
      hass,
      states,
      shown,
      status,
      deviceId: this._deviceId,
      ids: this._ids,
      last: this._last,
      schedule: this._schedule,
    });
    const body = String(cardBody(view));

    // Replacing the HTML loses focus; put it back on the same control.
    const active = this.shadowRoot.activeElement;
    const focused = active && this._card.contains?.(active) ? active.dataset : null;
    const classes = ['card', view.stale && 'stale', fitClasses(this._fit)].filter(Boolean).join(' ');
    this._card.innerHTML = String(html`<div class="${classes}">${raw(body)}</div>`);
    this._layout = body;
    this._fitLayout();
    const selector = focused?.action
      ? `[data-action="${focused.action}"]`
      : focused?.entity
        ? `[data-entity="${focused.entity}"]`
        : null;
    if (selector) this._card.querySelector(selector)?.focus({ preventScroll: true });
  }

  // Measures the natural widths once per new width or content, with every text at full length, and applies the
  // adaptive classes `fitLayout` picks. Classes only: the content is not rendered again. The observed card width keys
  // the cache, so an unchanged render costs no layout. The sample is measured once, then again after a font or theme
  // change.
  _fitLayout() {
    const card = this._card.querySelector('.card');
    if (!card?.getBoundingClientRect) return;
    this._sizeHeaderActions(card);

    const key = `${this._width} ${this._layout}`;
    if (this._width === 0 || key === this._fitKey) return;
    const width = card.querySelector('.header').getBoundingClientRect().width;
    if (!width) return;
    this._fitKey = key;

    const classes = (more) => ['card', card.classList.contains('stale') && 'stale', more].filter(Boolean).join(' ');
    card.className = classes('measure');
    this._sampleSize ||= measureSample(this._sample);
    this._fit = fitLayout({ width, ...this._sampleSize, ...measureCard(card) });
    card.className = classes(fitClasses(this._fit));
  }

  // The 3..21 paths plus their 2-unit stroke paint 20/24 of the canvas. A 120% SVG fills its square slot,
  // sized to 95% of the measured badge height; 10 px between slots is also 10 px between the painted edges.
  // Measured before the layout cache: font metrics can change the pill height without changing its text.
  _sizeHeaderActions(card) {
    const badge = card.querySelector('.badge');
    if (this._badgeResizeObserver && badge !== this._headerBadge) {
      if (this._headerBadge) this._badgeResizeObserver.unobserve(this._headerBadge);
      this._headerBadge = badge;
      if (badge) this._badgeResizeObserver.observe(badge);
    }
    const badgeHeight = badge?.getBoundingClientRect().height;
    if (badgeHeight > 0) card.style.setProperty('--header-action-size', `${badgeHeight * 0.95}px`);
  }

  // Actions

  _onCardClick(e) {
    // Native links keep browser keyboard, context-menu and long-press behavior, separate from HA details.
    if (e.target.closest('[data-action="device-page"]')) return;
    if (e.target.closest('[data-action="schedule"]')) return this._openDetails();
    if (e.target.closest('[data-action="flame-history"]')) return this._openHeatHistory('gas');
    if (e.target.closest('[data-action="electric-history"]')) return this._openHeatHistory('electric');
    const button = e.target.closest('[data-entity]');
    if (button) this._moreInfo(button.dataset.entity);
  }

  _onDialogClick(e) {
    // A click on the dialog itself, outside the sheet, is the backdrop.
    if (e.target === this._dialog || e.target.closest('[data-close]')) return this._dialog.close();
    const button = e.target.closest('[data-entity]');
    if (button) {
      this._dialog.close();
      this._moreInfo(button.dataset.entity);
    }
  }

  _openDetails() {
    if (!this._schedule) return;
    this._showDetails();
    if (!this._dialog.open) this._dialog.showModal();
  }

  _showDetails() {
    const content = String(details(this._schedule, this._config.show_heat_source !== false));
    if (content !== this._detailsHtml) {
      this._detailsHtml = content;
      this._dialog.innerHTML = content;
    }
  }

  // Opens the History page for the last six hours of the flame sensors or the electric elements.
  _openHeatHistory(kind) {
    const keys =
      kind === 'gas'
        ? ['burner_left', 'burner_right']
        : this._config?.element_count === 1
          ? ['element_1']
          : ['element_1', 'element_2'];
    // Use registry-resolved IDs so renamed entities still open the selected geyser's history.
    const ids = keys.map((key) => this._ids?.[key]).filter((entity) => entity && this._hass?.states[entity]);
    if (!ids.length) return;
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
    const query = new URLSearchParams({
      entity_id: ids.join(','),
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    });
    window.history.pushState(null, '', `/history?${query}`);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }

  _moreInfo(key = this._config?.main || 'top') {
    const id = this._ids?.[key];
    if (!id || !this._hass?.states[id]) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true }));
  }
}

if (!customElements.get('ezgeyser-card')) customElements.define('ezgeyser-card', EzGeyserCard);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'ezgeyser-card')) {
  window.customCards.push({
    type: 'ezgeyser-card',
    name: 'ezGeyser overview',
    description: 'Read-only tank temperatures, heating and sensor status.',
    documentationURL: 'https://github.com/basghar/home-assistant-ezgeyser#geyser-overview-card',
    preview: true,
  });
}
