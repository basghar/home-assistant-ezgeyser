// What the status badge and the footer's connectivity icons say about the geyser.

// The Wi-Fi level (the integration's enum states), its accessible label, and how many arcs are lit, as in the app.
export const WIFI = {
  excellent: { label: 'Excellent', arcs: 3 },
  good: { label: 'Good', arcs: 2 },
  fair: { label: 'Fair', arcs: 1 },
  weak: { label: 'Weak', arcs: 0 },
};

// What the badge and the footer's end say about the connection: a missing or unknown entity is neither shown nor an issue.
export function connectivity(shown) {
  const level = WIFI[shown.wifi?.state] ? shown.wifi.state : null;
  const cloud = ['on', 'off'].includes(shown.cloud?.state) ? shown.cloud.state === 'on' : null;
  return { level, cloud, clockOff: shown.clock?.state === 'on' };
}

// The badge counts sensor faults and connectivity problems: none is "All OK", one is named, several are counted. The
// visible name of a sensor fault is short ("Top sensor"): the badge shares row 1 with the name, and the striped tank half
// and the dash already say it is a fault. Screen readers hear the full name.
export function problems(shown, link) {
  const fault = (key) => shown[`${key}_ok`]?.state === 'off';
  return [
    fault('top') && 'Top sensor fault',
    fault('bottom') && 'Bottom sensor fault',
    link.level === 'weak' && 'Weak Wi-Fi',
    link.cloud === false && 'Cloud offline',
    link.clockOff && 'Clock off',
  ].filter(Boolean);
}

export function badgeText(issues) {
  if (issues.length > 1) return `${issues.length} issues`;
  return issues[0]?.replace(/ fault$/, '') || 'All OK';
}

// The footer's end group as one sentence: "Wi-Fi Weak, cloud offline, clock off".
export function linkLabel(link) {
  const text = [
    link.level && `Wi-Fi ${WIFI[link.level].label}`,
    link.cloud !== null && `cloud ${link.cloud ? 'online' : 'offline'}`,
    link.clockOff && 'clock off',
  ]
    .filter(Boolean)
    .join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
