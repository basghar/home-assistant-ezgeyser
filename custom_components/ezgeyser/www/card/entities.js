// The entities the card reads, by the card's own short key. Each value is the entity's translation key, the
// integration's stable name for it (also the suffix of its unique ID).
export const FIELDS = {
  top: 'temperature_top',
  bottom: 'temperature_bottom',
  target: 'temperature_target',
  source: 'heating_source',
  top_ok: 'temperature_top_ok',
  bottom_ok: 'temperature_bottom_ok',
  burner_left: 'heating_burner_1',
  burner_right: 'heating_burner_2',
  element_1: 'heating_element_1',
  element_2: 'heating_element_2',
  boost: 'heating_boost_mode',
  vacation: 'heating_vacation_mode',
  next_event: 'next_scheduled_event',
  timer: 'timer_remaining',
  wifi: 'network_wifi_signal',
  cloud: 'network_cloud_connection',
  clock: 'device_clock',
};

// Added after the first releases: a card keeps working while these are missing; a missing one hides its item.
export const OPTIONAL = new Set(['next_event', 'vacation', 'timer', 'wifi', 'cloud', 'clock']);

export const BINARY = new Set([
  'top_ok',
  'bottom_ok',
  'burner_left',
  'burner_right',
  'element_1',
  'element_2',
  'boost',
  'vacation',
  'cloud',
  'clock',
]);

// Entity IDs and translated names can change; device membership and the translation key identify each function.
// `entities` is hass.entities, by entity ID.
export function deviceEntities(entities, deviceId) {
  const entries = deviceId
    ? Object.values(entities).filter((e) => e.device_id === deviceId && e.platform === 'ezgeyser')
    : [];
  return Object.fromEntries(
    Object.entries(FIELDS).map(([key, translationKey]) => [
      key,
      entries.find((e) => e.translation_key === translationKey)?.entity_id || null,
    ]),
  );
}
