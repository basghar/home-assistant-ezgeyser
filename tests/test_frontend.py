"""Dashboard resource registration: normal, upgraded, YAML and headless installs."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from custom_components.ezgeyser.frontend import CARD_PATH, async_register_card
import pytest

from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.dashboard import LovelaceStorage
from homeassistant.components.lovelace.resources import ResourceStorageCollection, ResourceYAMLCollection
from homeassistant.core import HomeAssistant


@pytest.fixture
def frontend(hass: HomeAssistant):
    """Use real HA resource storage, isolating only HTTP and the frontend loader."""
    hass.config.components.add("frontend")
    resources = ResourceStorageCollection(hass, LovelaceStorage(hass, None))
    hass.data[LOVELACE_DATA] = SimpleNamespace(resources=resources)
    with (
        patch.object(hass, "http") as http,
        patch(
            "custom_components.ezgeyser.frontend.async_get_integration", return_value=SimpleNamespace(version="0.4.2")
        ),
        patch("custom_components.ezgeyser.frontend.add_extra_js_url") as extra,
    ):
        http.async_register_static_paths = AsyncMock()
        yield resources, http, extra


async def test_resource_is_added_and_static_file_is_served(hass: HomeAssistant, frontend) -> None:
    resources, http, extra = frontend
    await async_register_card(hass)
    item = next(iter(resources.async_items()))
    assert (item["url"], item["type"]) == (f"{CARD_PATH}?v=0.4.2", "module")
    route = http.async_register_static_paths.call_args.args[0][0]
    assert route.url_path == CARD_PATH
    assert route.path.endswith("/www/ezgeyser-card.js")
    assert route.cache_headers is False
    extra.assert_not_called()


async def test_update_migrates_old_manual_resource_and_preserves_other_cards(hass: HomeAssistant, frontend) -> None:
    resources, _, _ = frontend
    await resources.async_create_item({"url": "/local/other-card.js", "res_type": "module"})
    await resources.async_create_item({"url": "/local/ezgeyser-card.js?v=0.4.1", "res_type": "module"})
    await resources.async_create_item({"url": f"{CARD_PATH}?v=old", "res_type": "module"})
    await async_register_card(hass)
    assert {item["url"] for item in resources.async_items()} == {
        "/local/other-card.js",
        f"{CARD_PATH}?v=0.4.2",
    }


async def test_yaml_resources_are_unchanged_and_frontend_loads_module(hass: HomeAssistant, frontend) -> None:
    _, _, extra = frontend
    resources = ResourceYAMLCollection([{"url": "/local/user.js", "type": "module"}])
    hass.data[LOVELACE_DATA] = SimpleNamespace(resources=resources)
    await async_register_card(hass)
    assert resources.async_items() == [{"url": "/local/user.js", "type": "module"}]
    extra.assert_called_once_with(hass, f"{CARD_PATH}?v=0.4.2")


async def test_headless_install_needs_no_frontend(hass: HomeAssistant) -> None:
    with patch("custom_components.ezgeyser.frontend.async_get_integration") as integration:
        await async_register_card(hass)
        integration.assert_not_called()
