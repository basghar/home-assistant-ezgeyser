"""ezGeyser Direct: reads ezGeyser water heaters over the local network, read-only."""

from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .coordinator import EzGeyserConfigEntry, EzGeyserCoordinator
from .frontend import async_register_card

PLATFORMS: list[Platform] = [Platform.BINARY_SENSOR, Platform.SENSOR]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Publish the bundled dashboard card once, independently of device polling."""
    await async_register_card(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: EzGeyserConfigEntry) -> bool:
    """Read the geyser once, then create its device and entities."""
    coordinator = EzGeyserCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: EzGeyserConfigEntry) -> bool:
    """Stop polling and remove the entities."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
