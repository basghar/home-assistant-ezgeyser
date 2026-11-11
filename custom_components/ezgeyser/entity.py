"""The base of every ezGeyser entity: one device per geyser, identified by its MAC address."""

from homeassistant.const import CONF_HOST, CONF_MAC
from homeassistant.helpers.device_registry import CONNECTION_NETWORK_MAC, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER
from .coordinator import EzGeyserCoordinator


class EzGeyserEntity(CoordinatorEntity[EzGeyserCoordinator]):
    """Named after its device, so the device name you give is the prefix of every entity ID."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: EzGeyserCoordinator, key: str) -> None:
        super().__init__(coordinator)
        mac = coordinator.config_entry.data[CONF_MAC]
        identity = coordinator.identity
        self._attr_unique_id = f"{mac}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, mac)},
            connections={(CONNECTION_NETWORK_MAC, mac)},
            name=coordinator.config_entry.title,
            manufacturer=MANUFACTURER,
            model=identity.model,
            sw_version=identity.sw_version,
            hw_version=identity.hw_version,
            configuration_url=f"http://{coordinator.config_entry.data[CONF_HOST]}/",
        )
