from datetime import UTC, datetime, timedelta

from custom_components.ezgeyser.const import DOMAIN
from custom_components.ezgeyser.schedule import NextEvent
from custom_components.ezgeyser.sensor import NEXT_EVENT_ATTRIBUTES
from freezegun.api import FrozenDateTimeFactory
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
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
}
# Every unsmoothed reading; disabled by default, so they have no state until enabled.
RAW_ENTITY_IDS = {"sensor.kitchen_temperature_top_raw", "sensor.kitchen_temperature_bottom_raw"}


async def _setup(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


def _answer(aioclient_mock: AiohttpClientMocker, quick_status: bytes | None = QUICK_STATUS, data: bytes = DATA) -> None:
    aioclient_mock.clear_requests()
    aioclient_mock.get(f"http://{HOST}/data", content=data)
    aioclient_mock.get(f"http://{HOST}/cloudStatus", content=CLOUD_STATUS)
    if quick_status is None:
        aioclient_mock.get(f"http://{HOST}/quickStatus", exc=TimeoutError())
    else:
        aioclient_mock.get(f"http://{HOST}/quickStatus", content=quick_status)


async def test_setup_creates_one_named_device_with_fifteen_prefixed_entities(
    hass: HomeAssistant, entry: MockConfigEntry, geyser: AiohttpClientMocker
) -> None:
    await _setup(hass, entry)

    assert entry.state is ConfigEntryState.LOADED
    device = dr.async_get(hass).async_get_device_by_identifier((DOMAIN, MAC), entry.entry_id)
    assert device is not None
    assert (device.name, device.manufacturer, device.model, device.sw_version) == (
        "Kitchen", "KytherTek", "Hybrid geyser · v2", "1.4.0",
    )  # fmt: skip
    assert (dr.CONNECTION_NETWORK_MAC, MAC) in device.connections
    entities = er.async_entries_for_device(er.async_get(hass), device.id, include_disabled_entities=True)
    assert {entity.entity_id for entity in entities} == set(ENTITY_IDS) | RAW_ENTITY_IDS
    assert {entity.entity_id for entity in entities if entity.disabled_by is er.RegistryEntryDisabler.INTEGRATION} == (
        RAW_ENTITY_IDS
    )
    assert {entity_id: hass.states.get(entity_id).state for entity_id in ENTITY_IDS} == ENTITY_IDS
    assert hass.states.get("sensor.kitchen_temperature_top").attributes["friendly_name"] == "Kitchen Temperature top"
    assert [str(call[1]) for call in geyser.mock_calls] == [
        f"http://{HOST}/data",
        f"http://{HOST}/quickStatus",
        f"http://{HOST}/api/schedules",
    ]


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
