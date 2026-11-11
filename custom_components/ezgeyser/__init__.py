"""ezGeyser Direct: reads ezGeyser water heaters over the local network, read-only."""

from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .coordinator import EzGeyserConfigEntry, EzGeyserCoordinator

PLATFORMS: list[Platform] = [Platform.BINARY_SENSOR, Platform.SENSOR]


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
