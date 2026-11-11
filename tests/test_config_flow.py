from ipaddress import ip_address
from unittest.mock import AsyncMock, patch

from custom_components.ezgeyser.api import parse_identity
from custom_components.ezgeyser.const import DOMAIN
from custom_components.ezgeyser.discovery import FoundGeyser
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from homeassistant.config_entries import SOURCE_DHCP, SOURCE_USER, SOURCE_ZEROCONF
from homeassistant.const import CONF_HOST, CONF_MAC, CONF_NAME
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers.service_info.dhcp import DhcpServiceInfo
from homeassistant.helpers.service_info.zeroconf import ZeroconfServiceInfo

from .conftest import DATA, HOST, HOSTNAME, MAC

pytestmark = pytest.mark.usefixtures("no_setup")

DHCP_INFO = DhcpServiceInfo(ip=HOST, hostname=HOSTNAME.lower(), macaddress="70041d123456")
ZEROCONF_INFO = ZeroconfServiceInfo(
    ip_address=ip_address(HOST),
    ip_addresses=[ip_address(HOST)],
    port=80,
    hostname=f"{HOSTNAME}.local.",
    type="_http._tcp.local.",
    name=f"{HOSTNAME}._http._tcp.local.",
    properties={},
)


async def _user(hass: HomeAssistant, host: str) -> dict:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["step_id"] == "user"
    return await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_HOST: host})


@pytest.mark.usefixtures("geyser")
async def test_user_by_address_then_name(hass: HomeAssistant) -> None:
    result = await _user(hass, f" {HOST} ")
    assert result["step_id"] == "name"
    assert result["description_placeholders"] == {"host": HOST, "hostname": HOSTNAME}

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_NAME: "Kitchen"})

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Kitchen"
    assert result["result"].unique_id == MAC
    assert result["data"][CONF_HOST] == HOST
    assert result["data"][CONF_MAC] == MAC


@pytest.mark.parametrize("host", ["8.8.8.8", "example.com", "http://192.168.50.51"])
async def test_user_address_off_the_local_network_is_refused_without_a_request(
    hass: HomeAssistant, aioclient_mock: AiohttpClientMocker, host: str
) -> None:
    result = await _user(hass, host)

    assert result["errors"] == {CONF_HOST: "invalid_host"}
    assert aioclient_mock.call_count == 0


async def test_user_address_that_does_not_answer(hass: HomeAssistant, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(f"http://{HOST}/cloudStatus", exc=TimeoutError())

    assert (await _user(hass, HOST))["errors"] == {"base": "cannot_connect"}


async def test_user_address_of_another_device(hass: HomeAssistant, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(f"http://{HOST}/cloudStatus", status=404)

    assert (await _user(hass, HOST))["errors"] == {"base": "not_ezgeyser"}


@pytest.mark.usefixtures("geyser")
async def test_user_geyser_already_added_aborts(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    entry.add_to_hass(hass)

    result = await _user(hass, HOST)

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "already_configured"


async def test_user_empty_address_scans_and_picks(hass: HomeAssistant) -> None:
    found = [FoundGeyser(HOST, parse_identity(DATA))]
    with patch("custom_components.ezgeyser.config_flow.async_scan", AsyncMock(return_value=found)) as scan:
        result = await _user(hass, "")

    assert result["step_id"] == "pick_device"
    assert scan.await_args.kwargs == {"skip_hosts": set(), "skip_macs": set()}
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"device": MAC})
    assert result["step_id"] == "name"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_NAME: "Bathroom"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert (result["title"], result["data"][CONF_HOST]) == ("Bathroom", HOST)


async def test_user_scan_that_finds_nothing_returns_to_the_address_form(hass: HomeAssistant) -> None:
    with patch("custom_components.ezgeyser.config_flow.async_scan", AsyncMock(return_value=[])):
        result = await _user(hass, "")

    assert result["step_id"] == "user"
    assert result["errors"] == {"base": "no_devices_found"}


@pytest.mark.usefixtures("geyser")
async def test_dhcp_discovery_confirms_with_a_name(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_DHCP}, data=DHCP_INFO)
    assert result["step_id"] == "discovery_confirm"

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_NAME: "Kitchen"})

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["result"].unique_id == MAC


async def test_dhcp_discovery_of_an_added_geyser_updates_its_address_without_a_request(
    hass: HomeAssistant, entry: MockConfigEntry, aioclient_mock: AiohttpClientMocker
) -> None:
    entry.add_to_hass(hass)
    moved = DhcpServiceInfo(ip="192.168.50.99", hostname=HOSTNAME.lower(), macaddress="70041d123456")

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_DHCP}, data=moved)

    assert result["reason"] == "already_configured"
    assert entry.data[CONF_HOST] == "192.168.50.99"
    assert aioclient_mock.call_count == 0


@pytest.mark.usefixtures("geyser")
async def test_zeroconf_discovery_confirms_with_a_name(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_ZEROCONF}, data=ZEROCONF_INFO)
    assert result["step_id"] == "discovery_confirm"
    assert result["description_placeholders"]["hostname"] == HOSTNAME

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_NAME: "Kitchen"})

    assert result["type"] is FlowResultType.CREATE_ENTRY


async def test_zeroconf_discovery_of_an_added_geyser_is_recognised_by_name(
    hass: HomeAssistant, entry: MockConfigEntry, aioclient_mock: AiohttpClientMocker
) -> None:
    entry.add_to_hass(hass)

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_ZEROCONF}, data=ZEROCONF_INFO)

    assert result["reason"] == "already_configured"
    assert aioclient_mock.call_count == 0


async def test_discovery_of_something_else_aborts(hass: HomeAssistant, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(f"http://{HOST}/cloudStatus", status=404)

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_DHCP}, data=DHCP_INFO)

    assert result["reason"] == "not_ezgeyser"


async def test_reconfigure_changes_the_address_of_the_same_geyser(
    hass: HomeAssistant, entry: MockConfigEntry, aioclient_mock: AiohttpClientMocker
) -> None:
    entry.add_to_hass(hass)
    new = "192.168.50.60"
    aioclient_mock.get(f"http://{new}/cloudStatus", text='{"state":"registered"}')
    aioclient_mock.get(f"http://{new}/data", content=DATA)

    result = await entry.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_HOST: new})

    assert result["reason"] == "reconfigure_successful"
    assert entry.data[CONF_HOST] == new


async def test_reconfigure_to_a_different_geyser_is_refused(
    hass: HomeAssistant, entry: MockConfigEntry, aioclient_mock: AiohttpClientMocker
) -> None:
    entry.add_to_hass(hass)
    other = DATA.replace(b"70:04:1D:12:34:56", b"70:04:1D:00:00:01")
    aioclient_mock.get(f"http://{HOST}/cloudStatus", text='{"state":"registered"}')
    aioclient_mock.get(f"http://{HOST}/data", content=other)

    result = await entry.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_HOST: HOST})

    assert result["reason"] == "wrong_device"
