// The card's configuration: validation, the visual editor's form, and the card picker's starting config.
import { BINARY, FIELDS } from './entities.js';

export function validateConfig(config) {
  if (config.device_id !== undefined && typeof config.device_id !== 'string') {
    throw new Error('device_id must be a Home Assistant device ID');
  }
  if (config.device_id === undefined && !config.entity && !config.entities?.top) {
    throw new Error('Select an ezGeyser device');
  }
  if (config.main && !['top', 'bottom'].includes(config.main)) {
    throw new Error('main must be top or bottom');
  }
  if (config.element_count !== undefined && ![1, 2].includes(config.element_count)) {
    throw new Error('element_count must be 1 or 2');
  }
  if (config.theme && !['auto', 'light', 'dark'].includes(config.theme)) {
    throw new Error('theme must be auto, light or dark');
  }
  if (config.show_heat_source !== undefined && typeof config.show_heat_source !== 'boolean') {
    throw new Error('show_heat_source must be true or false');
  }
  // Legacy cards map entities by hand, without a device ID.
  for (const [key, id] of Object.entries(config.entities || {})) {
    const domain = BINARY.has(key) ? 'binary_sensor' : 'sensor';
    if (!(key in FIELDS) || typeof id !== 'string' || !id.startsWith(`${domain}.`)) {
      throw new Error(`Invalid entity mapping: ${key}`);
    }
  }
}

const LABELS = {
  device_id: 'Geyser',
  name: 'Name (optional)',
  main: 'Main temperature',
  element_count: 'Electric elements',
  theme: 'Theme',
  show_heat_source: 'Show heating mode in schedule details',
};

export const configForm = () => ({
  schema: [
    { name: 'device_id', required: true, selector: { device: { filter: [{ integration: 'ezgeyser' }] } } },
    { name: 'name', selector: { text: {} } },
    { name: 'main', selector: { select: { options: ['top', 'bottom'] } } },
    { name: 'element_count', selector: { number: { min: 1, max: 2, step: 1, mode: 'box' } } },
    { name: 'theme', selector: { select: { options: ['auto', 'light', 'dark'] } } },
    { name: 'show_heat_source', default: true, selector: { boolean: {} } },
  ],
  computeLabel: (field) => LABELS[field.name],
  computeHelper: (field) =>
    field.name === 'show_heat_source' ? 'Turn off for a gas-only or electric-only geyser.' : undefined,
  assertConfig: (config) => {
    if (config.entity || config.entities) {
      throw new Error(
        'This legacy card uses entity mappings. Use YAML, or replace them with device_id to use the device selector.',
      );
    }
  },
});

// The first ezGeyser device, for a card just added from the picker.
export function stubConfig(hass) {
  const first = Object.values(hass.entities || {}).find((e) => e.platform === 'ezgeyser' && e.device_id);
  return { device_id: first?.device_id || '' };
}
