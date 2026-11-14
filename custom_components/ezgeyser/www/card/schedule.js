// The next scheduled event: what the card's line and the details window say about it.

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// The zone the user's profile shows times in: the browser's (default) or the server's.
function displayZone(hass) {
  return hass.locale?.time_zone === 'server' ? hass.config?.time_zone || undefined : undefined;
}

function hour12(hass) {
  const format = hass.locale?.time_format;
  if (format === '12') return true;
  if (format === '24') return false;
  return undefined;
}

function calendarDay(date, timeZone) {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
  const parts = Object.fromEntries(format.formatToParts(date).map((p) => [p.type, p.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

// `repeat_days` is Sunday first (the integration's unverified order); shown Monday first. A schedule runs on its flagged
// days only, so one with none never runs ("No days"), as in the Android app.
function repeatText(days, lang) {
  if (!days?.length) return 'No days';
  if (days.length === 7) return 'Every day';
  const set = new Set(days);
  if (days.length === 5 && DAYS.slice(1, 6).every((d) => set.has(d))) return 'Weekdays';
  if (days.length === 2 && set.has('saturday') && set.has('sunday')) return 'Weekends';
  // 16 Nov 2026 is a Monday.
  const weekday = (d) =>
    new Date(Date.UTC(2026, 10, 16 + ((DAYS.indexOf(d) + 6) % 7))).toLocaleDateString(lang, {
      weekday: 'short',
      timeZone: 'UTC',
    });
  return [...DAYS.slice(1), DAYS[0]]
    .filter((d) => set.has(d))
    .map(weekday)
    .join(', ');
}

// Everything the card line and the details window say about the next scheduled event; null when there is none.
export function scheduleView(state, hass, now = new Date()) {
  if (!state || ['unknown', 'unavailable', ''].includes(state.state)) return null;
  const date = new Date(state.state);
  if (Number.isNaN(date.getTime())) return null;

  const lang = hass.locale?.language || 'en';
  const timeZone = displayZone(hass);
  const a = state.attributes || {};
  const days = Math.max(0, Math.round((calendarDay(date, timeZone) - calendarDay(now, timeZone)) / 864e5));
  const off = a.heating_off === true;
  const target =
    typeof a.target_temperature === 'number'
      ? new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(a.target_temperature)
      : null;
  const unit = hass.config?.unit_system?.temperature || '°C';
  const time = date.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit', hour12: hour12(hass), timeZone });
  const dateText = date.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short', timeZone });
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;

  const goal = off ? 'heating off' : target !== null ? `${target} ${unit}` : 'no target';
  const spokenGoal = off ? 'heating off' : target !== null ? `target ${target} degrees` : 'no target';
  const source =
    a.source === 'gas' ? 'Gas' : Number.isFinite(a.source_code) ? `Source ${a.source_code} (unverified)` : 'Unknown';
  // Switch-over moves from gas, the cheaper source, to electric.
  const switchOver = a.switch_over === true ? 'On, gas to electric' : a.switch_over === false ? 'Off' : 'Unknown';
  const switchOverShort = a.switch_over === true ? 'on' : a.switch_over === false ? 'off' : 'unknown';

  return {
    days,
    off,
    target,
    unit,
    time,
    source,
    switchOver,
    when: `${day} · ${dateText} · ${time}`,
    repeats: repeatText(Array.isArray(a.repeat_days) ? a.repeat_days : null, lang),
    spoken: `Next scheduled event ${day.toLowerCase()} at ${time}, ${spokenGoal}`,
    summary: (showSource) =>
      `${day} ${time}: ${goal}${showSource ? `, ${source}, switch-over ${switchOverShort}` : ''}`,
  };
}
