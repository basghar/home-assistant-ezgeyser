"""Temperature and heating-source sensors, from `/quickStatus`."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import override

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
GAS_SOURCE_CODE = 1  # The only `source` code confirmed so far; others are shown as codes.


@dataclass(frozen=True, kw_only=True)
class EzGeyserSensorDescription(SensorEntityDescription):
    value_fn: Callable[[QuickStatus], StateType]


def _source(code: int) -> str:
    return "Gas" if code == GAS_SOURCE_CODE else f"Code {code} (unverified)"


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
        value_fn=lambda status: _source(status.source),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: EzGeyserConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    coordinator = entry.runtime_data
    async_add_entities(EzGeyserSensor(coordinator, description) for description in SENSORS)


class EzGeyserSensor(EzGeyserEntity, SensorEntity):
    entity_description: EzGeyserSensorDescription

    def __init__(self, coordinator: EzGeyserCoordinator, description: EzGeyserSensorDescription) -> None:
        super().__init__(coordinator, description.key)
        self.entity_description = description

    @property
    @override
    def native_value(self) -> StateType:
        return self.entity_description.value_fn(self.coordinator.data)
