/* ezGeyser overview card. No dependencies or direct device requests/writes. */
const FIELDS = {
  top: 'temperature_top', bottom: 'temperature_bottom', target: 'temperature_target',
  source: 'heating_source', top_ok: 'temperature_top_ok', bottom_ok: 'temperature_bottom_ok',
  burner_left: 'heating_burner_1', burner_right: 'heating_burner_2',
  element_1: 'heating_element_1', element_2: 'heating_element_2', boost: 'heating_boost_mode',
  vacation: 'heating_vacation_mode', next_event: 'next_scheduled_event', timer: 'timer_remaining',
  wifi: 'network_wifi_signal', cloud: 'network_cloud_connection', clock: 'device_clock',
};
// Added after the first releases: a card keeps working while these are missing; a missing one hides its item.
const OPTIONAL = new Set(['next_event', 'vacation', 'timer', 'wifi', 'cloud', 'clock']);
const BINARY = new Set(['top_ok', 'bottom_ok', 'burner_left', 'burner_right', 'element_1', 'element_2', 'boost', 'vacation', 'cloud', 'clock']);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PATHS = {
  warning: 'M12 3L2 21h20L12 3Zm0 6v5m0 3v.1',
  // Tabler temperature (MIT): the word "Target" beside it says it is the set point.
  temperature: 'M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0-4 0v8.5M10 9h4',
  offline: 'M3 3l18 18M2 8a16 16 0 0 1 4-2m4-1a16 16 0 0 1 12 3M5 12a11 11 0 0 1 5-2m5 0a11 11 0 0 1 4 2M8 16a6 6 0 0 1 8 0M12 20h.01',
  info: 'M12 11v6m0-10v.1M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0',
  // Tabler calendar-time, calendar-off, beach and x (MIT), as in the Android app.
  calendarClock: 'M11.795 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M14 18a4 4 0 1 0 8 0a4 4 0 1 0-8 0m1-15v4M7 3v4m-4 4h16M18 16.496V18l1 1',
  calendarOff: 'M9 5h9a2 2 0 0 1 2 2v9m-.184 3.839A2 2 0 0 1 18 21H6a2 2 0 0 1-2-2V7a2 2 0 0 1 1.158-1.815M16 3v4M8 3v1m-4 7h7m4 0h5M3 3l18 18',
  beach: 'M17.553 16.75a7.5 7.5 0 0 0-10.606 0M18 3.804A6 6 0 0 0 9.804 6l10.392 6A6 6 0 0 0 18 3.804M16.732 10C18.39 7.13 18.957 4.356 18 3.804S14.925 5.13 13.268 8M15 9l-3 5.196M3 19.25A2.4 2.4 0 0 1 4 19a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 1 .25',
  close: 'M18 6L6 18M6 6l12 12',
  // Tabler arrow-right (MIT), for the mode pill.
  arrow: 'M5 12h14M13 18l6-6M13 6l6 6',
  // Tabler check, rocket (Boost; the bolt means electric heating only), clock, clock-exclamation, cloud and cloud-off (MIT).
  check: 'M5 12l5 5L20 7',
  rocket: 'M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3-5a9 9 0 0 0 6-8a3 3 0 0 0-3-3a9 9 0 0 0-8 6a6 6 0 0 0-5 3M7 14a6 6 0 0 0-3 6a6 6 0 0 0 6-3m4-8a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  clock: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0M12 7v5l3 3',
  clockAlert: 'M20.986 12.502a9 9 0 1 0-5.973 7.98M12 7v5l3 3m4 1v3m0 3v.01',
  cloud: 'M6.657 18C4.085 18 2 15.993 2 13.517s2.085-4.482 4.657-4.482c.393-1.762 1.794-3.2 3.675-3.773c1.88-.572 3.956-.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486s-1.551 3.487-3.465 3.487H6.657',
  cloudOff: 'M9.58 5.548q.361-.166.752-.286c1.88-.572 3.956-.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 .957-.383 1.824-1.003 2.454M18 18.004H6.657C4.085 18 2 15.993 2 13.517s2.085-4.482 4.657-4.482c.13-.582.37-1.128.7-1.62M3 3l18 18',
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[name]}"/></svg>`;
}
// The device-page glyph shares the info circle's 3..21 geometry; both scale just inside the badge's painted height.
function devicePageIcon() {
  const teeth = Array.from({length:8},(_,i) => {
    const angle = i * Math.PI / 4;
    const point = radius => `${(11 + radius * Math.cos(angle)).toFixed(4)} ${(13 + radius * Math.sin(angle)).toFixed(4)}`;
    return `<path d="M${point(3.4)} ${point(4.85)}" stroke-width="1.8"/>`;
  }).join('');
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 5H5.5a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 5.5 21h11a2.5 2.5 0 0 0 2.5-2.5V12.5"/><path d="M17.5 6.5 21 3M17 3h4v4"/><circle cx="11" cy="13" r="3.4" stroke-width="1.7"/><circle cx="11" cy="13" r="1.36" stroke-width="1.4"/>${teeth}</svg>`;
}
// The integration publishes this root URL in the device registry. Never infer an address from a name or entity ID.
function devicePage(device) {
  const match = /^http:\/\/([^/?#@:]+)\/$/.exec(device?.configuration_url || '');
  if (!match) return null;
  const host = match[1];
  const octets = host.split('.');
  const ipv4 = octets.length === 4 && octets.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
  const local = ipv4 && (['10','127'].includes(octets[0]) || octets[0] === '172' && Number(octets[1]) >= 16 && Number(octets[1]) <= 31
    || octets[0] === '192' && octets[1] === '168' || octets[0] === '169' && octets[1] === '254');
  const mdns = host.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+local$/.test(host);
  return local || mdns ? {url:match[0],host} : null;
}
// The Wi-Fi level (the integration's enum states), its accessible label, and how many arcs are lit, as in the app.
const WIFI = {excellent:['Excellent',3], good:['Good',2], fair:['Fair',1], weak:['Weak',0]};
const WIFI_ARCS = ['M8.82 13.32A4.5 4.5 0 0 1 15.18 13.32','M6.34 10.84A8 8 0 0 1 17.66 10.84','M3.87 8.37A11.5 11.5 0 0 1 20.13 8.37'];
// The dot and every arc are always drawn: the lit ones in the item's colour, the rest in the inactive-arc token. Weak
// lights the dot alone, in the warning colour, so it still reads as Wi-Fi.
function wifiIcon(level) {
  const lit = WIFI[level]?.[1] ?? 0;
  return `<svg class="icon wifi-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="16.5" r="1.6" fill="currentColor"/>${WIFI_ARCS.map((d,i) => `<path d="${d}" stroke="${i < lit ? 'currentColor' : 'var(--wifi-off)'}"/>`).join('')}</svg>`;
}
// What the badge and the footer's end say about the connection: a missing or unknown entity is neither shown nor an issue.
function connectivity(shown) {
  const level = WIFI[shown.wifi?.state] ? shown.wifi.state : null;
  const cloud = ['on','off'].includes(shown.cloud?.state) ? shown.cloud.state === 'on' : null;
  return {level, cloud, clockOff:shown.clock?.state === 'on'};
}
// The badge counts sensor faults and connectivity problems: none is "All OK", one is named, several are counted. The
// visible name of a sensor fault is short ("Top sensor"): the badge shares row 1 with the name, and the striped tank half
// and the dash already say it is a fault. Screen readers hear the full name.
function problems(shown, link) {
  const fault = key => shown[`${key}_ok`]?.state === 'off';
  return [fault('top') && 'Top sensor fault', fault('bottom') && 'Bottom sensor fault', link.level === 'weak' && 'Weak Wi-Fi',
    link.cloud === false && 'Cloud offline', link.clockOff && 'Clock off'].filter(Boolean);
}
function badgeText(issues) { return issues.length > 1 ? `${issues.length} issues` : issues[0]?.replace(/ fault$/,'') || 'All OK'; }
// The footer's end group as one sentence: "Wi-Fi Weak, cloud offline, clock off".
function linkLabel(link) {
  const text = [link.level && `Wi-Fi ${WIFI[link.level][0]}`, link.cloud !== null && `cloud ${link.cloud ? 'online' : 'offline'}`, link.clockOff && 'clock off'].filter(Boolean).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function linkItems(link) {
  const item = (key, label, title, content, warn) => `<button class="${key} entity-button ${warn ? 'warn' : ''}" data-entity="${key}" aria-label="${escape(label)}. Open ${escape(title)} details" title="${escape(label)}">${content}</button>`;
  return (link.level ? item('wifi',`Wi-Fi ${WIFI[link.level][0]}`,'Wi-Fi signal',wifiIcon(link.level),link.level === 'weak') : '')
    + (link.cloud !== null ? item('cloud',`Cloud ${link.cloud ? 'online' : 'offline'}`,'cloud connection',icon(link.cloud ? 'cloud' : 'cloudOff'),!link.cloud) : '')
    + (link.clockOff ? item('clock','Clock off','device clock',icon('clockAlert'),true) : '');
}
// The adaptive steps, from natural widths measured with every text at full length (see `_fitLayout`). Text never
// shrinks or wraps. The row stacks by the Android app's rule, whatever the card shows: iff the fixed worst case of
// SAMPLE does not fit side by side, so cards of the same width always share a layout and height. The footer wraps by
// the same kind of rule: the end group takes its own line iff SAMPLE's footer line does not fit, and the mode pill too
// iff its start does not. The mode chips lose their words if the card's own row does not fit; the footer's first line
// drops the mode pill's word, then the timer's text, then truncates the state text, stopping at the first step that fits.
const ROW_GAP = 10;
function fitLayout(m) {
  const stacked = m.sampleLeft + ROW_GAP + m.sampleRight > m.width;
  const chipsIcons = (stacked ? 0 : m.left + ROW_GAP) + m.right > m.width;
  const footerLines = m.sampleFooter > m.width ? m.sampleStart > m.width ? 3 : 2 : 1;
  // On its own line the mode pill always drops its word (see `fitClasses`), which saves nothing on the first line.
  let footer = m.footer - (footerLines > 1 ? m.status : 0) - (footerLines > 2 ? m.mode : 0), footerStep = 0;
  for (const saving of [footerLines > 2 ? 0 : m.modeWord, m.timerText, m.activity]) {
    if (footer <= m.width) break;
    footer -= saving; footerStep += 1;
  }
  return {chipsIcons, stacked, footerLines, footerStep};
}
// The worst case the stacking and footer rules measure, with the card's own classes, in a hidden element: the widest
// reading and second line on the left; the target, an event a week ahead and two icon-only mode chips on the right; and
// the widest footer line once every step applies: both heat icons, an empty state text and the timer icon in the status
// chip, an Unknown mode pill, then Wi-Fi, cloud and clock.
const SAMPLE = `<div class="left"><div class="tank"></div><div class="readings"><div class="reading"><span class="number">88.8</span><span class="unit">°C</span></div><div class="secondary">Bottom 88.8°C</div></div></div>
  <div class="right"><span class="line">${icon('temperature')}<span>Target</span><span class="value">72.5°C</span></span><span class="line">${icon('calendarClock')}<span>12:30 PM</span><span class="day-badge">+7</span><span class="quiet">→</span><span class="value">72.5°</span></span><div class="modes"><span class="chip">${icon('rocket')}</span><span class="chip">${icon('beach')}</span></div></div>
  <div class="footer"><div class="start"><div class="heat-status"><div class="sources"><div class="heat-control"></div><div class="heat-control"></div></div><span class="state-text"><span class="activity"></span><span class="timer">${icon('clock')}</span></span></div><span class="mode"><span class="quiet">Unknown</span></span></div><div class="status"><span class="wifi">${wifiIcon('good')}</span><span class="cloud">${icon('cloud')}</span><span class="clock">${icon('clockAlert')}</span></div></div>`;
function fitClasses(fit) {
  return [fit.chipsIcons && 'chips-icons', fit.stacked && 'stacked', fit.footerLines >= 2 && 'wrap-status',
    fit.footerLines >= 3 && 'wrap-mode', (fit.footerStep >= 1 || fit.footerLines >= 3) && 'no-mode-word',
    fit.footerStep >= 2 && 'no-timer-text', fit.footerStep >= 3 && 'truncate-state'].filter(Boolean).join(' ');
}
const HEAT_GLYPHS = {gas:'M12 2.5C12 2.5 5 9.5 5 14.5a7 7 0 0 0 14 0C19 9.5 12 2.5 12 2.5Z', electric:'M13.6 2 5 13.4h6.2L10.2 22 19 10.4h-6.2L13.6 2Z'};
function heatIcon(kind, first, second, count, known = true) {
  const on = known && (first || second);
  const text = !known ? `${kind === 'gas' ? 'Burner' : 'Elements'} status unknown`
    : kind === 'gas' ? first && second ? 'Burner both sides on' : first ? 'Burner left side on' : second ? 'Burner right side on' : 'Burner off'
    : count === 1 ? `Element ${on ? 'on' : 'off'}` : `Element 1 ${first ? 'on' : 'off'}, element 2 ${second ? 'on' : 'off'}`;
  const path = HEAT_GLYPHS[kind];
  const bar = (x1, x2, active) => `<path d="M${x1} 21H${x2}" class="segment ${known && active ? 'lit' : ''}"/>`;
  return `<svg class="heat ${kind} ${on ? 'on' : ''}" viewBox="0 0 24 24" role="img" aria-label="${text}"><title>${text}</title><g transform="translate(3.6 .5) scale(.7)"><path class="glyph" d="${path}"/></g>${count === 1 ? bar(3.5,20.5,on) : bar(3.5,10.8,first)+bar(13.2,20.5,second)}</svg>`;
}
function heatControls(kind, first, second, count, known) {
  if (kind === 'gas') return `<button class="entity-button heat-control" data-action="flame-history" aria-label="Open left and right flame sensor history" title="Open left and right flame sensor history">${heatIcon(kind,first,second,count,known)}</button>`;
  const keys = ['element_1','element_2'];
  const labels = ['Electric element 1 details','Electric element 2 details'];
  return `<div class="heat-control">${heatIcon(kind,first,second,count,known)}<div class="heat-buttons">${keys.slice(0,count).map((key,i) => `<button class="entity-button heat-button" data-entity="${key}" aria-label="Open ${labels[i]}" title="Open ${labels[i]}"></button>`).join('')}</div></div>`;
}
// The configured heating source, which the device's `source` code selects: which heat sources the mode allows, not what
// heats right now. Allowed sources are neutral, never the gas and electric colours of the live heat icons. Only the gas
// code is confirmed on a device; the sensor maps any other code to unknown, with the raw code in `source_code`.
const MODES = {
  gas: ['Mode: gas only', true, false],
  hybrid: ['Mode: gas, with electric fallback', true, true],
  electric: ['Mode: electric only', false, true],
};
function modePill(state) {
  if (!state) return '';
  const code = state.attributes?.source_code;
  const [label, gas, electric] = MODES[state.state] || [`Mode unknown${Number.isFinite(code) ? ` (source code ${code})` : ''}`, false, false];
  const glyph = (kind, allowed) => `<svg class="mode-icon ${allowed ? 'allowed' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEAT_GLYPHS[kind]}"/></svg>`;
  const arrow = `<svg class="mode-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS.arrow}"/></svg>`;
  // An unknown source says so in words, rather than as two not-allowed icons that read like a mode.
  const value = MODES[state.state] ? `<span class="mode-icons">${glyph('gas',gas)}${gas && electric ? arrow : ''}${glyph('electric',electric)}</span>` : '<span class="quiet">Unknown</span>';
  return `<button class="mode entity-button" data-entity="source" aria-label="${escape(label)}. Open heating source details" title="${escape(label)}"><span class="mode-word">Mode</span>${value}</button>`;
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
// The number's and the second line's line heights are trimmed to the glyphs, so the text block centres on its digits.
// The middle row is always as tall as a full right column (target, event and a mode line), with or without modes, so
// every card in a list is the same height; a wrapped footer reserves its lines' height the same way, for a footer with
// nothing to wrap. Text is never shrunk or wrapped; `fitLayout` picks the adaptive classes.
const STYLE = `
:host{display:block;--surface:#EFEDF4;--text:#1B1B1F;--secondary:#46464F;--tertiary:#77767F;--line:#DAD8E2;--off:#8E8C96;--ok:#1E6B3A;--ok-bg:#D4EEDB;--warn:#8A5100;--warn-bg:#FFDDB8;--primary:#3B57A6;--on-primary:#FFFFFF;--primary-bg:#DCE2FA;--dialog:#FBF8FF;--gas:#D9480F;--electric:#B86E00;--wifi-off:#9896A0;--mode-off:#C4C2CC;--line-strong:#B5B3BE;--line-h:18px;--chip-h:22px;--row-h:calc(2 * var(--line-h) + var(--chip-h) + 2 * 6px)}
:host([dark]){--surface:#202024;--text:#E5E1E6;--secondary:#C6C5CF;--tertiary:#908F99;--line:#34343A;--off:#77767F;--ok:#9AD6A9;--ok-bg:#1E3826;--warn:#FFB95E;--warn-bg:#4A2B00;--primary:#B4C5FF;--on-primary:#13285E;--primary-bg:#2B3A66;--dialog:#2A2A2F;--gas:#FF8F57;--electric:#F2B33D;--wifi-off:#66656E;--mode-off:#4A4950;--line-strong:#57565E}
*{box-sizing:border-box}ha-card{display:block;background:var(--ha-card-background,var(--surface));color:var(--text);border:1px solid var(--ha-card-border-color,var(--line));border-radius:var(--ha-card-border-radius,16px);box-shadow:var(--ha-card-box-shadow,none);overflow:hidden}ha-card,.sample{font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif)}
.card{padding:12px 14px 10px;outline:none}.entity-button{font:inherit;color:inherit;background:none;border:0;padding:0;text-align:inherit;cursor:pointer}.entity-button:focus-visible{outline:2px solid var(--primary);outline-offset:2px;border-radius:3px}.card:focus-visible{outline:3px solid var(--primary);outline-offset:-3px;border-radius:16px}.header{display:flex;align-items:center;gap:10px;min-width:0;min-height:24px}.name{margin:0;flex:1;min-width:0;font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;max-width:60%;font-size:12px;font-weight:500;color:var(--ok);background:var(--ok-bg)}.badge span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.badge.warning{color:var(--warn);background:var(--warn-bg)}.icon{width:16px;height:16px;flex:none}.header .icon{width:18px;height:18px;stroke-width:2}.details-button{position:relative;flex:none;width:var(--header-action-size,22.8px);height:var(--header-action-size,22.8px);border:0;background:none;color:var(--secondary);padding:0;display:grid;place-items:center;border-radius:50%;cursor:pointer}.details-button::before{content:"";position:absolute;z-index:0;width:48px;height:48px;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%}.header .name,.header .badge{position:relative;z-index:1}.details-button .icon{position:absolute;z-index:1;left:50%;top:50%;width:120%;height:120%;transform:translate(-50%,-50%)}.details-button:focus-visible{outline:2px solid var(--primary);outline-offset:3px}.details-button[aria-disabled="true"]{opacity:.38;cursor:default}.details-button[aria-disabled="true"]::before{pointer-events:none}
.temperatures{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:8px;align-items:center;min-height:var(--row-h);margin:12px 0 8px}.left{display:flex;align-items:center;align-self:stretch;gap:12px;min-width:0}.tank{width:11px;flex:none;align-self:stretch;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 0 1px var(--line)}.half{height:50%;flex:1}.half+.half{border-top:1px solid var(--surface)}.half.fault{background:repeating-linear-gradient(135deg,var(--off) 0 3px,var(--surface) 3px 5px)!important}.readings{min-width:0}.reading{display:flex;align-items:baseline;gap:4px;white-space:nowrap;line-height:.75}.number{font-size:36px;font-weight:500;letter-spacing:-1px;font-variant-numeric:tabular-nums}.unit{font-size:15px;color:var(--secondary)}.secondary{display:block;font-size:14px;line-height:.95;white-space:nowrap;color:var(--secondary);margin-top:11px}.fault-text{color:var(--warn)}
.right{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:6px;min-width:0;font-size:12px;color:var(--secondary);text-align:right}.line{display:inline-flex;align-items:center;justify-content:flex-end;gap:4px;max-width:100%;min-height:var(--line-h);white-space:nowrap;overflow:hidden}.line .icon{width:14px;height:14px}.value{font-weight:500;color:var(--text)}.quiet{color:var(--tertiary)}.day-badge{display:inline-grid;place-items:center;flex:none;height:18px;min-width:18px;padding:0 4px;border-radius:9px;background:var(--primary);color:var(--on-primary);font-size:10px;font-weight:600;line-height:1}.modes{display:flex;gap:6px;flex:none}.chip{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:var(--chip-h);min-width:var(--chip-h);border-radius:11px;padding:0 9px 0 7px;font-size:11px;font-weight:500;white-space:nowrap;background:var(--primary-bg);color:var(--primary)}.chip .icon{width:13px;height:13px}.chips-icons .chip{width:var(--chip-h);padding:0}.chips-icons .chip span{display:none}
.footer{border-top:1px solid var(--line);padding-top:6px;display:flex;align-items:center;gap:8px;min-height:31px;font-size:12px;color:var(--secondary);white-space:nowrap}.start{display:flex;align-items:center;gap:8px;flex:1;min-width:0}.sources{display:flex;gap:6px;flex:none}.heat-control{position:relative;width:24px;height:24px;flex:none}.heat-buttons{position:absolute;inset:0;display:flex}.heat-button{flex:1;min-width:0;height:100%}.heat{width:24px;height:24px;color:var(--off);overflow:visible}.glyph{fill:none;stroke:currentColor;stroke-width:2.3;stroke-linejoin:round}.on .glyph{fill:currentColor}.gas.on{color:var(--gas)}.electric.on{color:var(--electric)}.segment{fill:none;stroke:var(--off);opacity:.55;stroke-width:2.6;stroke-linecap:round}.gas .lit{stroke:var(--gas);opacity:1}.electric .lit{stroke:var(--electric);opacity:1}.activity{flex:none;overflow:hidden;text-overflow:ellipsis}.activity.heating{color:var(--text)}.timer,.wifi,.cloud,.clock{display:inline-flex;align-items:center;gap:4px;flex:none}.wifi .icon{width:18px;height:18px}.mode{display:inline-flex;align-items:center;flex:none;height:20px;padding:0 7px;border:1px solid var(--line-strong);border-radius:10px;font-size:11px;line-height:1;color:var(--secondary)}.mode-word{align-self:stretch;display:inline-flex;align-items:center;padding-right:6px;margin-right:6px;border-right:1px solid var(--line-strong)}.mode-icons{display:inline-flex;align-items:center;gap:3px}.mode-icon{width:12px;height:12px;flex:none;fill:none;stroke:var(--mode-off);stroke-width:2.3;stroke-linejoin:round}.mode-icon.allowed{stroke:var(--text)}.mode-arrow{width:9px;height:9px;flex:none;fill:none;stroke:var(--tertiary);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.heat-status{display:inline-flex;align-items:center;flex:none;height:20px;padding:0 7px;border:1px solid var(--line-strong);border-radius:10px;font-size:11px;line-height:1}.heat-status .sources{gap:3px}.heat-status .heat-control,.heat-status .heat{width:16px;height:16px}.heat-status .timer .icon{width:13px;height:13px}.state-text{align-self:stretch;display:inline-flex;align-items:center;gap:8px;padding-left:6px;margin-left:6px;border-left:1px solid var(--line-strong)}.tint-gas{background:color-mix(in srgb,var(--gas) 16%,transparent);border-color:transparent}.tint-gas .state-text{border-left-color:color-mix(in srgb,var(--gas) 50%,transparent)}.tint-electric{background:color-mix(in srgb,var(--electric) 16%,transparent);border-color:transparent}.tint-electric .state-text{border-left-color:color-mix(in srgb,var(--electric) 50%,transparent)}@media(min-resolution:2dppx){.mode,.mode-word,.heat-status,.state-text{border-width:.5px}}.status{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}.warn{color:var(--warn)}.stale .number,.stale .unit,.stale .secondary{color:var(--tertiary)}.stale .tank{opacity:.45}.stale .right{color:var(--tertiary)}
.no-mode-word .mode-word,.no-timer-text .timer span{display:none}.truncate-state .heat-status{flex:0 1 auto}.truncate-state .state-text{display:grid;grid-auto-flow:column;grid-template-columns:minmax(0,max-content)}.truncate-state .activity{min-width:0}
.wrap-status .footer{flex-wrap:wrap;row-gap:4px;min-height:49px}.wrap-status .start{flex-basis:100%}.wrap-mode .footer{min-height:73px}.wrap-mode .start{flex-wrap:wrap;row-gap:0}.wrap-mode .start::after{content:"";flex-basis:100%;order:1}.wrap-mode .mode{order:2;margin-top:4px}
.stacked .temperatures{grid-template-columns:minmax(0,1fr)}.stacked .left{align-self:auto}.stacked .right{align-items:flex-start;justify-content:flex-start;min-height:var(--row-h);text-align:left;padding-left:23px}.stacked .line{justify-content:flex-start}
.measure .temperatures{grid-template-columns:max-content max-content;width:max-content}.measure .footer{width:max-content}.measure .start,.measure .activity{flex:none}
.sample{position:absolute;height:0;overflow:hidden;visibility:hidden;pointer-events:none;display:flex;flex-direction:column}.sample,.sample>*{width:max-content}
dialog.details{border:0;padding:0;margin:auto;width:min(360px,calc(100vw - 32px));max-height:calc(100vh - 32px);border-radius:24px;background:var(--dialog);color:var(--text);font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif);font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,.3)}dialog.details::backdrop{background:rgba(0,0,0,.45)}.sheet{padding:20px 20px 16px;outline:none}.sheet header{display:flex;align-items:center;gap:8px}.sheet h2{flex:1;margin:0;font-size:18px;font-weight:500}.icon-button{display:grid;place-items:center;width:40px;height:40px;margin:-8px -8px -8px 0;border:0;border-radius:50%;background:none;color:var(--secondary);cursor:pointer}.icon-button .icon{width:20px;height:20px}.when{margin:4px 0 12px;color:var(--secondary)}.sheet dl{margin:0;border-top:1px solid var(--line)}.row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line)}.row dt{color:var(--secondary)}.row dd{margin:0;font-weight:500;text-align:right}.sheet footer{display:flex;justify-content:space-between;gap:8px;margin-top:16px}.text-button,.filled-button{font:inherit;font-weight:500;min-height:40px;padding:0 16px;border-radius:20px;border:0;cursor:pointer}.text-button{background:none;color:var(--primary)}.filled-button{background:var(--primary);color:var(--on-primary)}.sheet button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
@media(max-width:600px){dialog.details{margin:auto 0 0;width:100vw;max-width:100vw;border-radius:24px 24px 0 0}.sheet{padding-bottom:max(16px,env(safe-area-inset-bottom))}}
`;
class EzGeyserCard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'}); this._last = null; this._fit = {chipsIcons:false,stacked:false,footerLines:1,footerStep:0};
    // The details window is a native <dialog>, outside ha-card so the per-second re-render leaves it alone. HA's own
    // dialog elements are not a public API for cards.
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card></ha-card><div class="sample chips-icons" aria-hidden="true">${SAMPLE}</div><dialog class="details" aria-labelledby="details-title"></dialog>`;
    this._card = this.shadowRoot.querySelector('ha-card');
    this._sample = this.shadowRoot.querySelector('.sample');
    // Fonts that load later, such as a theme's, change every width.
    this._remeasure = () => { this._sampleSize = null; this._fitKey = null; this._fitLayout(); };
    this._dialog = this.shadowRoot.querySelector('dialog');
    this._card.addEventListener('click', e => {
      // Native links keep browser keyboard, context-menu and long-press behavior, separate from HA details.
      if (e.target.closest('[data-action="device-page"]')) return;
      if (e.target.closest('[data-action="schedule"]')) return this._openDetails();
      if (e.target.closest('[data-action="flame-history"]')) return this._openFlameHistory();
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
    // A new width is measured on the next frame, so the class changes never feed back into this observer's own loop.
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(([entry]) => { this._width = entry.contentRect.width; requestAnimationFrame(() => this._fitLayout()); }).observe(this._card);
      // Observe the pill itself too: a smaller font can shrink it while the previous action size holds the row open.
      this._badgeResizeObserver = new ResizeObserver(() => requestAnimationFrame(() => this._fitLayout()));
    }
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
    this._last = null; this._signature = null; this._fitKey = null;
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
  connectedCallback() {
    this._loadRegistry(); this._subscribeRegistry(); this._fitLayout();
    // Widths measured with a fallback font are wrong once the web font arrives.
    if (typeof document !== 'undefined') {
      document.fonts?.ready.then(this._remeasure);
      document.fonts?.addEventListener('loadingdone',this._remeasure);
    }
  }
  disconnectedCallback() {
    this._badgeResizeObserver?.disconnect(); this._headerBadge = null;
    if (typeof document !== 'undefined') document.fonts?.removeEventListener('loadingdone',this._remeasure);
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
  // Measures the natural widths once per new width or content, with every text at full length, and applies the
  // adaptive classes `fitLayout` picks. Classes only: the content is not rendered again. The observed card width keys
  // the cache, so an unchanged render costs no layout. The sample is measured once, then again after a font or theme
  // change.
  _fitLayout() {
    const card = this._card.querySelector('.card');
    if (!card?.getBoundingClientRect) return;
    // The 3..21 paths plus their 2-unit stroke paint 20/24 of the canvas. A 120% SVG fills its square slot,
    // sized to 95% of the measured badge height; 10 px between slots is also 10 px between the painted edges.
    // Measure before the layout cache: font metrics can change the pill height without changing its text.
    const badge = card.querySelector('.badge');
    if (this._badgeResizeObserver && badge !== this._headerBadge) {
      if (this._headerBadge) this._badgeResizeObserver.unobserve(this._headerBadge);
      this._headerBadge = badge;
      if (badge) this._badgeResizeObserver.observe(badge);
    }
    const badgeHeight = badge?.getBoundingClientRect().height;
    if (badgeHeight > 0) card.style.setProperty('--header-action-size',`${badgeHeight * .95}px`);
    const key = `${this._width} ${this._layout}`;
    if (this._width === 0 || key === this._fitKey) return;
    const width = card.querySelector('.header').getBoundingClientRect().width;
    if (!width) return;
    this._fitKey = key;
    const classes = more => ['card',card.classList.contains('stale') && 'stale',more].filter(Boolean).join(' ');
    card.className = classes('measure');
    const w = element => element?.getBoundingClientRect().width || 0;
    const one = selector => w(card.querySelector(selector));
    const x = selector => card.querySelector(selector)?.getBoundingClientRect().left || 0;
    const end = selector => card.querySelector(selector)?.getBoundingClientRect().right || 0;
    if (!this._sampleSize) {
      const size = {sampleLeft:w(this._sample.querySelector('.left')), sampleRight:w(this._sample.querySelector('.right')),
        sampleFooter:w(this._sample.querySelector('.footer')), sampleStart:w(this._sample.querySelector('.footer .start'))};
      if (size.sampleLeft) this._sampleSize = size;
    }
    this._fit = fitLayout({
      width, ...this._sampleSize, left:one('.left'), right:one('.right'),
      // The mode word's saving includes its divider and the space after it: where the value starts, less where it starts.
      footer:one('.footer'), modeWord:x('.mode-word + span') - x('.mode-word'), timerText:one('.timer') - one('.timer .icon'),
      activity:one('.activity'),
      // What wrapping takes off the first line, each with the gap before it: the end group, and the whole mode pill.
      status:end('.footer') - end('.start'), mode:end('.mode') - end('.start > :nth-last-child(2)'),
    });
    card.className = classes(fitClasses(this._fit));
  }
  _openFlameHistory() {
    // Use registry-resolved IDs so renamed entities still open the same burner's history.
    const ids = ['burner_left','burner_right'].map(side => this._ids?.[side]).filter(entity => entity && this._hass?.states[entity]);
    if (!ids.length) return;
    window.history.pushState(null,'',`/history?entity_id=${encodeURIComponent(ids.join(','))}`);
    window.dispatchEvent(new CustomEvent('location-changed',{detail:{replace:false}}));
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
    // A theme can bring its own font; it applies its styles on its own schedule, so measure again on the next frame.
    const theme = JSON.stringify([hass.themes?.theme,hass.selectedTheme]);
    if (this._theme !== undefined && theme !== this._theme && typeof requestAnimationFrame === 'function') requestAnimationFrame(this._remeasure);
    this._theme = theme;
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
    const link = connectivity(shown);
    const issues = problems(shown,link);
    let badge = badgeText(issues);
    if (unknown) badge = 'Status unknown';
    if (missing) badge = this._registryError ? 'Registry unavailable' : this._registry === undefined ? 'Loading entities' : 'Check entities';
    if (config.device_id === '') badge = 'Select geyser';
    if (unreachable) badge = 'Unreachable';
    const warning = missing || unreachable || unknown || issues.length > 0;
    const page = devicePage(hass.devices?.[this._deviceId]);
    this._devicePage = !missing && !unreachable ? page : null;
    const name = config.name || hass.devices?.[this._deviceId]?.name_by_user || hass.devices?.[this._deviceId]?.name || this._ids.top?.replace(/^sensor\./,'').replace(/_temperature_top$/,'').replaceAll('_',' ') || 'Geyser';
    const unit = shown[main]?.attributes.unit_of_measurement || '°C';
    // Always the same line, "[thermometer] Target 65°C": a target of 0 means none is set.
    const target = numeric(shown.target), targetUnit = shown.target?.attributes.unit_of_measurement || '°C';
    const targetNumber = target === null ? null : new Intl.NumberFormat(hass.locale?.language || 'en',{maximumFractionDigits:1}).format(target);
    const targetText = target === null ? 'unknown' : Math.abs(celsius(shown.target)) < .01 ? 'not set' : null;
    const targetLabel = `Target temperature ${targetText || `${targetNumber} ${targetUnit}`}`;
    const targetLine = `${icon('temperature')}<span>Target</span>${targetText ? `<span class="quiet">${targetText}</span>` : `<span class="value">${escape(targetNumber)}${escape(targetUnit)}</span>`}`;
    const showSource = config.show_heat_source !== false;
    this._schedule = unreachable ? null : scheduleView(states.next_event,hass);
    if (this._dialog.open) this._schedule ? this._showDetails() : this._dialog.close();
    const heatingKnown = !missing && !unknown && !unreachable;
    const left = on('burner_left'), right = on('burner_right'), el1 = on('element_1'), el2 = on('element_2');
    const heating = left || right || el1 || el2;
    // The live state only; unknown shows no text, the dimmed heat icons say it. The configured source is the mode pill.
    const activity = !heatingKnown ? '' : `<span class="activity ${heating ? 'heating' : ''}">${heating ? 'Heating' : 'Idle'}</span>`;
    const remaining = numeric(shown.timer);
    const timer = remaining !== null && remaining > 0 ? `Timer running, ${remaining} left` : null;
    const timerButton = timer ? `<button class="timer entity-button" data-entity="timer" aria-label="${escape(timer)}. Open timer details" title="${escape(timer)}">${icon('clock')}<span>${escape(remaining)} left</span></button>` : '';
    // One chip for the heat icons, the state and the timer: outlined while idle or unknown (icons only), tinted in the
    // colour of what heats, gas when both do. The border stays, transparent, so tinting never changes the chip's size.
    // An unknown status keeps a running timer, after the chip.
    const tint = !heatingKnown ? '' : left || right ? 'gas' : el1 || el2 ? 'electric' : '';
    const heatStatus = `<div class="heat-status${tint ? ` tint-${tint}` : ''}"><div class="sources">${heatControls('gas',left,right,2,heatingKnown)}${heatControls('electric',el1,el2,config.element_count || 2,heatingKnown)}</div>${heatingKnown ? `<span class="state-text">${activity}${timerButton}</span>` : ''}</div>${heatingKnown ? '' : timerButton}`;
    // last_updated is an HA state timestamp, not the last successful poll time.
    const lastTime = this._last ? Object.values(this._last).map(s => s?.last_updated).filter(Boolean).sort().at(-1) : null;
    const updated = lastTime ? new Date(lastTime).toLocaleString(hass.locale?.language || 'en') : null;
    const tankLabel = `Top ${display('top')} ${shown.top?.attributes.unit_of_measurement || '°C'}${fault('top') ? ', sensor fault' : ''}; Bottom ${display('bottom')} ${shown.bottom?.attributes.unit_of_measurement || '°C'}${fault('bottom') ? ', sensor fault' : ''}. Colours emphasize the relative temperature difference.`;
    const active = this.shadowRoot.activeElement;
    const focused = active && this._card.contains?.(active) ? active.dataset : null;
    // The chips' words can be hidden (`chips-icons`), so each says what it is in its label and tooltip.
    const chip = (key, iconName, text) => `<button class="chip entity-button" data-entity="${key}" aria-label="${text} on. Open ${text.toLowerCase()} details" title="${text} on">${icon(iconName)}<span>${text}</span></button>`;
    const modes = (on('boost') ? chip('boost','rocket','Boost') : '') + (on('vacation') ? chip('vacation','beach','Vacation') : '');
    const badgeLabel = issues.length && badge === badgeText(issues) ? issues.length > 1 ? `${badge}: ${issues.join(', ')}` : issues[0] : badge;
    const links = linkItems(link);
    const body = `<div class="header"><h2 class="name" title="${escape(name)}">${escape(name)}</h2><div class="badge ${warning ? 'warning' : ''}" role="img" aria-label="${escape(badgeLabel)}" title="${escape(badgeLabel)}">${icon(unreachable ? 'offline' : warning ? 'warning' : 'check')}<span>${escape(badge)}</span></div><button class="details-button entity-button" data-entity="${main}" aria-label="Open main temperature details">${icon('info')}</button><a class="details-button device-page-button" data-action="device-page" aria-label="Open device page in browser" title="${escape(page ? `Open ${page.host}` : 'Device address unavailable')}"${this._devicePage ? ` href="${escape(page.url)}" target="_blank" rel="noopener noreferrer"` : ' role="link" aria-disabled="true" tabindex="-1"'}>${devicePageIcon()}</a></div>
      <div class="temperatures"><div class="left"><div class="tank" role="group" aria-label="${escape(tankLabel)}" title="${escape(tankLabel)}"><button class="half entity-button ${top === null ? 'fault' : ''}" data-entity="top" aria-label="Open top temperature details" style="background:${colors[0]}"></button><button class="half entity-button ${bottom === null ? 'fault' : ''}" data-entity="bottom" aria-label="Open bottom temperature details" style="background:${colors[1]}"></button></div>
      <div class="readings"><button class="reading entity-button" data-entity="${main}" aria-label="Open ${main} temperature details"><span class="number ${number(main) === null ? 'fault-text' : ''}">${escape(display(main))}</span><span class="unit">${escape(unit)}</span></button><button data-entity="${other}" aria-label="Open ${other} temperature details" class="secondary entity-button ${number(other) === null ? 'fault-text' : ''}">${other === 'top' ? 'Top' : 'Bottom'} ${escape(display(other))}${escape(shown[other]?.attributes.unit_of_measurement || '°C')}</button></div></div>
      <div class="right">${unreachable ? '<span class="line">Last known values</span>' : `<button class="line entity-button" data-entity="target" aria-label="${escape(targetLabel)}. Open target temperature details" title="${escape(targetLabel)}">${targetLine}</button>${scheduleLine(this._schedule,Boolean(states.next_event),showSource)}${modes ? `<div class="modes">${modes}</div>` : ''}`}</div></div>
      <div class="footer">${unreachable ? `<div class="start"><span class="activity">${updated ? `Last available ${escape(updated)}` : 'No previous values available'}</span></div>` : `<div class="start">${heatStatus}${modePill(shown.source)}</div>${links ? `<div class="status" role="group" aria-label="${escape(linkLabel(link))}">${links}</div>` : ''}`}</div>`;
    this._card.innerHTML = `<div class="${['card',unreachable && 'stale',fitClasses(this._fit)].filter(Boolean).join(' ')}">${body}</div>`;
    this._layout = body;
    this._fitLayout();
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
