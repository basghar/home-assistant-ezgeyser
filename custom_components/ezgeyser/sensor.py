"""Temperature, heating-source, Wi-Fi and timer sensors, from `/quickStatus`.

The tank temperatures are smoothed (see `smoothing.py`); the raw readings are separate sensors, disabled by default.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Final, override

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import SIGNAL_STRENGTH_DECIBELS_MILLIWATT, EntityCategory, UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.typing import StateType
from homeassistant.util.unit_conversion import TemperatureConverter

from .api import QuickStatus
from .coordinator import EzGeyserConfigEntry, EzGeyserCoordinator
from .entity import EzGeyserEntity

PARALLEL_UPDATES = 0

# `source` codes, read from the geyser's firmware as in the Android app: hybrid runs gas and electric together. Any
# other code shows as unknown, with the raw code in the `source_code` attribute.
SOURCE_CODES: dict[int, str] = {1: "gas", 2: "electric", 3: "hybrid"}
# A schedule's source and switch-over as the one choice they are, the Android app's heating modes. With switch-over, gas
# moves to electric while ignition fails and electric to gas during a power cut; hybrid already runs both, so the
# firmware ignores its switch-over. An unlisted switch-over reads as off, the firmware's default.
HEATING_MODES: dict[tuple[str, bool], str] = {
    ("gas", False): "gas_only",
    ("gas", True): "gas_backup",
    ("electric", False): "electric_only",
    ("electric", True): "electric_backup",
    ("hybrid", False): "hybrid",
    ("hybrid", True): "hybrid",
}

NEXT_EVENT_ATTRIBUTES = (
    "target_temperature",
    "heating_off",
    "heating_mode",
    "source",
    "source_code",
    "switch_over",
    "repeat_days",
)
# The schedule's weekday flags, Sunday first: the order the Android app assumes, not yet verified on a device.
WEEKDAYS = ("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")
SOURCE_OPTIONS = ["gas", "electric", "hybrid", "unknown"]
WIFI_LEVELS = ["excellent", "good", "fair", "weak", "very_weak"]
# dBm; the weakest reading of each level, as in the Android app. Anything below `WIFI_WEAK` is very weak, the only level
# the card warns about: a geyser sends so little that weak still works.
WIFI_EXCELLENT: Final = -50
WIFI_GOOD: Final = -60
WIFI_FAIR: Final = -70
WIFI_WEAK: Final = -80


def heating_mode(source_code: int | None, switch_over: bool | None) -> str | None:
    """The heating mode a configured source and switch-over select; None for a missing or unknown source code.

    Only for configured pairs, such as a schedule's: the live source is the one in use, which switch-over may have
    replaced, so the heating source sensor has no mode.
    """
    source = SOURCE_CODES.get(source_code) if source_code is not None else None
    return HEATING_MODES.get((source, switch_over is True)) if source else None


def wifi_level(rssi: int | None) -> str | None:
    """-50 dBm or more excellent, -51 to -60 good, -61 to -70 fair, -71 to -80 weak, -81 or less very weak."""
    if rssi is None:
        return None
    if rssi >= WIFI_EXCELLENT:
        return "excellent"
    if rssi >= WIFI_GOOD:
        return "good"
    if rssi >= WIFI_FAIR:
        return "fair"
    return "weak" if rssi >= WIFI_WEAK else "very_weak"


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
    # The level stores no raw RSSI attribute; the rounded dBm reading is separate and disabled by default.
    EzGeyserSensorDescription(
        key="network_wifi_signal",
        translation_key="network_wifi_signal",
        device_class=SensorDeviceClass.ENUM,
        options=WIFI_LEVELS,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda coordinator: wifi_level(coordinator.data.rssi),
    ),
    EzGeyserSensorDescription(
        key="network_wifi_rssi",
        translation_key="network_wifi_rssi",
        device_class=SensorDeviceClass.SIGNAL_STRENGTH,
        native_unit_of_measurement=SIGNAL_STRENGTH_DECIBELS_MILLIWATT,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        value_fn=lambda coordinator: coordinator.wifi_rssi,
    ),
    # The firmware's number as sent: its unit is unverified, so it has none, and no statistics.
    EzGeyserSensorDescription(
        key="timer_remaining",
        translation_key="timer_remaining",
        value_fn=lambda coordinator: coordinator.data.remaining,
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
        (`heating_off`) or names no target. `heating_mode` is `source` and `switch_over` as one choice. `repeat_days`
        lists the days the entry runs on; its Sunday-first order is unverified.
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
            "heating_mode": heating_mode(event.source_code, event.switch_over),
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
