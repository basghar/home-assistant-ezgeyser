"""Fixtures: every test may load `custom_components/ezgeyser`, and no test reaches a real network."""

from collections.abc import Generator
from pathlib import Path
from unittest.mock import patch

from custom_components.ezgeyser.const import CONF_HOSTNAME, CONF_MODEL, DOMAIN
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from homeassistant.const import CONF_HOST, CONF_MAC

FIXTURES = Path(__file__).parent / "fixtures"
HOST = "192.168.50.51"
MAC = "70:04:1d:12:34:56"
HOSTNAME = "ezgeyser-70041D123456"
QUICK_STATUS = (FIXTURES / "quick_status.json").read_bytes()
DATA = (FIXTURES / "data.json").read_bytes()
CLOUD_STATUS = (FIXTURES / "cloud_status.json").read_bytes()


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    return


@pytest.fixture
def geyser(aioclient_mock: AiohttpClientMocker) -> AiohttpClientMocker:
    """A geyser at `HOST` that answers the three read-only paths with the captured fixtures."""
    aioclient_mock.get(f"http://{HOST}/quickStatus", content=QUICK_STATUS)
    aioclient_mock.get(f"http://{HOST}/data", content=DATA)
    aioclient_mock.get(f"http://{HOST}/cloudStatus", content=CLOUD_STATUS)
    aioclient_mock.get(f"http://{HOST}/api/schedules", content=b"[]")
    return aioclient_mock


@pytest.fixture
def entry() -> MockConfigEntry:
    return MockConfigEntry(
        domain=DOMAIN,
        title="Kitchen",
        unique_id=MAC,
        data={CONF_HOST: HOST, CONF_MAC: MAC, CONF_HOSTNAME: HOSTNAME, CONF_MODEL: "Hybrid geyser · v2"},
    )


@pytest.fixture
def no_setup() -> Generator[None]:
    """Keep config-flow tests from starting the coordinator after an entry is created."""
    with patch("custom_components.ezgeyser.async_setup_entry", return_value=True):
        yield
