from datetime import UTC, datetime, timedelta
import json
from typing import Any

from custom_components.ezgeyser.const import DOMAIN
from custom_components.ezgeyser.schedule import NextEvent
from custom_components.ezgeyser.sensor import NEXT_EVENT_ATTRIBUTES, wifi_level
from freezegun.api import FrozenDateTimeFactory
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import CONF_HOST, STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.util import dt as dt_util
from homeassistant.util.unit_system import US_CUSTOMARY_SYSTEM

from .conftest import CLOUD_STATUS, DATA, HOST, MAC, QUICK_STATUS

ENTITY_IDS = {
    "sensor.kitchen_next_scheduled_event": "unknown",
    "sensor.kitchen_temperature_top": "43.1",
    "binary_sensor.kitchen_temperature_top_ok": STATE_ON,
    "sensor.kitchen_temperature_bottom": "40.7",
    "binary_sensor.kitchen_temperature_bottom_ok": STATE_ON,
    "sensor.kitchen_temperature_target": "0.0",
    "binary_sensor.kitchen_burner_left_flame_sensor": STATE_OFF,
    "binary_sensor.kitchen_burner_right_flame_sensor": STATE_OFF,
    "binary_sensor.kitchen_heating_element_1": STATE_OFF,
    "binary_sensor.kitchen_heating_element_2": STATE_OFF,
    "sensor.kitchen_heating_source": "gas",
    "binary_sensor.kitchen_heating_boost_mode": STATE_OFF,
    "binary_sensor.kitchen_heating_vacation_mode": STATE_OFF,
    "sensor.kitchen_timer_remaining": "0",
    "sensor.kitchen_network_wi_fi_signal": "fair",
    "binary_sensor.kitchen_network_cloud_connection": STATE_ON,
    # The captured clock is from 2026-11-10, so it is off against the time the tests run at.
    "binary_sensor.kitchen_device_clock": STATE_ON,
}
DIAGNOSTIC_ENTITY_IDS = {
    "sensor.kitchen_network_wi_fi_signal",
    "sensor.kitchen_network_wi_fi_rssi",
    "binary_sensor.kitchen_network_cloud_connection",
    "binary_sensor.kitchen_device_clock",
}
# Optional readings; disabled by default, so they have no state until enabled.
RAW_ENTITY_IDS = {
    "sensor.kitchen_temperature_top_raw",
    "sensor.kitchen_temperature_bottom_raw",
    "sensor.kitchen_network_wi_fi_rssi",
}


