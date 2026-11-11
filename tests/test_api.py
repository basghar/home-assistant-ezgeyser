import json
from typing import Any

from aiohttp import ClientError
from custom_components.ezgeyser.api import (
    GeyserClient,
    GeyserError,
    NotAGeyser,
    parse_identity,
    parse_quick_status,
)
import pytest
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from homeassistant.core import HomeAssistant

from .conftest import DATA, HOST, HOSTNAME, MAC, QUICK_STATUS


def _with(body: bytes, **changes: Any) -> bytes:
    return json.dumps({**json.loads(body), **changes}).encode()


def test_parse_quick_status_reads_the_captured_fixture() -> None:
    status = parse_quick_status(QUICK_STATUS)

    assert (status.top, status.top_ok, status.bottom, status.bottom_ok, status.target_temp) == (
        43.1,
        True,
        40.7,
        True,
        0,
    )
    assert (status.burner1, status.burner2, status.element1, status.element2) == (False,) * 4
    assert (status.source, status.boost) == (1, False)


@pytest.mark.parametrize(
    ("field", "value"),
    [("topOk", 2), ("burner1Status", True), ("boostMode", "1"), ("top", "43.1"), ("top", None), ("source", 1.5)],
)
def test_parse_quick_status_value_of_the_wrong_kind_is_refused(field: str, value: Any) -> None:
    with pytest.raises(NotAGeyser, match=field):
        parse_quick_status(_with(QUICK_STATUS, **{field: value}))


@pytest.mark.parametrize("body", [b"", b"<html>", b"[]", b'{"top": NaN}'])
def test_parse_quick_status_body_that_is_not_the_documented_object_is_refused(body: bytes) -> None:
    with pytest.raises(NotAGeyser):
        parse_quick_status(body)


def test_parse_identity_reads_mac_hostname_and_versions() -> None:
    identity = parse_identity(DATA)

    assert (identity.mac, identity.hostname) == (MAC, HOSTNAME)
    assert (identity.model, identity.sw_version, identity.hw_version) == ("Hybrid geyser · v2", "1.4.0", "v2")


@pytest.mark.parametrize("changes", [{"host": ""}, {"mac": "not-a-mac"}, {"mac": None}])
def test_parse_identity_without_a_host_or_mac_is_not_a_geyser(changes: dict[str, Any]) -> None:
    with pytest.raises(NotAGeyser):
        parse_identity(_with(DATA, **changes))


async def test_probe_asks_cloud_status_then_data(hass: HomeAssistant, geyser: AiohttpClientMocker) -> None:
    identity = await GeyserClient(hass, HOST).probe()

    assert identity.mac == MAC
    assert [str(call[1]) for call in geyser.mock_calls] == [f"http://{HOST}/cloudStatus", f"http://{HOST}/data"]
    assert geyser.mock_calls[0][3] == {"Accept": "application/json", "Connection": "close"}


async def test_probe_of_a_stranger_costs_one_request(hass: HomeAssistant, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(f"http://{HOST}/cloudStatus", text="<html>printer</html>")

    with pytest.raises(NotAGeyser):
        await GeyserClient(hass, HOST).probe()

    assert aioclient_mock.call_count == 1


@pytest.mark.parametrize(
    ("kwargs", "error"),
    [
        ({"status": 500}, NotAGeyser),
        ({"status": 302}, NotAGeyser),
        ({"content": b"x" * 9000}, NotAGeyser),
        ({"exc": ClientError()}, GeyserError),
        ({"exc": TimeoutError()}, GeyserError),
    ],
)
async def test_quick_status_failures_raise_geyser_errors(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker, kwargs: dict[str, Any], error: type[Exception]
) -> None:
    aioclient_mock.get(f"http://{HOST}/quickStatus", **kwargs)

    with pytest.raises(error):
        await GeyserClient(hass, HOST).quick_status()
