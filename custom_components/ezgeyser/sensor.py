"""Temperature and heating-source sensors, from `/quickStatus`.

The tank temperatures are smoothed (see `smoothing.py`); the raw readings are separate sensors, disabled by default.
"""

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
from homeassistant.util.unit_conversion import TemperatureConverter

from .api import QuickStatus
from .coordinator import EzGeyserConfigEntry, EzGeyserCoordinator
from .entity import EzGeyserEntity

PARALLEL_UPDATES = 0

# `source` codes confirmed on a device. Electric and Hybrid are options already, but their codes have not been observed
# yet, so every code but 1 shows as unknown, with the raw code in the `source_code` attribute.
SOURCE_CODES: dict[int, str] = {1: "gas"}

NEXT_EVENT_ATTRIBUTES = ("target_temperature", "heating_off", "source", "source_code", "switch_over", "repeat_days")
# The schedule's weekday flags, Sunday first: the order the Android app assumes, not yet verified on a device.
WEEKDAYS = ("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")
SOURCE_OPTIONS = ["gas", "electric", "hybrid", "unknown"]


@dataclass(frozen=True, kw_only=True)
class EzGeyserSensorDescription(SensorEntityDescription):
    value_fn: Callable[[EzGeyserCoordinator], StateType]
    attributes_fn: Callable[[QuickStatus], dict[str, Any]] | None = None


def _temperature(
    key: str, value_fn: Callable[[EzGeyserCoordinator], StateType], *, enabled: bool = True
) -> EzGeyserSensorDescription:
    return EzGeyserSensorDescription(
        key=key,
        translation_key=key,
        device_class=SensorDeviceClass.TEMPERATURE,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        entity_registry_enabled_default=enabled,
        value_fn=value_fn,
    )


SENSORS: tuple[EzGeyserSensorDescription, ...] = (
    # A reading is meaningful only while its sensor reports OK; otherwise the state is unknown, as in the Android app.
    _temperature("temperature_top", lambda coordinator: coordinator.temperatures["temperature_top"]),
    _temperature("temperature_bottom", lambda coordinator: coordinator.temperatures["temperature_bottom"]),
    # Every 1-second reading, unsmoothed. Disabled by default: enabled, each stores about 2,600 history rows an hour.
    _temperature(
        "temperature_top_raw",
        lambda coordinator: coordinator.data.top if coordinator.data.top_ok else None,
        enabled=False,
    ),
    _temperature(
        "temperature_bottom_raw",
        lambda coordinator: coordinator.data.bottom if coordinator.data.bottom_ok else None,
        enabled=False,
    ),
    _temperature("temperature_target", lambda coordinator: coordinator.data.target_temp),
    EzGeyserSensorDescription(
        key="heating_source",
        translation_key="heating_source",
        device_class=SensorDeviceClass.ENUM,
        options=SOURCE_OPTIONS,
        value_fn=lambda coordinator: SOURCE_CODES.get(coordinator.data.source, "unknown"),
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
        event = self.coordinator.next_event
        return event.at if event else None

    @property
    @override
    def extra_state_attributes(self) -> dict[str, Any]:
        """The next event's settings, for the card's details and for automations.

        `target_temperature` is in Home Assistant's temperature unit and None when the event turns heating off
        (`heating_off`) or names no target. `repeat_days` is None for a one-off entry; its Sunday-first order is
        unverified.
        """
        event = self.coordinator.next_event
        if event is None:
            return dict.fromkeys(NEXT_EVENT_ATTRIBUTES)
        heating_off = event.target == 0 if event.target is not None else None
        target = None
        if event.target is not None and not heating_off:
            unit = self.hass.config.units.temperature_unit
            target = round(TemperatureConverter.convert(event.target, UnitOfTemperature.CELSIUS, unit), 1)
        source = None if event.source_code is None else SOURCE_CODES.get(event.source_code, "unknown")
        days = None if event.weekdays is None else [day for day, on in zip(WEEKDAYS, event.weekdays, strict=True) if on]
        return {
            "target_temperature": target,
            "heating_off": heating_off,
            "source": source,
            "source_code": event.source_code,
            "switch_over": event.switch_over,
            "repeat_days": days,
        }


class EzGeyserSensor(EzGeyserEntity, SensorEntity):
    entity_description: EzGeyserSensorDescription

    def __init__(self, coordinator: EzGeyserCoordinator, description: EzGeyserSensorDescription) -> None:
        super().__init__(coordinator, description.key)
        self.entity_description = description

    @property
    @override
    def native_value(self) -> StateType:
        return self.entity_description.value_fn(self.coordinator)

    @property
    @override
    def extra_state_attributes(self) -> dict[str, Any] | None:
        attributes_fn = self.entity_description.attributes_fn
        return attributes_fn(self.coordinator.data) if attributes_fn else None