async def _setup(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


def _answer(
    aioclient_mock: AiohttpClientMocker,
    quick_status: bytes | None = QUICK_STATUS,
    data: bytes = DATA,
    schedules: bytes | None = b"[]",
) -> None:
    aioclient_mock.clear_requests()
    aioclient_mock.get(f"http://{HOST}/data", content=data)
    aioclient_mock.get(f"http://{HOST}/cloudStatus", content=CLOUD_STATUS)
    if quick_status is None:
        aioclient_mock.get(f"http://{HOST}/quickStatus", exc=TimeoutError())
    else:
        aioclient_mock.get(f"http://{HOST}/quickStatus", content=quick_status)
    if schedules is None:
        aioclient_mock.get(f"http://{HOST}/api/schedules", exc=TimeoutError())
    else:
        aioclient_mock.get(f"http://{HOST}/api/schedules", content=schedules)


def _status(**changes: Any) -> bytes:
    return json.dumps({**json.loads(QUICK_STATUS), **changes}).encode()


def _device_now(offset: timedelta = timedelta(), *, after: float = 1) -> int:
    """Home Assistant's local wall time `after` seconds from now (at the next poll), encoded as the geyser sends it."""
    return int((dt_util.now() + offset + timedelta(seconds=after)).replace(tzinfo=UTC).timestamp())


async def _tick(hass: HomeAssistant, freezer: FrozenDateTimeFactory, seconds: float = 1) -> None:
    freezer.tick(timedelta(seconds=seconds))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_setup_creates_one_named_device_with_twenty_prefixed_entities(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker
) -> None:
    await _setup(hass, entry)

    assert entry.state is ConfigEntryState.LOADED
    device = dr.async_get(hass).async_get_device_by_identifier((DOMAIN, MAC), entry.entry_id)
    assert device is not None
    assert (device.name, device.manufacturer, device.model, device.sw_version) == (
        "Kitchen", "KytherTek", "Hybrid geyser · v2", "1.4.0",
    )  # fmt: skip
    assert device.configuration_url == f"http://{HOST}/"
    assert (dr.CONNECTION_NETWORK_MAC, MAC) in device.connections
    entities = er.async_entries_for_device(er.async_get(hass), device.id, include_disabled_entities=True)
    assert {entity.entity_id for entity in entities} == set(ENTITY_IDS) | RAW_ENTITY_IDS
    assert {entity.entity_id for entity in entities if entity.disabled_by is er.RegistryEntryDisabler.INTEGRATION} == (
        RAW_ENTITY_IDS
    )
    assert {entity.entity_id for entity in entities if entity.entity_category is er.EntityCategory.DIAGNOSTIC} == (
        DIAGNOSTIC_ENTITY_IDS
    )
    assert {entity_id: hass.states.get(entity_id).state for entity_id in ENTITY_IDS} == ENTITY_IDS
    assert hass.states.get("sensor.kitchen_temperature_top").attributes["friendly_name"] == "Kitchen Temperature top"
    assert [str(call[1]) for call in geyser.mock_calls] == [
        f"http://{HOST}/data",
        f"http://{HOST}/quickStatus",
        f"http://{HOST}/api/schedules",
    ]


async def test_device_page_address_follows_a_host_change_after_reload(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker
) -> None:
    await _setup(hass, entry)
    registry = dr.async_get(hass)
    device = registry.async_get_device_by_identifier((DOMAIN, MAC), entry.entry_id)
    assert device is not None
    device_id = device.id
    new_host = "192.168.50.77"
    geyser.get(f"http://{new_host}/data", content=DATA)
    geyser.get(f"http://{new_host}/quickStatus", content=QUICK_STATUS)
    geyser.get(f"http://{new_host}/api/schedules", content=b"[]")
    hass.config_entries.async_update_entry(entry, data={**entry.data, CONF_HOST: new_host})

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()

    device = registry.async_get_device_by_identifier((DOMAIN, MAC), entry.entry_id)
    assert device is not None
    assert device.id == device_id
    assert device.configuration_url == f"http://{new_host}/"


async def test_setup_retries_while_the_geyser_does_not_answer(
    hass: HomeAssistant, entry: MockConfigEntry, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(f"http://{HOST}/data", exc=TimeoutError())

    await _setup(hass, entry)

    assert entry.state is ConfigEntryState.SETUP_RETRY


async def test_setup_retries_when_another_geyser_answers_at_the_address(
    hass: HomeAssistant, entry: MockConfigEntry, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(f"http://{HOST}/data", content=DATA.replace(b"70:04:1D:12:34:56", b"70:04:1D:00:00:01"))

    await _setup(hass, entry)

    assert entry.state is ConfigEntryState.SETUP_RETRY


async def test_polls_every_second_and_unknown_temperature_while_its_sensor_is_not_ok(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass, entry)
    _answer(
        geyser, QUICK_STATUS.replace(b'"topOk":1', b'"topOk":0').replace(b'"burner2Status":0', b'"burner2Status":1')
    )

    freezer.tick(timedelta(seconds=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert hass.states.get("sensor.kitchen_temperature_top").state == STATE_UNKNOWN
    assert hass.states.get("binary_sensor.kitchen_temperature_top_ok").state == STATE_OFF
    assert hass.states.get("binary_sensor.kitchen_burner_right_flame_sensor").state == STATE_ON


async def _poll(hass: HomeAssistant, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory, top: float) -> None:
    _answer(geyser, QUICK_STATUS.replace(b'"top":43.1', f'"top":{top}'.encode()))
    freezer.tick(timedelta(seconds=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_scatter_in_the_top_reading_does_not_change_the_temperature(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass, entry)

    for top in (43.3, 42.9, 43.2, 43.0, 43.4, 42.8):
        await _poll(hass, geyser, freezer, top)
        assert hass.states.get("sensor.kitchen_temperature_top").state == "43.1"


async def test_an_enabled_raw_temperature_shows_every_reading(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        DOMAIN,
        f"{MAC}_temperature_top_raw",
        config_entry=entry,
        suggested_object_id="kitchen_temperature_top_raw",
    )
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get("sensor.kitchen_temperature_top_raw").state == "43.1"

    await _poll(hass, geyser, freezer, 43.4)

    assert hass.states.get("sensor.kitchen_temperature_top_raw").state == "43.4"
    assert hass.states.get("sensor.kitchen_temperature_top").state == "43.1"


async def test_heating_source_is_an_enum_and_an_unconfirmed_code_is_unknown_with_the_code_kept(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass, entry)
    source = hass.states.get("sensor.kitchen_heating_source")
    assert source.attributes["options"] == ["gas", "electric", "hybrid", "unknown"]
    assert source.attributes["source_code"] == 1

    _answer(geyser, QUICK_STATUS.replace(b'"source":1', b'"source":3'))
    freezer.tick(timedelta(seconds=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    source = hass.states.get("sensor.kitchen_heating_source")
    assert (source.state, source.attributes["source_code"]) == ("unknown", 3)


async def test_two_missed_reads_are_tolerated_and_the_third_makes_it_unavailable(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass, entry)
    _answer(geyser, quick_status=None)
    top = "sensor.kitchen_temperature_top"

    for seconds, state in [(1, "43.1"), (2, "43.1"), (2, STATE_UNAVAILABLE)]:
        freezer.tick(timedelta(seconds=seconds))
        async_fire_time_changed(hass)
        await hass.async_block_till_done()
        assert hass.states.get(top).state == state

    _answer(geyser)
    freezer.tick(timedelta(seconds=4))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert hass.states.get(top).state == "43.1"


async def test_unload_stops_polling(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass, entry)
    assert await hass.config_entries.async_unload(entry.entry_id)
    calls = geyser.call_count

    freezer.tick(timedelta(seconds=5))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    assert entry.state is ConfigEntryState.NOT_LOADED
    assert geyser.call_count == calls


async def test_next_event_attributes_carry_the_schedule_settings(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker
) -> None:
    await _setup(hass, entry)
    coordinator = entry.runtime_data
    entity_id = "sensor.kitchen_next_scheduled_event"
    assert hass.states.get(entity_id).attributes["heating_off"] is None

    at = datetime(2026, 11, 12, 1, 0, tzinfo=UTC)
    coordinator.next_event = NextEvent(at, 60.0, 1, False, (True, True, True, True, True, True, True))
    coordinator.async_update_listeners()
    state = hass.states.get(entity_id)
    assert state.state == "2026-11-12T01:00:00+00:00"
    assert {key: state.attributes[key] for key in NEXT_EVENT_ATTRIBUTES} == {
        "target_temperature": 60.0,
        "heating_off": False,
        "source": "gas",
        "source_code": 1,
        "switch_over": False,
        "repeat_days": ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    }

    coordinator.next_event = NextEvent(at, 0.0, 3, True, (False, True, False, False, False, False, True))
    coordinator.async_update_listeners()
    attributes = hass.states.get(entity_id).attributes
    assert (attributes["target_temperature"], attributes["heating_off"]) == (None, True)
    assert (attributes["source"], attributes["source_code"], attributes["switch_over"]) == ("unknown", 3, True)
    assert attributes["repeat_days"] == ["monday", "saturday"]

    hass.config.units = US_CUSTOMARY_SYSTEM
    coordinator.next_event = NextEvent(at, 60.0)
    coordinator.async_update_listeners()
    attributes = hass.states.get(entity_id).attributes
    assert (attributes["target_temperature"], attributes["source"], attributes["repeat_days"]) == (140.0, None, None)


@pytest.mark.parametrize(
    ("rssi", "level"),
    [(-30, "excellent"), (-50, "excellent"), (-51, "good"), (-60, "good"), (-61, "fair"), (-70, "fair"),
     (-71, "weak"), (-90, "weak"), (None, None)],
)  # fmt: skip
def test_wifi_level_uses_the_android_bands(rssi: int | None, level: str | None) -> None:
    assert wifi_level(rssi) == level


async def test_wifi_cloud_and_timer_follow_the_status_and_are_unknown_when_left_out(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass, entry)
    signal = hass.states.get("sensor.kitchen_network_wi_fi_signal")
    assert signal.attributes["options"] == ["excellent", "good", "fair", "weak"]
    assert "rssi" not in signal.attributes
    timer = hass.states.get("sensor.kitchen_timer_remaining")
    assert ("unit_of_measurement" not in timer.attributes, "state_class" not in timer.attributes) == (True, True)

    _answer(geyser, _status(rssi=-71, mqtt=0, remaining=25))
    await _tick(hass, freezer)
    assert hass.states.get("sensor.kitchen_network_wi_fi_signal").state == "weak"
    assert hass.states.get("binary_sensor.kitchen_network_cloud_connection").state == STATE_OFF
    assert hass.states.get("sensor.kitchen_timer_remaining").state == "25"

    status = json.loads(QUICK_STATUS)
    for field in ("rssi", "mqtt", "remaining"):
        del status[field]
    _answer(geyser, json.dumps(status).encode())
    await _tick(hass, freezer)
    assert hass.states.get("sensor.kitchen_temperature_top").state == "43.1"
    for entity_id in (
        "sensor.kitchen_network_wi_fi_signal",
        "binary_sensor.kitchen_network_cloud_connection",
        "sensor.kitchen_timer_remaining",
    ):
        assert hass.states.get(entity_id).state == STATE_UNKNOWN


async def test_an_enabled_wifi_rssi_is_rounded_without_raw_attributes(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor", DOMAIN, f"{MAC}_network_wifi_rssi", config_entry=entry, suggested_object_id="kitchen_wifi_rssi"
    )
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    rssi = hass.states.get("sensor.kitchen_wifi_rssi")
    assert (rssi.state, rssi.attributes["unit_of_measurement"], rssi.attributes["device_class"]) == (
        "-65", "dBm", "signal_strength",
    )  # fmt: skip
    assert "rssi" not in rssi.attributes

    for reading in (-63, -62, -63, -62):
        _answer(geyser, _status(rssi=reading))
        await _tick(hass, freezer)
        assert hass.states.get("sensor.kitchen_wifi_rssi").state == "-65"
        assert hass.states.get("sensor.kitchen_network_wi_fi_signal").state == "fair"

    _answer(geyser, _status(rssi=-59))
    await _tick(hass, freezer)
    assert hass.states.get("sensor.kitchen_wifi_rssi").state == "-60"
    assert hass.states.get("sensor.kitchen_network_wi_fi_signal").state == "good"

    status = json.loads(QUICK_STATUS)
    del status["rssi"]
    _answer(geyser, json.dumps(status).encode())
    await _tick(hass, freezer)
    assert hass.states.get("sensor.kitchen_wifi_rssi").state == STATE_UNKNOWN

    _answer(geyser, _status(rssi=-62))
    await _tick(hass, freezer)
    assert hass.states.get("sensor.kitchen_wifi_rssi").state == "-60"


async def test_device_clock_is_a_problem_more_than_two_minutes_from_home_assistant(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass, entry)
    clock = "binary_sensor.kitchen_device_clock"

    for offset, state in [
        (timedelta(), STATE_OFF),
        (timedelta(seconds=-110), STATE_OFF),
        (timedelta(seconds=130), STATE_ON),
        (timedelta(minutes=-3), STATE_ON),
    ]:
        _answer(geyser, _status(now=_device_now(offset)))
        await _tick(hass, freezer)
        assert hass.states.get(clock).state == state

    _answer(geyser, _status(now=0))
    await _tick(hass, freezer)
    assert hass.states.get(clock).state == STATE_UNKNOWN


async def test_a_failed_or_unreadable_schedules_read_keeps_the_last_schedules(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker, freezer: FrozenDateTimeFactory
) -> None:
    start = (dt_util.now() + timedelta(hours=2)).strftime("%H:%M")
    schedules = json.dumps([{"isEnabled": True, "repetitionIsEnabled": False, "start": start}]).encode()
    _answer(geyser, _status(now=_device_now(after=0)), schedules=schedules)
    await _setup(hass, entry)
    event = "sensor.kitchen_next_scheduled_event"
    expected = hass.states.get(event).state
    assert expected != STATE_UNKNOWN

    for failed in (None, b"<html>busy</html>", b'{"not": "a list"}'):
        _answer(geyser, _status(now=_device_now(after=60)), schedules=failed)
        await _tick(hass, freezer, 60)
        assert [str(call[1]) for call in geyser.mock_calls][-1] == f"http://{HOST}/api/schedules"
        assert hass.states.get(event).state == expected

    _answer(geyser, _status(now=_device_now(after=60)), schedules=b"[]")
    await _tick(hass, freezer, 60)
    assert hass.states.get(event).state == STATE_UNKNOWN
