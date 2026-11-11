/* ezGeyser overview card. No dependencies, network calls or device writes. */
const FIELDS = {
  top: 'temperature_top', bottom: 'temperature_bottom', target: 'temperature_target',
  source: 'heating_source', top_ok: 'temperature_top_ok', bottom_ok: 'temperature_bottom_ok',
  burner_left: 'heating_burner_1', burner_right: 'heating_burner_2',
  element_1: 'heating_element_1', element_2: 'heating_element_2', boost: 'heating_boost_mode',
};
const BINARY = new Set(['top_ok', 'bottom_ok', 'burner_left', 'burner_right', 'element_1', 'element_2', 'boost']);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PATHS = {
  check: 'M5 12l4 4L19 6', warning: 'M12 3L2 21h20L12 3Zm0 6v5m0 3v.1',
  target: 'M12 3v3m0 12v3M3 12h3m12 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  boost: 'M13 2 5 14h6l-1 8 9-12h-6l1-8Z',
  offline: 'M3 3l18 18M2 8a16 16 0 0 1 4-2m4-1a16 16 0 0 1 12 3M5 12a11 11 0 0 1 5-2m5 0a11 11 0 0 1 4 2M8 16a6 6 0 0 1 8 0M12 20h.01',
  info: 'M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
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
const STYLE = `
:host{display:block;container-type:inline-size;--surface:#EFEDF4;--text:#1B1B1F;--secondary:#46464F;--tertiary:#77767F;--line:#DAD8E2;--off:#8E8C96;--ok:#1E6B3A;--ok-bg:#D4EEDB;--warn:#8A5100;--warn-bg:#FFDDB8;--primary:#3B57A6;--primary-bg:#DCE2FA;--gas:#D9480F;--electric:#B86E00}
:host([dark]){--surface:#202024;--text:#E5E1E6;--secondary:#C6C5CF;--tertiary:#908F99;--line:#34343A;--off:#77767F;--ok:#9AD6A9;--ok-bg:#1E3826;--warn:#FFB95E;--warn-bg:#4A2B00;--primary:#B4C5FF;--primary-bg:#2B3A66;--gas:#FF8F57;--electric:#F2B33D}
*{box-sizing:border-box}ha-card{display:block;background:var(--ha-card-background,var(--surface));color:var(--text);border:1px solid var(--ha-card-border-color,var(--line));border-radius:var(--ha-card-border-radius,16px);box-shadow:var(--ha-card-box-shadow,none);font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif);overflow:hidden}
.card{padding:12px 14px;cursor:pointer;outline:none}.card:focus-visible{outline:3px solid var(--primary);outline-offset:-3px;border-radius:16px}.header{display:flex;align-items:center;gap:8px;min-width:0}.name{margin:0;flex:1;min-width:0;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;max-width:60%;font-size:12px;font-weight:500;color:var(--ok);background:var(--ok-bg)}.badge span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.badge.warning{color:var(--warn);background:var(--warn-bg)}.icon{width:16px;height:16px;flex:none}.details-button{border:0;background:none;color:var(--tertiary);padding:0;min-width:28px;min-height:28px;display:grid;place-items:center;border-radius:50%;cursor:pointer}.details-button:focus-visible{outline:2px solid var(--primary)}
.temperatures{display:grid;grid-template-columns:9px minmax(0,1fr) minmax(0,auto);gap:12px;align-items:center;margin:12px 0}.tank{height:46px;width:9px;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 0 1px var(--line)}.half{height:50%;flex:1}.half+.half{border-top:1px solid var(--surface)}.half.fault{background:repeating-linear-gradient(135deg,var(--off) 0 3px,var(--surface) 3px 5px)!important}.reading{display:flex;align-items:baseline;gap:4px;white-space:nowrap;line-height:1.15}.number{font-size:32px;font-weight:500;letter-spacing:-1px;font-variant-numeric:tabular-nums}.unit{font-size:15px;color:var(--secondary)}.secondary{font-size:12px;color:var(--secondary);margin-top:4px}.fault-text{color:var(--warn)}.right{text-align:right;min-width:0;font-size:12px;color:var(--secondary)}.target{display:flex;justify-content:flex-end;align-items:center;gap:4px;flex-wrap:wrap}.chips{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:4px;margin-top:5px}.chip{display:inline-flex;align-items:center;gap:3px;border-radius:8px;padding:2px 6px;background:var(--primary-bg);color:var(--primary)}.chip .icon{width:13px;height:13px}
.footer{border-top:1px solid var(--line);padding-top:8px;display:flex;align-items:center;gap:10px;min-height:31px;font-size:12px;color:var(--secondary);flex-wrap:wrap}.sources{display:flex;gap:6px;flex:none}.heat{width:24px;height:24px;color:var(--off);overflow:visible}.glyph{fill:none;stroke:currentColor;stroke-width:2.3;stroke-linejoin:round}.on .glyph{fill:currentColor}.gas.on{color:var(--gas)}.electric.on{color:var(--electric)}.segment{fill:none;stroke:var(--off);opacity:.55;stroke-width:2.6;stroke-linecap:round}.gas .lit{stroke:var(--gas);opacity:1}.electric .lit{stroke:var(--electric);opacity:1}.activity{flex:1;min-width:0}.status-label{display:inline-flex;align-items:center;gap:4px;color:var(--tertiary)}.stale .number,.stale .unit,.stale .secondary{color:var(--tertiary)}.stale .tank{opacity:.45}.stale .right{color:var(--tertiary)}
@container(max-width:300px){.card{padding:10px}.name{font-size:14px}.temperatures{gap:8px}.number{font-size:28px}.header{gap:5px}.details-button{display:none}.footer{gap:6px}.right{font-size:11px}.badge{font-size:11px;padding:3px 6px}}
@container(max-width:230px){.temperatures{grid-template-columns:8px minmax(0,1fr)}.right{grid-column:2;text-align:left}.target,.chips{justify-content:flex-start}.badge{max-width:50%}.number{font-size:26px}}
`;
class EzGeyserCard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'}); this._last = null;
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card></ha-card>`;
    this._card = this.shadowRoot.querySelector('ha-card');
    this._card.addEventListener('click', () => this._moreInfo());
    this._card.addEventListener('keydown', e => {
      if (e.target.classList.contains('card') && ['Enter',' '].includes(e.key)) { e.preventDefault(); this._moreInfo(); }
    });
  }
  setConfig(config) {
    if (!/^sensor\..+_temperature_(top|bottom)$/.test(config.entity || '') && !config.entities?.top) {
      throw new Error('Set entity to this geyser’s top/bottom temperature sensor, or provide entities.top.');
    }
    if (config.main && !['top','bottom'].includes(config.main)) throw new Error('main must be top or bottom');
    if (config.element_count !== undefined && ![1,2].includes(config.element_count)) throw new Error('element_count must be 1 or 2');
    if (config.theme && !['auto','light','dark'].includes(config.theme)) throw new Error('theme must be auto, light or dark');
    for (const [key,id] of Object.entries(config.entities || {})) {
      if (!(key in FIELDS) || typeof id !== 'string' || !id.startsWith(`${BINARY.has(key) ? 'binary_sensor' : 'sensor'}.`)) throw new Error(`Invalid entity mapping: ${key}`);
    }
    const prefix = config.entity?.replace(/^sensor\./,'').replace(/_temperature_(top|bottom)$/,'');
    this._config = {...config};
    this._ids = Object.fromEntries(Object.entries(FIELDS).map(([key,suffix]) => [key, config.entities?.[key] || (prefix ? `${BINARY.has(key) ? 'binary_sensor' : 'sensor'}.${prefix}_${suffix}` : null)]));
    this._last = null; this._signature = null; this._render();
  }
  set hass(value) { this._hass = value; this._render(); }
  getCardSize() { return 3; }
  getGridOptions() { return {columns:12,rows:'auto',min_columns:6}; }
  static getConfigElement() { return document.createElement('ezgeyser-card-editor'); }
  static async getStubConfig(hass) {
    if (hass.callWS) {
      try {
        const entries = await hass.callWS({type:'config/entity_registry/list'});
        const first = entries.find(e => e.platform === 'ezgeyser' && e.unique_id?.endsWith('_temperature_top') && !e.disabled_by);
        if (first) return registryConfig(entries,first.entity_id);
      } catch { /* Fall back to state IDs when registry access is unavailable. */ }
    }
    return {entity: Object.keys(hass.states).find(id => /^sensor\..+_temperature_top$/.test(id)) || 'sensor.kitchen_temperature_top'};
  }
  _moreInfo() {
    if (!this._config) return;
    this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:this._ids[this._config.main || 'top']},bubbles:true,composed:true}));
  }
  _render() {
    if (!this._config || !this._hass) return;
    const hass = this._hass, config = this._config;
    const dark = config.theme === 'dark' || (config.theme !== 'light' && Boolean(hass.themes?.darkMode));
    this.toggleAttribute('dark',dark);
    const states = Object.fromEntries(Object.entries(this._ids).map(([key,id]) => [key,hass.states[id]]));
    const signature = JSON.stringify([dark,config.name,hass.locale,Object.values(states)]);
    if (signature === this._signature) return;
    this._signature = signature;
    const required = Object.keys(FIELDS).filter(key => config.element_count !== 1 || key !== 'element_2');
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
    if (missing) badge = 'Check entities';
    if (unreachable) badge = 'Unreachable';
    const warning = missing || unreachable || unknown || issues.length > 0;
    const name = config.name || hass.devices?.[hass.entities?.[this._ids.top]?.device_id]?.name_by_user || hass.devices?.[hass.entities?.[this._ids.top]?.device_id]?.name || this._ids.top?.replace(/^sensor\./,'').replace(/_temperature_top$/,'').replaceAll('_',' ') || 'Geyser';
    const unit = shown[main]?.attributes.unit_of_measurement || '°C';
    const target = numeric(shown.target), noTarget = celsius(shown.target);
    const targetText = target === null ? 'Target unknown' : Math.abs(noTarget) < .01 ? 'No target' : `Target ${new Intl.NumberFormat(hass.locale?.language || 'en',{maximumFractionDigits:1}).format(target)}${shown.target.attributes.unit_of_measurement || '°C'}`;
    const heatingKnown = !missing && !unknown && !unreachable;
    const left = on('burner_left'), right = on('burner_right'), el1 = on('element_1'), el2 = on('element_2');
    const heating = left || right || el1 || el2;
    const code = shown.source?.attributes.source_code;
    const source = shown.source?.state === 'gas' ? 'Gas' : Number.isFinite(code) ? `Source ${code}?` : 'Source unknown';
    const activity = !heatingKnown ? 'Heating status unknown' : heating ? 'Heating' : `Idle · ${source}`;
    // last_updated is an HA state timestamp, not the last successful poll time.
    const lastTime = this._last ? Object.values(this._last).map(s => s.last_updated).filter(Boolean).sort().at(-1) : null;
    const updated = lastTime ? new Date(lastTime).toLocaleString(hass.locale?.language || 'en') : null;
    const tankLabel = `Top ${display('top')} ${shown.top?.attributes.unit_of_measurement || '°C'}${fault('top') ? ', sensor fault' : ''}; Bottom ${display('bottom')} ${shown.bottom?.attributes.unit_of_measurement || '°C'}${fault('bottom') ? ', sensor fault' : ''}. Colours emphasize the relative temperature difference.`;
    const restoreFocus = this.shadowRoot.activeElement?.classList.contains('card');
    this._card.innerHTML = `<div class="card ${unreachable ? 'stale' : ''}" role="button" tabindex="0" aria-label="${escape(name)}, ${escape(badge)}. Open temperature details">
      <div class="header"><h2 class="name" title="${escape(name)}">${escape(name)}</h2><div class="badge ${warning ? 'warning' : ''}" title="${escape(issues.join(', ') || badge)}">${icon(unreachable ? 'offline' : warning ? 'warning' : 'check')}<span>${escape(badge)}</span></div><span class="details-button" aria-hidden="true">${icon('info')}</span></div>
      <div class="temperatures"><div class="tank" role="img" aria-label="${escape(tankLabel)}" title="${escape(tankLabel)}"><div class="half ${top === null ? 'fault' : ''}" style="background:${colors[0]}"></div><div class="half ${bottom === null ? 'fault' : ''}" style="background:${colors[1]}"></div></div>
      <div><div class="reading"><span class="number ${number(main) === null ? 'fault-text' : ''}">${escape(display(main))}</span><span class="unit">${escape(unit)}</span></div><div class="secondary ${number(other) === null ? 'fault-text' : ''}">${other === 'top' ? 'Top' : 'Bottom'} ${escape(display(other))}${escape(shown[other]?.attributes.unit_of_measurement || '°C')}</div></div>
      <div class="right">${unreachable ? 'Last known values' : `<div class="target">${target !== null && Math.abs(noTarget) >= .01 ? icon('target') : ''}${escape(targetText)}</div>${on('boost') ? `<div class="chips"><span class="chip">${icon('boost')}Boost</span></div>` : ''}`}</div></div>
      <div class="footer">${unreachable ? `<span class="activity">${updated ? `Last available ${escape(updated)}` : 'No previous values available'}</span><span>Open details</span>` : `<div class="sources">${heatIcon('gas',left,right,2,heatingKnown)}${heatIcon('electric',el1,el2,config.element_count || 2,heatingKnown)}</div><span class="activity">${escape(activity)}</span><span class="status-label">${issues.length ? icon('warning') : ''}${issues.length ? 'Sensor fault' : 'Read-only'}</span>`}</div></div>`;
    if (restoreFocus) this._card.querySelector('.card').focus({preventScroll:true});
  }
}
// Resolve by registry identity, so selecting a device also works with renamed entities.
function registryConfig(registry, entity) {
  const anchor = registry.find(e => e.entity_id === entity && e.platform === 'ezgeyser');
  if (!anchor) return {entity};
  const entries = registry.filter(e => e.device_id === anchor.device_id && e.platform === 'ezgeyser');
  const entities = {};
  for (const [key,suffix] of Object.entries(FIELDS)) {
    const match = entries.find(e => e.unique_id?.endsWith(`_${suffix}`));
    if (match) entities[key] = match.entity_id;
  }
  return {entity,entities};
}
class EzGeyserCardEditor extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'});
    this.shadowRoot.addEventListener('change', e => this._change(e));
  }
  setConfig(config) { this._config = {...config}; this._render(); }
  set hass(hass) {
    this._hass = hass;
    if (!this._loading && hass.callWS) {
      this._loading = true;
      hass.callWS({type:'config/entity_registry/list'}).then(entries => {
        this._registry = entries; this._render();
      }).catch(() => { this._registry = []; this._render(); });
    }
    this._render();
  }
  _change(event) {
    const key = event.target.name;
    if (!key) return;
    const config = {...this._config};
    if (key === 'entity') {
      // Discard mappings from the previous device when selecting another geyser.
      delete config.entities;
      Object.assign(config,registryConfig(this._registry || [],event.target.value));
    } else if (key === 'element_count') config[key] = Number(event.target.value);
    else if (event.target.value) config[key] = event.target.value;
    else delete config[key];
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed',{detail:{config},bubbles:true,composed:true}));
  }
  _render() {
    if (!this._config || !this._hass) return;
    const c = this._config, hass = this._hass;
    const registered = (this._registry || []).filter(e => e.platform === 'ezgeyser' && e.unique_id?.endsWith('_temperature_top') && !e.disabled_by);
    const ids = registered.length ? registered.map(e => e.entity_id) : Object.keys(hass.states).filter(id => /^sensor\..+_temperature_top$/.test(id));
    const selected = c.entities?.top || c.entity;
    if (selected && !ids.includes(selected)) ids.unshift(selected);
    const signature = JSON.stringify([c,ids.map(id => [id,hass.states[id]?.attributes.friendly_name])]);
    if (signature === this._editorSignature) return;
    this._editorSignature = signature;
    const option = (value,label,current) => `<option value="${escape(value)}" ${String(value) === String(current) ? 'selected' : ''}>${escape(label)}</option>`;
    this.shadowRoot.innerHTML = `<style>:host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif)}label{display:grid;gap:6px;margin:0 0 16px;font-size:14px}select,input{box-sizing:border-box;width:100%;min-height:44px;padding:10px;border:1px solid var(--divider-color,#888);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#111);font:inherit}p{font-size:13px;color:var(--secondary-text-color)}</style>
      <label>Geyser<select name="entity"><option value="" disabled ${selected ? '' : 'selected'}>Select a geyser</option>${ids.map(id => option(id,hass.states[id]?.attributes.friendly_name || id,selected)).join('')}</select></label>
      <label>Name (optional)<input name="name" value="${escape(c.name || '')}" placeholder="Use the device name"></label>
      <label>Main temperature<select name="main">${option('top','Top',c.main || 'top')}${option('bottom','Bottom',c.main || 'top')}</select></label>
      <label>Electric elements<select name="element_count">${option(2,'Two',c.element_count || 2)}${option(1,'One',c.element_count || 2)}</select></label>
      <label>Theme<select name="theme">${['auto','light','dark'].map(v => option(v,v[0].toUpperCase()+v.slice(1),c.theme || 'auto')).join('')}</select></label>
      <p>${ids.length ? 'Read-only. Selecting a geyser configures its temperature and heating entities.' : 'No geysers found. Add a device through the ezGeyser Direct integration first.'}</p>`;
  }
}
if (!customElements.get('ezgeyser-card-editor')) customElements.define('ezgeyser-card-editor',EzGeyserCardEditor);

if (!customElements.get('ezgeyser-card')) customElements.define('ezgeyser-card',EzGeyserCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'ezgeyser-card')) window.customCards.push({type:'ezgeyser-card',name:'ezGeyser overview',description:'Read-only tank temperatures, heating and sensor status.',documentationURL:'https://github.com/basghar/home-assistant-ezgeyser#geyser-overview-card',preview:true});
