// What the card shows, worked out from Home Assistant's states as plain data. The templates only lay it out.
import { devicePage } from './device-page.js';
import { FIELDS, OPTIONAL } from './entities.js';
import { celsius, numeric } from './states.js';
import { badgeText, connectivity, problems } from './status.js';
import { tankColors } from './tank-colors.js';

// A faulted sensor's reading, and a source code the sensor cannot name, are expected to be unknown.
function unknownIsExpected(key, states) {
  if (key === 'top') return states.top_ok?.state === 'off';
  if (key === 'bottom') return states.bottom_ok?.state === 'off';
  if (key === 'source') return Number.isFinite(states.source?.attributes.source_code);
  return false;
}

// Whether every required entity exists, is reachable and reports a value.
export function availability(states, config) {
  const required = Object.keys(FIELDS).filter(
    (key) => !OPTIONAL.has(key) && (config.element_count !== 1 || key !== 'element_2'),
  );
  const missing = required.some((key) => !states[key]);
  const unreachable = required.some((key) => states[key]?.state === 'unavailable');
  const unknown = required.some((key) => states[key]?.state === 'unknown' && !unknownIsExpected(key, states));
  return { missing, unreachable, unknown, complete: !missing && !unreachable && !unknown };
}

// The configured heating source, which the device's `source` code selects: which heat sources the mode allows, not what
// heats right now. Allowed sources are neutral, never the gas and electric colours of the live heat icons. Only the gas
// code is confirmed on a device; the sensor maps any other code to unknown, with the raw code in `source_code`.
const MODES = {
  gas: { label: 'Mode: gas only', gas: true, electric: false },
  hybrid: { label: 'Mode: gas, with electric fallback', gas: true, electric: true },
  electric: { label: 'Mode: electric only', gas: false, electric: true },
};

function modeView(state) {
  if (!state) return null;
  const mode = MODES[state.state];
  if (mode) return { ...mode, known: true };
  const code = state.attributes?.source_code;
  const label = `Mode unknown${Number.isFinite(code) ? ` (source code ${code})` : ''}`;
  return { label, gas: false, electric: false, known: false };
}

/**
 * @param states    the current state of each entity, by the card's key (see FIELDS)
 * @param shown     the states to display: the current ones, or the last complete ones while unreachable
 * @param status    from availability(states)
 * @param schedule  from scheduleView(), or null
 */
export function buildView({ config, hass, states, shown, status, deviceId, ids, last, schedule }) {
  const { missing, unreachable, unknown } = status;
  const lang = hass.locale?.language || 'en';
  const device = hass.devices?.[deviceId];

  const on = (key) => shown[key]?.state === 'on';
  const fault = (key) => shown[`${key}_ok`]?.state === 'off';
  const unitOf = (key) => shown[key]?.attributes.unit_of_measurement || '°C';
  const reading = (key) => {
    const n = fault(key) ? null : numeric(shown[key]);
    const format = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return { text: n === null ? '—' : format.format(n), unit: unitOf(key), missing: n === null };
  };
  const main = config.main || 'top';
  const other = main === 'top' ? 'bottom' : 'top';

  // Header
  const name =
    config.name ||
    device?.name_by_user ||
    device?.name ||
    ids.top
      ?.replace(/^sensor\./, '')
      .replace(/_temperature_top$/, '')
      .replaceAll('_', ' ') ||
    'Geyser';

  const link = connectivity(shown);
  const issues = problems(shown, link);
  let badge = badgeText(issues);
  if (unknown) badge = 'Status unknown';
  if (missing) badge = 'Check entities';
  if (config.device_id === '') badge = 'Select geyser';
  if (unreachable) badge = 'Unreachable';
  const warning = missing || unreachable || unknown || issues.length > 0;
  // Screen readers hear every issue; the badge itself counts them.
  let badgeLabel = badge;
  if (issues.length && badge === badgeText(issues)) {
    badgeLabel = issues.length > 1 ? `${badge}: ${issues.join(', ')}` : issues[0];
  }
  const page = devicePage(device);

  // Tank bar
  const top = fault('top') ? null : celsius(shown.top);
  const bottom = fault('bottom') ? null : celsius(shown.bottom);
  const sensorLabel = (key, word) =>
    fault(key) ? `${word} sensor not reporting` : `${word} ${reading(key).text} ${unitOf(key)}`;

  // Target: a target of 0 means none is set.
  const target = numeric(shown.target);
  const targetUnit = unitOf('target');
  const targetNumber =
    target === null ? null : new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(target);
  const targetText = target === null ? 'unknown' : Math.abs(celsius(shown.target)) < 0.01 ? 'not set' : null;

  // Heating: a lone flame input can persist after shutdown; keep it visible without calling it gas heating.
  const heatKnown = !missing && !unknown && !unreachable;
  const [left, right, el1, el2] = ['burner_left', 'burner_right', 'element_1', 'element_2'].map(on);
  const gasHeating = left && right;
  const heating = gasHeating || el1 || el2;
  const remaining = numeric(shown.timer);

  // last_updated is an HA state timestamp, not the last successful poll time.
  const lastTime = last
    ? Object.values(last)
        .map((s) => s?.last_updated)
        .filter(Boolean)
        .sort()
        .at(-1)
    : null;

  return {
    stale: unreachable,
    name,
    badge: { text: badge, label: badgeLabel, warning, icon: unreachable ? 'offline' : warning ? 'warning' : 'check' },
    main,
    devicePage: { page, enabled: Boolean(page) && !missing && !unreachable },
    tank: {
      label: `${sensorLabel('top', 'Top')}, ${sensorLabel('bottom', 'bottom')}`,
      colors: tankColors(top, bottom),
    },
    readings: {
      main: { key: main, ...reading(main) },
      other: { key: other, name: other === 'top' ? 'Top' : 'Bottom', ...reading(other) },
    },
    target: {
      label: `Target temperature ${targetText || `${targetNumber} ${targetUnit}`}`,
      text: targetText,
      number: targetNumber,
      unit: targetUnit,
    },
    schedule,
    hasScheduleEntity: Boolean(states.next_event),
    showSource: config.show_heat_source !== false,
    boost: on('boost'),
    vacation: on('vacation'),
    heat: {
      known: heatKnown,
      burners: [left, right],
      elements: [el1, el2],
      elementCount: config.element_count || 2,
      // Tinted in the colour of what heats, gas when both do; outlined while idle, lone flame or unknown.
      tint: !heatKnown ? '' : gasHeating ? 'gas' : el1 || el2 ? 'electric' : '',
      heating,
      activity: heating ? 'Heating' : left || right ? 'Flame detected' : 'Idle',
    },
    timer: remaining !== null && remaining > 0 ? { remaining, label: `Timer running, ${remaining} left` } : null,
    mode: modeView(shown.source),
    link,
    lastUpdated: lastTime ? new Date(lastTime).toLocaleString(lang) : null,
  };
}
