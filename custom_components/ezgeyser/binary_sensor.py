"""Sensor-validity, heating, cloud-link and device-clock flags, from `/quickStatus`.

The states are what the firmware reports. Only idle values have been captured, so the polarity of the flags while
heating is unverified, and none of them is a safety signal: never read a burner flag as flame confirmation.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import override

from homeassistant.components.binary_sensor import BinarySensorEntity, BinarySensorEntityDescription
from homeassistant.components.binary_sensor.const import BinarySensorDeviceClass
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .coordinator import EzGeyserConfigEntry, EzGeyserCoordinator
from .entity import EzGeyserEntity

PARALLEL_UPDATES = 0


@dataclass(frozen=True, kw_only=True)
class EzGeyserBinarySensorDescription(BinarySensorEntityDescription):
    value_fn: Callable[[EzGeyserCoordinator], bool | None]


BINARY_SENSORS: tuple[EzGeyserBinarySensorDescription, ...] = (
    EzGeyserBinarySensorDescription(
        key="temperature_top_ok", translation_key="temperature_top_ok", value_fn=lambda c: c.data.top_ok
    ),
    EzGeyserBinarySensorDescription(
        key="temperature_bottom_ok", translation_key="temperature_bottom_ok", value_fn=lambda c: c.data.bottom_ok
    ),
    EzGeyserBinarySensorDescription(
        key="heating_burner_1", translation_key="heating_burner_1", value_fn=lambda c: c.data.burner1
    ),
    EzGeyserBinarySensorDescription(
        key="heating_burner_2", translation_key="heating_burner_2", value_fn=lambda c: c.data.burner2
    ),
    EzGeyserBinarySensorDescription(
        key="heating_element_1", translation_key="heating_element_1", value_fn=lambda c: c.data.element1
    ),
    EzGeyserBinarySensorDescription(
        key="heating_element_2", translation_key="heating_element_2", value_fn=lambda c: c.data.element2
    ),
    EzGeyserBinarySensorDescription(
        key="heating_boost_mode", translation_key="heating_boost_mode", value_fn=lambda c: c.data.boost
    ),
    EzGeyserBinarySensorDescription(
        key="heating_vacation_mode", translation_key="heating_vacation_mode", value_fn=lambda c: c.data.vacation
    ),
    EzGeyserBinarySensorDescription(
        key="network_cloud_connection",
        translation_key="network_cloud_connection",
        device_class=BinarySensorDeviceClass.CONNECTIVITY,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c: c.data.cloud,
    ),
    # On when the geyser's clock is more than 2 minutes from Home Assistant's local time (see `schedule.clock_off`).
    EzGeyserBinarySensorDescription(
        key="device_clock",
        translation_key="device_clock",
        device_class=BinarySensorDeviceClass.PROBLEM,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda c: c.clock_off,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: EzGeyserConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    coordinator = entry.runtime_data
    async_add_entities(EzGeyserBinarySensor(coordinator, description) for description in BINARY_SENSORS)


class EzGeyserBinarySensor(EzGeyserEntity, BinarySensorEntity):
    entity_description: EzGeyserBinarySensorDescription

    def __init__(self, coordinator: EzGeyserCoordinator, description: EzGeyserBinarySensorDescription) -> None:
        super().__init__(coordinator, description.key)
        self.entity_description = description

    @property
    @override
    def is_on(self) -> bool | None:
        return self.entity_description.value_fn(self.coordinator)
