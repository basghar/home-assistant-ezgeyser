/* ezGeyser overview card. No dependencies or direct device requests/writes. */
const FIELDS = {
  top: 'temperature_top', bottom: 'temperature_bottom', target: 'temperature_target',
  source: 'heating_source', top_ok: 'temperature_top_ok', bottom_ok: 'temperature_bottom_ok',
  burner_left: 'heating_burner_1', burner_right: 'heating_burner_2',
  element_1: 'heating_element_1', element_2: 'heating_element_2', boost: 'heating_boost_mode',
  vacation: 'heating_vacation_mode', next_event: 'next_scheduled_event',
};
// Added after the first releases: a card keeps working while these are missing.
const OPTIONAL = new Set(['next_event', 'vacation']);
const BINARY = new Set(['top_ok', 'bottom_ok', 'burner_left', 'burner_right', 'element_1', 'element_2', 'boost', 'vacation']);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PATHS = {
  check: 'M5 12l4 4L19 6', warning: 'M12 3L2 21h20L12 3Zm0 6v5m0 3v.1',
  target: 'M12 3v3m0 12v3M3 12h3m12 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  boost: 'M13 2 5 14h6l-1 8 9-12h-6l1-8Z',
  offline: 'M3 3l18 18M2 8a16 16 0 0 1 4-2m4-1a16 16 0 0 1 12 3M5 12a11 11 0 0 1 5-2m5 0a11 11 0 0 1 4 2M8 16a6 6 0 0 1 8 0M12 20h.01',
  info: 'M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  // Tabler calendar-time, calendar-off, beach and x (MIT), as in the Android app.
  calendarClock: 'M11.795 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M14 18a4 4 0 1 0 8 0a4 4 0 1 0-8 0m1-15v4M7 3v4m-4 4h16M18 16.496V18l1 1',
  calendarOff: 'M9 5h9a2 2 0 0 1 2 2v9m-.184 3.839A2 2 0 0 1 18 21H6a2 2 0 0 1-2-2V7a2 2 0 0 1 1.158-1.815M16 3v4M8 3v1m-4 7h7m4 0h5M3 3l18 18',
  beach: 'M17.553 16.75a7.5 7.5 0 0 0-10.606 0M18 3.804A6 6 0 0 0 9.804 6l10.392 6A6 6 0 0 0 18 3.804M16.732 10C18.39 7.13 18.957 4.356 18 3.804S14.925 5.13 13.268 8M15 9l-3 5.196M3 19.25A2.4 2.4 0 0 1 4 19a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 1 .25',
  close: 'M18 6L6 18M6 6l12 12',
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[name]}"/></svg>`;
}
function heatIcon(kind, first, second, count, known = true) {
  const on = known && (first || second);
  const text = !known ? `${kind === 'gas' ? 'Burner' : 'Elements'} status unknown`
    : kind === 'gas' ? first && second ? 'Burner both sides on' : first ? 'Burner left side on' : second ? 'Burner right side on' : 'Burner off'
    : count === 1 ? `Element ${on ? 'on' : 'off'}` : `Element 1 ${first ? 'on' : 'off'}, element 2 ${second ? 'on' : 'off'}`;
  const path = kind === 'gas' ? 'M12 2.5C12 2.5 5 9.5 5 14.5a7 7 0 0 0 14 0C19 9.5 12 2.5 12 2.5Z' : 'M13.6 2 5 13.4h6.2L10.2 22 19 10.4h-6.2L13.6 2Z';
  const bar = (x1, x2, active) => `<path d="M${x1} 21H${x2}" class="segment ${known && active ? 'lit' : ''}"/>`;
  return `<svg class="heat ${kind} ${on ? 'on' : ''}" viewBox="0 0 24 24" role="img" aria-label="${text}"><title>${text}</title><g transform="translate(3.6 .5) scale(.7)"><path class="glyph" d="${path}"/></g>${count === 1 ? bar(3.5,20.5,on) : bar(3.5,10.8,first)+bar(13.2,20.5,second)}</svg>`;
}
function heatControls(kind, first, second, count, known) {
  const keys = kind === 'gas' ? ['burner_left','burner_right'] : ['element_1','element_2'];
  const labels = kind === 'gas' ? ['Left flame sensor','Right flame sensor'] : ['Electric element 1','Electric element 2'];
  return `<div class="heat-control">${heatIcon(kind,first,second,count,known)}<div class="heat-buttons">${keys.slice(0,count).map((key,i) => `<button class="entity-button heat-button" data-entity="${key}" aria-label="Open ${labels[i]} details" title="Open ${labels[i]} details"></button>`).join('')}</div></div>`;
}
function numeric(state) {
  if (!state || ['unknown', 'unavailable', ''].includes(state.state)) return null;
  const n = Number(state.state);
  return Number.isFinite(n) ? n : null;
}
function celsius(state) {
  const n = numeric(state);
  if (n === null) return null;
  return state.attributes.unit_of_measurement === '°F' ? (n - 32) * 5 / 9
    : state.attributes.unit_of_measurement === 'K' ? n - 273.15 : n;
}
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
// The zone the user's profile shows times in: the browser's (default) or the server's.
function displayZone(hass) { return hass.locale?.time_zone === 'server' ? hass.config?.time_zone || undefined : undefined; }
function hour12(hass) { const format = hass.locale?.time_format; return format === '12' ? true : format === '24' ? false : undefined; }
function calendarDay(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(date).map(p => [p.type,p.value]));
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
}
// `repeat_days` is Sunday first (the integration's unverified order); shown Monday first.
function repeatText(days, lang) {
  if (!days?.length) return 'Once';
  if (days.length === 7) return 'Every day';
  const set = new Set(days);
  if (days.length === 5 && DAYS.slice(1,6).every(d => set.has(d))) return 'Weekdays';
  if (days.length === 2 && set.has('saturday') && set.has('sunday')) return 'Weekends';
  // 16 Nov 2026 is a Monday.
  return [...DAYS.slice(1),DAYS[0]].filter(d => set.has(d))
    .map(d => new Date(Date.UTC(2026,10,16 + (DAYS.indexOf(d)+6)%7)).toLocaleDateString(lang,{weekday:'short',timeZone:'UTC'})).join(', ');
}
// Everything the card line and the details window say about the next scheduled event; null when there is none.
function scheduleView(state, hass, now = new Date()) {
  if (!state || ['unknown','unavailable',''].includes(state.state)) return null;
  const date = new Date(state.state);
  if (Number.isNaN(date.getTime())) return null;
  const lang = hass.locale?.language || 'en', timeZone = displayZone(hass), a = state.attributes || {};
  const days = Math.max(0,Math.round((calendarDay(date,timeZone) - calendarDay(now,timeZone)) / 864e5));
  const off = a.heating_off === true;
  const target = typeof a.target_temperature === 'number' ? new Intl.NumberFormat(lang,{maximumFractionDigits:1}).format(a.target_temperature) : null;
  const unit = hass.config?.unit_system?.temperature || '°C';
  const time = date.toLocaleTimeString(lang,{hour:'numeric',minute:'2-digit',hour12:hour12(hass),timeZone});
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  const goal = off ? 'heating off' : target !== null ? `${target} ${unit}` : 'no target';
  const source = a.source === 'gas' ? 'Gas' : Number.isFinite(a.source_code) ? `Source ${a.source_code} (unverified)` : 'Unknown';
  // Switch-over moves from gas, the cheaper source, to electric.
  const switchOver = a.switch_over === true ? 'On, gas to electric' : a.switch_over === false ? 'Off' : 'Unknown';
  return {
    days, off, target, unit, time, source, switchOver,
    when: `${day} · ${date.toLocaleDateString(lang,{weekday:'short',day:'numeric',month:'short',timeZone})} · ${time}`,
    repeats: repeatText(Array.isArray(a.repeat_days) ? a.repeat_days : null,lang),
    spoken: `Next scheduled event ${day.toLowerCase()} at ${time}, ${off ? 'heating off' : target !== null ? `target ${target} degrees` : 'no target'}`,
    summary: (showSource) => `${day} ${time}: ${goal}${showSource ? `, ${source}, switch-over ${a.switch_over === true ? 'on' : a.switch_over === false ? 'off' : 'unknown'}` : ''}`,
  };
}
// The right column's second line: "6:00 AM [+1] → 60°", "→ Off" for an event that turns heating off, or "No schedule".
function scheduleLine(view, hasEntity, showSource) {
  const none = `${icon('calendarOff')}<span>No schedule</span>`;
  if (!view) return hasEntity ? `<button class="line quiet entity-button" data-entity="next_event" aria-label="No schedule. Open next scheduled event details">${none}</button>` : `<span class="line quiet">${none}</span>`;
  const value = view.off ? 'Off' : view.target !== null ? `${view.target}°` : null;
  return `<button class="line entity-button" data-action="schedule" aria-haspopup="dialog" aria-label="${escape(view.spoken)}" title="${escape(view.summary(showSource))}">${icon('calendarClock')}<span aria-hidden="true">${escape(view.time)}</span>${view.days > 0 ? `<span class="day-badge" aria-hidden="true">+${view.days}</span>` : ''}${value ? `<span class="quiet" aria-hidden="true">→</span><span class="value" aria-hidden="true">${escape(value)}</span>` : ''}</button>`;
}
function detailsHtml(view, showSource) {
  const row = (label, value) => `<div class="row"><dt>${label}</dt><dd>${escape(value)}</dd></div>`;
  const target = view.off ? 'Heating off' : view.target !== null ? `${view.target} ${view.unit}` : 'Not set';
  // The sheet takes the initial focus, so the close button isn't highlighted on open; Tab reaches the buttons.
  return `<div class="sheet" tabindex="-1" autofocus><header><h2 id="details-title">Next scheduled event</h2><button class="icon-button" data-close aria-label="Close">${icon('close')}</button></header>
    <p class="when">${escape(view.when)}</p>
    <dl>${row('Target',target)}${showSource ? row('Heat source',view.source) + row('Switch-over',view.switchOver) : ''}${row('Repeats',view.repeats)}</dl>
    <footer><button class="text-button" data-entity="next_event">History</button><button class="filled-button" data-close>Close</button></footer></div>`;
}
// Absolute hue anchors preserve the cool-to-hot meaning. A bounded relative
// lightness contrast makes a small top/bottom difference visible inside the tank.
function tankColors(top, bottom) {
  const anchors = [[20,220],[30,165],[40,40],[50,25],[60,12],[75,0]];
  function hue(t) {
    if (t <= 20) return 220;
    for (let i = 1; i < anchors.length; i++) {
      if (t <= anchors[i][0]) {
        const [a,h] = anchors[i-1], [b,j] = anchors[i];
        return h + (j-h)*(t-a)/(b-a);
      }
    }
    return 0;
  }
  const difference = top !== null && bottom !== null ? top-bottom : 0;
  // At a 1°C delta the halves differ by 24 lightness points; never exaggerate numbers.
  const contrast = Math.abs(difference) < .05 ? 0 : Math.min(18, 12 + Math.abs(difference)/3);
  return [top,bottom].map((t,i) => t === null ? 'var(--off)' : `hsl(${hue(t).toFixed(2)} 76% ${55 + (i === 0 ? 1 : -1)*Math.sign(difference)*contrast}%)`);
}
// The number's and the second line's line heights are trimmed to the glyphs, so the stretched tank runs from the top of
// the digits to the bottom of the second line.
const STYLE = `
:host{display:block;container-type:inline-size;--surface:#EFEDF4;--text:#1B1B1F;--secondary:#46464F;--tertiary:#77767F;--line:#DAD8E2;--off:#8E8C96;--ok:#1E6B3A;--ok-bg:#D4EEDB;--warn:#8A5100;--warn-bg:#FFDDB8;--primary:#3B57A6;--on-primary:#FFFFFF;--primary-bg:#DCE2FA;--dialog:#FBF8FF;--gas:#D9480F;--electric:#B86E00}
:host([dark]){--surface:#202024;--text:#E5E1E6;--secondary:#C6C5CF;--tertiary:#908F99;--line:#34343A;--off:#77767F;--ok:#9AD6A9;--ok-bg:#1E3826;--warn:#FFB95E;--warn-bg:#4A2B00;--primary:#B4C5FF;--on-primary:#13285E;--primary-bg:#2B3A66;--dialog:#2A2A2F;--gas:#FF8F57;--electric:#F2B33D}
*{box-sizing:border-box}ha-card{display:block;background:var(--ha-card-background,var(--surface));color:var(--text);border:1px solid var(--ha-card-border-color,var(--line));border-radius:var(--ha-card-border-radius,16px);box-shadow:var(--ha-card-box-shadow,none);font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif);overflow:hidden}
.card{padding:12px 14px;outline:none}.entity-button{font:inherit;color:inherit;background:none;border:0;padding:0;text-align:inherit;cursor:pointer}.entity-button:focus-visible{outline:2px solid var(--primary);outline-offset:2px;border-radius:3px}.card:focus-visible{outline:3px solid var(--primary);outline-offset:-3px;border-radius:16px}.header{display:flex;align-items:center;gap:8px;min-width:0}.name{margin:0;flex:1;min-width:0;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;max-width:60%;font-size:12px;font-weight:500;color:var(--ok);background:var(--ok-bg)}.badge span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.badge.warning{color:var(--warn);background:var(--warn-bg)}.icon{width:16px;height:16px;flex:none}.details-button{border:0;background:none;color:var(--tertiary);padding:0;min-width:28px;min-height:28px;display:grid;place-items:center;border-radius:50%;cursor:pointer}.details-button:focus-visible{outline:2px solid var(--primary)}
.temperatures{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,auto);gap:12px;align-items:center;margin:12px 0}.left{display:flex;align-items:stretch;gap:12px;min-width:0}.tank{width:9px;flex:none;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 0 1px var(--line)}.half{height:50%;flex:1}.half+.half{border-top:1px solid var(--surface)}.half.fault{background:repeating-linear-gradient(135deg,var(--off) 0 3px,var(--surface) 3px 5px)!important}.reading{display:flex;align-items:baseline;gap:4px;white-space:nowrap;line-height:.75}.number{font-size:32px;font-weight:500;letter-spacing:-1px;font-variant-numeric:tabular-nums}.unit{font-size:15px;color:var(--secondary)}.secondary{display:block;font-size:12px;line-height:.95;color:var(--secondary);margin-top:7px}.fault-text{color:var(--warn)}.right{display:flex;flex-direction:column;align-items:flex-end;gap:5px;min-width:0;font-size:12px;color:var(--secondary);text-align:right}.line{display:inline-flex;align-items:center;justify-content:flex-end;gap:4px;max-width:100%;min-height:18px;white-space:nowrap;overflow:hidden}.line .icon{width:14px;height:14px}.value{font-weight:500;color:var(--text)}.quiet{color:var(--tertiary)}.day-badge{display:inline-grid;place-items:center;flex:none;height:18px;min-width:18px;padding:0 4px;border-radius:9px;background:var(--primary);color:var(--on-primary);font-size:10px;font-weight:600;line-height:1}.modes{display:flex;gap:4px;flex:none}.chip{display:inline-flex;align-items:center;gap:3px;border-radius:8px;padding:2px 6px;font-size:11px;font-weight:500;background:var(--primary-bg);color:var(--primary)}.chip .icon{width:13px;height:13px}
.footer{border-top:1px solid var(--line);padding-top:8px;display:flex;align-items:center;gap:10px;min-height:31px;font-size:12px;color:var(--secondary)}.sources{display:flex;gap:6px;flex:none}.heat-control{position:relative;width:24px;height:24px;flex:none}.heat-buttons{position:absolute;inset:0;display:flex}.heat-button{flex:1;min-width:0;height:100%}.heat{width:24px;height:24px;color:var(--off);overflow:visible}.glyph{fill:none;stroke:currentColor;stroke-width:2.3;stroke-linejoin:round}.on .glyph{fill:currentColor}.gas.on{color:var(--gas)}.electric.on{color:var(--electric)}.segment{fill:none;stroke:var(--off);opacity:.55;stroke-width:2.6;stroke-linecap:round}.gas .lit{stroke:var(--gas);opacity:1}.electric .lit{stroke:var(--electric);opacity:1}.activity{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stale .number,.stale .unit,.stale .secondary{color:var(--tertiary)}.stale .tank{opacity:.45}.stale .right{color:var(--tertiary)}
@container(max-width:300px){.card{padding:10px}.name{font-size:14px}.temperatures{gap:8px}.number{font-size:28px}.header{gap:5px}.details-button{display:none}.footer{gap:6px}.right{font-size:11px}.badge{font-size:11px;padding:3px 6px}}
dialog.details{border:0;padding:0;margin:auto;width:min(360px,calc(100vw - 32px));max-height:calc(100vh - 32px);border-radius:24px;background:var(--dialog);color:var(--text);font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif);font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,.3)}dialog.details::backdrop{background:rgba(0,0,0,.45)}.sheet{padding:20px 20px 16px;outline:none}.sheet header{display:flex;align-items:center;gap:8px}.sheet h2{flex:1;margin:0;font-size:18px;font-weight:500}.icon-button{display:grid;place-items:center;width:40px;height:40px;margin:-8px -8px -8px 0;border:0;border-radius:50%;background:none;color:var(--secondary);cursor:pointer}.icon-button .icon{width:20px;height:20px}.when{margin:4px 0 12px;color:var(--secondary)}.sheet dl{margin:0;border-top:1px solid var(--line)}.row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line)}.row dt{color:var(--secondary)}.row dd{margin:0;font-weight:500;text-align:right}.sheet footer{display:flex;justify-content:space-between;gap:8px;margin-top:16px}.text-button,.filled-button{font:inherit;font-weight:500;min-height:40px;padding:0 16px;border-radius:20px;border:0;cursor:pointer}.text-button{background:none;color:var(--primary)}.filled-button{background:var(--primary);color:var(--on-primary)}.sheet button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
@media(max-width:600px){dialog.details{margin:auto 0 0;width:100vw;max-width:100vw;border-radius:24px 24px 0 0}.sheet{padding-bottom:max(16px,env(safe-area-inset-bottom))}}
@container(max-width:230px){.temperatures{grid-template-columns:minmax(0,1fr)}.right{align-items:flex-start;text-align:left;padding-left:21px}.line{justify-content:flex-start}.badge{max-width:50%}.number{font-size:26px}}
`;
class EzGeyserCard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'}); this._last = null;
    // The details window is a native <dialog>, outside ha-card so the per-second re-render leaves it alone. HA's own
    // dialog elements are not a public API for cards.
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card></ha-card><dialog class="details" aria-labelledby="details-title"></dialog>`;
    this._card = this.shadowRoot.querySelector('ha-card');
    this._dialog = this.shadowRoot.querySelector('dialog');
    this._card.addEventListener('click', e => {
      if (e.target.closest('[data-action="schedule"]')) return this._openDetails();
      const button = e.target.closest('[data-entity]');
      if (button) this._moreInfo(button.dataset.entity);
    });
    this._dialog.addEventListener('click', e => {
      // A click on the dialog itself, outside the sheet, is the backdrop.
      if (e.target === this._dialog || e.target.closest('[data-close]')) return this._dialog.close();
      const button = e.target.closest('[data-entity]');
      if (button) { this._dialog.close(); this._moreInfo(button.dataset.entity); }
    });
    this._dialog.addEventListener('close', () => this._card.querySelector('[data-action="schedule"]')?.focus({preventScroll:true}));
  }
  _openDetails() {
    if (!this._schedule) return;
    this._showDetails();
    if (!this._dialog.open) this._dialog.showModal();
  }
  _showDetails() {
    const html = detailsHtml(this._schedule,this._config.show_heat_source !== false);
    if (html !== this._detailsHtml) { this._detailsHtml = html; this._dialog.innerHTML = html; }
  }
  setConfig(config) {
    if (config.device_id !== undefined && typeof config.device_id !== 'string') throw new Error('device_id must be a Home Assistant device ID');
    if (config.device_id === undefined && !config.entity && !config.entities?.top) throw new Error('Select an ezGeyser device');
    if (config.main && !['top','bottom'].includes(config.main)) throw new Error('main must be top or bottom');
    if (config.element_count !== undefined && ![1,2].includes(config.element_count)) throw new Error('element_count must be 1 or 2');
    if (config.theme && !['auto','light','dark'].includes(config.theme)) throw new Error('theme must be auto, light or dark');
    if (config.show_heat_source !== undefined && typeof config.show_heat_source !== 'boolean') throw new Error('show_heat_source must be true or false');
    for (const [key,id] of Object.entries(config.entities || {})) {
      if (!(key in FIELDS) || typeof id !== 'string' || !id.startsWith(`${BINARY.has(key) ? 'binary_sensor' : 'sensor'}.`)) throw new Error(`Invalid entity mapping: ${key}`);
    }
    this._config = {...config};
    this._ids = Object.fromEntries(Object.keys(FIELDS).map(key => [key,config.device_id !== undefined ? null : config.entities?.[key] || null]));
    this._last = null; this._signature = null;
    this._resolveDevice(); this._loadRegistry(); this._render();
  }
  set hass(value) { this._hass = value; this._loadRegistry(); this._subscribeRegistry(); this._render(); }
  getCardSize() { return 3; }
  getGridOptions() { return {columns:12,rows:'auto',min_columns:6}; }
  static getConfigForm() {
    return {
      schema: [
        {name:'device_id',required:true,selector:{device:{filter:[{integration:'ezgeyser'}]}}},
        {name:'name',selector:{text:{}}},
        {name:'main',selector:{select:{options:['top','bottom']}}},
        {name:'element_count',selector:{number:{min:1,max:2,step:1,mode:'box'}}},
        {name:'theme',selector:{select:{options:['auto','light','dark']}}},
        {name:'show_heat_source',default:true,selector:{boolean:{}}},
      ],
      computeLabel: field => ({device_id:'Geyser',name:'Name (optional)',main:'Main temperature',element_count:'Electric elements',theme:'Theme',show_heat_source:'Show heat source and switch-over in schedule details'})[field.name],
      computeHelper: field => field.name === 'show_heat_source' ? 'Turn off for a gas-only or electric-only geyser.' : undefined,
      assertConfig: config => {
        if (config.entity || config.entities) throw new Error('This legacy card uses entity mappings. Use YAML, or replace them with device_id to use the device selector.');
      },
    };
  }
  static async getStubConfig(hass) {
    try {
      const entries = await hass.callWS({type:'config/entity_registry/list'});
      const first = entries.find(e => e.platform === 'ezgeyser' && e.device_id && !e.disabled_by);
      return {device_id:first?.device_id || ''};
    } catch { return {device_id:''}; }
  }
  connectedCallback() { this._loadRegistry(); this._subscribeRegistry(); }
  disconnectedCallback() {
    this._registryEpoch = (this._registryEpoch || 0) + 1;
    this._registryUnsubscribe?.();
    this._registryUnsubscribe = undefined;
    this._registrySubscriptionPending = false;
    this._registryLoading = false;
    this._registry = undefined;
  }
  async _loadRegistry() {
    if (!this._hass?.callWS || this._registryLoading || this._registry !== undefined) return;
    this._registryLoading = true;
    this._registryDirty = false;
    const epoch = this._registryEpoch || 0;
    try {
      const entries = await this._hass.callWS({type:'config/entity_registry/list'});
      if (epoch !== (this._registryEpoch || 0)) return;
      this._registry = entries;
      this._registryError = false;
    } catch {
      if (epoch !== (this._registryEpoch || 0)) return;
      this._registry = [];
      this._registryError = true;
    }
    this._registryLoading = false;
    this._resolveDevice();
    this._render();
    if (this._registryDirty) { this._registry = undefined; this._loadRegistry(); }
  }
  _subscribeRegistry() {
    const connection = this._hass?.connection;
    if (!this.isConnected || !connection?.subscribeMessage || this._registryUnsubscribe || this._registrySubscriptionPending) return;
    this._registrySubscriptionPending = true;
    const epoch = this._registryEpoch || 0;
    connection.subscribeMessage(() => {
      this._registryDirty = true;
      this._registry = undefined;
      this._loadRegistry();
    },{type:'subscribe_events',event_type:'entity_registry_updated'}).then(unsubscribe => {
      if (!this.isConnected || epoch !== (this._registryEpoch || 0)) unsubscribe();
      else { this._registryUnsubscribe = unsubscribe; this._registrySubscriptionPending = false; }
    }).catch(() => { this._registrySubscriptionPending = false; });
  }
  _resolveDevice() {
    if (!this._config || this._registry === undefined) return;
    const config = this._config;
    // Legacy entity configurations use the registry relationship too. Explicit
    // mappings remain available for older dashboards, without guessing a prefix.
    const deviceId = config.device_id || this._registry.find(e => e.entity_id === (config.entities?.top || config.entity) && e.platform === 'ezgeyser')?.device_id;
    this._deviceId = deviceId;
    const resolved = deviceEntities(this._registry,deviceId);
    const ids = Object.fromEntries(Object.keys(FIELDS).map(key => [key,
      config.device_id !== undefined ? resolved[key] : config.entities?.[key] || resolved[key] || null,
    ]));
    if (JSON.stringify(ids) !== JSON.stringify(this._ids)) {
      this._ids = ids;
      this._signature = null;
      // Never display another selected device's cached readings.
      this._last = null;
    }
  }
  _moreInfo(key = this._config?.main || 'top') {
    const id = this._ids?.[key];
    if (!id || !this._hass?.states[id]) return;
    this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:id},bubbles:true,composed:true}));
  }
  _render() {
    if (!this._config || !this._hass) return;
    const hass = this._hass, config = this._config;
    const dark = config.theme === 'dark' || (config.theme !== 'light' && Boolean(hass.themes?.darkMode));
    this.toggleAttribute('dark',dark);
    const states = Object.fromEntries(Object.entries(this._ids).map(([key,id]) => [key,hass.states[id]]));
    const signature = JSON.stringify([dark,config.name,hass.locale,hass.config?.time_zone,hass.config?.unit_system,this._registryError,this._registry === undefined,this._deviceId,hass.devices?.[this._deviceId],Object.values(states)]);
    if (signature === this._signature) return;
    this._signature = signature;
    const required = Object.keys(FIELDS).filter(key => !OPTIONAL.has(key) && (config.element_count !== 1 || key !== 'element_2'));
    const missing = required.some(key => !states[key]);
    const unreachable = required.some(key => states[key]?.state === 'unavailable');
    const unknown = required.some(key => states[key]?.state === 'unknown'
      && !(key === 'top' && states.top_ok?.state === 'off')
      && !(key === 'bottom' && states.bottom_ok?.state === 'off')
      && !(key === 'source' && Number.isFinite(states.source?.attributes.source_code)));
    if (!missing && !unreachable && !unknown) this._last = states;
    const shown = unreachable && this._last ? this._last : states;
    const on = key => shown[key]?.state === 'on';
    const fault = key => shown[`${key}_ok`]?.state === 'off';
    const number = key => fault(key) ? null : numeric(shown[key]);
    const main = config.main || 'top', other = main === 'top' ? 'bottom' : 'top';
    const display = key => {
      const n = number(key);
      return n === null ? '—' : new Intl.NumberFormat(hass.locale?.language || 'en',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
    };
    const top = fault('top') ? null : celsius(shown.top), bottom = fault('bottom') ? null : celsius(shown.bottom);
    const colors = tankColors(top,bottom);
    const issues = ['top','bottom'].filter(fault).map(key => `${key === 'top' ? 'Top' : 'Bottom'} sensor`);
    let badge = issues.length > 1 ? `${issues.length} issues` : issues[0] || 'Sensors OK';
    if (unknown) badge = 'Status unknown';
    if (missing) badge = this._registryError ? 'Registry unavailable' : this._registry === undefined ? 'Loading entities' : 'Check entities';
    if (config.device_id === '') badge = 'Select geyser';
    if (unreachable) badge = 'Unreachable';
    const warning = missing || unreachable || unknown || issues.length > 0;
    const name = config.name || hass.devices?.[this._deviceId]?.name_by_user || hass.devices?.[this._deviceId]?.name || this._ids.top?.replace(/^sensor\./,'').replace(/_temperature_top$/,'').replaceAll('_',' ') || 'Geyser';
    const unit = shown[main]?.attributes.unit_of_measurement || '°C';
    const target = numeric(shown.target), noTarget = celsius(shown.target);
    const targetLine = target === null ? '<span class="quiet">Target unknown</span>' : Math.abs(noTarget) < .01 ? '<span class="quiet">No target</span>'
      : `${icon('target')}<span>Target</span><span class="value">${escape(new Intl.NumberFormat(hass.locale?.language || 'en',{maximumFractionDigits:1}).format(target))}${escape(shown.target.attributes.unit_of_measurement || '°C')}</span>`;
    const showSource = config.show_heat_source !== false;
    this._schedule = unreachable ? null : scheduleView(states.next_event,hass);
    if (this._dialog.open) this._schedule ? this._showDetails() : this._dialog.close();
    const heatingKnown = !missing && !unknown && !unreachable;
    const left = on('burner_left'), right = on('burner_right'), el1 = on('element_1'), el2 = on('element_2');
    const heating = left || right || el1 || el2;
    const code = shown.source?.attributes.source_code;
    const source = shown.source?.state === 'gas' ? 'Gas' : Number.isFinite(code) ? `Source ${code}?` : 'Source unknown';
    const activity = !heatingKnown ? 'Heating status unknown' : heating ? 'Heating' : `Idle · ${source}`;
    // last_updated is an HA state timestamp, not the last successful poll time.
    const lastTime = this._last ? Object.values(this._last).map(s => s?.last_updated).filter(Boolean).sort().at(-1) : null;
    const updated = lastTime ? new Date(lastTime).toLocaleString(hass.locale?.language || 'en') : null;
    const tankLabel = `Top ${display('top')} ${shown.top?.attributes.unit_of_measurement || '°C'}${fault('top') ? ', sensor fault' : ''}; Bottom ${display('bottom')} ${shown.bottom?.attributes.unit_of_measurement || '°C'}${fault('bottom') ? ', sensor fault' : ''}. Colours emphasize the relative temperature difference.`;
    const active = this.shadowRoot.activeElement;
    const focused = active && this._card.contains?.(active) ? active.dataset : null;
    const modes = [on('boost') ? `<button class="chip entity-button" data-entity="boost" aria-label="Boost on. Open boost details">${icon('boost')}Boost</button>` : '',
      on('vacation') ? `<button class="chip entity-button" data-entity="vacation" aria-label="Vacation on. Open vacation details">${icon('beach')}Vacation</button>` : ''].join('');
    this._card.innerHTML = `<div class="card ${unreachable ? 'stale' : ''}">
      <div class="header"><h2 class="name" title="${escape(name)}">${escape(name)}</h2><div class="badge ${warning ? 'warning' : ''}" title="${escape(issues.join(', ') || badge)}">${icon(unreachable ? 'offline' : warning ? 'warning' : 'check')}<span>${escape(badge)}</span></div><button class="details-button entity-button" data-entity="${main}" aria-label="Open main temperature details">${icon('info')}</button></div>
      <div class="temperatures"><div class="left"><div class="tank" role="group" aria-label="${escape(tankLabel)}" title="${escape(tankLabel)}"><button class="half entity-button ${top === null ? 'fault' : ''}" data-entity="top" aria-label="Open top temperature details" style="background:${colors[0]}"></button><button class="half entity-button ${bottom === null ? 'fault' : ''}" data-entity="bottom" aria-label="Open bottom temperature details" style="background:${colors[1]}"></button></div>
      <div><button class="reading entity-button" data-entity="${main}" aria-label="Open ${main} temperature details"><span class="number ${number(main) === null ? 'fault-text' : ''}">${escape(display(main))}</span><span class="unit">${escape(unit)}</span></button><button data-entity="${other}" aria-label="Open ${other} temperature details" class="secondary entity-button ${number(other) === null ? 'fault-text' : ''}">${other === 'top' ? 'Top' : 'Bottom'} ${escape(display(other))}${escape(shown[other]?.attributes.unit_of_measurement || '°C')}</button></div></div>
      <div class="right">${unreachable ? 'Last known values' : `<button class="line entity-button" data-entity="target" aria-label="Open target temperature details">${targetLine}</button>${scheduleLine(this._schedule,Boolean(states.next_event),showSource)}`}</div></div>
      <div class="footer">${unreachable ? `<span class="activity">${updated ? `Last available ${escape(updated)}` : 'No previous values available'}</span><span>Open details</span>` : `<div class="sources">${heatControls('gas',left,right,2,heatingKnown)}${heatControls('electric',el1,el2,config.element_count || 2,heatingKnown)}</div><span class="activity">${!heating && heatingKnown ? `<button class="entity-button" data-entity="source" aria-label="Open heating source details">${escape(activity)}</button>` : escape(activity)}</span>${modes ? `<span class="modes">${modes}</span>` : ''}`}</div></div>`;
    const selector = focused?.action ? `[data-action="${focused.action}"]` : focused?.entity ? `[data-entity="${focused.entity}"]` : null;
    if (selector) this._card.querySelector(selector)?.focus({preventScroll:true});
  }
}
// Entity IDs and translated names can change; device membership and the
// integration's stable unique-ID suffix identify each function.
function deviceEntities(registry, deviceId) {
  const entries = deviceId ? registry.filter(e => e.device_id === deviceId && e.platform === 'ezgeyser' && !e.disabled_by) : [];
  return Object.fromEntries(Object.entries(FIELDS).map(([key,suffix]) => [key,
    entries.find(e => e.unique_id?.endsWith(`_${suffix}`))?.entity_id || null,
  ]));
}

if (!customElements.get('ezgeyser-card')) customElements.define('ezgeyser-card',EzGeyserCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'ezgeyser-card')) window.customCards.push({type:'ezgeyser-card',name:'ezGeyser overview',description:'Read-only tank temperatures, heating and sensor status.',documentationURL:'https://github.com/basghar/home-assistant-ezgeyser#geyser-overview-card',preview:true});
