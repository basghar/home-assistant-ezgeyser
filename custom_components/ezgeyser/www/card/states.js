// Reading values out of Home Assistant state objects.

export function numeric(state) {
  if (!state || ['unknown', 'unavailable', ''].includes(state.state)) return null;
  const n = Number(state.state);
  return Number.isFinite(n) ? n : null;
}

export function celsius(state) {
  const n = numeric(state);
  if (n === null) return null;
  const unit = state.attributes.unit_of_measurement;
  if (unit === '°F') return ((n - 32) * 5) / 9;
  if (unit === 'K') return n - 273.15;
  return n;
}
