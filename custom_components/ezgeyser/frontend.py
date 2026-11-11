"""Serve the bundled card and register it with the dashboard resource loader."""

from pathlib import Path
from urllib.parse import urlsplit

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig  # type: ignore[attr-defined]
from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

CARD_PATH = "/ezgeyser/ezgeyser-card.js"
LEGACY_CARD_PATH = "/local/ezgeyser-card.js"


async def async_register_card(hass: HomeAssistant) -> None:
    """Register once per HA startup; keep user dashboards intact."""
    if "frontend" not in hass.config.components:
        return

    integration = await async_get_integration(hass, "ezgeyser")
    url = f"{CARD_PATH}?v={integration.version}"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_PATH, str(Path(__file__).parent / "www" / "ezgeyser-card.js"), False)]
    )
    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None or not isinstance(lovelace.resources, ResourceStorageCollection):
        # YAML resource lists are user-owned. HA's frontend loader also supports
        # integration-provided modules without changing that configuration.
        add_extra_js_url(hass, url)
        return

    resources = lovelace.resources
    await resources.async_get_info()  # Public API ensures resources are loaded before inspecting them.
    existing = [item for item in resources.async_items() if urlsplit(item["url"]).path in (CARD_PATH, LEGACY_CARD_PATH)]
    if existing:
        await resources.async_update_item(existing[0]["id"], {"url": url, "res_type": "module"})
        for duplicate in existing[1:]:
            await resources.async_delete_item(duplicate["id"])
    else:
        await resources.async_create_item({"url": url, "res_type": "module"})
