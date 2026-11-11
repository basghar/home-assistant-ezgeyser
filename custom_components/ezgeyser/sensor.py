"""Temperature and heating-source sensors, from `/quickStatus`."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, override

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.typing import StateType

from .api import QuickStatus
from .coordinator import EzGeyserConfigEntry, EzGeyserCoordinator
from .entity import EzGeyserEntity

PARALLEL_UPDATES = 0

# `source` codes confirmed on a device. Electric and Hybrid are options already, but their codes have not been observed
# yet, so every code but 1 shows as unknown, with the raw code in the `source_code` attribute.
SOURCE_CODES: dict[int, str] = {1: "gas"}
SOURCE_OPTIONS = ["gas", "electric", "hybrid", "unknown"]


@dataclass(frozen=True, kw_only=True)
class EzGeyserSensorDescription(SensorEntityDescription):
    value_fn: Callable[[QuickStatus], StateType]
    attributes_fn: Callable[[QuickStatus], dict[str, Any]] | None = None


def _temperature(key: str, value_fn: Callable[[QuickStatus], StateType]) -> EzGeyserSensorDescription:
    return EzGeyserSensorDescription(
        key=key,
        translation_key=key,
        device_class=SensorDeviceClass.TEMPERATURE,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        value_fn=value_fn,
    )


SENSORS: tuple[EzGeyserSensorDescription, ...] = (
    # A reading is meaningful only while its sensor reports OK; otherwise the state is unknown, as in the Android app.
    _temperature("temperature_top", lambda status: status.top if status.top_ok else None),
    _temperature("temperature_bottom", lambda status: status.bottom if status.bottom_ok else None),
    _temperature("temperature_target", lambda status: status.target_temp),
    EzGeyserSensorDescription(
        key="heating_source",
        translation_key="heating_source",
        device_class=SensorDeviceClass.ENUM,
        options=SOURCE_OPTIONS,
        value_fn=lambda status: SOURCE_CODES.get(status.source, "unknown"),
        attributes_fn=lambda status: {"source_code": status.source},
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: EzGeyserConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    coordinator = entry.runtime_data
    async_add_entities(
        [*(EzGeyserSensor(coordinator, description) for description in SENSORS), NextEventSensor(coordinator)]
    )


class NextEventSensor(EzGeyserEntity, SensorEntity):
    _attr_translation_key = "next_scheduled_event"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, coordinator: EzGeyserCoordinator) -> None:
        super().__init__(coordinator, "next_scheduled_event")

    @property
    def native_value(self) -> datetime | None:
        return self.coordinator.next_event


class EzGeyserSensor(EzGeyserEntity, SensorEntity):
    entity_description: EzGeyserSensorDescription

    def __init__(self, coordinator: EzGeyserCoordinator, description: EzGeyserSensorDescription) -> None:
        super().__init__(coordinator, description.key)
        self.entity_description = description

    @property
    @override
    def native_value(self) -> StateType:
        return self.entity_description.value_fn(self.coordinator.data)

    @property
    @override
    def extra_state_attributes(self) -> dict[str, Any] | None:
        attributes_fn = self.entity_description.attributes_fn
        return attributes_fn(self.coordinator.data) if attributes_fn else None
